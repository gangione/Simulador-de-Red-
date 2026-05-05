import type { ICommand, ICommandContext, ICommandResult } from '../types';
import { Events, type IEventBus } from '../services/EventBus';

/**
 * CommandController — dispatcher central (patrón Command + Registry).
 *
 * SOLID — Abierto/Cerrado: para sumar comandos basta con `register(...)`;
 *         este archivo no se modifica.
 * SOLID — Responsabilidad única: parseo y enrutado. La lógica de cada
 *         comando vive en su propia clase `ICommand`.
 */
export class CommandController {
  private readonly registry = new Map<string, ICommand>();
  private getCwd: () => string = () => 'C:\\Users\\Administrador';
  private setCwd: (cwd: string) => void = () => undefined;

  constructor(private readonly bus: IEventBus) {}

  /** Conecta los getters/setters del CWD compartido (lo gobierna `main.ts`). */
  bindCwd(getter: () => string, setter: (cwd: string) => void): void {
    this.getCwd = getter;
    this.setCwd = setter;
  }

  /** Registra un comando bajo su nombre principal y todos sus alias. */
  register(cmd: ICommand): void {
    this.registry.set(cmd.name.toLowerCase(), cmd);
    cmd.aliases?.forEach((a) => this.registry.set(a.toLowerCase(), cmd));
  }

  /** True si existe un comando registrado con ese nombre o alias. */
  has(name: string): boolean {
    return this.registry.has(name.toLowerCase());
  }

  /**
   * Parsea la línea cruda, detecta casos especiales (cambio de unidad, echo
   * con redirección, sintaxis pegada `ipconfig/flushdns`) y delega al handler.
   */
  async dispatch(raw: string): Promise<ICommandResult | null> {
    const args = raw.split(/\s+/);
    let cmd = (args[0] || '').toLowerCase();

    // Cambio de unidad: "C:" / "Z:".
    if (/^[a-z]:$/i.test(cmd)) {
      return this.changeDrive(cmd.toUpperCase());
    }
    // Echo con redirección: lo maneja el `EchoCommand` dedicado.
    if (cmd === 'echo' && raw.includes('>')) {
      return null;
    }
    // Algunas invocaciones legacy llegan pegadas: "ipconfig/flushdns".
    if (cmd.startsWith('ipconfig/')) {
      const sub = cmd.substring('ipconfig/'.length);
      args[0] = 'ipconfig';
      args.splice(1, 0, `/${sub}`);
      cmd = 'ipconfig';
    }

    const handler = this.registry.get(cmd);
    if (!handler) {
      return {
        output: [
          [
            `'${cmd}' no se reconoce como un comando interno o externo, programa o archivo por lotes ejecutable.`,
          ],
        ],
      };
    }

    const ctx: ICommandContext = {
      args,
      raw,
      cwd: this.getCwd(),
    };
    const result = await handler.execute(ctx);
    if (result.newCwd) this.setCwd(result.newCwd);
    return result;
  }

  /** Maneja el cambio de unidad (`C:`, `Z:`, etc.). */
  private changeDrive(drive: string): ICommandResult {
    if (drive === 'C:') {
      const cwd = 'C:\\Users\\Administrador';
      this.setCwd(cwd);
      return { output: [], newCwd: cwd };
    }
    // Otras unidades: por simplicidad se acepta el cambio sin validar el VFS.
    const cwd = drive + '\\';
    this.setCwd(cwd);
    return { output: [], newCwd: cwd };
  }

  /** Publica un resultado emitiendo eventos `TerminalPrint` (efecto centralizado). */
  publish(result: ICommandResult): void {
    for (const [text, color] of result.output) {
      this.bus.emit(Events.TerminalPrint, { text, color });
    }
  }
}
