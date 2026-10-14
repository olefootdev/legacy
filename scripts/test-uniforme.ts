/**
 * UNIFORME 2D (14/10) — as regras da camisa.   npm run test:uniforme
 *
 * src/club/camisa.ts: camisa antiga (Fundação) continua válida e com o mesmo
 * visual; o que vem quebrado de fora cai no padrão; entre aparelhos vence a
 * editada por último; a do Clube vence a da Fundação; o goleiro sai sempre
 * bem diferente da linha; o texto do peito é limpo.
 */
import {
  CAMISA_PADRAO, CORES_DE_CAMISA, camisaDoClube, camisaDoGoleiro, camisaMaisRecente, corDaManga, corDoMeiao, distanciaDeCor,
  golaDe, normalizarCamisa, temPunho, type CamisaDoClube,
} from '../src/club/camisa';
import { gameReducer } from '../src/game/reducer';
import type { OlefootGameState } from '../src/game/types';

let ok = 0, falhou = 0;
const check = (nome: string, cond: boolean, extra = '') => {
  if (cond) { ok++; console.log(`  ✅ ${nome}`); } else { falhou++; console.log(`  ❌ ${nome} ${extra}`); }
};

console.log('\n👕 compatível com a camisa da Fundação\n');
{
  const antiga = { padrao: 'listras', primaria: '#F2E61E', secundaria: '#0D0D0C', calcao: '#0D0D0C' };
  const c = normalizarCamisa(antiga);
  check('a camisa antiga passa inteira', c.padrao === 'listras' && c.primaria === '#F2E61E' && c.calcao === '#0D0D0C');
  check('sem os campos novos: mangas e meião na cor principal, gola redonda, punho ligado', corDaManga(c) === '#F2E61E' && corDoMeiao(c) === '#F2E61E' && golaDe(c) === 'redonda' && temPunho(c));
  check("o padrão antigo 'mangas' segue pintando as mangas no detalhe", corDaManga(normalizarCamisa({ ...antiga, padrao: 'mangas' })) === '#0D0D0C');
  check('os 8 padrões da Fundação continuam válidos', ['lisa', 'listras', 'horiz', 'diagonal', 'meio', 'peito', 'mangas', 'gola'].every((p) => normalizarCamisa({ ...antiga, padrao: p }).padrao === p));
}

console.log('\n🧹 o que vem de fora é limpo\n');
{
  const c = normalizarCamisa({ padrao: 'zebra', primaria: 'vermelho', secundaria: '#12', calcao: null, gola: 'gola-alta', manga: '#b3121b', peito: 'rua <script>!!', mangaLonga: 'sim' });
  check('padrão e cores inválidos caem no padrão do jogo', c.padrao === CAMISA_PADRAO.padrao && c.primaria === CAMISA_PADRAO.primaria && c.secundaria === CAMISA_PADRAO.secundaria && c.calcao === CAMISA_PADRAO.calcao);
  check('cor válida em minúscula vira maiúscula', c.manga === '#B3121B');
  check('gola desconhecida e booleano falso não entram', c.gola === undefined && c.mangaLonga === undefined);
  check('texto do peito: maiúsculo, sem símbolo, até 12', c.peito === 'RUA SCRIPT!!', JSON.stringify(c.peito));
  check('lixo total vira a camisa padrão', JSON.stringify(normalizarCamisa(null)) === JSON.stringify(CAMISA_PADRAO));
}

console.log('\n🔁 qual camisa vale\n');
{
  const a: CamisaDoClube = { ...CAMISA_PADRAO, primaria: '#B3121B', editadaEm: '2026-10-14T10:00:00Z' };
  const b: CamisaDoClube = { ...CAMISA_PADRAO, primaria: '#0B3D91', editadaEm: '2026-10-14T12:00:00Z' };
  check('entre aparelhos vence a editada por último', camisaMaisRecente(a, b) === b && camisaMaisRecente(b, a) === b);
  check('sem a outra, fica a que existe', camisaMaisRecente(a, null) === a && camisaMaisRecente(undefined, b) === b);
  const fundacao = { padrao: 'meio' as const, primaria: '#0E7A3A', secundaria: '#EEE9DF', calcao: '#0E7A3A' };
  check('a do Clube vence a da Fundação', camisaDoClube({ camisa: b, identidade: { camisa: fundacao } }).primaria === '#0B3D91');
  check('sem a do Clube, vale a da Fundação; sem nada, a do jogo', camisaDoClube({ identidade: { camisa: fundacao } }).padrao === 'meio' && camisaDoClube({}).primaria === CAMISA_PADRAO.primaria);
}

console.log('\n🧤 o goleiro\n');
{
  let pior = Infinity;
  for (const p of CORES_DE_CAMISA) for (const s of CORES_DE_CAMISA) {
    const g = camisaDoGoleiro({ ...CAMISA_PADRAO, primaria: p, secundaria: s });
    pior = Math.min(pior, distanciaDeCor(g.primaria, p), distanciaDeCor(g.primaria, s));
  }
  check(`com qualquer combinação da paleta, o goleiro fica longe da linha (pior distância ${Math.round(pior)})`, pior > 150);
}

console.log('\n🗂️ salvar no Clube\n');
{
  const base = { club: { name: 'Tigres', shortName: 'TIG', identidade: { camisa: CAMISA_PADRAO, formacao: '4-3-3' } }, manager: { formationScheme: '4-4-2' } } as unknown as OlefootGameState;
  const nova: CamisaDoClube = { ...CAMISA_PADRAO, primaria: '#5E2A84', gola: 'polo' };
  const depois = gameReducer(base, { type: 'SET_CLUB_CAMISA', camisa: nova });
  check('a camisa vai pro clube com a hora da edição', depois.club.camisa?.primaria === '#5E2A84' && !!depois.club.camisa?.editadaEm);
  check('a identidade da Fundação recebe a mesma camisa', (depois.club.identidade as { camisa: CamisaDoClube }).camisa.gola === 'polo');
  check('a formação do manager não muda (a camisa não mexe no jogo)', depois.manager.formationScheme === '4-4-2');
  const semFundacao = gameReducer({ ...base, club: { name: 'Velho', shortName: 'VEL' } } as unknown as OlefootGameState, { type: 'SET_CLUB_CAMISA', camisa: nova });
  check('clube sem Fundação também ganha a camisa (sem inventar identidade)', semFundacao.club.camisa?.primaria === '#5E2A84' && semFundacao.club.identidade === undefined);
}

console.log(`\n${falhou ? '❌' : '✅'} uniforme: ${ok} ok, ${falhou} falhou\n`);
if (falhou) process.exit(1);
