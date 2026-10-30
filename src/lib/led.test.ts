import { describe, expect, it } from 'vitest';
import { renderLedGrid } from './led';

describe('renderLedGrid', () => {
  it('memberi warna di tengah LED dan hitam di sudut sel', () => {
    const red = new Uint8ClampedArray([255, 0, 0, 255]);
    const out = renderLedGrid(red, 1, { x: 0, y: 0, width: 1, height: 1 }, 5);
    const at = (x: number, y: number) => [...out.slice((y * 5 + x) * 4, (y * 5 + x) * 4 + 4)];
    expect(at(2, 2)).toEqual([255, 0, 0, 255]);
    expect(at(0, 0)[0]).toBeLessThan(26);
    expect(out.length).toBe(5 * 5 * 4);
  });
});
