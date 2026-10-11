/**
 * Self-test do momento decisivo (quickClutch) — a alma do Quick Match.
 *
 * UMA VERDADE SÓ (Fase 0): o desfecho de cada opção vem do motor
 * (`event.decisivo`). Aqui se cobre o que o aparelho faz com isso:
 *   1. montarDecisivo lê o bloco do motor (opções, contexto, melhor, rival)
 *   2. sem bloco (plano antigo) → null: o gol vale direto
 *   3. o duelo pra tela usa os números do motor
 *   4. o texto do desfecho segue o que o motor decidiu (nunca sorteia)
 *   5. a escolha automática é a mesma regra da custódia
 *
 * Uso: npm run test:quick-clutch
 */

import { montarDecisivo, dueloDoDecisivo, textoDoDesfecho } from '../src/match/quickClutch';
import { escolhaAutomatica, golDoLance, lanceDe } from '../src/match/placarAoVivo';
import type { MatchPlanEvent } from '../src/match/quickPlanTypes';

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) console.log(`  ✓ ${label}`);
  else { failures += 1; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
}

const golCasa = (opcoes: Record<string, boolean>): MatchPlanEvent => ({
  minute: 23, kind: 'goal_home', actor_side: 'home', actor_id: 'h9', actor_name: 'Pedro', weight_tier: 'big', zone: 'att', text: 'gol',
  decisivo: {
    intent: 'attack', contexto: 'cara_a_cara', melhor: 'driblar', rival: 'goleiro',
    duelo: { nosso: { id: 'h9', nome: 'Pedro' }, deles: { id: 'a1', nome: 'Goleiro' }, por_opcao: { chutar: [84, 64], driblar: [70, 64], tocar: [60, 64] } },
    opcoes,
  },
});
const golFora = (opcoes: Record<string, boolean>): MatchPlanEvent => ({
  minute: 70, kind: 'goal_away', actor_side: 'away', actor_id: 'a10', actor_name: 'Dez', weight_tier: 'big', zone: 'att', text: 'gol deles',
  decisivo: {
    intent: 'defend', contexto: 'dispara_em_velocidade', melhor: 'carrinho', rival: 'zagueiro',
    duelo: { nosso: { id: 'h4', nome: 'Zaga' }, deles: { id: 'a10', nome: 'Dez' }, por_opcao: { cercar: [80, 70], carrinho: [50, 88], combate: [75, 60] } },
    opcoes,
  },
});

function main() {
  console.log('— Momento decisivo (clutch) —\n');

  console.log('[1] montarDecisivo lê o motor');
  const atk = montarDecisivo(golCasa({ chutar: false, driblar: true, tocar: false }), 'CAS')!;
  const def = montarDecisivo(golFora({ cercar: true, carrinho: false, combate: true }), 'VIS')!;
  check('ataque tem chutar/driblar/tocar', JSON.stringify(atk.options.map((o) => o.key)) === JSON.stringify(['chutar', 'driblar', 'tocar']));
  check('defesa tem cercar/carrinho/combate', JSON.stringify(def.options.map((o) => o.key)) === JSON.stringify(['cercar', 'carrinho', 'combate']));
  check('a melhor e o rival vêm do motor', atk.best === 'driblar' && atk.rival === 'goleiro' && def.best === 'carrinho');
  check('o contexto vira texto', /goleiro|keeper/i.test(atk.context) && def.context.length > 3);
  check('o nome do protagonista é o do lance', atk.actorName === 'Pedro' && def.actorName === 'Dez');

  console.log('\n[2] plano antigo (sem bloco) → o gol vale direto');
  const antigo: MatchPlanEvent = { minute: 5, kind: 'goal_home', actor_side: 'home', actor_id: 'h9', weight_tier: 'big', zone: 'att', text: '' };
  check('montarDecisivo devolve null', montarDecisivo(antigo, 'CAS') === null);
  check('golDoLance conta o gol', golDoLance(lanceDe(antigo)!, { decisivos: {}, penaltis: {} }) === true);

  console.log('\n[3] o duelo pra tela');
  const d = dueloDoDecisivo(golCasa({ chutar: true, driblar: true, tocar: true }), atk)!;
  check('chutar: finalização 84 × goleiro 64', d.porOpcao.chutar?.nosso === 84 && d.porOpcao.chutar?.deles === 64 && d.porOpcao.chutar?.rotuloDeles !== d.porOpcao.driblar?.rotuloNosso);
  check('os dois lados têm nome', d.nosso.nome === 'Pedro' && d.deles.nome === 'Goleiro');

  console.log('\n[4] o texto segue o motor');
  const ev = golCasa({ chutar: false, driblar: true, tocar: false });
  const l = lanceDe(ev)!;
  check('driblar (certa, motor diz gol) → GOL', golDoLance(l, { decisivos: { '23': 'driblar' }, penaltis: {} }) === true
    && /GOL|GOAL/.test(textoDoDesfecho(atk, 'driblar', true).headline));
  check('chutar (errada, motor diz não) → perdeu, e o feedback cita driblar',
    golDoLance(l, { decisivos: { '23': 'chutar' }, penaltis: {} }) === false
    && /perdeu|lost/.test(textoDoDesfecho(atk, 'chutar', false).headline)
    && /dribl/i.test(textoDoDesfecho(atk, 'chutar', false).feedback));
  const lf = lanceDe(golFora({ cercar: true, carrinho: false, combate: true }))!;
  check('defendendo: carrinho (motor diz sem gol) → salvou', golDoLance(lf, { decisivos: { '70': 'carrinho' }, penaltis: {} }) === false
    && /salvou|saved/.test(textoDoDesfecho(def, 'carrinho', false).headline));
  check('defendendo: cercar (motor diz gol) → sofreu', golDoLance(lf, { decisivos: { '70': 'cercar' }, penaltis: {} }) === true
    && /sofreu|conceded/.test(textoDoDesfecho(def, 'cercar', true).headline));
  check('opção inexistente cai na automática (nunca inventa gol)', golDoLance(l, { decisivos: { '23': 'voadora' }, penaltis: {} }) === golDoLance(l, { decisivos: {}, penaltis: {} }));

  console.log('\n[5] escolha automática = maior vantagem no duelo (a mesma regra da custódia)');
  check('ataque: chutar (84 × 64 é a maior vantagem)', escolhaAutomatica(ev.decisivo!) === 'chutar');
  check('defesa: combate (75 × 60)', escolhaAutomatica(golFora({ cercar: true, carrinho: false, combate: true }).decisivo!) === 'combate');

  console.log(failures === 0 ? '\n✅ Clutch OK — todos os checks passaram' : `\n❌ ${failures} check(s) falharam`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
