/**
 * Focus manager: dialog focus traps, focus restore, points-of-interest list (shared template).
 * @module a11y/focus
 */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function openDialog(el, trigger) {
  el.__restoreTo = trigger || document.activeElement;
  if (typeof el.showModal === 'function') el.showModal();
  else { el.removeAttribute('hidden'); el.setAttribute('aria-hidden', 'false'); }
  const first = el.querySelector(FOCUSABLE);
  (first || el).focus();
  el.__trap = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); closeDialog(el); return; }
    if (e.key !== 'Tab') return;
    const items = [...el.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null || n === el);
    if (!items.length) return;
    const firstItem = items[0], lastItem = items[items.length - 1];
    if (e.shiftKey && document.activeElement === firstItem) { e.preventDefault(); lastItem.focus(); }
    else if (!e.shiftKey && document.activeElement === lastItem) { e.preventDefault(); firstItem.focus(); }
  };
  el.addEventListener('keydown', el.__trap);
}

export function closeDialog(el) {
  if (el.__trap) { el.removeEventListener('keydown', el.__trap); el.__trap = null; }
  if (typeof el.close === 'function' && el.open) el.close();
  else { el.setAttribute('hidden', ''); el.setAttribute('aria-hidden', 'true'); }
  el.__restoreTo?.focus?.();
}

export class PoiList {
  constructor(container, { label = 'Points of interest' } = {}) {
    this.container = container;
    this.pois = new Map();
    this.onChange = null;
    container.innerHTML = '';
    const h = document.createElement('h3');
    h.textContent = label;
    const ul = document.createElement('ul');
    ul.className = 'poi-list';
    this.ul = ul;
    container.append(h, ul);
  }
  set(id, { label, onSelect, hidden = false }) {
    if (hidden) { this.pois.delete(id); this.render(); return; }
    this.pois.set(id, { label, onSelect });
    this.render();
  }
  clear() { this.pois.clear(); this.render(); }
  render() {
    this.ul.innerHTML = '';
    for (const [id, poi] of this.pois) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = poi.label;
      b.dataset.poi = id;
      b.addEventListener('click', () => poi.onSelect?.());
      li.appendChild(b);
      this.ul.appendChild(li);
    }
    this.onChange?.(this.pois.size);
  }
}
