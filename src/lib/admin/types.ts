import type { VendaLojistas } from "./lojistas";

export type ActionState = {
  ok?: boolean;
  message?: string;
  /** Deu certo, mas com uma ressalva que o operador precisa ver como alerta, não como sucesso. */
  warning?: string;
  errors?: Record<string, string[]>;
  orderId?: string;
  orderNumber?: string;
};

export type ProductStatus = "draft" | "active" | "archived";

export type OrderStatus = "pending" | "completed" | "cancelled";
export type OrderPaymentMethod = "pix" | "credit_card" | "debit_card" | "boleto" | "cash_on_delivery" | "to_confirm";
export type OrderDeliveryMethod = "uberlandia_delivery" | "shipping_to_confirm";

export const ORDER_PAYMENT_METHOD_LABELS: Record<OrderPaymentMethod, string> = {
  pix: "Pix",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  boleto: "Boleto bancário",
  cash_on_delivery: "Pagar no ato da entrega",
  to_confirm: "Pagamento a combinar",
};

/**
 * ONDE a venda aconteceu. Diferente da origem (`TrafficSource`), que diz como o
 * cliente chegou: um cliente que achou a loja no Instagram (origem) pode fechar
 * pelo WhatsApp (canal).
 *
 * Pedido gravado antes do controle de trafego fica com `""` = nao informado.
 */
export type OrderChannel = "site" | "whatsapp" | "store" | "shopee" | "mercado_livre" | "magalu" | "other";

export const ORDER_CHANNEL_LABELS: Record<OrderChannel, string> = {
  site: "Site",
  whatsapp: "WhatsApp",
  store: "Loja física",
  shopee: "Shopee",
  mercado_livre: "Mercado Livre",
  magalu: "Magalu",
  other: "Outro canal",
};

/**
 * COMO o cliente chegou ate a loja. E o que o controle de trafego soma por
 * origem. `""` = nao informado (pedido antigo, lancamento do grupo sem origem).
 */
export type TrafficSource =
  | "direct"
  | "instagram"
  | "facebook"
  | "whatsapp"
  | "google"
  | "shopee"
  | "mercado_livre"
  | "magalu"
  | "referral"
  | "store"
  | "other";

export const TRAFFIC_SOURCE_LABELS: Record<TrafficSource, string> = {
  direct: "Direto",
  instagram: "Instagram",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  google: "Google",
  shopee: "Shopee",
  mercado_livre: "Mercado Livre",
  magalu: "Magalu",
  referral: "Indicação",
  store: "Loja física",
  other: "Outra origem",
};

/** Rotulo de canal/origem vazio: dado anterior ao controle de trafego ou que ninguem informou. */
export const ORIGIN_NOT_INFORMED_LABEL = "Não informado";

/**
 * Canais que o operador escolhe ao lancar um pedido no painel. Site e
 * marketplaces ficam de fora: o pedido do site nasce no checkout e o de
 * marketplace entra pelo lancamento em lote, cada um com o canal certo.
 */
export const PANEL_ORDER_CHANNELS = ["whatsapp", "store", "other"] as const satisfies readonly OrderChannel[];

/** Origens que o operador escolhe no painel (pedido novo e atendimento manual). */
export const PANEL_TRAFFIC_SOURCES = ["direct", "instagram", "facebook", "google", "whatsapp", "referral", "store", "other"] as const satisfies readonly TrafficSource[];

/**
 * De onde o cliente veio, como o navegador dele registrou (cookie e
 * armazenamento local proprios da loja, sem ferramenta de terceiros).
 *
 * Os campos sem prefixo sao o PRIMEIRO contato rastreavel; os `last_*` guardam
 * a campanha mais recente quando o cliente voltou por outro link depois. Todos
 * sao texto curto (ate 200 caracteres) porque chegam de um cookie que qualquer
 * pessoa pode editar.
 */
export interface OrderAttribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  /** So o dominio do site que trouxe o cliente ("l.instagram.com"), sem caminho nem busca. */
  referrer?: string;
  /** Primeira pagina vista nesta origem, sem a query string. */
  landing_path?: string;
  /** "1" quando o link veio de anuncio do Facebook/Instagram. O identificador em si nao e guardado. */
  fbclid?: string;
  /** "1" quando o link veio de anuncio do Google. O identificador em si nao e guardado. */
  gclid?: string;
  first_seen_at?: string;
  last_utm_source?: string;
  last_utm_medium?: string;
  last_utm_campaign?: string;
  last_seen_at?: string;
}

