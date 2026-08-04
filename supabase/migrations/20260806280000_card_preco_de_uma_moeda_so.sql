-- ════════════════════════════════════════════════════════════════════════════
-- CARD SÓ CARREGA O PREÇO DA PRÓPRIA MOEDA
-- ════════════════════════════════════════════════════════════════════════════
-- `npm run audit:card-prices` achou uma bomba armada:
--
--   legacy-juca-consolidacao · OVR 80 · currency USDT · US$ 2,00 · 1.000.000 OLEFOOT
--
-- ── SÃO DOIS PROBLEMAS, NÃO UM ──────────────────────────────────────────────
--  1. O 1.000.000 sobrando. Não quebra hoje (a guarda de moeda em buy-legacy
--     barra card não-OLEFOOT), mas vira o preço de venda no dia em que alguém
--     trocar a moeda desse card no painel.
--  2. E o mais imediato, que eu tinha subestimado: **US$ 2,00 num OVR 80**. Se
--     alguém listar como está, sai por ~R$ 10 — enquanto o Palhinha OVR 95 sai
--     por R$ 77 e as outras consolidações vão de US$ 5 a US$ 15. Um card de
--     OVR 80 é o segundo mais forte do catálogo.
--
-- Os dois vêm da mesma origem: a linha foi montada pra OLEFOOT e ficou com um
-- preço em dólar de placeholder.
--
-- ── A ESCOLHA, E ELA É REVERSÍVEL ───────────────────────────────────────────
-- O registro do projeto diz **JUCA = 1M OLE**. Então esta migration assume que
-- a intenção era OLEFOOT e põe a linha coerente com isso: moeda OLEFOOT,
-- 1.000.000, e o dólar zerado.
--
-- Se a intenção era vender por PIX, é UMA LINHA: trocar por
-- `currency='USDT', price_unit_cents=<centavos de dólar>, price_bro_cents=0`.
-- O card SEGUE FORA DE VENDA nos dois casos — nada muda pra comprador nenhum
-- hoje. Só some a armadilha.
-- ════════════════════════════════════════════════════════════════════════════

update public.legacy_players
   set currency         = 'OLEFOOT',
       price_bro_cents  = 1000000,   -- 1.000.000 OLEFOOT (inteiro, não centavo)
       price_unit_cents = 0,
       updated_at       = now()
 where id = 'legacy-juca-consolidacao';


-- ════════════════════════════════════════════════════════════════════════════
-- E A CLASSE INTEIRA, PRA NÃO VOLTAR
-- ════════════════════════════════════════════════════════════════════════════
-- Um card carregar o preço da OUTRA moeda é sempre erro, e é um erro fácil de
-- cometer: o painel de admin abre card novo com `currency='OLEFOOT'` e
-- `price_bro_cents=50000` por padrão. Trocar a moeda pra USDT e esquecer de
-- limpar o campo antigo arma a bomba de novo, em silêncio.
--
-- ── TRIGGER QUE NORMALIZA, NÃO CHECK QUE REJEITA ────────────────────────────
-- Um `check` constraint rejeitaria o save e o painel mostraria erro cru de
-- Postgres pra quem só queria mudar a moeda — atrito por uma correção que a
-- gente sabe fazer sozinho. O trigger zera o campo que não pertence àquela
-- moeda e deixa passar. O dado fica certo sem ninguém precisar lembrar.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.legacy_preco_de_uma_moeda_so()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.currency, 'OLEFOOT') = 'OLEFOOT' then
    new.price_unit_cents := 0;   -- preço em dólar não vale pra card OLEFOOT
  else
    new.price_bro_cents := 0;    -- preço em OLEFOOT não vale pra card em dólar
  end if;
  return new;
end;
$$;

drop trigger if exists legacy_players_preco_coerente on public.legacy_players;
create trigger legacy_players_preco_coerente
  before insert or update of currency, price_bro_cents, price_unit_cents
  on public.legacy_players
  for each row
  execute function public.legacy_preco_de_uma_moeda_so();

comment on function public.legacy_preco_de_uma_moeda_so() is
  'Zera o preço da moeda que o card NÃO usa. Evita a bomba: preço antigo virar '
  'preço de venda quando alguém troca a moeda no painel. Ver 20260806280000.';


-- ── Limpa quem já estava com sobra ──────────────────────────────────────────
-- O trigger só age em escrita. Este update passa por todo mundo uma vez — e
-- dispara o próprio trigger, que faz a normalização.
update public.legacy_players
   set updated_at = now()
 where (coalesce(currency, 'OLEFOOT') = 'OLEFOOT' and coalesce(price_unit_cents, 0) <> 0)
    or (coalesce(currency, 'OLEFOOT') <> 'OLEFOOT' and coalesce(price_bro_cents, 0) <> 0);


-- ─── Verificação ────────────────────────────────────────────────────────────
-- Tem que voltar VAZIO:
select id, name, currency, price_unit_cents, price_bro_cents, listed_on_market
  from public.legacy_players
 where (coalesce(currency, 'OLEFOOT') = 'OLEFOOT' and coalesce(price_unit_cents, 0) <> 0)
    or (coalesce(currency, 'OLEFOOT') <> 'OLEFOOT' and coalesce(price_bro_cents, 0) <> 0);

-- E o Juca, coerente:
select id, currency, price_unit_cents, price_bro_cents, listed_on_market
  from public.legacy_players
 where id = 'legacy-juca-consolidacao';
