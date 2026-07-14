-- ============================================================
-- LENDAS — Passo A (wire beneficiário) + Passo B (mapa + resolver de lançamento)
--
-- Contexto: cards lançados gravaram o uid da lenda SÓ dentro do payment_split
-- (player.user_id), deixando a coluna beneficiary_user_id nula. Como
-- get_my_linked_cards filtra por beneficiary_user_id, os cards ficavam INVISÍVEIS
-- no PLAYERVIP (0 de 5 cards apareciam). Aditiva e idempotente.
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- PASSO A.1 — Backfill beneficiary_user_id a partir do split.player.user_id
--   Conecta os 3 cards do Marcelo (e qualquer outro no mesmo estado) na hora.
-- ════════════════════════════════════════════════════════════
update public.legacy_players lp
   set beneficiary_user_id = (
     select nullif(e->>'user_id','')::uuid
       from jsonb_array_elements(lp.payment_split) e
      where e->>'kind' = 'player' and coalesce(e->>'user_id','') <> ''
      limit 1)
 where lp.beneficiary_user_id is null
   and lp.payment_split is not null;

update public.genesis_market_players gp
   set beneficiary_user_id = (
     select nullif(e->>'user_id','')::uuid
       from jsonb_array_elements(gp.payment_split) e
      where e->>'kind' = 'player' and coalesce(e->>'user_id','') <> ''
      limit 1)
 where gp.beneficiary_user_id is null
   and gp.payment_split is not null;

-- ════════════════════════════════════════════════════════════
-- PASSO A.2 — Fix get_my_linked_cards: legacy retornava listed_on_market
--   HARDCODED como false → todo card aparecia "Pausada" no PLAYERVIP.
--   (Mesma assinatura/colunas — só troca o false por coalesce real.)
-- ════════════════════════════════════════════════════════════
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
           coalesce(l.listed_on_market, false), l.beneficiary_user_id, l.payment_split
      from public.legacy_players l where l.beneficiary_user_id = v_uid
     order by name;
end;
$$;
revoke all on function public.get_my_linked_cards() from public;
grant execute on function public.get_my_linked_cards() to authenticated;

