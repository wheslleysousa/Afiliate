import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, deleteDoc, doc, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Coupon } from '../types';
import { Ticket, RefreshCw, Trash2, ExternalLink, Clock, AlertCircle, Search, Puzzle } from 'lucide-react';

interface CouponsTabProps {
  uid?: string;
  onNavigateToExtension?: () => void;
}

const PLATFORMS: { key: string; label: string; color: string }[] = [
  { key: 'all', label: 'Todas', color: 'text-[#eef2f9]' },
  { key: 'mercadolivre', label: 'Mercado Livre', color: 'text-yellow-300' },
  { key: 'shopee', label: 'Shopee', color: 'text-orange-300' },
  { key: 'amazon', label: 'Amazon', color: 'text-blue-300' },
  { key: 'aliexpress', label: 'AliExpress', color: 'text-red-300' },
];

function platformLabel(p: string): string {
  return PLATFORMS.find((x) => x.key === p)?.label || p;
}

// Um cupom está expirado se tiver validUntil no passado, ou a flag expired.
function isExpired(c: Coupon): boolean {
  if (c.expired) return true;
  if (c.validUntil) {
    const t = Date.parse(c.validUntil);
    if (!isNaN(t) && t < Date.now()) return true;
  }
  return false;
}

export const CouponsTab: React.FC<CouponsTabProps> = ({ uid, onNavigateToExtension }) => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState('all');
  const [search, setSearch] = useState('');
  const [showExpired, setShowExpired] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const q = query(collection(db, 'users', uid, 'coupons'));
    const unsub = onSnapshot(q, (snap) => {
      setCoupons(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }) as Coupon));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [uid]);

  const filtered = useMemo(() => {
    return coupons
      .filter((c) => (platform === 'all' ? true : c.platform === platform))
      .filter((c) => (showExpired ? true : !isExpired(c)))
      .filter((c) => {
        if (!search.trim()) return true;
        const s = search.toLowerCase();
        return (c.code || '').toLowerCase().includes(s) || (c.couponId || '').toLowerCase().includes(s) || (c.category || '').toLowerCase().includes(s) || (c.discountRaw || '').toLowerCase().includes(s) || (c.conditions || '').toLowerCase().includes(s);
      })
      .sort((a, b) => (isExpired(a) === isExpired(b) ? 0 : isExpired(a) ? 1 : -1));
  }, [coupons, platform, showExpired, search]);

  const activeCount = coupons.filter((c) => !isExpired(c)).length;

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  };

  const removeCoupon = async (id: string) => {
    if (!uid) return;
    try { await deleteDoc(doc(db, 'users', uid, 'coupons', id)); } catch { /* ignore */ }
  };

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <Ticket className="w-5 h-5 text-emerald-400" />
          <h3 className="text-base font-extrabold text-white">Cupons</h3>
          <span className="ml-auto text-xs text-[#93a0b5]"><b className="text-emerald-400">{activeCount}</b> ativos · {coupons.length} no total</span>
        </div>
        <p className="text-xs text-[#93a0b5]">Cupons extraídos pela extensão. Use a extensão na página de cupons de afiliado de cada loja para extraí-los; eles aparecem aqui e são aplicados automaticamente aos produtos que batem com as regras.</p>
        <button onClick={onNavigateToExtension} className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#151a26] hover:bg-[#1e2636] border border-[#1e2636] text-[#eef2f9] text-xs font-bold transition-colors">
          <Puzzle className="w-3.5 h-3.5 text-blue-400" /> Como extrair cupons
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {PLATFORMS.map((p) => (
          <button key={p.key} onClick={() => setPlatform(p.key)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${platform === p.key ? 'border-blue-500 bg-blue-500/10 text-blue-300' : 'border-[#1e2636] text-[#93a0b5] hover:text-white'}`}>{p.label}</button>
        ))}
        <label className="flex items-center gap-1.5 ml-auto text-xs text-[#93a0b5] cursor-pointer select-none">
          <input type="checkbox" checked={showExpired} onChange={(e) => setShowExpired(e.target.checked)} className="accent-blue-500" /> Mostrar expirados
        </label>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-[#4b5872] absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por código, categoria ou desconto..." className="w-full bg-[#0b0e15] border border-[#1e2636] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#eef2f9] placeholder-[#4b5872] focus:outline-none focus:border-blue-500/60" />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><RefreshCw className="w-6 h-6 text-blue-400 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[#4b5872]">
          <Ticket className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum cupom {platform !== 'all' ? `de ${platformLabel(platform)} ` : ''}encontrado.</p>
          <p className="text-xs mt-1">Extraia cupons pela extensão para vê-los aqui.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => {
            const expired = isExpired(c);
            return (
              <div key={c.id} className={`relative rounded-2xl border p-4 transition-all ${expired ? 'border-[#1e2636] bg-[#0b0e15] opacity-60' : 'border-emerald-500/30 bg-emerald-950/10'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#151a26] text-[#93a0b5]">{platformLabel(c.platform)}</span>
                  {expired ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-red-400"><AlertCircle className="w-3 h-3" /> Expirado</span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400"><Clock className="w-3 h-3" /> Ativo</span>
                  )}
                </div>
                <div className="text-lg font-extrabold text-white leading-tight">{c.discountRaw || (c.discountType === 'percent' ? `${c.discountValue}% OFF` : c.discountValue ? `R$ ${c.discountValue} OFF` : 'Cupom')}</div>
                {c.category ? <div className="text-xs text-[#93a0b5] mt-0.5">{c.category}</div> : null}
                {c.minValue ? <div className="text-[11px] text-[#93a0b5] mt-1">Mín. R$ {c.minValue}</div> : null}
                {c.expirationRaw ? <div className="text-[11px] text-[#93a0b5] mt-1">{c.expirationRaw}</div> : null}
                {c.conditions ? <div className="text-[11px] text-[#7c8aa3] mt-1 line-clamp-3" title={c.conditions}>{c.conditions}</div> : null}

                <div className="mt-3 flex items-center gap-2">
                  {c.code ? (
                    <button onClick={() => copyCode(c.code!)} className="flex-1 font-mono text-sm font-bold text-emerald-300 bg-[#0e1119] border border-dashed border-emerald-500/40 rounded-lg py-2 hover:bg-emerald-500/10 transition-colors">
                      {copied === c.code ? 'Copiado!' : c.code}
                    </button>
                  ) : c.productsUrl ? (
                    <a href={c.productsUrl} target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-sm font-bold text-emerald-300 bg-[#0e1119] border border-dashed border-emerald-500/40 rounded-lg py-2 hover:bg-emerald-500/10 transition-colors">{c.couponId ? `Ativar cupom #${c.couponId}` : 'Ativar cupom'}</a>
                  ) : (
                    <span className="flex-1 text-center text-sm font-semibold text-[#93a0b5] bg-[#0e1119] border border-dashed border-[#1e2636] rounded-lg py-2">{c.couponId ? `Cupom #${c.couponId}` : 'Sem código'}</span>
                  )}
                  {c.productsUrl && c.code ? (
                    <a href={c.productsUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-[#151a26] hover:bg-[#1e2636] border border-[#1e2636] text-blue-400" title="Ver produtos"><ExternalLink className="w-4 h-4" /></a>
                  ) : null}
                  <button onClick={() => removeCoupon(c.id)} className="p-2 rounded-lg text-[#4b5872] hover:text-red-400" title="Remover"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CouponsTab;
