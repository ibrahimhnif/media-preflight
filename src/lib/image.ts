import { PREVIEW_MAX_EDGE_PX } from './constants';
import { jpegComponents } from './check';
import type { PrintLayout, Size } from './formulas';

export type Design = {
  kind: 'gambar' | 'video';
  name: string;
  size: Size;
  source: ImageBitmap;
  durationS?: number;
  cmykJpeg: boolean;
};

const VIDEO_ERROR = 'Browser ini tidak bisa membaca video tersebut. Coba MP4 (H.264) atau WebM.';

export async function loadImage(file: File): Promise<Design> {
  const head = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
  let source: ImageBitmap;
  try {
    source = await createImageBitmap(file);
  } catch {
    throw new Error('Gambar tidak bisa dibuka. File mungkin rusak atau terlalu besar untuk browser ini.');
  }
  return {
    kind: 'gambar',
    name: file.name,
    size: { width: source.width, height: source.height },
    source,
    cmykJpeg: jpegComponents(head) === 4,
  };
}

function once(target: HTMLVideoElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    target.addEventListener(event, () => resolve(), { once: true });
    target.addEventListener('error', () => reject(new Error(VIDEO_ERROR)), { once: true });
  });
}

export async function loadVideo(file: File): Promise<Design> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  video.src = url;
  try {
    await once(video, 'loadedmetadata');
    if (!video.videoWidth || !Number.isFinite(video.duration)) throw new Error(VIDEO_ERROR);
    const seeked = once(video, 'seeked');
    video.currentTime = Math.min(1, video.duration / 2);
    await seeked;
    return {
      kind: 'video',
      name: file.name,
      size: { width: video.videoWidth, height: video.videoHeight },
      source: await createImageBitmap(video),
      durationS: video.duration,
      cmykJpeg: false,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' });
  if (!ctx) throw new Error('Canvas 2D tidak tersedia');
  return ctx;
}

/** Perkecil bertahap supaya pengecilan besar tidak menghasilkan aliasing. */
export function resample(source: CanvasImageSource & { width: number; height: number }, width: number, height: number) {
  let current: CanvasImageSource & { width: number; height: number } = source;
  while (current.width > width * 2 && current.height > height * 2) {
    const next = makeCanvas(Math.ceil(current.width / 2), Math.ceil(current.height / 2));
    const ctx = context(next);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(current, 0, 0, next.width, next.height);
    current = next;
  }
  return current;
}

export type Rect = { x: number; y: number; width: number; height: number };

export function containRect(content: Size, box: Rect): Rect {
  const scale = Math.min(box.width / content.width, box.height / content.height);
  const width = content.width * scale;
  const height = content.height * scale;
  return { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height };
}

export function drawContained(ctx: CanvasRenderingContext2D, source: ImageBitmap, box: Rect) {
  const rect = containRect(source, box);
  const reduced = resample(source, rect.width, rect.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(reduced, rect.x, rect.y, rect.width, rect.height);
}

export type PrintFrame = {
  width: number;
  height: number;
  pxPerMm: number;
  trim: Rect;
  safe: Rect;
};

export function printFrame(layout: PrintLayout): PrintFrame {
  const fullW = layout.trimMm.width + layout.bleedMm * 2;
  const fullH = layout.trimMm.height + layout.bleedMm * 2;
  const pxPerMm = PREVIEW_MAX_EDGE_PX / Math.max(fullW, fullH);
  const bleed = layout.bleedMm * pxPerMm;
  const safe = layout.safeMm * pxPerMm;
  const trimW = layout.trimMm.width * pxPerMm;
  const trimH = layout.trimMm.height * pxPerMm;
  return {
    width: Math.round(fullW * pxPerMm),
    height: Math.round(fullH * pxPerMm),
    pxPerMm,
    trim: { x: bleed, y: bleed, width: trimW, height: trimH },
    safe: {
      x: bleed + safe,
      y: bleed + safe,
      width: Math.max(0, trimW - safe * 2),
      height: Math.max(0, trimH - safe * 2),
    },
  };
}
