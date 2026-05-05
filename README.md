# Simulador de Redes y Ciberseguridad — EEST N°10

> Plataforma educativa de simulación de Red Team vs Blue Team para los laboratorios de informática de la Escuela de Educación Secundaria Técnica N°10.

Desarrollado por **Prof. Soto Diego Ariel** y **Prof. Gareca Cristian**.

---

## 1. ¿Qué es?

Una aplicación de escritorio (Electron) que emula una **Terminal de Comandos (CLI)** realista conectada a una **infraestructura de red virtual** (3 laboratorios, 60 PCs + router + servidor). Los estudiantes practican comandos reales de Windows, diagnostican fallos y resuelven crisis de ciberseguridad sin riesgo para la infraestructura física de la escuela.

- **Panel izquierdo** — Terminal Táctica: consola interactiva con autocompletado, historial y latencias simuladas.
- **Panel derecho** — Monitor de Infraestructura: dashboard con CPU/RAM/LAN, rango del estudiante y objetivos de la misión activa.
- **Motor de misiones** integrado: 17 escenarios de crisis evaluados por expresiones regulares en tiempo real.
- **Sistema de rangos persistente**: Estudiante → Junior → Semi-Senior → Senior → Futuro Hacker → The King/Queen of the Hacker.

## 2. Arquitectura

El proyecto sigue **MVC + SOLID** estricto sobre TypeScript. Cada capa tiene una responsabilidad única y depende solo de interfaces.

```
src/
├── types/          Interfaces y contratos (ICommand, IHost, IMission, IVFS…)
├── data/           Topología de red, catálogo de misiones, VFS inicial
├── models/         Estado puro: NetworkModel, MissionModel, UserModel, FileSystemModel
├── services/       EventBus (Observer), StorageService, AIAgentService (stub)
├── views/          BaseView abstracta + TerminalView, DashboardView
├── controllers/    AppController (orquestador), CommandController (dispatcher),
│                   commands/  (un archivo por familia: red, FS, ayuda)
└── main.ts         Composition root — inyecta dependencias y arranca todo
```

### Mapeo SOLID

| Principio | Dónde se ejemplifica |
|---|---|
| **S — Single Responsibility** | `NetworkModel` solo gestiona estado de red; `StorageService` solo persiste; cada `ICommand` hace una sola cosa. |
| **O — Open/Closed** | `CommandController` mantiene un registro de comandos. Agregar uno nuevo = crear un archivo y llamar a `register()` en `main.ts`. El dispatcher no se modifica. |
| **L — Liskov Substitution** | `TerminalView` y `DashboardView` extienden `BaseView` y son intercambiables donde se espera la base. |
| **I — Interface Segregation** | `IStorageProvider`, `IAIAgent`, `IEventBus`, `ICommand` son pequeñas y enfocadas. |
| **D — Dependency Inversion** | `AppController` recibe sus colaboradores por constructor; los modelos dependen de `IStorageProvider`, no de `sessionStorage`. |

## 3. Stack técnico

| Capa | Tecnología |
|---|---|
| Lenguaje | **TypeScript** (strict mode) |
| Bundler | **Vite** + `vite-plugin-electron` |
| UI | HTML5 + CSS3 puros (sin framework) |
| Empaquetado | **Electron** + `electron-builder` (Windows NSIS) |
| Persistencia | `sessionStorage` (vía `IStorageProvider`) |
| IA (Fase 2) | Interfaz `IAIAgent` lista para conectar Ollama, OpenAI o LLM local |

## 4. Comandos

### Desarrollo

```bash
npm install        # Instalar dependencias
npm run dev        # Vite + Electron en modo hot-reload
```

### Build de producción

```bash
npm run build      # Type-check + bundle Vite (genera dist/ y dist-electron/)
npm start          # Ejecutar la app Electron sobre el bundle
npm run package    # Empaquetar a .exe con electron-builder
```

## 5. Uso del simulador

