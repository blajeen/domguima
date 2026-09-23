import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { social, whatsapp } from "@/config/site";
import { getCatalogCategories } from "@/lib/catalog/queries";
import { loadPublicStoreSettings } from "@/lib/catalog/database";
import { genericMessage } from "@/lib/services/whatsapp";
import { WhatsAppChooser } from "./WhatsAppChooser";
import { CartButton } from "./CartButton";
import { CategoryMenu } from "./CategoryMenu";
import { Logo } from "./Logo";
import { MobileMenu } from "./MobileMenu";
import { SearchBar } from "./SearchBar";

// Link de texto da faixa de avisos. Papel, e não cinza: sobre o banner a
// faixa vira vidro, e texto pequeno cinza cairia abaixo de 4,5:1.
const avisoLink =
  "inline-flex min-h-7 items-center transition-colors duration-(--duracao-toque) hover:text-ouro-claro";

/**
 * Header da loja, fixo no topo. Todas as linhas têm altura fixa: a soma é o
 * --header-h do globals.css, que os elementos sticky e a barra de compra usam.
 *
 * A parte escura (avisos, logo, busca, pedidos e carrinho) é grafite sólido
 * com o fio de ouro embaixo. Na home, enquanto o banner passa por baixo dela,
 * o `data-over-media` (ligado por MidiaDoTopo) troca o grafite pelo vidro
 * escuro. O vidro mora numa camada de fundo à parte, e não no contêiner:
 * backdrop-filter num ancestral viraria o bloco de contenção dos filhos
 * `fixed` e prenderia qualquer diálogo aberto daqui dentro do header. Com uma
 * gaveta ou a escolha do atendente aberta (`data-modal` no <html>, ligado por
 * useDialogoModal), o header volta ao grafite: coberto pela tinta, o vidro
 * dele seria desfoque sobre desfoque e passaria do limite de 3 superfícies.
 *
 * Abaixo da parte escura, só no desktop, a faixa branca das categorias.
 */
export async function Header() {
  const [allCategories, settings] = await Promise.all([getCatalogCategories(), loadPublicStoreSettings()]);
  const mainMenuCategories = allCategories.filter((category) => category.inMainMenu).sort((a, b) => a.order - b.order);
  return (
    <header data-storefront-chrome data-cabecalho className="sticky top-0 z-50">
      <div
        data-cabecalho-escuro
        // Foco em ouro-claro: o ouro do foco padrão fica em 3,2:1 no grafite.
        className="relative border-b border-ouro text-papel [--cor-foco:var(--color-ouro-claro)]"
      >
        <div
          aria-hidden
          // Tinta .78 no vidro: com uma foto branca atrás, o letreiro
          // ouro-claro fica em 4,9:1 e o texto papel em 7,9:1. A troca é
          // seca, sem transição: o desfoque nunca anima.
          className="absolute inset-0 -z-10 bg-grafite-900 [--vidro-tinta:0.78] in-data-over-media:not-in-data-modal:glass-dark"
        />

        {/* Faixa de avisos: só no desktop, para não roubar altura no celular. */}
        <div className="hidden h-7 border-b border-white/10 lg:block">
          <div className="site-shell flex h-full items-center justify-between gap-4 text-xs">
            <p className="flex items-center gap-1.5">
              <Icon name="caminhao" size={16} />
              Enviamos para todo o Brasil
            </p>
            <div className="flex items-center gap-5">
              <a
                href={settings.shopeeUrl || social.shopee}
                target="_blank"
                rel="noopener noreferrer"
                className={avisoLink}
              >
                Nossa loja na Shopee
              </a>
              <a
                href={settings.instagramUrl || social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className={avisoLink}
              >
                Instagram
              </a>
              <WhatsAppChooser
                message={genericMessage}
                className={`${avisoLink} font-semibold text-ouro-claro hover:text-papel`}
              >
                WhatsApp {settings.whatsappDisplay || whatsapp.display}
              </WhatsAppChooser>
            </div>
          </div>
        </div>

        <div className="site-shell">
          {/* No desktop, as laterais dividem a sobra por igual (e nunca ficam
              menores que o conteúdo): a busca fica no centro da tela. */}
          <div className="flex h-14 items-center gap-1 lg:grid lg:h-16 lg:grid-cols-[minmax(max-content,1fr)_minmax(28rem,56rem)_minmax(max-content,1fr)] lg:gap-6">
            <MobileMenu categories={mainMenuCategories} />
            <Logo className="ml-1 lg:ml-0 lg:justify-self-start" />

            <SearchBar className="hidden w-full min-w-0 lg:block" />

            <div className="ml-auto flex items-center gap-1 lg:ml-0 lg:justify-self-end">
              {/* Não há login na loja: a página é o acompanhamento de pedidos.
                  Por isso a caixa (a mesma da página /conta), e não o boneco,
                  que entre sm e lg, sem o texto, leria como "entrar". */}
              <Link
                href="/conta"
                aria-label="Meus pedidos"
                className="hidden h-11 min-w-11 items-center justify-center gap-2 rounded-control px-2.5 transition-colors duration-(--duracao-toque) hover:bg-white/10 sm:flex"
              >
                <Icon name="caixa" />
                <span className="hidden whitespace-nowrap text-sm font-semibold lg:inline">Meus pedidos</span>
              </Link>
              <CartButton />
            </div>
          </div>

          {/* No celular a busca ganha a linha inteira, logo abaixo da logo. */}
          <div className="h-14 pb-3 lg:hidden">
            <SearchBar />
          </div>
        </div>
      </div>

      <CategoryMenu categories={mainMenuCategories} />
    </header>
  );
}
