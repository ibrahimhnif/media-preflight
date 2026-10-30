import { readFile } from 'node:fs/promises';
import { instantiate } from 'lcms-wasm';
import { beforeAll, describe, expect, it } from 'vitest';
import { deltaE76, srgbToLab } from './color';
import { GAMUT_DELTA_E } from './constants';
import { createSimulator, type Simulator } from './simulator';

let simulate: Simulator;

beforeAll(async () => {
  const bytes = new Uint8Array(await readFile('public/icc/FOGRA39L_coated.icc'));
  simulate = createSimulator(await instantiate(), bytes);
});

const shift = (r: number, g: number, b: number) => {
  const [sr, sg, sb] = simulate(new Uint8ClampedArray([r, g, b, 255]));
  return deltaE76(srgbToLab(r, g, b), srgbToLab(sr!, sg!, sb!));
};

describe('simulasi ICC FOGRA39L', () => {
  it('warna RGB jenuh berubah melewati ambang out-of-gamut', () => {
    expect(shift(0, 0, 255)).toBeGreaterThan(GAMUT_DELTA_E);
    expect(shift(0, 255, 0)).toBeGreaterThan(GAMUT_DELTA_E);
    expect(shift(255, 0, 255)).toBeGreaterThan(GAMUT_DELTA_E);
  });

  it('warna yang bisa dicetak hampir tidak berubah', () => {
    expect(shift(128, 128, 128)).toBeLessThan(2);
    expect(shift(230, 180, 150)).toBeLessThan(2);
    expect(shift(120, 160, 80)).toBeLessThan(2);
  });

  it('putih tetap putih dan alpha dipertahankan', () => {
    expect([...simulate(new Uint8ClampedArray([255, 255, 255, 200]))]).toEqual([255, 255, 255, 200]);
  });

  it('menolak profile yang bukan CMYK', async () => {
    const lcms = await instantiate();
    expect(() => createSimulator(lcms, new Uint8Array(200))).toThrow();
  });
});
