import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  doc, getDoc, setDoc, deleteDoc, collection, query, where, limit, getDocs,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  BioPage, BioBlock, BioBlockType, BioTheme, BioButtonShape, BioButtonStyle, BioAvatarShape, UserProfile,
} from '../types';
import { BioContent } from './BioContent';
import { apiFetch, getShortDomain } from '../utils/apiBase';
import { uploadBioImage } from '../utils/uploadImage';
import {
  Loader2, Check, X, Trash2, ArrowUp, ArrowDown, Link2, Type as TypeIcon,
  Copy, ExternalLink, Eye, BarChart2, Sparkles, AlertCircle, Image as ImageIcon,
  Video, AlignLeft, Pencil, Upload, Plus, Palette, LayoutGrid, User, Lock, RotateCcw,
  GripVertical, Share2, QrCode,
} from 'lucide-react';

interface BioTabProps {
  user: UserProfile | null;
  uid?: string;
}

// ── Nomes reservados (colidiriam com rotas do app / encurtador) ──────────────
const RESERVED = new Set([
  'dashboard', 'new-product', 'saved-products', 'marketplace', 'my-products', 'projects',
  'whatsapp-auto', 'templates', 'extension', 'url-shortener', 'bio', 'settings', 'api-docs',
  'api', 'r', 'rb', 'assets', 'health', 'admin', 'login', 'logout', 'signup', 'register',
  'sitemap', 'robots', 'favicon', 'index', 'home', 'app', 'www', 'static', 'public',
]);

// ── Opções de personalização (≥5 por eixo) ───────────────────────────────────
const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: 'Padrão', value: 'Inter, system-ui, sans-serif' },
  { label: 'Serifada', value: "Georgia, 'Times New Roman', serif" },
  { label: 'Suave', value: "'Trebuchet MS', 'Segoe UI', sans-serif" },
  { label: 'Mono', value: "'Courier New', ui-monospace, monospace" },
  { label: 'Larga', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Elegante', value: "'Palatino Linotype', 'Book Antiqua', serif" },
];

const GRADIENT_PRESETS = [
  'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
  'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)',
  'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)',
  'linear-gradient(135deg, #f97316 0%, #db2777 100%)',
  'linear-gradient(135deg, #059669 0%, #10b981 100%)',
  'linear-gradient(160deg, #111827 0%, #4f46e5 100%)',
];

const SHAPE_OPTIONS: { value: BioButtonShape; label: string }[] = [
  { value: 'sharp', label: 'Reto' },
  { value: 'square', label: 'Suave' },
  { value: 'rounded', label: 'Arredondado' },
  { value: 'large', label: 'Grande' },
  { value: 'pill', label: 'Pílula' },
];

const STYLE_OPTIONS: { value: BioButtonStyle; label: string }[] = [
  { value: 'fill', label: 'Preenchido' },
  { value: 'outline', label: 'Contorno' },
  { value: 'soft', label: 'Suave' },
  { value: 'glass', label: 'Vidro' },
  { value: 'hard', label: '3D' },
];

const AVATAR_OPTIONS: { value: BioAvatarShape; label: string }[] = [
  { value: 'circle', label: 'Círculo' },
  { value: 'rounded', label: 'Arredondado' },
  { value: 'square', label: 'Quadrado' },
];

const PALETTE_PRESETS: { name: string; bgType: BioTheme['bgType']; bgValue: string; buttonColor: string; buttonTextColor: string; textColor: string }[] = [
  { name: 'Meia-noite', bgType: 'solid', bgValue: '#0e1119', buttonColor: '#2563eb', buttonTextColor: '#ffffff', textColor: '#ffffff' },
  { name: 'Oceano', bgType: 'gradient', bgValue: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)', buttonColor: '#ffffff', buttonTextColor: '#0f172a', textColor: '#ffffff' },
  { name: 'Sunset', bgType: 'gradient', bgValue: 'linear-gradient(135deg, #f97316 0%, #db2777 100%)', buttonColor: '#ffffff', buttonTextColor: '#7c2d12', textColor: '#ffffff' },
  { name: 'Floresta', bgType: 'solid', bgValue: '#08221a', buttonColor: '#10b981', buttonTextColor: '#052e16', textColor: '#eafff5' },
  { name: 'Rosé', bgType: 'gradient', bgValue: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)', buttonColor: '#ffffff', buttonTextColor: '#831843', textColor: '#ffffff' },
  { name: 'Claro', bgType: 'solid', bgValue: '#f5f5f7', buttonColor: '#111827', buttonTextColor: '#ffffff', textColor: '#111827' },
];

