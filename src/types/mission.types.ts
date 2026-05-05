/**
 * Tipos del sistema de misiones.
 *
 * Refleja la estructura del prototipo monolítico (`script.js`) pero tipada y
 * con `IMissionStep.done` como único campo mutable (el motor lo marca tras
 * detectar el comando esperado mediante `regex`).
 */

/** Un objetivo concreto dentro de una misión. */
export interface IMissionStep {
  /** Texto humano: `'1. Confirma caída: ping 192.168.1.10'`. */
  readonly text: string;
  /** Regex contra la cual `MissionModel.evaluate()` testea cada comando. */
  readonly regex: RegExp;
  /** Marca de paso completado. Mutable por diseño. */
  done: boolean;
}

/** Una crisis completa: D1, D2, M101, … */
export interface IMission {
  readonly id: number;
  readonly title: string;
  readonly desc: string;
  readonly steps: IMissionStep[];
}

/** Snapshot del progreso del usuario (para debugging y tests). */
export interface IProgress {
  readonly completedMissions: ReadonlyArray<number>;
  readonly tutorials: { red: boolean; dos: boolean; fw: boolean; atk: boolean };
  readonly rank: string;
}

/** Identificador discriminante de los cuatro tutoriales del simulador. */
export type TutorialKey = 'red' | 'dos' | 'fw' | 'atk';
