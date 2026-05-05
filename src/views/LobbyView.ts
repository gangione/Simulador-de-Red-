/**
 * LobbyView — pantalla full-screen para Multijugador LAN.
 *
 * SOLID — Liskov: extiende `BaseView` y se inicializa como cualquier vista.
 * SOLID — Single Responsibility: sólo render + eventos del DOM. El transporte
 *         WS vive en `LobbyService`.
 *
 * Tres pantallas dentro del mismo overlay:
 *   - inicio  : alias + crear / unirse (con historial de códigos)
 *   - sala    : código grande, lista de jugadores, configuración (host) o
 *               selector de equipo + ready (cliente)
 *   - partida : HUD mínimo (timer + scores) — el dashboard hace lo grueso.
 */
import { BaseView } from './BaseView';
import type { IEventBus } from '../services/EventBus';
import { Events } from '../services/EventBus';
import type { LobbyService, RoomSnapshot, RoomOpts } from '../services/LobbyService';
import type { UserModel } from '../models/UserModel';
import { MODE_INFO, type ModeId } from '../data/modes.data';
import type { ConfirmService } from '../services/ConfirmService';

const MODE_LABELS: Record<string, string> = {
  'red-vs-blue': 'Red vs Blue',
  'capture':     'Capture the Server',
  'coop':        'Co-op Defensa',
  'ffa':         'Free-for-All',
};

export class LobbyView extends BaseView {
  private overlay!: HTMLElement;
  private screenInicio!: HTMLElement;
  private screenSala!: HTMLElement;
  private chatLog: Array<ChatEntry> = [];
  private currentRoomCode: string | null = null;
  private lastPhase: 'lobby' | 'match' | 'ended' | null = null;
  private myTeam: string = 'auto';

  constructor(
    bus: IEventBus,
    private readonly lobby: LobbyService,
    private readonly users: UserModel,
    private readonly confirm: ConfirmService,
  ) { super(bus); }

