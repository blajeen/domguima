import "server-only";

import { googleStats, shopeeStats, social } from "@/config/site";
import { loadPublicStoreSettings } from "./database";

export interface CanalReputacao {
  canal: "Google" | "Shopee";
  /** Como a frase liga a nota ao canal: "no Google", "na Shopee". */
  preposicao: "no" | "na";
  nota: number;
  avaliacoes: number;
  /** Dia da consulta pública (AAAA-MM-DD): a nota nunca aparece sem ele. */
  consultadoEm: string;
  href: string;
}

/**
 * Notas da loja no Google e na Shopee, as mesmas na home e na página de
 * produto. O Google pode ser atualizado no painel (Configurações); sem valor
 * lá, vale o retrato datado de config/site. A Shopee só tem o retrato.
 */
export async function reputacaoDaLoja(): Promise<{
  google: CanalReputacao;
  shopee: CanalReputacao;
}> {
  const settings = await loadPublicStoreSettings();
  return {
    google: {
      canal: "Google",
      preposicao: "no",
      nota: Number(settings.googleRating.replace(",", ".")) || googleStats.ratingAverage,
      avaliacoes: Number(settings.googleRatingCount) || googleStats.ratingCount,
      consultadoEm: settings.googleVerifiedAt || googleStats.verifiedAt,
      href: settings.googleUrl || googleStats.profileUrl,
    },
    shopee: {
      canal: "Shopee",
      preposicao: "na",
      nota: shopeeStats.ratingAverage,
      avaliacoes: shopeeStats.ratingCount,
      consultadoEm: shopeeStats.verifiedAt,
      href: settings.shopeeUrl || social.shopee,
    },
  };
}
