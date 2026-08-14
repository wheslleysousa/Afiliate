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
      'bg-emerald-950/90 text-amber-300 border-amber-400/60 shadow-amber-500/10',
    yellow:
      'bg-amber-400 text-black border-amber-500 font-black shadow-amber-500/20',
    green:
      'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold',
    blue: 'bg-blue-950/90 text-blue-300 border-blue-500/50 font-bold',
    default: 'bg-[#151a26] text-[#93a0b5] border-[#1e2636] font-semibold',
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
      className={`flex items-center justify-between bg-[#151a26] border border-amber-400/50 px-2.5 py-1.5 rounded-xl shadow-md ${className}`}
    >
      <div className="flex items-center gap-1.5">
        {ratePct ? (
          <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-black rounded bg-amber-400 text-black shadow-sm">
            +{ratePct}%
          </span>
        ) : null}
        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">
          Sua Comissão:
        </span>
      </div>
      <span className="text-xs sm:text-sm font-black text-amber-300 drop-shadow-sm font-mono">
        {amountFormatted}
      </span>
    </div>
  );
};
