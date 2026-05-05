import type { IEventBus } from '../services/EventBus';

/**
 * BaseView — clase base abstracta de todos los paneles de UI.
 *
 * SOLID — Sustitución de Liskov: cualquier vista concreta (`TerminalView`,
 *         `DashboardView`) es intercambiable donde se espera una
 *         `BaseView`.
 * SOLID — Abierto/Cerrado: para sumar un panel nuevo basta con extender
 *         `BaseView`; el `AppController` no se toca.
 *
 * Encapsulación: las subclases reciben un helper `el()` para consultar el DOM
 * por id en un solo lugar (Template Method).
 */
export abstract class BaseView {
  constructor(protected readonly bus: IEventBus) {}

  /**
   * Engancha listeners del DOM y suscripciones al `EventBus`. Debe ser
   * implementado por cada subclase y se invoca una sola vez al arrancar.
   */
  abstract init(): void;

  /**
   * Busca un elemento por id; devuelve `null` si no existe (cada subclase
   * decide si eso es un error fatal o no).
   */
  protected el<T extends HTMLElement = HTMLElement>(id: string): T | null {
    return document.getElementById(id) as T | null;
  }
}
