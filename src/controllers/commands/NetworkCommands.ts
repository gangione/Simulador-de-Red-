import type { ICommand, ICommandContext, ICommandResult } from '../../types';
import type { NetworkModel } from '../../models/NetworkModel';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Comandos relacionados con la red simulada.
 *
 * Cada clase es un `ICommand` aislado (S de SOLID). Sumar un comando nuevo
 * no toca el dispatcher (O de SOLID): basta con `commands.register(new XxxCommand(...))`
 * en `main.ts`.
 */

export class IpconfigCommand implements ICommand {
  readonly name = 'ipconfig';
  constructor(private readonly net: NetworkModel) {}
  async execute(ctx: ICommandContext): Promise<ICommandResult> {
    const sub = ctx.args[1];
    if (sub === '/flushdns') {
      this.net.flushDns();
      return { output: [['Se vació con éxito la caché de resolución de DNS.']] };
    }
    if (sub === '/release') {
      this.net.setLocalIP('0.0.0.0');
      return { output: [['Dirección IP liberada.']] };
    }
    if (sub === '/renew') {
      this.net.setLocalIP('192.168.1.150');
      return { output: [['Nueva IP asignada: 192.168.1.150']] };
    }
    await sleep(400);
    const s = this.net.getState();
    return {
      output: [
        [
          `\nConfiguración IP de Windows\n\nAdaptador de Ethernet:\n   Dirección IPv4. . . . . . . . . . . . . . : ${s.localIP}\n   Máscara de subred . . . . . . . . . . . . : ${s.subnet}\n   Puerta de enlace predeterminada . . . . . : ${s.gateway}\n`,
        ],
      ],
      tutorialCompleted: 'red',
    };
  }
}

export class ArpCommand implements ICommand {
  readonly name = 'arp';
  constructor(private readonly net: NetworkModel) {}
  async execute(): Promise<ICommandResult> {
    await sleep(600);
    const s = this.net.getState();
    let result = `\nInterfaz: ${s.localIP} --- 0x12\n  Dirección de Internet      Dirección física      Tipo\n`;
    s.hosts.forEach((h) => {
      result += `  ${h.ip.padEnd(25)}  ${h.mac.toLowerCase()}     ${h.type}\n`;
    });
    return { output: [[result]] };
  }
}

export class PingCommand implements ICommand {
  readonly name = 'ping';
  constructor(private readonly net: NetworkModel) {}
  async execute(ctx: ICommandContext): Promise<ICommandResult> {
    if (!ctx.args[1]) return { output: [] };
    const fullArg = ctx.args.slice(1).join(' ');
    const ip = ctx.args[ctx.args.length - 1];
    const isDos = fullArg.includes('-t') && fullArg.includes('-l 65500');
    const lines: Array<readonly [string, string?]> = [];
    if (isDos) {
      lines.push([`\nHaciendo ping a ${ip} con 65500 bytes de datos:`]);
      for (let i = 0; i < 8; i++) {
        await sleep(300);
        lines.push([`Respuesta desde ${ip}: bytes=65500 tiempo=999ms TTL=128`]);
      }
      lines.push([`\n[!] SOBRECARGA DETECTADA. Host ${ip} dejó de responder. Ping finalizado.`, 'var(--warning)']);
    } else {
      const host = this.net.findHost(ip);
      const reachable = !!host || ip === this.net.getState().localIP || ip.includes('google');
      lines.push([`\nHaciendo ping a ${ip} con 32 bytes de datos:`]);
      let rec = 0;
      for (let i = 0; i < 4; i++) {
        await sleep(800);
        if (reachable) {
          lines.push([`Respuesta desde ${ip}: bytes=32 tiempo=${Math.floor(Math.random() * 15 + 2)}ms TTL=128`]);
          rec++;
        } else {
          lines.push([`Tiempo de espera agotado para esta solicitud.`]);
        }
      }
      lines.push([`\nEstadísticas de ping para ${ip}:\n    Paquetes: enviados = 4, recibidos = ${rec}, perdidos = ${4 - rec} (${(4 - rec) * 25}% perdidos)`]);
    }
    return { output: lines };
  }
}

export class NetstatCommand implements ICommand {
  readonly name = 'netstat';
  constructor(private readonly net: NetworkModel) {}
  async execute(): Promise<ICommandResult> {
    await sleep(1000);
    const ip = this.net.getState().localIP;
    return {
      output: [[
        `\nConexiones activas\n\n  Proto  Dirección local        Dirección remota       Estado\n  TCP    ${ip}:135       0.0.0.0:0              LISTENING\n  TCP    ${ip}:4444       0.0.0.0:0              LISTENING\n  TCP    ${ip}:3389       203.0.113.45:51234     ESTABLISHED\n`,
      ]],
    };
  }
}

