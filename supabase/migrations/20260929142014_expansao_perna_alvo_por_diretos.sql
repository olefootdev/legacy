-- ═══════════════════════════════════════════════════════════════════════════
-- EXPANSÃO — a perna alvo sai dos INDICADOS DIRETOS, não do volume
--
-- ⚠️ ARQUIVO RECUPERADO em 2026-10-07. Aplicada direto no banco em 2026-09-29
-- (versão 20260929142014), sem arquivo no repo. O corpo da função abaixo é o
-- que está gravado em `supabase_migrations.schema_migrations` — copiado da
-- FONTE, não da memória (Regra 3 do _TEMPLATE). Sem este arquivo, reconstruir
-- o banco pelo repositório trazia de volta o balanceamento por volume.
--
-- 🐞 O balanceamento por VOLUME não serve pra quem está começando.
-- Patrocinador novo tem zero nos dois lados → empate → Time 1 sempre. No teste,
-- três cadastros seguidos pela mesma pessoa caíram todos no Time 1 e ela
-- continuou INATIVA, porque ativar exige 1 indicado em CADA perna.
--
-- A regra passa a olhar primeiro a coisa que destrava o bônus: quantos
-- INDICADOS DIRETOS cada perna já tem. Só quando as duas empatam em diretos é
-- que o volume desempata.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.expansao_perna_alvo(p_patrocinador uuid)
returns smallint language sql stable security definer set search_path = public as $$
  with diretos as (
    select coalesce((select n2.lado from expansao_no n2
              where n2.user_id = d.posicao_path[array_position(d.posicao_path, p_patrocinador) + 1]), d.lado) as perna
      from expansao_no d
     where d.patrocinador_id = p_patrocinador and p_patrocinador = any(d.posicao_path)
  ), c as (
    select count(*) filter (where perna = 1) as t1, count(*) filter (where perna = 2) as t2 from diretos
  )
  select coalesce(
    (select perna_padrao from expansao_no where user_id = p_patrocinador),
    case
      -- 1º critério: a perna com MENOS indicados diretos. É o que leva à ativação.
      when (select t1 from c) < (select t2 from c) then 1::smallint
      when (select t2 from c) < (select t1 from c) then 2::smallint
      -- 2º: empatou em diretos, desempata pelo volume menor.
      when coalesce((select volume from expansao_perna where user_id=p_patrocinador and lado=1 and trilho='qualificacao'),0)
        <= coalesce((select volume from expansao_perna where user_id=p_patrocinador and lado=2 and trilho='qualificacao'),0)
      then 1::smallint else 2::smallint end);
$$;

revoke all on function public.expansao_perna_alvo(uuid) from public, anon, authenticated;
grant execute on function public.expansao_perna_alvo(uuid) to service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — roda junto e derruba tudo se falhar
-- ═══════════════════════════════════════════════════════════════════════════
-- Exercita o caminho novo: chama a função de verdade e confere o ACL no final.
do $$
declare v_perna smallint;
begin
  -- patrocinador inexistente: sem diretos nos dois lados, o volume desempata → 1
  select public.expansao_perna_alvo('00000000-0000-0000-0000-000000000000'::uuid) into v_perna;
  if v_perna is null or v_perna not in (1, 2) then
    raise exception 'expansao_perna_alvo devolveu % — esperado 1 ou 2', coalesce(v_perna::text, 'null');
  end if;

  if has_function_privilege('anon', 'public.expansao_perna_alvo(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.expansao_perna_alvo(uuid)', 'execute') then
    raise exception 'expansao_perna_alvo ficou executável pelo cliente';
  end if;
  if not has_function_privilege('service_role', 'public.expansao_perna_alvo(uuid)', 'execute') then
    raise exception 'service_role perdeu o execute em expansao_perna_alvo';
  end if;

  raise notice 'verificação: ok — perna alvo = %, ACL fechado no cliente', v_perna;
end $$;
