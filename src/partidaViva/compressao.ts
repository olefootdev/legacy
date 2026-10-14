/**
 * PARTIDA VIVA — a COMPRESSÃO dos lances de baixa tensão ("comprime!", fundador 14/10).
 *
 * Critério do plano (docs/raio-x-partida-viva.html): partida no modo Lances em até
 * 4 min de tela. Medido em 13/10: 6min13s, e 3min19s disso eram ~39 lances
 * encenados por inteiro — a maioria construção, escanteio que não deu em nada e
 * chute fraco. O raio-x já dizia: "o campo toca todas as posses, comprimindo as de
 * baixa tensão".
 *
 * ALTA TENSÃO (encenada inteira, como sempre): gol, pênalti, trave, contra-ataque,
 * lance de peso alto, e chute/chance/defesa de chute perigoso (xG ≥ 0,20).
 * BAIXA TENSÃO (comprimida): o resto — o campo mostra o FINAL da jogada (as duas
 * últimas ações, como um corte de transmissão) e a bola parada é rápida.
 *
 * Só visual: o lance, o autor, o desfecho e o placar são os mesmos (o placar nem
 * passa por aqui). Determinístico — o filme grava o lance já comprimido.
 */
import type { AcaoDeLance, MatchPlanEvent } from '@/match/quickPlanTypes';

const SEMPRE_ALTA = new Set(['goal', 'penalty', 'woodwork', 'counter']);
/** xG a partir do qual um chute é perigoso (encena inteiro). */
export const XG_DE_ALTA_TENSAO = 0.2;

export function altaTensao(ev: Pick<MatchPlanEvent, 'kind' | 'weight_tier' | 'xg'>): boolean {
  const base = ev.kind.replace(/_(home|away)$/, '');
  if (SEMPRE_ALTA.has(base)) return true;
  if (ev.weight_tier === 'big' || ev.weight_tier === 'epic') return true;
  // Chute, chance e DEFESA só são alta tensão quando o chute era perigoso.
  return (base === 'shot' || base === 'chance' || base === 'save') && (ev.xg ?? 0) >= XG_DE_ALTA_TENSAO;
}

/**
 * De onde o corte começa: as duas últimas ações — mas nunca numa falta nem logo
 * depois dela (o faltoso viraria o dono da bola; a cobrança precisa da falta pra
 * saber que é bola parada). Jogada de falta fica inteira.
 */
export function inicioDoCorte(acoes: readonly AcaoDeLance[]): number {
  if (acoes.length <= 2) return 0;
  let s = acoes.length - 2;
  while (s > 0 && (acoes[s]!.t === 'falta' || acoes[s - 1]!.t === 'falta')) s--;
  return s;
}

/** O lance como o campo mostra: inteiro (alta tensão) ou comprimido (baixa). */
export function comprimirLance<E extends MatchPlanEvent>(ev: E): E {
  const cad = ev.cadeia;
  if (!cad?.acoes.length || cad.compacta || altaTensao(ev)) return ev;
  const s = inicioDoCorte(cad.acoes);
  const antes = s > 0 ? cad.acoes[s - 1]! : null;
  return {
    ...ev,
    cadeia: { ...cad, compacta: true, acoes: cad.acoes.slice(s), inicio: antes ? { x: antes.x, z: antes.z } : cad.inicio },
  };
}

export function comprimirEventos<E extends MatchPlanEvent>(evs: readonly E[]): E[] {
  return evs.map(comprimirLance);
}
