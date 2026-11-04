import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { WaGroup, WaChannel, WaSession, ApiKeysConfig } from '../types';
import { WhatsAppGroupsView } from './WhatsAppAutomation/WhatsAppGroupsView';
import { WhatsAppChannelsView } from './WhatsAppAutomation/WhatsAppChannelsView';
import { WhatsAppCampaignsView } from './WhatsAppAutomation/WhatsAppCampaignsView';
import { WhatsAppQueueLogsView } from './WhatsAppAutomation/WhatsAppQueueLogsView';
import { WhatsAppSessionCard } from './WhatsAppAutomation/WhatsAppSessionCard';
import { WorkerHealthCard } from './WhatsAppAutomation/WorkerHealthCard';
import { Users, Zap, Radio, Clock, ChevronDown, Smartphone } from 'lucide-react';

interface WhatsAppAutomationTabProps {
  uid: string;
  apiKeys?: ApiKeysConfig;
  customTemplates?: any[];
  defaultTemplateId?: string;
}

type Section = 'groups' | 'channels' | 'campaigns' | 'queue-logs';

export const WhatsAppAutomationTab: React.FC<WhatsAppAutomationTabProps> = ({
  uid, apiKeys, customTemplates = [], defaultTemplateId,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<Section>('groups');
  const [waGroups, setWaGroups] = useState<WaGroup[]>([]);
  const [waChannels, setWaChannels] = useState<WaChannel[]>([]);
  const [waSessions, setWaSessions] = useState<WaSession[]>([]);
  const [preselectedGroupId, setPreselectedGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(collection(db, 'users', uid, 'waSessions'),
      snap => setWaSessions(snap.docs.map(d => ({ id: d.id, sessionId: d.id, ...d.data() } as WaSession))),
      err => console.error('[Afiliate] Erro ao buscar sessões:', err.message));
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(collection(db, 'users', uid, 'waGroups'), snap => {
      const unique = new Map<string, WaGroup>();
      snap.docs.forEach(d => {
        const data = d.data();
        const g = { id: d.id, groupId: data.groupId || d.id, ...data } as WaGroup;
        const key = String(g.sessionId || 'legacy') + ':' + g.groupId;
        if (!unique.has(key)) unique.set(key, g);
      });
      setWaGroups([...unique.values()]);
    }, err => console.error('[Afiliate] Erro ao carregar grupos:', err.message));
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(collection(db, 'users', uid, 'waChannels'),
      snap => setWaChannels(snap.docs.map(d => ({ id: d.id, ...d.data() } as WaChannel))),
      err => console.error('[Afiliate] Erro ao carregar canais:', err.message));
  }, [uid]);

  const connected = waSessions.filter(s => s.status === 'connected');
  const connectedIds = new Set(connected.map(s => s.sessionId || s.id || ''));
  const visibleGroups = waGroups.filter(g => g.isActive !== false && !g.hidden &&
    !!g.sessionId && connectedIds.has(g.sessionId));
  const visibleChannels = waChannels.filter(c => connectedIds.has(c.sessionId));
  const myChannels = visibleChannels.filter(c => c.canPost);
  const campaignDestinations: WaGroup[] = [
    ...visibleGroups,
    ...myChannels.map(c => ({
      groupId: c.channelId, sessionId: c.sessionId, name: c.name,
      kind: 'channel' as const, size: 0,
    })),
  ];

  const openCampaign = (destinationId: string) => {
    setPreselectedGroupId(destinationId);
    setActiveSubTab('campaigns');
  };

  const tabs: Array<{ id: Section; title: string; icon: typeof Users; total?: number }> = [
    { id: 'groups', title: 'Grupos', icon: Users, total: visibleGroups.length },
    { id: 'channels', title: 'Canais', icon: Radio, total: visibleChannels.length },
    { id: 'campaigns', title: 'Campanhas', icon: Zap },
    { id: 'queue-logs', title: 'Atividade', icon: Clock },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5 motion-safe:animate-fadeIn pb-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">WhatsApp</h1>
        <p className="text-sm text-[#a6b4c9]">Canais, grupos e campanhas em um só lugar.</p>
      </div>
      <WorkerHealthCard uid={uid} compact />
      <div className="grid grid-cols-3 gap-2">
        {([
          ['Contas', connected.length],
          ['Grupos', visibleGroups.length],
          ['Canais', visibleChannels.length],
        ] as const).map(([label, count]) => (
          <div key={label} className="rounded-xl border border-[#283246] bg-[#101723] px-3 py-3.5">
            <div className="text-[11px] text-[#a6b4c9]">{label}</div>
            <div className="text-xl font-bold text-white mt-0.5">{count}</div>
          </div>
        ))}
      </div>
      <nav aria-label="Áreas do WhatsApp" className="grid grid-cols-4 gap-1.5 border-b border-[#273245] pb-3">
        {tabs.map(({ id, title, icon: Icon, total }) => (
          <button key={id} type="button" onClick={() => setActiveSubTab(id)}
            aria-current={activeSubTab === id ? 'page' : undefined}
            className={'flex flex-col sm:flex-row items-center justify-center gap-1.5 min-w-0 rounded-xl px-1.5 sm:px-3 py-3 text-[11px] sm:text-xs font-semibold transition-colors ' +
              (activeSubTab === id ? 'bg-blue-600 text-white' : 'bg-[#121925] text-[#a6b4c9] hover:bg-[#1c2738]')}>
            <Icon size={18} className="shrink-0" />
            <span className="truncate">{title}{total !== undefined ? ' (' + total + ')' : ''}</span>
          </button>
        ))}
      </nav>

      <section aria-label="Área selecionada">
        {activeSubTab === 'groups' && (
          <WhatsAppGroupsView uid={uid} waSessions={waSessions} onSelectGroupForCampaign={openCampaign} />
        )}
        {activeSubTab === 'channels' && (
          <WhatsAppChannelsView uid={uid} sessions={waSessions} onSelectChannel={openCampaign} />
        )}
        {activeSubTab === 'campaigns' && (
          <WhatsAppCampaignsView
            uid={uid} waGroups={campaignDestinations} waSessions={waSessions}
            apiKeys={apiKeys} preselectedGroupId={preselectedGroupId}
            customTemplates={customTemplates} defaultTemplateId={defaultTemplateId}
          />
        )}
        {activeSubTab === 'queue-logs' && (
          <WhatsAppQueueLogsView uid={uid} waSessions={waSessions} />
        )}
      </section>

      <details className="rounded-xl border border-[#293246] bg-[#0e1119] group">
        <summary className="flex cursor-pointer list-none select-none items-center justify-between gap-2 px-4 py-3.5 text-sm text-white font-semibold focus-visible:outline focus-visible:outline-blue-400">
          <span className="flex items-center gap-2"><Smartphone size={17} className="text-blue-400" /> Gerenciar contas</span>
          <span className="flex items-center gap-2 text-xs text-[#a6b4c9]">
            {connected.length} conectada(s) <ChevronDown size={16} className="group-open:rotate-180 transition-transform" />
          </span>
        </summary>
        <div className="p-3 border-t border-[#293246]">
          <WhatsAppSessionCard uid={uid} compact waGroupsCount={visibleGroups.length} />
        </div>
      </details>
    </div>
  );
};
