/**
 * App controller (v2.0.0): 5 modules (Why hazards hide → Practice hunt → Incident replay →
 * Fix it → Speak up + transfer), zone viewpoints with smooth camera glide & WASD walk,
 * POI list, floating HUD drawer with full text-mode parity, Calm Mode, and learning record logging.
 * @module app
 */
import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { Engine } from './core/engine.js';
import { loadJSON, hasWebGL2 } from './core/assets.js';
import { Input, LookController } from './core/input.js';
import { Shell } from './ui/shell.js';
import { Settings } from './ui/settings.js';
import { ProgressPage } from './ui/progress.js';
import { LearningRecord } from './learning/record.js';
import { TextMode, dataTable } from './a11y/text-mode.js';
import { MotionPrefs } from './a11y/motion.js';
import { ShotPlayer } from './cinematics/shot-player.js';
import { PoiList, openDialog, closeDialog } from './a11y/focus.js';
import { announce } from './a11y/announcer.js';
import { Warehouse } from './scenes/warehouse.js';
import { HuntController, BAND_RULE } from './systems/hazard-hunt.js';
import { ReplayPlayer } from './systems/replay-player.js';
import { ControlsActivity } from './systems/controls-activity.js';
import { DialoguePlayer, validateGraph } from './systems/dialogue.js';
import { mcItem, scoreAnswers, shuffled } from './learning/assess.js';
import { applyCaseGrade, initFloatingHud } from './v2/cinematic-grade.js';

export const SLUG = 'hazard-hunt';
window.__SLUG__ = SLUG;

const MODULES = ['1. Why hazards hide', '2. Practice hunt', '3. Incident replay', '4. Fix it', '5. Speak up + transfer'];

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

function lerpAngle(a, b, t) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

export class App {
  constructor() {
    document.body.insertAdjacentHTML('afterbegin',
      '<dialog id="settings-dialog" aria-labelledby="settings-h"></dialog><dialog id="progress-dialog" aria-labelledby="progress-h"></dialog><dialog id="task-dialog" aria-labelledby="task-h"></dialog>');
    this.shell = new Shell({ slug: SLUG, title: 'Hazard Hunt — Northwind Logistics (fictional)', moduleLabels: MODULES, onModuleChange: (i) => this.gotoModule(i) });
    this.record = new LearningRecord(SLUG);
    this.motion = new MotionPrefs(SLUG);
    this.stage = document.getElementById('stage');
    this.textMode = new TextMode({ root: document.getElementById('textmode'), slug: SLUG, onDecision: (id, payload) => this._textDecision(id, payload) });
    this.poi = new PoiList(this.shell.overlays, { label: 'Inspectable areas' });
    this.moduleIndex = 0;
    this._cameraGlide = null;
    this.results = { pre: [], post: [], hunt: {}, replay: [], controls: [], speakup: null, transfer: {}, reflection: null };
    initFloatingHud({ slug: SLUG, panel: document.getElementById('textmode') });
    this._init3D();
    this._initDialogs();
    this._initContent();
  }

  async _initContent() {
    const [zones, replay, controls, speakup, items, cinematics] = await Promise.all([
      loadJSON('content/zones.json'), loadJSON('content/replay.json'), loadJSON('content/controls.json'),
      loadJSON('content/speakup.json'), loadJSON('content/items.json'), loadJSON('content/cinematics.json'),
    ]);
    this.zones = zones.zones;
    this.replayData = replay;
    this.controlsData = controls;
    this.speakupData = speakup;
    this.items = items;
    this.graphCheck = validateGraph(speakup);
    this.hunt = new HuntController({ zones: this.zones, onFlagged: (def, result) => this._flagged(def, result) });
    this.player = new ShotPlayer({ container: document.getElementById('cinematic-host'), camera: this.engine?.camera, motion: this.motion, onDone: () => {} });
    this.player.load(cinematics);
    this._registerTextModes();
    this.gotoModule(0);
    if (window.location.hash === '#play-cinematic') this.player.play();
    if (__TEST_HOOKS__) window.__TEST__ = { app: this, engine: this.engine, hunt: this.hunt, graphCheck: this.graphCheck, shell: this.shell, record: this.record };
  }

