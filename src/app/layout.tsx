import type { Metadata, Viewport } from "next";
import { Archivo, Bodoni_Moda, Libre_Franklin } from "next/font/google";
import { Suspense } from "react";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { CapturaOrigem } from "@/components/layout/CapturaOrigem";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { WhatsAppFloat } from "@/components/layout/WhatsAppFloat";
import { site } from "@/config/site";
import { loadParcelamento, loadPublicAttendants } from "@/lib/catalog/database";
import { AttendantsProvider } from "@/lib/store/attendants";
import { CartProvider } from "@/lib/store/cart";
import { ParcelamentoProvider } from "@/lib/store/parcelamento";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/utils/seo";
import "./globals.css";

// Interface e texto da loja. O painel continua na Inter (painel/layout.tsx).
const libreFranklin = Libre_Franklin({
  subsets: ["latin"],
  variable: "--font-libre-franklin",
  display: "swap",
});

// Só o letreiro da marca e raros momentos de marca. Sem preload, mesmo com o
// letreiro no header de toda página: os ~46 KB não disputam com a foto
// principal. Até o arquivo chegar, o letreiro sai na serifada de reserva que o
// next/font ajusta às medidas da Bodoni (troca o desenho, quase sem mexer no
// layout).
// Medir no F6 se vale ligar o preload.
const bodoniModa = Bodoni_Moda({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-bodoni-moda",
  display: "swap",
  preload: false,
});

// Números de preço. O eixo de largura (wdth) dá o condensado do preço de
// cartaz. Com preload: o PriceTag está no card, na página de produto, na barra
// fixa, no carrinho, no checkout e no banner, quase sempre acima da dobra. A
// reserva que o next/font ajusta (Arial) tem a largura normal, não a
// condensada, então sem a fonte o preço entra bem mais largo e estreita quando
// ela chega; no card estreito o −X% quebra de linha e volta, e isso conta no
// CLS. O custo é o arquivo latin (~90 KB) disputando banda com a foto
// principal: conferir o LCP no preview antes do merge.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
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
  // O grafite-900 do header: a barra do navegador no celular continua o topo.
  themeColor: "#1c1d21",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Uma leitura so para todos os botoes de WhatsApp do site e para a tabela da
  // maquininha da gaveta do carrinho (produto, carrinho e checkouts leem a
  // tabela no proprio segmento; ver loadParcelamento). Header, rodape e
  // flutuante ja leem o catalogo; readCatalogState deduplica no cache de 5s.
  const [attendants, parcelamento] = await Promise.all([loadPublicAttendants(), loadParcelamento()]);
  return (
    <html
      lang="pt-BR"
      className={`${libreFranklin.variable} ${bodoniModa.variable} ${archivo.variable}`}
    >
      <body className="antialiased">
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={websiteJsonLd()} />

        {/* Origem da visita (controle de tráfego próprio, sem terceiros). O
            Suspense é obrigatório: o componente lê a query string com
            useSearchParams, e sem a fronteira as páginas estáticas deixariam
            de ser pré-renderizadas. */}
        <Suspense fallback={null}>
          <CapturaOrigem />
        </Suspense>

        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-control focus:bg-grafite-900 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-papel focus-visible:outline-ouro-claro"
        >
          Pular para o conteúdo
        </a>

        <AttendantsProvider value={attendants}>
          <ParcelamentoProvider value={parcelamento}>
            <CartProvider>
              <Header />
              <main id="conteudo">{children}</main>
              <Footer />
              <CartDrawer />
              <WhatsAppFloat />
            </CartProvider>
          </ParcelamentoProvider>
        </AttendantsProvider>
      </body>
    </html>
  );
}