-- ════════════════════════════════════════════════════════════
-- PASSO A.3 — Corrige o facilitador do Marcelo nos 3 cards.
--   O card apontava ramonsennaBH@gmail.com; o correto (confirmado pelo fundador
--   e presente na árvore antiga #97) é ramonsennaUSA@gmail.com. Best-effort:
--   só re-resolve se essa conta existir em auth.users.
-- ════════════════════════════════════════════════════════════
do $$
declare v_fac uuid; v_split jsonb; r record;
begin
  select id into v_fac from auth.users where lower(email) = 'ramonsennausa@gmail.com' limit 1;
  if v_fac is not null then
    for r in select id, payment_split from public.legacy_players
              where collection_id = 'mem-marcelo-goncalves-2026' and payment_split is not null loop
      select jsonb_agg(
               case when (e->>'kind') = 'facilitator'
                    then jsonb_set(jsonb_set(e, '{user_id}', to_jsonb(v_fac::text)),
                                   '{label}', to_jsonb('ramonsennausa@gmail.com'::text))
                    else e end)
        into v_split from jsonb_array_elements(r.payment_split) e;
      update public.legacy_players set payment_split = v_split, updated_at = now() where id = r.id;
    end loop;
  end if;
end $$;

-- ════════════════════════════════════════════════════════════
-- PASSO B.1 — Mapa de lançamento: lenda → facilitador (referência)
--   Recuperado da árvore do banco antigo + confirmações do fundador.
-- ════════════════════════════════════════════════════════════
create table if not exists public.legend_facilitator_map (
  legend_key         text primary key,
  legend_label       text,
  facilitator_email  text not null,
  facilitator_label  text,
  updated_at         timestamptz not null default now()
);

insert into public.legend_facilitator_map (legend_key, legend_label, facilitator_email, facilitator_label) values
  ('adauto',            'Adauto',            'afiger@gmail.com',           'Andre Figer'),
  ('diego-lugano',      'Diego Lugano',      'afiger@gmail.com',           'Andre Figer'),
  ('willian-xavier',    'Willian Xavier',    'matheusjsouza16@gmail.com',  'Matheus Souza'),
  ('cocito',            'Cocito',            'adautogol@gmail.com',        'Adauto'),
  ('nem-lima',          'Nem Lima',          'adautogol@gmail.com',        'Adauto'),
  ('johson-macaba',     'Johson Macaba',     'adautogol@gmail.com',        'Adauto'),
  ('breno-borges',      'Breno Borges',      'adautogol@gmail.com',        'Adauto'),
  ('marcelo-goncalves', 'Marcelo Gonçalves', 'ramonsennausa@gmail.com',    'Ramon Ferreira Sena'),
  ('palhinha',          'Palhinha',          'Fariawellinton77@gmail.com', 'Wellington')
on conflict (legend_key) do update
  set facilitator_email = excluded.facilitator_email,
      facilitator_label = excluded.facilitator_label,
      legend_label      = excluded.legend_label,
      updated_at        = now();

alter table public.legend_facilitator_map enable row level security;
drop policy if exists legend_facilitator_map_admin on public.legend_facilitator_map;
create policy legend_facilitator_map_admin on public.legend_facilitator_map
  for select to authenticated using (public.is_admin());

-- ════════════════════════════════════════════════════════════
-- PASSO B.2 — Resolver de lançamento: seta beneficiário + facilitador por E-MAIL
--   Usado ao lançar/editar um card. Resolve os dois e-mails contra auth.users e
--   injeta os user_ids nas entradas 'player' e 'facilitator' do split.
--   Retorna jsonb com o que resolveu (pra feedback no admin).
-- ════════════════════════════════════════════════════════════
create or replace function public.admin_link_legend_full(
  p_player_id text,
  p_beneficiary_email text,
  p_facilitator_email text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ben uuid;
  v_fac uuid;
  v_split jsonb;
  v_new jsonb;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if p_beneficiary_email is null or length(btrim(p_beneficiary_email)) = 0 then
    raise exception 'EMAIL_BENEFICIARIO_OBRIGATORIO';
  end if;

  select id into v_ben from auth.users where lower(email) = lower(btrim(p_beneficiary_email)) limit 1;
  if v_ben is null then raise exception 'BENEFICIARIO_SEM_CONTA: %', p_beneficiary_email; end if;

  if p_facilitator_email is not null and length(btrim(p_facilitator_email)) > 0 then
    select id into v_fac from auth.users where lower(email) = lower(btrim(p_facilitator_email)) limit 1;
  end if;

  select payment_split into v_split from public.legacy_players where id = p_player_id;
  if v_split is null then raise exception 'CARD_SEM_SPLIT: %', p_player_id; end if;

  -- injeta uids nas entradas player e facilitator
  select jsonb_agg(
           case
             when (e->>'kind') = 'player'
               then jsonb_set(jsonb_set(e, '{user_id}', to_jsonb(v_ben::text)),
                              '{label}', to_jsonb(btrim(p_beneficiary_email)))
             when (e->>'kind') = 'facilitator' and v_fac is not null
               then jsonb_set(jsonb_set(e, '{user_id}', to_jsonb(v_fac::text)),
                              '{label}', to_jsonb(btrim(p_facilitator_email)))
             else e
           end)
    into v_new
    from jsonb_array_elements(v_split) e;

  update public.legacy_players
     set beneficiary_user_id = v_ben,
         payment_split = coalesce(v_new, v_split),
         updated_at = now()
   where id = p_player_id;

  return jsonb_build_object(
    'player_id', p_player_id,
    'beneficiary_uid', v_ben,
    'facilitator_uid', v_fac,
    'facilitator_resolved', (v_fac is not null)
  );
end;
$$;
grant execute on function public.admin_link_legend_full(text, text, text) to authenticated;
