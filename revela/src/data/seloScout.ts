/**
 * O SELO DO OLE SCOUT — a marca que diz "um humano olhou esta ficha".
 *
 * ── DUAS CONDIÇÕES, E AS DUAS PRECISAM ──────────────────────────────────────
 *   • RATING ASSINADO  (`ratingSource === 'scout'`) — alguém abriu, conferiu os
 *     dez atributos e botou o nome. É o que `revela_admin_review_talent` carimba.
 *   • FICHA COMPLETA   (6 de 6 em `completude.ts`) — foto, vídeo, história,
 *     Instagram, pé dominante e idade.
 *
 * Sozinha, nenhuma vale: rating sem ficha completa é olheiro avaliando no
 * escuro; ficha completa sem rating é formulário bem preenchido. O selo é o
 * encontro dos dois — e é por isso que ele é raro o bastante pra significar
 * alguma coisa quando aparece na vitrine.
 *
 * ── POR QUE ISSO NÃO PODE SER "TEM OVR" ─────────────────────────────────────
 * Era assim, e virou mentira no dia do SCOUT autônomo: todo cadastro passou a
 * nascer com `overall`, então qualquer regra baseada nele carimba a base
 * inteira. Foi exatamente o que aconteceu com o chip "Avaliado" da vitrine e
 * com o selo do perfil. `ratingSource` é o único campo que distingue.
 *
 * Ausência de `ratingSource` = ficha anterior à migration, e aquelas foram
 * avaliadas por gente de verdade — por isso o padrão é 'scout'.
 */
import { completudePct, computeCompletude } from './completude';
import type { Talent } from './types';

export interface EstadoSelo {
  /** Tem o selo: rating assinado E ficha completa. */
  tem: boolean;
  assinado: boolean;
  completude: number;
  /** O que falta, em uma frase. Null quando já tem. */
  falta: string | null;
}

export function estadoDoSelo(t: Talent): EstadoSelo {
  const assinado = (t.ratingSource ?? 'scout') === 'scout' && t.overall != null;
  const completude = completudePct(computeCompletude(t));
  const tem = assinado && completude === 100;

  let falta: string | null = null;
  if (!tem) {
    if (!assinado && completude < 100) falta = 'Falta completar a ficha e o aval do olheiro';
    else if (!assinado) falta = 'Ficha completa. Falta o aval do olheiro';
    else falta = 'Avaliado. Falta completar a ficha';
  }

  return { tem, assinado, completude, falta };
}
