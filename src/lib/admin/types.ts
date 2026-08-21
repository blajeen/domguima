export type ActionState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string[]>;
};

export type ProductStatus = "draft" | "active" | "archived";

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
