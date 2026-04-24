-- Vinculação de cards a usuário (beneficiary) + split de pagamento.
-- Split padrão: 50% jogador · 10% facilitador(es) · 40% Olefoot.
-- Formato: [{ kind: 'player'|'facilitator'|'olefoot', user_id uuid|null, label text, percent numeric }]
-- Soma dos percents deve ser 100. Validação via RPC (CHECK em jsonb é limitado).

alter table public.genesis_market_players
  add column if not exists beneficiary_user_id uuid references auth.users(id) on delete set null,
  add column if not exists payment_split jsonb;

alter table public.legacy_players
  add column if not exists beneficiary_user_id uuid references auth.users(id) on delete set null,
  add column if not exists payment_split jsonb;

create index if not exists genesis_market_players_beneficiary_idx
  on public.genesis_market_players (beneficiary_user_id)
  where beneficiary_user_id is not null;
create index if not exists legacy_players_beneficiary_idx
  on public.legacy_players (beneficiary_user_id)
  where beneficiary_user_id is not null;

create or replace function public.validate_payment_split(p_split jsonb)
returns void language plpgsql as $$
declare
  v_sum numeric := 0;
  v_item jsonb;
begin
  if p_split is null or jsonb_typeof(p_split) <> 'array' then
    raise exception 'split must be a non-null array';
  end if;
  if jsonb_array_length(p_split) < 1 then
    raise exception 'split must have at least one entry';
  end if;
  for v_item in select * from jsonb_array_elements(p_split) loop
    if (v_item->>'kind') is null or (v_item->>'percent') is null then
      raise exception 'each split entry needs kind and percent';
    end if;
    v_sum := v_sum + (v_item->>'percent')::numeric;
  end loop;
  if abs(v_sum - 100) > 0.01 then
    raise exception 'split percents must sum to 100 (got %)', v_sum;
  end if;
end;
$$;
revoke all on function public.validate_payment_split(jsonb) from public;

create or replace function public.admin_update_player_link(
  p_table text,
  p_player_id text,
  p_beneficiary_user_id uuid,
  p_payment_split jsonb
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if p_table not in ('genesis_market_players', 'legacy_players') then
    raise exception 'invalid table: %', p_table;
  end if;
  perform public.validate_payment_split(p_payment_split);
  if p_table = 'genesis_market_players' then
    update public.genesis_market_players
      set beneficiary_user_id = p_beneficiary_user_id, payment_split = p_payment_split, updated_at = now()
      where id = p_player_id;
  else
    update public.legacy_players
      set beneficiary_user_id = p_beneficiary_user_id, payment_split = p_payment_split, updated_at = now()
      where id = p_player_id;
  end if;
end;
$$;
revoke all on function public.admin_update_player_link(text, text, uuid, jsonb) from public;
grant execute on function public.admin_update_player_link(text, text, uuid, jsonb) to authenticated;

create or replace function public.get_my_linked_cards()
returns table (
  source text,
  id text,
  name text,
  pos text,
  rarity_label text,
  portrait_public_url text,
  price_bro_cents bigint,
  listed_on_market boolean,
  beneficiary_user_id uuid,
  payment_split jsonb
)
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  return query
    select 'genesis'::text, g.id, g.name, g.pos, g.rarity_label, g.portrait_public_url,
           g.price_bro_cents::bigint, g.listed_on_market, g.beneficiary_user_id, g.payment_split
      from public.genesis_market_players g where g.beneficiary_user_id = v_uid
     union all
    select 'legacy'::text, l.id, l.name, coalesce(l.pos,'')::text, coalesce(l.rarity_label,'')::text,
           coalesce(l.portrait_public_url,'')::text, coalesce(l.price_bro_cents,0)::bigint,
           false, l.beneficiary_user_id, l.payment_split
      from public.legacy_players l where l.beneficiary_user_id = v_uid
     order by name;
end;
$$;
revoke all on function public.get_my_linked_cards() from public;
grant execute on function public.get_my_linked_cards() to authenticated;
