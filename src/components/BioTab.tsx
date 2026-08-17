import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  doc, getDoc, setDoc, deleteDoc, collection, query, where, limit, getDocs,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BioPage, BioBlock, BioTheme, UserProfile } from '../types';
import { BioContent } from './BioContent';
import { apiFetch, getShortDomain } from '../utils/apiBase';
import {
  Loader2, Check, X, Trash2, ArrowUp, ArrowDown, Link2, Type as TypeIcon,
  Copy, ExternalLink, Eye, BarChart2, Sparkles, AlertCircle,
} from 'lucide-react';

interface BioTabProps {
  user: UserProfile | null;
  uid?: string;
}

// Nomes reservados que não podem virar slug de bio (colidiriam com rotas do app / encurtador)
const RESERVED = new Set([
  'dashboard', 'new-product', 'saved-products', 'marketplace', 'my-products', 'projects',
  'whatsapp-auto', 'templates', 'extension', 'url-shortener', 'bio', 'settings', 'api-docs',
  'api', 'r', 'rb', 'assets', 'health', 'admin', 'login', 'logout', 'signup', 'register',
  'sitemap', 'robots', 'favicon', 'index', 'home', 'app', 'www', 'static', 'public',
]);

const GRADIENT_PRESETS = [
  'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
  'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)',
  'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)',
  'linear-gradient(135deg, #f97316 0%, #db2777 100%)',
  'linear-gradient(135deg, #059669 0%, #10b981 100%)',
  'linear-gradient(160deg, #111827 0%, #4f46e5 100%)',
];

const THEME_PRESETS: { name: string; theme: BioTheme }[] = [
  {
    name: 'Escuro',
    theme: { bgType: 'solid', bgValue: '#0e1119', buttonColor: '#1f2937', buttonTextColor: '#ffffff', buttonShape: 'rounded', textColor: '#ffffff', font: 'Inter, system-ui, sans-serif' },
  },
  {
    name: 'Oceano',
    theme: { bgType: 'gradient', bgValue: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)', buttonColor: '#ffffff', buttonTextColor: '#0f172a', buttonShape: 'pill', textColor: '#ffffff', font: 'Inter, system-ui, sans-serif' },
  },
  {
    name: 'Sunset',
    theme: { bgType: 'gradient', bgValue: 'linear-gradient(135deg, #f97316 0%, #db2777 100%)', buttonColor: '#ffffff', buttonTextColor: '#7c2d12', buttonShape: 'rounded', textColor: '#ffffff', font: 'Inter, system-ui, sans-serif' },
  },
  {
    name: 'Neon',
    theme: { bgType: 'solid', bgValue: '#0a0a0a', buttonColor: '#22c55e', buttonTextColor: '#052e16', buttonShape: 'square', textColor: '#22c55e', font: 'Inter, system-ui, sans-serif' },
  },
];

const DEFAULT_THEME: BioTheme = THEME_PRESETS[0].theme;

const EMOJI_SUGGESTIONS = ['🔥', '🛒', '💸', '📱', '💬', '📸', '🎥', '⭐', '🎁', '📦', '💚', '🏷️'];

