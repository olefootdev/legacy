/**
 * Rateio da colheita do Vault (A VIRADA · V1).
 *
 * A régua fechada pelo fundador: 50 depositante / 10 MyClub / 5 Manager /
 * 5 Capitão / 5 Pro / 25 OLEFOOT. Soma 100 — a versão anterior somava 110, e é
 * por isso que a soma é conferida em tempo de carga aqui embaixo, não num
 * comentário.
 *
 * O PROBLEMA QUE ESTE ARQUIVO EXISTE PRA RESOLVER. Medido em produção em
 * 2026-09-22: a árvore de indicação tem UM nível de profundidade. 78 perfis,
 * 16 com código de indicador, 11 que resolvem; nível 2 e nível 3: zero pessoas,
 * zero. Ou seja, hoje, para todo mundo, as fatias de Manager e Capitão não têm
 * a quem pagar — e para 67 dos 78, MyClub também não. Somando o Pro, que ainda
 * é papel indefinido, 15% a 25% de cada colheita não tem endereço.
 *
 * Fatia sem dono é exatamente por onde dinheiro vaza em silêncio. Aqui ela é
 * uma DECISÃO NOMEADA (`PoliticaVaga`), sempre reportada linha a linha, e o
 * padrão é `reinvestir`: o valor não sai do livro, sobe o NAV de todos os
 * cotistas pro rata. Ninguém é enriquecido por sorteio, nada some, e a resposta
 * pra "cadê os 20%?" é "continua seu, na pool".
 *
 * Puro: bigint na menor unidade, sem float, sem banco.
 */

import type { Unidades } from './vaultBook.js';

export type IdFatia = 'voce' | 'myclub' | 'manager' | 'captain' | 'pro' | 'olefoot';

export type Papel =
  | 'depositante'
  | 'nivel1'
  | 'nivel2'
  | 'nivel3'
  | 'indefinido'
  | 'casa';

export interface Fatia {
  readonly id: IdFatia;
  readonly bps: number;
  readonly papel: Papel;
  readonly rotulo: string;
}

/** Ordem declarada: também é o desempate do resto do arredondamento. */
export const FATIAS: readonly Fatia[] = [
  { id: 'voce',    bps: 5000, papel: 'depositante', rotulo: 'Você' },
  { id: 'myclub',  bps: 1000, papel: 'nivel1',      rotulo: 'MyClub' },
  { id: 'manager', bps:  500, papel: 'nivel2',      rotulo: 'Manager' },
  { id: 'captain', bps:  500, papel: 'nivel3',      rotulo: 'Capitão' },
  { id: 'pro',     bps:  500, papel: 'indefinido',  rotulo: 'Pro' },
  { id: 'olefoot', bps: 2500, papel: 'casa',        rotulo: 'OLEFOOT' },
] as const;

export const BPS_TOTAL = 10_000;

// Não é comentário, é checagem: 110% já aconteceu uma vez.
{
  const soma = FATIAS.reduce((s, f) => s + f.bps, 0);
  if (soma !== BPS_TOTAL) {
    throw new Error(`rateio não soma 100%: ${soma} bps em ${FATIAS.length} fatias`);
  }
}

/** O que fazer com a fatia de um papel que hoje não tem ninguém. */
export type PoliticaVaga =
  /** Não sai do livro: vira patrimônio e sobe o NAV de todos os cotistas. */
  | 'reinvestir'
  /** Volta pro depositante: sem rede, você fica com mais. */
  | 'depositante'
  /** Fica com a casa. Nomeado de propósito: é o que mais parece vazamento. */
  | 'casa';

export const POLITICA_VAGA_PADRAO: PoliticaVaga = 'reinvestir';

export interface Rede {
  /** Quem depositou. Obrigatório. */
  readonly depositante: string;
  /** Tesouraria da OLEFOOT. Obrigatório. */
  readonly casa: string;
  /**
   * Ancestrais na árvore, do mais próximo pro mais distante:
   * [0] = nível 1 (MyClub), [1] = nível 2 (Manager), [2] = nível 3 (Capitão).
   * Lista curta é o caso normal hoje, não erro.
   */
  readonly ancestrais: readonly string[];
  /**
   * Quem ocupa o papel "Pro". Enquanto o fundador não definir o que é Pro, isto
   * fica `undefined` e a fatia cai na política de vaga — nunca na casa por
   * omissão.
   */
  readonly pro?: string;
}

export interface Pagamento {
  readonly fatia: IdFatia;
  readonly papel: Papel;
  readonly rotulo: string;
  readonly destino: string;
  readonly unidades: Unidades;
}

export interface Vaga {
  readonly fatia: IdFatia;
  readonly papel: Papel;
  readonly rotulo: string;
  readonly unidades: Unidades;
  readonly motivo: string;
}

