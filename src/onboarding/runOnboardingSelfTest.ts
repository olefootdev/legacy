/**
 * Self-test do núcleo econômico do onboarding (PR 1).
 *
 * Roda com `npm run test:onboarding`. Sem dependências de runtime de teste —
 * usamos `assert` padrão pra manter o estilo dos outros self-tests do repo.
 */
import assert from 'node:assert/strict';
import { createSeededRng } from './seededRng';
import {
  STARTER_EXP_TIERS,
  rollStarterExp,
  totalStarterExpWeight,
} from './rollStarterExp';
import {
  STARTER_SQUAD_SIZE,
  STARTER_RARITY_QUOTA,
  STARTER_MIN_GOL,
  draftStarterSquad,
  classifyRarity,
  type DraftablePlayerRow,
  type RarityTier,
} from './draftStarterSquad';
import {
  DAILY_BONUS_MIN_INTERVAL_MS,
  DAILY_BONUS_MAX_INTERVAL_MS,
  DAILY_BONUS_LOOP_LENGTH,
  evaluateDailyClaim,
  applyDailyClaim,
} from './dailyBonus';

const HOUR_MS = 60 * 60 * 1000;

function makePool(): DraftablePlayerRow[] {
  // Pool generoso: 60 basic, 25 rare, 12 epic, 4 legendary, com mistura de pos.
  const positions = ['GOL', 'ZAG', 'LD', 'LE', 'VOL', 'MEI', 'PD', 'PE', 'ATA'];
  const out: DraftablePlayerRow[] = [];
  let id = 0;
  const push = (count: number, label: string) => {
    for (let i = 0; i < count; i++) {
      out.push({
        id: `p${id++}`,
        pos: positions[id % positions.length] ?? 'MEI',
        rarity_label: label,
      });
    }
  };
  // Labels seguem convenção Genesis (ver classifyRarity):
  //   'basic' → basic, 'rare' → rare, 'gold' → epic, 'legendary' → legendary
  push(60, 'basic');
  push(25, 'rare');
  push(12, 'gold');
  push(4, 'legendary');
  return out;
}

function testSeededRngDeterministic(): void {
  const a = createSeededRng(42);
  const b = createSeededRng(42);
  for (let i = 0; i < 100; i++) {
    assert.equal(a.next(), b.next(), 'mesma seed deve produzir mesma sequência');
  }
  console.log('  ✓ seededRng determinístico');
}

function testRollStarterExp(): void {
  const total = totalStarterExpWeight();
  assert.equal(total, 100, 'soma dos pesos deve ser 100');

  const counts = new Map<string, number>();
  const rng = createSeededRng(7);
  const N = 20_000;
  for (let i = 0; i < N; i++) {
    const tier = rollStarterExp(rng);
    counts.set(tier.id, (counts.get(tier.id) ?? 0) + 1);
  }
  // Tolerância de 25% sobre o esperado — distribuição empírica.
  for (const t of STARTER_EXP_TIERS) {
    const observed = (counts.get(t.id) ?? 0) / N;
    const expected = t.weight / total;
    const ratio = observed / expected;
    assert.ok(
      ratio > 0.75 && ratio < 1.25,
      `tier ${t.id}: observed=${observed.toFixed(3)} expected=${expected.toFixed(3)}`,
    );
  }
  console.log('  ✓ rollStarterExp distribuição dentro de ±25%');
}

function testDraftDeterministic(): void {
  const pool = makePool();
  const r1 = draftStarterSquad(pool, createSeededRng(1234));
  const r2 = draftStarterSquad(pool, createSeededRng(1234));
  assert.ok(r1 && r2, 'deve sortear');
  assert.deepEqual(
    r1!.selected.map((p) => p.id),
    r2!.selected.map((p) => p.id),
    'mesma seed → mesmo plantel',
  );
  console.log('  ✓ draft determinístico para mesma seed');
}

