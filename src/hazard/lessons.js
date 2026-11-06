/**
 * lessons.js — the five Hazard Hunt modules in the v3 scene-first shell
 * (plan 10 §2, §6.4): a Now card per step (goal, step x of y, one action, a
 * hint, one primary button; at most 60 words), drawers for the longer work
 * (rating forms, the causes chart, the controls ranking, the speak-up
 * conversation, the reflection and the summary), and a text-mode page per
 * module with the same decisions and the same record (text-mode parity).
 *
 * One answer per item across the Now card, the drawers and text mode: every
 * path writes the same state (`this.results`, `this.hunt.flags`).
 * Task objects show only what can be seen until the learner judges them
 * (DECISIONS #24, #29): their catalog `more` and `whyItMatters` stay hidden
 * until then (`_lockVerdicts`).
 * @module hazard/lessons
 */
import { HuntController, BAND_RULE } from '../systems/hazard-hunt.js';
import { ControlsActivity } from '../systems/controls-activity.js';
import { DialoguePlayer, validateGraph } from '../systems/dialogue.js';
import { mcItem, scoreAnswers, shuffled } from '../learning/assess.js';
import { dataTable } from '../a11y/text-mode.js';
import { VIEWS } from './layout.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const btn = (label, onClick, cls = 'v3-btn') => { const b = el('button', cls, label); b.type = 'button'; b.addEventListener('click', onClick); return b; };
const DISCLAIMER = 'This course does not replace training required by law or by your employer.';
/** Control tasks that open from a hazard's card in Module 4. */
export const CONTROL_TASK_BY_ITEM = { 'hazard-overhang': 'controls-overhang', 'hazard-frayed-cable': 'controls-frayed-cable', 'hazard-misaligned-mirror': 'controls-mirror' };
export const CAUSE_LEVELS = ['condition', 'behavior', 'system'];

export class Lessons {
  /** @param {{ slug: string, content: { zones, items, replay, controls, speakup } }} o */
  constructor(o) {
    this.slug = o.slug;
    this.items = o.content.items;
    this.controls = o.content.controls;
    this.speakup = o.content.speakup;
    this.replayContent = o.content.replay;
    this.zones = o.content.zones.zones;
    this.replay = null;
    this.graphCheck = validateGraph(this.speakup);
    this.hunt = new HuntController({ zones: this.zones, onFlagged: () => {} });
    this.results = { pre: [], post: [], hunt: {}, replay: new Map(), controls: [], speakup: null, reflection: null, causes: null };
    this.step = [0, 0, 0, 0, 0];
    this.app = null;
    this.record = { log() {} };
    this._verdicts = new Map();
  }

  // ---------------------------------------------------------------- wiring
  bind(app, bay) {
    this.app = app;
    this.bay = bay;
    this.record = app.record;
    this._lockVerdicts();
    const inspect = app.inspect;
    if (inspect) {
      inspect.on('open', (id) => this._cardActions(id));
      inspect.on('open', () => { if (this.replay?.playing) this.replay.pause(); });
    }
  }

  /** Hide a task object's verdict text (catalog more / whyItMatters) until it is judged. */
  _lockVerdicts() {
    for (const z of this.zones) for (const it of z.inspectables) {
      const e = this.app.catalog.get(it.id);
      if (!e || this._verdicts.has(it.id)) continue;
      this._verdicts.set(it.id, { more: e.more, whyItMatters: e.whyItMatters });
      if (!this.hunt.flags.has(it.id)) { e.more = ''; e.whyItMatters = ''; }
    }
  }
  _unlockVerdict(id) {
    const e = this.app?.catalog.get(id), v = this._verdicts.get(id);
    if (e && v) Object.assign(e, v);
  }

  /** The zones whose areas can be judged in the current module and step. */
  activeZones(i = this.app?.module, k = this.step[i]) {
    if (i === 1) return [this.zones[k === 1 ? 1 : 0]].filter(() => k < 2);
    if (i === 4 && k === 1) return [this.zones[2]];
    return [];
  }

  /** In-world actions on an object's info card: Judge this area, Rank the controls, Talk to Grace. */
  _cardActions(id) {
    const card = this.app.inspect.card;
    card.querySelectorAll('[data-hh-action]').forEach((b) => b.remove());
    const actions = card.querySelector('.v3-card-actions');
    const add = (label, fn) => {
      const b = btn(label, fn, 'v3-btn v3-primary');
      b.dataset.hhAction = label;
      actions.prepend(b);
    };
    const zone = this.activeZones().find((z) => z.inspectables.some((x) => x.id === id));
    if (zone) add(this.hunt.flags.has(id) ? 'See my answer' : 'Judge this area', () => this.openJudge(id));
    if (this.app.module === 3 && this.step[3] === 0 && CONTROL_TASK_BY_ITEM[id]) add('Rank the controls', () => this.openRanking(CONTROL_TASK_BY_ITEM[id]));
    if (this.app.module === 4 && this.step[4] === 0 && id === 'grace-supervisor') add('Talk to Grace', () => this.openSpeakUp());
    this.app.inspect._placeCard(true);
  }

  /** Legend for the in-world cues (shell menu, plan 10 §4.2). */
  legend() {
    return [
      { label: 'Blue spot on the floor', text: 'A blue light the forklift projects on the floor ahead of it, so people see it coming round a corner. It is a real safety feature; this course has no sound.' },
      { label: 'Amber beacon', text: 'The flashing light on the forklift roof: a truck is working nearby.' },
      { label: 'Outline and name', text: 'Point at or tab to anything to see its name. Hazards, safe conditions and everyday items all look the same until you judge them.' },
    ];
  }