export interface Rateio {
  readonly pagamentos: readonly Pagamento[];
  /** As fatias sem dono, com o valor que teriam recebido. Para o extrato. */
  readonly vagas: readonly Vaga[];
  /** Total que ficou no livro por falta de dono (política `reinvestir`). */
  readonly reinvestido: Unidades;
  readonly colheita: Unidades;
}

function destinoDe(fatia: Fatia, rede: Rede): { destino?: string; motivo?: string } {
  switch (fatia.papel) {
    case 'depositante':
      return { destino: rede.depositante };
    case 'casa':
      return { destino: rede.casa };
    case 'nivel1':
    case 'nivel2':
    case 'nivel3': {
      const profundidade = fatia.papel === 'nivel1' ? 0 : fatia.papel === 'nivel2' ? 1 : 2;
      const quem = rede.ancestrais[profundidade];
      return quem ? { destino: quem } : { motivo: `sem ancestral de nível ${profundidade + 1}` };
    }
    case 'indefinido':
      return rede.pro ? { destino: rede.pro } : { motivo: 'papel Pro ainda não definido' };
  }
}

/**
 * Parte exata: método do maior resto. `colheita * bps / 10000` trunca, então
 * sobram unidades; elas vão uma a uma pras fatias de maior resto, desempatando
 * pela ordem declarada em FATIAS. Determinístico, e a soma bate na unidade.
 */
function fatiarExato(colheita: Unidades): Map<IdFatia, Unidades> {
  const bruto = FATIAS.map((f) => {
    const produto = colheita * BigInt(f.bps);
    return { id: f.id, base: produto / BigInt(BPS_TOTAL), resto: produto % BigInt(BPS_TOTAL) };
  });

  let sobra = colheita - bruto.reduce((s, b) => s + b.base, 0n);

  const porResto = bruto
    .map((b, ordem) => ({ ...b, ordem }))
    .sort((a, b) => (a.resto === b.resto ? a.ordem - b.ordem : a.resto > b.resto ? -1 : 1));

  const fatiado = new Map<IdFatia, Unidades>(bruto.map((b) => [b.id, b.base]));
  for (const cand of porResto) {
    if (sobra <= 0n) break;
    fatiado.set(cand.id, (fatiado.get(cand.id) as bigint) + 1n);
    sobra -= 1n;
  }
  return fatiado;
}

/**
 * Rateia `colheita` (menor unidade) entre as fatias. Garante, por construção:
 * soma dos pagamentos + reinvestido === colheita, sempre, sem poeira.
 */
export function ratear(
  colheita: Unidades,
  rede: Rede,
  politica: PoliticaVaga = POLITICA_VAGA_PADRAO,
): Rateio {
  if (colheita < 0n) throw new RangeError(`colheita negativa: ${colheita}`);
  if (!rede.depositante) throw new Error('rateio sem depositante');
  if (!rede.casa) throw new Error('rateio sem tesouraria da casa');

  const fatiado = fatiarExato(colheita);
  const pago = new Map<string, Unidades>();
  const pagamentos: Pagamento[] = [];
  const vagas: Vaga[] = [];
  let reinvestido = 0n;

  // 1ª passada: quem tem dono recebe; quem não tem vira vaga com valor.
  for (const f of FATIAS) {
    const unidades = fatiado.get(f.id) as bigint;
    const { destino, motivo } = destinoDe(f, rede);
    if (destino) {
      pagamentos.push({ fatia: f.id, papel: f.papel, rotulo: f.rotulo, destino, unidades });
      pago.set(f.id, unidades);
    } else {
      vagas.push({ fatia: f.id, papel: f.papel, rotulo: f.rotulo, unidades, motivo: motivo ?? 'sem dono' });
    }
  }

  // 2ª passada: a política decide o destino das vagas. Uma decisão, não uma sobra.
  const totalVago = vagas.reduce((s, v) => s + v.unidades, 0n);
  if (totalVago > 0n) {
    if (politica === 'reinvestir') {
      reinvestido = totalVago;
    } else {
      const alvo: Papel = politica === 'depositante' ? 'depositante' : 'casa';
      const i = pagamentos.findIndex((p) => p.papel === alvo);
      if (i < 0) throw new Error(`política "${politica}" sem fatia de destino no rateio`);
      const antes = pagamentos[i] as Pagamento;
      pagamentos[i] = { ...antes, unidades: antes.unidades + totalVago };
    }
  }

  const conferencia = pagamentos.reduce((s, p) => s + p.unidades, 0n) + reinvestido;
  if (conferencia !== colheita) {
    throw new Error(`rateio não fecha: ${conferencia} distribuído de ${colheita} colhido`);
  }

  return { pagamentos, vagas, reinvestido, colheita };
}
