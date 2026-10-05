/**
 * Seed de narração — banco de templates por situação.
 * Cada template usa placeholders: {{from}}, {{to}}, {{team}}, {{keeper}}.
 * `pickLine` escolhe por peso, preenche e devolve uma linha única pronta para o feed.
 */

import { L, emIngles } from '@/i18n/L';

export interface NarrationEntry {
  situation: string;
  template: string;
  tags: string[];
  weight: number;
}

export const NARRATION_SEED: NarrationEntry[] = [
  {
    situation: 'kickoff',
    template: L('Bola rolando — {{team}} coloca o jogo em movimento no apito inicial.', "We're under way — {{team}} get the game started."),
    tags: ['pt-BR', 'radio'],
    weight: 10,
  },
  {
    situation: 'pass_short',
    template: L('{{from}} toca curto e seguro para {{to}} no compasso do {{team}}.', '{{from}} plays it short and safe to {{to}}, {{team}} keeping it ticking.'),
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'pass_long',
    template: L('{{from}} abre o jogo em profundidade na direção de {{to}}.', '{{from}} goes long, looking for {{to}} in behind.'),
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'pass_missed',
    template: L('{{from}} erra o passe; a bola sobra limpa para o adversário.', '{{from}} misplaces the pass; it runs straight to the opposition.'),
    tags: ['pt-BR', 'radio'],
    weight: 8,
  },
  {
    situation: 'interception',
    template: L('{{from}} lê o passe, intercepta e mata a jogada de ataque.', '{{from}} reads it, intercepts and kills the attack.'),
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'tackle_clean',
    template: L('{{from}} desarma com limpeza, fica com a bola e acelera o {{team}}.', '{{from}} wins it cleanly and drives {{team}} forward.'),
    tags: ['pt-BR', 'radio'],
    weight: 10,
  },
  {
    situation: 'tackle_hard',
    template: L('{{from}} chega forte em {{to}} e derruba o lance; o estádio reage.', '{{from}} goes in hard on {{to}} and brings him down; the crowd reacts.'),
    tags: ['pt-BR', 'radio'],
    weight: 8,
  },
  {
    situation: 'foul_soft',
    template: L('{{from}} comete falta leve em {{to}}; o árbitro para o jogo.', '{{from}} with a soft foul on {{to}}; the referee stops play.'),
    tags: ['pt-BR', 'radio'],
    weight: 7,
  },
  {
    situation: 'foul_hard',
    template: L('Entrada dura de {{from}} em {{to}}; o árbitro apita e corta o ritmo.', 'Heavy challenge from {{from}} on {{to}}; the referee blows up.'),
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'advantage_play',
    template: L('O árbitro deixa seguir: vantagem clara para o {{team}}.', 'The referee waves play on: advantage {{team}}.'),
    tags: ['pt-BR', 'radio'],
    weight: 8,
  },
  {
    situation: 'shot_out',
    template: L('{{from}} finaliza com convicção, mas a bola passa longe da baliza.', "{{from}} hits it with conviction, but it's well wide of the target."),
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'shot_blocked',
    template: L('{{from}} solta o remate e um defensor fecha o caminho na hora H.', '{{from}} lets fly and a defender throws himself in the way.'),
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'shot_save',
    template: L('{{from}} bate com intenção e {{keeper}} fecha o ângulo com defesa segura.', '{{from}} means it, but {{keeper}} narrows the angle and saves.'),
    tags: ['pt-BR', 'radio'],
    weight: 10,
  },
  {
    situation: 'shot_strong',
    template: L('{{from}} enche o pé; o remate vibra na defesa e assusta o estádio.', '{{from}} leathers it; the shot rattles the defence and stirs the crowd.'),
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'goal_simple',
    template: L('GOL! {{from}} empurra para a rede e coloca o {{team}} na frente do placar.', 'GOAL! {{from}} tucks it away and puts {{team}} ahead.'),
    tags: ['pt-BR', 'radio'],
    weight: 10,
  },
  {
    situation: 'goal_beautiful',
    template: L('GOLAÇO! {{from}} pinta o lance e explode o {{team}} na comemoração.', 'WHAT A GOAL! {{from}} paints a picture and {{team}} erupt.'),
    tags: ['pt-BR', 'radio'],
    weight: 10,
  },
  {
    situation: 'goal_header',
    template: L('GOL DE CABEÇA! {{from}} sobe mais alto que a marcação e manda para a rede.', 'HEADED GOAL! {{from}} rises above everyone and nods it in.'),
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'goal_rebound',
    template: L('GOL NO REBOTE! {{from}} aproveita a sobra fria dentro da área.', 'GOAL ON THE REBOUND! {{from}} pounces on the loose ball in the box.'),
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'counter_attack',
    template: L('{{team}} dispara o contra-ataque em três toques e leva perigo na área.', "{{team}} break in three passes and there's danger in the box."),
    tags: ['pt-BR', 'radio'],
    weight: 10,
  },
  {
    situation: 'build_up',
    template: L('{{team}} troca passes na intermediária e tenta puxar o bloco adversário.', '{{team}} work it through midfield, trying to pull the block apart.'),
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'wing_play',
    template: L('{{from}} ganha a linha, ganha velocidade e manda o cruzamento na medida.', '{{from}} gets to the byline, picks up speed and whips in an inviting cross.'),
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'cross_cut',
    template: L('{{to}} antecipa e corta o cruzamento de {{from}} antes da conclusão.', "{{to}} gets there first and cuts out {{from}}'s cross."),
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'cross_header',
    template: L('{{from}} levanta na área e {{to}} sobe livre para cabecear com veneno.', '{{from}} swings it in and {{to}} rises unmarked to head it with venom.'),
    tags: ['pt-BR', 'radio'],
    weight: 10,
  },
  {
    situation: 'dribble_success',
    template: L('{{from}} engana {{to}} na condução, entra no espaço e deixa o estádio em pé.', '{{from}} skips past {{to}}, drives into space and has the crowd on its feet.'),
    tags: ['pt-BR', 'radio'],
    weight: 10,
  },
  {
    situation: 'dribble_fail',
    template: L('{{from}} tenta o drible cerrado e {{to}} fecha a porta sem falta.', '{{from}} tries to squeeze through and {{to}} shuts the door, no foul.'),
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'clearance',
    template: L('A zaga afasta com o pé levantado e tira o perigo da pequena área.', 'The defence hacks it clear and the danger in the six-yard box is gone.'),
    tags: ['pt-BR', 'radio'],
    weight: 10,
  },
  {
    situation: 'keeper_catch',
    template: L('{{keeper}} sai do gol, segura firme no alto e acalma o jogo.', '{{keeper}} comes off his line, claims it high and calms things down.'),
    tags: ['pt-BR', 'radio'],
    weight: 10,
  },
  {
    situation: 'keeper_punch',
    template: L('{{keeper}} soca para longe num lance aéreo tenso; sobra viva na área.', "{{keeper}} punches clear under pressure; the ball's still live in the box."),
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'throw_in',
    template: L('Arremesso lateral para o {{team}} na faixa ofensiva.', 'Throw-in to {{team}} in the attacking third.'),
    tags: ['pt-BR', 'radio'],
    weight: 8,
  },
  {
    situation: 'corner_kick',
    template: L('Escanteio perigoso para o {{team}}; a área fica pequena demais.', 'Dangerous corner for {{team}}; the box suddenly looks very crowded.'),
    tags: ['pt-BR', 'radio'],
    weight: 10,
  },
  {
    situation: 'corner_clear',
    template: L('A defesa sobe na primeira bola e afasta o escanteio sem drama.', 'The defence wins the first ball and clears the corner without fuss.'),
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'free_kick',
    template: L('Falta frontal para o {{team}}; a barreira respira fundo.', 'Free kick in a central position for {{team}}; the wall takes a deep breath.'),
    tags: ['pt-BR', 'radio'],
    weight: 10,
  },
  {
    situation: 'free_kick_shot',
    template: L('{{from}} cobra direto, a bola desvia na barreira e ainda assusta.', '{{from}} goes direct, it deflects off the wall and still causes a scare.'),
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'offside',
    template: L('Bandeira no ar: impedimento marcado e jogada anulada.', "Flag's up: offside, and the move is called back."),
    tags: ['pt-BR', 'radio'],
    weight: 10,
  },
  {
    situation: 'possession_switch',
    template: L('A posse troca de lado num piscar de olhos no meio-campo.', 'Possession changes hands in the blink of an eye in midfield.'),
    tags: ['pt-BR', 'radio'],
    weight: 8,
  },
  {
    situation: 'midfield_duel',
    template: L('{{from}} e {{to}} travam duelo físico no miolo; ninguém cede terreno.', '{{from}} and {{to}} go toe to toe in midfield; neither gives an inch.'),
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'pressure_high',
    template: L('{{team}} sobe a pressão, rouba metros e força o erro na saída.', '{{team}} push up the press, win ground and force the error.'),
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'pressure_low',
    template: L('{{team}} recua o bloco, fecha o corredor central e espera o erro.', '{{team}} drop deep, close the middle and wait for the mistake.'),
    tags: ['pt-BR', 'radio'],
    weight: 8,
  },
  {
    situation: 'long_shot',
    template: L('{{from}} arrisca de fora da área; a bola raspa a trave e o estádio segura o grito.', '{{from}} tries his luck from distance; it shaves the post and the crowd holds its breath.'),
    tags: ['pt-BR', 'radio'],
    weight: 9,
  },
  {
    situation: 'miss_big_chance',
    template: L('{{from}} fica cara a cara e manda por cima; chance limpa desperdiçada.', '{{from}} is one-on-one and blazes over; a golden chance wasted.'),
    tags: ['pt-BR', 'radio'],
    weight: 10,
  },
  {
    situation: 'crowd_reaction',
    template: L('A torcida empurra o {{team}} e o estádio vira caldeirão por um instante.', 'The crowd roar {{team}} on and the stadium becomes a cauldron.'),
    tags: ['pt-BR', 'radio'],
    weight: 8,
  },
  {
    situation: 'game_pause',
    template: L('O jogo segura o ritmo: atendimento em campo e conversa com o árbitro.', "Play's held up: treatment on the pitch and words with the referee."),
    tags: ['pt-BR', 'radio'],
    weight: 7,
  },
  {
    situation: 'restart_play',
    template: L('Árbitro autoriza: bola em jogo de novo e o relógio volta a correr.', 'The referee waves it on: back in play and the clock is running again.'),
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
    .replace(/\{\{keeper\}\}/g, p.keeper ?? L('o guarda-redes', 'the keeper'));
}

/** Injeta linhas dos NarrativePacks do admin no pool de candidatos. */
function adminPackEntries(situations: string[]): NarrationEntry[] {
  if (typeof localStorage === 'undefined') return [];
  // Packs do admin são escritos em PT — em inglês ficam de fora do pool.
  if (emIngles()) return [];
  try {
    const raw = localStorage.getItem('olefoot-gamespirit-knowledge-v2');
    if (!raw) return [];
    const p = JSON.parse(raw) as { v: number; narrativePacks?: { bucket: string; lines: string[] }[] };
    if (p.v !== 2 || !Array.isArray(p.narrativePacks)) return [];
    const out: NarrationEntry[] = [];
    for (const pack of p.narrativePacks) {
      if (!situations.includes(pack.bucket)) continue;
      for (const line of pack.lines) {
        if (line.trim()) out.push({ situation: pack.bucket, template: line.trim(), tags: ['admin'], weight: 15 });
      }
    }
    return out;
  } catch {
    return [];
  }
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
  const adminEntries = adminPackEntries(sits);
  let candidates = [...NARRATION_SEED.filter((s) => sits.includes(s.situation)), ...adminEntries];

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
