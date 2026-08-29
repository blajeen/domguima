import Link from "next/link";
import { social, whatsapp } from "@/config/site";
import { getCatalogCategories } from "@/lib/catalog/queries";
import { loadPublicStoreSettings } from "@/lib/catalog/database";
import { genericMessage, whatsappLink } from "@/lib/services/whatsapp";
import { CartButton } from "./CartButton";
import { CategoryMenu } from "./CategoryMenu";
import { Logo } from "./Logo";
import { MobileMenu } from "./MobileMenu";
import { SearchBar } from "./SearchBar";

export async function Header() {
  const [allCategories, settings] = await Promise.all([getCatalogCategories(), loadPublicStoreSettings()]);
  const mainMenuCategories = allCategories.filter((category) => category.inMainMenu).sort((a, b) => a.order - b.order);
  return (
    <header data-storefront-chrome className="sticky top-0 z-50 shadow-sm">
      {/* Faixa de avisos — só no desktop, para não roubar altura no celular. */}
      <div className="hidden bg-brand-950 text-brand-100 lg:block">
        <div className="site-shell flex items-center justify-between gap-4 py-1 text-[11px]">
          <p className="flex items-center gap-1.5">
            <span aria-hidden>🚚</span> Enviamos para todo o Brasil
          </p>
          <div className="flex items-center gap-4">
            <a
              href={settings.shopeeUrl || social.shopee}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-gold-300"
            >
              Nossa loja na Shopee
            </a>
            <a
              href={settings.instagramUrl || social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-gold-300"
            >
              Instagram
            </a>
            <a
              href={whatsappLink(genericMessage, settings.whatsappNumber)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-gold-300 transition-colors hover:text-gold-200"
            >
              WhatsApp {settings.whatsappDisplay || whatsapp.display}
            </a>
          </div>
        </div>
      </div>

      {/* Barra principal */}
      <div className="bg-brand-900">
        <div className="site-shell">
          <div className="flex items-center gap-2 py-2.5 sm:gap-3 lg:grid lg:grid-cols-[minmax(190px,.75fr)_minmax(440px,900px)_minmax(210px,.75fr)] lg:gap-5">
            <MobileMenu categories={mainMenuCategories} />
            <Logo className="lg:justify-self-start" />

            {/* Centralizada e limitada para não dominar o cabeçalho em telas largas. */}
            <SearchBar className="hidden w-full min-w-0 lg:block" />

            <div className="ml-auto flex items-center gap-1 sm:gap-2 lg:ml-0 lg:justify-self-end">
              <Link
                href="/conta"
                aria-label="Minha conta"
                className="hidden items-center gap-2 rounded-lg px-2.5 py-2 text-white transition-colors hover:bg-white/10 sm:flex"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
                  <circle cx="12" cy="8.5" r="3.6" stroke="currentColor" strokeWidth="1.7" />
                  <path
                    d="M4.8 20c.6-3.7 3.6-5.8 7.2-5.8s6.6 2.1 7.2 5.8"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="hidden whitespace-nowrap text-sm font-semibold lg:inline">Minha conta</span>
              </Link>
              <CartButton />
            </div>
          </div>

          {/* No celular a busca ganha a linha inteira, logo abaixo da logo. */}
          <div className="pb-2.5 lg:hidden">
            <SearchBar />
          </div>
        </div>
      </div>

      <CategoryMenu categories={mainMenuCategories} />
    </header>
  );
}
