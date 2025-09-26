const { app, BrowserWindow, ipcMain, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const { autoUpdater } = require('electron-updater');
const { Client } = require('minecraft-launcher-core');
const { Auth } = require('msmc');
const { status } = require('minecraft-server-util');
const log = require('electron-log');

// --- CONFIGURACIÓN ---
const MINECRAFT_DIR = path.join(app.getPath('appData'), '.evasoresfiscales');
if (!fs.existsSync(MINECRAFT_DIR)) {
    fs.mkdirSync(MINECRAFT_DIR, { recursive: true });
}

log.transports.file.resolvePath = () => path.join(MINECRAFT_DIR, 'launcher.log');
log.transports.file.level = 'info';
log.info('=== INICIANDO LAUNCHER ===');
log.info('Directorio del launcher:', MINECRAFT_DIR);

const SERVER_IP = 'evasoresfiscales.holy.gg';
const SERVER_PORT = 25796;
const MODS_JSON_URL = 'https://raw.githubusercontent.com/itsreciglorious/evasoresfiscales-mods-server/main/mods.json';
const NEWS_JSON_URL = 'https://raw.githubusercontent.com/itsreciglorious/evasoresfiscales-mods-server/main/news.json';
const MINECRAFT_VERSION = '1.20.1';
const FABRIC_VERSION = '0.17.2';
const SETTINGS_PATH = path.join(MINECRAFT_DIR, 'launcher-settings.json');
const MODS_DIR = path.join(MINECRAFT_DIR, 'mods');

let mainWindow;
let userProfile;

// --- Lógica de Ajustes ---
const DEFAULT_SETTINGS = {
  ram: { max: '2', min: '1' }, // REDUCIDO para evitar errores de memoria
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
    log.error("Error al leer los ajustes:", error);
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings) {
  try {
    if (!fs.existsSync(MINECRAFT_DIR)) {
      fs.mkdirSync(MINECRAFT_DIR, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (error) {
    log.error("Error al guardar ajustes:", error);
  }
}

function createWindow() {
  console.log('🪟 Creando ventana principal...');
  console.log('📁 Directorio del launcher:', MINECRAFT_DIR);

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
  
  mainWindow.webContents.once('did-finish-load', () => {
    autoUpdater.checkForUpdatesAndNotify().catch(err => {
      log.error('Error checking for updates:', err);
    });
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  log.info('App está lista, creando ventana...');
  createWindow();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});

// === IPC HANDLERS ORGANIZADOS ===

// 1. Handlers de Ajustes
ipcMain.handle('get-settings', () => {
  return getSettings();
});

ipcMain.handle('set-settings', (event, settings) => {
  saveSettings(settings);
});

ipcMain.handle('reset-settings', async () => {
  saveSettings(DEFAULT_SETTINGS);
  return { success: true };
});

// 2. Handlers de Sistema e Información
ipcMain.handle('get-system-info', async () => {
  const os = require('os');
  return {
    totalRAM: Math.floor(os.totalmem() / (1024 * 1024 * 1024)),
    availableRAM: Math.floor(os.freemem() / (1024 * 1024 * 1024))
  };
});

// 3. Handlers de Archivos y Carpetas
ipcMain.on('open-launcher-folder', () => {
  shell.openPath(MINECRAFT_DIR);
});

ipcMain.handle('open-mods-folder', () => {
  shell.openPath(MODS_DIR);
});

ipcMain.handle('open-logs-folder', () => {
  shell.openPath(MINECRAFT_DIR);
});

// 4. Handlers de Mantenimiento (SOLO UNO POR FUNCIÓN)
ipcMain.handle('clear-cache', async () => {
  log.info('🧹 Limpiando caché...');
  const cacheDirs = [
    path.join(MINECRAFT_DIR, 'versions'),
    path.join(MINECRAFT_DIR, 'libraries'),
    path.join(MINECRAFT_DIR, 'assets')
  ];
  
  for (const dir of cacheDirs) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      log.info(`Eliminado: ${dir}`);
    }
  }
  
  return { success: true };
});

ipcMain.handle('verify-game-files', async () => {
  log.info('🔍 Verificando archivos del juego...');
  await verifyMinecraftFiles();
  return { success: true };
});

ipcMain.handle('clear-account-data', async () => {
  userProfile = null;
  const settings = getSettings();
  settings.refreshToken = null;
  saveSettings(settings);
  return { success: true };
});

// 5. Handlers de Mods y Actualizaciones
ipcMain.handle('reinstall-mods', async () => {
  sendUpdateProgress('Borrando caché de mods...', 0);
  if (fs.existsSync(MODS_DIR)) {
    fs.rmSync(MODS_DIR, { recursive: true, force: true });
  }
  sendUpdateProgress('Reinstalando mods...', 10);
  const result = await checkForModUpdates();
  return result;
});

ipcMain.handle('check-for-updates', async () => {
  return await checkForModUpdates();
});

// 6. Handlers de Noticias y Servidor
ipcMain.handle('get-news', async () => {
  try {
    const response = await axios.get(NEWS_JSON_URL);
    return response.data.articles || [];
  } catch (error) {
    console.error("Error al obtener las noticias:", error.message);
    return [];
  }
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

// 7. Handlers de Autenticación
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

// 8. Handlers de Utilidad
ipcMain.on('copy-to-clipboard', (event, text) => {
  clipboard.writeText(text);
});

ipcMain.on('restart-app', () => {
  autoUpdater.quitAndInstall();
});

// 9. Handler Principal - Lanzar Juego
ipcMain.handle('launch-game', async () => {
  if (!userProfile) {
    sendUpdateProgress('Error: No has iniciado sesión.', 100);
    return { success: false, error: 'No autenticado' };
  }

  try {
    log.info('=== INICIANDO PROCESO DE LANZAMIENTO ===');
    sendUpdateProgress('Preparando para lanzar...', 0);

    // Verificar memoria disponible y ajustar
    const memoryInfo = await getAvailableMemory();
    const settings = getSettings();
    
    let maxRAM = Math.min(parseInt(settings.ram.max), Math.floor(memoryInfo.free * 0.6));
    let minRAM = Math.min(parseInt(settings.ram.min), Math.floor(maxRAM * 0.5));
    
    // Asegurar valores mínimos
    maxRAM = Math.max(2, maxRAM);
    minRAM = Math.max(1, minRAM);
    
    log.info(`🎮 Memoria configurada: Min=${minRAM}GB, Max=${maxRAM}GB`);

    const javaPath = await ensureJavaInstalled();
    sendUpdateProgress('Java verificado...', 20);

    const fabricVersionName = await ensureFabricInstalled();
    sendUpdateProgress('Fabric verificado...', 40);

    const client = new Client();

    const opts = {
      authorization: userProfile.mclc(),
      root: MINECRAFT_DIR,
      version: {
        number: MINECRAFT_VERSION,
        type: 'release',
        custom: fabricVersionName,
      },
      memory: {
        max: `${maxRAM}G`,
        min: `${minRAM}G`
      },
      overrides: {
        gameDirectory: MINECRAFT_DIR,
        detached: false,
        windowsHide: false
      },
      jvmArgs: [
        '-XX:+UseG1GC',
        '-XX:MaxGCPauseMillis=50',
        '-XX:-UseAdaptiveSizePolicy',
        '-XX:ConcGCThreads=2'
      ]
    };

    if (javaPath !== 'java') {
      opts.javaPath = javaPath;
    }

    log.info('Opciones de lanzamiento configuradas');
    sendUpdateProgress('Iniciando Minecraft...', 60);

    return new Promise((resolve) => {
      let gameStarted = false;
      let hasError = false;

      client.on('progress', (e) => {
        let progressPercent = 0;
        let progressText = 'Preparando...';
        
        if (e && typeof e === 'object') {
          if (e.percent !== undefined && !isNaN(e.percent)) {
            progressPercent = Math.min(e.percent, 90);
          }
          
          if (e.type) {
            progressText = `Descargando ${e.type}...`;
          }
        }
        
        if (!isNaN(progressPercent)) {
          sendUpdateProgress(progressText, progressPercent);
          log.info(`Progreso: ${progressText} - ${progressPercent}%`);
        }
      });

      client.on('data', (data) => {
        log.info(`[Minecraft] ${data}`);
        
        if (!gameStarted && (data.includes('Loading') || data.includes('Starting'))) {
          gameStarted = true;
          log.info('✅ Minecraft se ha iniciado correctamente!');
          sendUpdateProgress('¡Juego iniciado!', 100);
          if (mainWindow) mainWindow.hide();
          resolve({ success: true });
        }
      });

      client.on('error', (error) => {
        if (!hasError) {
          hasError = true;
          log.error('❌ Error al lanzar Minecraft:', error);
          sendUpdateProgress(`Error: ${error.message}`, 100);
          if (mainWindow) mainWindow.show();
          resolve({ success: false, error: error.message });
        }
      });

      client.on('close', (code) => {
        log.info(`🚪 Minecraft cerró con código: ${code}`);
        
        if (mainWindow) {
          mainWindow.show();
          mainWindow.webContents.send('game-closed');
        }
        
        if (!gameStarted && !hasError) {
          hasError = true;
          resolve({ success: false, error: `Juego cerró con código: ${code}` });
        }
      });

      log.info('Lanzando Minecraft...');
      client.launch(opts);

      setTimeout(() => {
        if (!gameStarted && !hasError) {
          hasError = true;
          log.error('Timeout: El juego no inició en 60 segundos');
          sendUpdateProgress('Error: Timeout al iniciar', 100);
          if (mainWindow) mainWindow.show();
          resolve({ success: false, error: 'Timeout' });
        }
      }, 60000);
    });

  } catch (error) {
    log.error('Error fatal:', error);
    sendUpdateProgress(`Error: ${error.message}`, 100);
    return { success: false, error: error.message };
  }
});

// === FUNCIONES AUXILIARES ===

async function getAvailableMemory() {
  const os = require('os');
  return {
    total: Math.floor(os.totalmem() / (1024 * 1024 * 1024)),
    free: Math.floor(os.freemem() / (1024 * 1024 * 1024))
  };
}

async function checkForModUpdates() {
  sendUpdateProgress('Verificando mods...', 0);
  
  if (!fs.existsSync(MODS_DIR)) {
    fs.mkdirSync(MODS_DIR, { recursive: true });
  }

  try {
    const response = await axios.get(MODS_JSON_URL);
    const remoteMods = response.data.mods;

    // Log para debugging
    log.info(`Mods remotos encontrados: ${remoteMods.length}`);
    remoteMods.forEach(mod => {
      log.info(`Mod: ${mod.name} -> ${mod.filename}`);
    });

    const localFiles = fs.readdirSync(MODS_DIR);
    log.info(`Archivos locales en mods: ${localFiles.length}`);
    localFiles.forEach(file => {
      log.info(`Archivo local: ${file}`);
    });

    const localModsMap = new Map();

    for (const file of localFiles) {
      const filePath = path.join(MODS_DIR, file);
      try {
        const fileBuffer = fs.readFileSync(filePath);
        const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        localModsMap.set(file, hash);
        log.info(`Mod local: ${file} -> Hash: ${hash.substring(0, 16)}...`);
      } catch (error) {
        log.error(`Error leyendo archivo ${file}:`, error);
      }
    }

    // Eliminar mods que ya no están en la lista remota
    const remoteFilenames = new Set(remoteMods.map(mod => mod.filename));
    for (const localFile of localFiles) {
      if (!remoteFilenames.has(localFile)) {
        log.info(`🗑️ Eliminando mod obsoleto: ${localFile}`);
        fs.unlinkSync(path.join(MODS_DIR, localFile));
      }
    }

    // Descargar/actualizar mods
    for (let i = 0; i < remoteMods.length; i++) {
      const mod = remoteMods[i];
      const progress = ((i + 1) / remoteMods.length) * 100;
      
      log.info(`🔍 Verificando mod: ${mod.name} (${mod.filename})`);
      sendUpdateProgress(`Verificando ${mod.name}...`, progress);

      const needsDownload = !localModsMap.has(mod.filename) || localModsMap.get(mod.filename) !== mod.checksum;
      
      if (needsDownload) {
        log.info(`📥 Descargando: ${mod.name}`);
        sendUpdateProgress(`Descargando ${mod.name}...`, progress);
        await downloadMod(mod.download_url, path.join(MODS_DIR, mod.filename));
        log.info(`✅ Descargado: ${mod.name}`);
      } else {
        log.info(`✅ Mod actualizado: ${mod.name}`);
      }
    }

    // Verificar archivos finales
    const finalFiles = fs.readdirSync(MODS_DIR);
    log.info(`Mods instalados finales: ${finalFiles.length}`);
    finalFiles.forEach(file => {
      log.info(`Mod instalado: ${file}`);
    });

    sendUpdateProgress('¡Todos los mods actualizados!', 100);
    return { success: true, modsCount: finalFiles.length };
  } catch (error) {
    log.error("Error al verificar mods:", error);
    sendUpdateProgress('Error al actualizar mods', 100);
    return { success: false, error: error.message };
  }
}

ipcMain.handle('diagnose-mods', async () => {
  log.info('Iniciando diagnóstico de mods...');
  
  if (!fs.existsSync(MODS_DIR)) {
    return { success: false, error: 'Carpeta de mods no existe' };
  }

  const mods = fs.readdirSync(MODS_DIR);
  const diagnosis = [];

  for (const modFile of mods) {
    try {
      const filePath = path.join(MODS_DIR, modFile);
      const stats = fs.statSync(filePath);
      
      diagnosis.push({
        file: modFile,
        size: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
        isValid: modFile.endsWith('.jar'),
        path: filePath
      });
      
      log.info(`Mod: ${modFile} - ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    } catch (error) {
      diagnosis.push({
        file: modFile,
        error: error.message,
        isValid: false
      });
    }
  }

  log.info(`🔧 Diagnóstico completado. Mods encontrados: ${mods.length}`);
  return { success: true, mods: diagnosis, total: mods.length };
});

async function verifyMinecraftFiles() {
  const versionsDir = path.join(MINECRAFT_DIR, 'versions');
  const fabricVersionName = `fabric-loader-${FABRIC_VERSION}-${MINECRAFT_VERSION}`;
  const fabricDir = path.join(versionsDir, fabricVersionName);
  
  if (!fs.existsSync(fabricDir)) {
    await ensureFabricInstalled();
  }
}

function sendUpdateProgress(text, percentage) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-progress', { text, percentage });
  }
}

async function ensureJavaInstalled() {
  log.info('Verificando Java...');
  
  try {
    const { execSync } = require('child_process');
    const javaVersion = execSync('java -version 2>&1').toString();
    if (javaVersion.includes('version')) {
      log.info('✅ Java del sistema encontrado');
      return 'java';
    }
  } catch (error) {
    log.info('Java del sistema no encontrado');
  }

  const javaDir = path.join(MINECRAFT_DIR, 'jre');
  const javaExePath = path.join(javaDir, 'bin', 'java.exe');

  if (fs.existsSync(javaExePath)) {
    log.info('✅ Java embebido encontrado');
    return javaExePath;
  }

  log.info('Descargando Java embebido...');
  sendUpdateProgress('Descargando Java...', 10);

  try {
    const javaUrl = 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jre/hotspot/normal/eclipse';
    const tempZipPath = path.join(MINECRAFT_DIR, 'java_temp.zip');
    
    const response = await axios({
      url: javaUrl,
      method: 'GET',
      responseType: 'stream'
    });
    
    const writer = fs.createWriteStream(tempZipPath);
    response.data.pipe(writer);
    
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    sendUpdateProgress('Extrayendo Java...', 30);
    
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(tempZipPath);
    zip.extractAllTo(MINECRAFT_DIR, true);
    
    fs.unlinkSync(tempZipPath);
    
    log.info('✅ Java instalado correctamente');
    return javaExePath;
  } catch (error) {
    log.error('❌ Error instalando Java:', error);
    throw new Error(`No se pudo instalar Java: ${error.message}`);
  }
}

async function ensureFabricInstalled() {
  const fabricVersionName = `fabric-loader-${FABRIC_VERSION}-${MINECRAFT_VERSION}`;
  const fabricVersionPath = path.join(MINECRAFT_DIR, 'versions', fabricVersionName);
  const fabricJsonPath = path.join(fabricVersionPath, `${fabricVersionName}.json`);

  if (fs.existsSync(fabricJsonPath)) {
    log.info('✅ Fabric ya está instalado');
    return fabricVersionName;
  }

  log.info('📥 Instalando Fabric Loader...');
  sendUpdateProgress('Instalando Fabric...', 25);

  if (!fs.existsSync(fabricVersionPath)) {
    fs.mkdirSync(fabricVersionPath, { recursive: true });
  }

  try {
    const url = `https://meta.fabricmc.net/v2/versions/loader/${MINECRAFT_VERSION}/${FABRIC_VERSION}/profile/json`;
    const response = await axios.get(url);
    fs.writeFileSync(fabricJsonPath, JSON.stringify(response.data, null, 2));
    log.info('✅ Fabric Loader instalado correctamente');
    sendUpdateProgress('Fabric instalado', 50);
    return fabricVersionName;
  } catch (error) {
    log.error('❌ Error al instalar Fabric:', error);
    throw new Error(`No se pudo instalar Fabric: ${error.message}`);
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

// === AUTO UPDATER EVENTS ===
autoUpdater.on('error', (error) => {
  log.error('Error en autoUpdater:', error);
});

autoUpdater.on('update-available', () => {
  log.info('Actualización disponible');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-available');
  }
});

autoUpdater.on('update-not-available', () => {
  log.info('No hay actualizaciones disponibles');
});

autoUpdater.on('update-downloaded', () => {
  log.info('Actualización descargada');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-downloaded');
  }
});
