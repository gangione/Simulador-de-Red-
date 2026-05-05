# 00 · Quick Start

Esta guía te lleva del clon del repositorio a tener el simulador corriendo en
tu máquina en pocos minutos.

## 1. Requisitos

| Software | Versión recomendada |
|----------|---------------------|
| Node.js  | 20.x o 22.x         |
| npm      | 10.x                |
| Sistema  | Windows 10 / 11 (también funciona en macOS y Linux para desarrollo) |

> En Windows usá **Git Bash** o **PowerShell** para ejecutar los comandos.

## 2. Instalación

```bash
git clone <url-del-repositorio>
cd Simulador-de-Red-
npm install
```

<!-- Esto en mi caso no estoy seguro si me ocurrió. Se deja comentado por utilidad de troubleshooting si existe el caso. -->
<!-- ### Fix conocido — binario de Electron en Windows

A veces `npm install` no descarga automáticamente el binario nativo de
Electron en Windows y verás un error al intentar arrancar. Si te ocurre,
ejecutá una sola vez:

```bash
node node_modules/electron/install.js
``` -->

## 3. Scripts disponibles

| Comando            | Para qué sirve                                                                 |
|--------------------|--------------------------------------------------------------------------------|
| `npm run dev`      | Levanta Vite + Electron en modo hot-reload. Ideal para desarrollar.            |
| `npm run build`    | Type-check con `tsc --noEmit` + bundle de producción a `dist/` y `dist-electron/`. |
| `npm start`        | Ejecuta la app Electron sobre el bundle de producción.                         |
| `npm run package`  | Genera el instalador `.exe` con electron-builder (target NSIS).                |

## 4. Primer arranque

```bash
npm run dev
```

Se abrirá una ventana de Electron con dos paneles:

- **Izquierda** → Terminal Táctica (consola interactiva).
- **Derecha** → Monitor de Infraestructura (estado, CPU/RAM/LAN, guía).

En la consola escribí:

```text
help
```

Verás el listado de módulos disponibles. Te recomendamos seguir esta ruta:

1. `tutorial-red` → familiarízate con comandos de red básicos.
2. `tutorial-firewall` → aprende a defender (Blue Team).
3. `misiones` → listado del catálogo de crisis.
4. `mision 1` → primera misión guiada con briefing en pantalla.

## 5. Persistir tu progreso

`sessionStorage` se borra al cerrar la app. Para guardar tu progreso entre
sesiones usá:

```text
save           # Guarda la primera vez. Pide confirmación si ya existe.
save confirm   # Sobrescribe la partida anterior.
```

Al volver a abrir la app, el `MissionModel` y el `UserModel` restauran
automáticamente lo guardado (rango, tutoriales, misiones activas y enfocada).

## 6. Próximos pasos

- Para entender la arquitectura, leé [01 · Arquitectura](01-arquitectura.md).
- Para ver una sesión típica completa, leé [04 · Ejemplos de uso](04-ejemplos-de-uso.md).
- Para extender el proyecto (nuevo comando, misión, vista o agente IA), revisá
  [`AGENTS.md`](../AGENTS.md).
