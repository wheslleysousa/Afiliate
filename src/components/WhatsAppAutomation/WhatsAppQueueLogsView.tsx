import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  query,
  doc,
  deleteDoc,
  updateDoc,
  getDocs,
  limit,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { WaSendQueueItem, WaSendLogItem, WaSession } from '../../types';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Trash2,
  Search,
  RefreshCw,
  ExternalLink,
  FileText,
  Pause,
  Play,
  AlertTriangle,
  Smartphone,
  Layers,
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
  const [showClearHistoryModal, setShowClearHistoryModal] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);

  // Map session labels
  const sessionMap = new Map<string, string>();
  waSessions.forEach((s) => {
    const sId = s.sessionId || s.id || '';
    if (sId) {
      sessionMap.set(sId, s.label || s.phoneNumber || 'WhatsApp');
    }
  });

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
      limit(200)
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

  const handleTogglePauseQueueItem = async (itemId: string, currentStatus?: string) => {
    if (!uid) return;
    try {
      const nextStatus = currentStatus === 'paused' ? 'pending' : 'paused';
      await updateDoc(doc(db, 'users', uid, 'sendQueue', itemId), {
        status: nextStatus,
      });
    } catch (err) {
      console.error('Erro ao alternar pausa do item:', err);
    }
  };

  const handleConfirmClearHistory = async () => {
    if (!uid) return;
    setIsClearingHistory(true);
    try {
      const snapshot = await getDocs(collection(db, 'users', uid, 'sendLog'));
      const deletePromises = snapshot.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deletePromises);
      setShowClearHistoryModal(false);
    } catch (err) {
      console.error('Erro ao limpar histórico:', err);
    } finally {
      setIsClearingHistory(false);
    }
  };

  const filteredQueue = queueItems.filter((item) =>
    (item.productTitle || item.copyText || item.groupName || item.campaignName || '')
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const filteredLogs = logItems
    .filter((log) => {
      if (statusFilter === 'sent' && log.status !== 'sent') return false;
      if (statusFilter === 'failed' && log.status === 'sent') return false;
      return (log.productName || log.groupName || log.campaignName || log.error || '')
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

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'processing':
        return (
          <span className="bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
            Processando
          </span>
        );
      case 'paused':
        return (
          <span className="bg-[#151a26] text-[#93a0b5] border border-[#1e2636] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Pause className="w-3 h-3 text-[#93a0b5]" />
            Pausado
          </span>
        );
      case 'sent':
      case 'completed':
      case 'success':
        return (
          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Enviado
          </span>
        );
      case 'failed':
      case 'error':
        return (
          <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <XCircle className="w-3 h-3 text-red-400" />
            Falhou
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-400" />
            Aguardando
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Subtab Toggle & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0e1119] p-4 rounded-2xl border border-[#1e2636]">
        <div className="flex items-center gap-2 p-1 bg-[#151a26] rounded-xl border border-[#1e2636]">
          <button
            onClick={() => setSubTab('queue')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'queue'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/40'
                : 'text-[#93a0b5] hover:text-white'
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
                : 'text-[#93a0b5] hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            Histórico ({logItems.length})
          </button>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {subTab === 'logs' && (
            <>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-[#151a26] border border-[#1e2636] text-[#eef2f9] text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
              >
                <option value="all">Todos os Status</option>
                <option value="sent">Enviados (Sucesso)</option>
                <option value="failed">Falhas / Erros</option>
              </select>

              {logItems.length > 0 && (
                <button
                  onClick={() => setShowClearHistoryModal(true)}
                  className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                  Limpar histórico
                </button>
              )}
            </>
          )}

          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 text-[#93a0b5] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#151a26] border border-[#1e2636] text-[#eef2f9] text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Queue View */}
      {subTab === 'queue' && (
        <div className="space-y-4">
          {loadingQueue && (
            <div className="p-8 text-center text-[#93a0b5]">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-400" />
            </div>
          )}

          {!loadingQueue && filteredQueue.length === 0 && (
            <div className="bg-[#0e1119] border border-[#1e2636] p-10 rounded-2xl text-center space-y-2">
              <Clock className="w-8 h-8 text-[#93a0b5] mx-auto" />
              <h4 className="text-sm font-bold text-white">Fila de envios vazia</h4>
              <p className="text-xs text-[#93a0b5]">
                Quando um disparo for programado, os itens em fila aparecerão aqui em tempo real.
              </p>
            </div>
          )}

          {!loadingQueue &&
            filteredQueue.map((item, idx) => {
              const accountLabel = item.sessionId
                ? sessionMap.get(item.sessionId) || 'Conta WhatsApp'
                : 'Conta Padrão';
              const isPaused = item.status === 'paused';

              return (
                <div
                  key={item.id || `qitem-${idx}`}
                  className="bg-[#0e1119] border border-[#1e2636] p-4 rounded-2xl flex flex-col sm:flex-row gap-4 items-start hover:border-blue-500/40 transition-all"
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.productTitle || 'Oferta'}
                      className="w-16 h-16 rounded-xl object-cover border border-[#1e2636] shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-[#151a26] border border-[#1e2636] flex items-center justify-center text-[#93a0b5] text-xs shrink-0 font-medium">
                      Sem Foto
                    </div>
                  )}

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <h4 className="text-xs font-bold text-white truncate">
                        {item.productTitle || item.campaignName || 'Disparo WhatsApp'}
                      </h4>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(item.status)}
                        <span className="text-[10px] text-[#93a0b5] font-mono">
                          Horário: {formatTime(item.scheduledAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#93a0b5]">
                      <span className="flex items-center gap-1">
                        <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                        <strong>Conta:</strong> {accountLabel}
                      </span>
                      <span><strong>Grupo:</strong> {item.groupName || item.groupId}</span>
                      {item.campaignName && (
                        <span><strong>Campanha:</strong> {item.campaignName}</span>
                      )}
                    </div>

                    {item.copyText && (
                      <p className="text-[11px] font-mono text-[#eef2f9] bg-[#151a26] p-2.5 rounded-xl border border-[#1e2636] truncate">
                        {item.copyText}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => item.id && handleTogglePauseQueueItem(item.id, item.status)}
                      className={`p-2 rounded-xl border border-[#1e2636] text-xs font-bold flex items-center gap-1.5 transition-all ${
                        isPaused
                          ? 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border-blue-500/30'
                          : 'bg-[#151a26] hover:bg-[#1e2636] text-[#eef2f9]'
                      }`}
                      title={isPaused ? 'Retomar Envio' : 'Pausar Envio'}
                    >
                      {isPaused ? <Play className="w-4 h-4 text-blue-400" /> : <Pause className="w-4 h-4 text-amber-400" />}
                      <span className="text-[11px]">{isPaused ? 'Retomar' : 'Pausar'}</span>
                    </button>

                    <button
                      onClick={() => item.id && handleDeleteQueueItem(item.id)}
                      className="p-2 text-[#93a0b5] hover:text-red-400 bg-[#151a26] hover:bg-red-500/20 rounded-xl border border-[#1e2636]"
                      title="Cancelar / Remover"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Logs View */}
      {subTab === 'logs' && (
        <div className="space-y-4">
          {loadingLogs && (
            <div className="p-8 text-center text-[#93a0b5]">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-400" />
            </div>
          )}

          {!loadingLogs && filteredLogs.length === 0 && (
            <div className="bg-[#0e1119] border border-[#1e2636] p-10 rounded-2xl text-center space-y-2">
              <FileText className="w-8 h-8 text-[#93a0b5] mx-auto" />
              <h4 className="text-sm font-bold text-white">Nenhum registro no histórico</h4>
              <p className="text-xs text-[#93a0b5]">
                O histórico de disparos executados aparecerá aqui.
              </p>
            </div>
          )}

          {!loadingLogs &&
            filteredLogs.map((log, idx) => {
              const isSuccess = log.status === 'sent';
              const accountLabel = log.sessionId
                ? sessionMap.get(log.sessionId) || 'Conta WhatsApp'
                : 'Conta WhatsApp';

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
                      <div className="flex items-center gap-2">
                        {getStatusBadge(log.status)}
                        <span className="text-[10px] text-[#93a0b5] font-mono">
                          {formatTime(log.sentAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#93a0b5]">
                      <span><strong>Conta:</strong> {accountLabel}</span>
                      <span><strong>Grupo:</strong> {log.groupName || log.groupId}</span>
                      {log.campaignName && (
                        <span><strong>Campanha:</strong> {log.campaignName}</span>
                      )}
                    </div>

                    {log.error && (
                      <div className="p-2 bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] rounded-lg mt-1 font-mono">
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
                        Ver Link
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Confirmation Modal - Clear History */}
      {showClearHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1119] border border-red-500/30 w-full max-w-md rounded-2xl p-6 space-y-5 shadow-2xl relative animate-fadeIn">
            <div className="flex items-center gap-3 pb-4 border-b border-[#1e2636]">
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Limpar histórico de envios?</h3>
              </div>
            </div>

            <div className="space-y-3 text-xs text-[#eef2f9]">
              <p>
                Essa ação é irreversível. Tem certeza de que deseja apagar todos os registros do histórico?
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1e2636]">
              <button
                disabled={isClearingHistory}
                onClick={() => setShowClearHistoryModal(false)}
                className="px-4 py-2 bg-[#151a26] hover:bg-[#1e2636] text-[#eef2f9] text-xs font-semibold rounded-xl border border-[#1e2636] transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={isClearingHistory}
                onClick={handleConfirmClearHistory}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-red-950/50 transition-all"
              >
                {isClearingHistory ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Limpando...
                  </>
                ) : (
                  <>
                    Limpar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
