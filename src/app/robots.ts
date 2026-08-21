import type { MetadataRoute } from "next";
import { site } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Páginas de sessão e de resultado não devem entrar no índice.
      disallow: [
        "/api/",
        "/carrinho",
        "/checkout",
        "/conta",
        "/pedido-enviado",
        "/busca",
      ],
    },
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
