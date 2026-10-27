/**
 * Hierarchy-of-controls activity: rank controls per hazard. Ranking is done with
 * up/down buttons (no drag-only interaction; WCAG 2.1 friendly). Feedback cites
 * the NIOSH hierarchy tiers (content/controls.json).
 * @module systems/controls-activity
 */
import { announce } from '../a11y/announcer.js';

export function scoreRanking(task, order) {
  // Scored by hierarchy tier (expert review S3): only pairs from DIFFERENT tiers that
  // are out of hierarchy order count; any order within one tier is accepted.
  const HIER = ['elimination', 'substitution', 'engineering', 'administrative', 'ppe'];
  const rank = (id) => HIER.indexOf(task.controls.find((c) => c.id === id).kind);
  let inversions = 0;
  let maxInv = 0;
  for (let i = 0; i < order.length; i++) {
    for (let j = i + 1; j < order.length; j++) {
      if (rank(order[i]) === rank(order[j])) continue;
      maxInv++;
      if (rank(order[i]) > rank(order[j])) inversions++;
    }
  }
  const accuracy = maxInv ? 1 - inversions / maxInv : 1;
  const tiers = order.map((id) => task.controls.find((c) => c.id === id).kind);
  return { inversions, accuracy, tiers, perfect: inversions === 0 };
}

export class ControlsActivity {
  constructor({ data, container, onComplete }) {
    this.data = data;
    this.container = container;
    this.onComplete = onComplete;
    this.results = [];
    this.taskIndex = -1;
  }

  next() {
    this.taskIndex++;
    if (this.taskIndex >= this.data.tasks.length) { this.onComplete?.(this.results); return false; }
    this._renderTask(this.data.tasks[this.taskIndex]);
    return true;
  }

  _renderTask(task) {
    const c = this.container;
    c.innerHTML = '';
    const h = document.createElement('h3');
    h.textContent = task.hazard;
    const p = document.createElement('p');
    p.textContent = task.prompt;
    const hierarchyNote = document.createElement('p');
    hierarchyNote.className = 'hierarchy-note';
    hierarchyNote.textContent = 'Hierarchy reference (most → least effective): ' + this.data.hierarchy.map((k) => this.data.hierarchyLabels[k].split('—')[0].trim()).join(' → ');
    c.append(h, p, hierarchyNote);
    const list = document.createElement('ul');
    list.className = 'rank-list';
    list.setAttribute('aria-label', 'Controls to rank; use the up and down buttons');
    let order = task.controls.map((x) => x.id);

    const render = () => {
      list.innerHTML = '';
      order.forEach((id, i) => {
        const ctrl = task.controls.find((x) => x.id === id);
        const li = document.createElement('li');
        const up = document.createElement('button');
        up.type = 'button';
        up.textContent = '↑ Move up';
        up.setAttribute('aria-label', `Move up: ${ctrl.text}`);
        up.disabled = i === 0;
        up.addEventListener('click', () => { [order[i - 1], order[i]] = [order[i], order[i - 1]]; render(); announce('Moved up'); });
        const down = document.createElement('button');
        down.type = 'button';
        down.textContent = '↓ Move down';
        down.setAttribute('aria-label', `Move down: ${ctrl.text}`);
        down.disabled = i === order.length - 1;
        down.addEventListener('click', () => { [order[i + 1], order[i]] = [order[i], order[i + 1]]; render(); announce('Moved down'); });
        const label = document.createElement('span');
        label.textContent = ` ${i + 1}. ${ctrl.text}`;
        li.append(up, down, label);
        list.appendChild(li);
      });
    };
    render();
    c.appendChild(list);

    const submit = document.createElement('button');
    submit.type = 'button';
    submit.textContent = 'Submit ranking';
    submit.addEventListener('click', () => {
      const result = scoreRanking(task, order);
      this.results.push({ taskId: task.id, ...result });
      const fb = document.createElement('div');
      fb.className = 'feedback';
      const tiers = result.tiers.map((t) => this.data.hierarchyLabels[t].split('—')[0].trim()).join(' → ');
      const verdict = result.perfect ? 'Your order follows the hierarchy.'
        : `${result.accuracy >= 0.75 ? 'Close' : 'Not yet'}: ${result.inversions} pair(s) out of hierarchy order.`;
      const ref = task.correctOrder.map((id) => {
        const ctrl = task.controls.find((x) => x.id === id);
        return `<li>${ctrl.text} <em>(${this.data.hierarchyLabels[ctrl.kind].split('—')[0].trim()})</em></li>`;
      }).join('');
      fb.innerHTML = `<p><strong>${verdict}</strong></p>
        <p>Your tiers, most → least effective: ${tiers}.</p><p>A reference order (any order within one tier is also correct):</p><ol>${ref}</ol><p>${task.why}</p>`;
      c.appendChild(fb);
      submit.disabled = true;
      announce(result.perfect ? 'Perfect ranking' : 'Ranking submitted, feedback shown');
      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.textContent = 'Next hazard';
      nextBtn.addEventListener('click', () => this.next());
      c.appendChild(nextBtn);
    });
    c.appendChild(submit);
  }
}
