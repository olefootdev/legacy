/**
 * SUGERIR CORREÇÃO — a lenda corrige a própria ficha.
 *
 * Quem viveu a carreira sabe mais que qualquer matéria. O servidor recusa se
 * quem chama não for o beneficiário do card (migration 20260719120000).
 */
import { getSupabase } from './client';

export type CorrectionStatus = 'pending' | 'accepted' | 'rejected';

export interface CardCorrection {
  id: number;
  legacyPlayerId: string;
  field: string | null;
  message: string;
  status: CorrectionStatus;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

/** Campos que a lenda pode apontar. Livre-texto continua sendo o principal. */
export const CORRECTION_FIELDS: Array<{ value: string; label: string }> = [
  { value: 'historia', label: 'A história / narrativa' },
  { value: 'clube', label: 'Clube ou período' },
  { value: 'atributos', label: 'Os atributos' },
  { value: 'foto', label: 'A foto' },
  { value: 'nome', label: 'O nome no card' },
  { value: 'outro', label: 'Outro' },
];

export async function suggestCardCorrection(params: {
  legacyPlayerId: string;
  message: string;
  field?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Serviço indisponível.' };
  const { error } = await sb.rpc('suggest_card_correction', {
    p_legacy_player_id: params.legacyPlayerId,
    p_message: params.message,
    p_field: params.field ?? null,
  });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes('dono do card')) return { ok: false, error: 'Só o dono do card pode sugerir correção.' };
    if (m.includes('10 sugest')) return { ok: false, error: 'Você já tem 10 sugestões em análise. Aguarde a resposta.' };
    if (m.includes('does not exist')) return { ok: false, error: 'Este recurso está sendo ativado. Tente em instantes.' };
    return { ok: false, error: 'Não foi possível enviar agora. Tente de novo.' };
  }
  return { ok: true };
}

export async function getMyCardCorrections(): Promise<CardCorrection[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc('get_my_card_corrections');
  if (error || !Array.isArray(data)) return [];
  return data.map((r: Record<string, unknown>) => ({
    id: Number(r.id),
    legacyPlayerId: String(r.legacy_player_id),
    field: (r.field as string) ?? null,
    message: String(r.message ?? ''),
    status: (r.status as CorrectionStatus) ?? 'pending',
    adminNote: (r.admin_note as string) ?? null,
    createdAt: String(r.created_at),
    reviewedAt: (r.reviewed_at as string) ?? null,
  }));
}
