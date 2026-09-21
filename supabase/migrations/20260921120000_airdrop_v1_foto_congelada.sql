-- ════════════════════════════════════════════════════════════════════════════
-- A foto do airdrop da v1 para de se mexer
-- ════════════════════════════════════════════════════════════════════════════
-- Decisão do fundador (D2): o saldo de quem tinha OLEFOOT na carteira antiga
-- vira um AIRDROP À PARTE — não entra no jogo, o jogo só precisa do endereço
-- Solana assinado.
--
-- O problema medido em 2026-09-21: esse saldo mora em
-- `legacy_olefoot_credits.balance_human`, e essa é a MESMA coluna que
-- `/api/market/buy-legacy` debita quando alguém compra uma lenda
-- (server/src/routes/market.ts:358). Ou seja: a "foto" da v1 é uma coluna viva,
-- que encolhe conforme se joga. Não existe cópia do valor original — o
-- `credited_amount` só foi preenchido em 20 das 168 linhas.
--
-- Estado no momento do congelamento:
--     168 linhas · 639.037.272 no total · 69 com saldo > 0
--     snapshot da BSC tirado em 2026-05-31 (data única)
--     das 20 linhas auditáveis, 18 intactas e 2 gastaram ~2.000.002 no total
--
-- Daqui pra frente o airdrop lê ESTA tabela, que ninguém escreve. Se o jogo
-- continuar debitando `legacy_olefoot_credits`, a foto não muda junto — que é
-- exatamente o ponto.
--
-- 🔴 Esta tabela NÃO é o saldo do jogo. O saldo do jogo é OLEXP e é fictício.
-- Aqui é o registro de quanto cada endereço da BSC tinha quando a v1 fechou.

create table if not exists public.airdrop_v1_snapshot (
  user_id          uuid primary key,
  email            text,
  -- Endereço da carteira BSC de onde veio o saldo. É a PROVENIÊNCIA, não o
  -- destino: o destino é a carteira Solana assinada (solana_wallet_links), que
  -- pode ser vinculada depois e não se congela aqui.
  bsc_wallet       text,
  saldo_congelado  numeric(38, 8) not null,
  -- Quando a foto da BSC foi tirada (vem de legacy_olefoot_credits.snapshot_at).
  snapshot_at      timestamptz,
  -- Quando ESTA linha foi congelada aqui.
  frozen_at        timestamptz not null default now()
);

alter table public.airdrop_v1_snapshot enable row level security;
revoke all on public.airdrop_v1_snapshot from anon, authenticated;

comment on table public.airdrop_v1_snapshot is
  'Foto CONGELADA do saldo da v1 (carteira BSC), base do airdrop. Cópia de '
  'legacy_olefoot_credits, que é coluna VIVA e encolhe com a compra de lenda. '
  'Ninguém escreve aqui pelo cliente. NÃO é saldo de jogo (isso é OLEXP). '
  'Ver 20260921120000_airdrop_v1_foto_congelada.sql.';


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — a porta está fechada e a tabela aceita o formato certo
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  v_msg text;
begin
  if has_table_privilege('authenticated', 'public.airdrop_v1_snapshot', 'SELECT')
     or has_table_privilege('anon', 'public.airdrop_v1_snapshot', 'SELECT')
     or has_table_privilege('authenticated', 'public.airdrop_v1_snapshot', 'INSERT')
     or has_table_privilege('authenticated', 'public.airdrop_v1_snapshot', 'UPDATE')
     or has_table_privilege('authenticated', 'public.airdrop_v1_snapshot', 'DELETE') then
    raise exception 'cliente alcança airdrop_v1_snapshot';
  end if;

  begin
    insert into public.airdrop_v1_snapshot (user_id, email, bsc_wallet, saldo_congelado, snapshot_at)
    values ('00000000-0000-0000-0000-000000000000', 'zz@teste', '0xZZ', 123.45, now());

    if (select saldo_congelado from public.airdrop_v1_snapshot
         where user_id = '00000000-0000-0000-0000-000000000000') <> 123.45 then
      raise exception 'saldo não persistiu como esperado';
    end if;

    -- Idempotência: congelar de novo não duplica nem sobrescreve.
    insert into public.airdrop_v1_snapshot (user_id, email, bsc_wallet, saldo_congelado, snapshot_at)
    values ('00000000-0000-0000-0000-000000000000', 'zz@teste', '0xZZ', 999, now())
    on conflict (user_id) do nothing;

    if (select saldo_congelado from public.airdrop_v1_snapshot
         where user_id = '00000000-0000-0000-0000-000000000000') <> 123.45 then
      raise exception 'on conflict do nothing não protegeu a foto';
    end if;

    raise exception 'zz_verifica_ok';
  exception when others then
    v_msg := sqlerrm;
    if v_msg <> 'zz_verifica_ok' then
      raise exception 'verificação da foto do airdrop falhou: %', v_msg;
    end if;
  end;

  if exists (select 1 from public.airdrop_v1_snapshot
              where user_id = '00000000-0000-0000-0000-000000000000') then
    raise exception 'a verificação deixou rastro';
  end if;

  raise notice 'verificação: ok — tabela fechada pro cliente, foto protegida contra sobrescrita';
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- POPULAÇÃO (rodada uma vez em 2026-09-21 23:49 UTC — é DADO, não schema)
-- ════════════════════════════════════════════════════════════════════════════
-- insert into public.airdrop_v1_snapshot (user_id, email, bsc_wallet, saldo_congelado, snapshot_at)
-- select c.user_id, c.email, c.wallet_address, c.balance_human::numeric, c.snapshot_at
--   from public.legacy_olefoot_credits c
--  where c.user_id is not null
--    on conflict (user_id) do nothing;
--
-- Resultado: 168 linhas · 639.037.272 congelados · 69 com saldo > 0 · 168 com
-- carteira BSC. Fica comentado de propósito: a migration cria a tabela, o
-- congelamento é um ato datado. Rodar de novo não duplica (on conflict).
