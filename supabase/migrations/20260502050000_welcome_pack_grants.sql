-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — welcome_pack_grants
--
-- Idempotência real por manager: garante que cada user_id recebe o welcome
-- pack exatamente uma vez, independente de localStorage ou cache.
-- Substitui o guard local (welcomeGenesisPackVersion no localStorage).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.welcome_pack_grants (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  pack_version int not null default 1,
  granted_at timestamptz not null default now()
);

alter table public.welcome_pack_grants enable row level security;

create policy "welcome_pack_grants_select_own"
  on public.welcome_pack_grants for select
  to authenticated using (user_id = auth.uid());

grant select on table public.welcome_pack_grants to authenticated;

comment on table public.welcome_pack_grants is
  'Registro server-side de entrega do welcome pack por manager. Idempotência real — substitui guard localStorage.';

-- Recria claim_welcome_pack com verificação por manager
create or replace function public.claim_welcome_pack(p_manager_id uuid)
returns table (
  claimed          boolean,
  queue_position   bigint,
  remaining        bigint,
  welcome_packs_claimed bigint,
  welcome_packs_limit   bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed bigint;
  v_limit   bigint;
  v_already boolean;
begin
  -- Verificar se este manager já recebeu (idempotência por manager)
  select exists(
    select 1 from public.welcome_pack_grants where user_id = p_manager_id
  ) into v_already;

  if v_already then
    select lc.welcome_packs_claimed, lc.welcome_packs_limit
      into v_claimed, v_limit
      from public.launch_counters lc where lc.id = 1;
    return query select
      false                    as claimed,
      (v_claimed + 1)          as queue_position,
      (v_limit - v_claimed)    as remaining,
      v_claimed                as welcome_packs_claimed,
      v_limit                  as welcome_packs_limit;
    return;
  end if;

  -- Lock singleton para incremento atômico
  select lc.welcome_packs_claimed, lc.welcome_packs_limit
    into v_claimed, v_limit
    from public.launch_counters lc where lc.id = 1
    for update;

  if v_claimed < v_limit then
    update public.launch_counters
       set welcome_packs_claimed = welcome_packs_claimed + 1,
           updated_at = now()
     where id = 1
     returning launch_counters.welcome_packs_claimed into v_claimed;

    -- Registrar entrega para este manager
    insert into public.welcome_pack_grants (user_id, pack_version)
    values (p_manager_id, 2)
    on conflict (user_id) do nothing;

    return query select
      true                     as claimed,
      v_claimed                as queue_position,
      (v_limit - v_claimed)    as remaining,
      v_claimed                as welcome_packs_claimed,
      v_limit                  as welcome_packs_limit;
  else
    return query select
      false                    as claimed,
      (v_claimed + 1)          as queue_position,
      0::bigint                as remaining,
      v_claimed                as welcome_packs_claimed,
      v_limit                  as welcome_packs_limit;
  end if;
end;
$$;

revoke all on function public.claim_welcome_pack(uuid) from public;
grant execute on function public.claim_welcome_pack(uuid) to authenticated;
