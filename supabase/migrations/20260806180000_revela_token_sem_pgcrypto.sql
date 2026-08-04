-- ════════════════════════════════════════════════════════════════════════════
-- 🔴 URGENTE — MENOR DE IDADE NÃO CONSEGUE SE CADASTRAR
-- ════════════════════════════════════════════════════════════════════════════
-- `revela_submit_talent` com `p_birth_year` de menor devolve:
--
--   42883 · function gen_random_bytes(integer) does not exist
--
-- E como o trigger é AFTER INSERT, a exceção derruba a transação inteira: o
-- cadastro não é gravado. A proteção que a gente subiu pra CUIDAR de menor de
-- idade estava impedindo menor de idade de entrar.
--
-- ── POR QUE PASSOU BATIDO NA MIGRATION ──────────────────────────────────────
-- `gen_random_bytes` é do pgcrypto, que no Supabase mora no schema
-- `extensions`. Minhas funções declaram `set search_path = public`, então ela
-- some. O SQL Editor não acusou porque as DUAS chamadas ficam em caminhos que
-- não rodaram na hora de aplicar:
--
--   • no trigger, que só dispara quando um menor com foto se cadastra;
--   • no INSERT retroativo, cujo SELECT devolveu ZERO linhas — não havia
--     nenhum menor com foto pública no banco.
--
-- Migration que só executa o caminho vazio passa verde e mente. A lição é
-- rodar o caminho de verdade depois de aplicar, que é o que faltou.
--
-- ── O CONSERTO ──────────────────────────────────────────────────────────────
-- Token montado com `gen_random_uuid()`, que é do NÚCLEO do Postgres desde a
-- 13 e não depende de extensão nem de search_path. Dois UUIDs em hexa dão 64
-- caracteres e 256 bits de entropia — mais do que os 192 de antes.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.revela_novo_token()
returns text
language sql
volatile
as $$
  select replace(gen_random_uuid()::text, '-', '')
      || replace(gen_random_uuid()::text, '-', '');
$$;

comment on function public.revela_novo_token() is
  'Token de link. NÃO usar gen_random_bytes: é do pgcrypto, vive no schema '
  'extensions e some sob search_path=public — ver 20260806180000.';


-- ── O trigger que segura a foto do menor ────────────────────────────────────
create or replace function public.revela_segura_foto_de_menor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  idade int;
begin
  idade := case when new.birth_year is not null
                then extract(year from now())::int - new.birth_year end;

  if idade is not null and idade < 18 and new.portrait_url is not null then
    update public.revela_talents
       set pending_portrait_url = new.portrait_url,
           portrait_url         = null
     where id = new.id;

    insert into public.revela_guardian_auth (talent_id, token)
    values (new.id, public.revela_novo_token())
    on conflict (talent_id) do nothing;
  end if;

  return null;
end;
$$;


-- ── O pedido de autorização, pelo painel do atleta ──────────────────────────
create or replace function public.revela_pedir_autorizacao()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t     public.revela_talents;
  a     public.revela_guardian_auth;
  idade int;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'auth_required');
  end if;

  select * into t from public.revela_talents
   where user_id = auth.uid() and status <> 'rejected'
   order by created_at asc limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_talent');
  end if;

  idade := case when t.birth_year is not null
                then extract(year from now())::int - t.birth_year end;
  if idade is null or idade >= 18 then
    return jsonb_build_object('ok', false, 'reason', 'nao_e_menor');
  end if;

  select * into a from public.revela_guardian_auth where talent_id = t.id;
  if not found then
    insert into public.revela_guardian_auth (talent_id, token)
    values (t.id, public.revela_novo_token())
    returning * into a;
  end if;

  return jsonb_build_object(
    'ok', true,
    'token', a.token,
    'status', a.status,
    'nomeResponsavel', t.guardian_name,
    'telefoneResponsavel', t.guardian_phone
  );
end;
$$;

grant execute on function public.revela_pedir_autorizacao() to authenticated;


-- ── E agora o retroativo roda de verdade ────────────────────────────────────
-- Da primeira vez ele varreu zero linhas. Repetido aqui pra pegar quem entrou
-- no meio-tempo, e desta vez com uma função que existe.
update public.revela_talents
   set pending_portrait_url = portrait_url,
       portrait_url         = null,
       updated_at           = now()
 where portrait_url is not null
   and birth_year is not null
   and extract(year from now())::int - birth_year < 18;

insert into public.revela_guardian_auth (talent_id, token)
select id, public.revela_novo_token()
  from public.revela_talents
 where pending_portrait_url is not null
on conflict (talent_id) do nothing;


-- ─── Verificação — RODE ESTA, não confie no "Success" ───────────────────────
-- Tem que devolver ok:true. Se devolver 42883, o conserto não pegou.
--
--   select public.revela_submit_talent(
--     p_name => 'ZZ Prova Menor', p_pos => 'ATA',
--     p_contact_phone => '11900000377', p_handle => 'zzprovamenor',
--     p_birth_year => 2012, p_guardian_name => 'Mae Teste',
--     p_guardian_phone => '11900000388', p_photo_url => 'https://exemplo.test/x.jpg');
--
--   delete from public.revela_talents where slug like 'zz-prova-menor%';
