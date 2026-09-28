# TOKENOMICS FINAL — $OLEFOOT na Solana

> **Revisão 4 — 2026-09-28 · PARA APROVAÇÃO DO FUNDADOR**
>
> Régua do token, como `VOLT2.md` é a régua do visual. Número aqui vira constante em
> código; constante em código não muda sem mudar este arquivo.
>
> A análise completa que produziu estes números está em `docs/TOKENOMICS-ANALISE.md`.
> 🔴 Interno até o fundador aprovar.

---

## 1. Vocabulário (fechado)

| Palavra | O que é |
|---|---|
| **VERBA / VRB** | saldo mole do jogo (`finance.ole`, cliente) |
| **OLEXP** | unidade de expansão da rede — contador, **não negociável** |
| **OLEFOOT** | o token na Solana |
| **BRO** | crédito de Pix |
| **Pontos** | classificação de liga |

**VERBA nunca vira OLEFOOT.** Os 1,28 bilhão em `finance.ole` **não são passivo de
token**. A única porta é o **REFUND PROGRAM**, com validação de conta, caso a caso.

---

## 2. A TABELA FINAL

**Supply: 5.000.000.000** · **Decimais: 9** · **Rede: Solana**

| Alocação | % | Tokens | Liberação |
|---|---|---|---|
| **Expansão (bônus de equiparação)** | **25%** | **1.250.000.000** | por tranche, limitada pela receita · claim com teto de 1%/dia |
| Claim holders antigos (v1) | 20% | 1.000.000.000 | degraus (§5) · topo travado por profundidade de pool |
| Ecossistema / recompensas in-game | 20% | 1.000.000.000 | emissão por jogo, 5 anos, **atrelada a sink** |
| Tesouraria / reserva | 12% | 600.000.000 | travado, governança, 6 meses de aviso |
| Equipe / fundadores | 12% | 600.000.000 | 12 meses de carência, linear 36 meses |
| **Pré-venda** | **5%** | **250.000.000** | 10% no lançamento, 1 mês de carência, linear 12 meses |
| **Liquidez DEX** | **4%** | **200.000.000** | 80M na pool no lançamento, 120M conforme a receita aprofunda |
| Marketing / parcerias / advisors | 2% | 100.000.000 | 5% no lançamento, linear 24 meses, teto mensal publicado |
| **TOTAL** | **100%** | **5.000.000.000** | |

### De onde saiu cada mudança (fecha em zero)

| Mudança | Δ |
|---|---|
| Comissões Marketing 10% + Comunidade 15% → **Expansão 25%** | 0% |
| Advisors 4% → 2% (junta com marketing/parcerias) | −2% |
| Pré-venda 4% → **5%** (250M, decisão do fundador) | +1% |
| Liquidez DEX 3% → **4%** | +1% |

**Por que Marketing + Comunidade viram Expansão:** o bônus de equiparação **é** o motor
de marketing e de comunidade — nas suas palavras, "serve pra gente alavancar e criar
comunidade". Manter três baldes para o mesmo trabalho é contar o mesmo dinheiro três
vezes. Sobram 2% de verba discricionária para listagem, design e parceria pontual.

**Por que Advisors caiu de 4% para 2%:** na tabela original advisors (200M) recebiam
80% da pré-venda inteira (250M). Advisor quase em paridade com quem pagou dinheiro é a
linha que vai ser printada — e com razão. Os 2% liberados pagam exatamente o +1% da
pré-venda e o +1% da liquidez.

---

## 3. A pré-venda e o lançamento

| | |
|---|---|
| Preço | **\$0,000125** |
| Meta de arrecadação | **\$10.000** |
| Tokens vendidos na meta | **80.000.000** (1,6% do supply · 32% do balde) |
| FDV no preço da pré-venda | **\$625.000** |

**FDV de \$625k é honesto** e é ponto forte destes números — muito mais defensável que
lançamento de FDV inflado.

### A pool no lançamento

| | |
|---|---|
| Tokens na pool | **80.000.000** (do balde de Liquidez) |
| USDC na pool | **\$10.000** (a arrecadação inteira) |
| Abre em | \$0,000125 |
| TVL | \$20.000 |
| Guardado do balde | 120.000.000, para aprofundar com a receita |

