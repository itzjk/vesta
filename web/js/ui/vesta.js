import { el } from './el.js';
import { tag } from './chip.js';

const POSES = ['alert', 'point', 'nosource'];
let nextArtId = 0;

function art(pose) {
  const alert = pose === 'alert', point = pose === 'point', nos = pose === 'nosource';
  const beacon = point ? 'var(--ice)' : 'var(--amber)';
  const look = point ? 3.2 : 0;
  const ry = alert ? 19 : 16.5, rx = alert ? 14.5 : 13.5;
  const eye = cx => `
    <ellipse cx="${cx}" cy="134" rx="${rx}" ry="${ry}" fill="var(--vesta-eye)"/>
    <ellipse cx="${cx + look}" cy="136" rx="${rx - 3.5}" ry="${ry - 4}" fill="url(#vo-iris)"/>
    <circle cx="${cx - 4 + look}" cy="${alert ? 125 : 127}" r="${alert ? 5.4 : 4.6}" fill="#fff"/>
    <circle cx="${cx + 5 + look}" cy="141" r="2.2" fill="#fff" opacity=".85"/>`;
  const brows = nos
    ? `<path d="M68 113 Q78 104 90 106" /><path d="M132 113 Q122 104 110 106" />`
    : alert
    ? `<path d="M67 104 Q79 97 91 103" /><path d="M133 104 Q121 97 109 103" />`
    : `<path d="M68 111 Q80 106 91 110" /><path d="M132 111 Q120 106 109 110" />`;
  const mouth = nos ? `<path d="M92 164 Q100 161 108 164" />` : alert ? `<ellipse cx="100" cy="164" rx="4.5" ry="5.5" fill="var(--vesta-eye)" stroke="none"/>` : `<path d="M91 161 Q100 169 109 161" />`;
  const L = nos ? [22, 168, -25] : alert ? [26, 132, 20] : [30, 160, 0];
  const R = nos ? [178, 168, 25] : alert ? [174, 132, -20] : point ? [190, 128, -12] : [170, 160, 0];
  const mitt = ([cx, cy, rot], open, side) => `
    <path d="M${side < 0 ? 58 : 142} 152 L${cx} ${cy}" stroke="var(--vesta-body)" stroke-width="11" stroke-linecap="round"/>
    <g transform="translate(${cx} ${cy}) rotate(${rot})">
      <ellipse rx="15" ry="13" fill="url(#vo-orange)"/>
      <circle cx="${side * 2}" cy="-13" r="6" fill="url(#vo-orange)"/>
      ${open ? `<ellipse rx="8.5" ry="7" fill="#ffb27a" opacity=".85"/>` : ''}
      ${point && side > 0 ? `<path d="M10 -4 L27 -7" stroke="var(--vesta-orange)" stroke-width="9" stroke-linecap="round"/>` : ''}
    </g>`;
  return `
<svg viewBox="0 0 212 250" width="100%" height="100%" role="img" aria-label="VESTA, the fire officer${nos ? ': no source' : alert ? ': alert' : ''}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="vo-body" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="#fffdf8"/><stop offset=".6" stop-color="#f1ece2"/><stop offset="1" stop-color="#c9bfae"/></radialGradient>
    <radialGradient id="vo-helmet" cx="36%" cy="24%" r="85%"><stop offset="0" stop-color="#ff7a52"/><stop offset=".5" stop-color="#f5411a"/><stop offset="1" stop-color="#b3260c"/></radialGradient>
    <linearGradient id="vo-orange" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9a4d"/><stop offset="1" stop-color="#e85a10"/></linearGradient>
    <radialGradient id="vo-iris" cx="50%" cy="70%" r="70%"><stop offset="0" stop-color="#6fb6ff"/><stop offset=".55" stop-color="#1d3f8a"/><stop offset="1" stop-color="#0a0607"/></radialGradient>
    <radialGradient id="vo-ice" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#d6efff"/><stop offset=".5" stop-color="rgb(66,163,255)"/><stop offset="1" stop-color="#14408a"/></radialGradient>
    <radialGradient id="vo-halo" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${beacon}" stop-opacity=".75"/><stop offset="1" stop-color="${beacon}" stop-opacity="0"/></radialGradient>
  </defs>
  <g transform="translate(6 4)">
    <path d="M60 164 C26 172 14 204 24 232 C46 224 64 208 72 188 Z" fill="url(#vo-orange)"/>
    <path d="M140 164 C174 172 186 204 176 232 C154 224 136 208 128 188 Z" fill="url(#vo-orange)"/>
    <circle cx="100" cy="222" r="19" fill="url(#vo-halo)" opacity=".5" style="--c:var(--ice)"/>
    <circle class="vo-sphere" cx="100" cy="221" r="12" fill="url(#vo-ice)"/>
    <rect x="84" y="196" width="32" height="13" rx="4" fill="var(--vesta-dark)"/>
    <path d="M54 100 C48 150 62 200 100 200 C138 200 152 150 146 100 Z" fill="url(#vo-body)"/>
    <path d="M90 176 C90 200 95 214 100 220 C105 214 110 200 110 176 Z" fill="#e85a10"/>
    <ellipse cx="66" cy="152" rx="8" ry="5" fill="#ff9a6b" opacity=".45"/><ellipse cx="134" cy="152" rx="8" ry="5" fill="#ff9a6b" opacity=".45"/>
    ${eye(80)}${eye(120)}
    <g fill="none" stroke="var(--vesta-dark)" stroke-width="3.4" stroke-linecap="round">${brows}${mouth}</g>
    ${mitt(L, nos, -1)}${mitt(R, nos, 1)}
    <path d="M46 96 C44 52 70 30 100 30 C130 30 156 52 154 96 Z" fill="url(#vo-helmet)"/>
    <path d="M47 88 Q100 104 153 88" fill="none" stroke="var(--vesta-gold)" stroke-width="7"/>
    <ellipse cx="100" cy="98" rx="70" ry="12" fill="#c9300f"/>
    <ellipse cx="100" cy="95" rx="70" ry="10.5" fill="url(#vo-helmet)"/>
    <path d="M100 48 L114 54 V68 C114 77 107 82 100 85 C93 82 86 77 86 68 V54 Z" fill="var(--vesta-gold)" stroke="#fff3d0" stroke-width="1.5"/>
    <circle cx="100" cy="65" r="5.5" fill="#fff8e6"/>
    <circle class="vo-halo${alert ? ' vo-pulse' : ''}" cx="100" cy="24" r="24" fill="url(#vo-halo)"/>
    <rect x="93" y="27" width="14" height="7" rx="2" fill="var(--vesta-dark)"/>
    <circle class="vo-beacon" cx="100" cy="22" r="8.5" fill="${beacon}"/>
    <circle cx="97" cy="19" r="2.6" fill="#fff" opacity=".9"/>
  </g>
</svg>`;
}

