/**
 * Hazard Hunt v3 — entry point (plan 10 §6.4, scene-first revamp).
 * The v3 template shell (src/v3/, synced with _tools/sync-v3-core.mjs) runs
 * Northwind Logistics Bay 4 at night (src/hazard/bay.js, fictional), the five
 * modules (src/hazard/lessons.js) and the object catalog (content/objects.json).
 * Loading: the building, racking and lights before the title screen; every
 * hazard and prop after the learner's first interaction; the people right after.
 */
import './v3/layers.css';
import './v3/type.css';
import './v3/shell.css';
import './styles/case-fonts.css';
import './styles/hazard-v3.css';
import { createSceneApp } from './v3/app.js';
import catalog from '../content/objects.json';
import zones from '../content/zones.json';
import items from '../content/items.json';
import replay from '../content/replay.json';
import controls from '../content/controls.json';
import speakup from '../content/speakup.json';
import cinematic from '../content/cinematics.json';
import { Lessons } from './hazard/lessons.js';
import { Bay } from './hazard/bay.js';
import { Replay } from './hazard/replay.js';
import { VIEWS } from './hazard/layout.js';

const SLUG = window.__SLUG__ || 'hazard-hunt';
window.__SLUG__ = SLUG;
const lessons = new Lessons({ slug: SLUG, content: { zones, items, replay, controls, speakup } });
const app = await createSceneApp({
  slug: SLUG,
  title: 'Hazard Hunt',
  modules: lessons.modules(),
  catalog,
  home: VIEWS.home,
  walkable: true,
  titleScreen: { kicker: 'Northwind Logistics, Bay 4 · night shift (fictional)', oneLiner: 'Walk a warehouse floor, tell real hazards from things that only look risky, replay a near-miss, and speak up.' },
  practiceObject: 'pallet-racking',
  cinematic,
  lut: `${import.meta.env.BASE_URL}lut/bay4-night-33.png`,
  limits: { minRadius: 0.6, maxRadius: 34, minPhi: 0.12, maxPhi: 1.62, minEye: 0.35, eyeHeight: 1.6 },
  buildScene: async (a) => {
    const bay = new Bay(a);
    const shell = await bay.load();
    bay.registerShell();
    bay.addMotion(a.motion);
    lessons.bind(a, bay);
    const rp = new Replay({ data: replay, app: a, bay });
    lessons.attachReplay(rp);
    a.bay = bay;
    a.lessons = lessons;
    // Props and people stream after the learner's first interaction (plan §7 download gate).
    const first = () => {
      bay.loadProps().then(() => bay.loadPeople()).then(() => bay.ensureReplayActors()).then(() => { bay.buildLod(); a.shell.root.dataset.bayReady = 'ready'; lessons.refresh(); });
      for (const ev of ['pointerdown', 'keydown']) window.removeEventListener(ev, first, true);
    };
    for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, first, true);
    return { ...shell, legend: lessons.legend(), update: (dt) => { bay.update(dt); rp.update(dt); } };
  },
});
if (__TEST_HOOKS__ && window.__TEST__) Object.assign(window.__TEST__, { lessons, bay: app.bay });
window.__app = app;
