-- match_events são imutáveis após inserção — eventos de partida não devem ser alterados.
-- Bloqueia UPDATE e DELETE para todos os roles (service_role bypassa RLS quando necessário).

create policy "match_events_no_update"
  on public.match_events for update
  using (false);

create policy "match_events_no_delete"
  on public.match_events for delete
  using (false);
