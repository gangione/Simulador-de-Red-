# 02 · Stack técnico

## Resumen

| Capa            | Tecnología                                 |
|-----------------|--------------------------------------------|
| Lenguaje        | **TypeScript 5.4** (modo `strict` en renderer y server) |
| Bundler         | **Vite 5** + `vite-plugin-electron 0.28`   |
| Renderer        | HTML5 + CSS3 puros (sin frameworks UI)     |
| Runtime         | **Electron 29** (Chromium + Node)          |
| Game server     | **Node + `ws` 8** compilado con `tsconfig.server.json` (salida `server-dist/`) y forkeado por Electron |
| Empaquetado     | `electron-builder 24.9` (target NSIS Windows). `extraResources` copia `server-dist/` y `node_modules/ws` |
| Persistencia    | `sessionStorage` (vía `IStorageProvider`) + `localStorage` para guardado durable |
| IA (Fase 2)     | Interfaz `IAIAgent` con `StubAIAgent` por defecto, listo para enchufar Ollama / OpenAI / LLM local |
| Tests           | Planificado: Vitest (unit) + Playwright (E2E) — ver [09 · Roadmap](09-roadmap.md) |

## Decisiones técnicas y por qué

### TypeScript estricto

El proyecto compila con `strict: true` en **dos targets independientes**:

| Config                  | Qué compila                                        | Salida          |
|-------------------------|----------------------------------------------------|-----------------|
| `tsconfig.json`         | Renderer + `electron/` + `server/protocol.ts`      | `dist/` (Vite)  |
| `tsconfig.server.json`  | `server/**/*.ts` (game server)                     | `server-dist/`  |

El server activa además `noUncheckedIndexedAccess` y `noImplicitOverride`
para forzar narrowing explícito y dejar los `override` evidentes en los
modos. El renderer ejecuta `tsc --noEmit` antes de cada build. Esto:

- detecta errores de tipo antes de llegar al runtime;
- documenta los contratos entre capas a nivel de tipos;
- facilita refactors seguros (renombrado de campos, cambio de firmas);
- comparte un único contrato WS (`server/protocol.ts`) entre cliente y
  servidor vía `import type`. Cualquier cambio en el protocolo rompe en
  compile-time en ambos lados.

### Vite + vite-plugin-electron

- **Vite** da hot-reload instantáneo del renderer y bundles eficientes.
- **vite-plugin-electron** compila `electron/main.js` y arranca Electron
  apuntando al servidor de desarrollo (`VITE_DEV_SERVER_URL`). En producción
  carga `dist/index.html` directamente.

`vite.config.ts` controla:
- entrada del proceso main: `electron/main.js`
- salida del main: `dist-electron/`
- salida del renderer: `dist/`

### Electron 29

Configuración de seguridad:

```js
webPreferences: {
  contextIsolation: true,
  nodeIntegration:  false,
}
```

Esto significa que el renderer **no tiene acceso directo a Node**. Toda la
lógica del simulador es 100 % cliente, sin necesidad de IPC al main process.

### Sin frameworks UI

Decisión pedagógica explícita: HTML/CSS puros. Permite que:
- los alumnos vean exactamente qué hace cada nodo del DOM;
- el `BaseView` ejemplifique el patrón Template Method sin magia de framework;
- la curva de aprendizaje sea baja para sumarse a contribuir.

### Persistencia en dos niveles

Los modelos hablan con `IStorageProvider` (interfaz pequeña). La
implementación concreta `SessionStorageProvider` añade dos métodos extra:

| Método             | Para qué                                                            |
|--------------------|---------------------------------------------------------------------|
| `persist()`        | Copia `sessionStorage` → `localStorage` con prefijo `sim:`          |
| `restore()`        | Restaura `sim:*` de `localStorage` → `sessionStorage` al arrancar   |
| `hasPersisted()`   | True si existe alguna clave `sim:*` (para confirmar sobrescritura)  |

El comando `save` invoca `persist()` después de pedir un `snapshot()` a
modelos en memoria.

### Sistema de eventos (Observer)

`EventBus` es la única vía de comunicación entre capas. Esto desacopla
totalmente vistas y modelos:

- Una vista nueva sólo se suscribe a los eventos que necesita.
- Un controlador nuevo emite eventos sin saber quién escucha.
- En **Fase 3** (multijugador) un `GameServer` puede inyectar un bus
  alternativo que retransmita eventos por WebSocket sin tocar nada más.

### electron-builder

`package.json` declara el target Windows NSIS con `appId:
com.tecnica10.simulador` y separa la salida de `electron-builder` en
`release/` para no mezclarla con los bundles de Vite (`dist/` y
`dist-electron/`). `npm run package` genera el instalador `.exe` en esa
carpeta.

## Compatibilidad y portabilidad

- **Windows 10/11** — soportado oficialmente, con instalador NSIS.
- **macOS** y **Linux** — funcionan en desarrollo (`npm run dev` y
  `npm start`); los targets de empaquetado se pueden agregar a
  `package.json` cuando haga falta.
- **Offline** — el simulador no requiere conexión a internet. La única
  dependencia online opcional es el `IAIAgent` real (Fase 2).

## Referencias

- Configuración Vite: [`vite.config.ts`](../vite.config.ts)
- Entry de Electron: [`electron/main.js`](../electron/main.js)
- TS strict: [`tsconfig.json`](../tsconfig.json)
- Build/empaquetado: [`package.json`](../package.json)
