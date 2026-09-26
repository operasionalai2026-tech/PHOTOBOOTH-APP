// Suara shutter & beep countdown. Default disintesis via Web Audio (tanpa file berlisensi).
// Kalau EVENT.shutterSoundUrl diisi (mis. file free-license dari Pixabay/Mixkit), file itu yang diputar.

import { EVENT } from '@/config/event';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Panggil dari aksi klik pertama supaya audio diizinkan browser (iOS). */
export function unlockAudio() {
  audio();
}

export function playBeep(final = false) {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.value = final ? 1320 : 880;
  gain.gain.setValueAtTime(0.0001, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.18);
  osc.connect(gain).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + 0.2);
}

let shutterAudio: HTMLAudioElement | null = null;

export function playShutter() {
  if (EVENT.shutterSoundUrl) {
    shutterAudio ??= new Audio(EVENT.shutterSoundUrl);
    shutterAudio.currentTime = 0;
    void shutterAudio.play().catch(() => synthShutter());
    return;
  }
  synthShutter();
}

/** Dua "klik" noise pendek meniru shutter kamera mekanik. */
function synthShutter() {
  const ac = audio();
  if (!ac) return;
  const click = (at: number, dur: number, gainVal: number) => {
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2500;
    filter.Q.value = 0.8;
    const g = ac.createGain();
    g.gain.value = gainVal;
    src.connect(filter).connect(g).connect(ac.destination);
    src.start(ac.currentTime + at);
  };
  click(0, 0.05, 0.9);
  click(0.09, 0.07, 0.6);
}
