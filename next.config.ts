import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Permite enviar um lote de imagens do painel (cada arquivo continua
    // limitado a 4 MB na ação e o lote a 40 MB).
    serverActions: { bodySizeLimit: "45mb" },
  },
  images: {
    // AVIF/WebP automáticos: o Next serve o formato mais leve que o navegador aceita.
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // Fotos do Instagram, quando a Graph API estiver configurada.
      { protocol: "https", hostname: "scontent.cdninstagram.com" },
      { protocol: "https", hostname: "**.cdninstagram.com" },
      { protocol: "https", hostname: "**.fbcdn.net" },
      // Fotos de autor das avaliações do Google.
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "places.googleapis.com" },
      // CDN da Shopee, caso o catálogo seja importado com URLs remotas.
      { protocol: "https", hostname: "down-br.img.susercontent.com" },
      { protocol: "https", hostname: "**.susercontent.com" },
      // Fotos enviadas pelo painel administrativo e armazenadas no Supabase Storage.
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "usiwdhadqfrqigbvvlsw.supabase.co" },
    ],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
