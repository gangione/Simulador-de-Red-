/**
 * Bootstrap de la aplicación.
 *
 * Conecta toda la pila MVC y deja el simulador listo para escuchar comandos:
 *   - Servicios (`EventBus`, `StorageService`, `AIAgentService`)
 *   - Modelos (`NetworkModel`, `MissionModel`, `UserModel`, `FileSystemModel`)
 *   - Vistas (`TerminalView`, `DashboardView`)
 *   - Controladores (`AppController`, `CommandController` + handlers)
 *
 * SOLID — Inversión de Dependencias: únicamente `main.ts` conoce las clases
 *         concretas; el resto del código depende de interfaces.
 */
import './style.css';

import { EventBus, Events } from './services/EventBus';
import { SessionStorageProvider } from './services/StorageService';
import { StubAIAgent, FallbackAIAgent } from './services/AIAgentService';
import { OllamaAIAgent } from './services/OllamaAIAgent';
import { AudioService } from './services/AudioService';
import { LobbyService } from './services/LobbyService';
import { ConfirmService } from './services/ConfirmService';

import { NetworkModel } from './models/NetworkModel';
import { MissionModel } from './models/MissionModel';
import { UserModel } from './models/UserModel';
import { FileSystemModel } from './models/FileSystemModel';

import { TerminalView } from './views/TerminalView';
import { DashboardView } from './views/DashboardView';
import { SettingsView } from './views/SettingsView';
import { LobbyView } from './views/LobbyView';
import { MatchHudView } from './views/MatchHudView';
import { ToastView } from './views/ToastView';

import { CommandController } from './controllers/CommandController';
import { AppController } from './controllers/AppController';

import {
  IpconfigCommand, ArpCommand, PingCommand, NetstatCommand, TracertCommand,
  NbtstatCommand, GetmacCommand, HostnameCommand, RouteCommand, SystemInfoCommand,
  TasklistCommand, TaskkillCommand, NslookupCommand, NmapCommand, CrackCommand,
  NetshCommand, NetCommand, WhoamiCommand, SfcCommand,
} from './controllers/commands/NetworkCommands';
import {
  DirCommand, CdCommand, MkdirCommand, DelCommand, TypeCommand, TreeCommand, EchoCommand,
} from './controllers/commands/FileSystemCommands';
import {
  HelpCommand, ClearCommand, MissionsCommand, StartMissionCommand, AbortMissionCommand,
  FocusMissionCommand, ExitCommand,
  TutorialRedCommand, TutorialDosCommand, TutorialFirewallCommand, TutorialAttackCommand,
  TheoryCommand, SaveCommand,
} from './controllers/commands/HelpCommands';
import {
  VolumeCommand, MuteCommand, PlayCommand, PauseCommand,
} from './controllers/commands/AudioCommands';
import {
  LobbyOpenCommand, JoinCommand, HostCommand, TeamCommand, ReadyCommand, LeaveCommand,
} from './controllers/commands/LobbyCommands';

// Captura global de errores: "[FALLO DEL SISTEMA]".
window.addEventListener('error', (e) => {
  const out = document.getElementById('terminal-output');
  if (out) {
    out.innerHTML += `<br><span style="color:#f6264a; font-weight:bold;">[FALLO DEL SISTEMA] Error interno: ${e.message} en la línea ${e.lineno}.</span><br>`;
  }
});

