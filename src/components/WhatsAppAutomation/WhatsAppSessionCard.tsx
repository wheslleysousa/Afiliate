import React, { useState, useEffect } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp, query, where, getDocs, writeBatch } from 'firebase/firestore';
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
  AlertTriangle,
  Edit3,
  Save,
  Trash2,
  Terminal,
  Server,
  X,
  Check,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { WhatsAppAlert } from './WhatsAppAlert';

interface WhatsAppSessionCardProps {
  uid: string;
}

export const WhatsAppSessionCard: React.FC<WhatsAppSessionCardProps> = ({ uid }) => {
  const [sessions, setSessions] = useState<WaSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertMessage, setAlertMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Add account modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newAccountLabel, setNewAccountLabel] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Edit label inline state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editLabelInput, setEditLabelInput] = useState('');

  // Disconnect confirmation modal state
  const [disconnectModalSession, setDisconnectModalSession] = useState<WaSession | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Delete confirmation modal state
  const [deleteModalSession, setDeleteModalSession] = useState<WaSession | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
        setAlertMessage({
          type: 'error',
          text: 'Erro ao carregar as conexões do WhatsApp. Verifique sua conexão.',
        });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid) return;

    setIsCreating(true);
    setAlertMessage(null);

    try {
      const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const sessionRef = doc(db, 'users', uid, 'waSessions', sessionId);

      await setDoc(sessionRef, {
        sessionId,
        label: newAccountLabel.trim() || 'Meu WhatsApp principal',
        status: 'connecting',
        requestedConnect: true,
        requestedLogout: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setNewAccountLabel('');
      setIsAddModalOpen(false);
      setAlertMessage({
        type: 'success',
        text: 'Nova conta cadastrada com sucesso! O QR Code para leitura será gerado abaixo.',
      });
    } catch (err: any) {
      console.error('Erro ao criar nova conta de WhatsApp:', err);
      setAlertMessage({
        type: 'error',
        text: err?.message || 'Falha ao cadastrar nova conta de WhatsApp. Tente novamente.',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const confirmDisconnect = async () => {
    if (!disconnectModalSession || !uid) return;
    const session = disconnectModalSession;
    const sId = session.sessionId || session.id;
    if (!sId) return;

    setIsDisconnecting(true);
    try {
      const sessionRef = doc(db, 'users', uid, 'waSessions', sId);
      await setDoc(sessionRef, { requestedLogout: true, updatedAt: serverTimestamp() }, { merge: true });
      setAlertMessage({
        type: 'success',
        text: `Solicitação de desconexão enviada para a conta "${session.label || sId}".`,
      });
      setDisconnectModalSession(null);
    } catch (err: any) {
      console.error('Erro ao solicitar logout:', err);
      setAlertMessage({
        type: 'error',
        text: 'Não foi possível enviar o pedido de desconexão. Tente novamente.',
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleRequestConnect = async (session: WaSession) => {
    const sId = session.sessionId || session.id;
    if (!uid || !sId) return;

    try {
      const sessionRef = doc(db, 'users', uid, 'waSessions', sId);
      await setDoc(sessionRef, { requestedConnect: true, status: 'connecting', qr: null }, { merge: true });
      setAlertMessage({
        type: 'success',
        text: 'Solicitando novo QR Code para o worker. Aguarde alguns segundos...',
      });
    } catch (err: any) {
      console.error('Erro ao solicitar reconexão:', err);
      setAlertMessage({
        type: 'error',
        text: 'Erro ao solicitar a geração do QR Code.',
      });
    }
  };

  const confirmDelete = async () => {
    if (!deleteModalSession || !uid) return;
    const session = deleteModalSession;
    const sId = session.sessionId || session.id;
    if (!sId) return;

    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'users', uid, 'waSessions', sId));

      // Also clean up any waGroups associated with this sessionId
      const groupsRef = collection(db, 'users', uid, 'waGroups');
      const q = query(groupsRef, where('sessionId', '==', sId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }

      setAlertMessage({
        type: 'success',
        text: `Conta "${session.label || sId}" e seus grupos associados foram excluídos com sucesso.`,
      });
      setDeleteModalSession(null);
    } catch (err: any) {
      console.error('Erro ao excluir sessão:', err);
      setAlertMessage({
        type: 'error',
        text: 'Ocorreu um erro ao excluir esta conta de WhatsApp.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveLabel = async (sId: string) => {
    if (!uid || !sId) return;
    try {
      const sessionRef = doc(db, 'users', uid, 'waSessions', sId);
      await setDoc(sessionRef, { label: editLabelInput.trim() || 'Sem Apelido' }, { merge: true });
      setEditingSessionId(null);
      setAlertMessage({
        type: 'success',
        text: 'Apelido da conta atualizado com sucesso.',
      });
    } catch (err: any) {
      console.error('Erro ao salvar apelido:', err);
      setAlertMessage({
        type: 'error',
        text: 'Erro ao salvar apelido da conta.',
      });
    }
  };

  return (
    <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-6 relative overflow-hidden shadow-xl space-y-6">
      {/* Alert message banner if present */}
      {alertMessage && (
        <WhatsAppAlert
          type={alertMessage.type}
          message={alertMessage.text}
          onClose={() => setAlertMessage(null)}
        />
      )}

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
                Multi-Sessão Individual
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Conecte um ou mais números do WhatsApp. Cada usuário possui conexões e dados 100% isolados e privados.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-950/50 flex items-center gap-2 shrink-0 self-start sm:self-center"
        >
          <Plus className="w-4 h-4" />
          Cadastrar Número do WhatsApp
        </button>
      </div>

      {/* Worker requirement info */}
      <div className="bg-[#151a26] border border-[#1e2636] p-3.5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-stone-400">
        <div className="flex items-center gap-2 font-mono text-[11px] text-stone-300">
          <Terminal className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Worker de Disparo Ativo em Segundo Plano</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-stone-400">
          <Server className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span>Sua conta está sincronizada em tempo real via Firestore</span>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="py-10 flex flex-col items-center justify-center text-stone-400 space-y-3">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-xs">Carregando suas sessões de WhatsApp...</p>
        </div>
      )}

      {/* Clean Onboarding State for First Access */}
      {!loading && sessions.length === 0 && (
        <div className="bg-[#151a26] border border-emerald-500/30 p-8 rounded-2xl text-center space-y-4 shadow-xl relative overflow-hidden animate-fadeIn">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/50">
            <Smartphone className="w-8 h-8" />
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
              Primeiro Acesso
            </span>
            <h4 className="text-lg font-extrabold text-white">Conecte seu WhatsApp para começar</h4>
            <p className="text-xs text-stone-300 leading-relaxed">
              Sua conta está pronta! Para automatizar os disparos de ofertas nos seus grupos, você só precisa cadastrar e escanear o QR Code do seu WhatsApp.
            </p>
          </div>

          <div className="bg-[#0e1119]/80 border border-[#1e2636] p-4 rounded-xl max-w-md mx-auto text-left space-y-2 text-xs text-stone-300">
            <div className="flex items-center gap-2 font-bold text-emerald-400">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              Sua Conta é 100% Privada e Isolada:
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-stone-400">
              <li>Qualquer pessoa cadastrada no app pode conectar seu próprio número.</li>
              <li>Você pode conectar quantos WhatsApps quiser sem interferir nos outros usuários.</li>
              <li>Seus dados de grupos e campanhas são acessados unicamente por você.</li>
            </ul>
          </div>

          <div className="pt-2">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold transition-all shadow-xl shadow-emerald-950/60 inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Cadastrar Meu Número de WhatsApp
            </button>
          </div>
        </div>
      )}

      {/* Sessions Grid */}
      {!loading && sessions.length > 0 && (
        <div className="grid grid-cols-1 gap-6">
          {sessions.map((session, idx) => {
            const sId = session.sessionId || session.id || '';
            const status = session.status || 'disconnected';
            const isEditingThis = editingSessionId === sId;

            return (
              <div
                key={session.id || session.sessionId || `session-${idx}`}
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
                          title="Editar apelido da conta"
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
                        onClick={() => setDisconnectModalSession(session)}
                        className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                        title="Desconectar WhatsApp"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Desconectar
                      </button>
                    )}

                    {status === 'disconnected' && (
                      <button
                        onClick={() => handleRequestConnect(session)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        Escanear QR Code
                      </button>
                    )}

                    {/* Excluir button option available for all session states */}
                    <button
                      onClick={() => setDeleteModalSession(session)}
                      className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                      title="Excluir Conta do WhatsApp"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Excluir</span>
                    </button>
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
                        <li>Aponte a câmera do seu celular para o QR Code ao lado.</li>
                      </ol>

                      <p className="text-[11px] text-stone-500 italic flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin text-emerald-500" />
                        O QR Code é atualizado em tempo real.
                      </p>
                    </div>
                  </div>
                ) : status === 'connecting' ? (
                  /* CONNECTING SPINNER */
                  <div className="py-6 bg-[#0e1119] border border-[#1e2636] rounded-xl flex flex-col items-center justify-center text-center space-y-2">
                    <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
                    <p className="text-xs font-bold text-white">Solicitando conexão ao worker...</p>
                    <p className="text-[11px] text-stone-400">
                      O worker está gerando o QR Code para a conta "{session.label}". Aparecerá em instantes.
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
                  <div className="bg-[#0e1119] border border-[#1e2636] p-4 rounded-xl flex items-center justify-between gap-3 text-xs text-stone-400">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                      <span>
                        Conta desconectada. Clique em <strong>"Escanear QR Code"</strong> para conectar.
                      </span>
                    </div>
                    <button
                      onClick={() => handleRequestConnect(session)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      Conectar
                    </button>
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
                Cadastrar Número do WhatsApp
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
                  Apelido do Número / Identificação *
                </label>
                <input
                  type="text"
                  required
                  value={newAccountLabel}
                  onChange={(e) => setNewAccountLabel(e.target.value)}
                  placeholder="Ex: Meu WhatsApp Principal, Zap Ofertas #1"
                  className="w-full bg-[#151a26] border border-[#1e2636] text-white text-xs px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-stone-500 mt-1">
                  Nome fácil para você identificar qual celular responderá pelas mensagens.
                </p>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-xl text-xs text-stone-300 space-y-1">
                <p className="font-bold text-emerald-400">Como funciona:</p>
                <p className="text-[11px] leading-relaxed text-stone-400">
                  Ao criar o cadastro, o sistema gera o QR Code na tela para você escanear com a câmera do seu celular no WhatsApp.
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
                  Gerar QR Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: Confirmar Desconexão */}
      {disconnectModalSession && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1119] border border-[#1e2636] w-full max-w-md rounded-2xl p-6 space-y-5 shadow-2xl relative animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-[#1e2636]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <LogOut className="w-5 h-5 text-amber-400" />
                Confirmar Desconexão
              </h3>
              <button
                onClick={() => setDisconnectModalSession(null)}
                className="text-stone-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-stone-300 leading-relaxed">
                Tem certeza que deseja desconectar o WhatsApp{' '}
                <strong className="text-white font-bold">
                  "{disconnectModalSession.label || disconnectModalSession.sessionId}"
                </strong>
                ?
              </p>
              <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-xl text-xs text-amber-300 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <span className="leading-relaxed">
                  Ao desconectar, o envio de mensagens e campanhas automáticas para este número será suspenso até que um novo QR Code seja lido.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1e2636]">
              <button
                type="button"
                onClick={() => setDisconnectModalSession(null)}
                disabled={isDisconnecting}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDisconnect}
                disabled={isDisconnecting}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg disabled:opacity-50"
              >
                {isDisconnecting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                Desconectar Conta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirmar Exclusão */}
      {deleteModalSession && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1119] border border-[#1e2636] w-full max-w-md rounded-2xl p-6 space-y-5 shadow-2xl relative animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-[#1e2636]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-400" />
                Excluir Conta do WhatsApp
              </h3>
              <button
                onClick={() => setDeleteModalSession(null)}
                className="text-stone-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-stone-300 leading-relaxed">
                Tem certeza que deseja excluir permanentemente a conta{' '}
                <strong className="text-white font-bold">
                  "{deleteModalSession.label || deleteModalSession.sessionId}"
                </strong>
                ?
              </p>
              <div className="bg-red-500/10 border border-red-500/20 p-3.5 rounded-xl text-xs text-red-300 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <span className="leading-relaxed">
                  Esta ação é irreversível. A conexão deste número será removida permanentemente do seu painel.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1e2636]">
              <button
                type="button"
                onClick={() => setDeleteModalSession(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg disabled:opacity-50"
              >
                {isDeleting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Sim, Excluir Conta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
