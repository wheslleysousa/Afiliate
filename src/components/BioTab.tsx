import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  doc, getDoc, setDoc, deleteDoc, collection, query, where, limit, getDocs,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  BioPage, BioBlock, BioBlockType, BioTheme, BioButtonShape, BioButtonStyle, BioAvatarShape,
  BioIconType, BioSocial, UserProfile,
} from '../types';
import { BioContent } from './BioContent';
import { BUILTIN_ICONS, SOCIAL_PLATFORMS, renderBuiltinIcon } from './bioIcons';
import { apiFetch, getShortDomain } from '../utils/apiBase';
import { uploadBioImage } from '../utils/uploadImage';
import {
  Loader2, Check, X, Trash2, ArrowUp, ArrowDown, Link2, Type as TypeIcon,
  Copy, ExternalLink, Eye, BarChart2, Sparkles, AlertCircle, Image as ImageIcon,
  Video, AlignLeft, Pencil, Upload, Plus, Palette, LayoutGrid, User, Lock, RotateCcw,
  GripVertical, Share2, QrCode, ChevronDown,
} from 'lucide-react';

interface BioTabProps {
  user: UserProfile | null;
  uid?: string;
}

const RESERVED = new Set([
  'dashboard', 'new-product', 'saved-products', 'marketplace', 'my-products', 'projects',
  'whatsapp-auto', 'templates', 'extension', 'url-shortener', 'bio', 'settings', 'api-docs',
  'api', 'r', 'rb', 'assets', 'health', 'admin', 'login', 'logout', 'signup', 'register',
  'sitemap', 'robots', 'favicon', 'index', 'home', 'app', 'www', 'static', 'public',
]);

const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: 'Padrão', value: 'Inter, system-ui, sans-serif' },
  { label: 'Serifada', value: "Georgia, 'Times New Roman', serif" },
  { label: 'Suave', value: "'Trebuchet MS', 'Segoe UI', sans-serif" },
  { label: 'Mono', value: "'Courier New', ui-monospace, monospace" },
  { label: 'Larga', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Elegante', value: "'Palatino Linotype', 'Book Antiqua', serif" },
  { label: 'Impacto', value: "'Arial Black', Impact, sans-serif" },
  { label: 'Tahoma', value: 'Tahoma, Geneva, sans-serif' },
  { label: 'Clássica', value: "Garamond, 'Times New Roman', serif" },
  { label: 'Console', value: "'Lucida Console', Monaco, monospace" },
];

