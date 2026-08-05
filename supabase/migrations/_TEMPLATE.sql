-- ════════════════════════════════════════════════════════════════════════════
-- MODELO DE MIGRATION — copie este arquivo, não escreva do zero
-- ════════════════════════════════════════════════════════════════════════════
-- Ele existe por causa de um dia específico: 2026-08-04. Nove migrations, e só
-- quatro precisavam existir. As outras cinco foram conserto de conserto, ou
-- dado disfarçado de schema. Este arquivo é a régua pra isso não repetir.
--
--
-- ── REGRA 1 · SCHEMA AQUI, DADO EM `scripts/` ───────────────────────────────
-- Migration é ESTRUTURA: tabela, coluna, função, trigger, índice, grant.
--
-- `update revela_talents set category = 'amador' where slug = 'juan'` NÃO é
-- migration. Rodando num ambiente novo, aquele slug não existe e o comando não
-- faz nada — ou pior, faz em cima de outro dado. E o histórico de schema fica
-- poluído de correção pontual.
--
-- Dado vai pra `scripts/`, roda pela service role (PostgREST resolve UPDATE sem
-- precisar de DDL), é repetível e deixa log. Modelo: `scripts/fix-juca-price.ts`.
--
-- A exceção legítima: BACKFILL de coluna nova. `update ... set nova = <derivado>`
-- pertence à migration que criou a coluna, porque sem ele a coluna nasce
-- inconsistente em qualquer ambiente.
--
--
-- ── REGRA 2 · A MIGRATION TEM QUE EXECUTAR O QUE ELA MUDOU ──────────────────
-- 🔴 Este é o erro caro, e ele não parece erro: o SQL Editor diz **Success**.
--
-- Em 2026-08-04 a migration 20260806140000 criou um trigger que chamava
-- `gen_random_bytes` — função do pgcrypto, que vive no schema `extensions` e
-- some sob `search_path = public`. Passou verde e ficou dois dias assim, porque
-- as duas chamadas estavam em caminhos que não rodaram ao aplicar:
--
--   • o trigger, que só dispara quando um menor com foto se cadastra;
--   • um `insert ... select` cujo SELECT devolveu ZERO linhas.
--
-- Resultado: menor de idade não conseguia se cadastrar. Numa migration cujo
-- objetivo era PROTEGER menor de idade.
--
-- O bloco de verificação no fim resolve. Ele roda no mesmo `apply`, na mesma
-- transação, e derruba tudo se o caminho novo não funcionar de verdade.
--
--
-- ── REGRA 3 · FUNÇÃO EXISTENTE SE COPIA DA FONTE, NÃO DA MEMÓRIA ────────────
-- `create or replace` de uma função que já existe é o lugar onde erro de
-- transcrição mora. No mesmo dia eu reescrevi `revela_trajetoria_ranking` de
-- cabeça pra acrescentar UMA linha e saiu com a assinatura trocada
-- (`p_limit` e `p_periodo` invertidos) e sem `revela_oleko_events` — teria
-- quebrado o placar inteiro.
--
-- O jeito certo: extrair o corpo do arquivo original por script, aplicar a
-- mudança pontual, e conferir que o diff tem o número de linhas esperado.
-- ════════════════════════════════════════════════════════════════════════════


-- ── O que muda ──────────────────────────────────────────────────────────────
-- (schema aqui)


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — roda junto e derruba tudo se falhar
-- ════════════════════════════════════════════════════════════════════════════
-- Não é comentário nem `select` de conferência: é execução. Se o caminho novo
-- não funcionar, a migration inteira volta atrás e você vê o erro na hora, em
-- vez de descobrir dias depois em produção.
--
-- Exercite o CAMINHO NOVO, não a existência dele:
--   • função nova  → chame com argumento de verdade e confira a saída
--   • trigger novo → insira uma linha que o dispare e confira o efeito
--   • coluna nova  → confira que o backfill preencheu o que devia
do $$
begin
  -- exemplo de função:
  --   if public.minha_funcao('entrada') is null then
  --     raise exception 'minha_funcao devolveu null pra entrada válida';
  --   end if;

  -- exemplo de trigger (insere, confere, apaga — tudo na transação):
  --   insert into public.minha_tabela (id, campo) values ('zz-verifica', 'x');
  --   if (select campo_normalizado from public.minha_tabela where id = 'zz-verifica') <> 'X' then
  --     raise exception 'o trigger não normalizou';
  --   end if;
  --   delete from public.minha_tabela where id = 'zz-verifica';

  raise notice 'verificação: ok';
end $$;
