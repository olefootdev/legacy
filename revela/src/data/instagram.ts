/**
 * O @ do atleta — do texto livre que ele digitou até um link seguro.
 *
 * ── POR QUE ISTO NÃO É UM `trim()` ──────────────────────────────────────────
 * O campo do cadastro é livre, e o banco prova: hoje existem `@imjonhnes`,
 * `@zzteste` e um `Diadema` — alguém digitou a CIDADE no campo do Instagram.
 * Amanhã vai ter `instagram.com/fulano`, `https://www.instagram.com/fulano/`,
 * `www.instagram.com/fulano?igshid=...` e espaço no meio.
 *
 * ── A REGRA DE SEGURANÇA ────────────────────────────────────────────────────
 * O valor NUNCA vira href diretamente. O link é MONTADO a partir de um handle
 * que passou por uma lista branca de caracteres — se a string original fosse
 * usada como href, um `javascript:` gravado no cadastro viraria código rodando
 * na página do atleta. Montar em vez de confiar torna essa classe de ataque
 * impossível por construção, não por validação.
 *
 * A régua do handle é a do próprio Instagram: letras, números, ponto e
 * sublinhado, até 30 caracteres.
 */

const HANDLE_VALIDO = /^[A-Za-z0-9._]{1,30}$/;

export interface PerfilInstagram {
  /** Como se escreve: `@fulano`. */
  handle: string;
  /** Para onde se vai — montado por nós, nunca o que veio do cadastro. */
  url: string;
}

/**
 * Devolve `null` quando não dá pra extrair um handle plausível. Null é a
 * resposta certa aqui: melhor não mostrar botão nenhum do que mandar a torcida
 * pra um perfil que não existe.
 */
export function perfilInstagram(bruto: string | null | undefined): PerfilInstagram | null {
  if (!bruto) return null;

  let s = bruto.trim();
  if (!s) return null;

  // Tira o endereço, com ou sem protocolo, com ou sem www.
  s = s.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  if (/^instagram\.com\//i.test(s)) s = s.slice('instagram.com/'.length);

  // Tira query, âncora, barra final e o arroba.
  s = s.split(/[?#]/)[0] ?? '';
  s = s.replace(/\/+$/, '').replace(/^@+/, '');

  // Sobrou caminho? Não é perfil (é post, reel, tag...). Fora.
  if (s.includes('/')) return null;
  if (!HANDLE_VALIDO.test(s)) return null;

  return { handle: `@${s}`, url: `https://instagram.com/${s}` };
}
