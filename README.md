# Simulador de Redes y Ciberseguridad — EEST N°10

> Plataforma educativa de simulación de Red Team / Blue Team para los laboratorios de informática de la Escuela de Educación Secundaria Técnica N°10.

Desarrollado por **Prof. Soto Diego Ariel** y **Prof. Gareca Cristian**.

---

## ¿Qué es?

Aplicación de escritorio (Electron + TypeScript) que emula una **terminal de comandos CLI** conectada a una **infraestructura de red virtual** (3 laboratorios, 60 PCs + router + servidor). Los estudiantes practican comandos reales de Windows, diagnostican fallos y resuelven 18 crisis de ciberseguridad en un entorno 100 % offline y seguro.

**Características clave**
- Terminal táctica interactiva con autocompletado, historial y latencias simuladas.
- Dashboard de infraestructura en tiempo real (CPU/RAM/LAN, rango del estudiante, objetivos de misión activa).
- 18 misiones Blue Team y Red Team evaluadas por expresiones regulares.
- Sistema de rangos: Estudiante → Junior → Semi-Senior → Senior → Futuro Hacker → The King/Queen.
- **Multijugador LAN** (Fase 3 completa): salas WebSocket, 4 modos de juego, reconexión con grace timer de 60 s.
- **IA pedagógica** (Fase 2 en progreso): interfaz `IAIAgent` lista; `OllamaAIAgent` skeleton presente.

## Instalación rápida

```bash
git clone https://github.com/tu-usuario/Simulador-de-Red-
cd Simulador-de-Red-
npm install
npm run dev          # modo desarrollo con hot-reload
```

> Requiere **Node.js 20 o 22**. Detalle completo en [`docs/00-quick-start.md`](docs/00-quick-start.md).

## Documentación

Toda la documentación técnica y pedagógica vive en [`docs/`](docs/README.md).

| # | Documento | Qué encontrás |
|---|-----------|---------------|
| 00 | [Quick Start](docs/00-quick-start.md) | Instalación, scripts `npm`, primer arranque, prueba multijugador. |
| 01 | [Arquitectura](docs/01-arquitectura.md) | MVC + SOLID, EventBus, ciclo de vida de un comando, fork del servidor. |
| 02 | [Stack técnico](docs/02-stack-tecnico.md) | Vite, Electron, TypeScript strict (dual tsconfig), electron-builder, WebSocket. |
| 03 | [Estructura del proyecto](docs/03-estructura-proyecto.md) | Árbol completo `src/` + `server/` + `electron/` con descripción de cada archivo. |
| 04 | [Ejemplos de uso](docs/04-ejemplos-de-uso.md) | Sesiones reales: tutoriales, misiones, multi-misión, partida LAN. |
| 05 | [Referencia de comandos](docs/05-comandos.md) | Cada `ICommand`: nombre, alias, sintaxis, ejemplo. |
| 06 | [Catálogo de misiones](docs/06-misiones.md) | Las 18 misiones con equipo, objetivos y comandos esperados. |
| 07 | [Eventos del bus](docs/07-eventos.md) | Tabla completa: payload, emisor y suscriptor de los 35 eventos. |
| 08 | [Multijugador LAN](docs/08-multijugador.md) | Fase 3: topología, protocolo WS, modos de juego, reconexión, timer seguro. |
| 09 | [Roadmap](docs/09-roadmap.md) | Fases 1–4: estado actual y próximos pasos. |

Reglas de contribución (10 reglas inviolables, recetas de extensión): [`AGENTS.md`](AGENTS.md).

## Objetivos pedagógicos

- **Práctica segura**: los alumnos manipulan firewall, procesos críticos y herramientas ofensivas en entorno aislado.
- **Comprensión dual**: aprenden cómo piensa un atacante (Red Team) para luego mitigarlo (Blue Team).
- **Resolución bajo presión**: diagnostican y resuelven crisis simuladas con tiempo límite.
- **Motivación por logros**: sistema de rangos con ascensos visibles y persistencia de sesión.
- **Trabajo en equipo**: los modos LAN requieren coordinación real entre compañeros.

## Equipo

| Rol | Nombre |
|-----|--------|
| Desarrollo y diseño pedagógico | Prof. Soto Diego Ariel |
| Desarrollo y diseño pedagógico | Prof. Gareca Cristian |

## Licencia

Código de **libre distribución, adaptación y uso pedagógico**. Creado para los laboratorios de la EEST N°10.
