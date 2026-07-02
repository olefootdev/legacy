/**
 * Cliente do Decreto da Semana (Supabase) — FABLE v2 (cross-user).
 *
 * — `submitDecreeVote()`: grava/atualiza o voto do manager na semana ISO
 *   (unique user_id+week_key; RLS: só o próprio voto).
 * — `fetchDecreeTally()`: lê o placar agregado da semana pela view pública
 *   `weekly_decree_tally` (sem expor votos individuais) e devolve o vencedor.
 *
 * Degradação graciosa: sem sessão/tabela, tudo retorna null e o jogo segue
 * com o voto LOCAL (weeklyDecree no save) — comportamento da v1.
 */
import { getSupabase } from './client';
import type { DecreeOption } from '@/systems/weeklyDecree';

export async function submitDecreeVote(weekKey: string, option: DecreeOption): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { data: auth } = await sb.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) return false;
  const { error } = await sb
    .from('weekly_decree_votes')
    .upsert({ user_id: userId, week_key: weekKey, option }, { onConflict: 'user_id,week_key' });
  if (error) {
    console.warn('[decree] submitDecreeVote:', error.message);
    return false;
  }
  return true;
}

export interface DecreeTally {
  espetaculo: number;
  ferro: number;
  /** Opção vencedora (null em 0×0; empate resolve pro 'espetaculo'). */
  winner: DecreeOption | null;
}

export async function fetchDecreeTally(weekKey: string): Promise<DecreeTally | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from('weekly_decree_tally')
    .select('option, votes')
    .eq('week_key', weekKey);
  if (error) {
    console.warn('[decree] fetchDecreeTally:', error.message);
    return null;
  }
  const rows = (data ?? []) as { option: string; votes: number }[];
  const espetaculo = rows.find((r) => r.option === 'espetaculo')?.votes ?? 0;
  const ferro = rows.find((r) => r.option === 'ferro')?.votes ?? 0;
  const winner: DecreeOption | null =
    espetaculo === 0 && ferro === 0 ? null : ferro > espetaculo ? 'ferro' : 'espetaculo';
  return { espetaculo, ferro, winner };
}
