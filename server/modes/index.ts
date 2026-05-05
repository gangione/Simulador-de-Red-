/**
 * Modos de partida — dispatcher.
 * Cada modo cumple `ModeEngine` (ver server/protocol.ts).
 */
import type { ModeEngine, Mode, RoomOpts, PlayerLike } from '../protocol.js';
import { RedVsBlueMode } from './redVsBlue.js';
import { CaptureMode }   from './capture.js';
import { CoopMode }      from './coop.js';
import { FfaMode }       from './ffa.js';

export function createMode(name: Mode, opts: RoomOpts, players: PlayerLike[]): ModeEngine {
  switch (name) {
    case 'capture': return new CaptureMode(opts, players);
    case 'coop':    return new CoopMode(opts, players);
    case 'ffa':     return new FfaMode(opts, players);
    case 'red-vs-blue':
    default:        return new RedVsBlueMode(opts, players);
  }
}

// Pool de IPs de servidores válidos. Excluye router (.1) y nodos críticos
// usados por las misiones single-player (.10, .15, .105).
const SERVER_POOL: readonly string[] = [
  '192.168.1.20', '192.168.1.30', '192.168.1.40', '192.168.1.50',
  '192.168.1.60', '192.168.1.70', '192.168.1.80', '192.168.1.90',
  '192.168.1.100', '192.168.1.120', '192.168.1.130', '192.168.1.150',
];

export function pickServers(n: number): string[] {
  const pool = [...SERVER_POOL];
  const out: string[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    const [picked] = pool.splice(idx, 1);
    if (picked) out.push(picked);
  }
  return out;
}
