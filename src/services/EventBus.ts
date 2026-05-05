/**
 * EventBus — patrón Observer (publish/subscribe) que es el único canal de
 * comunicación entre vistas, controladores, modelos y servicios.
 *
 * SOLID — Inversión de dependencias: los controladores dependen de esta
 *         abstracción para hablar con las vistas sin conocerlas.
 *
 * Hook Fase 3: un futuro `GameServer` LAN/multijugador puede engancharse a los
 * mismos canales para retransmitir el estado entre clientes.
 */

/** Función suscriptora. Recibe el payload tipado del evento. */
export type EventHandler<T = unknown> = (payload: T) => void;

/** Contrato público del bus. Implementaciones concretas pueden ser locales o de red. */
export interface IEventBus {
  /** Suscribe `handler` al `event`. Devuelve una función para cancelar la suscripción. */
  on<T>(event: string, handler: EventHandler<T>): () => void;
  /** Cancela una suscripción manualmente. */
  off(event: string, handler: EventHandler): void;
  /** Emite el evento. Cada handler se invoca con el `payload`. */
  emit<T>(event: string, payload?: T): void;
}

/**
 * Implementación local en memoria del bus. Usa `Map<string, Set<handler>>`
 * para evitar duplicados y dar O(1) en suscripción/cancelación.
 */
export class EventBus implements IEventBus {
  private readonly listeners = new Map<string, Set<EventHandler>>();

  on<T>(event: string, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler as EventHandler);
    return () => this.off(event, handler as EventHandler);
  }

  off(event: string, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  /**
   * Emite el evento aislando excepciones de cada handler para que un
   * suscriptor que falle no impida la ejecución del resto.
   */
  emit<T>(event: string, payload?: T): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const h of set) {
      try {
        h(payload);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[EventBus] El handler de "${event}" lanzó una excepción:`, err);
      }
    }
  }
}

/**
 * Nombres canónicos de eventos usados en toda la aplicación.
 * Documentación del payload de cada uno: `docs/07-eventos.md`.
 */
export const Events = {
  /** Imprime una línea en la terminal. Payload: `{ text, color? }`. */
  TerminalPrint: 'terminal:print',
  /** Limpia la terminal y restaura el banner inicial. Sin payload. */
  TerminalClear: 'terminal:clear',
  /** El usuario apretó Enter. Payload: `string` con la línea cruda. */
  CommandSubmitted: 'command:submitted',
  /** Una nueva misión entró al conjunto de activas. Payload: `IMission`. */
  MissionStarted: 'mission:started',
  /** Un paso de la misión enfocada se acaba de marcar como hecho. */
  MissionStepDone: 'mission:step-done',
  /** La misión enfocada se completó. Payload: `IMission`. */
  MissionCompleted: 'mission:completed',
  /** Una misión fue abortada. Payload: `IMission`. */
  MissionAborted: 'mission:aborted',
  /** El foco se transfirió a otra misión activa. Payload: `IMission`. */
  MissionFocused: 'mission:focused',
  /** Un tutorial se completó por primera vez. Payload: `TutorialKey`. */
  TutorialCompleted: 'tutorial:completed',
  /** El rango del usuario cambió. Payload: `{ rank, message }`. */
  RankChanged: 'rank:changed',
  /** Cambio de progreso de la misión enfocada. `{0,0}` = sin foco. */
  ProgressChanged: 'progress:changed',
  /** Pide actualizar un gauge concreto. Payload: `{ id, value }`. */
  GaugeUpdate: 'gauge:update',
  /** El cwd cambió — se debe redibujar el prompt. Payload: `string`. */
  PromptChanged: 'prompt:changed',
  /** Cambio de estado del sistema ("EJECUTANDO COMANDO...", "ESPERANDO INSTRUCCIONES..."). */
  TaskStatusChanged: 'task:status',
} as const;
