/**
 * tips.data.ts — Glosario rápido / "Tip del día" rotativo del panel home.
 *
 * Cada entrada es independiente (no hay relación con misiones). El widget home
 * elige una al azar por sesión. Mantén las descripciones cortas (≤2 líneas).
 */

export interface ITip {
  readonly concepto: string;
  readonly comando: string;
  readonly ejemplo: string;
  readonly descripcion: string;
}

export const TIPS: ReadonlyArray<ITip> = [
  {
    concepto: 'ARP',
    comando: 'arp -a',
    ejemplo: 'arp -a',
    descripcion: 'Mapea IPs a direcciones MAC en tu red local.',
  },
  {
    concepto: 'ICMP / Ping',
    comando: 'ping',
    ejemplo: 'ping 192.168.1.1',
    descripcion: 'Comprueba si un host responde y mide la latencia.',
  },
  {
    concepto: 'DNS',
    comando: 'nslookup',
    ejemplo: 'nslookup google.com',
    descripcion: 'Resuelve un nombre de dominio a su IP real.',
  },
  {
    concepto: 'Firewall',
    comando: 'netsh advfirewall',
    ejemplo: 'netsh advfirewall show allprofiles',
    descripcion: 'Tu primera línea de defensa: filtra tráfico entrante y saliente.',
  },
  {
    concepto: 'Netstat',
    comando: 'netstat -an',
    ejemplo: 'netstat -an',
    descripcion: 'Lista conexiones activas y puertos en escucha.',
  },
  {
    concepto: 'Tracert',
    comando: 'tracert',
    ejemplo: 'tracert 8.8.8.8',
    descripcion: 'Muestra cada salto (router) hacia un destino.',
  },
  {
    concepto: 'MAC Spoofing',
    comando: 'getmac',
    ejemplo: 'getmac',
    descripcion: 'Atacantes pueden falsificar su MAC. Audita siempre con arp -a.',
  },
  {
    concepto: 'DoS',
    comando: 'ping -t -l',
    ejemplo: 'ping -t -l 65500 <ip>',
    descripcion: 'Denegación de servicio: saturar para inutilizar un host.',
  },
  {
    concepto: 'Fuerza bruta',
    comando: 'crack',
    ejemplo: 'crack 192.168.1.50 22',
    descripcion: 'Prueba miles de contraseñas. Mitigación: límites de intento.',
  },
  {
    concepto: 'DHCP',
    comando: 'ipconfig /renew',
    ejemplo: 'ipconfig /renew',
    descripcion: 'Pide una IP nueva al servidor DHCP de la red.',
  },
  {
    concepto: 'NAT',
    comando: 'ipconfig',
    ejemplo: 'ipconfig',
    descripcion: 'Traducción de direcciones: tu IP privada vs la pública del router.',
  },
  {
    concepto: 'Tasklist',
    comando: 'tasklist',
    ejemplo: 'tasklist',
    descripcion: 'Procesos en RAM. Si ves uno raro, taskkill /PID <n> /F.',
  },
  {
    concepto: 'Privilegios',
    comando: 'whoami',
    ejemplo: 'whoami',
    descripcion: 'Confirma con qué usuario corres antes de ejecutar comandos críticos.',
  },
  {
    concepto: 'Recursos compartidos',
    comando: 'net share',
    ejemplo: 'net share',
    descripcion: 'Lista carpetas compartidas. Cierra las que no uses.',
  },
  {
    concepto: 'Escaneo de red',
    comando: 'nmap',
    ejemplo: 'nmap 192.168.1.0/24',
    descripcion: 'Descubre hosts vivos y puertos abiertos en una subred.',
  },
];

/** Devuelve un tip pseudo-aleatorio de la lista. */
export function pickRandomTip(): ITip {
  return TIPS[Math.floor(Math.random() * TIPS.length)];
}
