# AGENTS.md

> Especificación técnica para humanos e IA que contribuyan al **Simulador de Redes y Ciberseguridad — EEST N°10**.

Este documento describe la arquitectura, las reglas de contribución y los puntos de extensión seguros. Cualquier agente (humano o LLM) que modifique el repositorio debe leer y respetar lo que aquí se define.

---

## 1. Arquitectura — vista rápida

```
┌─────────── Views ───────────┐         ┌──── Controllers ────┐
│ TerminalView                │◀──┐  ┌─▶│ AppController       │
│ DashboardView               │   │  │  │ CommandController   │
└─────────────────────────────┘   │  │  └─────────┬───────────┘
└─────────────────────────────┘   │  │            │
              ▲                   │  │            ▼
              │                   │  │   ┌──── Models ────┐
              │   EventBus  ──────┘──┘──▶│ NetworkModel    │
              │  (Observer)              │ MissionModel    │
              │                          │ UserModel       │
              │                          │ FileSystemModel │
              │                          └────────┬────────┘
              │                                   │
              │                   ┌────── Services ───────┐
              └───────────────────│ StorageService        │
                                  │ AIAgentService (stub) │
                                  └───────────────────────┘
```

- **Views** nunca tocan modelos directamente; reciben datos por `EventBus`.
- **Models** nunca tocan el DOM ni `sessionStorage`; reciben un `IStorageProvider`.
- **Controllers** orquestan: leen modelos, ejecutan comandos, emiten eventos.
- **Services** son piezas reutilizables sin estado de dominio.

## 2. Reglas de contribución

### Reglas inviolables

1. **No mezcles capas.** Una vista no importa modelos. Un modelo no importa vistas. Un controlador puede importar ambas.
2. **Persistencia solo en modelos.** Los modelos reciben un `IStorageProvider` por constructor. Está prohibido usar `sessionStorage` directamente fuera de `StorageService.ts`.
3. **DOM solo en vistas.** Si necesitas leer/escribir el DOM, hazlo en una `BaseView` o una subclase.
4. **TypeScript estricto en TODO el código.** El proyecto compila con `strict: true` en dos targets independientes:
   - `tsconfig.json`         → renderer + Electron main + `server/protocol.ts`.
   - `tsconfig.server.json`  → todo el código del game server (`server/**/*.ts` → `server-dist/`).
   No introduzcas `any` implícitos, no apagues reglas globalmente. **Nunca
   reintroduzcas `.mjs`** en `server/`: el código de servidor es 100% TS
   compilado con `noUncheckedIndexedAccess` y `noImplicitOverride`.
5. **No edites el dispatcher para agregar comandos.** Implementa `ICommand` en un archivo nuevo y regístralo en `main.ts`.
6. **Sin frameworks UI.** El proyecto debe seguir siendo HTML/CSS puros. Cualquier dependencia nueva requiere justificación pedagógica.
7. **Funciona offline.** No introduzcas dependencias en tiempo de ejecución de servicios online (excepto el `IAIAgent` opcional).
8. **Contrato WS único.** Todo mensaje cliente↔server pasa por las uniones
   discriminadas `ClientMsg` / `ServerMsg` definidas en
   [`server/protocol.ts`](server/protocol.ts). El renderer las importa con
   `import type`. Cualquier cambio en el protocolo se hace ahí primero.
9. **Regla del timer sobreviviente.** Cualquier `setTimeout` / `setInterval`
   que pueda dispararse después de que su conexión WS se cierre **debe**
   capturar referencias locales antes de programarse y comprobar con
   `rooms.has(targetRoom.code)` que la sala todavía existe. Nunca confiar
   en variables de scope que `cleanup()` puede haber nullificado: ese
   patrón causó el crash histórico `Cannot read properties of null
   (reading 'disconnected')`. Además envolvé el cuerpo del callback en
   `try/catch`. El servidor instala `process.on('uncaughtException')` y
   `process.on('unhandledRejection')` como red de seguridad — loggean y
   mantienen vivo el proceso, **no** sustituyen al guard.
10. **Todo en español.** Toda la documentación (`README.md`, `PLAN.md`,
    `docs/**/*.md`, comentarios JSDoc/TSDoc largos y strings de UI) se
    escribe en **español rioplatense neutro**. Los nombres de variables,
    funciones y clases siguen siendo en inglés (convención de código
    universal). Cualquier excepción requiere justificación pedagógica
    explícita. Esta regla aplica tanto a humanos como a agentes IA que
    contribuyan al repositorio.

### Convenciones de código

- Archivos: `PascalCase.ts` para clases (`NetworkModel.ts`), `camelCase.data.ts` para datos.
- Una clase principal por archivo.
- Documenta el principio SOLID que ejemplifica una clase nueva con un comentario al inicio.
- Las regex de misiones se mantienen idénticas a las históricas para no romper escenarios existentes.

