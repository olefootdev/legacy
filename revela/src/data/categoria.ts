/**
 * CATEGORIA × IDADE — o buraco mais real que o SCOUT autônomo deixou aberto.
 *
 * ── O QUE ESTAVA ERRADO ─────────────────────────────────────────────────────
 * A categoria define a BASE do rating automático: `profissional` vale 62,
 * `sub15` vale 46. E ninguém conferia se a categoria fazia sentido com a idade.
 *
 * Nos dois sentidos:
 *   • Um moleque de 14 anos se declara `profissional` e ganha 16 pontos de base
 *     sem ninguém olhar. Com o SCOUT autônomo, isso entra no ar sozinho.
 *   • O Juan estava `sub15` nascido em 1999 — 27 anos. Aí é o contrário: a ficha
 *     nasce afundada porque o campo ficou de um teste antigo.
 *
 * ── DUAS CAMADAS, DE PROPÓSITO ──────────────────────────────────────────────
 *  1. AQUI, no formulário: a categoria impossível nem aparece pra escolher.
 *     É a camada gentil — o atleta não erra porque a opção não existe.
 *  2. NO BANCO (`revela_rating_inicial`): teto de base por idade, aplicado
 *     SEMPRE. É a camada que vale mesmo quando alguém edita a linha por fora,
 *     importa dado antigo, ou muda a categoria no painel.
 *
 * A primeira sozinha não protege nada — validação de formulário é sugestão. A
 * segunda sozinha frustra sem explicar. Juntas, o caminho certo é o mais fácil.
 *
 * ── AS FAIXAS SÃO FOLGADAS DE PROPÓSITO ─────────────────────────────────────
 * Categoria de base vira no meio do ano e time pequeno inscreve moleque fora da
 * idade o tempo todo. Então o corte não é o nome da categoria: `sub15` aceita
 * até 16, `sub20` até 21. O objetivo é barrar o ABSURDO — 14 anos jogando como
 * profissional, 27 anos jogando como sub-15 — não policiar a borda.
 */
import { CATEGORIAS } from './posicoes';

export interface CategoriaDisponivel {
  code: string;
  nome: string;
}

/** Faixa aceita por categoria. `null` = sem limite daquele lado. */
const FAIXA: Record<string, { min: number | null; max: number | null }> = {
  sub15: { min: null, max: 16 },
  sub20: { min: null, max: 21 },
  // Amador é o coringa: qualquer idade de quem joga sem contrato.
  amador: { min: 13, max: null },
  // 15 é o piso do contrato profissional no futebol brasileiro na prática.
  profissional: { min: 15, max: null },
  // "Legend" aqui é ex-atleta, não idoso — mas ninguém encerra carreira aos 20.
  legend: { min: 25, max: null },
};

export function categoriaCabeNaIdade(code: string, idade: number | null): boolean {
  // Sem idade, tudo passa: quem não informou o ano não pode ser barrado por ele.
  if (idade == null || !Number.isFinite(idade)) return true;
  const f = FAIXA[code];
  if (!f) return true;
  if (f.min != null && idade < f.min) return false;
  if (f.max != null && idade > f.max) return false;
  return true;
}

/** As categorias que fazem sentido pra essa idade. Nunca devolve vazio. */
export function categoriasPara(idade: number | null): CategoriaDisponivel[] {
  const cabem = CATEGORIAS.filter((c) => categoriaCabeNaIdade(c.code, idade));
  // Rede: idade estranha (digitou 1900) não pode deixar o atleta sem opção
  // nenhuma e travar o cadastro. Melhor mostrar tudo do que mostrar nada.
  return cabem.length > 0 ? cabem.map((c) => ({ code: c.code, nome: c.nome })) : CATEGORIAS.map((c) => ({ code: c.code, nome: c.nome }));
}

/**
 * O TETO DE BASE POR IDADE — espelho da regra que roda no banco.
 *
 * ⚠️ ESPELHO de `revela_rating_inicial` (migration 20260807…). Se mudar aqui,
 * mude lá: este número está no caminho do OVR, que move o mercado. O self-test
 * `npm run test:revela-categoria` compara os dois lados.
 *
 * Não é punição: é o reconhecimento de que declarar categoria não é a mesma
 * coisa que ter idade pra ela. O olheiro pode passar por cima — ficha assinada
 * por humano (`rating_source = 'scout'`) não passa por esta função.
 */
export function tetoDeBasePorIdade(idade: number | null): number | null {
  if (idade == null || !Number.isFinite(idade)) return null;
  if (idade <= 13) return 46;
  if (idade <= 15) return 50;
  if (idade <= 17) return 56;
  return null;
}
