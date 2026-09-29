-- ═══════════════════════════════════════════════════════════════════════════
-- ATIVAÇÃO DA CASA — as contas-selo ativam sem Pix, e isso fica ESCRITO
--
-- Decisão do fundador (2026-09-29): "ativa a ORIGEM 7 sem pix, nós somos donos
-- do sistema". Correto — mas o caminho importa.
--
-- 🔴 O QUE EU NÃO FIZ: inserir uma linha em `presale_purchase` com status
-- 'pago'. Seria mais curto e estaria errado por três motivos concretos:
--
--   1. o pool do bônus é 25% da RECEITA (`poolDoCiclo`). Compra fantasma
--      inflaria o pool com dinheiro que nunca entrou, e a conta cairia na
--      cabeça de quem equipara de verdade;
--   2. o contador da pré-venda e qualquer relatório de vendas passariam a
--      contar essas linhas como venda;
--   3. daqui a seis meses alguém olha `pago` e vai procurar o dinheiro.
--
-- Então a ativação da casa é uma FONTE DIFERENTE, com nome, motivo e data.
-- A regra do fundador continua de pé: ninguém convida sem estar ativado. O que
-- muda é que existem duas formas de ativar, e as duas são auditáveis.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.expansao_ativacao_casa (
  user_id    uuid primary key references auth.users(id) on delete restrict,
  motivo     text not null,
  ativado_em timestamptz not null default now(),
  ativado_por text
);
alter table public.expansao_ativacao_casa enable row level security;
-- Leitura pública de propósito: se a casa ativou uma conta sem pagar, isso não
-- é segredo. Esconder seria a parte errada.
drop policy if exists expansao_ativacao_casa_leitura on public.expansao_ativacao_casa;
create policy expansao_ativacao_casa_leitura on public.expansao_ativacao_casa
  for select to anon, authenticated using (true);

-- Passa a aceitar as duas fontes. A ordem do `or` não é acidente: pagamento
-- primeiro, porque é o caminho normal.
create or replace function public.expansao_pode_convidar(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from presale_purchase
            where user_id = p_user and status = 'pago' and usd_cents >= 1000)
      or exists (select 1 from expansao_ativacao_casa where user_id = p_user);
$$;
revoke all on function public.expansao_pode_convidar(uuid) from public, anon;
grant execute on function public.expansao_pode_convidar(uuid) to authenticated, service_role;

comment on table public.expansao_ativacao_casa is
  'Contas ativadas pela casa, SEM pagamento. Existe pra não haver compra
   fantasma em presale_purchase: o pool do bônus é 25% da receita, e receita
   inventada sai do bolso de quem equipara de verdade.';
