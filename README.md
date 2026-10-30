# Media Preflight

Web app statis untuk mengecek kesiapan desain videotron, banner, poster, dan packaging, lalu menampilkan preview hasil akhirnya. Semua proses berjalan di browser; file tidak dikirim ke server.

## Menjalankan

Diuji di Node.js 24.

```sh
npm install
npm run dev        # server pengembangan
npm run build      # hasil statis di dist/
npm run preview    # menyajikan dist/
```

`dist/` harus disajikan lewat HTTP, karena wasm dan ICC profile diambil dengan `fetch`. Membuka `index.html` langsung dari disk tidak akan berjalan.

## Tes

```sh
npm test                        # unit test
npx playwright install chromium # sekali saja
npm run build && npm run e2e    # uji Chromium terhadap production build
```

`npm run e2e` juga memperbarui `screenshots/`. `npm run samples` membuat ulang `samples/` kecuali `poster-cmyk.jpg`, yang dibuat sekali lewat CoreGraphics macOS.

## Struktur

- `src/lib/constants.ts`: semua angka asumsi.
- `src/lib/formulas.ts`, `check.ts`, `color.ts`, `led.ts`: fungsi murni dengan unit test.
- `src/lib/simulator.ts`, `cms.ts`: transformasi ICC.
- `e2e/`: pembuat file contoh dan uji browser.

## Simulasi warna

Alurnya sRGB → CMYK → sRGB memakai Little CMS (`lcms-wasm`), intent relative colorimetric dengan black point compensation. Tidak ada rumus RGB-ke-CMYK sederhana.

Warna ditandai out-of-gamut bila bergeser lebih dari ΔE76 10 setelah bolak-balik lewat CMYK. Ambang ini bersifat perkiraan dan bisa diubah di `constants.ts`.

### Lisensi

| Komponen | Sumber | Lisensi |
| --- | --- | --- |
| `FOGRA39L_coated.icc` | [CTAN colorprofiles](https://ctan.org/tex-archive/support/colorprofiles), versi 20181105 | zlib/libpng menurut README CTAN; XML sumbernya di [colord](https://github.com/hughsie/colord/blob/main/data/profiles/FOGRA39L_coated.iccprofile.xml) berlabel CC0; pembuat file ICC (Peter Selinger) melepas haknya; tag copyright profile: "This profile is free of known copyright restrictions" |
| `lcms-wasm` 1.0.5 | [npm](https://www.npmjs.com/package/lcms-wasm) | MIT, termasuk Little CMS di dalamnya |

Teks lengkapnya ada di `licenses/`, dan salinan lisensi profile ikut terbit di samping file ICC. SHA-256 profile: `b35713ef7eff09349d4c3249e5f377736d06d8a2671c54712971a3546bf17c57`.

Data karakterisasi di dalam profile berasal dari Fogra. Status bebasnya mengikuti label colord dan CTAN di atas, belum ditinjau ahli hukum.

## Batasan

- Warna cetak adalah perkiraan. Hasil nyata tergantung layar, bahan, dan percetakan.
- Hanya ada satu profile, untuk offset kertas coated. Untuk flexi, kain, HVS, dan kraft, simulasi ini paling jauh dari kondisi nyata, dan UI menyebutkannya.
- Kertas putih tidak disimulasikan: putih desain tetap putih layar.
- Input hanya PNG/JPG, plus video untuk videotron. PDF dan AI di luar scope v1.
- Warna file dibaca lewat browser. JPG CMYK dideteksi dan diberi peringatan, tetapi nilai warnanya sudah diubah browser. Profile tertanam di PNG/JPG RGB ditangani browser.
- Preview video memakai satu frame. FPS dan codec tidak dicek; syarat final mengikuti operator. Format video tergantung dukungan browser, misalnya Chromium tanpa codec H.264 tidak bisa membuka MP4 H.264.
- Packaging v1 hanya mengenal pola box lurus dan mockup 2D tampak depan. Pola terbuka adalah perkiraan, bukan dieline siap produksi.
- Bleed tidak bisa dipastikan dari file bila rasio ukuran potong dan bleed hampir sama, misalnya format persegi. Aplikasi memberi peringatan untuk kasus ini kecuali ukuran pixel-nya pas.
- Gambar sangat besar bisa gagal dibuka di browser dengan batas memori ketat, terutama ponsel.
- Sudah diuji di Chromium. Safari dan Firefox belum diuji.
