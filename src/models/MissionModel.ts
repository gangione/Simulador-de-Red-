import type { IMission } from '../types';
import { buildMissions } from '../data/missions.data';
import type { IStorageProvider } from '../services/StorageService';
import type { IEventBus } from '../services/EventBus';
import { Events } from '../services/EventBus';

/**
 * MissionModel — dueño del estado de las misiones activas y del catálogo de
 * progreso del usuario.
 *
 * Modelo multi-activo: el operador puede tener varias misiones corriendo en
 * paralelo. Sólo la misión ENFOCADA (la más reciente, o la elegida con `foco`)
 * se evalúa contra cada comando. Las demás quedan pausadas con su progreso
 * intacto hasta que se les transfiera el foco.
 *
 * SOLID — Responsabilidad única: estado de misiones únicamente. La lógica de
 *         rangos vive en `UserModel`; las actualizaciones de UI viajan por el
 *         `EventBus`.
 */
export class MissionModel {
  private readonly catalogue: Record<number, IMission>;
  /** IDs activos en orden de inicio (el último es el más reciente). */
  private activeIds: number[] = [];
  /** ID enfocado. `0` significa "no hay foco" (panel home). */
  private focusedId = 0;
  /** IDs ya completadas (perduran tras abortar/reiniciar). */
  private completed: number[];

  constructor(
    private readonly storage: IStorageProvider,
    private readonly bus: IEventBus,
  ) {
    this.catalogue = buildMissions();
    this.completed = storage.get<number[]>('compMissions', []);

    // Restaura misiones activas, foco y estado de cada paso desde el storage.
    const savedActive = storage.get<number[]>('activeMissionIds', []);
    const savedFocus = storage.get<number>('focusedMissionId', 0);
    const savedSteps = storage.get<Record<string, boolean[]>>('missionStepsById', {});

    for (const id of savedActive) {
      const m = this.catalogue[id];
      if (!m) continue;
      this.activeIds.push(id);
      const flags = savedSteps[String(id)] ?? [];
      m.steps.forEach((s, i) => (s.done = flags[i] === true));
    }
    if (savedFocus && this.catalogue[savedFocus] && this.activeIds.includes(savedFocus)) {
      this.focusedId = savedFocus;
    } else if (this.activeIds.length > 0) {
      this.focusedId = this.activeIds[this.activeIds.length - 1];
    }
  }

  /**
   * Persiste el estado de las misiones activas (IDs + flags por paso + foco)
   * en `IStorageProvider`. Lo invoca el comando `save`.
   */
  snapshot(): void {
    const stepsById: Record<string, boolean[]> = {};
    for (const id of this.activeIds) {
      const m = this.catalogue[id];
      if (m) stepsById[String(id)] = m.steps.map((s) => s.done);
    }
    this.storage.set('activeMissionIds', this.activeIds);
    this.storage.set('focusedMissionId', this.focusedId);
    this.storage.set('missionStepsById', stepsById);
    this.storage.set('compMissions', this.completed);
  }

  /**
   * Reemite los eventos de misiones activas para que las vistas (dashboard)
   * se redibujen tras un `restore()` desde `localStorage`.
   */
  resumeIfAny(): void {
    if (this.activeIds.length === 0) return;
    for (const id of this.activeIds) {
      const m = this.catalogue[id];
      if (!m) continue;
      this.bus.emit(Events.MissionStarted, m);
      m.steps.forEach((s, idx) => {
        if (s.done) this.bus.emit(Events.MissionStepDone, { mission: m, stepIndex: idx });
      });
    }
    const f = this.getFocused();
    if (f) {
      this.bus.emit(Events.MissionFocused, f);
      const doneCount = f.steps.filter((s) => s.done).length;
      this.bus.emit(Events.ProgressChanged, { done: doneCount, total: f.steps.length });
    }
  }

  /** Catálogo completo (incluye misiones aún no iniciadas). */
  list(): ReadonlyArray<IMission> {
    return Object.values(this.catalogue);
  }

  /** Obtiene una misión del catálogo por ID, o `undefined`. */
  get(id: number): IMission | undefined {
    return this.catalogue[id];
  }

  /** Lista de misiones actualmente activas (en orden de inicio). */
  getActive(): IMission[] {
    return this.activeIds
      .map((id) => this.catalogue[id])
      .filter((m): m is IMission => Boolean(m));
  }

  /** Sólo los IDs activos, en orden de inicio. */
  getActiveIds(): ReadonlyArray<number> {
    return this.activeIds;
  }

  /** True si la misión indicada está entre las activas. */
  isActive(id: number): boolean {
    return this.activeIds.includes(id);
  }

  /** Misión actualmente enfocada, o `undefined` si no hay foco. */
  getFocused(): IMission | undefined {
    return this.focusedId === 0 ? undefined : this.catalogue[this.focusedId];
  }

  /** ID de la misión enfocada (`0` = sin foco). */
  getFocusedId(): number {
    return this.focusedId;
  }

  /**
   * Quita el foco SIN abortar ninguna misión. Las activas quedan pausadas con
   * su progreso intacto y el dashboard vuelve al panel home.
   * @returns `true` si había foco que limpiar.
   */
  unfocus(): boolean {
    if (this.focusedId === 0) return false;
    this.focusedId = 0;
    // Sentinela `total: 0` → DashboardView muestra el home pane.
    this.bus.emit(Events.ProgressChanged, { done: 0, total: 0 });
    return true;
  }

