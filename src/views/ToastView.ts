/**
 * ToastView — notificaciones globales bottom-center con auto-cierre y
 * "hover-to-keep". Cualquier capa puede emitir `Events.ToastShow` y la vista
 * se encarga del render + ciclo de vida del toast.
 *
 * SOLID — Single Responsibility: sólo muestra notificaciones; no decide qué
 *         es un error. Los emisores eligen el `kind`.
 *
 * Toasts con `id` pueden cerrarse remotamente vía `Events.ToastDismiss`.
 * Toasts con `actions` no auto-cierran hasta que el usuario decide (o por
 * timeout defensivo de 15s para evitar huérfanos).
 */
import { BaseView } from './BaseView';
import { Events } from '../services/EventBus';

const AUTO_DISMISS_MS = 3000;
const ACTION_DISMISS_MS = 15_000;

export interface ToastAction {
  label: string;
  kind?: 'primary' | 'danger';
  onClick: () => void;
}

interface ToastPayload {
  kind: 'info' | 'warn' | 'error';
  message: string;
  /** Si se provee, permite cerrar el toast con `Events.ToastDismiss`. */
  id?: string;
  /** Botones inline. Si hay acciones, el auto-dismiss se extiende. */
  actions?: ToastAction[];
}

export class ToastView extends BaseView {
  private container!: HTMLElement;
  private byId = new Map<string, HTMLElement>();

  init(): void {
    let c = this.el<HTMLElement>('toast-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'toast-container';
      c.className = 'toast-container';
      document.body.appendChild(c);
    }
    this.container = c;

    this.bus.on<ToastPayload>(Events.ToastShow, (p) => this.show(p));
    this.bus.on<string>(Events.ToastDismiss, (id) => this.dismissById(id));
  }

  private show(p: ToastPayload): void {
    if (!p || !p.message) return;
    // Si ya hay un toast con el mismo id, reemplazarlo.
    if (p.id) {
      const prev = this.byId.get(p.id);
      if (prev) this.dismiss(prev);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${p.kind}`;
    toast.setAttribute('role', p.kind === 'error' ? 'alert' : 'status');

    const text = document.createElement('span');
    text.className = 'toast-text';
    text.textContent = p.message;
    toast.appendChild(text);

    let timerId: number | null = null;
    const dismissDelay = p.actions && p.actions.length > 0 ? ACTION_DISMISS_MS : AUTO_DISMISS_MS;
    const arm = (): void => {
      if (timerId !== null) window.clearTimeout(timerId);
      timerId = window.setTimeout(() => this.dismiss(toast), dismissDelay);
    };
    const cancel = (): void => {
      if (timerId !== null) {
        window.clearTimeout(timerId);
        timerId = null;
      }
    };

    if (p.actions && p.actions.length > 0) {
      const actions = document.createElement('div');
      actions.className = 'toast-actions';
      for (const a of p.actions) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `toast-action toast-action-${a.kind ?? 'primary'}`;
        btn.textContent = a.label;
        btn.addEventListener('click', () => {
          try { a.onClick(); } catch (e) { console.error('[Toast] action error:', e); }
          this.dismiss(toast);
        });
        actions.appendChild(btn);
      }
      toast.appendChild(actions);
    }

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast-close';
    close.setAttribute('aria-label', 'Cerrar');
    close.textContent = '×';
    close.addEventListener('click', () => this.dismiss(toast));
    toast.appendChild(close);

    toast.addEventListener('mouseenter', cancel);
    toast.addEventListener('mouseleave', arm);

    if (p.id) {
      toast.dataset['toastId'] = p.id;
      this.byId.set(p.id, toast);
    }

    this.container.appendChild(toast);
    // Forzar reflow para que la transición de entrada se aplique.
    void toast.offsetWidth;
    toast.classList.add('toast-in');
    arm();
  }

  private dismissById(id: string): void {
    const t = this.byId.get(id);
    if (t) this.dismiss(t);
  }

  private dismiss(toast: HTMLElement): void {
    if (!toast.parentNode) return;
    const id = toast.dataset['toastId'];
    if (id && this.byId.get(id) === toast) this.byId.delete(id);
    toast.classList.add('toast-out');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    // Fallback por si la transición no dispara (display:none, prefers-reduced-motion).
    window.setTimeout(() => toast.remove(), 400);
  }
}
