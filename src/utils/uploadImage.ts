import { apiFetch } from './apiBase';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export interface UploadResult {
  url: string;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível processar a imagem.'));
    img.src = src;
  });
}

/**
 * Redimensiona (máx. maxDim px) e comprime a imagem no navegador antes de enviar,
 * deixando o upload rápido e a imagem leve para carregar. Preserva transparência
 * usando WebP quando suportado; senão cai para JPEG. Retorna base64 sem prefixo.
 */
async function compressToBase64(file: File, maxDim = 1200, quality = 0.85): Promise<string> {
  try {
    const dataUrl = await fileToDataUrl(file);
    const img = await loadImage(dataUrl);
    let { width, height } = img;
    if (width > maxDim || height > maxDim) {
      const s = maxDim / Math.max(width, height);
      width = Math.round(width * s);
      height = Math.round(height * s);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl.split(',')[1];
    ctx.drawImage(img, 0, 0, width, height);
    let out = canvas.toDataURL('image/webp', quality);
    if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/jpeg', quality);
    return out.split(',')[1];
  } catch {
    const dataUrl = await fileToDataUrl(file);
    return dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  }
}

let cachedKey: string | null = null;
async function getImgbbKey(): Promise<string> {
  if (cachedKey) return cachedKey;
  try {
    const res = await apiFetch('/api/bio/upload-config', { action: 'Config de upload da Bio' });
    const json = await res.json();
    cachedKey = json?.imgbbKey || '';
  } catch {
    cachedKey = '';
  }
  return cachedKey || '';
}

/**
 * Upload de imagem feito DIRETO do navegador para o ImgBB (o IP do usuário não
 * é bloqueado, ao contrário do IP do servidor Render). A chave vem do backend.
 * Se a chave não estiver configurada, oriente o usuário a colar uma URL.
 */
export async function uploadBioImage(
  file: File,
  _uid?: string,
  _kind: string = 'img',
): Promise<UploadResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('O arquivo precisa ser uma imagem (JPG, PNG, WEBP...).');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Imagem muito grande. O limite é 5 MB.');
  }

  const key = await getImgbbKey();
  if (!key) {
    throw new Error('Upload não configurado. Cole a URL de uma imagem, ou peça para configurar a chave IMGBB_API_KEY no servidor.');
  }

  const base64 = await compressToBase64(file);
  const form = new FormData();
  form.append('image', base64);

  const resp = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    body: form,
  });
  let json: any = null;
  try { json = await resp.json(); } catch { /* ignore */ }
  const url = json?.data?.url || json?.data?.display_url;
  if (!resp.ok || !url) {
    throw new Error(json?.error?.message || 'Falha no upload da imagem.');
  }
  return { url };
}
