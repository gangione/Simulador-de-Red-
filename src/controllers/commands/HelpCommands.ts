import type { ICommand, ICommandContext, ICommandResult } from '../../types';
import type { MissionModel } from '../../models/MissionModel';
import type { UserModel } from '../../models/UserModel';
import type { IAIAgent } from '../../services/AIAgentService';
import type { SessionStorageProvider } from '../../services/StorageService';

/**
 * Comandos de Ayuda, Misiones e IA.
 *
 * Cada clase implementa `ICommand` (patrón Command + Open/Closed):
 * registrándola en `main.ts` queda disponible en la terminal sin tocar el
 * dispatcher.
 */

export class HelpCommand implements ICommand {
  readonly name = 'help';
  execute(): ICommandResult {
    return {
      output: [[
        `[MÓDULOS DE APRENDIZAJE]\ntutorial-red      : Comandos IP, Ping, DNS y Rutas.\ntutorial-dos      : Navegación de Archivos y Carpetas.\ntutorial-firewall : Defensa, Firewall y Procesos (BLUE TEAM).\ntutorial-ataque   : Escaneo y Fuerza Bruta (RED TEAM).\n\n[MISIONES]\nmisiones          : Lista el catálogo de crisis disponibles.\nmision <numero>   : Inicia una misión (puedes tener varias en paralelo).\nfoco <numero>     : Cambia el foco a otra misión activa.\nabortar [numero]  : Cancela la misión enfocada o la indicada (alias: cancelar).\nexit              : Quita el foco de las misiones (sin abortar) y vuelve al home (alias: salir, home).\n\n[PARTIDA]\nsave              : Guarda tu progreso (rango, tutoriales, misiones activas).\ncls               : Limpia la consola conservando el banner inicial (alias: clear).\n\nEscribe '?teoria <concepto>' para consultar al agente IA (Fase 2).`,
        'var(--ui-blue)',
      ]],
    };
  }
}

export class ClearCommand implements ICommand {
  readonly name = 'cls';
  readonly aliases = ['clear'];
  execute(): ICommandResult {
    // Sentinela `__CLEAR__`: AppController lo reconoce y emite TerminalClear,
    // que en TerminalView restaura el HTML inicial (banner + bienvenida).
    return { output: [['__CLEAR__']] };
  }
}

export class MissionsCommand implements ICommand {
  readonly name = 'misiones';
  constructor(private readonly missions: MissionModel) {}
  execute(): ICommandResult {
    const out: Array<readonly [string, string?]> = [];
    out.push([`\n--- CATÁLOGO DE CRISIS (MISIONES) ---`, 'var(--warning)']);

    const completed = this.missions.getCompleted();
    const activeIds = this.missions.getActiveIds();
    const focusedId = this.missions.getFocusedId();

    if (activeIds.length > 0) {
      const list = activeIds.map((id) => `D${id}`).join(', ');
      const focusLabel = focusedId ? `D${focusedId}` : 'ninguna';
      out.push([`Activas: ${list}   (foco actual: ${focusLabel})`, 'var(--ui-blue)']);
    } else {
      out.push([`Sin misiones activas. Inicia una con 'mision <numero>'.`, 'var(--cmd-gray)']);
    }
    out.push(['', 'white']);

    this.missions.list().forEach((m) => {
      const total = m.steps.length;
      const isActive = activeIds.includes(m.id);
      const isFocused = m.id === focusedId;
      let status: string;
      let color: string;
      let glyph: string;
      if (completed.includes(m.id) && !isActive) {
        glyph = '✓';
        status = `${total}/${total} Completada`;
        color = 'var(--matrix-green)';
      } else if (isFocused) {
        const done = m.steps.filter((s) => s.done).length;
        glyph = '●';
        status = `${done}/${total} ENFOCADA`;
        color = 'var(--ui-blue)';
      } else if (isActive) {
        const done = m.steps.filter((s) => s.done).length;
        glyph = '○';
        status = `${done}/${total} Activa (pausada)`;
        color = 'var(--ui-blue)';
      } else {
        glyph = '·';
        status = `0/${total} Pendiente`;
        color = 'var(--cmd-gray)';
      }
      out.push([`${glyph} mision ${m.id} : ${status}  —  ${m.title}`, color]);
    });

    out.push([`\nUsos: 'mision <n>' inicia · 'foco <n>' cambia foco · 'abortar [n]' cancela.`, 'white']);
    return { output: out };
  }
}

