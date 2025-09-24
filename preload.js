const { contextBridge, ipcRenderer } = require('electron');

// Expone APIs protegidas al renderizador
contextBridge.exposeInMainWorld('electronAPI', {
  login: () => ipcRenderer.invoke('login-microsoft'),
  launch: () => ipcRenderer.invoke('launch-game'),
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (_event, value) => callback(value)),
  onGameClosed: (callback) => ipcRenderer.on('game-closed', () => callback()),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (settings) => ipcRenderer.invoke('set-settings', settings),
  openLauncherFolder: () => ipcRenderer.send('open-launcher-folder'),
  reinstallMods: () => ipcRenderer.invoke('reinstall-mods'),
  checkStoredSession: () => ipcRenderer.invoke('check-stored-session'),
  logout: () => ipcRenderer.invoke('logout'),
  getNews: () => ipcRenderer.invoke('get-news'),
  copyToClipboard: (text) => ipcRenderer.send('copy-to-clipboard', text),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', () => callback()),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', () => callback()),
  restartApp: () => ipcRenderer.send('restart-app')
});