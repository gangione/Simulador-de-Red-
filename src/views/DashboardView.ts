import { BaseView } from './BaseView';
import { Events, type IEventBus } from '../services/EventBus';
import type { IMission, TutorialKey } from '../types';
import type { MissionModel } from '../models/MissionModel';
import { pickRandomTip } from '../data/tips.data';

type TabKey = 'misiones' | 'foco' | 'aprendizaje';
type GaugeId = 'cpu' | 'ram' | 'red';

/**
 * DashboardView — renderiza TODO el panel derecho:
 *   - Estado de tarea / rango / temporizador.
 *   - Gauges del sistema local (CPU/RAM/LAN) con auto-randomizado en idle.
 *   - Widget de misión con tres pestañas internas:
 *       • `misiones`: lista de misiones activas + completadas con badges.
 *       • `foco`: misión actualmente enfocada (título, descripción, pasos).
 *       • `aprendizaje`: ruta de tutoriales + tip del día.
 *
 * El cambio de pestaña es automático ante eventos relevantes (`MissionFocused`
 * → `foco`; sentinela sin-foco → `aprendizaje`), salvo que el usuario haya
 * elegido una pestaña manualmente: en ese caso `userPinned=true` respeta su
 * elección hasta el próximo `MissionCompleted`.
 */
export class DashboardView extends BaseView {
  private missionList!: HTMLElement;
  private missionTitle!: HTMLElement;
  private missionDesc!: HTMLElement;
  private missionMeta!: HTMLElement;
  private tutorialRoute!: HTMLElement;
  private tipCard!: HTMLElement;
  private userRank!: HTMLElement;
  private activeTime!: HTMLElement;
  private miniProgress!: HTMLElement;
  private miniPercent!: HTMLElement;
  /** Mapa pane-key → contenedor DOM. */
  private panes!: Record<TabKey, HTMLElement>;
  /** Botones de la barra de tabs. */
  private tabBtns!: NodeListOf<HTMLButtonElement>;
  /** Lista de misiones (pane `misiones`). */
  private missionsList!: HTMLElement;
  /** Meta del pane `misiones` ("Activas: N · Completadas: M"). */
  private missionsMeta!: HTMLElement;
  /** Tab actualmente visible. */
  private currentTab: TabKey = 'aprendizaje';
  /** True si el usuario eligió manualmente: bloquea auto-switch. */
  private userPinned = false;
  /** True mientras hay un comando ejecutándose: pausa el sorteo idle de gauges. */
  private gaugesBusy = false;
  private secondsActive = 0;
  private focusedId = 0;

  private tutorialState: Record<TutorialKey, boolean> = {
    red: false, dos: false, fw: false, atk: false,
  };

  constructor(bus: IEventBus, private readonly missions: MissionModel) {
    super(bus);
  }

