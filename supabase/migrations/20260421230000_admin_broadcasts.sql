-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — admin_broadcasts
--
-- Motor de notificações globais do admin.
-- • admin_broadcasts: mensagens escritas pelo admin.
-- • broadcast_deliveries: idempotência por manager (entrega única).
-- • admin_send_broadcast / consume_broadcasts RPCs.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.admin_broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category text not null default 'CONTA',
  deep_link text,
  audience text not null default 'all' check (audience in ('all')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz
);

create index if not exists idx_admin_broadcasts_active
  on public.admin_broadcasts (active, created_at desc)
  where active = true;

alter table public.admin_broadcasts enable row level security;

drop policy if exists "admin_broadcasts_select_public" on public.admin_broadcasts;
create policy "admin_broadcasts_select_public"
  on public.admin_broadcasts for select
  to authenticated
  using (active = true);

grant select on table public.admin_broadcasts to authenticated;

comment on table public.admin_broadcasts is
  'Mensagens broadcast escritas pelo admin. Entregues 1×/manager via consume_broadcasts.';

-- ─── broadcast_deliveries ───────────────────────────────────────────────────
create table if not exists public.broadcast_deliveries (
  broadcast_id uuid not null references public.admin_broadcasts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  delivered_at timestamptz not null default now(),
  primary key (broadcast_id, user_id)
);

create index if not exists idx_broadcast_deliveries_user
  on public.broadcast_deliveries (user_id, delivered_at desc);

alter table public.broadcast_deliveries enable row level security;

drop policy if exists "broadcast_deliveries_self_read" on public.broadcast_deliveries;
create policy "broadcast_deliveries_self_read"
  on public.broadcast_deliveries for select
  to authenticated
  using (user_id = auth.uid());

grant select on table public.broadcast_deliveries to authenticated;

-- ─── admin_send_broadcast ───────────────────────────────────────────────────
create or replace function public.admin_send_broadcast(
  p_title text,
  p_body text,
  p_category text default 'CONTA',
  p_deep_link text default null,
  p_expires_at timestamptz default null
)
returns public.admin_broadcasts
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.admin_broadcasts;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;
  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_body), '') = '' then
    raise exception 'title and body required';
  end if;

  insert into public.admin_broadcasts (title, body, category, deep_link, created_by, expires_at)
  values (p_title, p_body, p_category, p_deep_link, auth.uid(), p_expires_at)
  returning * into v;

  return v;
end;
$$;

revoke all on function public.admin_send_broadcast(text, text, text, text, timestamptz) from public;
grant execute on function public.admin_send_broadcast(text, text, text, text, timestamptz)
  to authenticated;

-- ─── consume_broadcasts (cliente chama no boot) ─────────────────────────────
-- Retorna broadcasts ainda não entregues a este user, e grava delivery.
create or replace function public.consume_broadcasts()
returns setof public.admin_broadcasts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then return; end if;

  return query
    with pending as (
      select b.*
        from public.admin_broadcasts b
       where b.active = true
         and (b.expires_at is null or b.expires_at > now())
         and not exists (
           select 1 from public.broadcast_deliveries d
            where d.broadcast_id = b.id and d.user_id = v_uid
         )
       order by b.created_at asc
    ),
    insert_deliveries as (
      insert into public.broadcast_deliveries (broadcast_id, user_id)
        select id, v_uid from pending
      on conflict (broadcast_id, user_id) do nothing
      returning 1
    )
    select * from pending;
end;
$$;

revoke all on function public.consume_broadcasts() from public;
grant execute on function public.consume_broadcasts() to authenticated;

-- ─── admin_broadcast_stats (contagem de entregas por broadcast) ─────────────
create or replace function public.admin_broadcast_stats(p_limit int default 50)
returns table (
  id uuid,
  title text,
  category text,
  created_at timestamptz,
  active boolean,
  deliveries bigint
)
language sql
security definer
set search_path = public
as $$
  select b.id, b.title, b.category, b.created_at, b.active,
         (select count(*) from public.broadcast_deliveries d where d.broadcast_id = b.id) as deliveries
    from public.admin_broadcasts b
   order by b.created_at desc
   limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke all on function public.admin_broadcast_stats(int) from public;
grant execute on function public.admin_broadcast_stats(int) to authenticated;
