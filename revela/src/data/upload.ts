/**
 * Upload da foto de perfil do talento.
 *
 * Vai direto pro Storage do Supabase (bucket `revela-talent-photos`), sem
 * passar por servidor nosso. O upload é ANÔNIMO — a política aceita `anon`
 * porque o cadastro inteiro é anônimo — e isso só é seguro porque nada ali
 * aparece em lugar nenhum antes de o OLE SCOUT aprovar o talento.
 *
 * O bucket limita a 4 MB e a três formatos de imagem. A checagem aqui é pra dar
 * mensagem decente antes de gastar a banda de quem está no 4G; quem garante é a
 * política do bucket, não este arquivo.
 */
import { getSupabase } from '@/supabase/client';

const BUCKET = 'revela-talent-photos';
const MAX_BYTES = 4 * 1024 * 1024;
const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Uma forma só em vez de união discriminada: o tsconfig do REVELA não roda em
 * `strict` (o src/ compartilhado não é strict-clean), e sem ele o TS não estreita
 * união por `ok: true | false`. Mesma decisão de SupportResult em revelaApi.ts.
 */
export interface UploadResult {
  ok: boolean;
  url?: string;
  motivo?: string;
}

export async function uploadFotoTalento(file: File): Promise<UploadResult> {
  if (!TIPOS.includes(file.type)) {
    return { ok: false, motivo: 'Manda JPG, PNG ou WEBP.' };
  }
  if (file.size > MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return { ok: false, motivo: `Foto de ${mb} MB — o limite é 4 MB.` };
  }

  const sb = getSupabase();
  if (!sb) return { ok: false, motivo: 'Sem conexão agora. Tenta de novo.' };

  // Nome único sem depender de quem subiu: o cadastro é anônimo, então não há
  // user id pra usar de prefixo. O prefixo `talentos/` é exigido pela política.
  const ext = file.name.split('.').pop()?.toLowerCase().slice(0, 5) || 'jpg';
  const nome = `talentos/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  const { error } = await sb.storage.from(BUCKET).upload(nome, file, {
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) {
    console.warn('[revela] upload falhou:', error.message);
    return { ok: false, motivo: 'Não deu pra subir a foto. Tenta de novo.' };
  }

  const { data } = sb.storage.from(BUCKET).getPublicUrl(nome);
  return { ok: true, url: data.publicUrl };
}
