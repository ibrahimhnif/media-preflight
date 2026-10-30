export type LedRegion = { x: number; y: number; width: number; height: number };

/** Menggambar tiap piksel sumber sebagai satu LED bulat di atas panel hitam. Sel di bawah 3 px terlalu kecil untuk titik, jadi digambar penuh. */
export function renderLedGrid(
  pixels: Uint8ClampedArray,
  sourceWidth: number,
  region: LedRegion,
  cell: number,
): Uint8ClampedArray<ArrayBuffer> {
  const mask = new Float32Array(cell * cell);
  const center = (cell - 1) / 2;
  const radius = cell < 3 ? cell : cell * 0.47;
  for (let y = 0; y < cell; y++) {
    for (let x = 0; x < cell; x++) {
      const distance = Math.hypot(x - center, y - center);
      mask[y * cell + x] = Math.min(1, Math.max(0, radius - distance + 0.5));
    }
  }
  const outWidth = region.width * cell;
  const out = new Uint8ClampedArray(outWidth * region.height * cell * 4);
  for (let row = 0; row < region.height; row++) {
    for (let col = 0; col < region.width; col++) {
      const p = ((row + region.y) * sourceWidth + col + region.x) * 4;
      const [r, g, b] = [pixels[p]!, pixels[p + 1]!, pixels[p + 2]!];
      for (let y = 0; y < cell; y++) {
        for (let x = 0; x < cell; x++) {
          const m = mask[y * cell + x]!;
          const q = ((row * cell + y) * outWidth + col * cell + x) * 4;
          out[q] = r * m;
          out[q + 1] = g * m;
          out[q + 2] = b * m;
          out[q + 3] = 255;
        }
      }
    }
  }
  return out;
}
