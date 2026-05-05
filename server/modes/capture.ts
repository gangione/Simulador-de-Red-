/**
 * Capture the Server — simétrico.
 * Ambos equipos pueden atacar y defender; gana quien controle más servidores
 * al expirar el tiempo (o quien capture todos antes).
 */
import { BaseMode, CAPTURE_SECONDS } from './base.js';
import type { Mode, RoomOpts, PlayerLike, TickResult, Team } from '../protocol.js';

export class CaptureMode extends BaseMode {
  static override readonly MODE_ID: Mode = 'capture';

  constructor(opts: RoomOpts, players: PlayerLike[]) {
    super(opts, players);
    this.servers.forEach((s) => (s.owner = 'neutral'));
  }

  override tick(): TickResult {
    this.tickCommon();
    for (const s of this.servers) {
      if (s.attackingTeam && s.attackProgress >= CAPTURE_SECONDS) {
        const newOwner = s.attackingTeam;
        if (s.owner !== newOwner) {
          s.owner = newOwner;
          this.scores[newOwner] = (this.scores[newOwner] ?? 0) + 2;
          this.pendingEvents.push({
            event: 'captured', ip: s.ip, by: s.lastAttackerAlias, team: newOwner,
          });
        }
        s.attackProgress = 0;
        s.attackingTeam = null;
      }
    }

    const events = this.drainEvents();
    const earlyWinner = this.checkEarlyWinner();
    const ended = this.timeLeft <= 0 || earlyWinner !== null;
    const result: TickResult = {
      timeLeft: this.timeLeft,
      scores: this.scores,
      events,
      ended,
    };
    if (ended) {
      result.winner = earlyWinner ?? this.winnerByOwnership();
      result.summary = this.ownershipSummary();
    }
    return result;
  }

  private winnerByOwnership(): Team | 'draw' {
    const red  = this.servers.filter((s) => s.owner === 'red').length;
    const blue = this.servers.filter((s) => s.owner === 'blue').length;
    if (red > blue) return 'red';
    if (blue > red) return 'blue';
    return 'draw';
  }

  private ownershipSummary(): string {
    const red  = this.servers.filter((s) => s.owner === 'red').length;
    const blue = this.servers.filter((s) => s.owner === 'blue').length;
    return `Final: Red ${red} · Blue ${blue} · Neutral ${this.servers.length - red - blue}.`;
  }

  private checkEarlyWinner(): Team | null {
    if (this.servers.every((s) => s.owner === 'red'))  return 'red';
    if (this.servers.every((s) => s.owner === 'blue')) return 'blue';
    return this.checkFirstToN();
  }
}
