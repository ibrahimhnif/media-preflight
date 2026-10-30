import { instantiate } from 'lcms-wasm';
import wasmUrl from 'lcms-wasm/dist/lcms.wasm?url';
import { ICC_PROFILE_URL } from './constants';
import { createSimulator, type Simulator } from './simulator';

let simulator: Promise<Simulator> | null = null;

/** Memuat wasm dan profile sekali saja, baru saat pertama dibutuhkan. */
export function loadSimulator(): Promise<Simulator> {
  simulator ??= (async () => {
    const [lcms, response] = await Promise.all([
      instantiate({ locateFile: () => wasmUrl }),
      fetch(new URL(ICC_PROFILE_URL, document.baseURI)),
    ]);
    if (!response.ok) throw new Error(`ICC profile tidak ditemukan (${response.status})`);
    return createSimulator(lcms, new Uint8Array(await response.arrayBuffer()));
  })().catch((error) => {
    simulator = null;
    throw error;
  });
  return simulator;
}
