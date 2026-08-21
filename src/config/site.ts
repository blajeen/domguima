/**
 * Configuração central da Dom Guima.
 *
 * PROVENIÊNCIA DOS DADOS — leia antes de alterar:
 *   VERIFICADO  = coletado das fontes oficiais da loja em 19/08/2026 (ver `verifiedAt`).
 *   CONFIG      = precisa de confirmação/credencial do lojista antes do go-live.
 *
 * Nada aqui é inventado. Campos ainda não confirmados ficam `null` e a UI
 * simplesmente não os exibe — nunca preenchemos com número fictício.
 */

export const VERIFIED_AT = "2026-08-19";
export const GOOGLE_VERIFIED_AT = "2026-08-20";

const GOOGLE_PROFILE_URL =
  "https://www.google.com/maps/place/Dom+Guima+-+Emp%C3%B3rio+das+Ofertas/@-18.9220717,-48.2636901,12z/data=!4m6!3m5!1s0x94a44589c5d59787:0x20e24a8d38f6fc7e!8m2!3d-18.9220717!4d-48.2636901!16s%2Fg%2F11qyqp_45l";

export const site = {
  name: "Dom Guima",
  /** VERIFICADO — nome da conta na Shopee. */
  legalName: "DOM GUIMA SHOP",
  /** VERIFICADO — título público da loja na Shopee. */
  tagline: "Empório das Ofertas",
  shortDescription:
    "Eletrônicos, eletrodomésticos, climatização e decoração com preço justo e entrega para todo o Brasil.",
  /** VERIFICADO — descrição escrita pela própria loja na Shopee. */
  longDescription:
    "Somos especialistas em promoções e em uma ampla linha de produtos, incluindo eletrônicos, eletrodomésticos, climatização e decoração. Nosso objetivo é oferecer qualidade, variedade e preços acessíveis, garantindo praticidade e economia para nossos clientes.",
  /** CONFIG — troque pelo domínio definitivo antes de publicar. */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.domguima.com.br",
  locale: "pt-BR",
  currency: "BRL",
} as const;

/** Dados cadastrais informados pelo proprietário em 20/08/2026. */
export const company = {
  legalName: "Juliano Guimaraes",
  tradeName: "Dom Guima",
  cnpj: "36.720.898/0001-10",
  stateRegistration: "003697299.00-33",
  openedAt: "18/03/2020",
  address: "Avenida Francisco Ribeiro, 1805",
  district: "Santa Mônica",
  cityState: "Uberlândia/MG",
  postalCode: "38408-186",
  companySize: "Micro Empresa",
  legalNature: "Empresário (Individual)",
  isMei: false,
  isSimplesNacional: true,
  simplesNacionalSince: "01/01/2025",
  shareCapital: "R$ 105.000,00",
  establishmentType: "Matriz",
  registrationStatus: "Ativa",
  registrationStatusSince: "18/03/2020",
} as const;

/**
 * VERIFICADO — número publicado pela própria loja na bio do Instagram
 * Confirmado pelo lojista em 20/08/2026; alterar aqui atualiza o site inteiro.
 */
export const whatsapp = {
  /** Formato internacional, somente dígitos. */
  number: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "553498748425",
  display: "(34) 9874-8425",
} as const;

export const social = {
  /** VERIFICADO */
  instagram: "https://www.instagram.com/domguima/",
  instagramHandle: "@domguima",
  /** VERIFICADO */
  shopee: "https://shopee.com.br/domguima",
  /** VERIFICADO — perfil público da Dom Guima no Google Maps. */
  google: process.env.NEXT_PUBLIC_GOOGLE_PROFILE_URL ?? GOOGLE_PROFILE_URL,
} as const;

/**
 * VERIFICADO manualmente no perfil público do Google em 20/08/2026.
 * Sem API: sempre exibir a data da consulta para não sugerir atualização ao vivo.
 */
export const googleStats = {
  ratingAverage: 5,
  ratingCount: 405,
  verifiedAt: GOOGLE_VERIFIED_AT,
  profileUrl: process.env.NEXT_PUBLIC_GOOGLE_PROFILE_URL ?? GOOGLE_PROFILE_URL,
} as const;

/**
 * VERIFICADO — métricas públicas da loja na Shopee, lidas da API oficial
 * em 19/08/2026. São um retrato daquele dia: use `verifiedAt` ao exibir.
 * NÃO edite manualmente para "melhorar" os números.
 */
export const shopeeStats = {
  shopId: 772602809,
  ratingAverage: 4.88,
  ratingCount: 3239, // 3154 positivas + 55 neutras + 30 negativas
  followers: 1850,
  itemCount: 79,
  responseRate: 93,
  /** Loja aberta em maio de 2022 (ctime 1652657074). */
  openedAt: "2022-05",
  location: "Minas Gerais",
  verifiedAt: VERIFIED_AT,
} as const;

/** VERIFICADO — contagem lida do perfil público em 19/08/2026. */
export const instagramStats = {
  followers: 7624,
  verifiedAt: VERIFIED_AT,
} as const;

/**
 * CONFIG — atendimento. Preencha com os horários reais do lojista.
 * `null` esconde a linha em vez de exibir horário inventado.
 */
export const support = {
  hours: null as string | null,
  email: null as string | null,
} as const;

/** Regras comerciais. CONFIG — confirmar com o lojista. */
export const commerce = {
  /** Nº máximo de parcelas exibido nos cards/página de produto. */
  maxInstallments: 3,
  /** Parcela mínima em centavos (não parcela abaixo disso). */
  minInstallmentCents: 3000,
  /** Desconto à vista no Pix, em %. 0 desativa o selo. */
  pixDiscountPercent: 5,
} as const;
