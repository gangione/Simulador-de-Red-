/**
 * Tipos del sistema de comandos.
 *
 * SOLID — Segregación de interfaces: `ICommand` expone solo lo que el dispatcher
 *         necesita; nada más.
 * SOLID — Abierto/Cerrado: para sumar comandos basta con implementar `ICommand`
 *         y registrarlo en `main.ts`. El dispatcher (`CommandController`) no se
 *         modifica nunca.
 */

/**
 * Contexto que el `CommandController` arma y le pasa a cada `ICommand` al
 * ejecutarlo. Es inmutable para proteger al comando de efectos colaterales.
 */
export interface ICommandContext {
  /** Tokens del comando ya separados por espacios (`args[0]` = nombre). */
  readonly args: string[];
  /** Línea cruda tal cual la escribió el usuario. */
  readonly raw: string;
  /** Directorio de trabajo actual del simulador (ej. `C:\Users\Administrador`). */
  readonly cwd: string;
}

/**
 * Resultado devuelto por un `ICommand`. El `AppController` interpreta cada
 * campo y emite los eventos correspondientes en el `EventBus`.
 */
export interface ICommandResult {
  /** Líneas a imprimir en la terminal. Cada entrada: `[texto, color CSS opcional]`. */
  readonly output: ReadonlyArray<readonly [string, string?]>;
  /** Si está presente, cambia el `cwd` del simulador y emite `prompt:changed`. */
  readonly newCwd?: string;
  /** Marca un tutorial como completado (dispara `tutorial:completed`). */
  readonly tutorialCompleted?: 'red' | 'dos' | 'fw' | 'atk';
}

/**
 * Contrato común de un comando ejecutable.
 *
 * @example
 * export class HelloCommand implements ICommand {
 *   readonly name = 'hello';
 *   readonly aliases = ['hi'];
 *   execute(ctx: ICommandContext): ICommandResult {
 *     return { output: [[`Hola, ${ctx.args[1] ?? 'mundo'}!`]] };
 *   }
 * }
 */
export interface ICommand {
  /** Palabra clave principal (ej. `'ping'`). Case-insensitive en el dispatcher. */
  readonly name: string;
  /** Alias adicionales (ej. `['clear']` para `cls`). */
  readonly aliases?: readonly string[];
  /** Ejecuta el comando. Puede ser sincrónico o asíncrono. */
  execute(ctx: ICommandContext): Promise<ICommandResult> | ICommandResult;
}
