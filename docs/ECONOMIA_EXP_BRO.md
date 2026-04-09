# Economia OLEFOOT — EXP, ranking, BRO (≈ USD) e fluxo de jogadores especiais

Documento de **objetivos de produto e regras de sistema**. Ajustes jurídicos, contábeis e de compliance de pagamento ficam com o time especializado.

---

## 1. Objetivos (resumo executivo)

1. **EXP** — Moeda de progressão **ganha** em partidas, ligas, missões e desafios; gasta em itens, boosters, **níveis de estrutura** e (onde aplicável) **aquisição de jogadores**. As estruturas **devem** retornar valor ao time (performance, bônus de EXP, etc.) para fechar o loop de jogo.
2. **Ranking mundial de EXP** — Considera **apenas `exp_balance`** (saldo atual gastável). Nenhuma outra métrica (ex.: EXP ganho no histórico) entra no ranking. **Gastar EXP reduz `exp_balance` e portanto o ranking** (ex.: 1000 → compra 250 → 750; posição pode cair). Escolha: acumular posição vs investir no clube.
3. **BRO** — **Um saldo “real” na plataforma**, com **paridade de referência 1 BRO = 1 USD** (um dólar americano) para comunicação e contabilidade interna. **Ligas premiadas em BRO**, missões com BRO, e **toda a compra de cards de jogadores especiais em BRO**.
4. **Jogadores especiais** — Compra **100% em BRO**; repasses e carteira do atleta/facilitador em **BRO**, com **saque para conta bancária em reais** (ou outra moeda local) via pipeline de pagamentos — **não** misturar esse fluxo com EXP.

**Meta de design:** um loop claro (ganhar EXP → gastar com trade-off no ranking → estruturas aceleram novo ganho) **e** uma perna fiduciária estável (BRO lastreada em operação real, sem “imprimir” BRO infinito).

---

## 2. Duas pernas da economia


| Perna                                | Moeda         | Função principal                                           | Ranking                                                                                   |
| ------------------------------------ | ------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Progressão / jogo**                | EXP           | Desbloquear e melhorar conteúdo de jogo; competição social | Sim — **só `exp_balance`** no ranking mundial                                             |
| **Valor real / prêmios / especiais** | BRO (≈ 1 USD) | Prêmios, compra de cards especiais, saques                 | Não misturar com ranking de EXP (pode existir ranking separado de BRO/ligas, se desejado) |


**Regra explícita:** compra de **jogador especial** = **só BRO**. Itens/boosters/estruturas com EXP = **só EXP** (a menos que produto decida híbridos pontuais; documentar se existir).

---

## 3. EXP — ganhos, gastos e ranking

### 3.1 Fontes de EXP (exemplos)

- Partidas (ao vivo, simulação, resultado, objetivos secundários).
- Ligas (colocação, participação).
- Missões diárias / semanais / eventos.
- Desafios (condições específicas).

### 3.2 Sinks de EXP (gastos)

- Loja de itens e boosters (preço em EXP).
- **Upgrade de nível de estrutura** (cidade/instalações) em EXP.
- Jogadores adquiríveis por EXP (se existirem no catálogo; distintos dos **especiais BRO**).

### 3.3 Ranking mundial

- **Regra fixa:** o ranking ordena **exclusivamente** por `**exp_balance`** (EXP disponível após todos os gastos) — o mesmo número que o jogador pode gastar. **Qualquer gasto em EXP reduz o ranking** (ex.: 1000 → 750 após compra de 250).
- `**exp_lifetime_earned`** (ou similar), se existir, serve para **conquistas, telemetria ou UI de perfil** — **não** entra na ordenação do ranking mundial.

### 3.4 Estruturas e loop

- Cada estrutura (ou nível) deve ter **efeito jogável** +, idealmente, **bônus de ganho de EXP** ou eficiência (menos fadiga, mais prêmios de partida, etc.).
- Objetivo de game design: **gastar EXP em estrutura não é só “perda no ranking”**; é **investimento** que aumenta fluxo futuro de EXP (e performance), dentro de curvas balanceadas.

---

## 4. BRO — paridade, saldo único e anti-inflação

### 4.1 Comunicação 1 BRO ≈ 1 USD

- **Objetivo de produto:** um único saldo BRO na plataforma entendido como **equivalente a 1 dólar** para o usuário e para relatórios internos.
- **Implementação real:** BRO pode ser **crédito ledger** lastreado em **caixa/tesouraria** (fiat mantida pela empresa ou parceiro de pagamentos), não um token “solto” sem responsabilidade de caixa.

### 4.2 Saldo real e inflação

- **Problema que se quer evitar:** emitir BRO infinito em prêmios sem entrada de valor → inflação interna e risco de **quebra de caixa** no resgate.
- **Diretrizes:**
  - Toda **entrada** de BRO (compra de usuário, parceiros) deve ter **registro contábil** correspondente.
  - **Prêmios de liga / missões em BRO** devem vir de **orçamento** (pool de temporada, receita de taxas, patrocínio) — não de criação mágica.
  - **Saques** (jogadores especiais, usuários) respeitam **disponibilidade** e KYC/AML conforme regulação.

