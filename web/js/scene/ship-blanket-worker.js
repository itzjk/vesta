import { blanketPixels } from './ship-blanket.js';
onmessage = ({ data: size }) => {
  if (size !== 256 && size !== 512) return;
  const pixels = blanketPixels(size);
  postMessage(pixels.buffer, [pixels.buffer]);
};
