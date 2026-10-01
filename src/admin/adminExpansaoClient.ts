/**
 * Client admin da EXPANSÃO + PRÉ-VENDA + SUPORTE (P1 do raio-x 30/09).
 * Backend: server/src/routes/adminExpansao.ts, adminPresale.ts, adminSuporte.ts.
 * Mesmo cabeçalho do resto do admin (X-Admin-Token + Bearer da sessão).
 */
import { olefootApiBase } from '@/gamespirit/admin/runtimeTruth';
import { fail, headers } from '@/admin/adminPaymentsClient';

async function pegar<T>(caminho: string): Promise<T> {
  const r = await fetch(`${olefootApiBase()}/api/admin${caminho}`, { headers: await headers() });
  if (!r.ok) return fail(r);
  return (await r.json()) as T;
}

async function postar<T>(caminho: string, corpo?: unknown): Promise<T> {
  const r = await fetch(`${olefootApiBase()}/api/admin${caminho}`, {
    method: 'POST',
    headers: await headers(true),
    body: JSON.stringify(corpo ?? {}),
  });
  if (!r.ok) return fail(r);
  return (await r.json()) as T;
}

// ─── ciclos ──────────────────────────────────────────────────────────────────

export interface CicloAdmin {
  id: number;
  abre_em: string;
  status: string;
  receita_menor_unid: string;
  percentual_bps: number;
  pool: string;
  equiparado_total: string;
  bonus_total: string;
  cortado_total: string;
  teto_diario: string | null;
  preco_micro: string | null;
  motivo: string | null;
  fechado_em: string | null;
}

export interface ResumoExpansao {
  ciclos: CicloAdmin[];
  /** null = banco ainda sem ciclo nenhum (bootstrap é do cron). */
  horasPendentes: number | null;
  janela: {
    ciclos: number;
    settled: number;
    held: number;
    poolUsdCents: string;
    pagoUsdCents: string;
    cortadoUsdCents: string;
  };
}

export const lerResumoExpansao = (limite = 72) =>
  pegar<ResumoExpansao>(`/expansao/resumo?limite=${limite}`);

export const fecharCiclosPendentes = () =>
  postar<{ fechados: number }>('/expansao/ciclos/fechar');

export interface LiquidacaoAdmin {
  user_id: string;
  username: string | null;
  equiparado: string;
  sobra_t1: string;
  sobra_t2: string;
  bonus_contabil: string;
  cortado_teto: string;
  retido_inativo: boolean;
  criado_em: string;
}

export const lerLiquidacoesDoCiclo = (cicloId: number) =>
  pegar<{ ciclo: CicloAdmin | null; liquidacoes: LiquidacaoAdmin[] }>(`/expansao/ciclos/${cicloId}/liquidacoes`);

// ─── pessoa ──────────────────────────────────────────────────────────────────

export interface PessoaExpansao {
  username: string;
  userId: string;
  no: {
    patrocinador: string | null;
    pai: string | null;
    lado: number;
    nivel: number;
    perna_padrao: number | null;
    equiparado_acumulado: string;
    criado_em: string;
  } | null;
  pernas: { lado: number; trilho: string; volume: string }[];
  liquidacoes: {
    ciclo_id: number;
    abre_em: string | null;
    equiparado: string;
    bonus_contabil: string;
    cortado_teto: string;
    retido_inativo: boolean;
  }[];
  totalUsdCents: string;
  cortadoUsdCents: string;
  hojeUsdCents: string;
  premios: { degrau: string; olefoot: string; acumulado: string; criado_em: string }[];
  claims: { id: number; olefoot_liquido: string; olefoot_bruto: string; wallet: string; status: string; criado_em: string; pago_em: string | null }[];
  satelites: { user_id: string; username: string | null; lado: number; ref: string; criado_em: string }[];
  carteira: { wallet_address: string; verified: boolean } | null;
  disponivelOlefoot: string;
}

export const lerPessoaExpansao = (username: string) =>
  pegar<PessoaExpansao>(`/expansao/pessoa/${encodeURIComponent(username.trim().replace(/^@/, ''))}`);

// ─── árvore ──────────────────────────────────────────────────────────────────

export interface NoArvoreAdmin {
  userId: string;
  username: string | null;
  nivel: number;
  yOrdem: number;
  lado: number;
  /** Perna RELATIVA à raiz consultada. null na própria raiz. */
  perna: number | null;
  paiId: string | null;
  patrocinador: string | null;
  /** Dono quando a conta é satélite da Ativação 3×. */
  satelliteDe: string | null;
  criadoEm: string;
}

