import React from 'react';
import { BioPage, BioBlock, BioTheme } from '../types';

interface BioContentProps {
  page: BioPage;
  /**
   * Retorna o href de um bloco de link. Quando fornecido, os botões viram
   * âncoras clicáveis (usado na página pública, roteando pelo contador /rb/).
   * Quando ausente, os botões não navegam (usado no preview do editor).
   */
  getHref?: (block: BioBlock) => string | undefined;
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

/** Retorna o estilo inline do botão de link conforme buttonStyle + shape. */
function linkButtonStyle(theme: BioTheme): React.CSSProperties {
  const radius = buttonRadius(theme.buttonShape);
  const base: React.CSSProperties = { borderRadius: radius };
  switch (theme.buttonStyle) {
    case 'outline':
      return { ...base, background: 'transparent', color: theme.buttonColor, border: `2px solid ${theme.buttonColor}` };
    case 'soft':
      return { ...base, backgroundColor: hexToRgba(theme.buttonColor, 0.16), color: theme.buttonColor, border: `1px solid ${hexToRgba(theme.buttonColor, 0.35)}` };
    case 'glass':
      return { ...base, backgroundColor: 'rgba(255,255,255,0.12)', color: theme.buttonTextColor, border: '1px solid rgba(255,255,255,0.28)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' };
    case 'hard':
      return { ...base, backgroundColor: theme.buttonColor, color: theme.buttonTextColor, border: '2px solid #0a0a0a', boxShadow: '4px 4px 0 #0a0a0a' };
    case 'fill':
    default:
      return { ...base, backgroundColor: theme.buttonColor, color: theme.buttonTextColor, boxShadow: '0 4px 14px rgba(0,0,0,0.18)' };
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

/** Converte URLs de YouTube/Vimeo em URL de embed. Retorna null se não reconhecido. */
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

export const BioContent: React.FC<BioContentProps> = ({ page, getHref, onLinkClick }) => {
  const theme = page.theme;
  const btnStyle = linkButtonStyle(theme);

  const visibleBlocks = [...(page.blocks || [])]
    .filter((b) => b.active !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const btnCls = 'block w-full px-5 py-3.5 font-bold text-sm text-center transition-transform active:scale-[0.98] hover:brightness-110';

  return (
    <div
      className="min-h-full w-full flex flex-col items-center px-5 pb-16"
      style={{ ...backgroundStyle(theme), color: theme.textColor || '#ffffff', fontFamily: theme.font || 'Inter, system-ui, sans-serif' }}
    >
      {/* Banner opcional */}
      {page.bannerUrl ? (
        <div className="w-full max-w-md">
          <div className="w-full h-28 rounded-b-3xl bg-center bg-cover shadow-lg" style={{ backgroundImage: `url("${page.bannerUrl}")` }} />
        </div>
      ) : (
        <div className="h-8" />
      )}

      {/* Avatar */}
      <div className={page.bannerUrl ? '-mt-12' : 'mt-6'}>
        {page.avatarUrl ? (
          <img src={page.avatarUrl} alt={page.displayName} className="w-24 h-24 object-cover border-4 shadow-xl" style={{ borderColor: theme.buttonColor || '#ffffff', borderRadius: avatarRadius(theme.avatarShape) }} />
        ) : (
          <div className="w-24 h-24 flex items-center justify-center text-3xl font-black border-4 shadow-xl" style={{ backgroundColor: theme.buttonColor || '#2563eb', color: theme.buttonTextColor || '#ffffff', borderColor: '#ffffff33', borderRadius: avatarRadius(theme.avatarShape) }}>
            {(page.displayName || '?').trim().charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Nome + bio */}
      <h1 className="mt-4 text-xl font-extrabold tracking-tight text-center drop-shadow">{page.displayName || 'Seu nome'}</h1>
      {page.bio ? (
        <p className="mt-1.5 text-sm text-center max-w-xs opacity-90 leading-relaxed whitespace-pre-line">{page.bio}</p>
      ) : null}

      {/* Blocos */}
      <div className="w-full max-w-md mt-6 space-y-3">
        {visibleBlocks.length === 0 ? (
          <p className="text-center text-sm opacity-60 py-8">Nenhum conteúdo adicionado ainda.</p>
        ) : (
          visibleBlocks.map((block) => {
            if (block.type === 'section') {
              return (
                <h2 key={block.id} className="pt-4 pb-1 text-xs font-black uppercase tracking-widest text-center opacity-80">{block.title}</h2>
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
                    <iframe
                      src={embed}
                      title={block.title || 'video'}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              );
            }

            // link
            const href = getHref ? getHref(block) : undefined;
            const inner = (
              <div className="flex items-center justify-center gap-2 w-full">
                {block.icon ? <span className="text-lg leading-none">{block.icon}</span> : null}
                <span className="truncate">{block.title || 'Link'}</span>
              </div>
            );
            if (href) {
              return (
                <a key={block.id} href={href} target="_blank" rel="noopener noreferrer nofollow" className={btnCls} style={btnStyle} onClick={() => onLinkClick?.(block)}>{inner}</a>
              );
            }
            return (
              <div key={block.id} className={btnCls + ' cursor-default select-none'} style={btnStyle}>{inner}</div>
            );
          })
        )}
      </div>

      <div className="mt-10 text-[10px] font-semibold tracking-wider uppercase opacity-40">lkrm.site</div>
    </div>
  );
};

export default BioContent;
