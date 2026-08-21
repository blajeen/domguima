import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { WhatsAppFloat } from "@/components/layout/WhatsAppFloat";
import { site } from "@/config/site";
import { CartProvider } from "@/lib/store/cart";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/utils/seo";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s | ${site.name}`,
  },
  description: site.shortDescription,
  applicationName: site.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: site.url,
    siteName: site.legalName,
    title: `${site.name} — ${site.tagline}`,
    description: site.shortDescription,
    images: [
      {
        // JPEG, não PNG: a arte não tem transparência e o PNG original pesava
        // 1,4 MB. O WhatsApp costuma desistir de prévias grandes, e a prévia do
        // link é justamente onde a loja mais vende. Ao trocar a arte, mantenha
        // 1200x630 e o peso abaixo de ~300 KB (veja scripts/optimize-assets.mjs).
        url: "/brand/social-dom-guima.jpg",
        width: 1200,
        height: 630,
        alt: `${site.legalName} — Empório das Ofertas`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — ${site.tagline}`,
    description: site.shortDescription,
    images: ["/brand/social-dom-guima.jpg"],
  },
  // Os ícones vêm da convenção de arquivos do Next (src/app/icon.png e
  // apple-icon.png). Não declare `icons` aqui: as duas formas juntas emitem
  // links duplicados e o navegador escolhe o errado.
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#101216",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="antialiased">
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={websiteJsonLd()} />

        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-ink-900 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Pular para o conteúdo
        </a>

        <CartProvider>
          <Header />
          <main id="conteudo">{children}</main>
          <Footer />
          <CartDrawer />
          <WhatsAppFloat />
        </CartProvider>
      </body>
    </html>
  );
}
