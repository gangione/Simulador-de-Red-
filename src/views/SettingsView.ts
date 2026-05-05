/**
 * SettingsView — panel flotante de Ajustes.
 *
 * SOLID — Liskov: extiende `BaseView` y se inicializa exactamente igual que
 *         las demás vistas; el `main.ts` la enchufa con `init()`.
 * SOLID — Single Responsibility: sólo renderiza/maneja DOM. La lógica de
 *         audio vive en `AudioService` (inyectada).
 *
 * Activación: botón ⚙ en el header del dashboard. Cierra con ESC o click
 * fuera del panel.
 */
import { BaseView } from './BaseView';
import type { IEventBus } from '../services/EventBus';
import type { AudioService } from '../services/AudioService';

export class SettingsView extends BaseView {
  constructor(bus: IEventBus, private readonly audio: AudioService) {
    super(bus);
  }

  init(): void {
    const trigger = this.el<HTMLButtonElement>('btn-settings');
    const overlay = this.el<HTMLElement>('settings-overlay');
    const panel   = this.el<HTMLElement>('settings-panel');
    const close   = this.el<HTMLButtonElement>('btn-settings-close');
    const slider  = this.el<HTMLInputElement>('settings-volume');
    const volLbl  = this.el<HTMLSpanElement>('settings-volume-label');
    const mute    = this.el<HTMLInputElement>('settings-mute');
    const select  = this.el<HTMLSelectElement>('settings-track');
    const playBtn = this.el<HTMLButtonElement>('settings-play');

    if (!trigger || !overlay || !panel) return;

    // Poblar selector de pistas a partir del catálogo.
    if (select) {
      select.innerHTML = '';
      for (const t of this.audio.getTracks()) {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.label;
        if (t.id === this.audio.getCurrentTrackId()) opt.selected = true;
        select.appendChild(opt);
      }
      select.addEventListener('change', () => {
        this.audio.selectTrack(select.value);
      });
    }

    // Sincronizar valores iniciales.
    if (slider) {
      slider.value = String(Math.round(this.audio.getVolume() * 100));
      this.updateVolLabel(volLbl, slider.value);
      slider.addEventListener('input', () => {
        this.audio.setVolume(parseInt(slider.value, 10) / 100);
        this.updateVolLabel(volLbl, slider.value);
      });
    }
    if (mute) {
      mute.checked = this.audio.isMuted();
      mute.addEventListener('change', () => this.audio.setMuted(mute.checked));
    }
    if (playBtn) {
      this.refreshPlayBtn(playBtn);
      playBtn.addEventListener('click', () => {
        this.audio.toggle();
        // El estado real puede tardar un tick por la promesa de play().
        setTimeout(() => this.refreshPlayBtn(playBtn), 50);
      });
    }

    // Apertura / cierre.
    const open = () => {
      overlay.classList.remove('hidden');
      this.refreshPlayBtn(playBtn);
    };
    const closeFn = () => overlay.classList.add('hidden');

    trigger.addEventListener('click', open);
    close?.addEventListener('click', closeFn);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeFn();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeFn();
    });
  }

  private updateVolLabel(label: HTMLSpanElement | null, raw: string): void {
    if (label) label.textContent = `${raw}%`;
  }

  private refreshPlayBtn(btn: HTMLButtonElement | null): void {
    if (!btn) return;
    btn.textContent = this.audio.isPlaying() ? '⏸ PAUSAR' : '▶ REPRODUCIR';
  }
}