  // ---------------------------------------------------------------- module list
  modules() {
    const m = (id, label, view, text, extra = {}) => ({ id, label, view, text, now: () => this.nowFor(this._index(id)), enter: () => this._enter(this._index(id)), ...extra });
    this._ids = ['why', 'hunt', 'replay', 'fix', 'speak'];
    return [
      m('why', 'Why hazards hide', VIEWS.overview, (el2) => this._text1(el2)),
      m('hunt', 'Practice hunt', VIEWS.practice, (el2) => this._text2(el2)),
      m('replay', 'Incident replay', VIEWS.aisleWest, (el2) => this._text3(el2)),
      m('fix', 'Fix it', VIEWS.assessed, (el2) => this._text4(el2)),
      m('speak', 'Speak up', VIEWS.grace, (el2) => this._text5(el2)),
    ];
  }
  _index(id) { return this._ids.indexOf(id); }

  /** Steps per module (for the stepper totals and the unit test). */
  get steps() {
    return [
      ['m1-walk', 'm1-pre1', 'm1-pre2', 'm1-pre3', 'm1-pre4', 'm1-pre5', 'm1-done'],
      ['m2-practice', 'm2-assessed', 'm2-done'],
      ['m3-intro', 'm3-replay', 'm3-causes'],
      ['m4-rank', 'm4-training'],
      ['m5-speak', 'm5-transfer', 'm5-reflect', 'm5-post1', 'm5-post2', 'm5-post3', 'm5-post4', 'm5-post5', 'm5-summary'],
    ];
  }

  _enter(i) {
    this.step[i] = Math.min(this.step[i], this.steps[i].length - 1);
    if (i !== 2) this.replay?.close();
    this._applyStep(i, false);
  }

  /** Camera, calm mode and scene state for the current step. */
  _applyStep(i, fly = true) {
    const app = this.app;
    if (!app || app.sceneless) return;
    const k = this.step[i];
    const id = this.steps[i][k];
    const quiz = /pre\d|post\d/.test(id);
    app.motion.setCalm(quiz);
    const view = { 'm2-assessed': VIEWS.assessed, 'm5-transfer': VIEWS.staging, 'm4-rank': VIEWS.assessed }[id];
    if (fly && view) app.rig.flyTo(view, 1.1);
  }

  goStep(i, k) {
    this.step[i] = k;
    this._applyStep(i);
    this.refresh();
  }

  refresh() {
    const app = this.app;
    if (!app || app.module < 0 || app.onboarding?.active) return;
    const n = this.nowFor(app.module);
    app.shell.setNow(n);
    // An answered question shows its answer and feedback again.
    if (n.question?.answered) {
      const b = app.shell.now.querySelector(`[data-choice="${n.question.answered}"]`);
      if (b) { const r = n.question.onAnswer(n.question.answered); b.dataset.result = r.correct ? 'correct' : 'incorrect'; b.setAttribute('aria-pressed', 'true'); const fb = app.shell.now.querySelector('.v3-feedback'); if (fb) fb.textContent = r.feedback; }
    }
    if (!app.shell.textModeRoot.hidden) app.shell.setTextModeRenderer(app.shell._textRender);
  }

