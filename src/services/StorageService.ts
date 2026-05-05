/**
 * Abstracción de almacenamiento.
 *
 * SOLID — Segregación de interfaces: una interfaz pequeña y enfocada de la
 *         que dependen los modelos.
 * SOLID — Inversión de dependencias: los modelos dependen de
 *         `IStorageProvider`, nunca de `sessionStorage` directamente. Eso
 *         permite cambiar la implementación para tests o, más adelante,
 *         IndexedDB sin tocar el dominio.
 */

/** Contrato mínimo de un proveedor de almacenamiento clave-valor. */
export interface IStorageProvider {
  /** Lee `key`; devuelve `fallback` si no existe o no se puede parsear. */
  get<T>(key: string, fallback: T): T;
  /** Persiste `value` bajo `key`. Si es objeto se serializa con JSON. */
  set<T>(key: string, value: T): void;
  /** Borra `key` (no falla si no existía). */
  remove(key: string): void;
  /** Borra todas las claves del proveedor. */
  clear(): void;
}

/**
 * Implementación basada en `sessionStorage` del navegador (volátil — vive
 * mientras dure la ventana de Electron). Añade `persist()` / `restore()` para
 * pasar datos a `localStorage` con prefijo `sim:` y así sobrevivir cierres.
 */
export class SessionStorageProvider implements IStorageProvider {
  /**
   * Lee `key` parseando JSON. Si el valor crudo no es JSON válido se devuelve
   * tal cual (compatibilidad con el formato legacy del prototipo).
   */
  get<T>(key: string, fallback: T): T {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw === null) return fallback;
      // Los valores se guardan como JSON o como strings legacy crudos.
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    } catch {
      return fallback;
    }
  }

  /** Escribe `value` (string crudo o `JSON.stringify`) en `sessionStorage`. */
  set<T>(key: string, value: T): void {
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      sessionStorage.setItem(key, serialized);
    } catch {
      /* cuota llena o storage deshabilitado — silenciar */
    }
  }

  remove(key: string): void {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* ignorar */
    }
  }

  clear(): void {
    try {
      sessionStorage.clear();
    } catch {
      /* ignorar */
    }
  }

  /**
   * Persiste todas las claves de `sessionStorage` en `localStorage` bajo el
   * prefijo `sim:` para que sobrevivan a un cierre de la app. Devuelve la
   * cantidad de claves copiadas.
   *
   * Lo invoca `SaveCommand` (`save` / `save confirm`).
   */
  persist(): number {
    let count = 0;
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key === null) continue;
        const value = sessionStorage.getItem(key);
        if (value === null) continue;
        localStorage.setItem(`sim:${key}`, value);
        count++;
      }
    } catch {
      /* ignorar */
    }
    return count;
  }

  /**
   * Restaura claves previamente persistidas (prefijo `sim:`) desde
   * `localStorage` hacia `sessionStorage`. Se invoca una sola vez al arrancar,
   * antes de que los modelos lean su estado en sus constructores.
   */
  restore(): number {
    let count = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const fullKey = localStorage.key(i);
        if (fullKey === null || !fullKey.startsWith('sim:')) continue;
        const value = localStorage.getItem(fullKey);
        if (value === null) continue;
        sessionStorage.setItem(fullKey.substring(4), value);
        count++;
      }
    } catch {
      /* ignorar */
    }
    return count;
  }

  /** True si existe al menos una clave con prefijo `sim:` en `localStorage`. */
  hasPersisted(): boolean {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k !== null && k.startsWith('sim:')) return true;
      }
    } catch {
      /* ignorar */
    }
    return false;
  }
}

/** Proveedor en memoria — fallback usado en tests o si `sessionStorage` no está disponible. */
export class MemoryStorageProvider implements IStorageProvider {
  private readonly store = new Map<string, unknown>();
  get<T>(key: string, fallback: T): T {
    return this.store.has(key) ? (this.store.get(key) as T) : fallback;
  }
  set<T>(key: string, value: T): void {
    this.store.set(key, value);
  }
  remove(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}