### 4.3 Ligas e missões em BRO

- Premiações fixas ou variáveis **em BRO**, com **teto** e auditoria simples (quanto entrou vs saiu no período).

---

## 5. Jogadores especiais (cards) — só BRO até o saque em fiat

1. **Compra do card:** valor **integral em BRO** (checkout em BRO).
2. **Split** (já descrito no Admin): percentuais em BRO no ledger (Olefoot, agente, jogador, comunidade, facilitador conforme modelo).
3. **Carteira do beneficiário:** saldo em **BRO** na plataforma.
4. **Saque:** conversão **BRO → moeda fiat** (ex.: BRL na conta bancária), taxa de câmbio e spread definidos pela operação — **entendido pelo usuário** no fluxo de saque.

**Separação conceitual:** esse fluxo **não** usa EXP; evita confusão fiscal e de ranking.

---

## 6. Sistema de lances (leilões) — EXP vs BRO na interface

**Problema:** misturar no mesmo card “lance em EXP” e “quita em BRO” sem regra clara confunde o jogador e mistura **ranking** com **caixa fiduciária**.

### 6.1 Regra de produto (recomendada)

Cada **anúncio de leilão** tem **uma moeda oficial de lance**, explícita na UI:


| Tipo              | Moeda dos lances | Efeito                                                                                                                           |
| ----------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Leilão em EXP** | Só EXP           | Cada lance válido reserva/debita **EXP**; ao vencer, quita com **EXP**. **Altera `exp_balance`** → **altera o ranking mundial**. |
| **Leilão em BRO** | Só BRO           | Lances e arremate em **BRO**; **não** altera ranking de EXP.                                                                     |


**Na listagem e no detalhe do lance** deve aparecer sempre um selo inequívoco, por exemplo: **“Lances em EXP”** ou **“Lances em BRO”**, para ninguém achar que está gastando a moeda errada.

### 6.2 “Quitação agora” em BRO

- Se a intenção é **compra imediata em dinheiro da plataforma** (sem disputa em EXP), isso é um fluxo **BRO**: tratar como **compra direta** ou **buyout** com preço fixo em BRO no mesmo item, **ou** um segundo botão **“Arrematar agora — X BRO”** apenas em leilões catalogados como **BRO** (ou com buyout em BRO documentado no contrato do leilão).
- **Evitar (MVP):** o mesmo leilão aceitar lances alternados EXP e BRO — exige **taxa de conversão** oficial, impacto no ranking parcial e suporte; só documentar se produto exigir.

### 6.3 Resumo para implementação

- Campo obrigatório no backend: `auction_currency: 'EXP' | 'BRO'`.
- Toda linha do histórico de lances mostra valor **na moeda do leilão**.
- Ledger: crédito/débito só na moeda correspondente ao tipo de leilão.

---

## 7. Modelo de dados sugerido (campos mínimos)

```text
UserEconomy:
  exp_balance          # ÚNICA métrica do ranking mundial de EXP
  exp_lifetime_earned  # opcional; conquistas / perfil — NÃO entra no ranking
  bro_balance          # saldo único BRO (centavos ou micro-BRO)
  bro_lifetime_in      # opcional, compliance
  bro_lifetime_out     # opcional, saques
```

```text
LedgerEntry:
  user_id, currency: 'EXP' | 'BRO', delta, reason, ref_id, created_at
```

```text
RankingSnapshot / live query:
  ORDER BY exp_balance DESC  -- única chave de ordenação; desempate: ex. updated_at ou user_id
```

---

## 8. Critérios de aceite (economia)

- Ganhar EXP em partida/liga/missão aumenta `exp_balance` e pode subir posição no ranking (**somente `exp_balance` ordena o ranking**).
- Qualquer compra em EXP reduz `exp_balance` e **reflete no ranking mundial** na próxima atualização.
- Estruturas têm efeito documentado no jogo e, quando prometido, **aumentam ganho de EXP** ou equivalente.
- BRO exibido como **saldo único**; copy de produto: **1 BRO ≈ 1 USD** (com letras pequenas legais).
- Prêmios BRO e missões não criam BRO sem origem no modelo de tesouraria acordado.
- Jogador especial: **preço e repasses em BRO**; saque **fiat** em fluxo separado de EXP.
- Cada leilão tem `**auction_currency`** explícito; UI mostra **só EXP** ou **só BRO** para lances; histórico coerente com a moeda do anúncio.

---

## 9. Riscos e próximos passos não técnicos

- **Paridade fixa BRO/USD** com usuários em BRL implica **câmbio e disclosure** no saque/compra.
- **Ranking que cai ao gastar** é agressivo: pode incentivar **hoarding** ou frustrar; validar com playtest (curvas de estrutura ajudam).
- Jurídico: definição de BRO (voucher, crédito pré-pago, serviço) afeta KYC e impostos.

---

*Este doc alinha objetivos; implementação detalhada (contratos de API, anti-fraude, ledger idempotente) pode vir em `docs/ECONOMIA_IMPLEMENTACAO.md` se necessário.*