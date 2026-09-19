-- ════════════════════════════════════════════════════════════════════════════
-- Liga Global — time novo entra pela porta de baixo (Div 4), não pela Div 3
-- ════════════════════════════════════════════════════════════════════════════
-- O trigger `trg_default_division_on_insert` foi criado em produção pela
-- migration `auto_division_3_for_new_teams_when_active` (2026-05-31), aplicada
-- por fora e sem arquivo neste repo. Com a liga ativa, ele põe `division := 3`
-- em todo time novo — de quando havia 3 divisões.
--
-- Desde 2026-08-03 são 4 (Várzea), e a Edge usa ENTRY_DIVISION = DIVISIONS = 4:
-- o passo 3.5 do global-league-tick só gera partidas mid-season pra quem está
-- na divisão de entrada. Resultado: quem se cadastrava no meio da temporada
-- caía na Div 3 SEM NENHUMA PARTIDA até o próximo reset. É o sétimo "3
-- cravado" — os outros cinco saíram em agosto, o sexto era o cliente
-- (src/supabase/globalLeague.ts, corrigido junto: não manda mais divisão).
--
-- Corpo copiado da FONTE (pg_get_functiondef em 2026-09-18) — regra 3 do
-- _TEMPLATE. Única mudança: 3 → 4. Tem que bater com ENTRY_DIVISION em
-- supabase/functions/global-league-tick/index.ts.

create or replace function public.global_league_teams_default_division()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_status text;
begin
  if new.division is not null then
    return new;
  end if;
  select status into v_status from public.global_league_state where id = 'current';
  if v_status = 'active' then
    new.division := 4;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_default_division_on_insert on public.global_league_teams;
create trigger trg_default_division_on_insert
  before insert on public.global_league_teams
  for each row execute function public.global_league_teams_default_division();


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — cadastra um time de mentira e confere a divisão (desfeito)
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  v_status text;
  v_div    int;
  v_msg    text;
begin
  select status into v_status from public.global_league_state where id = 'current';
  begin
    insert into public.global_league_teams (id, manager_id, club_name, club_short, overall, registered_at)
    values ('zz-verifica-team', 'zz-verifica@invalid', 'ZZ Verifica', 'ZZV', 50, now());
    select division into v_div from public.global_league_teams where id = 'zz-verifica-team';

    if v_status = 'active' and v_div is distinct from 4 then
      raise exception 'liga ativa e o time novo entrou na divisão % (esperava 4)', v_div;
    end if;
    if v_status is distinct from 'active' and v_div is not null then
      raise exception 'liga fora de temporada e o time novo ganhou divisão %', v_div;
    end if;

    raise exception 'zz_verifica_ok';
  exception when others then
    v_msg := sqlerrm;
    if v_msg <> 'zz_verifica_ok' then
      raise exception 'verificação da divisão de entrada falhou: %', v_msg;
    end if;
  end;

  raise notice 'verificação: ok — time novo entra na Div 4 (liga %)', coalesce(v_status, 'sem estado');
end $$;
