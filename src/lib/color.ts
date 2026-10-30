/** sRGB 8-bit ke CIE Lab (D50), sama dengan PCS pada ICC. */
export function srgbToLab(r: number, g: number, b: number): [number, number, number] {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [lr, lg, lb] = [lin(r), lin(g), lin(b)];
  // Matriks sRGB ke XYZ D50 (Bradford), dinormalisasi ke titik putih D50.
  const x = (0.4360747 * lr + 0.3850649 * lg + 0.1430804 * lb) / 0.96422;
  const y = 0.2225045 * lr + 0.7168786 * lg + 0.0606169 * lb;
  const z = (0.0139322 * lr + 0.0971045 * lg + 0.7141733 * lb) / 0.82521;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function deltaE76(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export type GamutStats = { mask: Uint8Array; percent: number; maxDeltaE: number };

/** Bandingkan RGBA asli dan hasil simulasi. Piksel transparan diabaikan. */
export function gamutMask(source: Uint8ClampedArray, simulated: Uint8ClampedArray, threshold: number): GamutStats {
  const count = source.length / 4;
  const mask = new Uint8Array(count);
  let flagged = 0;
  let visible = 0;
  let maxDeltaE = 0;
  // Gambar punya banyak warna kembar; cache menghindari hitung Lab berulang.
  const cache = new Map<number, number>();
  for (let i = 0; i < count; i++) {
    const p = i * 4;
    if (source[p + 3] === 0) continue;
    visible++;
    const [r, g, b] = [source[p]!, source[p + 1]!, source[p + 2]!];
    const [sr, sg, sb] = [simulated[p]!, simulated[p + 1]!, simulated[p + 2]!];
    const key = r * 0x1000000 * 0x10000 + ((g << 16) | (b << 8) | sr) * 0x10000 + ((sg << 8) | sb);
    let de = cache.get(key);
    if (de === undefined) {
      de = deltaE76(srgbToLab(r, g, b), srgbToLab(sr, sg, sb));
      cache.set(key, de);
    }
    if (de > maxDeltaE) maxDeltaE = de;
    if (de > threshold) {
      mask[i] = 1;
      flagged++;
    }
  }
  return { mask, percent: visible ? (flagged / visible) * 100 : 0, maxDeltaE };
}
