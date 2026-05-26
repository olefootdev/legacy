-- Buckets do fluxo Academia OLE: selfies (privado, temporário) + portraits
-- e cards promocionais (público).
--
-- academy-selfies: selfie do manager usada como referência pelo admin pra
--   gerar a arte final no Freepik. Privado pois é dado pessoal; signed URLs
--   geradas com TTL 7 dias na rota /api/academy/upload-selfie. Deletada após
--   o admin "lançar" o jogador no plantel (cleanup futuro).
--
-- academy-portraits: arte final do jogador (portraitUrl) e card promocional
--   (promotionalCardUrl). Público pois o manager precisa exibir no plantel
--   e compartilhar nas redes sociais. Subdividido em duas subpastas
--   (portrait/ e promo/) só pra organização visual no dashboard.

insert into storage.buckets (id, name, public)
values
  ('academy-selfies', 'academy-selfies', false),
  ('academy-portraits', 'academy-portraits', true)
on conflict (id) do nothing;

-- Policies — uploads via service_role bypass RLS, então só precisamos abrir
-- LEITURA pra usuários autenticados (selfies) e leitura pública (portraits
-- já são públicos via bucket public=true).

drop policy if exists "academy_selfies_authenticated_read" on storage.objects;
create policy "academy_selfies_authenticated_read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'academy-selfies');

drop policy if exists "academy_selfies_owner_delete" on storage.objects;
create policy "academy_selfies_owner_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'academy-selfies' and owner = auth.uid());
