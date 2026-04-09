/**
 * Seed de narração — banco de templates por situação.
 * Cada template usa placeholders: {{from}}, {{to}}, {{team}}, {{keeper}}.
 * `pickLine` escolhe por peso, preenche e devolve uma linha única pronta para o feed.
 */

export interface NarrationEntry {
  situation: string;
  template: string;
  tags: string[];
  weight: number;
}

export const NARRATION_SEED: NarrationEntry[] = [
  {
    situation: 'kickoff',
    template: 'Bola rolando — {{team}} coloca o jogo em movimento no apito inicial.',
    tags: ['pt-BR', 'radio'],
    weight: 10,
  },
  {
    situation: 'pass_short',
    template: '{{from}} toca curto e seguro para {{to}} no compasso do {{team}}.',
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'pass_long',
    template: '{{from}} abre o jogo em profundidade na direção de {{to}}.',
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'pass_missed',
    template: '{{from}} erra o passe; a bola sobra limpa para o adversário.',
    tags: ['pt-BR', 'radio'],
    weight: 8,
  },
  {
    situation: 'interception',
    template: '{{from}} lê o passe, intercepta e mata a jogada de ataque.',
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'tackle_clean',
    template: '{{from}} desarma com limpeza, fica com a bola e acelera o {{team}}.',
    tags: ['pt-BR', 'radio'],
    weight: 10,
  },
  {
    situation: 'tackle_hard',
    template: '{{from}} chega forte em {{to}} e derruba o lance; o estádio reage.',
    tags: ['pt-BR', 'radio'],
    weight: 8,
  },
  {
    situation: 'foul_soft',
    template: '{{from}} comete falta leve em {{to}}; o árbitro para o jogo.',
    tags: ['pt-BR', 'radio'],
    weight: 7,
  },
  {
    situation: 'foul_hard',
    template: 'Entrada dura de {{from}} em {{to}}; o árbitro apita e corta o ritmo.',
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'advantage_play',
    template: 'O árbitro deixa seguir: vantagem clara para o {{team}}.',
    tags: ['pt-BR', 'radio'],
    weight: 8,
  },
  {
    situation: 'shot_out',
    template: '{{from}} finaliza com convicção, mas a bola passa longe da baliza.',
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'shot_blocked',
    template: '{{from}} solta o remate e um defensor fecha o caminho na hora H.',
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'shot_save',
    template: '{{from}} bate com intenção e {{keeper}} fecha o ângulo com defesa segura.',
    tags: ['pt-BR', 'radio'],
    weight: 10,
  },
  {
    situation: 'shot_strong',
    template: '{{from}} enche o pé; o remate vibra na defesa e assusta o estádio.',
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'goal_simple',
    template: 'GOL! {{from}} empurra para a rede e coloca o {{team}} na frente do placar.',
    tags: ['pt-BR', 'radio'],
    weight: 10,
  },
  {
    situation: 'goal_beautiful',
    template: 'GOLAÇO! {{from}} pinta o lance e explode o {{team}} na comemoração.',
    tags: ['pt-BR', 'radio'],
    weight: 10,
  },
  {
    situation: 'goal_header',
    template: 'GOL DE CABEÇA! {{from}} sobe mais alto que a marcação e manda para a rede.',
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'goal_rebound',
    template: 'GOL NO REBOTE! {{from}} aproveita a sobra fria dentro da área.',
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'counter_attack',
    template: '{{team}} dispara o contra-ataque em três toques e leva perigo na área.',
    tags: ['pt-BR', 'radio'],
    weight: 10,
  },
  {
    situation: 'build_up',
    template: '{{team}} troca passes na intermediária e tenta puxar o bloco adversário.',
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'wing_play',
    template: '{{from}} ganha a linha, ganha velocidade e manda o cruzamento na medida.',
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'cross_cut',
    template: '{{to}} antecipa e corta o cruzamento de {{from}} antes da conclusão.',
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'cross_header',
    template: '{{from}} levanta na área e {{to}} sobe livre para cabecear com veneno.',
    tags: ['pt-BR', 'radio'],
    weight: 10,
  },
  {
    situation: 'dribble_success',
    template: '{{from}} engana {{to}} na condução, entra no espaço e deixa o estádio em pé.',
    tags: ['pt-BR', 'radio'],
    weight: 10,
  },
  {
    situation: 'dribble_fail',
    template: '{{from}} tenta o drible cerrado e {{to}} fecha a porta sem falta.',
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'clearance',
    template: 'A zaga afasta com o pé levantado e tira o perigo da pequena área.',
    tags: ['pt-BR', 'radio'],
    weight: 10,
  },
  {
    situation: 'keeper_catch',
    template: '{{keeper}} sai do gol, segura firme no alto e acalma o jogo.',
    tags: ['pt-BR', 'radio'],
    weight: 10,
  },
  {
    situation: 'keeper_punch',
    template: '{{keeper}} soca para longe num lance aéreo tenso; sobra viva na área.',
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'throw_in',
    template: 'Arremesso lateral para o {{team}} na faixa ofensiva.',
    tags: ['pt-BR', 'radio'],
    weight: 8,
  },
  {
    situation: 'corner_kick',
    template: 'Escanteio perigoso para o {{team}}; a área fica pequena demais.',
    tags: ['pt-BR', 'radio'],
    weight: 10,
  },
  {
    situation: 'corner_clear',
    template: 'A defesa sobe na primeira bola e afasta o escanteio sem drama.',
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'free_kick',
    template: 'Falta frontal para o {{team}}; a barreira respira fundo.',
    tags: ['pt-BR', 'radio'],
    weight: 10,
  },
  {
    situation: 'free_kick_shot',
    template: '{{from}} cobra direto, a bola desvia na barreira e ainda assusta.',
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'offside',
    template: 'Bandeira no ar: impedimento marcado e jogada anulada.',
    tags: ['pt-BR', 'radio'],
    weight: 10,
  },
  {
    situation: 'possession_switch',
    template: 'A posse troca de lado num piscar de olhos no meio-campo.',
    tags: ['pt-BR', 'radio'],
    weight: 8,
  },
  {
    situation: 'midfield_duel',
    template: '{{from}} e {{to}} travam duelo físico no miolo; ninguém cede terreno.',
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'pressure_high',
    template: '{{team}} sobe a pressão, rouba metros e força o erro na saída.',
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'pressure_low',
    template: '{{team}} recua o bloco, fecha o corredor central e espera o erro.',
    tags: ['pt-BR', 'radio'],
    weight: 8,
  },
  {
    situation: 'long_shot',
    template: '{{from}} arrisca de fora da área; a bola raspa a trave e o estádio segura o grito.',
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'miss_big_chance',
    template: '{{from}} fica cara a cara e manda por cima; chance limpa desperdiçada.',
    tags: ['pt-BR', 'radio'],
    weight: 10,
  },
  {
    situation: 'crowd_reaction',
    template: 'A torcida empurra o {{team}} e o estádio vira caldeirão por um instante.',
    tags: ['pt-BR', 'radio'],
    weight: 8,
  },
  {
    situation: 'game_pause',
    template: 'O jogo segura o ritmo: atendimento em campo e conversa com o árbitro.',
    tags: ['pt-BR', 'radio'],
    weight: 7,
  },
  {
    situation: 'restart_play',
    template: 'Árbitro autoriza: bola em jogo de novo e o relógio volta a correr.',
    tags: ['pt-BR', 'radio'],
    weight: 8,
  },
];

