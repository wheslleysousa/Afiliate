import React, { useEffect } from 'react';
import { BioPage, BioBlock, BioTheme, BioSocial } from '../types';
import { renderBuiltinIcon, renderSocialIcon } from './bioIcons';

interface BioContentProps {
  page: BioPage;
  getHref?: (block: BioBlock) => string | undefined;
  getSocialHref?: (s: BioSocial) => string | undefined;
  onLinkClick?: (block: BioBlock) => void;
}

// ── 10 fontes (Google Fonts + fallback) ──────────────────────────────────────
export const BIO_FONTS: { label: string; css: string; google?: string }[] = [
  { label: 'Inter', css: "'Inter', system-ui, sans-serif", google: 'Inter:wght@400;600;800' },
  { label: 'Poppins', css: "'Poppins', sans-serif", google: 'Poppins:wght@400;600;800' },
  { label: 'Montserrat', css: "'Montserrat', sans-serif", google: 'Montserrat:wght@400;600;800' },
  { label: 'Plus Jakarta Sans', css: "'Plus Jakarta Sans', sans-serif", google: 'Plus+Jakarta+Sans:wght@400;600;800' },
  { label: 'Nunito', css: "'Nunito', sans-serif", google: 'Nunito:wght@400;700;900' },
  { label: 'Playfair Display', css: "'Playfair Display', serif", google: 'Playfair+Display:wght@400;700;900' },
  { label: 'Bebas Neue', css: "'Bebas Neue', sans-serif", google: 'Bebas+Neue' },
  { label: 'Pacifico', css: "'Pacifico', cursive", google: 'Pacifico' },
  { label: 'Oswald', css: "'Oswald', sans-serif", google: 'Oswald:wght@400;600;700' },
  { label: 'Lobster', css: "'Lobster', cursive", google: 'Lobster' },
];

