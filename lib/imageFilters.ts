// Filter foto per-pixel (jalan di semua browser, tanpa library).
// Ukuran efek (titik halftone, radius blur) diskalakan terhadap ukuran gambar,
// jadi preview kecil dan hasil cetak besar terlihat sama.

type Rgba = Uint8ClampedArray;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/** Noise deterministik per pixel (grain) supaya preview & hasil akhir sama. */
function grain(i: number) {
  let x = (i * 374761393) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) & 0xffff) / 0xffff - 0.5;
}

// ---------------------------------------------------------------------------
// 1. Retro halftone: warna pudar hangat, bayangan keunguan, titik halftone, grain.
// ---------------------------------------------------------------------------
export function retro(img: ImageData) {
  const { data: d, width: w, height: h } = img;
  const cell = Math.max(2.4, Math.min(w, h) / 260); // ukuran titik halftone
  const inv = 1 / cell;
  const cx = w / 2;
  const cy = h / 2;
  const maxR2 = cx * cx + cy * cy;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let r = d[i] / 255;
      let g = d[i + 1] / 255;
      let b = d[i + 2] / 255;
      const l = 0.299 * r + 0.587 * g + 0.114 * b;

      // saturasi turun sedikit
      r = l + (r - l) * 0.82;
      g = l + (g - l) * 0.82;
      b = l + (b - l) * 0.82;
      // kontras rendah + hitam diangkat (efek film pudar)
      r = 0.5 + (r - 0.5) * 0.82 + 0.03;
      g = 0.5 + (g - 0.5) * 0.82 + 0.02;
      b = 0.5 + (b - 0.5) * 0.82 + 0.02;
      // bayangan magenta/ungu, highlight krem hangat
      const sh = (1 - l) * (1 - l);
      const hl = l * l;
      r += 0.1 * sh + 0.07 * hl;
      g += -0.01 * sh + 0.045 * hl;
      b += 0.11 * sh - 0.07 * hl;

      // titik halftone (grid diputar 45°): makin gelap → titik makin besar
      const u = (x + y) * 0.7071 * inv;
      const v = (x - y) * 0.7071 * inv;
      const fu = u - Math.floor(u) - 0.5;
      const fv = v - Math.floor(v) - 0.5;
      const dist = Math.sqrt(fu * fu + fv * fv);
      const radius = Math.sqrt(clamp01(1 - l)) * 0.6;
      const dot = 1 - smoothstep(radius - 0.12, radius + 0.12, dist);
      const tone = 1 - 0.2 * dot + 0.035 * (1 - dot);

      // vinyet halus
      const dx = x - cx;
      const dy = y - cy;
      const vig = 1 - 0.16 * ((dx * dx + dy * dy) / maxR2);

      const n = grain(i) * 0.05;
      d[i] = (r * tone * vig + n) * 255;
      d[i + 1] = (g * tone * vig + n) * 255;
      d[i + 2] = (b * tone * vig + n) * 255;
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Hitam putih klasik: luminance, kurva-S lembut, grain halus.
// ---------------------------------------------------------------------------
export function blackWhite(img: ImageData) {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let v = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
    const s = v < 0.5 ? 2 * v * v : 1 - 2 * (1 - v) * (1 - v); // kurva-S
    v = v + (s - v) * 0.55;
    v = 0.025 + v * 0.96 + grain(i) * 0.035;
    const out = v * 255;
    d[i] = out;
    d[i + 1] = out;
    d[i + 2] = out;
  }
}

// ---------------------------------------------------------------------------
// 3. Cantik: kulit dihaluskan (hanya area warna kulit, detail mata/rambut/tepi dijaga),
//    lalu sedikit dicerahkan dengan rona pink hangat.
// ---------------------------------------------------------------------------
export function beauty(img: ImageData) {
  const { data: d, width: w, height: h } = img;
  const radius = Math.max(2, Math.round(Math.max(w, h) / 170));
  const blurred = new Uint8ClampedArray(d);
  boxBlur(blurred, w, h, radius);
  boxBlur(blurred, w, h, radius); // 2x box ≈ gaussian

  const sigma2 = 2 * 22 * 22;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];

    // deteksi kulit di ruang YCbCr (lunak di tepi rentang)
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    const skin =
      smoothstep(70, 82, cb) * (1 - smoothstep(122, 134, cb)) * smoothstep(128, 140, cr) * (1 - smoothstep(168, 180, cr)) *
      smoothstep(35, 60, y);

    // jaga detail: makin beda dengan versi blur (tepi, mata, alis), makin sedikit dihaluskan
    const dr = blurred[i] - r;
    const dg = blurred[i + 1] - g;
    const db = blurred[i + 2] - b;
    const diff = (Math.abs(dr) + Math.abs(dg) + Math.abs(db)) / 3;
    const keep = Math.exp(-(diff * diff) / sigma2);

    const k = 0.85 * skin * keep;
    const nr = r + dr * k;
    const ng = g + dg * k;
    const nb = b + db * k;

    // cerah lembut (gamma), rona pink hangat, sedikit glow — lewat tabel supaya cepat
    d[i] = TONE_R[nr < 0 ? 0 : nr > 255 ? 255 : nr | 0];
    d[i + 1] = TONE_G[ng < 0 ? 0 : ng > 255 ? 255 : ng | 0];
    d[i + 2] = TONE_B[nb < 0 ? 0 : nb > 255 ? 255 : nb | 0];
  }
}

function toneTable(gamma: number, lift: number, glow: number) {
  const t = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) {
    const c = 255 * Math.pow(v / 255, gamma) + lift;
    t[v] = c + (255 - c) * glow;
  }
  return t;
}
const TONE_R = toneTable(0.9, 4, 0.05);
const TONE_G = toneTable(0.92, 1, 0.04);
const TONE_B = toneTable(0.93, 3, 0.05);

/** Box blur terpisah (horizontal lalu vertikal) pada RGB, O(n) per pass. */
function boxBlur(px: Rgba, w: number, h: number, r: number) {
  const tmp = new Uint8ClampedArray(px.length);
  const size = r * 2 + 1;
  // horizontal: px → tmp
  for (let y = 0; y < h; y++) {
    for (let c = 0; c < 3; c++) {
      const row = y * w;
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += px[(row + Math.min(w - 1, Math.max(0, k))) * 4 + c];
      for (let x = 0; x < w; x++) {
        tmp[(row + x) * 4 + c] = sum / size;
        const out = Math.max(0, x - r);
        const inn = Math.min(w - 1, x + r + 1);
        sum += px[(row + inn) * 4 + c] - px[(row + out) * 4 + c];
      }
    }
  }
  // vertikal: tmp → px
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += tmp[(Math.min(h - 1, Math.max(0, k)) * w + x) * 4 + c];
      for (let y = 0; y < h; y++) {
        px[(y * w + x) * 4 + c] = sum / size;
        const out = Math.max(0, y - r);
        const inn = Math.min(h - 1, y + r + 1);
        sum += tmp[(inn * w + x) * 4 + c] - tmp[(out * w + x) * 4 + c];
      }
    }
  }
}
