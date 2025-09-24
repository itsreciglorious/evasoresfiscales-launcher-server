const { app, BrowserWindow, ipcMain, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const { autoUpdater } = require('electron-updater');
const { Client } = require('minecraft-launcher-core');
const { Auth } = require('msmc');
const { status } = require('minecraft-server-util');

// --- CONFIGURACIÓN ---
const SERVER_IP = 'evasoresfiscales.holy.gg';
const SERVER_PORT = 25796;
const MODS_JSON_URL = 'https://raw.githubusercontent.com/itsreciglorious/evasoresfiscales-mods-server/refs/heads/main/mods.json';
const NEWS_JSON_URL = 'https://raw.githubusercontent.com/itsreciglorious/evasoresfiscales-mods-server/refs/heads/main/news.json';
const MINECRAFT_VERSION = '1.20.1';
const FABRIC_VERSION = '0.17.2';
const MINECRAFT_DIR = path.join(app.getPath('appData'), '.evasoresfiscales');
const SETTINGS_PATH = path.join(MINECRAFT_DIR, 'launcher-settings.json');
const MODS_DIR = path.join(MINECRAFT_DIR, 'mods');
// ---------------------
let mainWindow;
let authManager;
let userProfile;

// --- Lógica de Ajustes ---
const DEFAULT_SETTINGS = {
  ram: {
    max: '6', // en GB
    min: '4'  // en GB
  },
  refreshToken: null
};

function getSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
      return { 
        ...DEFAULT_SETTINGS, 
        ...settings,
        ram: { ...DEFAULT_SETTINGS.ram, ...(settings.ram || {}) }
      };
    }
  } catch (error) {
    console.error("Error al leer los ajustes, usando valores por defecto:", error);
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings) {
  if (!fs.existsSync(MINECRAFT_DIR)) fs.mkdirSync(MINECRAFT_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    icon: path.join(__dirname, 'src/assets/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    resizable: true,
    frame: true,
    titleBarStyle: 'default'
  });

  mainWindow.loadFile('src/index.html');
  mainWindow.setMenu(null);
  autoUpdater.checkForUpdatesAndNotify();
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});

// --- LÓGICA DE IPC (Inter-Process Communication) ---
ipcMain.handle('get-settings', () => {
  return getSettings();
});

ipcMain.handle('set-settings', (event, settings) => {
  saveSettings(settings);
});

ipcMain.on('open-launcher-folder', () => {
  shell.openPath(MINECRAFT_DIR);
});

ipcMain.handle('reinstall-mods', async () => {
  sendUpdateProgress('Borrando caché de mods...', 0);
  if (fs.existsSync(MODS_DIR)) {
    fs.rmSync(MODS_DIR, { recursive: true, force: true });
  }
  sendUpdateProgress('Reinstalando mods...', 10);
  const result = await ipcMain.invoke('check-for-updates');
  return result;
});

ipcMain.handle('get-news', async () => {
  try {
    const response = await axios.get(NEWS_JSON_URL);
    return response.data.articles || [];
  } catch (error) {
    console.error("Error al obtener las noticias:", error.message);
    return [];
  }
});

ipcMain.on('copy-to-clipboard', (event, text) => {
  clipboard.writeText(text);
});

