# Frames

Semua frame digambar langsung dengan Canvas 2D di `config/frames.ts`
(Polaroid, Instagram, Strip Pita, Strip Klasik) — tidak ada aset gambar berlisensi.

Setiap gaya di `config/layouts.ts` menunjuk satu frame lewat `frameId`.
Menambah frame baru: tambahkan objek ke array `FRAMES` dengan fungsi `background()`
(digambar sebelum foto) dan `overlay()` (setelah foto, termasuk teks & dekorasi),
lalu buat gaya baru di `LAYOUTS` yang memakainya.
Kalau ingin memakai file PNG buatan sendiri, taruh di folder ini lalu gambar dengan
`ctx.drawImage()` di dalam `overlay()`.
