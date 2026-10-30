import { describe, expect, it } from 'vitest';
import { deltaE76, gamutMask, srgbToLab } from './color';

describe('srgbToLab', () => {
  it('putih dan hitam berada di ujung L*', () => {
    const white = srgbToLab(255, 255, 255);
    expect(white[0]).toBeCloseTo(100, 1);
    expect(Math.abs(white[1])).toBeLessThan(0.1);
    expect(srgbToLab(0, 0, 0)[0]).toBeCloseTo(0, 5);
  });

  it('merah sRGB sesuai nilai rujukan D50', () => {
    const [l, a, b] = srgbToLab(255, 0, 0);
    expect(l).toBeCloseTo(54.29, 1);
    expect(a).toBeCloseTo(80.81, 0);
    expect(b).toBeCloseTo(69.89, 0);
  });
});

describe('gamutMask', () => {
  const px = (...v: number[]) => new Uint8ClampedArray(v);

  it('hanya menandai piksel yang bergeser melebihi ambang', () => {
    const source = px(0, 0, 255, 255, 128, 128, 128, 255);
    const simulated = px(53, 61, 144, 255, 128, 128, 128, 255);
    const stats = gamutMask(source, simulated, 10);
    expect([...stats.mask]).toEqual([1, 0]);
    expect(stats.percent).toBe(50);
    expect(stats.maxDeltaE).toBeCloseTo(deltaE76(srgbToLab(0, 0, 255), srgbToLab(53, 61, 144)), 5);
  });

  it('piksel transparan tidak dihitung', () => {
    const stats = gamutMask(px(0, 0, 255, 0), px(53, 61, 144, 0), 10);
    expect(stats.percent).toBe(0);
  });
});
