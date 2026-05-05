# 03 · Estructura del proyecto

```
Simulador-de-Red-/
├── electron/
│   ├── main.js                  # Proceso principal de Electron (BrowserWindow + IPC + fork del game server)
│   └── preload.js               # contextBridge → expone window.lobbyAPI al renderer
├── scripts/
│   └── ensure-electron-entry.mjs  # Validator: verifica que electron/main.js existe antes del build
├── server/                      # Game server multijugador (Fase 3 — 100 % TypeScript)
│   ├── gameServer.ts            # WebSocketServer + salas + reconexión + heartbeat
│   ├── protocol.ts              # Contrato compartido (uniones discriminadas ClientMsg/ServerMsg)
│   ├── words.ts                 # Generador de códigos de sala aleatorios (4 letras)
│   └── modes/                   # Modos de partida (patrón Open/Closed)
│       ├── base.ts              # BaseMode (abstract) con tickCommon, handleAction, scoring
│       ├── index.ts             # Dispatcher: createMode(opts) → ModeEngine
│       ├── redVsBlue.ts         # Modo PvP asimétrico por equipos
│       ├── capture.ts           # Toma de servidores neutrales (simétrico)
│       ├── coop.ts              # Defensa cooperativa contra oleadas de bots
│       └── ffa.ts               # Free-for-all individual
├── src/
│   ├── main.ts                  # Composition root: instancia y conecta todo el MVC
│   ├── style.css                # Estilos del renderer (terminal + dashboard + lobby + toast)
│   ├── controllers/
│   │   ├── AppController.ts     # Orquestador: EventBus ↔ comandos ↔ modelos
│   │   ├── CommandController.ts # Dispatcher Open/Closed de ICommand (registro por map)
│   │   └── commands/
│   │       ├── HelpCommands.ts        # help / mision / foco / abortar / exit / save / tutoriales / IA
│   │       ├── NetworkCommands.ts     # ipconfig / arp / ping / netstat / nmap / netsh / crack / ...
│   │       ├── FileSystemCommands.ts  # dir / cd / mkdir / del / type / tree / echo / net / tasklist / ...
│   │       ├── AudioCommands.ts       # volumen / mute / play / pause
│   │       └── LobbyCommands.ts       # lobby / hostear / unirse / equipo / listo / leave
│   ├── data/
│   │   ├── missions.data.ts     # Catálogo de las 18 misiones (IDs, objetivos, regex)
│   │   ├── modes.data.ts        # Metadata pedagógica de los 4 modos (título, resumen, tips)
│   │   ├── network.data.ts      # Topología y los 60 hosts virtuales
│   │   ├── tips.data.ts         # Glosario rápido del "Tip del día" (home pane)
│   │   └── vfs.data.ts          # Estructura inicial del Virtual File System
│   ├── models/
│   │   ├── MissionModel.ts      # Estado: misiones activas, foco, evaluación de pasos
│   │   ├── NetworkModel.ts      # Estado: IP propia, gateway, firewall, hosts
│   │   ├── UserModel.ts         # Estado: tutoriales completados, rango, historial
│   │   └── FileSystemModel.ts   # Estado: VFS en memoria (cwd, mkdir, del, ...)
│   ├── services/
│   │   ├── EventBus.ts          # Observer pub/sub + enum Events con los 35 nombres canónicos
│   │   ├── StorageService.ts    # IStorageProvider + SessionStorageProvider + persist/restore
│   │   ├── AIAgentService.ts    # IAIAgent + StubAIAgent (hook para Fase 2)
│   │   ├── OllamaAIAgent.ts     # Skeleton de implementación contra Ollama local (Fase 2)
│   │   ├── AudioService.ts      # Efectos sonoros opcionales (BGM, UI sounds)
│   │   ├── ConfirmService.ts    # Modal de confirmación reutilizable (acciones destructivas)
│   │   └── LobbyService.ts      # Cliente WS → traduce mensajes protocol.ts a eventos lobby:*
│   ├── types/
│   │   ├── command.types.ts     # ICommand, ICommandContext, ICommandResult
│   │   ├── mission.types.ts     # IMission, IMissionStep
│   │   ├── network.types.ts     # IHost, INetworkState, IFirewallRule
│   │   ├── vfs.types.ts         # IVFSNode, tipo directorio/archivo
│   │   └── index.ts             # Re-exports y TutorialKey + tipos globales (window.lobbyAPI)
│   └── views/
│       ├── BaseView.ts          # Clase abstracta (Template Method) — toda vista la extiende
│       ├── TerminalView.ts      # Terminal: input, output, historial, banner, autocompletado
│       ├── DashboardView.ts     # Panel derecho: estado de red, gauges CPU/RAM/LAN, misión activa
│       ├── LobbyView.ts         # Sala multijugador: host/join/chat/team/aprobación de joins
│       ├── MatchHudView.ts      # HUD durante partida: timer, scores, eventos de captura
│       ├── SettingsView.ts      # Preferencias del jugador (audio, display)
│       └── ToastView.ts         # Notificaciones no bloqueantes con acciones inline (dismiss por id)
├── server-dist/                 # ⚠️ Generado por `npm run build:server` (no se commitea)
├── dist/                        # ⚠️ Generado por Vite (no se commitea)
├── dist-electron/               # ⚠️ Generado por vite-plugin-electron (no se commitea)
├── docs/                        # Esta documentación (guía de aprendizaje)
├── index.html                   # Markup base del renderer
├── package.json                 # Dependencias + scripts npm (dev/build/build:server/package)
├── tsconfig.json                # TS strict: renderer + electron + server/protocol.ts
├── tsconfig.server.json         # TS strict del game server (NodeNext + noUncheckedIndexedAccess)
├── vite.config.ts               # Vite + plugin Electron
├── AGENTS.md                    # 10 reglas inviolables + recetas de contribución
├── README.md                    # Resumen del proyecto + índice de docs
└── PLAN.md                      # Estado de fases (pointer → docs/09-roadmap.md)
```

