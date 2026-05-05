# 07 · Eventos del bus

El [`EventBus`](../src/services/EventBus.ts) es el único canal de
comunicación entre capas. Cualquier evento nuevo debe documentarse en esta
tabla y agregarse al objeto `Events`.

## Contrato público

| Evento                  | Payload                          | Emisor                | Suscriptores              |
|-------------------------|----------------------------------|------------------------|---------------------------|
| `terminal:print`        | `{ text: string; color?: string }` | Controllers / Commands | `TerminalView`            |
| `terminal:clear`        | —                                | `AppController`        | `TerminalView`            |
| `command:submitted`     | `string` (línea cruda)           | `TerminalView`         | `AppController`           |
| `mission:started`       | `IMission`                       | `MissionModel`         | `DashboardView`           |
| `mission:step-done`     | `{ mission, stepIndex }`         | `MissionModel`         | `DashboardView`           |
| `mission:completed`     | `IMission`                       | `MissionModel`         | `AppController`           |
| `mission:aborted`       | `IMission`                       | `MissionModel`         | `DashboardView`           |
| `mission:focused`       | `IMission`                       | `MissionModel`         | `DashboardView`           |
| `tutorial:completed`    | `TutorialKey` (`'red'|'dos'|'firewall'|'ataque'`) | `UserModel` | `DashboardView` |
| `rank:changed`          | `{ rank: string; message: string }` | `UserModel`         | `DashboardView`           |
| `progress:changed`      | `{ done: number; total: number }` | `MissionModel`        | `DashboardView`           |
| `prompt:changed`        | `string` (nuevo prompt)          | `CommandController`    | `TerminalView`            |
| `task:status`           | `string`                         | `AppController`        | `TerminalView`, `DashboardView` |
| `gauge:update`          | `{ id: string; value: number }`  | (libre)                | `DashboardView`               |

## Convenciones

- **Sentinel `progress:changed { done: 0, total: 0 }`** → indica al
  `DashboardView` que ya no hay misión enfocada (`focusedId === 0`) y
  debe mostrar el panel "home".
- **Sentinel en `ICommandResult.output === [['__CLEAR__']]`** → el
  `AppController` lo intercepta y emite `terminal:clear` en vez de imprimir.
- **`terminal:clear`** → el `TerminalView` restaura el HTML inicial
  capturado en `init()` (banner ASCII + bienvenida en una línea verde).

## API mínima del bus

```ts
interface IEventBus {
  on<T>(event: string, handler: (payload: T) => void): () => void; // devuelve unsubscribe
  emit<T>(event: string, payload?: T): void;
}
```

## Patrón de uso

```ts
// Suscripción (vista o controlador)
this.bus.on<{ text: string; color?: string }>(
  Events.TerminalPrint,
  ({ text, color }) => this.write(text, color),
);

// Emisión (modelo o servicio)
this.bus.emit(Events.MissionStarted, mission);
```

## Agregar un evento nuevo

1. Añadir la clave en `Events` (singleton `as const`) en
   [`src/services/EventBus.ts`](../src/services/EventBus.ts).
2. Documentarlo en la tabla de arriba **antes** de implementarlo.
3. Reutilizar uno existente si cubre el caso (no duplicar señales).
