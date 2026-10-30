import { describe, expect, it } from 'vitest';
import { checkPrintFile, checkVideotronFile, effectiveDpi, jpegComponents, worstStatus } from './check';
import { calcBanner, calcPoster, calcVideotron } from './formulas';

const statusOf = (items: { label: string; status: string }[], label: string) =>
  items.find((i) => i.label === label)?.status;

describe('cek videotron', () => {
  const result = calcVideotron({ widthM: 4, heightM: 3, pitchMm: 10, viewDistanceM: 30 });

  it('resolusi pas lolos', () => {
    expect(worstStatus(checkVideotronFile({ width: 400, height: 300 }, result))).toBe('lolos');
  });

  it('file lebih besar dengan rasio sama diberi peringatan', () => {
    const items = checkVideotronFile({ width: 800, height: 600 }, result);
    expect(statusOf(items, 'Rasio')).toBe('lolos');
    expect(statusOf(items, 'Resolusi')).toBe('peringatan');
  });

  it('file jauh lebih kecil gagal', () => {
    expect(statusOf(checkVideotronFile({ width: 200, height: 150 }, result), 'Resolusi')).toBe('gagal');
  });

  it('rasio salah gagal', () => {
    expect(statusOf(checkVideotronFile({ width: 1920, height: 1080 }, result), 'Rasio')).toBe('gagal');
  });
});

describe('cek cetak', () => {
  const poster = calcPoster({ width: 297, height: 420 });

  it('file dengan bleed lolos semua', () => {
    expect(worstStatus(checkPrintFile({ width: 3579, height: 5031 }, poster))).toBe('lolos');
  });

  it('file tanpa bleed diberi peringatan, DPI tetap lolos', () => {
    const items = checkPrintFile({ width: 3508, height: 4961 }, poster);
    expect(statusOf(items, 'Bleed')).toBe('peringatan');
    expect(statusOf(items, 'DPI efektif')).toBe('lolos');
  });

  it('DPI rendah gagal, sedikit di bawah anjuran peringatan', () => {
    expect(statusOf(checkPrintFile({ width: 1000, height: 1414 }, poster), 'DPI efektif')).toBe('gagal');
    expect(statusOf(checkPrintFile({ width: 2800, height: 3936 }, poster), 'DPI efektif')).toBe('peringatan');
  });

  it('format persegi: file tanpa bleed tidak dianggap punya bleed', () => {
    const square = calcPoster({ width: 500, height: 500 });
    const items = checkPrintFile({ width: 5906, height: 5906 }, square);
    expect(statusOf(items, 'Bleed')).toBe('peringatan');
    expect(statusOf(items, 'DPI efektif')).toBe('lolos');
    expect(items.find((i) => i.label === 'Bleed')?.detail).toContain('tidak bisa dipastikan');
  });

  it('format persegi: file seukuran bleed lolos', () => {
    const square = calcPoster({ width: 500, height: 500 });
    expect(worstStatus(checkPrintFile({ width: 5976, height: 5976 }, square))).toBe('lolos');
  });

  it('rasio salah: bleed tidak diklaim hilang maupun ada', () => {
    const items = checkPrintFile({ width: 5000, height: 2000 }, poster);
    expect(statusOf(items, 'Rasio')).toBe('gagal');
    expect(items.find((i) => i.label === 'Bleed')?.detail).toContain('Tidak bisa dipastikan');
  });

  it('banner memakai DPI targetnya sendiri', () => {
    const { layout } = calcBanner({ widthCm: 300, heightCm: 100, viewDistanceM: 5 });
    const items = checkPrintFile({ width: 11969, height: 4094 }, layout);
    expect(worstStatus(items)).toBe('lolos');
  });

  it('DPI efektif mengambil sisi terlemah', () => {
    expect(effectiveDpi({ width: 300, height: 100 }, { width: 25.4, height: 25.4 })).toBe(100);
  });
});

describe('jpegComponents', () => {
  it('membaca jumlah komponen dari SOF0', () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 14, 8, 0, 10, 0, 10, 4, 0, 0]);
    expect(jpegComponents(bytes)).toBe(4);
  });

  it('mengembalikan null untuk data bukan JPEG', () => {
    expect(jpegComponents(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
  });
});
