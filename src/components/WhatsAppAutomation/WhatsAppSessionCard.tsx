import React, { useState, useEffect } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { WaSession } from '../../types';
import { QRCodeSVG } from 'qrcode.react';
import {
  Smartphone,
  Plus,
  QrCode,
  RefreshCw,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Phone,
  Edit3,
  Save,
  Trash2,
  Terminal,
  Server,
  Zap,
  X,
  Check,
} from 'lucide-react';

interface WhatsAppSessionCardProps {
  uid: string;
}

export const WhatsAppSessionCard: React.FC<WhatsAppSessionCardProps> = ({ uid }) => {
  const [sessions, setSessions] = useState<WaSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Add account modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newAccountLabel, setNewAccountLabel] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Edit label inline state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editLabelInput, setEditLabelInput] = useState('');

  // Subscribe to waSessions collection
  useEffect(() => {
    if (!uid) return;
    setLoading(true);

    const sessionsCol = collection(db, 'users', uid, 'waSessions');

    const unsubscribe = onSnapshot(
      sessionsCol,
      (snap) => {
        const list: WaSession[] = snap.docs.map((d) => ({
          id: d.id,
          sessionId: d.id,
          ...d.data(),
        })) as WaSession[];

        // Ordenar por data de criação
        list.sort((a, b) => {
          const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return tB - tA;
        });

        setSessions(list);
        setLoading(false);
      },
      (err) => {
        console.error('Erro ao escutar coleção waSessions:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid) return;

    setIsCreating(true);
    try {
      const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const sessionRef = doc(db, 'users', uid, 'waSessions', sessionId);

      await setDoc(sessionRef, {
        sessionId,
        label: newAccountLabel.trim() || 'Nova Conta WhatsApp',
        status: 'connecting',
        requestedConnect: true,
        requestedLogout: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setNewAccountLabel('');
      setIsAddModalOpen(false);
    } catch (err) {
      console.error('Erro ao criar nova conta de WhatsApp:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRequestLogout = async (session: WaSession) => {
    const sId = session.sessionId || session.id;
    if (!uid || !sId) return;

    if (!window.confirm(`Tem certeza que deseja desconectar a conta "${session.label || sId}"?`)) return;

    try {
      const sessionRef = doc(db, 'users', uid, 'waSessions', sId);
      await setDoc(sessionRef, { requestedLogout: true }, { merge: true });
    } catch (err) {
      console.error('Erro ao solicitar logout:', err);
    }
  };

  const handleRequestConnect = async (session: WaSession) => {
    const sId = session.sessionId || session.id;
    if (!uid || !sId) return;

    try {
      const sessionRef = doc(db, 'users', uid, 'waSessions', sId);
      await setDoc(sessionRef, { requestedConnect: true, status: 'connecting', qr: null }, { merge: true });
    } catch (err) {
      console.error('Erro ao solicitar reconexão:', err);
    }
  };

  const handleDeleteSession = async (session: WaSession) => {
    const sId = session.sessionId || session.id;
    if (!uid || !sId) return;

    if (!window.confirm(`Excluir definitivamente as configurações da conta "${session.label || sId}"?`)) return;

    try {
      await deleteDoc(doc(db, 'users', uid, 'waSessions', sId));
    } catch (err) {
      console.error('Erro ao excluir sessão:', err);
    }
  };

  const handleSaveLabel = async (sId: string) => {
    if (!uid || !sId) return;
    try {
      const sessionRef = doc(db, 'users', uid, 'waSessions', sId);
      await setDoc(sessionRef, { label: editLabelInput.trim() || 'Sem Apelido' }, { merge: true });
      setEditingSessionId(null);
    } catch (err) {
      console.error('Erro ao salvar apelido:', err);
    }
  };

  return (
    <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-6 relative overflow-hidden shadow-xl space-y-6">
      {/* Glow Effect */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#1e2636]">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Contas do WhatsApp Conectadas ({sessions.length})</h3>
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                Multi-Sessão
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Gerencie múltiplas contas do WhatsApp simultaneamente para usar em diferentes campanhas.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-950/50 flex items-center gap-2 shrink-0 self-start sm:self-center"
        >
          <Plus className="w-4 h-4" />
          Adicionar Nova Conta
        </button>
      </div>

      {/* Notice about Worker requirement */}
      <div className="bg-[#151a26] border border-[#1e2636] p-3.5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-stone-400">
        <div className="flex items-center gap-2 font-mono text-[11px] text-stone-300">
          <Terminal className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Worker ativo: <code className="text-emerald-300">cd whatsapp-worker && node index.js</code></span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-stone-400">
          <Server className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span>O worker escuta os pedidos de conexão e gera os QR Codes em tempo real</span>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="py-10 flex flex-col items-center justify-center text-stone-400 space-y-3">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-xs">Carregando contas do WhatsApp...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && sessions.length === 0 && (
        <div className="bg-[#151a26] border border-[#1e2636] p-8 rounded-xl text-center space-y-3">
          <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
            <Smartphone className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-white">Nenhuma conta de WhatsApp cadastrada</h4>
          <p className="text-xs text-stone-400 max-w-md mx-auto">
            Clique no botão <strong>"Adicionar Nova Conta"</strong> acima para criar uma sessão de WhatsApp. O worker irá gerar o QR Code aqui na tela para você escanear.
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg inline-flex items-center gap-2 mt-2"
          >
            <Plus className="w-4 h-4" />
            Adicionar Primeira Conta
          </button>
        </div>
      )}

      {/* Sessions Grid */}
      {!loading && sessions.length > 0 && (
        <div className="grid grid-cols-1 gap-6">
          {sessions.map((session) => {
            const sId = session.sessionId || session.id || '';
            const status = session.status || 'disconnected';
            const isEditingThis = editingSessionId === sId;

            return (
              <div
                key={sId}
                className="bg-[#151a26] border border-[#1e2636] rounded-xl p-5 space-y-4 relative overflow-hidden transition-all hover:border-[#2a3447]"
              >
                {/* Top Card Info Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1e2636]">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-[#0e1119] border border-[#1e2636] text-emerald-400 rounded-lg">
                      <Smartphone className="w-5 h-5" />
                    </div>

                    {isEditingThis ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editLabelInput}
                          onChange={(e) => setEditLabelInput(e.target.value)}
                          className="bg-[#0e1119] border border-emerald-500/50 text-white text-xs px-2.5 py-1.5 rounded-lg focus:outline-none"
                          placeholder="Apelido da conta"
                        />
                        <button
                          onClick={() => handleSaveLabel(sId)}
                          className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs"
                          title="Salvar Apelido"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingSessionId(null)}
                          className="p-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-xs"
                          title="Cancelar"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white">
                          {session.label || 'Conta WhatsApp'}
                        </h4>
                        <button
                          onClick={() => {
                            setEditingSessionId(sId);
                            setEditLabelInput(session.label || '');
                          }}
                          className="text-stone-400 hover:text-emerald-400 p-1"
                          title="Editar apelido"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Status Badge & Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {status === 'connected' && (
                      <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Conectado
                      </span>
                    )}
                    {status === 'qr' && (
                      <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5">
                        <QrCode className="w-3.5 h-3.5 animate-pulse" />
                        Aguardando Leitura do QR
                      </span>
                    )}
                    {status === 'connecting' && (
                      <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Conectando...
                      </span>
                    )}
                    {status === 'disconnected' && (
                      <span className="bg-stone-800 text-stone-400 border border-stone-700 text-[11px] font-bold px-2.5 py-1 rounded-full">
                        Desconectado
                      </span>
                    )}

                    {status === 'connected' && (
                      <button
                        onClick={() => handleRequestLogout(session)}
                        className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Desconectar
                      </button>
                    )}

                    {status === 'disconnected' && (
                      <>
                        <button
                          onClick={() => handleRequestConnect(session)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          Gerar QR Code
                        </button>

                        <button
                          onClick={() => handleDeleteSession(session)}
                          className="p-1.5 text-stone-500 hover:text-red-400 hover:bg-stone-800 rounded-lg transition-colors"
                          title="Excluir Conta"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Card Content according to Status */}
                {status === 'qr' && session.qr ? (
                  /* QR CODE DISPLAY */
                  <div className="flex flex-col md:flex-row items-center gap-6 bg-[#0e1119] border border-[#1e2636] p-5 rounded-xl">
                    <div className="bg-white p-3.5 rounded-2xl shadow-2xl shrink-0 border-4 border-emerald-500/30">
                      <QRCodeSVG value={session.qr} size={180} level="M" />
                    </div>

                    <div className="space-y-3 text-left">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                        <QrCode className="w-4 h-4 animate-bounce" />
                        Escaneie o QR Code no seu WhatsApp
                      </div>

                      <ol className="space-y-2 text-xs text-stone-300 list-decimal list-inside bg-[#151a26] p-3.5 rounded-xl border border-[#1e2636]">
                        <li>
                          Abra o <strong>WhatsApp</strong> no celular desta conta.
                        </li>
                        <li>
                          Acesse <strong>Aparelhos conectados</strong> → <strong>Conectar um aparelho</strong>.
                        </li>
                        <li>Aponta a câmera para o QR Code ao lado.</li>
                      </ol>

                      <p className="text-[11px] text-stone-500 italic flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin text-emerald-500" />
                        O QR Code é atualizado em tempo real pelo worker.
                      </p>
                    </div>
                  </div>
                ) : status === 'connecting' ? (
                  /* CONNECTING SPINNER */
                  <div className="py-6 bg-[#0e1119] border border-[#1e2636] rounded-xl flex flex-col items-center justify-center text-center space-y-2">
                    <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
                    <p className="text-xs font-bold text-white">Solicitando conexão ao worker...</p>
                    <p className="text-[11px] text-stone-400">
                      O worker está iniciando o socket Baileys para a conta "{session.label}". O QR Code aparecerá em breve.
                    </p>
                  </div>
                ) : status === 'connected' ? (
                  /* CONNECTED STATE */
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-white">
                          +{session.phoneNumber || 'Número Conectado'}
                        </div>
                        {session.name && (
                          <div className="text-[11px] text-stone-400">
                            Nome: {session.name}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-[11px] text-stone-400 text-right">
                      Sessão ativa e pronta para disparos
                    </div>
                  </div>
                ) : (
                  /* DISCONNECTED STATE */
                  <div className="bg-[#0e1119] border border-[#1e2636] p-4 rounded-xl flex items-center gap-3 text-xs text-stone-400">
                    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                    <span>
                      Conta desconectada. Clique em <strong>"Gerar QR Code"</strong> para conectar um celular a esta sessão.
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Adicionar Nova Conta */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1119] border border-[#1e2636] w-full max-w-md rounded-2xl p-6 space-y-5 shadow-2xl relative animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-[#1e2636]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-400" />
                Adicionar Nova Conta WhatsApp
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-stone-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1.5">
                  Apelido / Identificação da Conta *
                </label>
                <input
                  type="text"
                  required
                  value={newAccountLabel}
                  onChange={(e) => setNewAccountLabel(e.target.value)}
                  placeholder="Ex: Zap Vendas ML, Zap Modas Shein"
                  className="w-full bg-[#151a26] border border-[#1e2636] text-white text-xs px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-stone-500 mt-1">
                  Um nome fácil para identificar qual WhatsApp será usado ao criar campanhas.
                </p>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-xs text-stone-300 space-y-1">
                <p className="font-bold text-emerald-400">Como funciona:</p>
                <p className="text-[11px] leading-relaxed text-stone-400">
                  Ao criar a conta, o worker iniciará um novo socket de conexão e gerará o QR Code na tela para você escanear.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1e2636]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg disabled:opacity-50"
                >
                  {isCreating ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Criar e Gerar QR Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
