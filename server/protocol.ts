/**
 * protocol.ts — contrato compartido cliente↔server (solo tipos, sin runtime).
 *
 * Este módulo se importa con `import type` desde:
 *   - server/gameServer.ts (compilado por tsconfig.server.json)
 *   - src/services/LobbyService.ts (incluido por tsconfig.json del renderer)
 *
 * Cualquier cambio rompe AMBOS lados en compile-time. Si necesitás un mensaje
 * nuevo, agregalo a la unión discriminada y a la cadena de manejadores.
 *
 * Decisión de diseño: NO contiene runtime (no funciones, no consts) para no
 * contaminar el bundle del renderer ni acoplar dependencias del server.
 */

// ───────────────────────── Tipos básicos ─────────────────────────

export type Mode = 'red-vs-blue' | 'capture' | 'coop' | 'ffa';

/** `auto` solo es válido en lobby antes de iniciar; el server lo resuelve a red/blue. */
export type Team = 'red' | 'blue' | 'auto' | 'neutral' | `ffa-${number}`;

export type MatchPhase = 'lobby' | 'match' | 'ended';

export interface RoomRules {
  time: boolean;
  firstToN: boolean;
  objectives: boolean;
  firstToNTarget: number;
}

export interface RoomOpts {
  mode: Mode;
  teamSize: number;
  serverCount: number;
  durationSec: number;
  rules: RoomRules;
}

/** Subset enviable por el host al hacer `config`. */
export type RoomOptsPartial = Partial<Omit<RoomOpts, 'rules'>> & {
  rules?: Partial<RoomRules>;
};

export interface PlayerSnapshot {
  alias: string;
  team: Team;
  ready: boolean;
  isHost: boolean;
}

export interface DisconnectedSnapshot {
  alias: string;
  team: Team;
}

export interface ServerNode {
  ip: string;
  owner: Team;                 // 'red' | 'blue' | 'neutral' | `ffa-N`
  attackingTeam: Team | null;
  attackProgress: number;
  lastAttackerAlias: string | null;
  defendedAt: number;
}

export type Scores = Record<string, number>;

export interface MatchSnapshot {
  mode: Mode;
  opts: RoomOpts;
  timeLeft: number;
  scores: Scores;
  servers: ServerNode[];
}

export interface RoomSnapshot {
  code: string;
  phase: MatchPhase;
  opts: RoomOpts;
  host: string | null;
  players: PlayerSnapshot[];
  disconnected: DisconnectedSnapshot[];
  match: MatchSnapshot | null;
}

// ───────────────────────── Eventos de match ─────────────────────────

export type MatchEventKind = 'attack' | 'defend' | 'captured' | 'wave' | 'lost';

export interface MatchEventBase {
  event: MatchEventKind;
  ip: string;
  team: Team;
  by?: string | null;
  victim?: Team | null;
  progress?: number;
  total?: number;
}

export interface TickResult {
  timeLeft: number;
  scores: Scores;
  events?: MatchEventBase[];
  ended?: boolean;
  winner?: Team | 'draw';
  summary?: string;
}

// ───────────────────────── Mensajes Cliente → Server ─────────────────────────

export interface CMHost {
  type: 'host';
  alias: string;
  opts?: RoomOptsPartial;
}
export interface CMJoin {
  type: 'join';
  code: string;
  alias: string;
  /** Sólo requerido al unirse a una sala con partida en curso (modos rb / capture). */
  team?: 'red' | 'blue';
}
export interface CMApproveJoin {
  type: 'approve-join';
  requestId: string;
  accept: boolean;
}
export interface CMLeave   { type: 'leave' }
export interface CMTeam    { type: 'team'; team: 'red' | 'blue' | 'auto' }
export interface CMReady   { type: 'ready'; ready: boolean }
export interface CMConfig  { type: 'config'; opts: RoomOptsPartial }
export interface CMStart   { type: 'start' }
export interface CMChat    { type: 'chat'; text: string }
export interface CMAction  { type: 'action'; cmd: string; target?: string }
export interface CMPong    { type: 'pong' }

export type ClientMsg =
  | CMHost | CMJoin | CMApproveJoin | CMLeave | CMTeam | CMReady
  | CMConfig | CMStart | CMChat | CMAction | CMPong;

// ───────────────────────── Mensajes Server → Cliente ─────────────────────────

export interface SMState  { type: 'state'; room: RoomSnapshot }
export interface SMJoined { type: 'joined'; player: PlayerSnapshot }
export interface SMLeft   { type: 'left'; alias: string; reason?: 'disconnect' | 'kick' | 'leave' }
export interface SMChat {
  type: 'chat';
  from: string;
  text: string;
  scope: 'team' | 'global';
  team: Team | null;
}
export interface SMMatchStarted   { type: 'match-started'; match: MatchSnapshot }
export interface SMMatchTick      { type: 'match-tick'; timeLeft: number; scores: Scores }
export interface SMMatchEvent     extends MatchEventBase { type: 'match-event' }
export interface SMMatchEnded {
  type: 'match-ended';
  winner: Team | 'draw';
  scores: Scores;
  summary: string | null;
}
export interface SMMatchCountdown { type: 'match-countdown'; value: number }
export interface SMJoinRequest    { type: 'join-request'; requestId: string; alias: string; team: Team }
export interface SMJoinResolved   { type: 'join-resolved'; requestId: string; by: string; accepted: boolean }
export interface SMPendingApproval{ type: 'pending-approval'; message: string; team: Team }
export interface SMRejoinInfo     { type: 'rejoin-info'; message: string }
export interface SMTeamRequired   { type: 'team-required'; mode: Mode; code: string }
export interface SMError          { type: 'error'; message: string }
export interface SMPing           { type: 'ping' }

export type ServerMsg =
  | SMState | SMJoined | SMLeft | SMChat
  | SMMatchStarted | SMMatchTick | SMMatchEvent | SMMatchEnded | SMMatchCountdown
  | SMJoinRequest | SMJoinResolved | SMPendingApproval | SMRejoinInfo | SMTeamRequired
  | SMError | SMPing;

// ───────────────────────── Engine de modos (Liskov) ─────────────────────────

/**
 * Todos los modos cumplen este contrato. `Player` se define del lado server
 * (clase concreta con `ws`); para tipar `handleAction` desde el contrato
 * compartido usamos esta cara mínima.
 */
export interface PlayerLike {
  alias: string;
  team: Team;
}

export interface ModeEngine {
  snapshot(): MatchSnapshot;
  handleAction(player: PlayerLike, msg: CMAction): void;
  tick(): TickResult;
}

// ───────────────────────── Type guards ─────────────────────────

export const MODES: readonly Mode[] = ['red-vs-blue', 'capture', 'coop', 'ffa'] as const;

export function isMode(x: unknown): x is Mode {
  return typeof x === 'string' && (MODES as readonly string[]).includes(x);
}

export function isExplicitTeam(x: unknown): x is 'red' | 'blue' {
  return x === 'red' || x === 'blue';
}

export function isLobbyTeam(x: unknown): x is 'red' | 'blue' | 'auto' {
  return x === 'red' || x === 'blue' || x === 'auto';
}
