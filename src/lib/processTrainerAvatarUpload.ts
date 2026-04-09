/** Limite de caracteres do data URL para não estourar localStorage. */
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
    return { ok: false as const, error: 'Escolhe um ficheiro de imagem.' };
  }
  if (file.size > MAX_INPUT_BYTES) {
    return { ok: false as const, error: 'Ficheiro demasiado grande (máx. 8 MB).' };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { ok: false as const, error: 'Não foi possível ler a imagem.' };
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
    if (!ctx) return { ok: false as const, error: 'Erro ao processar a imagem.' };
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
        error: 'A imagem continua grande demais. Tenta outra foto.',
      };
    }
    return { ok: true as const, dataUrl };
  } finally {
    bitmap.close();
  }
}