export class TracertCommand implements ICommand {
  readonly name = 'tracert';
  constructor(private readonly net: NetworkModel) {}
  async execute(ctx: ICommandContext): Promise<ICommandResult> {
    const ip = ctx.args[1];
    if (!ip) return { output: [] };
    const out: Array<readonly [string, string?]> = [[`\nTraza a ${ip} sobre un máximo de 30 saltos:\n`]];
    await sleep(1000);
    const gw = this.net.getState().gateway;
    if (gw === '192.168.1.105' && ip === '8.8.8.8') {
      out.push([`  1     1 ms    <1 ms     1 ms  192.168.1.105 [CLON-PC]\n  2    15 ms    14 ms    15 ms  ${ip}\nTraza completa.`]);
    } else {
      out.push([`  1     1 ms    <1 ms     1 ms  ${gw}\n  2    15 ms    14 ms    15 ms  10.20.30.1\n  3    22 ms    21 ms    22 ms  ${ip}\nTraza completa.`]);
    }
    return { output: out };
  }
}

export class NbtstatCommand implements ICommand {
  readonly name = 'nbtstat';
  constructor(private readonly net: NetworkModel) {}
  async execute(ctx: ICommandContext): Promise<ICommandResult> {
    const ip = ctx.args[2];
    if (!ip) return { output: [] };
    await sleep(600);
    const host = this.net.findHost(ip);
    if (host) {
      return {
        output: [[
          `\nTabla NetBIOS del equipo remoto\n    ${host.name.padEnd(15)}  <00>  Registrado\n    MAC = ${host.mac}\n`,
        ]],
      };
    }
    return { output: [['\nHost no encontrado.']] };
  }
}

export class GetmacCommand implements ICommand {
  readonly name = 'getmac';
  constructor(private readonly net: NetworkModel) {}
  execute(): ICommandResult {
    return {
      output: [[
        `\nDirección física    Transporte Nombre\n=================== ==========================================================\n${this.net.getState().macLocal.toUpperCase()}   \\Device\\Tcpip_{AAAA-BBBB-CCCC-DDDD}`,
      ]],
    };
  }
}

export class HostnameCommand implements ICommand {
  readonly name = 'hostname';
  constructor(private readonly net: NetworkModel) {}
  execute(): ICommandResult {
    return { output: [[this.net.getState().hostname]] };
  }
}

export class RouteCommand implements ICommand {
  readonly name = 'route';
  constructor(private readonly net: NetworkModel) {}
  async execute(ctx: ICommandContext): Promise<ICommandResult> {
    if (ctx.args[1] !== 'print') return { output: [] };
    await sleep(500);
    return {
      output: [[
        `\nDestino de red        Máscara de red   Puerta de enlace\n0.0.0.0               0.0.0.0          ${this.net.getState().gateway}\n`,
      ]],
    };
  }
}

export class SystemInfoCommand implements ICommand {
  readonly name = 'systeminfo';
  constructor(private readonly net: NetworkModel) {}
  async execute(): Promise<ICommandResult> {
    await sleep(600);
    return { output: [[`\nNombre del host: ${this.net.getState().hostname}\nSO: Microsoft Windows 10 Pro\n`]] };
  }
}

export class TasklistCommand implements ICommand {
  readonly name = 'tasklist';
  async execute(): Promise<ICommandResult> {
    await sleep(600);
    return {
      output: [[
        `\nNombre de imagen               PID  Uso de memo\n========================= ======== ===========\nSystem                           4      1,248 KB\nexplorer.exe                  1852     85,412 KB\nbackdoor.exe                  9921     10,500 KB\nremote_spy.exe                4055     15,000 KB\n`,
      ]],
    };
  }
}

export class TaskkillCommand implements ICommand {
  readonly name = 'taskkill';
  execute(): ICommandResult {
    return { output: [['CORRECTO: Se envió la señal de terminación al proceso.']] };
  }
}

export class NslookupCommand implements ICommand {
  readonly name = 'nslookup';
  constructor(private readonly net: NetworkModel) {}
  execute(ctx: ICommandContext): ICommandResult {
    const target = ctx.args[1] ?? '';
    if (this.net.isDnsPoisoned()) {
      return { output: [[`Servidor: dns.google\nNombre: ${target}\nAddress: 192.168.1.111`]] };
    }
    return { output: [[`Servidor: dns.google\nNombre: ${target}\nAddress: 142.250.190.46`]] };
  }
}

export class NmapCommand implements ICommand {
  readonly name = 'nmap';
  async execute(ctx: ICommandContext): Promise<ICommandResult> {
    const target = ctx.args[1];
    if (!target) return { output: [['Uso: nmap <ip>']] };
    const out: Array<readonly [string, string?]> = [];
    out.push([`\nIniciando Nmap 7.92 ( https://nmap.org ) al objetivo...`]);
    await sleep(1500);
    if (target.includes('/24')) {
      out.push([
        `Nmap scan report for 192.168.1.1\nHost is up (0.0010s latency).\nNmap scan report for 192.168.1.15\nHost is up (0.0020s latency).\nNmap scan report for 192.168.1.106\nHost is up (0.0050s latency).\n`,
      ]);
    } else {
      out.push([
        `Nmap scan report for ${target}\nHost is up (0.0020s latency).\nNot shown: 997 closed tcp ports\nPORT     STATE SERVICE\n80/tcp   open  http\n445/tcp  open  microsoft-ds\n3389/tcp open  ms-wbt-server\n`,
      ]);
    }
    out.push([`Nmap done: 1 IP address scanned.`]);
    return { output: out, tutorialCompleted: 'atk' };
  }
}

