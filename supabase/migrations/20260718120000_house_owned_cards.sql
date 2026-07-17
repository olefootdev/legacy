-- ============================================================
-- CARD DA CASA — a plataforma é dono E facilitador (ex.: Juca, Nando)
--
-- CONTEXTO
-- Juca e Nando são lendas que a OLEFOOT criou: não existe atleta real nem
-- facilitador. Estavam LISTADOS com o split 100% null (player/facilitator/
-- beneficiary), então uma venda não creditava ninguém. A migration de ontem
-- (20260717210000) já pôs olefoot 25% + community 15% na plataforma; falta o
-- player 50% + facilitator 10%.
--
-- Decisão do fundador (2026-07-18): pra card da casa, a plataforma (trader4,
-- via olefoot_platform_user_id) fica com 100%.
--
-- ⚠️ POR QUE UMA FLAG EXPLÍCITA, não "todo nulo vira trader4"
-- Card da casa e lenda real são INDISTINGUÍVEIS hoje — ambos creator_label
-- 'lenda'. Se a gente preenchesse todo split nulo com a plataforma, uma lenda
-- REAL (ex.: Adauto) importada e ainda não vinculada viraria "da plataforma" em
-- silêncio, e a trader4 abocanharia os 50% do atleta se vendesse antes do
-- admin_link_legend_full. A flag `house_owned` é o sinal explícito: só quem for
-- marcado é preenchido; lenda real fica com split nulo (o alarme de "não pronto")
-- até ser vinculada.
-- ============================================================

-- ─── 1. A flag ─────────────────────────────────────────────────────────────
alter table public.legacy_players
  add column if not exists house_owned boolean not null default false;

comment on column public.legacy_players.house_owned is
  'Card da casa: sem atleta/facilitador reais. O trigger preenche '
  'player+facilitator+beneficiary com a conta da plataforma. Lenda real fica '
  'false e usa admin_link_legend_full. Ver 20260718120000.';

do $$
begin
  if to_regclass('public.genesis_market_players') is not null then
    alter table public.genesis_market_players
      add column if not exists house_owned boolean not null default false;
  end if;
end $$;

-- ─── 2. Trigger estendido ──────────────────────────────────────────────────
-- Regra base (todos os cards): olefoot/community null → plataforma.
-- Regra da casa (só house_owned): player/facilitator null → plataforma, e
-- beneficiary_user_id null → plataforma.
--
-- SEMPRE só toca em slot NULO. Assim o admin_link_legend_full (que grava uids
-- reais) nunca é sobrescrito: quando ele roda, os slots já não são nulos.
create or replace function public.trg_fill_platform_split()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public.olefoot_platform_user_id();
  v_kinds text[];
  v_out jsonb;
begin
  if new.payment_split is null or jsonb_typeof(new.payment_split) <> 'array' then
    return new;
  end if;

  -- Quais fatias a plataforma assume neste card.
  if new.house_owned then
    v_kinds := array['olefoot', 'community', 'player', 'facilitator'];
  else
    v_kinds := array['olefoot', 'community'];
  end if;

  select jsonb_agg(
           case
             when (e->>'kind') = any(v_kinds) and nullif(e->>'user_id', '') is null
               then jsonb_set(e, '{user_id}', to_jsonb(v_uid::text))
             else e
           end
         )
    into v_out
    from jsonb_array_elements(new.payment_split) e;

  if v_out is not null then
    new.payment_split := v_out;
  end if;

  -- Card da casa também precisa de beneficiary (o painel e o buy-legacy leem
  -- essa coluna, não o split).
  if new.house_owned and new.beneficiary_user_id is null then
    new.beneficiary_user_id := v_uid;
  end if;

  return new;
end;
$$;

-- Dispara em qualquer update (não só de payment_split): marcar house_owned=true
-- numa linha existente precisa re-preencher os slots.
drop trigger if exists legacy_players_fill_platform_split on public.legacy_players;
create trigger legacy_players_fill_platform_split
  before insert or update on public.legacy_players
  for each row execute function public.trg_fill_platform_split();

do $$
begin
  if to_regclass('public.genesis_market_players') is not null then
    drop trigger if exists genesis_players_fill_platform_split on public.genesis_market_players;
    create trigger genesis_players_fill_platform_split
      before insert or update on public.genesis_market_players
      for each row execute function public.trg_fill_platform_split();
  end if;
end $$;

-- ─── 3. Juca e Nando viram card da casa ────────────────────────────────────
-- Marca a flag: o trigger BEFORE UPDATE preenche player+facilitator+beneficiary
-- com a plataforma (olefoot/community já estavam de ontem).
update public.legacy_players
   set house_owned = true, updated_at = now()
 where collection_id in ('mem-juca-1970', 'mem-nando-2026');

-- ─── Conferência ───────────────────────────────────────────────────────────
select
  lp.id,
  lp.house_owned,
  lp.beneficiary_user_id = public.olefoot_platform_user_id() as benef_eh_plataforma,
  (
    select string_agg(e->>'kind' || '=' ||
             case when (e->>'user_id') = public.olefoot_platform_user_id()::text then 'PLATAFORMA'
                  when nullif(e->>'user_id','') is null then 'null'
                  else 'outro' end, ' · ')
    from jsonb_array_elements(lp.payment_split) e
  ) as split
from public.legacy_players lp
where lp.collection_id in ('mem-juca-1970', 'mem-nando-2026', 'mem-marcelo-goncalves-2026')
order by lp.house_owned desc, lp.id;
