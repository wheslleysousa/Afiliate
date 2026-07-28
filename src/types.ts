export interface UserProfile {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface ApiKeysConfig {
  mercadoLivreAppId?: string;
  mercadoLivreClientSecret?: string;
  mercadoLivreKey?: string;
  mercadoLivreRefreshToken?: string;
  mercadoLivreExpiresAt?: number;
  shopeeKey?: string;
  amazonKey?: string;
  aliExpressKey?: string;
  sheinKey?: string;
  geminiApiKey?: string;
  geminiApiKeys?: string[];

  // NOVOS — IDs de afiliado por plataforma:
  mercadolivreTrackingId?: string;   // ML: ?tracking_id=XXX
  amazonAssociatesTag?: string;       // Amazon: ?tag=XXX
  shopeeTrackingId?: string;          // Shopee: ?smtt=XXX
  aliexpressAffiliateId?: string;     // AliExpress: ?aff_id=XXX
  sheinAffiliateToken?: string;       // Shein: ?url_from=XXX
}

export interface ProductData {
  id?: string;
  platform: "mercadolivre" | "shopee" | "amazon" | "aliexpress" | "shein" | string;
  title: string;
  description?: string;
  image_url: string | null;
  pictures?: string[];
  video_url?: string | null;
  videos?: string[];
  selectedMediaUrl?: string | null;
  selectedMediaType?: 'image' | 'video' | null;
  selectedImageIndex?: number;
  price_to: string;
  price_from?: string | null;
  card_price?: string | null;
  installments?: string | null;
  max_installments_interest_free?: string | null;
  coupon: string | null;
  coupon_text?: string | null;
  original_link: string;
  affiliate_link?: string;
  extractedAt?: string;
  priceUncertain?: boolean;
  shipping?: string | null;

  // NOVOS CAMPOS:
  pix_price?: string | null;          // Preço específico no PIX (pode diferir do price_to)
  free_shipping?: boolean;            // true = frete grátis confirmado
  stars?: string | null;              // Avaliação média (ex: "4.8")
  sales_count?: string | null;        // Número de vendas (ex: "1.2k", "500")
  discount_pct?: number | null;       // % de desconto calculado
  category?: string | null;           // Categoria do produto
  commission_rate?: number | null;    // Taxa de comissão em % (ex: 15)
  commission_amount?: number | null;  // Valor estimado da comissão em R$
  sales_trend_pct?: number | null;    // Tendência de crescimento de vendas últimos 7 dias (+25, -10)
}

export type ScrapedProduct = ProductData;

export interface CopyTemplate {
  id: string;
  name: string;
  category: 'urgency' | 'direct' | 'review' | 'minimalist' | 'group' | 'custom';
  template: string;
  description?: string;
}

export interface GeminiCopyVariation {
  id: string;
  title: string;
  copy: string;
}

export interface SavedHistoryItem {
  id: string;
  product: ScrapedProduct;
  variations: GeminiCopyVariation[];
  selectedCopyIndex: number;
  createdAt: string;
}

// ─── Marketplace Global ──────────────────────────────────────────────────────

/** Produto único no Marketplace Global (deduplicado por platform + platformId) */
export interface GlobalProduct {
  id: string;              // "{platform}_{platformId}" — ex: "mercadolivre_MLB123456789"
  platform: string;
  platformId: string;      // ID nativo do produto na plataforma
  title: string;
  description?: string | null;
  image_url: string | null;
  pictures?: string[];
  video_url?: string | null;
  price_to: string;        // preço atual (Pix/à vista)
  price_from?: string | null;
  installments?: string | null;
  coupon?: string | null;
  shipping?: string | null;
  original_link: string;
  miners: string[];        // UIDs dos usuários que mineraram este produto
  mineCount: number;
  firstMinedAt: string;    // ISO timestamp
  lastMinedAt: string;     // ISO timestamp
  lastUpdatedAt: string;   // ISO timestamp (última atualização de preço)

  // NOVOS CAMPOS:
  pix_price?: string | null;
  free_shipping?: boolean;
  stars?: string | null;
  sales_count?: string | null;
  discount_pct?: number | null;
  category?: string | null;
  commission_rate?: number | null;
  commission_amount?: number | null;
  sales_trend_pct?: number | null;
}

/** Entrada no histórico de preço de um produto do marketplace */
export interface PriceHistoryEntry {
  id: string;
  price: string;
  price_from?: string | null;
  recordedAt: string;      // ISO timestamp
}

/** Referência por usuário a um produto do marketplace global */
export interface MinedProductRef {
  productId: string;       // = GlobalProduct.id
  platform: string;
  minedAt: string;         // ISO timestamp
  favorite: boolean;
  status: 'active' | 'archived';
}

/** Contador diário de produtos minerados por usuário */
export interface DailyStat {
  date: string;            // "YYYY-MM-DD"
  count: number;
}

// ─── Navegação ───────────────────────────────────────────────────────────────

export type AppTab =
  | "new-product"
  | "saved-products"
  | "marketplace"
  | "my-products"
  | "analytics"
  | "settings"
  | "api-docs";