import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { WaGroup, WaSession, ApiKeysConfig } from '../types';
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
  Smartphone,
} from 'lucide-react';

interface WhatsAppAutomationTabProps {
  uid: string;
  apiKeys?: ApiKeysConfig;
}

export const WhatsAppAutomationTab: React.FC<WhatsAppAutomationTabProps> = ({ uid, apiKeys }) => {
  const [activeSubTab, setActiveSubTab] = useState<'campaigns' | 'groups' | 'queue-logs'>('campaigns');
  const [waGroups, setWaGroups] = useState<WaGroup[]>([]);
  const [waSessions, setWaSessions] = useState<WaSession[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [preselectedGroupId, setPreselectedGroupId] = useState<string | null>(null);

  // Subscribe to waSessions
  useEffect(() => {
    if (!uid) return;

    const q = query(collection(db, 'users', uid, 'waSessions'));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list: WaSession[] = snap.docs.map((d) => ({
          id: d.id,
          sessionId: d.id,
          ...d.data(),
        })) as WaSession[];
        setWaSessions(list);
      },
      (err) => {
        console.error('Erro ao carregar waSessions:', err);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  // Subscribe to waGroups
  useEffect(() => {
    if (!uid) return;
    setLoadingGroups(true);

    const q = query(collection(db, 'users', uid, 'waGroups'));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const uniqueMap = new Map<string, WaGroup>();
        snap.docs.forEach((d) => {
          const data = d.data();
          const gid = data.groupId || d.id;
          const groupObj: WaGroup = {
            id: d.id,
            docId: d.id,
            groupId: gid,
            ...data,
          } as unknown as WaGroup;

          if (!uniqueMap.has(gid)) {
            uniqueMap.set(gid, groupObj);
          }
        });
        const list = Array.from(uniqueMap.values());
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

  const connectedSessionsCount = waSessions.filter((s) => s.status === 'connected').length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner Header */}
      <div className="bg-[#0e1119] border border-[#1e2636] p-5 rounded-2xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-2xl shadow-lg shadow-emerald-950/40">
            <Bot className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              Automação Zap
            </h2>
            <h3 className="text-sm font-semibold text-stone-300 mt-0.5">
              Painel de Automação WhatsApp
            </h3>
          </div>
        </div>

        {/* Contas Conectadas Stat Box */}
        <div className="bg-[#151a26] border border-[#1e2636] p-3.5 rounded-xl text-xs text-stone-300 space-y-1.5 shrink-0 w-full md:w-auto">
          <div className="flex items-center gap-2 text-stone-200 font-bold">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            Contas conectadas: <span className="text-white font-extrabold">{waSessions.length}</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-stone-400 pt-0.5 border-t border-[#1e2636]">
            <span>Ativas: <strong className="text-emerald-400">{connectedSessionsCount}</strong></span>
            <span>Grupos: <strong className="text-blue-400">{waGroups.length}</strong></span>
          </div>
        </div>
      </div>

      {/* WhatsApp Connection Cards (Multi-Sessão) */}
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
          waSessions={waSessions}
          apiKeys={apiKeys}
          preselectedGroupId={preselectedGroupId}
        />
      )}

      {activeSubTab === 'groups' && (
        <WhatsAppGroupsView
          uid={uid}
          waSessions={waSessions}
          onSelectGroupForCampaign={handleSelectGroupForCampaign}
        />
      )}

      {activeSubTab === 'queue-logs' && (
        <WhatsAppQueueLogsView uid={uid} waSessions={waSessions} />
      )}
    </div>
  );
};
