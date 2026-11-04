import React, { useEffect, useState } from 'react';
import { addDoc, collection, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { Radio, Plus, AlertTriangle, CheckCircle2 } from 'lucide-react';
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
  const [commands, setCommands] = useState<Array<{ id: string; status: string; error?: string; channelId?: string }>>([]);
  const [sessionId, setSessionId] = useState('');
  const [channelReference, setChannelReference] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const connected = sessions.filter(s => s.status === 'connected');
  const selectedSessionId = connected.some(s => (s.sessionId || s.id) === sessionId)
    ? sessionId : (connected[0]?.sessionId || connected[0]?.id || '');

  useEffect(() => {
    if (!uid) return;
    const stopChannels = onSnapshot(collection(db, 'users', uid, 'waChannels'), snap => {
      setChannels(snap.docs.map(d => ({ id: d.id, ...d.data() } as WaChannel))
        .sort((a, b) => a.name.localeCompare(b.name)));
    }, err => setError('Não foi possível carregar os canais: ' + err.message));
    const stopCommands = onSnapshot(collection(db, 'users', uid, 'waCommands'), snap => {
      setCommands(snap.docs.filter(d => d.data().action === 'registerChannel')
        .map(d => ({ id: d.id, status: d.data().status, error: d.data().error, channelId: d.data().channelId }))
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

  const owned = channels.filter(c => connected.some(s => (s.sessionId || s.id) === c.sessionId));
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#1e2636] bg-[#0e1119] p-5 space-y-3">
        <h3 className="text-white font-semibold flex items-center gap-2"><Radio className="w-5 h-5 text-blue-400" /> Canais do WhatsApp</h3>
        <p className="text-xs text-[#93a0b5] leading-relaxed">
          Cadastre um canal que sua conta administra. O worker verifica a permissão diretamente no WhatsApp.
          Seguir um canal não dá permissão para publicar nele.
        </p>
        <form onSubmit={register} className="flex flex-col gap-3 sm:flex-row">
          <select aria-label="Conta WhatsApp" className="rounded-xl bg-[#151a26] border border-[#1e2636] text-white p-3 text-sm"
            value={selectedSessionId} onChange={e => setSessionId(e.target.value)}>
            {connected.length === 0 && <option value="">Nenhuma conta conectada</option>}
            {connected.map(s => <option key={s.sessionId || s.id} value={s.sessionId || s.id}>{s.label || 'Conta WhatsApp'}</option>)}
          </select>
          <input aria-label="Link do canal" value={channelReference} onChange={e => setChannelReference(e.target.value)}
            placeholder="https://whatsapp.com/channel/..." className="min-w-0 flex-1 rounded-xl border border-[#1e2636] bg-[#151a26] text-white p-3 text-sm" />
          <button type="submit" disabled={saving || !selectedSessionId}
            className="rounded-xl bg-blue-600 px-4 py-3 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            <Plus size={17} /> {saving ? 'Solicitando...' : 'Adicionar canal'}
          </button>
        </form>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      </div>
      {commands.some(c => c.status === 'pending' || c.status === 'processing') && (
        <p className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-200">
          Solicitação pendente: o worker do Termux precisa estar conectado para validar o canal.
        </p>
      )}
      {commands.filter(c => c.status === 'failed').map(c => (
        <p key={c.id} role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">
          <AlertTriangle className="inline h-4 w-4 mr-1" /> {c.error || 'Não foi possível cadastrar o canal.'}
        </p>
      ))}
      {owned.length === 0 ? (
        <div className="rounded-xl border border-[#1e2636] p-6 text-center text-sm text-[#93a0b5]">
          Nenhum canal autorizado encontrado. Cadastre o link de um canal administrado por você.
        </div>
      ) : owned.map(c => (
        <div key={c.id || c.channelId} className="rounded-xl border border-[#1e2636] bg-[#0e1119] p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-white font-semibold truncate">{c.name || c.channelId}</p>
            <p className="text-xs text-[#93a0b5] truncate">{c.channelId}</p>
            <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1"><CheckCircle2 size={13} /> {c.canPost ? 'Permissão verificada' : 'Somente leitura'}</p>
          </div>
          <button type="button" disabled={!c.canPost}
            onClick={() => onSelectChannel(c.channelId)}
            className="rounded-lg bg-blue-600/20 text-blue-300 px-3 py-2 text-xs font-semibold disabled:opacity-50 whitespace-nowrap">
            Criar campanha
          </button>
        </div>
      ))}
      <p className="text-xs text-amber-200/80">
        Enviar imagens para canais depende da versão instalada do Baileys e pode falhar. Use primeiro um canal próprio para validação.
      </p>
    </div>
  );
};
