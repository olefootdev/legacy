-- Troca ON DELETE CASCADE → ON DELETE RESTRICT na FK match_events.match_id.
-- Impede apagar partidas que já têm eventos registados (integridade de auditoria).

alter table public.match_events
  drop constraint if exists match_events_match_id_fkey;

alter table public.match_events
  add constraint match_events_match_id_fkey
  foreign key (match_id)
  references public.matches(id)
  on delete restrict;
