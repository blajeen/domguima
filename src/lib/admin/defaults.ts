import { categories as fallbackCategories } from "@/lib/catalog/categories";
import { products as fallbackProducts } from "@/lib/catalog/products";
import type { AdminCategoryRow, AdminProductRow, StoreSettings } from "./types";

export const defaultStoreSettings: StoreSettings = {
  catalogEnabled: false,
  supportEmail: "",
  supportHours: "",
  cnpj: "36.720.898/0001-10",
  fiscalAddress: "",
  whatsappDisplay: "+55 34 9874-8425",
  whatsappNumber: "553498748425",
  instagramUrl: "https://www.instagram.com/domguima/",
  shopeeUrl: "https://shopee.com.br/domguima",
  googleUrl: "",
  googleRating: "5,0",
  googleRatingCount: "405",
  googleVerifiedAt: "2026-08-20",
  pixDiscountPercent: "5",
  maxInstallments: "3",
};

export function initialProducts(): AdminProductRow[] { return fallbackProducts.map(fallbackProductRow); }

export function initialCategories(): AdminCategoryRow[] {
  return fallbackCategories.map((category) => ({ id: category.id, name: category.name, slug: category.slug, description: category.description, icon: category.icon, sort_order: category.order, in_main_menu: category.inMainMenu, active: true }));
}

export function fallbackProductRow(product: (typeof fallbackProducts)[number]): AdminProductRow {
  return {
    id: product.id, external_id: product.externalId ?? null, name: product.name, slug: product.slug,
    description: product.description, price_cents: product.price, old_price_cents: product.oldPrice ?? null,
    category_id: product.categoryId, brand: product.brand ?? null, sku: product.sku, stock: product.stock,
    low_stock_threshold: 3, status: "active", variants: product.variants ?? [], specifications: product.specifications,
    shipping: product.shipping, rating: product.rating ?? null, review_count: product.reviewCount ?? null,
    sold_count: product.soldCount ?? null, is_featured: product.isFeatured, is_best_seller: product.isBestSeller,
    is_offer: product.isOffer, is_exclusive: product.isExclusive ?? false, tags: product.tags, data_source: product.dataSource, source_url: product.sourceUrl ?? null,
    card_installment: product.cardInstallment ?? null, seller_note: product.sellerNote ?? null,
    published_at: product.publishedAt ?? null, last_stock_entry_at: product.lastStockEntryAt ?? null,
    last_sale_at: product.lastSaleAt ?? null, hero_enabled: product.heroEnabled ?? true,
    hero_priority: product.heroPriority ?? 0, created_at: "2026-08-20T00:00:00.000Z",
    updated_at: "2026-08-20T00:00:00.000Z",
    product_images: product.images.map((image, index) => ({ id: `${product.id}-${index}`, product_id: product.id, src: image.src, storage_path: null, alt: image.alt, sort_order: index, is_primary: index === 0 })),
    categories: { name: fallbackCategories.find((item) => item.id === product.categoryId)?.name ?? "" },
  };
}