/**
 * Como um atendimento novo vindo do site escolhe o atendente.
 *
 * `customer_choice` e o comportamento historico: o cliente escolhe no dialogo
 * "Com quem voce quer falar?". Nos modos automaticos a escolha e feita dentro
 * da RPC `create_lead_v1`, com trava no banco: `round_robin` entrega para quem
 * recebeu ha mais tempo; `least_busy` para quem tem menos atendimentos em
 * etapa aberta (`OPEN_LEAD_STAGES`), com o rodizio como desempate.
 */
export type LeadDistributionMode = "customer_choice" | "round_robin" | "least_busy";

export const LEAD_DISTRIBUTION_MODE_LABELS: Record<LeadDistributionMode, string> = {
  customer_choice: "Cliente escolhe o atendente",
  round_robin: "Rodízio entre os atendentes",
  least_busy: "Atendente com menos atendimentos em aberto",
};

/**
 * Por onde o atendimento comecou. O valor e o mesmo que vai para
 * `leads.kind`; o rotulo e o que o painel mostra na etiqueta da linha.
 */
export type LeadKind =
  | "whatsapp_generic"
  | "whatsapp_product"
  | "whatsapp_cart"
  | "quick_checkout"
  | "site_checkout"
  | "manual";

export const LEAD_KIND_LABELS: Record<LeadKind, string> = {
  whatsapp_generic: "WhatsApp do site",
  whatsapp_product: "Dúvida de produto",
  whatsapp_cart: "Carrinho pelo WhatsApp",
  quick_checkout: "Pedido rápido",
  site_checkout: "Pedido do site",
  manual: "Lançado no painel",
};

/**
 * Etapa do ATENDIMENTO, antes da venda. Nao tem relacao com `OrderStatus`, que
 * dirige a baixa de estoque e continua com tres valores: um atendimento pode
 * ser "ganho" sem nunca ter virado pedido no painel.
 */
export type LeadStage = "new" | "in_progress" | "quote_sent" | "awaiting_payment" | "won" | "lost";

/** As etapas na ordem do funil — a mesma dos selects e do mini-funil do painel. */
export const LEAD_STAGES = ["new", "in_progress", "quote_sent", "awaiting_payment", "won", "lost"] as const satisfies readonly LeadStage[];

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: "Novo",
  in_progress: "Em atendimento",
  quote_sent: "Orçamento enviado",
  awaiting_payment: "Aguardando pagamento",
  won: "Ganho",
  lost: "Perdido",
};

/** Etapas em que o atendimento ainda esta vivo (conta como carga do atendente). */
export const OPEN_LEAD_STAGES: readonly LeadStage[] = ["new", "in_progress", "quote_sent", "awaiting_payment"];

export type LeadLostReason = "price" | "out_of_stock" | "delivery" | "no_reply" | "bought_elsewhere" | "other";

export const LEAD_LOST_REASONS = ["price", "out_of_stock", "delivery", "no_reply", "bought_elsewhere", "other"] as const satisfies readonly LeadLostReason[];

export const LEAD_LOST_REASON_LABELS: Record<LeadLostReason, string> = {
  price: "Preço",
  out_of_stock: "Sem estoque",
  delivery: "Entrega ou frete",
  no_reply: "Cliente não respondeu",
  bought_elsewhere: "Comprou em outro lugar",
  other: "Outro motivo",
};

/**
 * Em que ponto da relacao com a loja o cliente esta, pelo historico de
 * compras FINALIZADAS. As regras (quantas compras, quanto gasto, quantos dias)
 * moram em customers.ts, como constantes no topo do arquivo.
 */
export type CustomerSegment = "new" | "returning" | "vip" | "inactive";

export const CUSTOMER_SEGMENTS = ["new", "returning", "vip", "inactive"] as const satisfies readonly CustomerSegment[];

export const CUSTOMER_SEGMENT_LABELS: Record<CustomerSegment, string> = {
  new: "Cliente novo",
  returning: "Recorrente",
  vip: "VIP",
  inactive: "Inativo",
};

/**
 * Um cliente reconhecido pelos pedidos: todos os pedidos que compartilham
 * telefone ou CPF/CNPJ (ver `buildCustomerIndex`). A loja nao tem cadastro de
 * cliente; isto e calculado a cada leitura a partir dos pedidos.
 */
