# 04 · Ejemplos de uso

Sesiones reales para ver el simulador "en acción". Las salidas están
abreviadas: lo importante es la secuencia de comandos y cómo reacciona el
sistema.

## A. Arranque

```text
>> Entorno de Simulación EEST N°10 Operativo. 60 nodos detectados.
[CYBER-OS] >
```

A la derecha verás el panel "Misión Activa". Mientras no haya ninguna en
foco, se muestra la **Home**: ruta sugerida de tutoriales + un "Tip del día"
elegido al azar de [`src/data/tips.data.ts`](../src/data/tips.data.ts).

## B. Pedir ayuda

```text
[CYBER-OS] > help
```

Devuelve el menú principal con las categorías:

- **Misiones**: `misiones` · `mision <n>` · `foco <n>` · `abortar [n]` · `exit`
- **Tutoriales**: `tutorial-red` · `tutorial-dos` · `tutorial-firewall` · `tutorial-ataque`
- **Sistema**: `cls` · `save` · `save confirm`
- **IA**: `?teoria <concepto>` (Fase 2)

## C. Hacer un tutorial completo

```text
[CYBER-OS] > tutorial-red
--- MÓDULO: REDES (Diagnóstico Básico) ---
1. ipconfig : Muestra tu IP actual.
...
[ACCIÓN]: Prueba 'ipconfig' para completar este tutorial.

[CYBER-OS] > ipconfig
Adaptador Ethernet: 192.168.1.X / 255.255.255.0 / Gateway 192.168.1.1
[OK] Tutorial REDES completado. Rango promovido.
```

El evento `Events.TutorialCompleted` viaja al `DashboardView` y la "ruta
sugerida" tacha esa estación, dejando la próxima en color ámbar.

## D. Ver y arrancar misiones

```text
[CYBER-OS] > misiones
--- CATÁLOGO DE CRISIS ---
Activas: D1, D2 — foco: D2
○ D1: El Servidor Fantasma
● D2: El Polizón en la Red
· D3: Ataque de Fuerza Bruta
✓ D6: La Falsa Internet
...

[CYBER-OS] > mision 3
╔═════════════ BRIEFING ═════════════╗
║ D3: Ataque de Fuerza Bruta         ║
║ Misiones activas: 3 — foco actual: D3
╚════════════════════════════════════╝
```

## E. Multi-misión (varias activas)

El `MissionModel` permite N misiones en simultáneo: solo la **enfocada**
evalúa los comandos. Para alternar:

```text
[CYBER-OS] > mision 1     # arranca D1, queda en foco
[CYBER-OS] > mision 2     # arranca D2, foco se transfiere a D2
[CYBER-OS] > foco 1       # vuelve a poner el foco en D1
>> Foco transferido a D1: El Servidor Fantasma
   Progreso: 2/5 pasos completados.
```

Cuando completás una misión, el motor **transfiere el foco automáticamente
a otra activa** (si queda alguna). De lo contrario vuelve al panel home.

## F. Quitar el foco sin abortar (`exit`)

```text
[CYBER-OS] > exit
```

- **NO aborta** las misiones.
- Limpia la consola y restaura el banner de bienvenida.
- El dashboard vuelve al panel "home" con tutoriales + tip.
- Las misiones siguen activas y conservan su progreso. Volvé a entrar con
  `foco <n>` cuando quieras.

## G. Abortar (sí descarta progreso)

```text
[CYBER-OS] > abortar         # aborta la enfocada
[CYBER-OS] > abortar 2       # aborta una específica
```

Si quedan otras activas, el foco se transfiere; si no, se vuelve a la home.

## H. Guardar el progreso

```text
[CYBER-OS] > save
[!] Ya existe un guardado anterior. Confirma con: save confirm
[CYBER-OS] > save confirm
[OK] Progreso guardado en disco. Podés cerrar la app sin perder nada.
```

`save` invoca `storage.persist()` después de pedir snapshots a los modelos.
Al volver a abrir la app, `restore()` reactiva el estado anterior.

