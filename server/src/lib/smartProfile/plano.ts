/**
 * CONFERÊNCIA DO PLANO (Fase 3) — o motor da Partida Rápida para de receber
 * atributo de fora.
 *
 * Até aqui o celular mandava, para cada titular, os números que decidem a
 * partida (finalizacao, passe, marcacao, …) e o servidor repassava o corpo
 * INTACTO ao Python. Quem mexesse no pedido jogava com o atributo que quisesse,
 * sem precisar tocar no elenco salvo — e nada registrava.
 *
 * Agora cada número é conferido contra a FICHA do jogador (`player_profiles`).
 *
 * Por que CONFERIR e não ESCREVER: o valor que vai ao motor não é o atributo
 * cru da ficha. O jogo soma, antes de enviar, três tilts pequenos
 * (src/match/quickPlanClient.ts): behavior (±3), moral (±5 na confiança) e o
 * boost passivo de lenda (até +8 por categoria). O behavior está no elenco, mas
 * a moral e a ativação da lenda vivem no celular. Se o servidor reconstruísse
 * os três e errasse um, mudaria o resultado de TODA partida honesta. Então ele
 * não escreve o número: confere se cabe no envelope legal desses tilts e corta
 * o que passa.
 *
 * Resultado: partida honesta sai idêntica, byte por byte. O que excede o teto
 * desce ao teto e fica registrado na custódia do plano — e o relato do fim da
 * partida que citar esse plano sai `suspeita`.
 *
 * O que a Fase 3B ainda tem para fechar: a fadiga e a força do time
 * (`strength`) continuam vindo do celular, e só quem tem ficha é conferido.
 */
import type { Atributos } from './tipos.js';

/** O mínimo que a conferência precisa saber de uma ficha. */
export interface FichaDoMotor {
  atributos: Atributos;
}

/** Campo do payload do motor → atributo da ficha. */
const CAMPOS: Array<readonly [string, keyof Atributos]> = [
  ['finalizacao', 'finalizacao'],
  ['passe', 'passe'],
  ['marcacao', 'marcacao'],
  ['velocidade', 'velocidade'],
  ['fisico', 'fisico'],
  ['confianca', 'confianca'],
  ['drible', 'drible'],
  ['tatico', 'tatico'],
  ['mentalidade', 'mentalidade'],
  ['fair_play', 'fairPlay'],
];

/**
 * Desvio legal de cada campo sobre o valor da ficha, somando o que o jogo
 * legitimamente acrescenta antes de enviar:
 *   behaviorTilt   ofensivo / defensivo / criativo — no máximo ±3
 *   moralTilt      confiança ±5, mentalidade ±2
 *   lenda          até +8 por categoria (CAP de applyLegacyBoostToLineup)
 */
const ENVELOPE: Record<string, readonly [number, number]> = {
  finalizacao: [-2, 11], // behavior −2…+3 · lenda ATAQUE/FINALIZAÇÃO +8
  passe: [0, 11], //        behavior  0…+3 · lenda PASSE/POSSE +8
  marcacao: [-2, 11], //    behavior −2…+3 · lenda DEFESA +8
  velocidade: [0, 10], //   behavior  0…+2 · lenda VELOCIDADE +8
  confianca: [-5, 13], //   moral    −5…+5 · lenda MORAL +8
  fisico: [-1, 1], //       behavior −1…+1
  drible: [0, 3], //        behavior  0…+3
  tatico: [0, 2], //        behavior  0…+2
  mentalidade: [-2, 2], //  moral    −2…+2
  fair_play: [0, 0], //     nenhum tilt toca
};

/**
 * Folga de 1 ponto no envelope. O jogo arredonda duas vezes — uma no tilt e
 * outra no boost de lenda, que chega em porcentagem fracionária — e
 * `round(round(x) + d)` pode ficar 1 ponto longe de `round(x + d)`. Sem a
 * folga, o servidor cortaria jogada honesta.
 */
const FOLGA = 1;

const limitar = (v: number) => Math.max(1, Math.min(99, Math.round(v)));
const numero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export interface Conferencia {
  /** Titulares com ficha — os únicos que o servidor sabe conferir. */
  conferidos: number;
  /** Titulares sem ficha (adversário sintético, elenco de outro manager, visitante). */
  sem_ficha: number;
  /**
   * Titulares em que algum número ENVIADO passou do envelope e foi cortado.
   * É o único sinal de adulteração: só ele suja a custódia da partida.
   */
  corrigidos: number;
  /**
   * Titulares em que algum campo veio ausente ou não-numérico e foi preenchido
   * pela ficha. Não é adulteração — cliente antigo ou payload incompleto — mas
   * fica registrado, porque sem isso o motor leria NaN.
   */
  preenchidos: number;
  motivos: string[];
}

