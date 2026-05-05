/**
 * MatchHudView — HUD flotante mínimo que se muestra durante una partida.
 *
 * Permite al jugador cerrar el modal de lobby y seguir comandando desde la
 * terminal sin perder de vista el timer, los scores y los últimos eventos.
 *
 * SOLID — Single Responsibility: sólo renderiza el HUD; no modifica estado
 *         del juego. Recibe los datos vía `EventBus`.
 */
import { BaseView } from './BaseView';
import { Events, type IEventBus } from '../services/EventBus';

interface MatchTick { timeLeft: number; scores: Record<string, number>; }
interface MatchEvent { event: string; ip?: string; team?: string; by?: string; [k: string]: unknown; }

export class MatchHudView extends BaseView {
  private container!: HTMLDivElement;
  private timerEl!: HTMLSpanElement;
  private scoresEl!: HTMLDivElement;
  private logEl!: HTMLDivElement;
  private events: string[] = [];

  constructor(bus: IEventBus) { super(bus); }

  init(): void {
    // Crear contenedor inyectado al final del body — no toca el HTML existente.
    const div = document.createElement('div');
    div.id = 'match-hud';
    div.className = 'match-hud hidden';
    div.innerHTML = `
      <header>
        <span class="match-hud-title">⚡ PARTIDA</span>
        <span class="match-hud-timer">--:--</span>
      </header>
      <div class="match-hud-scores"></div>
      <div class="match-hud-log"></div>
    `;
    document.body.appendChild(div);
    this.container = div;
    this.timerEl = div.querySelector('.match-hud-timer') as HTMLSpanElement;
    this.scoresEl = div.querySelector('.match-hud-scores') as HTMLDivElement;
    this.logEl = div.querySelector('.match-hud-log') as HTMLDivElement;

    this.bus.on(Events.LobbyMatchStarted, () => this.show());
    this.bus.on<MatchTick>(Events.LobbyMatchTick, (t) => this.renderTick(t));
    this.bus.on<MatchEvent>(Events.LobbyMatchEvent, (e) => this.appendEvent(e));
    this.bus.on(Events.LobbyMatchEnded, () => this.hide());
    // Ocultar también cuando el jugador abandona explícitamente (ws cierra)
    // o cuando el estado de sala vuelve a lobby/ended tras una revancha.
    this.bus.on<{ status: string }>(Events.LobbyConnection, ({ status }) => {
      if (status === 'disconnected') this.hide();
    });
    this.bus.on<{ phase: string }>(Events.LobbyState, ({ phase }) => {
      if (phase !== 'match') this.hide();
    });
  }

  private show(): void {
    this.events = [];
    this.logEl.innerHTML = '';
    this.container.classList.remove('hidden');
  }
  private hide(): void {
    this.container.classList.add('hidden');
  }

  private renderTick({ timeLeft, scores }: MatchTick): void {
    const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const s = Math.floor(timeLeft % 60).toString().padStart(2, '0');
    this.timerEl.textContent = `${m}:${s}`;
    const entries = Object.entries(scores ?? {});
    this.scoresEl.innerHTML = entries.map(([team, val]) => {
      const color = team === 'red' ? 'var(--warning)'
        : team === 'blue' ? 'var(--ui-blue)' : 'var(--matrix-green)';
      return `<div class="match-hud-score" style="border-color:${color}"><span style="color:${color}">${escapeHtml(team).toUpperCase()}</span> <strong>${val}</strong></div>`;
    }).join('');
  }

  private appendEvent(e: MatchEvent): void {
    let line = '';
    if (e.event === 'captured') line = `🔓 ${e.team ?? '?'} capturó ${e.ip ?? '?'} (${e.by ?? '?'})`;
    else if (e.event === 'wave') line = `🌊 Oleada de ataque sobre ${e.ip ?? '?'}`;
    else line = `· ${e.event}`;
    this.events.push(line);
    if (this.events.length > 6) this.events.shift();
    this.logEl.innerHTML = this.events.map((l) => `<div>${escapeHtml(l)}</div>`).join('');
  }
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!));
}
