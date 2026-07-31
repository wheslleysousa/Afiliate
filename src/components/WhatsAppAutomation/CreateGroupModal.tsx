import React, { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { WaSession } from '../../types';
import {
  Users,
  Plus,
  X,
  Smartphone,
  Info,
  CheckCircle2,
  RefreshCw,
  Globe2,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react';
import { WhatsAppAlert } from './WhatsAppAlert';

interface CreateGroupModalProps {
  uid: string;
  waSessions: WaSession[];
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  uid,
  waSessions,
  onClose,
  onSuccess,
}) => {
  const [type, setType] = useState<'group' | 'community'>('group');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    waSessions.find((s) => s.status === 'connected')?.sessionId ||
      waSessions[0]?.sessionId ||
      ''
  );
  const [participantsInput, setParticipantsInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const connectedSessions = waSessions.filter((s) => s.status === 'connected');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Por favor, informe o nome do grupo ou comunidade.');
      return;
    }

    if (!selectedSessionId) {
      setErrorMessage('Selecione uma conta de WhatsApp conectada para ser a criadora do grupo.');
      return;
    }

    setLoading(true);

    try {
      // Process initial participants string into clean numbers array
      const rawNumbers = participantsInput
        .split(/[\n,;]+/)
        .map((num) => num.replace(/\D/g, '').trim())
        .filter((num) => num.length >= 10);

      const tempId = `group_req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      // Save request to Firestore under users/{uid}/waGroups
      await setDoc(doc(db, 'users', uid, 'waGroups', tempId), {
        groupId: tempId,
        sessionId: selectedSessionId,
        name: name.trim(),
        description: description.trim() || null,
        type,
        status: 'pending_creation',
        initialParticipants: rawNumbers,
        isAdmin: true,
        participantsCount: rawNumbers.length + 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao solicitar criação do grupo:', err);
      setErrorMessage(
        err?.message ||
          'Não foi possível salvar a solicitação de criação de grupo. Tente novamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0e1119] border border-[#1e2636] w-full max-w-lg rounded-2xl p-6 space-y-5 shadow-2xl relative animate-fadeIn max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-[#1e2636]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Criar Grupo ou Comunidade</h3>
              <p className="text-xs text-stone-400">
                O grupo será criado no seu WhatsApp através da sessão conectada.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-lg bg-[#151a26]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <WhatsAppAlert
            type="error"
            title="Erro ao Criar Grupo"
            message={errorMessage}
            onClose={() => setErrorMessage(null)}
          />
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo: Grupo vs Comunidade */}
          <div>
            <label className="block text-xs font-bold text-stone-300 mb-2">
              Tipo de Estrutura
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('group')}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between space-y-2 ${
                  type === 'group'
                    ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-lg'
                    : 'bg-[#151a26] border-[#1e2636] text-stone-400 hover:text-stone-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <MessageSquare className="w-5 h-5 text-emerald-400" />
                  {type === 'group' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Grupo de WhatsApp</div>
                  <div className="text-[11px] text-stone-400 mt-0.5">
                    Grupo padrão para disparo de ofertas e interação.
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType('community')}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between space-y-2 ${
                  type === 'community'
                    ? 'bg-blue-500/10 border-blue-500 text-white shadow-lg'
                    : 'bg-[#151a26] border-[#1e2636] text-stone-400 hover:text-stone-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Globe2 className="w-5 h-5 text-blue-400" />
                  {type === 'community' && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Comunidade de Canais</div>
                  <div className="text-[11px] text-stone-400 mt-0.5">
                    Comunidade central para agrupar múltiplos subgrupos.
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Nome */}
          <div>
            <label className="block text-xs font-bold text-stone-300 mb-1.5">
              Nome do {type === 'group' ? 'Grupo' : 'Comunidade'} *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === 'group' ? 'Ex: Achadinhos e Ofertas VIP #1' : 'Ex: Central de Promoções Shein & Shopee'}
              className="w-full bg-[#151a26] border border-[#1e2636] text-white text-xs px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-bold text-stone-300 mb-1.5">
              Descrição / Regras (Opcional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o propósito do grupo, regras de convívio ou horários de postagem de ofertas..."
              className="w-full bg-[#151a26] border border-[#1e2636] text-white text-xs px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          {/* WhatsApp Sessão Criadora */}
          <div>
            <label className="block text-xs font-bold text-stone-300 mb-1.5 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              Conta do WhatsApp Criadora *
            </label>

            {connectedSessions.length === 0 ? (
              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl text-xs text-amber-200 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Nenhum WhatsApp conectado. Conecte um WhatsApp primeiro antes de criar o grupo.</span>
              </div>
            ) : (
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="w-full bg-[#151a26] border border-[#1e2636] text-white text-xs px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500"
              >
                {connectedSessions.map((s) => {
                  const sId = s.sessionId || s.id || '';
                  return (
                    <option key={sId} value={sId}>
                      {s.label || 'WhatsApp'} ({s.phoneNumber ? `+${s.phoneNumber}` : 'Conectado'})
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* Contatos Iniciais */}
          <div>
            <label className="block text-xs font-bold text-stone-300 mb-1.5">
              Adicionar Participantes Iniciais (Opcional)
            </label>
            <textarea
              rows={2}
              value={participantsInput}
              onChange={(e) => setParticipantsInput(e.target.value)}
              placeholder="Digite os números de celular com DDD (ex: 5511999998888, 5521988887777)"
              className="w-full bg-[#151a26] border border-[#1e2636] text-white text-xs px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500 resize-none font-mono text-[11px]"
            />
            <p className="text-[11px] text-stone-500 mt-1">
              Você pode adicionar membros agora ou convidar via link mais tarde.
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-[#151a26] border border-[#1e2636] p-3 rounded-xl text-xs text-stone-400 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              O worker sincronizado criará o grupo na sua conta selecionada e atribuirá a você o papel de <strong>Administrador</strong> do grupo automaticamente.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1e2636]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || connectedSessions.length === 0}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Criar {type === 'group' ? 'Grupo' : 'Comunidade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
