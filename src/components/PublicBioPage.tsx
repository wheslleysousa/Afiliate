import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BioPage, BioBlock, BioSocial } from '../types';
import { BioContent } from './BioContent';
import { Loader2, AlertCircle } from 'lucide-react';

interface PublicBioPageProps {
  slug: string;
}

/** Monta o href de um botão da bio roteando pelo contador de cliques do backend. */
function trackedHref(slug: string, block: BioBlock): string | undefined {
  if (!block.url) return undefined;
  const trackId = `bio_${slug}_${block.id}`;
  // Caminho relativo → mesmo domínio (lkrm.site), onde /rb/ é servido pelo backend.
  return `/rb/${encodeURIComponent(trackId)}?url=${encodeURIComponent(block.url)}`;
}

function trackedSocialHref(slug: string, s: BioSocial): string | undefined {
  if (!s.url) return undefined;
  const trackId = `bio_${slug}_social_${s.id}`;
  return `/rb/${encodeURIComponent(trackId)}?url=${encodeURIComponent(s.url)}`;
}

export const PublicBioPage: React.FC<PublicBioPageProps> = ({ slug }) => {
  const [page, setPage] = useState<BioPage | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'notfound'>('loading');

  useEffect(() => {
    let mounted = true;
    getDoc(doc(db, 'bioPages', slug))
      .then((snap) => {
        if (!mounted) return;
        if (snap.exists() && snap.data().published !== false) {
          setPage(snap.data() as BioPage);
          setStatus('ok');
          const name = (snap.data() as BioPage).displayName;
          if (name) document.title = `${name} • lkrm.site`;
        } else {
          setStatus('notfound');
        }
      })
      .catch(() => {
        if (mounted) setStatus('notfound');
      });
    return () => {
      mounted = false;
    };
  }, [slug]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#07090f] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (status === 'notfound' || !page) {
    return (
      <div className="min-h-screen bg-[#07090f] flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-lg font-extrabold text-white">Página não encontrada</h2>
        <p className="text-xs text-[#93a0b5] mt-1 max-w-xs">
          Esta bio não existe, foi despublicada ou o endereço foi digitado incorretamente.
        </p>
        <a
          href="/"
          className="mt-5 py-2.5 px-5 rounded-xl bg-[#151a26] hover:bg-[#1e2636] text-[#eef2f9] border border-[#1e2636] font-bold text-xs"
        >
          Ir para o início
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full">
      <BioContent page={page} getHref={(b) => trackedHref(slug, b)} getSocialHref={(s) => trackedSocialHref(slug, s)} />
    </div>
  );
};

export default PublicBioPage;
