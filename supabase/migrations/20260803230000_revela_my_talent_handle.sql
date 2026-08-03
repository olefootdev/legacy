-- ============================================================================
-- REVELA — o painel precisa saber o @ do atleta e se a indicação já credita
-- ============================================================================
-- `revela_my_talent()` não devolvia `handle`. Sem ele, o painel não tem como
-- montar o LINK DE INDICAÇÃO — que é justamente o link curto
-- `revela.olefoot.com/<handle>`: endereço e indicação na mesma URL.
--
-- ── POR QUE `indicacaoAtiva` E NÃO O CÓDIGO ─────────────────────────────────
-- O crédito de rede vem do `my_referral_code` da conta do atleta, que só existe
-- depois que ele cria o clube no jogo. Antes disso o link curto ABRE o perfil
-- mas não credita ninguém.
--
-- O painel precisa saber disso pra não mentir — mas não precisa do CÓDIGO em
-- si: quem resolve o código é `revela_resolve_handle`, no momento em que
-- alguém abre o link. Devolver só o booleano mantém a superfície mínima.
-- ============================================================================

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
    -- A indicação só credita quando o atleta já é manager no jogo.
    'indicacaoAtiva', exists (
      select 1 from public.profiles p
      where p.id = rt.user_id and p.my_referral_code is not null
    ),
    'createdAt',  rt.created_at
  )
  from public.revela_talents rt
  where rt.user_id = auth.uid()
    and rt.status <> 'rejected'
  limit 1;
$$;

grant execute on function public.revela_my_talent() to authenticated;


-- ─── Verificação ────────────────────────────────────────────────────────────
--   select public.revela_my_talent();   -- logado como atleta
-- Deve trazer as chaves "handle" e "indicacaoAtiva".