  /** @deprecated Usar `getFocused()`. Conservado por compatibilidad. */
  getCurrent(): IMission | undefined {
    return this.getFocused();
  }

  /** @deprecated Usar `getFocusedId()`. */
  getCurrentId(): number {
    return this.focusedId;
  }

  /** Cantidad total de misiones completadas históricamente. */
  getCompletedCount(): number {
    return this.completed.length;
  }

  /** Lista inmutable de IDs completados. */
  getCompleted(): ReadonlyArray<number> {
    return this.completed;
  }

  /**
   * Inicia una misión y la enfoca. Si ya estaba activa, sólo refoca sin
   * resetear el progreso.
   * @returns `{ mission, alreadyActive }` o `undefined` si el ID no existe.
   */
  start(id: number): { mission: IMission; alreadyActive: boolean } | undefined {
    const m = this.catalogue[id];
    if (!m) return undefined;

    if (this.activeIds.includes(id)) {
      // Ya activa — sólo refocar, no se resetea el progreso.
      this.focusedId = id;
      this.bus.emit(Events.MissionFocused, m);
      this.emitFocusedProgress();
      return { mission: m, alreadyActive: true };
    }

    // Reset de pasos (cubre también re-runs de misiones ya completadas).
    m.steps.forEach((s) => (s.done = false));
    this.activeIds.push(id);
    this.focusedId = id;
    this.bus.emit(Events.MissionStarted, m);
    this.bus.emit(Events.MissionFocused, m);
    this.emitFocusedProgress();
    return { mission: m, alreadyActive: false };
  }

  /**
   * Cambia el foco hacia una misión YA activa.
   * @returns la misión enfocada, o `undefined` si no estaba activa.
   */
  focus(id: number): IMission | undefined {
    if (!this.activeIds.includes(id)) return undefined;
    const m = this.catalogue[id];
    if (!m) return undefined;
    this.focusedId = id;
    this.bus.emit(Events.MissionFocused, m);
    this.emitFocusedProgress();
    return m;
  }

  /**
   * Aborta una misión. Si se omite `id`, aborta la enfocada.
   * @returns `{ aborted, newFocused }` con la misión abortada y la siguiente
   *          que recibió el foco (o `undefined` si no quedan activas).
   */
  abort(id?: number): { aborted: IMission; newFocused: IMission | undefined } | undefined {
    const targetId = id ?? this.focusedId;
    if (!targetId) return undefined;
    const m = this.catalogue[targetId];
    if (!m || !this.activeIds.includes(targetId)) return undefined;

    m.steps.forEach((s) => (s.done = false));
    this.activeIds = this.activeIds.filter((x) => x !== targetId);

    if (this.focusedId === targetId) {
      this.focusedId = this.activeIds.length > 0 ? this.activeIds[this.activeIds.length - 1] : 0;
    }

    this.bus.emit(Events.MissionAborted, m);

    const newFocused = this.getFocused();
    if (newFocused) {
      this.bus.emit(Events.MissionFocused, newFocused);
      this.emitFocusedProgress();
    } else {
      this.bus.emit(Events.ProgressChanged, { done: 0, total: 0 });
    }
    return { aborted: m, newFocused };
  }

  /**
   * Evalúa un comando crudo contra los pasos (regex) de la misión ENFOCADA.
   * Las demás misiones activas están pausadas (decisión de diseño intencional).
   *
   * @returns un objeto con los índices de pasos recién completados, si la
   *          misión terminó, y la nueva misión enfocada después del transfer.
   */
  evaluate(cmd: string): {
    newlyCompleted: number[];
    finished: boolean;
    finishedMission?: IMission;
    newFocused?: IMission;
  } {
    const m = this.getFocused();
    if (!m) return { newlyCompleted: [], finished: false };

    const newlyCompleted: number[] = [];
    m.steps.forEach((step, idx) => {
      if (!step.done && step.regex.test(cmd)) {
        step.done = true;
        newlyCompleted.push(idx);
        this.bus.emit(Events.MissionStepDone, { mission: m, stepIndex: idx });
      }
    });

    const finished = m.steps.every((s) => s.done);
    let newFocused: IMission | undefined;

    if (finished) {
      if (!this.completed.includes(m.id)) {
        this.completed = [...this.completed, m.id];
        this.storage.set('compMissions', this.completed);
      }
      this.bus.emit(Events.MissionCompleted, m);

      // Saca la misión del set activo y refoca a la siguiente más reciente.
      this.activeIds = this.activeIds.filter((x) => x !== m.id);
      this.focusedId = this.activeIds.length > 0 ? this.activeIds[this.activeIds.length - 1] : 0;
      newFocused = this.getFocused();
      if (newFocused) {
        this.bus.emit(Events.MissionFocused, newFocused);
        this.emitFocusedProgress();
      } else {
        this.bus.emit(Events.ProgressChanged, { done: 0, total: 0 });
      }
    } else {
      this.emitFocusedProgress();
    }

    return { newlyCompleted, finished, finishedMission: finished ? m : undefined, newFocused };
  }

  /** Emite `progress:changed` con el estado de la misión enfocada (o `0/0`). */
  private emitFocusedProgress(): void {
    const f = this.getFocused();
    if (!f) {
      this.bus.emit(Events.ProgressChanged, { done: 0, total: 0 });
      return;
    }
    const doneCount = f.steps.filter((s) => s.done).length;
    this.bus.emit(Events.ProgressChanged, { done: doneCount, total: f.steps.length });
  }
}
