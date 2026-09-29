# Frames

Setiap gaya foto memakai satu gambar desain di folder ini. **Jendela foto harus transparan**;
foto tamu digambar di bawah gambar ini, jadi bentuk jendela bebas (kotak, bergelombang, dll.)
dan hiasan yang menimpa foto (mis. selotip) tetap tampil di atas foto.

| File | Gaya | Jendela | Cetak |
|---|---|---|---|
| `remisya-bubble.webp` | Bingkai Unik | 4 | 8x10 in |
| `remisya-grid.webp` | Grid | 4 | 8x10 in |
| `remisya-single.webp` | Satu Foto | 1 | 8x10 in |
| `remisya-strip-collage.webp` | Strip Kolase | 3 | 2x6 in |
| `remisya-strip.webp` | Strip | 3 | 2x6 in |
| `remisya-strip-keffiyeh.webp` | Strip Keffiyeh | 3 | 2x6 in |

## Menambah / mengganti frame

1. Buat desain dengan rasio sesuai ukuran cetak (8x10 → 4:5, strip 2x6 → 1:3). Resolusi ideal
   = ukuran cetak × 300 dpi (8x10 = 2400×3000 px, strip = 600×1800 px).
2. Ekspor sebagai **PNG/WebP transparan**: area foto dihapus (transparan), bukan diisi abu-abu.
3. Taruh file di folder ini, lalu tambahkan gaya di `config/layouts.ts`:
   `src`, ukuran gambar (`artW`, `artH`), dan kotak tiap jendela `[x, y, lebar, tinggi]`
   dalam piksel gambar tersebut (urut atas → bawah, kiri → kanan).
