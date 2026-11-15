// A reading surface within the world: the cabin/query stays owned by the station.
export function createEvidenceWorkspace({ host, content, onDismiss, invalidate }) {
  const shell = document.createElement('dialog');
  shell.className = 'evidence-workspace';
  shell.setAttribute('aria-label', 'Evidence workspace');
  const header = document.createElement('header'); header.className = 'evidence-workspace-header';
  const title = document.createElement('p'); title.textContent = 'VESTA · Evidence';
  const back = document.createElement('button'); back.type = 'button';
  back.className = 'evidence-workspace-back'; back.textContent = '← Back to the 3D collection';
  back.setAttribute('aria-label', 'Back to the 3D collection'); back.onclick = () => onDismiss();
  header.append(title, back); shell.append(header, content); host.append(shell);
  let trigger = null, disposed = false;
  // Do not turn reading, scrolling or arrow-key navigation into a station flight.
  for (const event of ['pointerdown', 'pointerup', 'wheel', 'keydown']) shell.addEventListener(event, e => e.stopPropagation());
  shell.addEventListener('cancel', event => { event.preventDefault(); onDismiss(); });
  const handle = {
    element: content, shell,
    get target() { return Number(shell.open); },
    open() {
      if (disposed || shell.open) return handle;
      trigger = document.activeElement;
      content.hidden = false; content.inert = false; content.setAttribute('aria-hidden', 'false');
      host.dataset.evidenceFocus = 'true'; shell.showModal(); back.focus({ preventScroll: true }); invalidate?.();
      return handle;
    },
    close() {
      if (!shell.open) return handle;
      shell.close(); content.hidden = true; content.inert = true; content.setAttribute('aria-hidden', 'true');
      delete host.dataset.evidenceFocus;
      if (trigger?.isConnected && !trigger.closest('[inert]')) trigger.focus({ preventScroll: true });
      invalidate?.(); return handle;
    },
    toggle() { return shell.open ? handle.close() : handle.open(); },
    set(options = {}) { if (options.title) title.textContent = `VESTA · ${options.title}`; return handle; },
    dispose() { handle.close(); disposed = true; shell.remove(); }
  };
  content.hidden = true; content.inert = true;
  return handle;
}