  init(): void {
    this.missionList = this.el('mission-list-ui')!;
    this.missionTitle = this.el('mission-title')!;
    this.missionDesc = this.el('mission-desc')!;
    this.missionMeta = this.el('mission-active-meta')!;
    this.tutorialRoute = this.el('tutorial-route')!;
    this.tipCard = this.el('tip-card')!;
    this.userRank = this.el('user-rank')!;
    this.activeTime = this.el('active-time')!;
    this.miniProgress = this.el('mini-progress')!;
    this.miniPercent = this.el('mini-percent')!;
    this.missionsList = this.el('missions-list')!;
    this.missionsMeta = this.el('missions-meta')!;
    this.panes = {
      misiones: this.el('dash-pane-misiones')!,
      foco: this.el('dash-pane-foco')!,
      aprendizaje: this.el('dash-pane-aprendizaje')!,
    };
    this.tabBtns = document.querySelectorAll<HTMLButtonElement>('.dash-tab');
    this.tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab as TabKey | undefined;
        if (!tab) return;
        this.userPinned = true;
        this.switchTab(tab);
      });
    });

    this.bus.on<IMission>(Events.MissionStarted, () => {
      this.renderMissionsList();
      if (!this.userPinned) this.switchTab('foco');
    });
    this.bus.on<IMission>(Events.MissionFocused, (m) => {
      this.focusedId = m.id;
      this.renderMission(m);
      this.renderMissionsList();
      if (!this.userPinned) this.switchTab('foco');
    });
    this.bus.on<{ mission: IMission; stepIndex: number }>(Events.MissionStepDone, ({ mission, stepIndex }) => {
      // Actualiza el item del paso sólo si pertenece a la misión enfocada
      // (los demás pasos no se renderean en el pane `foco`).
      if (mission.id === this.focusedId) {
        const li = document.getElementById(`step_${stepIndex}`);
        if (li) {
          li.classList.add('done');
          const status = li.querySelector('.m-status');
          if (status) (status as HTMLElement).innerText = '[HECHO]';
        }
      }
      // El conteo done/total cambia para esa misión: refresca la lista.
      this.renderMissionsList();
    });
    this.bus.on<IMission>(Events.MissionAborted, () => {
      this.renderMissionsList();
    });
    this.bus.on<IMission>(Events.MissionCompleted, () => {
      // Punto natural para liberar el pin del usuario y dejar que el auto-switch
      // siguiente lo lleve al próximo contexto.
      this.userPinned = false;
      this.renderMissionsList();
    });
    this.bus.on<TutorialKey>(Events.TutorialCompleted, (t) => {
      this.tutorialState[t] = true;
      // Refresca la ruta sólo si la pestaña `aprendizaje` está visible.
      if (this.currentTab === 'aprendizaje') this.renderTutorialRoute();
    });
    this.bus.on<{ rank: string; message: string }>(Events.RankChanged, ({ rank }) => {
      this.userRank.innerText = `RANGO: ${rank}`;
    });
    // Gauges — override manual desde cualquier emisor (ej. comando de monitoreo).
    this.bus.on<{ id: GaugeId; value: number }>(Events.GaugeUpdate, ({ id, value }) =>
      this.setGauge(id, value),
    );
    // El estado del task pausa el sorteo idle de gauges (mientras se ejecuta
    // un comando, los valores no se inventan al azar).
    this.bus.on<string>(Events.TaskStatusChanged, (s) => {
      this.gaugesBusy = s !== 'ESPERANDO INSTRUCCIONES...';
    });
    this.bus.on<{ done: number; total: number }>(Events.ProgressChanged, ({ done, total }) => {
      if (total === 0) {
        // Sentinela "sin foco" → reset visual y, si no hay pin del usuario,
        // volvemos a la pestaña de aprendizaje.
        this.focusedId = 0;
        this.miniProgress.style.width = '0%';
        this.miniPercent.innerText = '0%';
        this.renderFocoEmpty();
        this.renderMissionsList();
        if (!this.userPinned) this.switchTab('aprendizaje');
        return;
      }
      const pct = Math.round((done / total) * 100);
      this.miniProgress.style.width = `${pct}%`;
      this.miniPercent.innerText = `${pct}%`;
    });

    setInterval(() => this.tick(), 1000);
    // Animación idle de gauges: cada 2s sortea CPU y LAN si no hay comando en curso.
    setInterval(() => {
      if (this.gaugesBusy) return;
      this.setGauge('cpu', Math.floor(Math.random() * 15) + 5);
      this.setGauge('red', Math.floor(Math.random() * 10) + 1);
    }, 2000);
  }

  /** Inicializa badges de tutoriales, rango y deja la pestaña aprendizaje activa. */
  hydrate(tutorials: Record<TutorialKey, boolean>, rank: string): void {
    this.tutorialState = { ...tutorials };
    this.userRank.innerText = `RANGO: ${rank}`;
    this.renderHomePane();
    this.renderMissionsList();
    this.switchTab('aprendizaje');
  }

  // ----- Tabs -----
  /**
   * Cambia la pestaña visible y actualiza estado ARIA / clases. También
   * dispara los renders perezosos del pane que se vuelve visible.
   */
  private switchTab(tab: TabKey): void {
    this.currentTab = tab;
    (Object.keys(this.panes) as TabKey[]).forEach((k) => {
      this.panes[k].hidden = k !== tab;
    });
    this.tabBtns.forEach((btn) => {
      const isActive = btn.dataset.tab === tab;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
    });
    if (tab === 'misiones') this.renderMissionsList();
    if (tab === 'aprendizaje') this.renderHomePane();
    if (tab === 'foco' && this.focusedId === 0) this.renderFocoEmpty();
  }

  /** Estado vacío del pane `foco`: sin misión enfocada. */
  private renderFocoEmpty(): void {
    this.missionTitle.innerText = 'SIN MISIÓN EN FOCO';
    this.missionMeta.innerText = '';
    this.missionDesc.innerHTML = '';
    this.missionList.innerHTML =
      `<li class="mission-row empty">Sin misión enfocada, no hay instrucciones. Escribe <code>misiones</code> para ver el catálogo o <code>mision &lt;id&gt;</code> para iniciar una.</li>`;
    this.miniProgress.style.width = '0%';
    this.miniPercent.innerText = '0%';
  }

  // ----- Render -----
  private renderMission(m: IMission): void {
    this.missionTitle.innerText = `D${m.id}: ${m.title}`;
    this.missionDesc.innerText = m.desc;
    const done = m.steps.filter((s) => s.done).length;
    this.missionMeta.innerText = `Foco actual · ${done}/${m.steps.length} objetivos completados`;
    this.missionList.innerHTML = m.steps
      .map(
        (step, idx) =>
          `<li id="step_${idx}"${step.done ? ' class="done"' : ''}>${step.text} <span class="m-status">${step.done ? '[HECHO]' : ''}</span></li>`,
      )
      .join('');
    const pct = Math.round((done / m.steps.length) * 100);
    this.miniProgress.style.width = `${pct}%`;
    this.miniPercent.innerText = `${pct}%`;
  }

  /**
   * Pinta la lista de misiones del pane `misiones`. Muestra primero las
   * activas (con badge `[ENFOCADA]` o `[PAUSADA]`) y luego las completadas
   * que no estén en curso (badge `[COMPLETADA]`).
   */
  private renderMissionsList(): void {
    const active = this.missions.getActive();
    const focusedId = this.missions.getFocusedId();
    const completedIds = this.missions.getCompleted();
    const activeIdSet = new Set(active.map((m) => m.id));

    this.missionsMeta.innerText = `Activas: ${active.length} · Completadas: ${completedIds.length}`;

    if (active.length === 0 && completedIds.length === 0) {
      this.missionsList.innerHTML =
        `<li class="mission-row empty">Sin misiones aún. Escribe <code>misiones</code> para ver el catálogo o <code>mision &lt;id&gt;</code> para iniciar.</li>`;
      return;
    }

    const rows: string[] = [];
    for (const m of active) {
      const done = m.steps.filter((s) => s.done).length;
      const total = m.steps.length;
      const isFocused = m.id === focusedId;
      const cls = isFocused ? 'focused' : 'paused';
      const badge = isFocused ? '[ENFOCADA]' : '[PAUSADA]';
      rows.push(
        `<li class="mission-row ${cls}"><span class="m-id">D${m.id}</span> <span class="m-title">${this.escape(m.title)}</span> <span class="m-count">${done}/${total}</span> <span class="m-badge">${badge}</span></li>`,
      );
    }
    for (const id of completedIds) {
      if (activeIdSet.has(id)) continue;
      const m = this.missions.get(id);
      if (!m) continue;
      rows.push(
        `<li class="mission-row done"><span class="m-id">D${m.id}</span> <span class="m-title">${this.escape(m.title)}</span> <span class="m-badge">[COMPLETADA]</span></li>`,
      );
    }
    this.missionsList.innerHTML = rows.join('');
  }

  private renderHomePane(): void {
    this.renderTutorialRoute();
    this.renderTipCard();
  }

  private renderTutorialRoute(): void {
    const items: Array<{ key: TutorialKey; label: string; cmd: string }> = [
      { key: 'red', label: 'Módulo Redes',   cmd: 'tutorial-red' },
      { key: 'dos', label: 'Módulo DOS',     cmd: 'tutorial-dos' },
      { key: 'fw',  label: 'Módulo Defensa', cmd: 'tutorial-firewall' },
      { key: 'atk', label: 'Módulo Ataque',  cmd: 'tutorial-ataque' },
    ];
    let nextMarked = false;
    this.tutorialRoute.innerHTML = items
      .map((it) => {
        const done = this.tutorialState[it.key];
        const isNext = !done && !nextMarked;
        if (isNext) nextMarked = true;
        const badge = done
          ? `<span class="status-done">[COMPLETADO]</span>`
          : isNext
            ? `<span class="status-next">[SIGUIENTE]</span>`
            : `<span class="m-status">[PENDIENTE]</span>`;
        return `
          <li class="${done ? 'done' : isNext ? 'next' : ''}">
            <div class="route-row">
              <span class="route-label">${it.label}</span>
              ${badge}
            </div>
            <code class="route-cmd">&gt; ${it.cmd}</code>
          </li>`;
      })
      .join('');
  }

  private renderTipCard(): void {
    const tip = pickRandomTip();
    this.tipCard.innerHTML = `
      <div class="tip-header">💡 TIP DEL DÍA — ${this.escape(tip.concepto)}</div>
      <div class="tip-body">${this.escape(tip.descripcion)}</div>
      <code class="tip-example">${this.escape(tip.ejemplo)}</code>
      <div class="tip-cta">Escribe <code>?teoria ${this.escape(tip.concepto.toLowerCase())}</code> para profundizar.</div>
    `;
  }

  private escape(s: string): string {
    return s.replace(/[&<>"']/g, (c) =>
      c === '&' ? '&amp;' :
      c === '<' ? '&lt;' :
      c === '>' ? '&gt;' :
      c === '"' ? '&quot;' : '&#39;',
    );
  }

  private tick(): void {
    this.secondsActive++;
    const hrs = String(Math.floor(this.secondsActive / 3600)).padStart(2, '0');
    const mins = String(Math.floor((this.secondsActive % 3600) / 60)).padStart(2, '0');
    const secs = String(this.secondsActive % 60).padStart(2, '0');
    this.activeTime.innerText = `TIEMPO ACTIVO: ${hrs}:${mins}:${secs}`;
  }

  /** Aplica `value` (0–100) al gauge indicado actualizando la variable CSS `--p`. */
  private setGauge(id: GaugeId, value: number): void {
    const el = this.el(`gauge-${id}`);
    if (el) {
      el.style.setProperty('--p', String(value));
      const span = el.querySelector('span');
      if (span) span.textContent = `${value}%`;
    }
  }
}
