/**
 * PARTIDA VIVA — Fase 9: o auxiliar do intervalo e o duelo do momento decisivo.
 * npm run test:auxiliar-duelo
 */
import { leituraDoIntervalo } from '../src/match/auxiliarDoIntervalo';
import { fraseDaProva, leituraDasProvas, type ProvaDeCausa } from '../src/match/provaDeCausa';
import { dueloDoDecisivo, montarDecisivo } from '../src/match/quickClutch';
import { escolhaAutomatica, golDoLance, lanceDe } from '../src/match/placarAoVivo';
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

// ── O duelo (UMA VERDADE SÓ: números e desfechos vêm do motor) ──────────────
{
  const ataque: MatchPlanEvent = { minute: 30, kind: 'goal_home', actor_side: 'home', actor_id: 'n', actor_name: 'Nove', weight_tier: 'big', zone: 'att', text: '',
    decisivo: { intent: 'attack', contexto: 'cara_a_cara', melhor: 'driblar', rival: 'goleiro',
      duelo: { nosso: { id: 'n', nome: 'Nove' }, deles: { id: 'g', nome: 'Goleiro' }, por_opcao: { chutar: [84, 64], driblar: [70, 64], tocar: [60, 64] } },
      opcoes: { chutar: true, driblar: true, tocar: false } } };
  const m = montarDecisivo(ataque, 'CAS')!;
  const d = dueloDoDecisivo(ataque, m)!;
  confere(d.porOpcao.chutar?.nosso === 84 && d.porOpcao.chutar?.deles === 64 && d.porOpcao.chutar?.rotuloDeles !== 'Marcação', 'chutar: finalização × goleiro (números do motor)');
  confere(escolhaAutomatica(ataque.decisivo!) === 'chutar', 'sem ordem do técnico: a maior vantagem (84 × 64) decide');
  const defesa: MatchPlanEvent = { minute: 60, kind: 'goal_away', actor_side: 'away', actor_id: 'a', actor_name: 'Dez', weight_tier: 'big', zone: 'att', text: '',
    decisivo: { intent: 'defend', contexto: 'dispara_em_velocidade', melhor: 'carrinho', rival: 'zagueiro',
      duelo: { nosso: { id: 'z', nome: 'Zaga' }, deles: { id: 'a', nome: 'Dez' }, por_opcao: { cercar: [80, 70], carrinho: [50, 88], combate: [75, 60] } },
      opcoes: { cercar: true, carrinho: false, combate: false } } };
  const dm = montarDecisivo(defesa, 'VIS')!;
  const dd = dueloDoDecisivo(defesa, dm)!;
  confere(dd.porOpcao.carrinho?.nosso === 50 && dd.porOpcao.carrinho?.deles === 88, 'defendendo: carrinho é velocidade × velocidade');
  confere(escolhaAutomatica(defesa.decisivo!) === 'combate', 'contra atacante rápido, o combate (75 × 60) é a escolha automática');
  const l = lanceDe(defesa)!;
  confere(golDoLance(l, { decisivos: { '60': 'carrinho' }, penaltis: {} }) === false && golDoLance(l, { decisivos: { '60': 'cercar' }, penaltis: {} }) === true,
    'o desfecho é o do motor por opção: carrinho segura, cercar sofre — nada é sorteado no aparelho');
}

// ── Fase 3: a Prova de Causa vira frase; o analista lê as diferenças ─────────
{
  const num = (o: Partial<ProvaDeCausa['com']> = {}): ProvaDeCausa['com'] => ({ posses_casa: 5, posses: 10, chutes_casa: 1, chutes_fora: 1, xg_casa: 0.1, xg_fora: 0.1, roubadas_casa: 2, faltas_casa: 1, cartoes_casa: 0, por_jogador: {}, ...o });
  const marcar: ProvaDeCausa = {
    janela: [23, 32], causa: { tipo: 'comando', jogador: 'z1', alvo: 'a9', ordem: 'marcar' }, divergiu_em: 24,
    com: num({ roubadas_casa: 4, chutes_fora: 0, por_jogador: { a9: { toques: 1 }, z1: { desarme: 3 } } }),
    sem: num({ roubadas_casa: 2, chutes_fora: 2, por_jogador: { a9: { toques: 4 }, z1: { desarme: 0 } } }),
    so_com: [], so_sem: [{ m: 27, k: 'chance', lado: 'away', a: 'a9' }, { m: 30, k: 'shot', lado: 'away', a: 'a9' }],
  };
  const nomes: Record<string, string> = { z1: 'Caio', a9: 'Freitas' };
  const f = fraseDaProva(marcar, 'a ordem pra Caio', (id) => nomes[id] ?? id);
  confere(/Freitas tocou 1× na bola \(sem a marcação: 4\)|Freitas touched the ball 1×/.test(f) && /Caio desarmou 3|Caio won it back 3/.test(f) && /27'/.test(f),
    `marcar o 10 vira frase com o alvo, o marcador e o lance que não houve: "${f}"`);
  const nada: ProvaDeCausa = { ...marcar, causa: { tipo: 'comando', grito: 'acalmar' }, com: num(), sem: num(), so_com: [], so_sem: [] };
  confere(/nada mudou|nothing changed/.test(fraseDaProva(nada, 'o grito', (id) => id)), 'comando sem efeito: a prova diz que nada mudou (não inventa)');
  const leitura = leituraDasProvas([{ rotulo: 'o grito', prova: nada }, { rotulo: 'a ordem pra Caio', prova: marcar }]);
  confere(!!leitura && /a ordem pra Caio/.test(leitura) && /-2|−2/.test(leitura), `o analista aponta o comando que mais mudou o jogo: "${leitura}"`);
  confere(leituraDasProvas([]) === null, 'sem prova, o analista não fala de comando');
}

if (falhas) { console.error(`\n${falhas} falha(s)`); process.exit(1); }
console.log('\nFase 9: auxiliar e duelo ok');
