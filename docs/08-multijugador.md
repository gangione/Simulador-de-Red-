# 08 · Multijugador LAN (Fase 3)

Este documento explica cómo funciona el modo multijugador: desde la
topología de procesos hasta el protocolo WebSocket, los modos de juego,
el sistema de reconexión y cómo extender la Fase 3 con modos o mensajes
nuevos.

---

## 1. Topología de procesos

```
┌─────────────────────────── Electron ─────────────────────────────┐
│                                                                   │
│  ┌─── Main Process (electron/main.js) ──────────────────────┐   │
│  │  • Crea BrowserWindow                                     │   │
│  │  • Forkea game server: child_process.fork('server-dist/  │   │
│  │    gameServer.js')                                         │   │
│  │  • IPC handlers: startServer, stopServer, getStatus,     │   │
│  │    getLanIps → expuestos al renderer via preload.js       │   │
│  └───────────────────────────────────────────────────────────┘   │
│                    │ fork()  ↑ IPC                                │
│  ┌─── Game Server (server-dist/gameServer.js) ───────────────┐   │
│  │  • ws.WebSocketServer en puerto 7331                       │   │
│  │  • Salas en Map<string, Room>                              │   │
│  │  • Modos: BaseMode ← redVsBlue / capture / coop / ffa     │   │
│  │  • Heartbeat + grace timer 60 s                           │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─── Renderer Process (dist/index.html) ───────────────────┐   │
│  │  • window.lobbyAPI (contextBridge)                        │   │
│  │  • LobbyService: WebSocket → EventBus lobby:*             │   │
│  │  • LobbyView + MatchHudView: suscriptos al EventBus       │   │
│  └───────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
```

**Puntos clave:**
- El game server corre en su **propio proceso Node** — si el renderer se
  cuelga, el servidor sigue vivo.
- El renderer no importa nada de `ws` ni de Node en tiempo de ejecución.
  Solo usa `import type` de `server/protocol.ts` para los tipos.
- `window.lobbyAPI` es la única "puerta" hacia el proceso main desde el
  renderer. Está definida en [`electron/preload.js`](../electron/preload.js)
  y tipada en [`src/types/index.ts`](../src/types/index.ts).

---

## 2. Ciclo completo de una partida

```
LOBBY IDLE
    │
    ▼ host → CMHost
SALA CREADA (phase: 'lobby')
    │ join → CMJoin
    ▼
JUGADORES EN SALA  (SMState broadcast a cada join)
    │ ready x N + CMStart (host)
    ▼
COUNTDOWN  3 → 2 → 1 → 0  (SMMatchCountdown)
    │
    ▼
PARTIDA EN CURSO (phase: 'match')
    │ SMMatchTick cada ~1 s
    │ CMAction → SMMatchEvent (captured / attacked / defended / …)
    │ SMServerCaptured (en capture / ffa)
    │ [CMJoin mid-match] → SMJoinRequest → CMApproveJoin → SMJoinResolved
    │
    ▼  tiempo agotado o objetivo alcanzado
MATCH ENDED  (SMMatchEnded: winner, scores, summary?)
    │
    ▼
Sala vuelve a phase: 'lobby' (lista para otra ronda)
```

---

## 3. Protocolo WebSocket (`server/protocol.ts`)

Todo mensaje cliente↔servidor es un objeto JSON con un campo discriminante
`type`. Los tipos están definidos como **uniones discriminadas** en
[`server/protocol.ts`](../server/protocol.ts). El renderer los importa
**solo como tipos** (`import type`), nunca en runtime.

### Regla de oro del protocolo

> Cualquier cambio en el protocolo se hace **primero en `server/protocol.ts`**.
> El compilador TypeScript detecta inmediatamente los `switch` / `case` que
> quedaron sin manejar — en el servidor **y** en el cliente.

### Mensajes cliente → servidor (ClientMsg)

| `type`         | Cuándo se usa |
|----------------|---------------|
| `host`         | Crear sala (alias + opts de modo) |
| `join`         | Unirse a sala (code + IP + alias + team opcional) |
| `approve-join` | Host aprueba/rechaza reconexión pendiente |
| `team`         | Cambiar equipo en lobby |
| `ready`        | Marcar/desmarcar listo |
| `config`       | Solo host: cambiar modo/tamaño/duración antes de iniciar |
| `start`        | Solo host: arrancar countdown |
| `chat`         | Enviar mensaje de chat |
| `action`       | Acción de gameplay (cmd + target) |
| `leave`        | Salida limpia de la sala |
| `pong`         | Respuesta al heartbeat del servidor |

