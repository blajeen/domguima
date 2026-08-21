import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: { default: "Painel", template: "%s | Painel Dom Guima" },
  robots: { index: false, follow: false },
};

export default function PanelRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-app">{children}</div>;
}
