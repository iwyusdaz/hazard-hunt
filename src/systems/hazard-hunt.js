/**
 * Hazard hunt logic: flag an inspectable → rate risk (likelihood × severity radio
 * grids) → feedback. Distractors explain why they're controlled. Hints (practice
 * zone only) as text, never color alone.
 * @module systems/hazard-hunt
 */
import { announce } from '../a11y/announcer.js';

/** Plain-language statement of the banding rule, shown with every rating. */
export const BAND_RULE = 'High: score 15 or more, or any severity-5 hazard (life-changing or fatal) with likelihood 2 or more. Medium: score 8 to 14. Low: below 8.';

/**
 * Risk band from likelihood × severity. A severity-5 hazard with likelihood ≥ 2 is
 * High regardless of score, so a rare-but-fatal hazard is never rated Medium.
 */
export function riskBand(score, severity = 0, likelihood = 0) {
  if (score >= 15 || (severity === 5 && likelihood >= 2)) return { label: 'High', icon: '▲▲' };
  if (score >= 8) return { label: 'Medium', icon: '▲' };
  return { label: 'Low', icon: '●' };
}

export function rateRisk(def, likelihood, severity) {
  const score = likelihood * severity;
  const trueScore = def.likelihood * def.severity;
  const band = riskBand(score, severity, likelihood);
  const trueBand = riskBand(trueScore, def.severity, def.likelihood);
  const bandDistance = Math.abs(score - trueScore);
  return {
    score,
    trueScore,
    band,
    trueBand,
    accurate: band.label === trueBand.label,
    bandDistance,
    feedback: buildFeedback(def, band, trueBand),
  };
}

/** The classification each kind of inspectable should receive. */
export const EXPECTED_CLASS = { hazard: 'hazard', distractor: 'controlled', neutral: 'acceptable' };

/**
 * Score one judgment: classification first (objective 2, discrimination), then the
 * rating for hazards (objective 1). `discriminated` is the hazard / not-hazard
 * decision; `accurate` additionally requires the right band for hazards.
 * @param {object} def zones.json inspectable
 * @param {'hazard'|'controlled'|'acceptable'} classification
 */
export function judge(def, classification, likelihood = 0, severity = 0) {
  const isHazard = def.kind === 'hazard';
  const saidHazard = classification === 'hazard';
  const discriminated = isHazard === saidHazard;
  const exactClass = classification === EXPECTED_CLASS[def.kind];
  const label = `This was: ${def.label}.`;
  if (isHazard) {
    if (!saidHazard) {
      const trueBand = riskBand(def.likelihood * def.severity, def.severity, def.likelihood);
      return { classification, discriminated, exactClass, accurate: false, score: 0, trueScore: def.likelihood * def.severity, band: null, trueBand,
        feedback: `${label} It is a **hazard to report** (reference: likelihood ${def.likelihood} × severity ${def.severity}, ${trueBand.label}). ${def.why}` };
    }
    const r = rateRisk(def, likelihood, severity);
    return { ...r, classification, discriminated, exactClass, likelihood, severity, feedback: `${label} ${r.feedback}` };
  }
  const opening = saidHazard
    ? 'You reported it as a hazard, but it is not one.'
    : exactClass ? 'Right: nothing to report.' : 'Right that there is nothing to report.';
  return { classification, discriminated, exactClass, accurate: discriminated, score: 0, trueScore: 0, band: null, trueBand: null,
    feedback: `${label} ${opening} ${buildFeedback(def)}` };
}

function buildFeedback(def, band, trueBand) {
  if (def.kind === 'distractor') {
    return `This is a **controlled condition**, not a hazard to report. ${def.why} Flagging controlled conditions buries real hazards in the report queue — that is why discrimination is part of this exercise.`;
  }
  if (def.kind === 'neutral') {
    return `This is an acceptable condition. ${def.why} Knowing what is acceptable keeps your reports credible.`;
  }
  const ratingPart = band.label === trueBand.label
    ? `Your band (${band.label}) matches the reference band (${trueBand.label}).`
    : `The reference rating is **${trueBand.label}** (likelihood ${def.likelihood} × severity ${def.severity}); your band was ${band.label}.`;
  return `${ratingPart} ${def.why}`;
}

export class HuntController {
  /**
   * @param {object} opts
   * @param {Array} opts.zones content/zones.json zones
   * @param {Function} opts.onFlagged (def, result) — called after rating submitted
   */
  constructor({ zones, onFlagged }) {
    this.zones = zones;
    this.onFlagged = onFlagged;
    this.flags = new Map(); // id -> { def, result }
    this.hintsUsed = 0;
  }

  byId(id) {
    for (const z of this.zones) {
      const def = z.inspectables.find((i) => i.id === id);
      if (def) return { def, zone: z };
    }
    return null;
  }

