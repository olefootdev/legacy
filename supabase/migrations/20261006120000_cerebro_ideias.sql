-- ═══════════════════════════════════════════════════════════════════════════
-- SMART-PROFILE — Fase 5: o CÉREBRO do jogador aceita o que o manager ensina
--
-- A memória do jogador (`player_profile_events`) só aceitava quatro tipos de
-- acontecimento. Aprender e esquecer uma ideia são acontecimentos da carreira
-- dele — e a memória é append-only, então é aqui que eles ganham lugar.
--
-- A mudança só ABRE o conjunto permitido: nenhuma linha existente viola o
-- constraint novo, e nada é reescrito. As tabelas em si não mudam.
--
-- Lógica: server/src/lib/smartProfile/ideias.ts. Plano: doc SMART-PROFILE, Fase 5.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.player_profile_events
  drop constraint if exists player_profile_events_tipo_check;

alter table public.player_profile_events
  add constraint player_profile_events_tipo_check
  check (tipo in (
    'nasceu', 'atributos', 'saiu_do_elenco', 'voltou_ao_elenco',
    -- Fase 5 — o manager ensina, o jogador leva a campo.
    'aprendeu_ideia', 'esqueceu_ideia'
  ));

-- Nenhuma linha antiga pode ter ficado de fora.
do $$
declare fora bigint;
begin
  select count(*) into fora from public.player_profile_events
  where tipo not in ('nasceu','atributos','saiu_do_elenco','voltou_ao_elenco','aprendeu_ideia','esqueceu_ideia');
  if fora > 0 then
    raise exception 'o constraint novo deixaria % linha(s) da memória fora', fora;
  end if;
end $$;