  // ---------------------------------------------------------------- Now cards
  nowFor(i) {
    const k = this.step[i];
    const id = this.steps[i][k];
    const touch = this.app?.shell?.touch;
    const click = touch ? 'Tap' : 'Click';
    const total = this.steps[i].length;
    const base = { step: k + 1, total };
    switch (id) {
      case 'm1-walk': return {
        ...base, goal: 'Walk into Bay 4',
        action: touch ? 'Look around the night shift. Drag to look and push the joystick to walk. Then press Next step.' : 'Look around the night shift. Drag to look and walk with W A S D. Then press Next step.',
        hint: `${click} anything to learn what it is.`,
        primary: { label: 'Next step', onClick: () => this.goStep(0, 1) },
        secondary: { label: 'Watch the shift start', play: true, onClick: () => this.app.playCinematic() },
        readMore: { title: 'About this course', render: (b) => this._about(b) },
      };
      case 'm1-pre1': case 'm1-pre2': case 'm1-pre3': case 'm1-pre4': case 'm1-pre5': {
        const n = Number(id.slice(-1));
        const item = this.items.preCheck[n - 1];
        const done = this.results.pre.some((a) => a.itemId === item.id);
        return {
          kicker: `Pre-check ${n} of 5`, goal: 'Check what you know',
          question: this._question(item, 'pre'),
          primary: { label: n < 5 ? 'Next question' : 'Finish the pre-check', disabled: !done, onClick: () => this.goStep(0, k + 1) },
        };
      }
      case 'm1-done': {
        const s = scoreAnswers(this.results.pre);
        return { ...base, goal: 'Pre-check done', action: 'Press Next module to start the practice hunt.', result: `${s.correct} of 5 right. The post-check at the end uses new questions.`, primary: { label: 'Next module', onClick: () => this.app.completeModule(0) } };
      }
      case 'm2-practice': case 'm2-assessed': {
        const zone = this.zones[id === 'm2-practice' ? 0 : 1];
        const n = this._judged(zone), all = zone.inspectables.length;
        return {
          kicker: id === 'm2-practice' ? 'Part A of 2 · hints on' : 'Part B of 2 · no hints',
          goal: id === 'm2-practice' ? 'Hunt the dock and charging area' : 'Hunt the racks and packing bench',
          action: `Find the ${all} areas to judge. ${click} one, then press Judge this area on its card.`,
          result: `${n} of ${all} judged.`,
          hint: id === 'm2-practice' ? this._warmHint(zone) : 'Some things only look risky. Leave controlled conditions alone.',
          primary: id === 'm2-practice'
            ? { label: 'Go to Part B', disabled: n < all, onClick: () => this.goStep(1, 1) }
            : { label: 'Finish the hunt', disabled: n < all, onClick: () => this.goStep(1, 2) },
          secondary: { label: 'List the areas', onClick: () => this.openAreas(zone) },
        };
      }
      case 'm2-done': {
        const r = this._huntScore([this.zones[0], this.zones[1]]);
        return { ...base, goal: 'Hunt done', action: 'Press Next module to replay a near-miss.', result: `You told hazards apart in ${r.disc} of ${r.judged} areas. ${r.band} of ${r.hazards} hazards were rated in the right band.`, primary: { label: 'Next module', onClick: () => this.app.completeModule(1) } };
      }
      case 'm3-intro': return {
        ...base, goal: 'Replay a near-miss', action: 'Press Start the replay. You set the pace and make two decisions.',
        result: 'This near-miss is fictional, made for teaching. Nobody is hurt.',
        primary: { label: 'Start the replay', onClick: () => { this.goStep(2, 1); this._startReplay(); } },
      };
      case 'm3-replay': return this._replayCard(base);
      case 'm3-causes': {
        const c = this.results.causes;
        return {
          ...base, goal: 'Sort the causes',
          action: c ? 'Press Next module to fix the hazards.' : 'Press Open the causes chart. Sort each cause as a condition, a behaviour or a system.',
          result: c ? `${c.right} of 5 causes sorted to the right level.` : undefined,
          primary: c ? { label: 'Next module', onClick: () => this.app.completeModule(2) } : { label: 'Open the causes chart', onClick: (e) => this.openCauses() },
          secondary: c ? { label: 'Open the causes chart', onClick: () => this.openCauses() } : undefined,
        };
      }
      case 'm4-rank': {
        const n = this.results.controls.length;
        return {
          ...base, goal: 'Rank the controls',
          action: n < 3 ? `Rank the controls for three hazards. Press Rank the controls, or ${click.toLowerCase()} the overhanging pallet, the frayed cable or the mirror.` : 'Press Next step.',
          result: `${n} of 3 ranked.`,
          hint: 'Most effective first: remove, replace, engineer, change the work, then PPE.',
          primary: n < 3 ? { label: 'Rank the controls', onClick: () => this.openRanking() } : { label: 'Next step', onClick: () => this.goStep(3, 1) },
        };
      }
      case 'm4-training': return {
        ...base, goal: 'Is it training?', action: 'Press Open Is it training and read which causes training can fix. Then press Next module.',
        primary: { label: 'Next module', onClick: () => this.app.completeModule(3) },
        secondary: { label: 'Open Is it training', onClick: () => this.openTraining() },
      };
      case 'm5-speak': {
        const o = this.results.speakup;
        return {
          ...base, goal: 'Report the blocked exit',
          action: o ? 'Press Next step for the transfer hunt.' : `Grace, the supervisor, is at her desk by the dock. ${click} her, or press Talk to Grace.`,
          result: o ? `Your report: ${{ strong: 'strong', mixed: 'mixed', poor: 'not made' }[o]}.` : undefined,
          primary: o ? { label: 'Next step', onClick: () => this.goStep(4, 1) } : { label: 'Talk to Grace', onClick: () => this.openSpeakUp() },
          secondary: o ? { label: 'Talk to Grace again', onClick: () => this.openSpeakUp() } : undefined,
        };
      }
      case 'm5-transfer': {
        const zone = this.zones[2];
        const n = this._judged(zone), all = zone.inspectables.length;
        return {
          ...base, goal: 'Transfer hunt: the staging lane',
          action: `A new area, no hints. Find the ${all} areas to judge. ${click} one, then press Judge this area.`,
          result: `${n} of ${all} judged.`,
          primary: { label: 'Next step', disabled: n < all, onClick: () => this.goStep(4, 2) },
          secondary: { label: 'List the areas', onClick: () => this.openAreas(zone) },
        };
      }
      case 'm5-reflect': return {
        ...base, goal: 'Think about your own work',
        action: this.results.reflection ? 'Saved. Press Next step for the post-check.' : 'Press Write your reflection. It is not graded and stays on this device. Or press Next step.',
        primary: { label: 'Next step', onClick: () => this.goStep(4, 3) },
        secondary: { label: 'Write your reflection', onClick: () => this.openReflection() },
      };
      case 'm5-post1': case 'm5-post2': case 'm5-post3': case 'm5-post4': case 'm5-post5': {
        const n = Number(id.slice(-1));
        const item = this.items.postCheck[n - 1];
        const done = this.results.post.some((a) => a.itemId === item.id);
        return {
          kicker: `Post-check ${n} of 5`, goal: 'Check what you learned',
          question: this._question(item, 'post'),
          primary: { label: n < 5 ? 'Next question' : 'See my results', disabled: !done, onClick: () => this.goStep(4, k + 1) },
        };
      }
      case 'm5-summary': {
        const pre = scoreAnswers(this.results.pre), post = scoreAnswers(this.results.post);
        return {
          ...base, goal: 'Course complete', action: 'Press Open the course summary to see all your results.',
          result: `Pre-check ${pre.correct} of 5, post-check ${post.correct} of 5. ${DISCLAIMER}`,
          primary: { label: 'Open the course summary', onClick: () => this.openSummary() },
        };
      }
      default: return { goal: 'Hazard Hunt', action: 'Press Next step.' };
    }
  }

