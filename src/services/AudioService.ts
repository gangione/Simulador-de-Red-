/**
 * AudioService — gestiona la música de fondo del simulador.
 *
 * SOLID — Responsabilidad única: control de reproducción + persistencia de
 *         ajustes; nada de DOM más allá del `<audio>`.
 *
 * Persistencia (vía `IStorageProvider` → `localStorage` con prefijo `sim:`):
 *   - `audio:volume` (0..1)
 *   - `audio:muted`  (boolean)
 *   - `audio:track`  (id de pista)
 *   - `audio:playing` (boolean — autoplay tras recargar)
 */
import type { IStorageProvider } from './StorageService';

export interface IAudioTrack {
  /** Id estable usado en storage / comandos. */
  id: string;
  /** Nombre legible para la UI. */
  label: string;
  /** Ruta relativa al servidor (servida por Vite desde `public/`). */
  src: string;
}

/**
 * Catálogo por defecto. Los archivos viven en `public/audio/`. Si alguno
 * falta, el `<audio>` simplemente no carga y el usuario verá un aviso en
 * consola — la app sigue funcionando.
 */
export const DEFAULT_TRACKS: ReadonlyArray<IAudioTrack> = [
  { id: 'cyberpunk', label: 'Cyberpunk Loop',   src: 'audio/bgm-cyberpunk.mp3' },
  { id: 'ambient',   label: 'Ambient Hacker',   src: 'audio/bgm-ambient.mp3' },
];

export class AudioService {
  private readonly el: HTMLAudioElement;
  private readonly tracks: ReadonlyArray<IAudioTrack>;
  private currentTrackId: string;
  private volume: number;
  private muted: boolean;
  private hasInteracted = false;

  constructor(
    audioEl: HTMLAudioElement,
    private readonly storage: IStorageProvider,
    tracks: ReadonlyArray<IAudioTrack> = DEFAULT_TRACKS,
  ) {
    this.el = audioEl;
    this.tracks = tracks;
    this.volume = clamp01(this.storage.get<number>('audio:volume', 0.4));
    this.muted = this.storage.get<boolean>('audio:muted', false);
    this.currentTrackId = this.storage.get<string>('audio:track', tracks[0]?.id ?? '');

    this.el.loop = true;
    this.el.preload = 'auto';
    this.applyVolume();
    this.loadTrack(this.currentTrackId, /* autoplay */ false);

    // Los navegadores requieren interacción del usuario antes del primer play.
    // Engancha un autoplay diferido al primer click/keydown si veníamos
    // reproduciendo en la sesión anterior.
    if (this.storage.get<boolean>('audio:playing', false)) {
      const tryStart = () => {
        if (this.hasInteracted) return;
        this.hasInteracted = true;
        void this.play();
        window.removeEventListener('pointerdown', tryStart);
        window.removeEventListener('keydown', tryStart);
      };
      window.addEventListener('pointerdown', tryStart, { once: true });
      window.addEventListener('keydown', tryStart, { once: true });
    }
  }

  /** Lista catálogo expuesto a la UI. */
  getTracks(): ReadonlyArray<IAudioTrack> { return this.tracks; }
  getCurrentTrackId(): string { return this.currentTrackId; }
  getVolume(): number { return this.volume; }
  isMuted(): boolean { return this.muted; }
  isPlaying(): boolean { return !this.el.paused && !this.el.ended; }

  setVolume(v: number): void {
    this.volume = clamp01(v);
    this.storage.set('audio:volume', this.volume);
    this.applyVolume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.storage.set('audio:muted', m);
    this.applyVolume();
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** Cambia de pista. Si estaba reproduciendo, sigue. */
  selectTrack(id: string): boolean {
    const was = this.isPlaying();
    if (!this.tracks.find((t) => t.id === id)) return false;
    this.loadTrack(id, was);
    return true;
  }

  /** Avanza a la siguiente pista del catálogo (rotativo). */
  next(): void {
    const idx = this.tracks.findIndex((t) => t.id === this.currentTrackId);
    const nextTrack = this.tracks[(idx + 1) % this.tracks.length];
    if (nextTrack) this.selectTrack(nextTrack.id);
  }

  async play(): Promise<void> {
    try {
      await this.el.play();
      this.storage.set('audio:playing', true);
    } catch (err) {
      // Autoplay bloqueado o archivo faltante — log silencioso.
      // eslint-disable-next-line no-console
      console.warn('[AudioService] play() falló:', err);
    }
  }

  pause(): void {
    this.el.pause();
    this.storage.set('audio:playing', false);
  }

  toggle(): boolean {
    if (this.isPlaying()) { this.pause(); return false; }
    void this.play(); return true;
  }

  // ---------- internos ----------
  private loadTrack(id: string, autoplay: boolean): void {
    const t = this.tracks.find((x) => x.id === id) ?? this.tracks[0];
    if (!t) return;
    this.currentTrackId = t.id;
    this.storage.set('audio:track', t.id);
    if (this.el.getAttribute('data-track') !== t.id) {
      this.el.setAttribute('data-track', t.id);
      this.el.src = t.src;
    }
    if (autoplay) void this.play();
  }

  private applyVolume(): void {
    this.el.muted = this.muted;
    this.el.volume = this.volume;
  }
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}