### Mensajes servidor → cliente (ServerMsg)

| `type`             | Cuándo lo emite el servidor |
|--------------------|-----------------------------|
| `state`            | Tras cada cambio de estado: join, leave, config, team, ready, match-start, match-end |
| `joined` / `left`  | Notificaciones puntuales de entrada/salida |
| `chat`             | Broadcast de un mensaje de chat |
| `match-countdown`  | Cuenta regresiva (values: 3, 2, 1, 0) |
| `match-started`    | Snapshot inicial de la partida (servidores, scores, modo) |
| `match-tick`       | Tick periódico ~1 s (timeLeft, scores, …) |
| `match-event`      | Evento puntual de gameplay (kind discriminado) |
| `match-ended`      | Resultado final (winner, scores, summary?) |
| `join-request`     | Solicitud de reconexión mid-match → dirigido al equipo destino |
| `join-resolved`    | La solicitud fue aceptada o rechazada → broadcast al team |
| `pending-approval` | Tu reconexión está esperando aprobación del equipo |
| `rejoin-info`      | Confirmación informativa tras reconexión exitosa |
| `team-required`    | El servidor pide elegir equipo para entrar a partida en curso |
| `error`            | Mensaje de error para mostrar al usuario |
| `ping`             | Heartbeat periódico (responder con `pong`) |

### Cómo agregar un mensaje nuevo

Ver receta completa en [AGENTS.md §6.2](../AGENTS.md):

1. Agregar la interfaz tipada en `server/protocol.ts` y sumala a la unión.
2. Manejar el `case` en `server/gameServer.ts` (client → server) o en
   `src/services/LobbyService.ts` (server → client).
3. Si emitís un evento de bus nuevo, documentarlo en `docs/07-eventos.md`.
4. `npm run build` debe pasar sin `any`.

---

## 4. Modos de juego

Datos pedagógicos en [`src/data/modes.data.ts`](../src/data/modes.data.ts).
Implementaciones en [`server/modes/`](../server/modes/).

| Modo          | Dinámica | Equipos | Objetivo |
|---------------|----------|---------|---------|
| `red-vs-blue` | Asimétrico: Red ataca, Blue defiende | 2 equipos | Red toma todos los servidores antes del tiempo |
| `capture`     | Simétrico: ambos atacan y defienden | 2 equipos | El equipo con más servidores al final gana |
| `coop`        | Cooperativo: todos defienden oleadas | 1 equipo | Resistir N oleadas generadas por el servidor |
| `ffa`         | Libre: cada jugador tiene su propio servidor | Individual | Mayor puntaje al final del tiempo |

### Lógica compartida (`BaseMode`)

`BaseMode` provee `tickCommon()` que reduce el tiempo restante, evalúa
condición de victoria y emite `TickResult`. Los modos concretos solo
sobrescriben lo que es específico de su dinámica.

### Cómo agregar un modo nuevo

Ver receta en [AGENTS.md §6.1](../AGENTS.md):

1. Crear `server/modes/miModo.ts` extendiendo `BaseMode`.
2. Registrarlo en `server/modes/index.ts` con `case 'mi-modo'`.
3. Añadir `'mi-modo'` al tipo `Mode` y al array `MODES` en
   `server/protocol.ts`.
4. `npm run build:server` debe pasar verde.

---

## 5. Reconexión con grace timer

Si un jugador se desconecta (WS `close`), su slot no se borra inmediatamente.
El servidor inicia un `setTimeout` de **60 segundos**:

```
Jugador desconectado → room.disconnected.set(alias, slot)
    │
    │  ← puede reconectarse dentro de los 60 s
    ▼
Si vuelve antes:
    CMJoin (mismo alias) → servidor detecta match, emite SMRejoinInfo,
    si partida en curso → SMTeamRequired (confirmar equipo) o SMJoinRequest
    (aprobación del equipo) → SMJoinResolved

Si no vuelve:
    60 s → slot liberado de room.disconnected (graceTimer callback)
```

### La regla del timer sobreviviente (AGENTS.md §2.9)

Todo `setTimeout`/`setInterval` que puede ejecutarse **después** de que la
sala fue cerrada (`cleanup()`) debe:

```ts
// ✅ Patrón correcto
const targetCode = room.code;      // captura local antes del setTimeout
const targetSlot = { ...slot };    // copia local del slot

setTimeout(() => {
  try {
    if (!rooms.has(targetCode)) return;   // sala ya no existe → no tocar nada
    const room = rooms.get(targetCode)!;
    // ... lógica del grace timer
  } catch (e) {
    console.error('[grace-timer] error:', e);
  }
}, GRACE_MS);
```