## 3. Cómo agregar un comando nuevo

```ts
// src/controllers/commands/MyCommand.ts
import type { ICommand, ICommandContext, ICommandResult } from '../../types';

export class HelloCommand implements ICommand {
  readonly name = 'hello';
  readonly aliases = ['hi'];
  execute(ctx: ICommandContext): ICommandResult {
    return { output: [[`Hola, ${ctx.args[1] ?? 'mundo'}!`, 'var(--matrix-green)']] };
  }
}
```

```ts
// src/main.ts (al final del bloque de register)
commands.register(new HelloCommand());
```

Eso es todo. **Cero modificaciones al dispatcher** (Open/Closed cumplido).

## 4. Cómo agregar una misión

Edita `src/data/missions.data.ts` y añade una entrada al objeto:

```ts
99: {
  id: 99,
  title: 'D99: Mi nueva crisis',
  desc: 'Descripción corta para el dashboard.',
  steps: [
    { text: '1. Primer objetivo', regex: /^comando exacto/i, done: false },
    { text: '2. Segundo objetivo', regex: /otra-regex/i, done: false },
  ],
},
```

El motor de misiones lo recogerá automáticamente.

## 5. Cómo conectar un agente IA real (Fase 2)

1. Implementa `IAIAgent` en un archivo nuevo:

```ts
// src/services/OllamaAIAgent.ts
import type { IAIAgent } from './AIAgentService';

export class OllamaAIAgent implements IAIAgent {
  isReady() { return true; }
  async explain(concept: string) { /* fetch a Ollama local */ }
  async ask(prompt: string)      { /* idem */ }
}
```

2. En `main.ts`, reemplaza `new StubAIAgent()` por `new OllamaAIAgent()`.

3. Ningún otro archivo cambia. El comando `?teoria` empieza a contestar.

## 6. Cómo agregar un panel/vista nuevo

```ts
// src/views/HistoryView.ts
import { BaseView } from './BaseView';
import { Events } from '../services/EventBus';

export class HistoryView extends BaseView {
  init() {
    this.bus.on<string>(Events.CommandSubmitted, (cmd) => { /* render */ });
  }
}
```

Inicialízalo en `main.ts`. Liskov garantiza que se comporta como cualquier otra vista.

## 6.1 Cómo agregar un modo de partida (server)

1. Creá `server/modes/miModo.ts` extendiendo `BaseMode`:

   ```ts
   import { BaseMode, type ModeOptions } from './base.js';
   import type { Mode, TickResult } from '../protocol.js';

   export class MiModoMode extends BaseMode {
     static override readonly MODE_ID: Mode = 'mi-modo';
     constructor(opts: ModeOptions) { super(opts); }
     override tick(): TickResult {
       const result: TickResult = this.tickCommon();
       // lógica específica del modo
       return result;
     }
   }
   ```

2. Registralo en el dispatcher [`server/modes/index.ts`](server/modes/index.ts)
   agregando un `case 'mi-modo'` que devuelva `new MiModoMode(...)`.
3. Añadí `'mi-modo'` al tipo `Mode` y al array `MODES` en
   [`server/protocol.ts`](server/protocol.ts).
4. `npm run build:server` debe seguir verde.

El dispatcher de modos cumple Open/Closed igual que el de comandos: agregar
un modo no requiere modificar `BaseMode` ni los modos existentes.

## 6.2 Cómo agregar un mensaje al protocolo WS

1. Editá [`server/protocol.ts`](server/protocol.ts):
   - Añadí la interfaz tipada (`SMNuevo` o `CMNuevo`) con un `type` literal.
   - Sumá esa interfaz a la unión discriminada (`ServerMsg` o `ClientMsg`).
2. Manejá el nuevo `case 'nuevo'` en el `switch (msg.type)` correspondiente:
   - Cliente → server: `server/gameServer.ts`.
   - Server → cliente: `src/services/LobbyService.ts`.
3. Si emitís un evento de bus desde el cliente, documentálo en la tabla de la
   sección 7 antes de implementarlo.
4. `npm run build` (renderer + server) debe pasar sin `any`.

No hace falta serialize/deserialize manual: la unión discriminada se afina
sola con el `switch`. **No uses `as any`** ni casts amplios para esquivar
la narrowing del compilador.


## 7. Eventos del bus (contrato público)

