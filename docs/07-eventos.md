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
| `lobby:state`           | `RoomSnapshot`                   | `LobbyService`         | `LobbyView`, `MatchHudView` |
| `lobby:connection`      | `{ status, error? }`             | `LobbyService`         | `LobbyView`               |
| `lobby:player-joined`   | `PlayerSnapshot`                 | `LobbyService`         | `LobbyView`               |
| `lobby:player-left`     | `{ alias }`                      | `LobbyService`         | `LobbyView`               |
| `lobby:chat`            | `{ from, text, scope, team }`    | `LobbyService`         | `LobbyView`               |
| `lobby:match-started`   | `MatchSnapshot`                  | `LobbyService`         | `MatchHudView`            |
| `lobby:match-countdown` | `{ value: number }` (3,2,1,0)    | `LobbyService`         | `LobbyView`               |
| `lobby:match-tick`      | `{ timeLeft, scores }`           | `LobbyService`         | `MatchHudView`            |
| `lobby:match-event`     | `MatchEventBase` (kind discriminado) | `LobbyService`     | `MatchHudView`            |
| `lobby:server-captured` | `{ ip, by, team }`               | `LobbyService`         | `MatchHudView`            |
| `lobby:match-ended`     | `{ winner, scores, summary? }`   | `LobbyService`         | `LobbyView`               |
| `lobby:join-request`    | `{ requestId, alias, team }`     | `LobbyService`         | `LobbyView` (host)        |
| `lobby:join-resolved`   | `{ requestId, by, accepted }`    | `LobbyService`         | `LobbyView` (todos del team) |
| `lobby:join-pending`    | `{ message, team }`              | `LobbyService`         | `LobbyView`               |
| `lobby:rejoin-info`     | `string`                         | `LobbyService`         | `LobbyView`               |
| `lobby:team-required`   | `{ mode, code }`                 | `LobbyService`         | `LobbyView`               |
| `lobby:error`           | `string`                         | `LobbyService`         | `LobbyView`               |
| `toast:show`            | `{ kind, message, id?, actions? }` | (libre)              | `ToastView`               |
| `toast:dismiss`         | `string` (id)                    | (libre)                | `ToastView`               |

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

## Protocolo WebSocket (Fase 3)

Los eventos `lobby:*` son traducciones del contrato WS definido en
[`server/protocol.ts`](../server/protocol.ts). El contrato es **único y
compartido** entre cliente y servidor vía `import type`.

### Mensajes cliente → servidor (`ClientMsg`, unión discriminada)

| `type`           | Payload extra                      | Descripción                                     |
|------------------|------------------------------------|------------------------------------------------|
| `host`           | `alias`, `opts: RoomOptsPartial`   | Crear sala y asumir rol de host                |
| `join`           | `code`, `alias`, `team?`           | Entrar a una sala (con team si la partida está en curso) |
| `approve-join`   | `requestId`, `accept: boolean`     | Aprobar/rechazar reconexión pendiente          |
| `team`           | `team: Team`                       | Cambiar de equipo en lobby                     |
| `ready`          | `ready: boolean`                   | Marcarse listo                                 |
| `config`         | `opts: RoomOptsPartial`            | Solo host: editar reglas / modo / tamaño       |
| `start`          | —                                  | Solo host: arrancar countdown 3-2-1            |
| `chat`           | `text`                             | Mensaje (team-scoped durante partida)          |
| `action`         | `cmd`, `target?`                   | Acción de gameplay (ataque/defensa)            |
| `leave`          | —                                  | Salida limpia                                  |
| `pong`           | —                                  | Respuesta al heartbeat                         |

### Mensajes servidor → cliente (`ServerMsg`, unión discriminada)

| `type`              | Descripción                                                       |
|---------------------|-------------------------------------------------------------------|
| `state`             | Snapshot completo de la sala (`RoomSnapshot`)                     |
| `joined` / `left`   | Notificaciones puntuales de jugadores                             |
| `chat`              | Difusión de un mensaje (con `scope` y `team`)                     |
| `match-countdown`   | Cuenta regresiva (3, 2, 1, 0)                                     |
| `match-started`     | La partida comenzó (`MatchSnapshot`)                              |
| `match-tick`        | Tick periódico (`timeLeft`, `scores`)                             |
| `match-event`       | Evento puntual (`event: 'captured' \| 'attacked' \| ...`)         |
| `match-ended`       | Resultado final (`winner`, `scores`, `summary?`)                  |
| `join-request`      | Pedido de reconexión para que el equipo lo apruebe                |
| `join-resolved`     | Aviso de que la solicitud fue aceptada/rechazada (broadcast al team) |
| `pending-approval`  | Tu reconexión está esperando aprobación                            |
| `rejoin-info`       | Mensaje informativo tras una reconexión exitosa                   |
| `team-required`     | El server pide que elijas equipo para entrar a una partida en curso |
| `error`             | Mensaje de error para mostrar al usuario                          |
| `ping`              | Heartbeat (responder con `pong`)                                  |

### Reconexión y *grace timer*

Cuando un WS se cierra, el slot del jugador queda en `room.disconnected`
con un `setTimeout` de 60 s. Si el jugador vuelve antes (mismo alias),
recupera automáticamente su equipo y rol. Si no, el slot se libera. Esta
lógica está sujeta a la **regla del timer sobreviviente** (ver
[AGENTS.md §2.9](../AGENTS.md)): el callback debe capturar referencias
locales al `room`/`team` y validar `rooms.has(targetRoom.code)` antes de
tocar nada, porque `cleanup()` puede haber nullificado las variables del
scope original. El proceso además instala
`process.on('uncaughtException'/'unhandledRejection')` como red de
seguridad: loggean y mantienen vivo al servidor.
