'use client';

// Admin: login magic link (Supabase Auth) + statistik kuota + galeri.

import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { Spinner } from '@/components/booth/SaveOptions';
import { Backdrop } from '@/components/ui/Backdrop';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { EVENT } from '@/config/event';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

export default function AdminPage() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return setSession(null);
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <main className="relative min-h-[100dvh]">
      <Backdrop />
      {!isSupabaseConfigured ? (
        <Centered>
          <h1 className="text-2xl font-semibold">Supabase belum diatur</h1>
          <p className="mt-2 text-white/60">
            Isi <code className="rounded bg-white/10 px-1.5">NEXT_PUBLIC_SUPABASE_URL</code> dan{' '}
            <code className="rounded bg-white/10 px-1.5">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, lalu build ulang.
          </p>
        </Centered>
      ) : session === undefined ? (
        <Centered>
          <Spinner className="h-8 w-8" />
        </Centered>
      ) : session ? (
        <AdminDashboard session={session} />
      ) : (
        <Login />
      )}
    </main>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;
    setStatus('sending');
    const redirect = `${EVENT.baseUrl || window.location.origin}/admin`;
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      // shouldCreateUser: false → hanya akun admin yang sudah diundang yang bisa login.
      options: { emailRedirectTo: redirect, shouldCreateUser: false },
    });
    if (error) {
      setStatus('error');
      setError(loginErrorMessage(error));
    } else setStatus('sent');
  };

  return (
    <Centered>
      <div className="w-full rounded-3xl bg-white/[0.06] p-8 text-left ring-1 ring-white/10 backdrop-blur">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-accent-soft">Admin</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">{EVENT.name}</h1>
        {status === 'sent' ? (
          <div className="mt-6">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-200">
              <Icon name="check" />
            </div>
            <p className="mt-4 font-semibold">Cek email kamu</p>
            <p className="mt-1 text-sm text-white/60">
              Link login dikirim ke <b>{email}</b>. Buka link itu di perangkat ini.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
            <label className="text-sm text-white/70" htmlFor="email">
              Email admin
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@contoh.com"
              className="h-12 rounded-2xl bg-white/10 px-4 ring-1 ring-white/10 placeholder:text-white/30 focus:outline-none focus:ring-accent"
            />
            {status === 'error' && <p className="text-sm text-red-300">{error}</p>}
            <Button type="submit" disabled={status === 'sending'} className="mt-2">
              {status === 'sending' ? <Spinner /> : null} Kirim magic link
            </Button>
          </form>
        )}
      </div>
    </Centered>
  );
}

/** Terjemahkan error Supabase Auth ke pesan yang jelas untuk operator. */
function loginErrorMessage(error: { message: string; status?: number; code?: string }): string {
  const code = error.code ?? '';
  const msg = error.message.toLowerCase();
  // Email tidak ada di daftar user (shouldCreateUser: false).
  if (code === 'otp_disabled' || msg.includes('signups not allowed for otp')) {
    return 'Email ini bukan admin terdaftar. Minta admin mengundang email ini di Supabase.';
  }
  // User ada tapi belum menerima undangan: Supabase menganggapnya pendaftaran baru, padahal sign up dimatikan.
  if (code === 'signup_disabled' || msg.includes('signups not allowed')) {
    return 'Akun admin ini belum aktif. Buka email undangan dari Supabase dan klik link-nya dulu, lalu coba lagi.';
  }
  if (code === 'over_email_send_rate_limit' || error.status === 429) {
    return 'Terlalu banyak permintaan email. Tunggu beberapa menit lalu coba lagi (layanan email bawaan Supabase dibatasi per jam).';
  }
  return error.message;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-4 text-center">{children}</div>;
}
