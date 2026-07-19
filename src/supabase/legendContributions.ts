/**
 * A LENDA FALA — contribuições do atleta sobre a própria coleção.
 *
 *   correcao   → "isso no meu card está errado"
 *   historia   → áudio + transcrição contando a própria história
 *   novo_card  → "quero um card do meu período no clube X"
 *
 * O servidor recusa quem não for dono do card (migration 20260719120000).
 * O áudio vai pro bucket privado `legend-stories`, na pasta do próprio usuário.
 */
import { getSupabase } from './client';

export type ContributionKind = 'correcao' | 'historia' | 'novo_card';
export type ContributionStatus = 'pendente' | 'aceita' | 'recusada';

export interface LegendContribution {
  id: number;
  kind: ContributionKind;
  legacyPlayerId: string | null;
  message: string | null;
  audioPath: string | null;
  payload: Record<string, unknown>;
  status: ContributionStatus;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

/** O que a lenda pode apontar numa correção. */
export const CORRECTION_FIELDS: Array<{ value: string; label: string }> = [
  { value: 'historia', label: 'A história / narrativa' },
  { value: 'clube', label: 'Clube ou período' },
  { value: 'atributos', label: 'Os atributos' },
  { value: 'foto', label: 'A foto' },
  { value: 'nome', label: 'O nome no card' },
  { value: 'outro', label: 'Outro' },
];

const KIND_ERROR: Record<string, string> = {
  'dono do card': 'Só o dono do card pode enviar isso.',
  'atletas com card': 'Só atletas com card publicado podem enviar.',
  '10 envios': 'Você já tem 10 envios em análise. Aguarde a resposta.',
  'vazia': 'Escreva ou grave alguma coisa antes de enviar.',
  'does not exist': 'Este recurso está sendo ativado. Tente em instantes.',
};

function mapError(msg: string): string {
  const m = msg.toLowerCase();
  for (const [k, v] of Object.entries(KIND_ERROR)) if (m.includes(k)) return v;
  return 'Não foi possível enviar agora. Tente de novo.';
}

/**
 * Sobe o áudio pro bucket privado. O caminho SEMPRE começa com o uid — a policy
 * do storage só deixa escrever dentro da própria pasta.
 */
export async function uploadStoryAudio(blob: Blob): Promise<{ path?: string; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { error: 'Serviço indisponível.' };
  const { data: auth } = await sb.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { error: 'Sua sessão expirou. Entre novamente.' };

  const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
  const path = `${uid}/${Date.now()}.${ext}`;
  const { error } = await sb.storage.from('legend-stories').upload(path, blob, {
    contentType: blob.type || 'audio/webm',
    upsert: false,
  });
  if (error) {
    console.warn('[legendContributions] upload:', error.message);
    return { error: 'Não conseguimos guardar o áudio. Tente de novo.' };
  }
  return { path };
}

export async function submitContribution(params: {
  kind: ContributionKind;
  message?: string;
  legacyPlayerId?: string | null;
  payload?: Record<string, unknown>;
  audioPath?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Serviço indisponível.' };
  const { error } = await sb.rpc('submit_legend_contribution', {
    p_kind: params.kind,
    p_message: params.message ?? null,
    p_legacy_player_id: params.legacyPlayerId ?? null,
    p_payload: params.payload ?? {},
    p_audio_path: params.audioPath ?? null,
  });
  if (error) return { ok: false, error: mapError(error.message) };
  return { ok: true };
}

export async function getMyContributions(): Promise<LegendContribution[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc('get_my_legend_contributions');
  if (error || !Array.isArray(data)) return [];
  return data.map((r: Record<string, unknown>) => ({
    id: Number(r.id),
    kind: r.kind as ContributionKind,
    legacyPlayerId: (r.legacy_player_id as string) ?? null,
    message: (r.message as string) ?? null,
    audioPath: (r.audio_path as string) ?? null,
    payload: (r.payload as Record<string, unknown>) ?? {},
    status: (r.status as ContributionStatus) ?? 'pendente',
    adminNote: (r.admin_note as string) ?? null,
    createdAt: String(r.created_at),
    reviewedAt: (r.reviewed_at as string) ?? null,
  }));
}
