/**
 * Co-op Defense — todos defensores contra oleadas scriptadas.
 * Cada 60s aparece un "ataque automatizado" sobre un servidor random.
 * Los jugadores deben usar acciones defensivas para neutralizarlo.
 * Gana el equipo si llega a tiempo final con al menos 1 servidor en pie.
 */
import { BaseMode, CAPTURE_SECONDS } from './base.js';
import type { Mode, RoomOpts, PlayerLike, TickResult } from '../protocol.js';

export class CoopMode extends BaseMode {
  static override readonly MODE_ID: Mode = 'coop';

  private waveAccumulator = 0;
  private readonly waveInterval = 60;

  constructor(opts: RoomOpts, players: PlayerLike[]) {
    super(opts, players);
    this.servers.forEach((s) => (s.owner = 'blue'));
    this.scores = { defended: 0, lost: 0 };
  }

  override tick(): TickResult {
    this.tickCommon();
    this.waveAccumulator++;
    if (this.waveAccumulator >= this.waveInterval) {
      this.waveAccumulator = 0;
      const alive = this.servers.filter((s) => s.owner === 'blue');
      if (alive.length > 0) {
        const target = alive[Math.floor(Math.random() * alive.length)];
        if (target) {
          target.attackingTeam = 'red';
          target.attackProgress = Math.max(target.attackProgress, CAPTURE_SECONDS / 2);
          target.lastAttackerAlias = 'BOT-RED';
          this.pendingEvents.push({
            event: 'wave', ip: target.ip, by: 'BOT-RED', team: 'red',
            progress: target.attackProgress, total: CAPTURE_SECONDS,
          });
        }
      }
    }
    // Avance lento de cualquier ataque activo.
    for (const s of this.servers) {
      if (s.attackingTeam === 'red' && s.owner === 'blue') {
        s.attackProgress += 1;
        if (s.attackProgress >= CAPTURE_SECONDS) {
          s.owner = 'red';
          s.attackProgress = 0;
          s.attackingTeam = null;
          this.scores.lost = (this.scores.lost ?? 0) + 1;
          this.pendingEvents.push({ event: 'lost', ip: s.ip, team: 'red' });
        }
      }
    }
    this.scores.defended = this.servers.filter((s) => s.owner === 'blue').length;

    const ended = this.timeLeft <= 0 || (this.scores.defended ?? 0) === 0;
    const result: TickResult = {
      timeLeft: this.timeLeft,
      scores: this.scores,
      events: this.drainEvents(),
      ended,
    };
    if (ended) {
      result.winner = (this.scores.defended ?? 0) > 0 ? 'blue' : 'red';
      result.summary = `Defendieron ${this.scores.defended ?? 0}/${this.servers.length} servidores.`;
    }
    return result;
  }
}
