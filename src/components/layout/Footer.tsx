import Link from "next/link";
import { company, site, social, support, whatsapp } from "@/config/site";
import { getCatalogCategories } from "@/lib/catalog/queries";
import { loadPublicStoreSettings } from "@/lib/catalog/database";
import { genericMessage } from "@/lib/services/whatsapp";
import { WhatsAppChooser } from "./WhatsAppChooser";
import { Logo } from "./Logo";

// Links do rodapé: ink-300 no grafite-950 (8,3:1). 28 px de altura com mouse;
// na tela de toque, 44 px, como o resto do cromo, para o polegar não pegar o
// link vizinho.
const LINK =
  "inline-flex min-h-7 items-center text-sm text-ink-300 transition-colors duration-(--duracao-toque) hover:text-ouro-claro pointer-coarse:min-h-11";

/**
 * Rodapé: grafite-950, com o letreiro da marca, o endereço de Uberlândia e o
 * CNPJ (dados cadastrais de site.ts) e os canais da loja. Títulos das colunas
 * pelo peso, sem caixa alta. Foco em ouro-claro: o ouro padrão some no grafite.
 */
export async function Footer() {
  const year = new Date().getFullYear();
  const [allCategories, settings] = await Promise.all([getCatalogCategories(), loadPublicStoreSettings()]);
  const mainMenuCategories = allCategories.filter((category) => category.inMainMenu).sort((a, b) => a.order - b.order);
  const horario = settings.supportHours || support.hours;
  const email = settings.supportEmail || support.email;

  return (
    <footer
      data-storefront-chrome
      className="mt-10 bg-grafite-950 text-ink-300 [--cor-foco:var(--color-ouro-claro)]"
    >
      <div className="site-shell py-10 sm:py-12">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))] lg:gap-10">
          <div className="col-span-2 lg:col-span-1">
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed">{site.shortDescription}</p>
            <address className="mt-4 text-sm not-italic leading-relaxed">
              {company.address}
              <br />
              {company.district}, {company.cityState}
              <br />
              CEP {company.postalCode}
            </address>
            <p className="mt-2 text-sm tabular-nums">CNPJ {settings.cnpj || company.cnpj}</p>
          </div>

          <Coluna titulo="Dom Guima">
            <FooterLink href="/institucional/sobre-nos">Sobre nós</FooterLink>
            <FooterLink href="/institucional/contato">Contato</FooterLink>
            <FooterLink href="/ofertas">Ofertas</FooterLink>
            <FooterLink href="/mais-vendidos">Mais vendidos</FooterLink>
          </Coluna>

          <Coluna titulo="Atendimento">
            <li>
              {/* Botão (abre a escolha do atendente): alinhado à esquerda como os
                  links, e o número não quebra no meio. */}
              <WhatsAppChooser message={genericMessage} className={`${LINK} flex-wrap gap-x-1 text-left`}>
                WhatsApp
                <span className="whitespace-nowrap tabular-nums">{settings.whatsappDisplay || whatsapp.display}</span>
              </WhatsAppChooser>
            </li>
            <FooterExternal href={settings.instagramUrl || social.instagram}>
              Instagram {social.instagramHandle}
            </FooterExternal>
            <FooterExternal href={settings.shopeeUrl || social.shopee}>
              Nossa loja na Shopee
            </FooterExternal>
            <FooterExternal href={settings.googleUrl || social.google}>
              Perfil no Google
            </FooterExternal>
            {/* Só mostramos horário/e-mail quando forem informados de verdade. */}
            {horario && <li className="pt-1 text-sm">{horario}</li>}
            {email && <FooterExternal href={`mailto:${email}`}>{email}</FooterExternal>}
          </Coluna>

          <Coluna titulo="Compras">
            {mainMenuCategories.slice(0, 5).map((category) => (
              <FooterLink key={category.id} href={`/categoria/${category.slug}`}>
                {category.name}
              </FooterLink>
            ))}
          </Coluna>

          <Coluna titulo="Ajuda">
            <FooterLink href="/conta">Meus pedidos</FooterLink>
            <FooterLink href="/institucional/frete-e-entrega">Frete e entrega</FooterLink>
            <FooterLink href="/institucional/formas-de-pagamento">Formas de pagamento</FooterLink>
            <FooterLink href="/institucional/trocas-e-devolucoes">Trocas e devoluções</FooterLink>
            <FooterLink href="/institucional/politica-de-privacidade">Política de privacidade</FooterLink>
            <FooterLink href="/institucional/termos-de-uso">Termos de uso</FooterLink>
          </Coluna>
        </div>

        {/* ink-400 no grafite-950: 4,5:1 no texto de 12 px. */}
        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs leading-5 text-ink-400 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
          <div className="max-w-4xl space-y-1">
            <p>
              © {company.openedAt.slice(-4)}–{year} {company.tradeName}. Todos os direitos reservados.
              Inscrição Estadual MG nº {company.stateRegistration}.
            </p>
            <p>Imagens meramente ilustrativas. Preços e estoque sujeitos a alteração sem aviso prévio.</p>
          </div>
          <p className="flex shrink-0 items-center gap-3">
            <span>
              Site produzido por{" "}
              <a
                href="https://blajeen.com.br/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-ink-300 underline decoration-ink-600 underline-offset-4 transition-colors duration-(--duracao-toque) hover:text-ouro-claro"
              >
                Blajeen Labs
              </a>
              .
            </span>
            <Link
              href="/painel/login"
              aria-label="Acesso administrativo"
              title="Acesso administrativo"
              // Discreto, mas alcançável pelo polegar: 44 px na tela de toque,
              // como os links acima; o desenho continua do mesmo tamanho.
              className="inline-flex size-6 items-center justify-center rounded-control text-ink-500 opacity-35 transition-[opacity,background-color,color] duration-(--duracao-toque) hover:bg-white/10 hover:text-ouro-claro hover:opacity-100 focus-visible:opacity-100 pointer-coarse:size-11"
            >
              <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
                className="size-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5.5 17V3.8c0-.44.36-.8.8-.8h7.2c.55 0 1 .45 1 1v13" />
                <path d="M3.5 17h13M8 3v14" />
                <path d="M10.5 10h.01" strokeWidth="2" />
              </svg>
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

/** Coluna de links: título pelo peso, em papel, sem caixa alta. */
function Coluna({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-papel">{titulo}</h2>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className={LINK}>
        {children}
      </Link>
    </li>
  );
}

function FooterExternal({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <a href={href} target="_blank" rel="noopener noreferrer" className={LINK}>
        {children}
      </a>
    </li>
  );
}
