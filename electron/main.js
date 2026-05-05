// Electron main process entry point.
// Loaded by vite-plugin-electron in dev mode and bundled to dist-electron in build.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const { fork } = require('child_process');

const isDev = !app.isPackaged && process.env.VITE_DEV_SERVER_URL;

/** @type {import('child_process').ChildProcess | null} */
let lobbyProc = null;
let lobbyPort = 0;

function resolveServerEntry() {
  // En dev y prod apuntamos al bundle compilado por `tsc -p tsconfig.server.json`.
  // En prod (packaged), `extraResources` copia `server-dist/` a `process.resourcesPath/server`.
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'server', 'gameServer.js');
  }
  return path.join(__dirname, '..', 'server-dist', 'gameServer.js');
}

function getLanIps() {
  const out = [];
  const ifs = os.networkInterfaces();
  for (const name of Object.keys(ifs)) {
    for (const i of ifs[name] ?? []) {
      if (i.family === 'IPv4' && !i.internal) out.push({ name, address: i.address });
    }
  }
  return out;
}

function startLobbyServer({ port = 7331 } = {}) {
  return new Promise((resolve, reject) => {
    if (lobbyProc) {
      return resolve({ port: lobbyPort, lanIps: getLanIps(), alreadyRunning: true });
    }
    const entry = resolveServerEntry();
    const child = fork(entry, ['--port', String(port)], {
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    let resolved = false;
    child.on('message', (m) => {
      if (m && m.type === 'ready' && !resolved) {
        resolved = true;
        lobbyProc = child;
        lobbyPort = m.port;
        resolve({ port: m.port, lanIps: getLanIps(), alreadyRunning: false });
      }
    });
    child.stdout?.on('data', (d) => process.stdout.write(`[lobby] ${d}`));
    child.stderr?.on('data', (d) => process.stderr.write(`[lobby] ${d}`));
    child.on('exit', (code) => {
      lobbyProc = null;
      lobbyPort = 0;
      if (!resolved) reject(new Error(`gameServer terminó antes de iniciar (exit ${code}).`));
    });
    // Fallback timeout: si en 4s no manda 'ready', resolvemos igual asumiendo
    // que arrancó (algunos antivirus retienen IPC).
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        lobbyProc = child;
        lobbyPort = port;
        resolve({ port, lanIps: getLanIps(), alreadyRunning: false });
      }
    }, 4000);
  });
}

function stopLobbyServer() {
  if (!lobbyProc) return Promise.resolve({ stopped: false });
  return new Promise((resolve) => {
    const proc = lobbyProc;
    proc.once('exit', () => resolve({ stopped: true }));
    try { proc.send('shutdown'); } catch {}
    setTimeout(() => { try { proc.kill(); } catch {} }, 1500);
    lobbyProc = null;
    lobbyPort = 0;
  });
}

ipcMain.handle('lobby:start-server', (_e, opts) => startLobbyServer(opts));
ipcMain.handle('lobby:stop-server', () => stopLobbyServer());
ipcMain.handle('lobby:status', () => ({
  running: !!lobbyProc, port: lobbyPort, lanIps: getLanIps(),
}));
ipcMain.handle('lobby:lan-ips', () => getLanIps());

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1024,
    minHeight: 768,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#0a0e14',
    icon: path.join(__dirname, '..', 'secure-sonetcyber-game.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Mostrar solo cuando el contenido esté listo: evita el flash blanco
  // característico de Electron al abrir el .exe.
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
  stopLobbyServer().finally(() => {
    if (process.platform !== 'darwin') app.quit();
  });
});

app.on('before-quit', () => {
  if (lobbyProc) { try { lobbyProc.kill(); } catch {} }
});