export class StartMissionCommand implements ICommand {
  readonly name = 'mision';
  constructor(private readonly missions: MissionModel) {}
  execute(ctx: ICommandContext): ICommandResult {
    const id = parseInt(ctx.args[1] ?? '', 10);
    const result = this.missions.start(id);
    if (!result) {
      return { output: [["Misión no encontrada. Escribe 'misiones' para ver la lista."]] };
    }
    const { mission: m, alreadyActive } = result;
    if (alreadyActive) {
      return {
        output: [
          [`\nLa misión D${m.id} ya estaba activa — foco transferido a ella.`, 'var(--ui-blue)'],
          [`Escribe 'misiones' para ver el estado completo.\n`, 'var(--cmd-gray)'],
        ],
      };
    }

    const activeCount = this.missions.getActiveIds().length;
    const W = 53; // inner content width (chars between ║ and ║)
    const hr = '═'.repeat(W);
    const row = (text: string, color?: string): readonly [string, string?] => {
      const padded = text.length > W ? text.substring(0, W) : text.padEnd(W);
      return color ? [`║${padded}║`, color] : [`║${padded}║`];
    };
    const wrap = (text: string, indent = ''): string[] => {
      const maxW = W - indent.length;
      const words = text.split(' ');
      const lines: string[] = [];
      let cur = '';
      for (const w of words) {
        const next = cur ? `${cur} ${w}` : w;
        if (next.length > maxW) { lines.push(cur); cur = w; }
        else { cur = next; }
      }
      if (cur) lines.push(cur);
      return lines.map((l) => indent + l);
    };

    const out: Array<readonly [string, string?]> = [];
    out.push([`\n╔${hr}╗`, 'var(--ui-blue)']);
    out.push(row(`  ▶  BRIEFING — MISIÓN ${m.id}`, 'var(--ui-blue)'));
    out.push([`╠${hr}╣`, 'var(--ui-blue)']);
    out.push(row(`  ${m.title}`, 'var(--warning)'));
    out.push([`╠${hr}╣`, 'var(--ui-blue)']);
    for (const l of wrap(m.desc, '  ')) {
      out.push(row(l, 'var(--cmd-gray)'));
    }
    out.push([`╠${hr}╣`, 'var(--ui-blue)']);
    out.push(row('  OBJETIVOS:', 'var(--matrix-green)'));
    out.push(row('', 'var(--matrix-green)'));
    m.steps.forEach((step, i) => {
      const prefix = `  ${i + 1}. `;
      const cont   = ' '.repeat(prefix.length);
      const lines  = wrap(step.text, prefix);
      lines.forEach((l, li) =>
        out.push(row(li === 0 ? l : cont + l.trimStart(), 'var(--matrix-green)')),
      );
    });
    out.push([`╠${hr}╣`, 'var(--ui-blue)']);
    out.push(row('  ¿Listo? Escribe el primer comando para comenzar.', 'var(--warning)'));
    out.push(row(`  • 'abortar'       — cancela la misión enfocada.`, 'var(--cmd-gray)'));
    out.push(row(`  • 'foco <n>'      — cambia el foco a otra misión activa.`, 'var(--cmd-gray)'));
    out.push(row(`  • 'save'          — guarda tu progreso actual.`, 'var(--cmd-gray)'));
    out.push(row(`  • 'save confirm'  — sobrescribe una partida guardada.`, 'var(--cmd-gray)'));
    out.push([`╠${hr}╣`, 'var(--ui-blue)']);
    out.push(row(`  Misiones activas: ${activeCount}  —  foco actual: D${m.id}`, 'var(--ui-blue)'));
    out.push([`╚${hr}╝\n`, 'var(--ui-blue)']);

    return { output: out };
  }
}

export class AbortMissionCommand implements ICommand {
  readonly name = 'abortar';
  readonly aliases = ['salir-mision', 'cancelar'];
  constructor(private readonly missions: MissionModel) {}
  execute(ctx: ICommandContext): ICommandResult {
    const arg = ctx.args[1];
    const targetId = arg ? parseInt(arg, 10) : undefined;
    if (arg && (Number.isNaN(targetId) || !this.missions.isActive(targetId!))) {
      return { output: [[`No hay misión activa con id ${arg}. Escribe 'misiones' para ver las activas.`, 'var(--warning)']] };
    }
    const result = this.missions.abort(targetId);
    if (!result) {
      return { output: [["No hay ninguna misión activa para abortar.", 'var(--cmd-gray)']] };
    }
    const { aborted, newFocused } = result;
    const W = 53;
    const hr = '═'.repeat(W);
    const pad = (t: string) => t.length > W ? t.substring(0, W) : t.padEnd(W);
    const followup = newFocused
      ? `  Foco transferido a D${newFocused.id}: ${newFocused.title}`
      : `  Sin misiones activas — volves al modo libre.`;
    return {
      output: [
        [`\n╔${hr}╗`, 'var(--warning)'],
        [`║${pad(`  ⚠  MISIÓN ${aborted.id} ABORTADA`)}║`, 'var(--warning)'],
        [`║${pad(`  Progreso de esta misión descartado.`)}║`, 'var(--cmd-gray)'],
        [`║${pad(followup.substring(0, W))}║`, 'var(--ui-blue)'],
        [`╚${hr}╝\n`, 'var(--warning)'],
      ],
    };
  }
}

