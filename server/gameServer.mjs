/**
 * gameServer.mjs — servidor WebSocket para multijugador LAN.
 *
 * Lo lanza el proceso main de Electron mediante `child_process.fork()` cuando
 * el usuario crea una partida. También se puede ejecutar de forma standalone:
 *
 *   node server/gameServer.mjs --port 7331
 *
 * Protocolo (mensajes JSON sobre WebSocket):
 *
 *   Cliente -> Server
 *     { type: 'host',    alias, opts }                  // crear sala
 *     { type: 'join',    code, alias }                  // unirse
 *     { type: 'leave' }
 *     { type: 'team',    team: 'red'|'blue'|'auto' }
 *     { type: 'ready',   ready: boolean }
 *     { type: 'config',  opts: <subset> }               // sólo host
 *     { type: 'start' }                                  // sólo host
 *     { type: 'chat',    text }
 *     { type: 'action',  cmd, target? }                 // gameplay (Fase C)
 *     { type: 'pong' }
 *
 *   Server -> Cliente
 *     { type: 'state',   room }                         // snapshot completo
 *     { type: 'joined',  player }
 *     { type: 'left',    alias }
 *     { type: 'chat',    from, text }
 *     { type: 'match-started', match }
 *     { type: 'match-tick',    timeLeft, scores }
 *     { type: 'match-event',   ... }                    // captura, defensa, etc.
 *     { type: 'match-ended',   winner, scores }
 *     { type: 'error',         message }
 *     { type: 'ping' }
 */

import { WebSocketServer } from 'ws';
import { generateRoomCode } from './words.mjs';
import { createMode } from './modes/index.mjs';

// ---------- safety net ----------
// Defensa en profundidad: un bug en un timer no debe matar la partida
// para todos los jugadores conectados. Solo loguear y seguir vivo.
process.on('uncaughtException', (err) => {
  console.error('[gameServer] uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[gameServer] unhandledRejection:', reason);
});

// ---------- args ----------
const args = process.argv.slice(2);
function argVal(name, def) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const PORT = parseInt(argVal('--port', '7331'), 10);
const HOST = argVal('--host', '0.0.0.0');

// ---------- estado en memoria ----------
/** @type {Map<string, Room>} */
const rooms = new Map();
const MAX_PLAYERS = 10;
const HEARTBEAT_MS = 15_000;
const TIMEOUT_MS = 45_000;

class Player {
  constructor(ws, alias) {
    this.ws = ws;
    this.alias = alias;
    this.team = 'auto';
    this.ready = false;
    this.lastPong = Date.now();
    this.isHost = false;
  }
  send(msg) { try { this.ws.send(JSON.stringify(msg)); } catch {} }
}

class Room {
  constructor(code, hostPlayer, opts) {
    this.code = code;
    this.players = new Set();
    this.host = hostPlayer;
    this.opts = sanitizeOpts(opts);
    this.phase = 'lobby'; // 'lobby' | 'match' | 'ended'
    this.match = null;    // estado de partida activa (Fase C)
    this.matchTimer = null;
    this.countdownTimer = null;
    /**
     * Jugadores caídos durante una partida en curso. Conservan su team y
     * permiten reconexión automática con el mismo alias.
     * Map<aliasLower, { team, isHost, graceTimer }>
     */
    this.disconnected = new Map();
    /**
     * Solicitudes de reconexión pendientes de aprobación.
     * Map<requestId, { ws, alias, team, timer }>
     */
    this.pendingJoins = new Map();
  }

  add(player) {
    if (this.players.size >= MAX_PLAYERS) return false;
    this.players.add(player);
    return true;
  }

  remove(player) {
    this.players.delete(player);
    if (player === this.host && this.players.size > 0) {
      // Promover al siguiente jugador como host.
      this.host = this.players.values().next().value;
      this.host.isHost = true;
    }
  }

  broadcast(msg, exclude) {
    for (const p of this.players) if (p !== exclude) p.send(msg);
  }

