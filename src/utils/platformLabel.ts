const PLATFORM_LABELS: Record<string, { label: string; emoji: string }> = {
  mercadolivre: { label: "Mercado Livre", emoji: "🛒" },
  shopee:       { label: "Shopee", emoji: "🧡" },
  amazon:       { label: "Amazon", emoji: "📦" },
  aliexpress:   { label: "AliExpress", emoji: "🌐" },
  shein:        { label: "Shein", emoji: "👗" },
  tiktokshop:   { label: "TikTok Shop", emoji: "🎵" },
};

export function getPlatformLabel(platform?: string | null): string {
  if (!platform) return 'Plataforma';
  const p = String(platform).toLowerCase().replace(/[^a-z0-9]/g, '');
  
  if (p.includes('mercadolivre') || p.includes('ml')) return `${PLATFORM_LABELS.mercadolivre.emoji} ${PLATFORM_LABELS.mercadolivre.label}`;
  if (p.includes('shopee')) return `${PLATFORM_LABELS.shopee.emoji} ${PLATFORM_LABELS.shopee.label}`;
  if (p.includes('amazon')) return `${PLATFORM_LABELS.amazon.emoji} ${PLATFORM_LABELS.amazon.label}`;
  if (p.includes('aliexpress') || p.includes('ali')) return `${PLATFORM_LABELS.aliexpress.emoji} ${PLATFORM_LABELS.aliexpress.label}`;
  if (p.includes('shein')) return `${PLATFORM_LABELS.shein.emoji} ${PLATFORM_LABELS.shein.label}`;
  if (p.includes('tiktok')) return `${PLATFORM_LABELS.tiktokshop.emoji} ${PLATFORM_LABELS.tiktokshop.label}`;
  
  const info = PLATFORM_LABELS[p];
  return info ? `${info.emoji} ${info.label}` : String(platform);
}
