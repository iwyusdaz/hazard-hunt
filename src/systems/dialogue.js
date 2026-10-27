/**
 * Speak-up branching dialogue (structured model: Situation, Hazard, Impact, Ask).
 * Graph-driven from content/speakup.json; every node reachable (validated by tests).
 * @module systems/dialogue
 */
export function validateGraph(data) {
  const errors = [];
  const seen = new Set();
  const walk = (id) => {
    if (seen.has(id)) return;
    seen.add(id);
    const node = data.nodes[id];
    if (!node) { errors.push(`missing node: ${id}`); return; }
    for (const opt of node.options || []) {
      if (!data.nodes[opt.to]) errors.push(`option "${opt.id}" in "${id}" points at missing node "${opt.to}"`);
      else walk(opt.to);
    }
  };
  walk(data.start);
  for (const id of Object.keys(data.nodes)) {
    if (!seen.has(id)) errors.push(`unreachable node: ${id}`);
    const n = data.nodes[id];
    if (!n.outcome && !(n.options || []).length) errors.push(`dead end: ${id}`);
  }
  return { errors, reachable: seen.size, total: Object.keys(data.nodes).length, outcomes: Object.values(data.nodes).filter((n) => n.outcome).map((n) => n.outcome) };
}

export class DialoguePlayer {
  constructor({ data, container, onOutcome }) {
    this.data = data;
    this.container = container;
    this.onOutcome = onOutcome;
  }

  start() { this._show(this.data.start); }

  _show(id) {
    const node = this.data.nodes[id];
    const c = this.container;
    c.innerHTML = '';
    const speaker = document.createElement('p');
    speaker.className = 'dlg-speaker';
    speaker.textContent = node.speaker;
    const line = document.createElement('p');
    line.className = 'dlg-line';
    line.textContent = node.line;
    c.append(speaker, line);
    if (node.outcome) { this.onOutcome?.(node.outcome, node.line); return; }
    const opts = document.createElement('div');
    opts.setAttribute('role', 'group');
    opts.setAttribute('aria-label', 'Response options');
    for (const opt of node.options) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'choice-btn';
      b.textContent = opt.text;
      b.addEventListener('click', () => this._show(opt.to));
      opts.appendChild(b);
    }
    c.appendChild(opts);
  }
}
