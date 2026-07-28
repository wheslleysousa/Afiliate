import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'green-yellow' | 'yellow' | 'green' | 'blue' | 'default';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'green-yellow',
  className = '',
}) => {
  const baseClasses =
    'inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-extrabold border shadow-sm backdrop-blur-md transition-all';

  const variants = {
    'green-yellow':
      'bg-emerald-950/90 text-yellow-300 border-yellow-400/60 shadow-yellow-500/10',
    yellow:
      'bg-yellow-400 text-stone-950 border-yellow-500 font-black shadow-yellow-500/20',
    green:
      'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold',
    blue: 'bg-blue-950/90 text-blue-300 border-blue-500/50 font-bold',
    default: 'bg-stone-800 text-stone-300 border-stone-700 font-semibold',
  };

  return (
    <span className={`${baseClasses} ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

interface CommissionBadgeProps {
  ratePct?: number | null;
  amountFormatted: string;
  className?: string;
}

export const CommissionBadge: React.FC<CommissionBadgeProps> = ({
  ratePct,
  amountFormatted,
  className = '',
}) => {
  return (
    <div
      className={`flex items-center justify-between bg-gradient-to-r from-emerald-950 via-stone-900 to-emerald-950 border border-yellow-400/60 px-2.5 py-1.5 rounded-xl shadow-md shadow-emerald-950/50 ${className}`}
    >
      <div className="flex items-center gap-1.5">
        {ratePct ? (
          <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-black rounded bg-yellow-400 text-stone-950 shadow-sm">
            +{ratePct}%
          </span>
        ) : null}
        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">
          Sua Comissão:
        </span>
      </div>
      <span className="text-xs sm:text-sm font-black text-yellow-300 drop-shadow-sm font-mono">
        {amountFormatted}
      </span>
    </div>
  );
};
