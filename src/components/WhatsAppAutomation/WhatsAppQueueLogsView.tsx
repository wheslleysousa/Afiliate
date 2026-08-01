import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  deleteDoc,
  limit,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { WaSendQueueItem, WaSendLogItem, WaSession } from '../../types';
import {
  Clock,
  List,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
  Search,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  Users,
  Send,
  FileText,
  Smartphone,
} from 'lucide-react';

interface WhatsAppQueueLogsViewProps {
  uid: string;
  waSessions?: WaSession[];
}

export const WhatsAppQueueLogsView: React.FC<WhatsAppQueueLogsViewProps> = ({ uid, waSessions = [] }) => {
  const [subTab, setSubTab] = useState<'queue' | 'logs'>('queue');
  const [queueItems, setQueueItems] = useState<WaSendQueueItem[]>([]);
  const [logItems, setLogItems] = useState<WaSendLogItem[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'failed'>('all');

  // Listen to sendQueue
  useEffect(() => {
    if (!uid) return;
    setLoadingQueue(true);

    const q = query(
      collection(db, 'users', uid, 'sendQueue')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: WaSendQueueItem[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as WaSendQueueItem[];

        setQueueItems(list);
        setLoadingQueue(false);
      },
      (err) => {
        console.error('Erro ao escutar sendQueue:', err);
        setLoadingQueue(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  // Listen to sendLog
  useEffect(() => {
    if (!uid) return;
    setLoadingLogs(true);

    const q = query(
      collection(db, 'users', uid, 'sendLog'),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: WaSendLogItem[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as WaSendLogItem[];

        setLogItems(list);
        setLoadingLogs(false);
      },
      (err) => {
        console.error('Erro ao escutar sendLog:', err);
        setLoadingLogs(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  const handleDeleteQueueItem = async (itemId: string) => {
    if (!uid) return;
    try {
      await deleteDoc(doc(db, 'users', uid, 'sendQueue', itemId));
    } catch (err) {
      console.error('Erro ao excluir item da fila:', err);
    }
  };

  const filteredQueue = queueItems.filter((item) =>
    (item.productTitle || item.copyText || item.groupName || '')
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const filteredLogs = logItems
    .filter((log) => {
      if (statusFilter !== 'all' && log.status !== statusFilter) return false;
      return (log.productName || log.groupName || log.error || '')
        .toLowerCase()
        .includes(search.toLowerCase());
    });

  const formatTime = (timeVal: any) => {
    if (!timeVal) return '-';
    if (typeof timeVal === 'object' && timeVal.toDate) {
      return timeVal.toDate().toLocaleString('pt-BR');
    }
    if (typeof timeVal === 'number') {
      return new Date(timeVal).toLocaleString('pt-BR');
    }
    return String(timeVal);
  };

  return (
    <div className="space-y-6">
      {/* Subtab Toggle & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0e1119] p-4 rounded-2xl border border-[#1e2636]">
        <div className="flex items-center gap-2 p-1 bg-[#151a26] rounded-xl border border-[#1e2636]">
          <button
            onClick={() => setSubTab('queue')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'queue'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/40'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            Fila de Envios ({queueItems.length})
          </button>
          <button
            onClick={() => setSubTab('logs')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'logs'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/40'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            Histórico / Logs ({logItems.length})
          </button>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {subTab === 'logs' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-[#151a26] border border-[#1e2636] text-stone-300 text-xs rounded-xl px-3 py-2 focus:outline-none"
            >
              <option value="all">Todos os Status</option>
              <option value="sent">Sucesso (Enviados)</option>
              <option value="failed">Falhas (Erros)</option>
            </select>
          )}

          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#151a26] border border-[#1e2636] text-stone-200 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-blue-500/50"
            />
          </div>
        </div>
      </div>

      {/* Queue View */}
      {subTab === 'queue' && (
        <div className="space-y-4">
          {loadingQueue && (
            <div className="p-8 text-center text-stone-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-400" />
            </div>
          )}

          {!loadingQueue && filteredQueue.length === 0 && (
            <div className="bg-[#0e1119] border border-[#1e2636] p-10 rounded-2xl text-center space-y-2">
              <Clock className="w-8 h-8 text-stone-500 mx-auto" />
              <h4 className="text-sm font-bold text-white">Fila de envios vazia</h4>
              <p className="text-xs text-stone-400">
                Assim que uma campanha ativa rodar ou o worker processar o ciclo, os itens agendados aparecerão aqui em tempo real.
              </p>
            </div>
          )}

          {!loadingQueue &&
            filteredQueue.map((item, idx) => (
              <div
                key={item.id || `qitem-${idx}`}
                className="bg-[#0e1119] border border-[#1e2636] p-4 rounded-2xl flex flex-col sm:flex-row gap-4 items-start hover:border-blue-500/30 transition-all"
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.productTitle || 'Produto'}
                    className="w-16 h-16 rounded-xl object-cover border border-[#1e2636] shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-stone-800 flex items-center justify-center text-stone-500 text-xs shrink-0">
                    Sem Foto
                  </div>
                )}

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-white truncate">
                      {item.productTitle || 'Oferta agendada'}
                    </h4>
                    <span className="shrink-0 text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-400" />
                      Previsto: {formatTime(item.scheduledAt)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-stone-400">
                    <span><strong>Grupo:</strong> {item.groupName || item.groupId}</span>
                    {item.campaignName && (
                      <span><strong>Campanha:</strong> {item.campaignName}</span>
                    )}
                  </div>

                  <p className="text-[11px] font-mono text-stone-300 bg-[#151a26] p-2.5 rounded-xl border border-[#1e2636] truncate">
                    {item.copyText}
                  </p>
                </div>

                <button
                  onClick={() => item.id && handleDeleteQueueItem(item.id)}
                  className="p-2 text-stone-400 hover:text-red-400 bg-[#151a26] hover:bg-red-500/20 rounded-xl border border-[#1e2636] shrink-0"
                  title="Cancelar / Remover da Fila"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
        </div>
      )}

      {/* Logs View */}
      {subTab === 'logs' && (
        <div className="space-y-4">
          {loadingLogs && (
            <div className="p-8 text-center text-stone-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-400" />
            </div>
          )}

          {!loadingLogs && filteredLogs.length === 0 && (
            <div className="bg-[#0e1119] border border-[#1e2636] p-10 rounded-2xl text-center space-y-2">
              <FileText className="w-8 h-8 text-stone-500 mx-auto" />
              <h4 className="text-sm font-bold text-white">Nenhum registro no histórico</h4>
              <p className="text-xs text-stone-400">
                Os registros de disparos concluídos ou falhas enviados pelo worker aparecerão aqui.
              </p>
            </div>
          )}

          {!loadingLogs &&
            filteredLogs.map((log, idx) => {
              const isSuccess = log.status === 'sent';
              return (
                <div
                  key={log.id || `logitem-${idx}`}
                  className={`bg-[#0e1119] border p-4 rounded-2xl flex flex-col sm:flex-row gap-4 items-start ${
                    isSuccess ? 'border-[#1e2636]' : 'border-red-500/30'
                  }`}
                >
                  <div className="shrink-0">
                    {isSuccess ? (
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center">
                        <XCircle className="w-5 h-5" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-white truncate">
                        {log.productName || 'Disparo WhatsApp'}
                      </h4>
                      <span className="text-[10px] text-stone-400 font-mono">
                        {formatTime(log.sentAt)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-stone-400">
                      <span><strong>Grupo:</strong> {log.groupName || log.groupId}</span>
                      {log.campaignName && (
                        <span><strong>Campanha:</strong> {log.campaignName}</span>
                      )}
                    </div>

                    {log.error && (
                      <div className="p-2 bg-red-500/10 border border-red-500/20 text-red-300 text-[11px] rounded-lg mt-1 font-mono">
                        <strong>Erro:</strong> {log.error}
                      </div>
                    )}

                    {log.affiliateLink && (
                      <a
                        href={log.affiliateLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-blue-400 hover:underline flex items-center gap-1 pt-0.5"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Ver Link do Afiliado
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};
