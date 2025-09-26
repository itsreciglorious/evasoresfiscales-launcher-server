const { contextBridge, ipcRenderer } = require('electron');

// Expone APIs protegidas al renderizador
contextBridge.exposeInMainWorld('electronAPI', {
  // === AUTENTICACIÓN Y SESIÓN ===
  login: () => ipcRenderer.invoke('login-microsoft'),
  checkStoredSession: () => ipcRenderer.invoke('check-stored-session'),
  logout: () => ipcRenderer.invoke('logout'),
  
  // === JUEGO PRINCIPAL ===
  launch: () => ipcRenderer.invoke('launch-game'),
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),
  
  // === AJUSTES Y CONFIGURACIÓN ===
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (settings) => ipcRenderer.invoke('set-settings', settings),
  resetSettings: () => ipcRenderer.invoke('reset-settings'),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  
  // === GESTIÓN DE ARCHIVOS Y CARPETAS ===
  openLauncherFolder: () => ipcRenderer.send('open-launcher-folder'),
  openModsFolder: () => ipcRenderer.invoke('open-mods-folder'),
  openLogsFolder: () => ipcRenderer.invoke('open-logs-folder'),
  
  // === MANTENIMIENTO Y LIMPIEZA ===
  clearCache: () => ipcRenderer.invoke('clear-cache'),
  verifyGameFiles: () => ipcRenderer.invoke('verify-game-files'),
  clearAccountData: () => ipcRenderer.invoke('clear-account-data'),
  
  // === MODS Y ACTUALIZACIONES ===
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  reinstallMods: () => ipcRenderer.invoke('reinstall-mods'),
  
  // === NOTICIAS Y UTILIDADES ===
  getNews: () => ipcRenderer.invoke('get-news'),
  copyToClipboard: (text) => ipcRenderer.send('copy-to-clipboard', text),
  restartApp: () => ipcRenderer.send('restart-app'),
  
  // === EVENTOS Y CALLBACKS ===
  onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (_event, value) => callback(value)),
  onGameClosed: (callback) => ipcRenderer.on('game-closed', () => callback()),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', () => callback()),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', () => callback()),

  diagnoseMods: () => ipcRenderer.invoke('diagnose-mods')
});
