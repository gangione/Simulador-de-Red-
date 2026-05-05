// Electron preload — bridge seguro entre renderer y main.
// Mantiene contextIsolation:true y nodeIntegration:false.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lobbyAPI', {
  /** Inicia el servidor WS local. Devuelve { port, lanIps[] }. */
  startServer: (opts) => ipcRenderer.invoke('lobby:start-server', opts ?? {}),
  /** Detiene el servidor WS local. */
  stopServer: () => ipcRenderer.invoke('lobby:stop-server'),
  /** Estado del servidor: { running, port, lanIps[] }. */
  getStatus: () => ipcRenderer.invoke('lobby:status'),
  /** IPs LAN del host (sin levantar el servidor). */
  getLanIps: () => ipcRenderer.invoke('lobby:lan-ips'),
});
