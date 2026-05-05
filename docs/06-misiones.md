# 06 · Catálogo de misiones

Datos definidos en
[`src/data/missions.data.ts`](../src/data/missions.data.ts). Cada paso
contiene la `regex` que el `MissionModel.evaluate()` usa para detectar que
el operador escribió el comando esperado.

> Las misiones se ejecutan **solo cuando están enfocadas**. Podés tener
> varias activas y alternarlas con `foco <n>`.

## Defensa (Blue Team)

### D1 · El Servidor Fantasma
> El servidor `.10` cayó. Descubre su nueva IP y restáuralo.

| # | Objetivo | Regex |
|---|----------|-------|
| 1 | `ping 192.168.1.10` | `/^ping 192\.168\.1\.10/i` |
| 2 | `arp -a` | `/^arp -a/i` |
| 3 | `nbtstat -A 192.168.1.15` | `/^nbtstat -A 192\.168\.1\.15/i` |
| 4 | `netsh ... static 192.168.1.10 ...` | `/static 192\.168\.1\.10/i` |
| 5 | `ping 192.168.1.10` | `/^ping 192\.168\.1\.10/i` |

### D2 · El Polizón en la Red
> Hay un dispositivo no autorizado. Búscalo y bloquéalo.

| # | Objetivo | Regex |
|---|----------|-------|
| 1 | `arp -a` | `/^arp -a/i` |
| 2 | `nbtstat -A 192.168.1.106` | `/^nbtstat -A 192\.168\.1\.106/i` |
| 3 | Bloqueo en firewall: `remoteip=192.168.1.106` | `/remoteip=192\.168\.1\.106/i` |

### D3 · Ataque de Fuerza Bruta
> Atacante en puerto 3389. Elimina el proceso y bloquea.

| # | Objetivo | Regex |
|---|----------|-------|
| 1 | `netstat -an` | `/^netstat -an/i` |
| 2 | `tracert 203.0.113.45` | `/^tracert 203\.0\.113\.45/i` |
| 3 | `tasklist` | `/^tasklist/i` |
| 4 | `taskkill /PID 4055 /F` | `/taskkill.*4055/i` |
| 5 | `remoteip=203.0.113.45` | `/remoteip=203\.0\.113\.45/i` |

### D6 · La Falsa Internet
> Redirección maliciosa. Limpia la caché DNS.

| # | Objetivo | Regex |
|---|----------|-------|
| 1 | `ping google.com` | `/^ping google\.com/i` |
| 2 | `nslookup google.com` | `/^nslookup google\.com/i` |
| 3 | `ipconfig /flushdns` | `/^ipconfig\s?\/flushdns/i` |

### D7 · El Infiltrado VIP
> Audita cuentas y borra al administrador intruso.

| # | Objetivo | Regex |
|---|----------|-------|
| 1 | `net user` | `/^net user$/i` |
| 2 | `net localgroup administradores` | `/^net localgroup administradores/i` |
| 3 | `whoami` | `/^whoami/i` |
| 4 | `net user Mantenimiento_Falso /delete` | `/Mantenimiento_Falso \/delete/i` |

### D8 · El Agujero Negro
> Encuentra y borra el archivo gigante en Descargas.

| # | Objetivo | Regex |
|---|----------|-------|
| 1 | `dir` | `/^dir/i` |
| 2 | `cd Descargas` | `/^cd Descargas/i` |
| 3 | `del broma_gigante.txt` | `/^del broma_gigante\.txt/i` |

### D9 · El Escudo Caído
> Levanta el firewall y borra `gusano.bat`.

| # | Objetivo | Regex |
|---|----------|-------|
| 1 | `netsh advfirewall show allprofiles` | `/show allprofiles/i` |
| 2 | `netsh advfirewall set allprofiles state on` | `/state on/i` |
| 3 | `cd Descargas` | `/^cd Descargas/i` |
| 4 | `del gusano.bat` | `/^del gusano\.bat/i` |

### D10 · El Clon en la Red
> Resuelve el conflicto de IP renovando tu dirección.

| # | Objetivo | Regex |
|---|----------|-------|
| 1 | `getmac` | `/^getmac/i` |
| 2 | `arp -a` | `/^arp -a/i` |
| 3 | `ipconfig /release` | `/^ipconfig\s?\/release/i` |
| 4 | `ipconfig /renew` | `/^ipconfig\s?\/renew/i` |

### D11 · La Puerta Trasera
> Cierra el puerto 4444 matando el proceso y bloqueando IP.

