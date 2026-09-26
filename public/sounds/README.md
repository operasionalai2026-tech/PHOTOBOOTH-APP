# Suara (opsional)

Secara default suara countdown & shutter **disintesis via Web Audio** (lihat `lib/sound.ts`),
jadi folder ini boleh kosong.

Kalau ingin suara shutter asli:

1. Unduh file shutter dengan lisensi gratis (mis. Pixabay Content License atau Mixkit Free License).
2. Simpan sebagai `public/sounds/shutter.mp3`.
3. Isi `shutterSoundUrl: '/sounds/shutter.mp3'` di `config/event.ts`.

Simpan juga link sumber & lisensinya di file ini untuk arsip.
