/**
 * Self-test: devolução do EXP preso no Exchange removido.
 *
 * O Exchange (câmbio EXP↔BRO) saiu do jogo em 2026-08-01. Anunciar um lote
 * DEBITAVA o EXP na hora, e ele só voltava pelo botão "cancelar" daquela tela.
 * Sem a tela, esse EXP ficaria preso pra sempre — dinheiro do manager destruído
 * por decisão de produto.
 *
 * Este teste prova que `expPresoEmOrdensDoExchange` devolve exatamente o que era
 * do clube, e nada além disso.
 *
 *   npm run test:exchange-refund
 */
import { expPresoEmOrdensDoExchange } from './persistence';

let falhas = 0;

function checa(nome: string, obtido: number, esperado: number) {
  const ok = obtido === esperado;
  if (!ok) falhas++;
  console.log(`${ok ? '✓' : '✗'} ${nome} — esperado ${esperado}, obtido ${obtido}`);
}

const CLUBE = 'clube-do-manager';

// 1. Uma ordem do próprio clube → devolve tudo.
checa(
  'ordem própria devolve o lote inteiro',
  expPresoEmOrdensDoExchange(
    { playerOrders: [{ id: 'a', kind: 'player', sellerClubId: CLUBE, teamName: 'Ole FC', expAmount: 50_000, broCents: 500, createdAtIso: '2026-07-01' }] },
    CLUBE,
  ),
  50_000,
);

// 2. Várias ordens próprias → soma.
checa(
  'duas ordens próprias somam',
  expPresoEmOrdensDoExchange(
    {
      playerOrders: [
        { id: 'a', kind: 'player', sellerClubId: CLUBE, teamName: 'Ole FC', expAmount: 50_000, broCents: 500, createdAtIso: '2026-07-01' },
        { id: 'b', kind: 'player', sellerClubId: CLUBE, teamName: 'Ole FC', expAmount: 25_000, broCents: 250, createdAtIso: '2026-07-02' },
      ],
    },
    CLUBE,
  ),
  75_000,
);

// 3. Ordem de OUTRO clube não é dinheiro meu — não devolve.
checa(
  'ordem de terceiro não devolve nada',
  expPresoEmOrdensDoExchange(
    { playerOrders: [{ id: 'c', kind: 'player', sellerClubId: 'outro-clube', teamName: 'Rival FC', expAmount: 90_000, broCents: 900, createdAtIso: '2026-07-01' }] },
    CLUBE,
  ),
  0,
);

// 4. Mistura: só a parte própria volta.
checa(
  'mistura devolve só a parte própria',
  expPresoEmOrdensDoExchange(
    {
      playerOrders: [
        { id: 'a', kind: 'player', sellerClubId: CLUBE, teamName: 'Ole FC', expAmount: 10_000, broCents: 100, createdAtIso: '2026-07-01' },
        { id: 'c', kind: 'player', sellerClubId: 'outro-clube', teamName: 'Rival FC', expAmount: 90_000, broCents: 900, createdAtIso: '2026-07-01' },
      ],
    },
    CLUBE,
  ),
  10_000,
);

// 5. Save sem exchange nenhum → zero, sem explodir.
checa('save sem exchange devolve zero', expPresoEmOrdensDoExchange(undefined, CLUBE), 0);
checa('exchange vazio devolve zero', expPresoEmOrdensDoExchange({ playerOrders: [] }, CLUBE), 0);

// 6. Lixo no save não vira dinheiro.
checa(
  'ordem com expAmount inválido é ignorada',
  expPresoEmOrdensDoExchange(
    {
      playerOrders: [
        { id: 'x', kind: 'player', sellerClubId: CLUBE, teamName: 'Ole FC', expAmount: Number.NaN, broCents: 100, createdAtIso: '2026-07-01' },
        { id: 'y', kind: 'player', sellerClubId: CLUBE, teamName: 'Ole FC', expAmount: -5_000, broCents: 100, createdAtIso: '2026-07-01' },
      ],
    },
    CLUBE,
  ),
  0,
);

console.log(falhas === 0 ? '\n✅ devolução do Exchange OK' : `\n❌ ${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
