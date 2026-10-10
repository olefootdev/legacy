/**
 * PARTIDA VIVA — forma do time (Fase 3).
 *
 * Portado do antigo `engine/test2d/teamShape.ts` (git 12e57c7), sem as
 * dependências do motor 2D aposentado: cada time tem uma INTENÇÃO (construir
 * baixo, progredir, atacar pelos lados, pressionar, bloco médio/baixo,
 * transição) que vira altura da linha, largura, compactação e gatilho de
 * pressão. Por cima, a CLASSE do SMART-PROFILE de cada jogador dá o jeito
 * dele de ocupar o campo — é aqui que o perfil vira coisa vista.
 *
 * Função pura: mesma entrada, mesmo alvo (o coreógrafo segue determinístico).
 */
import type { FormationSchemeId } from '@/match-engine/types';
import { C, L, lim } from './fisica';

export type Intencao =
  | 'construcao_baixa' | 'progressao' | 'ataque_lados' | 'ataque_centro'
  | 'pressao_alta' | 'bloco_medio' | 'bloco_baixo' | 'transicao_ataque' | 'transicao_defesa';

export interface Forma { alturaLinha: number; largura: number; compactacao: number; pressao: number }

const TABELA: Record<Intencao, Forma> = {
  construcao_baixa: { alturaLinha: 0.25, largura: 0.70, compactacao: 0.55, pressao: 0.10 },
  progressao:       { alturaLinha: 0.47, largura: 0.60, compactacao: 0.50, pressao: 0.20 },
  ataque_lados:     { alturaLinha: 0.70, largura: 0.88, compactacao: 0.38, pressao: 0.15 },
  ataque_centro:    { alturaLinha: 0.72, largura: 0.46, compactacao: 0.42, pressao: 0.20 },
  pressao_alta:     { alturaLinha: 0.80, largura: 0.55, compactacao: 0.75, pressao: 0.90 },
  bloco_medio:      { alturaLinha: 0.40, largura: 0.50, compactacao: 0.70, pressao: 0.45 },
  bloco_baixo:      { alturaLinha: 0.20, largura: 0.40, compactacao: 0.80, pressao: 0.15 },
  transicao_ataque: { alturaLinha: 0.62, largura: 0.65, compactacao: 0.32, pressao: 0.10 },
  transicao_defesa: { alturaLinha: 0.30, largura: 0.45, compactacao: 0.70, pressao: 0.60 },
};

/** Viés por esquema (pequeno de propósito: tempera, não manda). */
const VIES: Partial<Record<FormationSchemeId, Forma>> = {
  '4-4-2': { alturaLinha: 0, largura: 0.05, compactacao: 0.05, pressao: 0 },
  '4-2-3-1': { alturaLinha: 0.03, largura: -0.03, compactacao: 0.04, pressao: 0.03 },
  '3-5-2': { alturaLinha: -0.04, largura: 0.08, compactacao: 0.06, pressao: -0.03 },
  '4-5-1': { alturaLinha: -0.06, largura: 0.04, compactacao: 0.08, pressao: -0.05 },
  '5-3-2': { alturaLinha: -0.08, largura: -0.04, compactacao: 0.10, pressao: -0.06 },
  '3-4-3': { alturaLinha: 0.05, largura: 0.10, compactacao: -0.04, pressao: 0.05 },
};

const u = (v: number) => Math.min(1, Math.max(0, v));

/** Profundidade 0–1 a partir do PRÓPRIO gol. */
export const profundidade = (lado: 'home' | 'away', x: number) => (lado === 'home' ? x / C : 1 - x / C);

export function intencaoDoTime(args: {
  comBola: boolean; profBola: number; emTransicao: boolean; ultimoLanceChute: boolean; dominio: number;
}): Intencao {
  const { comBola, profBola, emTransicao, ultimoLanceChute, dominio } = args;
  if (comBola) {
    if (emTransicao) return 'transicao_ataque';
    if (profBola < 0.33) return 'construcao_baixa';
    if (profBola < 0.66) return 'progressao';
    return ultimoLanceChute ? 'ataque_centro' : 'ataque_lados';
  }
  if (emTransicao) return 'transicao_defesa';
  // Bola perto do MEU gol (profBola alta pra quem ataca = baixa pra mim).
  if (profBola > 0.67) return 'bloco_baixo';
  return dominio > 58 ? 'pressao_alta' : 'bloco_medio';
}

export function formaDe(intencao: Intencao, esquema: FormationSchemeId): Forma {
  const b = TABELA[intencao], v = VIES[esquema];
  if (!v) return b;
  return { alturaLinha: u(b.alturaLinha + v.alturaLinha), largura: u(b.largura + v.largura), compactacao: u(b.compactacao + v.compactacao), pressao: u(b.pressao + v.pressao) };
}

