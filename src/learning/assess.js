/**
 * Assessment engine shared by 3D and text mode (shared template): item players +
 * "why" feedback. No automated grading of free text anywhere.
 * @module learning/assess
 */
import { announce } from '../a11y/announcer.js';

/** FNV-1a 32-bit string hash. */
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** Small seeded PRNG (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic option order for one item (review N4). The seed is the item key, so
 * the order is the same on every load and for every learner (stable for the answer
 * key and the tests), but the correct option moves between positions across items.
 * Returns a new array; the content order is untouched.
 */
export function shuffled(options, key) {
  const out = options.slice();
  const r = rng(hash(String(key)));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function mcItem({ item, container, onAnswered, showFeedback = true, previous = null }) {
  const wrap = document.createElement('section');
  wrap.className = 'assessment-item';
  const h = document.createElement('h3');
  h.textContent = item.prompt;
  wrap.appendChild(h);
  const options = document.createElement('div');
  options.setAttribute('role', 'radiogroup');
  options.setAttribute('aria-label', item.prompt);
  const buttons = [];
  const showResult = (opt, b) => {
    const correct = opt.id === item.correct;
    for (const x of buttons) x.disabled = true;
    b.classList.add(correct ? 'correct' : 'incorrect');
    b.setAttribute('aria-pressed', 'true');
    const fb = document.createElement('div');
    fb.className = 'feedback';
    fb.innerHTML = `<p><strong>${correct ? 'Correct.' : 'Not quite.'}</strong> ${opt.why || item.why || ''}</p>`;
    wrap.appendChild(fb);
    return correct;
  };
  for (const opt of shuffled(item.options, item.id)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'choice-btn';
    b.textContent = opt.text;
    b.dataset.option = opt.id;
    b.addEventListener('click', () => {
      const correct = opt.id === item.correct;
      if (showFeedback) showResult(opt, b);
      announce(correct ? 'Correct' : 'Answer recorded');
      onAnswered?.({ itemId: item.id, correct, chosen: opt.id });
    });
    buttons.push(b);
    options.appendChild(b);
  }
  wrap.appendChild(options);
  // An item answered earlier (e.g. before switching modules) is shown answered,
  // read-only, without logging again (review N5).
  if (previous) {
    const b = buttons.find((x) => x.dataset.option === previous.chosen);
    const opt = item.options.find((o) => o.id === previous.chosen);
    if (b && opt) showResult(opt, b);
  }
  container.appendChild(wrap);
  return wrap;
}

export function scoreAnswers(answers) {
  const byItem = {};
  let correct = 0;
  for (const a of answers) { byItem[a.itemId] = a.correct; if (a.correct) correct++; }
  return { correct, total: answers.length, byItem, ratio: answers.length ? correct / answers.length : 0 };
}