  /** A pre- or post-check item as a Now-card question (one answer per item, all paths). */
  _question(item, phase) {
    const prev = this.results[phase].find((a) => a.itemId === item.id);
    return {
      prompt: item.short?.prompt || item.prompt,
      choices: shuffled(item.options, item.id).map((o) => ({ id: o.id, text: item.short?.options?.[o.id] || o.text })),
      answered: prev?.chosen,
      onAnswer: (choice) => {
        const first = this.results[phase].find((a) => a.itemId === item.id);
        const chosen = first ? first.chosen : choice;
        const opt = item.options.find((o) => o.id === chosen);
        const correct = chosen === item.correct;
        if (!first) this._answer({ itemId: item.id, correct, chosen }, phase);
        this._enablePrimary();
        const lead = first && first.chosen !== choice ? 'You answered this already. ' : '';
        return { correct, feedback: `${lead}${correct ? 'Correct.' : 'Not quite.'} ${opt.whyShort || opt.why}` };
      },
    };
  }

  _enablePrimary() {
    const b = this.app?.shell?.now?.querySelector?.('[data-action="now-primary"]');
    if (b) b.disabled = false;
  }

  _answer(a, phase) {
    this.results[phase] = this.results[phase].filter((x) => x.itemId !== a.itemId).concat(a);
    this.record.log('answered', { id: a.itemId, name: phase === 'pre' ? 'Pre-check item' : 'Post-check item' }, { response: a.chosen, success: a.correct });
    if (phase === 'post' && this.results.post.length === this.items.postCheck.length) {
      const s = scoreAnswers(this.results.post);
      this.record.log('completed', { id: 'course', name: 'Hazard Hunt' }, { score: { raw: s.correct, max: this.items.postCheck.length, scaled: s.ratio }, completion: true });
      this.app?.shell?.setModuleDone?.(4, true);
    }
  }

  _judged(zone) { return zone.inspectables.filter((i) => this.hunt.flags.has(i.id)).length; }
  _warmHint(zone) {
    const next = zone.inspectables.find((i) => i.kind === 'hazard' && !this.hunt.flags.has(i.id) && i.hintWarm);
    return next ? `Hint: ${next.hintWarm}` : 'Hint: every area in the list gets one judgement.';
  }
  _huntScore(zones) {
    const ids = new Set(zones.flatMap((z) => z.inspectables.map((i) => i.id)));
    const judged = Object.entries(this.results.hunt).filter(([id]) => ids.has(id));
    const hazards = judged.filter(([, r]) => r.kind === 'hazard');
    return { judged: judged.length, disc: judged.filter(([, r]) => r.discriminated).length, hazards: hazards.length, band: hazards.filter(([, r]) => r.accurate).length };
  }

  // ---------------------------------------------------------------- hunt: judge an area
  /** The "Areas to judge" drawer: every area of the zone (hazards and not), so the list gives nothing away. */
  openAreas(zone) {
    const shell = this.app.shell;
    shell.openDrawer({
      title: 'Areas to judge', key: 'areas',
      render: (b) => {
        b.append(el('p', null, `${zone.name}. Every area here gets one judgement: a hazard, a controlled condition, or acceptable.`));
        const ul = el('ul', 'hh-areas');
        for (const it of zone.inspectables) {
          const li = el('li');
          const done = this.hunt.flags.has(it.id);
          const name = this.app.catalog.get(it.id)?.name || it.area;
          const b2 = btn(`${done ? '✓ ' : ''}${name}`, (ev) => {
            shell.closeDrawer();
            if (this.app.inspect) this.app.inspect.open(it.id, { via: ev.detail === 0 ? 'keyboard' : 'pointer' });
            else this.openJudge(it.id);
          }, 'v3-list-btn');
          b2.dataset.areaId = it.id;
          li.append(b2);
          ul.append(li);
        }
        b.append(ul);
      },
    });
  }

  /** The "Judge this area" drawer: the rating form, or the answer already given. */
  openJudge(id) {
    const found = this.hunt.byId(id);
    if (!found) return;
    const app = this.app;
    app.inspect?.close({ restore: false });
    app.motion?.setCalm(true);
    app.shell.openDrawer({
      title: 'Judge this area', key: 'judge',
      onClose: () => { if (app.motion) this._applyStep(app.module, false); this.refresh(); },
      render: (b) => this._judgeForm(b, found.def, found.zone, true),
    });
  }

  /** Rating form (or the stored answer with "Change my answer"); used by the drawer and text mode. */
  _judgeForm(host, def, zone, inDrawer = false) {
    host.innerHTML = '';
    const sec = el('section', 'assessment-item hh-judge');
    sec.dataset.item = def.id;
    host.append(sec);
    const prev = this.hunt.flags.get(def.id);
    const name = this.app?.catalog?.get(def.id)?.name;
    if (prev) {
      sec.append(el('h3', null, def.area), el('p', null, def.cue), el('p', 'your-answer', `Your answer: ${this._describe(prev.result)}`));
      const fb = el('div', 'feedback');
      fb.append(el('p', null, prev.result.feedback.replace(/\*\*/g, '')));
      sec.append(fb);
      const again = btn('Change my answer', () => { this.hunt.flags.delete(def.id); this._judgeForm(host, def, zone, inDrawer); host.querySelector('input')?.focus(); });
      again.setAttribute('aria-label', `Change my answer: ${def.area}`);
      sec.append(again);
      return sec;
    }
    this.hunt.renderRatingDialog(def, zone, sec, (result) => {
      this._flagged(def, result);
      this._judgeForm(host, def, zone, inDrawer);
      const fb = host.querySelector('.feedback');
      if (inDrawer && fb) { fb.tabIndex = -1; this.app.shell.revealInDrawer(fb); }
      this.refresh();
    });
    sec.querySelector('h3').after(el('p', null, def.cue));
    if (name) sec.querySelector('h3').before(el('p', 'v3-kicker', name));
    sec.querySelector('button')?.classList.add('v3-btn', 'v3-primary');
    return sec;
  }

