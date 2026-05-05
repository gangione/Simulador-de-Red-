/**
 * gameServer.ts — servidor WebSocket para multijugador LAN.
 *
 * Lo lanza el proceso main de Electron mediante `child_process.fork()` cuando
 * el usuario crea una partida. También se puede ejecutar de forma standalone:
 *
 *   node server-dist/gameServer.js --port 7331
 *
 * El contrato del protocolo (ClientMsg / ServerMsg, RoomSnapshot, etc.) vive
 * en `protocol.ts` y es compartido con el cliente (`src/services/LobbyService.ts`)
 * vía `import type` — cualquier breaking change rompe ambos lados en compile-time.
 *
 * Reglas inviolables (ver AGENTS.md):
 *   - El dispatcher `switch (msg.type)` se mantiene delgado; la lógica de
 *     gameplay vive en los `ModeEngine` (modos/*.ts).
 *   - Cualquier timer que sobreviva al ciclo de vida de la conexión DEBE
 *     capturar referencias locales (`const targetRoom = room`); las variables
 *     `room` / `player` se nullifican al cerrar el socket.
 */

import { WebSocketServer, type WebSocket as WS } from 'ws';
import { generateRoomCode } from './words.js';
import { createMode } from './modes/index.js';
import type {
  ClientMsg, ServerMsg, RoomSnapshot, RoomOpts, RoomOptsPartial,
  Mode, Team, ModeEngine, MatchSnapshot, PlayerSnapshot,
} from './protocol.js';
import {
  isMode, isExplicitTeam, isLobbyTeam,
} from './protocol.js';

// ───────────────────────── Safety net ─────────────────────────
// Defensa en profundidad: un bug en un timer no debe matar la partida
// para todos los jugadores conectados. Solo loguear y seguir vivo.
process.on('uncaughtException', (err) => {
  console.error('[gameServer] uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[gameServer] unhandledRejection:', reason);
});

// ───────────────────────── Args ─────────────────────────
const args = process.argv.slice(2);
function argVal(name: string, def: string): string {
  const i = args.indexOf(name);
  const v = i >= 0 ? args[i + 1] : undefined;
  return typeof v === 'string' && v.length > 0 ? v : def;
}
const PORT = parseInt(argVal('--port', '7331'), 10);
const HOST = argVal('--host', '0.0.0.0');

// ───────────────────────── Estado en memoria ─────────────────────────
const rooms: Map<string, Room> = new Map();
/** Callbacks registrados por conexiones en estado pending-approval para que,
 *  cuando su aprobación llegue desde OTRO socket, puedan setear `player`/`room`
 *  dentro de su propio closure. */
const pendingAttachCallbacks = new Map<WS, (p: Player, r: Room) => void>();
const MAX_PLAYERS = 10;
const HEARTBEAT_MS = 15_000;
const TIMEOUT_MS = 45_000;

interface DisconnectedSlot {
  team: Team;
  isHost: boolean;
  graceTimer: NodeJS.Timeout;
}

interface PendingJoin {
  ws: WS;
  alias: string;
  team: Team;
  timer: NodeJS.Timeout;
}

class Player {
  team: Team = 'auto';
  ready = false;
  lastPong = Date.now();
  isHost = false;

  constructor(public readonly ws: WS, public readonly alias: string) {}

  send(msg: ServerMsg): void {
    try { this.ws.send(JSON.stringify(msg)); } catch { /* ignore */ }
  }
}

class Room {
  readonly players = new Set<Player>();
  host: Player;
  opts: RoomOpts;
  phase: 'lobby' | 'match' | 'ended' = 'lobby';
  match: ModeEngine | null = null;
  matchTimer: NodeJS.Timeout | null = null;
  countdownTimer: NodeJS.Timeout | null = null;

  /** Jugadores caídos durante una partida en curso (clave: alias en minúsculas). */
  readonly disconnected = new Map<string, DisconnectedSlot>();
  /** Solicitudes de reconexión esperando aprobación. */
  readonly pendingJoins = new Map<string, PendingJoin>();

  constructor(public readonly code: string, hostPlayer: Player, opts: RoomOptsPartial | undefined) {
    this.host = hostPlayer;
    this.opts = sanitizeOpts(opts);
  }

  add(player: Player): boolean {
    if (this.players.size >= MAX_PLAYERS) return false;
    this.players.add(player);
    return true;
  }

