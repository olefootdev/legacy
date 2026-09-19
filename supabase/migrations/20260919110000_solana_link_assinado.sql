-- ════════════════════════════════════════════════════════════════════════════
-- A VIRADA · C1 — o vínculo de carteira só entra com assinatura
-- ════════════════════════════════════════════════════════════════════════════
-- A 20260918210000 criou `solana_wallet_links` com escrita pela RPC
-- `link_my_solana_wallet`, que aceitava qualquer endereço bem formado
-- (verified = false). Servia pra lista de espera; não serve pro que o vínculo
-- virou em 2026-09-19:
--   · o cadastro do AIRDROP da v1 (o saldo novo cai nesse endereço);
--   · a ponte com olefoot.com/wallet (quem é dono de qual clube).
--
-- A partir daqui quem grava é o servidor (POST /api/wallet/solana/link), com
-- service role, e só depois de conferir a assinatura ed25519 da própria
-- carteira sobre uma mensagem que amarra conta + endereço + instante
-- (server/src/lib/solanaLinkProof.ts). A prova fica guardada: qualquer um pode
-- reconferir a assinatura contra o endereço, sem confiar no nosso banco.
--
-- Medido antes de aplicar: 0 linhas em solana_wallet_links. Nada a migrar.

alter table public.solana_wallet_links
  add column if not exists verified_at     timestamptz,
  add column if not exists proof_message   text,
  add column if not exists proof_signature text;

-- Coerência: verificado ⇔ tem prova. Linha antiga sem prova fica verified=false.
alter table public.solana_wallet_links
  drop constraint if exists solana_wallet_links_verified_has_proof;
alter table public.solana_wallet_links
  add constraint solana_wallet_links_verified_has_proof
  check (not verified or (verified_at is not null and proof_message is not null and proof_signature is not null));

-- O cliente não escreve mais endereço sem assinatura. A função fica (reverter é
-- um grant), mas ninguém de fora executa.
revoke execute on function public.link_my_solana_wallet(text) from public, anon, authenticated;

comment on table public.solana_wallet_links is
  'Carteira Solana do manager, AO LADO da conta por e-mail. Gravada só pelo '
  'servidor depois de conferir a assinatura da carteira (proof_message + '
  'proof_signature, verificáveis por terceiro). Cadastro do airdrop da v1 e '
  'ponte com olefoot.com/wallet. Ver 20260919110000_solana_link_assinado.sql.';


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — executa o que mudou e desfaz o próprio rastro
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  v_uid uuid;
  v_msg text;
begin
  -- 1. o cliente não executa mais a RPC sem assinatura
  if has_function_privilege('authenticated', 'public.link_my_solana_wallet(text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.link_my_solana_wallet(text)', 'EXECUTE') then
    raise exception 'cliente ainda executa link_my_solana_wallet';
  end if;

  -- 2. o cliente continua sem escrita direta na tabela
  if has_table_privilege('authenticated', 'public.solana_wallet_links', 'INSERT')
     or has_table_privilege('authenticated', 'public.solana_wallet_links', 'UPDATE') then
    raise exception 'cliente consegue escrever em solana_wallet_links';
  end if;

  -- 3. a leitura da própria carteira segue funcionando (a Carteira do jogo usa)
  if not has_function_privilege('authenticated', 'public.get_my_solana_wallet()', 'EXECUTE') then
    raise exception 'cliente perdeu get_my_solana_wallet';
  end if;

  -- 4. o check recusa "verificado sem prova" e aceita com prova
  select id into v_uid from auth.users limit 1;
  if v_uid is not null then
    begin
      begin
        insert into public.solana_wallet_links (user_id, wallet_address, verified)
        values (v_uid, 'zzTesteSemProva1111111111111111111', true)
        on conflict (user_id) do update set verified = true, verified_at = null,
          proof_message = null, proof_signature = null,
          wallet_address = excluded.wallet_address;
        raise exception 'check deixou passar verificado sem prova';
      exception when check_violation then
        null; -- esperado
      end;

      insert into public.solana_wallet_links
        (user_id, wallet_address, verified, verified_at, proof_message, proof_signature)
      values (v_uid, 'zzTesteComProva1111111111111111111', true, now(), 'msg', 'sig')
      on conflict (user_id) do update set verified = true, verified_at = now(),
        proof_message = 'msg', proof_signature = 'sig',
        wallet_address = excluded.wallet_address;

      raise exception 'zz_verifica_ok';
    exception when others then
      v_msg := sqlerrm;
      if v_msg <> 'zz_verifica_ok' then
        raise exception 'verificação do vínculo assinado falhou: %', v_msg;
      end if;
    end;
  end if;

  raise notice 'verificação: ok — vínculo só pelo servidor, com prova';
end $$;
