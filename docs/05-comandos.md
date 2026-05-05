# 05 · Referencia de comandos

Cada comando es una clase que implementa la interfaz
[`ICommand`](../src/types/command.types.ts). El `CommandController` los
busca por `name` o `aliases`, sin modificarse cuando se agregan nuevos
(principio Open/Closed). El registro se hace en
[`src/main.ts`](../src/main.ts).

## Sistema y misiones

| Nombre   | Alias                       | Sintaxis              | Qué hace |
|----------|-----------------------------|-----------------------|----------|
| `help`   | —                           | `help`                | Lista todos los módulos disponibles. |
| `cls`    | `clear`                     | `cls`                 | Limpia el output (mantiene banner). |
| `misiones` | —                         | `misiones`            | Catálogo con badges ✓●○· y línea "Activas:". |
| `mision` | —                           | `mision <n>`          | Inicia o re-enfoca una misión. Imprime el briefing. |
| `foco`   | `focus`, `enfocar`          | `foco <n>`            | Transfiere el foco a otra misión activa. |
| `abortar`| `salir-mision`, `cancelar`  | `abortar [n]`         | Aborta la enfocada (o `n` específica). Descarta progreso. |
| `exit`   | `salir`, `home`             | `exit`                | Quita el foco SIN abortar. Vuelve al home. |
| `save`   | `guardar`                   | `save` / `save confirm` | Persiste a `localStorage` con prefijo `sim:`. |
| `?teoria`| —                           | `?teoria <concepto>`  | Hook de IA (Fase 2). Hoy responde el `StubAIAgent`. |

## Tutoriales

| Nombre              | Marca como completado | Comando que dispara la marca |
|---------------------|-----------------------|------------------------------|
| `tutorial-red`      | `red`                 | `ipconfig`                   |
| `tutorial-dos`      | `dos`                 | `dir`                        |
| `tutorial-firewall` | `firewall`            | `netsh advfirewall show allprofiles` |
| `tutorial-ataque`   | `ataque`              | `nmap 192.168.1.0/24`        |

## Red (NetworkCommands)

| Nombre        | Para qué sirve |
|---------------|----------------|
| `ipconfig`    | Muestra/libera/renueva IP (`/release`, `/renew`, `/flushdns`). |
| `arp`         | Tabla ARP. `arp -a` muestra la red. |
| `ping`        | Prueba conectividad. Soporta `-t -l 65500` (DoS). |
| `netstat`     | Conexiones activas. `netstat -an`. |
| `tracert`     | Ruta hop-by-hop a un destino. |
| `nbtstat`     | Resuelve hostname NetBIOS. `nbtstat -A <ip>`. |
| `getmac`      | MAC del adaptador. |
| `hostname`    | Nombre del equipo local. |
| `route`       | `route print` muestra la tabla de rutas. |
| `systeminfo`  | Resumen de hardware/SO. |
| `tasklist`    | Procesos en ejecución. |
| `taskkill`    | `taskkill /PID <n> /F` mata un proceso. |
| `nslookup`    | Consulta DNS. |
| `nmap`        | Escaneo de red o de puertos. |
| `crack`       | Fuerza bruta sobre `<ip> <puerto>` (Red Team). |
| `netsh`       | Firewall y configuración IP estática. |
| `net`         | `user`, `localgroup`, `share`, `use`. |
| `whoami`      | Usuario actual. |
| `sfc`         | `sfc /scannow` repara archivos del sistema. |

Implementación completa en
[`src/controllers/commands/NetworkCommands.ts`](../src/controllers/commands/NetworkCommands.ts).

## Sistema de archivos virtual (FileSystemCommands)

| Nombre   | Alias | Sintaxis                        | Qué hace |
|----------|-------|----------------------------------|----------|
| `dir`    | —     | `dir`                            | Lista contenido del cwd. |
| `cd`     | —     | `cd <ruta>` / `cd ..`            | Cambia directorio. Emite `PromptChanged`. |
| `mkdir`  | `md`  | `mkdir <nombre>`                 | Crea carpeta. |
| `del`    | —     | `del <archivo>` / `del *.mp4`    | Borra archivo (o por glob). |
| `type`   | —     | `type <archivo>`                 | Muestra contenido. |
| `tree`   | —     | `tree`                           | Árbol completo. |
| `echo`   | —     | `echo <texto> > <archivo>`       | Crea archivo de texto. |

Implementación en
[`src/controllers/commands/FileSystemCommands.ts`](../src/controllers/commands/FileSystemCommands.ts).

## Audio (AudioCommands)

| Nombre     | Alias                      | Sintaxis              | Qué hace |
|------------|----------------------------|-----------------------|----------|
| `volumen`  | `volume`, `vol`            | `volumen <0–100>`     | Ajusta el volumen de la música de fondo. |
| `mute`     | `silencio`                 | `mute`                | Silencia / activa la música (toggle). |
| `play`     | `musica`                   | `play`                | Reanuda la reproducción si está pausada. |
| `pause`    | `pausa`                    | `pause`               | Pausa la música de fondo. |

Implementación en
[`src/controllers/commands/AudioCommands.ts`](../src/controllers/commands/AudioCommands.ts).

## Multijugador / Lobby (LobbyCommands)

Todos los comandos de esta categoría se conectan a través de
[`LobbyService`](../src/services/LobbyService.ts) vía WebSocket.
El servidor de juego se inicia automáticamente al abrir la app en Electron.

| Nombre    | Alias              | Sintaxis                              | Qué hace |
|-----------|--------------------|---------------------------------------|----------|
| `lobby`   | —                  | `lobby`                               | Abre/cierra el panel de lobby en el dashboard. |
| `hostear` | `host`             | `hostear <alias>`                     | Crea una sala nueva y espera jugadores. Imprime el código de 4 letras. |
| `unirse`  | `join`             | `unirse <CÓDIGO> <IP-host> <alias>`   | Se conecta a una sala existente por código + IP LAN del host. |
| `equipo`  | `team`             | `equipo <red\|blue\|auto>`            | Elige (o cambia) de equipo antes de que arranque la partida. |
| `listo`   | `ready`            | `listo`                               | Marca al jugador como listo. Cuando todos están listos, el host puede iniciar. |
| `leave`   | `salir-sala`       | `leave`                               | Sale de la sala actual (sin cerrar el servidor). |

> Si un jugador intenta unirse durante una partida activa y el equipo requiere
> aprobación, el host y sus compañeros ven un **toast de aprobación** con botones
> ACEPTAR / RECHAZAR. El servidor mantiene la solicitud pendiente 60 s.
> Ver detalles en [08 · Multijugador](08-multijugador.md).

Implementación en
[`src/controllers/commands/LobbyCommands.ts`](../src/controllers/commands/LobbyCommands.ts).

## Crear un comando nuevo

```ts
// src/controllers/commands/HelloCommand.ts
import type { ICommand, ICommandContext, ICommandResult } from '../../types';

export class HelloCommand implements ICommand {
  readonly name = 'hello';
  readonly aliases = ['hi'];
  execute(ctx: ICommandContext): ICommandResult {
    return { output: [[`Hola, ${ctx.args[1] ?? 'mundo'}!`, 'var(--matrix-green)']] };
  }
}
```

```ts
// src/main.ts (al final del registro)
commands.register(new HelloCommand());
```

Cero modificaciones al dispatcher.
