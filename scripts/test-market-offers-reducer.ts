/**
 * Self-test das actions P2P de negociação no reducer (a parte local/testável).
 * A transferência real é server-authoritative; aqui provo o espelho de estado:
 * sync das ofertas, entrega ao comprador (set OLE autoritativo, idempotente) e
 * remoção no vendedor (sem re-crédito — EXP vem por wallet_credits).
 *
 * Uso: npm run test:market-offers-reducer
 */
import { gameReducer } from '../src/game/reducer';
import type { OlefootGameState, GameAction, MarketOffer } from '../src/game/types';
import type { PlayerEntity } from '../src/entities/types';

let fail = 0;
const check = (l: string, ok: boolean, d = '') => { console.log(ok ? `  ✅ ${l}` : `  ❌ ${l} ${d}`); if (!ok) fail++; };

const mkPlayer = (id: string): PlayerEntity => ({
  id, name: id.toUpperCase(), pos: 'ATA', num: 9,
  attrs: { passe: 70, marcacao: 70, velocidade: 70, drible: 70, finalizacao: 70, fisico: 70, tatico: 70, mentalidade: 70, confianca: 70, fairPlay: 70 },
  fatigue: 20, injuryRisk: 5, outForMatches: 0, evolutionXp: 0,
} as unknown as PlayerEntity);

function baseState(): OlefootGameState {
  return {
    club: { id: 'c1', name: 'Ole FC', shortName: 'OLE' },
    finance: { ole: 500_000, broCents: 0, expLifetimeEarned: 0, expHistory: [] },
    players: { mine1: mkPlayer('mine1'), mine2: mkPlayer('mine2') },
    playerHealth: {},
    lineup: { ATA1: 'mine1' },
    inbox: [], results: [], form: [],
    managerProspectMarket: { ownListings: [{ listingId: 'L1', playerId: 'mine1', priceExp: 300_000, listedAtIso: '2026-07-21' }], npcOffers: [] },
  } as unknown as OlefootGameState;
}

const offer = (over: Partial<MarketOffer> = {}): MarketOffer => ({
  offerId: 'o1', listingId: 'L1', gamePlayerId: 'mine1', playerName: 'MINE1', playerOverall: 78,
  buyerUserId: 'buyer', buyerClubName: 'Katsu FC', sellerUserId: 'me', offerExp: 250_000,
  status: 'pending', createdAtIso: '2026-07-21', ...over,
});

console.log('\n🤝 NEGOCIAÇÃO P2P — reducer\n');

// ── 1) SET_MARKET_OFFERS sincroniza recebidas/enviadas ──
{
  let s = baseState();
  s = gameReducer(s, { type: 'SET_MARKET_OFFERS', incoming: [offer()], outgoing: [offer({ offerId: 'o2', sellerUserId: 'other', buyerUserId: 'me', gamePlayerId: 'wanted1' })] } as GameAction);
  check('recebidas sincronizadas', s.managerProspectMarket.incomingOffers?.length === 1);
  check('enviadas sincronizadas', s.managerProspectMarket.outgoingOffers?.length === 1);
}

// ── 2) Comprador: proposta aceita → entrega jogador + SETA OLE (não re-deduz) ──
{
  let s = baseState();
  s = gameReducer(s, { type: 'SET_MARKET_OFFERS', incoming: [], outgoing: [offer({ buyerUserId: 'me', gamePlayerId: 'wanted1' })] } as GameAction);
  const bought = mkPlayer('wanted1');
  s = gameReducer(s, { type: 'APPLY_OFFER_ACCEPTED_AS_BUYER', player: bought, priceExp: 250_000, ole: 250_000 } as GameAction);
  check('jogador comprado entra no plantel', !!s.players['wanted1']);
  check('OLE setado ao valor autoritativo (não re-deduz)', s.finance.ole === 250_000, `ole=${s.finance.ole}`);
  check('pontuou compra_jogador', (s.managerScore?.total ?? 0) >= 15, `score=${s.managerScore?.total}`);
  check('removeu da lista de enviadas', (s.managerProspectMarket.outgoingOffers ?? []).every((o) => o.gamePlayerId !== 'wanted1'));
  check('inbox avisa proposta aceita', s.inbox.some((i) => /proposta aceita/i.test(i.title ?? '')));
  // idempotência: aplicar de novo não duplica nem muda OLE
  const before = s.finance.ole;
  s = gameReducer(s, { type: 'APPLY_OFFER_ACCEPTED_AS_BUYER', player: bought, priceExp: 250_000, ole: 250_000 } as GameAction);
  check('idempotente: jogador não duplica, OLE inalterado', s.finance.ole === before && !!s.players['wanted1']);
}

// ── 3) Vendedor: venda liquidada → remove do plantel/escalação, sem re-crédito ──
{
  let s = baseState();
  s = gameReducer(s, { type: 'SET_MARKET_OFFERS', incoming: [offer()], outgoing: [] } as GameAction);
  const oleBefore = s.finance.ole;
  s = gameReducer(s, { type: 'APPLY_OFFER_SETTLED_AS_SELLER', playerId: 'mine1', playerName: 'MINE1', creditExp: 250_000, buyerClubName: 'Katsu FC' } as GameAction);
  check('jogador vendido sai do plantel', !s.players['mine1']);
  check('sai da escalação', !Object.values(s.lineup).includes('mine1'));
  check('NÃO re-credita OLE local (vem por wallet_credits)', s.finance.ole === oleBefore, `ole=${s.finance.ole}`);
  check('sai das listagens próprias', s.managerProspectMarket.ownListings.every((l) => l.playerId !== 'mine1'));
  check('pontuou venda_jogador', (s.managerScore?.total ?? 0) >= 20, `score=${s.managerScore?.total}`);
  check('inbox avisa venda', s.inbox.some((i) => /vendeste/i.test(i.title ?? '')));
}

console.log(fail === 0 ? '\n✅ NEGOCIAÇÃO P2P (reducer) — tudo passou\n' : `\n❌ ${fail} falha(s)\n`);
if (fail > 0) process.exit(1);
