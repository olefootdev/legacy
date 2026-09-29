/**
 * O último convite de expansão que a pessoa ABRIU e ainda não confirmou.
 *
 * 🔴 Por que existe: desde 2026-09-29 quem compra um pack entra na árvore
 * sozinho, sob quem o indicou no cadastro ou sob a ORIGEM. E a posição é
 * PERMANENTE. Se a pessoa abriu o convite de alguém, não confirmou e foi
 * comprar, ela entraria debaixo de outro — e quem convidou perderia o indicado
 * pra sempre, sem ninguém ter escolhido isso.
 *
 * Então a tela de compra pergunta antes. Este módulo só lembra qual convite
 * perguntar; a decisão continua sendo da pessoa.
 *
 * `localStorage` e não `sessionStorage`: o convite costuma ser aberto num dia
 * e a compra feita em outro. Guarda só o @ de quem convidou, que é público.
 */
const CHAVE = 'olefoot.convite.visto';

export function lembrarConviteVisto(username: string): void {
  try { localStorage.setItem(CHAVE, username.trim().toLowerCase()); }
  catch { /* storage bloqueado: a compra segue sem a pergunta */ }
}

export function conviteVisto(): string | null {
  try { return localStorage.getItem(CHAVE); } catch { return null; }
}

export function esquecerConviteVisto(): void {
  try { localStorage.removeItem(CHAVE); } catch { /* idem */ }
}
