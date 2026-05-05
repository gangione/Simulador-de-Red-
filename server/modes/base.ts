/**
 * BaseMode — utilidades comunes a todos los modos.
 *
 * SOLID — Liskov: cualquier subclase de BaseMode puede pasarse como
 * `ModeEngine` (ver protocol.ts) sin que el dispatcher del server lo note.
 *
 * Captura por presencia: un atacante mantiene una IP enfocada N segundos
 * sin que un defensor tire una acción defensiva sobre ella.
 */
import { pickServers } from './index.js';
import type {
  ModeEngine, MatchSnapshot, Mode, RoomOpts, ServerNode, Scores,
  TickResult, MatchEventBase, PlayerLike, CMAction, Team,
} from '../protocol.js';

export const CAPTURE_SECONDS = 30;

// Comandos que cuentan como ataque / defensa. Son patrones simples sobre
// el comando crudo enviado por el cliente.
const ATTACK_RX = /^(nmap|crack|tracert|nbtstat)\b/i;
const DEFEND_RX = /^(netsh|sfc|taskkill|net\s+user|net\s+localgroup|netstat)\b/i;

export abstract class BaseMode implements ModeEngine {
  static readonly MODE_ID: Mode = 'red-vs-blue';

  protected readonly startedAt: number;
  protected timeLeft: number;
  protected scores: Scores;
  protected readonly servers: ServerNode[];
  protected pendingEvents: MatchEventBase[];

  constructor(
    protected readonly opts: RoomOpts,
    protected readonly players: PlayerLike[],
  ) {
    this.startedAt = Date.now();
    this.timeLeft = opts.durationSec;
    this.scores = { red: 0, blue: 0 };
    this.servers = pickServers(opts.serverCount).map<ServerNode>((ip) => ({
      ip,
      owner: 'neutral',
      attackingTeam: null,
      attackProgress: 0,
      lastAttackerAlias: null,
      defendedAt: 0,
    }));
    this.pendingEvents = [];
  }

  /** ID del modo concreto. Cada subclase sobrescribe `MODE_ID`. */
  protected get modeId(): Mode {
    return (this.constructor as typeof BaseMode).MODE_ID;
  }

  snapshot(): MatchSnapshot {
    return {
      mode: this.modeId,
      opts: this.opts,
      timeLeft: this.timeLeft,
      scores: this.scores,
      servers: this.servers,
    };
  }

  /** Ataque/defensa básico: registra intento sobre `target` ip. */
  handleAction(player: PlayerLike, msg: CMAction): void {
    const cmd = String(msg.cmd ?? '').trim();
    const target = String(msg.target ?? '').trim();
    if (!cmd || !target) return;
    const srv = this.servers.find((s) => s.ip === target);
    if (!srv) return;

    if (ATTACK_RX.test(cmd)) {
      // Sólo el equipo opuesto al dueño puede atacar.
      if (srv.owner !== player.team) {
        srv.attackingTeam = player.team;
        srv.attackProgress = Math.min(srv.attackProgress + 5, CAPTURE_SECONDS);
        srv.lastAttackerAlias = player.alias;
        this.pendingEvents.push({
          event: 'attack', ip: target, by: player.alias, team: player.team,
          progress: srv.attackProgress, total: CAPTURE_SECONDS,
        });
      }
    } else if (DEFEND_RX.test(cmd)) {
      if (srv.owner === player.team || srv.owner === 'neutral') {
        if (srv.attackingTeam && srv.attackingTeam !== player.team) {
          srv.attackProgress = 0;
          srv.attackingTeam = null;
          srv.defendedAt = Date.now();
          this.pendingEvents.push({
            event: 'defend', ip: target, by: player.alias, team: player.team,
          });
        }
      }
    }
  }

  /** Subclases deben implementar el avance por tick. */
  abstract tick(): TickResult;

  // ── helpers protegidos ──

  /** Drena eventos generados desde el último tick. */
  protected drainEvents(): MatchEventBase[] {
    const ev = this.pendingEvents;
    this.pendingEvents = [];
    return ev;
  }

  protected tickCommon(): void {
    this.timeLeft = Math.max(0, this.timeLeft - 1);
  }

  protected checkFirstToN(): Team | null {
    const r = this.opts.rules;
    if (!r?.firstToN) return null;
    const target = r.firstToNTarget;
    if ((this.scores.red ?? 0) >= target)  return 'red';
    if ((this.scores.blue ?? 0) >= target) return 'blue';
    return null;
  }

  protected winnerByScore(): Team | 'draw' {
    const r = this.scores.red ?? 0;
    const b = this.scores.blue ?? 0;
    if (r > b) return 'red';
    if (b > r) return 'blue';
    return 'draw';
  }
}
