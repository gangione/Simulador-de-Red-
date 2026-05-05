# 02 · Stack técnico

## Resumen

| Capa            | Tecnología                                 |
|-----------------|--------------------------------------------|
| Lenguaje        | **TypeScript 5.4** (modo `strict` en renderer y server) |
| Bundler         | **Vite 5** + `vite-plugin-electron 0.28`   |
| Renderer        | HTML5 + CSS3 puros (sin frameworks UI)     |
| Runtime         | **Electron 29** (Chromium + Node, `contextIsolation: true`) |
| Game server     | **Node + `ws` 8**, código **100 % TypeScript** compilado con `tsconfig.server.json` → `server-dist/`, forkeado por Electron |
| Preload         | `electron/preload.js` — expone `window.lobbyAPI` al renderer vía `contextBridge` |
| Empaquetado     | `electron-builder 24.9` (target NSIS Windows). `extraResources` copia `server-dist/` y `node_modules/ws` |
| Persistencia    | `sessionStorage` (vía `IStorageProvider`) + `localStorage` para guardado durable |
| IA (Fase 2)     | Interfaz `IAIAgent`; `OllamaAIAgent.ts` skeleton presente, `StubAIAgent` por defecto |
| Tests           | Planificado: Vitest (unit) + Playwright (E2E) — ver [09 · Roadmap](09-roadmap.md) |

## Decisiones técnicas y por qué

### TypeScript estricto — doble compilación

El proyecto compila con `strict: true` en **dos targets independientes**:

| Config                  | Qué compila                                        | Salida          |
|-------------------------|----------------------------------------------------|-----------------|
| `tsconfig.json`         | Renderer + `electron/` + `server/protocol.ts`      | `dist/` (Vite)  |
| `tsconfig.server.json`  | `server/**/*.ts` (game server completo)            | `server-dist/`  |

El server activa además `noUncheckedIndexedAccess` y `noImplicitOverride`
para forzar narrowing explícito y dejar los `override` evidentes en los
modos.

> **Regla clave**: **nunca reintroduzcas `.mjs`** en `server/`. El código
> del servidor es 100 % TypeScript puro. Esta regla está documentada en
> [`AGENTS.md §2`](../AGENTS.md), regla 4.

Beneficios:
- Detecta errores de tipo antes del runtime.
- Documenta contratos entre capas a nivel de tipos.
- Facilita refactors seguros.
- Comparte el contrato WS (`server/protocol.ts`) entre cliente y servidor
  vía `import type`. Cualquier cambio rompe en compile-time en ambos lados.

### Vite + vite-plugin-electron

- **Vite** da hot-reload instantáneo del renderer y bundles eficientes.
- **vite-plugin-electron** compila `electron/main.js` y arranca Electron
  apuntando al servidor de desarrollo (`VITE_DEV_SERVER_URL`). En producción
  carga `dist/index.html` directamente.

`vite.config.ts` controla:
- entrada del proceso main: `electron/main.js`
- salida del main: `dist-electron/`
- salida del renderer: `dist/`

### Electron 29 — seguridad y preload

Configuración de seguridad:

```js
webPreferences: {
  contextIsolation: true,
  nodeIntegration:  false,
}
```

El renderer no tiene acceso directo a Node. El `electron/preload.js`
expone únicamente la API necesaria con `contextBridge`:

```js
contextBridge.exposeInMainWorld('lobbyAPI', {
  startServer: (port) => ipcRenderer.invoke('lobby:start', port),
  stopServer:  ()     => ipcRenderer.invoke('lobby:stop'),
  getStatus:   ()     => ipcRenderer.invoke('lobby:status'),
  getLanIps:   ()     => ipcRenderer.invoke('lobby:lan-ips'),
});
```

`window.lobbyAPI` está tipado en `src/types/index.ts` para que el
renderer lo use de forma segura.

### Sin frameworks UI

Decisión pedagógica explícita: HTML/CSS puros (regla 6 de `AGENTS.md`). Permite:
- Ver exactamente qué hace cada nodo del DOM.
- Que `BaseView` ejemplifique el patrón Template Method sin magia de framework.
- Que la curva de aprendizaje sea baja para contribuidores nuevos.

### Persistencia en dos niveles

Los modelos hablan con `IStorageProvider` (interfaz pequeña). La
implementación concreta `SessionStorageProvider` añade dos métodos extra:

| Método             | Para qué                                                            |
|--------------------|---------------------------------------------------------------------|
| `persist()`        | Copia `sessionStorage` → `localStorage` con prefijo `sim:`          |
| `restore()`        | Restaura `sim:*` de `localStorage` → `sessionStorage` al arrancar   |
| `hasPersisted()`   | True si existe alguna clave `sim:*` (para confirmar sobrescritura)  |

### Sistema de eventos (Observer)

`EventBus` es la única vía de comunicación entre capas. Esto desacopla
totalmente vistas y modelos:

- Una vista nueva sólo se suscribe a los eventos que necesita.
- Un controlador nuevo emite eventos sin saber quién escucha.
- En **Fase 3** (multijugador), `LobbyService` traduce mensajes WS a
  eventos del bus sin que ninguna otra capa sepa que existe WebSocket.

### electron-builder

`package.json` declara el target Windows NSIS con `appId:
com.tecnica10.simulador`. `npm run package` genera el instalador `.exe`
en `release/`.

`extraResources` copia `server-dist/` y `node_modules/ws` al paquete
para que Electron pueda forkear el game server sin dependencias externas.

### `@types/ws`

Paquete de tipos necesario para que `server/**/*.ts` compile sin errores
bajo `tsconfig.server.json`. Solo está en `devDependencies`.

## Compatibilidad

- **Windows 10/11** — soportado oficialmente, con instalador NSIS.
- **macOS** y **Linux** — funcionan en desarrollo (`npm run dev` y `npm start`).
- **Offline** — no requiere conexión a internet. La única dependencia online
  opcional es el `IAIAgent` real (Fase 2, interfaz lista).

## Referencias

- Configuración Vite: [`vite.config.ts`](../vite.config.ts)
- Entry de Electron: [`electron/main.js`](../electron/main.js)
- Preload bridge: [`electron/preload.js`](../electron/preload.js)
- TS renderer: [`tsconfig.json`](../tsconfig.json)
- TS server: [`tsconfig.server.json`](../tsconfig.server.json)
- Build/empaquetado: [`package.json`](../package.json)
