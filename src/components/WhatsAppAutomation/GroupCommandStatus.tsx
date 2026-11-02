import React, { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { CheckCircle2, Clock3, AlertCircle, RefreshCw } from 'lucide-react';

type CommandState = 'pending' | 'processing' | 'done' | 'failed';
type CommandDoc = { id: string; action?: string; name?: string; status?: CommandState; error?: string; warning?: string; createdAt?: any };

export function GroupCommandStatus({ uid }: { uid: string }) {
  const [commands, setCommands] = useState<CommandDoc[]>([]);
  useEffect(() => {
    if (!uid) return;
    const ref = query(collection(db, 'users', uid, 'waCommands'), orderBy('createdAt', 'desc'), limit(6));
    return onSnapshot(ref, snapshot => setCommands(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))), err => {
      console.warn('[Afiliate] Não foi possível carregar o status dos comandos:', err.message);
    });
  }, [uid]);

  if (!commands.length) return null;
  const statusLabel: Record<CommandState, string> = {
    pending: 'Aguardando worker', processing: 'Em execução', done: 'Confirmado', failed: 'Falhou',
  };

  return (
    <section aria-label="Atividade recente do WhatsApp" className="rounded-2xl border border-[#243146] bg-[#0e1420] p-4">
      <h3 className="font-bold text-sm text-white mb-3">Atividade recente</h3>
      <div className="space-y-2">
        {commands.map(item => {
          const state = item.status || 'pending';
          const title = item.action === 'leaveGroup' ? 'Saída de grupo' : item.action === 'createGroup' ? 'Criação no WhatsApp' : 'Comando WhatsApp';
          const Icon = state === 'done' ? CheckCircle2 : state === 'failed' ? AlertCircle : state === 'processing' ? RefreshCw : Clock3;
          return (
            <div key={item.id} className="flex items-start gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5">
              <Icon size={17} aria-hidden="true" className={state === 'done' ? 'text-emerald-400 shrink-0 mt-0.5' : state === 'failed' ? 'text-red-400 shrink-0 mt-0.5' : 'text-blue-300 shrink-0 mt-0.5'} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-white truncate">{title}{item.name ? ` · ${item.name}` : ''}</div>
                <div className="text-[11px] text-[#a6b4c9] mt-1">{statusLabel[state]}</div>
                {(item.error || item.warning) && <p role={state === 'failed' ? 'alert' : undefined} className="text-xs text-amber-200 mt-1 break-words">{item.error || item.warning}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
