/**
 * Unit tests: risk rating, controls ranking, speak-up graph validation, hunt state.
 * The plan-required validations: risk-rating logic, branch coverage (graph),
 * controls ranking scoring.
 */
import { describe, it, expect } from 'vitest';
import { rateRisk, riskBand } from '../../src/systems/hazard-hunt.js';
import { scoreRanking } from '../../src/systems/controls-activity.js';
import { validateGraph } from '../../src/systems/dialogue.js';
import { readFileSync } from 'node:fs';

const speakup = JSON.parse(readFileSync(new URL('../../content/speakup.json', import.meta.url), 'utf8'));
const controls = JSON.parse(readFileSync(new URL('../../content/controls.json', import.meta.url), 'utf8'));
const zones = JSON.parse(readFileSync(new URL('../../content/zones.json', import.meta.url), 'utf8'));

describe('risk rating', () => {
  it('computes likelihood × severity and bands', () => {
    expect(riskBand(1).label).toBe('Low');
    expect(riskBand(9).label).toBe('Medium');
    expect(riskBand(20).label).toBe('High');
    const r = rateRisk({ kind: 'hazard', likelihood: 3, severity: 4, why: '' }, 3, 4);
    expect(r.score).toBe(12);
    expect(r.accurate).toBe(true);
  });
  it('marks over- and under-rating as inaccurate', () => {
    const over = rateRisk({ kind: 'hazard', likelihood: 2, severity: 2, why: '' }, 5, 5);
    expect(over.accurate).toBe(false);
    expect(over.bandDistance).toBeGreaterThan(0);
  });
  it('explains distractors as controlled conditions', () => {
    const r = rateRisk({ kind: 'distractor', likelihood: 1, severity: 1, why: 'controlled' }, 5, 5);
    expect(r.feedback).toMatch(/controlled condition/i);
  });
});

describe('controls ranking', () => {
  it('scores a perfect ranking', () => {
    const task = controls.tasks[0];
    const r = scoreRanking(task, task.correctOrder);
    expect(r.perfect).toBe(true);
    expect(r.accuracy).toBe(1);
  });
  it('penalizes inversions', () => {
    const task = controls.tasks[0];
    const reversed = [...task.correctOrder].reverse();
    const r = scoreRanking(task, reversed);
    expect(r.inversions).toBeGreaterThan(0);
    expect(r.accuracy).toBeLessThan(1);
  });
});

describe('speak-up dialogue graph', () => {
  it('has no dead ends, no missing nodes, and every outcome reachable', () => {
    const v = validateGraph(speakup);
    expect(v.errors).toEqual([]);
    expect(v.reachable).toBe(v.total);
    expect(v.outcomes.sort()).toEqual(['mixed', 'poor', 'strong']);
  });
});

describe('zone content integrity', () => {
  it('has hazard catalog data with cues, ratings and why for every inspectable', () => {
    for (const zone of zones.zones) {
      for (const item of zone.inspectables) {
        expect(item.cue, item.id).toBeTruthy();
        expect(item.kind, item.id).toMatch(/hazard|distractor|neutral/);
        expect(item.why || item.kind === 'neutral' ? true : item.why, item.id).toBeTruthy();
        if (item.kind === 'hazard') {
          expect(item.likelihood, item.id).toBeGreaterThanOrEqual(1);
          expect(item.severity, item.id).toBeLessThanOrEqual(5);
        }
      }
    }
  });
  it('has exactly the planned counts: 12 hazards across the two hunt zones, 2 subtle, 4 distractors total', () => {
    const all = zones.zones.flatMap((z) => z.inspectables);
    const hazards = all.filter((i) => i.kind === 'hazard');
    const distractors = all.filter((i) => i.kind === 'distractor');
    expect(hazards.length).toBe(12); // 4 practice + 6 assessed + 2 transfer
    expect(distractors.length).toBe(4);
    const subtle = hazards.filter((h) => ['hazard-unchocked-trailer', 'hazard-misaligned-mirror'].includes(h.id));
    expect(subtle.length).toBe(2); // the two deliberately subtle hazards
  });
});