🔴 **Achado que muda a estratégia: preço não é alavanca.** Para abrir no preço da
pré-venda, `USDC = tokens × preço` — dobrar o preço dobra os dois lados, então a razão
`token vendido / token na pool` é **invariante ao preço**. A \$0,000125 ou a \$0,002, a
tranche derruba o mesmo tanto. Só três coisas protegem o gráfico: mais token na pool,
menos token saindo por dia, ou menos supply.

### Float no lançamento

| Origem | Tokens |
|---|---|
| Pré-venda, 10% dos 80M vendidos | 8.000.000 |
| Marketing, 5% de 100M | 5.000.000 |
| Expansão | **0** (estrangulada pelo teto) |
| **TOTAL** | **13.000.000 = 16,2% da reserva** |
| Impacto se tudo vender de uma vez | **−26,0%** |

---

## 4. O balde de Expansão — as três travas

**Tranche por etapa, começando em 5% na pré-venda.** Mas:

### 🔴 Trava 1 — a tranche é limitada pela RECEITA, não pelo degrau

| | Tokens | Valor |
|---|---|---|
| 5% do balde (degrau fixo) | 62.500.000 | \$7.812,50 |
| 25% da receita de \$10.000 | **20.000.000** | **\$2.500,00** |

A regra fixa liberaria **3,1× mais do que a receita cobre** — o "a cada \$1 destino
\$0,25" viraria \$0,78 por dólar. **A tranche é o MENOR entre o degrau e o que a receita
cobre.** Degrau é teto administrativo; receita é o chão da realidade.
→ `trancheLiberavel()` em `server/src/lib/expansao/equiparacao.ts`

### Trava 2 — teto diário de claim: 1% de impacto

O bônus acumula em **OLEXP**, que é contador e tem **zero impacto de mercado**. Quem
toca o mercado é o CLAIM. A tranche de 20M despejada de uma vez derrubaria a pool; o
teto transforma isso em saída gradual.

| Impacto máx./dia | Tokens/dia | Tranche de 20M sai em |
|---|---|---|
| **1,0% (aprovado)** | **403.025** | **50 dias** |

Pool desconhecida ⇒ teto zero ⇒ claim retido. O padrão seguro é não pagar.
→ `tetoDeClaim.ts`

### Trava 3 — piso do balde em 20%

Abaixo de 20% da tranche a liquidação **troca de régua**: deixa de ser denominada em
dinheiro e passa a distribuir fração do balde restante. É o que impede a espiral de
emitir mais token conforme o preço cai. → `abaixoDoPiso()`

### Realimentação — o balde é fundo rotativo, não saldo

Todo OLEFOOT que volta reentra no balde primeiro, até o tamanho da tranche:

| Fonte | Mecânica |
|---|---|
| Compra de card / lenda | preço em OLEFOOT |
| Aporte no Vault | taxa em OLEFOOT |
| Buy-in de liga premiada | já funciona em EXP |
| Compra via Pix | a casa compra no mercado para entregar |
| REFUND PROGRAM | a casa compra no mercado |

🔒 **Não existe valor fixo por OLEXP em lugar nenhum.** Liquidação é
`pool ÷ equiparado`, por ciclo. E o claim converte pelo preço **registrado no ciclo**,
nunca pelo preço do momento do claim.

---

## 5. Claim dos holders antigos — degraus e o portão de profundidade

Medido em produção (`airdrop_v1_snapshot`, congelado em 2026-09-21):

| Fato | Valor |
|---|---|
| Credores com saldo | 69 |
| Total congelado | 639.037.272 unidades |
| Maior credor · Top 3 · Top 10 | **26,3%** · **50,8%** · **78,2%** |
| Abaixo de 1M unidades | 22 pessoas = **1,3%** do balde |
| **Nunca logaram na v11** | **46 pessoas = 76,0% do valor** |
| **Com wallet Solana assinada** | **0** |

### ⚠️ Decisão pendente: a razão de conversão

20% = 1.000M contra um snapshot de 639.037.272. A razão implícita é **1,564854
token/unidade** e não está escrita em lugar nenhum.

