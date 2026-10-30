import { useEffect, useRef, useState } from 'react';
import { context, drawContained, makeCanvas, type Design } from '../lib/image';
import { renderLedGrid } from '../lib/led';

const MAX_LED_PIXELS = 10_000_000;
const ZOOM_CELL_PX = 14;
const ZOOM_COLUMNS = 56;
const ZOOM_ROWS = 32;

function paint(canvas: HTMLCanvasElement, width: number, height: number, data: Uint8ClampedArray<ArrayBuffer>) {
  canvas.width = width;
  canvas.height = height;
  context(canvas).putImageData(new ImageData(data, width, height), 0, 0);
}

export function VideotronPreview({ design, width, height }: { design: Design; width: number; height: number }) {
  const full = useRef<HTMLCanvasElement>(null);
  const zoom = useRef<HTMLCanvasElement>(null);
  const tooBig = width * height > MAX_LED_PIXELS;
  const [available, setAvailable] = useState(0);
  const dpr = window.devicePixelRatio || 1;

  useEffect(() => {
    const parent = full.current?.parentElement;
    if (!parent) return;
    const observer = new ResizeObserver(() => setAvailable(parent.clientWidth));
    observer.observe(parent);
    return () => observer.disconnect();
  }, [tooBig]);

  useEffect(() => {
    if (tooBig || !available || !full.current || !zoom.current) return;
    const led = makeCanvas(width, height);
    const ctx = context(led);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    drawContained(ctx, design.source, { x: 0, y: 0, width, height });
    const pixels = ctx.getImageData(0, 0, width, height).data;

    // Ukuran sel harus bilangan bulat piksel layar; skala pecahan menimbulkan moiré.
    const cell = Math.max(1, Math.min(10, Math.floor((available * dpr) / width)));
    const whole = { x: 0, y: 0, width, height };
    paint(full.current, width * cell, height * cell, renderLedGrid(pixels, width, whole, cell));
    full.current.style.width = `${(width * cell) / dpr}px`;

    const columns = Math.min(ZOOM_COLUMNS, width);
    const rows = Math.min(ZOOM_ROWS, height);
    const region = {
      x: Math.floor((width - columns) / 2),
      y: Math.floor((height - rows) / 2),
      width: columns,
      height: rows,
    };
    zoom.current.style.width = `${(columns * ZOOM_CELL_PX) / dpr}px`;
    paint(
      zoom.current,
      columns * ZOOM_CELL_PX,
      rows * ZOOM_CELL_PX,
      renderLedGrid(pixels, width, region, ZOOM_CELL_PX),
    );
  }, [design, width, height, tooBig, available, dpr]);

  if (tooBig) {
    return <p className="note">Resolusi {width} × {height} px terlalu besar untuk ditampilkan sebagai grid LED di browser.</p>;
  }

  return (
    <div className="preview-stack">
      <figure>
        <figcaption>Seluruh layar pada resolusi LED {width} × {height} px</figcaption>
        <canvas ref={full} data-testid="led-full" data-led-width={width} data-led-height={height} />
      </figure>
      <figure>
        <figcaption>Perbesaran bagian tengah, tiap titik adalah satu LED</figcaption>
        <canvas ref={zoom} data-testid="led-zoom" />
      </figure>
    </div>
  );
}