export class FocusMissionCommand implements ICommand {
  readonly name = 'foco';
  readonly aliases = ['focus', 'enfocar'];
  constructor(private readonly missions: MissionModel) {}
  execute(ctx: ICommandContext): ICommandResult {
    const id = parseInt(ctx.args[1] ?? '', 10);
    if (Number.isNaN(id)) {
      return { output: [[`Uso: foco <numero>   Ej: foco 2`, 'var(--cmd-gray)']] };
    }
    const m = this.missions.focus(id);
    if (!m) {
      const active = this.missions.getActiveIds();
      const hint = active.length > 0
        ? `Activas: ${active.map((i) => `D${i}`).join(', ')}.`
        : `No hay misiones activas. Inicia una con 'mision <numero>'.`;
      return {
        output: [
          [`La misión ${id} no está activa.`, 'var(--warning)'],
          [hint, 'var(--cmd-gray)'],
        ],
      };
    }
    const done = m.steps.filter((s) => s.done).length;
    return {
      output: [
        [`\n>> Foco transferido a D${m.id}: ${m.title}`, 'var(--ui-blue)'],
        [`   Progreso: ${done}/${m.steps.length} pasos completados.\n`, 'var(--cmd-gray)'],
      ],
    };
  }
}

/**
 * ExitCommand — abandona el modo misión SIN abortar nada: quita el foco de
 * todas las misiones (quedan activas y pausadas, conservando su progreso) y
 * limpia la consola, dejando al operador en la "home" con banner + guía.
 */
export class ExitCommand implements ICommand {
  readonly name = 'exit';
  readonly aliases = ['salir', 'home'];
  constructor(private readonly missions: MissionModel) {}
  execute(): ICommandResult {
    // Quita el foco (no aborta). Las misiones activas siguen activas y pausadas.
    this.missions.unfocus();
    // Sentinel reconocido por AppController → emite TerminalClear,
    // que en TerminalView restaura el HTML inicial (banner + bienvenida).
    return { output: [['__CLEAR__']] };
  }
}

export class TutorialRedCommand implements ICommand {
  readonly name = 'tutorial-red';
  execute(): ICommandResult {
    return {
      output: [[
        `\n--- MÓDULO: REDES (Diagnóstico Básico) ---
1. ipconfig : Muestra tu IP actual.
2. ipconfig /release y /renew : Libera tu IP actual y solicita una nueva al router.
3. ipconfig /flushdns : Limpia la caché de dominios (útil si hay redirecciones falsas).
4. getmac : Muestra la dirección física (MAC) de tu tarjeta de red.
5. arp -a : Muestra las IPs y MACs de todos los equipos en tu red local.
6. ping <ip> : Prueba la conexión con otro equipo midiendo el tiempo de respuesta.
7. tracert <ip> : Muestra el camino salto por salto (routers) hacia un destino.
8. netstat -an : Lista las conexiones activas y puertos abiertos en tu PC.
9. nslookup <dominio> : Consulta al servidor DNS cuál es la IP real de una web.
10. nbtstat -A <ip> : Muestra el nombre (hostname) del equipo dueño de esa IP.
11. route print : Muestra la tabla de rutas y tu puerta de enlace (Gateway).
12. netsh interface ip set address "Ethernet" static <IP> <Masc> <Gateway> : Cambia tu IP y ruta manualmente.
13. systeminfo : Muestra la información general del hardware y SO.

[ACCIÓN]: Prueba 'ipconfig' para completar este tutorial.`,
        'var(--matrix-green)',
      ]],
    };
  }
}

export class TutorialDosCommand implements ICommand {
  readonly name = 'tutorial-dos';
  execute(): ICommandResult {
    return {
      output: [[
        `\n--- MÓDULO: DOS (Sistema de Archivos) ---
1. dir : Lista el contenido y carpetas donde te encuentras ahora.
2. cd <carpeta> : Entra a una carpeta. Escribe 'cd ..' para retroceder.
3. mkdir <nombre> : Crea una carpeta nueva.
4. echo <texto> > <archivo> : Crea un archivo de texto. (Ej: echo Hola > saludo.txt)
5. type <archivo> : Lee el contenido de un archivo de texto en pantalla.
6. del <archivo> : Elimina un archivo permanentemente.
7. tree : Muestra el árbol visual completo de carpetas y subcarpetas.

[ACCIÓN]: Ejecuta 'dir' para ver tus archivos y completar el tutorial.`,
        'var(--matrix-green)',
      ]],
    };
  }
}

