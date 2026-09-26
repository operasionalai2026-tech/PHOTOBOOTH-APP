// Akses kamera via getUserMedia. Hanya jalan di HTTPS atau localhost.

export type CameraError = 'unsupported' | 'denied' | 'notfound' | 'unknown';

export async function startCamera(video: HTMLVideoElement, deviceId?: string): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw cameraError('unsupported');
  const constraints: MediaStreamConstraints = {
    audio: false,
    video: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }),
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  };
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (e) {
    const name = (e as DOMException)?.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') throw cameraError('denied');
    if (name === 'NotFoundError' || name === 'OverconstrainedError') throw cameraError('notfound');
    throw cameraError('unknown');
  }
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play().catch(() => undefined);
  if (!video.videoWidth) {
    await new Promise<void>((resolve) => {
      video.onloadedmetadata = () => resolve();
      setTimeout(resolve, 2000);
    });
  }
  return stream;
}

export function stopCamera(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop());
}

export async function listCameras(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === 'videoinput');
}

/** Ambil satu frame dari video dalam resolusi penuh kamera. */
export function captureFrame(video: HTMLVideoElement, mirror: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext('2d')!;
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function cameraErrorMessage(code: CameraError): string {
  switch (code) {
    case 'unsupported':
      return 'Browser ini tidak mendukung kamera. Pastikan halaman dibuka lewat HTTPS.';
    case 'denied':
      return 'Izin kamera ditolak. Izinkan akses kamera di pengaturan browser lalu muat ulang.';
    case 'notfound':
      return 'Kamera tidak ditemukan. Cek kabel/kamera lalu coba lagi.';
    default:
      return 'Kamera tidak bisa dibuka. Tutup aplikasi lain yang memakai kamera lalu coba lagi.';
  }
}

function cameraError(code: CameraError) {
  return Object.assign(new Error(code), { code });
}
