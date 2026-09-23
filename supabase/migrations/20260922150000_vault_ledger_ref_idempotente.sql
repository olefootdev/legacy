-- Idempotência do livro do Vault, como índice e não como "cuidado ao chamar".
--
-- `vault_ledger.ref` existe desde a 20260922140000 pra amarrar o movimento na
-- sua origem: a assinatura da transação Solana, o id do pagamento, o id da
-- colheita. Só que sem unicidade ele é decoração: webhook que reentrega, retry
-- de rede ou dedo duplo no botão creditam a pessoa duas vezes, e a segunda
-- passa por todas as outras travas — a soma fecha, a posição bate, o NAV está
-- certo. O dinheiro simplesmente nasceu.
--
-- Parcial porque movimento interno (marcação, reinvestimento) não tem origem
-- externa e vem com ref nulo; vários nulos convivem.
--
-- Aplicada e conferida em produção (pg_indexes), não no "Success".

create unique index if not exists vault_ledger_ref_unico
  on public.vault_ledger (fund_id, ref)
  where ref is not null;

comment on index public.vault_ledger_ref_unico is
  'Um ref externo entra uma vez só por fundo. Reentrega de webhook bate aqui (23505).';
