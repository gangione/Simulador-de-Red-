import { BaseView } from './BaseView';
import { Events, type IEventBus } from '../services/EventBus';

/**
 * TerminalView — renderiza la salida de la terminal y reenvía la entrada del
 * usuario como eventos del bus.
 *
 * Suscribe a: `TerminalPrint`, `TerminalClear`, `PromptChanged`, `TaskStatusChanged`.
 * Emite:      `CommandSubmitted` con la línea cruda.
 */
export class TerminalView extends BaseView {
  private input!: HTMLInputElement;
  private output!: HTMLElement;
  private terminalContent!: HTMLElement;
  private promptEl!: HTMLElement;
  private taskStatus!: HTMLElement;
  /** HTML inicial del output — se restaura cuando llega `TerminalClear`. */
  private initialOutputHTML = '';
  private isProcessing = false;
  private historyIndex = 0;
  private localHistory: string[] = [];

  constructor(bus: IEventBus) {
    super(bus);
  }

  /** Conecta listeners DOM y suscripciones al bus. */
  init(): void {
    const input = this.el<HTMLInputElement>('terminal-input');
    const output = this.el('terminal-output');
    const content = this.el('terminal-content');
    const prompt = this.el('prompt-text');
    const taskStatus = this.el('task-status');
    if (!input || !output || !content || !prompt || !taskStatus) {
      throw new Error('TerminalView: faltan elementos requeridos en el DOM');
    }
    console.log('TerminalView inicializada');
    this.input = input;
    this.output = output;
    this.terminalContent = content;
    this.promptEl = prompt;
    this.taskStatus = taskStatus;
    // Snapshot del banner de bienvenida para restaurarlo con `cls` / `clear` / `exit`.
    this.initialOutputHTML = this.output.innerHTML;

    this.bus.on<{ text: string; color?: string }>(Events.TerminalPrint, ({ text, color }) =>
      this.printLine(text, color),
    );
    this.bus.on(Events.TerminalClear, () => {
      this.output.innerHTML = this.initialOutputHTML;
      this.terminalContent.scrollTop = this.terminalContent.scrollHeight;
    });
    this.bus.on<string>(Events.PromptChanged, (cwd) => {
      this.promptEl.innerText = `${cwd}>`;
    });
    this.bus.on<string>(Events.TaskStatusChanged, (s) => {
      this.taskStatus.innerText = s;
    });

    this.input.addEventListener('keydown', (e) => this.onKeyDown(e));
  }

  /** Habilita/deshabilita el input mientras se procesa un comando asíncrono. */
  setBusy(busy: boolean): void {
    this.isProcessing = busy;
    this.input.disabled = busy;
    if (!busy) this.input.focus();
  }

  /**
   * Manejador del teclado. Enter envía el comando, ↑/↓ navegan el historial
   * local de la sesión.
   */
  private async onKeyDown(e: KeyboardEvent): Promise<void> {
    if (e.key === 'Enter' && !this.isProcessing) {
      const raw = this.input.value.trim();
      if (raw === '') return;
      this.localHistory.push(raw);
      this.historyIndex = this.localHistory.length;
      this.printLine(`\n${this.promptEl.innerText} ${raw}`, 'white');
      this.input.value = '';
      this.bus.emit(Events.CommandSubmitted, raw);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.input.value = this.localHistory[this.historyIndex] ?? '';
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (this.historyIndex < this.localHistory.length - 1) {
        this.historyIndex++;
        this.input.value = this.localHistory[this.historyIndex] ?? '';
      } else {
        this.historyIndex = this.localHistory.length;
        this.input.value = '';
      }
    }
  }

  /** Imprime una línea coloreada en el `<pre id="terminal-output">`. */
  private printLine(text: string, color = 'var(--cmd-gray)'): void {
    const span = document.createElement('span');
    span.style.color = color;
    span.innerText = text + '\n';
    this.output.appendChild(span);
    this.terminalContent.scrollTop = this.terminalContent.scrollHeight;
  }
}
