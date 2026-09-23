/**
 * A costura entre a conta e o banco (A VIRADA · V1).
 *
 * `vaultBook.ts` sabe a conta e não sabe onde mora. As migrations 20260922140000
 * e 141000 sabem guardar e recusar estado impossível, e não sabem contar. Este
 * arquivo liga os dois — e por isso é o lugar mais fácil de esconder um erro que
 * nenhum dos dois pega.
 *
 * Então ele é partido em dois: PLANEJADORES puros, que recebem o fundo lido e
 * devolvem exatamente o payload que será gravado (testáveis sem banco, no
 * runVaultBookSelfTest), e APLICADORES, que só fazem IO — ler, chamar
 * `vault_apply`, e reler quando bater conflito de versão.
 *
 * Nada aqui inventa dinheiro: todo número que vai pro banco saiu de uma função
 * de vaultBook.ts ou harvestSplit.ts.
 */
import { getSupabaseAdmin } from './supabaseAdmin.js';
import {
  depositar,
  marcar,
  reinvestir,
  resgatar,
  type Cotas,
  type Livro,
  type Unidades,
} from './vaultBook.js';
import {
  POLITICA_VAGA_PADRAO,
  ratear,
  type PoliticaVaga,
  type Rateio,
  type Rede,
} from './harvestSplit.js';

export interface Fundo {
  readonly id: string;
  readonly slug: string;
  readonly ativo: string;
  readonly decimais: number;
  readonly versao: bigint;
  readonly livro: Livro;
}

/** Uma posição em estado ABSOLUTO — é o que `vault_apply` espera. */
export interface PosicaoNova {
  readonly user_id: string;
  readonly cotas: string;
}

export interface LinhaLedger {
  readonly user_id: string | null;
  readonly tipo: 'aporte' | 'resgate' | 'marcacao' | 'colheita' | 'rateio' | 'reinvestimento';
  readonly unidades: string;
  readonly cotas: string;
  readonly motivo?: string;
  readonly ref?: string;
}

/** O que será gravado. Um planejador devolve isto e mais nada. */
export interface Plano {
  readonly livro: Livro;
  readonly posicoes: readonly PosicaoNova[];
  readonly ledger: readonly LinhaLedger[];
}

// ------------------------------------------------------------ planejadores ---

export interface PlanoAporte extends Plano {
  readonly cotasEmitidas: Cotas;
}

/**
 * Aporte: emite cotas ao NAV corrente e soma na posição que a pessoa já tinha.
 * `cotasAtuais` é o que está gravado hoje (0 se não há linha).
 */
export function planejarAporte(
  fundo: Fundo,
  userId: string,
  unidades: Unidades,
  cotasAtuais: Cotas,
  ref?: string,
): PlanoAporte {
  if (unidades <= 0n) throw new RangeError('aporte tem que ser positivo');
  const { livro, cotasEmitidas } = depositar(fundo.livro, unidades);
  return {
    livro,
    cotasEmitidas,
    posicoes: [{ user_id: userId, cotas: (cotasAtuais + cotasEmitidas).toString() }],
    ledger: [{
      user_id: userId,
      tipo: 'aporte',
      unidades: unidades.toString(),
      cotas: cotasEmitidas.toString(),
      ref,
    }],
  };
}

export interface PlanoResgate extends Plano {
  readonly unidadesPagas: Unidades;
}

/** Resgate: queima cotas ao NAV corrente. Não deixa sacar mais do que se tem. */
export function planejarResgate(
  fundo: Fundo,
  userId: string,
  cotas: Cotas,
  cotasAtuais: Cotas,
  ref?: string,
): PlanoResgate {
  if (cotas <= 0n) throw new RangeError('resgate tem que ser positivo');
  if (cotas > cotasAtuais) {
    throw new RangeError(`resgate de ${cotas} acima das ${cotasAtuais} que a pessoa tem`);
  }
  const { livro, unidadesPagas } = resgatar(fundo.livro, cotas);
  return {
    livro,
    unidadesPagas,
    posicoes: [{ user_id: userId, cotas: (cotasAtuais - cotas).toString() }],
    ledger: [{
      user_id: userId,
      tipo: 'resgate',
      unidades: unidadesPagas.toString(),
      cotas: cotas.toString(),
      ref,
    }],
  };
}

