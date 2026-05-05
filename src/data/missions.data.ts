import type { IMission } from '../types';

/**
 * Catálogo de misiones migrado desde el `script.js` legacy.
 *
 * Cada llamada a `buildMissions()` devuelve objetos nuevos (con `done: false`
 * en cada paso) para que las misiones se puedan reiniciar y volver a jugar
 * sin arrastrar progreso anterior.
 */
export function buildMissions(): Record<number, IMission> {
  const m: Record<number, IMission> = {
    1: {
      id: 1,
      title: 'D1: El Servidor Fantasma',
      desc: 'El servidor .10 cayó. Descubre su nueva IP y restáuralo.',
      steps: [
        { text: '1. Confirma caída: ping 192.168.1.10', regex: /^ping 192\.168\.1\.10/i, done: false },
        { text: '2. Mapea la red: arp -a', regex: /^arp -a/i, done: false },
        { text: '3. Identifica la IP .15: nbtstat -A 192.168.1.15', regex: /^nbtstat -A 192\.168\.1\.15/i, done: false },
        { text: '4. Restaura IP (netsh interface ip set address...)', regex: /static 192\.168\.1\.10/i, done: false },
        { text: '5. Verifica conexión: ping 192.168.1.10', regex: /^ping 192\.168\.1\.10/i, done: false },
      ],
    },
    2: {
      id: 2,
      title: 'D2: El Polizón en la Red',
      desc: 'Hay un dispositivo no autorizado. Búscalo y bloquéalo.',
      steps: [
        { text: '1. Revisa conectados: arp -a', regex: /^arp -a/i, done: false },
        { text: '2. Identifica al intruso .106: nbtstat -A 192.168.1.106', regex: /^nbtstat -A 192\.168\.1\.106/i, done: false },
        { text: '3. Bloquea IP en Firewall', regex: /remoteip=192\.168\.1\.106/i, done: false },
      ],
    },
    3: {
      id: 3,
      title: 'D3: Ataque de Fuerza Bruta',
      desc: 'Atacante en puerto 3389. Elimina el proceso y bloquea.',
      steps: [
        { text: '1. Detectar conexión: netstat -an', regex: /^netstat -an/i, done: false },
        { text: '2. Trazar ruta: tracert 203.0.113.45', regex: /^tracert 203\.0\.113\.45/i, done: false },
        { text: '3. Buscar proceso: tasklist', regex: /^tasklist/i, done: false },
        { text: '4. Matar malware: taskkill /PID 4055 /F', regex: /taskkill.*4055/i, done: false },
        { text: '5. Bloquear IP en Firewall', regex: /remoteip=203\.0\.113\.45/i, done: false },
      ],
    },
    6: {
      id: 6,
      title: 'D6: La Falsa Internet',
      desc: 'Redirección maliciosa. Limpia la caché DNS.',
      steps: [
        { text: '1. Comprobar ping: ping google.com', regex: /^ping google\.com/i, done: false },
        { text: '2. Investigar DNS: nslookup google.com', regex: /^nslookup google\.com/i, done: false },
        { text: '3. Limpiar DNS: ipconfig /flushdns', regex: /^ipconfig\s?\/flushdns/i, done: false },
      ],
    },
    7: {
      id: 7,
      title: 'D7: El Infiltrado VIP',
      desc: 'Audita cuentas y borra al administrador intruso.',
      steps: [
        { text: '1. Listar usuarios: net user', regex: /^net user$/i, done: false },
        { text: '2. Ver administradores: net localgroup administradores', regex: /^net localgroup administradores/i, done: false },
        { text: '3. Identidad actual: whoami', regex: /^whoami/i, done: false },
        { text: '4. Borrar intruso: net user Mantenimiento_Falso /delete', regex: /Mantenimiento_Falso \/delete/i, done: false },
      ],
    },
    8: {
      id: 8,
      title: 'D8: El Agujero Negro',
      desc: 'Encuentra y borra el archivo gigante en Descargas.',
      steps: [
        { text: '1. Explorar: dir', regex: /^dir/i, done: false },
        { text: '2. Entrar a Descargas: cd Descargas', regex: /^cd Descargas/i, done: false },
        { text: '3. Eliminar broma: del broma_gigante.txt', regex: /^del broma_gigante\.txt/i, done: false },
      ],
    },
    9: {
      id: 9,
      title: 'D9: El Escudo Caído',
      desc: 'Levanta el firewall y borra "gusano.bat".',
      steps: [
        { text: '1. Ver estado Firewall: netsh advfirewall show allprofiles', regex: /show allprofiles/i, done: false },
        { text: '2. Encender: netsh advfirewall set allprofiles state on', regex: /state on/i, done: false },
        { text: '3. Entrar a Descargas: cd Descargas', regex: /^cd Descargas/i, done: false },
        { text: '4. Eliminar gusano: del gusano.bat', regex: /^del gusano\.bat/i, done: false },
      ],
    },
    10: {
      id: 10,
      title: 'D10: El Clon en la Red',
      desc: 'Resuelve el conflicto de IP renovando tu dirección.',
      steps: [
        { text: '1. Ver tu MAC: getmac', regex: /^getmac/i, done: false },
        { text: '2. Ver IPs duplicadas: arp -a', regex: /^arp -a/i, done: false },
        { text: '3. Liberar IP: ipconfig /release', regex: /^ipconfig\s?\/release/i, done: false },
        { text: '4. Renovar IP: ipconfig /renew', regex: /^ipconfig\s?\/renew/i, done: false },
      ],
    },
    11: {
      id: 11,
      title: 'D11: La Puerta Trasera',
      desc: 'Cierra el puerto 4444 matando el proceso y bloqueando IP.',
      steps: [
        { text: '1. Escanear puertos: netstat -an', regex: /^netstat -an/i, done: false },
        { text: '2. Listar procesos: tasklist', regex: /^tasklist/i, done: false },
        { text: '3. Matar proceso: taskkill /PID 9921 /F', regex: /taskkill.*9921/i, done: false },
        { text: '4. Bloquear atacante en Firewall', regex: /remoteip=203\.0\.113\.45/i, done: false },
      ],
    },
    12: {
      id: 12,
      title: 'D12: El Laberinto',
      desc: 'Borra respuestas.txt en el árbol oculto.',
      steps: [
        { text: '1. Mapear árbol: tree', regex: /^tree/i, done: false },
        { text: '2. Navegar: cd Oculto', regex: /^cd Oculto/i, done: false },
        { text: '3. Navegar: cd Sistema', regex: /^cd Sistema/i, done: false },
        { text: '4. Borrar archivo: del respuestas.txt', regex: /^del respuestas\.txt/i, done: false },
      ],
    },
    13: {
      id: 13,
      title: 'D13: Tráfico Desviado',
      desc: 'Restaura la puerta de enlace original .1',
      steps: [
        { text: '1. Ver tabla de rutas: route print', regex: /^route print/i, done: false },
        { text: '2. Prueba de desvío: tracert 8.8.8.8', regex: /^tracert 8\.8\.8\.8/i, done: false },
        { text: '3. Restaurar IP y Gateway a .1', regex: /192\.168\.1\.1$/i, done: false },
        { text: '4. Verificación: tracert 8.8.8.8', regex: /^tracert 8\.8\.8\.8/i, done: false },
      ],
    },
    14: {
      id: 14,
      title: 'D14: Bodega Clandestina',
      desc: 'Bórrala contenido de la red y clausura el recurso.',
      steps: [
        { text: '1. Ver compartidos: net share', regex: /^net share$/i, done: false },
        { text: '2. Montar unidad: net use Z: \\\\servidor\\Peliculas', regex: /^net use Z:/i, done: false },
        { text: '3. Entrar a Z:', regex: /^Z:/i, done: false },
        { text: '4. Borrar videos: del *.mp4', regex: /^del \*\.mp4/i, done: false },
        { text: '5. Eliminar recurso: net share Peliculas /delete', regex: /Peliculas \/delete/i, done: false },
      ],
    },
    15: {
      id: 15,
      title: 'D15: Código Rojo',
      desc: 'Repara los archivos del sistema dañados.',
      steps: [
        { text: '1. Revisar estado: systeminfo', regex: /^systeminfo/i, done: false },
        { text: '2. Reparar Windows: sfc /scannow', regex: /^sfc \/scannow/i, done: false },
      ],
    },
    101: {
      id: 101,
      title: 'M101 (Red): Denegación de Servicio (DoS)',
      desc: 'Satura la red del servidor .15.',
      steps: [
        { text: '1. Reconocimiento: ping 192.168.1.15', regex: /^ping 192\.168\.1\.15$/i, done: false },
        { text: '2. Ping de la Muerte: ping -t -l 65500 192.168.1.15', regex: /ping -t -l 65500 192\.168\.1\.15/i, done: false },
      ],
    },
    102: {
      id: 102,
      title: 'M102 (Red): Escaneo',
      desc: 'Mapea la red completa y puertos del servidor .15.',
      steps: [
        { text: '1. Descubrimiento: nmap 192.168.1.0/24', regex: /nmap 192\.168\.1\.0\/24/i, done: false },
        { text: '2. Escaneo de puertos: nmap 192.168.1.15', regex: /^nmap 192\.168\.1\.15$/i, done: false },
      ],
    },
    103: {
      id: 103,
      title: 'M103 (Red): Escalada de Privilegios',
      desc: 'Crea un usuario y hazlo Administrador.',
      steps: [
        { text: '1. Crear usuario: net user Mantenimiento_Falso /add', regex: /net user Mantenimiento_Falso \/add/i, done: false },
        { text: '2. Elevar a Admin: net localgroup administradores Mantenimiento_Falso /add', regex: /administradores Mantenimiento_Falso \/add/i, done: false },
        { text: '3. Verificar: net user', regex: /^net user$/i, done: false },
      ],
    },
    104: {
      id: 104,
      title: 'M104 (Red): Fuerza Bruta',
      desc: 'Rompe la contraseña del puerto 3389.',
      steps: [
        { text: '1. Verificar puertos: nmap 192.168.1.15', regex: /^nmap 192\.168\.1\.15/i, done: false },
        { text: '2. Lanzar ataque: crack 192.168.1.15 3389', regex: /crack 192\.168\.1\.15 3389/i, done: false },
      ],
    },
    105: {
      id: 105,
      title: 'M105 (Red): Desarmar Defensas',
      desc: 'Apaga el firewall del sistema objetivo.',
      steps: [
        { text: '1. Apagar Firewall: netsh advfirewall set allprofiles state off', regex: /state off/i, done: false },
        { text: '2. Confirmar: netsh advfirewall show allprofiles', regex: /show allprofiles/i, done: false },
      ],
    },
  };
  return m;
}