ipcMain.on('restart-app', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('check-stored-session', async () => {
  const settings = getSettings();
  if (settings.refreshToken) {
    try {
      sendUpdateProgress('Intentando reanudar sesión...', 10);
      const authManager = new Auth();
      const xboxManager = await authManager.refresh(settings.refreshToken);
      userProfile = await xboxManager.getMinecraft();
      const newSettings = getSettings();
      newSettings.refreshToken = xboxManager.save();
      saveSettings(newSettings);
      sendUpdateProgress('Sesión reanudada.', 50);
      return {
        name: userProfile.profile.name,
        avatar: `https://mc-heads.net/avatar/${userProfile.profile.id}`
      };
    } catch (error) {
      console.error("Error al refrescar la sesión:", error);
      sendUpdateProgress('La sesión ha expirado. Inicia sesión de nuevo.', 0);
      return null;
    }
  }
  return null;
});

ipcMain.handle('login-microsoft', async () => {
  try {
    const authManager = new Auth('select_account');
    const xboxManager = await authManager.launch('electron');
    userProfile = await xboxManager.getMinecraft();
    const settings = getSettings();
    settings.refreshToken = xboxManager.save();
    saveSettings(settings);
    return {
      name: userProfile.profile.name,
      avatar: `https://mc-heads.net/avatar/${userProfile.profile.id}`
    };
  } catch (error) {
    console.error("Error de autenticación:", error);
    return null;
  }
});

ipcMain.handle('logout', async () => {
  userProfile = null;
  const settings = getSettings();
  settings.refreshToken = null;
  saveSettings(settings);
});

ipcMain.handle('get-server-status', async () => {
  try {
    const serverStatus = await status(SERVER_IP, SERVER_PORT);
    return {
      online: true,
      players: serverStatus.players
    };
  } catch (error) {
    console.error('Error al hacer ping al servidor:', error);
    return { online: false };
  }
});

ipcMain.handle('check-for-updates', async () => {
  sendUpdateProgress('Verificando mods...', 0);
  
  if (!fs.existsSync(MODS_DIR)) {
    fs.mkdirSync(MODS_DIR, { recursive: true });
  }

  try {
    const response = await axios.get(MODS_JSON_URL);
    const remoteMods = response.data.mods;

    const localFiles = fs.readdirSync(MODS_DIR);
    const localModsMap = new Map();

    for (const file of localFiles) {
      const filePath = path.join(MODS_DIR, file);
      const hash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
      localModsMap.set(file, hash);
    }

    const remoteFilenames = new Set(remoteMods.map(mod => mod.filename));
    for (const localFile of localFiles) {
      if (!remoteFilenames.has(localFile)) {
        fs.unlinkSync(path.join(MODS_DIR, localFile));
      }
    }

    for (let i = 0; i < remoteMods.length; i++) {
      const mod = remoteMods[i];
      const progress = ((i + 1) / remoteMods.length) * 100;
      sendUpdateProgress(`Verificando ${mod.name}...`, progress);

      if (!localModsMap.has(mod.filename) || localModsMap.get(mod.filename) !== mod.checksum) {
        sendUpdateProgress(`Descargando ${mod.name}...`, progress);
        await downloadMod(mod.download_url, path.join(MODS_DIR, mod.filename));
      }
    }

    sendUpdateProgress('¡Todo actualizado!', 100);
    return { success: true };
  } catch (error) {
    console.error("Error al verificar mods:", error);
    sendUpdateProgress('Error al actualizar', 100);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('launch-game', async () => {
  if (!userProfile) {
    sendUpdateProgress('Error: No has iniciado sesión.', 100);
    return;
  }

  try {
    sendUpdateProgress('Preparando para lanzar...', 0);
    const fabricVersionName = await ensureFabricInstalled();

    const settings = getSettings();
    const client = new Client();

    const opts = {
      clientPackage: null,
      authorization: userProfile.mclc(),

      root: MINECRAFT_DIR,
      version: {
        number: MINECRAFT_VERSION,
        type: 'release',
        custom: fabricVersionName,
      },
      memory: {
        max: `${settings.ram.max}G`,
        min: `${settings.ram.min}G`
      },
      overrides: {
        detached: true,
        windowsHide: true
      }
    };


    sendUpdateProgress('Iniciando Minecraft...', 75);
    client.launch(opts);

    client.once('data', () => {
      if (mainWindow) mainWindow.hide();
    });

    client.on('debug', (e) => console.log(`[Launcher-Debug] ${e}`));
    client.on('data', (e) => console.log(`[Minecraft] ${e}`));
    client.on('progress', (e) => {
      const progressText = e.type === 'assets' ? 'Descargando assets...' : `Descargando ${e.type}...`;
      sendUpdateProgress(progressText, e.percent);
    });
    client.on('close', (e) => {
      const message = e === 0 ? 'Juego cerrado.' : `El juego cerró con el código de error: ${e}`;
      sendUpdateProgress(message, 100);
      if (mainWindow) {
        mainWindow.show();
        mainWindow.webContents.send('game-closed');
      }
    });

  } catch (error) {
    console.error('Error fatal al lanzar el juego:', error);
    sendUpdateProgress(`Error al lanzar: ${error.message}`, 100);
  }
});

// --- FUNCIONES AUXILIARES ---

function sendUpdateProgress(text, percentage) {
  if (mainWindow) {
    mainWindow.webContents.send('update-progress', { text, percentage });
  }
}

autoUpdater.on('update-available', () => {
  mainWindow.webContents.send('update-available');
});

autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('update-downloaded');
});

async function ensureFabricInstalled() {
  const fabricVersionName = `fabric-loader-${FABRIC_VERSION}-${MINECRAFT_VERSION}`;
  const fabricVersionPath = path.join(MINECRAFT_DIR, 'versions', fabricVersionName);
  const fabricJsonPath = path.join(fabricVersionPath, `${fabricVersionName}.json`);

  if (fs.existsSync(fabricJsonPath)) {
    return fabricVersionName;
  }

  sendUpdateProgress('Instalando Fabric Loader...', 25);
  
  if (!fs.existsSync(fabricVersionPath)) {
    fs.mkdirSync(fabricVersionPath, { recursive: true });
  }

  try {
    const url = `https://meta.fabricmc.net/v2/versions/loader/${MINECRAFT_VERSION}/${FABRIC_VERSION}/profile/json`;
    const response = await axios.get(url);
    fs.writeFileSync(fabricJsonPath, JSON.stringify(response.data, null, 2));
    sendUpdateProgress('Fabric Loader instalado.', 50);
    return fabricVersionName;
  } catch (error) {
    console.error('Error al instalar Fabric Loader:', error);
    sendUpdateProgress('Error al instalar Fabric.', 100);
    throw new Error('No se pudo instalar Fabric Loader.');
  }
}

async function downloadMod(url, dest) {
  const writer = fs.createWriteStream(dest);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}