export class TutorialFirewallCommand implements ICommand {
  readonly name = 'tutorial-firewall';
  execute(): ICommandResult {
    return {
      output: [[
        `\n--- MÓDULO: BLUE TEAM (Defensa y Administración) ---
1. netsh advfirewall show allprofiles : Muestra si tu Firewall está ON u OFF.
2. netsh advfirewall set allprofiles state on / off : Enciende o apaga el escudo de Windows.
3. netsh advfirewall firewall add rule name="Bloqueo" dir=in action=block remoteip=<IP> : Bloquea permanentemente el acceso de un atacante a tu red.
4. tasklist : Lista todos los procesos y programas corriendo en la memoria RAM.
5. taskkill /PID <numero> /F : Fuerza el cierre de un proceso malicioso.
6. net user : Lista todos los usuarios registrados en tu PC.
7. net user <nombre> /delete : Elimina un usuario del sistema.
8. net localgroup administradores : Muestra qué usuarios tienen control total.
9. whoami : Muestra qué usuario estás utilizando en este momento.
10. net share : Lista qué carpetas estás compartiendo con el resto de la red.
11. net share <nombre> /delete : Deshabilita una carpeta compartida.
12. net use Z: \\\\servidor\\<carpeta> : Conecta una carpeta remota a tu disco Z:.
13. sfc /scannow : Escanea y repara archivos corruptos del sistema operativo.

[ACCIÓN]: Ejecuta 'netsh advfirewall show allprofiles' para completar.`,
        'var(--matrix-green)',
      ]],
    };
  }
}

export class TutorialAttackCommand implements ICommand {
  readonly name = 'tutorial-ataque';
  execute(): ICommandResult {
    return {
      output: [[
        `\n--- MÓDULO: RED TEAM (Ataque y Penetración) ---
1. nmap <ip> o <ip/24> : Escanea una IP para ver sus puertos vulnerables, o escanea toda la red buscando equipos encendidos.
2. ping -t -l 65500 <ip> : Ataque de Denegación de Servicio (DoS). Satura la red del objetivo enviando paquetes gigantes.
3. crack <ip> <puerto> : Herramienta de fuerza bruta. Intenta adivinar contraseñas remotas usando un diccionario.
4. net user <nombre> /add : Comando para inyectar un usuario fantasma en la PC objetivo.
5. net localgroup administradores <nombre> /add : Eleva los permisos del usuario fantasma para robar el control total.

[ACCIÓN]: Escanea la red con 'nmap 192.168.1.0/24' para completar el entrenamiento.`,
        'var(--warning)',
      ]],
    };
  }
}

/**
 * Comando de teoría IA — hook de Fase 2.
 * Hoy devuelve la respuesta del stub. Implementando `IAIAgent` contra un
 * backend real (Ollama/OpenAI) este comando empieza a contestar sin tocar
 * nada más.
 */
export class TheoryCommand implements ICommand {
  readonly name = '?teoria';
  constructor(private readonly agent: IAIAgent) {}
  async execute(ctx: ICommandContext): Promise<ICommandResult> {
    const concept = ctx.args.slice(1).join(' ').trim();
    if (!concept) {
      return { output: [['Uso: ?teoria <concepto>   Ej: ?teoria firewall']] };
    }
    const answer = await this.agent.explain(concept);
    return { output: [[answer, 'var(--ui-blue)']] };
  }
}

/**
 * SaveCommand — captura el progreso en memoria (misiones activas, tutoriales,
 * rango) en `sessionStorage` y luego lo persiste en `localStorage` para que
 * sobreviva al cierre de la app. Pide `save confirm` si ya había un guardado.
 */
export class SaveCommand implements ICommand {
  readonly name = 'save';
  readonly aliases = ['guardar'];
  constructor(
    private readonly storage: SessionStorageProvider,
    private readonly missions: MissionModel,
    private readonly users: UserModel,
  ) {}
  execute(ctx: ICommandContext): ICommandResult {
    // Primero baja el estado en memoria al `sessionStorage`.
    this.missions.snapshot();
    this.users.snapshot();

    const confirm = (ctx.args[1] ?? '').toLowerCase() === 'confirm';
    const hasPrevious = this.storage.hasPersisted();

    if (hasPrevious && !confirm) {
      return {
        output: [
          [`\n⚠  Ya existe una partida guardada.`, 'var(--warning)'],
          [`Si continuas, se sobrescribira con tu progreso actual.`, 'var(--cmd-gray)'],
          [`Escribe 'save confirm' para confirmar.\n`, 'var(--warning)'],
        ],
      };
    }

    const count = this.storage.persist();
    return {
      output: [[
        `\n[✓] Partida guardada (${count} entradas). Tu progreso se restaurará en el próximo inicio.\n`,
        'var(--matrix-green)',
      ]],
    };
  }
}
