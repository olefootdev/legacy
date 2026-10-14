/**
 * COMANDO DE VOZ (protótipo) — a frase vira o comando certo.   npm run test:voz
 *
 * O entendedor (src/partidaViva/voz/entender.ts) é puro: este teste fala com
 * ele como o manager falaria, com um elenco de verdade (nomes compostos, dois
 * zagueiros, banco com posição) e confere o comando que sai — o MESMO id que o
 * botão do campo manda pro QuickPlanPlayer.
 */
import { entenderComando, type ContextoDaVoz } from '../src/partidaViva/voz/entender';

let ok = 0, falhou = 0;
const casa = [
  { id: 'h-gol', nome: 'Rafael Santos', slot: 'gol', fadiga: 10 },
  { id: 'h-ld', nome: 'Bruno Lima', slot: 'ld', fadiga: 40 },
  { id: 'h-z1', nome: 'Thiago Silva', slot: 'zag1', fadiga: 30 },
  { id: 'h-z2', nome: 'Diego Costa', slot: 'zag2', fadiga: 70 },
  { id: 'h-le', nome: 'Caio Henrique', slot: 'le', fadiga: 55 },
  { id: 'h-vol', nome: 'Lucas Moura', slot: 'vol', fadiga: 20 },
  { id: 'h-mc1', nome: 'Renan Oliveira', slot: 'mc1', fadiga: 35 },
  { id: 'h-mc2', nome: 'Matheus Pereira', slot: 'mc2', fadiga: 85 },
  { id: 'h-pd', nome: 'Vitor Roque', slot: 'pd', fadiga: 45 },
  { id: 'h-ata', nome: 'Gabriel Barbosa', slot: 'ata', fadiga: 60 },
  { id: 'h-pe', nome: 'Pedro Henrique Lima', slot: 'pe', fadiga: 50 },
];
const fora = [
  { id: 'a-gol', nome: 'Neto', slot: 'gol', fadiga: 0 }, { id: 'a-z1', nome: 'Igor Rabello', slot: 'zag1', fadiga: 0 },
  { id: 'a-z2', nome: 'Freitas', slot: 'zag2', fadiga: 0 }, { id: 'a-ld', nome: 'Marcelo', slot: 'ld', fadiga: 0 },
  { id: 'a-le', nome: 'Douglas Santos', slot: 'le', fadiga: 0 }, { id: 'a-vol', nome: 'Anderson', slot: 'vol', fadiga: 0 },
  { id: 'a-mc1', nome: 'Felipe Melo', slot: 'mc1', fadiga: 0 }, { id: 'a-mc2', nome: 'Wesley', slot: 'mc2', fadiga: 0 },
  { id: 'a-pd', nome: 'Jonas', slot: 'pd', fadiga: 0 }, { id: 'a-ata', nome: 'Adriano Imperador', slot: 'ata', fadiga: 0 },
  { id: 'a-pe', nome: 'Savinho', slot: 'pe', fadiga: 0 },
];
const base: ContextoDaVoz = {
  casa, fora, subsRestantes: 3,
  banco: [{ id: 'b-ata', nome: 'Endrick Felipe', pos: 'ATA' }, { id: 'b-zag', nome: 'Murilo', pos: 'ZAG' }, { id: 'b-mc', nome: 'Andreas Pereira', pos: 'MC' }],
  decisao: null, formacoes: ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '5-3-2', '3-4-3'], lendas: [{ id: 'legacy-juca-1', nome: 'Juca Kfouri' }],
};

const fala = (texto: string, esperado: string | null, ctx: Partial<ContextoDaVoz> = {}) => {
  const r = entenderComando(texto, { ...base, ...ctx });
  const veio = r.tipo === 'ok' ? r.id : null;
  if (veio === esperado) { ok++; console.log(`  ✅ "${texto}" → ${veio ?? (r.tipo === 'duvida' ? `dúvida: ${r.texto}` : '-')}`); }
  else { falhou++; console.log(`  ❌ "${texto}" → ${veio ?? (r.tipo === 'duvida' ? `dúvida: ${r.texto}` : '-')} (esperado ${esperado ?? 'dúvida'})`); }
};

