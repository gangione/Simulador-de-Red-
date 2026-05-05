/**
 * Información pedagógica de cada modo de juego del lobby. Se muestra durante
 * la fase de configuración de la sala para que todos los jugadores entiendan
 * el objetivo antes de que el host inicie la partida.
 */
export type ModeId = 'red-vs-blue' | 'capture' | 'coop' | 'ffa';

export interface ModeInfo {
  title: string;
  summary: string;
  howToWin: string;
  tips: string[];
}

export const MODE_INFO: Record<ModeId, ModeInfo> = {
  'red-vs-blue': {
    title: 'Red vs Blue (asimétrico)',
    summary:
      'Equipos enfrentados con roles distintos: Red Team ataca y captura servidores, Blue Team los defiende y mantiene los servicios online.',
    howToWin:
      'Red gana sumando capturas (3 pts c/u). Blue gana defendiendo: 1 pt cada 30s por servidor sano. Al timeout, mayor puntaje gana.',
    tips: [
      'Red: usá nmap para mapear, crack para forzar credenciales y netsh para abrir brechas.',
      'Blue: monitoreá con netstat y tasklist; cerrá puertos con netsh advfirewall y matá procesos sospechosos.',
      'Coordinen por chat: una captura mal cubierta deja al equipo sin tiempo de reacción.',
    ],
  },
  'capture': {
    title: 'Capture the Server (simétrico)',
    summary:
      'Ambos equipos pueden atacar y defender los mismos servidores neutrales. Reglas idénticas para los dos bandos.',
    howToWin:
      'Cada captura otorga 2 pts al equipo. Al timeout, gana quien controle más servidores; empate si la suma es igual.',
    tips: [
      'Las capturas son simétricas: si tu equipo lo perdió, podés re-tomarlo.',
      'Defender un servidor recién capturado es tan importante como tomarlo.',
      'Vigilá el chat de captures (lobby:server-captured) para reaccionar a tiempo.',
    ],
  },
  'coop': {
    title: 'Co-op Defensa (oleadas)',
    summary:
      'Todos los jugadores forman un único equipo defensivo contra oleadas de bots scripteados que intentan hacer caer los servidores cada 60s.',
    howToWin:
      'El equipo gana si al menos un servidor sobrevive al final del tiempo. Métricas: defensas exitosas vs caídas.',
    tips: [
      'Repartan los servidores entre los jugadores; nadie debe quedar sin asignación.',
      'Las oleadas escalan en intensidad — anticipen reforzando firewall antes del minuto.',
      'Compartan IPs de servidores comprometidos por chat para priorizar la respuesta.',
    ],
  },
  'ffa': {
    title: 'Free-for-All',
    summary:
      'Cada jugador defiende su propio servidor y puede atacar a los de los demás. Si tu servidor cae, te volvés espectador.',
    howToWin:
      'Score = capturas + tiempo defendido. El último con servidor en pie gana. Si caen todos, gana el de mayor score.',
    tips: [
      'Equilibrio entre defensa y agresión: un puro defensor se queda sin pts ofensivos.',
      'No todos los rivales son iguales — apuntá al jugador con más capturas para frenarlo.',
      'Una vez eliminado, podés mirar la partida en modo espectador en el dashboard.',
    ],
  },
};