## Lectura recomendada paso a paso

Para entender el simulador de adentro hacia afuera:

1. [`src/types/`](../src/types/) — los contratos de tipos primero.
2. [`src/services/EventBus.ts`](../src/services/EventBus.ts) — la columna vertebral de la comunicación.
3. [`src/services/StorageService.ts`](../src/services/StorageService.ts) — la capa de persistencia.
4. [`src/data/`](../src/data/) — los datos de partida (misiones, red, VFS, tips, modos).
5. [`src/models/`](../src/models/) — el estado del dominio.
6. [`src/views/BaseView.ts`](../src/views/BaseView.ts) → vistas concretas.
7. [`src/controllers/CommandController.ts`](../src/controllers/CommandController.ts)
   → [`AppController.ts`](../src/controllers/AppController.ts) → comandos.
8. [`src/main.ts`](../src/main.ts) — el bootstrap final que une todo.
9. [`server/protocol.ts`](../server/protocol.ts) → [`server/gameServer.ts`](../server/gameServer.ts) → modos.

Cada archivo tiene una cabecera narrativa en español y TSDoc en sus métodos
públicos para que la lectura sea autocontenida.

## ¿Dónde agrego X?

| Tarea | Carpeta / archivo clave |
|-------|------------------------|
| Nuevo comando de terminal | `src/controllers/commands/` + registro en `src/main.ts` |
| Nueva misión | `src/data/missions.data.ts` |
| Nuevo modo de juego | `server/modes/` + registro en `server/modes/index.ts` + tipo en `server/protocol.ts` |
| Nuevo mensaje WS | `server/protocol.ts` → handler en `server/gameServer.ts` + `src/services/LobbyService.ts` |
| Nuevo evento del bus | `src/services/EventBus.ts` → documentar en `docs/07-eventos.md` |
| Nueva vista | `src/views/` extendiendo `BaseView` |
| Nueva capa de persistencia | Implementar `IStorageProvider` en `src/services/` |

Ver recetas detalladas en [`AGENTS.md §3–§6`](../AGENTS.md).
