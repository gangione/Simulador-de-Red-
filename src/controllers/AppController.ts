import { Events, type IEventBus } from '../services/EventBus';
import type { CommandController } from './CommandController';
import type { MissionModel } from '../models/MissionModel';
import type { UserModel } from '../models/UserModel';
import type { TutorialKey } from '../types';

/**
 * AppController — orquestador principal de la aplicación.
 *
 * Recibe la línea cruda de la terminal por el `EventBus`, la pasa al
 * `CommandController` para que se ejecute, publica el resultado en la vista
 * y luego evalúa el progreso de la misión enfocada.
 *
 * SOLID — Inversión de Dependencias: todos los colaboradores se inyectan por
 *         constructor; este controlador nunca instancia sus dependencias.
 * SOLID — Responsabilidad única: orquestación; aquí no viven reglas de negocio.
 */
export class AppController {
  constructor(
    private readonly bus: IEventBus,
    private readonly commands: CommandController,
    private readonly missions: MissionModel,
    private readonly users: UserModel,
  ) {}

  /** Suscribe el manejador principal al evento `CommandSubmitted`. */
  start(): void {
    this.bus.on<string>(Events.CommandSubmitted, (raw) => this.handle(raw));
  }

  /**
   * Pipeline cuando llega un comando del usuario:
   *   1. Marca el sistema como ocupado.
   *   2. Lo registra en el historial del usuario.
   *   3. Despacha el comando y publica su salida.
   *   4. Evalúa la misión enfocada y emite mensajes de progreso/ascenso.
   *   5. Restaura el estado a "ESPERANDO INSTRUCCIONES...".
   */
  private async handle(raw: string): Promise<void> {
    this.bus.emit(Events.TaskStatusChanged, 'EJECUTANDO COMANDO...');
    this.users.pushHistory(raw);

    try {
      const result = await this.commands.dispatch(raw);
      if (result) {
        // Sentinela CLS — emitido por `ClearCommand` para limpiar la terminal.
        const isClear =
          result.output.length === 1 &&
          result.output[0][0] === '__CLEAR__';
        if (isClear) {
          this.bus.emit(Events.TerminalClear);
        } else {
          this.commands.publish(result);
        }

        if (result.tutorialCompleted) {
          const newly = this.users.completeTutorial(result.tutorialCompleted as TutorialKey);
          if (newly) this.users.recomputeRank(this.missions.getCompletedCount());
        }
        if (result.newCwd) {
          this.bus.emit(Events.PromptChanged, result.newCwd);
        }
      }

      // Chequeo de progreso de misión: corre DESPUÉS de imprimir la salida.
      const progress = this.missions.evaluate(raw);
      if (progress.finished) {
        const finishedId = progress.finishedMission?.id ?? 0;
        this.bus.emit(Events.TerminalPrint, {
          text: `\n=================================================`,
          color: 'var(--ui-blue)',
        });
        this.bus.emit(Events.TerminalPrint, {
          text: `¡MISIÓN ${finishedId} COMPLETADA CON ÉXITO!`,
          color: 'var(--matrix-green)',
        });
        this.bus.emit(Events.TerminalPrint, {
          text: `=================================================\n`,
          color: 'var(--ui-blue)',
        });
        if (progress.newFocused) {
          this.bus.emit(Events.TerminalPrint, {
            text: `>> Foco transferido a la misión D${progress.newFocused.id}: ${progress.newFocused.title}.\n`,
            color: 'var(--ui-blue)',
          });
        }
        const ranked = this.users.recomputeRank(this.missions.getCompletedCount());
        if (ranked.changed) {
          this.bus.emit(Events.TerminalPrint, {
            text: `\n¡ASCENSO CONCEDIDO! Nuevo Rango: ${ranked.newRank}\n${ranked.message}\n`,
            color: 'var(--matrix-green)',
          });
        }
      } else if (progress.newlyCompleted.length > 0) {
        for (const idx of progress.newlyCompleted) {
          this.bus.emit(Events.TerminalPrint, {
            text: `\n>>> OBJETIVO ${idx + 1} COMPLETADO <<<`,
            color: 'var(--matrix-green)',
          });
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      this.bus.emit(Events.TerminalPrint, {
        text: `\n[FALLO DEL SISTEMA]: Error interno al ejecutar.`,
        color: 'var(--warning)',
      });
      this.bus.emit(Events.ToastShow, {
        kind: 'error',
        message: 'Fallo del sistema: error interno al ejecutar el comando.',
      });
    } finally {
      this.bus.emit(Events.TaskStatusChanged, 'ESPERANDO INSTRUCCIONES...');
    }
  }
}
