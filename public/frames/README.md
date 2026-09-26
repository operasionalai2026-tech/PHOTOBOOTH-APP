# Frames

Semua frame digambar langsung dengan Canvas 2D di `config/frames.ts`
(Classic, Noir Gold, Confetti, Retro 70s, Bloom) — tidak ada aset berlisensi.

Menambah frame baru: tambahkan objek ke array `FRAMES` dengan fungsi `background()`
(digambar sebelum foto) dan `overlay()` (digambar setelah foto, termasuk teks footer).
Kalau ingin memakai file SVG/PNG buatan sendiri, taruh di folder ini lalu gambar dengan
`ctx.drawImage()` di dalam `overlay()`.
