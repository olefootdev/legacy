/**
 * SORTEIO DA FUNDAÇÃO DO CLUBE (Fase 2, 2026-10-07).
 *
 * POST /api/onboarding/sorteio  (Bearer obrigatório)
 *
 * O elenco inicial sai daqui, não do cliente:
 *   · 12 Genesis do catálogo listado (2 GOL, 4 DEF, 3 MEI, 3 ATA; tiers de base);
 *   · 3 cards premium, cada um com chance de virar LENDA — 60%, 45%, 30%
 *     (decisão do fundador; eram 35/25/15 até 08/10/2026). ~85% dos clubes
 *     saem com pelo menos uma lenda, e a média é 1,35 por sorteio. O pool de
 *     lendas são as `legacy_players` listadas — os craques que criamos. Lenda = EDIÇÃO FUNDAÇÃO: cópia jogável de uma
 *     legacy_player listada, que não conta no supply e não se vende. Sem
 *     lenda, o card vem do topo do catálogo Genesis (gold/next/ultra rare);
 *   · a faixa de EXP inicial (mesmos pesos de `rollStarterExp`).
 *
 * Aleatoriedade: `crypto.randomInt`. O resultado é gravado em
 * `welcome_pack_grants.sorteio`: pedir de novo devolve O MESMO sorteio, então
 * limpar o navegador não vira re-sorteio até sair lenda. A vaga é reservada
 * pela mesma RPC de sempre (`claim_welcome_pack`, com o teto de lançamento).
 *
 * Devolve só IDS (+ chances); o cliente monta os PlayerEntity com os
 * mapeadores que já existem (Genesis → contrato de boas-vindas; legacy →
 * Edição Fundação).
 */
import { Hono } from 'hono';
import { randomInt } from 'node:crypto';
import { rateLimit } from '../lib/rateLimit.js';
import { donoDaSessao } from '../lib/sessao.js';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';

export const CHANCES_DE_LENDA = [0.6, 0.45, 0.3] as const;
/** Mesmos pesos de `src/onboarding/rollStarterExp.ts` (índice da faixa). */
const PESOS_EXP = [20, 35, 25, 15, 5];

type Grupo = 'GOL' | 'DEF' | 'MEI' | 'ATA';
const COTA: Record<Grupo, number> = { GOL: 2, DEF: 4, MEI: 3, ATA: 3 };
const GRUPO_DA_POS: Record<string, Grupo> = {
  GOL: 'GOL', ZAG: 'DEF', LD: 'DEF', LE: 'DEF', LAT: 'DEF',
  VOL: 'MEI', MC: 'MEI', MEI: 'MEI', CAM: 'MEI',
  PE: 'ATA', PD: 'ATA', ATA: 'ATA', CA: 'ATA',
};

/** Espelha `classifyRarity` (src/onboarding/draftStarterSquad.ts). */
export function tierDoRotulo(label: string | null | undefined): 'basic' | 'rare' | 'epic' | 'legendary' {
  const u = (label ?? '').trim().toLowerCase();
  if (['epic', 'legend', 'legendary', 'ultra rare', 'ultra_rare', 'mythic', 'mitico'].includes(u)) return 'legendary';
  if (['gold', 'ouro', 'retro', 'classic', 'next', 'epico', 'champion'].includes(u)) return 'epic';
  if (['rare', 'raro', 'silver', 'prata', 'premium'].includes(u)) return 'rare';
  return 'basic';
}

export interface Sorteio {
  versao: 1;
  genesis: string[];
  premium: Array<{ tipo: 'lenda' | 'premium'; id: string; chance: number }>;
  expTier: number;
  sorteadoEm: string;
}

type Linha = { id: string; pos: string | null; rarity_label: string | null; name?: string | null };

/** Fases do legacy (espelha `samePersonKey` em src/entities/player.ts). */
const FASES_LEGACY = ['revelacao', 'consolidacao', 'expansao'];

/**
 * MESMA PESSOA: o catálogo Genesis tem raridades da mesma pessoa (mesmo nome,
 * GEN-xxx diferente) e o legacy tem fases (legacy-<slug>-<fase>). O jogo não
 * escala duas da mesma pessoa — o sorteio não entrega duas.
 */
export function pessoaDe(l: { id: string; name?: string | null }): string {
  if (l.id.startsWith('legacy-')) {
    let base = l.id;
    for (const f of FASES_LEGACY) if (base.endsWith(`-${f}`)) { base = base.slice(0, -(f.length + 1)); break; }
    return `legacy:${base}`;
  }
  const nome = (l.name ?? '').trim().toLowerCase();
  return nome ? `genesis:${nome}` : `id:${l.id}`;
}

/** Sorteia `n` de `pool` sem repetir PESSOA já sorteada (`usados` guarda `pessoaDe`). */
function pegar<T extends { id: string; name?: string | null }>(pool: T[], n: number, usados: Set<string>, rnd: (max: number) => number): T[] {
  const livres = pool.filter((p) => !usados.has(pessoaDe(p)));
  const out: T[] = [];
  while (out.length < n && livres.length > 0) {
    const [x] = livres.splice(rnd(livres.length), 1);
    const k = pessoaDe(x!);
    if (usados.has(k)) continue; // duas raridades da mesma pessoa no pool
    usados.add(k);
    out.push(x!);
  }
  return out;
}

