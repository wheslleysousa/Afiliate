import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export interface UploadResult {
  url: string;
}

/**
 * Faz upload de uma imagem para o Firebase Storage em bioImages/{uid}/...
 * e retorna a URL pública de download.
 */
export async function uploadBioImage(
  file: File,
  uid: string,
  kind: string = 'img',
): Promise<UploadResult> {
  if (!uid) throw new Error('Usuário não autenticado.');
  if (!file.type.startsWith('image/')) {
    throw new Error('O arquivo precisa ser uma imagem (JPG, PNG, WEBP...).');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Imagem muito grande. O limite é 5 MB.');
  }

  const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]/g, '-').slice(-40);
  const path = `bioImages/${uid}/${kind}_${Date.now()}_${safeName}`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, file, { contentType: file.type });
  const url = await getDownloadURL(storageRef);
  return { url };
}
