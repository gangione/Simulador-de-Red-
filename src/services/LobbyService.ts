/**
 * LobbyService — cliente WebSocket que habla con `server/gameServer.ts`.
 *
 * SOLID — Single Responsibility: sólo se encarga del transporte y la
 *         normalización de eventos hacia el `EventBus`. Las vistas se
 *         enchufan a los eventos `lobby:*` sin saber que existe WS.
 *
 * El contrato de mensajes vive en `server/protocol.ts` y se comparte
 * cliente↔server con `import type` (rompe ambos lados en compile-time si
 * se modifica).
 */
import type { IEventBus } from './EventBus';
import { Events } from './EventBus';
import type { IStorageProvider } from './StorageService';
import type {
  ClientMsg, ServerMsg, RoomSnapshot, RoomOptsPartial, Mode,
} from '../../server/protocol';

export type { RoomSnapshot, Mode } from '../../server/protocol';
export type RoomOpts = RoomOptsPartial;

export type LobbyStatus = 'idle' | 'connecting' | 'in-room' | 'in-match' | 'disconnected';

declare global {
  interface Window {
    lobbyAPI?: {
      startServer(opts?: { port?: number }): Promise<{ port: number; lanIps: Array<{ name: string; address: string }>; alreadyRunning?: boolean }>;
      stopServer(): Promise<{ stopped: boolean }>;
      getStatus(): Promise<{ running: boolean; port: number; lanIps: Array<{ name: string; address: string }> }>;
      getLanIps(): Promise<Array<{ name: string; address: string }>>;
    };
  }
}

export class LobbyService {
  private ws: WebSocket | null = null;
  private status: LobbyStatus = 'idle';
  private alias = '';
  /** Código de la sala para la que el server pidió elegir equipo (handshake en 2 pasos). */
  private pendingRejoinCode: string | null = null;
  private currentRoom: RoomSnapshot | null = null;
  private reconnectAttempts = 0;
  private explicitDisconnect = false;
  private serverUrl = '';

  constructor(
    private readonly bus: IEventBus,
    private readonly storage: IStorageProvider,
  ) {}

  getStatus(): LobbyStatus { return this.status; }
  getRoom(): RoomSnapshot | null { return this.currentRoom; }
  getAlias(): string { return this.alias; }

  /** Si hay `window.lobbyAPI`, levanta el servidor local en Electron. */
  async startLocalServer(port = 7331): Promise<{ port: number; lanIps: Array<{ name: string; address: string }> } | null> {
    if (!window.lobbyAPI) return null;
    return window.lobbyAPI.startServer({ port });
  }

  async stopLocalServer(): Promise<void> {
    if (window.lobbyAPI) await window.lobbyAPI.stopServer();
  }

  /** Crea sala como host (debe haber un servidor accesible en `url`). */
  async host(url: string, alias: string, opts: RoomOpts = {}): Promise<void> {
    this.alias = alias;
    await this.connect(url);
    this.send({ type: 'host', alias, opts });
  }

  /** Se une a una sala existente. */
  async join(url: string, code: string, alias: string): Promise<void> {
    this.alias = alias;
    await this.connect(url);
    this.send({ type: 'join', code: code.toLowerCase().trim(), alias });
  }

  /**
   * Reconexión / unirse durante una partida en curso.
   * Requiere elegir team explícitamente (red|blue) salvo que se reconecte con
   * un alias previamente registrado por el server.
   */
  async rejoin(url: string, code: string, alias: string, team: 'red' | 'blue'): Promise<void> {
    this.alias = alias;
    await this.connect(url);
    this.send({ type: 'join', code: code.toLowerCase().trim(), alias, team });
  }

  /** Aprobar / rechazar una solicitud de reconexión recibida. */
  approveJoin(requestId: string, accept: boolean): void {
    this.send({ type: 'approve-join', requestId, accept });
  }

  /**
   * Reenviar el `join` con el equipo elegido tras un `team-required`. Reusa la
   * conexión WS ya abierta: el server respondía con `team-required` sin haber
   * registrado al jugador, así que ahora el segundo `join` lo crea.
   */
  chooseTeam(team: 'red' | 'blue'): void {
    if (!this.pendingRejoinCode) return;
    this.send({ type: 'join', code: this.pendingRejoinCode, alias: this.alias, team });
  }

  setTeam(team: 'red' | 'blue' | 'auto'): void { this.send({ type: 'team', team }); }
  setReady(ready: boolean): void { this.send({ type: 'ready', ready }); }
  config(opts: RoomOpts): void { this.send({ type: 'config', opts }); }
  startMatch(): void { this.send({ type: 'start' }); }
  chat(text: string): void { this.send({ type: 'chat', text }); }
  /** Reporta una acción de gameplay (Fase C). */
  reportAction(cmd: string, target?: string): void {
    if (this.status !== 'in-match') return;
    this.send({ type: 'action', cmd, target });
  }

  leave(): void {
    this.explicitDisconnect = true;
    this.send({ type: 'leave' });
    try { this.ws?.close(); } catch { /* ignore */ }
    this.ws = null;
    this.currentRoom = null;
    this.pendingRejoinCode = null;
    this.setStatus('idle');
  }

