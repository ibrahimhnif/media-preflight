import { useEffect, useRef, useState } from 'react';
import { GAMUT_DELTA_E } from '../lib/constants';
import type { BoxLayout, EyeletPoint } from '../lib/formulas';
import { context, type PrintFrame } from '../lib/image';
import type { Proof } from '../useProof';

type Overlay = { eyelets?: EyeletPoint[]; box?: BoxLayout };

const GAMUT_MARK: [number, number, number] = [0, 255, 70];

function stroke(ctx: CanvasRenderingContext2D, rect: PrintFrame['trim'], color: string, dash: number[], width: number) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
}

function drawGuides(ctx: CanvasRenderingContext2D, frame: PrintFrame, overlay: Overlay) {
  const unit = Math.max(frame.width, frame.height) / 500;
  const { trim, safe, pxPerMm } = frame;
  ctx.save();
  ctx.fillStyle = 'rgba(190, 30, 60, 0.28)';
  ctx.beginPath();
  ctx.rect(0, 0, frame.width, frame.height);
  ctx.rect(trim.x, trim.y, trim.width, trim.height);
  ctx.fill('evenodd');
  ctx.restore();
  stroke(ctx, trim, '#d11a4b', [], unit);
  stroke(ctx, safe, '#0b7fd1', [unit * 4, unit * 3], unit);

  for (const point of overlay.eyelets ?? []) {
    const x = trim.x + point.xCm * 10 * pxPerMm;
    const y = trim.y + point.yCm * 10 * pxPerMm;
    ctx.beginPath();
    ctx.arc(x, y, unit * 3.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();
    ctx.lineWidth = unit * 1.2;
    ctx.strokeStyle = '#1c1f24';
    ctx.stroke();
  }

  for (const panel of overlay.box?.panels ?? []) {
    const rect = {
      x: trim.x + panel.x * pxPerMm,
      y: trim.y + panel.y * pxPerMm,
      width: panel.width * pxPerMm,
      height: panel.height * pxPerMm,
    };
    stroke(ctx, rect, '#1c1f24', [unit * 3, unit * 2], unit * 0.8);
    ctx.font = `600 ${unit * 13}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1c1f24';
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = unit * 3;
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    if (rect.width > ctx.measureText(panel.name).width) {
      ctx.strokeText(panel.name, cx, cy);
      ctx.fillText(panel.name, cx, cy);
    }
  }
}

function withGamut(image: ImageData, mask: Uint8Array): ImageData {
  const marked = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
  for (let i = 0; i < mask.length; i++) {
    const x = i % image.width;
    const y = (i / image.width) | 0;
    if (mask[i] && (x + y) % 24 < 10) {
      marked.data[i * 4] = GAMUT_MARK[0];
      marked.data[i * 4 + 1] = GAMUT_MARK[1];
      marked.data[i * 4 + 2] = GAMUT_MARK[2];
    }
  }
  return marked;
}

function ProofCanvas(props: { image: ImageData; draw?: (ctx: CanvasRenderingContext2D) => void; testId: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { image, draw } = props;
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = context(canvas);
    ctx.putImageData(image, 0, 0);
    draw?.(ctx);
  }, [image, draw]);
  return <canvas ref={ref} data-testid={props.testId} />;
}

/** Tampilan depan box: panel "Depan" dipotong dari hasil simulasi. */
function BoxFront({ print, frame, box }: { print: ImageData; frame: PrintFrame; box: BoxLayout }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const x = Math.round(frame.trim.x + box.front.x * frame.pxPerMm);
    const y = Math.round(frame.trim.y + box.front.y * frame.pxPerMm);
    const width = Math.max(1, Math.round(box.front.width * frame.pxPerMm));
    const height = Math.max(1, Math.round(box.front.height * frame.pxPerMm));
    canvas.width = width;
    canvas.height = height;
    context(canvas).putImageData(print, -x, -y, x, y, width, height);
  }, [print, frame, box]);
  return (
    <figure className="box-front">
      <figcaption>Mockup 2D, tampak depan box</figcaption>
      <canvas ref={ref} data-testid="box-front" />
    </figure>
  );
}

export function PrintPreview(props: { proof: Proof; overlay: Overlay }) {
  const { proof, overlay } = props;
  const [guides, setGuides] = useState(true);
  const [showGamut, setShowGamut] = useState(false);
  const [draw, setDraw] = useState<((ctx: CanvasRenderingContext2D) => void) | undefined>();
  const frame = proof.state === 'ready' ? proof.frame : null;

  useEffect(() => {
    setDraw(() =>
      guides && frame ? (ctx: CanvasRenderingContext2D) => drawGuides(ctx, frame, overlay) : undefined,
    );
  }, [guides, frame, overlay]);

  if (proof.state === 'idle') return null;
  if (proof.state === 'loading') return <p className="note">Menjalankan simulasi warna…</p>;
  if (proof.state === 'error') {
    return (
      <p className="error" role="alert">
        Simulasi warna tidak berjalan: {proof.message}. Hasil cek ukuran di atas tetap berlaku.
      </p>
    );
  }

  const printed = showGamut ? withGamut(proof.print, proof.gamut.mask) : proof.print;

  return (
    <>
      <div className="toolbar">
        <label>
          <input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} /> Tampilkan garis panduan
        </label>
        <label>
          <input type="checkbox" data-testid="gamut-toggle" checked={showGamut} onChange={(e) => setShowGamut(e.target.checked)} /> Tandai warna out-of-gamut
        </label>
      </div>
      <div className="compare">
        <figure>
          <figcaption>Layar (sRGB)</figcaption>
          <ProofCanvas image={proof.screen} draw={draw} testId="proof-screen" />
        </figure>
        <figure>
          <figcaption>Perkiraan cetak (CMYK)</figcaption>
          <ProofCanvas image={printed} draw={draw} testId="proof-print" />
        </figure>
      </div>
      <p className="legend">
        <i className="swatch swatch-trim" /> Garis potong
        <i className="swatch swatch-safe" /> Area aman
        <i className="swatch swatch-bleed" /> Bleed
        {overlay.eyelets && overlay.eyelets.length > 0 && (
          <>
            <i className="swatch swatch-eyelet" /> Mata ayam
          </>
        )}
        {showGamut && (
          <>
            <i className="swatch swatch-gamut" /> Bergeser lebih dari ΔE {GAMUT_DELTA_E}
          </>
        )}
      </p>
      {overlay.box && <BoxFront print={proof.print} frame={proof.frame} box={overlay.box} />}
    </>
  );
}