| Opção | Balde | Consequência |
|---|---|---|
| **A** — manter 20%, gravar a razão 1,564854 | 1.000M | v1 ganha 56% de bônus sobre o de face. Maior credor fica com **262.722.918 = 5,25% do supply, 3,3× a pool** |
| **B** — razão 1:1, balde = 639M (12,8%) | 639M | os 7,2% liberados vão para Liquidez → pool **3,6× mais profunda**. Maior credor cai para 3,36% do supply |

**Recomendo B.** É a única mudança que resolve os dois problemas de uma vez — a
concentração e a profundidade da pool — e ela sai de um balde cujos donos, 76% deles,
nunca entraram na v11.

### Degraus (valem nas duas opções)

| Faixa | Pessoas | % do balde | Liberação |
|---|---|---|---|
| ≤ 1M unidades | 22 | 1,3% | **100% no lançamento** |
| 1M – 10M | 34 | ~19% | 24 meses linear |
| > 10M | 13 | ~80% | 60 meses linear diário |

Liberar 22 pessoas na hora custa 1,3% do balde e compra 22 evangelistas. Segurar os 13
que são 80% do balde é o que protege o gráfico — e é defensável porque é proporcional
ao risco de cada faixa.

### 🔴 O portão de profundidade

Mesmo com o vesting mais conservador, o desbloqueio mensal é **72,6% da reserva da
pool**:

| Cenário de vesting | Desbloqueio/mês | % da pool de 80M |
|---|---|---|
| A — o do original (claim 24m, pré 6m) | 87,4M | **109,2%** |
| B — degraus, topo em 36m | 82,2M | **102,7%** |
| C — degraus, topo em 60m, pré 12m | 58,1M | **72,6%** |

**A 5 bilhões de supply com \$10.000 de pool, nenhum calendário de vesting deixa essa
razão saudável.** Então o vesting dos baldes grandes **não começa por data — começa por
profundidade**:

| | |
|---|---|
| Gatilho | reserva da pool ≥ **194.000.000 tokens** (\$24.204 no lado USDC) |
| Hoje | 80.000.000 (\$10.000) — falta **2,4×** |
| Receita acumulada a injetar | **~\$14.204** |

Antes do gatilho só se movem: a faixa ≤1M do claim, o marketing e a expansão (já
estrangulada). Isso protege inclusive os holders — eles recebem um token com mercado,
em vez de um gráfico morto.

---

## 6. A taxa de transferência de 5%

**Decisão do fundador:** 5% em transferência de OLEFOOT, para wallet dos founders, a
partir do lançamento do token.

### 🔴 O que é irreversível e precisa ser decidido AGORA

SPL Token padrão **não tem taxa de transferência** — não existe como configuração.
Exige **Token-2022** com a extensão `TransferFee`. E, confirmado na doc da Solana:

| | |
|---|---|
| **A extensão NÃO pode ser adicionada depois** | tem que estar na criação do mint |
| **A ALÍQUOTA pode ser alterada depois** | via `SetTransferFee`, valendo 2 épocas adiante |
| Existe `maximumFee` absoluto por transferência | limita o dano em transferência grande |

Ou seja: **a alíquota é ajustável — o que não é ajustável é a escolha do Token-2022.**
E essa escolha vence no próximo passo do seu roadmap, que é criar o mint. Depois de
criado, não tem volta.

### O custo, com a conta feita

Pool de 80M + \$10.000. Round trip de \$1.000, ninguém mais mexendo no preço:

> pagou \$1.000,00 → recebeu **\$910,57** = **−8,94%** · founders levaram ≈ \$88,64
> · **sem a taxa o mesmo round trip é 0,00%**

Suporte de DEX: **Raydium CPMM aceita mints com transfer-fee**, CLMM aceita via
`SwapV2` — mas **AMM v4, a pool padrão, não suporta Token-2022 de jeito nenhum.**

### 🔴 A taxa tributa o motor de realimentação

O ciclo é claim → vende → alguém compra → gasta no game → tesouraria → volta pro bônus.
**Cada hop é uma transferência:**

| Transferências no ciclo | Evapora |
|---|---|
| 3 | 14,3% |
| 4 | **18,5%** |
| 5 | **22,6%** |

