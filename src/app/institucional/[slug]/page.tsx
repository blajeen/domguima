import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { buttonStyles, chipStyles } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { site, whatsapp } from "@/config/site";
import {
  getInstitutionalPage,
  institutionalPages,
} from "@/lib/content/institucional";
import { genericMessage } from "@/lib/services/whatsapp";
import { WhatsAppChooser } from "@/components/layout/WhatsAppChooser";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return institutionalPages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getInstitutionalPage(slug);
  if (!page) return { title: "Página não encontrada" };

  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: `/institucional/${page.slug}` },
    openGraph: {
      title: `${page.title} | ${site.name}`,
      description: page.description,
      url: `/institucional/${page.slug}`,
    },
  };
}

export default async function InstitutionalPage({ params }: PageProps) {
  const { slug } = await params;
  const page = getInstitutionalPage(slug);
  if (!page) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Breadcrumbs
        items={[{ label: "Início", href: "/" }, { label: page.title }]}
        siteUrl={site.url}
      />

      <article className="mt-5">
        <h1 className="text-balance text-titulo-lg font-bold text-grafite-900 sm:text-4xl">
          {page.title}
        </h1>

        {page.intro && (
          <p className="mt-4 max-w-prose text-lg leading-relaxed text-ink-600">
            {page.intro}
          </p>
        )}

        <div className="mt-10 space-y-9">
          {page.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-balance text-titulo font-bold text-grafite-900">
                {section.heading}
              </h2>
              {section.paragraphs?.map((paragraph, i) => (
                <p
                  key={i}
                  className="mt-3 max-w-prose text-base leading-relaxed text-ink-600"
                >
                  {paragraph}
                </p>
              ))}
              {section.list && (
                <ul className="mt-3 max-w-prose space-y-2.5">
                  {section.list.map((item) => (
                    <li
                      key={item}
                      className="flex gap-3 text-base leading-relaxed text-ink-600"
                    >
                      {/* Traço de ouro no lugar de marcador, como nos
                          destaques da página de produto. */}
                      <span aria-hidden className="mt-[0.8em] h-px w-3 shrink-0 bg-ouro" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </article>

      {/* Mesmo bloco e mesmo botão verde do /conta: ação de WhatsApp é verde. */}
      <div className="mt-12 rounded-card border border-fio bg-white p-6 text-center">
        <p className="text-base font-bold text-grafite-900">Ficou alguma dúvida?</p>
        <p className="mt-1 text-sm text-ink-600">
          Fale com a gente. Respondemos rápido.
        </p>
        <WhatsAppChooser
          message={genericMessage}
          className={buttonStyles({ variant: "whatsapp", size: "lg", className: "mt-4" })}
        >
          <Icon name="whatsapp" />
          Falar com a Dom Guima · {whatsapp.display}
        </WhatsAppChooser>
      </div>

      <nav aria-label="Outras páginas" className="mt-10">
        <h2 className="mb-3 text-sm font-semibold text-grafite-900">Veja também</h2>
        <ul className="flex flex-wrap gap-2">
          {institutionalPages
            .filter((other) => other.slug !== page.slug)
            .map((other) => (
              <li key={other.slug}>
                <Link href={`/institucional/${other.slug}`} className={chipStyles}>
                  {other.title}
                </Link>
              </li>
            ))}
        </ul>
      </nav>
    </div>
  );
}
