export const STAGE = { w: 1920, h: 1080 };
let scale = 1;
export const stageScale = () => scale;

export function fitStage(stage) {
  const vw = document.documentElement.clientWidth || innerWidth, vh = document.documentElement.clientHeight || innerHeight;
  const phone = vw < 760;
  const fluid = phone;
  document.documentElement.dataset.phone = phone ? 'true' : 'false';
  if (fluid) {
    scale = 1;
    stage.style.transform = 'none';
    stage.style.setProperty('--stage-scale', '1');
    return;
  }
  const head = phone ? 104 : 0;
  scale = Math.min(vw / STAGE.w, (vh - head) / STAGE.h);
  const x = Math.max(0, (vw - STAGE.w * scale) / 2), y = Math.max(0, (vh - head - STAGE.h * scale) / 2) + head;
  stage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  stage.style.setProperty('--stage-scale', String(scale));
}

export function initStage(stage) {
  // A quiet background keeps the evidence in focus.
  const fit = () => fitStage(stage);
  fit();
  addEventListener('resize', fit);
  return fit;
}
