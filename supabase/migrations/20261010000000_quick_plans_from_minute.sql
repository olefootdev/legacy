-- ═══════════════════════════════════════════════════════════════════════════
-- LEGACY (Partida Viva, Fase 4b/4c): a custódia aceita o replan `from_minute`
--
-- Grito, ordem individual e troca arrastada do banco pedem ao motor um replan
-- a partir de minuto+3 (`mode: 'from_minute'`). O check antigo só deixava
-- 'full' e 'second_half': o insert falhava calado, o plano voltava sem id e o
-- relato da partida saía `suspeita` — sem crédito do servidor pro jogador.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.quick_plans_emitidos drop constraint if exists quick_plans_emitidos_modo_check;
alter table public.quick_plans_emitidos
  add constraint quick_plans_emitidos_modo_check check (modo in ('full', 'second_half', 'from_minute'));


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — o insert que falhava agora entra (e sai na mesma transação)
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  dono uuid := (select id from auth.users limit 1);
  novo uuid;
begin
  if dono is null then
    raise notice 'verificação: sem usuário pra testar o insert (ambiente vazio)';
    return;
  end if;
  insert into public.quick_plans_emitidos (owner_id, seed, modo, resumo)
    values (dono, 'zz-verifica-from-minute', 'from_minute', '{}'::jsonb)
    returning id into novo;
  delete from public.quick_plans_emitidos where id = novo;
  begin
    insert into public.quick_plans_emitidos (owner_id, seed, modo, resumo)
      values (dono, 'zz-verifica-invalido', 'qualquer', '{}'::jsonb);
    raise exception 'o check deixou passar um modo inválido';
  exception when check_violation then
    null; -- esperado
  end;
  raise notice 'verificação: ok';
end $$;
