-- ════════════════════════════════════════════════════════════════════════════
-- SOLANA · vínculo de carteira (ponte mínima pro lançamento)
-- ════════════════════════════════════════════════════════════════════════════
-- Guarda o endereço Solana que o manager conectou, AO LADO da conta por
-- e-mail (nunca no lugar — ver memory project_solana_economia_nao_custodial).
--
-- ⚠️ Este vínculo NÃO verifica posse da carteira por assinatura — grava o
-- endereço que a extensão (Phantom) devolveu no connect(). Dá pra montar a
-- lista de espera do claim hoje; trocar por Sign-In-With-Solana
-- (supabase.auth.signInWithWeb3) quando o claim existir de verdade (Onda 4).
-- NÃO usar este endereço pra autorizar pagamento/claim real sem essa
-- verificação.

create table if not exists public.solana_wallet_links (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  wallet_address  text not null,
  verified        boolean not null default false,
  linked_at       timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists solana_wallet_links_address_idx
  on public.solana_wallet_links (wallet_address);

alter table public.solana_wallet_links enable row level security;

drop policy if exists "solana_wallet_links_select_own" on public.solana_wallet_links;
create policy "solana_wallet_links_select_own"
  on public.solana_wallet_links for select
  to authenticated using (user_id = auth.uid());

-- Escrita só via RPC, que valida formato e garante 1 carteira por conta.
revoke all on public.solana_wallet_links from anon, authenticated;
grant select on public.solana_wallet_links to authenticated;

comment on table public.solana_wallet_links is
  'Endereço Solana declarado pelo manager, SEM verificação de assinatura. '
  'Lista de espera do claim — não autoriza pagamento. Ver topo da migration '
  '20260918210000_solana_wallet_link.sql.';

create or replace function public.link_my_solana_wallet(p_address text)
returns public.solana_wallet_links
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_row public.solana_wallet_links;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_address is null
     or length(p_address) < 32
     or length(p_address) > 44
     or p_address !~ '^[1-9A-HJ-NP-Za-km-z]+$' then
    raise exception 'endereço Solana inválido';
  end if;

  begin
    insert into public.solana_wallet_links (user_id, wallet_address, verified, linked_at, updated_at)
    values (v_uid, p_address, false, now(), now())
    on conflict (user_id) do update
      set wallet_address = excluded.wallet_address,
          verified = false,
          updated_at = now()
    returning * into v_row;
  exception when unique_violation then
    raise exception 'essa carteira já está vinculada a outra conta';
  end;

  return v_row;
end;
$function$;

revoke execute on function public.link_my_solana_wallet(text) from public, anon;
grant execute on function public.link_my_solana_wallet(text) to authenticated;

-- drop antes: uma versão anterior deste bloco (colada no SQL Editor na mesma
-- noite) devolvia a linha única, e `create or replace` não troca tipo de retorno.
drop function if exists public.get_my_solana_wallet();
create or replace function public.get_my_solana_wallet()
returns setof public.solana_wallet_links
language sql
security definer
set search_path to 'public'
stable
as $function$
  select * from public.solana_wallet_links where user_id = auth.uid();
$function$;

revoke execute on function public.get_my_solana_wallet() from public, anon;
grant execute on function public.get_my_solana_wallet() to authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — exercita o caminho novo e desfaz o próprio rastro
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  v_uid   uuid;
  v_uid2  uuid;
  v_addr  constant text := '11111111111111111111111111111111';
  v_got   text;
  v_msg   text;
  v_threw boolean;
begin
  if has_table_privilege('authenticated', 'public.solana_wallet_links', 'INSERT')
     or has_table_privilege('authenticated', 'public.solana_wallet_links', 'UPDATE')
     or has_table_privilege('authenticated', 'public.solana_wallet_links', 'DELETE') then
    raise exception 'cliente escreve solana_wallet_links direto (tinha que ser só via RPC)';
  end if;
  if not has_table_privilege('authenticated', 'public.solana_wallet_links', 'SELECT') then
    raise exception 'cliente perdeu a leitura da própria carteira';
  end if;

  select id into v_uid from auth.users order by created_at limit 1;
  select id into v_uid2 from auth.users where id <> v_uid order by created_at limit 1;
  if v_uid is null then
    raise notice 'verificação: sem usuários pra exercitar link_my_solana_wallet';
  else
    begin
      perform set_config('request.jwt.claim.sub', v_uid::text, true);
      perform public.link_my_solana_wallet(v_addr);
      select wallet_address into v_got from public.get_my_solana_wallet();
      if v_got is distinct from v_addr then
        raise exception 'get_my_solana_wallet devolveu % em vez do endereço vinculado', v_got;
      end if;

      v_threw := false;
      begin
        perform public.link_my_solana_wallet('0OIl-nao-e-base58');
      exception when others then
        v_threw := true;
      end;
      if not v_threw then
        raise exception 'link_my_solana_wallet aceitou endereço inválido';
      end if;

      if v_uid2 is not null then
        perform set_config('request.jwt.claim.sub', v_uid2::text, true);
        v_threw := false;
        begin
          perform public.link_my_solana_wallet(v_addr);
        exception when others then
          v_threw := sqlerrm like '%já está vinculada%';
        end;
        if not v_threw then
          raise exception 'a mesma carteira foi aceita em duas contas';
        end if;
      end if;

      raise exception 'zz_verifica_ok';
    exception when others then
      v_msg := sqlerrm;
      if v_msg <> 'zz_verifica_ok' then
        raise exception 'verificação da carteira Solana falhou: %', v_msg;
      end if;
    end;
    perform set_config('request.jwt.claim.sub', '', true);
  end if;

  raise notice 'verificação: ok — vínculo Solana só via RPC, 1 carteira por conta';
end $$;
