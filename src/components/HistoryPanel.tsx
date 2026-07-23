import React, { useState } from 'react';
import { History, Copy, Check, Trash2, ExternalLink, Search, ShoppingBag } from 'lucide-react';
import { SavedHistoryItem } from '../types';
import { getPlatformInfo } from '../utils/copyHelper';

interface HistoryPanelProps {
  historyItems: SavedHistoryItem[];
  onDeleteHistoryItem: (id: string) => void;
  onClearAllHistory: () => void;
  onLoadHistoryItem: (item: SavedHistoryItem) => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  historyItems,
  onDeleteHistoryItem,
  onClearAllHistory,
  onLoadHistoryItem,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredItems = historyItems.filter((item) => {
    const q = searchTerm.toLowerCase();
    return (
      item.product.title.toLowerCase().includes(q) ||
      item.product.platform.toLowerCase().includes(q) ||
      item.templateName.toLowerCase().includes(q) ||
      item.copyText.toLowerCase().includes(q)
    );
  });

  const handleCopyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Histórico de Copies Salvas</h2>
            <p className="text-xs text-stone-400">Reutilize ou copie novamente suas melhores ofertas criadas</p>
          </div>
        </div>

        {historyItems.length > 0 && (
          <button
            onClick={onClearAllHistory}
            className="text-xs text-red-400 hover:text-red-300 font-medium flex items-center gap-1 self-start sm:self-auto px-3 py-1.5 rounded-lg bg-red-950/30 border border-red-900/40 hover:bg-red-950/60 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpar Histórico</span>
          </button>
        )}
      </div>

      {historyItems.length === 0 ? (
        <div className="py-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-stone-800 flex items-center justify-center mx-auto text-stone-500">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-stone-300">Nenhuma copy salva no histórico</p>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            Gere uma copy e clique em "Salvar no Histórico" para guardá-la nesta lista.
          </p>
        </div>
      ) : (
        <>
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-stone-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome do produto, plataforma ou palavra-chave..."
              className="w-full pl-10 pr-4 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredItems.map((item) => {
              const platformInfo = getPlatformInfo(item.product.platform);
              const isCopied = copiedId === item.id;

              return (
                <div
                  key={item.id}
                  className="bg-stone-950 border border-stone-800 hover:border-stone-700 rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-md transition-all group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${platformInfo.badgeClass}`}>
                        {platformInfo.name}
                      </span>
                      <span className="text-[10px] text-stone-500">{item.createdAt}</span>
                    </div>

                    <h3 className="text-xs font-bold text-stone-200 line-clamp-2">{item.product.title}</h3>

                    <div className="flex items-center gap-2 text-xs text-stone-400">
                      <span className="font-bold text-emerald-400">R$ {item.product.price_to}</span>
                      {item.product.price_from && (
                        <span className="line-through text-stone-500 text-[11px]">R$ {item.product.price_from}</span>
                      )}
                    </div>

                    <pre className="text-[11px] text-stone-300 font-sans whitespace-pre-wrap bg-stone-900/80 p-2.5 rounded-lg border border-stone-800/80 max-h-28 overflow-y-auto scrollbar-thin scrollbar-thumb-stone-800">
                      {item.copyText}
                    </pre>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-stone-800/80">
                    <button
                      onClick={() => handleCopyText(item.id, item.copyText)}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                        isCopied
                          ? 'bg-emerald-400 text-stone-950'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-stone-950'
                      }`}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => onLoadHistoryItem(item)}
                      title="Carregar no Gerador"
                      className="px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs font-medium border border-stone-700 transition-all"
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => onDeleteHistoryItem(item.id)}
                      title="Excluir do Histórico"
                      className="p-1.5 text-stone-500 hover:text-red-400 hover:bg-red-950/50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