  _describe(r) {
    if (r.classification === 'hazard') return `a hazard to report, likelihood ${r.likelihood} × severity ${r.severity} (${r.band?.label}).`;
    return r.classification === 'controlled' ? 'a controlled condition.' : 'acceptable, nothing to report.';
  }

  /** Log one judgement. A distractor counts as success only when judged "not a hazard". */
  _flagged(def, result) {
    this.results.hunt[def.id] = { kind: def.kind, classification: result.classification, discriminated: result.discriminated, accurate: result.accurate };
    this._unlockVerdict(def.id);
    this.record.log('answered', { id: `hunt-${def.id}`, name: def.area }, {
      response: result.classification, success: !!result.accurate,
      extensions: {
        'urn:hazard-hunt:classification': result.classification,
        'urn:hazard-hunt:discriminated': result.discriminated,
        'urn:hazard-hunt:likelihood': result.likelihood ?? null,
        'urn:hazard-hunt:severity': result.severity ?? null,
        'urn:hazard-hunt:band': result.band?.label ?? null,
        'urn:hazard-hunt:referenceBand': result.trueBand?.label ?? null,
      },
    });
    for (const z of this.zones) if (z.inspectables.every((i) => this.hunt.flags.has(i.id)) && !this._zoneLogged?.has(z.id)) {
      (this._zoneLogged ||= new Set()).add(z.id);
      this.record.log('completed', { id: `hunt-zone-${z.id}`, name: z.name });
    }
  }

  // ---------------------------------------------------------------- Module 3: replay
  _startReplay() {
    if (!this.replay || !this.app.inspect) return;
    const go = () => { this.replay.open(0); this.refresh(); };
    if (this.bay?.ready.people && this.bay?.replayTruck) go();
    else { this.app.shell.toast('Loading the replay…'); Promise.all([this.bay.loadProps(), this.bay.loadPeople()]).then(() => this.bay.ensureReplayActors()).then(go); }
  }

  _replayCard(base) {
    const R = this.replay;
    const seg = R ? R.seg : this.replay?.seg;
    const i = R ? R.i : 0;
    const pp = R?.pending;
    const name = (seg?.name || '').replace(/^\d+\.\s*/, '');
    if (pp) {
      const key = `${seg.id}@${pp.at}`;
      const prev = this.results.replay.get(key);
      return {
        kicker: `Segment ${i + 1} of 4 · decision`, goal: name,
        question: {
          prompt: pp.questionShort || pp.question,
          choices: shuffled(pp.options, `replay-${key}`).map((o) => ({ id: o.id, text: o.short || o.text })),
          onAnswer: (id) => {
            const first = this.results.replay.get(key);
            const opt = first || pp.options.find((o) => o.id === id);
            if (!first) this._replayAnswer(seg, pp, opt);
            this._enablePrimary();
            return { correct: opt.correct, feedback: `${first && first.id !== id ? 'You answered this already. ' : ''}${opt.whyShort || opt.why}` };
          },
        },
        primary: { label: 'Continue the replay', disabled: !prev, onClick: () => { R.pending = null; R.resolve(pp); this.refresh(); } },
        readMore: { label: 'Read the full story', title: 'Replay: the full story', render: (b) => this._story(b) },
      };
    }
    const ended = R?.ended.has(seg?.id);
    const last = i === 3;
    return {
      kicker: `Segment ${i + 1} of 4`, goal: name,
      action: seg?.storyShort || seg?.story || 'Press Play.',
      tool: (box) => this._replayTool(box),
      primary: last
        ? { label: 'Sort the causes', disabled: !ended, onClick: () => { R.close(); this.goStep(2, 2); } }
        : { label: 'Next segment', disabled: !ended, onClick: () => { R.next(); this.refresh(); } },
      readMore: { label: 'Read the full story', title: 'Replay: the full story', render: (b) => this._story(b) },
    };
  }

  _replayTool(box) {
    const R = this.replay;
    const row = el('div', 'hh-replay-tool');
    const play = btn(R?.playing ? 'Pause' : 'Play', () => { if (R.playing) R.pause(); else R.play(); });
    play.dataset.replay = 'play';
    const again = btn('Restart segment', () => R.restart());
    const clock = el('span', 'hh-clock', R ? R.clock() : '0:00');
    clock.setAttribute('aria-live', 'off');
    row.append(play, again, clock);
    box.append(row);
    this._replayUi = { play, clock };
  }

  _replayAnswer(seg, pp, opt) {
    const key = `${seg.id}@${pp.at}`;
    this.results.replay.set(key, opt);
    this.record.log('answered', { id: `replay-${seg.id}`, name: pp.question }, { response: opt.id, success: opt.correct });
  }

  _story(b) {
    for (const s of this.replay?.segments || this.replayData().segments) {
      b.append(el('h3', null, s.name), el('p', null, s.story));
      for (const pp of s.pausePoints || []) {
        const a = this.results.replay.get(`${s.id}@${pp.at}`);
        if (a) b.append(el('p', null, `Decision: ${pp.question} Your answer: ${a.text} ${a.why}`));
      }
    }
  }
  replayData() { return this.replay?.data || this.replayContent; }

