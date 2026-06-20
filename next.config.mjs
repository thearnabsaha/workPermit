/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep heavy/native server-only deps out of the bundler so the Node runtime
  // loads them directly (sharp native binary, pdfjs/tesseract WASM + workers).
  experimental: {
    serverComponentsExternalPackages: ["sharp", "pdfjs-dist", "tesseract.js"],
  },
};
export default nextConfig;
