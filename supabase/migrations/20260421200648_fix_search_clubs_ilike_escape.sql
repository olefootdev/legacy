-- Escapa metacaracteres LIKE (%, _) e limita o input a 60 chars
-- antes de usar ilike, prevenindo pattern matching abusivo.

create or replace function public.search_clubs_for_friendly(search text, max_results int default 12)
returns table (club_id uuid, name text, short_name text)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id as club_id,
    c.name,
    coalesce(nullif(btrim(c.short_name), ''), left(c.name, 48)) as short_name
  from public.clubs c
  inner join public.profiles p on p.club_id = c.id
  where
    public.my_club_id() is not null
    and c.id <> public.my_club_id()
    and nullif(btrim(search), '') is not null
    and (
      c.name ilike '%' || replace(replace(left(btrim(search), 60), '%', '\%'), '_', '\_') || '%' escape '\'
      or coalesce(c.short_name, '') ilike '%' || replace(replace(left(btrim(search), 60), '%', '\%'), '_', '\_') || '%' escape '\'
    )
  order by c.name asc
  limit least(coalesce(max_results, 12), 24);
$$;

comment on function public.search_clubs_for_friendly(text, int) is
  'Lista clubes com utilizador associado (perfil), excluindo o clube do JWT; para convite amistoso. Input escapado e limitado a 60 chars.';

grant execute on function public.search_clubs_for_friendly(text, int) to authenticated;