export const conferenciaVazia = (): Conferencia =>
  ({ conferidos: 0, sem_ficha: 0, corrigidos: 0, preenchidos: 0, motivos: [] });

/** Uma linha do payload que vai ao Python. Chaves livres: só os CAMPOS importam. */
export type LinhaDoMotor = Record<string, unknown>;

/**
 * Confere uma escalação contra as fichas e devolve a escalação já corrigida.
 *
 * Só serve para a escalação DO PRÓPRIO manager (o lado `home`, que é sempre o
 * time de quem pede). O adversário fica de fora de propósito: todo mundo tem
 * cópia dos mesmos Genesis, então o id `genesis-12` do elenco do adversário
 * casaria com a MINHA ficha do `genesis-12` e o servidor cortaria o jogador
 * dele pelos meus números.
 *
 * Jogador sem ficha passa intacto — inventar valor para ele mudaria partida
 * honesta.
 */
export function conferirEscalacao<T extends object>(
  escalacao: readonly T[],
  fichas: Map<string, FichaDoMotor>,
  conferencia: Conferencia = conferenciaVazia(),
): { escalacao: T[]; conferencia: Conferencia } {
  const saida: T[] = [];
  for (const bruta of escalacao) {
    const linha = bruta as LinhaDoMotor;
    const id = typeof linha.id === 'string' ? linha.id : '';
    const ficha = id ? fichas.get(id) : undefined;
    if (!ficha) {
      conferencia.sem_ficha++;
      saida.push(bruta);
      continue;
    }
    conferencia.conferidos++;

    let corrigido: Record<string, unknown> | null = null;
    let cortou = false;
    let preencheu = false;
    for (const [campo, atributo] of CAMPOS) {
      const base = numero(ficha.atributos?.[atributo]);
      if (base === null) continue; // ficha sem o atributo: nada a comparar
      const [min, max] = ENVELOPE[campo]!;
      // Campo sem tilt nenhum não tem delta para arredondar: vale a ficha exata.
      const folga = min === 0 && max === 0 ? 0 : FOLGA;
      const piso = Math.max(1, limitar(base + min) - folga);
      const teto = Math.min(99, limitar(base + max) + folga);

      const enviado = numero(linha[campo]);
      if (enviado === null) {
        // Ausente ou não-numérico: o motor leria NaN. Vale o da ficha, e isso
        // NÃO é adulteração — não entra na conta de `corrigidos`.
        preencheu = true;
        corrigido ??= { ...linha };
        corrigido[campo] = limitar(base);
        continue;
      }
      const valor = Math.min(teto, Math.max(piso, Math.round(enviado)));
      if (valor === Math.round(enviado)) continue;

      cortou = true;
      corrigido ??= { ...linha };
      corrigido[campo] = valor;
      if (conferencia.motivos.length < 20) {
        conferencia.motivos.push(`${id}.${campo}: ${enviado} fora de [${piso}, ${teto}] (ficha ${Math.round(base)}) → ${valor}`);
      }
    }

    if (cortou) conferencia.corrigidos++;
    if (preencheu) conferencia.preenchidos++;
    saida.push(corrigido ? (corrigido as T) : bruta);
  }
  return { escalacao: saida, conferencia };
}

/**
 * Impressão dos números que vão ao motor — entra na chave do cache.
 *
 * A chave só olhava seed, ids, força e intensidade. Dois pedidos com a MESMA
 * escalação e atributos diferentes colidiam: o primeiro plano era servido ao
 * segundo. Isso tinha dois efeitos ruins — ativar a lenda não mudava nada
 * dentro da janela do cache (mesmos ids, mesmo plano), e um pedido adulterado
 * deixava o plano dele no cache para o próximo. Com a impressão na chave, cada
 * conjunto de números tem o seu plano.
 */
export function impressaoDaEscalacao(escalacoes: readonly (readonly object[])[]): string {
  let h = 0x811c9dc5;
  const comer = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  };
  for (const escalacao of escalacoes) {
    for (const bruta of escalacao) {
      const linha = bruta as LinhaDoMotor;
      for (const [campo] of CAMPOS) comer(`${campo}:${String(linha[campo] ?? '')}|`);
      comer(`fatigue:${String(linha.fatigue ?? '')}|role:${String(linha.role ?? '')}|`);
    }
    comer('#');
  }
  return (h >>> 0).toString(36);
}
