import { useMemo, useState } from 'react';
import { CheckList, NumberField, Section, SelectField, Stat, StatusChip } from './components/ui';
import { PrintPreview } from './components/PrintPreview';
import { Upload } from './components/Upload';
import { VideotronPreview } from './components/VideotronPreview';
import { checkPrintFile, checkVideotronFile, worstStatus, type CheckItem } from './lib/check';
import * as C from './lib/constants';
import {
  bannerDefaultDpi,
  calcBanner,
  calcBox,
  calcPoster,
  calcVideotron,
  type BoxLayout,
  type EyeletPoint,
  type PrintLayout,
  type VideotronResult,
} from './lib/formulas';
import type { Design } from './lib/image';
import { BANNER_MATERIALS, BOX_PAPERS, MEDIA, POSTER_PAPERS, POSTER_PRESETS, type MediaKind } from './media';
import { useProof } from './useProof';

const num = (value: string) => {
  const parsed = Number(value);
  return value.trim() !== '' && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};
const fmt = (value: number, digits = 0) => value.toLocaleString('id-ID', { maximumFractionDigits: digits });
const px = (size: { width: number; height: number }) => `${fmt(size.width)} × ${fmt(size.height)} px`;

export function App() {
  const [media, setMedia] = useState<MediaKind>('videotron');
  const [design, setDesign] = useState<Design | null>(null);

  const [led, setLed] = useState({ width: '4', height: '3', pitch: '10', distance: '30' });
  const [banner, setBanner] = useState({ width: '300', height: '100', material: 'flexi-front', distance: '5', dpi: '' });
  const [eyeletOverride, setEyeletOverride] = useState<boolean | null>(null);
  const [poster, setPoster] = useState({ width: '297', height: '420', paper: 'art-paper' });
  const [box, setBox] = useState({ length: '100', width: '50', height: '150', paper: 'ivory' });

  const material = BANNER_MATERIALS.find((m) => m.id === banner.material)!;
  const eyeletsOn = eyeletOverride ?? material.eyelets;

  const videotron = useMemo<VideotronResult | null>(() => {
    const [widthM, heightM, pitchMm, viewDistanceM] = [num(led.width), num(led.height), num(led.pitch), num(led.distance)];
    if (media !== 'videotron' || !widthM || !heightM || !pitchMm || !viewDistanceM) return null;
    const result = calcVideotron({ widthM, heightM, pitchMm, viewDistanceM });
    return result.width.px > 0 && result.height.px > 0 ? result : null;
  }, [media, led]);

  const print = useMemo<{ layout: PrintLayout; eyelets?: EyeletPoint[]; box?: BoxLayout } | null>(() => {
    if (media === 'banner') {
      const [widthCm, heightCm, viewDistanceM] = [num(banner.width), num(banner.height), num(banner.distance)];
      if (!widthCm || !heightCm || !viewDistanceM) return null;
      const dpiOverride = num(banner.dpi) ?? undefined;
      const result = calcBanner({ widthCm, heightCm, viewDistanceM, dpiOverride });
      return { layout: result.layout, eyelets: eyeletsOn ? result.eyelets : [] };
    }
    if (media === 'poster') {
      const [width, height] = [num(poster.width), num(poster.height)];
      return width && height ? { layout: calcPoster({ width, height }) } : null;
    }
    if (media === 'packaging') {
      const [lengthMm, widthMm, heightMm] = [num(box.length), num(box.width), num(box.height)];
      if (!lengthMm || !widthMm || !heightMm) return null;
      const result = calcBox({ lengthMm, widthMm, heightMm });
      return { layout: result.layout, box: result };
    }
    return null;
  }, [media, banner, eyeletsOn, poster, box]);

  const layout = print?.layout ?? null;
  const proofDesign = design?.kind === 'gambar' ? design : null;
  const proof = useProof(proofDesign, layout);
  const overlay = useMemo(() => ({ eyelets: print?.eyelets, box: print?.box }), [print]);

  const coated =
    media === 'poster'
      ? POSTER_PAPERS.find((p) => p.id === poster.paper)?.coated
      : media === 'packaging'
        ? BOX_PAPERS.find((p) => p.id === box.paper)?.coated
        : false;

  const checks = useMemo<CheckItem[]>(() => {
    if (!design) return [];
    const items: CheckItem[] = [];
    if (videotron) {
      items.push(...checkVideotronFile(design.size, videotron));
      if (design.durationS !== undefined) {
        items.push({
          label: 'Durasi',
          status: 'lolos',
          detail: `${fmt(design.durationS, 1)} detik. Sesuaikan dengan slot tayang dari operator.`,
        });
      }
    }
    if (layout) items.push(...checkPrintFile(design.size, layout));
    if (design.cmykJpeg) {
      items.push({
        label: 'Mode warna file',
        status: 'peringatan',
        detail: 'JPG ini sudah CMYK. Browser mengubahnya ke RGB dengan caranya sendiri, jadi nilai warna di pratinjau bukan nilai asli file.',
      });
    }
    if (layout && proof.state === 'ready') {
      const share = proof.gamut.percent;
      items.push({
        label: 'Warna',
        status: share > C.GAMUT_WARN_PERCENT ? 'peringatan' : 'lolos',
        detail: `${fmt(share, 1)}% area desain bergeser jelas saat dicetak (ΔE di atas ${C.GAMUT_DELTA_E}). Pergeseran terbesar ΔE ${fmt(proof.gamut.maxDeltaE, 1)}.`,
      });
    }
    return items;
  }, [design, videotron, layout, proof]);

  function pickMedia(next: MediaKind) {
    setMedia(next);
    if (next !== 'videotron' && design?.kind === 'video') setDesign(null);
  }

  return (
    <div className="app">
      <header className="top">
        <h1>Media Preflight</h1>
        <p>Cek kesiapan desain sebelum tayang atau cetak. Semua proses berjalan di browser Anda.</p>
      </header>

      <Section step={1} title="Pilih media">
        <div className="tabs" role="tablist">
          {MEDIA.map((item) => (
            <button
              key={item.id}
              role="tab"
              aria-selected={media === item.id}
              className={media === item.id ? 'tab active' : 'tab'}
              data-testid={`media-${item.id}`}
              onClick={() => pickMedia(item.id)}
            >
              <strong>{item.label}</strong>
              <span>{item.hint}</span>
            </button>
          ))}
        </div>
      </Section>

      <div className="columns">
        <Section step={2} title="Isi spesifikasi">
          <div className="fields">
            {media === 'videotron' && (
              <>
                <NumberField label="Lebar layar" unit="m" value={led.width} onChange={(width) => setLed({ ...led, width })} />
                <NumberField label="Tinggi layar" unit="m" value={led.height} onChange={(height) => setLed({ ...led, height })} />
                <NumberField label="Pixel pitch" unit="mm" value={led.pitch} onChange={(pitch) => setLed({ ...led, pitch })} />
                <NumberField label="Jarak pandang" unit="m" value={led.distance} onChange={(distance) => setLed({ ...led, distance })} />
              </>
            )}
            {media === 'banner' && (
              <>
                <NumberField label="Lebar" unit="cm" value={banner.width} onChange={(width) => setBanner({ ...banner, width })} />
                <NumberField label="Tinggi" unit="cm" value={banner.height} onChange={(height) => setBanner({ ...banner, height })} />
                <SelectField
                  label="Bahan"
                  value={banner.material}
                  options={BANNER_MATERIALS}
                  onChange={(value) => {
                    setBanner({ ...banner, material: value });
                    setEyeletOverride(null);
                  }}
                />
                <NumberField label="Jarak pandang" unit="m" value={banner.distance} onChange={(distance) => setBanner({ ...banner, distance })} />
                <NumberField
                  label="DPI"
                  unit="DPI"
                  value={banner.dpi}
                  placeholder={`Otomatis: ${num(banner.distance) ? bannerDefaultDpi(num(banner.distance)!) : '-'}`}
                  onChange={(dpi) => setBanner({ ...banner, dpi })}
                />
                <label className="check-field">
                  <input type="checkbox" checked={eyeletsOn} onChange={(e) => setEyeletOverride(e.target.checked)} /> Pasang mata ayam
                </label>
              </>
            )}
            {media === 'poster' && (
              <>
                <SelectField
                  label="Ukuran standar"
                  value={POSTER_PRESETS.find((p) => String(p.width) === poster.width && String(p.height) === poster.height)?.id ?? 'custom'}
                  options={[...POSTER_PRESETS.map((p) => ({ id: p.id, label: p.id })), { id: 'custom', label: 'Ukuran lain' }]}
                  onChange={(id) => {
                    const preset = POSTER_PRESETS.find((p) => p.id === id);
                    if (preset) setPoster({ ...poster, width: String(preset.width), height: String(preset.height) });
                  }}
                />
                <SelectField label="Kertas" value={poster.paper} options={POSTER_PAPERS} onChange={(paper) => setPoster({ ...poster, paper })} />
                <NumberField label="Lebar" unit="mm" value={poster.width} onChange={(width) => setPoster({ ...poster, width })} />
                <NumberField label="Tinggi" unit="mm" value={poster.height} onChange={(height) => setPoster({ ...poster, height })} />
              </>
            )}
            {media === 'packaging' && (
              <>
                <NumberField label="Panjang box" unit="mm" value={box.length} onChange={(length) => setBox({ ...box, length })} />
                <NumberField label="Lebar box" unit="mm" value={box.width} onChange={(width) => setBox({ ...box, width })} />
                <NumberField label="Tinggi box" unit="mm" value={box.height} onChange={(height) => setBox({ ...box, height })} />
                <SelectField label="Kertas" value={box.paper} options={BOX_PAPERS} onChange={(paper) => setBox({ ...box, paper })} />
              </>
            )}
          </div>
        </Section>

        <Section step={3} title="Hasil hitungan">
          {!videotron && !print && <p className="error">Isi semua ukuran dengan angka lebih dari 0.</p>}
          {videotron && <VideotronStats result={videotron} pitch={num(led.pitch)!} />}
          {print && <PrintStats media={media} layout={print.layout} eyelets={print.eyelets} box={print.box} />}
        </Section>
      </div>

      <Section step={4} title="Upload desain">
        <Upload allowVideo={media === 'videotron'} onLoaded={setDesign} />
      </Section>

      {design && (videotron || print) && (
        <Section step={5} title="Hasil cek dan preview">
          <div className="verdict" data-testid="verdict">
            <StatusChip status={worstStatus(checks)} />
            <span>
              {design.name}, {px(design.size)}
            </span>
          </div>
          <CheckList items={checks} />
          {design.kind === 'video' && (
            <p className="note">
              Preview memakai satu frame dari video. FPS dan codec tidak dicek karena browser tidak membacanya secara andal. Syarat final mengikuti operator videotron.
            </p>
          )}
          {videotron && <VideotronPreview design={design} width={videotron.width.px} height={videotron.height.px} />}
          {print && (
            <>
              <PrintPreview proof={proof} overlay={overlay} />
              <p className="disclaimer">
                Warna cetak di sini adalah perkiraan, memakai ICC profile {C.ICC_PROFILE_NAME} (offset kertas coated). Hasil nyata tergantung layar Anda, bahan, dan percetakan.
                {!coated && ' Bahan yang Anda pilih berbeda dari kondisi profile ini, jadi selisihnya bisa lebih besar.'}
              </p>
            </>
          )}
        </Section>
      )}

      <details className="assumptions">
        <summary>Asumsi perkiraan yang dipakai</summary>
        <ul>
          <li>Jarak pandang minimum videotron ≈ pitch (mm) × {C.MIN_VIEW_DISTANCE_M_PER_PITCH_MM} m.</li>
          <li>Tinggi teks videotron ≥ jarak pandang ÷ {C.TEXT_HEIGHT_DISTANCE_DIVISOR} dan ≥ {C.MIN_TEXT_LED_PX} pixel LED.</li>
          <li>DPI banner: di bawah {C.BANNER_NEAR_LIMIT_M} m = {C.BANNER_DPI_NEAR}, {C.BANNER_NEAR_LIMIT_M}–{C.BANNER_FAR_LIMIT_M} m = {C.BANNER_DPI_MID}, di atas {C.BANNER_FAR_LIMIT_M} m = {C.BANNER_DPI_FAR}.</li>
          <li>Banner: bleed {C.BANNER_BLEED_MM} mm, area aman {C.BANNER_SAFE_MM} mm, mata ayam paling jauh {C.EYELET_SPACING_CM} cm dan {C.EYELET_INSET_CM} cm dari tepi.</li>
          <li>Poster dan packaging: {C.PRINT_DPI} DPI, bleed {C.PRINT_BLEED_MM} mm, area aman {C.PRINT_SAFE_MM} mm.</li>
          <li>Packaging: pola box lurus, flap lem {C.BOX_GLUE_FLAP_MM} mm, tinggi tutup sama dengan lebar box.</li>
          <li>Out-of-gamut: warna bergeser lebih dari ΔE {C.GAMUT_DELTA_E} setelah bolak-balik lewat CMYK.</li>
          <li>Simulasi warna: Little CMS (lcms-wasm) dengan profile {C.ICC_PROFILE_NAME} dari proyek colord, relative colorimetric dengan black point compensation.</li>
        </ul>
      </details>
    </div>
  );
}

