import {
  BOX_PX_TOLERANCE,
  BOX_RATIO_MIN_GAP,
  DPI_WARN_RATIO,
  LED_RESOLUTION_WARN_RATIO,
  MM_PER_INCH,
  RATIO_PASS_TOLERANCE,
  RATIO_WARN_TOLERANCE,
} from './constants';
import { formatRatio, type PrintLayout, type Size, type VideotronResult } from './formulas';

export type Status = 'lolos' | 'peringatan' | 'gagal';

export type CheckItem = { label: string; status: Status; detail: string };

export function worstStatus(items: CheckItem[]): Status {
  if (items.some((i) => i.status === 'gagal')) return 'gagal';
  if (items.some((i) => i.status === 'peringatan')) return 'peringatan';
  return 'lolos';
}

export function ratioDeviation(a: Size, b: Size): number {
  const ra = a.width / a.height;
  const rb = b.width / b.height;
  return Math.abs(ra - rb) / rb;
}

export function effectiveDpi(file: Size, physicalMm: Size): number {
  return Math.min(
    file.width / (physicalMm.width / MM_PER_INCH),
    file.height / (physicalMm.height / MM_PER_INCH),
  );
}

function ratioStatus(deviation: number): Status {
  if (deviation <= RATIO_PASS_TOLERANCE) return 'lolos';
  return deviation <= RATIO_WARN_TOLERANCE ? 'peringatan' : 'gagal';
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1).replace('.', ',')}%`;
}

export function checkVideotronFile(file: Size, result: VideotronResult): CheckItem[] {
  const target = { width: result.width.px, height: result.height.px };
  const deviation = ratioDeviation(file, target);
  const ratioState = ratioStatus(deviation);
  const scale = Math.min(file.width / target.width, file.height / target.height);
  const exactSize = file.width === target.width && file.height === target.height;

  const resolution: CheckItem = exactSize
    ? { label: 'Resolusi', status: 'lolos', detail: `Pas ${target.width} × ${target.height} px.` }
    : scale >= 1
      ? {
          label: 'Resolusi',
          status: 'peringatan',
          detail: `File ${file.width} × ${file.height} px lebih besar dari layar ${target.width} × ${target.height} px. Detail kecil bisa hilang saat diperkecil.`,
        }
      : {
          label: 'Resolusi',
          status: scale >= LED_RESOLUTION_WARN_RATIO ? 'peringatan' : 'gagal',
          detail: `File ${file.width} × ${file.height} px lebih kecil dari layar ${target.width} × ${target.height} px, jadi harus diperbesar dan terlihat buram.`,
        };

  return [
    {
      label: 'Rasio',
      status: ratioState,
      detail:
        ratioState === 'lolos'
          ? `Rasio file ${formatRatio(file.width, file.height)} cocok dengan layar ${result.ratio}.`
          : `Rasio file ${formatRatio(file.width, file.height)} berbeda ${percent(deviation)} dari layar ${result.ratio}. Akan ada area kosong atau terpotong.`,
    },
    resolution,
  ];
}

export type BoxMatch = { box: 'trim' | 'bleed'; certain: boolean };

/**
 * File boleh selebar ukuran potong atau selebar potong + bleed.
 * Pada format mendekati persegi kedua rasionya nyaris sama, jadi rasio saja tidak
 * bisa membedakan; di situ dipakai ukuran pixel dan hasilnya ditandai tidak pasti.
 */
export function matchPrintBox(file: Size, layout: PrintLayout): BoxMatch {
  const withBleed = {
    width: layout.trimMm.width + layout.bleedMm * 2,
    height: layout.trimMm.height + layout.bleedMm * 2,
  };
  const toBleed = ratioDeviation(file, withBleed);
  const toTrim = ratioDeviation(file, layout.trimMm);
  if (Math.abs(toBleed - toTrim) > BOX_RATIO_MIN_GAP) {
    return { box: toBleed < toTrim ? 'bleed' : 'trim', certain: true };
  }
  const offBleed = Math.abs(file.width - layout.bleedPx.width);
  const offTrim = Math.abs(file.width - layout.trimPx.width);
  return {
    box: offBleed <= offTrim ? 'bleed' : 'trim',
    certain: offBleed / layout.bleedPx.width <= BOX_PX_TOLERANCE,
  };
}

function bleedItem(match: BoxMatch, ratioState: Status, layout: PrintLayout): CheckItem {
  const add = `Tambahkan ${layout.bleedMm} mm di tiap sisi, jadi ${layout.bleedPx.width} × ${layout.bleedPx.height} px.`;
  if (ratioState === 'gagal') {
    return { label: 'Bleed', status: 'peringatan', detail: `Tidak bisa dipastikan karena rasio file tidak cocok. ${add}` };
  }
  if (!match.certain) {
    return {
      label: 'Bleed',
      status: 'peringatan',
      detail: `Rasio ukuran potong dan ukuran bleed hampir sama, jadi bleed tidak bisa dipastikan dari file. Pastikan sendiri di desain. ${add}`,
    };
  }
  return match.box === 'bleed'
    ? { label: 'Bleed', status: 'lolos', detail: `File sudah memuat bleed ${layout.bleedMm} mm.` }
    : { label: 'Bleed', status: 'peringatan', detail: `File tidak memuat bleed. ${add}` };
}

export function checkPrintFile(file: Size, layout: PrintLayout): CheckItem[] {
  const match = matchPrintBox(file, layout);
  const box = match.box;
  const physical =
    box === 'bleed'
      ? {
          width: layout.trimMm.width + layout.bleedMm * 2,
          height: layout.trimMm.height + layout.bleedMm * 2,
        }
      : layout.trimMm;
  const deviation = ratioDeviation(file, physical);
  const ratioState = ratioStatus(deviation);
  const dpi = effectiveDpi(file, physical);
  const dpiState: Status = dpi >= layout.dpi - 0.5 ? 'lolos' : dpi >= layout.dpi * DPI_WARN_RATIO ? 'peringatan' : 'gagal';

  return [
    {
      label: 'Rasio',
      status: ratioState,
      detail:
        ratioState === 'lolos'
          ? `Rasio file ${formatRatio(file.width, file.height)} cocok dengan ukuran ${box === 'bleed' ? 'potong + bleed' : 'potong'}.`
          : `Rasio file ${formatRatio(file.width, file.height)} berbeda ${percent(deviation)} dari ukuran cetak. Desain akan terpotong atau menyisakan area kosong.`,
    },
    {
      label: 'DPI efektif',
      status: dpiState,
      detail: `${Math.round(dpi)} DPI pada ukuran cetak, anjuran ${layout.dpi} DPI.`,
    },
    bleedItem(match, ratioState, layout),
  ];
}

/** Baca jumlah komponen warna dari header JPEG. 4 berarti CMYK/YCCK. */
export function jpegComponents(bytes: Uint8Array): number | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1]!;
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) return bytes[i + 9]!;
    const length = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    i += 2 + length;
  }
  return null;
}
