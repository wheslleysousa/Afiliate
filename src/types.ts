export interface UserProfile {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  avatarUrl?: string;
  timezone?: string;
  role?: 'admin' | 'user';
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
  shopeeAppId?: string;               // Shopee API AppID
  shopeeSecret?: string;              // Shopee API Senha/Secret
  aliexpressAffiliateId?: string;     // AliExpress: ?aff_id=XXX
  sheinAffiliateToken?: string;       // Shein: ?url_from=XXX
  tiktokshopTrackingId?: string;      // TikTok Shop: ?affiliate_id=XXX ou link de afiliado
  tiktokshopAppKey?: string;          // TikTok Shop App Key (opcional)
  tiktokshopSecret?: string;          // TikTok Shop App Secret (opcional)

  // Dados da conta oficial conectada do Mercado Livre:
  mercadoLivreUserId?: string | number;
  mercadoLivreNickname?: string;
  mercadoLivreEmail?: string;

  // Dados da conta oficial conectada do TikTok Shop:
  tiktokshopKey?: string;
  tiktokshopRefreshToken?: string;
  tiktokshopExpiresAt?: number;
  tiktokshopUserId?: string | number;
  tiktokshopNickname?: string;
  tiktokshopEmail?: string;

  // Customização de Link Encurtado
  customShortDomain?: string; // Ex: https://lkrm.site
  customShortPrefix?: string; // Ex: radardeofertas
}

export type UserApiKeys = ApiKeysConfig;

// Configuração de Comissões por Categoria e Plataforma
export interface CategoryCommissionMap {
  [categoryName: string]: number;
}

export interface PlatformCommissionConfig {
  default: number;
  categories?: Record<string, number>;
}

export type CommissionRatesConfig = Record<string, PlatformCommissionConfig>;

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
  installments_interest_free?: boolean;
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
  category: 'urgency' | 'direct' | 'review' | 'minimalist' | 'group' | 'custom' | 'ai_generated' | string;
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
  templateName?: string;
  copyText?: string;
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
  videos?: string[];
  price_to: string;        // preço atual (Pix/à vista)
  price_from?: string | null;
  installments?: string | null;
  installments_interest_free?: boolean;
  coupon?: string | null;
  coupon_text?: string | null;
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
  sales_7d?: number | null;
  discount_pct?: number | null;
  category?: string | null;
  commission_rate?: number | null;
  commission_amount?: number | null;
  sales_trend_pct?: number | null;
  affiliate_link?: string | null;
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
  lastSharedAt?: number | string | null;
  archived?: boolean;
  productData?: GlobalProduct;
}

export type EnrichedMinedProduct = GlobalProduct & {
  favorite?: boolean;
  archived?: boolean;
  lastSharedAt?: string | null;
  minedAt?: string;
};

/** Contador diário de produtos minerados por usuário */
export interface DailyStat {
  date: string;            // "YYYY-MM-DD"
  count: number;
}

// ─── Automação de Disparos no WhatsApp ─────────────────────────────────────

export interface WaGroupParticipant {
  id: string;
  phone?: string;
  name?: string;
  isAdmin?: boolean;
}

export interface WaGroup {
  groupId: string;
  sessionId?: string;
  name: string;
  photoUrl?: string | null;
  size?: number;
  description?: string | null;
  isAdmin?: boolean;
  participantsCount?: number;
  participants?: WaGroupParticipant[];
  updatedAt?: any;
}

export type CampaignObjective = 'mais_vendidos' | 'maior_desconto' | 'maior_comissao' | 'mais_recentes';
export type CampaignPacing = 'aleatorio' | 'uniforme';

export interface CampaignFilters {
  minSales?: number;
  minDiscount?: number;
  platforms?: string[];
  categories?: string[];
  maxPrice?: number;
}

export interface CampaignSchedule {
  startHour: string; // ex: "09:00"
  endHour: string;   // ex: "21:00"
  days: number[];    // 0-6 (0 = Domingo, 6 = Sábado)
  timezone: string;  // ex: "America/Sao_Paulo"
}

export interface WaCampaign {
  id?: string;
  sessionId?: string;
  name: string;
  enabled: boolean;
  targetGroupIds: string[];
  objective: CampaignObjective;
  filters: CampaignFilters;
  quantity: number;
  windowMinutes: number;
  pacing: CampaignPacing;
  minGapSec: number;
  maxGapSec: number;
  schedule: CampaignSchedule;
  templateId?: string;
  customShortSlug?: string;
  lastRunAt?: any;
  createdAt?: any;
}

export type QueueStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'paused';

export interface WaSendQueueItem {
  id?: string;
  sessionId?: string;
  productId: string;
  productTitle?: string;
  groupId: string;
  groupName?: string;
  campaignId?: string;
  campaignName?: string;
  copyText: string;
  imageUrl?: string | null;
  affiliateLink: string;
  scheduledAt: any;
  status: QueueStatus;
  sentAt?: any;
  error?: string;
}

export interface WaSendLogItem {
  id?: string;
  sessionId?: string;
  productId: string;
  productName?: string;
  groupId: string;
  groupName?: string;
  campaignId?: string;
  campaignName?: string;
  sentAt: any;
  status: 'sent' | 'failed';
  error?: string;
  affiliateLink?: string;
  copyText?: string;
  imageUrl?: string | null;
}

export interface WaSession {
  id?: string;
  sessionId?: string;
  label?: string | null;
  status: 'disconnected' | 'connecting' | 'qr' | 'connected';
  qr?: string | null;
  phoneNumber?: string | null;
  name?: string | null;
  requestedConnect?: boolean;
  requestedLogout?: boolean;
  updatedAt?: any;
  lastConnectedAt?: any;
  createdAt?: any;
}

// ─── Navegação ───────────────────────────────────────────────────────────────

export type AppTab =
  | "new-product"
  | "saved-products"
  | "marketplace"
  | "my-products"
  | "whatsapp-auto"
  | "templates"
  | "extension"
  | "url-shortener"
  | "settings"
  | "api-docs";