function genId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function sanitizeSlug(raw: string): string {
  return (raw || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

const inputCls =
  'w-full bg-[#0b0e15] border border-[#1e2636] rounded-xl px-3 py-2.5 text-sm text-[#eef2f9] placeholder-[#4b5872] focus:outline-none focus:border-blue-500/60 transition-colors';
const labelCls = 'block text-[11px] font-bold uppercase tracking-wider text-[#93a0b5] mb-1.5';

export const BioTab: React.FC<BioTabProps> = ({ user, uid }) => {
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState('');
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [theme, setTheme] = useState<BioTheme>(DEFAULT_THEME);
  const [blocks, setBlocks] = useState<BioBlock[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [clicksMap, setClicksMap] = useState<Record<string, { clicks: number }>>({});

  const shortDomain = getShortDomain().replace(/^https?:\/\//, '');

  // ── Carregar bio existente do usuário ──────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!uid) { setLoading(false); return; }
      try {
        const q = query(collection(db, 'bioPages'), where('ownerUid', '==', uid), limit(1));
        const snap = await getDocs(q);
        if (mounted && !snap.empty) {
          const data = snap.docs[0].data() as BioPage;
          setSlug(data.slug || snap.docs[0].id);
          setSavedSlug(data.slug || snap.docs[0].id);
          setDisplayName(data.displayName || '');
          setBio(data.bio || '');
          setAvatarUrl(data.avatarUrl || '');
          setBannerUrl(data.bannerUrl || '');
          setTheme({ ...DEFAULT_THEME, ...(data.theme || {}) });
          setBlocks(Array.isArray(data.blocks) ? data.blocks : []);
          setSlugStatus('available');
        } else if (mounted) {
          // Sugestão inicial de nome/slug a partir do perfil
          setDisplayName(user?.name || '');
        }
      } catch (e) {
        console.error('Erro ao carregar bio:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [uid, user?.name]);

  // ── Analytics de cliques ────────────────────────────────────────────────────
  const refreshClicks = useCallback(async () => {
    try {
      const res = await apiFetch('/api/analytics/clicks', { action: 'Analytics Bio' });
      const json = await res.json();
      if (json?.clicksMap) setClicksMap(json.clicksMap);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { refreshClicks(); }, [refreshClicks]);

  // ── Verificação de disponibilidade do slug (debounce) ───────────────────────
  useEffect(() => {
    const clean = sanitizeSlug(slug);
    if (!clean || clean.length < 3) { setSlugStatus(clean ? 'invalid' : 'idle'); return; }
    if (RESERVED.has(clean)) { setSlugStatus('taken'); return; }
    if (savedSlug && clean === savedSlug) { setSlugStatus('available'); return; }

    setSlugStatus('checking');
    const t = setTimeout(async () => {
      try {
        const [bioSnap, shortSnap] = await Promise.all([
          getDoc(doc(db, 'bioPages', clean)),
          getDoc(doc(db, 'shortLinks', clean)),
        ]);
        const bioTakenByOther = bioSnap.exists() && (bioSnap.data() as BioPage).ownerUid !== uid;
        if (bioTakenByOther || shortSnap.exists()) {
          setSlugStatus('taken');
        } else {
          setSlugStatus('available');
        }
      } catch {
        setSlugStatus('idle');
      }
    }, 500);
    return () => clearTimeout(t);
  }, [slug, savedSlug, uid]);

  // ── Blocos ──────────────────────────────────────────────────────────────────
  const addBlock = (type: 'link' | 'section') => {
    setBlocks((prev) => [
      ...prev,
      { id: genId(), type, title: type === 'section' ? 'Nova seção' : '', url: type === 'link' ? '' : undefined, icon: '', active: true, order: prev.length },
    ]);
  };
  const updateBlock = (id: string, patch: Partial<BioBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };
  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id).map((b, i) => ({ ...b, order: i })));
  };
  const moveBlock = (id: string, dir: -1 | 1) => {
    setBlocks((prev) => {
      const arr = [...prev];
      const idx = arr.findIndex((b) => b.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= arr.length) return prev;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr.map((b, i) => ({ ...b, order: i }));
    });
  };

  // ── Objeto BioPage atual (para preview e save) ──────────────────────────────
  const currentPage: BioPage = useMemo(() => ({
    slug: sanitizeSlug(slug),
    ownerUid: uid || '',
    userId: uid,
    createdBy: uid,
    displayName,
    bio,
    avatarUrl: avatarUrl.trim() || undefined,
    bannerUrl: bannerUrl.trim() || undefined,
    theme,
    blocks,
    published: true,
  }), [slug, uid, displayName, bio, avatarUrl, bannerUrl, theme, blocks]);

  // ── Publicar ────────────────────────────────────────────────────────────────
  const canPublish = slugStatus === 'available' && !!displayName.trim() && !!uid;

  const handlePublish = async () => {
    const clean = sanitizeSlug(slug);
    if (!canPublish || !clean) {
      setToast({ type: 'err', msg: 'Escolha um link disponível e preencha o nome.' });
      return;
    }
    setSaving(true);
    setToast(null);
    try {
      const now = new Date().toISOString();
      const payload: BioPage = {
        ...currentPage,
        slug: clean,
        blocks: blocks.map((b, i) => ({ ...b, order: i })),
        published: true,
        createdAt: now,
        updatedAt: now,
      };
      // Remove campos undefined (Firestore não aceita)
      const clean_payload = JSON.parse(JSON.stringify(payload));
      await setDoc(doc(db, 'bioPages', clean), clean_payload, { merge: true });

      // Se o slug mudou, remove o documento antigo para liberar o namespace
      if (savedSlug && savedSlug !== clean) {
        try { await deleteDoc(doc(db, 'bioPages', savedSlug)); } catch { /* ignore */ }
      }
      setSavedSlug(clean);
      setToast({ type: 'ok', msg: 'Bio publicada com sucesso!' });
    } catch (e) {
      console.error('Erro ao publicar bio:', e);
      setToast({ type: 'err', msg: 'Não foi possível publicar. Tente novamente.' });
    } finally {
      setSaving(false);
    }
  };

  const publicUrl = savedSlug ? `${shortDomain}/${savedSlug}` : `${shortDomain}/${sanitizeSlug(slug) || 'seu-link'}`;
  const fullPublicUrl = `https://${publicUrl}`;

  const copyUrl = () => {
    navigator.clipboard?.writeText(fullPublicUrl).then(
      () => setToast({ type: 'ok', msg: 'Link copiado!' }),
      () => setToast({ type: 'err', msg: 'Falha ao copiar.' }),
    );
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      {/* ── Coluna do editor ── */}
      <div className="space-y-6">
        {/* Cabeçalho / URL pública */}
        <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-extrabold text-white">Seu link na bio</h3>
          </div>
          <p className="text-xs text-[#93a0b5] mb-4">
            Monte uma página estilo Linktree com seus links de afiliado. Publique e compartilhe em <span className="font-mono text-blue-400">{shortDomain}/seu-nome</span>.
          </p>

          <label className={labelCls}>Escolha seu link</label>
          <div className="flex items-stretch gap-2">
            <div className="flex-1 flex items-center bg-[#0b0e15] border border-[#1e2636] rounded-xl overflow-hidden focus-within:border-blue-500/60">
              <span className="pl-3 pr-1 text-sm text-[#4b5872] font-mono select-none">{shortDomain}/</span>
              <input
                value={slug}
                onChange={(e) => setSlug(sanitizeSlug(e.target.value))}
                placeholder="radardeofertas"
                className="flex-1 bg-transparent py-2.5 pr-3 text-sm text-[#eef2f9] placeholder-[#4b5872] focus:outline-none font-mono"
                maxLength={40}
              />
              <span className="pr-3 flex items-center">
                {slugStatus === 'checking' && <Loader2 className="w-4 h-4 text-[#93a0b5] animate-spin" />}
                {slugStatus === 'available' && <Check className="w-4 h-4 text-emerald-400" />}
                {(slugStatus === 'taken' || slugStatus === 'invalid') && <X className="w-4 h-4 text-red-400" />}
              </span>
            </div>
          </div>
          <div className="mt-1.5 min-h-[16px] text-[11px] font-semibold">
            {slugStatus === 'available' && <span className="text-emerald-400">✓ Disponível</span>}
            {slugStatus === 'taken' && <span className="text-red-400">✗ Já está em uso, escolha outro nome</span>}
            {slugStatus === 'invalid' && <span className="text-amber-400">Use ao menos 3 caracteres (letras, números e hífen)</span>}
          </div>
        </div>

        {/* Perfil */}
        <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-extrabold text-white">Perfil</h3>
          <div>
            <label className={labelCls}>Nome de exibição</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Radar de Ofertas" className={inputCls} maxLength={60} />
          </div>
          <div>
            <label className={labelCls}>Bio (descrição curta)</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="As melhores ofertas do dia 🔥" rows={2} className={inputCls + ' resize-none'} maxLength={160} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Foto de perfil (URL)</label>
              <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://.../foto.jpg" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Banner / capa (URL)</label>
              <input value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} placeholder="https://.../capa.jpg" className={inputCls} />
            </div>
          </div>
          <p className="text-[11px] text-[#4b5872]">Cole a URL de uma imagem (ex.: link direto do Imgur, Firebase Storage ou da sua rede social).</p>
        </div>

        {/* Aparência */}
        <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-extrabold text-white">Aparência</h3>

          <div>
            <label className={labelCls}>Temas prontos</label>
            <div className="flex flex-wrap gap-2">
              {THEME_PRESETS.map((p) => (
                <button key={p.name} onClick={() => setTheme(p.theme)} type="button"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[#1e2636] hover:border-blue-500/60 text-[#eef2f9] transition-colors"
                  style={{ background: p.theme.bgType === 'solid' ? p.theme.bgValue : p.theme.bgValue }}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Tipo de fundo</label>
            <div className="flex gap-2">
              {(['solid', 'gradient', 'image'] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTheme((th) => ({ ...th, bgType: t }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${theme.bgType === t ? 'border-blue-500 bg-blue-500/10 text-blue-300' : 'border-[#1e2636] text-[#93a0b5] hover:text-white'}`}>
                  {t === 'solid' ? 'Cor sólida' : t === 'gradient' ? 'Gradiente' : 'Imagem'}
                </button>
              ))}
            </div>
          </div>

          {theme.bgType === 'solid' && (
            <div className="flex items-center gap-3">
              <input type="color" value={theme.bgValue.startsWith('#') ? theme.bgValue : '#0e1119'} onChange={(e) => setTheme((th) => ({ ...th, bgValue: e.target.value }))} className="w-10 h-10 rounded-lg bg-transparent border border-[#1e2636] cursor-pointer" />
              <input value={theme.bgValue} onChange={(e) => setTheme((th) => ({ ...th, bgValue: e.target.value }))} className={inputCls} />
            </div>
          )}
          {theme.bgType === 'gradient' && (
            <div className="flex flex-wrap gap-2">
              {GRADIENT_PRESETS.map((g) => (
                <button key={g} type="button" onClick={() => setTheme((th) => ({ ...th, bgValue: g }))}
                  className={`w-12 h-9 rounded-lg border-2 transition-all ${theme.bgValue === g ? 'border-white' : 'border-transparent'}`} style={{ background: g }} />
              ))}
            </div>
          )}
          {theme.bgType === 'image' && (
            <input value={theme.bgValue.startsWith('http') ? theme.bgValue : ''} onChange={(e) => setTheme((th) => ({ ...th, bgValue: e.target.value }))} placeholder="https://.../fundo.jpg" className={inputCls} />
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Cor do botão</label>
              <input type="color" value={theme.buttonColor} onChange={(e) => setTheme((th) => ({ ...th, buttonColor: e.target.value }))} className="w-full h-9 rounded-lg bg-transparent border border-[#1e2636] cursor-pointer" />
            </div>
            <div>
              <label className={labelCls}>Texto do botão</label>
              <input type="color" value={theme.buttonTextColor} onChange={(e) => setTheme((th) => ({ ...th, buttonTextColor: e.target.value }))} className="w-full h-9 rounded-lg bg-transparent border border-[#1e2636] cursor-pointer" />
            </div>
            <div>
              <label className={labelCls}>Cor do texto</label>
              <input type="color" value={theme.textColor} onChange={(e) => setTheme((th) => ({ ...th, textColor: e.target.value }))} className="w-full h-9 rounded-lg bg-transparent border border-[#1e2636] cursor-pointer" />
            </div>
          </div>

          <div>
            <label className={labelCls}>Formato do botão</label>
            <div className="flex gap-2">
              {(['rounded', 'pill', 'square'] as const).map((s) => (
                <button key={s} type="button" onClick={() => setTheme((th) => ({ ...th, buttonShape: s }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${theme.buttonShape === s ? 'border-blue-500 bg-blue-500/10 text-blue-300' : 'border-[#1e2636] text-[#93a0b5] hover:text-white'}`}>
                  {s === 'rounded' ? 'Arredondado' : s === 'pill' ? 'Pílula' : 'Quadrado'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Blocos: links e seções */}
        <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-white">Links e seções</h3>
            <div className="flex gap-2">
              <button type="button" onClick={() => addBlock('link')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors">
                <Link2 className="w-3.5 h-3.5" /> Link
              </button>
              <button type="button" onClick={() => addBlock('section')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#151a26] hover:bg-[#1e2636] text-[#eef2f9] border border-[#1e2636] text-xs font-bold transition-colors">
                <TypeIcon className="w-3.5 h-3.5" /> Seção
              </button>
            </div>
          </div>

          {blocks.length === 0 && (
            <p className="text-center text-xs text-[#4b5872] py-6">Nenhum bloco ainda. Adicione um link ou uma seção acima.</p>
          )}

          <div className="space-y-2.5">
            {blocks.map((block, idx) => {
              const clicks = savedSlug ? (clicksMap[`bio_${savedSlug}_${block.id}`]?.clicks || 0) : 0;
              return (
                <div key={block.id} className={`rounded-xl border p-3 ${block.type === 'section' ? 'border-[#2a3550] bg-[#0b0e15]' : 'border-[#1e2636] bg-[#0b0e15]'}`}>
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col gap-1 pt-1">
                      <button type="button" onClick={() => moveBlock(block.id, -1)} disabled={idx === 0} className="text-[#4b5872] hover:text-white disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => moveBlock(block.id, 1)} disabled={idx === blocks.length - 1} className="text-[#4b5872] hover:text-white disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${block.type === 'section' ? 'bg-purple-500/15 text-purple-300' : 'bg-blue-500/15 text-blue-300'}`}>
                          {block.type === 'section' ? 'Seção' : 'Link'}
                        </span>
                        {block.type === 'link' && savedSlug && (
                          <span className="flex items-center gap-1 text-[10px] text-[#93a0b5]"><BarChart2 className="w-3 h-3" /> {clicks} cliques</span>
                        )}
                        <div className="ml-auto flex items-center gap-2">
                          <label className="flex items-center gap-1 text-[10px] text-[#93a0b5] cursor-pointer select-none">
                            <input type="checkbox" checked={block.active !== false} onChange={(e) => updateBlock(block.id, { active: e.target.checked })} className="accent-blue-500" />
                            Visível
                          </label>
                          <button type="button" onClick={() => removeBlock(block.id)} className="text-[#4b5872] hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>

                      {block.type === 'link' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-[70px_1fr] gap-2">
                          <input value={block.icon || ''} onChange={(e) => updateBlock(block.id, { icon: e.target.value })} placeholder="🔥" className={inputCls + ' text-center'} maxLength={2} />
                          <input value={block.title} onChange={(e) => updateBlock(block.id, { title: e.target.value })} placeholder="Título do botão" className={inputCls} maxLength={60} />
                          <input value={block.url || ''} onChange={(e) => updateBlock(block.id, { url: e.target.value })} placeholder="https://... (link do produto, WhatsApp, Instagram)" className={inputCls + ' sm:col-span-2'} />
                        </div>
                      ) : (
                        <input value={block.title} onChange={(e) => updateBlock(block.id, { title: e.target.value })} placeholder="Título da seção" className={inputCls} maxLength={60} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {blocks.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[10px] text-[#4b5872] self-center">Emojis:</span>
              {EMOJI_SUGGESTIONS.map((e) => (
                <span key={e} className="text-sm opacity-70 select-all">{e}</span>
              ))}
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button onClick={handlePublish} disabled={!canPublish || saving}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 hover:brightness-110 text-white font-bold text-sm shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {savedSlug ? 'Salvar alterações' : 'Publicar minha bio'}
          </button>
          {savedSlug && (
            <>
              <button onClick={copyUrl} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#151a26] hover:bg-[#1e2636] text-[#eef2f9] border border-[#1e2636] font-bold text-sm transition-colors">
                <Copy className="w-4 h-4" /> Copiar link
              </button>
              <a href={fullPublicUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#151a26] hover:bg-[#1e2636] text-[#eef2f9] border border-[#1e2636] font-bold text-sm transition-colors">
                <ExternalLink className="w-4 h-4" /> Abrir
              </a>
            </>
          )}
        </div>

        {toast && (
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold ${toast.type === 'ok' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/10 text-red-300 border border-red-500/30'}`}>
            {toast.type === 'ok' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.msg}
          </div>
        )}
      </div>

      {/* ── Coluna do preview ── */}
      <div className="lg:sticky lg:top-6 h-fit">
        <div className="flex items-center gap-2 mb-2 text-[#93a0b5]">
          <Eye className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Pré-visualização</span>
        </div>
        <div className="mx-auto w-full max-w-[300px] rounded-[2rem] border-[6px] border-[#1e2636] bg-black overflow-hidden shadow-2xl" style={{ height: 560 }}>
          <div className="w-full h-full overflow-y-auto">
            <BioContent page={currentPage} />
          </div>
        </div>
        {savedSlug && (
          <p className="text-center text-[11px] text-[#93a0b5] mt-3 font-mono break-all">{shortDomain}/{savedSlug}</p>
        )}
      </div>
    </div>
  );
};

export default BioTab;