1. **Inicio**: la consola está lista. Escribe `help` para ver los módulos.
2. **Tutoriales**: `tutorial-red`, `tutorial-dos`, `tutorial-firewall`, `tutorial-ataque`.
3. **Misiones**: `misiones` para listar el catálogo; `mision <id>` para iniciar.
4. **Resolución**: aplica los comandos correctos. Cada objetivo se tacha automáticamente y otorga progreso.
5. **IA (próximamente)**: `?teoria <concepto>` consultará al agente IA cuando se conecte un backend.

### Ejemplos de misión

| ID | Título | Equipo |
|---|---|---|
| 1 | El Servidor Fantasma | Blue |
| 3 | Ataque de Fuerza Bruta | Blue |
| 9 | El Escudo Caído | Blue |
| 13 | Tráfico Desviado | Blue |
| 101 | Denegación de Servicio (DoS) | Red |
| 102 | Escaneo Nmap | Red |
| 103 | Escalada de Privilegios | Red |
| 104 | Fuerza Bruta | Red |
| 105 | Desarmar Defensas | Red |

## 6. Roadmap

| Fase | Estado | Descripción |
|---|---|---|
| **1** | ✅ Completa | MVC + TypeScript + SOLID + interfaces de IA listas |
| **2** | 🔜 | Conectar `IAIAgent` con Ollama / API real; comando `?teoria <concepto>` operativo |
| **3** | 🔮 | `GameServer` WebSocket en Node.js; salas LAN Red Team vs Blue Team con estado de red sincronizado |

Detalle del roadmap y reglas de contribución: ver [AGENTS.md](AGENTS.md).

## 7. Objetivos pedagógicos

- **Práctica segura**: los alumnos manipulan firewall, procesos críticos y herramientas ofensivas en un entorno 100% aislado.
- **Comprensión dual**: aprenden cómo piensa un atacante (Red Team) para luego mitigarlo (Blue Team).
- **Resolución bajo presión**: diagnostican y resuelven crisis simuladas reales.
- **Motivación por logros**: sistema de rangos persistente con ascensos visibles.

## 8. Equipo

- **Prof. Soto Diego Ariel**
- **Prof. Gareca Cristian**

## 9. Licencia

Código fuente de **libre distribución, adaptación y actualización**. Uso meramente pedagógico y de aprendizaje. Aplicación creada para los laboratorios de la Escuela Secundaria Técnica EEST N°10.

---

## 10. Documentación técnica

La documentación detallada vive en la carpeta [`docs/`](docs/README.md). Incluye
quick-start, arquitectura, ejemplos de uso, referencia completa de comandos,
catálogo de misiones, eventos del bus y roadmap.

| # | Documento | Contenido |
|---|-----------|-----------|
| 00 | [Quick Start](docs/00-quick-start.md) | Instalación, scripts npm, primer arranque. |
| 01 | [Arquitectura](docs/01-arquitectura.md) | MVC + SOLID, EventBus, ciclo de vida de un comando. |
| 02 | [Stack técnico](docs/02-stack-tecnico.md) | Vite, Electron, TypeScript strict, electron-builder. |
| 03 | [Estructura del proyecto](docs/03-estructura-proyecto.md) | Árbol `src/` con descripción archivo por archivo. |
| 04 | [Ejemplos de uso](docs/04-ejemplos-de-uso.md) | Sesiones reales: tutoriales, multi-misión, save/exit. |
| 05 | [Referencia de comandos](docs/05-comandos.md) | Tabla con cada `ICommand`: nombre, alias, sintaxis. |
| 06 | [Catálogo de misiones](docs/06-misiones.md) | Las 18 misiones con objetivos y regex. |
| 07 | [Eventos del bus](docs/07-eventos.md) | Payload, emisor y suscriptor de cada evento. |
| 09 | [Roadmap](docs/09-roadmap.md) | Fase 2 (IA) y Fase 3 (multijugador LAN). |

Para reglas de contribución y normas de estilo, ver [`AGENTS.md`](AGENTS.md).
