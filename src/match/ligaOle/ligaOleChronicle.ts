/**
 * ligaOleChronicle.ts — Crônica da edição (Liga Ole → inbox).
 *
 * Filosofia Fable: a história é escrita a cada rodada — sem autor humano,
 * minerando o que o motor JÁ produz (results do chaveamento):
 *
 *   • A ZEBRA — o maior azarão que venceu na rodada (gap de OVR).
 *   • O MASSACRE — a maior goleada da rodada (fora o jogo do manager).
 *   • O CARRASCO — quem eliminou o manager (já vira nêmesis no reducer;
 *     aqui ganha a manchete).
 *
 * PURO — recebe estados antes/depois do advance; devolve InboxItems prontos.
 */

import type { InboxItem } from '@/game/inboxTypes';
import { makeInboxItem } from '@/game/inboxItem';
import { coachPersonaFor, personaLine } from './coachPersona';
import type { LigaOleState } from './ligaOleModel';
import { LIGA_OLE_ROUNDS } from './ligaOleModel';
import { L, emIngles } from '@/i18n/L';

/** Rótulo EN da fase (a fase PT segue sendo a chave). */
const ROUND_EN: Record<string, string> = {
  'Fase de 32': 'Round of 32',
  Oitavas: 'Round of 16',
  Quartas: 'Quarter-finals',
  Semifinal: 'Semi-final',
  Final: 'Final',
};

/**
 * Gera a crônica da rodada que ACABOU de ser resolvida (roundIndex do estado
 * anterior). `idSalt` garante ids únicos (caller passa timestamp).
 */
export function buildRoundChronicle(
  before: LigaOleState,
  after: LigaOleState,
  args: { managerClubName: string; idSalt: string | number },
): InboxItem[] {
  const r = before.roundIndex;
  const roundPt = LIGA_OLE_ROUNDS[r];
  const roundName = roundPt ? (emIngles() ? ROUND_EN[roundPt] ?? roundPt : roundPt) : L('Fase', 'Round');
  const round = before.participants[r];
  if (!round) return [];
  const out: InboxItem[] = [];

  // Varre os confrontos resolvidos da rodada (fora o jogo do manager).
  let zebra: { winner: string; loser: string; gap: number } | null = null;
  let massacre: { winner: string; loser: string; score: string; margin: number } | null = null;
  for (let pair = 0; pair < round.length; pair += 2) {
    const aId = round[pair]!;
    const bId = round[pair + 1]!;
    if (aId === before.managerTeamId || bId === before.managerTeamId) continue;
    const res = after.results[`${r}:${pair / 2}`];
    const a = before.teams[aId];
    const b = before.teams[bId];
    if (!res || !a || !b) continue;
    const winner = res.winner === aId ? a : b;
    const loser = res.winner === aId ? b : a;
    const gap = loser.overall - winner.overall; // >0 = azarão venceu
    if (gap >= 3 && (!zebra || gap > zebra.gap)) {
      zebra = { winner: winner.name, loser: loser.name, gap };
    }
    const margin = Math.abs(res.scoreA - res.scoreB);
    if (!res.shootout && margin >= 3 && (!massacre || margin > massacre.margin)) {
      const score = res.winner === aId ? `${res.scoreA}–${res.scoreB}` : `${res.scoreB}–${res.scoreA}`;
      massacre = { winner: winner.name, loser: loser.name, score, margin };
    }
  }

  if (zebra) {
    out.push(makeInboxItem(
      `lo-zebra-${args.idSalt}`,
      'COMPANY_ANNOUNCEMENT',
      'COMPETIÇÃO',
      L(`🦓 Zebra na ${roundName}: ${zebra.winner} derrubou ${zebra.loser}.`, `🦓 Upset in the ${roundName}: ${zebra.winner} knocked out ${zebra.loser}.`),
      { tag: 'Liga Ole', deepLink: '/liga-ole', hideFromHomeFeed: true },
    ));
  }
  if (massacre) {
    out.push(makeInboxItem(
      `lo-goleada-${args.idSalt}`,
      'COMPANY_ANNOUNCEMENT',
      'COMPETIÇÃO',
      L(`🔥 ${massacre.winner} atropelou ${massacre.loser} por ${massacre.score} na ${roundName}.`, `🔥 ${massacre.winner} thrashed ${massacre.loser} ${massacre.score} in the ${roundName}.`),
      { tag: 'Liga Ole', deepLink: '/liga-ole', hideFromHomeFeed: true },
    ));
  }

  // O CARRASCO — manager eliminado: manchete com a fala da persona do algoz.
  if (after.status === 'eliminated') {
    const mRound = before.participants[r]!;
    const mIdx = mRound.indexOf(before.managerTeamId);
    const oppId = mIdx >= 0 ? (mIdx % 2 === 0 ? mRound[mIdx + 1] : mRound[mIdx - 1]) : undefined;
    const opp = oppId ? before.teams[oppId] : undefined;
    if (opp) {
      const persona = coachPersonaFor(opp.id);
      const line = personaLine(opp.id, 'eliminated_you', String(args.idSalt));
      out.push(makeInboxItem(
        `lo-carrasco-${args.idSalt}`,
        'COMPANY_ANNOUNCEMENT',
        'COMPETIÇÃO',
        L(`${persona.icon} O carrasco: ${opp.name} eliminou ${args.managerClubName} na ${roundName}.`, `${persona.icon} The executioner: ${opp.name} knocked out ${args.managerClubName} in the ${roundName}.`),
        { body: L(`${persona.label} deixou o recado: "${line}"`, `${persona.label} left a message: "${line}"`), tag: 'Liga Ole', deepLink: '/liga-ole', hideFromHomeFeed: false },
      ));
    }
  }

  return out;
}
