import type { PitchPlayerState } from '@/engine/types';
import type { PlayerEntity } from '@/entities/types';
import { overallFromAttributes } from '@/entities/player';
import { normalizeMatchAttributes } from '@/match/playerInMatch';
import type { MatchupMatrix, SectorStrength } from './storyContracts';

function roughOvrFromPitch(p: PitchPlayerState): number {
  const a = p.attributes ?? normalizeMatchAttributes();
  return (
    a.passeCurto +
    a.finalizacao +
    a.marcacao +
    a.velocidade +
    a.drible +
    a.fisico +
    a.tatico
  ) / 7;
}

function avg(nums: number[]): number {
  if (!nums.length) return 70;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function sectorFromHomePlayers(players: PitchPlayerState[]): SectorStrength {
  const defs: number[] = [];
  const mids: number[] = [];
  const atts: number[] = [];

  for (const p of players) {
    const a = p.attributes ?? normalizeMatchAttributes();
    if (p.role === 'gk' || p.role === 'def') {
      defs.push((a.marcacao + a.fisico + a.passeLongo) / 3);
    } else if (p.role === 'mid') {
      mids.push((a.passeCurto + a.tatico + a.drible + a.cruzamento) / 4);
    } else {
      atts.push((a.finalizacao + a.velocidade + a.drible) / 3);
    }
  }

  return {
    defensive: Math.round(avg(defs.length ? defs : [68])),
    creative: Math.round(avg(mids.length ? mids : [68])),
    attack: Math.round(avg(atts.length ? atts : [68])),
  };
}

function sectorFromAwayStub(opponentStrength: number): SectorStrength {
  const b = Math.max(45, Math.min(92, opponentStrength));
  return {
    defensive: Math.round(b + (Math.sin(1.1) * 6)),
    creative: Math.round(b + (Math.sin(2.2) * 5)),
    attack: Math.round(b + (Math.sin(0.7) * 7)),
  };
}

export function computeMatchupMatrix(home: SectorStrength, away: SectorStrength): MatchupMatrix {
  const norm = (a: number, b: number) => {
    const raw = (a + 1) / (b + 1);
    return Math.max(0.55, Math.min(1.45, raw));
  };
  return {
    defVsAtk: norm(home.defensive, away.attack),
    criVsCri: norm(home.creative, away.creative),
    atkVsDef: norm(home.attack, away.defensive),
  };
}

export interface PrematchAnalysisInput {
  homePlayers: PitchPlayerState[];
  homeRoster: PlayerEntity[];
  opponentStrength: number;
}

/**
 * Análise pré-jogo: forças setoriais e matriz de duelos.
 * Não inclui nem calcula vencedor ou placar.
 */
export function buildPrematchSectorAndMatrix(input: PrematchAnalysisInput): {
  sectorHome: SectorStrength;
  sectorAway: SectorStrength;
  matrix: MatchupMatrix;
  highlights: string[];
} {
  const sectorHome = sectorFromHomePlayers(input.homePlayers);
  const sectorAway = sectorFromAwayStub(input.opponentStrength);

  const ovr =
    input.homeRoster.length === 0
      ? 78
      : input.homeRoster.reduce((s, p) => s + overallFromAttributes(p.attrs), 0) / input.homeRoster.length;

  const best = [...input.homePlayers].sort((a, b) => roughOvrFromPitch(b) - roughOvrFromPitch(a));

  const top = best[0];
  const highlights: string[] = [];
  if (top) {
    highlights.push(`Destaque: ${top.name} (${top.pos}) — trinca tática OLE.`);
  }
  highlights.push(
    `Setores OLE: DEF ${sectorHome.defensive} · CRI ${sectorHome.creative} · ATA ${sectorHome.attack}`,
  );
  highlights.push(`Bloco visitante (~força ${input.opponentStrength}): equilíbrio tático esperado.`);
  highlights.push(`Média elenco: ${ovr.toFixed(1)} OVR — ritmo definido em campo.`);

  return {
    sectorHome,
    sectorAway,
    matrix: computeMatchupMatrix(sectorHome, sectorAway),
    highlights,
  };
}
