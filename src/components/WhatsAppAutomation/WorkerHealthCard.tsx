import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { Activity, ShieldCheck, WifiOff, Clock3, CheckCircle2, AlertTriangle } from 'lucide-react';
import { db } from '../../lib/firebase';

type WorkerHealth = {
  heartbeatAt?: { toMillis?: () => number; seconds?: number };
  sendEnabled?: boolean;
  connectedSessions?: number;
  totalSessions?: number;
  workerVersion?: string;
};

function lastHeartbeatMs(heartbeat: WorkerHealth['heartbeatAt']): number | null {
  if (!heartbeat) return null;
  if (typeof heartbeat.toMillis === 'function') return heartbeat.toMillis();
  if (typeof heartbeat.seconds === 'number') return heartbeat.seconds * 1000;
  return null;
}

export const WorkerHealthCard: React.FC<{ uid: string }> = ({ uid }) => {
  const [data, setData] = useState<WorkerHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    const unsubscribe = onSnapshot(doc(db, 'users', uid, 'workerStatus', 'current'), snap => {
      setData(snap.exists() ? (snap.data() as WorkerHealth) : null);
      setLoading(false);
      setError(false);
    }, () => {
      setLoading(false);
      setError(true);
    });
    return () => unsubscribe();
  }, [uid]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const lastMs = lastHeartbeatMs(data?.heartbeatAt);
  const age = lastMs === null ? null : Math.max(0, Math.floor((now - lastMs) / 1000));
  const online = !error && age !== null && age <= 180;
  const connected = online ? (data?.connectedSessions || 0) : 0;
  const safe = online && data?.sendEnabled !== true;
  const active = online && !safe && connected > 0;
  const heading = loading ? 'Verificando worker...' : error ? 'Não foi possível consultar o worker' :
    !online ? 'Worker offline' : safe ? 'Worker conectado · modo seguro' :
    connected === 0 ? 'Worker online · WhatsApp desconectado' : 'Automação ativa';
  const description = loading ? 'Consultando o Firebase.' : error
    ? 'Confira sua conexão com o Firebase e tente atualizar.'
    : !online
      ? 'O Termux não está enviando sinais de vida. Confira o processo no celular.'
      : safe
        ? 'Conexão e sincronização disponíveis. Disparos desativados no Termux.'
        : connected === 0
          ? 'O worker está online, mas falta conectar uma conta do WhatsApp.'
          : 'O worker está pronto para processar campanhas e enviar ofertas aos grupos configurados.';
  const tone = active ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10' :
    online ? 'border-amber-500/30 text-amber-300 bg-amber-500/10' :
    'border-rose-500/30 text-rose-300 bg-rose-500/10';
  return (
    <section aria-label="Saúde da automação WhatsApp" className="rounded-2xl border border-[#293246] bg-[#0e1119] p-4 sm:p-5 shadow-lg">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className={'rounded-xl border p-2.5 shrink-0 ' + tone}>
            {active ? <CheckCircle2 size={21} /> : safe ? <ShieldCheck size={21} /> : online ? <Activity size={21} /> : <WifiOff size={21} />}
          </div>
          <div>
            <div className="flex items-center flex-wrap gap-2">
              <h2 className="font-bold text-sm text-white">{heading}</h2>
              <span className={'text-[10px] font-bold px-2 py-0.5 rounded-full border ' + tone}>
                {active ? 'ENVIO ATIVO' : online ? (safe ? 'MODO SEGURO' : 'SEM WHATSAPP') : 'OFFLINE'}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[#93a0b5]">{description}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs sm:justify-end shrink-0">
          <div><span className="text-[#93a0b5]">WhatsApp: </span><strong className="text-white">{connected} conta(s)</strong></div>
          <div className="flex items-center gap-1 text-[#93a0b5]"><Clock3 size={13} />
            {age !== null ? 'Último sinal: há ' + (age < 60 ? age + 's' : Math.floor(age / 60) + 'min') : 'Sem sinal recebido'}
          </div>
        </div>
      </div>
      {!online && !loading && !error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#293246] bg-[#151a26] p-3 text-xs text-[#b7c3d9]">
          <AlertTriangle size={15} className="shrink-0 text-amber-400" />
          <span>No Termux, entre em <code className="text-emerald-300">~/Afiliate/whatsapp-worker</code> e execute <code className="text-emerald-300">npm run doctor</code> e <code className="text-emerald-300">node index.js</code>. O status deve aparecer aqui após a conexão.</span>
        </div>
      )}
    </section>
  );
};
