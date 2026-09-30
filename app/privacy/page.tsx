import type { Metadata } from 'next';
import { Backdrop } from '@/components/ui/Backdrop';
import { EVENT, RETENTION_LABEL } from '@/config/event';

export const metadata: Metadata = {
  title: `Kebijakan Privasi — ${EVENT.name}`,
};

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL || '';

// Kebijakan privasi — dibutuhkan Google untuk mempublikasikan izin Google Drive (OAuth).
export default function PrivacyPage() {
  return (
    <main className="relative min-h-[100dvh] px-5 py-12">
      <Backdrop />
      <article className="mx-auto max-w-2xl space-y-6 text-[15px] leading-relaxed text-white/75">
        <header>
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-accent-soft">Photobooth</p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-white">Kebijakan Privasi</h1>
          <p className="mt-2 text-sm text-white/45">Berlaku untuk {EVENT.baseUrl || 'situs photobooth ini'}</p>
        </header>

        <Section title="Data yang kami simpan">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Foto hasil photobooth (versi terkompresi, maks. ±500 KB) dan GIF kalau memakai mode GIF, beserta pilihan
              layout, frame, dan filter.
            </li>
            <li>Waktu foto diambil dan apakah foto sudah dicetak.</li>
          </ul>
          <p>
            Kami <b>tidak</b> meminta nama, nomor telepon, atau akun apa pun dari tamu untuk memakai photobooth.
          </p>
        </Section>

        <Section title="Berapa lama foto disimpan">
          <p>
            Foto disimpan di server (Supabase) paling lama <b>{RETENTION_LABEL}</b>, lalu dihapus otomatis.
            Siapa pun yang memegang link/QR foto dapat melihat dan mengunduhnya selama masa itu, jadi jangan bagikan
            link foto yang tidak ingin dilihat orang lain.
          </p>
        </Section>

        <Section title="Simpan ke Google Drive">
          <p>
            Tombol <b>Google Drive</b> bersifat opsional. Jika dipakai, kamu login dengan akun Google dan memberi izin{' '}
            <code className="rounded bg-white/10 px-1.5">drive.file</code>. Izin ini hanya memungkinkan aplikasi
            <b> membuat folder “Photobooth” dan mengunggah foto yang kamu pilih</b> ke Drive kamu. Aplikasi tidak dapat
            melihat, membaca, atau mengubah file lain di Drive kamu.
          </p>
          <p>
            Token akses Google hanya disimpan sementara di browser (hilang saat tab ditutup, maks. ±1 jam) dan tidak
            pernah dikirim ke server kami. Kami tidak menyimpan email, profil, atau data Google kamu. Izin dapat dicabut
            kapan saja di{' '}
            <a className="text-accent-soft underline" href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
              myaccount.google.com/permissions
            </a>
            .
          </p>
          <p>
            Penggunaan data dari Google API mematuhi{' '}
            <a
              className="text-accent-soft underline"
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noreferrer"
            >
              Google API Services User Data Policy
            </a>
            , termasuk ketentuan Limited Use.
          </p>
        </Section>

        <Section title="Pihak ketiga">
          <p>
            Situs ini di-host di Cloudflare Pages, foto disimpan di Supabase, dan huruf dimuat dari Google Fonts. Data
            tidak dijual atau dibagikan untuk iklan.
          </p>
        </Section>

        <Section title="Hapus foto / kontak">
          <p>
            Ingin fotomu dihapus sebelum {RETENTION_LABEL}?{' '}
            {CONTACT ? (
              <>
                Hubungi{' '}
                <a className="text-accent-soft underline" href={`mailto:${CONTACT}`}>
                  {CONTACT}
                </a>{' '}
                dengan menyertakan link fotomu.
              </>
            ) : (
              'Hubungi penyelenggara event dengan menyertakan link fotomu.'
            )}
          </p>
        </Section>

        <p className="pt-4 text-xs text-white/35">
          <a href="/" className="underline">
            Kembali ke photobooth
          </a>
        </p>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded-3xl bg-white/[0.05] p-6 ring-1 ring-white/10">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}
