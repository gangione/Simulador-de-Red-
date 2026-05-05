import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const electronDir = path.resolve(process.cwd(), 'electron');
const electronEntry = path.join(electronDir, 'main.js');

const electronMainTemplate = `// Electron main process entry point.
// Loaded by vite-plugin-electron in dev mode and bundled to dist-electron in build.
const { app, BrowserWindow } = require('electron');
const path = require('path');

const isDev = !app.isPackaged && process.env.VITE_DEV_SERVER_URL;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1024,
    minHeight: 768,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#0a0e14',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
`;

mkdirSync(electronDir, { recursive: true });

if (!existsSync(electronEntry)) {
  writeFileSync(electronEntry, electronMainTemplate, 'utf8');
  console.log('[ensure-electron-entry] Creado electron/main.js');
}

const preloadEntry = path.join(electronDir, 'preload.js');
const preloadTemplate = `// Electron preload — bridge seguro entre renderer y main.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('lobbyAPI', {
  startServer: (opts) => ipcRenderer.invoke('lobby:start-server', opts ?? {}),
  stopServer: () => ipcRenderer.invoke('lobby:stop-server'),
  getStatus: () => ipcRenderer.invoke('lobby:status'),
  getLanIps: () => ipcRenderer.invoke('lobby:lan-ips'),
});
`;
if (!existsSync(preloadEntry)) {
  writeFileSync(preloadEntry, preloadTemplate, 'utf8');
  console.log('[ensure-electron-entry] Creado electron/preload.js');
}