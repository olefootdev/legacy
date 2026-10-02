# RUNBOOK — criar o $OLEFOOT na Solana MAINNET

*2026-10-01 · decisões do fundador: mainnet já, com site e logo prontos · baldes
distribuídos depois · liquidez só quando a pré-venda cruzar **$10.000** · as
wallets recebem token desde o dia zero (valor chega com a pool).*

**O script é o mesmo que foi PROVADO de ponta a ponta num validador Solana
local** (mint Token-2022 + taxa 5% + metadata + 5B cunhados + supply travado +
releitura on-chain conferida). Na mainnet só muda a rede e QUEM assina.

---

## 0. O que já está pronto (não refazer)

| Peça | Onde |
|---|---|
| Logo oficial (SVG + PNG 512) | `public/token/olefoot-token.{svg,png}` → servidos em `game.olefoot.ai/token/…` |
| Metadata JSON do token | `public/token/olefoot-metadata.json` (URI do mint aponta pra ele) |
| Script de criação | `scripts/token/criar-olefoot-mint.mts` |
| Página pública do token | `game.olefoot.ai/token` (endereço do contrato aparece sozinho via env) |
| Wallet lendo on-chain | Wallet do jogo mostra o saldo $OLEFOOT da carteira vinculada quando `VITE_OLEFOOT_MINT` existir |
| Régua de números | `docs/TOKENOMICS.md` Rev 6 — 5B · 9 decimais · taxa 500 bps sem teto |

⚠️ **Deploy do front ANTES do mint**: a URI da metadata é
`https://game.olefoot.ai/token/olefoot-metadata.json` — ela precisa responder
200 quando o mint for criado (carteiras leem na hora de mostrar o logo).

## 1. Pré-condições (uma vez)

1. **Chave do deployer** — SUA, criada por você, nunca por IA nem colada em chat:
   `solana-keygen new -o ~/.config/solana/olefoot-deployer.json` (guarda a seed offline).
2. **Saldo**: ~0,05 SOL na chave (rent do mint + taxas; sobra é devolvível).
3. **Multisig** (recomendado antes de divulgar o endereço): cria um Squads
   (https://squads.so) com as chaves dos founders — é pra onde as autoridades vão no §4.

## 2. Criar o token (1 comando)

```bash
npx tsx scripts/token/criar-olefoot-mint.mts --rede mainnet \
  --pagador ~/.config/solana/olefoot-deployer.json \
  --travar-supply
```

O que acontece, nesta ordem (e o script CONFERE relendo a chain no final):
- mint **Token-2022** com taxa de transferência **5% sem teto** (pra carteira do pagador)
  e **metadata no próprio mint** (OLEFOOT / OLEFOOT / URI acima);
- **5.000.000.000 × 10⁹** cunhados na ATA da tesouraria (default: o pagador;
  use `--tesouraria <pubkey>` pra cunhar direto no cofre);
- `--travar-supply` **revoga a mint authority**: supply fixo pra sempre, verificável;
- freeze authority nasce **nula** (ninguém congela carteira de ninguém);
- endereços gravados em `scripts/token/mint.out.mainnet.json`.

## 3. Ligar o jogo no token (mesmo dia)

```bash
# no deploy do front (adicionar ao comando deploy:cloudflare ou ao .env):
VITE_OLEFOOT_MINT=<mint do passo 2>
```
Com isso, automaticamente: a página `/token` publica o endereço do contrato, e a
Wallet passa a mostrar o saldo on-chain da carteira vinculada de cada jogador.

**Primeiros envios** (wallets funcionando sem valor — decisão 5): os saques do
bônus da expansão já têm fila de aprovação no admin; pagar = transferir da
tesouraria pra carteira do claim e colar a assinatura no painel. Lembra que a
taxa de 5% morde na transferência — o jogo já calcula o bruto (gross-up) em
`expansao_claim_bruto_interno`.

## 4. Segurança das autoridades (semana 1)

Transferir pro multisig (Squads) — três autoridades ficaram com o deployer:
- **TransferFee config** (muda a alíquota) e **Withheld withdraw** (saca a taxa retida):
  `spl-token set-transfer-fee-authority` / autoridade de saque — mover ambas.
- **Metadata update** (muda nome/símbolo/URI): mover ou revogar quando a arte for final.
- A tesouraria (onde estão os 5B) também deve ser uma ATA do multisig — transferir
  o saldo do deployer pro cofre assim que o multisig existir.

## 5. Baldes (depois, sem pressa — decisão 3)

Oito transferências da tesouraria, uma por balde, nos números EXATOS do
`TOKENOMICS.md` §2 (a taxa de 5% morde em cada transferência — conferir os
líquidos com `taxaDeTransferencia.ts`). Equipe/marketing via vesting
(Streamflow ou equivalente); claim v1 e expansão ficam na tesouraria até as
pontes de claim abrirem.

## 6. Liquidez — o gatilho de $10.000 (decisão 4)

O admin → Pré-venda mostra a régua **"Gatilho da liquidez: $X de $10.000"**.
Quando bater:
1. criar a pool no DEX (Raydium/Orca), par OLEFOOT/USDC, preço **$0,000125**;
   o TOKENOMICS manda enviar **263.157.894** do balde de Liquidez pra entregar
   250M na pool (a taxa morde no depósito);
2. ligar **"Liquidez adicionada"** no admin → Pré-venda (destrava a liberação
   da pré-venda — o flag `liquidez_adicionada` é a trava que as pontes checam);
3. a partir daí, todo token que já estiver nas carteiras tem preço de mercado
   sozinho — era exatamente o plano.

## O que NUNCA fazer

- Colar chave privada/seed em chat, issue, ou commit (nem criptografada).
- Criar segundo mint "de teste" na mainnet — teste é na devnet/validador local.
- Mudar número de balde sem mudar `TOKENOMICS.md` primeiro.
- Anunciar preço de mercado antes da pool existir — a página `/token` já diz a
  verdade; manter assim.
