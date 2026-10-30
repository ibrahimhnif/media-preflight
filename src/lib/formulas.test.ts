import { describe, expect, it } from 'vitest';
import {
  bannerDefaultDpi,
  calcBanner,
  calcBox,
  calcPoster,
  calcVideotron,
  eyeletPositions,
  formatRatio,
  ledAxis,
} from './formulas';

describe('videotron', () => {
  const p10 = calcVideotron({ widthM: 4, heightM: 3, pitchMm: 10, viewDistanceM: 30 });

  it('4 × 3 m P10 menghasilkan 400 × 300 px', () => {
    expect([p10.width.px, p10.height.px]).toEqual([400, 300]);
    expect(p10.exact).toBe(true);
    expect(p10.ratio).toBe('4:3');
  });

  it('jarak pandang minimum mengikuti pitch', () => {
    expect(p10.minViewDistanceM).toBe(10);
    expect(p10.viewDistanceTooClose).toBe(false);
    expect(calcVideotron({ widthM: 4, heightM: 3, pitchMm: 10, viewDistanceM: 5 }).viewDistanceTooClose).toBe(true);
  });

  it('tinggi teks memakai batas terbesar: 12 LED atau jarak ÷ 300', () => {
    expect(p10.minTextHeightMm).toBe(120);
    expect(p10.minTextHeightPx).toBe(12);
    const far = calcVideotron({ widthM: 4, heightM: 3, pitchMm: 10, viewDistanceM: 60 });
    expect(far.minTextHeightMm).toBe(200);
    expect(far.minTextHeightPx).toBe(20);
  });

  it('dimensi yang tidak habis dibagi pitch dibulatkan ke bawah dan ditandai', () => {
    const axis = ledAxis(4000, 3.9);
    expect(axis.px).toBe(1025);
    expect(axis.exact).toBe(false);
    expect(axis.remainderMm).toBeCloseTo(2.5, 6);
    const result = calcVideotron({ widthM: 4, heightM: 3, pitchMm: 3.9, viewDistanceM: 10 });
    expect(result.exact).toBe(false);
  });

  it('galat floating point tidak dianggap sisa', () => {
    expect(ledAxis(4.2 * 1000, 2.5)).toEqual({ px: 1680, exact: true, remainderMm: 0 });
    expect(ledAxis(0.3 * 1000, 0.1).exact).toBe(true);
  });
});

describe('banner', () => {
  it('300 × 100 cm, 100 DPI menghasilkan 11.811 × 3.937 px', () => {
    const { layout } = calcBanner({ widthCm: 300, heightCm: 100, viewDistanceM: 5, dpiOverride: 100 });
    expect(layout.trimPx).toEqual({ width: 11811, height: 3937 });
  });

  it('ukuran dengan bleed lebih besar di keempat sisi', () => {
    const { layout } = calcBanner({ widthCm: 300, heightCm: 100, viewDistanceM: 5 });
    expect(layout.bleedPx).toEqual({ width: 11969, height: 4094 });
  });

  it('DPI default sesuai jarak, batas 2 m dan 10 m masuk 100 DPI', () => {
    expect(bannerDefaultDpi(1.99)).toBe(150);
    expect(bannerDefaultDpi(2)).toBe(100);
    expect(bannerDefaultDpi(10)).toBe(100);
    expect(bannerDefaultDpi(10.01)).toBe(72);
  });

  it('nilai DPI pengguna mengalahkan default', () => {
    expect(calcBanner({ widthCm: 100, heightCm: 100, viewDistanceM: 20, dpiOverride: 120 }).layout.dpi).toBe(120);
  });

  it('mata ayam berjarak paling jauh 50 cm dan tanpa titik kembar', () => {
    const points = eyeletPositions(300, 100);
    expect(points).toHaveLength(16);
    expect(new Set(points.map((p) => `${p.xCm},${p.yCm}`)).size).toBe(16);
    const top = points.filter((p) => p.yCm === 2.5).sort((a, b) => a.xCm - b.xCm);
    expect(top).toHaveLength(7);
    expect(top[1]!.xCm - top[0]!.xCm).toBeLessThanOrEqual(50);
  });

  it('ukuran lebih kecil dari inset tidak menghasilkan titik', () => {
    expect(eyeletPositions(4, 4)).toEqual([]);
  });
});

describe('poster & packaging', () => {
  it('A3 di 300 DPI dengan bleed 3 mm', () => {
    const layout = calcPoster({ width: 297, height: 420 });
    expect(layout.trimPx).toEqual({ width: 3508, height: 4961 });
    expect(layout.bleedPx).toEqual({ width: 3579, height: 5031 });
  });

  it('box 100 × 50 × 150 mm', () => {
    const box = calcBox({ lengthMm: 100, widthMm: 50, heightMm: 150 });
    expect(box.flatMm).toEqual({ width: 315, height: 250 });
    expect(box.panels).toHaveLength(7);
    expect(box.front).toMatchObject({ x: 15, y: 50, width: 100, height: 150 });
  });
});

describe('formatRatio', () => {
  it('menyederhanakan rasio dan jatuh ke desimal bila angkanya besar', () => {
    expect(formatRatio(1920, 1080)).toBe('16:9');
    expect(formatRatio(1025, 769)).toBe('1,33:1');
  });
});
