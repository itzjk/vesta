const node = (tag, text, className) => {
  const element = document.createElement(tag);
  if (text != null) element.textContent = text;
  if (className) element.className = className;
  return element;
};

export function createRackUI({ materials, onSelect, onHover }) {
  const element = node('div', null, 'evidence-rack-ui');
  element.dataset.stationUi = 'evidence'; element.hidden = true;
  const legend = node('div', null, 'evidence-rack-legend');
  legend.setAttribute('aria-label', 'Evidence coverage in VESTA’s collection, not safety');
  for (const [status, label] of [['PROVEN', 'Nearby'], ['EXTRAPOLATED', 'Elsewhere'], ['NEVER_TESTED', 'No source']]) {
    const item = node('span', label); item.dataset.rackStatus = status;
    legend.append(item);
  }
  const label = node('p', 'Illustrative research samples', 'evidence-rack-caption');
  const order = node('p', 'Lamps: prevention · detection · suppression', 'evidence-rack-order');
  const names = node('nav', null, 'evidence-rack-names'); names.setAttribute('aria-label', 'Research material samples');
  const buttons = new Map();
  for (const [id, material] of Object.entries(materials)) {
    const button = node('button', material.label, 'evidence-sample-name'); button.type = 'button';
    button.dataset.sampleMaterial = id;
    button.setAttribute('aria-label', `${material.label}: open material evidence`);
    button.setAttribute('aria-expanded', 'false');
    button.onclick = () => onSelect(id);
    button.onpointerenter = button.onfocus = () => onHover?.(id);
    button.onpointerleave = button.onblur = () => onHover?.(null);
    names.append(button); buttons.set(id, button);
  }
  for (const type of ['pointerdown', 'pointerup']) names.addEventListener(type, event => event.stopPropagation());
  element.append(label, order, legend, names);
  return {
    element,
    update({ visible, positions, selected = null, dimmed = null, panelOpen = false }) {
      element.hidden = !visible;
      element.dataset.panelOpen = String(panelOpen);
      if (!visible) return;
      for (const [id, button] of buttons) {
        const point = positions.get(id);
        button.hidden = !point || point.hidden || panelOpen;
        if (point) button.style.transform = `translate(${Math.round(point.x)}px,${Math.round(point.y)}px) translate(-50%,-50%)`;
        button.setAttribute('aria-expanded', String(selected === id));
        button.dataset.dimmed = String(dimmed !== null && !dimmed.has(id));
      }
    },
    dispose() { element.remove(); buttons.clear(); }
  };
}
