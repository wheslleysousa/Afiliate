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

/**
 * Faz upload de uma imagem através do backend (proxy para o ImgBB, hospedagem
 * gratuita) e retorna a URL pública. Não depende do Firebase Storage.
 * O parâmetro `uid`/`kind` é mantido por compatibilidade de assinatura.
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

  const dataUrl = await fileToDataUrl(file);

  const res = await apiFetch('/api/bio/upload-image', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: dataUrl,
    action: 'Upload de imagem da Bio',
    title: 'ao enviar imagem da Bio',
  });

  let json: any = null;
  try { json = await res.json(); } catch { /* ignore */ }
  if (!res.ok || !json?.url) {
    throw new Error(json?.error || 'Falha no upload da imagem.');
  }
  return { url: json.url };
}
