import { getSupabase } from './client';
import { L } from '@/i18n/L';

/**
 * Convite de expansão — a porta de entrada na árvore binária.
 *
 * 🔒 A entrada é ATO PRÓPRIO: `expansao_confirmar_convite` age sobre
 * `auth.uid()`, então ninguém coloca ninguém na árvore. E a posição é
 * PERMANENTE — por isso a tela confirma antes, e o sim fica registrado.
 */

export interface ConviteInfo {
  readonly username: string;
  readonly existe: boolean;
  /** Falso quando o padrinho ainda não ativou um pack de $10. */
  readonly podeConvidar: boolean;
}

export type MotivoRecusa =
  | 'convite_inexistente'
  | 'auto_convite'
  | 'ja_esta_na_expansao'
  | 'convite_nao_ativado'
  | 'patrocinador_fora_da_arvore'
  | 'sem_sessao'
  | 'erro';

export interface Confirmacao {
  readonly entrou: boolean;
  readonly motivo: MotivoRecusa | null;
  readonly patrocinador: string | null;
}

/** Leitura pública: quem clicou no link ainda não fez login. */
export async function buscarConvite(username: string): Promise<ConviteInfo | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('expansao_convite_de', { p_username: username });
  if (error) return null;
  const linha = Array.isArray(data) ? data[0] : data;
  if (!linha) return null;
  return {
    username: String(linha.username ?? username),
    existe: linha.existe === true,
    podeConvidar: linha.pode_convidar === true,
  };
}

export async function confirmarConvite(username: string): Promise<Confirmacao> {
  const sb = getSupabase();
  if (!sb) return { entrou: false, motivo: 'erro', patrocinador: null };
  const { data, error } = await sb.rpc('expansao_confirmar_convite', { p_username: username });
  if (error) {
    // A função estoura de propósito quando não há sessão, em vez de adivinhar.
    const semSessao = /must be authenticated/i.test(error.message);
    return { entrou: false, motivo: semSessao ? 'sem_sessao' : 'erro', patrocinador: null };
  }
  const linha = Array.isArray(data) ? data[0] : data;
  return {
    entrou: linha?.entrou === true,
    motivo: (linha?.motivo ?? null) as MotivoRecusa | null,
    patrocinador: linha?.patrocinador ?? null,
  };
}

/** Já estou na árvore? Leitura da minha própria confirmação (RLS cuida). */
export async function jaConfirmou(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.from('expansao_confirmacao').select('username_convite').maybeSingle();
  return data?.username_convite ?? null;
}

// ─────────────────────────────────────────────── voltar pro convite ─────────

const CHAVE_DESTINO = 'olefoot.convite.expansao';

/**
 * Guarda o convite antes de mandar a pessoa pro login/cadastro.
 *
 * Sem isto o laço quebra no lugar mais caro: a pessoa clica em "já tenho
 * conta", loga, cai no jogo — e o convite some. Ela não perde nada de valor,
 * mas também nunca entra na expansão, e ninguém descobre o porquê.
 */
export function guardarConvitePendente(username: string): void {
  try { sessionStorage.setItem(CHAVE_DESTINO, username.trim().toLowerCase()); }
  catch { /* janela privada: segue sem o atalho de volta */ }
}

/** Só LÊ o convite pendente, sem consumir. É o que a faixa do login usa. */
export function convitePendente(): string | null {
  try { return sessionStorage.getItem(CHAVE_DESTINO); } catch { return null; }
}

/** Para onde ir depois de entrar/cadastrar. CONSOME o pendente. */
export function destinoAposEntrar(): string {
  let u: string | null = null;
  try {
    u = sessionStorage.getItem(CHAVE_DESTINO);
    if (u) sessionStorage.removeItem(CHAVE_DESTINO);
  } catch { /* idem */ }
  return u ? `/convite-expansao/${encodeURIComponent(u)}` : '/';
}

// ─────────────────────────────────────────────── quem te indicou ───────────

export type MotivoIndicacao = 'inexistente' | 'auto_indicacao' | 'nao_ativado' | 'ja_esta_na_arvore' | 'sem_sessao' | 'erro';

export const FRASE_DA_INDICACAO: Record<MotivoIndicacao, string> = {
  inexistente: L('Não achamos esse @. Confira com quem te indicou.', 'We couldn\'t find that @. Check with who referred you.'),
  auto_indicacao: L('Você não pode se indicar.', 'You can\'t refer yourself.'),
  nao_ativado: L('Essa conta ainda não ativou o convite.', 'This account hasn\'t activated the invite yet.'),
  ja_esta_na_arvore: L('Você já está na rede.', 'You are already in the network.'),
  sem_sessao: L('Entre na sua conta para continuar.', 'Log in to your account to continue.'),
  erro: L('Não deu para confirmar agora. Tente de novo.', 'Couldn\'t confirm right now. Try again.'),
};

/**
 * Declara quem me indicou (ou "ninguém", com null). Vale pra compra que me
 * põe na rede: `expansao_entrar_por_compra` usa esta escolha antes do código
 * de cadastro. Age sobre auth.uid().
 */
export async function escolherPatrocinador(
  username: string | null,
): Promise<{ ok: true; patrocinador: string | null } | { ok: false; motivo: MotivoIndicacao }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, motivo: 'erro' };
  const { data, error } = await sb.rpc('expansao_escolher_patrocinador', { p_username: username ?? '' });
  // Função ainda não existe no banco (front publicado antes da migration):
  // a compra segue como antes — código de cadastro, depois ORIGEM. Travar o
  // Pix por causa de uma pergunta seria pior que não perguntar.
  if (error?.code === 'PGRST202') return { ok: true, patrocinador: null };
  if (error) return { ok: false, motivo: /must be authenticated/i.test(error.message) ? 'sem_sessao' : 'erro' };
  const l = Array.isArray(data) ? data[0] : data;
  if (l?.ok === true) return { ok: true, patrocinador: l.patrocinador ?? null };
  return { ok: false, motivo: ((l?.motivo as MotivoIndicacao) ?? 'erro') };
}

/** O @ que pré-preenche o checkout: escolha já feita > dono do código de cadastro. */
export async function meuIndicador(): Promise<{ sugerido: string | null; fonte: 'escolhido' | 'cadastro' | null; naArvore: boolean } | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('expansao_meu_indicador');
  if (error) return null;
  const l = Array.isArray(data) ? data[0] : data;
  if (!l) return null;
  const fonte = l.fonte === 'escolhido' || l.fonte === 'cadastro' ? l.fonte : null;
  return { sugerido: l.sugerido ?? null, fonte, naArvore: l.na_arvore === true };
}

/** Código de cadastro de quem convida — pro link /cadastro/<código>. */
export async function codigoDeIndicacaoDe(username: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('codigo_de_indicacao_de', { p_username: username });
  return error || typeof data !== 'string' || !data ? null : data;
}
