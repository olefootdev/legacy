-- ============================================================================
-- OLEFOOT — Beta program, bug reports, notifications, manager friendships
-- ============================================================================
-- Tabelas para suportar testes online:
--   1) beta_testers        — controle de acesso ao beta (waitlist + invites)
--   2) bug_reports         — coleta de feedback/bugs dos testers
--   3) notifications       — log persistente de notificações (NotificationBell)
--   4) manager_friendships — solicitações + amizades confirmadas (ManagerNetwork)
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1) beta_testers
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.beta_testers (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  email         text not null,
  status        text not null default 'pending'
                check (status in ('pending','approved','rejected','active','revoked')),
  invite_code   text unique,
  invited_by    uuid references auth.users(id) on delete set null,
  approved_at   timestamptz,
  approved_by   uuid references auth.users(id) on delete set null,
  source        text,                    -- ex: 'landing', 'referral', 'admin'
  notes         text,
  metadata      jsonb default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (email)
);

create index if not exists idx_beta_testers_status on public.beta_testers(status);
create index if not exists idx_beta_testers_user on public.beta_testers(user_id);
create index if not exists idx_beta_testers_invite_code on public.beta_testers(invite_code);

alter table public.beta_testers enable row level security;

-- Usuário lê seu próprio registro; admin lê tudo.
drop policy if exists beta_testers_select_self on public.beta_testers;
create policy beta_testers_select_self on public.beta_testers
  for select using (user_id = auth.uid() or public.is_admin());

-- Inserção pública para waitlist (anon pode entrar com email).
drop policy if exists beta_testers_insert_waitlist on public.beta_testers;
create policy beta_testers_insert_waitlist on public.beta_testers
  for insert with check (status = 'pending');

-- Apenas admin atualiza/aprova.
drop policy if exists beta_testers_admin_write on public.beta_testers;
create policy beta_testers_admin_write on public.beta_testers
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists beta_testers_admin_delete on public.beta_testers;
create policy beta_testers_admin_delete on public.beta_testers
  for delete using (public.is_admin());

comment on table public.beta_testers is
  'Waitlist e controle de acesso ao beta online da Olefoot.';

-- ────────────────────────────────────────────────────────────────────────────
-- 2) bug_reports
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.bug_reports (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete set null,
  category       text not null default 'bug'
                 check (category in ('bug','feedback','suggestion','crash','ux')),
  severity       text not null default 'medium'
                 check (severity in ('low','medium','high','critical')),
  title          text not null,
  description    text not null,
  route          text,                    -- rota onde ocorreu (ex: /match/live)
  user_agent     text,
  app_version    text,
  screenshot_url text,                    -- supabase storage path
  attachments    jsonb default '[]'::jsonb,
  status         text not null default 'open'
                 check (status in ('open','triage','in_progress','resolved','wontfix','duplicate')),
  admin_notes    text,
  resolved_by    uuid references auth.users(id) on delete set null,
  resolved_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_bug_reports_user on public.bug_reports(user_id);
create index if not exists idx_bug_reports_status on public.bug_reports(status);
create index if not exists idx_bug_reports_category on public.bug_reports(category);
create index if not exists idx_bug_reports_created on public.bug_reports(created_at desc);

alter table public.bug_reports enable row level security;

drop policy if exists bug_reports_select_self on public.bug_reports;
create policy bug_reports_select_self on public.bug_reports
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists bug_reports_insert_self on public.bug_reports;
create policy bug_reports_insert_self on public.bug_reports
  for insert with check (user_id = auth.uid() or user_id is null);

drop policy if exists bug_reports_admin_write on public.bug_reports;
create policy bug_reports_admin_write on public.bug_reports
  for update using (public.is_admin()) with check (public.is_admin());

comment on table public.bug_reports is
  'Bugs e feedback enviados pelos beta testers via UI.';

-- ────────────────────────────────────────────────────────────────────────────
-- 3) notifications
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  category    text not null,             -- 'COMPETIÇÃO','PLANTEL','TREINO','STAFF','TORCIDA','SISTEMA'
  title       text not null,
  message     text,
  link        text,                      -- rota in-app (ex: /clube/elenco)
  payload     jsonb default '{}'::jsonb,
  read        boolean not null default false,
  read_at     timestamptz,
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_notifications_user_unread
  on public.notifications(user_id, read, created_at desc)
  where read = false;
