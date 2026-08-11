import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { WaCampaign, WaGroup, WaSession, ApiKeysConfig } from '../../types';
import { CampaignModal } from './CampaignModal';
import { CampaignPreviewModal } from './CampaignPreviewModal';
import {
  calculateCampaignScheduleStatus,
  getUserLocalTimezone,
} from '../../utils/scheduleUtils';
import {
  Zap,
  Plus,
  Play,
  Pause,
  Edit2,
  Trash2,
  Eye,
  Target,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle2,
  BarChart2,
  Calendar,
  Smartphone,
  Globe,
  Timer,
  Info,
  X,
} from 'lucide-react';

interface WhatsAppCampaignsViewProps {
  uid: string;
  waGroups: WaGroup[];
  waSessions: WaSession[];
  apiKeys?: ApiKeysConfig;
  preselectedGroupId?: string | null;
}

export const WhatsAppCampaignsView: React.FC<WhatsAppCampaignsViewProps> = ({
  uid,
  waGroups,
  waSessions,
  apiKeys,
  preselectedGroupId,
}) => {
  const [campaigns, setCampaigns] = useState<WaCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  // Live ticker that updates every 1 second for real-time countdown
  const [, setNowTick] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<WaCampaign | null>(null);

  const [previewCampaign, setPreviewCampaign] = useState<WaCampaign | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Modal de Exclusão de Campanha
  const [deletingCampaign, setDeletingCampaign] = useState<WaCampaign | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);

    const q = query(
      collection(db, 'users', uid, 'campaigns')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: WaCampaign[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as WaCampaign[];
        
        // Sort by createdAt desc if possible
        setCampaigns(list);
        setLoading(false);
      },
      (err) => {
        console.error('Erro ao buscar campanhas:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  // Handle preselected group from Groups tab
  useEffect(() => {
    if (preselectedGroupId) {
      setEditingCampaign(null);
      setIsModalOpen(true);
    }
  }, [preselectedGroupId]);

  const handleCreateCampaign = () => {
    setEditingCampaign(null);
    setIsModalOpen(true);
  };

  const handleEditCampaign = (camp: WaCampaign) => {
    setEditingCampaign(camp);
    setIsModalOpen(true);
  };

  const handleToggleEnabled = async (camp: WaCampaign) => {
    if (!camp.id || !uid) return;
    try {
      await updateDoc(doc(db, 'users', uid, 'campaigns', camp.id), {
        enabled: !camp.enabled,
      });
    } catch (err) {
      console.error('Erro ao atualizar status da campanha:', err);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingCampaign || !deletingCampaign.id || !uid) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'users', uid, 'campaigns', deletingCampaign.id));
      setDeletingCampaign(null);
    } catch (err) {
      console.error('Erro ao excluir campanha:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const sanitizeFirestoreData = (obj: any): any => {
    if (obj === undefined) return null;
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sanitizeFirestoreData);
    
    const clean: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        clean[key] = sanitizeFirestoreData(val);
      } else {
        clean[key] = null;
      }
    }
    return clean;
  };

  const handleSaveCampaignData = async (data: Partial<WaCampaign>) => {
    if (!uid) return;

    const sanitizedData = sanitizeFirestoreData(data);

    if (editingCampaign && editingCampaign.id) {
      // Update
      await updateDoc(doc(db, 'users', uid, 'campaigns', editingCampaign.id), {
        ...sanitizedData,
        updatedAt: serverTimestamp(),
      });
    } else {
      // Create
      await addDoc(collection(db, 'users', uid, 'campaigns'), {
        ...sanitizedData,
        createdAt: serverTimestamp(),
      });
    }
  };

  const groupMap = new Map(waGroups.map((g) => [g.groupId, g.name]));

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0e1119] p-4 rounded-2xl border border-[#1e2636]">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Disparo Automático ({campaigns.length})
          </h3>
        </div>

        <button
          onClick={handleCreateCampaign}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-blue-950/50 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          Novo Disparo
        </button>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-44 bg-[#0e1119] border border-[#1e2636] rounded-2xl animate-pulse p-4" />
          ))}
        </div>
      )}

      {/* Timezone Selector Bar */}
      <div className="bg-[#151a26] border border-[#1e2636] p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 text-stone-200 font-bold">
          <Globe className="w-4 h-4 text-blue-400 shrink-0" />
          <span>Fuso horário:</span>
          <span className="text-emerald-400 font-mono">{getUserLocalTimezone()}</span>
        </div>
        <p className="text-[11px] text-stone-400">
          O horário dos disparos segue automaticamente o fuso configurado nas regras.
        </p>
      </div>

      {/* Empty State */}
      {!loading && campaigns.length === 0 && (
        <div className="bg-[#0e1119] border border-[#1e2636] p-10 rounded-2xl text-center space-y-3">
          <div className="w-12 h-12 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mx-auto">
            <Zap className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white">Nenhuma campanha configurada</h4>
            <p className="text-xs text-stone-400 max-w-md mx-auto">
              Crie sua primeira regra de disparo automático.
            </p>
          </div>
        </div>
      )}

      {/* Campaign List Grid */}
      {!loading && campaigns.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map((camp, idx) => {
            const targetNames = (camp.targetGroupIds || [])
              .map((id) => groupMap.get(id) || id)
              .join(', ');

            const scheduleStatus = calculateCampaignScheduleStatus(camp.schedule, camp.enabled);

            return (
              <div
                key={camp.id || `camp-${idx}`}
                className={`bg-[#0e1119] border p-5 rounded-2xl transition-all space-y-4 flex flex-col justify-between ${
                  camp.enabled
                    ? 'border-[#1e2636] hover:border-blue-500/50'
                    : 'border-[#1e2636]/60 opacity-75'
                }`}
              >
                {/* Header & Status Toggle */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white truncate">
                        {camp.name}
                      </h4>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                          camp.enabled
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-stone-800 text-stone-400 border-stone-700'
                        }`}
                      >
                        {camp.enabled ? 'Ativa' : 'Pausada'}
                      </span>
                    </div>

                    <div className="text-xs text-stone-400 truncate flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate" title={targetNames}>
                        {camp.targetGroupIds?.length || 0} grupo(s): {targetNames || 'Nenhum'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleEnabled(camp)}
                    className={`p-2 rounded-xl border text-xs font-bold transition-all shrink-0 ${
                      camp.enabled
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
                        : 'bg-stone-800 text-stone-300 border-stone-700 hover:bg-stone-700'
                    }`}
                    title={camp.enabled ? 'Pausar Campanha' : 'Ativar Campanha'}
                  >
                    {camp.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                </div>

                {/* Real-time Countdown & Schedule Status Badge */}
                <div className="bg-[#151a26] p-3 rounded-xl border border-[#1e2636] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400 flex items-center gap-1">
                      <Timer className="w-3.5 h-3.5 text-amber-400" />
                      Contagem Regressiva & Status
                    </span>
                    <span className="text-[10px] font-mono text-stone-500">
                      {scheduleStatus.timezone}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className={`px-2.5 py-1 rounded-lg border text-xs font-black flex items-center gap-1.5 ${scheduleStatus.badgeColor}`}>
                      {scheduleStatus.badgeText}
                    </span>
                    <span className="text-[11px] text-stone-400 font-mono">
                      Agora: {scheduleStatus.currentTimeInTz}
                    </span>
                  </div>

                  <p className="text-[11px] text-stone-400 font-medium">
                    {scheduleStatus.subtext}
                  </p>
                </div>

                {/* Details Badges Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-[#151a26]/50 p-3 rounded-xl border border-[#1e2636]">
                  <div>
                    <span className="text-[10px] text-stone-500 uppercase font-bold block">Objetivo</span>
                    <span className="text-blue-300 font-bold capitalize">
                      {camp.objective.replace('_', ' ')}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-stone-500 uppercase font-bold block">Qtd / Janela</span>
                    <span className="text-stone-200 font-semibold">
                      {camp.quantity} ofertas / {camp.windowMinutes} min
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-stone-500 uppercase font-bold block">Ritmo (Pacing)</span>
                    <span className="text-amber-300 font-semibold capitalize">
                      {camp.pacing} ({camp.minGapSec}s-{camp.maxGapSec}s)
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-stone-500 uppercase font-bold block">Horário</span>
                    <span className="text-stone-300 font-mono text-[11px]">
                      {camp.schedule?.startHour} - {camp.schedule?.endHour}
                    </span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-[#1e2636]">
                  <button
                    onClick={() => {
                      setPreviewCampaign(camp);
                      setIsPreviewOpen(true);
                    }}
                    className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all"
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    Ver Prévia de Envio
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditCampaign(camp)}
                      className="p-1.5 bg-[#151a26] hover:bg-stone-800 text-stone-300 rounded-lg border border-[#1e2636] transition-all"
                      title="Editar"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingCampaign(camp)}
                      className="p-1.5 bg-[#151a26] hover:bg-red-500/20 text-red-400 rounded-lg border border-[#1e2636] hover:border-red-500/30 transition-all"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal CRUD Campanha */}
      <CampaignModal
        campaign={editingCampaign}
        waGroups={waGroups}
        waSessions={waSessions}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveCampaignData}
      />

      {/* Modal Prévia Próximos Envios */}
      {previewCampaign && (
        <CampaignPreviewModal
          campaign={previewCampaign}
          uid={uid}
          waGroups={waGroups}
          apiKeys={apiKeys}
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
        />
      )}

      {/* Modal Popup de Confirmação de Exclusão */}
      {deletingCampaign && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="max-w-md w-full bg-[#151a26] border border-red-500/30 rounded-2xl p-6 shadow-2xl space-y-5 text-center relative">
            <button
              onClick={() => setDeletingCampaign(null)}
              className="absolute top-4 right-4 text-stone-400 hover:text-white p-1 rounded-lg hover:bg-[#1e2636] transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-14 h-14 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Excluir Campanha?</h3>
              <p className="text-xs text-stone-300 leading-relaxed">
                Tem certeza de que deseja excluir a campanha{' '}
                <strong className="text-white font-semibold">"{deletingCampaign.name}"</strong>?
              </p>
              <div className="p-3 bg-[#0e1119] border border-[#1e2636] rounded-xl text-left text-[11px] text-stone-400">
                ⚠️ <strong className="text-stone-300">Atenção:</strong> Esta ação é irreversível. O robô no Termux interromperá os disparos automáticos associados a esta campanha imediatamente.
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCampaign(null)}
                disabled={isDeleting}
                className="flex-1 bg-[#0e1119] hover:bg-[#1e2636] border border-[#1e2636] text-stone-300 font-semibold py-2.5 px-4 rounded-xl text-xs transition-all"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 disabled:opacity-50"
              >
                {isDeleting ? (
                  <span>Excluindo...</span>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Sim, Excluir
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
