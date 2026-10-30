// Uji aplikasi di Chromium sungguhan terhadap production build (`vite preview`).
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const ROOT = new URL('..', import.meta.url).pathname;
const SAMPLES = ROOT + 'samples/';
const SHOTS = ROOT + 'screenshots/';
const PORT = 4179;
const BASE = `http://localhost:${PORT}/`;

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: true });
for (let i = 0; ; i++) {
  try {
    await fetch(BASE);
    break;
  } catch {
    if (i > 50) throw new Error('vite preview tidak hidup');
    await new Promise((r) => setTimeout(r, 200));
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 });
const problems = [];
const external = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
page.on('request', (r) => {
  if (!r.url().startsWith(BASE) && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) external.push(r.url());
  if (r.method() !== 'GET') external.push(`${r.method()} ${r.url()}`);
});

const results = [];
const step = async (name, fn) => {
  await fn();
  results.push(name);
  console.log(`ok  ${name}`);
};

const openMedia = (id) => page.getByTestId(`media-${id}`).click();
const upload = (file) => page.getByTestId('file-input').setInputFiles(SAMPLES + file);
const field = (label) => page.getByLabel(label);
const verdict = async (file) => {
  await page.getByTestId('verdict').getByText(file, { exact: false }).waitFor();
  return (await page.getByTestId('verdict').locator('.chip').textContent()).trim();
};
const checkStatus = async (label) => {
  const row = page.locator('.checks li', { hasText: label }).first();
  return (await row.locator('.chip').textContent()).trim();
};
const pixel = (testId, fx, fy) =>
  page.getByTestId(testId).evaluate(
    (canvas, [fx, fy]) => {
      const x = Math.floor(canvas.width * fx);
      const y = Math.floor(canvas.height * fy);
      return [...canvas.getContext('2d').getImageData(x, y, 1, 1).data].slice(0, 3);
    },
    [fx, fy],
  );
const shot = (name) => page.screenshot({ path: `${SHOTS}${name}.png`, fullPage: true });

const stop = () => {
  try {
    process.kill(-server.pid);
  } catch {}
};
process.on('exit', stop);

await page.goto(BASE);

await step('videotron: 4 × 3 m P10 = 400 × 300 px', async () => {
  await openMedia('videotron');
  assert.ok(await page.getByText('400 × 300 px', { exact: true }).isVisible());
  assert.ok(await page.getByText('4:3', { exact: true }).isVisible());
});

await step('videotron: PNG pas lolos, grid LED benar-benar tergambar', async () => {
  await upload('videotron-400x300.png');
  assert.equal(await verdict('videotron-400x300.png'), 'Lolos');
  await page.getByTestId('led-full').waitFor();
  const size = await page.getByTestId('led-full').evaluate((c) => [c.width, c.height]);
  // Sel 5 px pada layar 2x: pusat LED berwarna, sudut sel hitam. LED kolom 0 pada pita biru.
  assert.deepEqual(size, [2000, 1500]);
  const cells = await page.getByTestId('led-full').evaluate((c) => {
    const d = c.getContext('2d').getImageData(0, 0, 5, 5).data;
    return { center: [d[48], d[49], d[50]], corner: [d[0], d[1], d[2]] };
  });
  assert.ok(cells.center[2] > 200, `pusat LED ${cells.center}`);
  assert.ok(cells.corner[2] < cells.center[2] / 2, `sudut sel ${cells.corner}`);
  const zoom = await page.getByTestId('led-zoom').evaluate((c) => [c.width, c.height]);
  assert.deepEqual(zoom, [784, 448]);
  await shot('videotron-gambar');
});

await step('videotron: rasio salah gagal', async () => {
  await upload('videotron-1920x1080.png');
  assert.equal(await verdict('videotron-1920x1080.png'), 'Gagal');
  assert.equal(await checkStatus('Rasio'), 'Gagal');
});

await step('videotron: video WebM terbaca durasi dan resolusinya', async () => {
  await upload('videotron-400x300.webm');
  assert.equal(await verdict('videotron-400x300.webm'), 'Lolos');
  assert.ok(await page.getByText('3 detik', { exact: false }).isVisible());
  assert.ok(await page.getByText('FPS dan codec tidak dicek', { exact: false }).isVisible());
  const frame = await page.getByTestId('led-full').evaluate((c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let lit = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60) lit++;
    return lit / (d.length / 4);
  });
  assert.ok(frame > 0.2, `frame video di grid LED hanya ${frame}`);
  await shot('videotron-video');
});

await step('videotron: dimensi tidak habis dibagi pitch diberi peringatan', async () => {
  await field('Pixel pitch').fill('3.9');
  await page.getByTestId('pitch-warning').waitFor();
  assert.match(await page.getByTestId('pitch-warning').textContent(), /2,5 mm/);
  assert.ok(await page.getByText('1.025 × 769 px', { exact: true }).isVisible());
  await field('Pixel pitch').fill('10');
});

