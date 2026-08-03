-- ============================================================================
-- REVELA — PROVA DE DIVULGAÇÃO (o print do Instagram)
-- ============================================================================
-- Decisão do fundador (2026-08-02): "basta a gente pedir um print! Postou,
-- tira um print e manda pra gente, aí aprovamos assim que a IA ver que é real."
--
-- É a saída certa. A alternativa era o webhook `mentions` da Meta, que exige App
-- Review + verificação de negócio — dias ou semanas — e ainda assim não cobre
-- story. O print funciona hoje, em todos os formatos, sem depender de ninguém.
--
-- ── A SEMANA É DECIDIDA AQUI, NÃO NO CLIENTE ────────────────────────────────
-- `semana` é calculada no servidor. Se viesse do navegador, bastava mandar
-- '2026-W01' pra reenviar a mesma missão quantas vezes quisesse — o `unique`
-- protegeria nada.
-- ============================================================================


create table if not exists public.revela_oleko_provas (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  mission    text not null check (mission in ('insta_post', 'insta_story', 'highlight')),
  semana     text not null,
  image_url  text not null,
  status     text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  -- Veredito da IA: o que ela viu e o quanto confia. Fica registrado mesmo
  -- quando um humano decide diferente — é como a régua da IA é auditada depois.
  ia_veredito text,
  note       text,
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  -- Uma prova por missão por semana. Reenvio na semana seguinte é bem-vindo.
  unique (user_id, mission, semana)
);

create index if not exists revela_oleko_provas_fila_idx
  on public.revela_oleko_provas (status, created_at desc);

alter table public.revela_oleko_provas enable row level security;

-- O atleta vê as próprias provas (é como a tela mostra "enviado / aprovado").
drop policy if exists revela_oleko_provas_self_read on public.revela_oleko_provas;
create policy revela_oleko_provas_self_read
  on public.revela_oleko_provas for select
  using (user_id = auth.uid());

-- Escrita NUNCA direto da tabela: só pela RPC abaixo, que carimba a semana e
-- força status 'pending'. Sem isto, o cliente inseriria status='approved'.


-- ─── Enviar prova ───────────────────────────────────────────────────────────
create or replace function public.revela_oleko_enviar_prova(
  p_mission   text,
  p_image_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_semana text := to_char(now() at time zone 'UTC', 'IYYY-"W"IW');
  v_uid    uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'auth_required');
  end if;
  if p_mission not in ('insta_post', 'insta_story', 'highlight') then
    return jsonb_build_object('ok', false, 'reason', 'missao_invalida');
  end if;
  -- Só aceita URL do nosso bucket. Sem isto, alguém apontaria a prova pra
  -- qualquer imagem da internet e a IA analisaria o print de outra pessoa.
  if p_image_url is null or p_image_url not like '%/storage/v1/object/public/revela-talent-photos/%' then
    return jsonb_build_object('ok', false, 'reason', 'url_invalida');
  end if;
  -- Só atleta manda prova: a Trajetória é dele, não do fã.
  if not exists (
    select 1 from public.revela_talents t
    where t.user_id = v_uid and t.status <> 'rejected'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'sem_ficha');
  end if;

  insert into public.revela_oleko_provas (user_id, mission, semana, image_url)
  values (v_uid, p_mission, v_semana, p_image_url)
  on conflict (user_id, mission, semana) do nothing;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'ja_enviado', 'semana', v_semana);
  end if;

  return jsonb_build_object('ok', true, 'semana', v_semana);
end;
$$;


-- ─── O estado das provas da semana (pra tela do atleta) ─────────────────────
create or replace function public.revela_minhas_provas()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_object_agg(p.mission, jsonb_build_object(
    'status', p.status,
    'note',   p.note
  )), '{}'::jsonb)
  from public.revela_oleko_provas p
  where p.user_id = auth.uid()
    and p.semana = to_char(now() at time zone 'UTC', 'IYYY-"W"IW');
$$;


-- ─── Fila e revisão (service role — o servidor é quem chama) ────────────────
create or replace function public.revela_provas_fila(p_limit int default 50)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(x order by x -> 'createdAt' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id',        p.id,
      'userId',    p.user_id,
      'mission',   p.mission,
      'semana',    p.semana,
      'imageUrl',  p.image_url,
      'status',    p.status,
      'iaVeredito', p.ia_veredito,
      'createdAt', p.created_at,
      'atleta',    coalesce(nullif(t.nickname, ''), t.name),
      'slug',      t.slug
    ) as x
    from public.revela_oleko_provas p
    left join public.revela_talents t on t.user_id = p.user_id
    where p.status = 'pending'
    order by p.created_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 200))
  ) q;
$$;

create or replace function public.revela_prova_revisar(
  p_id        uuid,
  p_status    text,
  p_ia        text default null,
  p_note      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.revela_oleko_provas%rowtype;
begin
  if p_status not in ('approved', 'rejected') then
    return jsonb_build_object('ok', false, 'reason', 'status');
  end if;

  update public.revela_oleko_provas
     set status = p_status,
         ia_veredito = coalesce(p_ia, ia_veredito),
         note = coalesce(nullif(trim(coalesce(p_note, '')), ''), note),
         reviewed_at = now()
   where id = p_id and status = 'pending'
  returning * into v;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'nao_pendente');
  end if;

  return jsonb_build_object('ok', true, 'userId', v.user_id, 'mission', v.mission, 'semana', v.semana);
end;
$$;


grant execute on function public.revela_oleko_enviar_prova(text, text) to authenticated;
grant execute on function public.revela_minhas_provas()                to authenticated;
-- Fila e revisão são service role: a fila carrega o user_id de todo mundo.
revoke all on function public.revela_provas_fila(int)                       from public, anon, authenticated;
revoke all on function public.revela_prova_revisar(uuid, text, text, text)  from public, anon, authenticated;


-- ─── Verificação ────────────────────────────────────────────────────────────
--   select public.revela_minhas_provas();          -- logado como atleta
--   select public.revela_provas_fila(20);          -- service role
