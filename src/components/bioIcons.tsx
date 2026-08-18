import React from 'react';
import {
  ShoppingCart, Tag, Flame, Gift, Star, Heart, Globe, Play, Phone, Mail,
  MapPin, Music, DollarSign, Zap, Camera, Package, Percent, Crown, Rocket, Link2,
} from 'lucide-react';

export type IconRender = (size: number, color?: string) => React.ReactNode;

export interface BioIconDef {
  key: string;
  label: string;
  render: IconRender;
}

// Helper para ícones de marca (baseados em fill)
const brand = (children: React.ReactNode): IconRender => (size, color = 'currentColor') => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    {children}
  </svg>
);

// Helper para ícones genéricos do lucide (baseados em stroke)
const lucide = (Comp: React.ComponentType<any>): IconRender => (size, color = 'currentColor') => (
  <Comp size={size} color={color} strokeWidth={2.2} />
);

const IG = brand(<><path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.31-1.46.72-2.13 1.38C1.35 2.68.94 3.35.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.31.79.72 1.46 1.38 2.13.67.66 1.34 1.07 2.13 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.79-.31 1.46-.72 2.13-1.38.66-.67 1.07-1.34 1.38-2.13.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91-.31-.79-.72-1.46-1.38-2.13-.67-.66-1.34-1.07-2.13-1.38-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0z" /><path d="M12 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84zm0 10.16A4 4 0 1 1 16 12a4 4 0 0 1-4 4z" /><circle cx="18.41" cy="5.59" r="1.44" /></>);
const TIKTOK = brand(<path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />);
const WHATSAPP = brand(<><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.8.37-.27.3-1.05 1.02-1.05 2.49 0 1.47 1.07 2.89 1.22 3.09.15.2 2.11 3.22 5.11 4.51.71.31 1.27.49 1.71.63.72.23 1.37.2 1.89.12.58-.09 1.76-.72 2.01-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z" /><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.22 8.22 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24z" /></>);
const YOUTUBE = brand(<path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.08 0 12 0 12s0 3.92.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.92 24 12 24 12s0-3.92-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z" />);
const TELEGRAM = brand(<path d="M11.94 2C6.5 2 2.06 6.44 2.06 11.94S6.5 21.88 11.94 21.88s9.88-4.44 9.88-9.94S17.38 2 11.94 2zm4.6 6.79-1.54 7.26c-.11.51-.42.63-.85.39l-2.35-1.73-1.13 1.09c-.13.13-.24.24-.48.24l.17-2.4 4.37-3.95c.19-.17-.04-.26-.29-.09l-5.4 3.4-2.33-.73c-.5-.16-.51-.5.11-.74l9.1-3.51c.42-.15.79.1.65.72z" />);
const FACEBOOK = brand(<path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />);
const XCOM = brand(<path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93zm-1.29 19.5h2.04L6.49 3.24H4.3l13.31 17.41z" />);

// Ícones de marca (também usados na barra de redes sociais)
export const SOCIAL_PLATFORMS: BioIconDef[] = [
  { key: 'instagram', label: 'Instagram', render: IG },
  { key: 'tiktok', label: 'TikTok', render: TIKTOK },
  { key: 'whatsapp', label: 'WhatsApp', render: WHATSAPP },
  { key: 'youtube', label: 'YouTube', render: YOUTUBE },
  { key: 'telegram', label: 'Telegram', render: TELEGRAM },
  { key: 'facebook', label: 'Facebook', render: FACEBOOK },
  { key: 'x', label: 'X (Twitter)', render: XCOM },
  { key: 'email', label: 'E-mail', render: lucide(Mail) },
  { key: 'website', label: 'Site', render: lucide(Globe) },
];

// Ícones embutidos para os botões de link
export const BUILTIN_ICONS: BioIconDef[] = [
  { key: 'cart', label: 'Carrinho', render: lucide(ShoppingCart) },
  { key: 'tag', label: 'Etiqueta', render: lucide(Tag) },
  { key: 'percent', label: 'Desconto', render: lucide(Percent) },
  { key: 'fire', label: 'Oferta', render: lucide(Flame) },
  { key: 'gift', label: 'Presente', render: lucide(Gift) },
  { key: 'star', label: 'Estrela', render: lucide(Star) },
  { key: 'crown', label: 'Premium', render: lucide(Crown) },
  { key: 'rocket', label: 'Lançamento', render: lucide(Rocket) },
  { key: 'money', label: 'Dinheiro', render: lucide(DollarSign) },
  { key: 'bolt', label: 'Relâmpago', render: lucide(Zap) },
  { key: 'heart', label: 'Coração', render: lucide(Heart) },
  { key: 'play', label: 'Play', render: lucide(Play) },
  { key: 'camera', label: 'Foto', render: lucide(Camera) },
  { key: 'music', label: 'Música', render: lucide(Music) },
  { key: 'package', label: 'Pacote', render: lucide(Package) },
  { key: 'phone', label: 'Telefone', render: lucide(Phone) },
  { key: 'location', label: 'Local', render: lucide(MapPin) },
  { key: 'link', label: 'Link', render: lucide(Link2) },
  { key: 'globe', label: 'Site', render: lucide(Globe) },
  // marcas também disponíveis como ícone de link
  ...SOCIAL_PLATFORMS,
];

const ICON_MAP: Record<string, IconRender> = {};
for (const def of BUILTIN_ICONS) ICON_MAP[def.key] = def.render;

export function renderBuiltinIcon(key: string | undefined, size: number, color?: string): React.ReactNode {
  if (!key) return null;
  return ICON_MAP[key]?.(size, color) ?? null;
}

export function renderSocialIcon(platform: string, size: number, color?: string): React.ReactNode {
  const def = SOCIAL_PLATFORMS.find((s) => s.key === platform);
  return def ? def.render(size, color) : renderBuiltinIcon('link', size, color);
}
