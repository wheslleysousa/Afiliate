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
}

export interface ProductData {
  id?: string;
  platform: "mercadolivre" | "shopee" | "amazon" | "aliexpress" | "shein" | string;
  title: string;
  description?: string;
  image_url: string | null;
  pictures?: string[]; // Array com todas as imagens extraídas do produto
  video_url?: string | null; // URL do vídeo (se houver, ex: YouTube)
  videos?: string[]; // Array com todos os vídeos extraídos do produto
  selectedMediaUrl?: string | null; // URL da mídia selecionada pelo usuário
  selectedMediaType?: 'image' | 'video' | null; // Tipo de mídia selecionada
  selectedImageIndex?: number;
  price_to: string; // Preço extraído do produto
  price_from?: string | null; // Opcional se presente
  card_price?: string | null; // Preço para parcelamento no cartão
  installments?: string | null; // Opcional se presente
  max_installments_interest_free?: string | null; // Máximo de parcelas sem juros
  coupon: string | null; // Apenas se houver cupom real
  original_link: string;
  extractedAt?: string;
  priceUncertain?: boolean; // true quando o backend não confiou no preço extraído
  shipping?: string | null; // Opcional, ex: "Frete grátis"
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

export type AppTab = "new-product" | "saved-products" | "settings" | "api-docs";