# Documentación técnica — Simulador de Redes y Ciberseguridad

> Esta carpeta es la **guía de aprendizaje completa** del proyecto: cómo se diseñó,
> cómo se extiende y hacia dónde va. Está pensada para alumnos, docentes,
> contribuidores nuevos y agentes IA que necesiten contexto rápido.

---

## Camino de lectura recomendado

```
¿Primera vez?  →  00 (arrancar)  →  01 (entender)  →  04 (ver en acción)
¿Extender?     →  03 (archivos)  →  05 (comandos)  →  AGENTS.md (reglas)
¿Misiones?     →  06 (catálogo)
¿Multijugador? →  08 (Fase 3)    →  07 (eventos)
¿Futuro?       →  09 (roadmap)
¿Stack tech?   →  02 (stack)
```

---

## Índice completo

| # | Documento | Qué encontrás |
|---|-----------|---------------|
| 00 | [Quick Start](00-quick-start.md) | Instalación paso a paso, scripts `npm`, primer arranque y prueba multijugador LAN. |
| 01 | [Arquitectura](01-arquitectura.md) | MVC + SOLID, EventBus como único canal, ciclo de vida de un comando, fork del servidor. |
| 02 | [Stack técnico](02-stack-tecnico.md) | Vite, Electron, TypeScript strict (dual tsconfig), WebSocket, electron-builder NSIS. |
| 03 | [Estructura del proyecto](03-estructura-proyecto.md) | Árbol completo `src/` + `server/` + `electron/` con descripción de cada archivo y su rol. |
| 04 | [Ejemplos de uso](04-ejemplos-de-uso.md) | Sesiones reales: tutoriales, misiones, multi-misión, partida LAN con toast y aprobación. |
| 05 | [Referencia de comandos](05-comandos.md) | Cada `ICommand`: nombre, alias, sintaxis, equipo destino y ejemplo de uso. |
| 06 | [Catálogo de misiones](06-misiones.md) | Las 18 misiones (Blue + Red Team) con equipo, dificultad, objetivos y comandos clave. |
| 07 | [Eventos del bus](07-eventos.md) | Tabla de los 35 eventos: payload tipado, emisor y suscriptor; más protocolo WS. |
| 08 | [Multijugador LAN](08-multijugador.md) | Fase 3 completa: topología, protocolo, ciclo de partida, modos, reconexión, timer seguro. |
| 09 | [Roadmap](09-roadmap.md) | Fases 1–4: lo completado, lo que sigue (IA + Tests) y visión de largo plazo. |

---

## Por rol

### Alumno / jugador
Empezá con [00 Quick Start](00-quick-start.md), luego `help` en la terminal.
Para entender qué hacen los comandos y misiones: [05](05-comandos.md) y [06](06-misiones.md).

### Docente
La arquitectura pedagógica está en [01](01-arquitectura.md). El catálogo de misiones
con objetivos de aprendizaje está en [06](06-misiones.md). Para agregar una misión nueva:
ver `AGENTS.md §4`.

### Contribuidor / desarrollador
1. Leé las [10 reglas inviolables](../AGENTS.md) antes de tocar código.
2. Ubicá el archivo correcto en [03 Estructura](03-estructura-proyecto.md).
3. Seguí las recetas de `AGENTS.md` (§3 comandos, §4 misiones, §6 vistas, §6.1 modos, §6.2 protocolo WS).
4. Antes de hacer commit: checklist en `AGENTS.md §10`.

### Agente IA
Este archivo es tu punto de entrada. Las reglas inviolables están en
[`AGENTS.md §2`](../AGENTS.md). El contrato de eventos está en [07](07-eventos.md).
El protocolo WS está en [`server/protocol.ts`](../server/protocol.ts) — no uses `as any`.

---

Reglas de contribución, recetas de extensión y checklist de PR: [`AGENTS.md`](../AGENTS.md).