## I. Limpiar pantalla sin tocar misiones

```text
[CYBER-OS] > cls
```

Equivale a `clear`. Restaura el HTML inicial del `<pre id="terminal-output">`
(banner + bienvenida) sin afectar misiones, foco ni progreso.

## J. Sesión completa de la D1

```text
[CYBER-OS] > mision 1
[CYBER-OS] > ping 192.168.1.10        # paso 1 ✓
[CYBER-OS] > arp -a                   # paso 2 ✓
[CYBER-OS] > nbtstat -A 192.168.1.15  # paso 3 ✓
[CYBER-OS] > netsh interface ip set address "Ethernet" static 192.168.1.10 255.255.255.0 192.168.1.1
                                      # paso 4 ✓
[CYBER-OS] > ping 192.168.1.10        # paso 5 ✓
[OK] Misión D1 completada. Rango promovido.
```

El catálogo completo con regex está en [06 · Misiones](06-misiones.md).

## K. Partida multijugador LAN (Sesión de 3 jugadores)

Esta sesión ilustra el flujo completo de Fase 3. La notación `PC1:`, `PC2:`,
`PC3:` indica qué terminal está ejecutando el comando.

**Paso 1 — Levantar servidor y crear sala (host)**
```text
PC1: [CYBER-OS] > hostear Diego
>> Servidor local iniciado en puerto 7331.
>> Sala creada. Código: KXMV
>> Lobby abierto. Esperando jugadores...
```

**Paso 2 — Unirse desde otra máquina**
```text
PC2: [CYBER-OS] > unirse KXMV 192.168.1.5 Cristian
>> Conectado a KXMV como "Cristian".

PC3: [CYBER-OS] > unirse KXMV 192.168.1.5 Alumno01
>> Conectado a KXMV como "Alumno01".
```

**Paso 3 — Elegir equipos y marcar listo**
```text
PC1: [CYBER-OS] > equipo red
PC2: [CYBER-OS] > equipo blue
PC3: [CYBER-OS] > equipo blue
PC1: [CYBER-OS] > listo
PC2: [CYBER-OS] > listo
PC3: [CYBER-OS] > listo
```

**Paso 4 — El host inicia la partida**

El host puede usar el botón "Iniciar" del panel lobby (abre con `lobby`)
o desde la terminal si el modo ya tiene todos los jugadores listos.

**Paso 5 — Un cuarto jugador quiere unirse durante la partida**

El jugador PC4 intenta reconectarse con un equipo ya ocupado.
El servidor emite `join-request` al equipo destino (red) y en todos los
clientes del equipo aparece un **toast no bloqueante**:

```
┌─────────────────────────────────────────────┐
│ ℹ  Nuevojugador quiere unirse al equipo 🔴. │
│ [ACEPTAR]  [RECHAZAR]                        │
└─────────────────────────────────────────────┘
```

- Si Diego (PC1) hace clic en **ACEPTAR**, el servidor emite `join-resolved`
  a todos los miembros del equipo red.
- El toast se cierra en **todos** los clientes del equipo automáticamente.
- Un toast de información secundario confirma: "Solicitud aceptada por Diego".

> Este flujo evita interrumpir la partida con modales bloqueantes.
> Detalles del protocolo: [`docs/08-multijugador.md`](08-multijugador.md)
> y [`server/protocol.ts`](../server/protocol.ts).

**Paso 6 — Chat durante la partida**

```text
PC1: [CYBER-OS] > chat Voy a atacar .15, cubrí el .20
```

El mensaje viaja por `LobbyService` → WebSocket → `gameServer.ts` →
broadcast al equipo (scope `team`) o a todos (scope `global`).
El evento `lobby:chat` lo recibe `LobbyView` y lo muestra en el panel de chat.

**Paso 7 — La partida termina**

Al agotar el tiempo o alcanzar el objetivo, el servidor emite `match-ended`.
`MatchHudView` muestra el resultado final, scores y summary. El lobby vuelve
a la fase `lobby` para jugar otra ronda.