class VestaOfficer extends HTMLElement {
  static get observedAttributes() { return ['pose', 'size', 'dir']; }
  connectedCallback() { this.render(); }
  attributeChangedCallback() { if (this.isConnected) this.render(); }
  render() {
    const pose = POSES.includes(this.getAttribute('pose')) ? this.getAttribute('pose') : 'point';
    const size = Math.max(24, Number(this.getAttribute('size')) || 140);
    this.style.width = size + 'px'; this.style.height = Math.round(size * 250 / 212) + 'px';
    this.dataset.pose = pose;
    this.artId ||= `officer-${++nextArtId}-`;
    this.innerHTML = art(pose).replace(/id="vo-/g, `id="${this.artId}`).replace(/url\(#vo-/g, `url(#${this.artId}`);
    if (this.getAttribute('dir') === 'left') this.firstElementChild.style.transform = 'scaleX(-1)';
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('vesta-officer')) customElements.define('vesta-officer', VestaOfficer);


export function vesta(pose = 'point', opts = {}) {
  const who = el('vesta-officer', { pose, size: opts.size || 140, dir: opts.dir });
  if (opts.say == null || opts.say === '') return who;
  return el('div', { class: 'vesta-say' + (opts.below ? ' vesta-say-below' : '') + (opts.class ? ' ' + opts.class : ''), data: { pose } }, who,
    el('div.bubble', { data: { vestaLine: opts.lineId || null } }, el('p.bubble-text', opts.say), tag('VESTA · interpretation', { tone: 'ice', class: 'bubble-tag' })));
}


export function vestaMark(size = 40) {
  const box = el('span.vesta-mark', { style: { width: size + 'px', height: size + 'px', display: 'inline-block' }, 'aria-hidden': 'true' });
  box.innerHTML = `<svg viewBox="0 0 64 64" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <path d="M17 34 C15 52 22 60 32 60 C42 60 49 52 47 34 Z" fill="#f1ece2"/>
    <ellipse cx="25.5" cy="45" rx="4.2" ry="5.4" fill="#0a0607"/><ellipse cx="38.5" cy="45" rx="4.2" ry="5.4" fill="#0a0607"/>
    <circle cx="24.3" cy="43" r="1.6" fill="#fff"/><circle cx="37.3" cy="43" r="1.6" fill="#fff"/>
    <path d="M13 33 C12 16 22 8 32 8 C42 8 52 16 51 33 Z" fill="#f5411a"/>
    <path d="M13.5 29.5 Q32 36 50.500 29.5" fill="none" stroke="#e0a93a" stroke-width="3"/>
    <ellipse cx="32" cy="33.5" rx="25" ry="4.6" fill="#d8350f"/>
    <path d="M32 14 l5 2.2 v5 c0 3.4 -2.6 5.2 -5 6.3 c-2.4 -1.100 -5 -2.900 -5 -6.300 v-5 z" fill="#e0a93a"/>
    <circle cx="32" cy="6" r="3.6" fill="rgb(255,128,31)"/>
  </svg>`;
  return box;
}