**Nunca** confiar en variables del scope externo que `cleanup()` pudo haber
nullificado. Este patrón evita el crash histórico
`Cannot read properties of null (reading 'disconnected')`.

---

## 6. Toast de aprobación de join

Cuando un jugador intenta unirse a una partida en curso que requiere
aprobación del equipo destino, el flujo es:

```
PC4 → CMJoin (con team)
    │
    ▼
Server emite SMJoinRequest → todos los WS del equipo destino
    │
    ▼
LobbyService emite Events.LobbyJoinRequest
    │
    ▼
LobbyView → ToastView.show({
  kind: 'info',
  id: requestId,                    // id único para poder dismissar por id
  message: 'PC4 quiere unirse al equipo rojo.',
  actions: [ACEPTAR, RECHAZAR],     // botones con handlers
  timeout: 15000,
})
    │
    ▼
Host hace clic ACEPTAR → LobbyService.sendApproveJoin(requestId, true)
→ CMApproveJoin → Server procesa
    │
    ▼
Server emite SMJoinResolved (accepted: true) → todos del equipo
    │
    ▼
LobbyService emite Events.LobbyJoinResolved
    │
    ▼
LobbyView → EventBus.emit(Events.ToastDismiss, requestId)
→ ToastView cierra el toast en TODOS los clientes del equipo
```

**Detalles importantes:**
- El `id` del toast coincide con el `requestId` del servidor para poder
  hacer dismiss remoto vía `Events.ToastDismiss`.
- Si ningún miembro del equipo responde en **60 s**, el servidor libera
  la solicitud automáticamente.
- Si `accepted: false`, el toast de todos se cierra igualmente y aparece
  un segundo toast informativo: "Solicitud rechazada por [alias]".

Implementación: [`src/views/ToastView.ts`](../src/views/ToastView.ts),
[`src/services/LobbyService.ts`](../src/services/LobbyService.ts),
[`server/gameServer.ts`](../server/gameServer.ts).

---

## 7. Seguridad y hardening del servidor

El proceso del game server instala dos handlers de seguridad al arrancar:

```ts
process.on('uncaughtException',    (err) => console.error('[server] uncaught:', err));
process.on('unhandledRejection',   (reason) => console.error('[server] unhandled:', reason));
```

Estos **loggean y mantienen vivo el proceso** — no son sustituto del
manejo de errores real, pero evitan que un bug puntual tire el servidor
en medio de una partida. Complementan (no reemplazan) el patrón
`try/catch` en cada timer callback.

---

## 8. Variables de entorno y configuración

| Variable          | Default   | Descripción |
|-------------------|-----------|-------------|
| `PORT` (env)      | `7331`    | Puerto del WebSocketServer |
| `GRACE_MS`        | `60000`   | Grace period de reconexión (ms) |
| `TICK_INTERVAL_MS`| `1000`    | Frecuencia del tick de partida (ms) |

El renderer lee la IP del host mediante `window.lobbyAPI.getLanIps()` y la
muestra en el panel de lobby para facilitar que otros jugadores la copien.

---

## 9. Referencia rápida de archivos

| Archivo | Qué hace |
|---------|---------|
| [`server/protocol.ts`](../server/protocol.ts) | Uniones discriminadas ClientMsg/ServerMsg, tipos Mode/Team/Room |
| [`server/gameServer.ts`](../server/gameServer.ts) | WebSocketServer, manejo de salas, tick, reconexión |
| [`server/modes/base.ts`](../server/modes/base.ts) | BaseMode abstracto (tickCommon, handleAction) |
| [`server/modes/index.ts`](../server/modes/index.ts) | Dispatcher createMode() |
| [`src/services/LobbyService.ts`](../src/services/LobbyService.ts) | Cliente WS → traduce a eventos lobby:* |
| [`src/views/LobbyView.ts`](../src/views/LobbyView.ts) | UI de sala (host/join/chat/aprobación) |
| [`src/views/MatchHudView.ts`](../src/views/MatchHudView.ts) | HUD de partida (timer, scores, eventos) |
| [`src/views/ToastView.ts`](../src/views/ToastView.ts) | Toasts con acciones y dismiss por id |
| [`electron/main.js`](../electron/main.js) | Fork del server, IPC handlers |
| [`electron/preload.js`](../electron/preload.js) | contextBridge → window.lobbyAPI |
| [`src/data/modes.data.ts`](../src/data/modes.data.ts) | Metadata pedagógica de los 4 modos |