  init(): void {
    const overlay = this.el<HTMLElement>('lobby-overlay');
    const screenInicio = this.el<HTMLElement>('lobby-screen-inicio');
    const screenSala = this.el<HTMLElement>('lobby-screen-sala');
    if (!overlay || !screenInicio || !screenSala) return;
    this.overlay = overlay;
    this.screenInicio = screenInicio;
    this.screenSala = screenSala;

    // Trigger desde dashboard.
    this.el<HTMLButtonElement>('btn-multiplayer')?.addEventListener('click', () => this.open());
    this.el<HTMLButtonElement>('btn-lobby-close')?.addEventListener('click', () => this.close());

    // Alias inicial.
    const aliasInput = this.el<HTMLInputElement>('lobby-alias');
    if (aliasInput) aliasInput.value = this.lobby.getLastAlias() || '';

    // Botones de pantalla inicio.
    this.el<HTMLButtonElement>('btn-lobby-host')?.addEventListener('click', () => this.handleHost());
    this.el<HTMLButtonElement>('btn-lobby-join')?.addEventListener('click', () => this.handleJoin());

    // Pintar historial / códigos recientes.
    this.refreshHistory();

    // Botones de sala.
    this.el<HTMLButtonElement>('btn-lobby-leave')?.addEventListener('click', () => this.handleLeave());
    this.el<HTMLButtonElement>('btn-lobby-copy')?.addEventListener('click', () => this.copyCode());
    this.el<HTMLButtonElement>('btn-lobby-start')?.addEventListener('click', () => this.lobby.startMatch());
    this.el<HTMLButtonElement>('btn-lobby-ready')?.addEventListener('click', () => this.toggleReady());
    this.el<HTMLSelectElement>('lobby-team')?.addEventListener('change', (e) => {
      this.lobby.setTeam((e.target as HTMLSelectElement).value as 'red' | 'blue' | 'auto');
    });
    this.el<HTMLButtonElement>('btn-lobby-chat-send')?.addEventListener('click', () => this.sendChat());
    this.el<HTMLInputElement>('lobby-chat-input')?.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') this.sendChat();
    });

    // Listeners de configuración (sólo host).
    ['lobby-cfg-mode', 'lobby-cfg-team-size', 'lobby-cfg-server-count', 'lobby-cfg-duration',
     'lobby-cfg-rule-firstn', 'lobby-cfg-rule-objectives']
      .forEach((id) => this.el(id)?.addEventListener('change', () => this.pushConfig()));

    // El select de modo además actualiza el tutorial visible localmente.
    this.el<HTMLSelectElement>('lobby-cfg-mode')?.addEventListener('change', (e) => {
      this.renderModeTutorial((e.target as HTMLSelectElement).value as ModeId);
    });

    // Toggle colapso del tutorial — estado persistido en sessionStorage.
    this.setupTutorialToggle();

    // Suscripciones.
    this.bus.on<RoomSnapshot>(Events.LobbyState, (room) => this.renderRoom(room));
    this.bus.on<ChatEntry>(Events.LobbyChat, (m) => this.appendChat(m));
    this.bus.on<string>(Events.LobbyError, (msg) => this.toast(msg, 'error'));
    this.bus.on<{ status: string }>(Events.LobbyConnection, ({ status }) => {
      if (status === 'disconnected') {
        this.toast('Desconectado del servidor', 'warn');
        this.clearChat();
        this.currentRoomCode = null;
        this.lastPhase = null;
        this.myTeam = 'auto';
      }
    });
    this.bus.on<{ value: number }>(Events.LobbyMatchCountdown, (p) => this.renderCountdown(p.value));
    this.bus.on<{ winner: string; scores: unknown; summary?: string }>(Events.LobbyMatchEnded, (r) => {
      this.toast(`Fin de partida — Ganador: ${r.winner}. ${r.summary ?? ''}`, 'info');
      this.recordMatchResult(r);
    });
    this.bus.on<{ requestId: string; alias: string; team: string }>(
      Events.LobbyJoinRequest,
      (req) => this.showJoinRequestToast(req),
    );
    this.bus.on<{ requestId: string; by: string; accepted: boolean }>(
      Events.LobbyJoinResolved,
      (r) => {
        // Cerrar el toast con acciones en TODOS los miembros del team.
        this.bus.emit(Events.ToastDismiss, `join-req:${r.requestId}`);
        // Mostrar feedback breve a quienes no decidieron.
        const verdict = r.accepted ? 'aceptada' : 'rechazada';
        this.toast(`Solicitud ${verdict} por ${r.by}`, 'info');
      },
    );
    this.bus.on<{ message: string; team: string }>(
      Events.LobbyJoinPending,
      (p) => this.toast(p.message || `Esperando aprobación del equipo ${p.team}…`, 'info'),
    );
    this.bus.on<string>(Events.LobbyRejoinInfo, (m) => this.toast(m, 'info'));
    this.bus.on<{ mode: string; code: string }>(Events.LobbyTeamRequired, (p) => this.showChooseTeamModal(p));
  }

  open(): void {
    this.overlay.classList.remove('hidden');
    this.refreshHistory();
  }
  close(): void {
    this.overlay.classList.add('hidden');
  }

  private async handleHost(): Promise<void> {
    const alias = this.getAlias();
    if (!alias) return this.toast('Ingresá un alias', 'warn');
    const opts = this.collectConfig();
    try {
      // Si estamos en Electron, levanta el servidor local automáticamente.
      let url = 'ws://127.0.0.1:7331';
      if (window.lobbyAPI) {
        const info = await this.lobby.startLocalServer(7331);
        if (info) {
          this.toast(`Servidor levantado en :${info.port}. IPs LAN: ${info.lanIps.map(i => i.address).join(', ') || 'sólo local'}`, 'info');
          url = `ws://127.0.0.1:${info.port}`;
        }
      }
      await this.lobby.host(url, alias, opts);
    } catch (err) {
      this.toast(`No pude crear la partida: ${(err as Error).message}`, 'error');
    }
  }

  private async handleJoin(): Promise<void> {
    const alias = this.getAlias();
    const codeIn = this.el<HTMLInputElement>('lobby-code')?.value.trim().toLowerCase() ?? '';
    const hostInput = this.el<HTMLInputElement>('lobby-host')?.value.trim() ?? '';
    if (!alias) return this.toast('Ingresá un alias', 'warn');
    if (!codeIn) return this.toast('Ingresá el código de partida', 'warn');
    const host = hostInput || '127.0.0.1';
    const url = `ws://${host}:7331`;
    try {
      // Si la sala está en curso, el server responderá con `team-required` y el
      // cliente abrirá el modal de selección de equipo. No es necesario que el
      // usuario decida el team antes de pulsar UNIRSE.
      await this.lobby.join(url, codeIn, alias);
    } catch (err) {
      this.toast(`No pude unirme: ${(err as Error).message}`, 'error');
    }
  }

  private async handleLeave(): Promise<void> {
    const room = this.lobby.getRoom();
    if (room && room.phase === 'match') {
      const ok = await this.confirm.ask(
        'La partida está en curso. Si te retíras se notificará a tu equipo y perderás tu progreso. ¿Seguro que querés salir?',
        { acceptLabel: 'RETIRARME', cancelLabel: 'VOLVER A LA PARTIDA', title: 'ABANDONAR PARTIDA' },
      );
      if (!ok) return;
    }
    this.lobby.leave();
    this.clearChat();
    this.currentRoomCode = null;
    this.lastPhase = null;
    this.myTeam = 'auto';
    this.showInicio();
  }

  private toggleReady(): void {
    const room = this.lobby.getRoom();
    if (!room) return;
    const me = room.players.find((p) => p.alias === this.lobby.getAlias());
    this.lobby.setReady(!me?.ready);
  }

  private sendChat(): void {
    const input = this.el<HTMLInputElement>('lobby-chat-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    this.lobby.chat(text);
    input.value = '';
  }

  private appendChat(m: ChatEntry): void {
    this.chatLog.push(m);
    if (this.chatLog.length > 50) this.chatLog.shift();
    const log = this.el<HTMLDivElement>('lobby-chat-log');
    if (!log) return;
    log.innerHTML = this.chatLog.map((c) => {
      const tag = c.scope === 'team' && c.team
        ? `<span class="chat-scope-label team-${c.team}">${escapeHtml(c.team.toUpperCase())}</span> `
        : '';
      return `<div>${tag}<span class="chat-from">${escapeHtml(c.from)}:</span> ${escapeHtml(c.text)}</div>`;
    }).join('');
    log.scrollTop = log.scrollHeight;
  }

  private updateChatScopeLabel(phase: 'lobby' | 'match' | 'ended', myTeam: string): void {
    const label = this.el<HTMLSpanElement>('lobby-chat-scope');
    if (!label) return;
    label.classList.remove('team-red', 'team-blue');
    if (phase === 'match' && (myTeam === 'red' || myTeam === 'blue')) {
      label.textContent = `EQUIPO ${myTeam.toUpperCase()}`;
      label.classList.add(`team-${myTeam}`);
    } else if (phase === 'match') {
      label.textContent = 'EQUIPO';
    } else {
      label.textContent = 'GENERAL';
    }
  }

  private renderRoom(room: RoomSnapshot): void {
    // Cambio de sala (o entrada inicial) → chat efímero.
    if (this.currentRoomCode !== null && this.currentRoomCode !== room.code) {
      this.clearChat();
    }
    // Transición de fase: el chat general muere al iniciar la partida y el de
    // equipo nace nuevo. Al volver al lobby (revancha) también se limpia.
    if (this.lastPhase !== null && this.lastPhase !== room.phase) {
      this.clearChat();
    }
    this.currentRoomCode = room.code;
    this.lastPhase = room.phase;

    this.showSala();
    const meEntry = room.players.find((p) => p.alias === this.lobby.getAlias());
    const isHost = !!meEntry?.isHost;
    this.myTeam = meEntry?.team ?? 'auto';
    this.updateChatScopeLabel(room.phase, this.myTeam);

    const codeEl = this.el<HTMLDivElement>('lobby-room-code');
    if (codeEl) codeEl.textContent = room.code;

    const phaseEl = this.el<HTMLSpanElement>('lobby-room-phase');
    if (phaseEl) phaseEl.textContent = room.phase.toUpperCase();

    const list = this.el<HTMLUListElement>('lobby-players');
    if (list) {
      const connected = room.players.map((p) => {
        const teamColor = p.team === 'red' ? 'var(--warning)' : p.team === 'blue' ? 'var(--ui-blue)' : 'var(--cmd-gray)';
        const readyIcon = p.ready ? '✓' : '○';
        return `<li><span style="color:${teamColor}">●</span> ${escapeHtml(p.alias)} ${p.isHost ? '(host)' : ''} <span class="ready-icon">${readyIcon}</span> <span class="team-tag">${p.team}</span></li>`;
      });
      const disconnected = (room.disconnected ?? []).map((d) => {
        const teamColor = d.team === 'red' ? 'var(--warning)' : d.team === 'blue' ? 'var(--ui-blue)' : 'var(--cmd-gray)';
        return `<li class="disconnected"><span style="color:${teamColor}">○</span> ${escapeHtml(d.alias)} (desconectado) <span class="team-tag">${d.team}</span></li>`;
      });
      list.innerHTML = [...connected, ...disconnected].join('');
    }

    // Mostrar / ocultar configuración según rol.
    const cfgPanel = this.el<HTMLDivElement>('lobby-host-config');
    if (cfgPanel) cfgPanel.style.display = isHost && room.phase === 'lobby' ? 'block' : 'none';
    const startBtn = this.el<HTMLButtonElement>('btn-lobby-start');
    if (startBtn) startBtn.style.display = isHost && room.phase === 'lobby' ? 'inline-block' : 'none';
    const readyBtn = this.el<HTMLButtonElement>('btn-lobby-ready');
    if (readyBtn) readyBtn.style.display = !isHost && room.phase === 'lobby' ? 'inline-block' : 'none';

    // Sincronizar valores de config con el snapshot recibido.
    if (isHost && room.phase === 'lobby') this.syncConfigInputs(room.opts);

    // Tutorial del modo: visible para todos durante la fase lobby.
    const tutorialWrap = document.getElementById('lobby-tutorial-wrap');
    if (room.phase === 'lobby') {
      this.renderModeTutorial(room.opts.mode as ModeId);
      tutorialWrap?.classList.remove('force-collapsed');
    } else {
      this.renderModeTutorial(null);
      tutorialWrap?.classList.add('force-collapsed');
    }

    // HUD de partida.
    const matchHud = this.el<HTMLDivElement>('lobby-match-hud');
    if (matchHud) matchHud.style.display = room.phase === 'match' ? 'block' : 'none';
  }

  private collectConfig(): RoomOpts {
    const mode = (this.el<HTMLSelectElement>('lobby-cfg-mode')?.value ?? 'red-vs-blue') as RoomOpts['mode'];
    return {
      mode,
      teamSize: parseInt(this.el<HTMLInputElement>('lobby-cfg-team-size')?.value ?? '2', 10),
      serverCount: parseInt(this.el<HTMLInputElement>('lobby-cfg-server-count')?.value ?? '3', 10),
      durationSec: parseInt(this.el<HTMLSelectElement>('lobby-cfg-duration')?.value ?? '600', 10),
      rules: {
        time: true,
        firstToN: !!this.el<HTMLInputElement>('lobby-cfg-rule-firstn')?.checked,
        objectives: !!this.el<HTMLInputElement>('lobby-cfg-rule-objectives')?.checked,
        firstToNTarget: 3,
      },
    };
  }

  private syncConfigInputs(opts: RoomSnapshot['opts']): void {
    const set = (id: string, v: string | number | boolean) => {
      const el = this.el<HTMLInputElement | HTMLSelectElement>(id);
      if (!el) return;
      if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = !!v;
      else el.value = String(v);
    };
    set('lobby-cfg-mode', opts.mode);
    set('lobby-cfg-team-size', opts.teamSize);
    set('lobby-cfg-server-count', opts.serverCount);
    set('lobby-cfg-duration', opts.durationSec);
    set('lobby-cfg-rule-firstn', !!opts.rules?.firstToN);
    set('lobby-cfg-rule-objectives', !!opts.rules?.objectives);
  }

  private pushConfig(): void {
    const room = this.lobby.getRoom();
    if (!room) return;
    const me = room.players.find((p) => p.alias === this.lobby.getAlias());
    if (!me?.isHost) return;
    this.lobby.config(this.collectConfig());
  }

  private copyCode(): void {
    const room = this.lobby.getRoom();
    if (!room) return;
    void navigator.clipboard.writeText(room.code).then(
      () => this.toast(`Código copiado: ${room.code}`, 'info'),
      () => this.toast('No pude copiar el código', 'warn'),
    );
  }

  private getAlias(): string {
    return this.el<HTMLInputElement>('lobby-alias')?.value.trim() ?? '';
  }

  private showInicio(): void {
    this.screenInicio.style.display = 'block';
    this.screenSala.style.display = 'none';
  }
  private showSala(): void {
    this.screenInicio.style.display = 'none';
    this.screenSala.style.display = 'block';
  }

  private toast(message: string, kind: 'info' | 'warn' | 'error'): void {
    // 1) Notificación visual global (pop-up bottom-center).
    this.bus.emit(Events.ToastShow, { kind, message });
    // 2) Eco a la terminal para mantener histórico.
    this.bus.emit(Events.TerminalPrint, {
      text: `[LOBBY ${kind.toUpperCase()}] ${message}`,
      color: kind === 'error' ? 'var(--warning)' : kind === 'warn' ? '#ffaa00' : 'var(--ui-blue)',
    });
  }

  private clearChat(): void {
    this.chatLog = [];
    const log = this.el<HTMLDivElement>('lobby-chat-log');
    if (log) log.innerHTML = '';
  }

  private renderModeTutorial(mode: ModeId | null): void {
    const box = this.el<HTMLDivElement>('lobby-mode-tutorial');
    if (!box) return;
    if (!mode || !MODE_INFO[mode]) { box.innerHTML = ''; return; }
    const info = MODE_INFO[mode];
    box.innerHTML = `
      <h4>▸ ${escapeHtml(info.title)}</h4>
      <p>${escapeHtml(info.summary)}</p>
      <p><span class="mode-section-label">Cómo se gana</span> ${escapeHtml(info.howToWin)}</p>
      <p><span class="mode-section-label">Tips</span></p>
      <ul>${info.tips.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
    `;
  }

  private renderCountdown(value: number): void {
    const box = this.el<HTMLDivElement>('lobby-countdown');
    if (!box) return;
    // Asegurar overlay visible para que el conteo se vea sobre el lobby.
    this.overlay.classList.remove('hidden');
    box.classList.remove('hidden');
    if (value > 0) {
      box.classList.remove('go');
      box.innerHTML = `<span class="pulse">${value}</span>`;
      this.bus.emit(Events.TerminalPrint, {
        text: `>>> ${value} <<<`,
        color: 'var(--matrix-green)',
      });
    } else {
      box.classList.add('go');
      box.innerHTML = `<span class="pulse">¡YA!</span>`;
      this.bus.emit(Events.TerminalPrint, {
        text: `¡COMIENZA LA PARTIDA!`,
        color: 'var(--ui-blue)',
      });
      this.bus.emit(Events.ToastShow, { kind: 'info', message: '¡Comienza la partida!' });
      // Mostrar "¡YA!" un instante y luego cerrar el overlay para mostrar la consola.
      window.setTimeout(() => {
        box.classList.add('hidden');
        box.innerHTML = '';
        this.close();
      }, 700);
    }
  }

  private refreshHistory(): void {
    const list = this.el<HTMLDivElement>('lobby-recent');
    if (!list) return;
    const codes = this.lobby.getRecentCodes();
    if (codes.length === 0) {
      list.innerHTML = '<span class="cmd-gray">Sin códigos recientes.</span>';
      return;
    }
    list.innerHTML = codes.map((c) =>
      `<button type="button" class="lobby-recent-btn" data-code="${escapeHtml(c)}">${escapeHtml(c)}</button>`
    ).join('');
    list.querySelectorAll<HTMLButtonElement>('.lobby-recent-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = this.el<HTMLInputElement>('lobby-code');
        if (input) input.value = btn.dataset.code ?? '';
      });
    });

    // Render historial de partidas terminadas.
    const histEl = this.el<HTMLUListElement>('lobby-history');
    if (histEl) {
      const hist = this.users.getMatches();
      histEl.innerHTML = hist.length === 0
        ? '<li class="cmd-gray">Sin partidas registradas.</li>'
        : hist.slice(0, 10).map((m) => {
          const date = new Date(m.ts).toLocaleString();
          const color = m.result === 'win' ? 'var(--matrix-green)' : m.result === 'lose' ? 'var(--warning)' : 'var(--cmd-gray)';
          return `<li><span style="color:${color}">${m.result.toUpperCase()}</span> · ${escapeHtml(MODE_LABELS[m.mode] ?? m.mode)} · ${escapeHtml(m.code)} · score ${m.score} <span class="cmd-gray">(${date})</span></li>`;
        }).join('');
    }
  }

  private recordMatchResult(r: { winner: string; scores: unknown; summary?: string }): void {
    const room = this.lobby.getRoom();
    if (!room) return;
    const me = room.players.find((p) => p.alias === this.lobby.getAlias());
    if (!me) return;
    const result: 'win' | 'lose' | 'draw' = r.winner === me.team ? 'win'
      : r.winner === 'draw' ? 'draw' : 'lose';
    const scoreObj = (r.scores ?? {}) as Record<string, number>;
    const score = typeof scoreObj[me.team] === 'number' ? scoreObj[me.team] : 0;
    this.users.pushMatch({
      code: room.code,
      mode: room.opts.mode,
      role: me.team,
      result,
      score,
    });
    this.refreshHistory();
  }

  /**
   * Notifica al miembro del team destino mediante un toast no bloqueante con
   * botones inline. Cuando alguno de los miembros decide, el server emite
   * `join-resolved` y el listener correspondiente cierra el toast en TODOS
   * los clientes vía `Events.ToastDismiss`.
   */
  private showJoinRequestToast(req: { requestId: string; alias: string; team: string }): void {
    const teamLabel = req.team.toUpperCase();
    this.bus.emit(Events.ToastShow, {
      id: `join-req:${req.requestId}`,
      kind: 'info',
      message: `${req.alias} quiere unirse al equipo ${teamLabel}.`,
      actions: [
        {
          label: 'ACEPTAR',
          kind: 'primary',
          onClick: () => this.lobby.approveJoin(req.requestId, true),
        },
        {
          label: 'RECHAZAR',
          kind: 'danger',
          onClick: () => this.lobby.approveJoin(req.requestId, false),
        },
      ],
    });
  }

  /**
   * Modal disparado cuando el server responde `team-required` (el cliente
   * pidió unirse a una sala con partida en curso). Tras elegir, se manda un
   * segundo `join` reusando la conexión WS abierta.
   */
  private showChooseTeamModal(_req: { mode: string; code: string }): void {
    const modal = document.getElementById('choose-team-modal');
    const red = document.getElementById('choose-team-red') as HTMLButtonElement | null;
    const blue = document.getElementById('choose-team-blue') as HTMLButtonElement | null;
    const cancel = document.getElementById('choose-team-cancel') as HTMLButtonElement | null;
    if (!modal || !red || !blue || !cancel) return;
    modal.classList.remove('hidden');
    const cleanup = (): void => {
      modal.classList.add('hidden');
      red.removeEventListener('click', onRed);
      blue.removeEventListener('click', onBlue);
      cancel.removeEventListener('click', onCancel);
    };
    const onRed = (): void => { cleanup(); this.lobby.chooseTeam('red'); this.toast('Solicitud enviada al RED TEAM…', 'info'); };
    const onBlue = (): void => { cleanup(); this.lobby.chooseTeam('blue'); this.toast('Solicitud enviada al BLUE TEAM…', 'info'); };
    const onCancel = (): void => { cleanup(); this.lobby.leave(); };
    red.addEventListener('click', onRed);
    blue.addEventListener('click', onBlue);
    cancel.addEventListener('click', onCancel);
  }

  /**
   * Cabecera "Cómo se juega" que colapsa/expande el tutorial del modo. El
   * estado se persiste en sessionStorage para sobrevivir entre aperturas del
   * lobby dentro de la misma sesión.
   */
  private setupTutorialToggle(): void {
    const wrap = document.getElementById('lobby-tutorial-wrap');
    const toggle = document.getElementById('lobby-tutorial-toggle') as HTMLButtonElement | null;
    if (!wrap || !toggle) return;
    const KEY = 'lobby:tutorial-collapsed';
    const initial = (() => { try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; } })();
    if (initial) wrap.classList.add('collapsed');
    toggle.setAttribute('aria-expanded', String(!initial));
    toggle.addEventListener('click', () => {
      const collapsed = wrap.classList.toggle('collapsed');
      toggle.setAttribute('aria-expanded', String(!collapsed));
      try { sessionStorage.setItem(KEY, collapsed ? '1' : '0'); } catch { /* ignore */ }
    });
  }
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!));
}

interface ChatEntry {
  from: string;
  text: string;
  scope?: 'team' | 'global';
  team?: string | null;
}
