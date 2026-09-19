# Documentação da Solana — acervo local

Fonte de verdade para o plano de implementação do OLEFOOT na Solana.
Baixado em **2026-09-01**. Fica em `vendor/solana-docs/` — **fora do git** (35 MB,
1.337 markdowns, sem histórico). Este índice está versionado; o conteúdo não.

## Como regenerar

```bash
mkdir -p vendor/solana-docs && cd vendor/solana-docs
git clone --depth 1 https://github.com/solana-foundation/developer-content.git developer-content
git clone --depth 1 https://github.com/solana-foundation/solana-com.git solana-com
git clone --depth 1 https://github.com/solana-foundation/solana-attestation-service.git attestation-service
git clone --depth 1 https://github.com/metaplex-foundation/digital-asset-standard-api.git das-api
git clone --depth 1 https://github.com/magicblock-labs/session-keys.git session-keys
git clone --depth 1 https://github.com/magicblock-labs/ephemeral-rollups-sdk.git magicblock-er
git clone --depth 1 https://github.com/MeteoraAg/dynamic-bonding-curve.git meteora-dbc
rm -rf */.git developer-content/public
# solana-com vem em 19 idiomas e com os sites inteiros; manter só apps/docs/content/{docs,cookbook,learn,developers-learn}/{en,pt}
```

## O que tem onde

| Pasta | O que é |
|---|---|
| `developer-content/content/guides/games/` | **10 guias de jogo** — não linkados na página de gaming |
| `developer-content/content/guides/advanced/auto-approve.md` | os 4 caminhos de auto-aprovação |
| `developer-content/content/courses/token-extensions/` | Token-2022, um arquivo por extensão |
| `developer-content/content/courses/state-compression/` | compressão de estado e cNFT |
| `solana-com/docs/en/tools/` | **Kora, Commerce Kit, Keychain, Actions, Solana Pay, Attestations** |
| `solana-com/docs/pt/` | os mesmos docs em português |
| `attestation-service/` | SAS: SDK, programa e exemplos em TS e Rust |
| `das-api/` | Digital Asset Standard API |
| `session-keys/` | programa Anchor + cliente das session keys |
| `magicblock-er/` | SDK dos ephemeral rollups (uso futuro) |
| `meteora-dbc/` | programa da bonding curve dinâmica |

## Os arquivos que importam para o nosso plano

```
# assinatura sem popup (Frente 03)
developer-content/content/guides/advanced/auto-approve.md
session-keys/README.md
session-keys/programs/

# taxa patrocinada — o usuário nunca precisa de SOL (Frente 03)
solana-com/docs/en/tools/kora/index.mdx
solana-com/docs/en/tools/kora/operators/deployment/railway.mdx   # nosso backend já é Railway
solana-com/docs/en/tools/kora/operators/fees.mdx
solana-com/docs/en/tools/kora/security-audits.mdx

# não travar na escolha de provedor de carteira (Frente 03)
solana-com/docs/en/tools/keychain/           # 1 interface, 14 backends

# checkout e pagamento em React (Frente 07)
solana-com/docs/en/tools/commerce-kit/
solana-com/docs/en/tools/solana-pay/

# identidade verificada sem guardar PII (Frente 06)
solana-com/docs/en/tools/attestations/
attestation-service/examples/typescript/attestation-flow-guides/

# o token e o royalty (Frente 04)
developer-content/content/courses/token-extensions/transfer-fee.md
developer-content/content/courses/token-extensions/token-extensions-metadata.md

# estado de jogo on-chain (Frente 05)
developer-content/content/guides/games/saving-game-state.md
developer-content/content/guides/games/store-sol-in-pda.md
developer-content/content/guides/games/nfts-in-games.md
developer-content/content/guides/games/energy-system.md

# distribuição por link
solana-com/docs/en/tools/actions.mdx
```

## Como pesquisar

```bash
grep -rl "transfer fee" vendor/solana-docs/developer-content/content/courses/token-extensions/
grep -rn "session token" vendor/solana-docs/session-keys/programs/ --include=*.rs
```

Ver também: [OLEPAPER e plano de implementação](https://claude.ai/code/artifact/3c1baf7d-d756-474b-b015-2605f7f5e807).