| Evento | Payload | Quién emite | Quién escucha |
|---|---|---|---|
| `terminal:print` | `{ text, color? }` | Controllers | TerminalView |
| `terminal:clear` | — | AppController | TerminalView |
| `command:submitted` | `string` (raw) | TerminalView | AppController |
| `mission:started` | `IMission` | MissionModel | DashboardView |
| `mission:step-done` | `{ mission, stepIndex }` | MissionModel | DashboardView |
| `mission:completed` | `IMission` | MissionModel | AppController |
| `mission:aborted` | `IMission` | MissionModel | DashboardView |
| `mission:focused` | `IMission` | MissionModel | DashboardView |
| `tutorial:completed` | `TutorialKey` | UserModel | DashboardView |
| `rank:changed` | `{ rank, message }` | UserModel | DashboardView |
| `progress:changed` | `{ done, total }` | MissionModel | DashboardView |
| `prompt:changed` | `string` | CommandController | TerminalView |
| `task:status` | `string` | AppController | TerminalView, DashboardView |
| `gauge:update` | `{ id, value }` | (libre) | DashboardView |
| `lobby:state` | `RoomSnapshot` | LobbyService | LobbyView, MatchHudView |
| `lobby:connection` | `{ status, error? }` | LobbyService | LobbyView |
| `lobby:player-joined` | `PlayerSnapshot` | LobbyService | LobbyView |
| `lobby:player-left` | `{ alias }` | LobbyService | LobbyView |
| `lobby:chat` | `{ from, text, scope, team }` | LobbyService | LobbyView |
| `lobby:match-started` | `MatchSnapshot` | LobbyService | MatchHudView |
| `lobby:match-countdown` | `{ value: number }` (3,2,1,0) | LobbyService | LobbyView |
| `lobby:match-tick` | `{ timeLeft, scores }` | LobbyService | MatchHudView |
| `lobby:match-event` | `MatchEventBase` (kind discriminado) | LobbyService | MatchHudView |
| `lobby:server-captured` | `{ ip, by, team }` | LobbyService | MatchHudView |
| `lobby:match-ended` | `{ winner, scores, summary? }` | LobbyService | LobbyView |
| `lobby:join-request` | `{ requestId, alias, team }` | LobbyService | LobbyView (host) |
| `lobby:join-resolved` | `{ requestId, by, accepted }` | LobbyService | LobbyView (todos del team) |
| `lobby:join-pending` | `{ message, team }` | LobbyService | LobbyView |
| `lobby:rejoin-info` | `string` (mensaje) | LobbyService | LobbyView |
| `lobby:team-required` | `{ mode, code }` | LobbyService | LobbyView |
| `lobby:error` | `string` | LobbyService | LobbyView |
| `toast:show` | `{ kind, message, id?, actions? }` | (libre) | ToastView |
| `toast:dismiss` | `string` (id) | (libre) | ToastView |

**Antes de inventar un evento nuevo**, comprueba si uno existente cubre tu caso.

## 8. Roadmap detallado

### Fase 1 — Base (✅ Completa)
- Vite + TypeScript + Electron
- MVC + SOLID con ejemplos didácticos
- 60 nodos de red, 17 misiones migradas, 4 tutoriales
- Stub de IA con interfaz `IAIAgent`

### Fase 2 — IA pedagógica
- Implementación `OllamaAIAgent` (modelo local) o `OpenAIAgent` (cloud)
- Comando `?teoria <concepto>` plenamente funcional
- Hints contextuales durante misiones (sugerencia del próximo comando útil)

### Fase 3 — Multijugador LAN (✅ Completa)
- `GameServer` WebSocket en proceso Node aparte (forkeado por Electron).
- 4 modos: `red-vs-blue`, `capture`, `coop`, `ffa` con motor `BaseMode`.
- Reconexión con grace timer de 60 s + cola de aprobación de joins.
- Migración completa a TypeScript estricto (`tsconfig.server.json`).
- Contrato compartido `server/protocol.ts` (uniones discriminadas).
- Hardening: `process.on('uncaughtException')` + regla del timer sobreviviente.

## 9. Tests (planeado)

- Unitarios sobre `NetworkModel`, `MissionModel`, `FileSystemModel` (Vitest).
- Tests de regresión sobre cada `ICommand` con `ctx` mock.
- E2E con Playwright sobre el bundle de producción.

## 10. Checklist para una PR

- [ ] `npm run build` pasa (renderer + `tsc -p tsconfig.server.json` + Vite).
- [ ] No se mezclan capas (vista ↔ modelo, renderer ↔ server).
- [ ] Si agregaste un comando, está en `controllers/commands/` y registrado en `main.ts`.
- [ ] Si agregaste un evento, está documentado en la tabla de la sección 7.
- [ ] Si agregaste un mensaje WS, está en `server/protocol.ts` y manejado en ambos lados.
- [ ] Si agregaste un modo, está en `server/modes/` y registrado en `modes/index.ts`.
- [ ] Cualquier `setTimeout`/`setInterval` que sobreviva a una desconexión captura referencias locales (regla 9).
- [ ] Misiones existentes siguen funcionando (ejecuta al menos M1 y M105).
- [ ] No hay accesos directos a `sessionStorage` fuera de `StorageService.ts`.
- [ ] No hay `.mjs` nuevos en `server/`.
