/**
 * O que o bot diz, sem rede e sem banco.   npm run test:telegram
 */
import {
  dolar, esc, lerComando, textoMercado, textoMvp, textoRanking, textoToken, inteiro,
} from './conteudo.js';
import { devidasAgora, minutoDoDiaEmSaoPaulo } from './agenda.js';
import { hojeEmSaoPaulo } from './dados.js';

let ok = 0, falhou = 0;
const check = (nome: string, cond: boolean) => {
  if (cond) { ok++; console.log(`  ✅ ${nome}`); } else { falhou++; console.log(`  ❌ ${nome}`); }
};

console.log('\n💬 comandos\n');
check('"/ranking" vira ranking', lerComando('/ranking', 'OlefootBot')?.comando === 'ranking');
check('"/ranking@OlefootBot 2" traz o argumento', lerComando('/ranking@OlefootBot 2', 'OlefootBot')?.arg === '2');
check('@ do bot sem diferenciar maiúscula', lerComando('/MVP@olefootbot', 'OlefootBot')?.comando === 'mvp');
check('🔒 comando de OUTRO bot é ignorado', lerComando('/start@OutroBot', 'OlefootBot') === null);
check('texto comum não é comando', lerComando('bom dia', 'OlefootBot') === null);
check('comando com caractere estranho é ignorado', lerComando('/<b>', 'OlefootBot') === null);

console.log('\n🔒 HTML\n');
check('esc neutraliza tag', esc('<b>Clube & Cia</b>') === '&lt;b&gt;Clube &amp; Cia&lt;/b&gt;');
check('🔒 nome de clube malicioso não vira link', !textoRanking([{ club_name: '<a href="x">golpe</a>', division: 1, points: 3, wins: 1, goal_difference: 0 }], 1).includes('<a href="x">'));

console.log('\n💰 números\n');
check('dólar em en-US', dolar(123456) === '$1,234.56');
check('inteiro grande em en-US', inteiro('80000000') === '80,000,000');

console.log('\n🏆 ranking\n');
{
  const t = textoRanking([
    { club_name: 'BEN SPORTS', division: 1, points: 385, wins: 113, goal_difference: 112 },
    { club_name: 'Pingu Fc', division: 1, points: 364, wins: 104, goal_difference: -3 },
  ], 1);
  check('título com o nome da divisão', t.includes('Global League · Elite'));
  check('medalha no 1º', t.includes('🥇 <b>BEN SPORTS</b>'));
  check('saldo positivo com +, negativo sem', t.includes('GD +112') && t.includes('GD -3'));
  check('divisão vazia diz isso', textoRanking([], 4).includes('No teams'));
}

console.log('\n📈 mercado\n');
{
  const t = textoMercado([
    { name: 'Caio', pos: 'ATA', ovr: 78, market_bro_cents: 1200, delta24h_cents: 200, dono: 'Pingu Fc' },
    { name: 'Desceu', pos: 'ZAG', ovr: 70, market_bro_cents: 900, delta24h_cents: -100, dono: null },
  ]);
  check('só quem subiu entra', t.includes('Caio') && !t.includes('Desceu'));
  check('alta em % sobre o valor de ontem', t.includes('(+20%)'));
  check('sem alta, diz que não houve', textoMercado([]).includes('No player has gained'));
}

console.log('\n⭐ MVP\n');
{
  const agora = new Date('2026-10-05T23:10:00Z');
  const m = { dia: '2026-10-05', player_name: 'Tiago', status: 'open', min_bid_olefoot: '50000', bid_olefoot: null, ends_at: '2026-10-05T23:15:00Z', clube: 'Tricolores' };
  const t = textoMvp(m, agora);
  check('aberto antes do fim', t.includes('open'));
  check('sem lance mostra o mínimo', t.includes('Minimum bid: <b>50,000 OLEFOOT</b>'));
  check('com lance mostra o lance', textoMvp({ ...m, bid_olefoot: '75000' }, agora).includes('Current bid: <b>75,000'));
  check('depois do fim, encerrado', textoMvp(m, new Date('2026-10-05T23:20:00Z')).includes('closed'));
  check('sem MVP explica o horário', textoMvp(null).includes('8 PM'));
}

console.log('\n🪙 token\n');
check('🇬🇧 tudo em inglês: nada de pt-BR nas respostas', ![textoToken('X'), textoToken(null), textoMvp(null), textoMercado([]), textoRanking([], 1)].join(' ').match(/ção|não|você|Liga|jogo |Lance|em breve/));
check('sem endereço: em breve', textoToken(null).includes('soon'));
check('com endereço: mostra em <code>', textoToken('ABC123pump').includes('<code>ABC123pump</code>'));
check('com endereço: link de compra no pump.fun', textoToken('ABC123pump').includes('pump.fun/coin/ABC123pump'));
check('sempre avisa do golpe no privado', textoToken(null).includes('never'));

console.log('\n⏰ agenda (horário de Brasília)\n');
check('15:00Z = 12:00 em SP', minutoDoDiaEmSaoPaulo(new Date('2026-10-05T15:00:00Z')) === 12 * 60);
check('12:00 SP: mercado devido', devidasAgora(new Date('2026-10-05T15:00:00Z')).map((p) => p.tipo).join() === 'mercado');
check('20:05 SP: MVP devido', devidasAgora(new Date('2026-10-05T23:05:00Z')).some((p) => p.tipo === 'mvp'));
check('11:59 SP: nada', devidasAgora(new Date('2026-10-05T14:59:00Z')).length === 0);
check('janela de 3h: 15:01 SP já não posta o mercado', !devidasAgora(new Date('2026-10-05T18:01:00Z')).some((p) => p.tipo === 'mercado'));
check('dia de SP vira à meia-noite de Brasília', hojeEmSaoPaulo(new Date('2026-10-06T02:30:00Z')) === '2026-10-05');

console.log(`\n${falhou === 0 ? '🟢' : '🔴'} ${ok} passaram, ${falhou} falharam`);
process.exit(falhou === 0 ? 0 : 1);
