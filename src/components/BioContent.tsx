import React from 'react';
import { BioPage, BioBlock, BioTheme, BioSocial } from '../types';
import { renderBuiltinIcon, renderSocialIcon } from './bioIcons';

interface BioContentProps {
  page: BioPage;
  getHref?: (block: BioBlock) => string | undefined;
  getSocialHref?: (s: BioSocial) => string | undefined;
  onLinkClick?: (block: BioBlock) => void;
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

function avatarRadius(shape: BioTheme['avatarShape']): string {
  switch (shape) {
    case 'square': return '14px';
    case 'rounded': return '28px';
    case 'squircle': return '32%';
    case 'circle':
    default: return '9999px';
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

function backgroundStyle(theme: BioTheme): React.CSSProperties {
  if (theme.bgType === 'image' && theme.bgValue) {
    return { backgroundImage: `url("${theme.bgValue}")`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' };
  }
  if (theme.bgType === 'gradient' && theme.bgValue) {
    return { background: theme.bgValue };
  }
  return { backgroundColor: theme.bgValue || '#0e1119' };
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

  const visibleBlocks = [...(page.blocks || [])]
    .filter((b) => b.active !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const socials = (page.socials || []).filter((s) => s.url);

  const btnCls = 'flex items-center justify-center gap-2 w-full px-5 py-3.5 font-bold text-sm text-center transition-transform active:scale-[0.98] hover:brightness-110';

  return (
    <div
      className="min-h-full w-full flex flex-col items-center px-5 pb-16"
      style={{ ...backgroundStyle(theme), color: theme.textColor || '#ffffff', fontFamily: theme.font || 'Inter, system-ui, sans-serif' }}
    >
      {/* Banner */}
      {page.bannerUrl ? (
        <div className="w-full max-w-md">
          <div className="w-full rounded-b-3xl bg-center bg-cover shadow-lg" style={{ height: bannerHeight, backgroundImage: `url("${page.bannerUrl}")` }} />
        </div>
      ) : (
        <div className="h-8" />
      )}

      {/* Avatar */}
      {theme.avatarShape !== 'none' && (
        <div style={{ marginTop: page.bannerUrl ? -(avatarSize / 2) : 24 }}>
          {page.avatarUrl ? (
            <img src={page.avatarUrl} alt={page.displayName} className="object-cover border-4 shadow-xl" style={{ width: avatarSize, height: avatarSize, borderColor: theme.buttonColor || '#ffffff', borderRadius: avatarRadius(theme.avatarShape) }} />
          ) : (
            <div className="flex items-center justify-center font-black border-4 shadow-xl" style={{ width: avatarSize, height: avatarSize, fontSize: avatarSize / 2.6, backgroundColor: theme.buttonColor || '#2563eb', color: theme.buttonTextColor || '#ffffff', borderColor: '#ffffff33', borderRadius: avatarRadius(theme.avatarShape) }}>
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

      <div className="mt-10 text-[10px] font-semibold tracking-wider uppercase opacity-40">lkrm.site</div>
    </div>
  );
};

export default BioContent;
