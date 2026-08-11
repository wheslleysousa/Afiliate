import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, doc, deleteDoc, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
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
  Download,
  FileSpreadsheet,
  UserPlus,
  Edit3,
  AlertCircle,
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
  const [accountFilter, setAccountFilter] = useState<string>('connected');
  const [isCleaning, setIsCleaning] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<WaGroup | null>(null);

  // Modals & Alerts
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Custom Deletion Confirmation Modals
  const [deleteConfirmGroup, setDeleteConfirmGroup] = useState<WaGroup | null>(null);
  const [showDeleteDisconnectedModal, setShowDeleteDisconnectedModal] = useState<boolean>(false);
  const [isDeletingGroup, setIsDeletingGroup] = useState<boolean>(false);

  // Manage Real Participants Modal
  const [manageGroupModal, setManageGroupModal] = useState<WaGroup | null>(null);
  const [manageInputText, setManageInputText] = useState('');
  const [isSavingParticipants, setIsSavingParticipants] = useState(false);

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
        const uniqueMap = new Map<string, WaGroup>();
        snapshot.docs.forEach((d) => {
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

  const connectedSessions = waSessions.filter((s) => s.status === 'connected');
  const connectedSessionIds = new Set(
    connectedSessions.map((s) => s.sessionId || s.id || '').filter(Boolean)
  );

  const disconnectedGroups = groups.filter((g) => {
    if (!g.sessionId) return false;
    return !connectedSessionIds.has(g.sessionId);
  });

  const handleConfirmCleanDisconnectedGroups = async () => {
    if (!uid || disconnectedGroups.length === 0) return;

    setIsCleaning(true);
    try {
      const batch = writeBatch(db);
      disconnectedGroups.forEach((g) => {
        const docId = (g as any).docId || (g as any).id || g.groupId;
        batch.delete(doc(db, 'users', uid, 'waGroups', docId));
      });
      await batch.commit();
      setAlertMessage({
        type: 'success',
        text: `Sucesso! ${disconnectedGroups.length} grupos de contas desconectadas foram removidos do banco de dados.`,
      });
      setShowDeleteDisconnectedModal(false);
    } catch (err: any) {
      console.error('Erro ao limpar grupos desconectados:', err);
      setAlertMessage({
        type: 'error',
        text: 'Erro ao remover grupos de contas desconectadas. Tente novamente.',
      });
    } finally {
      setIsCleaning(false);
    }
  };

  const filteredGroups = groups.filter((g) => {
    const matchesSearch =
      (g.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (g.groupId || '').toLowerCase().includes(search.toLowerCase());

    let matchesAccount = true;
    if (accountFilter === 'connected') {
      if (connectedSessionIds.size > 0) {
        matchesAccount = !!g.sessionId && connectedSessionIds.has(g.sessionId);
      } else {
        matchesAccount = true;
      }
    } else if (accountFilter !== 'all') {
      matchesAccount = g.sessionId === accountFilter;
    }

    return matchesSearch && matchesAccount;
  });

  const handleConfirmDeleteSingleGroup = async () => {
    if (!uid || !deleteConfirmGroup) return;
    setIsDeletingGroup(true);

    try {
      const targetDocId = (deleteConfirmGroup as any).docId || (deleteConfirmGroup as any).id || deleteConfirmGroup.groupId;
      await deleteDoc(doc(db, 'users', uid, 'waGroups', targetDocId));
      setAlertMessage({
        type: 'success',
        text: `Registro do grupo "${deleteConfirmGroup.name}" removido com sucesso.`,
      });
      if (selectedGroup?.groupId === deleteConfirmGroup.groupId) {
        setSelectedGroup(null);
      }
      setDeleteConfirmGroup(null);
    } catch (err: any) {
      console.error('Erro ao excluir grupo:', err);
      setAlertMessage({
        type: 'error',
        text: 'Não foi possível remover o registro do grupo. Tente novamente.',
      });
    } finally {
      setIsDeletingGroup(false);
    }
  };

  // Helper to format any phone or clean digits into standard Brazilian (+55 DDD) format
  const formatPhoneDisplay = (raw?: string): string => {
    if (!raw) return '';
    const clean = raw.replace(/@.*$/, '').replace(/\D/g, '');
    if (!clean) return raw;

    let withCountry = clean;
    if (clean.length === 10 || clean.length === 11) {
      withCountry = '55' + clean;
    }

    if (withCountry.startsWith('55') && (withCountry.length === 12 || withCountry.length === 13)) {
      const ddd = withCountry.slice(2, 4);
      const num = withCountry.slice(4);
      if (num.length === 9) {
        return `+55 (${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`;
      } else if (num.length === 8) {
        return `+55 (${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`;
      }
      return `+55 (${ddd}) ${num}`;
    } else if (clean.length >= 8) {
      return `+${clean}`;
    }
    return raw;
  };

  // Real participants extractor (returns only real stored/synced contacts)
  const getGroupParticipants = (group: WaGroup): WaGroupParticipant[] => {
    const list: WaGroupParticipant[] = [];

    const parseParticipant = (item: any, idx: number): WaGroupParticipant | null => {
      if (!item) return null;

      let rawStr = '';
      let itemName = '';
      let isAdmin = false;

      if (typeof item === 'string') {
        rawStr = item;
      } else if (typeof item === 'object') {
        rawStr = item.phone || item.phoneNumber || item.number || item.jid || item.id || item.user || '';
        itemName = item.name || item.notify || item.pushName || item.label || '';
        isAdmin = !!(item.isAdmin || item.admin || item.isSuperAdmin);
      }

      const cleanDigits = rawStr.replace(/@.*$/, '').replace(/\D/g, '');
      if (!cleanDigits && !itemName) return null;

      const formatted = cleanDigits ? formatPhoneDisplay(cleanDigits) : '';

      const finalName =
        itemName && !itemName.startsWith('Membro do Grupo') && !itemName.includes('**')
          ? itemName
          : formatted || `Participante ${idx + 1}`;

      return {
        id: `part_${idx}_${cleanDigits || Math.random().toString(36).substring(2, 6)}`,
        name: finalName,
        phone: formatted || cleanDigits || rawStr || 'Sem Número',
        isAdmin,
      };
    };

    const candidates = [
      group.participants,
      (group as any).initialParticipants,
      (group as any).members,
      (group as any).phoneNumbers,
      (group as any).contacts,
      (group as any).phones,
      (group as any).participantList,
      (group as any).jids,
      (group as any).userList,
    ];

    let foundRawItems: any[] = [];
    for (const cand of candidates) {
      if (!cand) continue;
      if (Array.isArray(cand) && cand.length > 0) {
        foundRawItems = cand;
        break;
      } else if (typeof cand === 'object' && Object.keys(cand).length > 0) {
        foundRawItems = Object.values(cand);
        break;
      }
    }

    if (foundRawItems.length > 0) {
      foundRawItems.forEach((item, idx) => {
        const parsed = parseParticipant(item, idx);
        if (parsed) {
          list.push(parsed);
        }
      });
    }

    // Ensure Admin "Você" is included if group.isAdmin is true and not already in list
    if (group.isAdmin && !list.some((p) => p.isAdmin || p.phone === 'Você' || p.name.includes('Você'))) {
      list.unshift({
        id: 'admin_you',
        name: 'Você (Administrador)',
        phone: 'Você',
        isAdmin: true,
      });
    }

    return list;
  };

  // Save/Update Real Participants in Firestore
  const handleSaveParticipants = async (group: WaGroup, input: string) => {
    if (!uid || !group) return;
    setIsSavingParticipants(true);

    try {
      const lines = input
        .split(/[\n,;]+/)
        .map((l) => l.trim())
        .filter(Boolean);

      const parsed: WaGroupParticipant[] = lines.map((entry, idx) => {
        let pName = '';
        let phoneStr = entry;
        if (entry.includes(':')) {
          const parts = entry.split(':');
          pName = parts[0].trim();
          phoneStr = parts[1].trim();
        }
        const cleanDigits = phoneStr.replace(/\D/g, '');
        const formatted = formatPhoneDisplay(cleanDigits || phoneStr);
        return {
          id: `part_${Date.now()}_${idx}_${cleanDigits || idx}`,
          name: pName || formatted || `Participante ${idx + 1}`,
          phone: formatted || phoneStr,
          isAdmin: false,
        };
      }).filter((p) => p.phone);

      if (group.isAdmin && !parsed.some((p) => p.isAdmin || p.phone === 'Você')) {
        parsed.unshift({
          id: 'admin_you',
          name: 'Você (Administrador)',
          phone: 'Você',
          isAdmin: true,
        });
      }

      const targetDocId = (group as any).docId || (group as any).id || group.groupId;

      await setDoc(
        doc(db, 'users', uid, 'waGroups', targetDocId),
        {
          participants: parsed,
          initialParticipants: parsed.map((p) => p.phone.replace(/\D/g, '')).filter(Boolean),
          participantsCount: parsed.length,
          size: parsed.length,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      if (selectedGroup && selectedGroup.groupId === group.groupId) {
        setSelectedGroup({
          ...selectedGroup,
          participants: parsed,
          participantsCount: parsed.length,
          size: parsed.length,
        });
      }

      setAlertMessage({
        type: 'success',
        text: `Sucesso! ${parsed.length} participantes com números e DDD salvos no grupo.`,
      });
      setManageGroupModal(null);
      setManageInputText('');
    } catch (err: any) {
      console.error('Erro ao salvar participantes:', err);
      setAlertMessage({
        type: 'error',
        text: 'Erro ao salvar participantes. Tente novamente.',
      });
    } finally {
      setIsSavingParticipants(false);
    }
  };

  // Export CSV for a specific group
  const exportGroupContactsCSV = (group: WaGroup) => {
    const participants = getGroupParticipants(group);
    if (participants.length === 0) {
      setAlertMessage({ type: 'error', text: 'Nenhum contato encontrado para exportar neste grupo.' });
      return;
    }

    const rows = [
      ['Nome', 'Telefone', 'Função', 'Grupo', 'Status'],
      ...participants.map((p) => [
        p.name || 'Participante',
        p.phone || p.id || '',
        p.isAdmin ? 'Administrador' : 'Membro',
        group.name || 'Grupo WhatsApp',
        'Ativo',
      ]),
    ];

    const csvContent =
      '\uFEFF' +
      rows
        .map((row) => row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(';'))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = (group.name || 'grupo').replace(/[^a-zA-Z0-9_ -]/g, '').trim().replace(/\s+/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `contatos_${safeName || 'grupo'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setAlertMessage({
      type: 'success',
      text: `Arquivo CSV gerado com sucesso! (${participants.length} contatos exportados)`,
    });
  };

  // Export CSV for all loaded groups
  const exportAllGroupsContactsCSV = () => {
    if (groups.length === 0) {
      setAlertMessage({ type: 'error', text: 'Nenhum grupo cadastrado para exportar.' });
      return;
    }

    const allRows: string[][] = [
      ['Nome', 'Telefone', 'Função', 'Grupo', 'Status'],
    ];

    let totalCount = 0;
    groups.forEach((g) => {
      const participants = getGroupParticipants(g);
      participants.forEach((p) => {
        totalCount++;
        allRows.push([
          p.name || 'Participante',
          p.phone || p.id || '',
          p.isAdmin ? 'Administrador' : 'Membro',
          g.name || 'Grupo WhatsApp',
          'Ativo',
        ]);
      });
    });

    if (totalCount === 0) {
      setAlertMessage({ type: 'error', text: 'Nenhum contato encontrado para exportar.' });
      return;
    }

    const csvContent =
      '\uFEFF' +
      allRows
        .map((row) => row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(';'))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `todos_contatos_grupos_whatsapp.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setAlertMessage({
      type: 'success',
      text: `Exportação concluída! Total de ${totalCount} contatos exportados em CSV.`,
    });
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
              Grupos e Comunidades
            </h3>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {/* Account Filter */}
          {waSessions.length > 0 && (
            <div className="relative w-full sm:w-56">
              <Smartphone className="w-4 h-4 text-emerald-400 absolute left-3 top-2.5 z-10 pointer-events-none" />
              <select
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
                className="w-full bg-[#151a26] border border-[#1e2636] text-stone-200 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-emerald-500/50"
              >
                <option value="connected">Apenas Contas Conectadas ({connectedSessions.length})</option>
                <option value="all">Todas as contas</option>
                {waSessions.map((s, i) => {
                  const sId = s.sessionId || s.id || '';
                  return (
                    <option key={sId} value={sId}>
                      {s.label || `Conta WhatsApp ${i + 1}`} {s.phoneNumber ? `(${s.phoneNumber})` : ''}
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

          {/* Button: Create Group */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Criar Grupo
          </button>
        </div>
      </div>

      {/* Disconnected groups info banner */}
      {disconnectedGroups.length > 0 && accountFilter === 'connected' && (
        <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-xl text-xs text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold">
                {disconnectedGroups.length} grupo(s) de contas desconectadas estão ocultos.
              </span>
              <span className="text-amber-300/80 ml-1">
                (Exibindo apenas os grupos do número atualmente conectado).
              </span>
            </div>
          </div>
          <button
            disabled={isCleaning}
            onClick={() => setShowDeleteDisconnectedModal(true)}
            className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5"
          >
            {isCleaning ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5 text-amber-400" />
            )}
            Excluir Grupos Desconectados ({disconnectedGroups.length})
          </button>
        </div>
      )}

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
          {filteredGroups.map((group, idx) => {
            const memberCount = group.size || group.participantsCount || (group.participants ? group.participants.length : 0);
            const isPending = (group as any).status === 'pending_creation';

            return (
              <div
                key={(group as any).docId || (group as any).id || `${group.groupId}_${idx}`}
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmGroup(group);
                      }}
                      className="p-1 text-stone-500 hover:text-red-400 hover:bg-[#151a26] rounded-md transition-colors"
                      title="Excluir grupo da lista"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <span className="text-emerald-400 font-semibold group-hover:underline flex items-center gap-1 text-[11px]">
                    Ver Contatos & Detalhes
                    <ArrowRight className="w-3 h-3" />
                  </span>
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

              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-white truncate">{selectedGroup.name}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    {selectedGroup.size || selectedGroup.participantsCount || (selectedGroup.participants ? selectedGroup.participants.length : 0)} membros
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
            {(() => {
              const currentParticipants = getGroupParticipants(selectedGroup);
              const loadedCount = currentParticipants.length;
              const totalCount = selectedGroup.size || selectedGroup.participantsCount || loadedCount;

              return (
                <>
                  <div className="flex items-center justify-between border-b border-[#1e2636] pb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setDetailTab('info')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                          detailTab === 'info'
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'bg-[#151a26] text-stone-400 hover:text-white border border-[#1e2636]'
                        }`}
                      >
                        <Info className="w-3.5 h-3.5" />
                        Informações
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
                        Contatos ({loadedCount}{totalCount > loadedCount ? ` de ${totalCount}` : ''})
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => exportGroupContactsCSV(selectedGroup)}
                        className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                        title="Exportar contatos deste grupo em CSV"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-400" />
                        Baixar Contatos CSV
                      </button>
                    </div>
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

                      <div className="bg-[#151a26]/70 p-4 rounded-xl border border-[#1e2636] flex items-center justify-between gap-4">
                        <div>
                          <h4 className="text-xs font-bold text-white">Contatos dos Grupos</h4>
                          <p className="text-[11px] text-stone-400 mt-0.5">
                            Extração automática de participantes via integração real.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => exportGroupContactsCSV(selectedGroup)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg"
                          >
                            <Download className="w-4 h-4" />
                            Baixar CSV
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tab: Members / Contacts List */}
                  {detailTab === 'members' && (
                    <div className="space-y-3">
                      {/* Search member & Export action */}
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                          <input
                            type="text"
                            placeholder="Buscar participante..."
                            value={memberSearch}
                            onChange={(e) => setMemberSearch(e.target.value)}
                            className="w-full bg-[#151a26] border border-[#1e2636] text-stone-200 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-emerald-500/50"
                          />
                        </div>
                        <button
                          onClick={() => exportGroupContactsCSV(selectedGroup)}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 shadow-md"
                        >
                          <Download className="w-4 h-4" />
                          <span className="hidden sm:inline">Baixar Contatos CSV</span>
                        </button>
                      </div>

                      <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                        {(() => {
                          const filtered = currentParticipants.filter(
                            (p) =>
                              (p.name || '').toLowerCase().includes(memberSearch.toLowerCase()) ||
                              (p.phone || '').toLowerCase().includes(memberSearch.toLowerCase())
                          );

                          if (filtered.length === 0) {
                      return (
                        <div className="p-5 text-center text-xs text-stone-400 bg-[#151a26]/50 border border-[#1e2636] rounded-xl space-y-2">
                          <p className="font-semibold text-stone-300">
                            {memberSearch
                              ? 'Nenhum participante encontrado para a busca.'
                              : 'Nenhum participante fornecido pela integração WhatsApp ainda.'}
                          </p>
                        </div>
                      );
                    }

                    return filtered.map((participant, idx) => (
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
                    ));
                  })()}
                </div>
              </div>
            )}
          </>
        );
      })()}

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

      {/* Manage / Add Real Numbers Modal */}
      {manageGroupModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1119] border border-[#1e2636] w-full max-w-lg rounded-2xl p-6 space-y-5 shadow-2xl relative animate-fadeIn max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#1e2636]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Adicionar / Editar Números Reais</h3>
                  <p className="text-xs text-stone-400 truncate max-w-[260px]">
                    {manageGroupModal.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setManageGroupModal(null);
                  setManageInputText('');
                }}
                className="text-stone-400 hover:text-white p-1 rounded-lg bg-[#151a26]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-stone-300">
                Insira ou cole os números reais dos integrantes do grupo:
              </label>
              <textarea
                rows={7}
                placeholder={`Cole os números um por linha ou separados por vírgula:\n\nExemplos:\n(91) 98123-4567\n5591999887766\nMaria: 91987654321\n+55 (11) 99887-6655`}
                value={manageInputText}
                onChange={(e) => setManageInputText(e.target.value)}
                className="w-full bg-[#151a26] border border-[#1e2636] rounded-xl p-3 text-xs text-stone-200 font-mono placeholder:text-stone-600 focus:outline-none focus:border-emerald-500/50"
              />
              <p className="text-[11px] text-stone-400 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                Todos os números são formatados automaticamente com o código do país (+55) e DDD.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1e2636]">
              <button
                onClick={() => {
                  setManageGroupModal(null);
                  setManageInputText('');
                }}
                className="px-4 py-2 bg-[#151a26] hover:bg-stone-800 text-stone-300 text-xs font-semibold rounded-xl border border-[#1e2636]"
              >
                Cancelar
              </button>
              <button
                disabled={isSavingParticipants || !manageInputText.trim()}
                onClick={() => handleSaveParticipants(manageGroupModal, manageInputText)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-950/40"
              >
                {isSavingParticipants ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Salvar Números Reais
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal - Single Group Deletion */}
      {deleteConfirmGroup && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1119] border border-[#1e2636] w-full max-w-md rounded-2xl p-6 space-y-5 shadow-2xl relative animate-fadeIn">
            <div className="flex items-center gap-3 pb-4 border-b border-[#1e2636]">
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Excluir grupo?</h3>
              </div>
            </div>

            <div className="space-y-3 text-xs text-stone-300">
              <p>
                Essa ação é irreversível. Tem certeza de que deseja excluir este grupo?
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1e2636]">
              <button
                disabled={isDeletingGroup}
                onClick={() => setDeleteConfirmGroup(null)}
                className="px-4 py-2 bg-[#151a26] hover:bg-stone-800 text-stone-300 text-xs font-semibold rounded-xl border border-[#1e2636] transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={isDeletingGroup}
                onClick={handleConfirmDeleteSingleGroup}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-red-950/50 transition-all"
              >
                {isDeletingGroup ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  <>
                    Excluir
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal - Disconnected Groups Bulk Deletion */}
      {showDeleteDisconnectedModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1119] border border-amber-500/30 w-full max-w-md rounded-2xl p-6 space-y-5 shadow-2xl relative animate-fadeIn">
            <div className="flex items-center gap-3 pb-4 border-b border-[#1e2636]">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Excluir Grupos Desconectados</h3>
                <p className="text-xs text-amber-300/80">{disconnectedGroups.length} grupo(s) selecionados</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-stone-300">
              <p>
                Tem certeza de que deseja remover os{' '}
                <strong className="text-amber-300 font-bold">{disconnectedGroups.length} grupos</strong>{' '}
                pertencentes a números que foram desconectados?
              </p>
              <div className="bg-[#151a26] p-3 rounded-xl border border-[#1e2636] text-[11px] text-stone-400 space-y-1">
                <p className="text-emerald-400 font-semibold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Os grupos da sua conta conectada atual continuarão salvos.
                </p>
                <p>Os registros dos grupos das contas antigas desconectadas serão limpos do banco de dados.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1e2636]">
              <button
                disabled={isCleaning}
                onClick={() => setShowDeleteDisconnectedModal(false)}
                className="px-4 py-2 bg-[#151a26] hover:bg-stone-800 text-stone-300 text-xs font-semibold rounded-xl border border-[#1e2636] transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={isCleaning}
                onClick={handleConfirmCleanDisconnectedGroups}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-amber-950/50 transition-all"
              >
                {isCleaning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Limpando...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Sim, Remover {disconnectedGroups.length} Grupos
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
