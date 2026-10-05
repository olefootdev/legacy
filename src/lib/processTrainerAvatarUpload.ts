/** Limite de caracteres do data URL para não estourar localStorage. */
import { L } from '@/i18n/L';
export const TRAINER_AVATAR_MAX_DATA_URL_LENGTH = 220_000;

const MAX_SIDE_PX = 128;
const MAX_INPUT_BYTES = 8 * 1024 * 1024;

export type TrainerAvatarResult =
  | { ok: true; dataUrl: string }
  | { ok: false; error: string };

/**
 * Redimensiona e comprime para JPEG; devolve data URL pronta para guardar no save.
 */
export async function fileToTrainerAvatarDataUrl(file: File): Promise<TrainerAvatarResult> {
  if (!file.type.startsWith('image/')) {
    return { ok: false as const, error: L('Escolha um arquivo de imagem.', 'Choose an image file.') };
  }
  if (file.size > MAX_INPUT_BYTES) {
    return { ok: false as const, error: L('Ficheiro demasiado grande (máx. 8 MB).', 'File too large (max. 8 MB).') };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { ok: false as const, error: L('Não foi possível ler a imagem.', 'Couldn\'t read the image.') };
  }

  try {
    const w = bitmap.width;
    const h = bitmap.height;
    const scale = Math.min(1, MAX_SIDE_PX / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ok: false as const, error: L('Erro ao processar a imagem.', 'Error processing the image.') };
    ctx.drawImage(bitmap, 0, 0, cw, ch);

    let quality = 0.88;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (dataUrl.length > TRAINER_AVATAR_MAX_DATA_URL_LENGTH && quality > 0.42) {
      quality -= 0.07;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    if (dataUrl.length > TRAINER_AVATAR_MAX_DATA_URL_LENGTH) {
      return {
        ok: false as const,
        error: L('A imagem continua grande demais. Tente outra foto.', 'The image is still too large. Try another photo.'),
      };
    }
    return { ok: true as const, dataUrl };
  } finally {
    bitmap.close();
  }
}