export interface CustomerSummary {
  /** Chave canonica: telefone sem o DDI quando existe, senao CPF/CNPJ em digitos. */
  key: string;
  /** Todos os telefones e CPF/CNPJ do cliente, inclusive os antigos (a chave e um deles). */
  identities: string[];
  /** Nome do pedido mais recente que trouxe nome. */
  name: string;
  /** Telefone em digitos sem o 55 (vazio quando nenhum pedido trouxe). */
  phone: string;
  /** CPF/CNPJ em digitos (vazio quando nenhum pedido trouxe). */
  cpf: string;
  /** Compras finalizadas. Pedido pendente ou cancelado nao conta. */
  ordersCount: number;
  totalCents: number;
  firstOrderAt: string;
  lastOrderAt: string;
  /** Dias, no fuso da loja, desde a ultima compra finalizada. */
  daysSinceLastOrder: number;
  /** Intervalo medio entre compras, em dias. `null` com uma compra so. */
  avgDaysBetween: number | null;
  segment: CustomerSegment;
  /** Atendimentos em etapa aberta com o mesmo telefone/CPF. */
  openLeads: number;
  /** Pediu para nao receber o recontato: fica fora das sugestoes e sem o botao de mensagem pronta. */
  contactOptOut: boolean;
  lastOrderNumber: string;
  /** Produtos da ultima compra, na ordem do pedido. */
  lastProducts: string[];
}

/** O retrato dos clientes e o que ficou de fora dele. */
export interface CustomerBook {
  customers: CustomerSummary[];
  /**
   * Compras finalizadas sem telefone nem CPF/CNPJ (lancamento do grupo, que so
   * traz o primeiro nome): nao ha como saber de quem sao, entao ficam fora do
   * agrupamento e sao contadas a parte, para o numero nao parecer sumido.
   */
  unidentifiedOrders: number;
  unidentifiedTotalCents: number;
}

/** Resposta do "este telefone/CPF já comprou N vezes" do Novo pedido. */
export interface CustomerPurchaseLookup {
  /** Compras finalizadas do cliente dono do telefone digitado. */
  phonePurchases: number;
  /** Compras finalizadas do cliente dono do CPF/CNPJ digitado. */
  documentPurchases: number;
  /** Número de um pedido do cliente, para o link do histórico (nunca o telefone ou o CPF na URL). */
  reference: string | null;
}

/** Item do carrinho congelado no atendimento, quando o contato trouxe produtos. */
export interface LeadItemSnapshot {
  product_id: string;
  product_name: string;
  quantity: number;
}

