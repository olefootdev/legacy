/**
 * Sessão do REVELA.
 *
 * ⚠️ REVELA e o jogo são ORIGENS DIFERENTES (revela.olefoot.com vs
 * game.olefoot.com). O Supabase guarda a sessão em localStorage, que é por
 * origem — então estar logado no jogo NÃO loga aqui. É o mesmo projeto Supabase
 * e a MESMA conta; o que não viaja é o token.
 *
 * Consequência de produto: aqui só fazemos LOGIN de conta que já existe. Criar
 * conta continua sendo no jogo (/cadastro/<código>), porque é lá que a árvore
 * de indicação e o perfil do manager são montados — duplicar esse cadastro aqui
 * criaria usuário órfão sem crédito de rede, que é justamente o que o banco
 * bloqueia.
 */
import { getSupabase } from '@/supabase/client';
import { normalizeReferralCode } from '@/wallet/referralCode';

export const GAME_URL = 'https://game.olefoot.com';

/** Chave própria do REVELA — nunca escrever na do jogo. */
const REF_KEY = 'olefoot-revela-ref';

export interface RevelaSession {
  userId: string;
  email: string | null;
}

export async function currentSession(): Promise<RevelaSession | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  return { userId: user.id, email: user.email ?? null };
}

export function onSessionChange(cb: (s: RevelaSession | null) => void): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((_evt, session) => {
    const user = session?.user;
    cb(user ? { userId: user.id, email: user.email ?? null } : null);
  });
  return () => data.subscription.unsubscribe();
}

/**
 * Cria conta com e-mail e senha, direto no REVELA.
 *
 * Antes o REVELA só fazia login e mandava criar conta no jogo, porque é lá que a
 * árvore de indicação é montada. O fundador pediu cadastro aqui (2026-07-23) —
 * então guardamos o código de indicação no metadata do usuário pra a informação
 * não se perder: quando essa conta entrar no jogo, o código está lá.
 *
 * Se a confirmação de e-mail estiver ligada no projeto, o signUp devolve o
 * usuário mas NÃO abre sessão. Quem chama precisa tratar isso — sem sessão não
 * dá pra reivindicar o cadastro.
 */
export async function signUpRevela(
  email: string,
  password: string,
): Promise<{ ok: boolean; sessao: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, sessao: false, error: 'Sem conexão agora.' };

  const ref = readReferral();
  const { data, error } = await sb.auth.signUp({
    email: email.trim(),
    password,
    options: ref ? { data: { referred_by_code: ref, origin: 'revela' } } : { data: { origin: 'revela' } },
  });
  if (error) return { ok: false, sessao: false, error: error.message };
  return { ok: true, sessao: Boolean(data.session) };
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  await sb?.auth.signOut();
}

/**
 * Captura o código de indicação da URL (?ref=CODIGO) e guarda pra sessão.
 * Quem chega por um link de talento leva o crédito da rede pro cadastro no jogo
 * — é o mesmo mecanismo que a vitrine do /playervip já usa.
 */
export function captureReferralFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('ref');
  const code = raw ? normalizeReferralCode(raw) : null;
  if (code) {
    try {
      sessionStorage.setItem(REF_KEY, code);
    } catch {
      /* modo privado: seguimos sem persistir */
    }
    return code;
  }
  return readReferral();
}

/**
 * Guarda o código de indicação que veio de uma página de lenda.
 *
 * Mesma chave do `?ref=` da URL: quem chega pela vitrine de um atleta e cria
 * conta depois entra pela rede dele — é o mecanismo viral que o /playervip já
 * usava, preservado aqui.
 */
export function rememberReferral(raw: string): void {
  const code = normalizeReferralCode(raw);
  if (!code) return;
  try {
    sessionStorage.setItem(REF_KEY, code);
  } catch {
    /* modo privado: segue sem persistir */
  }
}

export function readReferral(): string | null {
  try {
    return sessionStorage.getItem(REF_KEY);
  } catch {
    return null;
  }
}

/** Link de cadastro no jogo, já creditando a rede quando houver código. */
export function signupUrl(): string {
  const code = readReferral();
  return code ? `${GAME_URL}/cadastro/${code}` : `${GAME_URL}/cadastro`;
}
