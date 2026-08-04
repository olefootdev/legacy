-- ════════════════════════════════════════════════════════════════════════════
-- REVELA — MENOR DE IDADE NÃO TEM FOTO PÚBLICA SEM O RESPONSÁVEL AUTORIZAR
-- ════════════════════════════════════════════════════════════════════════════
-- Decisão do fundador (2026-08-04). Com o SCOUT autônomo, o cadastro entra no ar
-- sozinho — e isso significava que a foto de um menino de 14 anos ia pra vitrine
-- sem nenhum adulto ter dito sim. Este é o freio.
--
-- ── O FLUXO ─────────────────────────────────────────────────────────────────
--  1. Menor se cadastra normalmente. A foto NÃO vai pra `portrait_url`: fica em
--     `pending_portrait_url`, que RPC pública nenhuma devolve.
--  2. O sistema cria uma AUTORIZAÇÃO com um token, e o atleta manda o link no
--     WhatsApp do responsável.
--  3. O responsável abre o link e preenche COM AS PRÓPRIAS MÃOS: nome completo,
--     CPF, e-mail e telefone. Ele vê o nome do atleta e a foto que será
--     publicada antes de decidir.
--  4. Confirmou: a foto sai de `pending_portrait_url` e entra em `portrait_url`.
--     Só aí a vitrine e o card passam a mostrar o rosto.
--
-- ── POR QUE O RESPONSÁVEL DIGITA, E NÃO O ATLETA ────────────────────────────
-- O cadastro já pedia nome e telefone do responsável — digitados pelo próprio
-- moleque, que pode escrever qualquer coisa. Autorização em que o autorizado
-- preenche os dados do autorizador não autoriza nada. O token no link é o que
-- prova que a mensagem chegou ao telefone que ele informou.
--
-- ── ⚠️ CPF É DADO PESSOAL REGULADO ──────────────────────────────────────────
-- Guardar CPF muda o patamar de responsabilidade desta tabela (LGPD). Por isso:
-- RLS ligada sem política nenhuma, acesso só por função SECURITY DEFINER, e o
-- CPF NUNCA sai em nenhuma leitura — nem pro admin. Ele entra, fica guardado
-- como prova da autorização, e não volta. Se um dia precisar conferir, é no SQL
-- Editor com a service role, deliberadamente.
--
-- ── ITEM 3 JUNTO: O SONHO ESTAVA INDO PRA `bio` ─────────────────────────────
-- Na v2 do cadastro, `p_dream` passou a ser gravado na coluna `bio` e a coluna
-- `dream` ficou morta. A vitrine mostra `bio` sob o título "A história" — então
-- a página do Juan dizia "A história: Jogar na Seleção Brasileira". Corrigido
-- no fim deste arquivo.
-- ════════════════════════════════════════════════════════════════════════════

-- ── A foto que espera ───────────────────────────────────────────────────────
alter table public.revela_talents
  add column if not exists pending_portrait_url text;

comment on column public.revela_talents.pending_portrait_url is
  'Retrato de menor de idade aguardando autorização do responsável. NUNCA sai em RPC pública.';


-- ── A autorização ───────────────────────────────────────────────────────────
create table if not exists public.revela_guardian_auth (
  id            uuid primary key default gen_random_uuid(),
  talent_id     uuid not null unique references public.revela_talents(id) on delete cascade,
  -- O que vai no link. Aleatório e longo: é a única prova de que a mensagem
  -- chegou ao telefone que o atleta informou.
  token         text not null unique,
  status        text not null default 'pending' check (status in ('pending','approved','revoked')),

  -- Preenchido PELO RESPONSÁVEL, na página de autorização.
  guardian_name  text,
  guardian_cpf   text,   -- ⚠️ nunca sai em leitura. Ver cabeçalho.
  guardian_email text,
  guardian_phone text,
  -- Rastro de quem clicou: não identifica, mas mostra que houve um acesso real.
  approved_at   timestamptz,
  approved_ua   text,

  created_at    timestamptz not null default now()
);

alter table public.revela_guardian_auth enable row level security;

comment on table public.revela_guardian_auth is
  'Autorização do responsável pra publicar a foto de atleta menor de idade. '
  'RLS sem política: acesso só pelas funções security definer deste arquivo.';


-- ════════════════════════════════════════════════════════════════════════════
-- 1. Criar a autorização (o atleta pega o link)
-- ════════════════════════════════════════════════════════════════════════════
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

  -- Uma autorização por atleta, reaproveitada: gerar token novo a cada clique
  -- invalidaria o link que o responsável talvez já tenha recebido.
  select * into a from public.revela_guardian_auth where talent_id = t.id;
  if not found then
    insert into public.revela_guardian_auth (talent_id, token)
    values (t.id, encode(gen_random_bytes(24), 'hex'))
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


