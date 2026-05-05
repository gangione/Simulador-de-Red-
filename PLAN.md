# PLAN.md

> Este archivo era el plan original de migración del prototipo monolítico
> (`script.js`) al proyecto MVC actual. **La migración está completa**:
> Vite + TypeScript + Electron, MVC + SOLID, 18 misiones, 4 tutoriales,
> sistema multi-misión con foco transferible y persistencia opcional.

## Estado actual

- ✅ **Fase 1** — Base completa (MVC + SOLID + 60 nodos + 18 misiones).
  Detalles en [`docs/01-arquitectura.md`](docs/01-arquitectura.md).
- ✅ **Fase 3** — Multijugador LAN completo:
  - `server/gameServer.ts` (WebSocket, fork de Electron, TypeScript estricto).
  - 4 modos: `red-vs-blue`, `capture`, `coop`, `ffa` extendiendo `BaseMode`.
  - Reconexión con grace timer de 60 s, cola de aprobación de joins,
    handshake `team-required` para entrar a partidas en curso.
  - Contrato compartido `server/protocol.ts` (uniones discriminadas
    `ClientMsg`/`ServerMsg`) usado por cliente y servidor con `import type`.
  - Hardening del runtime: `process.on('uncaughtException'/'unhandledRejection')`
    + regla del *timer sobreviviente* (ver AGENTS.md §2).
- 🔜 **Fase 2** — IA pedagógica (Ollama / OpenAI tras `IAIAgent`). Pendiente.

El roadmap actualizado vive en [`docs/09-roadmap.md`](docs/09-roadmap.md) y
las reglas de contribución en [`AGENTS.md`](AGENTS.md).

## Documentación

Para entender el proyecto, su arquitectura, comandos, misiones y eventos,
empezá por el índice: [`docs/README.md`](docs/README.md).