export class CrackCommand implements ICommand {
  readonly name = 'crack';
  async execute(ctx: ICommandContext): Promise<ICommandResult> {
    const ip = ctx.args[1];
    const port = ctx.args[2];
    if (!ip || !port) return { output: [['Uso: crack <ip> <puerto>']] };
    const out: Array<readonly [string, string?]> = [];
    out.push([`\nIniciando herramienta de fuerza bruta a ${ip} en puerto ${port}...`]);
    await sleep(1000);
    out.push([`Cargando diccionario (rockyou.txt)... [OK]`]);
    for (let i = 0; i < 5; i++) {
      await sleep(400);
      out.push([`[INTENTO] Admin:password${i} -> Denegado`, 'var(--cmd-gray)']);
    }
    await sleep(800);
    out.push([`[+] ¡CONTRASEÑA ENCONTRADA!`, 'var(--matrix-green)']);
    out.push([`[+] IP: ${ip} | PORT: ${port} | LOGIN: Administrador | PASS: P@ssw0rd2026\n`, 'var(--matrix-green)']);
    return { output: out };
  }
}

export class NetshCommand implements ICommand {
  readonly name = 'netsh';
  constructor(private readonly net: NetworkModel) {}
  async execute(ctx: ICommandContext): Promise<ICommandResult> {
    const cmd = ctx.raw;
    if (cmd.includes('show allprofiles')) {
      return {
        output: [[
          `\nPerfil de dominio:\nEstado del firewall:   ${this.net.getFirewall().toUpperCase()}\nPolítica de entrada:   BlockInbound\nPolítica de salida:    AllowOutbound\n`,
        ]],
        tutorialCompleted: 'fw',
      };
    }
    if (cmd.includes('state on')) {
      this.net.setFirewall('on');
      return { output: [['Aceptar.\n']] };
    }
    if (cmd.includes('state off')) {
      this.net.setFirewall('off');
      return {
        output: [
          ['Aceptar.', undefined],
          ['[ADVERTENCIA] Sistema expuesto.', 'var(--warning)'],
        ],
      };
    }
    if (cmd.includes('action=block remoteip')) {
      return { output: [['Aceptar. Regla de bloqueo añadida.\n']] };
    }
    if (cmd.includes('set address')) {
      this.net.setLocalIP('192.168.1.10');
      this.net.setGateway('192.168.1.1');
      return { output: [['Aceptar. La configuración de red se ha actualizado correctamente.\n']] };
    }
    return { output: [['El comando no es válido o está incompleto.']] };
  }
}

export class NetCommand implements ICommand {
  readonly name = 'net';
  constructor(private readonly net: NetworkModel) {}
  execute(ctx: ICommandContext): ICommandResult {
    const args = ctx.args;
    if (args[1] === 'user') {
      if (args[3] === '/add') {
        this.net.addAdmin(args[2]);
        return { output: [['El comando se completó correctamente.']] };
      }
      if (args[3] === '/delete') {
        this.net.removeAdmin(args[2]);
        return { output: [['El comando se completó correctamente.']] };
      }
      const intruder = this.net.getAdmins().includes('Mantenimiento_Falso') ? 'Mantenimiento_Falso' : '';
      return {
        output: [[
          `\nCuentas de usuario de \\\\${this.net.getState().hostname}\n-------------------------------------------------------------------\nAdministrador            Invitado                 ${intruder}\nEl comando se completó correctamente.\n`,
        ]],
      };
    }
    if (args[1] === 'localgroup') {
      if (args[4] === '/add') return { output: [['El comando se completó correctamente.']] };
      return {
        output: [[
          `\nNombre de alias     administradores\nComentario          Acceso completo al equipo.\n\nMiembros\n-------------------------------------------------------------------\n${this.net.getAdmins().join('\n')}\nEl comando se completó correctamente.\n`,
        ]],
      };
    }
    if (args[1] === 'share') {
      if (args[3] === '/delete') {
        this.net.removeShare('Peliculas');
        return { output: [['Peliculas se eliminó correctamente.']] };
      }
      const shared = this.net.getSharedFolders().Peliculas
        ? 'Peliculas            C:\\Users\\Public\\Videos'
        : '';
      return {
        output: [[
          `\nRecurso compartido   Recurso\n----------------------------------------\nC$                   C:\\\n${shared}\n`,
        ]],
      };
    }
    if (args[1] === 'use') return { output: [['El comando se completó correctamente.']] };
    return { output: [] };
  }
}

export class WhoamiCommand implements ICommand {
  readonly name = 'whoami';
  execute(): ICommandResult {
    return { output: [['redescolar\\Administrador']] };
  }
}

export class SfcCommand implements ICommand {
  readonly name = 'sfc';
  async execute(): Promise<ICommandResult> {
    await sleep(1500);
    return { output: [['Protección de recursos de Windows encontró archivos dañados y los reparó correctamente.']] };
  }
}