  // ---------- internos ----------
  private connect(url: string): Promise<void> {
    this.serverUrl = url;
    this.explicitDisconnect = false;
    this.setStatus('connecting');
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(url);
        this.ws = ws;
        ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.bus.emit(Events.LobbyConnection, { status: 'connected' });
          resolve();
        };
        ws.onmessage = (ev) => this.onMessage(ev.data);
        ws.onerror = () => {
          this.bus.emit(Events.LobbyError, 'Error de conexión WebSocket');
        };
        ws.onclose = () => {
          this.ws = null;
          this.setStatus('disconnected');
          this.bus.emit(Events.LobbyConnection, { status: 'disconnected' });
          if (!this.explicitDisconnect) this.scheduleReconnect();
        };
        // Timeout duro a 5s.
        setTimeout(() => {
          if (ws.readyState === WebSocket.CONNECTING) {
            try { ws.close(); } catch { /* ignore */ }
            reject(new Error('Timeout conectando al servidor'));
          }
        }, 5000);
      } catch (err) {
        reject(err);
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= 3) return;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 8000);
    this.reconnectAttempts++;
    setTimeout(() => {
      if (this.serverUrl && !this.ws) {
        void this.connect(this.serverUrl).catch(() => { /* ignore */ });
      }
    }, delay);
  }

  private send(payload: ClientMsg): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try { this.ws.send(JSON.stringify(payload)); } catch { /* ignore */ }
  }

  private onMessage(raw: unknown): void {
    let msg: ServerMsg;
    try { msg = JSON.parse(String(raw)) as ServerMsg; } catch { return; }
    switch (msg.type) {
      case 'state': {
        const room = msg.room;
        this.currentRoom = room;
        this.pendingRejoinCode = null;
        this.persistHistory(room);
        this.setStatus(room.phase === 'match' ? 'in-match' : 'in-room');
        this.bus.emit(Events.LobbyState, room);
        break;
      }
      case 'joined':
        this.bus.emit(Events.LobbyPlayerJoined, msg.player);
        break;
      case 'left':
        this.bus.emit(Events.LobbyPlayerLeft, { alias: msg.alias });
        break;
      case 'chat':
        this.bus.emit(Events.LobbyChat, {
          from: msg.from,
          text: msg.text,
          scope: msg.scope,
          team: msg.team,
        });
        break;
      case 'match-started':
        this.setStatus('in-match');
        this.bus.emit(Events.LobbyMatchStarted, msg.match);
        break;
      case 'match-countdown':
        this.bus.emit(Events.LobbyMatchCountdown, { value: msg.value });
        break;
      case 'join-request':
        this.bus.emit(Events.LobbyJoinRequest, {
          requestId: msg.requestId,
          alias: msg.alias,
          team: String(msg.team),
        });
        break;
      case 'join-resolved':
        this.bus.emit(Events.LobbyJoinResolved, {
          requestId: msg.requestId,
          by: msg.by,
          accepted: msg.accepted,
        });
        break;
      case 'pending-approval':
        this.bus.emit(Events.LobbyJoinPending, {
          message: msg.message,
          team: String(msg.team),
        });
        break;
      case 'rejoin-info':
        this.bus.emit(Events.LobbyRejoinInfo, msg.message);
        break;
      case 'team-required':
        this.pendingRejoinCode = msg.code.toLowerCase();
        this.bus.emit(Events.LobbyTeamRequired, {
          mode: msg.mode,
          code: this.pendingRejoinCode,
        });
        break;
      case 'match-tick':
        this.bus.emit(Events.LobbyMatchTick, { timeLeft: msg.timeLeft, scores: msg.scores });
        break;
      case 'match-event':
        if (msg.event === 'captured') {
          this.bus.emit(Events.LobbyServerCaptured, { ip: msg.ip, by: msg.by, team: msg.team });
        }
        this.bus.emit(Events.LobbyMatchEvent, msg);
        break;
      case 'match-ended':
        this.setStatus('in-room');
        this.bus.emit(Events.LobbyMatchEnded, {
          winner: msg.winner, scores: msg.scores, summary: msg.summary,
        });
        break;
      case 'error':
        this.bus.emit(Events.LobbyError, msg.message);
        break;
      case 'ping':
        this.send({ type: 'pong' });
        break;
    }
  }

  private setStatus(s: LobbyStatus): void {
    this.status = s;
  }

  /** Guarda el código de sala visitado para reuso (últimos 5 alias también). */
  private persistHistory(room: RoomSnapshot): void {
    try {
      const recent = this.storage.get<string[]>('lobby:recent-codes', []);
      const codes = [room.code, ...recent.filter((c) => c !== room.code)].slice(0, 5);
      this.storage.set('lobby:recent-codes', codes);
      this.storage.set('lobby:last-alias', this.alias);
    } catch { /* ignore */ }
  }

  /** Lee historial de códigos recientes para sugerir en la UI. */
  getRecentCodes(): string[] {
    return this.storage.get<string[]>('lobby:recent-codes', []);
  }
  getLastAlias(): string {
    return this.storage.get<string>('lobby:last-alias', '');
  }
}