  /** Called by main.js once the bay and its replay actors exist. */
  attachReplay(replay) {
    this.replay = replay;
    replay.onPause = (seg, pp) => { replay.pending = pp; this.refresh(); };
    replay.onSegmentEnd = (seg) => {
      if (seg.id === 'seg4') this.record.log('completed', { id: 'replay-complete', name: 'Incident replay' });
      this.refresh();
    };
    replay.onChange = () => this._syncReplayUi();
  }
  _syncReplayUi() {
    const u = this._replayUi, R = this.replay;
    if (!u || !R) return;
    u.play.textContent = R.playing ? 'Pause' : 'Play';
    u.clock.textContent = R.clock();
    const prim = this.app.shell.now.querySelector('[data-action="now-primary"]');
    if (prim && R.ended.has(R.seg.id) && !R.pending) prim.disabled = false;
  }

  // ---------------------------------------------------------------- Module 3: causes chart
  openCauses() {
    this.app.shell.openDrawer({ title: 'Causes chart', key: 'causes', onClose: () => this.refresh(), render: (b) => this._causesChart(b, true) });
  }

  /** Sort each cause by level (condition, behaviour, system), then check. Used by the drawer and text mode. */
  _causesChart(host, inDrawer = false) {
    host.innerHTML = '';
    const causes = this.replay?.data?.causes || this.replayContent.causes;
    host.append(el('p', null, 'Five causes sit behind the near-miss. Choose the level of each one: a condition of the workplace, a behaviour of a person, or a system that made the unsafe state easy.'));
    const form = el('div', 'hh-causes');
    const prev = this.results.causes;
    const label = { condition: 'Condition', behavior: 'Behaviour', system: 'System' };
    for (const c of causes) {
      const row = el('div', 'hh-cause');
      const id = `cause-${c.id}${inDrawer ? '-d' : '-t'}`;
      const lab = el('label', null, c.label);
      lab.htmlFor = id;
      const sel = el('select');
      sel.id = id;
      sel.dataset.cause = c.id;
      sel.append(new Option('Choose a level', ''), ...CAUSE_LEVELS.map((l) => new Option(label[l], l)));
      if (prev) { sel.value = prev.choices[c.id] || ''; }
      row.append(lab, sel);
      form.append(row);
    }
    host.append(form);
    const out = el('div', 'hh-causes-result');
    out.setAttribute('role', 'status');
    const check = btn('Check my chart', () => {
      const choices = Object.fromEntries([...form.querySelectorAll('select')].map((s) => [s.dataset.cause, s.value]));
      if (Object.values(choices).some((v) => !v)) { out.textContent = 'Choose a level for every cause first.'; return; }
      const right = causes.filter((c) => choices[c.id] === c.level).length;
      this.results.causes = { choices, right };
      this.record.log('answered', { id: 'causes-chart', name: 'Contributing-causes chart' }, { response: JSON.stringify(choices), success: right === causes.length, score: { raw: right, max: causes.length } });
      this._causesResult(out, causes, choices);
      if (inDrawer) { out.tabIndex = -1; this.app.shell.revealInDrawer(out); }
      this.refresh();
    }, 'v3-btn v3-primary');
    host.append(check, out);
    if (prev) this._causesResult(out, causes, prev.choices);
  }

  _causesResult(out, causes, choices) {
    out.innerHTML = '';
    const right = causes.filter((c) => choices[c.id] === c.level).length;
    out.append(el('p', null, `${right} of ${causes.length} at the right level.`));
    out.append(dataTable(['Cause', 'Level', 'Why it matters'], causes.map((c) => [`${choices[c.id] === c.level ? '✓' : '✗'} ${c.label}`, c.level, c.why]), 'The causes behind the near-miss, by level'));
    out.append(el('p', null, 'System causes are the ones a fix lasts longest for: they make the unsafe state the easy state.'));
  }

  // ---------------------------------------------------------------- Module 4: controls
  openRanking(taskId = null) {
    const app = this.app;
    app.inspect?.close({ restore: false });
    app.shell.openDrawer({ title: 'Rank the controls', key: 'rank', onClose: () => this.refresh(), render: (b) => this._ranking(b, taskId, true) });
  }

  /** Ranking activity for the tasks not yet ranked (or one task); used by the drawer and text mode. */
  _ranking(host, taskId = null, inDrawer = false) {
    host.innerHTML = '';
    const data = this.controls;
    host.append(el('p', null, 'Hierarchy of controls (NIOSH, the US National Institute for Occupational Safety and Health), most to least effective: elimination, substitution, engineering controls, administrative controls, PPE.'));
    const remaining = data.tasks.filter((t) => !this.results.controls.some((r) => r.taskId === t.id) && (!taskId || t.id === taskId));
    if (this.results.controls.length) {
      host.append(dataTable(['Hazard', 'Result'], this.results.controls.map((r) => [data.tasks.find((t) => t.id === r.taskId)?.hazard ?? r.taskId, r.perfect ? 'Follows the hierarchy' : `${r.inversions} pair(s) out of hierarchy order`]), 'Your rankings so far'));
    }
    if (!remaining.length) {
      host.append(el('p', null, this.results.controls.length >= data.tasks.length ? 'All three hazards are ranked.' : 'That hazard is ranked. Press Rank the controls for the others.'));
      const again = btn('Rank them again', () => { this.results.controls = []; this._ranking(host, null, inDrawer); this.refresh(); });
      host.append(again);
      return;
    }
    const box = el('div', 'hh-rank');
    host.append(box);
    const act = new ControlsActivity({
      data: { ...data, tasks: remaining }, container: box,
      onComplete: () => {
        this.record.log('completed', { id: 'controls-activity', name: 'Hierarchy of controls ranking' }, { response: this.results.controls.map((r) => `${r.taskId}:${r.perfect ? 'perfect' : 'revised'}`).join(',') });
        this._ranking(host, null, inDrawer);
        if (inDrawer) { const f = host.querySelector('table') || host.firstElementChild; f.tabIndex = -1; this.app.shell.revealInDrawer(f); }
        this.refresh();
      },
    });
    // Each submitted ranking counts at once (the learner may close the drawer between hazards).
    const render = act._renderTask.bind(act);
    act._renderTask = (task) => {
      render(task);
      const submit = [...box.querySelectorAll('button')].find((b) => b.textContent === 'Submit ranking');
      submit?.classList.add('v3-btn', 'v3-primary');
      submit?.addEventListener('click', () => {
        const r = act.results.at(-1);
        if (!r) return;
        this.results.controls = this.results.controls.filter((x) => x.taskId !== r.taskId).concat(r);
        const next = [...box.querySelectorAll('button')].find((b) => b.textContent === 'Next hazard');
        if (next) { next.classList.add('v3-btn'); if (act.taskIndex >= act.data.tasks.length - 1) next.textContent = 'Finish ranking'; next.focus(); }
        this.refresh();
      });
    };
    act.next();
  }

