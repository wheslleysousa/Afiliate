import React from 'react';
import { BioPage, BioBlock } from '../types';

interface BioContentProps {
  page: BioPage;
  /**
   * Retorna o href de um bloco de link. Quando fornecido, os botões viram
   * âncoras clicáveis (usado na página pública, roteando pelo contador /r/).
   * Quando ausente, os botões não navegam (usado no preview do editor).
   */
  getHref?: (block: BioBlock) => string | undefined;
  /** Callback opcional de clique (analytics client-side / preview). */
  onLinkClick?: (block: BioBlock) => void;
}

function buttonRadius(shape: BioPage['theme']['buttonShape']): string {
  if (shape === 'pill') return '9999px';
  if (shape === 'square') return '6px';
  return '16px';
}

function backgroundStyle(theme: BioPage['theme']): React.CSSProperties {
  if (theme.bgType === 'image' && theme.bgValue) {
    return {
      backgroundImage: `url("${theme.bgValue}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    };
  }
  if (theme.bgType === 'gradient' && theme.bgValue) {
    return { background: theme.bgValue };
  }
  return { backgroundColor: theme.bgValue || '#0e1119' };
}

export const BioContent: React.FC<BioContentProps> = ({ page, getHref, onLinkClick }) => {
  const theme = page.theme;
  const radius = buttonRadius(theme.buttonShape);

  const visibleBlocks = [...(page.blocks || [])]
    .filter((b) => b.active !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div
      className="min-h-full w-full flex flex-col items-center px-5 pb-16"
      style={{
        ...backgroundStyle(theme),
        color: theme.textColor || '#ffffff',
        fontFamily: theme.font || 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Banner opcional */}
      {page.bannerUrl ? (
        <div className="w-full max-w-md mt-0">
          <div
            className="w-full h-28 rounded-b-3xl bg-center bg-cover shadow-lg"
            style={{ backgroundImage: `url("${page.bannerUrl}")` }}
          />
        </div>
      ) : (
        <div className="h-8" />
      )}

      {/* Avatar */}
      <div className={page.bannerUrl ? '-mt-12' : 'mt-6'}>
        {page.avatarUrl ? (
          <img
            src={page.avatarUrl}
            alt={page.displayName}
            className="w-24 h-24 rounded-full object-cover border-4 shadow-xl"
            style={{ borderColor: theme.buttonColor || '#ffffff' }}
          />
        ) : (
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-black border-4 shadow-xl"
            style={{
              backgroundColor: theme.buttonColor || '#2563eb',
              color: theme.buttonTextColor || '#ffffff',
              borderColor: '#ffffff33',
            }}
          >
            {(page.displayName || '?').trim().charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Nome + bio */}
      <h1 className="mt-4 text-xl font-extrabold tracking-tight text-center drop-shadow">
        {page.displayName || 'Seu nome'}
      </h1>
      {page.bio ? (
        <p className="mt-1.5 text-sm text-center max-w-xs opacity-90 leading-relaxed whitespace-pre-line">
          {page.bio}
        </p>
      ) : null}

      {/* Blocos */}
      <div className="w-full max-w-md mt-6 space-y-3">
        {visibleBlocks.length === 0 ? (
          <p className="text-center text-sm opacity-60 py-8">
            Nenhum link adicionado ainda.
          </p>
        ) : (
          visibleBlocks.map((block) => {
            if (block.type === 'section') {
              return (
                <h2
                  key={block.id}
                  className="pt-4 pb-1 text-xs font-black uppercase tracking-widest text-center opacity-80"
                >
                  {block.title}
                </h2>
              );
            }

            const href = getHref ? getHref(block) : undefined;
            const inner = (
              <div className="flex items-center justify-center gap-2 w-full">
                {block.icon ? <span className="text-lg leading-none">{block.icon}</span> : null}
                <span className="truncate">{block.title || 'Link'}</span>
              </div>
            );
            const style: React.CSSProperties = {
              backgroundColor: theme.buttonColor || '#2563eb',
              color: theme.buttonTextColor || '#ffffff',
              borderRadius: radius,
            };
            const cls =
              'block w-full px-5 py-3.5 font-bold text-sm text-center shadow-md transition-transform active:scale-[0.98] hover:brightness-110';

            if (href) {
              return (
                <a
                  key={block.id}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className={cls}
                  style={style}
                  onClick={() => onLinkClick?.(block)}
                >
                  {inner}
                </a>
              );
            }
            return (
              <div key={block.id} className={cls + ' cursor-default select-none'} style={style}>
                {inner}
              </div>
            );
          })
        )}
      </div>

      {/* Rodapé discreto */}
      <div className="mt-10 text-[10px] font-semibold tracking-wider uppercase opacity-40">
        lkrm.site
      </div>
    </div>
  );
};

export default BioContent;
