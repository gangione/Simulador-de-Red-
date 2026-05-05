# 03 · Estructura del proyecto

```
Simulador-de-Red-/
├── electron/
│   └── main.js                  # Proceso principal de Electron (BrowserWindow + fork del game server)
├── server/                      # Game server multijugador (Fase 3, TypeScript estricto)
│   ├── gameServer.ts            # WebSocketServer + salas + reconexión + heartbeat
│   ├── protocol.ts              # Contrato compartido (uniones discriminadas ClientMsg/ServerMsg)
│   ├── words.ts                 # Wordlists para generar códigos de sala
│   └── modes/                   # Modos de partida (Open/Closed)
│       ├── base.ts              # BaseMode (abstract) con tickCommon, handleAction, scoring
│       ├── index.ts             # Dispatcher (createMode + pickServers)
│       ├── redVsBlue.ts         # Modo PvP por equipos
│       ├── capture.ts           # Toma de servidores neutrales
│       ├── coop.ts              # Defensa cooperativa contra oleadas
│       └── ffa.ts               # Free-for-all
├── src/
│   ├── main.ts                  # Composition root: instancia y conecta MVC
│   ├── style.css                # Estilos del renderer (terminal + dashboard + lobby)
│   ├── controllers/
│   │   ├── AppController.ts     # Orquestador: conecta EventBus ↔ comandos ↔ modelos
│   │   ├── CommandController.ts # Dispatcher (registro Open/Closed) de ICommand
│   │   └── commands/
│   │       ├── HelpCommands.ts        # help / mision / foco / abortar / exit / save / tutoriales / IA
│   │       ├── NetworkCommands.ts     # ipconfig / arp / ping / netstat / nmap / netsh / ...
│   │       └── FileSystemCommands.ts  # dir / cd / mkdir / del / type / tree / echo
│   ├── data/
│   │   ├── missions.data.ts     # Catálogo de las 18 misiones (objetivos + regex)
│   │   ├── network.data.ts      # Topología y 60 hosts virtuales
│   │   ├── tips.data.ts         # Glosario rápido del "Tip del día" (home pane)
│   │   └── vfs.data.ts          # Estructura inicial del Virtual File System
│   ├── models/
│   │   ├── MissionModel.ts      # Estado: misiones activas, foco, evaluación de pasos
│   │   ├── NetworkModel.ts      # Estado: IP propia, gateway, firewall, hosts
│   │   ├── UserModel.ts         # Estado: tutoriales, rango, historial
│   │   └── FileSystemModel.ts   # Estado: VFS (cwd, mkdir, del, ...)
│   ├── services/
│   │   ├── EventBus.ts          # Observer pub/sub + nombres canónicos de eventos
│   │   ├── StorageService.ts    # IStorageProvider + SessionStorageProvider + persist/restore
│   │   ├── AIAgentService.ts    # IAIAgent + StubAIAgent (hook para Fase 2)
│   │   ├── OllamaAIAgent.ts     # Implementación contra Ollama local
│   │   ├── AudioService.ts      # Efectos sonoros opcionales
│   │   └── LobbyService.ts      # Cliente WS → traduce protocol.ts a eventos lobby:*
│   ├── types/
│   │   ├── command.types.ts     # ICommand, ICommandContext, ICommandResult
│   │   ├── mission.types.ts     # IMission, IMissionStep
│   │   ├── network.types.ts     # IHost, INetworkState, IFirewallRule
│   │   ├── vfs.types.ts         # IVFSNode, tipo de directorio/archivo
│   │   └── index.ts             # Re-exports y TutorialKey
│   └── views/
│       ├── BaseView.ts          # Clase abstracta (Template Method)
│       ├── TerminalView.ts      # Terminal: input, output, historial, banner
│       ├── DashboardView.ts     # Panel derecho: estado, gauges CPU/RAM/LAN y misión
│       ├── LobbyView.ts         # Sala multijugador (host/join/chat/aprobaciones)
│       ├── MatchHudView.ts      # HUD durante partida (timer, scores, eventos)
│       └── SettingsView.ts      # Preferencias
├── server-dist/                  # ⚠️ Generado por `tsc -p tsconfig.server.json` (no se commitea)
├── docs/                        # Esta documentación
├── index.html                   # Markup base del renderer
├── package.json                 # Dependencies + scripts npm (build:server incluido)
├── tsconfig.json                # TS strict (renderer + electron + server/protocol.ts)
├── tsconfig.server.json         # TS strict del game server (NodeNext + override + indexed access)
├── vite.config.ts               # Vite + plugin Electron
├── AGENTS.md                    # Reglas de contribución (humanas e IA)
├── README.md                    # Presentación del proyecto
└── PLAN.md                      # Plan original (histórico)
```

## Lectura recomendada paso a paso

Si querés entender el simulador "como si lo estuvieras corriendo en tu
cabeza", seguí los archivos en este orden:

1. [`src/types/`](../src/types/) — los contratos de tipos primero.
2. [`src/services/EventBus.ts`](../src/services/EventBus.ts) — la columna
   vertebral de la comunicación.
3. [`src/services/StorageService.ts`](../src/services/StorageService.ts) — la
   capa de persistencia.
4. [`src/data/`](../src/data/) — los datos de partida (misiones, red, VFS, tips).
5. [`src/models/`](../src/models/) — el estado del dominio.
6. [`src/views/BaseView.ts`](../src/views/BaseView.ts) → vistas concretas.
7. [`src/controllers/CommandController.ts`](../src/controllers/CommandController.ts)
   → [`AppController.ts`](../src/controllers/AppController.ts) → comandos.
8. [`src/main.ts`](../src/main.ts) — el bootstrap final que une todo.

Cada archivo tiene una cabecera narrativa en español y TSDoc en sus métodos
públicos para que la lectura sea autocontenida.
