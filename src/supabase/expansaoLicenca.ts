import { getSupabase } from './client';
import { L } from '@/i18n/L';

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
  licenca_invalida: L('Essa licença não existe. Confira as letras.', 'This license doesn\'t exist. Check the letters.'),
  licenca_revogada: L('Essa licença foi cancelada.', 'This license was cancelled.'),
  licenca_ja_usada: L('Essa licença já ativou outra conta.', 'This license already activated another account.'),
  licenca_expirada: L('Essa licença venceu.', 'This license expired.'),
  ja_ativada_por_esta_licenca: L('Sua conta já foi ativada por esta licença.', 'Your account was already activated by this license.'),
  conta_ja_ativada: L('Sua conta já está ativada. Guarde a licença pra outra pessoa.', 'Your account is already active. Save the license for someone else.'),
  muitas_tentativas: L('Muitas tentativas erradas. Tente de novo em uma hora.', 'Too many wrong attempts. Try again in an hour.'),
  sem_sessao: L('Entre na sua conta pra usar a licença.', 'Log in to your account to use the license.'),
};

export function fraseDoMotivo(motivo: string): string {
  return FRASE_DO_MOTIVO[motivo] ?? L('Não deu pra ativar agora. Tente de novo.', 'Couldn\'t activate right now. Try again.');
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