-- ════════════════════════════════════════════════════════════════════════════
-- 2. Abrir o link (o responsável vê o que está autorizando)
-- ════════════════════════════════════════════════════════════════════════════
-- Anônimo de propósito: o responsável não tem conta e não vai criar uma pra
-- clicar num link do WhatsApp. Devolve só o necessário pra ele reconhecer o
-- moleque — nome, posição, clube — e a foto que será publicada. Nada de
-- telefone, e-mail ou qualquer dado de contato.
create or replace function public.revela_ver_autorizacao(p_token text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'ok',        true,
    'status',    a.status,
    'atleta',    coalesce(nullif(t.nickname, ''), t.name),
    'nomeCompleto', t.name,
    'pos',       t.pos,
    'clube',     t.club,
    'cidade',    t.city,
    'uf',        t.uf,
    'idade',     case when t.birth_year is not null
                      then extract(year from now())::int - t.birth_year end,
    'foto',      coalesce(t.pending_portrait_url, t.portrait_url),
    'slug',      t.slug
  )
  from public.revela_guardian_auth a
  join public.revela_talents t on t.id = a.talent_id
  where a.token = p_token
  limit 1;
$$;

grant execute on function public.revela_ver_autorizacao(text) to anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- 3. Autorizar (o responsável assina)
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.revela_autorizar(
  p_token text,
  p_nome  text,
  p_cpf   text,
  p_email text,
  p_fone  text,
  p_ua    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a     public.revela_guardian_auth;
  cpf   text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  fone  text := regexp_replace(coalesce(p_fone, ''), '\D', '', 'g');
begin
  select * into a from public.revela_guardian_auth where token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'link_invalido');
  end if;
  if a.status = 'approved' then
    return jsonb_build_object('ok', false, 'reason', 'ja_autorizado');
  end if;

  if length(trim(coalesce(p_nome, ''))) < 5 or position(' ' in trim(p_nome)) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'nome_incompleto');
  end if;
  -- 11 dígitos e não pode ser todos iguais (111.111.111-11 e afins). NÃO valida
  -- o dígito verificador: quem quer burlar burla o dígito também, e reprovar um
  -- CPF válido digitado certo custa mais do que aceitar um inválido.
  if length(cpf) <> 11 or cpf ~ '^(.)\1{10}$' then
    return jsonb_build_object('ok', false, 'reason', 'cpf_invalido');
  end if;
  if coalesce(p_email, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'reason', 'email_invalido');
  end if;
  if length(fone) < 10 then
    return jsonb_build_object('ok', false, 'reason', 'telefone_invalido');
  end if;

  update public.revela_guardian_auth
     set status         = 'approved',
         guardian_name  = trim(p_nome),
         guardian_cpf   = cpf,
         guardian_email = lower(trim(p_email)),
         guardian_phone = fone,
         approved_at    = now(),
         approved_ua    = left(coalesce(p_ua, ''), 300)
   where id = a.id;

  -- O momento em que o rosto entra no ar.
  update public.revela_talents
     set portrait_url         = coalesce(pending_portrait_url, portrait_url),
         pending_portrait_url = null,
         guardian_name        = coalesce(guardian_name, trim(p_nome)),
         guardian_phone       = coalesce(guardian_phone, fone),
         updated_at           = now()
   where id = a.talent_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.revela_autorizar(text, text, text, text, text, text) to anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- 4. O cadastro de menor guarda a foto EM ESPERA
-- ════════════════════════════════════════════════════════════════════════════
-- Trigger em vez de reescrever `revela_submit_talent`: aquela função tem 120
-- linhas de validação que não têm nada a ver com isto.
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

    -- Já deixa a autorização pronta: assim o painel do atleta tem link pra
    -- mostrar no primeiro acesso, sem ele precisar pedir nada.
    insert into public.revela_guardian_auth (talent_id, token)
    values (new.id, encode(gen_random_bytes(24), 'hex'))
    on conflict (talent_id) do nothing;
  end if;

  return null;
end;
$$;

drop trigger if exists revela_talents_foto_de_menor on public.revela_talents;
-- ANTES do autoscout (ordem alfabética do nome do trigger decide, e
-- "revela_talents_autoscout" < "revela_talents_foto_de_menor" — então este roda
-- depois, o que é certo: o autoscout não mexe em foto).
create trigger revela_talents_foto_de_menor
  after insert on public.revela_talents
  for each row
  execute function public.revela_segura_foto_de_menor();


-- ── Fechar a porta pra quem já está no ar ───────────────────────────────────
-- Menor com foto pública AGORA volta pra espera. Nenhum é apagado.
update public.revela_talents
   set pending_portrait_url = portrait_url,
       portrait_url         = null,
       updated_at           = now()
 where portrait_url is not null
   and birth_year is not null
   and extract(year from now())::int - birth_year < 18;

