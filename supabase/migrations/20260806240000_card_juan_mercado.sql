-- ════════════════════════════════════════════════════════════════════════════
-- CARD DO JUAN NO MERCADO — 250.000 OLEFOOT
-- ════════════════════════════════════════════════════════════════════════════
-- Decisão do fundador (2026-08-04): "O JUAN não existe, pode colocar do jeito
-- que foi. Pode soltar ele no mercado e cobrar 250.000."
--
-- ── POR QUE OLEFOOT E NÃO EXP ───────────────────────────────────────────────
-- São duas carteiras vivas e diferentes, e o próprio `market.ts` avisa:
--
--     EXP (manager_game_state.finance.ole) é OUTRA moeda e NÃO é tocada aqui.
--
--   • `legacy_players`   → cobra OLEFOOT (créditos do snapshot v1) ou PIX.
--   • `academy_managers` → cobra EXP, mas é mercado P2P: exige vendedor com
--     clube e recusa comprador = vendedor. Não existe listagem "da casa".
--
-- O fundador escolheu o caminho A: card de lenda, na mesma vitrine do Jiva e do
-- Palhinha. Então o número 250.000 vale em OLEFOOT.
--
-- ── ⚠️ `price_bro_cents` NÃO É CENTAVO AQUI ─────────────────────────────────
-- O nome mente. Em `/api/market/buy-legacy` o valor é comparado direto contra a
-- parte INTEIRA de `legacy_olefoot_credits.balance_human`:
--
--     const price = Math.round(Number(row.price_bro_cents));
--     if (intPart < BigInt(price)) → saldo insuficiente
--
-- Ou seja: 250000 aqui = 250.000 OLEFOOT inteiros. Não dividir por 100.
--
-- ── A CASA É A DONA ─────────────────────────────────────────────────────────
-- Juan é ficção criada pela Olefoot, então `house_owned` e o `payment_split`
-- inteiro apontam pra conta da casa. Não há atleta pra remunerar — e deixar a
-- fatia 'player' apontando pra um humano qualquer seria pagar alguém por um
-- jogador que não existe.
--
-- Atributos e OVR 53 vêm da ficha do REVELA depois do acerto de categoria
-- (estava `sub15` com 27 anos, o que segurava a base em 46).
-- ════════════════════════════════════════════════════════════════════════════

insert into public.legacy_players (
  id, name, pos, pos_original, attributes, mint_overall,
  price_bro_cents, currency, listed_on_market,
  country, age, strong_foot, creator_label, rarity_label, tier, card_supply,
  phase, year_start, year_end, main_club,
  collection_id, collection_code, collection_title,
  narrative_title, tagline, bio, portrait_public_url,
  beneficiary_user_id, payment_split, house_owned, agent_profile_enabled
)
values (
  'legacy-juan-revelacao',
  'Juan',
  'LD', 'LD',
  '{"passe":49,"drible":52,"fisico":57,"tatico":50,"fairPlay":53,
    "marcacao":55,"confianca":50,"velocidade":54,"finalizacao":44,
    "mentalidade":50}'::jsonb,
  53,
  250000,          -- ⚠️ OLEFOOT inteiros, não centavos. Ver cabeçalho.
  'OLEFOOT',
  true,
  'Brasil', 27, 'left', 'olefoot', 'ai_plus', 2, 5000,
  'revelacao', 2026, 2026, 'Bola de Ouro',
  'ai-juan-2026', 'AI-JUAN-26', 'Juan — O Incansável Adaptivo',
  'O incansável adaptivo',
  'Não é o mais rápido nem o mais técnico. É o que nunca some do jogo.',
  'Lateral-direito criado pela OLEFOOT. Player DNA: Incansável adaptivo — '
    || 'sustenta a rotina e se encaixa em qualquer cenário.',
  'https://xtuveikgwlgbcleloxia.supabase.co/storage/v1/object/public/revela-talent-photos/talentos/1785791367002-c69m2y6j.png',
  'cc5d5342-c89f-431a-9da5-80882abdc358',
  '[{"kind":"player","label":"Olefoot","percent":50,"user_id":"cc5d5342-c89f-431a-9da5-80882abdc358"},
    {"kind":"olefoot","label":"Olefoot","percent":25,"user_id":"cc5d5342-c89f-431a-9da5-80882abdc358"},
    {"kind":"community","label":"Comunidade","percent":15,"user_id":"cc5d5342-c89f-431a-9da5-80882abdc358"},
    {"kind":"facilitator","label":"Olefoot","percent":10,"user_id":"cc5d5342-c89f-431a-9da5-80882abdc358"}]'::jsonb,
  true,
  false
)
on conflict (id) do update
   set price_bro_cents  = excluded.price_bro_cents,
       listed_on_market = excluded.listed_on_market,
       attributes       = excluded.attributes,
       mint_overall     = excluded.mint_overall,
       updated_at       = now();


-- ── Confere antes de anunciar ───────────────────────────────────────────────
select id, name, pos, mint_overall,
       price_bro_cents as preco_olefoot,
       currency, listed_on_market, house_owned
  from public.legacy_players
 where id = 'legacy-juan-revelacao';


-- ─── OPCIONAL — ligar o card à ficha do REVELA ──────────────────────────────
-- NÃO incluído de propósito. O Juan é ficção, e a vitrine do REVELA promete
-- "descubra quem está chegando" — atleta inventado ali, ao lado do Breno que é
-- gente de verdade, é outra conversa. Card fictício DENTRO DO JOGO é o normal;
-- na vitrine de talentos reais, não.
--
-- Se você decidir que ele fica nos dois lugares:
--   update public.revela_talents
--      set card_legacy_id = 'legacy-juan-revelacao', status = 'carded'
--    where slug = 'juan';
--
-- Se decidir tirar da vitrine e deixar só no jogo (o que eu faria):
--   update public.revela_talents set status = 'rejected' where slug = 'juan';
