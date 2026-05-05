/**
 * Tipos del dominio de red.
 *
 * SOLID — Responsabilidad única: cada interfaz modela un único concepto del
 *         dominio (host, estado de red, regla de firewall).
 */

/** Cómo se asigna la IP de un host. */
export type HostKind = 'estático' | 'dinámico';

/** Un equipo virtual de la red simulada. */
export interface IHost {
  readonly ip: string;
  readonly mac: string;
  readonly type: HostKind;
  readonly name: string;
}

/** Estado del firewall local. */
export type FirewallState = 'on' | 'off';

/**
 * Estado completo de la red propia (mutable porque comandos como `ipconfig
 * /renew` o `netsh set address` modifican IP y gateway).
 */
export interface INetworkState {
  localIP: string;
  subnet: string;
  gateway: string;
  macLocal: string;
  hostname: string;
  /** Bandera del escenario "DNS envenenado" (misión D6 La Falsa Internet). */
  dnsCacheEnvenenada: boolean;
  hosts: IHost[];
}

/** Regla de firewall añadida con `netsh advfirewall firewall add rule …`. */
export interface IFirewallRule {
  readonly remoteIp: string;
  readonly action: 'block' | 'allow';
}