console.log('\n🔄 trocas\n');
fala('sai o Caio entra o Endrick', 'sub:h-le|b-ata');
fala('tira o Matheus e coloca o Andreas', 'sub:h-mc2|b-mc');
fala('Endrick no lugar do Gabriel', 'sub:h-ata|b-ata');
fala('troca o Diego pelo Murilo', 'sub:h-z2|b-zag');
fala('tira o mais cansado e bota o Andreas', 'sub:h-mc2|b-mc');
fala('sai o 9 entra o Endrick', 'sub:h-ata|b-ata');
fala('tira o lateral esquerdo e coloca o Murilo', 'sub:h-le|b-zag');
fala('tira o zagueiro, entra o Murilo', 'sub:h-z2|b-zag'); // dois zagueiros: sai o mais cansado
fala('sai o Caio entra o Neymar', null);
fala('sai o Caio entra o Endrick', null, { subsRestantes: 0 });

console.log('\n🎯 ordens individuais\n');
fala('Lucas marca o Adriano', 'marcar:h-vol|a-ata');
fala('Thiago, gruda no 10', 'marcar:h-z1|a-mc2');
fala('Lucas em cima do Savinho', 'marcar:h-vol|a-pe');
fala('Renan marca de perto', 'ordem:h-mc1:marcar');
fala('Vitor ataca o espaço', 'ordem:h-pd:atacar_espaco');
fala('Gabriel vai nas costas', 'ordem:h-ata:atacar_espaco');
fala('Bruno segura a posição', 'ordem:h-ld:segurar');
fala('Bruno não sobe', 'ordem:h-ld:segurar');

console.log('\n📣 estilo e grito\n');
fala('ataque total', 'estilo:attack');
fala('pressiona a saída deles', 'estilo:press');
fala('recua todo mundo, fecha a casinha', 'estilo:defend');
fala('joga no contra-ataque', 'estilo:counter');
fala('toca a bola, cadencia', 'estilo:possession');
fala('vamo rapaziada!', 'grito:incentivar');
fala('acorda, time!', 'grito:cobrar');
fala('calma, calma', 'grito:acalmar');

console.log('\n🧭 formação e lenda\n');
fala('vamos de 3-5-2', 'formacao:3-5-2');
fala('quatro quatro dois', 'formacao:4-4-2');
fala('três zagueiros', 'formacao:3-5-2');
fala('ativa a lenda', 'lenda:legacy-juca-1');
fala('6-0-4', null);

console.log('\n⚡ decisões abertas\n');
const decisivo = { tipo: 'decisivo', opcoes: [{ id: 'chutar', rotulo: 'Chutar' }, { id: 'driblar', rotulo: 'Driblar' }, { id: 'tocar', rotulo: 'Tocar' }] };
fala('chuta!', 'chutar', { decisao: decisivo });
fala('dribla ele', 'driblar', { decisao: decisivo });
fala('toca pro lado', 'tocar', { decisao: decisivo });
const defesa = { tipo: 'decisivo', opcoes: [{ id: 'cercar', rotulo: 'Cercar' }, { id: 'carrinho', rotulo: 'Carrinho' }, { id: 'combate', rotulo: 'Combate' }] };
fala('dá o carrinho', 'carrinho', { decisao: defesa });
fala('chega junto!', 'combate', { decisao: defesa });
fala('bate o Gabriel', 'h-ata', { decisao: { tipo: 'penalti', opcoes: casa.map((c) => ({ id: c.id, rotulo: c.nome })) } });
fala('entra o Murilo', 'b-zag', { decisao: { tipo: 'lesao', opcoes: base.banco.map((b) => ({ id: b.id, rotulo: b.nome })) } });
// Com decisão aberta, um comando comum ainda passa.
fala('ataque total', 'estilo:attack', { decisao: decisivo });

console.log('\n🇬🇧 inglês (básico)\n');
fala('all out attack', 'estilo:attack');
fala('sub Caio for Endrick', 'sub:h-le|b-ata');
fala('Lucas mark Adriano', 'marcar:h-vol|a-ata');
fala('shoot!', 'chutar', { decisao: decisivo });

console.log('\n🤷 não entende sem inventar\n');
fala('que dia é hoje', null);
fala('', null);

console.log(`\n${falhou ? '❌' : '✅'} voz: ${ok} ok, ${falhou} falhou\n`);
if (falhou) process.exit(1);
