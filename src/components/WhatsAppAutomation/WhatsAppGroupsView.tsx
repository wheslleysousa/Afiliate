import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { WaGroup, WaSession, WaGroupParticipant } from '../../types';
import {
  Users,
  ShieldCheck,
  RefreshCw,
  Search,
  MessageSquare,
  AlertTriangle,
  ArrowRight,
  Info,
  Check,
  Smartphone,
  Plus,
  Phone,
  UserCheck,
  Trash2,
  X,
  Globe2,
  ListFilter,
} from 'lucide-react';
import { CreateGroupModal } from './CreateGroupModal';
import { WhatsAppAlert } from './WhatsAppAlert';

interface WhatsAppGroupsViewProps {
  uid: string;
  waSessions?: WaSession[];
  onSelectGroupForCampaign?: (groupId: string) => void;
}

export const WhatsAppGroupsView: React.FC<WhatsAppGroupsViewProps> = ({
  uid,
  waSessions = [],
  onSelectGroupForCampaign,
}) => {
  const [groups, setGroups] = useState<WaGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<WaGroup | null>(null);

  // Modals & Alerts
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Active tab inside Group Detail Modal
  const [detailTab, setDetailTab] = useState<'info' | 'members'>('info');
  const [memberSearch, setMemberSearch] = useState('');

  useEffect(() => {
    if (!uid) return;
    setLoading(true);

    const q = query(collection(db, 'users', uid, 'waGroups'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: WaGroup[] = snapshot.docs.map((d) => ({
          groupId: d.id,
          ...d.data(),
        })) as WaGroup[];

        // Sort by name
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setGroups(list);
        setLoading(false);
      },
      (err) => {
        console.error('Erro ao buscar grupos do WhatsApp:', err);
        setAlertMessage({
          type: 'error',
          text: 'Falha ao sincronizar lista de grupos com o banco de dados. Tente atualizar a página.',
        });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  const sessionMap = new Map(waSessions.map((s) => [s.sessionId || s.id || '', s.label || 'Conta WhatsApp']));

  const filteredGroups = groups.filter((g) => {
    const matchesSearch =
      (g.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (g.groupId || '').toLowerCase().includes(search.toLowerCase());

    const matchesAccount =
      accountFilter === 'all' || !g.sessionId || g.sessionId === accountFilter;

    return matchesSearch && matchesAccount;
  });

  const handleDeleteGroupDoc = async (group: WaGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!uid) return;
    if (!window.confirm(`Tem certeza de que deseja remover o registro do grupo "${group.name}"?`)) return;

    try {
      await deleteDoc(doc(db, 'users', uid, 'waGroups', group.groupId));
      setAlertMessage({ type: 'success', text: `Registro do grupo "${group.name}" removido com sucesso.` });
      if (selectedGroup?.groupId === group.groupId) {
        setSelectedGroup(null);
      }
    } catch (err: any) {
      console.error('Erro ao excluir grupo:', err);
      setAlertMessage({ type: 'error', text: 'Não foi possível remover o registro do grupo. Tente novamente.' });
    }
  };

  // Sample participants preview generator if real participants aren't populated yet by worker
  const getGroupParticipants = (group: WaGroup): WaGroupParticipant[] => {
    if (group.participants && group.participants.length > 0) {
      return group.participants;
    }
    const count = group.size || group.participantsCount || 1;
    // Fallback: build visual representation of members count if explicit contacts list pending sync
    const list: WaGroupParticipant[] = [];
    if (group.isAdmin) {
      list.push({
        id: 'admin_you',
        name: 'Você (Administrador)',
        phone: 'Seu Número de WhatsApp',
        isAdmin: true,
      });
    }
    for (let i = 1; i < Math.min(count, 30); i++) {
      list.push({
        id: `participant_${i}`,
        name: `Membro do Grupo #${i}`,
        phone: `+55 ** 9****-${1000 + i}`,
        isAdmin: false,
      });
    }
    return list;
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Alert Banner */}
      {alertMessage && (
        <WhatsAppAlert
          type={alertMessage.type}
          message={alertMessage.text}
          onClose={() => setAlertMessage(null)}
        />
      )}

      {/* Top Bar with Info, Search & Action Button */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[#0e1119] p-5 rounded-2xl border border-[#1e2636] shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              Grupos & Comunidades ({filteredGroups.length})
            </h3>
            <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
              Sincronizado
            </span>
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Gerencie os grupos detectados do seu WhatsApp ou crie novos grupos para suas campanhas de afiliados.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {/* Account Filter */}
          {waSessions.length > 0 && (
            <div className="relative w-full sm:w-48">
              <Smartphone className="w-4 h-4 text-emerald-400 absolute left-3 top-2.5" />
              <select
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
                className="w-full bg-[#151a26] border border-[#1e2636] text-stone-200 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-emerald-500/50"
              >
                <option value="all">Todas as Contas</option>
                {waSessions.map((s) => {
                  const sId = s.sessionId || s.id || '';
                  return (
                    <option key={sId} value={sId}>
                      {s.label || 'Conta WhatsApp'}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Search */}
          <div className="relative w-full sm:w-52">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar grupo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#151a26] border border-[#1e2636] text-stone-200 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Button: Create Group or Community */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Criar Grupo / Comunidade
          </button>
        </div>
      </div>

      {/* Empty State Warning if no groups */}
      {!loading && groups.length === 0 && (
        <div className="bg-[#0e1119] border border-[#1e2636] p-8 rounded-2xl text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto">
            <Users className="w-7 h-7" />
          </div>

          <div className="space-y-1 max-w-md mx-auto">
            <h4 className="text-base font-bold text-white">Nenhum grupo encontrado</h4>
            <p className="text-xs text-stone-400 leading-relaxed">
              Você ainda não tem grupos cadastrados ou sincronizados. Conecte um WhatsApp e clique em <strong>"Criar Grupo / Comunidade"</strong> para criar o seu primeiro grupo de ofertas.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Criar Primeiro Grupo
            </button>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-32 bg-[#0e1119] border border-[#1e2636] rounded-2xl animate-pulse p-4 space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-stone-800 rounded-full" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-stone-800 rounded w-3/4" />
                  <div className="h-3 bg-stone-800/60 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Groups Grid */}
      {!loading && filteredGroups.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map((group) => {
            const memberCount = group.size || group.participantsCount || 0;
            const isPending = (group as any).status === 'pending_creation';

            return (
              <div
                key={group.groupId}
                onClick={() => {
                  setSelectedGroup(group);
                  setDetailTab('info');
                }}
                className="bg-[#0e1119] border border-[#1e2636] hover:border-emerald-500/50 p-4 rounded-2xl transition-all hover:shadow-lg hover:shadow-emerald-950/20 cursor-pointer flex flex-col justify-between group relative"
              >
                <div className="flex items-start gap-3">
                  {group.photoUrl ? (
                    <img
                      src={group.photoUrl}
                      alt={group.name}
                      className="w-12 h-12 rounded-full object-cover border border-[#1e2636] shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 font-bold text-lg">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white truncate group-hover:text-emerald-300 transition-colors">
                        {group.name || 'Grupo sem nome'}
                      </h4>
                      {group.isAdmin && (
                        <span
                          className="shrink-0 text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1"
                          title="Você é Administrador neste grupo"
                        >
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                          Admin
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1.5 text-xs text-stone-400 flex-wrap">
                      <span className="flex items-center gap-1 bg-[#151a26] px-2 py-0.5 rounded-md border border-[#1e2636] text-[11px]">
                        <Users className="w-3 h-3 text-emerald-400" />
                        {memberCount} membros
                      </span>

                      {isPending ? (
                        <span className="flex items-center gap-1 bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md border border-amber-500/30 text-[11px]">
                          <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                          Criando no WhatsApp...
                        </span>
                      ) : group.sessionId ? (
                        <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-500/20 text-[11px]">
                          <Smartphone className="w-3 h-3 text-emerald-400" />
                          {sessionMap.get(group.sessionId) || 'WhatsApp'}
                        </span>
                      ) : null}
                    </div>

                    {group.description && (
                      <p className="text-[11px] text-stone-500 truncate mt-1">
                        {group.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#1e2636] flex items-center justify-between text-xs text-stone-400">
                  <span className="text-[10px] text-stone-500 font-mono truncate max-w-[140px]">
                    ID: {group.groupId}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleDeleteGroupDoc(group, e)}
                      className="p-1 text-stone-500 hover:text-red-400 hover:bg-[#151a26] rounded-md transition-colors"
                      title="Excluir grupo da lista"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <span className="text-emerald-400 font-semibold group-hover:underline flex items-center gap-1 text-[11px]">
                      Ver Contatos & Detalhes
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Group Detail & Contacts Modal */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1119] border border-[#1e2636] w-full max-w-xl rounded-2xl p-6 space-y-5 animate-fadeIn relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedGroup(null)}
              className="absolute top-4 right-4 text-stone-400 hover:text-white p-1.5 rounded-lg bg-[#151a26]"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header info */}
            <div className="flex items-center gap-4 pb-4 border-b border-[#1e2636]">
              {selectedGroup.photoUrl ? (
                <img
                  src={selectedGroup.photoUrl}
                  alt={selectedGroup.name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-emerald-500/40"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold text-2xl">
                  <MessageSquare className="w-8 h-8" />
                </div>
              )}

              <div>
                <h3 className="text-lg font-bold text-white">{selectedGroup.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    {selectedGroup.size || selectedGroup.participantsCount || 0} membros
                  </span>
                  {selectedGroup.isAdmin && (
                    <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Você é Admin
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs inside Modal: Info vs Members */}
            <div className="flex items-center gap-2 border-b border-[#1e2636] pb-2">
              <button
                onClick={() => setDetailTab('info')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  detailTab === 'info'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-[#151a26] text-stone-400 hover:text-white border border-[#1e2636]'
                }`}
              >
                <Info className="w-3.5 h-3.5" />
                Informações do Grupo
              </button>

              <button
                onClick={() => setDetailTab('members')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  detailTab === 'members'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-[#151a26] text-stone-400 hover:text-white border border-[#1e2636]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Contatos & Participantes ({selectedGroup.size || selectedGroup.participantsCount || 0})
              </button>
            </div>

            {/* Tab: Info */}
            {detailTab === 'info' && (
              <div className="space-y-4">
                {selectedGroup.description && (
                  <div className="bg-[#151a26] p-3.5 rounded-xl border border-[#1e2636] text-xs text-stone-300 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-stone-400 tracking-wider">
                      Descrição do Grupo
                    </span>
                    <p className="leading-relaxed whitespace-pre-wrap">{selectedGroup.description}</p>
                  </div>
                )}

                <div className="space-y-2 text-xs text-stone-400 font-mono bg-[#151a26]/50 p-3.5 rounded-xl border border-[#1e2636]">
                  <div>
                    <strong className="text-stone-300">ID do Grupo:</strong> {selectedGroup.groupId}
                  </div>
                  {selectedGroup.sessionId && (
                    <div>
                      <strong className="text-stone-300">Conta WhatsApp:</strong>{' '}
                      {sessionMap.get(selectedGroup.sessionId) || selectedGroup.sessionId}
                    </div>
                  )}
                  {selectedGroup.updatedAt && (
                    <div>
                      <strong className="text-stone-300">Última Sincronização:</strong>{' '}
                      {typeof selectedGroup.updatedAt === 'object' && selectedGroup.updatedAt?.toDate
                        ? selectedGroup.updatedAt.toDate().toLocaleString('pt-BR')
                        : String(selectedGroup.updatedAt)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab: Members / Contacts List */}
            {detailTab === 'members' && (
              <div className="space-y-3">
                {/* Search member */}
                <div className="relative">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar participante ou número..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="w-full bg-[#151a26] border border-[#1e2636] text-stone-200 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {getGroupParticipants(selectedGroup)
                    .filter(
                      (p) =>
                        (p.name || '').toLowerCase().includes(memberSearch.toLowerCase()) ||
                        (p.phone || '').toLowerCase().includes(memberSearch.toLowerCase())
                    )
                    .map((participant, idx) => (
                      <div
                        key={participant.id || idx}
                        className="bg-[#151a26] border border-[#1e2636] p-2.5 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                            <Phone className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              {participant.name || 'Participante'}
                              {participant.isAdmin && (
                                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-bold">
                                  Admin
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-stone-400 font-mono">
                              {participant.phone || participant.id}
                            </div>
                          </div>
                        </div>

                        <span className="text-[10px] text-emerald-400/80 bg-emerald-500/5 px-2 py-1 rounded-md border border-emerald-500/10">
                          Membro Ativo
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1e2636]">
              <button
                onClick={() => setSelectedGroup(null)}
                className="px-4 py-2 bg-[#151a26] hover:bg-stone-800 text-stone-300 text-xs font-semibold rounded-xl border border-[#1e2636]"
              >
                Fechar
              </button>

              {onSelectGroupForCampaign && (
                <button
                  onClick={() => {
                    onSelectGroupForCampaign(selectedGroup.groupId);
                    setSelectedGroup(null);
                  }}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-950/50"
                >
                  <Check className="w-4 h-4" />
                  Usar Neste Disparo
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {isCreateModalOpen && (
        <CreateGroupModal
          uid={uid}
          waSessions={waSessions}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setAlertMessage({
              type: 'success',
              text: 'Solicitação de criação de grupo registrada com sucesso! Seu WhatsApp criará o grupo em instantes.',
            });
          }}
        />
      )}
    </div>
  );
};