A realimentação é o que salva um lançamento de \$10k (§5). A taxa cobra ~20% dela por
volta. **A taxa e a realimentação disputam a mesma moeda duas vezes.** Mais: gross-up
de 5,26% para entregar a tranche líquida, e `auditarCiclo` reportando número diferente
do que chega na wallet.

### Recomendação

| | Taxa no token (5%) | 5% na camada do JOGO |
|---|---|---|
| Receita dos founders | 5% do volume on-chain | 5% do volume do produto |
| Token-2022 obrigatório | sim | **não** |
| AMM v4 disponível | **não** | sim |
| Risco de CEX | alto | **nenhum** |
| Tributa o bônus | sim | **não** |
| Tributa a realimentação | ~20%/ciclo | **não** |

OLEFOOT já passa pelo nosso servidor em card, lenda, mercado, Vault e buy-in —
`harvestSplit.ts` já põe a casa em 25%. **Mesma receita, zero dano ao token.**

**Se a decisão for manter on-chain**, três ajustes que não custam nada:
1. **1%, não 5%** — a alíquota é ajustável depois, então começar baixa não fecha porta.
2. **`maximumFee` absoluto** para a taxa não escalar em transferência grande.
3. Medir no faucet o efeito por swap e por depósito de LP **antes** do mainnet.

E vale registrar: **founders já têm 12% / 600M alocados** — essa é a remuneração
estrutural, e ela captura toda a valorização sem custo para a liquidez.

---

## 7. Decisões que precisam da sua assinatura

| # | Decisão | Recomendação |
|---|---|---|
| 1 | Tabela final da §2 | **aprovar** |
| 2 | Razão do claim v1: A (1,564854) ou B (1:1) | **B** |
| 3 | Taxa de transferência: on-chain 5% · on-chain 1% · camada do jogo | **camada do jogo**; se on-chain, **1%** |
| 4 | Portão de profundidade em 194M tokens | **aprovar** |
| 5 | Teto mensal do marketing (número) | definir |
| 6 | Destino do claim v1 não resgatado após 24 meses | Liquidez, anunciado no dia 1 |

## 8. Travas técnicas não negociáveis no lançamento

1. **Mint authority revogada** e **freeze authority revogada** — sem isso toda linha
   desta tabela é inexigível.
2. **LP travado** (não queimado, se a tesouraria for coletar taxa), hash público.
3. **Sink para o Ecossistema.** 1.000M de emissão sem destruição é torneira, não
   tokenomics.
4. Teto mensal do marketing **com número**.

## 9. Sequência de lançamento

| # | Etapa | Estado |
|---|---|---|
| 0 | **Renovar `olefoot.com`** + NS `memphis`/`rita.ns.cloudflare.com` | 🔴 **bloqueado, vencido em 17/09** |
| 1 | Aprovar este documento | ⏳ |
| 2 | Criar o mint em **devnet** (decide Token-2022 vs SPL) | ⏳ |
| 3 | Teste de faucet (§10) | ⏳ |
| 4 | Migrations + rota do ciclo horário + claim | ⏳ motor pronto, **sem persistência** |
| 5 | Pré-venda | ⏳ |
| 6 | Pool + lançamento | ⏳ |

## 10. O que o teste no faucet tem que provar

1. Mint com 9 decimais; mint e freeze authority **revogadas** — e um mint posterior
   **falhando** no teste.
2. A carteira deriva **o mesmo endereço** em devnet e mainnet.
3. Transferência SPL **assinada pela chave derivada da nossa seed** é aceita. Já
   provamos assinatura ed25519 contra `verifySolanaLinkProof`; **transferência SPL
   ainda não**.
4. 🔴 **Quem paga a renda da Associated Token Account** (~0,002 SOL). **Manager com 0
   SOL não recebe OLEFOOT** — é assim que airdrop de token de jogo quebra na prática.
   A tesouraria paga no primeiro claim.
5. Valor que estoura `Number` atravessa como **bigint de ponta a ponta**.
6. Limite de tamanho de transação ao pagar claims em lote.
7. **O teto diário recusando** um claim acima do limite. ✅ já coberto em self-test
8. Se a taxa for mantida: se a extensão permite **isentar a pool e a tesouraria**, e o
   custo por swap e por depósito de LP.