| # | Objetivo | Regex |
|---|----------|-------|
| 1 | `netstat -an` | `/^netstat -an/i` |
| 2 | `tasklist` | `/^tasklist/i` |
| 3 | `taskkill /PID 9921 /F` | `/taskkill.*9921/i` |
| 4 | `remoteip=203.0.113.45` | `/remoteip=203\.0\.113\.45/i` |

### D12 · El Laberinto
> Borra `respuestas.txt` en el árbol oculto.

| # | Objetivo | Regex |
|---|----------|-------|
| 1 | `tree` | `/^tree/i` |
| 2 | `cd Oculto` | `/^cd Oculto/i` |
| 3 | `cd Sistema` | `/^cd Sistema/i` |
| 4 | `del respuestas.txt` | `/^del respuestas\.txt/i` |

### D13 · Tráfico Desviado
> Restaura la puerta de enlace original `.1`.

| # | Objetivo | Regex |
|---|----------|-------|
| 1 | `route print` | `/^route print/i` |
| 2 | `tracert 8.8.8.8` | `/^tracert 8\.8\.8\.8/i` |
| 3 | Gateway termina en `.1` | `/192\.168\.1\.1$/i` |
| 4 | `tracert 8.8.8.8` | `/^tracert 8\.8\.8\.8/i` |

### D14 · Bodega Clandestina
> Borra contenido de la red y clausura el recurso.

| # | Objetivo | Regex |
|---|----------|-------|
| 1 | `net share` | `/^net share$/i` |
| 2 | `net use Z: \\servidor\Peliculas` | `/^net use Z:/i` |
| 3 | `Z:` | `/^Z:/i` |
| 4 | `del *.mp4` | `/^del \*\.mp4/i` |
| 5 | `net share Peliculas /delete` | `/Peliculas \/delete/i` |

### D15 · Código Rojo
> Repara los archivos del sistema dañados.

| # | Objetivo | Regex |
|---|----------|-------|
| 1 | `systeminfo` | `/^systeminfo/i` |
| 2 | `sfc /scannow` | `/^sfc \/scannow/i` |

## Ataque (Red Team)

### M101 · Denegación de Servicio (DoS)
> Satura la red del servidor `.15`.

| # | Objetivo | Regex |
|---|----------|-------|
| 1 | `ping 192.168.1.15` | `/^ping 192\.168\.1\.15$/i` |
| 2 | `ping -t -l 65500 192.168.1.15` | `/ping -t -l 65500 192\.168\.1\.15/i` |

### M102 · Escaneo
> Mapea la red completa y puertos del servidor `.15`.

| # | Objetivo | Regex |
|---|----------|-------|
| 1 | `nmap 192.168.1.0/24` | `/nmap 192\.168\.1\.0\/24/i` |
| 2 | `nmap 192.168.1.15` | `/^nmap 192\.168\.1\.15$/i` |

### M103 · Escalada de Privilegios
> Crea un usuario y hazlo Administrador.

| # | Objetivo | Regex |
|---|----------|-------|
| 1 | `net user Mantenimiento_Falso /add` | `/net user Mantenimiento_Falso \/add/i` |
| 2 | `net localgroup administradores Mantenimiento_Falso /add` | `/administradores Mantenimiento_Falso \/add/i` |
| 3 | `net user` | `/^net user$/i` |

### M104 · Fuerza Bruta
> Rompe la contraseña del puerto 3389.

| # | Objetivo | Regex |
|---|----------|-------|
| 1 | `nmap 192.168.1.15` | `/^nmap 192\.168\.1\.15/i` |
| 2 | `crack 192.168.1.15 3389` | `/crack 192\.168\.1\.15 3389/i` |

### M105 · Desarmar Defensas
> Apaga el firewall del sistema objetivo.

| # | Objetivo | Regex |
|---|----------|-------|
| 1 | `netsh advfirewall set allprofiles state off` | `/state off/i` |
| 2 | `netsh advfirewall show allprofiles` | `/show allprofiles/i` |

## Agregar una misión

```ts
// src/data/missions.data.ts
99: {
  id: 99,
  title: 'D99: Mi nueva crisis',
  desc: 'Descripción para el dashboard.',
  steps: [
    { text: '1. Primer objetivo', regex: /^comando exacto/i, done: false },
    { text: '2. Segundo objetivo', regex: /otra-regex/i, done: false },
  ],
},
```

El motor de misiones la recoge automáticamente al arrancar.
