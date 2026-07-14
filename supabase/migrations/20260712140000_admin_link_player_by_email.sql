-- ============================================================
-- ADMIN legend-creator ↔ PLAYERVIP — vínculo por E-MAIL
--
-- Hoje o admin só consegue vincular o beneficiário escolhendo um PERFIL de jogo
-- (adminListProfiles → profiles). Uma lenda que entra só pela PLAYERVIP (login
-- por link mágico) tem conta em auth.users mas pode NÃO ter row em profiles —
-- então não aparece no seletor e o card não sincroniza com o painel dela.
--
-- Esta RPC resolve o beneficiário pelo E-MAIL (auth.users) e grava
-- beneficiary_user_id + payment_split, injetando o user_id resolvido na fatia
-- 'player' do split. Assim, todo card lançado no ADMIN passa a sincronizar
-- com a PLAYERVIP da lenda (get_my_linked_cards filtra por beneficiary_user_id).
-- ============================================================

create or replace function public.admin_link_player_by_email(
  p_table text,
  p_player_id text,
  p_email text,
  p_payment_split jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_split jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin required';
  end if;
  if p_table not in ('legacy_players', 'genesis_market_players') then
    raise exception 'INVALID_TABLE';
  end if;
  if p_email is null or length(btrim(p_email)) = 0 then
    raise exception 'EMAIL_OBRIGATORIO';
  end if;

  select id into v_uid from auth.users where lower(email) = lower(btrim(p_email)) limit 1;
  if v_uid is null then
    raise exception 'EMAIL_SEM_CONTA';
  end if;

  -- Injeta o user_id resolvido na entrada 'player' do split.
  select jsonb_agg(
           case when (e->>'kind') = 'player'
                then jsonb_set(e, '{user_id}', to_jsonb(v_uid::text))
                else e end
         )
    into v_split
    from jsonb_array_elements(coalesce(p_payment_split, '[]'::jsonb)) e;

  if p_table = 'legacy_players' then
    update public.legacy_players
       set beneficiary_user_id = v_uid,
           payment_split = coalesce(v_split, p_payment_split)
     where id = p_player_id;
  else
    update public.genesis_market_players
       set beneficiary_user_id = v_uid,
           payment_split = coalesce(v_split, p_payment_split)
     where id = p_player_id;
  end if;

  return v_uid;
end;
$$;

grant execute on function public.admin_link_player_by_email(text, text, text, jsonb) to authenticated;
