// The page is one fixed 1920x1080 stage scaled to the viewport with a CSS transform, so a 1366 px laptop and the film see the same layout.
import { svg } from './el.js';
export const STAGE = { w: 1920, h: 1080 };
let scale = 1;
export const stageScale = () => scale;

export function fitStage(stage) {
  const vw = document.documentElement.clientWidth || innerWidth, vh = document.documentElement.clientHeight || innerHeight;
  scale = Math.min(vw / STAGE.w, vh / STAGE.h);
  const x = Math.max(0, (vw - STAGE.w * scale) / 2), y = Math.max(0, (vh - STAGE.h * scale) / 2);
  stage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  stage.style.setProperty('--stage-scale', String(scale));
}

// A static, faint star field. The positions come from a fixed seed, so every load and every capture draws the same sky.
function stars(count = 170) {
  let a = 20261114;
  const rnd = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const s = svg('svg#stars', { viewBox: `0 0 ${STAGE.w} ${STAGE.h}`, 'aria-hidden': 'true', preserveAspectRatio: 'none' });
  for (let i = 0; i < count; i++) {
    const big = rnd() < 0.12;
    s.append(svg('circle', { cx: (rnd() * STAGE.w).toFixed(1), cy: (rnd() * STAGE.h).toFixed(1), r: (big ? 1.3 + rnd() * 0.9 : 0.5 + rnd() * 0.7).toFixed(2),
      fill: rnd() < 0.2 ? 'rgb(255,214,170)' : 'rgb(190,225,255)', opacity: (big ? 0.28 + rnd() * 0.25 : 0.12 + rnd() * 0.3).toFixed(2) }));
  }
  return s;
}

export function initStage(stage) {
  stage.prepend(stars());
  const fit = () => fitStage(stage);
  fit();
  addEventListener('resize', fit);
  return fit;
}
