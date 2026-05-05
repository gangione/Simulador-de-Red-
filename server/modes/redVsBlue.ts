/**
 * Red vs Blue — asimétrico.
 * - Red ataca, gana puntos por cada captura.
 * - Blue defiende, gana 1 punto cada 30s que un servidor permanezca defendido.
 */
import { BaseMode, CAPTURE_SECONDS } from './base.js';
import type { Mode, RoomOpts, PlayerLike, TickResult, Team } from '../protocol.js';

export class RedVsBlueMode extends BaseMode {
  static override readonly MODE_ID: Mode = 'red-vs-blue';

  private defenseTickAccumulator = 0;

  constructor(opts: RoomOpts, players: PlayerLike[]) {
    super(opts, players);
    // Por defecto los servidores son del equipo Blue.
    this.servers.forEach((s) => (s.owner = 'blue'));
  }

  override tick(): TickResult {
    this.tickCommon();
    // Resolver capturas completas.
    for (const s of this.servers) {
      if (s.attackingTeam === 'red' && s.attackProgress >= CAPTURE_SECONDS && s.owner === 'blue') {
        s.owner = 'red';
        s.attackProgress = 0;
        s.attackingTeam = null;
        this.scores.red = (this.scores.red ?? 0) + 3;
        this.pendingEvents.push({
          event: 'captured', ip: s.ip, by: s.lastAttackerAlias, team: 'red',
        });
      }
    }
    // Defensa: cada 30s vivo y defendido = 1 punto al Blue.
    this.defenseTickAccumulator++;
    if (this.defenseTickAccumulator >= 30) {
      this.defenseTickAccumulator = 0;
      const stillBlue = this.servers.filter((s) => s.owner === 'blue').length;
      this.scores.blue = (this.scores.blue ?? 0) + stillBlue;
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
      result.winner = earlyWinner ?? this.winnerByScore();
      result.summary = `Red capturó ${this.servers.filter(s => s.owner === 'red').length}/${this.servers.length} servidores.`;
    }
    return result;
  }

  private checkEarlyWinner(): Team | null {
    if (this.servers.every((s) => s.owner === 'red')) return 'red';
    return this.checkFirstToN();
  }
}
