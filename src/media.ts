export type MediaKind = 'videotron' | 'banner' | 'poster' | 'packaging';

export const MEDIA: { id: MediaKind; label: string; hint: string }[] = [
  { id: 'videotron', label: 'Videotron', hint: 'Layar LED, RGB' },
  { id: 'banner', label: 'Banner / Spanduk', hint: 'Cetak besar, CMYK' },
  { id: 'poster', label: 'Poster', hint: 'Cetak kertas, CMYK' },
  { id: 'packaging', label: 'Packaging', hint: 'Box 2D, CMYK' },
];

export const BANNER_MATERIALS = [
  { id: 'flexi-front', label: 'Flexi frontlite', eyelets: true },
  { id: 'flexi-back', label: 'Flexi backlite', eyelets: false },
  { id: 'albatros', label: 'Albatros (indoor)', eyelets: false },
  { id: 'kain', label: 'Kain spanduk', eyelets: false },
];

export const POSTER_PAPERS = [
  { id: 'art-paper', label: 'Art paper', coated: true },
  { id: 'art-carton', label: 'Art carton', coated: true },
  { id: 'hvs', label: 'HVS', coated: false },
];

export const BOX_PAPERS = [
  { id: 'ivory', label: 'Ivory', coated: true },
  { id: 'art-carton', label: 'Art carton', coated: true },
  { id: 'duplex', label: 'Duplex', coated: true },
  { id: 'kraft', label: 'Kraft', coated: false },
];

export const POSTER_PRESETS = [
  { id: 'A4', width: 210, height: 297 },
  { id: 'A3', width: 297, height: 420 },
  { id: 'A2', width: 420, height: 594 },
  { id: 'A1', width: 594, height: 841 },
  { id: 'A0', width: 841, height: 1189 },
];
