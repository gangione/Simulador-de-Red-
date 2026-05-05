import type { IVFS } from '../types';

/**
 * Estructura inicial del VFS — replica el layout del simulador original.
 */
export function buildVFS(): IVFS {
  return {
    'C:\\Users\\Administrador': {
      'apuntes.txt': { type: 'file', content: 'Topología: 3 Laboratorios. Total 60 PCs activos.' },
      Descargas: { type: 'dir' },
      Oculto: { type: 'dir' },
    },
    'C:\\Users\\Administrador\\Descargas': {
      'gusano.bat': { type: 'file', content: 'copy %0 copia.bat\ngoto loop' },
      'broma_gigante.txt': { type: 'file', content: '[ARCHIVO DE 50GB DETECTADO]', size: 53687091200 },
    },
    'C:\\Users\\Administrador\\Oculto': { Sistema: { type: 'dir' } },
    'C:\\Users\\Administrador\\Oculto\\Sistema': {
      'respuestas.txt': { type: 'file', content: 'Respuestas: 1.A, 2.B, 3.TCP/IP' },
    },
    'Z:': {
      'spiderman.mp4': { type: 'file', content: '[CONTENIDO ILEGAL - PELÍCULA 2GB]' },
      'juego.iso': { type: 'file', content: '[ARCHIVO PESADO - INSTALADOR]' },
    },
  };
}