function VideotronStats({ result, pitch }: { result: VideotronResult; pitch: number }) {
  return (
    <>
      <dl className="stats">
        <Stat label="Resolusi konten" value={`${fmt(result.width.px)} × ${fmt(result.height.px)} px`} />
        <Stat label="Rasio" value={result.ratio} />
        <Stat label="Jarak pandang minimum" value={`${fmt(result.minViewDistanceM, 1)} m`} note="Perkiraan" />
        <Stat label="Tinggi teks minimum" value={`${fmt(result.minTextHeightMm)} mm`} note={`Perkiraan, ${fmt(result.minTextHeightPx)} pixel LED`} />
      </dl>
      {!result.exact && (
        <p className="warning" data-testid="pitch-warning">
          Ukuran tidak habis dibagi pitch {fmt(pitch, 2)} mm. Resolusi dibulatkan ke bawah ke LED utuh, sisa {fmt(result.width.remainderMm, 1)} mm di lebar dan {fmt(result.height.remainderMm, 1)} mm di tinggi. Pastikan ukuran fisik ke operator.
        </p>
      )}
      {result.viewDistanceTooClose && (
        <p className="warning">Jarak pandang lebih dekat dari minimum, jadi titik LED akan terlihat.</p>
      )}
    </>
  );
}

