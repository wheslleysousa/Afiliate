import React, { useEffect, useState } from 'react';
import { addDoc, collection, doc, onSnapshot, serverTimestamp, setDoc, deleteDoc } from 'firebase/firestore';
import { Radio, Plus, AlertTriangle, CheckCircle2, RefreshCw, Eye, ShieldCheck, Users, LogOut, Trash2, Undo2 } from 'lucide-react';
import { db } from '../../lib/firebase';
import type { WaChannel, WaSession } from '../../types';

interface Props {
  uid: string;
  sessions: WaSession[];
  onSelectChannel: (channelId: string) => void;
}

const CHANNEL_LINK = /^https:\/\/(?:www\.)?whatsapp\.com\/channel\/[A-Za-z0-9_-]{6,100}\/?(?:\?[^\s#]*)?$/i;
const CHANNEL_JID = /^[A-Za-z0-9_-]{6,80}@newsletter$/;

export const WhatsAppChannelsView: React.FC<Props> = ({ uid, sessions, onSelectChannel }) => {
  const [channels, setChannels] = useState<WaChannel[]>([]);
  const [commands, setCommands] = useState<Array<{ id: string; status: string; error?: string }>>([]);
  const [sessionId, setSessionId] = useState('');
  const [channelReference, setChannelReference] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'admin' | 'following'>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [busyChannelId, setBusyChannelId] = useState('');

  const connected = sessions.filter(s => s.status === 'connected');
  const selectedSessionId = connected.some(s => (s.sessionId || s.id) === sessionId)
    ? sessionId : (connected[0]?.sessionId || connected[0]?.id || '');
  const currentSession = connected.find(s => (s.sessionId || s.id) === selectedSessionId);

  useEffect(() => {
    if (!uid) return;
    const stopChannels = onSnapshot(collection(db, 'users', uid, 'waChannels'), snap => {
      setChannels(snap.docs.map(d => ({ id: d.id, ...d.data() } as WaChannel))
        .sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    }, err => setError('Não foi possível carregar os canais: ' + err.message));
    const stopExclusions = onSnapshot(collection(db, 'users', uid, 'waChannelExclusions'), snap => {
      setExcludedIds(new Set(snap.docs.map(d => d.id)));
    }, err => setError('Não foi possível carregar canais excluídos: ' + err.message));
    const stopCommands = onSnapshot(collection(db, 'users', uid, 'waCommands'), snap => {
      setCommands(snap.docs.filter(d => ['registerChannel', 'leaveChannel'].includes(d.data().action))
        .map(d => ({ id: d.id, status: d.data().status, error: d.data().error }))
        .slice(-8));
    });
    return () => { stopChannels(); stopCommands(); stopExclusions(); };
  }, [uid]);

  const register = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const reference = channelReference.trim();
    if (!selectedSessionId) return setError('Conecte o WhatsApp antes de cadastrar canais.');
    if (!CHANNEL_LINK.test(reference) && !CHANNEL_JID.test(reference)) {
      return setError('Cole o link oficial https://whatsapp.com/channel/... ou o ID @newsletter.');
    }
    setSaving(true);
    try {
      await addDoc(collection(db, 'users', uid, 'waCommands'), {
        action: 'registerChannel', sessionId: selectedSessionId,
        channelReference: reference, status: 'pending', createdAt: serverTimestamp(),
      });
      setChannelReference('');
    } catch (err: any) {
      setError('Não foi possível solicitar cadastro: ' + (err?.message || 'erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  const requestSync = async () => {
    if (!selectedSessionId) return;
    setError('');
    setSyncing(true);
    try {
      // O worker sincroniza ambos pelo mesmo sinal, sem ativar envio.
      await setDoc(doc(db, 'users', uid, 'waSessions', selectedSessionId),
        { requestedSyncGroups: true, requestedGroupSyncAt: serverTimestamp() }, { merge: true });
    } catch (err: any) {
      setError('Não foi possível solicitar a sincronização: ' + (err?.message || 'erro desconhecido'));
    } finally {
      window.setTimeout(() => setSyncing(false), 1400);
    }
  };

  const channelKey = (c: WaChannel) => c.id || (c.sessionId + '_' + c.channelId);
  const active = channels.filter(c => connected.some(s => (s.sessionId || s.id) === c.sessionId));
  const listed = active.filter(c => c.excluded !== true && c.isFollowing !== false && !excludedIds.has(channelKey(c)));
  const excluded = active.filter(c => c.excluded === true || c.isFollowing === false || excludedIds.has(channelKey(c)));

  const removeFromAfiliate = async (c: WaChannel) => {
    if (!window.confirm('Excluir "' + (c.name || 'este canal') + '" somente do Afiliate? Você continuará seguindo no WhatsApp.')) return;
    setBusyChannelId(channelKey(c)); setError('');
    try {
      await setDoc(doc(db, 'users', uid, 'waChannelExclusions', channelKey(c)), {
        channelId: c.channelId, sessionId: c.sessionId, reason: 'hidden_by_user',
        createdAt: serverTimestamp(),
      }, { merge: true });
      await setDoc(doc(db, 'users', uid, 'waChannels', channelKey(c)),
        { excluded: true, updatedAt: serverTimestamp() }, { merge: true });
    } catch (e: any) { setError('Falha ao excluir canal: ' + (e?.message || 'erro')); }
    finally { setBusyChannelId(''); }
  };
  const restoreToAfiliate = async (c: WaChannel) => {
    setBusyChannelId(channelKey(c)); setError('');
    try {
      await setDoc(doc(db, 'users', uid, 'waChannels', channelKey(c)),
        { excluded: false, isFollowing: true, updatedAt: serverTimestamp() }, { merge: true });
      await deleteDoc(doc(db, 'users', uid, 'waChannelExclusions', channelKey(c)));
    } catch (e: any) { setError('Falha ao restaurar canal: ' + (e?.message || 'erro')); }
    finally { setBusyChannelId(''); }
  };
  const leaveChannel = async (c: WaChannel) => {
    if (c.canPost) return setError('Para deixar um canal que você administra, use o WhatsApp.');
    if (!currentSession?.groupCapabilities?.leaveChannel) {
      return setError('A saída de canais não está disponível nesta sessão. Use o WhatsApp para deixar de seguir.');
    }
    if (!window.confirm('Deixar de seguir "' + (c.name || 'este canal') + '" no WhatsApp? Essa ação não é apenas ocultar no Afiliate.')) return;
    setBusyChannelId(channelKey(c)); setError('');
    try {
      await addDoc(collection(db, 'users', uid, 'waCommands'), {
        action: 'leaveChannel', channelId: c.channelId, sessionId: c.sessionId,
        status: 'pending', createdAt: serverTimestamp(),
      });
    } catch (e: any) { setError('Não foi possível solicitar saída: ' + (e?.message || 'erro')); }
    finally { setBusyChannelId(''); }
  };
  const admins = listed.filter(c => c.canPost);
  const followed = listed.filter(c => !c.canPost);
  const displayed = listed.filter(c => filter === 'all' || (filter === 'admin' ? c.canPost : !c.canPost));

  return (
    <section className="space-y-4" aria-label="Canais do WhatsApp">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-white">Canais</h2>
          <p className="text-xs text-[#a6b4c9]">Acompanhe os que você segue e publique apenas nos seus.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={requestSync} disabled={!selectedSessionId || syncing}
            className="rounded-xl border border-[#2b3a51] px-3 py-2.5 text-xs font-semibold text-blue-200 hover:bg-[#172338] disabled:opacity-50 flex items-center gap-2">
            <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} /> Atualizar
          </button>
          <button type="button" onClick={() => setShowAdd(v => !v)}
            className="rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-semibold text-white flex items-center gap-2">
            <Plus size={16} /> Adicionar por link
          </button>
        </div>
      </div>
      {connected.length > 1 && (
        <select aria-label="Selecionar conta WhatsApp" className="w-full rounded-xl border border-[#293246] bg-[#151a26] p-3 text-white text-sm"
          value={selectedSessionId} onChange={e => setSessionId(e.target.value)}>
          {connected.map(s => <option key={s.sessionId || s.id} value={s.sessionId || s.id}>{s.label || 'Conta WhatsApp'}</option>)}
        </select>
      )}
      {currentSession?.channelSyncError && (
        <div role="status" className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100 space-y-1">
          <p>{currentSession.channelSyncError}</p>
          <p className="text-amber-200/80">
            No WhatsApp, abra o canal → menu do canal → Compartilhar → Copiar link.
            Cole aqui. Esse cadastro não segue nem publica no canal.
          </p>
        </div>
      )}
      {(showAdd || (listed.length === 0 && currentSession?.channelDiscoverySupported === false)) && (
        <form onSubmit={register} className="rounded-2xl border border-[#293246] bg-[#101723] p-4 space-y-3">
          <p className="text-xs text-[#a6b4c9]">Cole o link de um canal seu ou de um canal que segue. O worker confirma se sua conta pode publicar.</p>
          <input aria-label="Link do canal" value={channelReference} onChange={e => setChannelReference(e.target.value)}
            placeholder="https://whatsapp.com/channel/..." className="w-full min-w-0 rounded-xl border border-[#293246] bg-[#151a26] text-white p-3 text-sm" />
          <button type="submit" disabled={saving || !selectedSessionId}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-white font-semibold text-sm disabled:opacity-50">
            {saving ? 'Validando...' : 'Cadastrar canal'}
          </button>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {commands.some(c => c.status === 'pending' || c.status === 'processing') && (
        <p role="status" className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-200">Aguardando validação do canal pelo worker.</p>
      )}
      {commands.filter(c => c.status === 'failed').map(c => (
        <p key={c.id} role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">
          <AlertTriangle className="inline h-4 w-4 mr-1" /> {c.error || 'Não foi possível cadastrar o canal.'}
        </p>
      ))}
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar canais">
        {([
          ['all', 'Todos', listed.length],
          ['admin', 'Meus canais', admins.length],
          ['following', 'Seguindo', followed.length],
        ] as const).map(([key, label, count]) => (
          <button key={key} type="button" onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={'whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-semibold ' +
              (filter === key ? 'bg-blue-600/20 border-blue-500/50 text-blue-200' : 'bg-[#101723] border-[#293246] text-[#a6b4c9]')}>
            {label} · {count}
          </button>
        ))}
      </div>
      {displayed.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#293246] p-7 text-center space-y-2">
          <Radio className="mx-auto text-blue-400" size={24} />
          <p className="text-sm font-semibold text-white">Nenhum canal nesta lista</p>
          <p className="text-xs leading-relaxed text-[#a6b4c9]">
            O Baileys pode não fornecer a lista completa. Toque em Atualizar para tentar detectar canais dos chats ou cadastre pelo link de compartilhamento acima.
          </p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {displayed.map(c => (
            <article key={channelKey(c)} className="min-w-0 overflow-hidden rounded-xl border border-[#293246] bg-[#101723] p-3 sm:p-4 space-y-3">
              <div className="flex min-w-0 gap-3 items-start">
                <div className="w-12 h-12 overflow-hidden rounded-full bg-[#1d2b41] shrink-0 flex items-center justify-center" aria-hidden="true">
                  {c.photoUrl
                    ? <img src={c.photoUrl} alt="" className="w-full h-full object-cover"
                        onError={e => { e.currentTarget.style.display = 'none'; }} />
                    : <Radio size={22} className="text-blue-300" />}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className="text-white font-bold text-sm [overflow-wrap:anywhere]">{c.name || 'Canal WhatsApp'}</h3>
                  <p className="flex items-center gap-1.5 text-xs text-[#a6b4c9] min-w-0">
                    <Users size={13} className="shrink-0" />
                    {typeof c.followersCount === 'number'
                      ? c.followersCount.toLocaleString('pt-BR') + ' seguidores'
                      : 'Seguidores não informados'}
                  </p>
                  <p className="text-xs text-[#a6b4c9] break-words">{c.canPost ? 'Você administra · pode publicar' : 'Seguindo · somente leitura'}</p>
                </div>
                {c.canPost ? <ShieldCheck className="text-emerald-400 shrink-0" size={18} aria-label="Administrador" /> : <Eye className="text-blue-400 shrink-0" size={18} />}
              </div>
              {c.description && <p className="text-xs text-[#a6b4c9] [overflow-wrap:anywhere] line-clamp-2">{c.description}</p>}
              <div className="grid grid-cols-1 min-[375px]:grid-cols-2 gap-2 min-w-0">
                {c.canPost && <button type="button" onClick={() => onSelectChannel(c.channelId)}
                  className="rounded-lg bg-blue-600/15 px-2.5 py-2.5 text-xs font-semibold text-blue-200 text-center">
                    Criar campanha
                  </button>}
                <button type="button" onClick={() => leaveChannel(c)}
                  disabled={busyChannelId === channelKey(c) || c.canPost || !currentSession?.groupCapabilities?.leaveChannel}
                  title={c.canPost ? 'Gerencie sua administração no WhatsApp' : !currentSession?.groupCapabilities?.leaveChannel ? 'Saída indisponível: use o WhatsApp' : 'Deixar de seguir no WhatsApp'}
                  className="flex min-w-0 items-center justify-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-2.5 text-xs font-semibold text-amber-100 disabled:opacity-40">
                  <LogOut size={14} className="shrink-0" /> Sair do canal
                </button>
                <button type="button" onClick={() => removeFromAfiliate(c)}
                  disabled={busyChannelId === channelKey(c)}
                  className="flex min-w-0 items-center justify-center gap-1.5 rounded-lg border border-rose-500/25 bg-rose-500/10 px-2 py-2.5 text-xs font-semibold text-rose-200 disabled:opacity-40">
                  <Trash2 size={14} className="shrink-0" /> Excluir do Afiliate
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {excluded.length > 0 && (
        <div className="rounded-xl border border-[#293246] p-3 space-y-2 min-w-0">
          <p className="text-xs font-semibold text-[#a6b4c9]">Excluídos do Afiliate ({excluded.length})</p>
          {excluded.map(c => (
            <div key={channelKey(c)} className="flex min-w-0 flex-wrap gap-2 items-center justify-between">
              <span className="text-xs text-white min-w-0 [overflow-wrap:anywhere]">{c.name || 'Canal WhatsApp'}</span>
              <button type="button" disabled={busyChannelId === channelKey(c) || c.isFollowing === false}
                onClick={() => restoreToAfiliate(c)}
                className="flex items-center gap-1.5 text-xs text-blue-300 disabled:opacity-40"><Undo2 size={14} /> Restaurar</button>
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] text-[#78899f]">Canais seguidos não recebem campanhas. Mídia nos canais administrados depende de validação real no WhatsApp.</p>
    </section>
  );
};
