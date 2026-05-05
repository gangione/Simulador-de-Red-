/**
 * Servicio de Agente IA — hook de la Fase 2.
 *
 * SOLID — Abierto/Cerrado + Inversión de dependencias:
 * la aplicación habla con `IAIAgent`. Hoy sólo el `StubAIAgent` está conectado.
 * Mañana se puede reemplazar por un adaptador de Ollama / OpenAI / LLM local
 * sin tocar los controladores ni los comandos.
 *
 * Consumidor planificado: el comando `?teoria <concepto>` que pide al agente
 * una explicación de un concepto Red/Blue Team al vuelo.
 */

/** Contrato mínimo de un agente de IA conectable al simulador. */
export interface IAIAgent {
  /** Indica si el agente está listo para responder. */
  isReady(): boolean;
  /** Pide al agente una explicación didáctica de `concept`. */
  explain(concept: string): Promise<string>;
  /** Prompt libre (Fase 2+). */
  ask(prompt: string): Promise<string>;
}

/**
 * Implementación stub: devuelve mensajes enlatados para que la UI y el
 * dispatcher puedan enchufarse hoy y el backend real se conecte después
 * sin cambiar código cliente.
 */
export class StubAIAgent implements IAIAgent {
  /** El stub nunca está "listo" porque no hay backend real conectado. */
  isReady(): boolean {
    return false;
  }

  /** Devuelve una respuesta enlatada que invita al alumno a usar tutoriales. */
  async explain(concept: string): Promise<string> {
    return (
      `[IA — Modo Stub]\n` +
      `Aún no hay un modelo conectado. En la Fase 2 este comando consultará\n` +
      `un agente local (Ollama) o remoto para explicar: "${concept}".\n` +
      `Mientras tanto, consulta los tutoriales con: tutorial-red, tutorial-firewall, etc.`
    );
  }

  /** Igual que `explain`, devuelve un eco placeholder. */
  async ask(prompt: string): Promise<string> {
    return `[IA — Modo Stub] Pregunta recibida: "${prompt}". Sin backend conectado todavía.`;
  }
}

/**
 * FallbackAIAgent — Patrón Decorator/Composite.
 *
 * Intenta delegar en `primary`. Si éste no está listo (o lanza una excepción
 * en cualquier llamada) cae automáticamente en `secondary` y antepone un
 * mensaje pedagógico para que el alumno entienda por qué la respuesta vino
 * del stub.
 *
 * SOLID — Open/Closed: encadenando `FallbackAIAgent`s se pueden agregar
 *         más backends (OpenAI → Ollama → Stub) sin tocar consumidores.
 */
export class FallbackAIAgent implements IAIAgent {
  constructor(
    private readonly primary: IAIAgent,
    private readonly secondary: IAIAgent,
  ) {}

  isReady(): boolean {
    return this.primary.isReady() || this.secondary.isReady();
  }

  async explain(concept: string): Promise<string> {
    if (this.primary.isReady()) {
      try {
        return await this.primary.explain(concept);
      } catch (err) {
        return this.degradedAnswer(await this.secondary.explain(concept), err);
      }
    }
    return this.degradedAnswer(await this.secondary.explain(concept));
  }

  async ask(prompt: string): Promise<string> {
    if (this.primary.isReady()) {
      try {
        return await this.primary.ask(prompt);
      } catch (err) {
        return this.degradedAnswer(await this.secondary.ask(prompt), err);
      }
    }
    return this.degradedAnswer(await this.secondary.ask(prompt));
  }

  /** Antepone un aviso al texto del fallback explicando por qué se cayó. */
  private degradedAnswer(text: string, err?: unknown): string {
    const why = err instanceof Error ? ` (${err.message})` : '';
    const head =
      `[IA — Backend principal no disponible${why}]\n` +
      `Sugerencia: instalá Ollama desde https://ollama.com y ejecutá ` +
      `'ollama pull llama3.2' en una terminal externa para activar la IA real.\n\n`;
    return head + text;
  }
}
