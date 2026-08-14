import React, { useState } from 'react';
import { SavedHistoryItem } from '../types';
import { ShoppingBag, Search, Trash2, ExternalLink, Share2, Copy, Check, Tag, PlusCircle, ArrowRight, TrendingDown } from 'lucide-react';
import { getPlatformLabel } from '../utils/platformLabel';
import { calculateDiscountPercent } from '../utils/copyHelper';
import { formatPrice } from '../utils/formatPrice';
import { PriceBlock } from './PriceBlock';

interface SavedProductsTabProps {
  items: SavedHistoryItem[];
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onNavigateToNew: () => void;
}

export const SavedProductsTab: React.FC<SavedProductsTabProps> = ({
  items,
  onDelete,
  onClearAll,
  onNavigateToNew,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<SavedHistoryItem | null>(items[0] || null);
  const [activeVarIdx, setActiveVarIdx] = useState<number>(0);
  const [copied, setCopied] = useState(false);

  const filteredItems = items.filter(
    (item) =>
      item.product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product.platform.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const [confirmDeleteModalItem, setConfirmDeleteModalItem] = useState<SavedHistoryItem | null>(null);

  const handleDeleteItem = (idToDelete: string) => {
    onDelete(idToDelete);
    const remaining = items.filter((item) => item.id !== idToDelete);
    setSelectedItem(remaining[0] || null);
    setActiveVarIdx(0);
    setConfirmDeleteModalItem(null);
  };

  const currentItem = (selectedItem && items.some(i => i.id === selectedItem.id))
    ? selectedItem
    : filteredItems[0] || null;
  const currentCopy = currentItem?.variations[activeVarIdx]?.copy || '';

  const handleCopy = async () => {
    if (!currentCopy) return;
    try {
      await navigator.clipboard.writeText(currentCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleWhatsApp = () => {
    if (!currentCopy) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(currentCopy)}`, '_blank');
  };

  if (items.length === 0) {
    return (
      <div className="bg-[#0e1119] border border-[#1e2636] rounded-3xl p-8 text-center space-y-4 max-w-xl mx-auto my-12 shadow-xl">
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-2xl inline-block">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-white">Nenhum Produto Cadastrado Ainda</h2>
        <p className="text-xs text-[#93a0b5] leading-relaxed">
          Sua lista de produtos e copies salvas está vazia. Cadastre novos links de produtos para gerar e reutilizar suas divulgações rapidamente!
        </p>
        <button
          onClick={onNavigateToNew}
          className="py-3 px-6 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-500/20 inline-flex items-center gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Cadastrar Primeiro Produto</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0e1119] border border-[#1e2636] rounded-2xl p-5">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-amber-400" />
            <span>Produtos Cadastrados ({items.length})</span>
          </h2>
          <p className="text-xs text-[#93a0b5]">Gerencie seus produtos extraídos e copie as frases para o WhatsApp</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateToNew}
            className="py-2 px-3.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Novo Produto</span>
          </button>

          <button
            onClick={onClearAll}
            className="py-2 px-3 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/50 rounded-xl text-xs font-semibold transition-all"
          >
            Limpar Tudo
          </button>
        </div>
      </div>

      {/* Main Grid: Item List & Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Filterable Product List */}
        <div className="lg:col-span-5 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#93a0b5]" />
            <input
              type="text"
              placeholder="Buscar por nome ou plataforma..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#0e1119] border border-[#1e2636] rounded-xl text-xs text-white placeholder-[#93a0b5]/60 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
            {filteredItems.map((item) => {
              const isSelected = currentItem?.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedItem(item);
                    setActiveVarIdx(0);
                  }}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex gap-3 ${
                    isSelected
                      ? 'bg-[#151a26] border-emerald-500/60 shadow-md'
                      : 'bg-[#0e1119] border-[#1e2636] hover:bg-[#151a26]'
                  }`}
                >
                  {(item.product.selectedMediaUrl || item.product.image_url) ? (
                    <div className="relative w-14 h-14 shrink-0 bg-[#07090f] rounded-lg overflow-hidden border border-[#1e2636] p-1 flex items-center justify-center">
                      <img
                        src={item.product.selectedMediaUrl || item.product.image_url!}
                        alt={item.product.title}
                        className="max-w-full max-h-full object-contain"
                      />
                      {item.product.selectedMediaType === 'video' && (
                        <div className="absolute inset-0 bg-red-600/20 flex items-center justify-center">
                          <svg className="w-5 h-5 text-red-500 fill-current" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-14 h-14 bg-[#07090f] rounded-lg shrink-0 flex items-center justify-center text-[#93a0b5] text-[10px] border border-[#1e2636]">
                      Sem mídia
                    </div>
                  )}

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-[#07090f] text-emerald-400 rounded-md border border-emerald-500/20 uppercase">
                        {getPlatformLabel(item.product.platform)}
                      </span>
                      <span className="text-[10px] text-[#93a0b5]">{item.createdAt}</span>
                    </div>

                    <h4 className="text-xs font-bold text-white truncate">{item.product.title}</h4>
                    <p className="text-xs font-semibold text-emerald-400">{formatPrice(item.product.price_to)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Selected Item Detail */}
        {currentItem && (
          <div className="lg:col-span-7 bg-[#0e1119] border border-[#1e2636] rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#1e2636] pb-3">
              <div>
                <span className="text-[10px] font-bold px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/30 uppercase">
                  {getPlatformLabel(currentItem.product.platform)}
                </span>
                <h3 className="text-sm font-bold text-white mt-1">{currentItem.product.title}</h3>
              </div>

              <button
                onClick={() => setConfirmDeleteModalItem(currentItem)}
                title="Excluir do histórico"
                className="p-2 text-[#93a0b5] hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Media Preview & Download */}
            {(currentItem.product.selectedMediaUrl || currentItem.product.image_url) && (
              <div className="flex items-center gap-3 bg-[#07090f] p-3 rounded-xl border border-[#1e2636]">
                <div className="relative w-16 h-16 shrink-0 bg-[#0e1119] rounded-lg overflow-hidden border border-[#1e2636] p-1 flex items-center justify-center">
                  <img
                    src={currentItem.product.selectedMediaUrl || currentItem.product.image_url!}
                    alt={currentItem.product.title}
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-[#93a0b5] font-bold uppercase">Mídia do Anúncio</p>
                  <p className="text-xs text-[#eef2f9] truncate mb-1">
                    {currentItem.product.selectedMediaType === 'video' ? '🎥 Vídeo do Produto' : '🖼️ Imagem do Produto'}
                  </p>
                  <div className="flex gap-2">
                    <a
                      href={`/api/download?url=${encodeURIComponent(currentItem.product.selectedMediaUrl || currentItem.product.image_url!)}`}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black rounded-md flex items-center gap-1 transition-all"
                      download
                    >
                      <span>⬇️ Baixar Mídia</span>
                    </a>
                    <a
                      href={currentItem.product.selectedMediaUrl || currentItem.product.image_url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 bg-[#151a26] hover:bg-[#1e2636] text-[#eef2f9] text-[10px] font-bold rounded-md border border-[#1e2636] flex items-center gap-1 transition-all"
                    >
                      <span>Abrir</span>
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Price & Coupon Details */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#07090f] p-3 rounded-xl border border-[#1e2636] text-xs">
              <PriceBlock product={currentItem.product} size="md" />

              {currentItem.product.coupon && (
                <div className="flex items-center gap-1.5 text-amber-300 font-semibold bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30">
                  <Tag className="w-3.5 h-3.5" />
                  <span>Cupom: {currentItem.product.coupon}</span>
                </div>
              )}
            </div>

            {/* Copy Variation Switcher */}
            <div>
              <p className="text-xs font-semibold text-[#eef2f9] mb-2">Variações de Copy:</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {currentItem.variations.map((v, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveVarIdx(idx)}
                    className={`p-2 rounded-xl text-xs font-bold truncate transition-all ${
                      activeVarIdx === idx
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                        : 'bg-[#07090f] text-[#93a0b5] border border-[#1e2636] hover:text-white'
                    }`}
                  >
                    {v.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview Box */}
            <textarea
              rows={8}
              readOnly
              value={currentCopy}
              className="w-full p-3.5 bg-[#07090f] border border-[#1e2636] rounded-xl text-xs text-[#eef2f9] font-mono leading-relaxed"
            />

            {/* Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleCopy}
                className="py-2.5 px-4 bg-[#151a26] hover:bg-[#1e2636] text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copiado!' : 'Copiar Copy'}</span>
              </button>

              <button
                onClick={handleWhatsApp}
                className="py-2.5 px-4 bg-[#25D366] hover:bg-[#20bd5a] text-stone-950 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <Share2 className="w-4 h-4" />
                <span>Enviar no WhatsApp</span>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Confirmation Modal */}
      {confirmDeleteModalItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl relative">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Excluir Produto</h3>
                <p className="text-xs text-[#93a0b5]">Remover este produto do histórico?</p>
              </div>
            </div>

            <div className="p-3 bg-[#151a26] border border-[#1e2636] rounded-xl flex items-center gap-3">
              {confirmDeleteModalItem.product.image_url ? (
                <img
                  src={confirmDeleteModalItem.product.image_url}
                  alt={confirmDeleteModalItem.product.title}
                  className="w-12 h-12 rounded-lg object-cover border border-[#1e2636] shrink-0"
                />
              ) : (
                <div className="w-12 h-12 bg-[#0e1119] rounded-lg flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-6 h-6 text-[#93a0b5]" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-white truncate">
                  {confirmDeleteModalItem.product.title}
                </h4>
                <p className="text-[11px] text-emerald-400 font-extrabold mt-0.5">
                  R$ {confirmDeleteModalItem.product.price_to}
                </p>
              </div>
            </div>

            <p className="text-xs text-[#eef2f9] leading-relaxed">
              Deseja realmente excluir este produto e todas as suas variações de copy?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmDeleteModalItem(null)}
                className="px-4 py-2 bg-[#151a26] hover:bg-[#1e2636] text-[#eef2f9] rounded-xl text-xs font-bold border border-[#1e2636] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteItem(confirmDeleteModalItem.id)}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-red-950/50 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
