import {
  TYPE_CMYK_8,
  TYPE_RGB_8,
  INTENT_RELATIVE_COLORIMETRIC,
  cmsFLAGS_BLACKPOINTCOMPENSATION,
  type Lcms,
} from 'lcms-wasm';

export type Simulator = (rgba: Uint8ClampedArray) => Uint8ClampedArray;

/** Membuat transformasi ICC sRGB → CMYK → sRGB. Melempar galat bila profile bukan CMYK. */
export function createSimulator(lcms: Lcms, profileBytes: Uint8Array): Simulator {
  const cmyk = lcms.cmsOpenProfileFromMem(profileBytes, profileBytes.byteLength);
  if (!cmyk || lcms.cmsGetColorSpaceASCII(cmyk).trim() !== 'CMYK') {
    throw new Error('ICC profile bukan profile CMYK yang valid');
  }
  const srgb = lcms.cmsCreate_sRGBProfile();
  const intent = INTENT_RELATIVE_COLORIMETRIC;
  const flags = cmsFLAGS_BLACKPOINTCOMPENSATION;
  const toCmyk = lcms.cmsCreateTransform(srgb, TYPE_RGB_8, cmyk, TYPE_CMYK_8, intent, flags);
  const toScreen = lcms.cmsCreateTransform(cmyk, TYPE_CMYK_8, srgb, TYPE_RGB_8, intent, flags);
  if (!toCmyk || !toScreen) throw new Error('Transformasi ICC gagal dibuat');

  return (rgba) => {
    const count = rgba.length / 4;
    const rgb = new Uint8Array(count * 3);
    for (let i = 0; i < count; i++) {
      rgb[i * 3] = rgba[i * 4]!;
      rgb[i * 3 + 1] = rgba[i * 4 + 1]!;
      rgb[i * 3 + 2] = rgba[i * 4 + 2]!;
    }
    const printed = lcms.cmsDoTransform(toCmyk, rgb, count);
    const screen = lcms.cmsDoTransform(toScreen, printed, count);
    const out = new Uint8ClampedArray(rgba.length);
    for (let i = 0; i < count; i++) {
      out[i * 4] = screen[i * 3]!;
      out[i * 4 + 1] = screen[i * 3 + 1]!;
      out[i * 4 + 2] = screen[i * 3 + 2]!;
      out[i * 4 + 3] = rgba[i * 4 + 3]!;
    }
    return out;
  };
}
