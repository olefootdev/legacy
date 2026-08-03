-- ════════════════════════════════════════════════════════════════════════════
-- REVELA — uma conta, uma ficha (agora também no ENVIO)
-- ════════════════════════════════════════════════════════════════════════════
-- `revela_claim_talent` sempre teve a regra "uma conta, um cadastro". O ENVIO
-- não tinha: `revela_submit_talent` grava `user_id = auth.uid()` direto no
-- INSERT, sem perguntar se aquela conta já tem ficha. Quem estava logado e
-- preenchia o formulário de novo criava uma SEGUNDA ficha, também dela.
--
-- ── POR QUE ISSO É PIOR DO QUE PARECE ───────────────────────────────────────
-- `revela_my_talent()` faz `where user_id = auth.uid() ... limit 1` SEM
-- `order by`. Com duas fichas, qual delas o painel mostra é decisão do
-- planejador do Postgres — pode mudar entre duas chamadas, depois de um vacuum,
-- ou quando um índice novo aparece. O atleta veria o painel trocar de ficha
-- sozinho, e o teste de DNA gravaria na que desse.
--
-- Aconteceu em produção: a conta olesports@olesports.com ficou com 'jonhnes' e
-- 'juan'. Esta migration fecha a porta e torna a escolha determinística — NÃO
-- apaga nada, porque decidir qual ficha sobrevive é do fundador, não do código.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. O envio recusa a segunda ficha ───────────────────────────────────────
-- Mesma razão que o claim já devolvia, mesmo nome: a tela do onboarding só
-- precisa aprender uma palavra nova se um dia quiser um texto diferente.
create or replace function public.revela_submit_talent_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null and exists (
    select 1 from public.revela_talents
     where user_id = new.user_id
       and status <> 'rejected'
       and id <> new.id
  ) then
    -- ERRCODE PADRÃO (P0001), NÃO unique_violation: `revela_submit_talent` tem
    -- um `exception when unique_violation` que traduz pra 'handle_taken'. Usar
    -- aquele código aqui faria a tela dizer "esse nome de usuário já foi pego"
    -- pra quem, na verdade, já tem ficha. A mensagem é a chave que o cliente lê.
    raise exception 'account_has_talent';
  end if;
  return new;
end;
$$;

drop trigger if exists revela_talents_uma_por_conta on public.revela_talents;
create trigger revela_talents_uma_por_conta
  before insert or update of user_id on public.revela_talents
  for each row
  execute function public.revela_submit_talent_guard();

comment on function public.revela_submit_talent_guard() is
  'Uma conta, uma ficha. Vale pro INSERT (envio logado) e pra troca de dono — '
  'a regra que revela_claim_talent já tinha, agora onde ninguém consegue passar por fora.';


-- ── 2. O painel para de sortear ─────────────────────────────────────────────
-- Enquanto a duplicata de produção existir, `limit 1` precisa de critério. A
-- MAIS ANTIGA vence: é a que o atleta divulgou, a que tem apoiador e a que o
-- olheiro pode já ter avaliado. A nova é sempre a que ele consegue refazer.
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
      select jsonb_build_object(
               'arquetipo', d.arquetipo,
               'tracos',    d.tracos,
               'respostas', d.respostas
             )
        from public.revela_talent_dna d
       where d.talent_id = rt.id
    ),
    'createdAt',  rt.created_at
  )
  from public.revela_talents rt
  where rt.user_id = auth.uid()
    and rt.status <> 'rejected'
  order by rt.created_at asc   -- determinístico: a primeira é a dele
  limit 1;
$$;

grant execute on function public.revela_my_talent() to authenticated;


-- ─── Verificação ────────────────────────────────────────────────────────────
-- Contas com mais de uma ficha (depois desta migration, só as que já existiam):
--
--   select user_id, count(*), array_agg(slug)
--     from public.revela_talents
--    where user_id is not null and status <> 'rejected'
--    group by user_id having count(*) > 1;
--
-- Pra soltar uma ficha de teste sem apagar nada (ela volta a ser órfã e some do
-- painel, mas continua no banco pro olheiro decidir):
--
--   update public.revela_talents set user_id = null where slug = 'juan';
