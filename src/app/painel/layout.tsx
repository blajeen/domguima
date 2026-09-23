import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./admin.css";

// O painel mantém a Inter: a planilha de estoque e as colunas `nowrap` foram
// medidas com ela. Carregada só aqui, o preload vale só nas rotas do painel.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Painel", template: "%s | Painel Dom Guima" },
  robots: { index: false, follow: false },
};

export default function PanelRootLayout({ children }: { children: React.ReactNode }) {
  return <div className={`admin-app ${inter.variable}`}>{children}</div>;
}
