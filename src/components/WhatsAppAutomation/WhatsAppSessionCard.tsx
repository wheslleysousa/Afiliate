import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { WaSession } from '../../types';
import { QRCodeSVG } from 'qrcode.react';
import {
  QrCode,
  Wifi,
  WifiOff,
  RefreshCw,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Phone,
  Edit3,
  Save,
  Terminal,
  Server,
  Zap,
} from 'lucide-react';

interface WhatsAppSessionCardProps {
  uid: string;
}

export const WhatsAppSessionCard: React.FC<WhatsAppSessionCardProps> = ({ uid }) => {
  const [session, setSession] = useState<WaSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelInput, setLabelInput] = useState('');
  const [isSavingLabel, setIsSavingLabel] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Escutar em tempo real o documento doc(db, 'users', uid, 'waSession', 'current')
  useEffect(() => {
    if (!uid) return;
    setLoading(true);

    const sessionRef = doc(db, 'users', uid, 'waSession', 'current');

    const unsubscribe = onSnapshot(
      sessionRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as WaSession;
          setSession(data);
          if (!editingLabel) {
            setLabelInput(data.label || '');
          }
        } else {
          setSession({ status: 'disconnected' });
        }
        setLoading(false);
      },
      (err) => {
        console.error('Erro ao escutar sessão do WhatsApp:', err);
        setSession({ status: 'disconnected' });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  const handleSaveLabel = async () => {
    if (!uid) return;
    setIsSavingLabel(true);
    try {
      const sessionRef = doc(db, 'users', uid, 'waSession', 'current');
      await setDoc(sessionRef, { label: labelInput.trim() || null }, { merge: true });
      setEditingLabel(false);
    } catch (err) {
      console.error('Erro ao salvar apelido da conexão:', err);
    } finally {
      setIsSavingLabel(false);
    }
  };

  const handleRequestLogout = async () => {
    if (!uid) return;
    if (!window.confirm('Tem certeza que deseja desconectar a conta de WhatsApp do Worker?')) return;

    setIsDisconnecting(true);
    try {
      const sessionRef = doc(db, 'users', uid, 'waSession', 'current');
      await setDoc(sessionRef, { requestedLogout: true }, { merge: true });
    } catch (err) {
      console.error('Erro ao solicitar desconexão:', err);
    } finally {
      setTimeout(() => setIsDisconnecting(false), 3000);
    }
  };

  const status = session?.status || 'disconnected';

  return (
    <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-6 relative overflow-hidden shadow-xl">
      {/* Background Subtle Gradient */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#1e2636]">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Conexão do WhatsApp (Baileys)</h3>
              {status === 'connected' && (
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Conectado
                </span>
              )}
              {status === 'qr' && (
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <QrCode className="w-3 h-3 animate-pulse" />
                  Aguardando Leitura
                </span>
              )}
              {status === 'connecting' && (
                <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Conectando...
                </span>
              )}
              {status === 'disconnected' && (
                <span className="bg-stone-800 text-stone-400 border border-stone-700 text-[11px] font-bold px-2 py-0.5 rounded-full">
                  Desconectado
                </span>
              )}
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Escaneie o QR Code diretamente no aplicativo para conectar a conta do worker.
            </p>
          </div>
        </div>

        {/* Status indicator on top right */}
        {status === 'connected' && (
          <button
            onClick={handleRequestLogout}
            disabled={isDisconnecting}
            className="self-start sm:self-center px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50"
          >
            {isDisconnecting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LogOut className="w-3.5 h-3.5" />
            )}
            Desconectar
          </button>
        )}
      </div>

      {/* Main Card Content Body */}
      <div className="pt-5">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-stone-400 space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-xs">Sincronizando estado da sessão com o Firestore...</p>
          </div>
        ) : status === 'qr' && session?.qr ? (
          /* STATE 1: QR CODE READY TO SCAN */
          <div className="flex flex-col md:flex-row items-center gap-8 bg-[#151a26] border border-[#1e2636] p-6 rounded-xl">
            <div className="bg-white p-4 rounded-2xl shadow-2xl shrink-0 border-4 border-emerald-500/30">
              <QRCodeSVG
                value={session.qr}
                size={220}
                level="M"
                includeMargin={false}
              />
            </div>

            <div className="space-y-4 text-left">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <QrCode className="w-5 h-5 animate-bounce" />
                Escaneie o QR Code abaixo no seu WhatsApp Dedicado
              </div>

              <ol className="space-y-2.5 text-xs text-stone-300 list-decimal list-inside bg-[#0e1119] p-4 rounded-xl border border-[#1e2636]">
                <li>
                  Abra o <strong>WhatsApp</strong> no seu celular dedicado.
                </li>
                <li>
                  Acesse <strong>Aparelhos conectados</strong> no menu superior (três pontos) ou Configurações.
                </li>
                <li>
                  Toque em <strong>Conectar um aparelho</strong> e aponte a câmera para o QR Code ao lado.
                </li>
                <li>
                  Aguarde a confirmação automática sem fechar esta tela.
                </li>
              </ol>

              <p className="text-[11px] text-stone-500 italic flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin text-emerald-500" />
                O QR Code atualiza dinamicamente a cada poucas segundos via worker.
              </p>
            </div>
          </div>
        ) : status === 'connecting' ? (
          /* STATE 2: CONNECTING SPINNER */
          <div className="py-10 bg-[#151a26] border border-[#1e2636] rounded-xl flex flex-col items-center justify-center text-center space-y-3">
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full animate-pulse">
              <RefreshCw className="w-8 h-8 animate-spin" />
            </div>
            <h4 className="text-sm font-bold text-white">Estabelecendo conexão com os servidores do WhatsApp...</h4>
            <p className="text-xs text-stone-400 max-w-md">
              O worker recebeu a autorização e está abrindo o socket de comunicação. Aguarde alguns instantes.
            </p>
          </div>
        ) : status === 'connected' ? (
          /* STATE 3: CONNECTED SUCCESS STATE */
          <div className="space-y-4">
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-5 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-extrabold text-white">
                      {session.label || session.name || 'Sessão Conectada'}
                    </h4>
                    {session.label && session.name && (
                      <span className="text-xs text-stone-400">({session.name})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-stone-300 mt-1">
                    <span className="flex items-center gap-1 text-emerald-300 font-mono font-bold">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      +{session.phoneNumber || 'Número ativo'}
                    </span>
                    <span className="text-stone-500">•</span>
                    <span className="text-stone-400 text-[11px]">
                      Sincronizado via Baileys Worker
                    </span>
                  </div>
                </div>
              </div>

              {/* Editable Label / Apelido da Conexão */}
              <div className="w-full md:w-auto bg-[#0e1119] border border-[#1e2636] p-2.5 rounded-xl flex items-center gap-2 shrink-0">
                {editingLabel ? (
                  <>
                    <input
                      type="text"
                      value={labelInput}
                      onChange={(e) => setLabelInput(e.target.value)}
                      placeholder="Ex: Zap Vendas 01"
                      className="bg-[#151a26] border border-[#2a3447] text-white text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500 w-40"
                    />
                    <button
                      onClick={handleSaveLabel}
                      disabled={isSavingLabel}
                      className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all"
                      title="Salvar Apelido"
                    >
                      <Save className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-stone-400">Apelido:</span>
                    <strong className="text-white font-medium">
                      {session.label || 'Nenhum definido'}
                    </strong>
                    <button
                      onClick={() => setEditingLabel(true)}
                      className="text-stone-400 hover:text-emerald-400 transition-colors p-1"
                      title="Editar apelido desta conexão"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* STATE 4: DISCONNECTED / WORKER NOT RUNNING NOTICE */
          <div className="bg-[#151a26] border border-[#1e2636] p-5 rounded-xl space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl shrink-0 mt-0.5">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-white">
                  Worker WhatsApp não conectado
                </h4>
                <p className="text-xs text-stone-300 leading-relaxed">
                  Para gerar o QR Code e realizar os disparos automáticos, certifique-se de que o{' '}
                  <strong className="text-emerald-400">Afiliate Worker Node.js</strong> está rodando no seu celulal (Termux) ou em seu servidor/VPS.
                </p>
              </div>
            </div>

            <div className="bg-[#0e1119] border border-[#1e2636] p-3.5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-stone-400">
              <div className="flex items-center gap-2 font-mono text-[11px] text-stone-300">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>cd whatsapp-worker && node index.js</span>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-stone-400">
                <Server className="w-3.5 h-3.5 text-blue-400" />
                <span>O QR Code é transmitido em tempo real pelo worker</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
