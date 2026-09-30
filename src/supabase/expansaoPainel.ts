import { getSupabase } from './client';

/**
 * Leitura do painel de expansão.
 *
 * Fala direto com o Supabase: `expansao_mapa` e `expansao_ativacao` são
 * executáveis por `authenticated`, e `expansao_perna` tem RLS de linha própria.
 * Não precisa de rota no Hono — e o que a pessoa vê é o que o banco deixa ela
 * ver, não o que o cliente resolveu pedir.
 */

export interface Ativacao {
  readonly ativo: boolean;
  readonly diretosT1: number;
  readonly diretosT2: number;
  /** Qual perna ainda falta. null quando já está ativo. */
  readonly faltaNaPerna: 1 | 2 | null;
}

export interface Pernas {
  readonly t1: bigint;
  readonly t2: bigint;
  /** O MIN — é ele que paga e é ele que gradua. */
  readonly menor: bigint;
}

export interface NoDoMapa {
  readonly userId: string;
  readonly nivel: number;
  readonly yOrdem: number;
  readonly perna: 1 | 2;
  /** Falso = chegou por derramamento: mostra graduação, não username. */
  readonly daMinhaEquipe: boolean;
  readonly paiId: string | null;
}

export async function lerAtivacao(): Promise<Ativacao | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: sess } = await sb.auth.getUser();
  if (!sess.user) return null;
  const { data, error } = await sb.rpc('expansao_ativacao', { p_user: sess.user.id });
  if (error) return null;
  const l = Array.isArray(data) ? data[0] : data;
  if (!l) return null;
  return {
    ativo: l.ativo === true,
    diretosT1: Number(l.diretos_t1 ?? 0),
    diretosT2: Number(l.diretos_t2 ?? 0),
    faltaNaPerna: (l.falta_na_perna ?? null) as 1 | 2 | null,
  };
}

/** Volume das duas pernas no trilho que PAGA (equiparação). */
export async function lerPernas(): Promise<Pernas | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from('expansao_perna')
    .select('lado, volume')
    .eq('trilho', 'equiparacao');
  if (error) return null;
  const achar = (lado: number) => {
    const linha = (data ?? []).find((d) => Number(d.lado) === lado);
    return linha ? BigInt(String(linha.volume)) : 0n;
  };
  const t1 = achar(1);
  const t2 = achar(2);
  return { t1, t2, menor: t1 < t2 ? t1 : t2 };
}

/** Volume no trilho que GRADUA — nunca é consumido pela equiparação. */
export async function lerPernasQualificacao(): Promise<Pernas | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from('expansao_perna')
    .select('lado, volume')
    .eq('trilho', 'qualificacao');
  if (error) return null;
  const achar = (lado: number) => {
    const linha = (data ?? []).find((d) => Number(d.lado) === lado);
    return linha ? BigInt(String(linha.volume)) : 0n;
  };
  const t1 = achar(1);
  const t2 = achar(2);
  return { t1, t2, menor: t1 < t2 ? t1 : t2 };
}

export async function lerMapa(ate = 5): Promise<NoDoMapa[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data: sess } = await sb.auth.getUser();
  if (!sess.user) return [];
  const { data, error } = await sb.rpc('expansao_mapa', {
    p_raiz: sess.user.id, p_de: 1, p_ate: ate,
  });
  if (error) return [];
  return (data ?? []).map((d: Record<string, unknown>) => ({
    userId: String(d.user_id),
    nivel: Number(d.nivel),
    yOrdem: Number(d.y_ordem),
    perna: Number(d.perna) as 1 | 2,
    daMinhaEquipe: d.da_minha_equipe === true,
    paiId: (d.pai_id as string | null) ?? null,
  }));
}

/** Estou na árvore? E por quem entrei? */
export async function lerMinhaEntrada(): Promise<{ naArvore: boolean; padrinho: string | null }> {
  const sb = getSupabase();
  if (!sb) return { naArvore: false, padrinho: null };
  const { data } = await sb.from('expansao_confirmacao').select('username_convite').maybeSingle();
  return { naArvore: !!data, padrinho: data?.username_convite ?? null };
}

export interface Carreira {
  /** O que já foi PAGO em equiparação, somado. É a base do degrau. */
  readonly acumulado: bigint;
  readonly degrau: string | null;
  readonly proximo: string | null;
  readonly falta: bigint;
}

/**
 * A graduação conta o OLEXP já PAGO, não o volume parado na perna menor.
 * Regra do fundador: quando entra um volume grande de um lado só, a perna menor
 * troca de lado — e lendo "a menor agora" o degrau olharia outro número. Somando
 * o pago, ele só sobe.
 */
export async function lerCarreira(): Promise<Carreira | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: sess } = await sb.auth.getUser();
  if (!sess.user) return null;
  const { data, error } = await sb.rpc('expansao_carreira', { p_user: sess.user.id });
  if (error) return null;
  const l = Array.isArray(data) ? data[0] : data;
  if (!l) return null;
  return {
    acumulado: BigInt(String(l.equiparado_acumulado ?? '0')),
    degrau: l.degrau ?? null,
    proximo: l.proximo ?? null,
    falta: BigInt(String(l.falta ?? '0')),
  };
}

