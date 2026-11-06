// Hazard Hunt v3 checks (plan 10 §2.1, §4, §5, §6.4): every Now card fits the
// 60-word rule with an action or a question, before and after its step is
// done (template T-23); every motion system is accurate or labelled on a card;
// every hazard and condition cites research/sources.md; the racking models
// match the layout's real sizes (pallet-racking is exempt in the catalog).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { Lessons } from '../../src/hazard/lessons.js';
import { Bay } from '../../src/hazard/bay.js';
import { RACK } from '../../src/hazard/layout.js';
import { nowCardIssues } from '../../src/v3/shell.js';
import { MotionLayerManager } from '../../src/v3/motion-layers.js';
import { createCatalog } from '../../src/v3/catalog.js';
import catalogRaw from '../../content/objects.json';
import zones from '../../content/zones.json';
import items from '../../content/items.json';
import replay from '../../content/replay.json';
import controls from '../../content/controls.json';
import speakup from '../../content/speakup.json';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

function fakeElement(tag) {
  const e = {
    tagName: tag.toUpperCase(), children: [], textContent: '', style: {}, dataset: {}, attributes: {}, hidden: false,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    append(...k) { for (const c of k) e.children.push(typeof c === 'string' ? { text: () => c } : c); },
    appendChild(c) { e.append(c); return c; },
    setAttribute(k, v) { e.attributes[k] = String(v); }, getAttribute: (k) => e.attributes[k] ?? null, removeAttribute(k) { delete e.attributes[k]; },
    addEventListener() {}, removeEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
    text() { return e.hidden ? '' : [e.textContent, ...e.children.map((c) => c.text?.() ?? '')].filter(Boolean).join(' '); },
  };
  return e;
}
const cardText = (n, box) => [n.step ? `Step ${n.step} of ${n.total}` : n.kicker, n.goal, n.action, n.result, n.question?.prompt,
  ...(n.question?.choices || []).map((c) => c.text), box?.text(), n.hint, n.primary?.label, n.secondary?.label, n.readMore?.label].filter(Boolean).join(' ');

describe('every Now card: at most 60 words and an action or a question (T-23)', () => {
  const saved = globalThis.document;
  beforeAll(() => { globalThis.document = { createElement: fakeElement, activeElement: null }; });
  afterAll(() => { globalThis.document = saved; });
  const L = new Lessons({ slug: 'unit-now', content: { zones, items, replay, controls, speakup } });
  const app = { catalog: createCatalog(catalogRaw), record: { log() {} }, shell: { touch: false, setNow() {}, toast() {}, now: { querySelector: () => null } }, module: 0, completeModule() {} };
  L.app = app;
  const finish = () => {
    for (const it of items.preCheck) L.results.pre.push({ itemId: it.id, correct: true, chosen: it.correct });
    for (const it of items.postCheck) L.results.post.push({ itemId: it.id, correct: true, chosen: it.correct });
    for (const z of L.zones) for (const i of z.inspectables) { L.hunt.flags.set(i.id, { result: { classification: 'hazard' } }); L.results.hunt[i.id] = { kind: i.kind, discriminated: true, accurate: true }; }
    L.results.causes = { choices: {}, right: 5 };
    L.results.controls = controls.tasks.map((t) => ({ taskId: t.id, perfect: true }));
    L.results.speakup = 'strong';
    L.results.reflection = 'A note.';
  };
  for (const pass of ['fresh', 'done']) {
    for (const [i, steps] of L.steps.entries()) {
      for (const [k, id] of steps.entries()) {
        for (const touch of [false, true]) {
          it(`${pass}${touch ? ' touch' : ''}: module ${i + 1} ${id}`, () => {
            if (pass === 'done') finish();
            app.shell.touch = touch;
            app.module = i;
            L.step[i] = k;
            const n = L.nowFor(i);
            let box = null;
            if (n.tool) { box = fakeElement('div'); n.tool(box, app.shell); }
            const text = cardText(n, box);
            expect(nowCardIssues(text, n).issues, `"${text}"`).toEqual([]);
          });
        }
      }
    }
  }
});

describe('motion systems (plan 10 §5)', () => {
  const m = new MotionLayerManager({ root: null });
  Bay.prototype.addMotion.call({}, m);
  it('at least eight systems across all four layers', () => {
    expect(m.systems.size).toBeGreaterThanOrEqual(8);
    expect(new Set([...m.systems.values()].map((s) => s.layer))).toEqual(new Set(['sky', 'environment', 'agents', 'objects']));
  });
  it('every illustrative or time-lapse motion is named on a catalog card', () => {
    expect(m.checkLabels(createCatalog(catalogRaw))).toEqual([]);
  });
  it('every system names catalog objects that exist', () => {
    const c = createCatalog(catalogRaw);
    for (const s of m.systems.values()) for (const id of s.objects) expect(c.has(id), `${s.id}: ${id}`).toBe(true);
  });
});

describe('sources (repo note: every hazard cites research/sources.md)', () => {
  const sources = read('../../research/sources.md');
  const cat = new Map(catalogRaw.objects.map((o) => [o.id, o]));
  for (const z of zones.zones) for (const i of z.inspectables) {
    it(`${i.id} cites a source listed in research/sources.md`, () => {
      const src = cat.get(i.id)?.source;
      expect(src, i.id).toBeTruthy();
      expect(sources.includes(src), `${i.id}: ${src}`).toBe(true);
    });
  }
  it('every catalog source is listed in research/sources.md', () => {
    for (const o of catalogRaw.objects) if (o.source) expect(sources.includes(o.source), `${o.id}: ${o.source}`).toBe(true);
  });
});

describe('racking at real size (pallet-racking realSizeNote)', () => {
  const man = JSON.parse(read('../../public/assets/v3/manifest.json')).assets;
  it('frame height and depth, beam length match the layout', () => {
    expect(man['rack-frame'].sizeM[1]).toBeCloseTo(RACK.frameHeight, 1);
    expect(man['rack-frame'].sizeM[2]).toBeCloseTo(RACK.depth, 2);
    expect(man['rack-beam'].sizeM[0]).toBeCloseTo(RACK.bay, 1);
  });
});