function PrintStats(props: { media: MediaKind; layout: PrintLayout; eyelets?: EyeletPoint[]; box?: BoxLayout }) {
  const { layout, eyelets, box, media } = props;
  return (
    <dl className="stats">
      <Stat label="DPI" value={fmt(layout.dpi)} note={media === 'banner' ? 'Perkiraan, bisa diubah' : 'Perkiraan'} />
      <Stat label="Ukuran file dengan bleed" value={px(layout.bleedPx)} note={`Tanpa bleed ${px(layout.trimPx)}`} />
      <Stat label="Bleed" value={`${fmt(layout.bleedMm)} mm`} note="Perkiraan, tiap sisi" />
      <Stat label="Area aman" value={`${fmt(layout.safeMm)} mm`} note="Perkiraan, dari garis potong" />
      {box && <Stat label="Ukuran pola terbuka" value={`${fmt(box.flatMm.width)} × ${fmt(box.flatMm.height)} mm`} note="Perkiraan, tanpa bleed" />}
      {eyelets && eyelets.length > 0 && (
        <Stat label="Mata ayam" value={`${eyelets.length} titik`} note={`Perkiraan, jarak maks. ${C.EYELET_SPACING_CM} cm, ${C.EYELET_INSET_CM} cm dari tepi`} />
      )}
    </dl>
  );
}
