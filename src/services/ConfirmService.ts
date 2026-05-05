/**
 * ConfirmService — pequeño helper que muestra un modal de confirmación y
 * resuelve a `true`/`false`. Reusa el contenedor `#confirm-modal` definido en
 * `index.html`.
 */
export class ConfirmService {
  constructor(private readonly modalId: string = 'confirm-modal') {}

  ask(message: string, opts: { acceptLabel?: string; cancelLabel?: string; title?: string } = {}): Promise<boolean> {
    return new Promise((resolve) => {
      const modal = document.getElementById(this.modalId);
      const titleEl = document.getElementById('confirm-title');
      const msgEl = document.getElementById('confirm-message');
      const accept = document.getElementById('confirm-accept') as HTMLButtonElement | null;
      const cancel = document.getElementById('confirm-cancel') as HTMLButtonElement | null;
      if (!modal || !msgEl || !accept || !cancel) {
        // Fallback prudente: si el modal no existe, asume cancelado.
        resolve(false);
        return;
      }
      if (titleEl && opts.title) titleEl.textContent = opts.title;
      msgEl.textContent = message;
      accept.textContent = opts.acceptLabel ?? 'CONFIRMAR';
      cancel.textContent = opts.cancelLabel ?? 'CANCELAR';
      modal.classList.remove('hidden');

      const cleanup = (result: boolean): void => {
        modal.classList.add('hidden');
        accept.removeEventListener('click', onAccept);
        cancel.removeEventListener('click', onCancel);
        resolve(result);
      };
      const onAccept = (): void => cleanup(true);
      const onCancel = (): void => cleanup(false);
      accept.addEventListener('click', onAccept);
      cancel.addEventListener('click', onCancel);
    });
  }
}