  openTraining() {
    this.app.shell.openDrawer({ title: 'Is it training', key: 'training', render: (b) => this._training(b) });
  }
  _training(b) {
    b.append(el('p', null, 'Some causes are system or layout problems that training alone will not fix. Telling them apart is part of the job.'));
    b.append(dataTable(['Cause', 'Is it training?', 'Why'], this.controls.isItTraining.map((r) => [r.cause, r.verdict, r.because]), 'Is it training? A performance-consulting view'));
    this.record.log('experienced', { id: 'is-it-training', name: 'Is it training reflection' });
  }

  // ---------------------------------------------------------------- Module 5
  openSpeakUp() {
    const app = this.app;
    app.inspect?.close({ restore: false });
    app.shell.openDrawer({ title: 'Talk to Grace', key: 'speak', onClose: () => this.refresh(), render: (b) => this._speakUp(b, true) });
  }

  _speakUp(host, inDrawer = false) {
    host.innerHTML = '';
    host.append(el('p', null, 'Report the blocked fire exit to Grace. A strong report has four parts: situation, hazard, impact, ask. You choose; the scene responds. (A fictional scene, made for teaching.)'));
    const dlg = el('div', 'dialogue-host');
    host.append(dlg);
    const player = new DialoguePlayer({
      data: this.speakup, container: dlg,
      onOutcome: (outcome, line) => {
        this.results.speakup = outcome;
        this.record.log('completed', { id: 'speakup', name: 'Speak-up scenario' }, { response: outcome });
        const fb = el('div', 'feedback');
        fb.append(el('p', null, line));
        dlg.append(fb, btn('Try a different approach', () => player.start()));
        if (inDrawer) { fb.tabIndex = -1; this.app.shell.revealInDrawer(fb); }
        this.refresh();
      },
    });
    const style = () => dlg.querySelectorAll('.choice-btn').forEach((b) => b.classList.add('v3-btn', 'v3-choice'));
    new MutationObserver(style).observe(dlg, { childList: true });
    if (this.results.speakup) {
      const line = Object.values(this.speakup.nodes).find((n) => n.outcome === this.results.speakup)?.line ?? '';
      dlg.append(el('p', 'your-answer', `Your earlier outcome: ${this.results.speakup}.`));
      const fb = el('div', 'feedback'); fb.append(el('p', null, line));
      dlg.append(fb, btn('Try a different approach', () => player.start()));
    } else player.start();
  }

  openReflection() {
    this.app.shell.openDrawer({ title: 'Your reflection', key: 'reflect', onClose: () => this.refresh(), render: (b) => this._reflection(b, true) });
  }
  _reflection(host, inDrawer = false) {
    const refl = this.items.transferReflection;
    const id = inDrawer ? 'reflection-input-d' : 'reflection-input';
    const lab = el('label', null, refl.prompt);
    lab.htmlFor = id;
    const ta = el('textarea');
    ta.id = id; ta.rows = 5;
    if (this.results.reflection) ta.value = this.results.reflection;
    const saved = el('p', 'feedback', 'Saved on this device. Reflections are not graded.');
    saved.setAttribute('role', 'status');
    saved.hidden = !this.results.reflection;
    const save = btn('Save reflection', () => {
      const text = ta.value.trim();
      if (!text) return;
      this.results.reflection = text;
      this.record.log('responded', { id: 'transfer-reflection', name: 'Transfer reflection' }, { response: text });
      saved.hidden = false;
      if (inDrawer) { saved.tabIndex = -1; this.app.shell.revealInDrawer(saved); }
      this.refresh();
    }, 'v3-btn v3-primary');
    host.append(lab, ta, save, saved);
  }

  openSummary() {
    this.app.shell.openDrawer({ title: 'Course summary', key: 'summary', render: (b) => this._summary(b) });
  }
  _summary(host) {
    const pre = scoreAnswers(this.results.pre), post = scoreAnswers(this.results.post);
    const judged = Object.entries(this.results.hunt);
    const hazards = judged.filter(([, r]) => r.kind === 'hazard');
    const missed = hazards.filter(([, r]) => !r.discriminated).map(([id]) => this.hunt.byId(id)?.def.label).filter(Boolean);
    host.append(dataTable(['Measure', 'Result'], [
      ['Pre-check', `${pre.correct} of ${this.items.preCheck.length}`],
      ['Post-check', `${post.correct} of ${this.items.postCheck.length}`],
      ['Hazard or not: correct judgements', `${judged.filter(([, r]) => r.discriminated).length} of ${judged.length} areas judged`],
      ['Hazards rated in the right band', `${hazards.filter(([, r]) => r.accurate).length} of ${hazards.length} hazards judged`],
      ['Hazards you judged as not a hazard', missed.length ? missed.join('; ') : 'None'],
      ['Causes chart', this.results.causes ? `${this.results.causes.right} of 5 at the right level` : 'Not done'],
      ['Controls ranked', `${this.results.controls.length} of 3`],
      ['Speak-up outcome', this.results.speakup || 'Not done'],
    ], 'Your results (stored on this device only)'));
    host.append(el('p', 'disclaimer', DISCLAIMER));
  }

