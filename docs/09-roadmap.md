# 09 · Roadmap

## Fase 1 — Base sólida ✅

- [x] Vite + TypeScript strict + Electron 29 con empaquetado NSIS.
- [x] MVC + SOLID con ejemplos didácticos en cada capa.
- [x] EventBus (Observer) como única vía de comunicación.
- [x] Sistema de comandos extensible (Open/Closed) con ~40 `ICommand`.
- [x] 60 nodos de red virtuales y 18 misiones (Blue + Red Team).
- [x] 4 tutoriales auto-detectados (red, dos, firewall, ataque).
- [x] **Multi-misión**: varias activas simultáneas con foco transferible
      (`foco`, `abortar [n]`, `exit` que des-enfoca sin abortar).
- [x] Persistencia opcional con `save` / `save confirm` en `localStorage`.
- [x] Stub de IA con interfaz `IAIAgent`.

## Fase 2 — IA pedagógica

Objetivo: que `?teoria <concepto>` y los tips contextuales pasen del stub
a un agente real, sin tocar nada fuera de `src/services/`.

- [ ] Implementación `OllamaAIAgent` (modelo local con `ollama serve`).
- [ ] Implementación alternativa `OpenAIAgent` con clave por variable de entorno.
- [ ] Comando `?teoria <concepto>` plenamente funcional.
- [ ] Hint contextual durante misiones: "el siguiente comando útil podría
      ser X" (basado en el `stepIndex` actual).
- [ ] Política de fallback: si no hay conexión, vuelve al `StubAIAgent`.

### Esqueleto

```ts
// src/services/OllamaAIAgent.ts
import type { IAIAgent } from './AIAgentService';

export class OllamaAIAgent implements IAIAgent {
  isReady() { return true; }
  async explain(concept: string): Promise<string> { /* fetch local Ollama */ }
  async ask(prompt: string): Promise<string>     { /* idem */ }
}
```

```ts
// src/main.ts (cambio mínimo)
const agent = new OllamaAIAgent();   // antes: new StubAIAgent()
```

Nada más cambia. Los comandos siguen igual (Dependency Inversion).

## Fase 3 — Multijugador LAN (✅ Completa)

Objetivo: dos o más jugadores sobre la misma red local con sincronización
en tiempo real, organizados en cuatro modos de juego.

- [x] `GameServer` WebSocket en proceso Node aparte (forkeado por Electron).
- [x] 4 modos: `red-vs-blue` (PvP por equipos), `capture` (toma de
      servidores), `coop` (defensa cooperativa) y `ffa` (free-for-all).
      Cada modo extiende `BaseMode` y se registra en `modes/index.ts`.
- [x] **Migración completa a TypeScript estricto** del server
      (`tsconfig.server.json`, `noUncheckedIndexedAccess`,
      `noImplicitOverride`). Salida en `server-dist/`.
- [x] Contrato compartido [`server/protocol.ts`](../server/protocol.ts)
      con uniones discriminadas `ClientMsg` / `ServerMsg`. El cliente lo
      consume con `import type` — cualquier cambio rompe en compile-time
      en ambos lados.
- [x] Reconexión: cuando un jugador se desconecta queda en `disconnected`
      con un grace timer de 60 s; si vuelve antes recupera su slot. Si la
      partida está en curso y entra alguien nuevo, se le pide elegir equipo
      (`team-required`) y los miembros del team aprueban (`join-request`).
- [x] Hardening: `process.on('uncaughtException'/'unhandledRejection')` +
      *regla del timer sobreviviente* (capturar refs locales, validar
      `rooms.has(code)`, envolver en `try/catch`). Ver AGENTS.md §2.9.
- [x] Vistas `LobbyView` + `MatchHudView` + servicio `LobbyService` que
      traduce el WS a eventos `lobby:*` del `EventBus`.

## Tests (planeado)

- [ ] **Vitest** unitarios sobre `NetworkModel`, `MissionModel`,
      `FileSystemModel` y cada `ICommand` con `ctx` mockeado.
- [ ] **Playwright** E2E sobre el bundle de producción: scripts que
      reproducen sesiones del documento [04 · Ejemplos de uso](04-ejemplos-de-uso.md).
- [ ] CI con `npm run build && vitest run` en cada PR.

## Mejoras de UX consideradas

- [ ] Atajo `Tab` para autocompletar comandos.
- [ ] Historial navegable con `↑/↓`.
- [ ] Modo oscuro/claro (variable CSS).
- [ ] Lectura accesible (ARIA labels, contraste AA).
