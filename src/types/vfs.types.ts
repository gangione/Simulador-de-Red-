/**
 * Tipos del Virtual File System (VFS) — sistema de archivos en memoria.
 *
 * Está modelado como un mapa `path -> { nombre -> entrada }`. Cada path es
 * absoluto (`'C:\\Users\\Administrador'`, `'C:\\Users\\Administrador\\Descargas'`).
 */

/** Una entrada del VFS: archivo (con contenido) o directorio. */
export type VFSEntry =
  | { type: 'file'; content: string; size?: number }
  | { type: 'dir' };

/** Estructura raíz del VFS: por path absoluto, sus entradas hijas por nombre. */
export interface IVFS {
  [path: string]: { [name: string]: VFSEntry };
}
