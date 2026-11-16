export const VIDEO_CASES = [
  {
    id: 'cool-flame', title: 'When the visible flame disappears', experiment: 'FLEX · recorded NASA experiment',
    video: 'https://svs.gsfc.nasa.gov/vis/a010000/a011300/a011318/ISS_FlexFlame-540-MASTER_high.mp4',
    poster: 'https://svs.gsfc.nasa.gov/vis/a010000/a011300/a011318/pf1-1024.jpg',
    source: 'https://svs.gsfc.nasa.gov/11318/', credit: "Science@NASA / NASA's Goddard Space Flight Center · SVS 11318",
    problem: 'Is the fire out just because the visible flame has gone?',
    observation: 'In this controlled droplet experiment, fuel continued burning under certain conditions after the visible flame disappeared.',
    response: 'Inspect the cool-flame findings and their conditions. The drill shows why a decision needs evidence beyond appearance.',
    limit: 'A fuel-droplet observation does not establish the outcome of a solid-material cabin fire.',
    query: 'cool flame'
  },
  {
    id: 'material-spread', title: 'When the same material burns differently', experiment: 'Saffire-V · recorded NASA experiment',
    video: 'https://images-assets.nasa.gov/video/GRC-2021-CN-00008/GRC-2021-CN-00008~mobile.mp4',
    poster: 'https://images-assets.nasa.gov/video/GRC-2021-CN-00008/GRC-2021-CN-00008~medium.jpg',
    source: 'https://images.nasa.gov/details/GRC-2021-CN-00008', credit: 'NASA Glenn Research Center · GRC-2021-CN-00008',
    problem: 'Does knowing the material alone tell us how a fire will spread?',
    observation: 'This Saffire-V recording shows ribbed Plexiglas burning. NASA reports faster growth on the thinner ribs than on the thicker sample regions.',
    response: 'Compare recorded conditions before transferring a finding to your cabin. VESTA exposes where its collection does not cover your question.',
    limit: 'Geometry and thickness are not matched by VESTA. This Saffire-V video is context; it is not an added row in the evidence collection.',
    query: 'flame'
  }
];

const node = (tag, text, className) => { const el = document.createElement(tag); if (text != null) el.textContent = text; if (className) el.className = className; return el; };

export function createVideoCases({ onEvidence, onDrill, onModel }) {
  const dialog = node('dialog', null, 'world-cases'); dialog.setAttribute('aria-labelledby', 'world-cases-title');
  const header = node('header'), heading = node('h2', 'Watch the problem. Inspect the response.'); heading.id = 'world-cases-title';
  const dismiss = node('button', 'Close'); dismiss.type = 'button'; dismiss.setAttribute('aria-label', 'Close video cases');
  header.append(heading, dismiss);
  const choices = node('nav'); choices.setAttribute('aria-label', 'Video cases');
  const body = node('div', null, 'world-case-body');
  const disclosure = node('p', 'Original NASA footage with credited sources. VESTA explanations are SI-assisted interpretations; the linked drill is scripted.', 'world-case-disclosure');
  dialog.append(header, choices, body, disclosure); document.body.append(dialog);
  let selected = VIDEO_CASES[0], player = null, trigger = null;
  const close = () => { player?.pause(); if (dialog.open) dialog.close(); };
  const buttons = VIDEO_CASES.map((item, i) => {
    const button = node('button', item.title); button.type = 'button'; button.dataset.videoCase = item.id;
    button.onclick = () => render(item); choices.append(button); return button;
  });
  function render(item) {
    player?.pause(); selected = item; body.replaceChildren();
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(VIDEO_CASES[i].id === item.id)));
    const figure = node('figure'), video = node('video'); player = video;
    video.controls = true; video.playsInline = true; video.preload = 'none'; video.poster = item.poster; video.src = item.video;
    video.setAttribute('aria-label', item.experiment); video.setAttribute('aria-describedby', 'world-case-observation');
    const caption = node('figcaption'), credit = node('a', item.credit); credit.href = item.source; credit.target = '_blank'; credit.rel = 'noopener noreferrer'; credit.onclick = () => video.pause();
    caption.append(node('strong', item.experiment), credit);
    const error = node('p', 'The video could not load. Open the credited NASA source to watch it there.'); error.hidden = true; error.setAttribute('role', 'status');
    video.addEventListener('error', () => { error.hidden = false; });
    const play = node('button', 'Play NASA video'); play.type = 'button'; play.dataset.casePlay = '';
    play.onclick = async () => {
      error.hidden = true;
      if (!video.paused) { video.pause(); return; }
      try { await video.play(); } catch { error.hidden = false; }
    };
    video.addEventListener('play', () => { play.textContent = 'Pause NASA video'; });
    video.addEventListener('pause', () => { play.textContent = 'Play NASA video'; });
    figure.append(video, play, caption, error);
    const explanation = node('div', null, 'world-case-explanation');
    for (const [label, text] of [['The problem', item.problem], ['What NASA observed', item.observation], ['Explore the response', item.response]]) {
      const section = node('section'); section.append(node('h3', label)); const p = node('p', text); if (label === 'What NASA observed') p.id = 'world-case-observation'; section.append(p); explanation.append(section);
    }
    explanation.append(node('p', item.limit, 'world-case-limit'));
    const actions = node('div', null, 'world-case-actions');
    const evidence = node('button', 'Explore the evidence'), drill = node('button', 'Try the scripted drill'); evidence.type = drill.type = 'button';
    evidence.onclick = () => { close(); onEvidence(item.query); };
    drill.onclick = () => { close(); onDrill(); };
    actions.append(evidence, drill);
    if (item.id === 'cool-flame' && onModel) {
      const model = node('button', 'Explore the FLEX table model'); model.type = 'button';
      model.onclick = () => { close(); onModel(); };
      actions.append(model);
      explanation.append(node('p', 'The FLEX table model explores archived droplet-test end states. This footage provides context; it is not synchronized to a table row or used as model input.', 'world-case-limit'));
    }
    explanation.append(actions); body.append(figure, explanation);
  }
  dismiss.onclick = close;
  const cancel = event => { event.preventDefault(); close(); };
  const restore = () => { player?.pause(); if (trigger?.isConnected) trigger.focus({ preventScroll: true }); };
  const keys = event => { if (dialog.open && event.key.toLowerCase() === 'h') event.stopImmediatePropagation(); };
  dialog.addEventListener('cancel', cancel); dialog.addEventListener('close', restore); dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
  window.addEventListener('hashchange', close); document.addEventListener('keydown', keys, true);
  return {
    open(from) { trigger = from || document.activeElement; render(selected); if (!dialog.open) dialog.showModal(); dismiss.focus({ preventScroll: true }); },
    close,
    dispose() { close(); window.removeEventListener('hashchange', close); document.removeEventListener('keydown', keys, true); dialog.remove(); }
  };
}
