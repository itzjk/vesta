import { el } from './el.js';
import { tag } from './chip.js';

const POSES = ['alert', 'point', 'nosource'];
let nextArtId = 0;

function art(pose) {
  const alert = pose === 'alert', point = pose === 'point', nos = pose === 'nosource';
  const beacon = 'var(--amber)';
  const look = point ? 3.2 : 0;
  const ry = alert ? 19 : 16.5, rx = alert ? 14.5 : 13.5;
  const eye = cx => `
    <ellipse cx="${cx}" cy="135" rx="${rx + 1.4}" ry="${ry + 1.4}" fill="#c9bfae" opacity=".6"/>
    <ellipse cx="${cx}" cy="134" rx="${rx}" ry="${ry}" fill="var(--vesta-eye)"/>
    <ellipse cx="${cx + look}" cy="136" rx="${rx - 3.5}" ry="${ry - 4}" fill="var(--earth-deep)"/>
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
      <ellipse rx="15" ry="13" fill="var(--rust)"/>
      <circle cx="${side * 2}" cy="-13" r="6" fill="var(--rust)"/>
      ${open ? `<ellipse rx="8.5" ry="7" fill="#ffb27a" opacity=".85"/>` : ''}
      ${point && side > 0 ? `<path d="M10 -4 L27 -7" stroke="var(--vesta-orange)" stroke-width="9" stroke-linecap="round"/>` : ''}
    </g>`;
  return `
<svg viewBox="0 0 212 250" width="100%" height="100%" role="img" aria-label="VESTA, the fire officer${nos ? ': no source' : alert ? ': alert' : ''}" xmlns="http://www.w3.org/2000/svg">

  <g transform="translate(6 4)">
    <path d="M60 158 C34 157 12 198 24 226 Q53 217 75 187 Z" fill="var(--rust)" stroke="#ffa357" stroke-width="1"/>
    <path d="M55 167 Q27 183 26 211" fill="none" stroke="#ffc28a" stroke-width="3" stroke-linecap="round" opacity=".65"/>
    <path d="M140 158 C166 157 188 198 176 226 Q147 217 125 187 Z" fill="var(--rust)" stroke="#ffa357" stroke-width="1"/>
    <path d="M146 167 Q172 187 174 211" fill="none" stroke="#ffbf81" stroke-width="2" opacity=".55"/>
    <circle cx="100" cy="222" r="19" fill="none" opacity=".5" style="--c:var(--earth)"/>
    <circle cx="100" cy="221" r="16" fill="none" stroke="#8fa3b5" stroke-width="1" opacity=".4"/>
    <circle class="vo-sphere" cx="100" cy="221" r="12" fill="var(--amber)"/>
    <path d="M92 218 A9 9 0 0 1 100 213" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".65"/>
    <path d="M85 194 H115 L119 208 Q100 213 81 208 Z" fill="var(--earth-deep)" stroke="#8fa3b5" stroke-width=".5"/>
    <path d="M49 98 C42 132 45 176 64 189 Q100 204 136 189 C155 176 158 132 151 98 Z" fill="var(--vesta-body)"/>
    <path d="M62 181 Q100 191 138 181 L134 190 Q100 200 66 190 Z" fill="var(--earth-deep)"/>
    <path d="M94 175 Q100 172 106 175 L106 199 Q100 208 94 199 Z" fill="var(--rust)"/>
    <path d="M57 108 Q50 140 58 167" fill="none" stroke="#fffdf8" stroke-width="3" opacity=".5" stroke-linecap="round"/>
    <ellipse cx="66" cy="152" rx="8" ry="5" fill="#ff9a6b" opacity=".45"/><ellipse cx="134" cy="152" rx="8" ry="5" fill="#ff9a6b" opacity=".45"/>
    ${eye(80)}${eye(120)}
    <g fill="none" stroke="var(--vesta-dark)" stroke-width="3.4" stroke-linecap="round">${brows}${mouth}</g>
    ${mitt(L, nos, -1)}${mitt(R, nos, 1)}
    <path d="M46 96 C44 52 70 30 100 30 C130 30 156 52 154 96 Z" fill="var(--rust)"/>
    <path d="M67 51 Q57 62 56 78" fill="none" stroke="#ffbc90" stroke-width="5" stroke-linecap="round" opacity=".7"/>
    <path d="M100 33 Q121 58 115 86" fill="none" stroke="#ff9867" stroke-width="2" opacity=".5"/>
    <path d="M47 88 Q100 104 153 88" fill="none" stroke="var(--vesta-gold)" stroke-width="7"/>
    <ellipse cx="100" cy="98" rx="70" ry="12" fill="#8f3a28"/>
    <ellipse cx="100" cy="95" rx="70" ry="10.5" fill="var(--rust)"/>
    <path d="M100 48 L114 54 V68 C114 77 107 82 100 85 C93 82 86 77 86 68 V54 Z" fill="var(--vesta-gold)" stroke="#fff3d0" stroke-width="1.5"/>
    <circle cx="100" cy="65" r="7" fill="#24262d"/>
    <circle cx="100" cy="65" r="4.6" fill="var(--amber)" stroke="#e8f7ff" stroke-width="1.2"/>
    <circle class="vo-halo${alert ? ' vo-pulse' : ''}" cx="100" cy="24" r="24" fill="none"/>
    <rect x="93" y="27" width="14" height="7" rx="2" fill="var(--vesta-dark)"/>
    <circle cx="100" cy="22" r="11" fill="#f3e7cf" opacity=".25" stroke="#fff3d0" stroke-width=".8"/>
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
    <path d="M13 33 C12 16 22 8 32 8 C42 8 52 16 51 33 Z" fill="#c8553d"/>
    <path d="M13.5 29.5 Q32 36 50.500 29.5" fill="none" stroke="#e0a458" stroke-width="3"/>
    <ellipse cx="32" cy="33.5" rx="25" ry="4.6" fill="#8f3a28"/>
    <path d="M32 14 l5 2.2 v5 c0 3.4 -2.6 5.2 -5 6.3 c-2.4 -1.100 -5 -2.900 -5 -6.300 v-5 z" fill="#e0a458"/>
    <circle cx="32" cy="6" r="3.6" fill="rgb(224,164,88)"/>
  </svg>`;
  return box;
}