await step('banner: angka, file dengan bleed, dan simulasi warna', async () => {
  await openMedia('banner');
  assert.ok(await page.getByText('11.969 × 4.094 px', { exact: true }).isVisible());
  assert.ok(await page.getByText('Tanpa bleed 11.811 × 3.937 px', { exact: true }).isVisible());
  assert.ok(await page.getByText('16 titik', { exact: true }).isVisible());
  await upload('banner-11969x4094-bleed.jpg');
  await verdict('banner-11969x4094-bleed.jpg');
  await page.getByTestId('proof-print').waitFor();
  assert.equal(await checkStatus('Rasio'), 'Lolos');
  assert.equal(await checkStatus('DPI efektif'), 'Lolos');
  assert.equal(await checkStatus('Bleed'), 'Lolos');
  await shot('banner');
});

await step('banner: DPI bisa diubah pengguna', async () => {
  await page.getByLabel('DPI', { exact: false }).first().fill('150');
  assert.ok(await page.getByText('Tanpa bleed 17.717 × 5.906 px', { exact: true }).isVisible());
  await page.getByLabel('DPI', { exact: false }).first().fill('');
});

await step('banner: file resolusi rendah gagal', async () => {
  await upload('banner-1200x400-lowres.jpg');
  assert.equal(await verdict('banner-1200x400-lowres.jpg'), 'Gagal');
  assert.equal(await checkStatus('DPI efektif'), 'Gagal');
});

let colorEvidence;
await step('poster: simulasi ICC mengubah nilai piksel', async () => {
  await openMedia('poster');
  assert.ok(await page.getByText('3.579 × 5.031 px', { exact: true }).isVisible());
  await upload('poster-a3-3579x5031-bleed.jpg');
  await verdict('poster-a3-3579x5031-bleed.jpg');
  await page.getByTestId('proof-print').waitFor();
  await page.locator('.checks li', { hasText: 'Warna' }).waitFor();
  const fx = 1 / 12; // tengah pita biru
  const fy = 0.2;
  const screen = await pixel('proof-screen', fx, fy);
  const printed = await pixel('proof-print', fx, fy);
  const gray = [await pixel('proof-screen', 0.5, 0.9), await pixel('proof-print', 0.5, 0.9)];
  colorEvidence = { screen, printed, gray };
  assert.ok(screen[2] > 240 && screen[0] < 15 && screen[1] < 15, `layar ${screen}`);
  assert.ok(Math.abs(printed[0] - 53) <= 6 && Math.abs(printed[1] - 61) <= 6 && Math.abs(printed[2] - 144) <= 6, `cetak ${printed}`);
  await shot('poster');
  await page.getByTestId('gamut-toggle').check();
  await page.waitForFunction(() => {
    const c = document.querySelector('[data-testid="proof-print"]');
    const d = c.getContext('2d').getImageData(Math.floor(c.width / 12), Math.floor(c.height * 0.2), 40, 40).data;
    for (let i = 0; i < d.length; i += 4) if (d[i] === 0 && d[i + 1] === 255 && d[i + 2] === 70) return true;
    return false;
  });
  await shot('poster-gamut');
  await page.getByTestId('gamut-toggle').uncheck();
});

await step('poster: JPG CMYK diberi peringatan', async () => {
  await upload('poster-cmyk.jpg');
  await verdict('poster-cmyk.jpg');
  assert.equal(await checkStatus('Mode warna file'), 'Peringatan');
});

await step('packaging: pola box, mockup 2D, simulasi warna', async () => {
  await openMedia('packaging');
  assert.ok(await page.getByText('3.791 × 3.024 px', { exact: true }).isVisible());
  await upload('packaging-3791x3024-bleed.jpg');
  assert.equal(await verdict('packaging-3791x3024-bleed.jpg'), 'Peringatan');
  await page.getByTestId('box-front').waitFor();
  const size = await page.getByTestId('box-front').evaluate((c) => [c.width, c.height]);
  assert.ok(size[0] > 0 && Math.abs(size[0] / size[1] - 100 / 150) < 0.01, `mockup ${size}`);
  const front = await pixel('box-front', 0.5, 0.15);
  assert.notDeepEqual(front, [0, 0, 0]);
  await shot('packaging');
});

await step('upload PDF ditolak dengan pesan jelas', async () => {
  await page.getByTestId('file-input').setInputFiles({ name: 'x.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') });
  await page.getByRole('alert').getByText('PDF dan AI belum didukung').waitFor();
});

await step('tampilan ponsel tidak melebar ke samping', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `overflow ${overflow}px`);
  await shot('packaging-ponsel');
});

await step('tanpa galat konsol dan tanpa kiriman data ke luar', async () => {
  assert.deepEqual(problems, []);
  assert.deepEqual(external, []);
});

await browser.close();
stop();
console.log(`\n${results.length} skenario lolos`);
console.log('Bukti warna (layar → cetak):', JSON.stringify(colorEvidence));
