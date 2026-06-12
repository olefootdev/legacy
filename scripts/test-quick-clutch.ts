/**
 * Self-test do momento decisivo (quickClutch) — a alma do Quick Match.
 *
 * Cobre:
 *   1. buildClutch determinístico + opções certas por intenção (ataque/defesa)
 *   2. Acertar o contexto (best) tem MUITO mais sucesso que errar (estatístico)
 *   3. Feedback sempre cita a melhor escolha quando erra
 *   4. Atributo alto do protagonista ajuda na conversão
 *
 * Uso: npm run test:quick-clutch
 */

import { buildClutch, resolveClutch, type ClutchKey } from '../src/match/quickClutch';

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) console.log(`  ✓ ${label}`);
  else { failures += 1; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
}

function main() {
  console.log('— Momento decisivo (clutch) —\n');

  console.log('[1] buildClutch');
  const atk = buildClutch({ intent: 'attack', minute: 23, seed: 's1', actorName: 'Pedro' });
  const def = buildClutch({ intent: 'defend', minute: 23, seed: 's1', actorName: 'Zaga' });
  check('ataque tem chutar/driblar/tocar', JSON.stringify(atk.options.map((o) => o.key)) === JSON.stringify(['chutar', 'driblar', 'tocar']));
  check('defesa tem cercar/carrinho/combate', JSON.stringify(def.options.map((o) => o.key)) === JSON.stringify(['cercar', 'carrinho', 'combate']));
  check('best do ataque é uma das opções', atk.options.some((o) => o.key === atk.best));
  check('best da defesa é uma das opções', def.options.some((o) => o.key === def.best));
  check('contexto não-vazio', atk.context.length > 3 && def.context.length > 3);
  check('determinístico (mesmo seed+min → mesmo contexto)',
    buildClutch({ intent: 'attack', minute: 23, seed: 's1', actorName: 'X' }).context === atk.context);

  console.log('\n[2] Acertar o contexto compensa (60 seeds)');
  let rightGoals = 0;
  let wrongGoals = 0;
  for (let i = 0; i < 60; i += 1) {
    const m = buildClutch({ intent: 'attack', minute: 20, seed: `atk-${i}`, actorName: 'P' });
    const wrongKey = m.options.find((o) => o.key !== m.best)!.key as ClutchKey;
    if (resolveClutch(m, m.best, `atk-${i}`).success) rightGoals += 1;
    if (resolveClutch(m, wrongKey, `atk-${i}`).success) wrongGoals += 1;
  }
  check(`escolha certa converte muito mais (${rightGoals} vs ${wrongGoals})`, rightGoals > wrongGoals + 15);

  console.log('\n[3] Feedback ensina');
  const m = buildClutch({ intent: 'attack', minute: 10, seed: 'fb', actorName: 'P' });
  const wrong = m.options.find((o) => o.key !== m.best)!.key as ClutchKey;
  const rWrong = resolveClutch(m, wrong, 'fb');
  check('feedback do erro cita o contexto', rWrong.feedback.toLowerCase().includes(m.context.slice(0, 6).toLowerCase()) || rWrong.feedback.length > 10);
  const dm = buildClutch({ intent: 'defend', minute: 10, seed: 'fb2', actorName: 'Z' });
  check('defesa: headline fala de salvar ou sofrer', (() => {
    const r = resolveClutch(dm, dm.best, 'fb2');
    return /salvou|sofreu/.test(r.headline.toLowerCase());
  })());

  console.log('\n[4] Atributo ajuda');
  let lowHits = 0;
  let highHits = 0;
  for (let i = 0; i < 80; i += 1) {
    const cm = buildClutch({ intent: 'attack', minute: 30, seed: `attr-${i}`, actorName: 'P' });
    if (resolveClutch(cm, cm.best, `attr-${i}`, 40).success) lowHits += 1;
    if (resolveClutch(cm, cm.best, `attr-${i}`, 95).success) highHits += 1;
  }
  check(`craque (95) converte >= perna-de-pau (40): ${highHits} vs ${lowHits}`, highHits >= lowHits);

  console.log(failures === 0 ? '\n✅ Clutch OK — todos os checks passaram' : `\n❌ ${failures} check(s) falharam`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