/** Marcação a mercado: muda o patrimônio, não emite nem queima cota. */
export function planejarMarcacao(fundo: Fundo, patrimonio: Unidades, motivo?: string): Plano {
  return {
    livro: marcar(fundo.livro, patrimonio),
    posicoes: [],
    ledger: [{
      user_id: null,
      tipo: 'marcacao',
      unidades: patrimonio.toString(),
      cotas: '0',
      motivo: motivo ?? 'marcação a mercado',
    }],
  };
}

export interface PlanoColheita extends Plano {
  readonly rateio: Rateio;
  /** O que sai do fundo pra ser pago às pessoas. */
  readonly aPagar: Unidades;
}

/**
 * Colheita: o que a pool produziu sai do patrimônio e é rateado — MENOS a parte
 * sem dono, que pela política `reinvestir` nem chega a sair: fica no livro e
 * sobe o NAV de todo cotista pro rata.
 *
 * Só planeja. Pagar de fato é assinar transação na Solana, e isso não é aqui.
 */
export function planejarColheita(
  fundo: Fundo,
  rede: Rede,
  colheita: Unidades,
  politica: PoliticaVaga = POLITICA_VAGA_PADRAO,
): PlanoColheita {
  if (colheita <= 0n) throw new RangeError('colheita tem que ser positiva');
  if (colheita > fundo.livro.patrimonio) {
    throw new RangeError(`colheita de ${colheita} acima do patrimônio ${fundo.livro.patrimonio}`);
  }

  const rateio = ratear(colheita, rede, politica);
  const aPagar = colheita - rateio.reinvestido;

  // O patrimônio cai só pelo que vai sair. O reinvestido nunca saiu — é essa
  // diferença que faz o NAV subir sem emitir cota.
  let livro = marcar(fundo.livro, fundo.livro.patrimonio - colheita);
  if (rateio.reinvestido > 0n) livro = reinvestir(livro, rateio.reinvestido);

  const ledger: LinhaLedger[] = [
    { user_id: null, tipo: 'colheita', unidades: colheita.toString(), cotas: '0', motivo: 'produzido pela pool' },
  ];
  if (aPagar > 0n) {
    ledger.push({ user_id: null, tipo: 'rateio', unidades: aPagar.toString(), cotas: '0', motivo: `${rateio.pagamentos.length} fatias com dono` });
  }
  if (rateio.reinvestido > 0n) {
    ledger.push({
      user_id: null,
      tipo: 'reinvestimento',
      unidades: rateio.reinvestido.toString(),
      cotas: '0',
      motivo: rateio.vagas.map((v) => `${v.rotulo}: ${v.motivo}`).join(' · '),
    });
  }

  return { livro, posicoes: [], ledger, rateio, aPagar };
}

// -------------------------------------------------------------- aplicadores ---

function sb() {
  const cliente = getSupabaseAdmin();
  if (!cliente) throw new Error('vault: sem service role configurado no servidor');
  return cliente;
}

export async function lerFundo(slug: string): Promise<Fundo | null> {
  const { data, error } = await sb()
    .from('vault_fund')
    .select('id, slug, ativo, decimais, versao, cotas_emitidas, patrimonio')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(`vault: falha ao ler o fundo ${slug}: ${error.message}`);
  if (!data) return null;
  // numeric vem como string do PostgREST — BigInt(string) não perde dígito.
  return {
    id: data.id as string,
    slug: data.slug as string,
    ativo: data.ativo as string,
    decimais: data.decimais as number,
    versao: BigInt(data.versao as string | number),
    livro: {
      cotasEmitidas: BigInt(data.cotas_emitidas as string),
      patrimonio: BigInt(data.patrimonio as string),
    },
  };
}

export async function lerCotas(fundId: string, userId: string): Promise<Cotas> {
  const { data, error } = await sb()
    .from('vault_position')
    .select('cotas')
    .eq('fund_id', fundId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`vault: falha ao ler a posição: ${error.message}`);
  return data ? BigInt(data.cotas as string) : 0n;
}

/** Os quatro papéis da rede, do mais próximo pro mais distante. */
export async function lerAncestrais(userId: string): Promise<string[]> {
  const { data, error } = await sb().rpc('vault_ancestrais', { p_user: userId, p_niveis: 4 });
  if (error) throw new Error(`vault: falha ao subir a árvore: ${error.message}`);
  const linhas = (data ?? []) as { nivel: number; user_id: string }[];
  return [...linhas].sort((a, b) => a.nivel - b.nivel).map((l) => l.user_id);
}

