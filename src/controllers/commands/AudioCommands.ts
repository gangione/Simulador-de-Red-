/**
 * Comandos de audio expuestos en la terminal:
 *   - `volumen <0-100>`  — fija el volumen.
 *   - `mute`             — alterna mute / unmute.
 *   - `play [pista]`     — reanuda música o cambia de pista.
 *   - `pause`            — detiene la música.
 *
 * SOLID — Open/Closed: agregar estos comandos sólo requiere registrarlos
 *         en `main.ts`; el dispatcher no se toca.
 */
import type { ICommand, ICommandContext, ICommandResult } from '../../types';
import type { AudioService } from '../../services/AudioService';

export class VolumeCommand implements ICommand {
  readonly name = 'volumen';
  readonly aliases = ['volume', 'vol'];
  constructor(private readonly audio: AudioService) {}
  execute(ctx: ICommandContext): ICommandResult {
    const raw = ctx.args[1];
    if (!raw) {
      const v = Math.round(this.audio.getVolume() * 100);
      return { output: [[`Volumen actual: ${v}%   (mute: ${this.audio.isMuted() ? 'ON' : 'OFF'})`, 'var(--ui-blue)']] };
    }
    const n = parseInt(raw, 10);
    if (Number.isNaN(n) || n < 0 || n > 100) {
      return { output: [['Uso: volumen <0-100>', 'var(--warning)']] };
    }
    this.audio.setVolume(n / 100);
    return { output: [[`Volumen ajustado a ${n}%.`, 'var(--matrix-green)']] };
  }
}

export class MuteCommand implements ICommand {
  readonly name = 'mute';
  readonly aliases = ['silencio'];
  constructor(private readonly audio: AudioService) {}
  execute(): ICommandResult {
    const muted = this.audio.toggleMute();
    return {
      output: [[
        muted ? 'Audio silenciado.' : 'Audio reactivado.',
        muted ? 'var(--cmd-gray)' : 'var(--matrix-green)',
      ]],
    };
  }
}

export class PlayCommand implements ICommand {
  readonly name = 'play';
  readonly aliases = ['musica'];
  constructor(private readonly audio: AudioService) {}
  execute(ctx: ICommandContext): ICommandResult {
    const id = ctx.args[1];
    if (id) {
      const ok = this.audio.selectTrack(id);
      if (!ok) {
        const list = this.audio.getTracks().map((t) => t.id).join(', ');
        return { output: [[`Pista desconocida. Disponibles: ${list}`, 'var(--warning)']] };
      }
      void this.audio.play();
      return { output: [[`Reproduciendo: ${id}`, 'var(--matrix-green)']] };
    }
    void this.audio.play();
    return { output: [[`Reproduciendo: ${this.audio.getCurrentTrackId()}`, 'var(--matrix-green)']] };
  }
}

export class PauseCommand implements ICommand {
  readonly name = 'pause';
  readonly aliases = ['pausa'];
  constructor(private readonly audio: AudioService) {}
  execute(): ICommandResult {
    this.audio.pause();
    return { output: [['Música pausada.', 'var(--cmd-gray)']] };
  }
}