/**
 * Onde um jogador quer estar, dada a forma do time, a âncora dele na formação,
 * a bola e a classe. `ancoraProf` é a profundidade da âncora (0–1 do próprio
 * gol); `centroProf` é a média das âncoras de linha do time.
 */
export function alvoNaForma(args: {
  lado: 'home' | 'away';
  ancoraProf: number;
  ancoraZ: number;
  centroProf: number;
  forma: Forma;
  bola: { x: number; z: number };
  comBola: boolean;
  classe?: string;
  oscilacao: { x: number; z: number };
}): { x: number; z: number } {
  const { lado, ancoraProf, ancoraZ, centroProf, forma, bola, comBola, classe, oscilacao } = args;
  const profBola = profundidade(lado, bola.x);
  // Altura do bloco: a linha do time + um empurrão da bola.
  const base = 0.12 + forma.alturaLinha * 0.62 + (profBola - 0.5) * 0.15;
  const espalha = 1.3 - forma.compactacao * 0.7;
  let prof = base + (ancoraProf - centroProf) * espalha;
  let z = L / 2 + (ancoraZ - L / 2) * (0.55 + forma.largura * 0.65) + (bola.z - L / 2) * 0.2;

  // ── A CLASSE vira jeito de jogar ─────────────────────────────────────────
  switch (classe) {
    case 'regista':            if (comBola) { prof -= 0.07; z += (L / 2 - z) * 0.4; } break; // recua pra buscar
    case 'falso_9':            if (comBola && profBola > 0.4) prof -= 0.08; break;           // sai da área, abre espaço
    case 'velocista':          if (comBola && profBola > 0.35) prof += 0.09; break;          // ataca as costas
    case 'matador':            if (comBola && profBola > 0.5) { prof = Math.max(prof, 0.85); z += (L / 2 - z) * 0.5; } break; // ronda a área
    case 'pivo':               if (comBola) z += (L / 2 - z) * 0.6; break;                   // fixo no centro
    case 'ponta_driblador':    z = L / 2 + (z - L / 2) * 1.15; break;                        // abre o campo
    case 'lateral_apoiador':   if (comBola && profBola > 0.4) prof += 0.12; break;           // passa por fora
    case 'meia_chegada':       if (comBola && profBola > 0.6) prof += 0.08; break;           // chega na área
    case 'box_to_box':         prof += (profBola - prof) * 0.25; break;                      // vai e volta com a bola
    case 'goleiro_libero':     break;
  }

  // Ninguém se planta na pequena área sem lance: no máximo na altura do pênalti.
  prof = Math.min(prof, 0.9);
  const x = lado === 'home' ? prof * C : (1 - prof) * C;
  // Bloco tem limite: sem lance, ninguém mora na linha de fundo.
  return { x: lim(x + oscilacao.x, 6, C - 6), z: lim(z + oscilacao.z, 2.5, L - 2.5) };
}

/**
 * Comando do manager, camada 1 (reação na hora): o estilo do dock da Rápida
 * mexe na forma da casa no mesmo instante. A camada 2 (o resultado) já é da
 * Rápida — `resolveStyleOnEvent` molda os lances seguintes pelo estilo.
 */
export function ajustarPorEstilo(f: Forma, estilo: string | undefined, comBola: boolean): Forma {
  const d = { alturaLinha: 0, largura: 0, compactacao: 0, pressao: 0 };
  switch (estilo) {
    case 'defend': d.alturaLinha = -0.18; d.compactacao = 0.15; d.pressao = -0.2; break;
    case 'possession': if (comBola) { d.compactacao = 0.08; d.largura = 0.05; d.alturaLinha = 0.03; } break;
    case 'counter': if (comBola) d.compactacao = -0.15; else d.alturaLinha = -0.1; break;
    case 'press': if (!comBola) { d.alturaLinha = 0.15; d.pressao = 0.35; } break;
    case 'attack': d.alturaLinha = 0.12; d.largura = 0.1; d.pressao = 0.1; break;
  }
  return { alturaLinha: u(f.alturaLinha + d.alturaLinha), largura: u(f.largura + d.largura), compactacao: u(f.compactacao + d.compactacao), pressao: u(f.pressao + d.pressao) };
}

/** Classes que pressionam o portador quando o time defende (além do gatilho da forma). */
export const CLASSES_QUE_PRESSIONAM = new Set(['volante_destruidor', 'box_to_box', 'xerife']);
