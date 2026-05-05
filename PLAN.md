# PLAN.md — Estado del proyecto

> Este archivo es un **resumen de estado**. El plan original de migración
> del prototipo monolítico (`script.js`) al proyecto MVC está **completamente
> ejecutado**. El roadmap vivo y los próximos pasos están en
> [`docs/09-roadmap.md`](docs/09-roadmap.md).

## Estado de fases

| Fase | Estado | Descripción |
|------|--------|-------------|
| **1 — Base** | ✅ Completa | MVC + SOLID + TypeScript strict, 60 nodos, 18 misiones, 4 tutoriales, multi-misión, persistencia, stub IA. |
| **2 — IA pedagógica** | 🟡 En progreso | `OllamaAIAgent.ts` skeleton presente; `IAIAgent` interfaz lista. Falta: conectar `?teoria`, hints contextuales, fallback offline. |
| **3 — Multijugador LAN** | ✅ Completa | `GameServer` WebSocket (fork Electron), 4 modos de juego, reconexión 60 s, `protocol.ts` compartido, hardening de runtime. |
| **4 — Tests** | 🔜 Pendiente | Vitest (unitarios sobre modelos y comandos) + Playwright (E2E sobre bundle de producción). |

## Dónde está cada cosa

| Recurso | Archivo |
|---------|--------|
| Guía de inicio | [`docs/00-quick-start.md`](docs/00-quick-start.md) |
| Arquitectura MVC + SOLID | [`docs/01-arquitectura.md`](docs/01-arquitectura.md) |
| Stack técnico completo | [`docs/02-stack-tecnico.md`](docs/02-stack-tecnico.md) |
| Estructura de archivos | [`docs/03-estructura-proyecto.md`](docs/03-estructura-proyecto.md) |
| Multijugador LAN (Fase 3) | [`docs/08-multijugador.md`](docs/08-multijugador.md) |
| Roadmap y próximos pasos | [`docs/09-roadmap.md`](docs/09-roadmap.md) |
| Reglas inviolables (10) | [`AGENTS.md`](AGENTS.md) |
