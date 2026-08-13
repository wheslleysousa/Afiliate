const PLATFORM_LABELS: Record<string, { label: string; emoji: string }> = {
  mercadolivre: { label: "Mercado Livre", emoji: "🛒" },
  shopee:       { label: "Shopee", emoji: "🧡" },
  amazon:       { label: "Amazon", emoji: "📦" },
  aliexpress:   { label: "AliExpress", emoji: "🌐" },
  shein:        { label: "Shein", emoji: "👗" },
  tiktokshop:   { label: "TikTok Shop", emoji: "🎵" },
};

export function getPlatformLabel(platform: string): string {
  const p = platform.toLowerCase();
  const info = PLATFORM_LABELS[p];
  return info ? `${info.emoji} ${info.label}` : platform;
}
