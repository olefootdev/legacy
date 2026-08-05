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
-- ── ESTA MIGRATION É SÓ ESTRUTURA ───────────────────────────────────────────
-- O conserto do Juca é DADO, e dado não é migration: `update ... where id =
-- 'legacy-juca-consolidacao'` num ambiente novo não acha a linha e não faz
-- nada — ou faz em cima de outra coisa. Foi pra `scripts/fix-juca-price.ts`,
-- que roda pela service role, é repetível e deixa log.
--
-- Aqui fica só o trigger, que é o que impede a classe inteira de voltar.
-- ════════════════════════════════════════════════════════════════════════════

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
-- Este SIM é migration: é BACKFILL da regra nova sobre o que já existe, não
-- correção de uma linha específica. Sem ele, a regra só valeria pro futuro e o
-- banco nasceria inconsistente em qualquer ambiente.
--
-- O trigger só age em escrita, então basta tocar as linhas fora da regra — o
-- próprio trigger normaliza.
update public.legacy_players
   set updated_at = now()
 where (coalesce(currency, 'OLEFOOT') = 'OLEFOOT' and coalesce(price_unit_cents, 0) <> 0)
    or (coalesce(currency, 'OLEFOOT') <> 'OLEFOOT' and coalesce(price_bro_cents, 0) <> 0);


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — roda junto e derruba tudo se falhar
-- ════════════════════════════════════════════════════════════════════════════
-- Não é `select` de conferir: é o trigger sendo EXERCITADO. Um card de teste
-- com as duas moedas preenchidas tem que sair com uma zerada — nos dois
-- sentidos. Se não sair, a migration inteira volta atrás.
--
-- (É exatamente o que faltou em 20260806140000, que passou verde executando
-- só o caminho vazio e deixou menor de idade sem conseguir se cadastrar.)
do $$
declare
  v_ole int;
  v_usd int;
begin
  -- Sentido 1: card em USDT não pode carregar preço em OLEFOOT.
  insert into public.legacy_players (id, name, pos, currency, price_unit_cents, price_bro_cents)
  values ('zz-verifica-preco', 'ZZ Verifica', 'ATA', 'USDT', 500, 999999);
  select price_bro_cents into v_ole from public.legacy_players where id = 'zz-verifica-preco';
  if v_ole <> 0 then
    raise exception 'trigger não zerou price_bro_cents em card USDT (ficou %)', v_ole;
  end if;

  -- Sentido 2: e o contrário.
  update public.legacy_players
     set currency = 'OLEFOOT', price_bro_cents = 250000, price_unit_cents = 700
   where id = 'zz-verifica-preco';
  select price_unit_cents, price_bro_cents into v_usd, v_ole
    from public.legacy_players where id = 'zz-verifica-preco';
  if v_usd <> 0 then
    raise exception 'trigger não zerou price_unit_cents em card OLEFOOT (ficou %)', v_usd;
  end if;
  if v_ole <> 250000 then
    raise exception 'trigger comeu o preço que DEVIA ficar (ficou %)', v_ole;
  end if;

  delete from public.legacy_players where id = 'zz-verifica-preco';
  raise notice 'verificação: trigger de preço normaliza nos dois sentidos ✓';
end $$;


-- ── E ninguém ficou com sobra ───────────────────────────────────────────────
do $$
declare
  n int;
begin
  select count(*) into n from public.legacy_players
   where (coalesce(currency, 'OLEFOOT') = 'OLEFOOT' and coalesce(price_unit_cents, 0) <> 0)
      or (coalesce(currency, 'OLEFOOT') <> 'OLEFOOT' and coalesce(price_bro_cents, 0) <> 0);
  if n > 0 then
    raise exception '% card(s) ainda carregam o preço da moeda errada', n;
  end if;
  raise notice 'verificação: nenhum card com preço da moeda errada ✓';
end $$;
