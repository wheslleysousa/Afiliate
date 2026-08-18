import { apiFetch } from './apiBase';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export interface UploadResult {
  url: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || '');
      resolve(s.includes(',') ? s.split(',')[1] : s); // sem o prefixo data:...
    };
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
    reader.readAsDataURL(file);
  });
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

  const base64 = await fileToBase64(file);
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
