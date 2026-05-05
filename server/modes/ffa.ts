/**
 * Free-for-All — cada jugador defiende su propio servidor.
 * Último en pie gana. Score = capturas hechas + tiempo defendido.
 */
import { BaseMode, CAPTURE_SECONDS } from './base.js';
import type { Mode, RoomOpts, PlayerLike, TickResult, Team } from '../protocol.js';

export class FfaMode extends BaseMode {
  static override readonly MODE_ID: Mode = 'ffa';

  constructor(opts: RoomOpts, players: PlayerLike[]) {
    super(opts, players);
    this.scores = {};
    // Asignar 1 servidor por jugador. Si hay menos servidores que jugadores,
    // los extras quedan sin servidor (espectadores hasta que alguien caiga).
    this.servers.forEach((s, i) => {
      const p = players[i];
      if (p) {
        s.owner = p.team;
        this.scores[p.team] = 0;
      }
    });
  }

  override tick(): TickResult {
    this.tickCommon();
    for (const s of this.servers) {
      if (s.attackingTeam && s.attackingTeam !== s.owner && s.attackProgress >= CAPTURE_SECONDS) {
        const old = s.owner;
        s.owner = s.attackingTeam;
        s.attackProgress = 0;
        s.attackingTeam = null;
        this.scores[s.owner] = (this.scores[s.owner] ?? 0) + 5;
        this.pendingEvents.push({
          event: 'captured', ip: s.ip, by: s.lastAttackerAlias, team: s.owner, victim: old,
        });
      }
    }
    // 1 punto por segundo para el dueño actual de cada servidor.
    for (const s of this.servers) {
      if (s.owner && s.owner !== 'neutral') {
        this.scores[s.owner] = (this.scores[s.owner] ?? 0) + 1;
      }
    }

    const aliveTeams = new Set<Team>(
      this.servers.map((s) => s.owner).filter((o): o is Team => o !== 'neutral'),
    );
    const ended = this.timeLeft <= 0 || aliveTeams.size <= 1;
    const result: TickResult = {
      timeLeft: this.timeLeft,
      scores: this.scores,
      events: this.drainEvents(),
      ended,
    };
    if (ended) {
      const ranked = Object.entries(this.scores).sort((a, b) => b[1] - a[1]);
      const top = ranked[0]?.[0];
      result.winner = (top as Team | undefined) ?? 'draw';
      result.summary = `Quedan ${aliveTeams.size} jugadores con servidor.`;
    }
    return result;
  }
}
