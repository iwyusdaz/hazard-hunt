/**
 * Text mode shell with parity (shared template): covers the SAME objectives and
 * assessment decisions as the 3D mode. Each zone renders as described views;
 * the learner flags and rates from the descriptions (plan section 11).
 * @module a11y/text-mode
 */
export class TextMode {
  constructor({ root, slug, onDecision }) {
    this.root = root;
    this.slug = slug;
    this.onDecision = onDecision;
    this.sections = new Map();
    this.activeId = null;
    this.root.hidden = true;
  }
  register(moduleId, renderFn) { this.sections.set(moduleId, renderFn); }
  show(moduleId) {
    this.activeId = moduleId;
    this.root.hidden = false;
    const fn = this.sections.get(moduleId);
    this.root.innerHTML = '';
    if (!fn) { this.root.innerHTML = '<p>Text mode for this section is not available.</p>'; return; }
    const h = document.createElement('h2');
    h.className = 'textmode-title';
    this.root.appendChild(h);
    const body = document.createElement('div');
    body.className = 'textmode-body';
    this.root.appendChild(body);
    fn(body, { answer: (id, payload) => this.onDecision?.(id, payload), setTitle: (t) => { h.textContent = t; } });
    this.root.scrollTop = 0;
  }
  hide() { this.root.hidden = true; this.activeId = null; }
}

export function dataTable(headers, rows, caption) {
  const table = document.createElement('table');
  if (caption) { const cap = document.createElement('caption'); cap.textContent = caption; table.appendChild(cap); }
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  for (const h of headers) { const th = document.createElement('th'); th.scope = 'col'; th.textContent = h; trh.appendChild(th); }
  thead.appendChild(trh); table.appendChild(thead);
  const tbody = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');
    for (const cell of row) { const td = document.createElement('td'); td.textContent = String(cell); tr.appendChild(td); }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  return table;
}
