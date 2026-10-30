import {
  BANNER_BLEED_MM,
  BANNER_DPI_FAR,
  BANNER_DPI_MID,
  BANNER_DPI_NEAR,
  BANNER_FAR_LIMIT_M,
  BANNER_NEAR_LIMIT_M,
  BANNER_SAFE_MM,
  BOX_GLUE_FLAP_MM,
  EYELET_INSET_CM,
  EYELET_SPACING_CM,
  MIN_TEXT_LED_PX,
  MIN_VIEW_DISTANCE_M_PER_PITCH_MM,
  MM_PER_INCH,
  PRINT_BLEED_MM,
  PRINT_DPI,
  PRINT_SAFE_MM,
  TEXT_HEIGHT_DISTANCE_DIVISOR,
} from './constants';

const EPSILON = 1e-6;

export type Size = { width: number; height: number };

export function mmToPx(mm: number, dpi: number): number {
  return Math.round((mm / MM_PER_INCH) * dpi);
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Rasio sederhana ("4:3"); bila angkanya besar, jatuh ke desimal ("1,37:1"). */
export function formatRatio(width: number, height: number): string {
  const w = Math.round(width);
  const h = Math.round(height);
  if (w <= 0 || h <= 0) return '-';
  const d = gcd(w, h);
  if (w / d <= 32 && h / d <= 32) return `${w / d}:${h / d}`;
  return `${(w / h).toFixed(2).replace('.', ',')}:1`;
}

export type LedAxis = {
  /** Jumlah LED utuh yang muat. Tidak pernah melebihi dimensi fisik. */
  px: number;
  exact: boolean;
  /** Sisa fisik (mm) yang tidak terisi LED utuh. */
  remainderMm: number;
};

/** Dimensi yang tidak habis dibagi pitch dibulatkan ke bawah dan ditandai. */
export function ledAxis(sizeMm: number, pitchMm: number): LedAxis {
  const raw = sizeMm / pitchMm;
  const nearest = Math.round(raw);
  if (Math.abs(raw - nearest) < EPSILON) {
    return { px: nearest, exact: true, remainderMm: 0 };
  }
  const px = Math.floor(raw);
  return { px, exact: false, remainderMm: sizeMm - px * pitchMm };
}

export type VideotronSpec = {
  widthM: number;
  heightM: number;
  pitchMm: number;
  viewDistanceM: number;
};

export type VideotronResult = {
  width: LedAxis;
  height: LedAxis;
  ratio: string;
  exact: boolean;
  minViewDistanceM: number;
  viewDistanceTooClose: boolean;
  minTextHeightMm: number;
  minTextHeightPx: number;
};

export function calcVideotron(spec: VideotronSpec): VideotronResult {
  const width = ledAxis(spec.widthM * 1000, spec.pitchMm);
  const height = ledAxis(spec.heightM * 1000, spec.pitchMm);
  const minViewDistanceM = spec.pitchMm * MIN_VIEW_DISTANCE_M_PER_PITCH_MM;
  const minTextHeightMm = Math.max(
    (spec.viewDistanceM * 1000) / TEXT_HEIGHT_DISTANCE_DIVISOR,
    MIN_TEXT_LED_PX * spec.pitchMm,
  );
  return {
    width,
    height,
    ratio: formatRatio(width.px, height.px),
    exact: width.exact && height.exact,
    minViewDistanceM,
    viewDistanceTooClose: spec.viewDistanceM < minViewDistanceM,
    minTextHeightMm,
    minTextHeightPx: Math.ceil(minTextHeightMm / spec.pitchMm - EPSILON),
  };
}

export function bannerDefaultDpi(viewDistanceM: number): number {
  if (viewDistanceM < BANNER_NEAR_LIMIT_M) return BANNER_DPI_NEAR;
  if (viewDistanceM <= BANNER_FAR_LIMIT_M) return BANNER_DPI_MID;
  return BANNER_DPI_FAR;
}

export type PrintLayout = {
  trimMm: Size;
  bleedMm: number;
  safeMm: number;
  dpi: number;
  trimPx: Size;
  /** Ukuran file yang dianjurkan: potong + bleed di keempat sisi. */
  bleedPx: Size;
};

export function calcPrintLayout(trimMm: Size, bleedMm: number, safeMm: number, dpi: number): PrintLayout {
  return {
    trimMm,
    bleedMm,
    safeMm,
    dpi,
    trimPx: { width: mmToPx(trimMm.width, dpi), height: mmToPx(trimMm.height, dpi) },
    bleedPx: {
      width: mmToPx(trimMm.width + bleedMm * 2, dpi),
      height: mmToPx(trimMm.height + bleedMm * 2, dpi),
    },
  };
}

export type EyeletPoint = { xCm: number; yCm: number };

/** Mata ayam di keempat sudut, lalu dibagi rata dengan jarak maksimum `spacingCm`. */
export function eyeletPositions(
  widthCm: number,
  heightCm: number,
  spacingCm = EYELET_SPACING_CM,
  insetCm = EYELET_INSET_CM,
): EyeletPoint[] {
  const innerW = widthCm - insetCm * 2;
  const innerH = heightCm - insetCm * 2;
  if (innerW <= 0 || innerH <= 0) return [];
  const stepsX = Math.max(1, Math.ceil(innerW / spacingCm - EPSILON));
  const stepsY = Math.max(1, Math.ceil(innerH / spacingCm - EPSILON));
  const points: EyeletPoint[] = [];
  for (let i = 0; i <= stepsX; i++) {
    const xCm = insetCm + (innerW * i) / stepsX;
    points.push({ xCm, yCm: insetCm }, { xCm, yCm: heightCm - insetCm });
  }
  for (let i = 1; i < stepsY; i++) {
    const yCm = insetCm + (innerH * i) / stepsY;
    points.push({ xCm: insetCm, yCm }, { xCm: widthCm - insetCm, yCm });
  }
  return points;
}

export type BannerSpec = {
  widthCm: number;
  heightCm: number;
  viewDistanceM: number;
  /** Bila kosong, memakai default dari jarak pandang. */
  dpiOverride?: number;
};

export function calcBanner(spec: BannerSpec) {
  const dpi = spec.dpiOverride ?? bannerDefaultDpi(spec.viewDistanceM);
  const layout = calcPrintLayout(
    { width: spec.widthCm * 10, height: spec.heightCm * 10 },
    BANNER_BLEED_MM,
    BANNER_SAFE_MM,
    dpi,
  );
  return { layout, eyelets: eyeletPositions(spec.widthCm, spec.heightCm) };
}

export function calcPoster(trimMm: Size): PrintLayout {
  return calcPrintLayout(trimMm, PRINT_BLEED_MM, PRINT_SAFE_MM, PRINT_DPI);
}

export type BoxSpec = { lengthMm: number; widthMm: number; heightMm: number };

export type BoxPanel = { name: string; x: number; y: number; width: number; height: number };

export type BoxLayout = { flatMm: Size; panels: BoxPanel[]; front: BoxPanel; layout: PrintLayout };

/** Pola lurus (straight tuck): lem, depan, samping, belakang, samping; tutup atas dan bawah. */
export function calcBox(spec: BoxSpec): BoxLayout {
  const { lengthMm: p, widthMm: l, heightMm: t } = spec;
  const glue = BOX_GLUE_FLAP_MM;
  const flap = l;
  const flatMm = { width: glue + 2 * (p + l), height: t + 2 * flap };
  const front: BoxPanel = { name: 'Depan', x: glue, y: flap, width: p, height: t };
  const panels: BoxPanel[] = [
    { name: 'Lem', x: 0, y: flap, width: glue, height: t },
    front,
    { name: 'Samping', x: glue + p, y: flap, width: l, height: t },
    { name: 'Belakang', x: glue + p + l, y: flap, width: p, height: t },
    { name: 'Samping', x: glue + 2 * p + l, y: flap, width: l, height: t },
    { name: 'Tutup atas', x: glue, y: 0, width: p, height: flap },
    { name: 'Tutup bawah', x: glue, y: flap + t, width: p, height: flap },
  ];
  return { flatMm, panels, front, layout: calcPoster(flatMm) };
}