function ensureFontLoaded(fontCss: string) {
  if (typeof document === 'undefined' || !fontCss) return;
  const found = BIO_FONTS.find((f) => f.css === fontCss || fontCss.includes(f.label));
  if (!found || !found.google) return;
  const id = 'bio-font-' + found.google.replace(/[^a-z0-9]/gi, '');
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${found.google}&display=swap`;
  document.head.appendChild(link);
}

function buttonRadius(shape: BioTheme['buttonShape']): string {
  switch (shape) {
    case 'sharp': return '0px';
    case 'square': return '6px';
    case 'large': return '22px';
    case 'pill': return '9999px';
    case 'rounded':
    default: return '14px';
  }
}

// 10 formatos de avatar (borderRadius ou clipPath)
function avatarShapeStyle(shape: BioTheme['avatarShape']): React.CSSProperties {
  switch (shape) {
    case 'square': return { borderRadius: '14px' };
    case 'rounded': return { borderRadius: '28px' };
    case 'squircle': return { borderRadius: '32%' };
    case 'hexagon': return { clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' };
    case 'diamond': return { clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' };
    case 'blob': return { borderRadius: '42% 58% 70% 30% / 45% 45% 55% 55%' };
    case 'star': return { clipPath: 'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)' };
    case 'shield': return { clipPath: 'polygon(50% 0%,100% 12%,100% 55%,50% 100%,0% 55%,0% 12%)' };
    case 'circle':
    default: return { borderRadius: '9999px' };
  }
}

// 10 formatos de banner
function bannerShapeStyle(shape: BioTheme['bannerShape']): React.CSSProperties {
  switch (shape) {
    case 'straight': return {};
    case 'rounded': return { borderRadius: '24px' };
    case 'pill': return { borderRadius: '48px' };
    case 'wave': return { borderBottomLeftRadius: '50% 40px', borderBottomRightRadius: '50% 40px' };
    case 'slant': return { clipPath: 'polygon(0 0, 100% 0, 100% 78%, 0 100%)' };
    case 'arch': return { borderBottomLeftRadius: '60% 60px', borderBottomRightRadius: '60% 60px' };
    case 'chevron': return { clipPath: 'polygon(0 0, 100% 0, 100% 82%, 50% 100%, 0 82%)' };
    case 'tilt': return { clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 82%)' };
    case 'scallop': return { borderBottomLeftRadius: '40px', borderBottomRightRadius: '40px', borderTopLeftRadius: '40px', borderTopRightRadius: '40px' };
    case 'round-bottom':
    default: return { borderBottomLeftRadius: '28px', borderBottomRightRadius: '28px' };
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const h = (hex || '').replace('#', '').trim();
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16), g = parseInt(h[1] + h[1], 16), b = parseInt(h[2] + h[2], 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return `rgba(37,99,235,${alpha})`;
}

function linkButtonStyle(theme: BioTheme): React.CSSProperties {
  const radius = buttonRadius(theme.buttonShape);
  const base: React.CSSProperties = { borderRadius: radius };
  const shadowColor = theme.shadowColor || 'rgba(0,0,0,0.5)';
  const off = theme.shadowOffset ?? 4;
  const blur = theme.shadowBlur ?? 0;
  switch (theme.buttonStyle) {
    case 'outline':
      return { ...base, background: 'transparent', color: theme.buttonColor, border: `${theme.buttonBorderWidth || 2}px solid ${theme.buttonBorderColor || theme.buttonColor}` };
    case 'soft':
      return { ...base, backgroundColor: hexToRgba(theme.buttonColor, 0.16), color: theme.buttonColor, border: `1px solid ${hexToRgba(theme.buttonColor, 0.35)}` };
    case 'glass':
      return { ...base, backgroundColor: 'rgba(255,255,255,0.12)', color: theme.buttonTextColor, border: '1px solid rgba(255,255,255,0.28)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' };
    case 'hard':
      return { ...base, backgroundColor: theme.buttonColor, color: theme.buttonTextColor, border: `2px solid ${theme.buttonBorderColor || '#0a0a0a'}`, boxShadow: `${off}px ${off}px ${blur}px ${shadowColor}` };
    case 'neumorph':
      return { ...base, backgroundColor: theme.buttonColor, color: theme.buttonTextColor, boxShadow: `${off}px ${off}px ${blur || 12}px rgba(0,0,0,0.45), -${off}px -${off}px ${blur || 12}px rgba(255,255,255,0.08)` };
    case 'gradient':
      return { ...base, backgroundImage: `linear-gradient(135deg, ${theme.buttonColor}, ${theme.buttonColor2 || theme.buttonColor})`, color: theme.buttonTextColor, boxShadow: `0 6px 18px ${hexToRgba(theme.buttonColor, 0.35)}` };
    case 'fill':
    default:
      return { ...base, backgroundColor: theme.buttonColor, color: theme.buttonTextColor, boxShadow: `0 4px 14px ${hexToRgba(theme.buttonColor, 0.25)}` };
  }
}

// Fundo com cores editáveis por estilo
export function backgroundStyle(theme: BioTheme): React.CSSProperties {
  const c1 = theme.bgColor1 || theme.bgValue || '#0e1119';
  const c2 = theme.bgColor2 || '#1e2636';
  const c3 = theme.bgColor3 || '#2563eb';
  const ang = theme.bgAngle ?? 135;
  switch (theme.bgType) {
    case 'image':
      if (theme.bgValue) return { backgroundImage: `url("${theme.bgValue}")`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' };
      return { backgroundColor: c1 };
    case 'gradient':
      // estilos prontos guardam um CSS de gradiente em bgValue
      if (theme.bgValue && /gradient/i.test(theme.bgValue)) return { background: theme.bgValue };
      return { backgroundImage: `linear-gradient(${ang}deg, ${c1}, ${c2})` };
    case 'gradient3':
      return { backgroundImage: `linear-gradient(${ang}deg, ${c1}, ${c2}, ${c3})` };
    case 'stripes':
      return { backgroundImage: `repeating-linear-gradient(${ang}deg, ${c1} 0 24px, ${c2} 24px 48px)` };
    case 'solid':
    default:
      return { backgroundColor: c1 };
  }
}

export function toEmbedUrl(raw?: string): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host.endsWith('youtube.com')) {
      if (u.pathname.startsWith('/embed/')) return raw;
      if (u.pathname.startsWith('/shorts/')) return `https://www.youtube.com/embed/${u.pathname.split('/')[2]}`;
      const v = u.searchParams.get('v');
      return v ? `https://www.youtube.com/embed/${v}` : null;
    }
    if (host.endsWith('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch { /* url inválida */ }
  return null;
}

const LinkIcon: React.FC<{ block: BioBlock; color: string }> = ({ block, color }) => {
  const t = block.iconType;
  if (t === 'image' && block.iconImage) {
    return <img src={block.iconImage} alt="" className="w-6 h-6 rounded object-cover shrink-0" />;
  }
  if (t === 'builtin' && block.iconKey) {
    return <span className="shrink-0 inline-flex">{renderBuiltinIcon(block.iconKey, 20, color)}</span>;
  }
  if ((t === 'emoji' || !t) && block.icon) {
    return <span className="text-lg leading-none shrink-0">{block.icon}</span>;
  }
  return null;
};

export const BioContent: React.FC<BioContentProps> = ({ page, getHref, getSocialHref, onLinkClick }) => {
  const theme = page.theme;
  const btnStyle = linkButtonStyle(theme);
  const titleColor = theme.titleColor || theme.textColor || '#ffffff';
  const avatarSize = theme.avatarSize ?? 96;
  const bannerHeight = theme.bannerHeight ?? 112;
  const showAvatar = theme.showAvatar !== false && theme.avatarShape !== 'none';
  const showBanner = theme.showBanner !== false && !!page.bannerUrl;
  const fullscreenBanner = theme.bannerMode === 'fullscreen' && showBanner;
  const avatarBorderW = theme.avatarBorderWidth ?? 4;
  const bannerScale = (theme.bannerScale ?? 100) / 100;

  useEffect(() => { ensureFontLoaded(theme.font); }, [theme.font]);

  const visibleBlocks = [...(page.blocks || [])]
    .filter((b) => b.active !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const socials = (page.socials || []).filter((s) => s.url);

  const btnCls = 'flex items-center justify-center gap-2 w-full px-5 py-3.5 font-bold text-sm text-center transition-transform active:scale-[0.98] hover:brightness-110';

  const avatarStyleShape = avatarShapeStyle(theme.avatarShape);
  const avatarBorder = avatarBorderW > 0 ? `${avatarBorderW}px solid ${theme.avatarBorderColor || theme.buttonColor || '#ffffff'}` : 'none';

  return (
    <div
      className="relative min-h-screen w-full flex flex-col items-center px-5 pb-16"
      style={{ ...(fullscreenBanner ? { backgroundColor: '#0a0a0a' } : backgroundStyle(theme)), color: theme.textColor || '#ffffff', fontFamily: theme.font || "'Inter', system-ui, sans-serif" }}
    >
      {/* Banner de tela inteira (fundo, atrás de tudo, esticado até as bordas) */}
      {fullscreenBanner && (
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
          <div className="absolute inset-0 bg-center bg-no-repeat" style={{ backgroundImage: `url("${page.bannerUrl}")`, backgroundSize: 'cover', transform: `scale(${bannerScale})` }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.55))' }} />
        </div>
      )}

      <div className="relative z-10 w-full flex flex-col items-center">
        {/* Banner topo */}
        {showBanner && !fullscreenBanner ? (
          <div className="w-full max-w-md">
            <div className="w-full bg-center bg-cover shadow-lg overflow-hidden" style={{ height: bannerHeight, backgroundImage: `url("${page.bannerUrl}")`, backgroundSize: `${(theme.bannerScale ?? 100)}% auto`, ...bannerShapeStyle(theme.bannerShape) }} />
          </div>
        ) : (
          <div style={{ height: fullscreenBanner ? 40 : 20 }} />
        )}

        {/* Avatar */}
        {showAvatar && (
          <div style={{ marginTop: (showBanner && !fullscreenBanner) ? -(avatarSize / 2) : 8 }}>
            {page.avatarUrl ? (
              <img src={page.avatarUrl} alt={page.displayName} className="object-cover shadow-xl" style={{ width: avatarSize, height: avatarSize, border: avatarBorder, ...avatarStyleShape }} />
            ) : (
              <div className="flex items-center justify-center font-black shadow-xl" style={{ width: avatarSize, height: avatarSize, fontSize: avatarSize / 2.6, backgroundColor: theme.buttonColor || '#2563eb', color: theme.buttonTextColor || '#ffffff', border: avatarBorder, ...avatarStyleShape }}>
                {(page.displayName || '?').trim().charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}

        {/* Nome + bio */}
        <h1 className="mt-4 font-extrabold tracking-tight text-center drop-shadow" style={{ color: titleColor, fontSize: theme.titleSize ?? 22 }}>
          {page.displayName || 'Seu nome'}
        </h1>
        {page.bio ? (
          <p className="mt-1.5 text-center max-w-xs opacity-90 leading-relaxed whitespace-pre-line" style={{ fontSize: theme.bioSize ?? 14 }}>
            {page.bio}
          </p>
        ) : null}

        {/* Redes sociais */}
        {socials.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
            {socials.map((s) => {
              const href = getSocialHref ? getSocialHref(s) : s.url;
              const icon = renderSocialIcon(s.platform, 24, titleColor);
              return (
                <a key={s.id} href={href} target="_blank" rel="noopener noreferrer" className="opacity-90 hover:opacity-100 hover:scale-110 transition-transform" style={{ color: titleColor }} aria-label={s.platform}>
                  {icon}
                </a>
              );
            })}
          </div>
        )}

        {/* Blocos */}
        <div className="w-full max-w-md mt-6 space-y-3">
          {visibleBlocks.length === 0 ? (
            <p className="text-center text-sm opacity-60 py-8">Nenhum conteúdo adicionado ainda.</p>
          ) : (
            visibleBlocks.map((block) => {
              if (block.type === 'section') {
                return (
                  <div key={block.id} className="pt-4 pb-1 text-center">
                    <h2 className="text-xs font-black uppercase tracking-widest opacity-80">{block.title}</h2>
                    {block.text ? <p className="text-xs opacity-60 mt-0.5">{block.text}</p> : null}
                  </div>
                );
              }

              if (block.type === 'text') {
                return (
                  <p key={block.id} className="text-sm text-center opacity-90 leading-relaxed whitespace-pre-line px-1">{block.text}</p>
                );
              }

              if (block.type === 'image') {
                if (!block.imageUrl) return null;
                const img = <img src={block.imageUrl} alt={block.title || ''} className="w-full object-cover shadow-md" style={{ borderRadius: buttonRadius(theme.buttonShape) }} />;
                const href = getHref ? getHref(block) : undefined;
                return href ? (
                  <a key={block.id} href={href} target="_blank" rel="noopener noreferrer nofollow" onClick={() => onLinkClick?.(block)}>{img}</a>
                ) : (
                  <div key={block.id}>{img}</div>
                );
              }

              if (block.type === 'video') {
                const embed = toEmbedUrl(block.videoUrl);
                if (!embed) return null;
                return (
                  <div key={block.id} className="w-full overflow-hidden shadow-md" style={{ borderRadius: buttonRadius(theme.buttonShape) }}>
                    <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                      <iframe src={embed} title={block.title || 'video'} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                    </div>
                  </div>
                );
              }

              // link (com possível cor própria do bloco sobrepondo o tema)
              const href = getHref ? getHref(block) : undefined;
              const perBlockStyle: React.CSSProperties = { ...btnStyle };
              if (block.buttonColor) {
                if (theme.buttonStyle === 'outline' || theme.buttonStyle === 'soft') {
                  perBlockStyle.color = block.buttonColor;
                  perBlockStyle.borderColor = block.buttonColor;
                } else {
                  perBlockStyle.backgroundColor = block.buttonColor;
                  perBlockStyle.backgroundImage = 'none';
                }
              }
              if (block.buttonTextColor) perBlockStyle.color = block.buttonTextColor;
              const textColor = (perBlockStyle.color as string) || theme.buttonTextColor;
              const inner = (
                <>
                  <LinkIcon block={block} color={textColor} />
                  <span className="truncate">{block.title || 'Link'}</span>
                </>
              );
              if (href) {
                return (
                  <a key={block.id} href={href} target="_blank" rel="noopener noreferrer nofollow" className={btnCls} style={perBlockStyle} onClick={() => onLinkClick?.(block)}>{inner}</a>
                );
              }
              return (
                <div key={block.id} className={btnCls + ' cursor-default select-none'} style={perBlockStyle}>{inner}</div>
              );
            })
          )}
        </div>

        {!theme.hideFooter && (
          <div className="mt-10 text-[10px] font-semibold tracking-wider uppercase opacity-40">lkrm.site</div>
        )}
      </div>
    </div>
  );
};

export default BioContent;
