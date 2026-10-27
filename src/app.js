/**
 * App controller: 5 modules (Why hazards hide → Practice hunt → Incident replay →
 * Fix it → Speak up + transfer), zone viewpoints, POI list, text mode parity,
 * learning record logging.
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
import { mcItem, scoreAnswers } from './learning/assess.js';

export const SLUG = 'hazard-hunt';
window.__SLUG__ = SLUG;

const MODULES = ['1. Why hazards hide', '2. Practice hunt', '3. Incident replay', '4. Fix it', '5. Speak up + transfer'];

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
    this.results = { pre: [], hunt: {}, replay: [], controls: [], speakup: null, transfer: {} };
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
    this.player = new ShotPlayer({ container: document.getElementById('cinematic-host'), camera: this.engine.camera, motion: this.motion, onDone: () => {} });
    this.player.load(cinematics);
    this._registerTextModes();
    this.gotoModule(0);
    if (window.location.hash === '#play-cinematic') this.player.play();
    if (__TEST_HOOKS__) window.__TEST__ = { app: this, engine: this.engine, hunt: this.hunt, graphCheck: this.graphCheck, shell: this.shell, record: this.record };
  }

  _init3D() {
    if (!hasWebGL2()) {
      this.stage.insertAdjacentHTML('beforeend',
        '<div data-webgl-fallback role="alert"><p>WebGL is not available in this browser. Every objective can be completed in <strong>Text mode</strong>.</p></div>');
      this.engine = null;
      return;
    }
    this.engine = new Engine(document.getElementById('app'));
    this.engine.camera.fov = 65;
    this.engine.camera.updateProjectionMatrix();
    this.warehouse = new Warehouse(this.engine.scene);
    this._loadEnvironment();
    this.input = new Input(document.getElementById('app'));
    this.look = new LookController(this.engine.camera);
    this.input.onPointer((p, kind) => {
      if (kind === 'move' && p.down) this.look.drag(p.dx, p.dy);
      if (kind === 'up' && Math.abs(p.dx) + Math.abs(p.dy) < 4) this._click(p.x, p.y);
    });
    this.input.onKey((code, e) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (code === 'ArrowLeft') this.look.steps({ yaw: -1 });
      if (code === 'ArrowRight') this.look.steps({ yaw: 1 });
      if (code === 'ArrowUp') this.look.steps({ pitch: 1 });
      if (code === 'ArrowDown') this.look.steps({ pitch: -1 });
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
      b.addEventListener('click', () => this.look.steps({ yaw, pitch }));
      lookPad.appendChild(b);
    }
    this.shell.overlays.appendChild(lookPad);
    this.engine.onUpdate(() => {});
    this.engine.start();
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

  _click(x, y) {
    if (!this.engine) return;
    const active = new Set(this._activeZones().flatMap((z) => z.inspectables.map((i) => i.id)));
    if (!active.size) return;
    const nx = (x / window.innerWidth) * 2 - 1;
    const ny = -(y / window.innerHeight) * 2 + 1;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(nx, ny), this.engine.camera);
    const meshes = [...this.warehouse.inspectables.values()].map((v) => v.mesh);
    const hits = ray.intersectObjects(meshes, true);
    if (!hits.length) return;
    let obj = hits[0].object;
    let id = null;
    for (const [iid, v] of this.warehouse.inspectables) {
      if (v.mesh === obj || (obj.parent && v.mesh === obj.parent)) { id = iid; break; }
    }
    if (id && active.has(id)) this._flag(id);
  }

  _flag(id) {
    const found = this.hunt.byId(id);
    if (!found) return;
    if (this.hunt.flags.has(id)) { announce('Already rated'); }
    const dlg = document.getElementById('task-dialog');
    this.hunt.renderRatingDialog(found.def, found.zone, dlg, (result) => {
      closeDialog(dlg);
      const fb = document.createElement('div');
      fb.className = 'feedback hunt-feedback';
      fb.innerHTML = `<p>${result.feedback.replace(/\*\*/g, '')}</p><p>Band legend: Low (●), Medium (▲), High (▲▲). ${BAND_RULE}</p>`;
      this.shell.overlays.querySelector('.hunt-feedback')?.remove();
      this.shell.overlays.appendChild(fb);
      setTimeout(() => fb.remove(), 14000);
      this._refreshPoi();
      const next = { practice: 'Practice zone complete. Continue with Part B, the assessed zone.', assessed: 'Assessed zone complete. Continue to Module 3, the incident replay.', transfer: 'Transfer zone complete.' };
      if (this._zoneComplete(found.zone.id)) {
        this.shell.setStatus(next[found.zone.id]);
        this.record.log('completed', { id: `hunt-zone-${found.zone.id}`, name: found.zone.name });
      }
    });
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
          onSelect: () => { this._gotoView(zone.views[0]); this._flag(item.id); },
        });
      }
    }
  }

  _gotoView(viewId) {
    if (!this.engine) return;
    const v = Warehouse.VIEWS[viewId];
    if (!v) return;
    this.engine.camera.position.set(...v.pos);
    this.look.yaw = v.yaw;
    this.look.pitch = 0;
    this.look.apply();
    announce(`View: ${v.label}`);
  }

  _initDialogs() {
    this.settings = new Settings({ slug: SLUG, dialog: document.getElementById('settings-dialog'), quality: this.engine?.quality, motion: this.motion });
    this.shell.on('settings', (btn) => this.settings.open(btn));
    this.progressPage = new ProgressPage({ slug: SLUG, dialog: document.getElementById('progress-dialog'), record: this.record });
    this.shell.on('progress', (btn) => this.progressPage.open(btn));
    this.shell.on('restart', () => this.gotoModule(this.moduleIndex));
    this.shell.on('textmode', () => {
      const on = !document.getElementById('textmode').hidden;
      if (on) this.textMode.show(MODULES[this.moduleIndex]);
    });
  }

  gotoModule(i) {
    this.moduleIndex = i;
    this.shell.setModule(i);
    document.getElementById('textmode').hidden = false;
    document.getElementById('app').style.visibility = 'hidden';
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
      mcItem({ item, container: body, onAnswered: (a) => this._answer(a, 'pre') });
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
      canvas.style.visibility = 'hidden';
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
        b.addEventListener('click', () => { this._gotoView(v); document.getElementById('app').style.visibility = 'visible'; document.getElementById('textmode').hidden = true; });
        views.appendChild(b);
      }
      body.appendChild(views);
      body.appendChild(this._el(`<p>Click an object to flag it, or use the points-of-interest list on the right. Close text mode to look around in 3D.</p>`));
    }
    body.appendChild(this._el(`<h4>Inspectable areas (all listed; decide which are hazards)</h4>`));
    const table = dataTable(['Area', 'What you can observe'], zone.inspectables.map((i) => [i.area, i.cue]), `${zone.name}: flag and rate each area`);
    body.appendChild(table);
    for (const item of zone.inspectables) {
      const section = document.createElement('section');
      section.className = 'assessment-item';
      section.innerHTML = `<h5>${item.area}</h5><p>${item.cue}</p>`;
      this.hunt.renderRatingDialog(item, zone, section, (result) => {
        const fb = document.createElement('div');
        fb.className = 'feedback';
        fb.innerHTML = `<p>${result.feedback.replace(/\*\*/g, '')}</p>`;
        section.appendChild(fb);
        this._flagged(item, result);
      });
      body.appendChild(section);
    }
    if (zone.hints) {
      const hint = document.createElement('p');
      hint.className = 'hint';
      const updateHint = () => { hint.textContent = this.hunt.hintText(zone, this.hunt.flags.size); };
      updateHint();
      body.appendChild(hint);
      this.hunt._updateHint = updateHint;
    }
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
        for (const opt of pp.options) {
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
        submit.addEventListener('click', () => {
          const sel = fs.querySelector('input:checked');
          if (!sel) return;
          const opt = pp.options.find((o) => o.id === sel.value);
          const fb = document.createElement('div');
          fb.className = 'feedback';
          fb.innerHTML = `<p><strong>${opt.correct ? 'Good decision.' : 'Consider the alternative:'}</strong> ${opt.why}</p>`;
          fs.appendChild(fb);
          this.results.replay.push({ segment: seg.id, chosen: opt.id, correct: opt.correct });
          this.record.log('answered', { id: `replay-${seg.id}`, name: pp.question }, { response: opt.id, success: opt.correct });
          for (const input of fs.querySelectorAll('input')) input.disabled = true;
          submit.disabled = true;
        });
        fs.appendChild(submit);
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

  _startReplay3D() {
    if (this._replay) { this._replay.loadSegment(0); return; }
    const ui = document.createElement('div');
    ui.className = 'replay-ui';
    this.shell.overlays.appendChild(ui);
    const pedestrian = this.warehouse._workers[1];
    this._replay = new ReplayPlayer({
      data: this.replayData,
      truck: this.warehouse._truck,
      pedestrian,
      camera: this.engine.camera,
      ui,
      motion: this.motion,
      onPausePoint: (pp, seg) => {
        const dlg = document.getElementById('task-dialog');
        dlg.innerHTML = `<h2 id="task-h">Decision point</h2><p>${pp.question}</p>`;
        const opts = document.createElement('div');
        opts.setAttribute('role', 'radiogroup');
        opts.setAttribute('aria-label', pp.question);
        for (const opt of pp.options) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'choice-btn';
          b.textContent = opt.text;
          b.addEventListener('click', () => {
            const fb = document.createElement('div');
            fb.className = 'feedback';
            fb.innerHTML = `<p><strong>${opt.correct ? 'Good decision.' : 'Consider the alternative:'}</strong> ${opt.why}</p>`;
            dlg.appendChild(fb);
            this.results.replay.push({ segment: seg.id, chosen: opt.id, correct: opt.correct });
            this.record.log('answered', { id: `replay-${seg.id}`, name: pp.question }, { response: opt.id, success: opt.correct });
            const cont = document.createElement('button');
            cont.type = 'button';
            cont.textContent = 'Continue replay';
            cont.addEventListener('click', () => {
              closeDialog(dlg);
              this._replay.showCauses(seg.causesVisible, this.replayData.causes);
              this._replay.resolveDecision(opt);
            });
            dlg.appendChild(cont);
          });
          opts.appendChild(b);
        }
        dlg.appendChild(opts);
        openDialog(dlg);
      },
      onSegmentEnd: (seg) => {
        this._replay.showCauses(seg.causesVisible, this.replayData.causes);
        if (seg.id === 'seg4') this.record.log('completed', { id: 'replay-complete', name: 'Incident replay' });
        else this._replay.loadSegment(this.replayData.segments.findIndex((s) => s.id === seg.id) + 1);
      },
    });
    this._replay.loadSegment(0);
    this._replay.play();
  }

  _module4(body, api) {
    body.appendChild(this._el(`<p>For each hazard from the replay, rank the candidate controls. The hierarchy of controls (NIOSH, verified in research/sources.md): Elimination → Substitution → Engineering → Administrative → PPE.</p>`));
    const host = document.createElement('div');
    body.appendChild(host);
    const activity = new ControlsActivity({
      data: this.controlsData,
      container: host,
      onComplete: (results) => {
        this.results.controls = results;
        this.record.log('completed', { id: 'controls-activity', name: 'Hierarchy of controls ranking' }, { 'response': results.map((r) => r.taskId + ':' + (r.perfect ? 'perfect' : 'revised')).join(',') });
        const isIt = this.controlsData.isItTraining;
        const table = dataTable(['Cause', 'Is it training?', 'Why'], isIt.map((r) => [r.cause, r.verdict, r.because]), '"Is it training?" — performance-consulting view');
        body.appendChild(this._el(`<h3>Is it training?</h3>`));
        body.appendChild(table);
        body.appendChild(this._el(`<p>Some causes are system or layout problems that training alone will not fix — that judgment is part of the job. (See the portfolio's "should-this-be-a-course" thread for the full analysis method.)</p>`));
        this.record.log('experienced', { id: 'is-it-training', name: 'Is it training reflection' });
      },
    });
    activity.next();
  }

  _module5(body, api) {
    body.appendChild(this._el(`<h3>Speak up: report the blocked exit</h3>`));
    body.appendChild(this._el(`<p>Structured model: <strong>Situation → Hazard → Impact → Ask</strong>. You choose; the scenario responds. (Fictional scenario, constructed for teaching.)</p>`));
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
    speakPlayer.start();

    body.appendChild(this._el(`<h3>Transfer hunt: outbound staging lane (no hints)</h3>`));
    body.appendChild(this._el(`<p>A new zone, no hints. Flag and rate what deserves a report — and leave the controlled conditions alone.</p>`));
    const zone = this.zones[2];
    const table = dataTable(['Area', 'What you can observe'], zone.inspectables.map((i) => [i.area, i.cue]), 'Transfer zone');
    body.appendChild(table);
    for (const item of zone.inspectables) {
      const section = document.createElement('section');
      section.className = 'assessment-item';
      section.innerHTML = `<h4>${item.area}</h4><p>${item.cue}</p>`;
      this.hunt.renderRatingDialog(item, zone, section, (result) => this._flagged(item, result));
      body.appendChild(section);
    }
    const refl = this.items.transferReflection;
    body.appendChild(this._el(`<h3>Transfer reflection</h3><p>${refl.prompt}</p>`));
  }

  _flagged(def, result) {
    this.results.hunt[def.id] = { kind: def.kind, accurate: result.accurate ?? true, score: result.score, trueScore: result.trueScore };
    this.record.log('answered', { id: `hunt-${def.id}`, name: def.label || def.area }, { response: `L${result.score / (result.trueScore || 1) > 0 ? result.score : 0}`, success: def.kind === 'hazard' ? result.accurate : true });
    this.hunt._updateHint?.();
  }

  _answer(a, phase) {
    this.results[phase].push(a);
    this.record.log('answered', { id: a.itemId, name: 'Check item' }, { response: a.chosen, success: a.correct });
  }

  _textDecision(id, payload) { this._answer(payload, 'pre'); }
}
