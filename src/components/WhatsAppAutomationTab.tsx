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
  customTemplates?: any[];
  defaultTemplateId?: string;
}

export const WhatsAppAutomationTab: React.FC<WhatsAppAutomationTabProps> = ({
  uid,
  apiKeys,
  customTemplates = [],
  defaultTemplateId,
}) => {
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

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* WhatsApp Connection Cards (Bloco Unificado com Métricas e Cadastro) */}
      <WhatsAppSessionCard uid={uid} waGroupsCount={waGroups.length} />

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
          customTemplates={customTemplates}
          defaultTemplateId={defaultTemplateId}
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
