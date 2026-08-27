export type ActionState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  orderId?: string;
  orderNumber?: string;
};

export type ProductStatus = "draft" | "active" | "archived";

export type OrderStatus = "completed" | "cancelled";

export interface SellerRecord {
  id: string;
  name: string;
  active: boolean;
}

export interface ProductOperationalMeta {
  ncm: string;
  cost_cents: number | null;
}

export interface OrderCustomerSnapshot {
  name: string;
  cpf: string;
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
  categories?: { name: string } | null;
}

/** Safe, compact payload used by the interactive inventory sheet. */
export interface InventorySheetProduct {
  id: string;
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
}
