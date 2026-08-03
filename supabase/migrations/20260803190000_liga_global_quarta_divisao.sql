-- ============================================================================
-- LIGA GLOBAL — a QUARTA divisão (Várzea)
-- ============================================================================
-- A liga passa de 3 para 4 divisões. O banco já aceitava o valor 4 desde
-- 20260724160000 ("só destrava o valor; nada cria a 4ª até o reset") — o que
-- faltava era o motor obedecer, e o que falta aqui é a PORTA DE ENTRADA.
--
-- ── POR QUE ISTO É A PEÇA QUE FALTAVA ───────────────────────────────────────
-- Clube sem divisão definida era contado como divisão 3, porque 3 era a última
-- — a de entrada. Com quatro divisões, a última passa a ser a 4. Sem esta
-- migration, todo clube novo continuaria caindo na Acesso e a Várzea nasceria
-- vazia no dia seguinte ao reset.
--
-- ⚠️ ESTA MIGRATION NÃO MOVE NINGUÉM. Os 75 clubes de hoje continuam onde
-- estão até o RESET DE TEMPORADA, que é quem redistribui. O que muda aqui é
-- só o destino de quem chega a partir de agora.
-- ============================================================================


-- ─── Contagem por divisão (alimenta o número do hero no REVELA) ─────────────
create or replace function public.revela_divisions()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object('division', d.division, 'clubs', d.clubs) order by d.division
  ), '[]'::jsonb)
  from (
    -- Sem divisão = ainda não classificado = entra pela última, que agora é a 4.
    select coalesce(division, 4) as division, count(*)::int as clubs
    from public.global_league_teams
    group by coalesce(division, 4)
  ) d;
$$;

grant execute on function public.revela_divisions() to anon, authenticated;


-- ─── A trava do banco ───────────────────────────────────────────────────────
-- Já devia aceitar 1..4 desde julho. Reafirmado aqui pra esta migration ser
-- suficiente sozinha: quem aplicar só ela, num banco restaurado de backup
-- antigo, não fica com a 4ª barrada por um CHECK de abril.
alter table public.global_league_teams drop constraint if exists valid_division;
alter table public.global_league_teams
  add constraint valid_division check (division is null or (division >= 1 and division <= 4));


-- ─── Verificação ────────────────────────────────────────────────────────────
-- Antes do reset, ainda deve mostrar 3 divisões (ninguém foi movido):
--   select public.revela_divisions();
--
-- Depois do reset de temporada, deve mostrar 4.