const THEME_PRESETS: { name: string; theme: BioTheme }[] = [
  { name: 'Escuro', theme: { bgType: 'solid', bgValue: '#0e1119', buttonColor: '#1f2937', buttonTextColor: '#ffffff', buttonShape: 'rounded', buttonStyle: 'fill', textColor: '#ffffff', font: FONT_OPTIONS[0].value, avatarShape: 'circle' } },
  { name: 'Oceano', theme: { bgType: 'gradient', bgValue: GRADIENT_PRESETS[1], buttonColor: '#ffffff', buttonTextColor: '#0f172a', buttonShape: 'pill', buttonStyle: 'fill', textColor: '#ffffff', font: FONT_OPTIONS[2].value, avatarShape: 'circle' } },
  { name: 'Sunset', theme: { bgType: 'gradient', bgValue: GRADIENT_PRESETS[3], buttonColor: '#ffffff', buttonTextColor: '#7c2d12', buttonShape: 'large', buttonStyle: 'glass', textColor: '#ffffff', font: FONT_OPTIONS[0].value, avatarShape: 'rounded' } },
  { name: 'Neon', theme: { bgType: 'solid', bgValue: '#0a0a0a', buttonColor: '#22c55e', buttonTextColor: '#052e16', buttonShape: 'square', buttonStyle: 'hard', textColor: '#22c55e', font: FONT_OPTIONS[3].value, avatarShape: 'square' } },
  { name: 'Rosé', theme: { bgType: 'gradient', bgValue: GRADIENT_PRESETS[2], buttonColor: '#ffffff', buttonTextColor: '#831843', buttonShape: 'pill', buttonStyle: 'soft', textColor: '#ffffff', font: FONT_OPTIONS[5].value, avatarShape: 'circle' } },
  { name: 'Minimal', theme: { bgType: 'solid', bgValue: '#f5f5f7', buttonColor: '#111827', buttonTextColor: '#ffffff', buttonShape: 'rounded', buttonStyle: 'outline', textColor: '#111827', font: FONT_OPTIONS[1].value, avatarShape: 'rounded' } },
];

const DEFAULT_THEME: BioTheme = {
  bgType: 'solid', bgValue: '#0e1119', buttonColor: '#2563eb', buttonTextColor: '#ffffff',
  buttonShape: 'rounded', buttonStyle: 'fill', textColor: '#ffffff',
  font: FONT_OPTIONS[0].value, avatarShape: 'circle',
};

const EMOJI_SUGGESTIONS = ['🔥', '🛒', '💸', '📱', '💬', '📸', '🎥', '⭐', '🎁', '📦', '💚', '🏷️'];

const BLOCK_META: Record<BioBlockType, { label: string; icon: React.ReactNode; color: string }> = {
  link: { label: 'Link', icon: <Link2 className="w-3.5 h-3.5" />, color: 'bg-blue-500/15 text-blue-300' },
  section: { label: 'Seção', icon: <TypeIcon className="w-3.5 h-3.5" />, color: 'bg-purple-500/15 text-purple-300' },
  text: { label: 'Texto', icon: <AlignLeft className="w-3.5 h-3.5" />, color: 'bg-amber-500/15 text-amber-300' },
  image: { label: 'Imagem', icon: <ImageIcon className="w-3.5 h-3.5" />, color: 'bg-emerald-500/15 text-emerald-300' },
  video: { label: 'Vídeo', icon: <Video className="w-3.5 h-3.5" />, color: 'bg-red-500/15 text-red-300' },
};

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
type SubTab = 'content' | 'appearance' | 'profile';

const inputCls =
  'w-full bg-[#0b0e15] border border-[#1e2636] rounded-xl px-3 py-2.5 text-sm text-[#eef2f9] placeholder-[#4b5872] focus:outline-none focus:border-blue-500/60 transition-colors';
const labelCls = 'block text-[11px] font-bold uppercase tracking-wider text-[#93a0b5] mb-1.5';
const chip = (active: boolean) =>
  `px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${active ? 'border-blue-500 bg-blue-500/10 text-blue-300' : 'border-[#1e2636] text-[#93a0b5] hover:text-white'}`;

// ── Campo de upload de imagem (arquivo do dispositivo ou URL) ─────────────────
const ImageField: React.FC<{
  label: string;
  value?: string;
  onChange: (url: string) => void;
  uid?: string;
  kind: string;
  onError: (msg: string) => void;
}> = ({ label, value, onChange, uid, kind, onError }) => {
  const inputId = `upl_${kind}_${genId()}`;
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !uid) return;
    setUploading(true);
    try {
      const { url } = await uploadBioImage(file, uid, kind);
      onChange(url);
    } catch (err: any) {
      onError(err?.message || 'Falha no upload da imagem.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex items-center gap-3">
        {value ? (
          <img src={value} alt="" className="w-12 h-12 rounded-lg object-cover border border-[#1e2636]" />
        ) : (
          <div className="w-12 h-12 rounded-lg border border-dashed border-[#2a3550] flex items-center justify-center text-[#4b5872]"><ImageIcon className="w-5 h-5" /></div>
        )}
        <div className="flex-1 space-y-1.5">
          <div className="flex gap-2">
            <label htmlFor={inputId} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#151a26] hover:bg-[#1e2636] border border-[#1e2636] text-[#eef2f9] text-xs font-bold cursor-pointer transition-colors">
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {uploading ? 'Enviando...' : 'Enviar imagem'}
            </label>
            <input id={inputId} type="file" accept="image/*" onChange={handleFile} className="hidden" />
            {value ? (
              <button type="button" onClick={() => onChange('')} className="px-2 py-1.5 rounded-lg text-[#93a0b5] hover:text-red-400 text-xs font-bold"><Trash2 className="w-3.5 h-3.5" /></button>
            ) : null}
          </div>
          <input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="ou cole uma URL de imagem" className={inputCls + ' text-xs py-1.5'} />
        </div>
      </div>
    </div>
  );
};