create index if not exists idx_notifications_user_created
  on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_expires
  on public.notifications(expires_at) where expires_at is not null;

alter table public.notifications enable row level security;

drop policy if exists notifications_select_self on public.notifications;
create policy notifications_select_self on public.notifications
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notifications_admin_insert on public.notifications;
create policy notifications_admin_insert on public.notifications
  for insert with check (public.is_admin());

drop policy if exists notifications_delete_self on public.notifications;
create policy notifications_delete_self on public.notifications
  for delete using (user_id = auth.uid() or public.is_admin());

comment on table public.notifications is
  'Notificações in-app persistentes (NotificationBell + InboxItem).';

-- RPC: marcar notificação como lida
create or replace function public.mark_notification_read(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notifications
     set read = true, read_at = now()
   where id = p_notification_id
     and user_id = auth.uid()
     and read = false;
  return found;
end;
$$;

grant execute on function public.mark_notification_read(uuid) to authenticated;

-- RPC: marcar todas como lidas
create or replace function public.mark_all_notifications_read()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update public.notifications
     set read = true, read_at = now()
   where user_id = auth.uid() and read = false;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.mark_all_notifications_read() to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 4) manager_friendships
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.manager_friendships (
  id                    uuid primary key default gen_random_uuid(),
  requester_id          uuid not null references auth.users(id) on delete cascade,
  addressee_id          uuid not null references auth.users(id) on delete cascade,
  status                text not null default 'pending'
                        check (status in ('pending','accepted','rejected','blocked','cancelled')),
  requester_club_name   text,
  addressee_club_name   text,
  message               text,
  responded_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint friendship_distinct_users check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);

create index if not exists idx_friendships_requester
  on public.manager_friendships(requester_id, status);
create index if not exists idx_friendships_addressee
  on public.manager_friendships(addressee_id, status);
create index if not exists idx_friendships_status
  on public.manager_friendships(status, created_at desc);

alter table public.manager_friendships enable row level security;

-- Ambos os lados leem; admin lê tudo.
drop policy if exists friendships_select_involved on public.manager_friendships;
create policy friendships_select_involved on public.manager_friendships
  for select using (
    requester_id = auth.uid()
    or addressee_id = auth.uid()
    or public.is_admin()
  );

-- Apenas o requester cria solicitação.
drop policy if exists friendships_insert_requester on public.manager_friendships;
create policy friendships_insert_requester on public.manager_friendships
  for insert with check (requester_id = auth.uid());

-- Ambos os lados podem atualizar (aceitar/rejeitar/cancelar).
drop policy if exists friendships_update_involved on public.manager_friendships;
create policy friendships_update_involved on public.manager_friendships
  for update using (
    requester_id = auth.uid() or addressee_id = auth.uid()
  ) with check (
    requester_id = auth.uid() or addressee_id = auth.uid()
  );

-- Apenas requester pode cancelar (delete) sua própria solicitação pending.
drop policy if exists friendships_delete_requester on public.manager_friendships;
create policy friendships_delete_requester on public.manager_friendships
  for delete using (
    requester_id = auth.uid() and status = 'pending'
  );

comment on table public.manager_friendships is
  'Solicitações de amizade e amizades confirmadas entre managers (ManagerNetwork).';

-- ────────────────────────────────────────────────────────────────────────────
-- Triggers de updated_at (compartilhado)
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_beta_testers_updated on public.beta_testers;
create trigger trg_beta_testers_updated
  before update on public.beta_testers
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_bug_reports_updated on public.bug_reports;
create trigger trg_bug_reports_updated
  before update on public.bug_reports
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_friendships_updated on public.manager_friendships;
create trigger trg_friendships_updated
  before update on public.manager_friendships
  for each row execute function public.touch_updated_at();
