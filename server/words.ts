// Wordlists para generar códigos de partida tipo "red-cobra-42".
// Curadas con temática red/cyber/animales, en español, sin acentos
// para evitar problemas al dictar el código.

export const ADJECTIVES: readonly string[] = [
  'rojo', 'azul', 'negro', 'verde', 'gris',
  'rapido', 'silente', 'oculto', 'tactico', 'cuantico',
  'ciber', 'digital', 'binario', 'critico', 'sigilo',
  'astuto', 'feroz', 'sombrio', 'electrico', 'glaciar',
  'oscuro', 'agudo', 'fugaz', 'audaz', 'voraz',
  'remoto', 'cifrado', 'bloqueado', 'libre', 'fantasma',
  'antiguo', 'frio', 'gamma', 'omega', 'alfa',
  'infrarrojo', 'plasma', 'neon', 'turbo', 'arcano',
];

export const NOUNS: readonly string[] = [
  'cobra', 'lobo', 'aguila', 'pantera', 'halcon',
  'tigre', 'zorro', 'oso', 'puma', 'jaguar',
  'router', 'firewall', 'kernel', 'paquete', 'subred',
  'proxy', 'puerto', 'switch', 'modem', 'shell',
  'rayo', 'cometa', 'meteoro', 'eclipse', 'nebulosa',
  'phantom', 'ninja', 'ronin', 'vortice', 'enigma',
  'cifra', 'glitch', 'token', 'nodo', 'lan',
  'ddos', 'exploit', 'payload', 'sandbox', 'honeypot',
];

/**
 * Genera un código `adjetivo-sustantivo-NN` (NN entre 10 y 99).
 * Espacio combinatorio: 40 * 40 * 90 = 144_000 combinaciones.
 */
export function generateRoomCode(): string {
  const adj  = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)] ?? 'rojo';
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)] ?? 'cobra';
  const num  = 10 + Math.floor(Math.random() * 90);
  return `${adj}-${noun}-${num}`;
}