/** Espelho 1:1 de uma linha de `public.leads`. */
export interface LeadRecord {
  id: string;
  kind: LeadKind;
  stage: LeadStage;
  /** `null` = fila livre: ninguem assumiu o atendimento ainda. */
  seller_id: string | null;
  assigned_at: string | null;
  /** username do painel, "customer" ou "auto:<modo>". */
  assigned_by: string | null;
  customer_name: string;
  /** So digitos quando conhecido. */
  customer_phone: string;
  /** Telefone ou CPF em digitos: e por aqui que o cliente recorrente e reconhecido. */
  customer_key: string | null;
  product_id: string | null;
  items: LeadItemSnapshot[];
  message: string;
  page_path: string;
  /** Um `TrafficSource`; fica como texto porque a coluna e texto livre e o valor antigo tem de continuar legivel. */
  source: string;
  attribution: OrderAttribution;
  visitor_id: string | null;
  /** `sales_orders.id` quando o atendimento virou pedido. */
  order_id: string | null;
  lost_reason: LeadLostReason | null;
  notes: string;
  closed_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Quem atende — a MESMA pessoa no site, no pedido e no login do painel.
 *
 * Antes eram tres listas soltas (whatsappContacts no site, sellers no painel,
 * admin_users no login) com ids diferentes para o mesmo dono. O `id` daqui e o
 * que vai em `sales_orders.seller_id` e em `admin_users.seller_id`, por isso
 * nunca muda depois de criado: renomear apagaria o vinculo com os pedidos.
 */
export interface SellerRecord {
  id: string;
  name: string;
  /** Funcao exibida no site abaixo do nome: "Dono da loja", "Vendedor". */
  role_label: string;
  /**
   * WhatsApp proprio, so digitos com DDI (5534...). `null` = usa o numero
   * principal da loja (`StoreSettings.whatsappNumber`), que o painel ja edita.
   */
  whatsapp_number: string | null;
  /** Como o numero aparece para o cliente: "(34) 99864-8425". Vazio = formatado a partir do numero. */
  whatsapp_display: string;
  /**
   * Aparece para o cliente escolher e entra na distribuicao automatica.
   * Equivale ao "Receber novas conversas" de CRMs de WhatsApp: desligado, a
   * pessoa continua podendo receber transferencias e lancar pedidos.
   */
  receives_leads: boolean;
  active: boolean;
  /** Ordem de exibicao no site e nos selects do painel. */
  sort_order: number;
}

export interface ProductOperationalMeta {
  ncm: string;
  cost_cents: number | null;
  model: string;
  gtin: string;
}

export interface ProductAssistTemplate {
  id: string;
  name: string;
  sku: string;
  brand: string;
  category_id: string;
  category_name: string;
  description: string;
  tags: string[];
  specifications: Array<{ label: string; value: string }>;
  variants: Array<{ name: string; options: string[] }>;
  shipping: AdminProductRow["shipping"];
  seller_note: string;
}

export interface OrderCustomerSnapshot {
  name: string;
  cpf: string;
  email?: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

export interface SalesOrderItem {
  product_id: string;
  product_name: string;
  sku: string;
  variant?: string | null;
  /** Opcao vendida, quando o produto tem estoque por variacao. */
  variant_id?: string | null;
  quantity: number;
  list_unit_price_cents: number;
  unit_price_cents: number;
  discount_cents: number;
  line_total_cents: number;
  commission_unit_cents: number;
  commission_total_cents: number;
}

export interface SalesOrderRecord {
  id: string;
  number: string;
  request_id: string;
  status: OrderStatus;
  seller_id: string;
  seller_name: string;
  payment_method?: OrderPaymentMethod;
  delivery_method?: OrderDeliveryMethod;
  customer: OrderCustomerSnapshot;
  items: SalesOrderItem[];
  total_units: number;
  gross_total_cents: number;
  discount_total_cents: number;
  total_cents: number;
  commission_total_cents: number;
  notes: string;
  created_by: string;
  created_at: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
  /** Onde a venda aconteceu. `""` = nao informado (pedido anterior ao controle de trafego). */
  channel: OrderChannel | "";
  /** Como o cliente chegou. `""` = nao informado. */
  source: TrafficSource | "";
  attribution: OrderAttribution;
  /** Atendimento (`leads.id`) que originou o pedido, quando existe. */
  lead_id: string | null;
  /** Telefone (sem DDI) ou CPF/CNPJ em digitos: reconhece o cliente que volta. Ver customers.ts. */
  customer_key: string | null;
  /** Mesmo `domguima_visitante` dos cliques de WhatsApp: junta pedido e conversas do mesmo navegador. */
  visitor_id: string | null;
}

/**
 * `seller_id` do pedido do site que ainda nao tem atendente — a "fila livre"
 * dos pedidos. E um valor de texto (e nao null) porque a coluna e `not null`
 * desde o livro-razao; o painel mostra "Fila livre" quando encontra este valor.
 */
export const UNASSIGNED_ORDER_SELLER_ID = "pending";
/** Rotulo gravado junto com `UNASSIGNED_ORDER_SELLER_ID` (o mesmo de sempre, sem acento). */
export const UNASSIGNED_ORDER_SELLER_NAME = "Aguardando definicao";

export interface AdminOperationsState {
  sellers: SellerRecord[];
  orders: SalesOrderRecord[];
  product_meta: Record<string, ProductOperationalMeta>;
  /**
   * Telefones (sem o 55) e CPF/CNPJ, em digitos, de quem pediu para nao
   * receber o recontato pos-compra — a recusa que a politica de privacidade
   * promete atender. Todas as identidades do cliente entram: quem trocou de
   * numero continua fora das sugestoes. Mora no JSONB privado de
   * store_settings (sem acesso de anon/authenticated), como os atendentes.
   */
  contact_opt_outs: string[];
  /**
   * Venda para lojistas (desconto, condições e preços especiais), só da conta
   * principal. Mora aqui, no JSONB privado de store_settings, e não em
   * `settings`: preço de atacado não pode chegar perto do que a loja lê.
   */
  lojistas: VendaLojistas;
}

export interface AdminProductRow {
  id: string;
  external_id: number | null;
  name: string;
  slug: string;
  description: string;
  price_cents: number;
  old_price_cents: number | null;
  category_id: string;
  brand: string | null;
  sku: string;
  stock: number;
  low_stock_threshold: number;
  status: ProductStatus;
  variants: Array<{ name: string; options: string[] }>;
  specifications: Array<{ label: string; value: string }>;
  shipping: {
    weight: number;
    dimensions: { length: number; width: number; height: number };
    origin: string;
  };
  rating: number | null;
  review_count: number | null;
  sold_count: number | null;
  is_featured: boolean;
  is_best_seller: boolean;
  is_offer: boolean;
  is_exclusive: boolean;
  tags: string[];
  data_source: "shopee-verified" | "loja-verified" | "placeholder";
  source_url: string | null;
  /**
   * Parcelado digitado à mão (legado, da importação inicial). A loja NÃO lê
   * mais esta coluna: calcula o parcelado pelo preço com a tabela da
   * maquininha (`lib/catalog/parcelamento.ts`). Mantida só para não apagar
   * dado do banco.
   */
  card_installment: { count: number; value: number } | null;
  seller_note: string | null;
  published_at: string | null;
  last_stock_entry_at: string | null;
  last_sale_at: string | null;
  hero_enabled: boolean;
  hero_priority: number;
  created_at: string;
  updated_at: string;
  product_images?: AdminProductImage[];
  /** Nome do eixo escolhido pelo lojista: "Cor", "Voltagem", "Tamanho". */
  variant_axis?: string | null;
  /**
   * Opcoes com preco, estoque e SKU proprios. Quando existe pelo menos uma,
   * `stock` do produto e a SOMA delas — mantida pelo banco.
   */
  product_variants?: AdminProductVariant[];
  categories?: { name: string } | null;
}

/** Safe, compact payload used by the interactive inventory sheet. */
/**
 * Uma linha da planilha de estoque.
 *
 * `id` e a chave da LINHA. Produto com variacao vira uma linha por opcao
 * (Preto, Cinza, Branco), cada uma com `variant_id` e o proprio saldo — e o
 * unico jeito de o lojista ver e acertar o estoque de cada cor sem sair da
 * planilha. Produto sem variacao continua uma linha so, com variant_id nulo.
 */
export interface InventorySheetProduct {
  id: string;
  product_id: string;
  variant_id: string | null;
  variant_label: string | null;
  name: string;
  sku: string;
  price_cents: number;
  old_price_cents: number | null;
  stock: number;
  low_stock_threshold: number;
  status: ProductStatus;
  category_name: string;
  image_src: string | null;
  image_alt: string;
  updated_at: string;
}

export interface InventorySheetMovement {
  id: string;
  product_id: string;
  product_name: string;
  quantity_delta: number;
  stock_before: number;
  stock_after: number;
  reason: string;
  note: string | null;
  created_at: string;
}

/**
 * Uma opcao de variacao com preco, estoque e SKU proprios.
 *
 * Antes disso, "variants" era so um rotulo no produto e a loja acabou com tres
 * cadastros separados para as tres cores do mesmo suporte.
 */
export interface AdminProductVariant {
  id: string;
  product_id: string;
  /** Rotulo da opcao: "Preto", "220V", "GG". */
  label: string;
  sku: string;
  price_cents: number;
  stock: number;
  sort_order: number;
  active: boolean;
  /**
   * URL da foto desta opcao, escolhida entre as imagens do produto.
   * Guardamos a URL e nao o id da imagem porque replace_catalog_state apaga e
   * reinsere product_images a cada salvamento — um vinculo por id se perderia.
   */
  image_src?: string | null;
}

export interface AdminProductImage {
  id: string;
  product_id: string;
  src: string;
  storage_path: string | null;
  alt: string;
  sort_order: number;
  is_primary: boolean;
}

export interface AdminCategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  sort_order: number;
  in_main_menu: boolean;
  active: boolean;
}

export interface StoreSettings {
  catalogEnabled: boolean;
  supportEmail: string;
  supportHours: string;
  cnpj: string;
  fiscalAddress: string;
  whatsappDisplay: string;
  whatsappNumber: string;
  instagramUrl: string;
  shopeeUrl: string;
  googleUrl: string;
  googleRating: string;
  googleRatingCount: string;
  googleVerifiedAt: string;
  /**
   * Taxas da maquininha por quantidade de parcelas (1x, 2x, ...), em %,
   * separadas por ";". O site calcula o parcelado de cada produto com elas
   * (`lib/catalog/parcelamento.ts`); leia sempre com `lerParcelamento()`.
   */
  cardFeeTable: string;
  /** Até quantas vezes a chamada junto do preço anuncia ("em até 12x"). Ver `lerParcelamento()`. */
  cardInstallmentsHeadline: string;
  /**
   * Um `LeadDistributionMode`. Fica como string porque StoreSettings inteiro e
   * gravado como texto pelo formulario; `normalizeLeadDistributionMode()`
   * devolve o valor tipado com fallback para "customer_choice".
   */
  leadDistributionMode: string;
}
