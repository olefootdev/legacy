-- ═══════════════════════════════════════════════════════════════════════════
-- CONVITE DE EXPANSÃO — com ativação e confirmação explícita
--
-- Decisões do fundador (2026-09-29):
--   · árvore começa do ZERO, ninguém é migrado automaticamente;
--   · quem já tem conta usa o mesmo e-mail — o login sempre foi um só;
--   · SÓ gera convite quem ativou um pack de $10. SEM ASTERISCO: nem as
--     contas-selo escapam;
--   · entrar na expansão exige CONFIRMAÇÃO ("você está sendo ativado por
--     @fulano. Confirma?").
--
-- 🔴 POR ISSO O GANCHO AUTOMÁTICO SAI DO CADASTRO. Na migration anterior o
-- `save_onboarding_profile` inseria na árvore sozinho a partir do
-- `referred_by_code`. Isso contradiz a confirmação: a pessoa entraria no
-- binário sem nunca ter dito sim. A posição na árvore é PERMANENTE — não se
-- atribui por efeito colateral de outra tela.
--
-- O `/cadastro/<código>` continua existindo e continua valendo pro JOGO
-- (amizade, indicação). Ele só deixa de mexer no binário. É a mesma fronteira
-- de sempre: game é game, expansão é expansão.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── quem pode convidar ───────────────────────────────────────────────────
-- Ativação = pack de pré-venda pago, a partir de $10. Sem isso o link não
-- existe: não é que ele falhe no clique, é que não se gera.
create or replace function public.expansao_pode_convidar(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from presale_purchase
     where user_id = p_user and status = 'pago' and usd_cents >= 1000
  );
$$;
revoke all on function public.expansao_pode_convidar(uuid) from public, anon;
grant execute on function public.expansao_pode_convidar(uuid) to authenticated, service_role;

-- ─── o que a tela do convite mostra ───────────────────────────────────────
-- Pública de leitura de propósito: quem clica no link ainda não fez login, e
-- precisa ver de quem é o convite antes de decidir entrar. Devolve só o
-- username e se está ativo — nada de e-mail, nada de volume, nada de rede.
create or replace function public.expansao_convite_de(p_username text)
returns table (username text, existe boolean, pode_convidar boolean)
language sql stable security definer set search_path = public as $$
  select coalesce(p.username, lower(trim(p_username))),
         (p.id is not null),
         coalesce(public.expansao_pode_convidar(p.id), false)
    from (select 1) z
    left join public.profiles p on lower(p.username) = lower(trim(p_username));
$$;
revoke all on function public.expansao_convite_de(text) from public;
grant execute on function public.expansao_convite_de(text) to anon, authenticated, service_role;

-- ─── o registro do sim ────────────────────────────────────────────────────
-- A posição na árvore é permanente, então o consentimento fica guardado: quem
-- confirmou, por quem, quando e de qual link.
create table if not exists public.expansao_confirmacao (
  user_id         uuid primary key references auth.users(id) on delete restrict,
  patrocinador_id uuid not null references auth.users(id) on delete restrict,
  username_convite text not null,
  confirmado_em   timestamptz not null default now()
);
alter table public.expansao_confirmacao enable row level security;
drop policy if exists expansao_confirmacao_propria on public.expansao_confirmacao;
create policy expansao_confirmacao_propria on public.expansao_confirmacao
  for select to authenticated using (user_id = auth.uid());

-- ─── confirmar ────────────────────────────────────────────────────────────
-- Chamada PELA PRÓPRIA PESSOA (auth.uid()), que é o ponto: ninguém entra na
-- árvore de outro. Por isso esta é a única função de expansão executável por
-- `authenticated` que ESCREVE.
create or replace function public.expansao_confirmar_convite(p_username text)
returns table (entrou boolean, motivo text, patrocinador text)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_pat uuid;
  v_pat_username text;
  v_r record;
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;

  select id, username into v_pat, v_pat_username
    from profiles where lower(username) = lower(trim(p_username));
  if v_pat is null then
    return query select false, 'convite_inexistente', null::text; return; end if;
  if v_pat = v_uid then
    return query select false, 'auto_convite', v_pat_username; return; end if;
  if exists (select 1 from expansao_no where user_id = v_uid) then
    return query select false, 'ja_esta_na_expansao', v_pat_username; return; end if;

  -- A trava de ativação. Sem pack de $10 pago, o convite não vale.
  if not public.expansao_pode_convidar(v_pat) then
    return query select false, 'convite_nao_ativado', v_pat_username; return; end if;

  -- Patrocinador precisa estar na árvore. Se ativou e ainda não entrou, é
  -- estado inconsistente do lado dele — e a pessoa não pode pagar por isso.
  if not exists (select 1 from expansao_no where user_id = v_pat) then
    return query select false, 'patrocinador_fora_da_arvore', v_pat_username; return; end if;

  select * into v_r from public.expansao_entrar(v_uid, v_pat);
  if not v_r.entrou then
    return query select false, v_r.motivo, v_pat_username; return; end if;

  insert into expansao_confirmacao (user_id, patrocinador_id, username_convite)
  values (v_uid, v_pat, v_pat_username)
  on conflict (user_id) do nothing;

  return query select true, null::text, v_pat_username;
end;
$$;
revoke all on function public.expansao_confirmar_convite(text) from public, anon;
grant execute on function public.expansao_confirmar_convite(text) to authenticated, service_role;

-- ─── o cadastro volta a NÃO mexer na árvore ───────────────────────────────
-- Restaura save_onboarding_profile ao que ela era antes da ponte automática:
-- perfil, código de indicação imutável e auto-amizade. O binário sai daqui.
--
-- Entrar na expansão passa a ser um ato próprio, com nome e data, em
-- expansao_confirmar_convite. Posição em árvore binária é permanente e mexe em
-- dinheiro — não se atribui de brinde num fluxo que a pessoa abriu pra escolher
-- o nome do clube.
create or replace function public.save_onboarding_profile(
  p_display_name text, p_club_name text, p_club_short text,
  p_onboarding_data jsonb, p_referred_by_code text default null::text)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  v_uid uuid := auth.uid(); v_code text; v_referrer_id uuid; v_referrer_club text;
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;

  v_code := nullif(regexp_replace(upper(coalesce(p_referred_by_code, '')), '[^A-Z0-9]', '', 'g'), '');
  if v_code is not null and (char_length(v_code) < 6 or char_length(v_code) > 8) then v_code := null; end if;
  if v_code is not null then
    if not exists (select 1 from public.profiles where my_referral_code = v_code and id <> v_uid) then
      v_code := null;
    end if;
  end if;

  insert into public.profiles (id, display_name, club_name, club_short, onboarding_data, referred_by_code)
  values (v_uid, p_display_name, p_club_name, p_club_short, p_onboarding_data, v_code)
  on conflict (id) do update set
    display_name = excluded.display_name, club_name = excluded.club_name,
    club_short = excluded.club_short, onboarding_data = excluded.onboarding_data,
    referred_by_code = coalesce(public.profiles.referred_by_code, excluded.referred_by_code),
    updated_at = now();

  -- Auto-amizade com quem indicou. Best-effort: onboarding NUNCA pode quebrar.
  begin
    select p.referred_by_code into v_code from public.profiles p where p.id = v_uid;
    if v_code is not null then
      select id, club_name into v_referrer_id, v_referrer_club
        from public.profiles where my_referral_code = v_code and id <> v_uid limit 1;
      if v_referrer_id is not null then
        insert into public.manager_friendships
          (requester_id, addressee_id, requester_club_name, addressee_club_name, status, responded_at)
        values (v_referrer_id, v_uid, v_referrer_club, p_club_name, 'accepted', now())
        on conflict (requester_id, addressee_id) do update
          set status = case when public.manager_friendships.status in ('rejected','cancelled')
                            then public.manager_friendships.status else 'accepted' end,
              addressee_club_name = excluded.addressee_club_name, updated_at = now();
      end if;
    end if;
  exception when others then null;
  end;
end;
$function$;

-- expansao_pendente perde o sentido: não há mais entrada automática que possa
-- falhar calada. Fica a tabela (pode ter linha de antes), some o uso.
comment on table public.expansao_pendente is
  'OBSOLETA desde 2026-09-29: a entrada na árvore virou confirmação explícita
   (expansao_confirmar_convite), então não existe mais falha silenciosa a
   registrar. Mantida só para não perder histórico.';
