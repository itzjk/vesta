const copy = {
  transit: ['Fire cannot wait for Earth.', 'Explore the flame, check your cabin against NASA evidence, then follow an on-board fire drill. Choose where to begin.'],
  flame: ['A different environment. A different flame.', 'Explore a visual explanation, then inspect the NASA observation behind it.'],
  evidence: ['What evidence covers your cabin?', 'Dots are NASA test rows. The diamond is your cabin. Change its conditions to explore gaps in the evidence.'],
  drill: ['An alarm. Eight decisions. No instant help.', 'Follow a scripted avionics fire. Advance one decision at a time to inspect the evidence, limits and source gaps.'],
  trust: ['Inspect the decisions behind the scene.', 'Run reviewed cases, inspect the rules and download the data that VESTA uses.'],
  robotics: ['Give the evidence a mission.', 'Concept simulation. Watch a digital robot observe, check your cabin’s evidence and request human approval before an inspection.']
};

export function createGuide(overlay) {
  const section = document.createElement('section');
  section.className = 'world-guide'; section.dataset.stationUi = 'guide';
  section.setAttribute('aria-label', 'Station guide');
  const intro = document.createElement('div'); intro.className = 'world-guide-intro';
  const label = document.createElement('p'); label.className = 'world-guide-label';
  const title = document.createElement('h1'), description = document.createElement('p');
  intro.append(label, title, description);
  const actions = document.createElement('div'); actions.className = 'world-actions'; actions.setAttribute('aria-label', 'Station actions');
  section.append(intro, actions); overlay.append(section);
  let current = [], buttons = [];
  return {
    set(station, definitions = []) {
      section.hidden = !copy[station.id];
      label.textContent = `VESTA / ${station.label}`;
      title.textContent = copy[station.id]?.[0] || '';
      description.textContent = copy[station.id]?.[1] || '';
      current = definitions;
      buttons = current.map(action => {
        const button = document.createElement('button'); button.type = 'button';
        button.dataset.stationAction = action.id;
        button.onclick = () => action.run(button);
        if (action.primary) button.className = 'world-action-primary';
        actions.append(button); return button;
      });
      actions.replaceChildren(...buttons);
      this.update();
    },
    update() {
      current.forEach((action, i) => {
        const button = buttons[i], text = typeof action.label === 'function' ? action.label() : action.label;
        if (button.textContent !== text) button.textContent = text;
        button.disabled = Boolean(action.disabled?.());
        if (action.expanded) button.setAttribute('aria-expanded', String(Boolean(action.expanded())));
      });
    },
    dispose() { section.remove(); }
  };
}
