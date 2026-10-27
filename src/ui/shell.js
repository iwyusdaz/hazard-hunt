/**
 * HTML overlay shell (shared template): header with "All projects" link to `/`,
 * module navigation, HUD, dialogs. All UI is semantic HTML above the canvas.
 * @module ui/shell
 */
import { openDialog, closeDialog } from '../a11y/focus.js';
import { announce } from '../a11y/announcer.js';

export class Shell {
  constructor({ slug, title, moduleLabels, onModuleChange }) {
    this.slug = slug;
    this.title = title;
    this.onModuleChange = onModuleChange;
    this.root = document.getElementById('ui');
    this.root.innerHTML = `
      <header class="app-header">
        <p class="app-title">${title}</p>
        <nav aria-label="Main">
          <button type="button" data-action="menu">Menu</button>
          <button type="button" data-action="settings">Settings</button>
          <button type="button" data-action="textmode">Text mode</button>
          <a class="all-projects" href="/" aria-label="All projects (back to showcase home)">All projects</a>
        </nav>
      </header>
      <nav class="module-nav" aria-label="Modules"></nav>
      <div class="hud" role="region" aria-label="Status"></div>
      <main class="stage" id="stage">
        <canvas id="app" aria-label="${title} 3D scene"></canvas>
        <div id="textmode" class="textmode" hidden></div>
        <div id="cinematic-host"></div>
      </main>
      <div id="overlays"></div>
      <dialog id="menu-dialog" aria-labelledby="menu-dialog-title">
        <h2 id="menu-dialog-title">Menu</h2>
        <ul class="menu-list">
          <li><button type="button" data-action="resume">Resume</button></li>
          <li><button type="button" data-action="restart">Restart module</button></li>
          <li><button type="button" data-action="textmode">Text mode</button></li>
          <li><button type="button" data-action="settings">Settings</button></li>
          <li><button type="button" data-action="progress">My progress</button></li>
          <li><a href="/">All projects</a></li>
        </ul>
      </dialog>
      <div class="visually-hidden" id="announcer"></div>
    `;
    this.hud = this.root.querySelector('.hud');
    this.moduleNav = this.root.querySelector('.module-nav');
    this.overlays = this.root.querySelector('#overlays');
    this.menuDialog = this.root.querySelector('#menu-dialog');
    this._moduleLabels = moduleLabels;
    this._buildModuleNav(0);
    this.listeners = {};
    this.root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'menu') openDialog(this.menuDialog, btn);
      if (action === 'resume') closeDialog(this.menuDialog);
      if (action === 'textmode') this.toggleTextMode();
      this.listeners[action]?.(btn);
    });
  }

  _buildModuleNav(active = 0) {
    this.moduleNav.innerHTML = '';
    this._moduleLabels.forEach((label, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.classList.toggle('active', i === active);
      b.setAttribute('aria-current', i === active ? 'page' : 'false');
      b.addEventListener('click', () => { this.setModule(i); this.onModuleChange?.(i); });
      this.moduleNav.appendChild(b);
    });
  }

  setModule(i) {
    [...this.moduleNav.children].forEach((b, j) => {
      b.classList.toggle('active', i === j);
      b.setAttribute('aria-current', i === j ? 'page' : 'false');
    });
  }

  on(action, fn) { this.listeners[action] = fn; }

  toggleTextMode() {
    const tm = document.getElementById('textmode');
    const canvas = document.getElementById('app');
    const showing = tm.hidden;
    tm.hidden = !showing;
    canvas.style.visibility = showing ? 'hidden' : 'visible';
    announce(showing ? 'Text mode on' : 'Text mode off');
    return showing;
  }

  setStatus(text, { announce: doAnnounce = true } = {}) {
    this.hud.textContent = text;
    if (doAnnounce) announce(text);
  }
}
