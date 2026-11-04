import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
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
  const [excludedGroupIds, setExcludedGroupIds] = useState<Set<string>>(new Set());
  const [waChannels, setWaChannels] = useState<WaChannel[]>([]);
  const [waSessions, setWaSessions] = useState<WaSession[]>([]);
  const [preselectedGroupId, setPreselectedGroupId] = useState<string | null>(null);
  const [hidingGroups, setHidingGroups] = useState(false);
  const [groupActionMessage, setGroupActionMessage] = useState('');

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

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(collection(db, 'users', uid, 'waGroupExclusions'),
      snap => setExcludedGroupIds(new Set(snap.docs.map(d => d.id))),
      err => console.warn('[Afiliate] Não foi possível consultar grupos excluídos:', err.message));
  }, [uid]);

  const connected = waSessions.filter(s => s.status === 'connected');
  const connectedIds = new Set(connected.map(s => s.sessionId || s.id || ''));
  const visibleGroups = waGroups.filter(g => g.isActive === true && g.membershipVerified === true && !g.hidden &&
    !excludedGroupIds.has((g.sessionId || '') + '_' + g.groupId) &&
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

  const hideAllVerifiedGroups = async () => {
    if (!visibleGroups.length || hidingGroups) return;
    if (!window.confirm('Ocultar todos os grupos somente no Afiliate? Isso não sai dos grupos nem apaga as sessões.')) return;
    setHidingGroups(true);
    setGroupActionMessage('');
    try {
      for (let index = 0; index < visibleGroups.length; index += 400) {
        const batch = writeBatch(db);
        for (const g of visibleGroups.slice(index, index + 400)) {
          const id = (g as any).id;
          if (id) batch.set(doc(db, 'users', uid, 'waGroups', id),
            { hidden: true, updatedAt: serverTimestamp() }, { merge: true });
        }
        await batch.commit();
      }
      setGroupActionMessage('Grupos ocultados apenas no Afiliate. Nenhuma conta foi desconectada.');
    } catch (err: any) {
      setGroupActionMessage('Falha ao ocultar grupos: ' + (err?.message || 'tente novamente'));
    } finally {
      setHidingGroups(false);
    }
  };

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
      {connected.some(s => !!s.groupSyncWarning) && (
        <p role="status" className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-3 text-xs leading-relaxed text-amber-200">
          {connected.find(s => s.groupSyncWarning)?.groupSyncWarning}
        </p>
      )}
      {visibleGroups.length === 0 && connected.length > 0 &&
        connected.some(s => s.groupSyncCandidateCount === 0) && (
          <p role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-3 text-xs text-emerald-200">
            Nenhum grupo ativo encontrado na última sincronização. Você pode gerenciar os canais normalmente.
          </p>
        )}
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
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#101723] border border-[#293246] px-3.5 py-3">
              <p className="text-xs text-[#a6b4c9]">Só aparecem como ativos grupos cuja participação foi confirmada.</p>
              {visibleGroups.length > 0 && (
                <button type="button" onClick={hideAllVerifiedGroups} disabled={hidingGroups}
                  className="shrink-0 rounded-lg border border-[#38465d] px-3 py-2 text-xs font-semibold text-[#c8d4e8] disabled:opacity-50">
                  {hidingGroups ? 'Ocultando...' : 'Ocultar todos'}
                </button>
              )}
            </div>
            {groupActionMessage && <p role="status" className="text-xs text-[#b6c7e3]">{groupActionMessage}</p>}
            <WhatsAppGroupsView uid={uid} waSessions={waSessions} onSelectGroupForCampaign={openCampaign} />
          </div>
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
