import type { ICommand, ICommandContext, ICommandResult } from '../../types';
import type { FileSystemModel } from '../../models/FileSystemModel';

/**
 * Comandos del sistema de archivos virtual (VFS).
 *
 * Cada clase implementa `ICommand` y opera sobre `FileSystemModel`. El
 * dispatcher las descubre cuando se registran en `main.ts`, sin
 * modificaciones aquí.
 */

export class DirCommand implements ICommand {
  readonly name = 'dir';
  constructor(private readonly fs: FileSystemModel) {}
  execute(ctx: ICommandContext): ICommandResult {
    const folder = this.fs.getDir(ctx.cwd);
    let result = `\n El volumen de la unidad C no tiene etiqueta.\n El Número de serie del volumen es: 843E-12AB\n\n Directorio de ${ctx.cwd}\n\n`;
    let dirs = 2;
    let files = 0;
    result += `10/05/2026  10:00 a. m.    <DIR>          .\n10/05/2026  10:00 a. m.    <DIR>          ..\n`;
    for (const key of Object.keys(folder)) {
      const entry = folder[key];
      if (!entry) continue;
      if (entry.type === 'dir') {
        result += `10/05/2026  10:01 a. m.    <DIR>          ${key}\n`;
        dirs++;
      } else {
        const size = entry.size ?? 1024;
        result += `10/05/2026  10:05 a. m.       ${String(size).padStart(10, ' ')}  ${key}\n`;
        files++;
      }
    }
    result += `               ${files} archivos          1.024 bytes\n               ${dirs} dirs     45.234.122.112 bytes libres\n`;
    return { output: [[result]], tutorialCompleted: 'dos' };
  }
}

export class CdCommand implements ICommand {
  readonly name = 'cd';
  constructor(private readonly fs: FileSystemModel) {}
  execute(ctx: ICommandContext): ICommandResult {
    const target = ctx.args[1];
    if (!target) return { output: [[ctx.cwd]] };
    const next = this.fs.resolveCd(ctx.cwd, target);
    if (next === null) {
      return { output: [['El sistema no puede encontrar la ruta especificada.']] };
    }
    return { output: [], newCwd: next };
  }
}

export class MkdirCommand implements ICommand {
  readonly name = 'mkdir';
  readonly aliases = ['md'];
  constructor(private readonly fs: FileSystemModel) {}
  execute(ctx: ICommandContext): ICommandResult {
    if (ctx.args[1]) this.fs.createDir(ctx.cwd, ctx.args[1]);
    return { output: [] };
  }
}

export class DelCommand implements ICommand {
  readonly name = 'del';
  constructor(private readonly fs: FileSystemModel) {}
  execute(ctx: ICommandContext): ICommandResult {
    const target = ctx.args[1];
    if (!target) return { output: [['Sintaxis: del <archivo>']] };
    if (target === '*.mp4') {
      this.fs.delete(ctx.cwd, 'spiderman.mp4');
      return { output: [['Archivos eliminados.']] };
    }
    if (this.fs.delete(ctx.cwd, target)) {
      return { output: [['Archivo eliminado.']] };
    }
    return { output: [['No se pudo encontrar el archivo.']] };
  }
}

export class TypeCommand implements ICommand {
  readonly name = 'type';
  constructor(private readonly fs: FileSystemModel) {}
  execute(ctx: ICommandContext): ICommandResult {
    const target = ctx.args[1];
    if (!target) return { output: [['Sintaxis: type <archivo>']] };
    const content = this.fs.read(ctx.cwd, target);
    if (content === null) {
      return { output: [['El sistema no puede encontrar el archivo.']] };
    }
    return { output: [[content]] };
  }
}

export class TreeCommand implements ICommand {
  readonly name = 'tree';
  execute(): ICommandResult {
    return {
      output: [[
        'C:.\n├───Descargas\n│   ├───gusano.bat\n│   └───broma_gigante.txt\n└───Oculto\n    └───Sistema\n        └───respuestas.txt',
      ]],
    };
  }
}

export class EchoCommand implements ICommand {
  readonly name = 'echo';
  constructor(private readonly fs: FileSystemModel) {}
  execute(ctx: ICommandContext): ICommandResult {
    if (!ctx.raw.includes('>')) {
      return { output: [[ctx.args.slice(1).join(' ')]] };
    }
    const parts = ctx.raw.substring(4).split('>');
    const content = (parts[0] ?? '').trim();
    const fname = (parts[1] ?? '').trim();
    if (fname) this.fs.createFile(ctx.cwd, fname, content);
    return { output: [] };
  }
}