export const BioTab: React.FC<BioTabProps> = ({ user, uid }) => {
  const [loading, setLoading] = useState(true);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);

  const [slug, setSlug] = useState('');
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');
  const [generating, setGenerating] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [theme, setTheme] = useState<BioTheme>(DEFAULT_THEME);
  const [blocks, setBlocks] = useState<BioBlock[]>([]);

  const [subTab, setSubTab] = useState<SubTab>('content');
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [clicksMap, setClicksMap] = useState<Record<string, { clicks: number }>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  const lastSavedRef = useRef<string>('');
  const dragIdRef = useRef<string | null>(null);
  const shortDomain = getShortDomain().replace(/^https?:\/\//, '');

  const editableSnapshot = useCallback(
    () => JSON.stringify({ displayName, bio, avatarUrl, bannerUrl, theme, blocks }),
    [displayName, bio, avatarUrl, bannerUrl, theme, blocks],
  );

  // ── Carregar bio existente ──────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!uid) { setLoading(false); return; }
      try {
        const q = query(collection(db, 'bioPages'), where('ownerUid', '==', uid), limit(1));
        const snap = await getDocs(q);
        if (mounted && !snap.empty) {
          const data = snap.docs[0].data() as BioPage;
          const sl = data.slug || snap.docs[0].id;
          setSavedSlug(sl);
          setSlug(sl);
          setDisplayName(data.displayName || '');
          setBio(data.bio || '');
          setAvatarUrl(data.avatarUrl || '');
          setBannerUrl(data.bannerUrl || '');
          setTheme({ ...DEFAULT_THEME, ...(data.theme || {}) });
          setBlocks(Array.isArray(data.blocks) ? data.blocks : []);
          lastSavedRef.current = JSON.stringify({
            displayName: data.displayName || '', bio: data.bio || '',
            avatarUrl: data.avatarUrl || '', bannerUrl: data.bannerUrl || '',
            theme: { ...DEFAULT_THEME, ...(data.theme || {}) },
            blocks: Array.isArray(data.blocks) ? data.blocks : [],
          });
        } else if (mounted) {
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

  // ── Analytics ────────────────────────────────────────────────────────────────
  const refreshClicks = useCallback(async () => {
    try {
      const res = await apiFetch('/api/analytics/clicks', { action: 'Analytics Bio' });
      const json = await res.json();
      if (json?.clicksMap) setClicksMap(json.clicksMap);
    } catch { /* silencioso */ }
  }, []);
  useEffect(() => { refreshClicks(); }, [refreshClicks]);

  // ── Disponibilidade do slug (fase de criação) ────────────────────────────────
  useEffect(() => {
    if (savedSlug) return; // slug travado; não checar
    const clean = sanitizeSlug(slug);
    if (!clean || clean.length < 3) { setSlugStatus(clean ? 'invalid' : 'idle'); return; }
    if (RESERVED.has(clean)) { setSlugStatus('taken'); return; }
    setSlugStatus('checking');
    const t = setTimeout(async () => {
      try {
        const [bioSnap, shortSnap] = await Promise.all([
          getDoc(doc(db, 'bioPages', clean)),
          getDoc(doc(db, 'shortLinks', clean)),
        ]);
        setSlugStatus(bioSnap.exists() || shortSnap.exists() ? 'taken' : 'available');
      } catch { setSlugStatus('idle'); }
    }, 500);
    return () => clearTimeout(t);
  }, [slug, savedSlug]);

  // ── Autosave (fase de edição) ────────────────────────────────────────────────
  const persist = useCallback(async () => {
    if (!savedSlug || !uid) return;
    const snapshot = editableSnapshot();
    setSaveStatus('saving');
    try {
      const payload = {
        slug: savedSlug, ownerUid: uid, userId: uid, createdBy: uid,
        displayName, bio, avatarUrl: avatarUrl.trim(), bannerUrl: bannerUrl.trim(),
        theme, blocks: blocks.map((b, i) => ({ ...b, order: i })),
        published: true, updatedAt: new Date().toISOString(),
      };
      const clean = JSON.parse(JSON.stringify(payload));
      await setDoc(doc(db, 'bioPages', savedSlug), clean, { merge: true });
      lastSavedRef.current = snapshot;
      setSaveStatus('saved');
    } catch (e) {
      console.error('Erro ao salvar bio:', e);
      setSaveStatus('idle');
      setToast({ type: 'err', msg: 'Falha ao salvar. Verifique a conexão.' });
    }
  }, [savedSlug, uid, displayName, bio, avatarUrl, bannerUrl, theme, blocks, editableSnapshot]);

  useEffect(() => {
    if (!savedSlug) return;
    if (editableSnapshot() === lastSavedRef.current) return;
    const t = setTimeout(() => { persist(); }, 800);
    return () => clearTimeout(t);
  }, [savedSlug, persist, editableSnapshot]);

  useEffect(() => {
    if (saveStatus !== 'saved') return;
    const t = setTimeout(() => setSaveStatus('idle'), 1800);
    return () => clearTimeout(t);
  }, [saveStatus]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Gerar bio (trava o slug) ──────────────────────────────────────────────────
  const handleGenerate = async () => {
    const clean = sanitizeSlug(slug);
    if (slugStatus !== 'available' || !clean || !uid) return;
    setGenerating(true);
    try {
      const name = displayName.trim() || user?.name || clean;
      const now = new Date().toISOString();
      const payload = {
        slug: clean, ownerUid: uid, userId: uid, createdBy: uid,
        displayName: name, bio: '', theme: DEFAULT_THEME, blocks: [],
        published: true, createdAt: now, updatedAt: now,
      };
      await setDoc(doc(db, 'bioPages', clean), JSON.parse(JSON.stringify(payload)));
      setSavedSlug(clean);
      setDisplayName(name);
      setTheme(DEFAULT_THEME);
      setBlocks([]);
      lastSavedRef.current = JSON.stringify({ displayName: name, bio: '', avatarUrl: '', bannerUrl: '', theme: DEFAULT_THEME, blocks: [] });
      setToast({ type: 'ok', msg: 'Bio criada! Agora personalize do seu jeito.' });
      setSubTab('content');
    } catch (e) {
      console.error('Erro ao gerar bio:', e);
      setToast({ type: 'err', msg: 'Não foi possível criar a bio.' });
    } finally {
      setGenerating(false);
    }
  };

  // ── Excluir e recomeçar ──────────────────────────────────────────────────────
  const handleDeleteAll = async () => {
    if (!savedSlug) return;
    try {
      await deleteDoc(doc(db, 'bioPages', savedSlug));
    } catch (e) { console.error('Erro ao excluir bio:', e); }
    setSavedSlug(null);
    setSlug('');
    setSlugStatus('idle');
    setDisplayName(user?.name || '');
    setBio('');
    setAvatarUrl('');
    setBannerUrl('');
    setTheme(DEFAULT_THEME);
    setBlocks([]);
    setEditingBlockId(null);
    setConfirmDelete(false);
    lastSavedRef.current = '';
    setToast({ type: 'ok', msg: 'Bio excluída. Você pode escolher um novo link.' });
  };

  // ── Blocos ────────────────────────────────────────────────────────────────────
  const addBlock = (type: BioBlockType) => {
    const id = genId();
    const base: BioBlock = { id, type, active: true, order: blocks.length };
    if (type === 'section') base.title = 'Nova seção';
    setBlocks((prev) => [...prev, base]);
    setEditingBlockId(id);
  };
  const updateBlock = (id: string, patch: Partial<BioBlock>) =>
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id).map((b, i) => ({ ...b, order: i })));
    if (editingBlockId === id) setEditingBlockId(null);
  };
  const moveBlock = (id: string, dir: -1 | 1) =>
    setBlocks((prev) => {
      const arr = [...prev];
      const idx = arr.findIndex((b) => b.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= arr.length) return prev;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr.map((b, i) => ({ ...b, order: i }));
    });

  // ── Arrastar para reordenar (funciona no toque via Pointer Events) ───────────
  const reorderTo = (id: string, overId: string) =>
    setBlocks((prev) => {
      const from = prev.findIndex((b) => b.id === id);
      const to = prev.findIndex((b) => b.id === overId);
      if (from < 0 || to < 0 || from === to) return prev;
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr.map((b, i) => ({ ...b, order: i }));
    });
  const handleDragMove = useCallback((e: PointerEvent) => {
    const id = dragIdRef.current;
    if (!id) return;
    const el = document.elementFromPoint(e.clientX, e.clientY) as Element | null;
    const card = el?.closest('[data-block-id]');
    const overId = card?.getAttribute('data-block-id');
    if (overId && overId !== id) reorderTo(id, overId);
  }, []);
  const endDrag = useCallback(() => {
    dragIdRef.current = null;
    setDragId(null);
    window.removeEventListener('pointermove', handleDragMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
  }, [handleDragMove]);
  const startDrag = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    dragIdRef.current = id;
    setDragId(id);
    window.addEventListener('pointermove', handleDragMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  };
  useEffect(() => () => endDrag(), [endDrag]);

  // ── Página atual (preview + save) ────────────────────────────────────────────
  const currentPage: BioPage = useMemo(() => ({
    slug: savedSlug || sanitizeSlug(slug),
    ownerUid: uid || '', userId: uid, createdBy: uid,
    displayName, bio,
    avatarUrl: avatarUrl.trim() || undefined,
    bannerUrl: bannerUrl.trim() || undefined,
    theme, blocks, published: true,
  }), [savedSlug, slug, uid, displayName, bio, avatarUrl, bannerUrl, theme, blocks]);

  const publicUrl = `${shortDomain}/${savedSlug || sanitizeSlug(slug) || 'seu-link'}`;
  const fullPublicUrl = `https://${publicUrl}`;
  const copyUrl = () => navigator.clipboard?.writeText(fullPublicUrl).then(
    () => setToast({ type: 'ok', msg: 'Link copiado!' }),
    () => setToast({ type: 'err', msg: 'Falha ao copiar.' }),
  );
  const shareUrl = async () => {
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try { await (navigator as any).share({ title: displayName || 'Meu link', text: bio || 'Confira meus links', url: fullPublicUrl }); } catch { /* cancelado */ }
    } else {
      copyUrl();
    }
  };
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(fullPublicUrl)}`;

  const setThemeField = <K extends keyof BioTheme>(k: K, v: BioTheme[K]) => setTheme((t) => ({ ...t, [k]: v }));
  const applyPalette = (p: typeof PALETTE_PRESETS[number]) =>
    setTheme((t) => ({ ...t, bgType: p.bgType, bgValue: p.bgValue, buttonColor: p.buttonColor, buttonTextColor: p.buttonTextColor, textColor: p.textColor }));

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-7 h-7 text-blue-400 animate-spin" /></div>;
  }

  // ══════════════ FASE 1: escolher o link (ainda não gerado) ══════════════
  if (!savedSlug) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-extrabold text-white">Crie seu Link in Bio</h3>
          </div>
          <p className="text-xs text-[#93a0b5] mb-5">
            Escolha o endereço da sua página. <span className="text-amber-300 font-semibold">Atenção:</span> depois de gerar, o link não poderá ser alterado — só excluindo a bio e começando de novo.
          </p>

          <label className={labelCls}>Seu link</label>
          <div className="flex items-center bg-[#0b0e15] border border-[#1e2636] rounded-xl overflow-hidden focus-within:border-blue-500/60">
            <span className="pl-3 pr-1 text-sm text-[#4b5872] font-mono select-none">{shortDomain}/</span>
            <input
              value={slug}
              onChange={(e) => setSlug(sanitizeSlug(e.target.value))}
              placeholder="radardeofertas"
              className="flex-1 bg-transparent py-3 pr-3 text-sm text-[#eef2f9] placeholder-[#4b5872] focus:outline-none font-mono"
              maxLength={40}
            />
            <span className="pr-3 flex items-center">
              {slugStatus === 'checking' && <Loader2 className="w-4 h-4 text-[#93a0b5] animate-spin" />}
              {slugStatus === 'available' && <Check className="w-4 h-4 text-emerald-400" />}
              {(slugStatus === 'taken' || slugStatus === 'invalid') && <X className="w-4 h-4 text-red-400" />}
            </span>
          </div>
          <div className="mt-1.5 min-h-[16px] text-[11px] font-semibold">
            {slugStatus === 'available' && <span className="text-emerald-400">✓ Disponível</span>}
            {slugStatus === 'taken' && <span className="text-red-400">✗ Já está em uso, escolha outro nome</span>}
            {slugStatus === 'invalid' && <span className="text-amber-400">Use ao menos 3 caracteres (letras, números e hífen)</span>}
          </div>

          <button
            onClick={handleGenerate}
            disabled={slugStatus !== 'available' || generating}
            className="mt-5 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 hover:brightness-110 text-white font-bold text-sm shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Gerar minha bio
          </button>
        </div>

        {toast && (
          <div className={`mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold ${toast.type === 'ok' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/10 text-red-300 border border-red-500/30'}`}>
            {toast.type === 'ok' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}{toast.msg}
          </div>
        )}
      </div>
    );
  }

  // ══════════════ FASE 2: editor completo ══════════════
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
      <div className="space-y-5">
        {/* Cabeçalho: link travado */}
        <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Lock className="w-4 h-4 text-[#93a0b5] shrink-0" />
              <span className="font-mono text-sm text-white break-all">{shortDomain}/<span className="text-blue-400 font-bold">{savedSlug}</span></span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-semibold">
              {saveStatus === 'saving' && <span className="flex items-center gap-1 text-[#93a0b5]"><Loader2 className="w-3 h-3 animate-spin" /> Salvando...</span>}
              {saveStatus === 'saved' && <span className="flex items-center gap-1 text-emerald-400"><Check className="w-3 h-3" /> Salvo</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={shareUrl} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"><Share2 className="w-3.5 h-3.5" /> Compartilhar</button>
            <button onClick={copyUrl} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#151a26] hover:bg-[#1e2636] border border-[#1e2636] text-[#eef2f9] text-xs font-bold transition-colors"><Copy className="w-3.5 h-3.5" /> Copiar</button>
            <button onClick={() => setShowQr((v) => !v)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#151a26] hover:bg-[#1e2636] border border-[#1e2636] text-[#eef2f9] text-xs font-bold transition-colors"><QrCode className="w-3.5 h-3.5" /> QR Code</button>
            <a href={fullPublicUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#151a26] hover:bg-[#1e2636] border border-[#1e2636] text-[#eef2f9] text-xs font-bold transition-colors"><ExternalLink className="w-3.5 h-3.5" /> Abrir</a>
            <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold transition-colors ml-auto"><RotateCcw className="w-3.5 h-3.5" /> Excluir e recomeçar</button>
          </div>
          {showQr && (
            <div className="mt-3 flex flex-col items-center gap-2 p-4 rounded-xl bg-[#0b0e15] border border-[#1e2636]">
              <img src={qrSrc} alt="QR Code do seu link" width={200} height={200} className="rounded-lg bg-white p-2" />
              <p className="text-[11px] text-[#93a0b5] text-center">Aponte a câmera para abrir <span className="font-mono text-blue-400">{shortDomain}/{savedSlug}</span></p>
            </div>
          )}
          {confirmDelete && (
            <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
              <p className="text-xs text-red-200 mb-2">Isso apaga a bio inteira e libera o link <b>{savedSlug}</b>. Não dá pra desfazer.</p>
              <div className="flex gap-2">
                <button onClick={handleDeleteAll} className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold">Sim, excluir tudo</button>
                <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-lg bg-[#151a26] border border-[#1e2636] text-[#eef2f9] text-xs font-bold">Cancelar</button>
              </div>
            </div>
          )}
        </div>

        {/* Sub-abas */}
        <div className="flex gap-1 bg-[#0b0e15] border border-[#1e2636] rounded-xl p-1">
          {([['content', 'Conteúdo', <LayoutGrid className="w-4 h-4" />], ['appearance', 'Aparência', <Palette className="w-4 h-4" />], ['profile', 'Perfil', <User className="w-4 h-4" />]] as [SubTab, string, React.ReactNode][]).map(([id, label, icon]) => (
            <button key={id} onClick={() => setSubTab(id)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors ${subTab === id ? 'bg-blue-600 text-white' : 'text-[#93a0b5] hover:text-white'}`}>
              {icon} {label}
            </button>
          ))}
        </div>

        {/* ─── CONTEÚDO ─── */}
        {subTab === 'content' && (
          <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap gap-2">
              {(['link', 'section', 'text', 'image', 'video'] as BioBlockType[]).map((t) => (
                <button key={t} onClick={() => addBlock(t)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#151a26] hover:bg-[#1e2636] border border-[#1e2636] text-[#eef2f9] text-xs font-bold transition-colors">
                  <Plus className="w-3.5 h-3.5" /> {BLOCK_META[t].label}
                </button>
              ))}
            </div>

            {blocks.length === 0 && (
              <p className="text-center text-xs text-[#4b5872] py-8">Nenhum bloco ainda. Adicione links, seções, textos, imagens ou vídeos acima.</p>
            )}

            <div className="space-y-2.5">
              {blocks.map((block, idx) => {
                const meta = BLOCK_META[block.type];
                const editing = editingBlockId === block.id;
                const clicks = clicksMap[`bio_${savedSlug}_${block.id}`]?.clicks || 0;
                const summary = block.type === 'text' ? (block.text || '—')
                  : block.type === 'image' ? (block.imageUrl ? 'Imagem' : '(sem imagem)')
                  : block.type === 'video' ? (block.videoUrl || '(sem URL)')
                  : (block.title || '(sem título)');

                return (
                  <div key={block.id} data-block-id={block.id} className={`rounded-xl border bg-[#0b0e15] transition-shadow ${dragId === block.id ? 'border-blue-500 ring-2 ring-blue-500/50 opacity-90' : 'border-[#1e2636]'}`}>
                    {/* Cabeçalho do card (sempre visível) */}
                    <div className="flex items-center gap-2 p-3">
                      <div className="flex flex-col items-center gap-0.5">
                        <button onPointerDown={(e) => startDrag(e, block.id)} title="Arraste para mover" style={{ touchAction: 'none' }} className="cursor-grab active:cursor-grabbing text-[#4b5872] hover:text-white"><GripVertical className="w-4 h-4" /></button>
                        <button onClick={() => moveBlock(block.id, -1)} disabled={idx === 0} className="text-[#4b5872] hover:text-white disabled:opacity-30"><ArrowUp className="w-3 h-3" /></button>
                        <button onClick={() => moveBlock(block.id, 1)} disabled={idx === blocks.length - 1} className="text-[#4b5872] hover:text-white disabled:opacity-30"><ArrowDown className="w-3 h-3" /></button>
                      </div>
                      <span className={`shrink-0 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${meta.color}`}>{meta.icon}{meta.label}</span>
                      <span className="flex-1 truncate text-sm text-[#eef2f9] font-medium">{summary}</span>
                      {block.type === 'link' && <span className="flex items-center gap-1 text-[10px] text-[#93a0b5] shrink-0"><BarChart2 className="w-3 h-3" />{clicks}</span>}
                      <label className="flex items-center shrink-0 cursor-pointer" title="Visível na página">
                        <input type="checkbox" checked={block.active !== false} onChange={(e) => updateBlock(block.id, { active: e.target.checked })} className="accent-blue-500" />
                      </label>
                      <button onClick={() => setEditingBlockId(editing ? null : block.id)} className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-colors ${editing ? 'bg-blue-600 text-white' : 'bg-[#151a26] text-[#93a0b5] hover:text-white border border-[#1e2636]'}`}>
                        {editing ? <><Check className="w-3.5 h-3.5" /> OK</> : <><Pencil className="w-3.5 h-3.5" /> Editar</>}
                      </button>
                      <button onClick={() => removeBlock(block.id)} className="shrink-0 text-[#4b5872] hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </div>

                    {/* Formulário de edição (só ao clicar em Editar) */}
                    {editing && (
                      <div className="px-3 pb-3 pt-1 border-t border-[#1e2636] space-y-2">
                        {block.type === 'link' && (
                          <div className="grid grid-cols-[64px_1fr] gap-2">
                            <input value={block.icon || ''} onChange={(e) => updateBlock(block.id, { icon: e.target.value })} placeholder="🔥" className={inputCls + ' text-center'} maxLength={2} />
                            <input value={block.title || ''} onChange={(e) => updateBlock(block.id, { title: e.target.value })} placeholder="Título do botão" className={inputCls} maxLength={60} />
                            <input value={block.url || ''} onChange={(e) => updateBlock(block.id, { url: e.target.value })} placeholder="https://... (produto, WhatsApp, Instagram)" className={inputCls + ' col-span-2'} />
                          </div>
                        )}
                        {block.type === 'section' && (
                          <input value={block.title || ''} onChange={(e) => updateBlock(block.id, { title: e.target.value })} placeholder="Título da seção" className={inputCls} maxLength={60} />
                        )}
                        {block.type === 'text' && (
                          <textarea value={block.text || ''} onChange={(e) => updateBlock(block.id, { text: e.target.value })} placeholder="Escreva um parágrafo..." rows={3} className={inputCls + ' resize-none'} maxLength={500} />
                        )}
                        {block.type === 'image' && (
                          <div className="space-y-2">
                            <ImageField label="Imagem" value={block.imageUrl} onChange={(url) => updateBlock(block.id, { imageUrl: url })} uid={uid} kind="block" onError={(m) => setToast({ type: 'err', msg: m })} />
                            <input value={block.url || ''} onChange={(e) => updateBlock(block.id, { url: e.target.value })} placeholder="Link ao clicar na imagem (opcional)" className={inputCls} />
                          </div>
                        )}
                        {block.type === 'video' && (
                          <div className="space-y-1">
                            <input value={block.videoUrl || ''} onChange={(e) => updateBlock(block.id, { videoUrl: e.target.value })} placeholder="Cole o link do YouTube ou Vimeo" className={inputCls} />
                            <p className="text-[10px] text-[#4b5872]">Suporta YouTube (incl. Shorts) e Vimeo. O vídeo aparece embutido na página.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {blocks.some((b) => editingBlockId === b.id && b.type === 'link') && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] text-[#4b5872] self-center">Emojis:</span>
                {EMOJI_SUGGESTIONS.map((e) => <span key={e} className="text-sm opacity-70 select-all">{e}</span>)}
              </div>
            )}
          </div>
        )}

        {/* ─── APARÊNCIA ─── */}
        {subTab === 'appearance' && (
          <div className="space-y-5">
            {/* Temas prontos */}
            <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-4 sm:p-5">
              <label className={labelCls}>Temas prontos</label>
              <div className="flex flex-wrap gap-2">
                {THEME_PRESETS.map((p) => (
                  <button key={p.name} onClick={() => setTheme(p.theme)} type="button" className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[#1e2636] hover:border-blue-500/60 text-white transition-colors" style={{ background: p.theme.bgValue }}>{p.name}</button>
                ))}
              </div>
            </div>

            {/* Cores */}
            <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-4 sm:p-5 space-y-4">
              <label className={labelCls}>Paletas de cores</label>
              <div className="flex flex-wrap gap-2">
                {PALETTE_PRESETS.map((p) => (
                  <button key={p.name} onClick={() => applyPalette(p)} type="button" className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[#1e2636] hover:border-blue-500/60 text-white transition-colors" style={{ background: p.bgValue }}>{p.name}</button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {([['buttonColor', 'Botão'], ['buttonTextColor', 'Texto do botão'], ['textColor', 'Texto']] as [keyof BioTheme, string][]).map(([k, lbl]) => (
                  <div key={k}>
                    <label className={labelCls}>{lbl}</label>
                    <input type="color" value={String(theme[k])} onChange={(e) => setThemeField(k, e.target.value as any)} className="w-full h-9 rounded-lg bg-transparent border border-[#1e2636] cursor-pointer" />
                  </div>
                ))}
              </div>
            </div>

            {/* Fundo */}
            <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-4 sm:p-5 space-y-3">
              <label className={labelCls}>Fundo</label>
              <div className="flex gap-2">
                {(['solid', 'gradient', 'image'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setThemeField('bgType', t)} className={chip(theme.bgType === t)}>{t === 'solid' ? 'Cor' : t === 'gradient' ? 'Gradiente' : 'Imagem'}</button>
                ))}
              </div>
              {theme.bgType === 'solid' && (
                <div className="flex items-center gap-3">
                  <input type="color" value={theme.bgValue.startsWith('#') ? theme.bgValue : '#0e1119'} onChange={(e) => setThemeField('bgValue', e.target.value)} className="w-10 h-10 rounded-lg bg-transparent border border-[#1e2636] cursor-pointer" />
                  <input value={theme.bgValue} onChange={(e) => setThemeField('bgValue', e.target.value)} className={inputCls} />
                </div>
              )}
              {theme.bgType === 'gradient' && (
                <div className="flex flex-wrap gap-2">
                  {GRADIENT_PRESETS.map((g) => (
                    <button key={g} type="button" onClick={() => setThemeField('bgValue', g)} className={`w-12 h-9 rounded-lg border-2 transition-all ${theme.bgValue === g ? 'border-white' : 'border-transparent'}`} style={{ background: g }} />
                  ))}
                </div>
              )}
              {theme.bgType === 'image' && (
                <ImageField label="Imagem de fundo" value={theme.bgValue.startsWith('http') ? theme.bgValue : ''} onChange={(url) => setThemeField('bgValue', url)} uid={uid} kind="bg" onError={(m) => setToast({ type: 'err', msg: m })} />
              )}
            </div>

            {/* Estilo dos botões / cards */}
            <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-4 sm:p-5 space-y-4">
              <div>
                <label className={labelCls}>Estilo do card</label>
                <div className="flex flex-wrap gap-2">
                  {STYLE_OPTIONS.map((s) => <button key={s.value} type="button" onClick={() => setThemeField('buttonStyle', s.value)} className={chip(theme.buttonStyle === s.value)}>{s.label}</button>)}
                </div>
              </div>
              <div>
                <label className={labelCls}>Formato do card</label>
                <div className="flex flex-wrap gap-2">
                  {SHAPE_OPTIONS.map((s) => <button key={s.value} type="button" onClick={() => setThemeField('buttonShape', s.value)} className={chip(theme.buttonShape === s.value)}>{s.label}</button>)}
                </div>
              </div>
              <div>
                <label className={labelCls}>Formato do avatar</label>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_OPTIONS.map((s) => <button key={s.value} type="button" onClick={() => setThemeField('avatarShape', s.value)} className={chip(theme.avatarShape === s.value)}>{s.label}</button>)}
                </div>
              </div>
              <div>
                <label className={labelCls}>Fonte</label>
                <div className="flex flex-wrap gap-2">
                  {FONT_OPTIONS.map((f) => <button key={f.value} type="button" onClick={() => setThemeField('font', f.value)} className={chip(theme.font === f.value)} style={{ fontFamily: f.value }}>{f.label}</button>)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── PERFIL ─── */}
        {subTab === 'profile' && (
          <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-4 sm:p-5 space-y-4">
            <div>
              <label className={labelCls}>Nome de exibição</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Radar de Ofertas" className={inputCls} maxLength={60} />
            </div>
            <div>
              <label className={labelCls}>Bio (descrição curta)</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="As melhores ofertas do dia 🔥" rows={2} className={inputCls + ' resize-none'} maxLength={160} />
            </div>
            <ImageField label="Foto de perfil" value={avatarUrl} onChange={setAvatarUrl} uid={uid} kind="avatar" onError={(m) => setToast({ type: 'err', msg: m })} />
            <ImageField label="Banner / capa" value={bannerUrl} onChange={setBannerUrl} uid={uid} kind="banner" onError={(m) => setToast({ type: 'err', msg: m })} />
          </div>
        )}

        {toast && (
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold ${toast.type === 'ok' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/10 text-red-300 border border-red-500/30'}`}>
            {toast.type === 'ok' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}{toast.msg}
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="lg:sticky lg:top-6 h-fit">
        <div className="flex items-center gap-2 mb-2 text-[#93a0b5]"><Eye className="w-4 h-4" /><span className="text-xs font-bold uppercase tracking-wider">Pré-visualização</span></div>
        <div className="mx-auto w-full max-w-[300px] rounded-[2rem] border-[6px] border-[#1e2636] bg-black overflow-hidden shadow-2xl" style={{ height: 560 }}>
          <div className="w-full h-full overflow-y-auto"><BioContent page={currentPage} /></div>
        </div>
        <p className="text-center text-[11px] text-[#93a0b5] mt-3 font-mono break-all">{shortDomain}/{savedSlug}</p>
      </div>
    </div>
  );
};

export default BioTab;
