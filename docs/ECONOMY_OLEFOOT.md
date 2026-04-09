# Economia OLEFOOT — EXP, ranking, BRO e jogadores especiais

Documento de objetivos de produto e regras de sistema. Ajustes jurídicos, contábeis e de compliance ficam com o time especializado.

## Resumo

| Perna | Moeda | Ranking EXP | Função |
|--------|--------|----------------|--------|
| Progressão / jogo | **EXP** | Sim — **somente `exp_balance`** (saldo gastável) | Itens, boosters, estruturas, jogadores do catálogo EXP (se houver) |
| Valor real / prêmios / especiais | **BRO** (ref. **1 BRO ≈ 1 USD**) | Não | Prêmios, compra de cards **especiais**, saques; ledger lastreado em tesouraria |

- Gastar EXP reduz `exp_balance` e pode baixar a posição no ranking mundial.
- **`exp_lifetime_earned`** (ou equivalente) é para conquistas, perfil e telemetria — **não** ordena o ranking.
- **Jogador especial**: compra e repasses **só em BRO**; saque fiat em fluxo separado de EXP.
- **Leilões**: campo obrigatório `auction_currency: 'EXP' | 'BRO'`; mesma moeda para todos os lances e quitação daquele anúncio. Evitar MVP com lances mistos EXP/BRO.

## Implementação no repositório (cliente Vite)

| Item | Onde |
|------|------|
| Tipos (`WalletCurrency`, `LedgerEntry`, `AuctionCurrency`, ranking) | `src/economy/model.ts` |
| Saldo EXP (ranking) + BRO + lifetime EXP | `FinanceState` em `src/entities/types.ts` |
| `grantEarnedExp` (ganho que incrementa lifetime) vs `addOle` (saldo só) | `src/systems/economy.ts` |
| Display BRO + nota USD | `formatBroDisplay` em `src/systems/economy.ts` |

Persistência: o campo **`ole`** no JSON salvo é o **`exp_balance`** (nome legado). `expLifetimeEarned` é preenchido quando o ganho vem de fontes “de jogo” (ex.: premiação de partida, venda de relatório), não quando EXP é adquirido por troca BRO → EXP.

Jogadores **especiais** (BRO, split, facilitador): ver também [`docs/ADMIN_TACTICAL_BRO.md`](./ADMIN_TACTICAL_BRO.md).

## API / backend (sugestão)

- `LedgerEntry`: `user_id`, `currency: 'EXP' | 'BRO'`, `delta`, `reason`, `ref_id`, `created_at`.
- Leaderboard: `ORDER BY exp_balance DESC` (+ desempate acordado).
- Leilões: toda linha de histórico de lance na moeda do anúncio.

## Critérios de aceite (checklist)

- [ ] Ganhar EXP (partida/missão/etc.) aumenta `exp_balance` e pode subir no ranking.
- [ ] Compras em EXP reduzem `exp_balance` e refletem no ranking na próxima atualização.
- [ ] BRO como saldo único; copy: 1 BRO ≈ 1 USD com letras pequenas legais.
- [ ] Prêmios BRO não “criam” BRO sem origem na tesouraria acordada.
- [ ] Especiais: preço e split em BRO; saque fiat separado de EXP.
- [ ] Cada leilão tem `auction_currency` explícito na API e selo claro na UI.
