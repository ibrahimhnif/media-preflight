import { useEffect, useState } from 'react';
import { gamutMask, type GamutStats } from './lib/color';
import { GAMUT_DELTA_E } from './lib/constants';
import { loadSimulator } from './lib/cms';
import { matchPrintBox } from './lib/check';
import type { PrintLayout } from './lib/formulas';
import { context, drawContained, makeCanvas, printFrame, type Design, type PrintFrame } from './lib/image';

export type Proof =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; frame: PrintFrame; screen: ImageData; print: ImageData; gamut: GamutStats };

/** Menempatkan desain pada ukuran cetak, lalu menjalankan simulasi ICC. */
export function useProof(design: Design | null, layout: PrintLayout | null): Proof {
  const [proof, setProof] = useState<Proof>({ state: 'idle' });

  useEffect(() => {
    if (!design || !layout) {
      setProof({ state: 'idle' });
      return;
    }
    let cancelled = false;
    setProof({ state: 'loading' });
    (async () => {
      const simulate = await loadSimulator();
      const frame = printFrame(layout);
      const canvas = makeCanvas(frame.width, frame.height);
      const ctx = context(canvas);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, frame.width, frame.height);
      const box =
        matchPrintBox(design.size, layout).box === 'bleed'
          ? { x: 0, y: 0, width: frame.width, height: frame.height }
          : frame.trim;
      drawContained(ctx, design.source, box);
      const screen = ctx.getImageData(0, 0, frame.width, frame.height);
      const simulated = simulate(screen.data);
      const print = new ImageData(new Uint8ClampedArray(simulated), frame.width, frame.height);
      const gamut = gamutMask(screen.data, simulated, GAMUT_DELTA_E);
      if (!cancelled) setProof({ state: 'ready', frame, screen, print, gamut });
    })().catch((error: unknown) => {
      if (!cancelled) {
        setProof({ state: 'error', message: error instanceof Error ? error.message : String(error) });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [design, layout]);

  return proof;
}
