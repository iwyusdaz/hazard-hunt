/**
 * Live-region announcer (shared template). State changes go to an aria-live region.
 * @module a11y/announcer
 */
let politeNode = null;
let assertiveNode = null;

function ensure() {
  if (politeNode) return;
  const container = document.createElement('div');
  container.className = 'visually-hidden';
  politeNode = document.createElement('div');
  politeNode.setAttribute('aria-live', 'polite');
  assertiveNode = document.createElement('div');
  assertiveNode.setAttribute('aria-live', 'assertive');
  container.append(politeNode, assertiveNode);
  document.body.appendChild(container);
}

export function announce(message, { assertive = false } = {}) {
  ensure();
  const node = assertive ? assertiveNode : politeNode;
  node.textContent = '';
  requestAnimationFrame(() => { node.textContent = message; });
}
