/**
 * Atajos de terminal para multijugador. Equivalentes a los botones del lobby.
 */
import type { ICommand, ICommandContext, ICommandResult } from '../../types';
import type { LobbyService, RoomOpts } from '../../services/LobbyService';

export class LobbyOpenCommand implements ICommand {
  readonly name = 'lobby';
  execute(): ICommandResult {
    document.getElementById('btn-multiplayer')?.click();
    return { output: [['Abriendo lobby multijugador...', 'var(--ui-blue)']] };
  }
}

export class JoinCommand implements ICommand {
  readonly name = 'unirse';
  readonly aliases = ['join'];
  constructor(private readonly lobby: LobbyService) {}
  async execute(ctx: ICommandContext): Promise<ICommandResult> {
    const code = (ctx.args[1] ?? '').toLowerCase().trim();
    if (!code) return { output: [['Uso: unirse <codigo> [host] [alias]', 'var(--warning)']] };
    const host = ctx.args[2] || '127.0.0.1';
    const alias = ctx.args[3] || this.lobby.getLastAlias() || `player-${Math.floor(Math.random() * 999)}`;
    try {
      await this.lobby.join(`ws://${host}:7331`, code, alias);
      return { output: [[`Conectado a ${code} como "${alias}".`, 'var(--matrix-green)']] };
    } catch (err) {
      return { output: [[`No pude unirme: ${(err as Error).message}`, 'var(--warning)']] };
    }
  }
}

export class HostCommand implements ICommand {
  readonly name = 'hostear';
  readonly aliases = ['host'];
  constructor(private readonly lobby: LobbyService) {}
  async execute(ctx: ICommandContext): Promise<ICommandResult> {
    const alias = ctx.args[1] || this.lobby.getLastAlias() || `host-${Math.floor(Math.random() * 999)}`;
    const opts: RoomOpts = { mode: 'red-vs-blue', teamSize: 2, serverCount: 3, durationSec: 600 };
    try {
      let url = 'ws://127.0.0.1:7331';
      if (window.lobbyAPI) {
        const info = await this.lobby.startLocalServer(7331);
        if (info) url = `ws://127.0.0.1:${info.port}`;
      }
      await this.lobby.host(url, alias, opts);
      return { output: [[`Sala creada. Compartí el código que aparece en el lobby.`, 'var(--matrix-green)']] };
    } catch (err) {
      return { output: [[`No pude crear la sala: ${(err as Error).message}`, 'var(--warning)']] };
    }
  }
}

export class TeamCommand implements ICommand {
  readonly name = 'equipo';
  readonly aliases = ['team'];
  constructor(private readonly lobby: LobbyService) {}
  execute(ctx: ICommandContext): ICommandResult {
    const team = (ctx.args[1] ?? '').toLowerCase();
    if (!['red', 'blue', 'auto'].includes(team)) {
      return { output: [['Uso: equipo <red|blue|auto>', 'var(--warning)']] };
    }
    this.lobby.setTeam(team as 'red' | 'blue' | 'auto');
    return { output: [[`Equipo: ${team}`, 'var(--ui-blue)']] };
  }
}

export class ReadyCommand implements ICommand {
  readonly name = 'listo';
  readonly aliases = ['ready'];
  constructor(private readonly lobby: LobbyService) {}
  execute(): ICommandResult {
    this.lobby.setReady(true);
    return { output: [['Marcado como listo.', 'var(--matrix-green)']] };
  }
}

export class LeaveCommand implements ICommand {
  readonly name = 'leave';
  readonly aliases = ['salir-sala'];
  constructor(private readonly lobby: LobbyService) {}
  execute(): ICommandResult {
    this.lobby.leave();
    return { output: [['Saliste de la sala.', 'var(--cmd-gray)']] };
  }
}
