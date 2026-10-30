// Membuat desain contoh buatan sendiri lewat canvas browser, plus satu video lewat ffmpeg.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const OUT = new URL('../samples/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

// Pita warna jenuh mengisi 40% bagian atas; e2e membaca piksel dari sini.
const SAMPLES = [
  ['videotron-400x300.png', 400, 300, 'VIDEOTRON', 'image/png'],
  ['videotron-1920x1080.png', 1920, 1080, 'SALAH RASIO', 'image/png'],
  ['banner-11969x4094-bleed.jpg', 11969, 4094, 'BANNER 300 x 100 cm', 'image/jpeg'],
  ['banner-1200x400-lowres.jpg', 1200, 400, 'RESOLUSI RENDAH', 'image/jpeg'],
  ['poster-a3-3579x5031-bleed.jpg', 3579, 5031, 'POSTER A3', 'image/jpeg'],
  // Judul ditaruh di panel depan pola box: x 18–118 mm, y 53–203 mm dari 321 × 256 mm.
  ['packaging-3791x3024-bleed.jpg', 3791, 3024, 'BOX', 'image/jpeg', { x: 68 / 321, y: 150 / 256, size: 0.16 }],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, width, height, title, type, spot] of SAMPLES) {
  const data = await page.evaluate(
    async ({ width, height, title, type, spot }) => {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      const colors = ['#0000ff', '#00ff00', '#ff00ff', '#00ffff', '#ff0000', '#ffff00'];
      const bandH = height * 0.4;
      colors.forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.fillRect((i * width) / colors.length, 0, Math.ceil(width / colors.length), bandH);
      });
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, '#2a5f8f');
      gradient.addColorStop(0.5, '#e6b496');
      gradient.addColorStop(1, '#78a050');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, bandH, width, height - bandH);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.round(height * (spot?.size ?? 0.11))}px Helvetica, Arial, sans-serif`;
      ctx.fillText(title, width * (spot?.x ?? 0.5), height * (spot?.y ?? 0.68), width * 0.9);
      const blob = await canvas.convertToBlob({ type, quality: 0.9 });
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    },
    { width, height, title, type, spot },
  );
  writeFileSync(OUT + name, Buffer.from(data));
  console.log(name, data.length);
}
await browser.close();

execFileSync('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-f', 'lavfi', '-i', 'testsrc2=size=400x300:rate=25:duration=3',
  '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p', OUT + 'videotron-400x300.webm',
]);
console.log('videotron-400x300.webm');
