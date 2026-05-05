import type { IHost } from '../types';

/**
 * Constructor de topología para el simulador de la EEST N°10.
 *
 * Genera 60 PCs distribuidos en Laboratorio 1 (25), Laboratorio 2 (15) y
 * Laboratorio 3 (20), más 2 nodos de infraestructura crítica (Router y
 * Servidor).
 */
const generarMAC = (): string =>
  'xx-xx-xx-xx-xx-xx'.replace(/x/g, () =>
    ((Math.random() * 16) | 0).toString(16),
  );

export function buildTopology(): IHost[] {
  const hosts: IHost[] = [];

  // Critical infrastructure
  hosts.push({ ip: '192.168.1.1', mac: '00-1a-2b-3c-4d-5e', type: 'estático', name: 'ROUTER-EEST10' });
  hosts.push({ ip: '192.168.1.15', mac: '08-00-27-88-99-aa', type: 'dinámico', name: 'SERVER-SALA' });

  // Lab 1 — 25 PCs (.101–.125)
  for (let i = 1; i <= 25; i++) {
    const ip = `192.168.1.${100 + i}`;
    if (ip === '192.168.1.105') {
      hosts.push({ ip, mac: 'a4-b1-c2-d3-00-00', type: 'dinámico', name: 'CLON-PC' });
    } else if (ip === '192.168.1.106') {
      hosts.push({ ip, mac: 'ff-aa-bb-cc-dd-ee', type: 'dinámico', name: 'Gamer-PC' });
    } else {
      hosts.push({
        ip,
        mac: generarMAC(),
        type: 'dinámico',
        name: `LAB1-PC${i.toString().padStart(2, '0')}`,
      });
    }
  }

  // Lab 2 — 15 PCs (.126–.140)
  for (let i = 1; i <= 15; i++) {
    hosts.push({
      ip: `192.168.1.${125 + i}`,
      mac: generarMAC(),
      type: 'dinámico',
      name: `LAB2-PC${i.toString().padStart(2, '0')}`,
    });
  }

  // Lab 3 — 20 PCs (.141–.160)
  for (let i = 1; i <= 20; i++) {
    hosts.push({
      ip: `192.168.1.${140 + i}`,
      mac: generarMAC(),
      type: 'dinámico',
      name: `LAB3-PC${i.toString().padStart(2, '0')}`,
    });
  }

  return hosts;
}

export const DEFAULT_NETWORK = {
  localIP: '192.168.1.105',
  subnet: '255.255.255.0',
  gateway: '192.168.1.105', // intentionally diverted (Mission 13)
  macLocal: 'A4-B1-C2-D3-E4-F5',
  hostname: 'PC-DOCENTE',
  dnsCacheEnvenenada: true,
};