  remove(player: Player): void {
    this.players.delete(player);
    if (player === this.host && this.players.size > 0) {
      // Promover al siguiente jugador como host.
      const next = this.players.values().next().value as Player | undefined;
      if (next) {
        this.host = next;
        next.isHost = true;
      }
    }
  }

  broadcast(msg: ServerMsg, exclude?: Player): void {
    for (const p of this.players) if (p !== exclude) p.send(msg);
  }

  snapshot(): RoomSnapshot {
    return {
      code: this.code,
      phase: this.phase,
      opts: this.opts,
      host: this.host?.alias ?? null,
      players: [...this.players].map<PlayerSnapshot>((p) => ({
        alias: p.alias, team: p.team, ready: p.ready, isHost: p === this.host,
      })),
      disconnected: [...this.disconnected.entries()].map(([alias, info]) => ({
        alias, team: info.team,
      })),
      match: this.match ? this.match.snapshot() : null,
    };
  }
}

/** Normaliza opciones de partida con defaults sanos. */
function sanitizeOpts(o: RoomOptsPartial | undefined): RoomOpts {
  const src = o ?? {};
  const mode: Mode = isMode(src.mode) ? src.mode : 'red-vs-blue';
  return {
    mode,
    teamSize:    clampInt(src.teamSize,    1, 5,        2),
    serverCount: clampInt(src.serverCount, 1, 5,        3),
    durationSec: clampInt(src.durationSec, 60, 60 * 60, 600),
    rules: {
      time:           src.rules?.time !== false,
      firstToN:       !!src.rules?.firstToN,
      objectives:     !!src.rules?.objectives,
      firstToNTarget: clampInt(src.rules?.firstToNTarget, 1, 20, 3),
    },
  };
}

