-- O grant que não era grant (A VIRADA · V1).
--
-- Na migration anterior eu escrevi `grant execute ... to service_role` achando
-- que isso restringia. Não restringe: o Postgres já concede EXECUTE a PUBLIC em
-- toda função nova, então o grant era redundante e a porta ficou aberta. É o
-- mesmo desenho que vazou PII em /api/admin/profiles: o portão falhando ABERTO.
--
-- `vault_ancestrais` é security definer e recebe `p_user` de quem chamar — ou
-- seja, qualquer sessão autenticada poderia subir a árvore de indicação de
-- qualquer pessoa e colher os uuid da rede dela. O servidor é o único chamador
-- legítimo (é ele quem monta o rateio), então volta a ser só do service_role.
--
-- `vault_reconciliar` é ferramenta de operação, não de produto: idem.
--
-- Conferido depois de aplicar, não no "Success":
--   has_function_privilege('authenticated', …, 'execute') = false nas três.

revoke execute on function public.vault_ancestrais(uuid, int) from public, anon, authenticated;
revoke execute on function public.vault_reconciliar()          from public, anon, authenticated;
revoke execute on function public.vault_apply(uuid,bigint,numeric,numeric,jsonb,jsonb) from public, anon, authenticated;

grant execute on function public.vault_ancestrais(uuid, int) to service_role;
grant execute on function public.vault_reconciliar()          to service_role;
grant execute on function public.vault_apply(uuid,bigint,numeric,numeric,jsonb,jsonb) to service_role;
