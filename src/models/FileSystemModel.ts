import type { IVFS, VFSEntry } from '../types';
import { buildVFS } from '../data/vfs.data';

/**
 * FileSystemModel — encapsula el Virtual File System (VFS) en memoria.
 *
 * SOLID — Responsabilidad única: navegación de directorios y CRUD de
 *         archivos, nada más. Sin I/O real, sin DOM, sin parseo de comandos.
 */
export class FileSystemModel {
  private vfs: IVFS;

  constructor() {
    this.vfs = buildVFS();
  }

  /**
   * Devuelve el record de entradas del directorio en `path`. Lo crea vacío si
   * no existía (los comandos `mkdir`, `echo > archivo`, etc. cuentan con esto).
   */
  getDir(path: string): Record<string, VFSEntry> {
    let p = path;
    if (p.endsWith('\\') && p.length > 3) p = p.slice(0, -1);
    if (!this.vfs[p]) this.vfs[p] = {};
    return this.vfs[p];
  }

  /** True si la unidad indicada (ej. `'C:'`, `'Z:'`) está disponible. */
  hasDrive(drive: string): boolean {
    return drive in this.vfs || drive === 'C:';
  }

  /**
   * Resuelve un `cd <target>` contra el directorio actual.
   * @returns la nueva ruta absoluta, o `null` si el destino no existe o no es
   *          un directorio.
   */
  resolveCd(currentDir: string, target: string | undefined): string | null {
    if (!target) return currentDir;
    if (target === '..') {
      if (currentDir.length <= 3) return currentDir;
      const idx = currentDir.lastIndexOf('\\');
      return currentDir.substring(0, idx) || 'C:\\';
    }
    const dir = this.getDir(currentDir);
    const entry = dir[target];
    if (entry && entry.type === 'dir') {
      return currentDir + (currentDir.endsWith('\\') ? '' : '\\') + target;
    }
    return null;
  }

  /** Crea un archivo de texto en `dirPath` con el contenido indicado. */
  createFile(dirPath: string, name: string, content: string): void {
    this.getDir(dirPath)[name] = { type: 'file', content };
  }

  /** Crea un directorio vacío dentro de `dirPath`. */
  createDir(dirPath: string, name: string): void {
    this.getDir(dirPath)[name] = { type: 'dir' };
  }

  /** Borra una entrada (archivo o directorio). True si la borró. */
  delete(dirPath: string, name: string): boolean {
    const dir = this.getDir(dirPath);
    if (dir[name]) {
      delete dir[name];
      return true;
    }
    return false;
  }

  /** Lee el contenido de un archivo de texto, o `null` si no existe. */
  read(dirPath: string, name: string): string | null {
    const e = this.getDir(dirPath)[name];
    return e && e.type === 'file' ? e.content : null;
  }
}