function clampInt(v: unknown, min: number, max: number, def: number): number {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  if (Number.isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
}

function uniqueCode(): string {
  for (let i = 0; i < 20; i++) {
    const c = generateRoomCode();
    if (!rooms.has(c)) return c;
  }
  return generateRoomCode() + '-' + Math.floor(Math.random() * 1000);
}

function sanitizeAlias(raw: unknown): string | null {
  const s = String(raw ?? '').trim().slice(0, 20);
  if (s.length < 1) return null;
  return s.replace(/[<>"'`]/g, '');
}

// ───────────────────────── WebSocket server ─────────────────────────
const wss = new WebSocketServer({ host: HOST, port: PORT });
console.log(`[gameServer] escuchando en ws://${HOST}:${PORT}`);

wss.on('connection', (ws: WS) => {
  let player: Player | null = null;
  let room: Room | null = null;

  const safeSend = (msg: ServerMsg): void => {
    try { ws.send(JSON.stringify(msg)); } catch { /* ignore */ }
  };
  const fail = (message: string): void => safeSend({ type: 'error', message });

  ws.on('message', (raw: Buffer | ArrayBuffer | string) => {
    let msg: ClientMsg;
    try {
      const parsed = JSON.parse(typeof raw === 'string' ? raw : raw.toString()) as unknown;
      if (!parsed || typeof parsed !== 'object' || typeof (parsed as { type: unknown }).type !== 'string') {
        return fail('Mensaje sin tipo');
      }
      msg = parsed as ClientMsg;
    } catch {
      return fail('JSON inválido');
    }

    switch (msg.type) {
      case 'host': {
        if (player) return fail('Ya estás en una sala');
        const alias = sanitizeAlias(msg.alias);
        if (!alias) return fail('Alias inválido');
        const code = uniqueCode();
        player = new Player(ws, alias);
        player.isHost = true;
        room = new Room(code, player, msg.opts);
        room.add(player);
        rooms.set(code, room);
        safeSend({ type: 'state', room: room.snapshot() });
        break;
      }

      case 'join': {
        if (player) return fail('Ya estás en una sala');
        const alias = sanitizeAlias(msg.alias);
        if (!alias) return fail('Alias inválido');
        const code = String(msg.code ?? '').trim().toLowerCase();
        const r = rooms.get(code);
        if (!r) return fail('Sala no encontrada');

        // ─── Reconexión / unirse durante una partida en curso ───
        if (r.phase === 'match') {
          const requestedTeam: 'red' | 'blue' | null = isExplicitTeam(msg.team) ? msg.team : null;
          const aliasKey = alias.toLowerCase();

          // 1) Mismo alias previamente desconectado: reconexión automática.
          const ghost = r.disconnected.get(aliasKey);
          if (ghost) {
            clearTimeout(ghost.graceTimer);
            r.disconnected.delete(aliasKey);
            player = new Player(ws, alias);
            player.team = ghost.team;
            player.isHost = false;
            r.add(player);
            room = r;
            r.broadcast({ type: 'joined', player: { alias, team: player.team, ready: true, isHost: false } }, player);
            r.broadcast({ type: 'state', room: r.snapshot() });
            safeSend({ type: 'state', room: r.snapshot() });
            break;
          }

          // Alias en uso por un jugador conectado.
          if ([...r.players].some((p) => p.alias.toLowerCase() === aliasKey)) {
            return fail('Ese alias ya está en uso en esta sala');
          }

          // 2) Alias nuevo: requiere team válido en modos red-vs-blue / capture.
          const mode = r.opts.mode;
          if ((mode === 'red-vs-blue' || mode === 'capture') && !requestedTeam) {
            safeSend({ type: 'team-required', mode, code: r.code });
            break;
          }

          // Caso especial: 1 solo conectado → auto-asignar al team contrario.
          if ((mode === 'red-vs-blue' || mode === 'capture') && r.players.size === 1) {
            const onlyTeam = [...r.players][0]?.team;
            const opposite: Team = onlyTeam === 'red' ? 'blue' : 'red';
            player = new Player(ws, alias);
            player.team = opposite;
            r.add(player);
            room = r;
            r.broadcast({ type: 'joined', player: { alias, team: opposite, ready: true, isHost: false } }, player);
            r.broadcast({ type: 'state', room: r.snapshot() });
            safeSend({ type: 'state', room: r.snapshot() });
            safeSend({ type: 'rejoin-info', message: `Asignado automáticamente al equipo ${opposite}.` });
            break;
          }

          // Caso general: pedir aprobación a los miembros del team destino.
          if (mode === 'red-vs-blue' || mode === 'capture') {
            const targetTeam: Team = requestedTeam ?? 'auto';
            const teamMembers = [...r.players].filter((p) => p.team === targetTeam);
            if (teamMembers.length === 0) {
              // Team vacío → auto-aprobado.
              player = new Player(ws, alias);
              player.team = targetTeam;
              r.add(player);
              room = r;
              r.broadcast({ type: 'joined', player: { alias, team: targetTeam, ready: true, isHost: false } }, player);
              r.broadcast({ type: 'state', room: r.snapshot() });
              safeSend({ type: 'state', room: r.snapshot() });
              safeSend({ type: 'rejoin-info', message: `Asignado automáticamente al equipo ${targetTeam} (vacío).` });
              break;
            }
            // Pedir aprobación.
            const reqId = `${aliasKey}-${Date.now()}`;
            // Capturar la sala — el ws origen puede cerrarse antes de los 30s
            // y dejar el closure sin contexto válido (causa del crash anterior).
            const targetRoom = r;
            const timer: NodeJS.Timeout = setTimeout(() => {
              try {
                if (!rooms.has(targetRoom.code)) return;
                const pending = targetRoom.pendingJoins.get(reqId);
                if (!pending) return;
                targetRoom.pendingJoins.delete(reqId);
                try { pending.ws.send(JSON.stringify({ type: 'error', message: 'Tiempo de aprobación agotado' })); } catch { /* ignore */ }
                try { pending.ws.close(); } catch { /* ignore */ }
              } catch (e) {
                console.error('[gameServer] pendingJoin timer error:', e);
              }
            }, 30_000);
            r.pendingJoins.set(reqId, { ws, alias, team: targetTeam, timer });
            // Registrar callback para que, al ser aprobados, este closure
            // reciba player/room sin depender del closure del aprobador.
            pendingAttachCallbacks.set(ws, (p, r2) => { player = p; room = r2; });
            for (const tm of teamMembers) {
              tm.send({ type: 'join-request', requestId: reqId, alias, team: targetTeam });
            }
            safeSend({ type: 'pending-approval', message: `Esperando aprobación del equipo ${targetTeam}…`, team: targetTeam });
            // No seteamos `player`/`room` todavía — se setea al recibir approve-join positivo.
            break;
          }

          // Modo coop / ffa durante match: simplemente entra (más permisivo).
          player = new Player(ws, alias);
          if (mode === 'coop') player.team = 'blue';
          else if (mode === 'ffa') player.team = `ffa-${r.players.size}` as const;
          r.add(player);
          room = r;
          r.broadcast({ type: 'joined', player: { alias, team: player.team, ready: true, isHost: false } }, player);
          r.broadcast({ type: 'state', room: r.snapshot() });
          safeSend({ type: 'state', room: r.snapshot() });
          break;
        }

        // ─── Unirse en lobby normal ───
        if (r.phase !== 'lobby') return fail('La partida ya terminó');
        if ([...r.players].some((p) => p.alias.toLowerCase() === alias.toLowerCase())) {
          return fail('Ese alias ya está en uso en esta sala');
        }
        player = new Player(ws, alias);
        if (!r.add(player)) return fail('Sala llena');
        room = r;
        room.broadcast({ type: 'joined', player: { alias, team: 'auto', ready: false, isHost: false } }, player);
        room.broadcast({ type: 'state', room: room.snapshot() });
        break;
      }

      case 'approve-join': {
        if (!player || !room) return fail('No estás en una sala');
        const reqId = String(msg.requestId);
        const pending = room.pendingJoins.get(reqId);
        if (!pending) return; // ya resuelto
        if (player.team !== pending.team) return fail('No pertenecés al equipo destino');
        if (msg.accept !== true && msg.accept !== false) break;
        const accepted = msg.accept === true;
        clearTimeout(pending.timer);
        room.pendingJoins.delete(reqId);
        // Notificar a TODOS los miembros del team destino (incluido el aprobador)
        // para que cierren su toast con ese requestId. Idempotente: si el toast
        // ya no existe en algún cliente, el dismiss no hace nada.
        const teammates = [...room.players].filter((p) => p.team === pending.team);
        for (const tm of teammates) {
          tm.send({ type: 'join-resolved', requestId: reqId, by: player.alias, accepted });
        }
        if (accepted) {
          const newPlayer = new Player(pending.ws, pending.alias);
          newPlayer.team = pending.team;
          room.add(newPlayer);
          // Invocar el callback registrado en el closure del nuevo jugador.
          const attach = pendingAttachCallbacks.get(pending.ws);
          if (attach) { attach(newPlayer, room); pendingAttachCallbacks.delete(pending.ws); }
          room.broadcast({ type: 'joined', player: { alias: newPlayer.alias, team: newPlayer.team, ready: true, isHost: false } });
          room.broadcast({ type: 'state', room: room.snapshot() });
          try { pending.ws.send(JSON.stringify({ type: 'state', room: room.snapshot() })); } catch { /* ignore */ }
          try { pending.ws.send(JSON.stringify({ type: 'rejoin-info', message: `Aprobado por ${player.alias}. Bienvenido al equipo ${pending.team}.` })); } catch { /* ignore */ }
        } else {
          try { pending.ws.send(JSON.stringify({ type: 'error', message: `Rechazado por ${player.alias}` })); } catch { /* ignore */ }
          try { pending.ws.close(); } catch { /* ignore */ }
        }
        break;
      }

      case 'team': {
        if (!player || !room) return fail('No estás en una sala');
        if (isLobbyTeam(msg.team)) player.team = msg.team;
        room.broadcast({ type: 'state', room: room.snapshot() });
        break;
      }

      case 'ready': {
        if (!player || !room) return fail('No estás en una sala');
        player.ready = !!msg.ready;
        room.broadcast({ type: 'state', room: room.snapshot() });
        break;
      }

      case 'config': {
        if (!player || !room) return fail('No estás en una sala');
        if (player !== room.host) return fail('Sólo el host puede configurar');
        if (room.phase !== 'lobby') return fail('Partida ya iniciada');
        room.opts = sanitizeOpts({ ...room.opts, ...msg.opts });
        room.broadcast({ type: 'state', room: room.snapshot() });
        break;
      }

      case 'start': {
        if (!player || !room) return fail('No estás en una sala');
        if (player !== room.host) return fail('Sólo el host puede iniciar');
        if (room.phase !== 'lobby') return fail('Partida ya iniciada');
        if (room.countdownTimer) return fail('Conteo regresivo en curso');
        // Host queda implícitamente listo al pulsar INICIAR.
        room.host.ready = true;
        const validation = validateStart(room);
        if (!validation.ok) return fail(validation.reason);
        applyTeamAssignments(room);
        room.broadcast({ type: 'state', room: room.snapshot() });
        beginCountdown(room);
        break;
      }

      case 'chat': {
        if (!player || !room) return fail('No estás en una sala');
        const text = String(msg.text ?? '').slice(0, 200);
        if (!text.trim()) return;
        const inMatch = room.phase === 'match';
        const scope: 'team' | 'global' = inMatch ? 'team' : 'global';
        const payload = {
          type: 'chat' as const,
          from: player.alias,
          text,
          scope,
          team: inMatch ? player.team : null,
        };
        if (inMatch) {
          for (const p of room.players) {
            if (p.team === player.team) p.send(payload);
          }
        } else {
          room.broadcast(payload);
        }
        break;
      }

      case 'action': {
        if (!player || !room || room.phase !== 'match' || !room.match) return;
        room.match.handleAction(player, msg);
        break;
      }

      case 'leave': {
        cleanup();
        break;
      }

      case 'pong': {
        if (player) player.lastPong = Date.now();
        break;
      }
    }
  });

  ws.on('close', cleanup);
  ws.on('error', cleanup);

  function cleanup(): void {
    // Si estábamos en pending-approval, cancelar el callback registrado.
    pendingAttachCallbacks.delete(ws);
    if (!room || !player) return;
    if (room.phase === 'match') {
      const aliasKey = player.alias.toLowerCase();
      const wasHost = player === room.host;
      // Capturar referencias locales — al final del cleanup `room`/`player` se
      // setean a null y este timer dispara 60s después, fuera del closure.
      const targetRoom = room;
      const targetTeam = player.team;
      room.remove(player);
      const graceTimer: NodeJS.Timeout = setTimeout(() => {
        try {
          if (!rooms.has(targetRoom.code)) return;
          targetRoom.disconnected.delete(aliasKey);
          targetRoom.broadcast({ type: 'state', room: targetRoom.snapshot() });
          if (targetRoom.players.size === 0 && targetRoom.disconnected.size === 0) {
            stopMatch(targetRoom);
            rooms.delete(targetRoom.code);
          }
        } catch (e) {
          console.error('[gameServer] grace timer error:', e);
        }
      }, 60_000);
      room.disconnected.set(aliasKey, { team: targetTeam, isHost: wasHost, graceTimer });
      room.broadcast({ type: 'left', alias: player.alias, reason: 'disconnect' });
      room.broadcast({ type: 'state', room: room.snapshot() });
    } else {
      room.remove(player);
      room.broadcast({ type: 'left', alias: player.alias });
      if (room.players.size === 0) {
        stopMatch(room);
        rooms.delete(room.code);
        console.log(`[gameServer] sala ${room.code} eliminada (vacía)`);
      } else {
        room.broadcast({ type: 'state', room: room.snapshot() });
      }
    }
    player = null;
    room = null;
  }
});

// ───────────────────────── Match lifecycle ─────────────────────────

function beginCountdown(room: Room): void {
  let value = 3;
  room.broadcast({ type: 'match-countdown', value });
  room.countdownTimer = setInterval(() => {
    value -= 1;
    room.broadcast({ type: 'match-countdown', value });
    if (value <= 0) {
      if (room.countdownTimer) clearInterval(room.countdownTimer);
      room.countdownTimer = null;
      if (room.players.size === 0) return;
      startMatch(room);
    }
  }, 1000);
}

function startMatch(room: Room): void {
  // Los teams ya fueron asignados por `applyTeamAssignments` en `case 'start'`.
  const players = [...room.players];
  room.match = createMode(room.opts.mode, room.opts, players);
  room.phase = 'match';
  room.broadcast({ type: 'match-started', match: room.match.snapshot() });
  room.broadcast({ type: 'state', room: room.snapshot() });

  room.matchTimer = setInterval(() => {
    try {
      if (!room.match) return;
      const result = room.match.tick();
      if (result.events?.length) {
        for (const ev of result.events) {
          room.broadcast({ type: 'match-event', ...ev });
        }
      }
      room.broadcast({ type: 'match-tick', timeLeft: result.timeLeft, scores: result.scores });
      if (result.ended) endMatch(room, result);
    } catch (e) {
      console.error('[gameServer] match tick error:', e);
    }
  }, 1000);
}

interface EndMatchResult {
  winner?: Team | 'draw';
  scores: Record<string, number>;
  summary?: string;
}

function endMatch(room: Room, result: EndMatchResult): void {
  if (!room.match) return;
  stopMatch(room);
  room.phase = 'ended';
  for (const [, info] of room.disconnected) clearTimeout(info.graceTimer);
  room.disconnected.clear();
  for (const [, pending] of room.pendingJoins) {
    clearTimeout(pending.timer);
    try { pending.ws.send(JSON.stringify({ type: 'error', message: 'La partida terminó antes de aprobar tu reconexión' })); } catch { /* ignore */ }
    try { pending.ws.close(); } catch { /* ignore */ }
  }
  room.pendingJoins.clear();
  room.broadcast({
    type: 'match-ended',
    winner: result.winner ?? 'draw',
    scores: result.scores,
    summary: result.summary ?? null,
  });
  // Volver al lobby después de 8s para permitir revancha.
  setTimeout(() => {
    try {
      if (!rooms.has(room.code)) return;
      room.phase = 'lobby';
      room.match = null;
      room.players.forEach((p) => (p.ready = false));
      room.broadcast({ type: 'state', room: room.snapshot() });
    } catch (e) {
      console.error('[gameServer] post-match return error:', e);
    }
  }, 8000);
}

function stopMatch(room: Room): void {
  if (room.matchTimer) {
    clearInterval(room.matchTimer);
    room.matchTimer = null;
  }
  if (room.countdownTimer) {
    clearInterval(room.countdownTimer);
    room.countdownTimer = null;
  }
}

// ───────────────────────── Team assignment / validación ─────────────────────────

interface TeamLike { team: Team }

function autoAssignTeams(players: TeamLike[]): void {
  let red = 0, blue = 0;
  for (const p of players) {
    if (p.team === 'red') red++;
    else if (p.team === 'blue') blue++;
  }
  for (const p of players) {
    if (p.team === 'auto') {
      if (red <= blue) { p.team = 'red'; red++; } else { p.team = 'blue'; blue++; }
    }
  }
}

function countTeams(players: TeamLike[]): { red: number; blue: number; other: number } {
  const counts = { red: 0, blue: 0, other: 0 };
  for (const p of players) {
    if (p.team === 'red') counts.red++;
    else if (p.team === 'blue') counts.blue++;
    else counts.other++;
  }
  return counts;
}

/**
 * Aplica la política de asignación de equipos según el modo. Mutates players.
 */
function applyTeamAssignments(room: Room): void {
  const players = [...room.players];
  const mode = room.opts.mode;
  if (mode === 'red-vs-blue' || mode === 'capture') {
    autoAssignTeams(players);
  } else if (mode === 'coop') {
    players.forEach((p) => (p.team = 'blue'));
  } else if (mode === 'ffa') {
    players.forEach((p, i) => (p.team = `ffa-${i}` as const));
  }
}

/**
 * Verifica que la partida pueda iniciarse:
 *   1) Todos los jugadores deben estar listos.
 *   2) En modos red-vs-blue / capture, ≥1 jugador en cada team tras la
 *      auto-asignación hipotética.
 */
function validateStart(room: Room): { ok: true } | { ok: false; reason: string } {
  const players = [...room.players];
  if (players.length < 1) return { ok: false, reason: 'No hay jugadores en la sala' };
  const notReady = players.filter((p) => !p.ready);
  if (notReady.length > 0) {
    const aliases = notReady.map((p) => p.alias).join(', ');
    return { ok: false, reason: `Faltan jugadores listos: ${aliases}` };
  }
  const mode = room.opts.mode;
  if (mode === 'red-vs-blue' || mode === 'capture') {
    const sim: TeamLike[] = players.map((p) => ({ team: p.team }));
    autoAssignTeams(sim);
    const counts = countTeams(sim);
    if (counts.red < 1 || counts.blue < 1) {
      return { ok: false, reason: 'Cada equipo necesita al menos 1 jugador' };
    }
  }
  return { ok: true };
}

// ───────────────────────── Heartbeat ─────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    for (const p of [...room.players]) {
      if (now - p.lastPong > TIMEOUT_MS) {
        try { p.ws.terminate(); } catch { /* ignore */ }
        room.remove(p);
        room.broadcast({ type: 'left', alias: p.alias });
      } else {
        p.send({ type: 'ping' });
      }
    }
    if (room.players.size === 0 && room.disconnected.size === 0) {
      stopMatch(room);
      rooms.delete(room.code);
    } else {
      room.broadcast({ type: 'state', room: room.snapshot() });
    }
  }
}, HEARTBEAT_MS);

// ───────────────────────── IPC con Electron ─────────────────────────
if (process.send) {
  process.send({ type: 'ready', port: PORT });
  process.on('message', (m: unknown) => {
    if (m === 'shutdown') {
      console.log('[gameServer] shutdown solicitado');
      wss.close(() => process.exit(0));
    }
  });
}

// Re-export para que MatchSnapshot/PlayerSnapshot sean importables desde tests futuros.
export type { MatchSnapshot, PlayerSnapshot };