  _about(b) {
    b.append(el('p', null, 'Northwind Logistics is a fictional distribution centre with 140 staff. Near-misses are up this quarter. You walk this floor every shift, and that is how hazards go unseen: nothing has gone wrong yet, so the risky starts to look normal.'));
    b.append(el('p', null, 'In this course you will: notice what has become invisible; rate what you find; trace a near-miss to its causes; choose controls that work; and report so that busy people can act.'));
    b.append(el('p', null, 'Every hazard is checked against a real safety rule or guidance, cited on its card once you judge it. Characters, the company and the incident are fictional.'));
    b.append(el('p', 'disclaimer', DISCLAIMER));
  }

  // ---------------------------------------------------------------- text mode (same decisions)
  _textNext(host, i, label = 'Next module') {
    host.append(btn(label, () => this.app.completeModule(i), 'v3-btn v3-primary'));
  }

  _text1(h) {
    this._about(h);
    h.append(el('h4', null, 'Pre-check'));
    for (const item of this.items.preCheck) {
      const previous = this.results.pre.find((a) => a.itemId === item.id) || null;
      mcItem({ item, container: h, previous, onAnswered: (a) => { this._answer(a, 'pre'); } });
    }
    this._textNext(h, 0);
  }

  _text2(h) {
    h.append(el('p', null, 'Two parts. Part A, the practice zone (dock, main floor, charging area), has hints. Part B, the assessed zone (racking aisle, packing bench, east exit), has none. Judge every area: report the hazards and leave alone the conditions that only look risky.'));
    for (const zone of [this.zones[0], this.zones[1]]) this._textZone(h, zone);
    this._textNext(h, 1);
  }

  _textZone(h, zone) {
    h.append(el('h4', null, zone.name));
    h.append(dataTable(['Area', 'What you can observe'], zone.inspectables.map((i) => [i.area, i.cue]), `${zone.name}: judge each area`));
    for (const it of zone.inspectables) {
      const box = el('div');
      h.append(box);
      this._judgeForm(box, it, zone, false);
    }
    h.append(el('p', 'band-rule', BAND_RULE));
  }

  _text3(h) {
    const data = this.replay?.data || this.replayContent;
    h.append(el('p', null, 'Content note: a fictional near-miss, made for teaching. Nobody is hurt. Read each segment and decide at each decision point.'));
    for (const seg of data.segments) {
      const sec = el('section', 'assessment-item');
      sec.append(el('h4', null, seg.name), el('p', null, seg.story));
      for (const pp of seg.pausePoints || []) {
        const key = `${seg.id}@${pp.at}`;
        const fs = el('fieldset');
        const lg = el('legend', null, pp.question);
        fs.append(lg);
        const fb = el('p');
        fb.setAttribute('role', 'status');
        const show = (opt) => { fb.textContent = `${opt.correct ? 'Good decision.' : 'Consider the alternative:'} ${opt.why}`; fs.querySelectorAll('button').forEach((b) => { b.disabled = true; if (b.dataset.option === opt.id) b.setAttribute('aria-pressed', 'true'); }); };
        for (const opt of shuffled(pp.options, `replay-${key}`)) {
          const b = btn(opt.text, () => { if (this.results.replay.has(key)) return; this._replayAnswer(seg, pp, opt); show(opt); }, 'choice-btn');
          b.dataset.option = opt.id;
          fs.append(b);
        }
        fs.append(fb);
        if (this.results.replay.has(key)) show(this.results.replay.get(key));
        sec.append(fs);
      }
      h.append(sec);
    }
    h.append(el('h4', null, 'Sort the causes'));
    const c = el('div');
    h.append(c);
    this._causesChart(c, false);
    this._textNext(h, 2);
  }

  _text4(h) {
    const c = el('div');
    h.append(c);
    this._ranking(c, null, false);
    h.append(el('h4', null, 'Is it training?'));
    this._training(h);
    this._textNext(h, 3);
  }

  _text5(h) {
    h.append(el('h4', null, 'Speak up: report the blocked exit'));
    const s = el('div'); h.append(s); this._speakUp(s, false);
    h.append(el('h4', null, 'Transfer hunt: outbound staging lane (no hints)'));
    this._textZone(h, this.zones[2]);
    h.append(el('h4', null, 'Transfer reflection'));
    const r = el('div'); h.append(r); this._reflection(r, false);
    h.append(el('h4', null, 'Post-check'));
    const summary = el('section', 'course-summary');
    summary.setAttribute('aria-live', 'polite');
    for (const item of this.items.postCheck) {
      const previous = this.results.post.find((a) => a.itemId === item.id) || null;
      mcItem({ item, container: h, previous, onAnswered: (a) => { this._answer(a, 'post'); if (this.results.post.length === this.items.postCheck.length) { summary.innerHTML = ''; summary.append(el('h4', null, 'Course summary')); this._summary(summary); } } });
    }
    h.append(summary);
    if (this.results.post.length === this.items.postCheck.length) { summary.append(el('h4', null, 'Course summary')); this._summary(summary); }
    else h.append(el('p', null, 'The summary appears when all five post-check questions are answered.'));
  }
}
