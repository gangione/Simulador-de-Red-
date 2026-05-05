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
4. **TypeScript estricto.** El proyecto compila con `strict: true`. No introduzcas `any` implícitos, no apagues reglas globalmente.
5. **No edites el dispatcher para agregar comandos.** Implementa `ICommand` en un archivo nuevo y regístralo en `main.ts`.
6. **Sin frameworks UI.** El proyecto debe seguir siendo HTML/CSS puros. Cualquier dependencia nueva requiere justificación pedagógica.
7. **Funciona offline.** No introduzcas dependencias en tiempo de ejecución de servicios online (excepto el `IAIAgent` opcional).

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

### Fase 3 — Multijugador LAN
- `GameServer` WebSocket en Node.js (proceso aparte de Electron)
- Salas con roles **Red Team** vs **Blue Team** sincronizadas
- `NetworkModel` con sincronización de estado vía `EventBus` extendido
- Tabla de puntuaciones por equipo

## 9. Tests (planeado)

- Unitarios sobre `NetworkModel`, `MissionModel`, `FileSystemModel` (Vitest).
- Tests de regresión sobre cada `ICommand` con `ctx` mock.
- E2E con Playwright sobre el bundle de producción.

## 10. Checklist para una PR

- [ ] `npm run build` pasa (incluye `tsc --noEmit`).
- [ ] No se mezclan capas (vista ↔ modelo).
- [ ] Si agregaste un comando, está en `controllers/commands/` y registrado en `main.ts`.
- [ ] Si agregaste un evento, está documentado en la tabla de la sección 7.
- [ ] Misiones existentes siguen funcionando (ejecuta al menos M1 y M105).
- [ ] No hay accesos directos a `sessionStorage` fuera de `StorageService.ts`.