  /** Rating dialog DOM (radio groups — fully keyboard operable, WCAG-friendly). */
  renderRatingDialog(def, zone, container, onSubmit, { headingId = null } = {}) {
    container.innerHTML = '';
    // Neutral heading: the area name only. The answer label appears only in the
    // feedback (agent review A1 / H-2 / L3).
    const h = document.createElement('h3');
    h.textContent = def.area;
    if (headingId) h.id = headingId;
    container.append(h);
    // Step 1: classify (objective 2, discrimination). Rating appears only for "hazard".
    const cls = document.createElement('fieldset');
    cls.className = 'rating-step';
    cls.innerHTML = '<legend>Step 1: what is this?</legend>';
    for (const [v, t] of [['hazard', 'A hazard to report'], ['controlled', 'A controlled condition (the risk is already managed)'], ['acceptable', 'Acceptable, nothing to report']]) {
      const lab = document.createElement('label');
      lab.className = 'choice';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'classification';
      input.value = v;
      lab.append(input, Object.assign(document.createElement('span'), { textContent: ` ${t}` }));
      cls.appendChild(lab);
    }
    container.appendChild(cls);
    const rateBox = document.createElement('div');
    rateBox.className = 'rating-step';
    rateBox.hidden = true;
    rateBox.appendChild(Object.assign(document.createElement('p'), { textContent: 'Step 2: rate the risk.' }));
    cls.addEventListener('change', () => {
      rateBox.hidden = cls.querySelector('input:checked')?.value !== 'hazard';
    });
    if (zone.hints && def.hintWarm) {
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.innerHTML = `<span aria-hidden="true">💡</span> Hint: ${def.hintWarm}`;
      container.appendChild(hint);
      this.hintsUsed++;
    }
    const makeGrid = (name, label, values) => {
      const fs = document.createElement('fieldset');
      const lg = document.createElement('legend');
      lg.textContent = label;
      fs.appendChild(lg);
      values.forEach((v) => {
        const lab = document.createElement('label');
        lab.className = 'choice';
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = name;
        input.value = String(v);
        lab.append(input, Object.assign(document.createElement('span'), { textContent: ` ${v}` }));
        fs.appendChild(lab);
      });
      return fs;
    };
    // Radio names are unique per item: the text page shows many forms at once, and
    // shared names would make them one document-wide radio group.
    const n = (k) => `${def.id}-${k}`;
    for (const input of cls.querySelectorAll('input')) input.name = n('classification');
    rateBox.appendChild(makeGrid(n('likelihood'), 'Likelihood (1 = rare, 5 = very likely)', [1, 2, 3, 4, 5]));
    rateBox.appendChild(makeGrid(n('severity'), 'Severity (1 = minor first aid, 5 = life-changing or fatal)', [1, 2, 3, 4, 5]));
    const rule = document.createElement('p');
    rule.className = 'band-rule';
    rule.textContent = BAND_RULE;
    rateBox.appendChild(rule);
    container.appendChild(rateBox);
    const err = document.createElement('p');
    err.className = 'error visually-hidden';
    err.setAttribute('role', 'alert');
    const submit = document.createElement('button');
    submit.type = 'button';
    submit.textContent = 'Submit';
    submit.addEventListener('click', () => {
      const c = container.querySelector(`input[name="${n('classification')}"]:checked`);
      const l = container.querySelector(`input[name="${n('likelihood')}"]:checked`);
      const s = container.querySelector(`input[name="${n('severity')}"]:checked`);
      const fail = (msg) => { err.classList.remove('visually-hidden'); err.textContent = msg; };
      if (!c) return fail('Choose what this is before submitting.');
      if (c.value === 'hazard' && (!l || !s)) return fail('Choose both a likelihood and a severity before submitting.');
      const result = judge(def, c.value, l ? parseInt(l.value, 10) : 0, s ? parseInt(s.value, 10) : 0);
      this.flags.set(def.id, { def, result });
      announce(`Answer submitted for ${def.area}`);
      onSubmit(result);
    });
    container.append(err, submit);
  }

  /** Warm/cold hint list for the practice zone POI panel (text + icon, not color). */
  hintText(zone, flaggedCount) {
    if (!zone.hints) return '';
    const remaining = zone.inspectables.filter((i) => i.kind !== 'neutral' && !this.flags.has(i.id)).length;
    if (remaining === 0) return 'Every inspectable item in this zone is rated.';
    return `${remaining} unrated item(s) remain in this zone. Warm areas: near the dock walkway, the charging cable ends. Icon legend: 💡 hint available, ● low risk, ▲ medium risk, ▲▲ high risk.`;
  }
}
