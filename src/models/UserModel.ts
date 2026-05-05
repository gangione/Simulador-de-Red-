import type { TutorialKey } from '../types';
import type { IStorageProvider } from '../services/StorageService';
import type { IEventBus } from '../services/EventBus';
import { Events } from '../services/EventBus';

/**
 * UserModel — dueño de la progresión del usuario: tutoriales superados,
 * rango y historial de comandos.
 *
 * SOLID — Responsabilidad única: estado del usuario, nada más.
 */
export class UserModel {
  private tutorials: Record<TutorialKey, boolean>;
  private rank: string;
  private readonly history: string[] = [];

  constructor(
    private readonly storage: IStorageProvider,
    private readonly bus: IEventBus,
  ) {
    this.tutorials = storage.get<Record<TutorialKey, boolean>>('tutStatus', {
      red: false,
      dos: false,
      fw: false,
      atk: false,
    });
    this.rank = storage.get<string>('userRank', 'ESTUDIANTE');
  }

  /** Mapa de tutoriales completados (en sólo lectura). */
  getTutorials(): Readonly<Record<TutorialKey, boolean>> {
    return this.tutorials;
  }

  /** Rango actual del usuario (texto legible). */
  getRank(): string {
    return this.rank;
  }

  /** Persiste flags de tutoriales y rango en el `IStorageProvider`. */
  snapshot(): void {
    this.storage.set('tutStatus', this.tutorials);
    this.storage.set('userRank', this.rank);
  }

  /** Registra un comando ejecutado en el historial en memoria. */
  pushHistory(cmd: string): void {
    this.history.push(cmd);
  }

  /** Historial completo de comandos ejecutados. */
  getHistory(): ReadonlyArray<string> {
    return this.history;
  }

  /**
   * Marca un tutorial como completado. Si era nuevo, persiste el cambio y
   * emite `Events.TutorialCompleted` para que el dashboard se actualice.
   * @returns `true` si era nuevo, `false` si ya estaba completado.
   */
  completeTutorial(t: TutorialKey): boolean {
    if (this.tutorials[t]) return false;
    this.tutorials = { ...this.tutorials, [t]: true };
    this.storage.set('tutStatus', this.tutorials);
    this.bus.emit(Events.TutorialCompleted, t);
    return true;
  }

  /**
   * Recalcula el rango a partir de la cantidad de misiones completadas y los
   * tutoriales superados. Si el rango sube, lo persiste y emite
   * `Events.RankChanged`.
   *
   * Tabla de ascensos:
   * - 20+ misiones → THE KING/QUEEN OF THE HACKER
   * - 15+         → FUTURO HACKER
   * - 10+         → ADMINISTRADOR DE REDES SENIOR
   * - 5+          → ADMINISTRADOR DE REDES SEMI-SENIOR
   * - Tutoriales completos → ADMINISTRADOR DE REDES - JUNIOR
   */
  recomputeRank(missionsDone: number): { changed: boolean; newRank: string; message: string } {
    const tutsDone = Object.values(this.tutorials).every(Boolean);
    let newRank = 'ESTUDIANTE';
    let message = '';

    if (missionsDone >= 20) {
      newRank = 'THE KING/QUEEN OF THE HACKER';
      message = 'Has conquistado todos los desafíos absolutos del simulador.';
    } else if (missionsDone >= 15) {
      newRank = 'FUTURO HACKER';
      message = 'Tu conocimiento supera las barreras estándar.';
    } else if (missionsDone >= 10) {
      newRank = 'ADMINISTRADOR DE REDES SENIOR';
      message = 'Controlas la red con maestría y seguridad.';
    } else if (missionsDone >= 5) {
      newRank = 'ADMINISTRADOR DE REDES SEMI-SENIOR';
      message = 'Tus habilidades de resolución de crisis son notables.';
    } else if (tutsDone) {
      newRank = 'ADMINISTRADOR DE REDES - JUNIOR';
      message = 'Has completado todos los tutoriales: ahora eres administrador de redes junior.';
    }

    const changed = newRank !== this.rank && newRank !== 'ESTUDIANTE';
    if (changed) {
      this.rank = newRank;
      this.storage.set('userRank', newRank);
      this.bus.emit(Events.RankChanged, { rank: newRank, message });
    }
    return { changed, newRank, message };
  }

  // ---------- Historial de partidas multijugador (Fase 3) ----------
  /**
   * Registra el resultado de una partida en el historial persistente
   * (`lobby:history`, últimos 20).
   */
  pushMatch(entry: {
    code: string;
    mode: string;
    role: string;
    result: 'win' | 'lose' | 'draw';
    score: number;
    ts?: number;
  }): void {
    const list = this.storage.get<MatchHistoryEntry[]>('lobby:history', []);
    list.unshift({ ts: Date.now(), ...entry });
    this.storage.set('lobby:history', list.slice(0, 20));
  }

  /** Devuelve el historial de partidas (más reciente primero). */
  getMatches(): ReadonlyArray<MatchHistoryEntry> {
    return this.storage.get<MatchHistoryEntry[]>('lobby:history', []);
  }
}

export interface MatchHistoryEntry {
  ts: number;
  code: string;
  mode: string;
  role: string;
  result: 'win' | 'lose' | 'draw';
  score: number;
}
