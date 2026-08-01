-- ════════════════════════════════════════════════════════════════════════════
-- REVELA — "Em Alta da Semana" (gamificação: ranking justo por CRESCIMENTO)
--
-- Ranking por total de apoiadores favorece só o veterano e desanima o novato.
-- Este RPC ranqueia por quem MAIS CRESCEU nos últimos 7 dias — um moleque que
-- acabou de chegar e mobilizou a torcida pode liderar. O prêmio é visibilidade
-- (destaque na Home), que é o que o talento mais quer.
--
-- Zero schema novo: `revela_supports.created_at` já existe. Só um recorte.
-- Sem PII (mesma lista branca da vitrine). Só talentos aprovados/carded.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.revela_weekly_rising(p_limit int default 10)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(q.payload order by q.ord), '[]'::jsonb)
  from (
    select
      jsonb_build_object(
        'id',         rt.id,
        'slug',       rt.slug,
        'name',       rt.name,
        'pos',        rt.pos,
        'club',       rt.club,
        'uf',         rt.uf,
        'portrait',   rt.portrait_url,
        'overall',    rt.overall,
        'carded',     rt.status = 'carded',
        'supporters', coalesce(s.total, 0),
        'weeklyGain', w.gain                 -- novos apoiadores nos últimos 7 dias
      ) as payload,
      row_number() over (
        order by w.gain desc, coalesce(s.total, 0) desc, rt.created_at desc
      ) as ord
    from public.revela_talents rt
    -- INNER join: só entra quem GANHOU apoiador na semana.
    join (
      select talent_id, count(*)::int as gain
      from public.revela_supports
      where created_at > now() - interval '7 days'
      group by talent_id
    ) w on w.talent_id = rt.id
    left join (
      select talent_id, count(*)::int as total
      from public.revela_supports
      group by talent_id
    ) s on s.talent_id = rt.id
    where rt.status in ('approved', 'carded')
    order by w.gain desc, coalesce(s.total, 0) desc, rt.created_at desc
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  ) q;
$$;

grant execute on function public.revela_weekly_rising(int) to anon, authenticated;

comment on function public.revela_weekly_rising(int) is
  'Em Alta da Semana: ranqueia talentos por apoiadores GANHOS nos últimos 7 dias '
  '(ranking justo — o novato pode liderar). Sem PII, só aprovados/carded.';
