/**
 * Self-test das CHAMADAS de transição + BUFF DE ACERTO do Quick Match.
 *
 * Certifica:
 *   1. As 10 situações classificam no kind/intent/reaction corretos
 *   2. Gatilhos: momento (contra-ataque), canal, reason, xG, rebote (prevKind)
 *   3. Guardas: lances de baixo sinal → sem chamada
 *   4. Fallback: todo gol natural tem contexto (nunca "do nada")
 *   5. Determinismo (classificador é puro)
 *   6. UMA VERDADE SÓ: a reação não muda lance nenhum aqui — vira decisão no replan
 *
 * Uso: npm run test:quick-transition
 */

import { classifyTransition } from '../src/match/quickBeatDirector';
import type { MatchPlanEvent } from '../src/match/quickPlanTypes';

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) console.log(`  ✓ ${label}`);
  else { failures += 1; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
}

function ev(partial: Partial<MatchPlanEvent> & Pick<MatchPlanEvent, 'kind'>): MatchPlanEvent {
  return {
    minute: 50,
    actor_side: partial.kind.endsWith('_away') ? 'away' : 'home',
    weight_tier: 'big',
    zone: 'att',
    xg: 0.3,
    text: 'x',
    ...partial,
  } as MatchPlanEvent;
}

async function main() {
  console.log('— Chamadas de transição + buff de acerto —\n');

  console.log('[1] As 10 situações');
  const cases: Array<{ label: string; event: MatchPlanEvent; momentumHome: number; prevKind?: MatchPlanEvent['kind']; kind: string; intent: string }> = [
    { label: '1 contra-ataque a favor', event: ev({ kind: 'goal_home', channel: 'criacao' }), momentumHome: 30, kind: 'contra_pro', intent: 'attack' },
    { label: '2 contra-ataque sofrido', event: ev({ kind: 'goal_away', channel: 'criacao' }), momentumHome: 70, kind: 'contra_sofrido', intent: 'defend' },
    { label: '3 rebote/sobra', event: ev({ kind: 'goal_home', channel: 'criacao' }), momentumHome: 50, prevKind: 'save_away', kind: 'rebote', intent: 'attack' },
    { label: '4 bola parada', event: ev({ kind: 'goal_home', channel: 'bola_parada' }), momentumHome: 50, kind: 'bola_parada', intent: 'attack' },
    { label: '5 erro defensivo', event: ev({ kind: 'goal_home', channel: 'criacao', reason: 'falha na saída de bola' }), momentumHome: 50, kind: 'falha', intent: 'attack' },
    { label: '6 pressão alta', event: ev({ kind: 'goal_home', channel: 'pressao' }), momentumHome: 50, kind: 'pressao', intent: 'attack' },
    { label: '7 jogada individual', event: ev({ kind: 'goal_home', channel: 'finalizacao_vs_gk' }), momentumHome: 50, kind: 'individual', intent: 'attack' },
    { label: '8 cruzamento na área', event: ev({ kind: 'goal_home', channel: 'corredor_direito' }), momentumHome: 50, kind: 'cruzamento', intent: 'attack' },
    { label: '9 golaço de longe', event: ev({ kind: 'goal_home', channel: 'criacao', xg: 0.04 }), momentumHome: 50, kind: 'golaco', intent: 'attack' },
    { label: '10 lançamento nas costas', event: ev({ kind: 'goal_home', channel: 'ataque_central' }), momentumHome: 50, kind: 'lancamento', intent: 'attack' },
  ];
  const hasTrio = (rx: { effect: string }[]) =>
    rx.length === 3
    && rx.some((c) => c.effect === 'positive')
    && rx.some((c) => c.effect === 'neutral')
    && rx.some((c) => c.effect === 'negative');
  for (const c of cases) {
    const r = classifyTransition({ event: c.event, momentumHome: c.momentumHome, prevKind: c.prevKind });
    check(c.label, !!r && r.kind === c.kind && r.intent === c.intent && hasTrio(r.reactions),
      r ? `got kind=${r.kind} intent=${r.intent} reactions=${JSON.stringify(r.reactions.map((x) => x.effect))}` : 'null');
  }

  console.log('\n[2] Guardas');
  check('lance de baixo sinal (shot normal) → sem chamada',
    classifyTransition({ event: ev({ kind: 'shot_home', weight_tier: 'normal' }), momentumHome: 30 }) === null);
  check('chance pequena (minor) → sem chamada',
    classifyTransition({ event: ev({ kind: 'chance_home', weight_tier: 'minor' }), momentumHome: 30 }) === null);
  check('chance GRANDE com canal → tem chamada',
    classifyTransition({ event: ev({ kind: 'chance_home', weight_tier: 'big', channel: 'corredor_direito' }), momentumHome: 50 })?.kind === 'cruzamento');

  console.log('\n[3] Fallback — todo gol tem contexto');
  const g = classifyTransition({ event: ev({ kind: 'goal_home', channel: undefined, xg: 0.2 }), momentumHome: 50 });
  check('gol sem canal cai no genérico "chegada"', g?.kind === 'chegada' && hasTrio(g.reactions), g ? g.kind : 'null');
  const ga = classifyTransition({ event: ev({ kind: 'goal_away', channel: undefined, xg: 0.2 }), momentumHome: 50 });
  check('gol deles sem canal → contexto defensivo', ga?.kind === 'chegada' && ga.intent === 'defend');

  console.log('\n[4] Determinismo');
  const a = classifyTransition({ event: ev({ kind: 'goal_home', channel: 'pressao' }), momentumHome: 50 });
  const b = classifyTransition({ event: ev({ kind: 'goal_home', channel: 'pressao' }), momentumHome: 50 });
  check('mesma entrada → mesma chamada', JSON.stringify(a) === JSON.stringify(b));

  console.log('\n[5] A reação não é mais um sorteio local');
  check('o módulo não exporta applyDecisionToRemainingEvents', !('applyDecisionToRemainingEvents' in (await import('../src/match/quickBeatDirector'))));

  console.log(failures === 0 ? '\n✅ Transição OK — todos os checks passaram' : `\n❌ ${failures} check(s) falharam`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