// Estilos de fundo variados (gradientes, mesh, padrões) — aplicados como background CSS
const BG_STYLES: { name: string; css: string }[] = [
  { name: 'Ardósia', css: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' },
  { name: 'Oceano', css: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)' },
  { name: 'Uva', css: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)' },
  { name: 'Sunset', css: 'linear-gradient(135deg, #f97316 0%, #db2777 100%)' },
  { name: 'Menta', css: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' },
  { name: 'Índigo', css: 'radial-gradient(circle at 30% 20%, #4f46e5, #0f172a 60%)' },
  { name: 'Magenta', css: 'radial-gradient(circle at 70% 30%, #db2777, #111827 60%)' },
  { name: 'Cônico', css: 'conic-gradient(from 180deg at 50% 50%, #312e81, #0f172a, #312e81)' },
  { name: 'Mesh', css: 'radial-gradient(at 20% 20%, #7c3aed 0, transparent 50%), radial-gradient(at 80% 0%, #2563eb 0, transparent 50%), radial-gradient(at 0% 80%, #db2777 0, transparent 50%), #0b1020' },
  { name: 'Bolinhas', css: 'radial-gradient(#ffffff22 1px, transparent 1px) 0 0/16px 16px, #0e1119' },
  { name: 'Listras', css: 'repeating-linear-gradient(45deg, #111827, #111827 10px, #0b1020 10px, #0b1020 20px)' },
  { name: 'Grade', css: 'linear-gradient(#ffffff11 1px, transparent 1px) 0 0/22px 22px, linear-gradient(90deg,#ffffff11 1px, transparent 1px) 0 0/22px 22px, #0e1119' },
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
  { value: 'gradient', label: 'Gradiente' },
  { value: 'outline', label: 'Contorno' },
  { value: 'soft', label: 'Suave' },
  { value: 'glass', label: 'Vidro' },
  { value: 'hard', label: '3D' },
  { value: 'neumorph', label: 'Neumorfismo' },
];

const AVATAR_OPTIONS: { value: BioAvatarShape; label: string }[] = [
  { value: 'circle', label: 'Círculo' },
  { value: 'rounded', label: 'Arredondado' },
  { value: 'squircle', label: 'Squircle' },
  { value: 'square', label: 'Quadrado' },
  { value: 'none', label: 'Sem foto' },
];

const DEFAULT_THEME: BioTheme = {
  bgType: 'solid', bgValue: '#0e1119', buttonColor: '#2563eb', buttonColor2: '#06b6d4',
  buttonTextColor: '#ffffff', buttonBorderColor: '#2563eb', buttonBorderWidth: 2,
  buttonShape: 'rounded', buttonStyle: 'fill',
  shadowColor: '#0a0a0a', shadowOffset: 4, shadowBlur: 0,
  textColor: '#ffffff', titleColor: '#ffffff', font: FONT_OPTIONS[0].value,
  titleSize: 22, bioSize: 14, avatarShape: 'circle', avatarSize: 96, bannerHeight: 112,
};

function base(t: Partial<BioTheme>): BioTheme {
  return { ...DEFAULT_THEME, ...t };
}

const THEME_PRESETS: { name: string; theme: BioTheme }[] = [
  { name: 'Escuro', theme: base({ bgType: 'solid', bgValue: '#0e1119', buttonColor: '#1f2937', buttonTextColor: '#fff', buttonShape: 'rounded', buttonStyle: 'fill', textColor: '#fff', font: FONT_OPTIONS[0].value, avatarShape: 'circle' }) },
  { name: 'Oceano', theme: base({ bgType: 'gradient', bgValue: BG_STYLES[1].css, buttonColor: '#ffffff', buttonTextColor: '#0f172a', buttonShape: 'pill', buttonStyle: 'fill', textColor: '#fff', font: FONT_OPTIONS[2].value, avatarShape: 'circle' }) },
  { name: 'Sunset', theme: base({ bgType: 'gradient', bgValue: BG_STYLES[3].css, buttonColor: '#ffffff', buttonTextColor: '#7c2d12', buttonShape: 'large', buttonStyle: 'glass', textColor: '#fff', font: FONT_OPTIONS[0].value, avatarShape: 'rounded' }) },
  { name: 'Neon', theme: base({ bgType: 'solid', bgValue: '#0a0a0a', buttonColor: '#22c55e', buttonTextColor: '#052e16', buttonShape: 'square', buttonStyle: 'hard', shadowColor: '#0affab', shadowOffset: 4, textColor: '#22c55e', font: FONT_OPTIONS[3].value, avatarShape: 'square' }) },
  { name: 'Uva', theme: base({ bgType: 'gradient', bgValue: BG_STYLES[2].css, buttonColor: '#ffffff', buttonTextColor: '#831843', buttonShape: 'pill', buttonStyle: 'soft', textColor: '#fff', font: FONT_OPTIONS[5].value, avatarShape: 'circle' }) },
  { name: 'Minimal', theme: base({ bgType: 'solid', bgValue: '#f5f5f7', buttonColor: '#111827', buttonTextColor: '#fff', buttonShape: 'rounded', buttonStyle: 'outline', buttonBorderColor: '#111827', textColor: '#111827', font: FONT_OPTIONS[1].value, avatarShape: 'rounded' }) },
  { name: 'Mesh', theme: base({ bgType: 'gradient', bgValue: BG_STYLES[8].css, buttonColor: '#8b5cf6', buttonColor2: '#ec4899', buttonTextColor: '#fff', buttonShape: 'large', buttonStyle: 'gradient', textColor: '#fff', font: FONT_OPTIONS[6].value, avatarShape: 'squircle' }) },
  { name: 'Grade', theme: base({ bgType: 'gradient', bgValue: BG_STYLES[11].css, buttonColor: '#38bdf8', buttonTextColor: '#082f49', buttonShape: 'sharp', buttonStyle: 'fill', textColor: '#e0f2fe', font: FONT_OPTIONS[9].value, avatarShape: 'square' }) },
  { name: 'Vidro', theme: base({ bgType: 'gradient', bgValue: BG_STYLES[5].css, buttonColor: '#ffffff', buttonTextColor: '#ffffff', buttonShape: 'large', buttonStyle: 'glass', textColor: '#fff', font: FONT_OPTIONS[2].value, avatarShape: 'circle' }) },
  { name: 'Suave', theme: base({ bgType: 'solid', bgValue: '#111827', buttonColor: '#f472b6', buttonTextColor: '#f472b6', buttonShape: 'pill', buttonStyle: 'soft', textColor: '#fbcfe8', font: FONT_OPTIONS[7].value, avatarShape: 'rounded' }) },
];

const EMOJI_SUGGESTIONS = ['🔥', '🛒', '💸', '📱', '💬', '📸', '🎥', '⭐', '🎁', '📦', '💚', '🏷️', '👉', '✅', '💰', '🎯'];

const BLOCK_META: Record<BioBlockType, { label: string; desc: string; icon: React.ReactNode }> = {
  link: { label: 'Link', desc: 'Botão com um link', icon: <Link2 className="w-4 h-4" /> },
  section: { label: 'Seção', desc: 'Título que separa blocos', icon: <TypeIcon className="w-4 h-4" /> },
  text: { label: 'Texto', desc: 'Um parágrafo livre', icon: <AlignLeft className="w-4 h-4" /> },
  image: { label: 'Imagem', desc: 'Foto (com link opcional)', icon: <ImageIcon className="w-4 h-4" /> },
  video: { label: 'Vídeo', desc: 'YouTube ou Vimeo', icon: <Video className="w-4 h-4" /> },
};

function genId(): string { return Math.random().toString(36).slice(2, 9); }

function sanitizeSlug(raw: string): string {
  return (raw || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isHex(v: string): boolean { return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test((v || '').trim()); }
function radiusOf(shape: BioButtonShape): string {
  return shape === 'sharp' ? '0px' : shape === 'square' ? '6px' : shape === 'large' ? '22px' : shape === 'pill' ? '9999px' : '14px';
}
function avatarRadiusOf(shape: BioAvatarShape): string {
  return shape === 'square' ? '14px' : shape === 'rounded' ? '28px' : shape === 'squircle' ? '32%' : '9999px';
}
function hexA(hex: string, a: number): string {
  const h = (hex || '').replace('#', '');
  if (h.length !== 6 && h.length !== 3) return `rgba(37,99,235,${a})`;
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return `rgba(${parseInt(f.slice(0, 2), 16)},${parseInt(f.slice(2, 4), 16)},${parseInt(f.slice(4, 6), 16)},${a})`;
}
// Estilo aproximado de um card para o seletor visual
function stylePreview(style: BioButtonStyle, t: BioTheme): React.CSSProperties {
  const r = radiusOf(t.buttonShape);
  switch (style) {
    case 'outline': return { borderRadius: r, background: 'transparent', border: `2px solid ${t.buttonColor}` };
    case 'soft': return { borderRadius: r, background: hexA(t.buttonColor, 0.18), border: `1px solid ${hexA(t.buttonColor, 0.35)}` };
    case 'glass': return { borderRadius: r, background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.3)' };
    case 'hard': return { borderRadius: r, background: t.buttonColor, border: '2px solid #0a0a0a', boxShadow: '3px 3px 0 #0a0a0a' };
    case 'neumorph': return { borderRadius: r, background: t.buttonColor, boxShadow: '2px 2px 5px rgba(0,0,0,0.5), -2px -2px 5px rgba(255,255,255,0.08)' };
    case 'gradient': return { borderRadius: r, backgroundImage: `linear-gradient(135deg, ${t.buttonColor}, ${t.buttonColor2 || t.buttonColor})` };
    case 'fill':
    default: return { borderRadius: r, background: t.buttonColor };
  }
}
// Proporções de banner (altura calculada para a largura ~448px do conteúdo)
const BANNER_RATIOS: { label: string; h: number }[] = [
  { label: '4:1', h: 112 },
  { label: '3:1', h: 150 },
  { label: '2.5:1', h: 180 },
  { label: '2:1', h: 224 },
  { label: '16:9', h: 252 },
];

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';
type SubTab = 'content' | 'appearance' | 'profile';

const inputCls = 'w-full bg-[#0b0e15] border border-[#1e2636] rounded-xl px-3 py-2.5 text-sm text-[#eef2f9] placeholder-[#4b5872] focus:outline-none focus:border-blue-500/60 transition-colors';
const labelCls = 'block text-[11px] font-bold uppercase tracking-wider text-[#93a0b5] mb-1.5';
const chip = (active: boolean) => `px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${active ? 'border-blue-500 bg-blue-500/10 text-blue-300' : 'border-[#1e2636] text-[#93a0b5] hover:text-white'}`;
const cardCls = 'bg-[#0e1119] border border-[#1e2636] rounded-2xl p-4 sm:p-5';

// ── Campos reutilizáveis ──────────────────────────────────────────────────────
const ColorField: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <div>
    <label className={labelCls}>{label}</label>
    <div className="flex items-center gap-2">
      <input type="color" value={isHex(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="w-9 h-9 rounded-lg bg-transparent border border-[#1e2636] cursor-pointer shrink-0" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="#000000" className={inputCls + ' font-mono text-xs'} maxLength={9} />
    </div>
  </div>
);

const Slider: React.FC<{ label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (n: number) => void }> = ({ label, value, min, max, step = 1, unit = 'px', onChange }) => (
  <div>
    <div className="flex justify-between items-center"><label className={labelCls}>{label}</label><span className="text-[11px] font-mono text-[#93a0b5]">{value}{unit}</span></div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-blue-500" />
  </div>
);

const ImageField: React.FC<{ label: string; value?: string; onChange: (url: string) => void; uid?: string; kind: string; onError: (m: string) => void; compact?: boolean }> = ({ label, value, onChange, uid, kind, onError, compact }) => {
  const inputId = `upl_${kind}_${genId()}`;
  const [uploading, setUploading] = useState(false);
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try { const { url } = await uploadBioImage(file, uid, kind); onChange(url); }
    catch (err: any) { onError(err?.message || 'Falha no upload da imagem.'); }
    finally { setUploading(false); }
  };
  return (
    <div>
      {!compact && <label className={labelCls}>{label}</label>}
      <div className="flex items-center gap-3">
        {value ? <img src={value} alt="" className="w-12 h-12 rounded-lg object-cover border border-[#1e2636]" /> : <div className="w-12 h-12 rounded-lg border border-dashed border-[#2a3550] flex items-center justify-center text-[#4b5872]"><ImageIcon className="w-5 h-5" /></div>}
        <div className="flex-1 space-y-1.5">
          <div className="flex gap-2">
            <label htmlFor={inputId} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#151a26] hover:bg-[#1e2636] border border-[#1e2636] text-[#eef2f9] text-xs font-bold cursor-pointer transition-colors">
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}{uploading ? 'Enviando...' : 'Enviar imagem'}
            </label>
            <input id={inputId} type="file" accept="image/*" onChange={handleFile} className="hidden" />
            {value ? <button type="button" onClick={() => onChange('')} className="px-2 py-1.5 rounded-lg text-[#93a0b5] hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button> : null}
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
  const [socials, setSocials] = useState<BioSocial[]>([]);

  const [subTab, setSubTab] = useState<SubTab>('content');
  const [appMode, setAppMode] = useState<'temas' | 'custom'>('temas');
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingSocialId, setEditingSocialId] = useState<string | null>(null);
  const [confirmSocialId, setConfirmSocialId] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
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
    () => JSON.stringify({ displayName, bio, avatarUrl, bannerUrl, theme, blocks, socials }),
    [displayName, bio, avatarUrl, bannerUrl, theme, blocks, socials],
  );

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
          setSavedSlug(sl); setSlug(sl);
          setDisplayName(data.displayName || '');
          setBio(data.bio || '');
          setAvatarUrl(data.avatarUrl || '');
          setBannerUrl(data.bannerUrl || '');
          setTheme({ ...DEFAULT_THEME, ...(data.theme || {}) });
          setBlocks(Array.isArray(data.blocks) ? data.blocks : []);
          setSocials(Array.isArray(data.socials) ? data.socials : []);
          lastSavedRef.current = JSON.stringify({
            displayName: data.displayName || '', bio: data.bio || '',
            avatarUrl: data.avatarUrl || '', bannerUrl: data.bannerUrl || '',
            theme: { ...DEFAULT_THEME, ...(data.theme || {}) },
            blocks: Array.isArray(data.blocks) ? data.blocks : [],
            socials: Array.isArray(data.socials) ? data.socials : [],
          });
        } else if (mounted) {
          setDisplayName(user?.name || '');
        }
      } catch (e) { console.error('Erro ao carregar bio:', e); }
      finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [uid, user?.name]);

  const refreshClicks = useCallback(async () => {
    try {
      const res = await apiFetch('/api/analytics/clicks', { action: 'Analytics Bio' });
      const json = await res.json();
      if (json?.clicksMap) setClicksMap(json.clicksMap);
    } catch { /* silencioso */ }
  }, []);
  useEffect(() => { refreshClicks(); }, [refreshClicks]);

  useEffect(() => {
    if (savedSlug) return;
    const clean = sanitizeSlug(slug);
    if (!clean || clean.length < 3) { setSlugStatus(clean ? 'invalid' : 'idle'); return; }
    if (RESERVED.has(clean)) { setSlugStatus('taken'); return; }
    setSlugStatus('checking');
    const t = setTimeout(async () => {
      try {
        const [bioSnap, shortSnap] = await Promise.all([getDoc(doc(db, 'bioPages', clean)), getDoc(doc(db, 'shortLinks', clean))]);
        setSlugStatus(bioSnap.exists() || shortSnap.exists() ? 'taken' : 'available');
      } catch { setSlugStatus('idle'); }
    }, 500);
    return () => clearTimeout(t);
  }, [slug, savedSlug]);

  const persist = useCallback(async () => {
    if (!savedSlug || !uid) return;
    const snapshot = editableSnapshot();
    setSaveStatus('saving');
    try {
      const payload = {
        slug: savedSlug, ownerUid: uid, userId: uid, createdBy: uid,
        displayName, bio, avatarUrl: avatarUrl.trim(), bannerUrl: bannerUrl.trim(),
        theme, blocks: blocks.map((b, i) => ({ ...b, order: i })), socials,
        published: true, updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'bioPages', savedSlug), JSON.parse(JSON.stringify(payload)), { merge: true });
      lastSavedRef.current = snapshot;
      setSaveStatus('saved');
    } catch (e) { console.error('Erro ao salvar bio:', e); setSaveStatus('idle'); setToast({ type: 'err', msg: 'Falha ao salvar.' }); }
  }, [savedSlug, uid, displayName, bio, avatarUrl, bannerUrl, theme, blocks, socials, editableSnapshot]);

  useEffect(() => {
    if (!savedSlug) return;
    if (editableSnapshot() === lastSavedRef.current) return;
    const t = setTimeout(() => { persist(); }, 800);
    return () => clearTimeout(t);
  }, [savedSlug, persist, editableSnapshot]);

  useEffect(() => { if (saveStatus !== 'saved') return; const t = setTimeout(() => setSaveStatus('idle'), 1800); return () => clearTimeout(t); }, [saveStatus]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3200); return () => clearTimeout(t); }, [toast]);

  const handleGenerate = async () => {
    const clean = sanitizeSlug(slug);
    if (slugStatus !== 'available' || !clean || !uid) return;
    setGenerating(true);
    try {
      const name = displayName.trim() || user?.name || clean;
      const now = new Date().toISOString();
      const payload = { slug: clean, ownerUid: uid, userId: uid, createdBy: uid, displayName: name, bio: '', theme: DEFAULT_THEME, blocks: [], socials: [], published: true, createdAt: now, updatedAt: now };
      await setDoc(doc(db, 'bioPages', clean), JSON.parse(JSON.stringify(payload)));
      setSavedSlug(clean); setDisplayName(name); setTheme(DEFAULT_THEME); setBlocks([]); setSocials([]);
      lastSavedRef.current = JSON.stringify({ displayName: name, bio: '', avatarUrl: '', bannerUrl: '', theme: DEFAULT_THEME, blocks: [], socials: [] });
      setToast({ type: 'ok', msg: 'Bio criada! Agora personalize.' }); setSubTab('content');
    } catch (e) { console.error(e); setToast({ type: 'err', msg: 'Não foi possível criar a bio.' }); }
    finally { setGenerating(false); }
  };

  const handleDeleteAll = async () => {
    if (!savedSlug) return;
    try { await deleteDoc(doc(db, 'bioPages', savedSlug)); } catch (e) { console.error(e); }
    setSavedSlug(null); setSlug(''); setSlugStatus('idle');
    setDisplayName(user?.name || ''); setBio(''); setAvatarUrl(''); setBannerUrl('');
    setTheme(DEFAULT_THEME); setBlocks([]); setSocials([]); setEditingBlockId(null); setConfirmDelete(false);
    lastSavedRef.current = '';
    setToast({ type: 'ok', msg: 'Bio excluída. Escolha um novo link.' });
  };

  // Blocos
  const addBlock = (type: BioBlockType) => {
    const id = genId();
    const b: BioBlock = { id, type, active: true, order: blocks.length };
    if (type === 'section') b.title = 'Nova seção';
    if (type === 'link') b.iconType = 'none';
    setBlocks((prev) => [...prev, b]);
    setEditingBlockId(id); setShowAddMenu(false);
  };
  const updateBlock = (id: string, patch: Partial<BioBlock>) => setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const removeBlock = (id: string) => { setBlocks((prev) => prev.filter((b) => b.id !== id).map((b, i) => ({ ...b, order: i }))); if (editingBlockId === id) setEditingBlockId(null); };
  const moveBlock = (id: string, dir: -1 | 1) => setBlocks((prev) => {
    const arr = [...prev]; const idx = arr.findIndex((b) => b.id === id); const target = idx + dir;
    if (idx < 0 || target < 0 || target >= arr.length) return prev;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    return arr.map((b, i) => ({ ...b, order: i }));
  });

  // Arrastar (pointer events, funciona no toque)
  const reorderTo = (id: string, overId: string) => setBlocks((prev) => {
    const from = prev.findIndex((b) => b.id === id); const to = prev.findIndex((b) => b.id === overId);
    if (from < 0 || to < 0 || from === to) return prev;
    const arr = [...prev]; const [m] = arr.splice(from, 1); arr.splice(to, 0, m);
    return arr.map((b, i) => ({ ...b, order: i }));
  });
  const handleDragMove = useCallback((e: PointerEvent) => {
    const id = dragIdRef.current; if (!id) return;
    const el = document.elementFromPoint(e.clientX, e.clientY) as Element | null;
    const overId = el?.closest('[data-block-id]')?.getAttribute('data-block-id');
    if (overId && overId !== id) reorderTo(id, overId);
  }, []);
  const endDrag = useCallback(() => {
    dragIdRef.current = null; setDragId(null);
    window.removeEventListener('pointermove', handleDragMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
  }, [handleDragMove]);
  const startDrag = (e: React.PointerEvent, id: string) => {
    e.preventDefault(); dragIdRef.current = id; setDragId(id);
    window.addEventListener('pointermove', handleDragMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  };
  useEffect(() => () => endDrag(), [endDrag]);

  // Redes sociais
  const addSocial = () => { const id = genId(); setSocials((prev) => [...prev, { id, platform: 'instagram', url: '' }]); setEditingSocialId(id); };
  const updateSocial = (id: string, patch: Partial<BioSocial>) => setSocials((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const removeSocial = (id: string) => setSocials((prev) => prev.filter((s) => s.id !== id));

  const currentPage: BioPage = useMemo(() => ({
    slug: savedSlug || sanitizeSlug(slug), ownerUid: uid || '', userId: uid, createdBy: uid,
    displayName, bio, avatarUrl: avatarUrl.trim() || undefined, bannerUrl: bannerUrl.trim() || undefined,
    theme, blocks, socials, published: true,
  }), [savedSlug, slug, uid, displayName, bio, avatarUrl, bannerUrl, theme, blocks, socials]);

  const publicUrl = `${shortDomain}/${savedSlug || sanitizeSlug(slug) || 'seu-link'}`;
  const fullPublicUrl = `https://${publicUrl}`;
  const copyUrl = () => navigator.clipboard?.writeText(fullPublicUrl).then(() => setToast({ type: 'ok', msg: 'Link copiado!' }), () => setToast({ type: 'err', msg: 'Falha ao copiar.' }));
  const shareUrl = async () => {
    if (typeof navigator !== 'undefined' && (navigator as any).share) { try { await (navigator as any).share({ title: displayName || 'Meu link', text: bio || 'Confira meus links', url: fullPublicUrl }); } catch { /* cancelado */ } }
    else copyUrl();
  };
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(fullPublicUrl)}`;

  const setTF = <K extends keyof BioTheme>(k: K, v: BioTheme[K]) => setTheme((t) => ({ ...t, [k]: v }));

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-7 h-7 text-blue-400 animate-spin" /></div>;

  // ══════════ FASE 1: escolher o link ══════════
  if (!savedSlug) {
    return (
      <div className="max-w-xl mx-auto">
        <div className={cardCls}>
          <div className="flex items-center gap-2 mb-1"><Sparkles className="w-5 h-5 text-blue-400" /><h3 className="text-base font-extrabold text-white">Crie seu Link in Bio</h3></div>
          <p className="text-xs text-[#93a0b5] mb-5">Escolha o endereço da sua página. <span className="text-amber-300 font-semibold">Atenção:</span> depois de gerar, o link não muda — só excluindo a bio e começando de novo.</p>
          <label className={labelCls}>Seu link</label>
          <div className="flex items-center bg-[#0b0e15] border border-[#1e2636] rounded-xl overflow-hidden focus-within:border-blue-500/60">
            <span className="pl-3 pr-1 text-sm text-[#4b5872] font-mono select-none">{shortDomain}/</span>
            <input value={slug} onChange={(e) => setSlug(sanitizeSlug(e.target.value))} placeholder="radardeofertas" className="flex-1 bg-transparent py-3 pr-3 text-sm text-[#eef2f9] placeholder-[#4b5872] focus:outline-none font-mono" maxLength={40} />
            <span className="pr-3 flex items-center">
              {slugStatus === 'checking' && <Loader2 className="w-4 h-4 text-[#93a0b5] animate-spin" />}
              {slugStatus === 'available' && <Check className="w-4 h-4 text-emerald-400" />}
              {(slugStatus === 'taken' || slugStatus === 'invalid') && <X className="w-4 h-4 text-red-400" />}
            </span>
          </div>
          <div className="mt-1.5 min-h-[16px] text-[11px] font-semibold">
            {slugStatus === 'available' && <span className="text-emerald-400">✓ Disponível</span>}
            {slugStatus === 'taken' && <span className="text-red-400">✗ Já está em uso, escolha outro</span>}
            {slugStatus === 'invalid' && <span className="text-amber-400">Use ao menos 3 caracteres (letras, números e hífen)</span>}
          </div>
          <button onClick={handleGenerate} disabled={slugStatus !== 'available' || generating} className="mt-5 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 hover:brightness-110 text-white font-bold text-sm shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}Gerar minha bio
          </button>
        </div>
        {toast && <div className={`mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold ${toast.type === 'ok' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/10 text-red-300 border border-red-500/30'}`}>{toast.type === 'ok' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}{toast.msg}</div>}
      </div>
    );
  }

  // ══════════ FASE 2: editor ══════════
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
      <div className="space-y-5">
        {/* Header: link travado */}
        <div className={cardCls}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]"><Lock className="w-4 h-4 text-[#93a0b5] shrink-0" /><span className="font-mono text-sm text-white break-all">{shortDomain}/<span className="text-blue-400 font-bold">{savedSlug}</span></span></div>
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
          {showQr && <div className="mt-3 flex flex-col items-center gap-2 p-4 rounded-xl bg-[#0b0e15] border border-[#1e2636]"><img src={qrSrc} alt="QR Code" width={200} height={200} className="rounded-lg bg-white p-2" /><p className="text-[11px] text-[#93a0b5] text-center">Aponte a câmera para abrir <span className="font-mono text-blue-400">{shortDomain}/{savedSlug}</span></p></div>}
          {confirmDelete && <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30"><p className="text-xs text-red-200 mb-2">Isso apaga a bio inteira e libera o link <b>{savedSlug}</b>. Não dá pra desfazer.</p><div className="flex gap-2"><button onClick={handleDeleteAll} className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold">Sim, excluir tudo</button><button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-lg bg-[#151a26] border border-[#1e2636] text-[#eef2f9] text-xs font-bold">Cancelar</button></div></div>}
        </div>

        {/* Sub-abas */}
        <div className="flex gap-1 bg-[#0b0e15] border border-[#1e2636] rounded-xl p-1">
          {([['content', 'Conteúdo', <LayoutGrid className="w-4 h-4" />], ['appearance', 'Aparência', <Palette className="w-4 h-4" />], ['profile', 'Perfil', <User className="w-4 h-4" />]] as [SubTab, string, React.ReactNode][]).map(([id, label, icon]) => (
            <button key={id} onClick={() => setSubTab(id)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors ${subTab === id ? 'bg-blue-600 text-white' : 'text-[#93a0b5] hover:text-white'}`}>{icon} {label}</button>
          ))}
        </div>

        {/* ─── CONTEÚDO ─── */}
        {subTab === 'content' && (
          <div className={cardCls + ' space-y-3'}>
            {/* Botão único Adicionar */}
            <div className="relative">
              <button onClick={() => setShowAddMenu((v) => !v)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 hover:brightness-110 text-white font-bold text-sm shadow-lg transition-all"><Plus className="w-4 h-4" /> Adicionar conteúdo <ChevronDown className={`w-4 h-4 transition-transform ${showAddMenu ? 'rotate-180' : ''}`} /></button>
              {showAddMenu && (
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(['link', 'section', 'text', 'image', 'video'] as BioBlockType[]).map((t) => (
                    <button key={t} onClick={() => addBlock(t)} className="flex items-center gap-3 p-3 rounded-xl bg-[#0b0e15] border border-[#1e2636] hover:border-blue-500/60 text-left transition-colors">
                      <span className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-300 flex items-center justify-center shrink-0">{BLOCK_META[t].icon}</span>
                      <span><span className="block text-sm font-bold text-[#eef2f9]">{BLOCK_META[t].label}</span><span className="block text-[11px] text-[#93a0b5]">{BLOCK_META[t].desc}</span></span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {blocks.length === 0 && <p className="text-center text-xs text-[#4b5872] py-6">Nenhum bloco ainda. Toque em <b>Adicionar conteúdo</b>.</p>}

            <div className="space-y-2.5">
              {blocks.map((block, idx) => {
                const editing = editingBlockId === block.id;
                const clicks = clicksMap[`bio_${savedSlug}_${block.id}`]?.clicks || 0;
                const summary = block.type === 'text' ? (block.text || '—') : block.type === 'image' ? (block.imageUrl ? 'Imagem' : '(sem imagem)') : block.type === 'video' ? (block.videoUrl || '(sem URL)') : (block.title || '(sem título)');
                return (
                  <div key={block.id} data-block-id={block.id} className={`rounded-xl border bg-[#0b0e15] transition-shadow ${dragId === block.id ? 'border-blue-500 ring-2 ring-blue-500/50 opacity-90' : 'border-[#1e2636]'}`}>
                    <div className="flex items-center gap-2 p-3">
                      <div className="flex flex-col items-center gap-0.5">
                        <button onPointerDown={(e) => startDrag(e, block.id)} title="Arraste para mover" style={{ touchAction: 'none' }} className="cursor-grab active:cursor-grabbing text-[#4b5872] hover:text-white"><GripVertical className="w-4 h-4" /></button>
                        <button onClick={() => moveBlock(block.id, -1)} disabled={idx === 0} className="text-[#4b5872] hover:text-white disabled:opacity-30"><ArrowUp className="w-3 h-3" /></button>
                        <button onClick={() => moveBlock(block.id, 1)} disabled={idx === blocks.length - 1} className="text-[#4b5872] hover:text-white disabled:opacity-30"><ArrowDown className="w-3 h-3" /></button>
                      </div>
                      <span className="shrink-0 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300">{BLOCK_META[block.type].icon}{BLOCK_META[block.type].label}</span>
                      <span className="flex-1 truncate text-sm text-[#eef2f9] font-medium">{summary}</span>
                      {block.type === 'link' && <span className="flex items-center gap-1 text-[10px] text-[#93a0b5] shrink-0"><BarChart2 className="w-3 h-3" />{clicks}</span>}
                      <label className="flex items-center shrink-0 cursor-pointer" title="Visível"><input type="checkbox" checked={block.active !== false} onChange={(e) => updateBlock(block.id, { active: e.target.checked })} className="accent-blue-500" /></label>
                      <button onClick={() => setEditingBlockId(editing ? null : block.id)} className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-colors ${editing ? 'bg-blue-600 text-white' : 'bg-[#151a26] text-[#93a0b5] hover:text-white border border-[#1e2636]'}`}>{editing ? <><Check className="w-3.5 h-3.5" /> OK</> : <><Pencil className="w-3.5 h-3.5" /> Editar</>}</button>
                      <button onClick={() => removeBlock(block.id)} className="shrink-0 text-[#4b5872] hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </div>

                    {editing && (
                      <div className="px-3 pb-3 pt-1 border-t border-[#1e2636] space-y-2.5">
                        {block.type === 'link' && (
                          <>
                            <input value={block.title || ''} onChange={(e) => updateBlock(block.id, { title: e.target.value })} placeholder="Título do botão" className={inputCls} maxLength={60} />
                            <input value={block.url || ''} onChange={(e) => updateBlock(block.id, { url: e.target.value })} placeholder="https://... (produto, WhatsApp, Instagram)" className={inputCls} />
                            <div>
                              <label className={labelCls}>Ícone do botão</label>
                              <div className="flex gap-2 mb-2">
                                {([['none', 'Nenhum'], ['emoji', 'Emoji'], ['builtin', 'Ícone'], ['image', 'Imagem']] as [BioIconType, string][]).map(([it, lbl]) => (
                                  <button key={it} type="button" onClick={() => updateBlock(block.id, { iconType: it })} className={chip((block.iconType || 'none') === it)}>{lbl}</button>
                                ))}
                              </div>
                              {block.iconType === 'emoji' && (
                                <div className="space-y-1.5">
                                  <input value={block.icon || ''} onChange={(e) => updateBlock(block.id, { icon: e.target.value })} placeholder="Cole um emoji" className={inputCls + ' text-center'} maxLength={2} />
                                  <div className="flex flex-wrap gap-1">{EMOJI_SUGGESTIONS.map((em) => <button key={em} type="button" onClick={() => updateBlock(block.id, { icon: em })} className="w-8 h-8 rounded-lg bg-[#151a26] hover:bg-[#1e2636] border border-[#1e2636] text-base">{em}</button>)}</div>
                                </div>
                              )}
                              {block.iconType === 'builtin' && (
                                <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5">
                                  {BUILTIN_ICONS.map((ic) => (
                                    <button key={ic.key} type="button" title={ic.label} onClick={() => updateBlock(block.id, { iconKey: ic.key })} className={`h-9 rounded-lg flex items-center justify-center border transition-colors ${block.iconKey === ic.key ? 'border-blue-500 bg-blue-500/15 text-blue-300' : 'border-[#1e2636] text-[#93a0b5] hover:text-white'}`}>{renderBuiltinIcon(ic.key, 18, 'currentColor')}</button>
                                  ))}
                                </div>
                              )}
                              {block.iconType === 'image' && (
                                <ImageField label="Ícone" compact value={block.iconImage} onChange={(url) => updateBlock(block.id, { iconImage: url })} uid={uid} kind="icon" onError={(m) => setToast({ type: 'err', msg: m })} />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center justify-between">
                                <label className={labelCls + ' mb-0'}>Cores só deste botão</label>
                                {(block.buttonColor || block.buttonTextColor) && <button type="button" onClick={() => updateBlock(block.id, { buttonColor: undefined, buttonTextColor: undefined })} className="text-[11px] text-[#93a0b5] hover:text-white">Usar cores do tema</button>}
                              </div>
                              <div className="grid grid-cols-2 gap-2 mt-1.5">
                                <ColorField label="Fundo" value={block.buttonColor || ''} onChange={(v) => updateBlock(block.id, { buttonColor: v })} />
                                <ColorField label="Texto" value={block.buttonTextColor || ''} onChange={(v) => updateBlock(block.id, { buttonTextColor: v })} />
                              </div>
                            </div>
                          </>
                        )}
                        {block.type === 'section' && (
                          <>
                            <input value={block.title || ''} onChange={(e) => updateBlock(block.id, { title: e.target.value })} placeholder="Título da seção" className={inputCls} maxLength={60} />
                            <input value={block.text || ''} onChange={(e) => updateBlock(block.id, { text: e.target.value })} placeholder="Subtítulo (opcional)" className={inputCls} maxLength={100} />
                          </>
                        )}
                        {block.type === 'text' && <textarea value={block.text || ''} onChange={(e) => updateBlock(block.id, { text: e.target.value })} placeholder="Escreva um parágrafo..." rows={3} className={inputCls + ' resize-none'} maxLength={500} />}
                        {block.type === 'image' && (
                          <div className="space-y-2">
                            <ImageField label="Imagem" value={block.imageUrl} onChange={(url) => updateBlock(block.id, { imageUrl: url })} uid={uid} kind="block" onError={(m) => setToast({ type: 'err', msg: m })} />
                            <input value={block.url || ''} onChange={(e) => updateBlock(block.id, { url: e.target.value })} placeholder="Link ao clicar na imagem (opcional)" className={inputCls} />
                          </div>
                        )}
                        {block.type === 'video' && (
                          <div className="space-y-1"><input value={block.videoUrl || ''} onChange={(e) => updateBlock(block.id, { videoUrl: e.target.value })} placeholder="Link do YouTube ou Vimeo" className={inputCls} /><p className="text-[10px] text-[#4b5872]">Suporta YouTube (incl. Shorts) e Vimeo.</p></div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── APARÊNCIA ─── */}
        {subTab === 'appearance' && (
          <div className="space-y-5">
            <div className="flex gap-1 bg-[#0b0e15] border border-[#1e2636] rounded-xl p-1">
              {(['temas', 'custom'] as const).map((m) => (
                <button key={m} type="button" onClick={() => setAppMode(m)} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${appMode === m ? 'bg-blue-600 text-white' : 'text-[#93a0b5] hover:text-white'}`}>{m === 'temas' ? 'Temas prontos' : 'Personalizado'}</button>
              ))}
            </div>

            {appMode === 'temas' && (
            <div className={cardCls}>
              <p className="text-xs text-[#93a0b5] mb-3">Escolha um tema pronto — aplica cores, fundo, botões e fonte de uma vez. Para editar cada detalhe do seu jeito, use <b className="text-[#eef2f9]">Personalizado</b>.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {THEME_PRESETS.map((p) => (
                  <button key={p.name} onClick={() => setTheme(p.theme)} type="button" className="relative h-16 rounded-xl border border-[#1e2636] hover:border-blue-500/60 overflow-hidden transition-colors" style={{ background: p.theme.bgValue }}>
                    <span className="absolute inset-x-0 bottom-0 py-1 text-[11px] font-bold text-white bg-black/40 backdrop-blur-sm">{p.name}</span>
                    <span className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-4 rounded" style={{ background: p.theme.buttonColor, borderRadius: radiusOf(p.theme.buttonShape) }} />
                  </button>
                ))}
              </div>
            </div>
            )}

            {appMode === 'custom' && (<>
            {/* Fundo */}
            <div className={cardCls + ' space-y-3'}>
              <label className={labelCls}>Fundo</label>
              <div className="flex gap-2">
                {(['solid', 'gradient', 'image'] as const).map((t) => <button key={t} type="button" onClick={() => setTF('bgType', t)} className={chip(theme.bgType === t)}>{t === 'solid' ? 'Cor' : t === 'gradient' ? 'Estilos' : 'Imagem'}</button>)}
              </div>
              {theme.bgType === 'solid' && <ColorField label="Cor do fundo" value={theme.bgValue} onChange={(v) => setTF('bgValue', v)} />}
              {theme.bgType === 'gradient' && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {BG_STYLES.map((g) => <button key={g.name} type="button" title={g.name} onClick={() => setTF('bgValue', g.css)} className={`h-12 rounded-lg border-2 transition-all ${theme.bgValue === g.css ? 'border-white' : 'border-transparent'}`} style={{ background: g.css }} />)}
                </div>
              )}
              {theme.bgType === 'image' && <ImageField label="Imagem de fundo" value={theme.bgValue.startsWith('http') ? theme.bgValue : ''} onChange={(url) => setTF('bgValue', url)} uid={uid} kind="bg" onError={(m) => setToast({ type: 'err', msg: m })} />}
            </div>

            {/* Botões / cards */}
            <div className={cardCls + ' space-y-4'}>
              <div>
                <label className={labelCls}>Estilo do card</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {STYLE_OPTIONS.map((s) => (
                    <button key={s.value} type="button" onClick={() => setTF('buttonStyle', s.value)} className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-colors ${theme.buttonStyle === s.value ? 'border-blue-500 bg-blue-500/10' : 'border-[#1e2636] hover:border-[#2a3550]'}`}>
                      <span className="w-full h-6 flex items-center justify-center text-[9px] font-bold" style={{ ...stylePreview(s.value, theme), color: theme.buttonTextColor }}>Aa</span>
                      <span className={`text-[10px] font-bold ${theme.buttonStyle === s.value ? 'text-blue-300' : 'text-[#93a0b5]'}`}>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Formato do card</label>
                <div className="flex flex-wrap gap-2">
                  {SHAPE_OPTIONS.map((s) => (
                    <button key={s.value} type="button" onClick={() => setTF('buttonShape', s.value)} className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${theme.buttonShape === s.value ? 'border-blue-500 bg-blue-500/10' : 'border-[#1e2636] hover:border-[#2a3550]'}`}>
                      <span className="w-12 h-5" style={{ background: theme.buttonColor, borderRadius: radiusOf(s.value) }} />
                      <span className={`text-[10px] font-bold ${theme.buttonShape === s.value ? 'text-blue-300' : 'text-[#93a0b5]'}`}>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ColorField label="Cor do botão" value={theme.buttonColor} onChange={(v) => setTF('buttonColor', v)} />
                <ColorField label="Texto do botão" value={theme.buttonTextColor} onChange={(v) => setTF('buttonTextColor', v)} />
              </div>
              {theme.buttonStyle === 'gradient' && <ColorField label="2ª cor (gradiente)" value={theme.buttonColor2 || theme.buttonColor} onChange={(v) => setTF('buttonColor2', v)} />}
              {theme.buttonStyle === 'outline' && (
                <div className="grid grid-cols-2 gap-3">
                  <ColorField label="Cor da borda" value={theme.buttonBorderColor || theme.buttonColor} onChange={(v) => setTF('buttonBorderColor', v)} />
                  <Slider label="Espessura da borda" value={theme.buttonBorderWidth ?? 2} min={1} max={6} onChange={(n) => setTF('buttonBorderWidth', n)} />
                </div>
              )}
              {(theme.buttonStyle === 'hard' || theme.buttonStyle === 'neumorph') && (
                <div className="space-y-3">
                  {theme.buttonStyle === 'hard' && <ColorField label="Cor da sombra" value={theme.shadowColor || '#0a0a0a'} onChange={(v) => setTF('shadowColor', v)} />}
                  <div className="grid grid-cols-2 gap-3">
                    <Slider label="Distância da sombra" value={theme.shadowOffset ?? 4} min={0} max={16} onChange={(n) => setTF('shadowOffset', n)} />
                    <Slider label="Desfoque da sombra" value={theme.shadowBlur ?? 0} min={0} max={30} onChange={(n) => setTF('shadowBlur', n)} />
                  </div>
                </div>
              )}
            </div>

            {/* Avatar & tamanhos */}
            <div className={cardCls + ' space-y-4'}>
              <div>
                <label className={labelCls}>Formato do avatar</label>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_OPTIONS.map((s) => (
                    <button key={s.value} type="button" onClick={() => setTF('avatarShape', s.value)} className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${theme.avatarShape === s.value ? 'border-blue-500 bg-blue-500/10' : 'border-[#1e2636] hover:border-[#2a3550]'}`}>
                      {s.value === 'none' ? <span className="w-8 h-8 flex items-center justify-center text-[#4b5872]"><X className="w-5 h-5" /></span> : <span className="w-8 h-8" style={{ background: theme.buttonColor, borderRadius: avatarRadiusOf(s.value) }} />}
                      <span className={`text-[10px] font-bold ${theme.avatarShape === s.value ? 'text-blue-300' : 'text-[#93a0b5]'}`}>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Slider label="Tamanho do avatar" value={theme.avatarSize ?? 96} min={56} max={160} onChange={(n) => setTF('avatarSize', n)} />
                <Slider label="Altura do banner" value={theme.bannerHeight ?? 112} min={60} max={320} onChange={(n) => setTF('bannerHeight', n)} />
              </div>
              <div>
                <label className={labelCls}>Proporção do banner</label>
                <div className="flex flex-wrap gap-2">
                  {BANNER_RATIOS.map((r) => (
                    <button key={r.label} type="button" onClick={() => setTF('bannerHeight', r.h)} className={chip((theme.bannerHeight ?? 112) === r.h)}>{r.label}</button>
                  ))}
                </div>
                <p className="text-[10px] text-[#4b5872] mt-1.5">A largura acompanha a página; ajuste a altura ou escolha uma proporção.</p>
              </div>
            </div>

            {/* Textos */}
            <div className={cardCls + ' space-y-4'}>
              <div>
                <label className={labelCls}>Fonte</label>
                <div className="flex flex-wrap gap-2">{FONT_OPTIONS.map((f) => <button key={f.value} type="button" onClick={() => setTF('font', f.value)} className={chip(theme.font === f.value)} style={{ fontFamily: f.value }}>{f.label}</button>)}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ColorField label="Cor do nome" value={theme.titleColor || theme.textColor} onChange={(v) => setTF('titleColor', v)} />
                <ColorField label="Cor do texto" value={theme.textColor} onChange={(v) => setTF('textColor', v)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Slider label="Tamanho do nome" value={theme.titleSize ?? 22} min={16} max={40} onChange={(n) => setTF('titleSize', n)} />
                <Slider label="Tamanho da descrição" value={theme.bioSize ?? 14} min={11} max={22} onChange={(n) => setTF('bioSize', n)} />
              </div>
            </div>
            </>)}
          </div>
        )}

        {/* ─── PERFIL ─── */}
        {subTab === 'profile' && (
          <div className="space-y-5">
            <div className={cardCls + ' space-y-4'}>
              <div><label className={labelCls}>Nome de exibição</label><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Radar de Ofertas" className={inputCls} maxLength={60} /></div>
              <div><label className={labelCls}>Bio (descrição curta)</label><textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="As melhores ofertas do dia 🔥" rows={2} className={inputCls + ' resize-none'} maxLength={160} /></div>
              <ImageField label="Foto de perfil" value={avatarUrl} onChange={setAvatarUrl} uid={uid} kind="avatar" onError={(m) => setToast({ type: 'err', msg: m })} />
              <ImageField label="Banner / capa" value={bannerUrl} onChange={setBannerUrl} uid={uid} kind="banner" onError={(m) => setToast({ type: 'err', msg: m })} />
            </div>

            {/* Redes sociais */}
            <div className={cardCls + ' space-y-3'}>
              <div className="flex items-center justify-between">
                <label className={labelCls + ' mb-0'}>Redes sociais</label>
                <button onClick={addSocial} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#151a26] hover:bg-[#1e2636] border border-[#1e2636] text-[#eef2f9] text-xs font-bold"><Plus className="w-3.5 h-3.5" /> Adicionar</button>
              </div>
              <p className="text-[11px] text-[#4b5872]">Ícones que aparecem abaixo do seu nome (Instagram, TikTok, WhatsApp...).</p>
              {socials.length === 0 && <p className="text-center text-xs text-[#4b5872] py-2">Nenhuma rede adicionada.</p>}
              {socials.map((s) => {
                const editing = editingSocialId === s.id;
                const label = SOCIAL_PLATFORMS.find((p) => p.key === s.platform)?.label || s.platform;
                return (
                  <div key={s.id} className="rounded-xl border border-[#1e2636] bg-[#0b0e15] p-3">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-[#151a26] border border-[#1e2636] flex items-center justify-center text-[#eef2f9] shrink-0">{renderBuiltinIcon(s.platform, 16, 'currentColor')}</span>
                      <div className="flex-1 min-w-0">
                        <span className="block text-sm font-bold text-[#eef2f9]">{label}</span>
                        <span className="block text-[11px] text-[#93a0b5] truncate">{s.url || '(sem link)'}</span>
                      </div>
                      {!editing && <button onClick={() => setEditingSocialId(s.id)} className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-[#151a26] border border-[#1e2636] text-[#93a0b5] hover:text-white text-xs font-bold"><Pencil className="w-3.5 h-3.5" /> Editar</button>}
                      <button onClick={() => setConfirmSocialId(confirmSocialId === s.id ? null : s.id)} className="shrink-0 text-[#4b5872] hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    {editing && (
                      <div className="mt-2.5 space-y-2 border-t border-[#1e2636] pt-2.5">
                        <select value={s.platform} onChange={(e) => updateSocial(s.id, { platform: e.target.value })} className="w-full bg-[#0b0e15] border border-[#1e2636] rounded-lg px-2 py-2 text-xs text-[#eef2f9]">
                          {SOCIAL_PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                        </select>
                        <input value={s.url} onChange={(e) => updateSocial(s.id, { url: e.target.value })} placeholder="https://..." className={inputCls} />
                        <button onClick={() => setEditingSocialId(null)} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"><Check className="w-3.5 h-3.5" /> Salvar</button>
                      </div>
                    )}
                    {confirmSocialId === s.id && (
                      <div className="mt-2.5 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30">
                        <p className="text-[11px] text-red-200 mb-2">Remover <b>{label}</b>?</p>
                        <div className="flex gap-2">
                          <button onClick={() => { removeSocial(s.id); setConfirmSocialId(null); }} className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold">Sim, remover</button>
                          <button onClick={() => setConfirmSocialId(null)} className="px-3 py-1 rounded-lg bg-[#151a26] border border-[#1e2636] text-[#eef2f9] text-xs font-bold">Cancelar</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {toast && <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold ${toast.type === 'ok' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/10 text-red-300 border border-red-500/30'}`}>{toast.type === 'ok' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}{toast.msg}</div>}
      </div>

      {/* Preview */}
      <div className="lg:sticky lg:top-6 h-fit">
        <div className="flex items-center gap-2 mb-2 text-[#93a0b5]"><Eye className="w-4 h-4" /><span className="text-xs font-bold uppercase tracking-wider">Pré-visualização</span></div>
        <div className="mx-auto w-full max-w-[300px] rounded-[2rem] border-[6px] border-[#1e2636] bg-black overflow-hidden shadow-2xl" style={{ height: 620 }}>
          <div className="w-full h-full overflow-y-auto"><BioContent page={currentPage} /></div>
        </div>
        <p className="text-center text-[11px] text-[#93a0b5] mt-3 font-mono break-all">{shortDomain}/{savedSlug}</p>
      </div>
    </div>
  );
};

export default BioTab;
