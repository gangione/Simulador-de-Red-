# 01 · Arquitectura

El simulador está construido siguiendo **MVC** (Modelo-Vista-Controlador) con
los cinco principios **SOLID** aplicados de forma deliberada y didáctica. El
objetivo: que el código se pueda leer linealmente, junto con la documentación,
y se entienda por qué cada pieza está donde está.

## Vista panorámica

```
┌─────────── Vistas ───────────┐         ┌──── Controladores ───┐
│ TerminalView                 │◀──┐  ┌─▶│ AppController        │
│ DashboardView                │   │  │  │ CommandController    │
└──────────────────────────────┘   │  │  └──────────┬───────────┘
└──────────────────────────────┘   │  │             │
              ▲                    │  │             ▼
              │                    │  │   ┌──── Modelos ────┐
              │   EventBus  ───────┘──┘──▶│ NetworkModel    │
              │  (Observer)               │ MissionModel    │
              │                           │ UserModel       │
              │                           │ FileSystemModel │
              │                           └────────┬────────┘
              │                                    │
              │                   ┌────── Servicios ───────┐
              └───────────────────│ StorageService         │
                                  │ AIAgentService (stub)  │
                                  └────────────────────────┘
```

### Reglas de oro

1. **Las vistas no tocan modelos** — reciben datos por `EventBus`.
2. **Los modelos no tocan el DOM ni `sessionStorage`** — reciben un
   `IStorageProvider` por constructor.
3. **Los controladores orquestan**: leen modelos, ejecutan comandos y emiten
   eventos.
4. **Los servicios** son piezas reutilizables sin estado de dominio.

## Capas en detalle

| Capa            | Carpeta             | Ejemplos                                        |
|-----------------|---------------------|-------------------------------------------------|
| **Vistas**      | `src/views/`        | `TerminalView`, `DashboardView`    |
| **Controladores** | `src/controllers/` | `AppController`, `CommandController`, `commands/*` |
| **Modelos**     | `src/models/`       | `NetworkModel`, `MissionModel`, `UserModel`, `FileSystemModel` |
| **Servicios**   | `src/services/`     | `EventBus`, `StorageService`, `AIAgentService`  |
| **Tipos**       | `src/types/`        | `ICommand`, `IMission`, `IHost`, `IVFS`         |
| **Datos**       | `src/data/`         | `missions.data.ts`, `network.data.ts`, `vfs.data.ts`, `tips.data.ts` |
| **Bootstrap**   | `src/main.ts`       | Composition root: instancia y conecta todo.     |

## Mapeo SOLID

| Principio | Ejemplo concreto                                                                                       |
|-----------|--------------------------------------------------------------------------------------------------------|
| **S — Single Responsibility** | `NetworkModel` solo gestiona estado de red; `StorageService` solo persiste; cada `ICommand` hace una sola cosa. |
| **O — Open/Closed**           | `CommandController` mantiene un registro de comandos. Para sumar uno nuevo: crear archivo + `commands.register(...)` en `main.ts`. El dispatcher no se modifica. |
| **L — Liskov Substitution**   | `TerminalView` y `DashboardView` extienden `BaseView` y son intercambiables donde se espera la base. |
| **I — Interface Segregation** | `IStorageProvider`, `IAIAgent`, `IEventBus`, `ICommand` son interfaces pequeñas y enfocadas. |
| **D — Dependency Inversion**  | `AppController` recibe sus colaboradores por constructor; los modelos dependen de `IStorageProvider`, no de `sessionStorage`. |

## Ciclo de vida de un comando

Todo el flujo, desde una tecla pulsada hasta la actualización del dashboard,
pasa por estos 8 pasos:

```
[1] Usuario pulsa Enter en #terminal-input
        │
        ▼
[2] TerminalView captura `keydown` → emite Events.CommandSubmitted (raw)
        │
        ▼
[3] AppController.handle(raw)
    ├─ emite Events.TaskStatusChanged "EJECUTANDO COMANDO..."
    └─ users.pushHistory(raw)
        │
        ▼
[4] CommandController.dispatch(raw)
    ├─ parsea `args` y arma ICommandContext
    ├─ busca el ICommand por nombre/alias
    └─ await command.execute(ctx)
        │
        ▼
[5] El ICommand devuelve ICommandResult
    └─ Si output === ['__CLEAR__'] → Events.TerminalClear
       Si tutorialCompleted        → users.completeTutorial(...)
       Si newCwd                   → Events.PromptChanged
       Caso normal                 → bus.emit(TerminalPrint, ...) por línea
        │
        ▼
[6] AppController invoca missions.evaluate(raw)
    └─ Solo evalúa la misión ENFOCADA. Cada paso que matchea regex emite
       Events.MissionStepDone. Si todos los pasos están done → MissionCompleted
       y se transfiere foco a la siguiente activa (o se vacía).
        │
        ▼
[7] DashboardView reacciona a los eventos:
    - MissionStepDone  → tacha el <li id="step_N"> y pone [HECHO]
    - MissionFocused   → muestra mission-active-pane y renderiza
    - ProgressChanged  → actualiza la barra mini-progress
        │
        ▼
[8] AppController emite TaskStatusChanged "ESPERANDO INSTRUCCIONES..."
```

## El EventBus en una línea

```ts
bus.emit(Events.TerminalPrint, { text: 'hola', color: 'var(--matrix-green)' });
bus.on<{ text: string; color?: string }>(Events.TerminalPrint, ({ text }) => /* ... */);
```

La lista completa de eventos está en [07 · Eventos](07-eventos.md).

## Persistencia en dos niveles

```
sessionStorage  (volátil — vida útil de la ventana)
        ▲
        │ persist() / restore()
        ▼
localStorage    (durable — sobrevive cierres)
   con prefijo "sim:"
```

`SessionStorageProvider.persist()` copia todo `sessionStorage` a
`localStorage` bajo el prefijo `sim:`. Al arrancar, `restore()` revierte el
proceso para que los modelos lean estado real al construirse. Implementado
en [`src/services/StorageService.ts`](../src/services/StorageService.ts).

## Modelo de misiones múltiples

El `MissionModel` permite varias misiones activas en paralelo. Solo una está
**enfocada** y es la única que evalúa cada comando.

```
activeIds  = [1, 2, 5]   ← orden de inicio
focusedId  = 5            ← la última iniciada (o la elegida con `foco N`)

evaluate(cmd) → solo testea pasos de la misión 5
abort()       → aborta la enfocada y refoca la siguiente
abort(2)      → aborta una específica
unfocus()     → quita el foco sin abortar (volvés al "home")
```

Detalles en [`src/models/MissionModel.ts`](../src/models/MissionModel.ts) y
ejemplos en [04 · Ejemplos de uso](04-ejemplos-de-uso.md).
