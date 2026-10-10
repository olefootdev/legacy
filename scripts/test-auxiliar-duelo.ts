/**
 * PARTIDA VIVA — Fase 9: o auxiliar do intervalo e o duelo do momento decisivo.
 * npm run test:auxiliar-duelo
 */
import { leituraDoIntervalo } from '../src/match/auxiliarDoIntervalo';
import { buildClutch, duelo, forcaNoDuelo, resolveClutch, type ClutchMoment } from '../src/match/quickClutch';
import type { MatchPlanEvent } from '../src/match/quickPlanTypes';

let falhas = 0;
function confere(cond: boolean, msg: string) {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) falhas++;
}
const ev = (minute: number, kind: string, side: 'home' | 'away', channel: MatchPlanEvent['channel']): MatchPlanEvent =>
  ({ minute, kind: `${kind}_${side}` as MatchPlanEvent['kind'], actor_side: side, actor_id: 'x', weight_tier: 'normal', zone: 'att', channel, text: '' });

// ── O auxiliar do intervalo ─────────────────────────────────────────────────
{
  const pelaEsquerda = [ev(5, 'shot', 'away', 'corredor_esquerdo'), ev(12, 'chance', 'away', 'corredor_esquerdo'), ev(30, 'save', 'away', 'corredor_esquerdo'), ev(40, 'shot', 'home', 'ataque_central')];
  const a = leituraDoIntervalo(pelaEsquerda, { casa: 0, fora: 0 });
  confere(/3 vezes pela esquerda|3 times down the left/.test(a.texto) && a.sugestao === 'balanced', `perigo concentrado: "${a.texto}" → ${a.sugestao}`);
  const ganhando = leituraDoIntervalo(pelaEsquerda, { casa: 1, fora: 0 });
  confere(ganhando.sugestao === 'defensive', 'mesmo perigo, mas ganhando: fecha (defensiva)');
  const insiste = leituraDoIntervalo([ev(3, 'shot', 'home', 'corredor_direito'), ev(20, 'save', 'home', 'corredor_direito'), ev(33, 'woodwork', 'home', 'corredor_direito')], { casa: 0, fora: 1 });
  confere(insiste.sugestao === 'offensive' && /direita|right/.test(insiste.texto), `a gente cria e não converte: "${insiste.texto}" → ofensiva`);
  const nada = leituraDoIntervalo([ev(10, 'buildup', 'home', 'criacao')], { casa: 0, fora: 0 });
  confere(nada.sugestao === 'offensive' && /Quase não|barely/.test(nada.texto), 'pouca chegada: arrisca mais');
  const segundoTempo = leituraDoIntervalo([ev(50, 'shot', 'away', 'corredor_esquerdo'), ev(60, 'shot', 'away', 'corredor_esquerdo'), ev(70, 'shot', 'away', 'corredor_esquerdo')], { casa: 0, fora: 0 });
  confere(!/3 vezes|3 times/.test(segundoTempo.texto), 'o auxiliar só lê o 1º tempo');
  const tranquilo = leituraDoIntervalo([ev(10, 'goal', 'home', 'ataque_central'), ev(20, 'shot', 'home', 'criacao')], { casa: 1, fora: 0 });
  confere(tranquilo.sugestao === null, 'ganhando sem sufoco: mantém (sem sugestão)');
}

// ── O duelo ─────────────────────────────────────────────────────────────────
{
  const ataque: ClutchMoment = { ...buildClutch({ intent: 'attack', minute: 30, seed: 's', actorName: 'Nove' }), rival: 'goleiro' };
  const d = duelo(ataque, { id: 'n', nome: 'Nove', attrs: { finalizacao: 84, drible: 70, passe: 60 } }, { id: 'g', nome: 'Goleiro', attrs: { marcacao: 64 } });
  confere(d.porOpcao.chutar?.nosso === 84 && d.porOpcao.chutar?.deles === 64 && d.porOpcao.chutar?.rotuloDeles !== 'Marcação', 'chutar: finalização × goleiro');
  confere(forcaNoDuelo(null, 'chutar') === 70, 'sem duelo: o mesmo 70 de antes (nada muda pra quem não tem atributo)');
  const empate = duelo(ataque, { id: 'n', nome: 'N', attrs: { finalizacao: 70 } }, { id: 'g', nome: 'G', attrs: { marcacao: 70 } });
  confere(forcaNoDuelo(empate, 'chutar') === 70, 'duelo empatado = jogo de antes');
  confere(forcaNoDuelo(d, 'chutar') === 86, 'vantagem de 20 → 86 (≈ +3 pp)');
  const defesa: ClutchMoment = { ...buildClutch({ intent: 'defend', minute: 60, seed: 's', actorName: 'Dez' }), rival: 'zagueiro' };
  const dd = duelo(defesa, { id: 'z', nome: 'Zaga', attrs: { marcacao: 80, velocidade: 50, fisico: 75 } }, { id: 'a', nome: 'Dez', attrs: { drible: 70, velocidade: 88, fisico: 60 } });
  confere(dd.porOpcao.carrinho?.nosso === 50 && dd.porOpcao.carrinho?.deles === 88, 'defendendo: carrinho é velocidade × velocidade');
  confere(forcaNoDuelo(dd, 'carrinho') < 70 && forcaNoDuelo(dd, 'combate') > 70, 'contra atacante rápido, o carrinho piora e o combate melhora');
  // O peso é real e limitado: em 4.000 momentos, a vantagem move o sucesso, mas pouco.
  let comVantagem = 0, semVantagem = 0;
  for (let i = 0; i < 4000; i++) {
    const m = { ...ataque, minute: i };
    if (resolveClutch(m, m.best, `seed-${i}`, 86).success) comVantagem++;
    if (resolveClutch(m, m.best, `seed-${i}`, 70).success) semVantagem++;
  }
  const dpp = (comVantagem - semVantagem) / 40;
  confere(dpp > 0 && dpp < 7, `a vantagem no duelo pesa de verdade e com teto: +${dpp.toFixed(1)} pp de sucesso`);
}

if (falhas) { console.error(`\n${falhas} falha(s)`); process.exit(1); }
console.log('\nFase 9: auxiliar e duelo ok');
