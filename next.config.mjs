/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: tidak ada API route / server. Hasil build ada di folder `out/`.
  output: 'export',
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
