-- ════════════════════════════════════════════════════════════════════════════
-- REVELA — o atleta vira dono do próprio cadastro (passo 2 do funil)
--
-- O onboarding v2 deixou o envio anônimo: `user_id` nasce nulo. Isso resolveu a
-- fricção, mas abriu uma ponta solta — sem dono, o atleta não tem como voltar,
-- acompanhar ou editar nada. Este é o passo 2, "Validação de Conta": logo depois
-- de enviar, ele entra ou cria conta, e o cadastro passa a ser dele.
--
-- 🔒 COMO O CLAIM É PROTEGIDO. Sem cuidado, "reivindicar um cadastro pelo id"
-- vira porta pra qualquer pessoa logada roubar o perfil de outra. Três travas:
--
--   1. Exige DUAS provas: o `id` (UUID devolvido só a quem enviou, nunca
--      publicado) e o TELEFONE daquele cadastro. Quem tem os dois é quem acabou
--      de preencher o formulário.
--   2. Só reivindica o que está ÓRFÃO (`user_id is null`). Cadastro que já tem
--      dono não muda de mãos — nem pra quem acertar as duas provas.
--   3. Uma conta, um talento: se a conta já tem cadastro, recusa em vez de
--      acumular.
--
-- O que isso NÃO resolve: quem interceptar o id e o telefone de outra pessoa no
-- intervalo entre o envio e o claim. É uma janela de segundos, no mesmo
-- dispositivo — aceitável aqui. Se um dia o claim precisar acontecer horas
-- depois, a prova certa passa a ser um código enviado por WhatsApp.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.revela_claim_talent(
  p_talent_id uuid,
  p_phone     text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid   uuid := auth.uid();
  fone  text := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
  alvo  public.revela_talents;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'auth_required');
  end if;

  -- Uma conta, um cadastro. Sem isto, alguém poderia colecionar perfis.
  if exists (
    select 1 from public.revela_talents
    where user_id = uid and status <> 'rejected'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'account_has_talent');
  end if;

  select * into alvo
  from public.revela_talents
  where id = p_talent_id
    and contact_phone = fone     -- segunda prova
    and user_id is null          -- só o que está órfão
    and status <> 'rejected';

  if not found then
    -- Uma razão só para "não existe", "telefone não bate" e "já tem dono": as
    -- três respostas juntas viram um oráculo pra descobrir cadastro alheio.
    return jsonb_build_object('ok', false, 'reason', 'not_claimable');
  end if;

  update public.revela_talents
  set user_id       = uid,
      contact_email = coalesce(contact_email, (select email from auth.users where id = uid)),
      updated_at    = now()
  where id = alvo.id;

  return jsonb_build_object('ok', true, 'slug', alvo.slug);
end;
$$;

grant execute on function public.revela_claim_talent(uuid, text) to authenticated;

comment on function public.revela_claim_talent(uuid, text) is
  'Liga um cadastro anônimo à conta que acabou de entrar. Exige id + telefone e '
  'só age sobre registro órfão — ver o cabeçalho de 20260723230000.';


-- ── O atleta enxerga o próprio cadastro, mesmo antes de aprovado ────────────
-- A vitrine pública (`revela_get_talent`) só mostra 'approved'/'carded'. Quem é
-- dono precisa ver o dele em qualquer status, pra saber onde está na fila — mas
-- sem os campos que nem ele precisa reler (telefone do responsável, empresário).
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
    'createdAt',  rt.created_at
  )
  from public.revela_talents rt
  where rt.user_id = auth.uid()
    and rt.status <> 'rejected'
  limit 1;
$$;

grant execute on function public.revela_my_talent() to authenticated;
