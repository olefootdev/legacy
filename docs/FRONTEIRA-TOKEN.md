# A fronteira do token

Uma regra só. Ela existe porque o saldo do jogo é escrito pelo navegador, e o
token não pode herdar isso.

> 🔴 **Nenhuma decisão de token — airdrop, mint, distribuição, alocação — pode
> ler `manager_game_state.finance`.**

## Por quê

`manager_game_state.finance` é gravado pelo **cliente**. A política de RLS
deixa cada manager escrever a própria linha, e o save do jogo manda o objeto
`finance` inteiro: saldo, lifetime e histórico. Não é um delta validado, é um
retrato que o navegador declara.

Medido em 2026-09-21: **1.285.636.685** nesse campo, e qualquer pessoa com
sessão grava o número que quiser no próprio.

Isso é tolerável enquanto o número só compra coisa dentro do jogo. Deixa de ser
no instante em que ele decidir quantidade de token: aí forjar saldo vira forjar
dinheiro.

Não adianta tentar tapar com teto. O maior crédito legítimo do jogo é de
**400 milhões numa escrita só** (Legends Cup, final, run ≥ 3) e a aposta 2× da
Liga Ole **não tem teto nenhum** — é função do saldo. Qualquer limite que não
quebre o jogo também não barra a fraude.

## O que vale no lugar

A base do airdrop é **`public.airdrop_v1_snapshot`**: cópia congelada do saldo
da v1, que veio de `legacy_olefoot_credits` (escrito pelo **servidor**), com a
carteira BSC de origem. RLS ligada, tudo revogado de `anon` e `authenticated`,
e `on conflict do nothing` pra que recongelar não sobrescreva.

Detalhe que motivou o congelamento: `legacy_olefoot_credits.balance_human` é a
mesma coluna que a compra de lenda debita. A "foto" era uma coluna viva.

## Como conferir que a regra vale

```sql
select * from public.fronteira_token_violacoes();
```

Zero linhas = fronteira de pé. Ela acusa:

1. função do banco que leia `finance` e mencione token/airdrop/solana/mint;
2. view que exponha `finance` junto com token/airdrop;
3. `airdrop_v1_snapshot` alcançável pelo cliente.

Só `service_role` executa. A checagem se exclui da própria varredura porque o
corpo dela cita as duas palavras como texto de busca — na primeira tentativa da
migration ela se acusou sozinha, e a verificação recusou aplicar.

## Estado auditado (2026-09-21)

Tudo que toca `finance` no banco, e nada disso é caminho de token:

| Objeto | Papel | Cliente executa |
|---|---|---|
| `audit_manager_finance_change` | trigger de auditoria | — |
| `_apply_finance_prize` | credita prêmio | não |
| `pay_ko_prize_backlog` | backlog do mata-mata | não (`service_role`) |
| `pay_season_champion_backlog` | backlog de título | não (`service_role`) |
| `claim_my_ko_prizes` | claim do próprio manager | sim |
| `claim_my_season_champion_prizes` | claim do próprio manager | sim |

Nenhuma view. Nenhuma outra tabela. No código, `airdrop` só aparece em
comentário e o caminho Solana não lê `finance` em lugar nenhum.

## O que esta regra NÃO resolve

Ela protege o token do saldo forjável. **Não conserta o saldo.** Enquanto o
cliente escrever `finance`, o número dentro do jogo continua sendo uma
declaração do navegador — e o conserto de verdade é o servidor saber o
resultado da partida, não um limite maior.

Ver também: `docs/VOLT2.md` (régua de design) e a migration
`20260921130000_fronteira_token_nao_le_saldo_do_cliente.sql`.