// ── Preenchimento + Seleção ─────────────────────────────

export interface PickLineParams {
  min: number;
  from?: string;
  to?: string;
  team?: string;
  keeper?: string;
}

function fillTemplate(
  template: string,
  p: PickLineParams,
): string {
  return template
    .replace(/\{\{from\}\}/g, p.from ?? '')
    .replace(/\{\{to\}\}/g, p.to ?? '')
    .replace(/\{\{team\}\}/g, p.team ?? '')
    .replace(/\{\{keeper\}\}/g, p.keeper ?? 'o guarda-redes');
}

/**
 * Seleciona um template por situação(ões), pondera por weight, preenche placeholders
 * e devolve a linha pronta com prefixo de minuto. Retorna null se nenhum candidato
 * válido existir (permite fallback ao chamador).
 *
 * Templates que exigem {{to}} são filtrados se `to` não for fornecido.
 */
export function pickLine(
  situation: string | string[],
  params: PickLineParams,
  seed?: number,
): string | null {
  const sits = Array.isArray(situation) ? situation : [situation];
  let candidates = NARRATION_SEED.filter((s) => sits.includes(s.situation));

  if (!params.to) {
    candidates = candidates.filter((c) => !c.template.includes('{{to}}'));
  }
  if (candidates.length === 0) return null;

  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
  const r =
    seed != null
      ? Math.abs(Math.floor(seed * 9973)) % totalWeight
      : Math.floor(Math.random() * totalWeight);

  let acc = 0;
  let chosen = candidates[0]!;
  for (const c of candidates) {
    acc += c.weight;
    if (r < acc) {
      chosen = c;
      break;
    }
  }

  return `${params.min}' — ${fillTemplate(chosen.template, params)}`;
}
