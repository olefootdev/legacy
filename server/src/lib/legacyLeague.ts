/**
 * LEGACY LEAGUE — regras puras (sem banco). Rotas em routes/legacyLeague.ts.
 *
 * Temporada semanal ISO (segunda a domingo, UTC). Até 3 partidas da liga por
 * dia. Uma partida só VALE quando o servidor tem as duas provas:
 *   - custódia válida do relato (evolucao_sombra.custodia = 'valida'), e
 *   - o filme da partida (partidas_filme) — só existe se o campo esteve aberto.
 * Sem as duas, fica `aguardando` (o celular tenta de novo por alguns segundos);
 * com custódia suspeita ou placar que não bate, `invalida` (0 pontos).
 */

export const LIMITE_POR_DIA = 3;
/** Partida aberta e não jogada vira `expirada` depois disto. */
export const VALIDADE_DA_PARTIDA_MS = 3 * 3600 * 1000;

/** '2026-W41' — semana ISO (segunda a domingo, UTC). */
export function temporadaDe(d: Date): string {
  const dia = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const semana = (dia.getUTCDay() + 6) % 7; // segunda = 0
  dia.setUTCDate(dia.getUTCDate() - semana + 3); // quinta da semana decide o ano ISO
  const ano = dia.getUTCFullYear();
  const primeiraQuinta = new Date(Date.UTC(ano, 0, 4));
  const n = 1 + Math.round(((dia.getTime() - primeiraQuinta.getTime()) / 86400000 - 3 + ((primeiraQuinta.getUTCDay() + 6) % 7)) / 7);
  return `${ano}-W${String(n).padStart(2, '0')}`;
}

/** A temporada anterior (pro "campeão da semana passada"). */
export function temporadaAnterior(d: Date): string {
  return temporadaDe(new Date(d.getTime() - 7 * 86400000));
}

/** Quando a temporada de `d` acaba (domingo 23:59:59 UTC). */
export function fimDaTemporada(d: Date): Date {
  const dia = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const ateDomingo = (7 - dia.getUTCDay()) % 7;
  return new Date(dia.getTime() + ateDomingo * 86400000 + 86399999);
}

export const pontosDe = (pro: number, contra: number): 0 | 1 | 3 => (pro > contra ? 3 : pro === contra ? 1 : 0);

export interface PartidaValida { dono: string; gols_pro: number; gols_contra: number; pontos: number }
export interface LinhaDaTabela { dono: string; jogos: number; v: number; e: number; d: number; gp: number; gc: number; saldo: number; pontos: number }

/** Tabela da temporada: pontos, saldo, gols pró; quem jogou menos fica na frente no empate total. */
export function montarTabela(partidas: readonly PartidaValida[]): LinhaDaTabela[] {
  const por = new Map<string, LinhaDaTabela>();
  for (const p of partidas) {
    const l = por.get(p.dono) ?? { dono: p.dono, jogos: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, saldo: 0, pontos: 0 };
    l.jogos++; l.gp += p.gols_pro; l.gc += p.gols_contra; l.pontos += p.pontos;
    if (p.pontos === 3) l.v++; else if (p.pontos === 1) l.e++; else l.d++;
    l.saldo = l.gp - l.gc;
    por.set(p.dono, l);
  }
  return [...por.values()].sort((a, b) => b.pontos - a.pontos || b.saldo - a.saldo || b.gp - a.gp || a.jogos - b.jogos || a.dono.localeCompare(b.dono));
}

/** A seed da partida da liga carrega o id da partida e o do adversário. */
export function seedDaPartida(seed: string, partidaId: string, adversario: string): boolean {
  return seed.includes(`-LL${partidaId}`) && seed.includes(`-${adversario}-`);
}

export type Veredito =
  | { status: 'valida'; gols_pro: number; gols_contra: number; pontos: 0 | 1 | 3 }
  | { status: 'invalida'; motivo: string }
  | { status: 'aguardando'; falta: 'custodia' | 'filme' };

/**
 * O veredito da partida. `sombra`: a linha da custódia (owner+seed);
 * `filme`: o resumo do filme (owner+seed). O placar oficial é o do filme, e tem
 * de bater com o resultado que a custódia conferiu.
 */
export function veredito(args: {
  seed: string; partidaId: string; adversario: string;
  sombra: { custodia: string; resultado: string } | null;
  filme: { placarCasa: number; placarFora: number } | null;
}): Veredito {
  if (!seedDaPartida(args.seed, args.partidaId, args.adversario)) return { status: 'invalida', motivo: 'a seed não é desta partida da liga' };
  if (!args.sombra) return { status: 'aguardando', falta: 'custodia' };
  if (args.sombra.custodia !== 'valida') return { status: 'invalida', motivo: `custódia ${args.sombra.custodia}` };
  if (!args.filme) return { status: 'aguardando', falta: 'filme' };
  const { placarCasa: pro, placarFora: contra } = args.filme;
  // Empate no tempo normal pode ter ido aos pênaltis (a custódia grava quem
  // venceu a disputa): na liga, empate é empate — 1 ponto, qualquer desfecho.
  const resultado = pro > contra ? 'win' : pro === contra ? 'draw' : 'loss';
  const bate = resultado === 'draw' ? true : resultado === args.sombra.resultado;
  if (!bate) return { status: 'invalida', motivo: 'o placar do filme não bate com o da custódia' };
  return { status: 'valida', gols_pro: pro, gols_contra: contra, pontos: pontosDe(pro, contra) };
}