function testDraftQuotaAndGoalkeepers(): void {
  const pool = makePool();
  const result = draftStarterSquad(pool, createSeededRng(99));
  assert.ok(result, 'esperava resultado');
  const r = result!;
  assert.equal(r.selected.length, STARTER_SQUAD_SIZE, 'tamanho 25');

  const tierCounts: Record<RarityTier, number> = {
    basic: 0, rare: 0, epic: 0, legendary: 0,
  };
  for (const p of r.selected) tierCounts[classifyRarity(p.rarity_label)]++;

  // Cota mínima por raridade respeitada. Pode ter MAIS de uma raridade alta
  // se a troca de goleiros (GK swap) substituiu basics por GOLs raros.
  assert.ok(tierCounts.legendary >= STARTER_RARITY_QUOTA.legendary, 'legendary >= cota');
  assert.ok(tierCounts.epic >= STARTER_RARITY_QUOTA.epic, 'epic >= cota');
  assert.ok(tierCounts.rare >= STARTER_RARITY_QUOTA.rare, 'rare >= cota');
  // Total exato.
  const totalTiers = tierCounts.basic + tierCounts.rare + tierCounts.epic + tierCounts.legendary;
  assert.equal(totalTiers, STARTER_SQUAD_SIZE, 'soma dos tiers = 25');

  const golCount = r.selected.filter((p) => p.pos === 'GOL').length;
  assert.ok(golCount >= STARTER_MIN_GOL, `min ${STARTER_MIN_GOL} goleiros (achou ${golCount})`);

  assert.equal(r.top3.length, 3, 'top3 tem 3 jogadores');
  console.log('  ✓ draft cota + min goleiros + top3');
}

function testDraftReturnsNullOnSmallPool(): void {
  const tiny = makePool().slice(0, 10);
  const result = draftStarterSquad(tiny, createSeededRng(1));
  assert.equal(result, null, 'pool pequeno deve retornar null');
  console.log('  ✓ draft retorna null em pool insuficiente');
}

function testDailyBonusFreshClaim(): void {
  const ev = evaluateDailyClaim({}, 1_000_000);
  assert.equal(ev.canClaim, true);
  assert.equal(ev.nextStreakDay, 1);
  assert.equal(ev.streakBroken, false);
  console.log('  ✓ daily: primeira reivindicação é dia 1');
}

function testDailyBonusBlockedTooSoon(): void {
  const last = 10_000_000;
  const ev = evaluateDailyClaim({ lastClaimMs: last, streakDay: 1 }, last + 5 * HOUR_MS);
  assert.equal(ev.canClaim, false);
  assert.equal(ev.blockReason, 'too_soon');
  assert.ok(ev.msUntilNext! > 0);
  console.log('  ✓ daily: < 20h bloqueia com msUntilNext');
}

function testDailyBonusAdvancesStreak(): void {
  let st = applyDailyClaim({}, 0).next;
  assert.equal(st.streakDay, 1);
  // Avança dia a dia em janelas de 24h (entre 20h e 48h).
  for (let day = 2; day <= DAILY_BONUS_LOOP_LENGTH; day++) {
    const now = (st.lastClaimMs ?? 0) + 24 * HOUR_MS;
    const ev = evaluateDailyClaim(st, now);
    assert.equal(ev.canClaim, true);
    assert.equal(ev.nextStreakDay, day);
    st = applyDailyClaim(st, now).next;
    assert.equal(st.streakDay, day);
  }
  // Próximo claim depois do dia 7 → loopa para 1.
  const now = (st.lastClaimMs ?? 0) + 24 * HOUR_MS;
  const evLoop = evaluateDailyClaim(st, now);
  assert.equal(evLoop.nextStreakDay, 1, 'loopa de 7 → 1');
  console.log('  ✓ daily: avança dia 1 → 7 e loopa');
}

function testDailyBonusResetsAfter48h(): void {
  const last = 10_000_000;
  const st = { lastClaimMs: last, streakDay: 5 };
  const ev = evaluateDailyClaim(st, last + DAILY_BONUS_MAX_INTERVAL_MS + HOUR_MS);
  assert.equal(ev.canClaim, true);
  assert.equal(ev.streakBroken, true);
  assert.equal(ev.nextStreakDay, 1);
  console.log('  ✓ daily: > 48h reseta streak para 1');
}

function testDailyBonusBoundary(): void {
  const last = 10_000_000;
  // Exatamente 20h: liberado.
  const ev20 = evaluateDailyClaim({ lastClaimMs: last, streakDay: 2 }, last + DAILY_BONUS_MIN_INTERVAL_MS);
  assert.equal(ev20.canClaim, true);
  // 1ms antes de 20h: bloqueado.
  const evJustBefore = evaluateDailyClaim({ lastClaimMs: last, streakDay: 2 }, last + DAILY_BONUS_MIN_INTERVAL_MS - 1);
  assert.equal(evJustBefore.canClaim, false);
  console.log('  ✓ daily: borda de 20h tratada corretamente');
}

function main(): void {
  console.log('• onboarding self-test');
  testSeededRngDeterministic();
  testRollStarterExp();
  testDraftDeterministic();
  testDraftQuotaAndGoalkeepers();
  testDraftReturnsNullOnSmallPool();
  testDailyBonusFreshClaim();
  testDailyBonusBlockedTooSoon();
  testDailyBonusAdvancesStreak();
  testDailyBonusResetsAfter48h();
  testDailyBonusBoundary();
  console.log('✓ onboarding self-test OK');
}

main();
