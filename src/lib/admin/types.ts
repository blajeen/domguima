export type ActionState = {
  ok?: boolean;
  message?: string;
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
 * Como um atendimento novo vindo do site escolhe o atendente.
 *
 * `customer_choice` e o comportamento historico: o cliente escolhe no dialogo
 * "Com quem voce quer falar?". Os modos automaticos existem na configuracao
 * desde ja para o painel; a distribuicao em si e feita pelo fluxo de
 * atendimentos.
 */
export type LeadDistributionMode = "customer_choice" | "round_robin" | "least_busy";

export const LEAD_DISTRIBUTION_MODE_LABELS: Record<LeadDistributionMode, string> = {
  customer_choice: "Cliente escolhe o atendente",
  round_robin: "Rodízio entre os atendentes",
  least_busy: "Atendente com menos atendimentos abertos",
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

export const LEAD_LOST_REASON_LABELS: Record<LeadLostReason, string> = {
  price: "Preço",
  out_of_stock: "Sem estoque",
  delivery: "Entrega ou frete",
  no_reply: "Cliente não respondeu",
  bought_elsewhere: "Comprou em outro lugar",
  other: "Outro motivo",
};

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
  source: string;
  attribution: Record<string, string>;
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
}

export interface AdminOperationsState {
  sellers: SellerRecord[];
  orders: SalesOrderRecord[];
  product_meta: Record<string, ProductOperationalMeta>;
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
  installment_count: number | null;
  installment_value_cents: number | null;
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
  pixDiscountPercent: string;
  maxInstallments: string;
  /**
   * Um `LeadDistributionMode`. Fica como string porque StoreSettings inteiro e
   * gravado como texto pelo formulario; `normalizeLeadDistributionMode()`
   * devolve o valor tipado com fallback para "customer_choice".
   */
  leadDistributionMode: string;
}
