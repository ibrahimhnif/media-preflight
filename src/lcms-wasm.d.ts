declare module 'lcms-wasm' {
  export type LcmsHandle = number;
  export type Lcms = {
    cmsOpenProfileFromMem(bytes: Uint8Array, size: number): LcmsHandle;
    cmsCreate_sRGBProfile(): LcmsHandle;
    cmsGetColorSpaceASCII(profile: LcmsHandle): string;
    cmsCreateTransform(
      input: LcmsHandle,
      inputFormat: number,
      output: LcmsHandle,
      outputFormat: number,
      intent: number,
      flags: number,
    ): LcmsHandle;
    cmsDoTransform(transform: LcmsHandle, input: Uint8Array, size: number): Uint8Array;
  };
  export function instantiate(options?: { locateFile?: (name: string) => string }): Promise<Lcms>;
  export const TYPE_RGB_8: number;
  export const TYPE_CMYK_8: number;
  export const INTENT_RELATIVE_COLORIMETRIC: number;
  export const cmsFLAGS_BLACKPOINTCOMPENSATION: number;
}
