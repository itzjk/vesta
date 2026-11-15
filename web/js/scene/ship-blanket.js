const TAU = Math.PI * 2;
const pixels = new Map(), canvases = new Map(), pending = new Map();
const hash = n => { const s = Math.sin(n * 127.1 + 61.7) * 43758.5453; return s - Math.floor(s); };
export function blanketFolds(size) {
  return Array.from({ length: 64 }, (_, i) => {
    const a = hash(i * 8 + 2) * TAU;
    const fold = { x: hash(i * 8) * size, y: hash(i * 8 + 1) * size, cosine: Math.cos(a), sine: Math.sin(a), length: 15 + hash(i * 8 + 3) * size * .3, width: 1 + hash(i * 8 + 4) * 3, strength: (hash(i * 8 + 5) - .5) * 130 };
    fold.dx = Float64Array.from({ length: size }, (_, x) => (x - fold.x + size * 1.5) % size - size * .5);
    fold.dy = Float64Array.from({ length: size }, (_, y) => (y - fold.y + size * 1.5) % size - size * .5);
    fold.widthSquared = fold.width * fold.width; fold.lengthSquared = fold.length * fold.length;
    return fold;
  });
}
export function blanketRows(size, image, folds, from = 0, to = size) {
  for (let y = from; y < to; y++) for (let x = 0; x < size; x++) {
    let value = 128 + (hash(x + y * size) - .5) * 13;
    for (const fold of folds) {
      const dx = fold.dx[x], dy = fold.dy[y], u = dx * fold.cosine + dy * fold.sine, v = -dx * fold.sine + dy * fold.cosine;
      value += fold.strength * Math.exp(-v * v / fold.widthSquared - u * u / fold.lengthSquared);
    }
    const p = (y * size + x) * 4;
    image[p] = image[p + 1] = image[p + 2] = value; image[p + 3] = 255;
  }
  return image;
}
export function blanketPixels(size) { return blanketRows(size, new Uint8ClampedArray(size * size * 4), blanketFolds(size)); }
async function sliced(size) {
  const image = new Uint8ClampedArray(size * size * 4), folds = blanketFolds(size);
  for (let row = 0; row < size; row += 4) {
    await new Promise(resolve => setTimeout(resolve, 0));
    blanketRows(size, image, folds, row, Math.min(size, row + 4));
  }
  return image;
}
export function warmBlanket(low = false) {
  const size = low ? 256 : 512;
  if (pixels.has(size)) return Promise.resolve();
  if (pending.has(size)) return pending.get(size);
  let worker, timer;
  const work = new Promise((resolve, reject) => {
    worker = new Worker(new URL('./ship-blanket-worker.js', import.meta.url), { type: 'module' });
    timer = setTimeout(() => reject(new Error('Blanket worker timeout')), 8000);
    worker.onerror = event => { event.preventDefault(); reject(new Error('Blanket worker unavailable')); };
    worker.onmessage = ({ data }) => {
      if (!(data instanceof ArrayBuffer) || data.byteLength !== size * size * 4) { reject(new Error('Invalid blanket pixels')); return; }
      resolve(new Uint8ClampedArray(data));
    };
    worker.postMessage(size);
  }).finally(() => { clearTimeout(timer); worker?.terminate(); }).catch(() => sliced(size)).then(image => { pixels.set(size, image); });
  pending.set(size, work);
  return work;
}
export function blanketCanvas(low = false) {
  const size = low ? 256 : 512;
  if (canvases.has(size)) return canvases.get(size);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const context = canvas.getContext('2d'), image = context.createImageData(size, size);
  image.data.set(pixels.get(size) || blanketPixels(size)); context.putImageData(image, 0, 0);
  canvases.set(size, canvas);
  return canvas;
}
