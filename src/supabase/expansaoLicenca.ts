import { getSupabase } from './client';

/**
 * Resgatar uma licença de ativação da expansão.
 *
 * Direto no Supabase: `expansao_resgatar_licenca` é a única função de licença
 * que `authenticated` executa, e ela age sobre `auth.uid()` — ninguém ativa a
 * conta de outro. Gerar, listar e revogar são do servidor, atrás do admin.
 */

export type MotivoLicenca =
  | 'licenca_invalida' | 'licenca_revogada' | 'licenca_ja_usada' | 'licenca_expirada'
  | 'ja_ativada_por_esta_licenca' | 'conta_ja_ativada' | 'muitas_tentativas'
  | 'arvore_sem_raiz' | 'sem_sessao' | 'erro';

export type ResultadoLicenca =
  | { readonly ativou: true; readonly patrocinador: string | null }
  | { readonly ativou: false; readonly motivo: MotivoLicenca | string };

export const FRASE_DO_MOTIVO: Record<string, string> = {
  licenca_invalida: 'Essa licença não existe. Confira as letras.',
  licenca_revogada: 'Essa licença foi cancelada.',
  licenca_ja_usada: 'Essa licença já ativou outra conta.',
  licenca_expirada: 'Essa licença venceu.',
  ja_ativada_por_esta_licenca: 'Sua conta já foi ativada por esta licença.',
  conta_ja_ativada: 'Sua conta já está ativada. Guarde a licença pra outra pessoa.',
  muitas_tentativas: 'Muitas tentativas erradas. Tente de novo em uma hora.',
  sem_sessao: 'Entre na sua conta pra usar a licença.',
};

export function fraseDoMotivo(motivo: string): string {
  return FRASE_DO_MOTIVO[motivo] ?? 'Não deu pra ativar agora. Tente de novo.';
}

export async function resgatarLicenca(codigo: string): Promise<ResultadoLicenca> {
  const sb = getSupabase();
  if (!sb) return { ativou: false, motivo: 'erro' };
  const { data: sess } = await sb.auth.getSession();
  if (!sess.session) return { ativou: false, motivo: 'sem_sessao' };
  const { data, error } = await sb.rpc('expansao_resgatar_licenca', { p_codigo: codigo });
  if (error) return { ativou: false, motivo: 'erro' };
  const r = (Array.isArray(data) ? data[0] : data) as
    { ativou: boolean; motivo: string | null; patrocinador: string | null } | undefined;
  if (!r) return { ativou: false, motivo: 'erro' };
  return r.ativou
    ? { ativou: true, patrocinador: r.patrocinador }
    : { ativou: false, motivo: r.motivo ?? 'erro' };
}
