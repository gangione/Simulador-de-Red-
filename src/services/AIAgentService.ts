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