/** Meu username — é ele que vira o link de convite. */
export async function lerMeuUsername(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.from('profiles').select('username').maybeSingle();
  return data?.username ?? null;
}

/** Posso convidar? (pack de $10 pago ou ativação da casa) */
export async function podeConvidar(): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { data: sess } = await sb.auth.getUser();
  if (!sess.user) return false;
  const { data, error } = await sb.rpc('expansao_pode_convidar', { p_user: sess.user.id });
  return !error && data === true;
}

// ───────────────────────────────────────────────────────────── o bônus ─────

export interface MeuBonus {
  /** Tudo que já foi liquidado pra mim, em centavos de dólar. */
  readonly usdCents: bigint;
  /** O mesmo, em OLEFOOT, pelo preço gravado em CADA ciclo. */
  readonly olefoot: bigint;
  /** Já sacado (claims aprovados ou pagos). */
  readonly olefootSacado: bigint;
  readonly ciclosPagos: number;
  /** null = automático. */
  readonly pernaPadrao: 1 | 2 | null;
}

const inteiro = (v: unknown): bigint => {
  try { return BigInt(String(v ?? '0').split('.')[0] || '0'); } catch { return 0n; }
};

/** RPC que age sobre `auth.uid()`: não recebe id, não lê de outro. */
export async function lerMeuBonus(): Promise<MeuBonus | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('expansao_meu_bonus');
  if (error) return null;
  const l = Array.isArray(data) ? data[0] : data;
  if (!l) return null;
  const perna = l.perna_padrao == null ? null : (Number(l.perna_padrao) as 1 | 2);
  return {
    usdCents: inteiro(l.bonus_usd_cents),
    olefoot: inteiro(l.olefoot),
    olefootSacado: inteiro(l.olefoot_sacado),
    ciclosPagos: Number(l.ciclos_pagos ?? 0),
    pernaPadrao: perna === 1 || perna === 2 ? perna : null,
  };
}

// ──────────────────────────────────────────────────────────── os ciclos ────

export interface CicloFechado {
  readonly abreEm: string;
  readonly status: 'SETTLED' | 'HELD' | string;
  readonly poolUsdCents: bigint;
  readonly equiparadoTotal: bigint;
  /** Micro-centavos de dólar por OLEXP. null = ciclo não liquidou. */
  readonly valorPorOlexpMicro: bigint | null;
}

/**
 * Os últimos ciclos que PAGARAM. A tabela é pública de leitura por desenho —
 * é o registro que prova que o pool saiu da receita. Os retidos ficam de fora
 * da tela: sem compra na hora, o ciclo é HELD, e uma lista de HELD esconde os
 * que importam.
 */
export async function lerCiclosPagos(quantos = 6): Promise<CicloFechado[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('expansao_ciclo')
    .select('abre_em, status, pool, equiparado_total, valor_por_olexp_micro')
    .eq('status', 'SETTLED')
    .order('abre_em', { ascending: false })
    .limit(quantos);
  if (error || !Array.isArray(data)) return [];
  return data.map((c) => ({
    abreEm: String(c.abre_em),
    status: String(c.status),
    poolUsdCents: inteiro(c.pool),
    equiparadoTotal: inteiro(c.equiparado_total),
    valorPorOlexpMicro: c.valor_por_olexp_micro == null ? null : inteiro(c.valor_por_olexp_micro),
  }));
}

/**
 * null = automático (o time com menos indicados diretos).
 *
 * Conta COM PIN assina com ele: sem `pin` o servidor responde
 * `pin_obrigatorio`, e a tela pede antes de repetir a chamada. Motivos
 * possíveis: pin_obrigatorio · pin_errado · muitas_tentativas · erro.
 */
export async function definirPernaPadrao(
  lado: 1 | 2 | null,
  pin?: string,
): Promise<{ ok: boolean; motivo: string | null; tentaDeNovoEm: number }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, motivo: 'erro', tentaDeNovoEm: 0 };
  if (pin != null) {
    const { data, error } = await sb.rpc('expansao_definir_perna_padrao', { p_lado: lado, p_pin: pin });
    const r = (Array.isArray(data) ? data[0] : data) as
      { ok: boolean; motivo: string | null; tenta_de_novo_em?: number } | null;
    if (error || !r) return { ok: false, motivo: 'erro', tentaDeNovoEm: 0 };
    return { ok: r.ok === true, motivo: r.motivo ?? null, tentaDeNovoEm: Number(r.tenta_de_novo_em ?? 0) };
  }
  const { error } = await sb.rpc('expansao_definir_perna_padrao', { p_lado: lado });
  if (!error) return { ok: true, motivo: null, tentaDeNovoEm: 0 };
  return {
    ok: false,
    motivo: error.message.includes('PIN_OBRIGATORIO') ? 'pin_obrigatorio' : 'erro',
    tentaDeNovoEm: 0,
  };
}
