-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — sorteio da Fundação do Clube (Fase 2, 2026-10-07)
--
-- O elenco inicial (12 Genesis + 3 cards premium com 35/25/15% de chance de
-- Lenda Edição Fundação) é sorteado NO SERVIDOR (`POST /api/onboarding/sorteio`)
-- e gravado aqui. Pedir de novo devolve o MESMO sorteio — limpar o navegador
-- não vira re-sorteio até sair lenda.
--
-- Schema só: a coluna nasce nula; o servidor (service role) escreve.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.welcome_pack_grants
  add column if not exists sorteio jsonb;

comment on column public.welcome_pack_grants.sorteio is
  'Sorteio da Fundação do Clube: {versao, genesis[12 ids], premium[3 {tipo, id, chance}], expTier, sorteadoEm}. Escrito só pelo servidor; nulo = pacote antigo (cerimônia v2).';

-- Confere o caminho novo: a coluna existe, é jsonb e o comentário entrou.
-- (Não dá pra gravar linha de teste: user_id tem FK pra auth.users.)
-- Se algo não bater, a migration inteira volta.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'welcome_pack_grants'
      and column_name = 'sorteio' and data_type = 'jsonb'
  ) then
    raise exception 'sorteio_fundacao: coluna welcome_pack_grants.sorteio (jsonb) não existe';
  end if;
  if col_description('public.welcome_pack_grants'::regclass,
       (select attnum from pg_attribute where attrelid = 'public.welcome_pack_grants'::regclass and attname = 'sorteio')) is null then
    raise exception 'sorteio_fundacao: comentário da coluna não gravou';
  end if;
end $$;