  _init3D() {
    if (!hasWebGL2()) {
      applyCaseGrade(SLUG, {});
      this.stage.insertAdjacentHTML('beforeend',
        '<div data-webgl-fallback role="alert"><p>WebGL is not available in this browser. Every objective can be completed in <strong>Text mode</strong>.</p></div>');
      this.engine = null;
      return;
    }
    this.engine = new Engine(document.getElementById('app'));
    this.engine.quality.restore(); // the saved preset wins over auto-selection (review N16)
    this.engine.camera.fov = 65;
    this.engine.camera.updateProjectionMatrix();
    applyCaseGrade(SLUG, {
      renderer: this.engine.renderer,
      scene: this.engine.scene,
      skyRadius: 400,
    });
    this.warehouse = new Warehouse(this.engine.scene, { reducedMotion: this.motion?.reduced });
    // In-world speak-up target (review I2-2): the supervisor character is a registered
    // interactive with its own hit proxy, highlight, tooltip and camera glide.
    this.warehouse.registerInteractive('char-supervisor-sam', this.warehouse.supervisorSam, 'Supervisor Sam');
    this.motion.onChange((reduced) => this.warehouse?.setReducedMotion(reduced));
    // Presets drive real-time shadows and resolution (standards 4.4).
    this.warehouse.applyPreset(this.engine.renderer, this.engine.quality.presetDef);
    this.engine.quality.onChange((def) => {
      this.warehouse.applyPreset(this.engine.renderer, def);
      this.engine.resize();
    });
    this._loadEnvironment();

    // Projected 3D hover tooltip
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'v2-world-tooltip';
    this.tooltip.setAttribute('aria-hidden', 'true');
    this.tooltip.hidden = true;
    this.shell.overlays.appendChild(this.tooltip);

    this.input = new Input(document.getElementById('app'));
    this.look = new LookController(this.engine.camera);
    this.input.onPointer((p, kind) => {
      if (kind === 'move' && p.down) {
        this._cameraGlide = null;
        this.look.drag(p.dx, p.dy);
      }
      // Only the canvas itself can hover or select, never HTML on top of it, and never
      // while a modal dialog is open (review N1).
      const blocked = !p.onTarget || document.querySelector('dialog[open]');
      if (kind === 'move' && !p.down) { if (blocked) this._clearHover(); else this._hover(p.x, p.y); }
      if (kind === 'up' && !blocked && p.moved < 4) this._click(p.x, p.y);
    });
    this.input.onKey((code, e) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (code === 'ArrowLeft') { this._cameraGlide = null; this.look.steps({ yaw: -1 }); }
      if (code === 'ArrowRight') { this._cameraGlide = null; this.look.steps({ yaw: 1 }); }
      if (code === 'ArrowUp') { this._cameraGlide = null; this.look.steps({ pitch: 1 }); }
      if (code === 'ArrowDown') { this._cameraGlide = null; this.look.steps({ pitch: -1 }); }
    });
    // On-screen look buttons (pointer alternatives, WCAG 2.5.1)
    const lookPad = document.createElement('div');
    lookPad.className = 'look-pad';
    lookPad.setAttribute('role', 'group');
    lookPad.setAttribute('aria-label', 'Look around');
    for (const [label, yaw, pitch] of [['◀', -1, 0], ['▶', 1, 0], ['▲', 0, 1], ['▼', 0, -1]]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.setAttribute('aria-label', `Look ${label === '◀' ? 'left' : label === '▶' ? 'right' : label === '▲' ? 'up' : 'down'}`);
      b.addEventListener('click', () => { this._cameraGlide = null; this.look.steps({ yaw, pitch }); });
      lookPad.appendChild(b);
    }
    this.shell.overlays.appendChild(lookPad);
    // Visible way back from 3D to the text page (H-6), plus a one-line look tip.
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'back-to-list';
    back.textContent = 'Back to the list';
    back.addEventListener('click', () => {
      document.getElementById('app').style.visibility = 'visible';
      document.getElementById('textmode').hidden = false;
      this.warehouse.highlight(null);
      this._clearHover();
    });
    this.shell.overlays.appendChild(back);
    this.shell.overlays.appendChild(Object.assign(document.createElement('p'), {
      className: 'look-tip', textContent: 'Drag, use WASD / arrow keys or the look buttons to explore. Click an object to judge it.',
    }));
    this.engine.onUpdate((dt) => this._update3D(dt));
    this.engine.start();
  }

  _update3D(dt) {
    if (!this.engine || !this.warehouse) return;

    // 1. Smooth camera glide between viewpoints
    if (this._cameraGlide) {
      this._cameraGlide.elapsed += dt;
      const u = Math.min(1, this._cameraGlide.elapsed / this._cameraGlide.duration);
      const k = easeInOutCubic(u);
      this.engine.camera.position.lerpVectors(this._cameraGlide.fromPos, this._cameraGlide.toPos, k);
      this.look.yaw = lerpAngle(this._cameraGlide.fromYaw, this._cameraGlide.toYaw, k);
      this.look.pitch = THREE.MathUtils.lerp(this._cameraGlide.fromPitch, this._cameraGlide.toPitch, k);
      this.look.apply();
      if (u >= 1) this._cameraGlide = null;
    } else if (!document.querySelector('dialog[open]') && !this._replay?.playing) {
      // 2. Free WASD floor walking inside the warehouse bay
      const tag = document.activeElement?.tagName;
      if (!tag || !/INPUT|TEXTAREA|SELECT/.test(tag)) {
        let fwd = 0;
        let strafe = 0;
        if (this.input?.isDown('KeyW')) fwd += 1;
        if (this.input?.isDown('KeyS')) fwd -= 1;
        if (this.input?.isDown('KeyD')) strafe += 1;
        if (this.input?.isDown('KeyA')) strafe -= 1;
        if (fwd !== 0 || strafe !== 0) {
          const speed = 3.8 * dt;
          const sinY = Math.sin(this.look.yaw);
          const cosY = Math.cos(this.look.yaw);
          const dx = (-sinY * fwd + cosY * strafe) * speed;
          const dz = (-cosY * fwd - sinY * strafe) * speed;
          this.engine.camera.position.x = THREE.MathUtils.clamp(this.engine.camera.position.x + dx, -30, 30);
          this.engine.camera.position.z = THREE.MathUtils.clamp(this.engine.camera.position.z + dz, -20, 20);
        }
      }
    }

    // 3. Advance warehouse ambient life & character animations
    this.warehouse.update(dt, this.engine.camera);
  }

  /** Image-based lighting from a CC0 Poly Haven HDRI (Empty Warehouse 01, 1k). Used for
   * lighting and reflections only; the background stays the modeled interior. */
  _loadEnvironment() {
    const url = `${import.meta.env.BASE_URL}assets/empty_warehouse_01_1k-9b3d611cad.hdr`;
    const pmrem = new THREE.PMREMGenerator(this.engine.renderer);
    new HDRLoader().load(url, (hdr) => {
      const env = pmrem.fromEquirectangular(hdr).texture;
      this.engine.scene.environment = env;
      this.engine.scene.environmentIntensity = 0.6;
      hdr.dispose();
      pmrem.dispose();
    }, undefined, () => {
      // Lighting falls back to the analytic lights already in the scene.
      pmrem.dispose();
    });
  }

  /** Zones whose objects are selectable in the current module. */
  _activeZones() {
    if (this.moduleIndex === 1) return [this.zones[0], this.zones[1]];
    if (this.moduleIndex === 4) return [this.zones[2]];
    return [];
  }

  /** Pick the inspectable or viewpoint ring under a screen point. */
  _pickAt(x, y) {
    if (!this.engine || document.getElementById('app').style.visibility === 'hidden') return { id: null, viewId: null, active: new Set() };
    const active = new Set(this._activeZones().flatMap((z) => z.inspectables.map((i) => i.id)));
    const rect = this.engine.canvas.getBoundingClientRect();
    const nx = ((x - rect.left) / rect.width) * 2 - 1;
    const ny = -((y - rect.top) / rect.height) * 2 + 1;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(nx, ny), this.engine.camera);
    const id = this.warehouse.pick(ray);
    const viewId = id ? null : this.warehouse.pickViewpoint(ray);
    return { id, viewId, active };
  }

  /**
   * In-world equivalents for the panel-only activities (interaction review I2-1/I2-2).
   * Module 4: the three hazards that have a controls task open their control card in
   * 3D. Module 5: clicking Supervisor Sam opens the speak-up scenario. Both keep the
   * text-panel versions as the keyboard/AT equivalent (owner decision 7).
   */
  _controlTaskByItem = {
    'hazard-overhang': 'controls-overhang',
    'hazard-frayed-cable': 'controls-frayed-cable',
    'hazard-misaligned-mirror': 'controls-mirror',
  };

  /** The in-world action for an object id in the current module, or null. */
  _actionFor(id) {
    if (this.moduleIndex === 3) {
      const task = this.controlsData?.tasks.find((t) => t.id === this._controlTaskByItem[id]);
      if (task) return { kind: 'controls', task };
    }
    if (this.moduleIndex === 4 && id === 'char-supervisor-sam') return { kind: 'speakup' };
    return null;
  }

  /** Open the in-world equivalent of a panel activity: glide to the object, then show
   * its control card or the speak-up dialogue in the shared task dialog. */
  _runAction(id, action) {
    const dlg = document.getElementById('task-dialog');
    if (dlg.open) return;
    this._glideToObject(id);
    this.warehouse?.setCalmMode(true);
    dlg.addEventListener('close', () => this.warehouse?.setCalmMode(false), { once: true });
    if (action.kind === 'controls') {
      dlg.innerHTML = `<h2 id="task-h">${action.task.hazard}</h2><p>Rank these controls for the hazard you are looking at, most → least effective. The same ranking is in the text panel.</p>`;
      const host = document.createElement('div');
      dlg.appendChild(host);
      const activity = new ControlsActivity({
        data: { ...this.controlsData, tasks: [action.task] },
        container: host,
        onComplete: (results) => {
          this._mergeControls(results);
          this.record.log('completed', { id: `controls-${action.task.id}`, name: action.task.hazard }, { response: results.map((r) => r.taskId + ':' + (r.perfect ? 'perfect' : 'revised')).join(',') });
          const close = document.createElement('button');
          close.type = 'button';
          close.textContent = 'Close';
          close.addEventListener('click', () => closeDialog(dlg));
          host.appendChild(close);
          close.focus();
        },
      });
      activity.next();
      openDialog(dlg);
      return;
    }
    dlg.innerHTML = `<h2 id="task-h">Speak up: report the blocked exit</h2><p>Structured model: <strong>Situation → Hazard → Impact → Ask</strong>. You choose; the scenario responds. (Fictional scenario, constructed for teaching.)</p>`;
    const host = document.createElement('div');
    host.className = 'dialogue-host';
    dlg.appendChild(host);
    const speakPlayer = new DialoguePlayer({
      data: this.speakupData,
      container: host,
      onOutcome: (outcome, line) => {
        this.results.speakup = outcome;
        this.record.log('completed', { id: 'speakup', name: 'Speak-up scenario' }, { response: outcome });
        const fb = document.createElement('div');
        fb.className = 'feedback';
        fb.innerHTML = `<p>${line}</p>`;
        const again = document.createElement('button');
        again.type = 'button';
        again.textContent = 'Try a different approach';
        again.addEventListener('click', () => speakPlayer.start());
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = 'Close';
        close.addEventListener('click', () => closeDialog(dlg));
        host.append(fb, again, close);
        close.focus();
      },
    });
    speakPlayer.start();
    openDialog(dlg);
  }

  /** Glide the camera to a spot facing a registered interactive or inspectable.
   * Reduced motion places the camera instantly (same rule as viewpoint glides). */
  _glideToObject(id) {
    if (!this.engine) return;
    const focus = this.warehouse.inspectables.get(id)?.focus;
    if (!focus) return;
    const from = this.engine.camera.position.clone();
    const dir = from.clone().sub(focus);
    dir.y = 0;
    if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
    dir.normalize();
    const toPos = focus.clone().addScaledVector(dir, focus.y > 2 ? 4.5 : 3.2);
    toPos.y = 1.7;
    toPos.x = THREE.MathUtils.clamp(toPos.x, -30, 30);
    toPos.z = THREE.MathUtils.clamp(toPos.z, -20, 20);
    const aim = this.warehouse.aimAt(id, toPos);
    if (this.motion?.reduced) {
      this._cameraGlide = null;
      this.engine.camera.position.copy(toPos);
      this.look.yaw = aim.yaw;
      this.look.pitch = Math.max(this.look.minPitch, Math.min(this.look.maxPitch, aim.pitch));
      this.look.apply();
      return;
    }
    this._cameraGlide = {
      fromPos: from,
      toPos,
      fromYaw: this.look.yaw,
      toYaw: aim.yaw,
      fromPitch: this.look.pitch,
      toPitch: Math.max(this.look.minPitch, Math.min(this.look.maxPitch, aim.pitch)),
      elapsed: 0,
      duration: 0.78,
    };
  }

  /** Merge one run's control-ranking results, replacing earlier results per task. */
  _mergeControls(results) {
    for (const r of results) {
      this.results.controls = this.results.controls.filter((x) => x.taskId !== r.taskId);
      this.results.controls.push(r);
    }
  }

  _hover(x, y) {
    const { id, viewId, active } = this._pickAt(x, y);
    const action = id ? this._actionFor(id) : null;
    if (action) {
      this.warehouse.highlight(id);
      this.engine.canvas.style.cursor = 'pointer';
      if (this.tooltip) {
        this.tooltip.hidden = false;
        this.tooltip.textContent = action.kind === 'controls'
          ? `${action.task.hazard} — Click to rank controls`
          : `${this.warehouse.inspectables.get(id)?.label ?? 'Supervisor Sam'} — Click to speak up`;
        this.tooltip.style.left = `${Math.min(window.innerWidth - 240, Math.max(16, x + 14))}px`;
        this.tooltip.style.top = `${Math.max(16, y - 36)}px`;
      }
      return;
    }
    const ok = id && active.has(id);
    this.warehouse.highlight(ok ? id : null);
    if (ok) {
      this.engine.canvas.style.cursor = 'pointer';
      const found = this.hunt?.byId(id);
      if (this.tooltip && found) {
        this.tooltip.hidden = false;
        this.tooltip.textContent = `${found.def.area} — Click to judge`;
        this.tooltip.style.left = `${Math.min(window.innerWidth - 240, Math.max(16, x + 14))}px`;
        this.tooltip.style.top = `${Math.max(16, y - 36)}px`;
      }
    } else if (viewId && Warehouse.VIEWS[viewId]) {
      this.engine.canvas.style.cursor = 'pointer';
      if (this.tooltip) {
        this.tooltip.hidden = false;
        this.tooltip.textContent = `Viewpoint: ${Warehouse.VIEWS[viewId].label} — Click to move here`;
        this.tooltip.style.left = `${Math.min(window.innerWidth - 240, Math.max(16, x + 14))}px`;
        this.tooltip.style.top = `${Math.max(16, y - 36)}px`;
      }
    } else {
      this._clearHover();
    }
  }

  _clearHover() {
    if (this.engine) this.engine.canvas.style.cursor = '';
    if (this.tooltip) this.tooltip.hidden = true;
  }

  _click(x, y) {
    const { id, viewId, active } = this._pickAt(x, y);
    if (id) {
      const action = this._actionFor(id);
      if (action) { this._runAction(id, action); return; }
      if (active.has(id)) { this._flag(id); return; }
      if (active.size) {
        announce(id.startsWith('char-')
          ? 'That is Supervisor Sam. The speak-up conversation is part of Module 5.'
          : 'That object belongs to a different zone. It is not part of this hunt.');
      }
      return;
    }
    if (viewId) {
      this._gotoView(viewId, { glide: true });
    }
  }

  _flag(id) {
    const found = this.hunt.byId(id);
    if (!found) return;
    if (this.hunt.flags.has(id)) { announce('Already rated. Submitting again replaces your earlier answer.'); }
    this.warehouse?.highlight(id);
    this.warehouse?.setCalmMode(true);
    const dlg = document.getElementById('task-dialog');
    dlg.addEventListener('close', () => this.warehouse?.setCalmMode(false), { once: true });
    this.hunt.renderRatingDialog(found.def, found.zone, dlg, (result) => {
      closeDialog(dlg);
      this.warehouse?.setCalmMode(false);
      this._flagged(found.def, result);
      this._syncSection(id);
      // Feedback stays until the learner closes it (no timers; agent review A4).
      this.shell.overlays.querySelector('.hunt-feedback')?.remove();
      const fb = document.createElement('div');
      fb.className = 'feedback hunt-feedback';
      fb.setAttribute('role', 'status');
      fb.innerHTML = `<p>${result.feedback.replace(/\*\*/g, '')}</p><p>${this._progressLine(found.zone)}</p>`;
      const close = document.createElement('button');
      close.type = 'button';
      close.textContent = 'Close feedback';
      this._refreshPoi();
      // Focus goes to the feedback, and back to the rebuilt POI button for this item
      // when the feedback is closed (review N6: the old button no longer exists).
      close.addEventListener('click', () => {
        fb.remove();
        this.warehouse?.highlight(null);
        const poiBtn = this.shell.overlays.querySelector(`[data-poi="${CSS.escape(id)}"]`);
        if (poiBtn && poiBtn.offsetParent !== null) poiBtn.focus();
        else document.querySelector('.back-to-list')?.focus();
      });
      fb.appendChild(close);
      this.shell.overlays.appendChild(fb);
      close.focus();
      const next = { practice: 'Practice zone complete. Continue with Part B, the assessed zone.', assessed: 'Assessed zone complete. Continue to Module 3, the incident replay.', transfer: 'Transfer zone complete.' };
      if (this._zoneComplete(found.zone.id)) {
        this.shell.setStatus(next[found.zone.id]);
        this.record.log('completed', { id: `hunt-zone-${found.zone.id}`, name: found.zone.name });
      }
    }, { headingId: 'task-h' });
    openDialog(dlg);
  }

  _zoneComplete(zoneId) {
    const zone = this.zones.find((z) => z.id === zoneId);
    return zone.inspectables.every((i) => this.hunt.flags.has(i.id));
  }

  _refreshPoi() {
    this.poi.clear();
    for (const zone of this._activeZones()) {
      for (const item of zone.inspectables) {
        // ALL inspectable areas are listed (hazards, distractors and neutral items),
        // so the list itself gives nothing away (plan §11).
        const rated = this.hunt.flags.has(item.id);
        this.poi.set(item.id, {
          label: `${rated ? '✓ ' : ''}${item.area}`,
          onSelect: () => { this._aimAtItem(item.id, zone); this._flag(item.id); },
        });
      }
    }
    // The POI panel and look pad only appear when a hunt is active (A10/V12).
    const show = this._activeZones().length > 0;
    this.shell.overlays.classList.toggle('hunt-inactive', !show);
  }

  /** "N of M rated" line for a zone (heuristics H1). */
  _progressLine(zone) {
    const n = zone.inspectables.filter((i) => this.hunt.flags.has(i.id)).length;
    return `${zone.name.split(':')[0]}: ${n} of ${zone.inspectables.length} areas judged.`;
  }

  /** Move to the zone view that frames the item best, then turn the camera onto it. */
  _aimAtItem(id, zone) {
    if (!this.engine) return;
    const viewId = this.warehouse.bestView(id, zone.views, this.engine.camera.aspect);
    this._gotoView(viewId, { quiet: true });
    const aim = this.warehouse.aimAt(id, this.engine.camera.position);
    if (aim) {
      this.look.yaw = aim.yaw;
      this.look.pitch = Math.max(this.look.minPitch, Math.min(this.look.maxPitch, aim.pitch));
      this.look.apply();
    }
    this._show3D();
  }

  _show3D() {
    document.getElementById('app').style.visibility = 'visible';
    document.getElementById('textmode').hidden = true;
  }

  _gotoView(viewId, { quiet = false, glide = false } = {}) {
    if (!this.engine) return;
    const v = Warehouse.VIEWS[viewId];
    if (!v) return;
    if (glide && !this.motion?.reduced) {
      this._cameraGlide = {
        fromPos: this.engine.camera.position.clone(),
        toPos: new THREE.Vector3(...v.pos),
        fromYaw: this.look.yaw,
        toYaw: v.yaw,
        fromPitch: this.look.pitch,
        toPitch: v.pitch || 0,
        elapsed: 0,
        duration: 0.78,
      };
    } else {
      this._cameraGlide = null;
      this.engine.camera.position.set(...v.pos);
      this.look.yaw = v.yaw;
      this.look.pitch = v.pitch || 0;
      this.look.apply();
    }
    if (!quiet) announce(`View: ${v.label}. Drag, or use WASD, the arrow keys or the look buttons, to look around.`);
  }

  _initDialogs() {
    this.settings = new Settings({
      slug: SLUG, dialog: document.getElementById('settings-dialog'), quality: this.engine?.quality, motion: this.motion,
      onFov: (fov) => { if (this.engine) { this.engine.camera.fov = fov; this.engine.camera.updateProjectionMatrix(); } },
    });
    this.settings._apply(); // restore saved text size, contrast and field of view
    this.shell.on('settings', (btn) => this.settings.open(btn));
    this.progressPage = new ProgressPage({ slug: SLUG, dialog: document.getElementById('progress-dialog'), record: this.record });
    this.shell.on('progress', (btn) => this.progressPage.open(btn));
    this.shell.on('restart', () => {
      // Restart clears this module's hunt answers (H-11).
      for (const z of this._activeZones()) for (const i of z.inspectables) this.hunt.flags.delete(i.id);
      this.gotoModule(this.moduleIndex);
    });
    this.shell.on('textmode', () => {
      const on = !document.getElementById('textmode').hidden;
      if (on) this.textMode.show(MODULES[this.moduleIndex]);
    });
  }

  gotoModule(i) {
    this._exitReplay(); // clears the replay overlay and actors on any module change (A7)
    this.shell.overlays.querySelector('.hunt-feedback')?.remove();
    this.warehouse?.highlight(null);
    this._clearHover();
    this.moduleIndex = i;
    this.shell.setModule(i);
    document.getElementById('textmode').hidden = false;
    document.getElementById('app').style.visibility = this.engine ? 'visible' : 'hidden';
    // Start each module from a real viewpoint, never the world origin (review N9):
    // the first view of the active zone, or the receiving dock otherwise.
    const firstZone = this._activeZones()[0] || this.zones[0];
    this._gotoView(firstZone.views[0], { quiet: true });
    this.textMode.show(MODULES[i]);
    this._refreshPoi();
    this.record.log('experienced', { id: `module-${i + 1}`, name: MODULES[i] });
  }

  /* ---------- Module implementations (rendered in text-mode container for both
     modes so 3D and text learners share the SAME decisions; the 3D scene supports
     the hunt interaction on top). ---------- */

  _el(html) { const d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }

  _registerTextModes() {
    const tm = this.textMode;
    tm.register(MODULES[0], (body, api) => this._module1(body));
    tm.register(MODULES[1], (body, api) => this._module2(body, api));
    tm.register(MODULES[2], (body, api) => this._module3(body, api));
    tm.register(MODULES[3], (body, api) => this._module4(body, api));
    tm.register(MODULES[4], (body, api) => this._module5(body, api));
  }

  _module1(body) {
    body.appendChild(this._el(`<p><strong>Northwind Logistics (fictional)</strong> runs this distribution center with 140 staff. Near-misses are up this quarter. You walk this floor every shift — and that is exactly how hazards go invisible: nothing has gone wrong <em>yet</em>, so the risky starts looking normal.</p>`));
    body.appendChild(this._el(`<p>In this module you will learn to: (1) notice what has become invisible, (2) rate what you find, (3) analyze a near-miss to its causes, (4) choose controls that actually work, and (5) report so busy people can act. This course does not replace training required by law or by your employer.</p>`));
    if (this.engine) {
      const intro = document.createElement('button');
      intro.type = 'button';
      intro.textContent = 'Play the shift-start intro (14 s, captioned, skippable with Esc)';
      intro.addEventListener('click', () => this._playIntro(intro));
      body.appendChild(intro);
    }
    body.appendChild(this._el(`<h3>Pre-check</h3>`));
    for (const item of this.items.preCheck) {
      // Answered items stay answered across module switches; no second answer (N5).
      const previous = this.results.pre.find((a) => a.itemId === item.id) || null;
      mcItem({ item, container: body, previous, onAnswered: (a) => this._answer(a, 'pre') });
    }
  }

  /** Intro shot S1. Plays on request only (never during an assessment); with reduced
   * motion the player shows a still frame with the same captions. */
  _playIntro(trigger) {
    const tm = document.getElementById('textmode');
    const canvas = document.getElementById('app');
    tm.hidden = true;
    canvas.style.visibility = 'visible';
    this.player.onDone = () => {
      tm.hidden = false;
      canvas.style.visibility = 'visible';
      this.record.log('experienced', { id: 'cinematic-S1', name: 'Shift start intro' });
      trigger?.focus();
    };
    this.player.play();
  }

  _module2(body, api) {
    body.appendChild(this._el(`<p>Two parts. <strong>Part A, practice zone</strong> (receiving dock, main floor, charging area): hints are available. <strong>Part B, assessed zone</strong> (racking aisle and packing station): no hints. In both, rate the conditions worth reporting and leave alone the ones that only <em>look</em> risky.</p>`));
    body.appendChild(this._el(`<h3>Part A: practice zone</h3>`));
    this._renderZone(body, this.zones[0]);
    body.appendChild(this._el(`<h3>Part B: assessed zone (no hints)</h3>`));
    this._renderZone(body, this.zones[1]);
  }

  /** One hunt zone: viewpoint buttons (3D), an observation table, and a rating form per inspectable area. */
  _renderZone(body, zone) {
    if (this.engine) {
      const views = document.createElement('div');
      views.className = 'view-buttons';
      views.setAttribute('role', 'group');
      views.setAttribute('aria-label', 'Zone viewpoints');
      for (const v of zone.views) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = `Go to: ${Warehouse.VIEWS[v].label}`;
        b.addEventListener('click', () => {
          this._gotoView(v, { glide: true });
          document.getElementById('app').style.visibility = 'visible';
          document.getElementById('textmode').hidden = true;
        });
        views.appendChild(b);
      }
      body.appendChild(views);
      body.appendChild(this._el(`<p>Click an object in the 3D warehouse to flag it, or use the points-of-interest list on the right. Use "Hide panel" or a viewpoint button to explore full-screen 3D.</p>`));
    }
    body.appendChild(this._el(`<h4>Inspectable areas (all listed; decide which are hazards)</h4>`));
    const table = dataTable(['Area', 'What you can observe'], zone.inspectables.map((i) => [i.area, i.cue]), `${zone.name}: flag and rate each area`);
    body.appendChild(table);
    for (const item of zone.inspectables) body.appendChild(this._ratingSection(item, zone));
    if (zone.hints) {
      const hint = document.createElement('p');
      hint.className = 'hint';
      const updateHint = () => { hint.textContent = this.hunt.hintText(zone, this.hunt.flags.size); };
      updateHint();
      body.appendChild(hint);
      this.hunt._updateHint = updateHint;
    }
  }

  /**
   * One text-page rating section. A rating already in `hunt.flags` (from this page,
   * from the 3D dialog, or from before a module switch) is shown read-only with its
   * feedback and a "Change my answer" button, so one item has one rating in both
   * views (review N5).
   */
  _ratingSection(item, zone, section = document.createElement('section')) {
    section.className = 'assessment-item';
    section.dataset.item = item.id;
    const showFeedback = (result) => {
      const fb = document.createElement('div');
      fb.className = 'feedback';
      fb.innerHTML = `<p>${result.feedback.replace(/\*\*/g, '')}</p>`;
      section.appendChild(fb);
      return fb;
    };
    const prev = this.hunt.flags.get(item.id);
    if (prev) {
      section.innerHTML = '';
      const h = Object.assign(document.createElement('h3'), { textContent: item.area });
      const cue = Object.assign(document.createElement('p'), { textContent: item.cue });
      const yours = Object.assign(document.createElement('p'), { className: 'your-answer', textContent: `Your answer: ${this._describeJudgment(prev.result)}` });
      section.append(h, cue, yours);
      showFeedback(prev.result);
      const again = document.createElement('button');
      again.type = 'button';
      again.textContent = 'Change my answer';
      again.setAttribute('aria-label', `Change my answer: ${item.area}`);
      again.addEventListener('click', () => {
        section.innerHTML = '';
        this._ratingForm(item, zone, section, showFeedback);
        section.querySelector('input')?.focus();
      });
      section.appendChild(again);
      return section;
    }
    this._ratingForm(item, zone, section, showFeedback);
    return section;
  }

  _ratingForm(item, zone, section, showFeedback) {
    this.hunt.renderRatingDialog(item, zone, section, (result) => {
      section.querySelector('.feedback')?.remove();
      showFeedback(result);
      this._flagged(item, result);
      this._refreshPoi();
    });
    const cue = Object.assign(document.createElement('p'), { textContent: item.cue });
    section.querySelector('h3').after(cue);
  }

  _describeJudgment(r) {
    if (r.classification === 'hazard') return `a hazard to report, likelihood ${r.likelihood} × severity ${r.severity} (${r.band?.label}).`;
    return r.classification === 'controlled' ? 'a controlled condition.' : 'acceptable, nothing to report.';
  }

  /** Re-render the text-page section of an item rated in 3D (review N5). */
  _syncSection(id) {
    const section = document.querySelector(`#textmode section[data-item="${CSS.escape(id)}"]`);
    const found = this.hunt.byId(id);
    if (section && found) this._ratingSection(found.def, found.zone, section);
  }

  _module3(body, api) {
    body.appendChild(this._el(`<p><strong>Content note:</strong> the following is a fictional near-miss constructed for teaching. Nobody is hurt. You control the pace — pause, scrub, and decide at each point.</p>`));
    if (this.engine) {
      body.appendChild(this._el(`<p>Switch to the 3D view for the replay? The same decisions exist in both views.</p>`));
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = 'Open the 3D replay';
      b.addEventListener('click', () => {
        document.getElementById('app').style.visibility = 'visible';
        document.getElementById('textmode').hidden = true;
        this._startReplay3D();
      });
      body.appendChild(b);
    }
    body.appendChild(this._el(`<h3>Storyboard (learner-paced)</h3>`));
    for (const seg of this.replayData.segments) {
      const section = document.createElement('section');
      section.className = 'assessment-item';
      section.innerHTML = `<h4>${seg.name}</h4><p>${seg.story}</p>`;
      for (const pp of seg.pausePoints || []) {
        const fs = document.createElement('fieldset');
        const lg = document.createElement('legend');
        lg.textContent = pp.question;
        fs.appendChild(lg);
        for (const opt of shuffled(pp.options, `replay-${seg.id}@${pp.at}`)) {
          const lab = document.createElement('label');
          lab.className = 'choice';
          const input = document.createElement('input');
          input.type = 'radio';
          input.name = `replay-${seg.id}-${pp.at}`;
          input.value = opt.id;
          lab.append(input, Object.assign(document.createElement('span'), { textContent: ` ${opt.text}` }));
          fs.appendChild(lab);
        }
        const submit = document.createElement('button');
        submit.type = 'button';
        submit.textContent = 'Submit decision';
        const key = `${seg.id}@${pp.at}`;
        this._replayAnswers ??= new Map();
        const showResult = (opt) => {
          const fb = document.createElement('div');
          fb.className = 'feedback';
          fb.innerHTML = `<p><strong>${opt.correct ? 'Good decision.' : 'Consider the alternative:'}</strong> ${opt.why}</p>`;
          fs.appendChild(fb);
          for (const input of fs.querySelectorAll('input')) { input.checked = input.value === opt.id; input.disabled = true; }
          submit.disabled = true;
        };
        submit.addEventListener('click', () => {
          const sel = fs.querySelector('input:checked');
          if (!sel || this._replayAnswers.has(key)) return;
          const opt = pp.options.find((o) => o.id === sel.value);
          // One answer per decision across the storyboard and the 3D replay (N3/N5).
          this._replayAnswers.set(key, opt);
          this.results.replay.push({ segment: seg.id, chosen: opt.id, correct: opt.correct });
          this.record.log('answered', { id: `replay-${seg.id}`, name: pp.question }, { response: opt.id, success: opt.correct });
          showResult(opt);
        });
        fs.appendChild(submit);
        if (this._replayAnswers.has(key)) showResult(this._replayAnswers.get(key));
        section.appendChild(fs);
      }
      body.appendChild(section);
    }
    body.appendChild(this._el(`<h3>Build the contributing-causes chart</h3>`));
    const causeLevels = dataTable(
      ['Cause', 'Level', 'Why it matters'],
      this.replayData.causes.map((c) => [c.label, c.level, c.why]),
      'The five causes behind the near-miss — sort them by level when you build your own chart',
    );
    body.appendChild(causeLevels);
  }

  /** Replay-only actors are shown only while the replay is open (R3/R4). */
  _setReplayActors(on) {
    if (!this.warehouse) return;
    this.warehouse._truck.visible = on;
    this.warehouse.replayPedestrian.visible = on;
  }

  /** Leave the 3D replay: stop it, hide its overlay and actors, back to the storyboard (A7). */
  _exitReplay() {
    if (!this._replay) return;
    this._replay.playing = false;
    this._replay.pausedAtPoint = null;
    this._replayUi.hidden = true;
    this._setReplayActors(false);
    this.warehouse?.setCalmMode(false);
    const dlg = document.getElementById('task-dialog');
    if (dlg.open) closeDialog(dlg);
    if (this.moduleIndex === 2) {
      document.getElementById('app').style.visibility = this.engine ? 'visible' : 'hidden';
      document.getElementById('textmode').hidden = false;
    }
  }

  _startReplay3D() {
    this._setReplayActors(true);
    // Opens paused on frame 0 with focus on Play, so the learner can read the
    // segment text before anything moves (review N14; reduced motion included).
    const focusPlay = () => this._replayUi.querySelector('[data-replay="play"]')?.focus();
    if (this._replay) { this._replayUi.hidden = false; this._replay.loadSegment(0); focusPlay(); return; }
    const ui = document.createElement('div');
    ui.className = 'replay-ui';
    this._replayUi = ui;
    this.shell.overlays.appendChild(ui);
    const pedestrian = this.warehouse.replayPedestrian;
    this._replay = new ReplayPlayer({
      data: this.replayData,
      truck: this.warehouse._truck,
      pedestrian,
      onExit: () => this._exitReplay(),
      camera: this.engine.camera,
      ui,
      motion: this.motion,
      onPausePoint: (pp, seg) => this._replayDecision(pp, seg),
      onSegmentEnd: (seg) => {
        this._replay.showCauses(seg.causesVisible, this.replayData.causes);
        if (seg.id === 'seg4') this.record.log('completed', { id: 'replay-complete', name: 'Incident replay' });
        else this._replay.loadSegment(this.replayData.segments.findIndex((s) => s.id === seg.id) + 1);
      },
    });
    this._replay.loadSegment(0);
    focusPlay();
  }

  /**
   * 3D replay decision dialog. One answer per decision (review N3): the options are
   * disabled after the first choice and only one `answered` statement is logged, also
   * when the dialog is closed with Esc and reopened. Closing without "Continue" leaves
   * the replay paused at the decision; Play reopens it (review N2).
   */
  _replayDecision(pp, seg) {
    const key = `${seg.id}@${pp.at}`;
    this._replayAnswers ??= new Map();
    this.warehouse?.setCalmMode(true);
    const dlg = document.getElementById('task-dialog');
    dlg.innerHTML = `<h2 id="task-h">Decision point</h2><p>${pp.question}</p>`;
    const opts = document.createElement('div');
    opts.setAttribute('role', 'group');
    opts.setAttribute('aria-label', pp.question);
    const buttons = [];
    const showResult = (opt) => {
      for (const x of buttons) x.disabled = true;
      const fb = document.createElement('div');
      fb.className = 'feedback';
      fb.setAttribute('role', 'status');
      fb.innerHTML = `<p><strong>${opt.correct ? 'Good decision.' : 'Consider the alternative:'}</strong> ${opt.why}</p>`;
      const cont = document.createElement('button');
      cont.type = 'button';
      cont.textContent = 'Continue replay';
      cont.addEventListener('click', () => {
        dlg.__answeredClose = true;
        closeDialog(dlg);
        this.warehouse?.setCalmMode(false);
        this._replay.showCauses(seg.causesVisible, this.replayData.causes);
        this._replay.resolveDecision(opt);
      });
      dlg.append(fb, cont);
      cont.focus();
    };
    for (const opt of shuffled(pp.options, `replay-${key}`)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'choice-btn';
      b.textContent = opt.text;
      b.addEventListener('click', () => {
        if (this._replayAnswers.has(key)) return;
        this._replayAnswers.set(key, opt);
        this.results.replay.push({ segment: seg.id, chosen: opt.id, correct: opt.correct });
        this.record.log('answered', { id: `replay-${seg.id}`, name: pp.question }, { response: opt.id, success: opt.correct });
        b.setAttribute('aria-pressed', 'true');
        showResult(opt);
      });
      buttons.push(b);
      opts.appendChild(b);
    }
    dlg.appendChild(opts);
    dlg.__answeredClose = false;
    // Esc (or any close without "Continue") keeps the replay paused at the decision
    // and says how to get back to it.
    dlg.onclose = () => {
      dlg.onclose = null;
      this.warehouse?.setCalmMode(false);
      if (dlg.__answeredClose || !this._replay?.pausedAtPoint) return;
      this._replay.storyEl.textContent = 'Decision waiting. Press Play to answer it and continue the replay.';
      announce('Replay paused at a decision. Press Play to answer it.');
      this._replayUi.querySelector('[data-replay="play"]')?.focus();
    };
    openDialog(dlg, this._replayUi.querySelector('[data-replay="play"]'));
    const prev = this._replayAnswers.get(key);
    if (prev) {
      buttons[shuffled(pp.options, `replay-${key}`).indexOf(prev)]?.setAttribute('aria-pressed', 'true');
      showResult(prev);
    }
  }

  _module4(body, api) {
    body.appendChild(this._el(`<p>For three hazards from this course, rank the candidate controls. The hierarchy of controls (source: NIOSH, the US National Institute for Occupational Safety and Health): Elimination → Substitution → Engineering → Administrative → PPE.</p>`));
    if (this.engine) {
      body.appendChild(this._el(`<p>In the 3D view you can also click the hazard where it happened — the overhanging pallet, the frayed charging cable, or the misaligned mirror — to rank its controls on the spot.</p>`));
    }
    const host = document.createElement('div');
    body.appendChild(host);
    const showIsIt = () => {
        const isIt = this.controlsData.isItTraining;
        const table = dataTable(['Cause', 'Is it training?', 'Why'], isIt.map((r) => [r.cause, r.verdict, r.because]), '"Is it training?" — performance-consulting view');
        body.appendChild(this._el(`<h3>Is it training?</h3>`));
        body.appendChild(table);
        body.appendChild(this._el(`<p>Some causes are system or layout problems that training alone will not fix — that judgment is part of the job. (See the portfolio's "should-this-be-a-course" thread for the full analysis method.)</p>`));
    };
    const start = () => {
      // Tasks already ranked (here or on the hazard in 3D) keep their result; only the
      // remaining ones are served (interaction review I2-1: one result per task, both ways).
      const remaining = this.controlsData.tasks.filter((t) => !this.results.controls.some((r) => r.taskId === t.id));
      if (!remaining.length) { showIsIt(); return; }
      const activity = new ControlsActivity({
        data: { ...this.controlsData, tasks: remaining },
        container: host,
        onComplete: (results) => {
          this._mergeControls(results);
          this.record.log('completed', { id: 'controls-activity', name: 'Hierarchy of controls ranking' }, { 'response': this.results.controls.map((r) => r.taskId + ':' + (r.perfect ? 'perfect' : 'revised')).join(',') });
          showIsIt();
          this.record.log('experienced', { id: 'is-it-training', name: 'Is it training reflection' });
        },
      });
      activity.next();
    };
    // Finished rankings stay finished when the learner comes back (review N5); partial
    // rankings (e.g. one hazard ranked in 3D) continue where they left off.
    if (this.results.controls.length) {
      host.appendChild(this._el(`<h3>Your rankings</h3>`));
      host.appendChild(dataTable(['Hazard', 'Result'], this.results.controls.map((r) => [
        this.controlsData.tasks.find((t) => t.id === r.taskId)?.hazard ?? r.taskId,
        r.perfect ? 'Follows the hierarchy' : `${r.inversions} pair(s) out of hierarchy order`,
      ]), 'Hierarchy of controls ranking, completed'));
      if (this.results.controls.length < this.controlsData.tasks.length) {
        const cont = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Continue ranking' });
        cont.addEventListener('click', () => { host.innerHTML = ''; start(); host.querySelector('button')?.focus(); });
        host.appendChild(cont);
      }
      const again = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Rank the controls again' });
      again.addEventListener('click', () => { this.results.controls = []; host.innerHTML = ''; start(); host.querySelector('button')?.focus(); });
      host.appendChild(again);
      showIsIt();
    } else start();
  }

  _module5(body, api) {
    body.appendChild(this._el(`<h3>Speak up: report the blocked exit</h3>`));
    body.appendChild(this._el(`<p>Structured model: <strong>Situation → Hazard → Impact → Ask</strong>. You choose; the scenario responds. (Fictional scenario, constructed for teaching.)</p>`));
    if (this.engine) {
      // In-world equivalent (review I2-1/I2-2): the conversation also opens by clicking
      // Supervisor Sam in the 3D scene; this button is its keyboard/pointer equivalent.
      const sam = document.createElement('button');
      sam.type = 'button';
      sam.textContent = 'Open the conversation with Supervisor Sam in 3D';
      sam.addEventListener('click', () => {
        this._show3D();
        this._glideToObject('char-supervisor-sam');
        this._runAction('char-supervisor-sam', { kind: 'speakup' });
      });
      body.appendChild(sam);
    }
    const dlgHost = document.createElement('div');
    dlgHost.className = 'dialogue-host';
    body.appendChild(dlgHost);
    const speakPlayer = new DialoguePlayer({
      data: this.speakupData,
      container: dlgHost,
      onOutcome: (outcome, line) => {
        this.results.speakup = outcome;
        this.record.log('completed', { id: 'speakup', name: 'Speak-up scenario' }, { response: outcome });
        const fb = document.createElement('div');
        fb.className = 'feedback';
        fb.innerHTML = `<p>${line}</p>`;
        dlgHost.appendChild(fb);
        const again = document.createElement('button');
        again.type = 'button';
        again.textContent = 'Try a different approach';
        // Restart only the dialogue (start() clears the host), not the whole module.
        again.addEventListener('click', () => speakPlayer.start());
        dlgHost.appendChild(again);
      },
    });
    if (this.results.speakup) {
      // Coming back to Module 5 shows the outcome reached earlier (review N5).
      const line = Object.values(this.speakupData.nodes).find((n) => n.outcome === this.results.speakup)?.line ?? '';
      dlgHost.appendChild(this._el(`<p class="your-answer">Your earlier outcome: ${this.results.speakup}.</p>`));
      dlgHost.appendChild(Object.assign(document.createElement('div'), { className: 'feedback', innerHTML: `<p>${line}</p>` }));
      const again = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Try a different approach' });
      again.addEventListener('click', () => speakPlayer.start());
      dlgHost.appendChild(again);
    } else speakPlayer.start();

    body.appendChild(this._el(`<h3>Transfer hunt: outbound staging lane (no hints)</h3>`));
    body.appendChild(this._el(`<p>A new zone, no hints. Flag and rate what deserves a report — and leave the controlled conditions alone.</p>`));
    const zone = this.zones[2];
    const table = dataTable(['Area', 'What you can observe'], zone.inspectables.map((i) => [i.area, i.cue]), 'Transfer zone');
    body.appendChild(table);
    for (const item of zone.inspectables) body.appendChild(this._ratingSection(item, zone));
    const refl = this.items.transferReflection;
    body.appendChild(this._el(`<h3>Transfer reflection</h3>`));
    const rf = document.createElement('div');
    rf.innerHTML = `<label for="reflection-input">${refl.prompt}</label><textarea id="reflection-input" rows="4"></textarea>`;
    if (this.results.reflection) rf.querySelector('textarea').value = this.results.reflection;
    const save = document.createElement('button');
    save.type = 'button';
    save.textContent = 'Save reflection';
    const saved = Object.assign(document.createElement('p'), { className: 'feedback', hidden: true, textContent: 'Saved on this device. Reflections are not graded.' });
    saved.setAttribute('role', 'status');
    save.addEventListener('click', () => {
      const text = rf.querySelector('textarea').value.trim();
      if (!text) return;
      this.results.reflection = text;
      this.record.log('responded', { id: 'transfer-reflection', name: 'Transfer reflection' }, { response: text });
      saved.hidden = false;
    });
    rf.append(save, saved);
    body.appendChild(rf);

    // Post-check (alignment matrix: objectives 1, 3, 4, 5), then the completion summary.
    body.appendChild(this._el(`<h3>Post-check</h3>`));
    body.appendChild(this._el(`<p>Five closing questions. Your pre- and post-check scores appear in the summary below.</p>`));
    const summary = document.createElement('section');
    summary.className = 'course-summary';
    summary.setAttribute('aria-live', 'polite');
    for (const item of this.items.postCheck) {
      const previous = this.results.post.find((a) => a.itemId === item.id) || null;
      mcItem({ item, container: body, previous, onAnswered: (a) => {
        this._answer(a, 'post');
        if (this.results.post.length === this.items.postCheck.length) {
          this._renderSummary(summary);
          const s = scoreAnswers(this.results.post);
          this.record.log('completed', { id: 'course', name: 'Hazard Hunt' }, { score: { raw: s.correct, max: this.items.postCheck.length, scaled: s.ratio }, completion: true });
          this.shell.setStatus('Course complete. Your summary is at the end of Module 5.');
        }
      } });
    }
    body.appendChild(summary);
    if (this.results.post.length === this.items.postCheck.length) this._renderSummary(summary);
    body.appendChild(this._el(`<p>The summary appears when all five post-check questions are answered.</p>`));
  }

  /** Log one hunt judgment. Distractors count as success only when judged "not a hazard" (L2/H-1). */
  _flagged(def, result) {
    this.results.hunt[def.id] = { kind: def.kind, classification: result.classification, discriminated: result.discriminated, accurate: result.accurate };
    this.record.log('answered', { id: `hunt-${def.id}`, name: def.area }, {
      response: result.classification,
      success: !!result.accurate,
      extensions: {
        'urn:hazard-hunt:classification': result.classification,
        'urn:hazard-hunt:discriminated': result.discriminated,
        'urn:hazard-hunt:likelihood': result.likelihood ?? null,
        'urn:hazard-hunt:severity': result.severity ?? null,
        'urn:hazard-hunt:band': result.band?.label ?? null,
        'urn:hazard-hunt:referenceBand': result.trueBand?.label ?? null,
      },
    });
    this.hunt._updateHint?.();
  }

  /** Completion summary: pre/post scores, hunt discrimination and rating accuracy, missed hazards. */
  _renderSummary(host) {
    const pre = scoreAnswers(this.results.pre);
    const post = scoreAnswers(this.results.post);
    const judged = Object.entries(this.results.hunt);
    const disc = judged.filter(([, r]) => r.discriminated).length;
    const hazards = judged.filter(([, r]) => r.kind === 'hazard');
    const rated = hazards.filter(([, r]) => r.accurate).length;
    const missed = hazards.filter(([, r]) => !r.discriminated).map(([id]) => this.hunt.byId(id)?.def.label).filter(Boolean);
    host.innerHTML = '<h3 id="summary-h">Course summary</h3>';
    host.appendChild(dataTable(['Measure', 'Result'], [
      ['Pre-check', `${pre.correct} of ${this.items.preCheck.length}`],
      ['Post-check', `${post.correct} of ${this.items.postCheck.length}`],
      ['Hazard or not: correct judgments', `${disc} of ${judged.length} areas judged`],
      ['Hazards rated in the right band', `${rated} of ${hazards.length} hazards judged`],
      ['Hazards you judged as not a hazard', missed.length ? missed.join('; ') : 'None'],
    ], 'Your results (stored on this device only)'));
    host.querySelector('table')?.classList.add('summary-table');
    // The legal disclaimer is repeated at the end of the course (second-pass review N17).
    host.appendChild(this._el(`<p class="disclaimer">This course does not replace training required by law or by your employer.</p>`));
  }

  _answer(a, phase) {
    this.results[phase] = this.results[phase].filter((x) => x.itemId !== a.itemId).concat(a);
    this.record.log('answered', { id: a.itemId, name: 'Check item' }, { response: a.chosen, success: a.correct });
  }

  _textDecision(id, payload) { this._answer(payload, 'pre'); }
}
