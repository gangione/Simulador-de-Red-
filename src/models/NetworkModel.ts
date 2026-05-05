import type { IHost, INetworkState, FirewallState } from '../types';
import type { IStorageProvider } from '../services/StorageService';
import { buildTopology, DEFAULT_NETWORK } from '../data/network.data';

/**
 * NetworkModel — única fuente de verdad del estado de red simulado.
 *
 * SOLID — Responsabilidad única: estado de red (IP, gateway, firewall, DNS,
 *         hosts) y nada más. No toca el DOM ni parsea comandos. La
 *         persistencia se delega en `IStorageProvider`.
 */
export class NetworkModel {
  private state: INetworkState;
  private firewall: FirewallState;
  private localGroupAdmins: string[];
  private sharedFolders: Record<string, boolean>;

  constructor(private readonly storage: IStorageProvider) {
    this.firewall = storage.get<FirewallState>('fwState', 'on');
    const ip = storage.get<string>('savedIP', DEFAULT_NETWORK.localIP);
    const gw = storage.get<string>('savedGateway', DEFAULT_NETWORK.gateway);
    this.state = {
      ...DEFAULT_NETWORK,
      localIP: ip,
      gateway: gw,
      hosts: buildTopology(),
    };
    this.localGroupAdmins = ['Administrador'];
    this.sharedFolders = { Peliculas: true };
  }

  // ------- API de lectura -------
  /** Estado completo (IP local, gateway, hosts, etc.) en modo sólo lectura. */
  getState(): Readonly<INetworkState> {
    return this.state;
  }
  /** Lista inmutable de los 60 hosts virtuales de la red. */
  getHosts(): ReadonlyArray<IHost> {
    return this.state.hosts;
  }
  /** Devuelve el host con esa IP, o `undefined` si no existe. */
  findHost(ip: string): IHost | undefined {
    return this.state.hosts.find((h) => h.ip === ip);
  }
  /** Estado actual del firewall (`'on' | 'off'`). */
  getFirewall(): FirewallState {
    return this.firewall;
  }
  /** Lista de usuarios miembros del grupo Administradores. */
  getAdmins(): ReadonlyArray<string> {
    return this.localGroupAdmins;
  }
  /** Mapa de carpetas compartidas con su flag de habilitado. */
  getSharedFolders(): Readonly<Record<string, boolean>> {
    return this.sharedFolders;
  }
  /** True si el escenario "DNS envenenado" está activo. */
  isDnsPoisoned(): boolean {
    return this.state.dnsCacheEnvenenada;
  }

  // ------- Mutaciones (deliberadamente acotadas) -------
  /** Cambia el estado del firewall y lo persiste. */
  setFirewall(s: FirewallState): void {
    this.firewall = s;
    this.storage.set('fwState', s);
  }

  /** Cambia la IP local (ej. tras `ipconfig /renew` o `netsh set address`). */
  setLocalIP(ip: string): void {
    this.state.localIP = ip;
    this.storage.set('savedIP', ip);
  }

  /** Cambia la puerta de enlace y la persiste. */
  setGateway(gw: string): void {
    this.state.gateway = gw;
    this.storage.set('savedGateway', gw);
  }

  /** Limpia el envenenamiento de DNS (resolución vuelve a ser real). */
  flushDns(): void {
    this.state.dnsCacheEnvenenada = false;
  }

  /** Agrega un usuario al grupo Administradores (no duplica). */
  addAdmin(user: string): void {
    if (!this.localGroupAdmins.includes(user)) this.localGroupAdmins.push(user);
  }

  /** Borra un usuario del grupo Administradores. */
  removeAdmin(user: string): void {
    this.localGroupAdmins = this.localGroupAdmins.filter((u) => u !== user);
  }

  /** Marca una carpeta compartida como deshabilitada. */
  removeShare(name: string): void {
    this.sharedFolders[name] = false;
  }
}
