/**
 * Earnings — o que a aba DEX lê do servidor.
 *
 * 🔴 A tela não guarda NENHUM número de regra. Split, prazo, multiplicador,
 * piso do canário e backtest vêm de GET /api/earnings. A OLEWALLET tinha uma
 * cópia do split escrita à mão ao lado do comentário "os mesmos números do
 * servidor" — é exatamente o tipo de cópia que um dia diverge calada.
 *
 * O que é de cada pessoa (cotas, fatias recebidas) vai com a sessão, em
 * `/api/vault/:slug/*`. Sem sessão a leitura devolve null e a tela mostra só a
 * regra.
 */
import { getSupabase } from '@/supabase/client';

const API_BASE =
  (import.meta.env.VITE_OLEFOOT_API_URL as string) ||
  (import.meta.env.VITE_API_URL as string) ||
  'http://localhost:4000';

// ──────────────────────────────────────────────────────────────── regras ───

export type IdFatia = 'voce' | 'myclub' | 'manager' | 'captain' | 'pro' | 'olefoot';

export interface Fatia {
  readonly id: IdFatia;
  readonly rotulo: string;
  readonly papel: string;
  /** Base 10.000: 5000 = 50%. */
  readonly bps: number;
}

export interface PrazoDeStake {
  readonly dias: number;
  /** Base 10.000: 15000 = 1,5×. */
  readonly multiplicadorBps: number;
}

export interface RegrasDeEarnings {
  readonly producao: { readonly fatias: readonly Fatia[]; readonly totalBps: number };
  readonly vault: {
    readonly slug: string;
    readonly par: string;
    readonly faixa: string;
    readonly canario: { readonly nome: string; readonly pisoAprBps: number };
    readonly backtest: {
      readonly janelaAnosDecimos: number;
      readonly retornoAoAnoPct: { readonly de: number; readonly ate: number };
      readonly piorQuedaPct: number;
      readonly segurandoSol: { readonly retornoAoAnoPct: number; readonly piorQuedaPct: number };
    };
    /** null = o fundo nunca operou com dinheiro. */
    readonly resultadoRealizado: number | null;
  };
  readonly stake: {
    readonly aberto: boolean;
    readonly saidaAntecipada: boolean;
    readonly prazos: readonly PrazoDeStake[];
  };
}

export async function lerRegras(): Promise<RegrasDeEarnings> {
  const res = await fetch(`${API_BASE}/api/earnings`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) throw new Error(body.error ?? `http_${res.status}`);
  return body as RegrasDeEarnings;
}

// ───────────────────────────────────────────────────────────────── fundo ───

export interface FundoDoVault {
  readonly ativo: string;
  readonly decimais: number;
  /** Patrimônio marcado a mercado, na menor unidade do ativo. */
  readonly patrimonio: bigint;
  /** Quanto vale UMA cota, na menor unidade. null = nenhuma cota emitida. */
  readonly valorDaCota: bigint | null;
}

const inteiro = (v: unknown): bigint => {
  try { return BigInt(String(v ?? '0').split('.')[0] || '0'); } catch { return 0n; }
};

/** null = o fundo ainda não foi criado. Não é erro: é o estado de lançamento. */
export async function lerFundo(slug: string): Promise<FundoDoVault | null> {
  const res = await fetch(`${API_BASE}/api/vault/${encodeURIComponent(slug)}`);
  if (res.status === 404) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok || !body.fundo) throw new Error(body.error ?? `http_${res.status}`);
  return {
    ativo: String(body.fundo.ativo ?? ''),
    decimais: Number(body.fundo.decimais ?? 0),
    patrimonio: inteiro(body.fundo.patrimonio),
    valorDaCota: body.fundo.navPorCota == null ? null : inteiro(body.fundo.navPorCota),
  };
}

// ──────────────────────────────────────────────────── o que é da pessoa ───

async function cabecalho(): Promise<Record<string, string> | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : null;
}

export interface MinhaPosicaoNoVault {
  /** Micro-cotas (1 cota = 1e9). */
  readonly cotas: bigint;
  /** Quanto as cotas valem agora, na menor unidade do ativo. */
  readonly valorAgora: bigint;
}

export interface FatiaRecebida {
  readonly fatia: string;
  readonly unidades: bigint;
  readonly colheita: string;
}

export interface MeuVault {
  readonly posicao: MinhaPosicaoNoVault;
  readonly fatias: readonly FatiaRecebida[];
}

/** null = sem sessão ou fundo inexistente. A tela mostra só a regra. */
export async function lerMeuVault(slug: string): Promise<MeuVault | null> {
  const h = await cabecalho();
  if (!h) return null;
  const base = `${API_BASE}/api/vault/${encodeURIComponent(slug)}`;
  const [rp, re] = await Promise.all([
    fetch(`${base}/minha-posicao`, { headers: h }),
    fetch(`${base}/meu-extrato`, { headers: h }),
  ]);
  if (!rp.ok || !re.ok) return null;
  const p = await rp.json().catch(() => ({}));
  const e = await re.json().catch(() => ({}));
  if (!p.ok || !e.ok) return null;
  return {
    posicao: { cotas: inteiro(p.cotas), valorAgora: inteiro(p.valorAgora) },
    fatias: (Array.isArray(e.fatiasRecebidas) ? e.fatiasRecebidas : []).map(
      (f: Record<string, unknown>) => ({
        fatia: String(f.fatia ?? ''),
        unidades: inteiro(f.unidades),
        colheita: String(f.harvest_id ?? ''),
      }),
    ),
  };
}

// ─────────────────────────────────────────────────────────────── formato ───

/** Menor unidade → texto com `casas` decimais, truncando (nunca arredonda pra cima). */
export function emUnidades(valor: bigint, decimais: number, casas = 2): string {
  const base = 10n ** BigInt(Math.max(0, decimais));
  const inteira = valor / base;
  const fracao = ((valor % base) * 10n ** BigInt(casas)) / base;
  const parte = inteira.toLocaleString('pt-BR');
  return casas > 0 ? `${parte},${fracao.toString().padStart(casas, '0')}` : parte;
}

/** 5000 bps → "50%"; 2550 → "25,5%". */
export function emPorcento(bps: number): string {
  return `${(bps / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

/** 15000 bps → "1,5×". */
export function emVezes(bps: number): string {
  return `${(bps / 10_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}×`;
}