async function aplicar(fundo: Fundo, plano: Plano): Promise<bigint> {
  const { data, error } = await sb().rpc('vault_apply', {
    p_fund: fundo.id,
    p_versao: Number(fundo.versao),
    p_cotas: plano.livro.cotasEmitidas.toString(),
    p_patrim: plano.livro.patrimonio.toString(),
    p_posicoes: plano.posicoes,
    p_ledger: plano.ledger,
  });
  if (error) {
    const conflito = error.code === '40001' || /conflito de vers/i.test(error.message);
    const e = new Error(`vault: ${error.message}`) as Error & { conflito?: boolean };
    e.conflito = conflito;
    throw e;
  }
  return BigInt(data as string | number);
}

/**
 * Lê o fundo, planeja, grava. Se outro write entrou no meio, o banco recusa por
 * versão e a gente refaz a conta em cima do estado novo — nunca em cima do
 * velho. Três tentativas; depois disso é contenção de verdade, não corrida.
 */
async function comRetry<T extends Plano>(
  slug: string,
  planejar: (fundo: Fundo) => Promise<T> | T,
  tentativas = 3,
): Promise<{ plano: T; versao: bigint }> {
  let ultimo: unknown;
  for (let i = 0; i < tentativas; i++) {
    const fundo = await lerFundo(slug);
    if (!fundo) throw new Error(`vault: fundo "${slug}" não existe`);
    const plano = await planejar(fundo);
    try {
      return { plano, versao: await aplicar(fundo, plano) };
    } catch (err) {
      if (!(err as { conflito?: boolean }).conflito) throw err;
      ultimo = err;
    }
  }
  throw new Error(`vault: ${tentativas} conflitos seguidos em "${slug}" — ${(ultimo as Error)?.message}`);
}

export async function aportar(slug: string, userId: string, unidades: Unidades, ref?: string) {
  return comRetry(slug, async (fundo) =>
    planejarAporte(fundo, userId, unidades, await lerCotas(fundo.id, userId), ref));
}

export async function sacar(slug: string, userId: string, cotas: Cotas, ref?: string) {
  return comRetry(slug, async (fundo) =>
    planejarResgate(fundo, userId, cotas, await lerCotas(fundo.id, userId), ref));
}

export async function marcarAMercado(slug: string, patrimonio: Unidades, motivo?: string) {
  return comRetry(slug, (fundo) => planejarMarcacao(fundo, patrimonio, motivo));
}

/**
 * Colhe e registra o rateio fatia por fatia — inclusive as vagas, com motivo.
 * O livro fecha antes de o extrato ser escrito; se a gravação do extrato falhar,
 * a colheita não fica invisível: ela está no ledger como 'colheita'.
 */
export async function colher(
  slug: string,
  depositante: string,
  colheita: Unidades,
  casa: string,
  politica: PoliticaVaga = POLITICA_VAGA_PADRAO,
) {
  if (!casa) throw new Error('vault: sem tesouraria da casa configurada');

  const { plano, versao } = await comRetry(slug, async (fundo) => {
    const rede: Rede = { depositante, casa, ancestrais: await lerAncestrais(depositante) };
    return planejarColheita(fundo, rede, colheita, politica);
  });

  const fundo = await lerFundo(slug);
  const { data, error } = await sb()
    .from('vault_harvest')
    .insert({
      fund_id: fundo?.id,
      depositante,
      colheita: colheita.toString(),
      politica,
      reinvestido: plano.rateio.reinvestido.toString(),
    })
    .select('id')
    .single();
  if (error) throw new Error(`vault: colheita aplicada mas o extrato falhou: ${error.message}`);

  const harvestId = data.id as number;
  const fatias = [
    ...plano.rateio.pagamentos.map((p) => ({
      harvest_id: harvestId, fatia: p.fatia, papel: p.papel,
      destino: p.destino, unidades: p.unidades.toString(), motivo: null as string | null,
    })),
    ...plano.rateio.vagas.map((v) => ({
      harvest_id: harvestId, fatia: v.fatia, papel: v.papel,
      destino: null, unidades: v.unidades.toString(), motivo: v.motivo,
    })),
  ];
  const { error: erroFatias } = await sb().from('vault_harvest_slice').insert(fatias);
  if (erroFatias) throw new Error(`vault: extrato do rateio falhou: ${erroFatias.message}`);

  return { plano, versao, harvestId };
}
