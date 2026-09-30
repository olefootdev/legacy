/**
 * PIN da carteira — o lado cliente da Fase 5.
 *
 * A tela pede; quem exige e confere é o servidor (migration 20260930180000):
 * bcrypt no banco, 5 erros = 15 minutos de trava, troca só com login dos
 * últimos 5 minutos. Aqui só mora a chamada e a tradução dos motivos.
 */
import { getSupabase } from '@/supabase/client';

export type PinEstado = { temPin: boolean; tentaDeNovoEm: number };
export type PinResultado = { ok: boolean; motivo: string | null; tentaDeNovoEm: number };

type LinhaEstado = { tem_pin: boolean; tenta_de_novo_em: number };
type LinhaResultado = { ok: boolean; motivo: string | null; tenta_de_novo_em?: number };

const linha = <T,>(data: unknown): T | null =>
  (Array.isArray(data) ? (data[0] as T | undefined) : (data as T | null)) ?? null;

export async function lerPinEstado(): Promise<PinEstado | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('carteira_pin_estado');
  const r = linha<LinhaEstado>(data);
  if (error || !r) return null;
  return { temPin: r.tem_pin === true, tentaDeNovoEm: Number(r.tenta_de_novo_em ?? 0) };
}

export async function verificarPin(pin: string): Promise<PinResultado> {
  const sb = getSupabase();
  if (!sb) return { ok: false, motivo: 'sem_conexao', tentaDeNovoEm: 0 };
  const { data, error } = await sb.rpc('carteira_pin_verificar', { p_pin: pin });
  const r = linha<LinhaResultado>(data);
  if (error || !r) return { ok: false, motivo: 'sem_conexao', tentaDeNovoEm: 0 };
  return { ok: r.ok === true, motivo: r.motivo ?? null, tentaDeNovoEm: Number(r.tenta_de_novo_em ?? 0) };
}

/** Define (primeira vez) ou troca (exige login dos últimos 5 minutos). */
export async function definirPin(pin: string): Promise<{ ok: boolean; motivo: string | null }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, motivo: 'sem_conexao' };
  const { data, error } = await sb.rpc('carteira_pin_definir', { p_pin: pin });
  const r = linha<LinhaResultado>(data);
  if (error || !r) return { ok: false, motivo: 'sem_conexao' };
  return { ok: r.ok === true, motivo: r.motivo ?? null };
}

/**
 * Reentra na conta com a senha, só pra refrescar o `amr` do JWT — é o que a
 * troca de PIN exige. Devolve null quando entrou, ou a mensagem de erro.
 */
export async function reentrarComSenha(senha: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return 'Sem conexão com a conta.';
  const { data: s } = await sb.auth.getUser();
  const email = s.user?.email;
  if (!email) return 'Não achei o e-mail da sua conta.';
  const { error } = await sb.auth.signInWithPassword({ email, password: senha });
  return error ? 'Senha errada.' : null;
}

export function mensagemDoPin(motivo: string | null, tentaDeNovoEm = 0): string {
  switch (motivo) {
    case 'pin_errado': return 'PIN errado.';
    case 'pin_invalido': return 'O PIN tem 6 números.';
    case 'pin_obrigatorio': return 'Digite o seu PIN.';
    case 'muitas_tentativas': {
      const min = Math.max(1, Math.ceil(tentaDeNovoEm / 60));
      return `Muitas tentativas. Espere ${min} min pra tentar de novo.`;
    }
    case 'login_antigo': return 'Trocar o PIN exige entrar na conta de novo.';
    case 'sem_pin': return 'Esta conta ainda não tem PIN.';
    default: return 'Não deu. Tente de novo.';
  }
}
