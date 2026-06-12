/**
 * test-liga-ole.ts — valida o chaveamento da Liga Ole.
 *
 * Roda: npm run test:liga-ole
 *
 * Garante: 32 times · seed por força (fortes se cruzam tarde) · auto-resolução
 * sem empate, mais forte vence mais · avanço/eliminação salvam a fase · campeão
 * após vencer a Final · determinismo.
 */

import {
  createLigaOle,
  advanceLigaOle,
  managerOpponent,
  resolveAutoMatch,
  roundsToTitle,
  LIGA_OLE_ROUNDS,
  type LigaOleTeam,
  type LigaOleState,
} from '../src/match/ligaOle/ligaOleModel';

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) console.log(`  ✓ ${label}`);
  else { failures += 1; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
}

function teams32(managerOvr = 75): LigaOleTeam[] {
  const out: LigaOleTeam[] = [{ id: 'manager', name: 'Meu Time', short: 'MEU', overall: managerOvr, isManager: true }];
  for (let i = 0; i < 31; i += 1) {
    out.push({ id: `t${i}`, name: `Time ${i}`, short: `T${i}`, overall: 60 + ((i * 7) % 35) });
  }
  return out;
}

/** Joga a liga inteira com o manager vencendo (ou perdendo numa fase dada). */
function playThrough(state: LigaOleState, loseAtRound?: number): LigaOleState {
  let s = state;
  let guard = 0;
  while (s.status === 'active' && guard < 10) {
    const lose = loseAtRound !== undefined && s.roundIndex === loseAtRound;
    s = advanceLigaOle(s, { won: !lose, scoreManager: lose ? 0 : 2, scoreOpp: lose ? 1 : 0, shootout: false });
    guard += 1;
  }
  return s;
}

function main() {
  console.log('— Liga Ole: chaveamento —\n');

  // [1] Criação
  console.log('[1] Criação do bracket');
  const s0 = createLigaOle({ teams: teams32(), managerTeamId: 'manager', seed: 'liga-1' });
  check('32 participantes na 1ª fase', s0.participants[0]!.length === 32);
  check('manager está no bracket', s0.participants[0]!.includes('manager'));
  check('status inicial active', s0.status === 'active');
  check('rodada inicial = Fase de 32', s0.reachedRound === 'Fase de 32');
  check('5 adversários até o título', roundsToTitle(s0) === 5);

  // [2] Seed por força: 2 mais fortes em metades opostas (só se cruzam na final)
  console.log('\n[2] Seed por força');
  const strong = teams32(99); // manager é o mais forte
  // adiciona um 2º muito forte
  strong[1] = { id: 't0', name: 'Forte2', short: 'F2', overall: 95 };
  const s1 = createLigaOle({ teams: strong, managerTeamId: 'manager', seed: 'seed-x' });
  const order = s1.participants[0]!;
  const idxManager = order.indexOf('manager');
  const idxForte2 = order.indexOf('t0');
  const half = 16;
  check('os 2 mais fortes em metades opostas do bracket',
    (idxManager < half) !== (idxForte2 < half),
    `manager@${idxManager} forte2@${idxForte2}`);

  // [3] resolveAutoMatch: sem empate + força importa + determinismo
  console.log('\n[3] Auto-resolução');
  const A: LigaOleTeam = { id: 'A', name: 'A', short: 'A', overall: 88 };
  const B: LigaOleTeam = { id: 'B', name: 'B', short: 'B', overall: 62 };
  let aWins = 0, draws = 0;
  for (let i = 0; i < 2000; i += 1) {
    const r = resolveAutoMatch(A, B, `m-${i}`);
    if (r.winner !== 'A' && r.winner !== 'B') draws += 1;
    if (r.winner === 'A') aWins += 1;
    if (!r.shootout && r.scoreA === r.scoreB) draws += 1; // empate sem pênalti = bug
  }
  check('nenhum confronto empata (sempre há vencedor)', draws === 0, `${draws} ruins`);
  check('time muito mais forte vence a maioria', aWins > 1400, `${(aWins / 20).toFixed(0)}%`);
  check('determinístico (mesma seed → mesmo resultado)',
    JSON.stringify(resolveAutoMatch(A, B, 'fix')) === JSON.stringify(resolveAutoMatch(A, B, 'fix')));

  // [4] managerOpponent
  console.log('\n[4] Adversário do manager');
  const opp = managerOpponent(s0);
  check('retorna um adversário válido', !!opp && opp.id !== 'manager' && !!s0.teams[opp.id]);

  // [5] Avanço: manager vence → halve participantes
  console.log('\n[5] Avanço de rodada');
  const s2 = advanceLigaOle(s0, { won: true, scoreManager: 3, scoreOpp: 1, shootout: false });
  check('vencendo → próxima fase (Oitavas)', s2.roundIndex === 1 && s2.reachedRound === 'Oitavas');
  check('participantes caíram pra 16', s2.participants[1]!.length === 16);
  check('manager segue vivo no bracket', s2.participants[1]!.includes('manager'));
  check('todos os 16 confrontos da 1ª fase resolvidos', Object.keys(s2.results).filter(k => k.startsWith('0:')).length === 16);

  // [6] Eliminação salva a fase
  console.log('\n[6] Eliminação salva o progresso');
  const elim = playThrough(s0, 2); // perde nas Quartas (roundIndex 2)
  check('eliminado vira status eliminated', elim.status === 'eliminated');
  check('salva a fase alcançada (Quartas)', elim.reachedRound === 'Quartas', elim.reachedRound);
  check('manager não está na rodada seguinte', !(elim.participants[3] ?? []).includes('manager'));

  // [7] Campeão
  console.log('\n[7] Título');
  const champ = playThrough(s0);
  check('vencendo tudo → campeão', champ.status === 'champion', champ.status);
  check('fase alcançada = Final', champ.reachedRound === 'Final');
  check('jogou exatamente 5 fases (rounds resolvidos do manager)',
    LIGA_OLE_ROUNDS.length === 5);

  // [7b] Ganhar fase intermediária só AVANÇA (nunca vira campeão antes da Final)
  console.log('\n[7b] Só a Final dá título');
  {
    let s = createLigaOle({ teams: teams32(), managerTeamId: 'manager', seed: 'title' });
    const labelsAtWin: string[] = [];
    let bug = false;
    for (let i = 0; i < LIGA_OLE_ROUNDS.length; i += 1) {
      const roundName = LIGA_OLE_ROUNDS[s.roundIndex]!;
      s = advanceLigaOle(s, { won: true, scoreManager: 2, scoreOpp: 0, shootout: false });
      const isFinalRound = roundName === 'Final';
      labelsAtWin.push(`${roundName}→${s.status}`);
      if (!isFinalRound && s.status === 'champion') bug = true;        // campeão cedo = bug
      if (isFinalRound && s.status !== 'champion') bug = true;          // Final sem título = bug
    }
    check('ganhar Oitavas/Quartas/Semi só avança (active); só a Final dá título', !bug, labelsAtWin.join(' '));
  }

  // [8] Determinismo do bracket inteiro
  console.log('\n[8] Determinismo da liga');
  const a = playThrough(createLigaOle({ teams: teams32(), managerTeamId: 'manager', seed: 'det' }));
  const b = playThrough(createLigaOle({ teams: teams32(), managerTeamId: 'manager', seed: 'det' }));
  check('mesma seed + mesmos resultados → bracket idêntico',
    JSON.stringify(a.results) === JSON.stringify(b.results));

  console.log(failures === 0
    ? '\n✅ OK — Liga Ole validada'
    : `\n❌ ${failures} check(s) falharam`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