/**
 * O sorteio em si, puro (rnd injetável pra teste). Genesis de base por grupo;
 * falta de grupo completa com o resto da base; premium: lenda pela chance,
 * senão topo do catálogo.
 */
export function sortear(
  genesis: Linha[],
  lendas: { id: string; name?: string | null }[],
  rnd: (max: number) => number,
  agora = new Date(),
): Sorteio | null {
  const base = genesis.filter((g) => ['basic', 'rare'].includes(tierDoRotulo(g.rarity_label)));
  const topo = genesis.filter((g) => ['epic', 'legendary'].includes(tierDoRotulo(g.rarity_label)));
  const usados = new Set<string>();
  const doze: Linha[] = [];
  for (const g of Object.keys(COTA) as Grupo[]) {
    doze.push(...pegar(base.filter((l) => GRUPO_DA_POS[(l.pos ?? '').toUpperCase()] === g), COTA[g], usados, rnd));
  }
  if (doze.length < 12) doze.push(...pegar(base, 12 - doze.length, usados, rnd));
  if (doze.length < 12) doze.push(...pegar(genesis, 12 - doze.length, usados, rnd));
  if (doze.length < 12) return null;

  const lendasUsadas = new Set<string>();
  const premium: Sorteio['premium'] = [];
  for (const chance of CHANCES_DE_LENDA) {
    // Sorteio em milésimos: 35% = 350 de 1000.
    const deuLenda = rnd(1000) < Math.round(chance * 1000);
    const lenda = deuLenda ? pegar(lendas, 1, lendasUsadas, rnd)[0] : undefined;
    if (lenda) {
      premium.push({ tipo: 'lenda', id: lenda.id, chance });
      continue;
    }
    const card = pegar(topo, 1, usados, rnd)[0] ?? pegar(genesis, 1, usados, rnd)[0];
    if (!card) return null;
    premium.push({ tipo: 'premium', id: card.id, chance });
  }

  const totalPeso = PESOS_EXP.reduce((a, b) => a + b, 0);
  let r = rnd(totalPeso);
  let expTier = 0;
  for (let i = 0; i < PESOS_EXP.length; i++) {
    r -= PESOS_EXP[i]!;
    if (r < 0) { expTier = i; break; }
  }

  return { versao: 1, genesis: doze.map((d) => d.id), premium, expTier, sorteadoEm: agora.toISOString() };
}

export const onboardingRoutes = new Hono();

onboardingRoutes.post('/api/onboarding/sorteio', rateLimit(10), async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, error: 'Serviço indisponível.' }, 503);
  const uid = await donoDaSessao(c.req.header('Authorization'));
  if (!uid) return c.json({ ok: false, error: 'Sessão expirada. Entra de novo.' }, 401);

  // 1) Já sorteou? Devolve o MESMO (idempotente — sem re-sorteio).
  const { data: grant } = await sb.from('welcome_pack_grants').select('sorteio').eq('user_id', uid).maybeSingle();
  const salvo = (grant as { sorteio?: Sorteio | null } | null)?.sorteio;
  if (salvo?.versao === 1) return c.json({ ok: true, sorteio: salvo, repetido: true });

  // 2) Vaga: quem não tem grant reserva pela RPC de sempre (teto de lançamento).
  //    Quem já tinha grant da cerimônia antiga (sorteio nulo) — manager antigo
  //    que perdeu o plantel — sorteia UMA vez e fica gravado.
  if (!grant) {
    const { data: claim, error: claimErr } = await sb.rpc('claim_welcome_pack', { p_manager_id: uid });
    if (claimErr) return c.json({ ok: false, error: claimErr.message }, 500);
    const row = (Array.isArray(claim) ? claim[0] : claim) as { claimed?: boolean } | null;
    if (!row?.claimed) {
      return c.json({ ok: false, error: 'As vagas do pacote de lançamento acabaram.' }, 409);
    }
  }

  // 3) Pools reais.
  const [{ data: gen, error: genErr }, { data: leg, error: legErr }] = await Promise.all([
    sb.from('genesis_market_players').select('id, name, pos, rarity_label, contract_is_lifetime').eq('listed_on_market', true),
    sb.from('legacy_players').select('id, name').eq('listed_on_market', true),
  ]);
  if (genErr || legErr) return c.json({ ok: false, error: (genErr ?? legErr)!.message }, 500);
  const genesis = ((gen ?? []) as (Linha & { contract_is_lifetime?: boolean | null })[])
    .filter((g) => g.id && g.contract_is_lifetime !== true);
  const sorteio = sortear(genesis, (leg ?? []) as { id: string; name: string | null }[], (max) => randomInt(max));
  if (!sorteio) return c.json({ ok: false, error: 'Catálogo Genesis insuficiente pro sorteio.' }, 503);

  // 4) Grava (upsert: cobre o grant recém-criado pela RPC e o grant antigo).
  const { error: upErr } = await sb
    .from('welcome_pack_grants')
    .upsert({ user_id: uid, pack_version: 3, sorteio }, { onConflict: 'user_id' });
  if (upErr) return c.json({ ok: false, error: upErr.message }, 500);

  return c.json({ ok: true, sorteio, repetido: false });
});
