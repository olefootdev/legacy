/**
 * Uma lenda é uma PESSOA, não uma carta.
 *
 * `legacy_players` guarda uma linha por FASE de carreira: Palhinha 93, Palhinha
 * 97 e Palhinha 92 são três cartas do mesmo homem, com OVR e clube diferentes.
 * Dentro do jogo isso está certo — são três itens colecionáveis distintos.
 *
 * No REVELA está errado. A seção promete "reconheça quem fez história", e quem
 * fez história é o Palhinha, uma vez. Mostrar as três cartas lado a lado
 * transforma um hall de lendas numa prateleira de SKU, e ainda empurra os outros
 * atletas pra fora da grade: 25 cartas de 11 pessoas significa que, mostrando 12,
 * metade do elenco de lendas nunca aparece.
 *
 * Então aqui a gente agrupa por atleta e mostra a melhor fase, dizendo quantas
 * outras existem. O catálogo completo continua no jogo e no /playervip.
 */
import type { Legend } from './types';

export interface AthleteLegend extends Legend {
  /** Identificador do atleta na URL: /lenda/<slug>. */
  slug: string;
  /** Quantas cartas (fases de carreira) este atleta tem no catálogo. */
  phases: number;
  /** OVR da fase mais baixa — junto com o `overall`, dá a amplitude da carreira. */
  lowestOverall: number | null;
}

/**
 * Chave do atleta.
 *
 * `handle` do /playervip é o identificador bom: cartas do mesmo atleta
 * compartilham a coleção, e a coleção resolve pro mesmo handle. Só que nem toda
 * lenda tem vitrine (hoje 5 de 25 não têm), então cai pro primeiro nome.
 *
 * O sufixo é a fase: número de ano ("Palhinha 93", "Goncalves98" — este último
 * sem espaço) ou sigla de clube ("Adauto SLV", "Nem PR"). Tirar o primeiro token
 * e limpar dígitos no fim cobre os dois formatos.
 */
export function athleteSlug(l: Legend): string {
  const handle = l.handle?.trim().toLowerCase();
  if (handle) return handle;

  const first = l.name.trim().split(/\s+/)[0] ?? l.name;
  const clean = first
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // marcas combinantes do NFD
    .replace(/\d+$/, '')
    .toLowerCase();
  return clean || l.name.toLowerCase();
}

/**
 * Todas as cartas de cada atleta, indexadas pelo slug que vai na URL.
 *
 * A grade da home só precisa da melhor fase; a página do atleta precisa de
 * TODAS — é o acervo dele. Uma função só monta os dois, pra não existirem duas
 * definições de "quem é o mesmo atleta" divergindo com o tempo.
 */
export function groupByAthlete(legends: Legend[]): Map<string, Legend[]> {
  const groups = new Map<string, Legend[]>();
  for (const l of legends) {
    const k = athleteSlug(l);
    const g = groups.get(k);
    if (g) g.push(l);
    else groups.set(k, [l]);
  }
  // Melhor fase primeiro dentro de cada atleta.
  for (const cards of groups.values()) cards.sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));
  return groups;
}

/**
 * Uma REVELAÇÃO não é uma lenda — ela vive do outro lado da página.
 *
 * O catálogo marca isso sozinho: `rarity = 'revelacao'` é a etiqueta de quem
 * ainda está começando. Hoje é só o Breno Liborge (20 anos, lateral do Água
 * Santa, um card só), e o próprio briefing dele diz por quê: "as outras lendas
 * têm 3 fases porque a carreira já aconteceu; o Breno está no começo".
 *
 * Pôr um lateral de 2024 ao lado do Palhinha bicampeão do mundo não homenageia
 * nenhum dos dois. Quem tem `rarity = 'revelacao'` sai da grade de LENDAS e
 * entra na vitrine de talentos, via `revela_talents` com `card_legacy_id`
 * apontando pra carta dele. Regra estrutural, não lista de nomes: a próxima
 * revelação tokenizada cai do lado certo sem ninguém tocar em código.
 */
export function isLegend(l: Legend): boolean {
  return l.rarity !== 'revelacao';
}

/** Um card por atleta: a melhor fase na frente, as outras contadas. */
export function byAthlete(legends: Legend[]): AthleteLegend[] {
  const out: AthleteLegend[] = [];
  for (const [slug, ranked] of groupByAthlete(legends)) {
    const best = ranked[0];
    const lowest = ranked[ranked.length - 1]?.overall ?? null;
    out.push({
      ...best,
      slug,
      phases: ranked.length,
      // Sem outra fase não há amplitude pra mostrar — evita "95 → 95".
      lowestOverall: ranked.length > 1 ? lowest : null,
    });
  }

  return out.sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));
}
