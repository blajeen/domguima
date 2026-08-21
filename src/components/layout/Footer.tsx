import Link from "next/link";
import { company, shopeeStats, site, social, support, whatsapp } from "@/config/site";
import { getCatalogCategories } from "@/lib/catalog/queries";
import { loadPublicStoreSettings } from "@/lib/catalog/database";
import { genericMessage, whatsappLink } from "@/lib/services/whatsapp";
import { Logo } from "./Logo";

export async function Footer() {
  const year = new Date().getFullYear();
  const [allCategories, settings] = await Promise.all([getCatalogCategories(), loadPublicStoreSettings()]);
  const mainMenuCategories = allCategories.filter((category) => category.inMainMenu).sort((a, b) => a.order - b.order);

  return (
    <footer data-storefront-chrome className="mt-10 bg-brand-950 text-brand-100">
      <div className="site-shell py-6 sm:py-7">
        <div className="grid grid-cols-2 gap-x-5 gap-y-5 lg:grid-cols-5 lg:gap-8">
          <div className="col-span-2 lg:col-span-1">
            <Logo />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-400">
              {site.shortDescription}
            </p>
            {/* Dado real: localização declarada na loja oficial. */}
            <p className="mt-2 text-xs text-ink-500">
              Loja online · {shopeeStats.location}
            </p>
          </div>

          <FooterColumn title="Dom Guima">
            <FooterLink href="/institucional/sobre-nos">Sobre nós</FooterLink>
            <FooterLink href="/institucional/contato">Contato</FooterLink>
            <FooterLink href="/ofertas">Ofertas</FooterLink>
            <FooterLink href="/mais-vendidos">Mais vendidos</FooterLink>
          </FooterColumn>

          <FooterColumn title="Atendimento">
            <FooterExternal href={whatsappLink(genericMessage, settings.whatsappNumber)}>
              WhatsApp {settings.whatsappDisplay || whatsapp.display}
            </FooterExternal>
            <FooterExternal href={settings.instagramUrl || social.instagram}>
              Instagram {social.instagramHandle}
            </FooterExternal>
            {/* Só mostramos horário/e-mail quando forem informados de verdade. */}
            {(settings.supportHours || support.hours) && <li className="text-sm text-ink-400">{settings.supportHours || support.hours}</li>}
            {(settings.supportEmail || support.email) && (
              <FooterExternal href={`mailto:${settings.supportEmail || support.email}`}>
                {settings.supportEmail || support.email}
              </FooterExternal>
            )}
          </FooterColumn>

          <FooterColumn title="Compras">
            {mainMenuCategories.slice(0, 5).map((category) => (
              <FooterLink
                key={category.id}
                href={`/categoria/${category.slug}`}
              >
                {category.name}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn title="Ajuda">
            <FooterLink href="/institucional/frete-e-entrega">
              Frete e entrega
            </FooterLink>
            <FooterLink href="/institucional/formas-de-pagamento">
              Formas de pagamento
            </FooterLink>
            <FooterLink href="/institucional/trocas-e-devolucoes">
              Trocas e devoluções
            </FooterLink>
            <FooterLink href="/institucional/politica-de-privacidade">
              Política de privacidade
            </FooterLink>
            <FooterLink href="/institucional/termos-de-uso">
              Termos de uso
            </FooterLink>
          </FooterColumn>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2.5 border-t border-ink-800 pt-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">
            Também estamos em
          </span>
          <SocialPill href={settings.shopeeUrl || social.shopee}>Shopee</SocialPill>
          <SocialPill href={settings.instagramUrl || social.instagram}>Instagram</SocialPill>
          <SocialPill href={settings.googleUrl || social.google}>Google</SocialPill>
        </div>

        <div className="mt-4 border-t border-ink-800 pt-4 text-xs leading-5 text-ink-500">
          <p className="font-semibold text-ink-400">
            Copyright © {company.openedAt.slice(-4)}-{year} {company.tradeName.toUpperCase()}. Todos os direitos reservados.
          </p>
          <p className="mt-1 max-w-5xl">
            {company.tradeName.toUpperCase()}, com sede em {company.address}, {company.district},
            {company.cityState}, CEP {company.postalCode},
            inscrito no CNPJ/MF sob o nº {settings.cnpj || company.cnpj} e Inscrição Estadual MG nº {company.stateRegistration}.
          </p>
          <div className="mt-1 flex flex-wrap gap-x-3">
            <span>Imagens meramente ilustrativas. Preços e estoque sujeitos a alteração sem aviso prévio.</span>
            <span>
              Site produzido por{" "}
              <a
                href="https://blajeen.com.br/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-ink-400 underline decoration-ink-700 underline-offset-4 transition-colors hover:text-gold-300"
              >
                Blajeen Labs
              </a>
              .
            </span>
            <Link
              href="/painel/login"
              aria-label="Acesso administrativo"
              title="Acesso administrativo"
              className="inline-flex size-5 items-center justify-center rounded text-ink-500 opacity-35 transition-all hover:bg-ink-800 hover:text-gold-300 hover:opacity-100 focus-visible:opacity-100"
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
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-white">
        {title}
      </h3>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-sm text-ink-400 transition-colors hover:text-gold-300"
      >
        {children}
      </Link>
    </li>
  );
}

function FooterExternal({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-ink-400 transition-colors hover:text-gold-300"
      >
        {children}
      </a>
    </li>
  );
}

function SocialPill({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-full border border-ink-700 px-3 py-1 text-xs font-semibold text-ink-300 transition-colors hover:border-gold-500 hover:text-gold-300"
    >
      {children}
    </a>
  );
}
