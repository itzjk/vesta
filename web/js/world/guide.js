const copy = {
  transit: 'Choose a cabin. Trace its fire evidence.',
  flame: 'Earth: teardrop. Space: rounded flame.',
  evidence: 'Pick a sample. Inspect its evidence.',
  drill: 'Rehearse a cabin fire.',
  trust: 'Inspect how VESTA checks evidence.',
  robotics: 'Humanoid inspection'
};

export function createGuide(overlay) {
  const section = document.createElement('section');
  section.className = 'world-guide'; section.dataset.stationUi = 'guide';
  section.setAttribute('aria-label', 'Station guide');
  const intro = document.createElement('div'); intro.className = 'world-guide-intro';
  const title = document.createElement('h1'); intro.append(title);
  const actions = document.createElement('div'); actions.className = 'world-actions'; actions.setAttribute('aria-label', 'Station actions');
  section.append(intro, actions); overlay.append(section);
  const host = overlay.parentElement;
  let current = [], buttons = [], explanationButton, missionDialog, stationId, context, lastPanel, explanationPending = false, explanationOpen = false;
  let tools, toolsSummary;
  const closeTools = (focus = false) => {
    if (!tools?.open) return;
    tools.open = false;
    if (focus) toolsSummary.focus({ preventScroll: true });
  };
  const outsideTools = event => { if (tools?.open && !tools.contains(event.target)) closeTools(); };
  const toolsKeydown = event => {
    if (event.key === 'Escape' && tools?.open) {
      event.preventDefault(); event.stopPropagation(); closeTools(true);
    }
  };
  document.addEventListener('pointerdown', outsideTools);
  section.addEventListener('keydown', toolsKeydown);
  const mission = (topic, button) => {
    overlay.querySelector('.world-mission-toggle')?.click();
    [...document.querySelectorAll('.mission-brief nav button')].find(item => item.textContent === topic)?.click();
    missionDialog = document.querySelector('.mission-brief');
    missionDialog?.addEventListener('close', () => button.focus(), { once: true });
  };
  function stationExplanation(station, definitions) {
    const action = id => definitions.find(item => item.id === id);
    if (station === 'flame') return action('source');
    if (station === 'robotics' && action('agents')) return { ...action('agents'), label: 'Concept & limits' };
    if (station === 'drill') {
      const evidence = action('decision-evidence');
      return evidence && { ...evidence, label: 'Evidence & limits', run(button) {
        if (!evidence.expanded?.()) evidence.run(button);
        const rationale = host.querySelector('.world-drill:not([hidden]) .drill-rationale');
        if (rationale) { rationale.open = true; rationale.scrollIntoView({ block: 'nearest' }); }
      } };
    }
    if (station === 'trust') return { id: 'explain', label: 'Machines & limits', run(button) {
      const checks = action('checks');
      if (!checks?.expanded?.()) checks?.run(button);
      host.querySelector('[data-trust=report]')?.click();
    } };
    if (station === 'transit') return { id: 'explain', label: 'NASA observation', run() {
      host.querySelector('.world-marker[aria-label="Read the communication observation and image credits"]')?.click();
    } };
    return { id: 'explain', label: station === 'robotics' ? 'Concept & limits' : 'Method & limits', run(button) {
      mission(station === 'robotics' ? 'Space robotics' : 'Method & limits', button);
    } };
  }
  function placeIntroduction() {
    const prior = lastPanel;
    const presenting = host.dataset.film === 'true' || host.dataset.questionState === 'running';
    const panel = !presenting && host.dataset.hologramOpen === 'true'
      ? prior?.classList.contains('world-hologram') && !prior.hidden && prior.getAttribute('aria-hidden') === 'false'
        ? prior : host.querySelector('.world-hologram[aria-hidden=false]:not([hidden]):not(.wc-source)')
      : null;
    lastPanel = panel;
    const inPanel = Boolean(panel);
    const parent = inPanel ? panel : section;
    if (intro.parentElement !== parent) parent.prepend(intro);
    intro.classList.toggle('world-guide-in-panel', inPanel);
    if (context && context.parentElement !== (panel || intro)) (panel || intro).append(context);
    const open = Boolean(panel) || Boolean(missionDialog?.open);
    if (explanationPending && open) { explanationOpen = true; explanationPending = false; }
    if (explanationOpen && !open) {
      const button = explanationButton;
      requestAnimationFrame(() => {
        const focused = document.activeElement;
        if (button?.isConnected && button.checkVisibility() && (focused === document.body || !focused?.checkVisibility() || stationId === 'drill' && focused?.matches('.world-marker'))) button.focus();
      });
      explanationOpen = false;
    }
  }
  return {
    set(station, definitions = []) {
      closeTools(); tools = toolsSummary = null;
      section.hidden = !copy[station.id];
      section.prepend(intro); context?.remove(); stationId = station.id; lastPanel = null;
      title.textContent = copy[station.id] || '';
      explanationPending = explanationOpen = false;
      const explanation = stationExplanation(station.id, definitions);
      context = explanation?.context;
      if (context) intro.append(context);
      current = definitions.filter(action => action.id !== explanation?.id);
      if (explanation) {
        const priorIndex = definitions.findIndex(action => action.id === explanation.id);
        current.splice(priorIndex < 0 ? Math.min(1, current.length) : priorIndex, 0, explanation);
      }
      buttons = current.map(action => {
        const button = document.createElement('button'); button.type = 'button';
        button.dataset.stationAction = action.id;
        button.onclick = () => {
          const keyboard = button.matches(':focus-visible');
          const trigger = tools?.contains(button) ? toolsSummary : button;
          closeTools(trigger === toolsSummary);
          if (action === explanation) { explanationPending = true; explanationButton = trigger; }
          action.run(trigger);
          if (action === explanation && keyboard) requestAnimationFrame(() => {
            placeIntroduction();
            lastPanel?.querySelector('[aria-label^=Close],.evidence-close,.drill-dismiss')?.focus();
          });
        };
        if (action === explanation) {
          button.dataset.stationExplain = ''; explanationButton = button;
          if (station.id === 'evidence' || station.id === 'robotics') button.setAttribute('aria-haspopup', 'dialog');
        }
        if (action.primary) button.className = 'world-action-primary';
        return button;
      });
      actions.replaceChildren(); delete actions.dataset.tools;
      if (station.id === 'evidence') {
        // Keep every action and identifier; secondary tasks use an ordinary disclosure,
        // with native Tab/Enter behavior rather than an incomplete ARIA menu.
        const primary = new Set(['overview', 'cabin', 'ask']);
        tools = document.createElement('details'); tools.className = 'world-tools';
        toolsSummary = document.createElement('summary'); toolsSummary.textContent = 'Tools';
        toolsSummary.setAttribute('aria-label', 'More evidence tools');
        const menu = document.createElement('div'); menu.className = 'world-tools-list';
        tools.append(toolsSummary, menu);
        buttons.forEach((button, i) => (primary.has(current[i].id) ? actions : menu).append(button));
        actions.append(tools); actions.dataset.tools = 'true';
      } else actions.append(...buttons);
      this.update();
    },
    update() {
      placeIntroduction();
      current.forEach((action, i) => {
        const button = buttons[i], text = typeof action.label === 'function' ? action.label() : action.label;
        if (button.textContent !== text) button.textContent = text;
        button.disabled = Boolean(action.disabled?.());
        if (action.expanded) button.setAttribute('aria-expanded', String(Boolean(action.expanded())));
      });
      if (tools) tools.dataset.active = String([...tools.querySelectorAll('button')].some(button => button.getAttribute('aria-expanded') === 'true'));
    },
    dispose() { document.removeEventListener('pointerdown', outsideTools); section.removeEventListener('keydown', toolsKeydown); context?.remove(); intro.remove(); section.remove(); }
  };
}
