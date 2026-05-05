/**
 * OllamaAIAgent — implementación real de `IAIAgent` que conversa con un
 * servidor Ollama local (https://ollama.com).
 *
 * SOLID — Inversión de dependencias: el resto de la app sigue dependiendo
 *         sólo de `IAIAgent`. Esta clase es la primera implementación con
 *         backend real (Fase 2).
 *
 * Por defecto apunta a `http://127.0.0.1:11434` y usa el modelo `llama3.2`.
 * Si Ollama no responde, `isReady()` devuelve `false` y el `FallbackAIAgent`
 * delega en el `StubAIAgent` para no romper la experiencia educativa.
 */
import type { IAIAgent } from './AIAgentService';

export interface OllamaConfig {
  /** URL base del servidor Ollama, sin slash final. */
  baseUrl?: string;
  /** Modelo a usar (debe estar instalado: `ollama pull <model>`). */
  model?: string;
  /** Temperatura del muestreo (0–1). */
  temperature?: number;
  /** Timeout por request en milisegundos. */
  timeoutMs?: number;
}

export class OllamaAIAgent implements IAIAgent {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly temperature: number;
  private readonly timeoutMs: number;

  /** Cache de disponibilidad: se refresca cada `READY_TTL_MS`. */
  private readyCache: { value: boolean; checkedAt: number } | null = null;
  private static readonly READY_TTL_MS = 30_000;

  constructor(cfg: OllamaConfig = {}) {
    this.baseUrl = (cfg.baseUrl ?? 'http://127.0.0.1:11434').replace(/\/+$/, '');
    this.model = cfg.model ?? 'llama3.2';
    this.temperature = cfg.temperature ?? 0.4;
    this.timeoutMs = cfg.timeoutMs ?? 60_000;
  }

  /**
   * Devuelve `true` si Ollama responde a `/api/tags`. Resultado cacheado.
   * No es `async` para respetar el contrato de `IAIAgent`; el primer chequeo
   * dispara una verificación en background y devuelve el último valor conocido.
   */
  isReady(): boolean {
    const now = Date.now();
    if (this.readyCache && now - this.readyCache.checkedAt < OllamaAIAgent.READY_TTL_MS) {
      return this.readyCache.value;
    }
    // Disparar chequeo asíncrono y devolver el último valor (o false si nunca chequeamos).
    void this.refreshReady();
    return this.readyCache?.value ?? false;
  }

  /** Chequea `/api/tags` con timeout corto y actualiza el cache. */
  private async refreshReady(): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2_000);
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: ctrl.signal });
      clearTimeout(t);
      const ok = res.ok;
      this.readyCache = { value: ok, checkedAt: Date.now() };
      return ok;
    } catch {
      this.readyCache = { value: false, checkedAt: Date.now() };
      return false;
    }
  }

  async explain(concept: string): Promise<string> {
    const prompt =
      `Sos un instructor de redes y ciberseguridad para alumnos de escuela técnica argentina. ` +
      `Explicá el concepto "${concept}" en español, en un párrafo claro de 4-7 oraciones, ` +
      `con un ejemplo concreto aplicable en una LAN escolar. Evitá listas y markdown.`;
    return this.generate(prompt);
  }

  async ask(prompt: string): Promise<string> {
    const wrapped =
      `Sos un asistente didáctico de redes y ciberseguridad. Respondé en español, breve y técnico, ` +
      `como si le hablaras a un alumno de 5to año de escuela técnica:\n\n${prompt}`;
    return this.generate(wrapped);
  }

  /** POST `/api/generate` con `stream:false` y devuelve la respuesta plana. */
  private async generate(prompt: string): Promise<string> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: { temperature: this.temperature },
        }),
      });
      if (!res.ok) {
        throw new Error(`Ollama HTTP ${res.status}`);
      }
      const data = (await res.json()) as { response?: string };
      const text = (data.response ?? '').trim();
      if (!text) throw new Error('Respuesta vacía del modelo');
      this.readyCache = { value: true, checkedAt: Date.now() };
      return text;
    } catch (err) {
      this.readyCache = { value: false, checkedAt: Date.now() };
      const reason = err instanceof Error ? err.message : 'desconocido';
      throw new Error(`[Ollama] ${reason}`);
    } finally {
      clearTimeout(t);
    }
  }
}
