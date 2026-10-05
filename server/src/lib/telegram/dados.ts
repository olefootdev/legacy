/**
 * O que o bot lê do banco — service role, porque ranking e mercado têm a
 * leitura de anon revogada. Só sai daqui o que a mensagem mostra (nome de
 * clube, pontos, preço); e-mail e id de manager nunca entram no select.
 */
import { getSupabaseAdmin } from '../supabaseAdmin.js';
import type { LinhaMercado, LinhaMvp, LinhaRanking } from './conteudo.js';

/** Data de hoje em São Paulo, "AAAA-MM-DD" — o dia do MVP é o de Brasília. */
export function hojeEmSaoPaulo(agora = new Date()): string {
  return agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export async function lerRanking(divisao = 1, limite = 10): Promise<LinhaRanking[] | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  // Mesmo desempate da tabela do jogo (src/ranking/divisionStandings.ts):
  // pontos, vitórias, saldo, gols pró.
  const { data, error } = await sb
    .from('global_league_teams')
    .select('club_name, division, points, wins, goal_difference, goals_for')
    .eq('division', divisao)
    .order('points', { ascending: false })
    .order('wins', { ascending: false })
    .order('goal_difference', { ascending: false })
    .order('goals_for', { ascending: false })
    .limit(limite);
  if (error) { console.error('[telegram] ranking', error.message); return null; }
  return (data ?? []) as LinhaRanking[];
}

export async function lerAltasDoMercado(): Promise<LinhaMercado[] | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb.rpc('ole100', { p_limite: 100 });
  if (error) { console.error('[telegram] mercado', error.message); return null; }
  return ((data ?? []) as Record<string, unknown>[]).map((d) => ({
    name: (d.name as string) ?? null,
    pos: (d.pos as string) ?? null,
    ovr: d.ovr == null ? null : Number(d.ovr),
    market_bro_cents: d.market_bro_cents == null ? null : Number(d.market_bro_cents),
    delta24h_cents: d.delta24h_cents == null ? null : Number(d.delta24h_cents),
    dono: (d.dono as string) ?? null,
  }));
}

/** O leilão do MVP de hoje (São Paulo). null = ainda não saiu. */
export async function lerMvpDeHoje(agora = new Date()): Promise<LinhaMvp | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from('mvp_auctions')
    .select('dia, player_name, status, min_bid_olefoot, bid_olefoot, ends_at, origem_user_id')
    .eq('dia', hojeEmSaoPaulo(agora))
    .maybeSingle();
  if (error) { console.error('[telegram] mvp', error.message); return null; }
  if (!data) return null;
  let clube: string | null = null;
  if (data.origem_user_id) {
    const p = await sb.from('profiles').select('club_name').eq('id', data.origem_user_id).maybeSingle();
    clube = (p.data?.club_name as string) ?? null;
  }
  return {
    dia: String(data.dia),
    player_name: (data.player_name as string) ?? null,
    status: (data.status as string) ?? null,
    min_bid_olefoot: data.min_bid_olefoot as string | number | null,
    bid_olefoot: data.bid_olefoot as string | number | null,
    ends_at: (data.ends_at as string) ?? null,
    clube,
  };
}