  snapshot() {
    return {
      code: this.code,
      phase: this.phase,
      opts: this.opts,
      host: this.host?.alias ?? null,
      players: [...this.players].map((p) => ({
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
function sanitizeOpts(o = {}) {
  const mode = ['red-vs-blue', 'capture', 'coop', 'ffa'].includes(o.mode) ? o.mode : 'red-vs-blue';
  const teamSize = clampInt(o.teamSize, 1, 5, 2);
  const serverCount = clampInt(o.serverCount, 1, 5, 3);
  const durationSec = clampInt(o.durationSec, 60, 60 * 60, 600);
  const rules = {
    time: o.rules?.time !== false,
    firstToN: !!o.rules?.firstToN,
    objectives: !!o.rules?.objectives,
    firstToNTarget: clampInt(o.rules?.firstToNTarget, 1, 20, 3),
  };
  return { mode, teamSize, serverCount, durationSec, rules };
}
function clampInt(v, min, max, def) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
}

function uniqueCode() {
  for (let i = 0; i < 20; i++) {
    const c = generateRoomCode();
    if (!rooms.has(c)) return c;
  }
  return generateRoomCode() + '-' + Math.floor(Math.random() * 1000);
}

// ---------- WS server ----------
const wss = new WebSocketServer({ host: HOST, port: PORT });
console.log(`[gameServer] escuchando en ws://${HOST}:${PORT}`);

wss.on('connection', (ws) => {
  /** @type {Player|null} */
  let player = null;
  /** @type {Room|null} */
  let room = null;

  const safeSend = (msg) => { try { ws.send(JSON.stringify(msg)); } catch {} };
  const fail = (message) => safeSend({ type: 'error', message });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return fail('JSON inválido'); }
    if (typeof msg?.type !== 'string') return fail('Mensaje sin tipo');

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
        const code = String(msg.code || '').trim().toLowerCase();
        const r = rooms.get(code);
        if (!r) return fail('Sala no encontrada');

        // ----- Reconexión / unirse durante una partida en curso -----
        if (r.phase === 'match') {
          const requestedTeam = ['red', 'blue'].includes(msg.team) ? msg.team : null;
          const aliasKey = alias.toLowerCase();

          // 1) Mismo alias previamente desconectado: reconexión automática.
          const ghost = r.disconnected.get(aliasKey);
          if (ghost) {
            if (ghost.graceTimer) clearTimeout(ghost.graceTimer);
            r.disconnected.delete(aliasKey);
            player = new Player(ws, alias);
            player.team = ghost.team;
            player.isHost = false; // host se reasigna en cleanup; al reconectar nunca recupera host.
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

          // 2) Alias nuevo: requiere team válido según modo. Si el cliente todavía
          //    no eligió, le pedimos uno y dejamos el ws abierto para un segundo
          //    `join` con team. No marcamos `player`/`room` hasta entonces.
          const mode = r.opts.mode;
          if ((mode === 'red-vs-blue' || mode === 'capture') && !requestedTeam) {
            safeSend({ type: 'team-required', mode, code: r.code });
            break;
          }

          // Conteo de equipos actuales.
          const teamCounts = countTeams([...r.players]);

          // Caso especial: 1 solo conectado en su team → auto-asignar al team contrario.
          if ((mode === 'red-vs-blue' || mode === 'capture') && r.players.size === 1) {
            const onlyTeam = [...r.players][0].team;
            const opposite = onlyTeam === 'red' ? 'blue' : 'red';
            // Aprobación automática al equipo vacío.
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
          const targetTeam = requestedTeam ?? 'auto';
          if (mode === 'red-vs-blue' || mode === 'capture') {
            const teamMembers = [...r.players].filter((p) => p.team === targetTeam);
            if (teamMembers.length === 0) {
              // Team vacío → auto aprobado.
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
            // y dejar el closure sin contexto válido.
            const targetRoom = r;
            const timer = setTimeout(() => {
              try {
                if (!rooms.has(targetRoom.code)) return;
                const pending = targetRoom.pendingJoins.get(reqId);
                if (!pending) return;
                targetRoom.pendingJoins.delete(reqId);
                try { pending.ws.send(JSON.stringify({ type: 'error', message: 'Tiempo de aprobación agotado' })); } catch {}
                try { pending.ws.close(); } catch {}
              } catch (e) {
                console.error('[gameServer] pendingJoin timer error:', e);
              }
            }, 30_000);
            r.pendingJoins.set(reqId, { ws, alias, team: targetTeam, timer });
            // Notificar a miembros del team.
            for (const tm of teamMembers) {
              tm.send({ type: 'join-request', requestId: reqId, alias, team: targetTeam });
            }
            safeSend({ type: 'pending-approval', message: `Esperando aprobación del equipo ${targetTeam}…`, team: targetTeam });
            // No seteamos `player`/`room` todavía — se setea al recibir approve-join positivo desde otro socket.
            break;
          }

          // Modo coop / ffa durante match: simplemente entra (más permisivo).
          player = new Player(ws, alias);
          if (mode === 'coop') player.team = 'blue';
          else if (mode === 'ffa') player.team = `ffa-${r.players.size}`;
          r.add(player);
          room = r;
          r.broadcast({ type: 'joined', player: { alias, team: player.team, ready: true, isHost: false } }, player);
          r.broadcast({ type: 'state', room: r.snapshot() });
          safeSend({ type: 'state', room: r.snapshot() });
          break;
        }

        // ----- Unirse en lobby normal -----
        if (r.phase !== 'lobby') return fail('La partida ya terminó');
        if ([...r.players].some((p) => p.alias.toLowerCase() === alias.toLowerCase())) {
          return fail('Ese alias ya está en uso en esta sala');
        }
        player = new Player(ws, alias);
        if (!r.add(player)) return fail('Sala llena');
        room = r;
        room.broadcast({ type: 'joined', player: { alias, team: 'auto', ready: false, isHost: false } }, player);
        // Refrescar el snapshot completo a TODOS (incluido el recién llegado)
        // para que la lista de jugadores se actualice instantáneamente en el
        // resto de clientes (antes sólo recibían `joined`, que la UI ignora).
        room.broadcast({ type: 'state', room: room.snapshot() });
        break;
      }
      case 'approve-join': {
        if (!player || !room) return fail('No estás en una sala');
        const reqId = String(msg.requestId || '');
        const pending = room.pendingJoins.get(reqId);
        if (!pending) return; // ya resuelto.
        // Solo miembros del team destino pueden aprobar.
        if (player.team !== pending.team) return fail('No pertenecés al equipo destino');
        if (msg.accept === true) {
          clearTimeout(pending.timer);
          room.pendingJoins.delete(reqId);
          // Crear nuevo Player atado al ws del solicitante.
          const newPlayer = new Player(pending.ws, pending.alias);
          newPlayer.team = pending.team;
          room.add(newPlayer);
          // Asociar el nuevo socket con su player y room en su closure.
          attachToPending(pending.ws, newPlayer, room);
          room.broadcast({ type: 'joined', player: { alias: newPlayer.alias, team: newPlayer.team, ready: true, isHost: false } });
          room.broadcast({ type: 'state', room: room.snapshot() });
          try { pending.ws.send(JSON.stringify({ type: 'state', room: room.snapshot() })); } catch {}
          try { pending.ws.send(JSON.stringify({ type: 'rejoin-info', message: `Aprobado por ${player.alias}. Bienvenido al equipo ${pending.team}.` })); } catch {}
        } else if (msg.accept === false) {
          // Cualquier rechazo cancela inmediatamente la solicitud.
          clearTimeout(pending.timer);
          room.pendingJoins.delete(reqId);
          try { pending.ws.send(JSON.stringify({ type: 'error', message: `Rechazado por ${player.alias}` })); } catch {}
          try { pending.ws.close(); } catch {}
        }
        break;
      }
      case 'team': {
        if (!player || !room) return fail('No estás en una sala');
        if (['red', 'blue', 'auto'].includes(msg.team)) player.team = msg.team;
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
        // El host queda implícitamente listo al pulsar INICIAR (no hace falta
        // que se marque listo a sí mismo manualmente).
        room.host.ready = true;
        const validation = validateStart(room);
        if (!validation.ok) return fail(validation.reason);
        // Resolver auto-asignaciones ANTES del countdown para que la regla
        // "≥1 jugador por equipo" sea determinista en pantalla.
        applyTeamAssignments(room);
        room.broadcast({ type: 'state', room: room.snapshot() });
        beginCountdown(room);
        break;
      }
      case 'chat': {
        if (!player || !room) return fail('No estás en una sala');
        const text = String(msg.text || '').slice(0, 200);
        if (!text.trim()) return;
        const inMatch = room.phase === 'match';
        const scope = inMatch ? 'team' : 'global';
        const payload = { type: 'chat', from: player.alias, text, scope, team: inMatch ? player.team : null };
        if (inMatch) {
          // Privado: sólo a miembros del mismo team.
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
      default: fail(`Tipo desconocido: ${msg.type}`);
    }
  });

  ws.on('close', cleanup);
  ws.on('error', cleanup);

  function cleanup() {
    if (!room || !player) return;
    // Si la partida está en curso, conservar el slot por 60s para reconexión.
    if (room.phase === 'match') {
      const aliasKey = player.alias.toLowerCase();
      const wasHost = player === room.host;
      // Capturar referencias locales — al final de cleanup() room/player se
      // setean a null y este timer dispara 60s después, fuera del closure.
      const targetRoom = room;
      const targetTeam = player.team;
      room.remove(player);
      const graceTimer = setTimeout(() => {
        try {
          if (!rooms.has(targetRoom.code)) return; // sala ya destruida
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
      if (room.players.size === 0) {
        // Nadie online: pausa de cortesía; si nadie reconecta, el grace timer cerrará todo.
        room.broadcast({ type: 'state', room: room.snapshot() });
      } else {
        room.broadcast({ type: 'state', room: room.snapshot() });
      }
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

  /**
   * Reasigna este socket WS a un Player ya creado (caso reconnect aprobado).
   * Reusa el mismo conjunto de handlers ya registrados.
   */
  function attachToPending(targetWs, newPlayer, targetRoom) {
    if (targetWs !== ws) return; // solo si el approve corresponde a este mismo socket.
    player = newPlayer;
    room = targetRoom;
  }
});

function sanitizeAlias(raw) {
  const s = String(raw || '').trim().slice(0, 20);
  if (s.length < 1) return null;
  return s.replace(/[<>"'`]/g, '');
}

// ---------- Match lifecycle ----------
function beginCountdown(room) {
  let value = 3;
  room.broadcast({ type: 'match-countdown', value });
  room.countdownTimer = setInterval(() => {
    value -= 1;
    room.broadcast({ type: 'match-countdown', value });
    if (value <= 0) {
      clearInterval(room.countdownTimer);
      room.countdownTimer = null;
      // Si la sala se vació mientras se contaba, no arrancar.
      if (room.players.size === 0) return;
      startMatch(room);
    }
  }, 1000);
}

function startMatch(room) {
  // Los teams ya fueron asignados por `applyTeamAssignments` antes del countdown
  // en `case 'start'`. Aquí sólo creamos el motor del modo y arrancamos los ticks.
  const players = [...room.players];
  room.match = createMode(room.opts.mode, room.opts, players);
  room.phase = 'match';
  room.broadcast({ type: 'match-started', match: room.match.snapshot() });
  room.broadcast({ type: 'state', room: room.snapshot() });

  // Tick cada 1s.
  room.matchTimer = setInterval(() => {
    const result = room.match.tick();
    if (result.events?.length) {
      for (const ev of result.events) room.broadcast({ type: 'match-event', ...ev });
    }
    room.broadcast({ type: 'match-tick', timeLeft: result.timeLeft, scores: result.scores });
    if (result.ended) endMatch(room, result);
  }, 1000);
}

function endMatch(room, result) {
  if (!room.match) return;
  stopMatch(room);
  room.phase = 'ended';
  // Cancelar reconexiones pendientes y descartar slots caídos: la partida terminó.
  for (const [, info] of room.disconnected) {
    if (info.graceTimer) clearTimeout(info.graceTimer);
  }
  room.disconnected.clear();
  for (const [, pending] of room.pendingJoins) {
    if (pending.timer) clearTimeout(pending.timer);
    try { pending.ws.send(JSON.stringify({ type: 'error', message: 'La partida terminó antes de aprobar tu reconexión' })); } catch {}
    try { pending.ws.close(); } catch {}
  }
  room.pendingJoins.clear();
  room.broadcast({
    type: 'match-ended',
    winner: result.winner,
    scores: result.scores,
    summary: result.summary ?? null,
  });
  // Volver al lobby después de 8s para permitir revancha.
  setTimeout(() => {
    if (!rooms.has(room.code)) return;
    room.phase = 'lobby';
    room.match = null;
    room.players.forEach((p) => (p.ready = false));
    room.broadcast({ type: 'state', room: room.snapshot() });
  }, 8000);
}

function stopMatch(room) {
  if (room.matchTimer) {
    clearInterval(room.matchTimer);
    room.matchTimer = null;
  }
  if (room.countdownTimer) {
    clearInterval(room.countdownTimer);
    room.countdownTimer = null;
  }
}

function autoAssignTeams(players) {
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

/**
 * Cuenta jugadores por team (sólo red / blue / otros).
 */
function countTeams(players) {
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
function applyTeamAssignments(room) {
  const players = [...room.players];
  const mode = room.opts.mode;
  if (mode === 'red-vs-blue' || mode === 'capture') {
    autoAssignTeams(players);
  } else if (mode === 'coop') {
    players.forEach((p) => (p.team = 'blue'));
  } else if (mode === 'ffa') {
    players.forEach((p, i) => (p.team = `ffa-${i}`));
  }
}

/**
 * Verifica que la partida pueda iniciarse según las reglas del usuario:
 *   1) Todos los jugadores deben estar listos.
 *   2) En modos simétricos / asimétricos (red-vs-blue, capture) debe haber
 *      al menos 1 jugador en cada team tras la auto-asignación hipotética.
 */
function validateStart(room) {
  const players = [...room.players];
  if (players.length < 1) return { ok: false, reason: 'No hay jugadores en la sala' };
  // Excluir host de la regla "ready"? — la regla del usuario dice TODOS los jugadores.
  const notReady = players.filter((p) => !p.ready);
  if (notReady.length > 0) {
    const aliases = notReady.map((p) => p.alias).join(', ');
    return { ok: false, reason: `Faltan jugadores listos: ${aliases}` };
  }
  const mode = room.opts.mode;
  if (mode === 'red-vs-blue' || mode === 'capture') {
    // Simular asignación para verificar balance de equipos.
    const sim = players.map((p) => ({ team: p.team }));
    autoAssignTeams(sim);
    const counts = countTeams(sim);
    if (counts.red < 1 || counts.blue < 1) {
      return { ok: false, reason: 'Cada equipo necesita al menos 1 jugador' };
    }
  }
  return { ok: true };
}

// ---------- Heartbeat ----------
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    for (const p of [...room.players]) {
      if (now - p.lastPong > TIMEOUT_MS) {
        try { p.ws.terminate(); } catch {}
        room.remove(p);
        room.broadcast({ type: 'left', alias: p.alias });
      } else {
        p.send({ type: 'ping' });
      }
    }
    if (room.players.size === 0) {
      stopMatch(room);
      rooms.delete(room.code);
    } else {
      room.broadcast({ type: 'state', room: room.snapshot() });
    }
  }
}, HEARTBEAT_MS);

// ---------- IPC con Electron (cuando se usa fork) ----------
if (process.send) {
  process.send({ type: 'ready', port: PORT });
  process.on('message', (m) => {
    if (m === 'shutdown') {
      console.log('[gameServer] shutdown solicitado');
      wss.close(() => process.exit(0));
    }
  });
}
