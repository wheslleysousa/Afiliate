import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { WaGroup, ApiKeysConfig } from '../types';
import { WhatsAppGroupsView } from './WhatsAppAutomation/WhatsAppGroupsView';
import { WhatsAppCampaignsView } from './WhatsAppAutomation/WhatsAppCampaignsView';
import { WhatsAppQueueLogsView } from './WhatsAppAutomation/WhatsAppQueueLogsView';
import { WhatsAppSessionCard } from './WhatsAppAutomation/WhatsAppSessionCard';
import {
  MessageSquare,
  Users,
  Zap,
  Clock,
  Radio,
  Info,
  CheckCircle2,
  AlertCircle,
  Bot,
  RefreshCw,
} from 'lucide-react';

interface WhatsAppAutomationTabProps {
  uid: string;
  apiKeys?: ApiKeysConfig;
}

export const WhatsAppAutomationTab: React.FC<WhatsAppAutomationTabProps> = ({ uid, apiKeys }) => {
  const [activeSubTab, setActiveSubTab] = useState<'campaigns' | 'groups' | 'queue-logs'>('campaigns');
  const [waGroups, setWaGroups] = useState<WaGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [preselectedGroupId, setPreselectedGroupId] = useState<string | null>(null);

  // Subscribe to waGroups
  useEffect(() => {
    if (!uid) return;
    setLoadingGroups(true);

    const q = query(collection(db, 'users', uid, 'waGroups'));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list: WaGroup[] = snap.docs.map((d) => ({
          groupId: d.id,
          ...d.data(),
        })) as WaGroup[];
        setWaGroups(list);
        setLoadingGroups(false);
      },
      (err) => {
        console.error('Erro ao carregar waGroups no container:', err);
        setLoadingGroups(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  const handleSelectGroupForCampaign = (groupId: string) => {
    setPreselectedGroupId(groupId);
    setActiveSubTab('campaigns');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner Header */}
      <div className="bg-[#0e1119] border border-[#1e2636] p-6 rounded-2xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 relative z-10 max-w-2xl">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-2xl shadow-lg shadow-emerald-950/40">
              <Bot className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-white tracking-tight">
                  Painel de Automação de Disparo
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  WhatsApp Worker Sync
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                Configure regras de disparo automático, ritmo antiban, horários e acompanhe a fila e logs em tempo real via Firestore.
              </p>
            </div>
          </div>
        </div>

        {/* Worker Status Box */}
        <div className="bg-[#151a26] border border-[#1e2636] p-3.5 rounded-xl text-xs text-stone-300 space-y-1 shrink-0 w-full md:w-auto">
          <div className="flex items-center gap-2 text-stone-200 font-bold">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            Sincronização em Tempo Real
          </div>
          <div className="text-[11px] text-stone-400">
            Grupos detectados: <strong className="text-emerald-400">{waGroups.length}</strong>
          </div>
        </div>

        {/* Subtle Background Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* WhatsApp Connection Card (QR Code / Status) */}
      <WhatsAppSessionCard uid={uid} />

      {/* Subtab Selector */}
      <div className="flex items-center gap-2 border-b border-[#1e2636] pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('campaigns')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeSubTab === 'campaigns'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/50'
              : 'bg-[#0e1119] text-stone-400 hover:text-white border border-[#1e2636]'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-400" />
          Automação / Disparos
        </button>

        <button
          onClick={() => setActiveSubTab('groups')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeSubTab === 'groups'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/50'
              : 'bg-[#0e1119] text-stone-400 hover:text-white border border-[#1e2636]'
          }`}
        >
          <Users className="w-4 h-4 text-emerald-400" />
          Grupos ({waGroups.length})
        </button>

        <button
          onClick={() => setActiveSubTab('queue-logs')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeSubTab === 'queue-logs'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/50'
              : 'bg-[#0e1119] text-stone-400 hover:text-white border border-[#1e2636]'
          }`}
        >
          <Clock className="w-4 h-4 text-blue-400" />
          Fila & Logs
        </button>
      </div>

      {/* Active Subtab Content */}
      {activeSubTab === 'campaigns' && (
        <WhatsAppCampaignsView
          uid={uid}
          waGroups={waGroups}
          apiKeys={apiKeys}
          preselectedGroupId={preselectedGroupId}
        />
      )}

      {activeSubTab === 'groups' && (
        <WhatsAppGroupsView
          uid={uid}
          onSelectGroupForCampaign={handleSelectGroupForCampaign}
        />
      )}

      {activeSubTab === 'queue-logs' && <WhatsAppQueueLogsView uid={uid} />}
    </div>
  );
};
