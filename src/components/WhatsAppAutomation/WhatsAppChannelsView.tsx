import React, { useEffect, useState } from 'react';
import { addDoc, collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { Radio, Plus, AlertTriangle, CheckCircle2, RefreshCw, Eye, ShieldCheck } from 'lucide-react';
import { db } from '../../lib/firebase';
import type { WaChannel, WaSession } from '../../types';

interface Props {
  uid: string;
  sessions: WaSession[];
  onSelectChannel: (channelId: string) => void;
}

const CHANNEL_LINK = /^https:\/\/(?:www\.)?whatsapp\.com\/channel\/[A-Za-z0-9_-]{6,100}\/?$/i;
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
    const stopCommands = onSnapshot(collection(db, 'users', uid, 'waCommands'), snap => {
      setCommands(snap.docs.filter(d => d.data().action === 'registerChannel')
        .map(d => ({ id: d.id, status: d.data().status, error: d.data().error }))
        .slice(-8));
    });
    return () => { stopChannels(); stopCommands(); };
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

  const listed = channels.filter(c => connected.some(s => (s.sessionId || s.id) === c.sessionId));
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
            <article key={c.id || c.channelId} className="rounded-xl border border-[#293246] bg-[#101723] p-4 flex gap-3 items-start">
              <div className={'rounded-xl p-2.5 shrink-0 ' + (c.canPost ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400')}>
                {c.canPost ? <ShieldCheck size={20} /> : <Eye size={20} />}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="text-white font-bold text-sm break-words">{c.name || 'Canal WhatsApp'}</h3>
                <p className="text-xs text-[#a6b4c9]">{c.canPost ? 'Você administra · pode publicar' : 'Seguindo · somente leitura'}</p>
                {c.canPost && <button type="button" onClick={() => onSelectChannel(c.channelId)}
                  className="text-blue-300 text-xs font-semibold pt-2">Criar campanha →</button>}
              </div>
              {c.canPost && <CheckCircle2 className="text-emerald-400 shrink-0" size={17} />}
            </article>
          ))}
        </div>
      )}
      <p className="text-[11px] text-[#78899f]">Canais seguidos não recebem campanhas. Mídia nos canais administrados depende de validação real no WhatsApp.</p>
    </section>
  );
};