insert into public.revela_guardian_auth (talent_id, token)
select id, encode(gen_random_bytes(24), 'hex')
  from public.revela_talents
 where pending_portrait_url is not null
on conflict (talent_id) do nothing;


-- ════════════════════════════════════════════════════════════════════════════
-- 5. ITEM 3 — o sonho para de virar "história"
-- ════════════════════════════════════════════════════════════════════════════
-- Duas coisas: a vitrine passa a devolver `dream` (e o `pendenteFoto`, pra tela
-- saber por que não há retrato), e o painel do atleta ganha o estado da
-- autorização. O conserto do INSERT é a linha comentada no fim — quem grava é
-- `revela_submit_talent`, e ela vive em 20260724240000.
create or replace function public.revela_get_talent(p_slug text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'id',            rt.id,
    'slug',          rt.slug,
    'name',          coalesce(nullif(rt.nickname, ''), rt.name),
    'pos',           rt.pos,
    'category',      rt.category,
    'gameSituation', rt.game_situation,
    'club',          rt.club,
    'city',          rt.city,
    'uf',            rt.uf,
    'country',       rt.country,
    'birthYear',     rt.birth_year,
    'strongFoot',    rt.strong_foot,
    'bio',           rt.bio,
    'dream',         rt.dream,
    'portrait',      rt.portrait_url,
    -- A tela precisa distinguir "não mandou foto" de "a foto espera o
    -- responsável" — a segunda vira convite, não buraco.
    'fotoEsperando', rt.pending_portrait_url is not null,
    'video',         rt.video_url,
    'instagram',     rt.instagram_url,
    'attributes',    rt.attributes,
    'overall',       rt.overall,
    'ratingSource',  rt.rating_source,
    'status',        rt.status,
    'featured',      rt.featured,
    'carded',        rt.status = 'carded',
    'dna',           (
      select jsonb_build_object('arquetipo', d.arquetipo, 'tracos', d.tracos)
        from public.revela_talent_dna d where d.talent_id = rt.id
    ),
    'supporters',    (select count(*)::int from public.revela_supports s where s.talent_id = rt.id),
    'createdAt',     rt.created_at
  )
  from public.revela_talents rt
  where rt.slug = p_slug
    and rt.status in ('approved', 'carded')
  limit 1;
$$;

grant execute on function public.revela_get_talent(text) to anon, authenticated;


create or replace function public.revela_my_talent()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'id',         rt.id,
    'slug',       rt.slug,
    'handle',     rt.handle,
    'name',       coalesce(nullif(rt.nickname, ''), rt.name),
    'pos',        rt.pos,
    'category',   rt.category,
    'club',       rt.club,
    'city',       rt.city,
    'uf',         rt.uf,
    'portrait',   rt.portrait_url,
    'overall',    rt.overall,
    'status',     rt.status,
    'scoutNote',  rt.scout_note,
    'supporters', (select count(*)::int from public.revela_supports s where s.talent_id = rt.id),
    'indicacaoAtiva', exists (
      select 1 from public.profiles p
      where p.id = rt.user_id and p.my_referral_code is not null
    ),
    'dna',        (
      select jsonb_build_object('arquetipo', d.arquetipo, 'tracos', d.tracos, 'respostas', d.respostas)
        from public.revela_talent_dna d where d.talent_id = rt.id
    ),
    -- O bloco da autorização no painel. `token` sai só pro DONO da ficha —
    -- é ele que vai mandar o link pro responsável.
    'autorizacao', (
      select jsonb_build_object('status', a.status, 'token', a.token)
        from public.revela_guardian_auth a where a.talent_id = rt.id
    ),
    'fotoEsperando', rt.pending_portrait_url is not null,
    'createdAt',  rt.created_at
  )
  from public.revela_talents rt
  where rt.user_id = auth.uid()
    and rt.status <> 'rejected'
  order by rt.created_at asc
  limit 1;
$$;

grant execute on function public.revela_my_talent() to authenticated;


-- ─── O que falta, e é UMA LINHA em 20260724240000 ───────────────────────────
-- Naquele INSERT, a lista de colunas diz `bio` no lugar onde o valor é
-- `p_dream`. Trocar a palavra `bio` por `dream` na lista resolve pra frente.
-- Está separado porque recriar aquela função inteira aqui (120 linhas de
-- validação) é onde erro de transcrição mora.
--
-- Pra quem já foi cadastrado com o sonho preso na bio:
--
--   update public.revela_talents
--      set dream = bio, bio = null
--    where dream is null and bio is not null and rating_source = 'auto';
