/**
 * Assessment engine shared by 3D and text mode (shared template): item players +
 * "why" feedback. No automated grading of free text anywhere.
 * @module learning/assess
 */
import { announce } from '../a11y/announcer.js';

export function mcItem({ item, container, onAnswered, showFeedback = true }) {
  const wrap = document.createElement('section');
  wrap.className = 'assessment-item';
  const h = document.createElement('h3');
  h.textContent = item.prompt;
  wrap.appendChild(h);
  const options = document.createElement('div');
  options.setAttribute('role', 'radiogroup');
  options.setAttribute('aria-label', item.prompt);
  const buttons = [];
  for (const opt of item.options) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'choice-btn';
    b.textContent = opt.text;
    b.addEventListener('click', () => {
      const correct = opt.id === item.correct;
      if (showFeedback) {
        for (const x of buttons) x.disabled = true;
        b.classList.add(correct ? 'correct' : 'incorrect');
        const fb = document.createElement('div');
        fb.className = 'feedback';
        fb.innerHTML = `<p><strong>${correct ? 'Correct.' : 'Not quite.'}</strong> ${opt.why || item.why || ''}</p>`;
        wrap.appendChild(fb);
      }
      announce(correct ? 'Correct' : 'Answer recorded');
      onAnswered?.({ itemId: item.id, correct, chosen: opt.id });
    });
    buttons.push(b);
    options.appendChild(b);
  }
  wrap.appendChild(options);
  container.appendChild(wrap);
  return wrap;
}

export function scoreAnswers(answers) {
  const byItem = {};
  let correct = 0;
  for (const a of answers) { byItem[a.itemId] = a.correct; if (a.correct) correct++; }
  return { correct, total: answers.length, byItem, ratio: answers.length ? correct / answers.length : 0 };
}
