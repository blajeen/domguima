import { shopeeStats, site, social, whatsapp } from "@/config/site";

export function absoluteUrl(path = "/"): string {
  return new URL(path, site.url).toString();
}

/**
 * JSON-LD da organização. Só declara o que é verificável: nome, logo, canais
 * oficiais e o telefone que a própria loja publica.
 */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    "@id": `${site.url}#organization`,
    name: site.legalName,
    alternateName: site.name,
    url: site.url,
    logo: absoluteUrl("/brand/logo-dom-guima.png"),
    description: site.longDescription,
    areaServed: { "@type": "Country", name: "Brasil" },
    address: {
      "@type": "PostalAddress",
      addressRegion: shopeeStats.location,
      addressCountry: "BR",
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      telephone: `+${whatsapp.number}`,
      availableLanguage: ["Portuguese"],
    },
    sameAs: [social.instagram, social.shopee, social.google].filter(
      (url): url is string => Boolean(url),
    ),
  };
}

/** Habilita a caixa de busca do site no Google. */
export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${site.url}#website`,
    url: site.url,
    name: site.name,
    inLanguage: "pt-BR",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${site.url}/busca?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
