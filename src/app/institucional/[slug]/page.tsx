import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { site, whatsapp } from "@/config/site";
import {
  getInstitutionalPage,
  institutionalPages,
} from "@/lib/content/institucional";
import { genericMessage, whatsappLink } from "@/lib/services/whatsapp";

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
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
          {page.title}
        </h1>

        {page.intro && (
          <p className="mt-4 text-[15px] leading-relaxed text-ink-600">
            {page.intro}
          </p>
        )}

        <div className="mt-8 space-y-8">
          {page.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-extrabold tracking-tight text-ink-900">
                {section.heading}
              </h2>
              {section.paragraphs?.map((paragraph, i) => (
                <p
                  key={i}
                  className="mt-2.5 text-[15px] leading-relaxed text-ink-600"
                >
                  {paragraph}
                </p>
              ))}
              {section.list && (
                <ul className="mt-3 space-y-2">
                  {section.list.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2.5 text-[15px] leading-relaxed text-ink-600"
                    >
                      <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </article>

      <div className="mt-12 rounded-card border border-ink-100 bg-white p-6 text-center shadow-card">
        <p className="text-base font-bold text-ink-900">Ficou alguma dúvida?</p>
        <p className="mt-1 text-sm text-ink-600">
          Fale com a gente — respondemos rápido.
        </p>
        <a
          href={whatsappLink(genericMessage)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block rounded-xl bg-brand-700 px-6 py-3 text-sm font-extrabold text-white transition-colors hover:bg-brand-600"
        >
          WhatsApp {whatsapp.display}
        </a>
      </div>

      <nav aria-label="Outras páginas" className="mt-10">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-400">
          Veja também
        </p>
        <ul className="flex flex-wrap gap-2">
          {institutionalPages
            .filter((other) => other.slug !== page.slug)
            .map((other) => (
              <li key={other.slug}>
                <Link
                  href={`/institucional/${other.slug}`}
                  className="block rounded-full border border-ink-200 px-4 py-2 text-sm font-medium text-ink-600 transition-colors hover:border-gold-400 hover:bg-gold-50 hover:text-gold-800"
                >
                  {other.title}
                </Link>
              </li>
            ))}
        </ul>
      </nav>
    </div>
  );
}