// Carga inicial de la aplicación una vez que el DOM está listo.
document.addEventListener('DOMContentLoaded', () => {
  // ----- Servicios -----
  const bus = new EventBus();
  const storage = new SessionStorageProvider();
  // Restaura el progreso previamente guardado en `localStorage` hacia
  // `sessionStorage`, para que los modelos lo lean al instanciarse.
  storage.restore();
  // Backend IA real (Ollama local) con fallback al stub si no responde.
  const ai = new FallbackAIAgent(new OllamaAIAgent(), new StubAIAgent());
  // Música de fondo + persistencia (volumen/mute/pista) en localStorage.
  const bgmEl = document.getElementById('bgm') as HTMLAudioElement | null;
  const audio = bgmEl ? new AudioService(bgmEl, storage) : null;
  // Cliente WebSocket multijugador (Fase 3). Lo controlan LobbyView y LobbyCommands.
  const lobby = new LobbyService(bus, storage);
  // Confirmaciones modales reutilizables.
  const confirmDialog = new ConfirmService();

  // ----- Modelos -----
  const network = new NetworkModel(storage);
  const missions = new MissionModel(storage, bus);
  const users = new UserModel(storage, bus);
  const fs = new FileSystemModel();

  // ----- Vistas -----
  const terminal = new TerminalView(bus);
  const dashboard = new DashboardView(bus, missions);
  terminal.init();
  dashboard.init();
  const toast = new ToastView(bus);
  toast.init();
  if (audio) {
    const settings = new SettingsView(bus, audio);
    settings.init();
  }
  const lobbyView = new LobbyView(bus, lobby, users, confirmDialog);
  lobbyView.init();
  const matchHud = new MatchHudView(bus);
  matchHud.init();

  // La terminal necesita saber cuándo empieza/termina la ejecución de un comando
  // para bloquear el input mientras dura.
  bus.on<string>(Events.TaskStatusChanged, (s) =>
    terminal.setBusy(s === 'EJECUTANDO COMANDO...'),
  );

  // Hidratación inicial del dashboard a partir del estado persistido.
  dashboard.hydrate(users.getTutorials(), users.getRank());
  // Si el `restore()` recuperó misiones activas, las re-emite para que el
  // dashboard las pinte de nuevo.
  missions.resumeIfAny();

  // ----- Dispatcher de comandos + puente del CWD -----
  let cwd = 'C:\\Users\\Administrador';
  const commands = new CommandController(bus);
  commands.bindCwd(
    () => cwd,
    (next) => {
      cwd = next;
      bus.emit(Events.PromptChanged, cwd);
    },
  );
  bus.emit(Events.PromptChanged, cwd);

  // Registro de comandos (Open/Closed: para sumar uno nuevo, basta con crear
  // su clase `ICommand` y agregar otra línea aquí; el dispatcher no se toca).
  commands.register(new HelpCommand());
  commands.register(new ClearCommand());
  commands.register(new MissionsCommand(missions));
  commands.register(new StartMissionCommand(missions));
  commands.register(new AbortMissionCommand(missions));
  commands.register(new FocusMissionCommand(missions));
  commands.register(new ExitCommand(missions, lobby, confirmDialog));
  commands.register(new SaveCommand(storage, missions, users));
  commands.register(new TutorialRedCommand());
  commands.register(new TutorialDosCommand());
  commands.register(new TutorialFirewallCommand());
  commands.register(new TutorialAttackCommand());
  commands.register(new TheoryCommand(ai));
  if (audio) {
    commands.register(new VolumeCommand(audio));
    commands.register(new MuteCommand(audio));
    commands.register(new PlayCommand(audio));
    commands.register(new PauseCommand(audio));
  }

  // Comandos del lobby multijugador (atajos de terminal equivalentes a los botones).
  commands.register(new LobbyOpenCommand());
  commands.register(new JoinCommand(lobby));
  commands.register(new HostCommand(lobby));
  commands.register(new TeamCommand(lobby));
  commands.register(new ReadyCommand(lobby));
  commands.register(new LeaveCommand(lobby));

  commands.register(new IpconfigCommand(network));
  commands.register(new ArpCommand(network));
  commands.register(new PingCommand(network));
  commands.register(new NetstatCommand(network));
  commands.register(new TracertCommand(network));
  commands.register(new NbtstatCommand(network));
  commands.register(new GetmacCommand(network));
  commands.register(new HostnameCommand(network));
  commands.register(new RouteCommand(network));
  commands.register(new SystemInfoCommand(network));
  commands.register(new TasklistCommand());
  commands.register(new TaskkillCommand());
  commands.register(new NslookupCommand(network));
  commands.register(new NmapCommand());
  commands.register(new CrackCommand());
  commands.register(new NetshCommand(network));
  commands.register(new NetCommand(network));
  commands.register(new WhoamiCommand());
  commands.register(new SfcCommand());

  commands.register(new DirCommand(fs));
  commands.register(new CdCommand(fs));
  commands.register(new MkdirCommand(fs));
  commands.register(new DelCommand(fs));
  commands.register(new TypeCommand(fs));
  commands.register(new TreeCommand());
  commands.register(new EchoCommand(fs));

  // ----- Orquestador -----
  const app = new AppController(bus, commands, missions, users);
  app.start();

  // Puente Fase 3: si hay partida en curso, reportar la acción al servidor
  // tras cada comando ejecutado por el usuario. Extrae el primer arg como
  // "target" cuando parece IP/host.
  bus.on<string>(Events.CommandSubmitted, (raw) => {
    if (lobby.getStatus() !== 'in-match') return;
    const parts = String(raw).trim().split(/\s+/);
    const cmd = parts[0] ?? '';
    const target = parts.slice(1).find((a) => /^\d{1,3}(\.\d{1,3}){3}$/.test(a) || /^[a-z][\w.-]+$/i.test(a));
    if (cmd) lobby.reportAction(cmd, target);
  });

  // Re-aplica la etiqueta de rango si el progreso vino de una sesión previa.
  users.recomputeRank(missions.getCompletedCount());

  // Bootstrap completo: ocultar el splash inline (definido en index.html) con
  // un fade suave y removerlo del DOM cuando termine la transición.
  const splash = document.getElementById('boot-splash');
  if (splash) {
    // Pequeño delay para que se perciba como transición intencional y no un parpadeo.
    setTimeout(() => {
      splash.classList.add('hide');
      splash.addEventListener('transitionend', () => splash.remove(), { once: true });
    }, 150);
  }
});

// ----- Helpers de los modales (expuestos en `window` para los onclick inline) -----
declare global {
  interface Window {
    exitSimulator: () => void;
    resumeSimulator: () => void;
    restartSimulator: () => void;
    closeSimulator: () => void;
  }
}

window.exitSimulator = () => document.getElementById('edu-modal')?.classList.remove('hidden');
window.resumeSimulator = () => {
  document.getElementById('edu-modal')?.classList.add('hidden');
  document.getElementById('terminal-input')?.focus();
};
window.restartSimulator = () => {
  sessionStorage.clear();
  location.reload();
};
window.closeSimulator = () => window.close();
