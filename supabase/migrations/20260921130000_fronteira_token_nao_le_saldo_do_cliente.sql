-- ════════════════════════════════════════════════════════════════════════════
-- A FRONTEIRA: nada que decide token pode ler o saldo escrito pelo cliente
-- ════════════════════════════════════════════════════════════════════════════
-- `manager_game_state.finance` é gravado pelo NAVEGADOR. A RLS deixa cada
-- manager escrever a própria linha, e o save do jogo manda o objeto `finance`
-- inteiro — saldo, lifetime e histórico. Em 2026-09-21 são 1.285.636.685 nesse
-- campo, e qualquer pessoa com sessão grava o número que quiser no próprio.
--
-- Isso é tolerável enquanto o número só compra coisa dentro do jogo. Deixa de
-- ser no instante em que ele decidir quantidade de token: aí forjar saldo vira
-- forjar dinheiro.
--
-- 🔴 A REGRA: nenhuma decisão de token (airdrop, mint, distribuição, alocação)
-- pode ler `manager_game_state.finance`. A base do airdrop é
-- `airdrop_v1_snapshot`, que veio de `legacy_olefoot_credits` (escrito pelo
-- servidor) e está congelada.
--
-- Estado auditado em 2026-09-21 — tudo que toca `finance` no banco:
--     audit_manager_finance_change ....... trigger de auditoria
--     _apply_finance_prize ............... credita prêmio (só interno)
--     pay_ko_prize_backlog ............... backlog do mata-mata (service_role)
--     pay_season_champion_backlog ........ backlog de título (service_role)
--     claim_my_ko_prizes ................. claim do próprio manager
--     claim_my_season_champion_prizes .... claim do próprio manager
-- Nenhuma view. Nenhuma outra tabela. Nada ligado a token ou airdrop.
-- No código: `airdrop` só aparece em comentário, e o caminho Solana não lê
-- `finance` em lugar nenhum.
--
-- `fronteira_token_violacoes()` existe pra que isso não dependa de alguém
-- lembrar: ela acusa qualquer objeto do banco que leia `finance` junto com
-- palavra de token.

comment on column public.manager_game_state.finance is
  '🔴 ESCRITO PELO CLIENTE (o navegador manda o objeto inteiro no save). '
  'NUNCA use este campo pra decidir quantidade de token, airdrop ou qualquer '
  'valor que saia do jogo — é forjável por quem tem sessão. A base do airdrop '
  'é public.airdrop_v1_snapshot. Ver 20260921130000_fronteira_token_nao_le_saldo_do_cliente.sql.';

create or replace function public.fronteira_token_violacoes()
returns table (objeto text, tipo text, por_que text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  -- 1. Função que lê o saldo do cliente E fala de token/airdrop.
  --    A própria checagem fica de fora: o corpo dela cita as duas palavras
  --    como texto de busca e se acusaria sozinha (aconteceu na primeira
  --    tentativa desta migration — a verificação pegou e recusou aplicar).
  select p.proname::text,
         'função'::text,
         'lê manager_game_state.finance e menciona token/airdrop/mint'::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prokind = 'f'
     and p.prolang <> 12
     and p.proname <> 'fronteira_token_violacoes'
     and p.prosrc ilike '%finance%'
     and (p.prosrc ilike '%airdrop%' or p.prosrc ilike '%token%'
          or p.prosrc ilike '%solana%' or p.prosrc ilike '%mint%')

  union all

  -- 2. View que expõe o saldo do cliente junto com token/airdrop.
  select v.table_name::text,
         'view'::text,
         'expõe finance junto com token/airdrop'::text
    from information_schema.views v
   where v.table_schema = 'public'
     and v.view_definition ilike '%finance%'
     and (v.view_definition ilike '%airdrop%' or v.view_definition ilike '%token%')

  union all

  -- 3. A foto do airdrop aberta pro cliente seria o mesmo furo pelo outro lado.
  select 'airdrop_v1_snapshot'::text,
         'tabela'::text,
         'cliente alcança a foto do airdrop'::text
   where has_table_privilege('authenticated', 'public.airdrop_v1_snapshot', 'SELECT')
      or has_table_privilege('authenticated', 'public.airdrop_v1_snapshot', 'UPDATE')
      or has_table_privilege('anon', 'public.airdrop_v1_snapshot', 'SELECT');
$function$;

comment on function public.fronteira_token_violacoes() is
  'Acusa objeto do banco que cruze o saldo escrito pelo cliente '
  '(manager_game_state.finance) com decisão de token/airdrop. Zero linhas = '
  'fronteira de pé. Ver 20260921130000_fronteira_token_nao_le_saldo_do_cliente.sql.';

revoke execute on function public.fronteira_token_violacoes() from public, anon, authenticated;
grant  execute on function public.fronteira_token_violacoes() to service_role;


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — planta uma violação de verdade, confere que é pega, e desfaz
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  v_antes int;
  v_com   int;
  v_msg   text;
begin
  select count(*) into v_antes from public.fronteira_token_violacoes();
  if v_antes <> 0 then
    raise exception 'a fronteira JÁ está violada hoje: % objeto(s)', v_antes;
  end if;

  begin
    -- Exatamente o erro que a regra existe pra impedir: alguém calculando
    -- airdrop a partir do saldo que o navegador escreve.
    execute $f$
      create or replace function public.zz_airdrop_pelo_saldo(p_user uuid)
      returns numeric language sql stable as $inner$
        select public.jsonb_num(finance, 'ole')
          from public.manager_game_state where user_id = p_user;  -- airdrop
      $inner$;
    $f$;

    select count(*) into v_com from public.fronteira_token_violacoes();
    if v_com <> 1 then
      raise exception 'a checagem não pegou a violação plantada (achou %)', v_com;
    end if;
    if not exists (select 1 from public.fronteira_token_violacoes()
                    where objeto = 'zz_airdrop_pelo_saldo') then
      raise exception 'pegou algo, mas não a função plantada';
    end if;

    raise exception 'zz_verifica_ok';
  exception when others then
    v_msg := sqlerrm;
    if v_msg <> 'zz_verifica_ok' then
      raise exception 'verificação da fronteira falhou: %', v_msg;
    end if;
  end;

  -- CREATE FUNCTION é transacional no Postgres: o rollback do sub-bloco já
  -- levou a função plantada embora. Conferir mesmo assim.
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'zz_airdrop_pelo_saldo') then
    raise exception 'a função plantada sobrou no banco';
  end if;

  select count(*) into v_com from public.fronteira_token_violacoes();
  if v_com <> 0 then
    raise exception 'a verificação deixou rastro: % violação(ões)', v_com;
  end if;

  raise notice 'verificação: ok — fronteira de pé (0 violações) e a checagem pega quem cruzar';
end $$;