export const lerArvoreAdmin = (username: string, ate = 6) =>
  pegar<{ raiz: { userId: string; username: string; nivel: number }; nos: NoArvoreAdmin[] }>(
    `/expansao/arvore/${encodeURIComponent(username.trim().replace(/^@/, ''))}?ate=${ate}`,
  );

export interface SateliteAdmin {
  user_id: string;
  username: string | null;
  dono_id: string;
  dono: string | null;
  lado: number;
  ref: string;
  criado_em: string;
}

export const lerSatelites = () => pegar<{ satelites: SateliteAdmin[] }>('/expansao/satelites');

export interface PremioAdmin {
  user_id: string;
  username: string | null;
  degrau: string;
  olefoot: string;
  acumulado: string;
  criado_em: string;
}

export const lerPremios = () =>
  pegar<{ premios: PremioAdmin[]; totalOlefoot: string }>('/expansao/premios');

// ─── claims ──────────────────────────────────────────────────────────────────

export type StatusClaim = 'pendente' | 'aprovado' | 'pago' | 'recusado';

export interface ClaimAdmin {
  claim_id: number;
  user_id: string;
  username: string | null;
  wallet: string;
  olefoot_liquido: string;
  olefoot_bruto: string;
  status: StatusClaim;
  criado_em: string;
  pago_em: string | null;
  achados: Record<string, unknown> | null;
}

export const lerClaims = (status?: StatusClaim) =>
  pegar<{ claims: ClaimAdmin[] }>(`/expansao/claims${status ? `?status=${status}` : ''}`);

export const aprovarClaim = (id: number) =>
  postar<{ ok: boolean }>(`/expansao/claims/${id}/aprovar`);

export const recusarClaim = (id: number, motivo: string) =>
  postar<{ ok: boolean }>(`/expansao/claims/${id}/recusar`, { motivo });

export const pagarClaim = (id: number, tx: string) =>
  postar<{ ok: boolean }>(`/expansao/claims/${id}/pagar`, { tx });

// ─── pré-venda ───────────────────────────────────────────────────────────────

export interface PresaleConfigAdmin {
  aberta: boolean;
  teto_conta_usd_cents: number | null;
  degrau_vendido_bps: number;
  teto_apos_degrau_usd_cents: number | null;
  tokens_vendidos: string;
  lancada_em: string | null;
  atualizado_em: string | null;
  /** Trava do fundador: liberação de token só depois de adicionar liquidez. */
  liquidez_adicionada?: boolean;
}

export interface PresaleAdmin {
  config: PresaleConfigAdmin | null;
  vendidosTokens: string;
  alocacaoTokens: string;
  vendidoBps: number;
  totais: { compras: number; pagas: number; usdCentsPagos: string; brlCentsPagos: string };
  compras: {
    id: string;
    username: string | null;
    ref: string;
    usd_cents: number;
    brl_cents: string;
    tokens_entregues: string;
    status: string;
    criada_em: string;
    paga_em: string | null;
  }[];
  posicoes: {
    username: string | null;
    compra_original_usd_cents: number;
    tokens_totais: string;
    liberado_por_compra: string;
    liberado_por_tempo: string;
    sacado: string;
    atualizado_em: string;
  }[];
}

export const lerPresaleAdmin = () => pegar<PresaleAdmin>('/presale');

export const mudarPresaleConfig = (patch: {
  aberta?: boolean;
  tetoContaUsdCents?: number | null;
  degrauVendidoBps?: number;
  tetoAposDegrauUsdCents?: number | null;
  liquidezAdicionada?: boolean;
}) => postar<{ config: PresaleConfigAdmin }>('/presale/config', patch);

// ─── suporte ─────────────────────────────────────────────────────────────────

export interface SuportePin {
  travados: { username: string | null; userId: string; erros: number; destravaEm: string }[];
  comErroRecente: { username: string | null; userId: string; erros: number }[];
  comPin: { username: string | null; criadoEm: string; trocadoEm: string | null }[];
}

export const lerSuportePin = () => pegar<SuportePin>('/suporte/pin');

export const destravarPin = (username: string) =>
  postar<{ ok: boolean; apagadas: number }>(
    `/suporte/pin/${encodeURIComponent(username.trim().replace(/^@/, ''))}/destravar`,
  );

export interface CardSaleAdmin {
  id: string;
  card: string;
  beneficiario: string | null;
  comprador: string | null;
  currency: string;
  gross_cents: string;
  owner_cents: string;
  payment_method: string;
  role: string | null;
  created_at: string;
}

export const lerCardSales = (limite = 200) =>
  pegar<{
    vendas: CardSaleAdmin[];
    resumo: { nome: string; moeda: string; vendas: number; grossCents: string; ownerCents: string }[];
  }>(`/suporte/card-sales?limite=${limite}`);
