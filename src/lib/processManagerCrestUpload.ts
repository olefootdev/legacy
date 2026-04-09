/** Limite de caracteres do data URL (localStorage). */
export const MANAGER_CREST_MAX_DATA_URL_LENGTH = 400_000;

const MAX_SIDE_PX = 384;
const MAX_INPUT_BYTES = 4 * 1024 * 1024;

export type ManagerCrestResult =
  | { ok: true; dataUrl: string }
  | { ok: false; error: string };

function isLikelyPng(file: File): boolean {
  if (file.type === 'image/png') return true;
  return /\.png$/i.test(file.name);
}

/**
 * Redimensiona mantendo alpha; saída PNG (data URL) para brasão no matchday.
 */
export async function fileToManagerCrestPngDataUrl(file: File): Promise<ManagerCrestResult> {
  if (!isLikelyPng(file)) {
    return {
      ok: false,
      error: 'Usa um ficheiro PNG (com fundo transparente, se quiseres).',
    };
  }
  if (file.size > MAX_INPUT_BYTES) {
    return { ok: false, error: 'Ficheiro demasiado grande (máx. 4 MB).' };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { ok: false, error: 'Não foi possível ler a imagem.' };
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
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return { ok: false, error: 'Erro ao processar a imagem.' };
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(bitmap, 0, 0, cw, ch);

    const dataUrl = canvas.toDataURL('image/png');
    if (dataUrl.length > MANAGER_CREST_MAX_DATA_URL_LENGTH) {
      return {
        ok: false,
        error: 'O brasão continua grande demais após otimização. Tenta uma imagem mais simples.',
      };
    }
    return { ok: true, dataUrl };
  } finally {
    bitmap.close();
  }
}
