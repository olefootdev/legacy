-- ============================================================
-- PLAYERVIP — backfill de card_sales (a 1ª venda real não aparece pro atleta)
--
-- O PROBLEMA
-- O Marcelo vendeu um card em 2026-07-08 (R$ 27,03, intent
-- 1d1dcb87-89b1-4be9-b877-bcb2fdefbb0b, card ...-expansao). O split rodou e
-- creditou de verdade em `wallet_credits`:
--     R$ 13,51  card_split:<intent>:player       -> Marcelo (ad84874a)
--     R$  2,70  card_split:<intent>:facilitator  -> a18f9b72
-- (olefoot 25% e comunidade 15% têm user_id null no split e, por desenho, não
--  geram crédito — ficam com a plataforma.)
--
-- MAS o painel do atleta lê `card_sales`, não `wallet_credits`:
--     get_my_withdrawable_balance() = sum(card_sales.owner_cents) - saques
--     get_my_card_sales() / get_my_card_sales_summary() -> idem
-- E `card_sales` está VAZIA. Motivo: quem popula é o trigger
-- `trg_record_card_sale_from_split` (migration 20260712130000, aplicada em
-- 2026-07-13) — e trigger NÃO roda retroativo. A venda é 5 dias mais velha.
--
-- Resultado: o Marcelo abre o PLAYERVIP e vê R$ 0,00 e "nenhuma venda", mesmo
-- tendo R$ 13,51 a receber. Antes de lançar mais atleta, isso tem que fechar.
--
-- O QUE ESTA MIGRATION FAZ
-- Reprocessa TODO crédito `card_split:*` que ainda não tem linha em card_sales,
-- reproduzindo exatamente o que o trigger faria. Idempotente: o `source_ref` é
-- único e o insert tem `on conflict do nothing` — rodar 2× não duplica.
--
-- E CORRIGE O DESTINO DO FACILITADOR
-- Os R$ 2,70 foram creditados em 2026-07-08 para `a18f9b72` (ramonsennabh), que
-- era o que estava no split NAQUELE momento; a migration 20260713120000 corrigiu
-- o facilitador para `cb0292e2` (ramonsennausa) SEIS DIAS DEPOIS da venda. São
-- duas contas reais do MESMO Ramon (mesmo e-mail base, ambas com login em
-- 2026-06-04). O fundador confirmou `ramonsennausa` como a conta boa, então o
-- crédito é remanejado pra lá (2026-07-17). Não tira dinheiro de ninguém: é a
-- mesma pessoa, e a conta destino é a que ele vai usar no lançamento.
-- ============================================================

-- CTE primeiro: o trigger envolvia o cast ::uuid num begin/exception, mas um
-- `insert ... select` não tem essa rede — um único reason malformado abortaria
-- o backfill inteiro. Filtramos por regex ANTES de castar.
with parsed as (
  select
    wc.user_id,
    wc.bro_cents,
    wc.created_at,
    split_part(wc.reason, ':', 2) as intent_txt,
    split_part(wc.reason, ':', 3) as role
  from public.wallet_credits wc
  where wc.reason like 'card_split:%'
    and wc.user_id is not null
    and wc.bro_cents > 0
    and split_part(wc.reason, ':', 3) in ('player', 'facilitator')
    and split_part(wc.reason, ':', 2)
        ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
),
ready as (
  select
    p.*,
    ('pixcard:' || p.intent_txt || ':' || p.role || ':' || p.user_id::text) as source_ref
  from parsed p
)
insert into public.card_sales (
  legacy_player_id, collection_id, beneficiary_user_id, buyer_user_id,
  currency, gross_cents, owner_cents, payment_method, role, source_ref, created_at
)
select
  pi.product_ref,
  lp.collection_id,
  r.user_id,
  pi.user_id,
  'BRO',
  pi.amount_cents,
  r.bro_cents,
  'pix',
  r.role,
  r.source_ref,
  -- Preserva a data REAL da venda, não a do backfill: o histórico do atleta
  -- precisa bater com o extrato dele.
  coalesce(pi.paid_at, r.created_at)
from ready r
join public.payment_intents pi on pi.id = r.intent_txt::uuid
left join public.legacy_players lp on lp.id = pi.product_ref
where not exists (
  select 1 from public.card_sales cs where cs.source_ref = r.source_ref
)
on conflict (source_ref) do nothing;

-- ─── Correção do destino do facilitador ────────────────────────────────────
-- Feita DEPOIS do backfill: assim a linha de card_sales já existe e é remanejada
-- junto com o crédito, mantendo os dois lados coerentes.
--
-- Escopo cirúrgico: SÓ o crédito de facilitador da venda 1d1dcb87 que ainda
-- estiver apontando pra conta antiga. Guardas: não roda se as contas não
-- existirem, e não roda de novo se já foi movido (idempotente).
do $$
declare
  v_wrong uuid := 'a18f9b72-8e9e-469b-b745-4c4de2c3457f'; -- ramonsennabh (antiga)
  v_right uuid := 'cb0292e2-21c4-47af-97e3-0f586adae383'; -- ramonsennausa (confirmada)
  v_intent text := '1d1dcb87-89b1-4be9-b877-bcb2fdefbb0b';
  v_moved int;
begin
  if not exists (select 1 from auth.users where id = v_right) then
    raise notice 'conta destino não existe — nada movido';
    return;
  end if;

  -- 1) o crédito
  update public.wallet_credits
     set user_id = v_right
   where user_id = v_wrong
     and reason = 'card_split:' || v_intent || ':facilitator';
  get diagnostics v_moved = row_count;
  raise notice 'wallet_credits movidos: %', v_moved;

  -- 2) a linha de card_sales correspondente. O source_ref embute o uid, então
  --    precisa ser reescrito junto — senão o próximo backfill recria a linha
  --    antiga achando que faltou.
  update public.card_sales
     set beneficiary_user_id = v_right,
         source_ref = 'pixcard:' || v_intent || ':facilitator:' || v_right::text
   where beneficiary_user_id = v_wrong
     and source_ref = 'pixcard:' || v_intent || ':facilitator:' || v_wrong::text;
  get diagnostics v_moved = row_count;
  raise notice 'card_sales movidos: %', v_moved;
end $$;

-- ─── Conferência (aparece no resultado do SQL Editor) ──────────────────────
select
  cs.role,
  cs.beneficiary_user_id,
  (select email from auth.users u where u.id = cs.beneficiary_user_id) as quem,
  cs.gross_cents  as venda_bruta_cents,
  cs.owner_cents  as recebe_cents,
  cs.currency,
  cs.created_at
from public.card_sales cs
order by cs.created_at desc;
