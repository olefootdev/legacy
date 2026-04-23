-- Corrige policies de storage que permitiam INSERT/UPDATE/DELETE por anon.
-- Apenas utilizadores autenticados podem fazer upload/update/delete de retratos.
-- Leitura pública mantém-se (bucket é público).

drop policy if exists "genesis_portraits_auth_insert" on storage.objects;
create policy "genesis_portraits_auth_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'genesis-player-portraits'
    and name like 'genesis/%'
  );

drop policy if exists "genesis_portraits_auth_update" on storage.objects;
create policy "genesis_portraits_auth_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'genesis-player-portraits' and name like 'genesis/%')
  with check (bucket_id = 'genesis-player-portraits' and name like 'genesis/%');

drop policy if exists "genesis_portraits_auth_delete" on storage.objects;
create policy "genesis_portraits_auth_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'genesis-player-portraits' and name like 'genesis/%');
