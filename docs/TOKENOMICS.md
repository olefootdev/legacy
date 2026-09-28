# TOKENOMICS FINAL — $OLEFOOT na Solana

> **Revisão 6 — 2026-09-28 · TABELA APROVADA · a casa cobre a taxa (opção 2)**
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

## 2. A TABELA FINAL — APROVADA

**Supply: 5.000.000.000** · **Decimais: 9** · **Rede: Solana (Token-2022)**

| Alocação | % | Tokens | Liberação |
|---|---|---|---|
| **Expansão (bônus de equiparação)** | 25,00% | 1.250.000.000 | tranche limitada pela receita · claim com teto de 1%/dia |
| Ecossistema / recompensas in-game | 20,00% | 1.000.000.000 | emissão por jogo, 5 anos, **atrelada a sink** |
| **Claim holders antigos v1** | **12,78%** | **639.037.272** | **razão 1:1** · degraus (§5) |
| Tesouraria / reserva | 12,00% | 600.000.000 | travado, governança, 6 meses de aviso |
| Equipe / fundadores | 12,00% | 600.000.000 | 12 meses de carência, linear 36 meses |
| **Liquidez DEX** | **11,22%** | **560.962.728** | 250M na pool no esgotamento · 310.962.728 guardados |
| **Pré-venda** | 5,00% | 250.000.000 | 10% no lançamento, linear 12 meses |
| Marketing / parcerias / advisors | 2,00% | 100.000.000 | 5% no lançamento, linear 24 meses, teto ⏳ |
| **TOTAL** | **100,00%** | **5.000.000.000** | |

### Opção B, aprovada em 2026-09-28

O claim v1 passa a ser **1:1 com o snapshot** — 639.037.272 tokens para
639.037.272 unidades, sem bônus de conversão. Os **360.962.728 liberados (7,22%) vão
para Liquidez**, que sai de 4% para 11,22%.

O que isso resolve, medido:

| | Opção A (1.000M) | **Opção B (639M)** |
|---|---|---|
| Maior credor, % do supply | 5,25% | **3,36%** |
| Balde de Liquidez | 200.000.000 | **560.962.728** |
| Pool no esgotamento | 250M tokens | 250M tokens **+ 310.962.728 de reserva** |

### De onde saiu cada mudança (fecha em zero)

| Mudança | Δ |
|---|---|
| Comissões Marketing 10% + Comunidade 15% → **Expansão 25%** | 0% |
| Advisors 4% → 2% (junta com marketing/parcerias) | −2% |
| Pré-venda 4% → **5%** | +1% |
| Liquidez 3% → 4% | +1% |
| **Claim v1 20% → 12,78% (razão 1:1) → Liquidez** | **−7,22% / +7,22%** |

**Por que Marketing + Comunidade viraram Expansão:** o bônus de equiparação **é** o
motor de marketing e comunidade. Três baldes para o mesmo trabalho é contar o mesmo
dinheiro três vezes. Sobram 2% de verba discricionária.

**Por que Advisors caiu de 4% para 2%:** recebiam 80% da pré-venda inteira. Os 2%
liberados pagam exatamente o +1% da pré-venda e o +1% da liquidez.

---

## 3. A pré-venda e o lançamento

**Decisão do fundador: a liquidez só é anunciada quando os 250.000.000 estiverem
vendidos.** Então a meta não é \$10.000 — é o esgotamento.

| | |
|---|---|
| Preço | **\$0,000125** |
| Alocação | **250.000.000** |
| **Meta (esgotamento)** | **\$31.250** |
| FDV no preço da pré-venda | \$625.000 |

### A pool no esgotamento

| | |
|---|---|
| Tokens que CHEGAM na pool | **250.000.000** |
| Enviados do balde de Liquidez | **263.157.894** (a taxa morde no depósito) |
| USDC na pool | **\$31.250** (a arrecadação inteira) |
| TVL | **\$62.500** |
| Sobra do balde | 284.646.940 |
| vs. o cenário de \$10.000 | **3,1× mais profunda** |

🔴 **Depósito de LP paga a taxa de 5%.** Não existe isenção por endereço no Token-2022
(§6), então enviar 250M para a pool entregaria 237,5M. Para a pool abrir com 250M de
verdade, o balde envia **263.157.894**. Cada reforço futuro da pool perde 5% do mesmo
jeito — o que encarece aprofundar a pool com a receita.

✅ **E isso satisfaz sozinho o portão de profundidade.** Eu tinha proposto travar o
vesting grande até a pool chegar a 194M tokens; condicionar o anúncio ao esgotamento
entrega **250M** — o portão passa a estar cumprido por construção, sem regra extra.

### O efeito combinado das duas decisões

| Origem | Tokens/dia |
|---|---|
| Expansão (teto de 1%) | 1.259.453 |
| Pré-venda (225M em 12 meses) | 625.000 |
| Ecossistema (5 anos) | 547.945 |
| Claim v1 (degraus) | 446.450 |
| Marketing (24 meses) | 130.136 |
| **TOTAL** | **3.008.986/dia = 90,3M/mês** |

**36,1% da reserva da pool por mês — contra 109,2% da tabela original.** Saiu de
insustentável para saudável, e as duas decisões que fizeram isso foram suas: razão 1:1
e esgotamento antes da liquidez.

### Quanto na pool mantém o token atrativo

Num AMM de produto constante, o slippage de uma **compra** de \$X é exatamente
`X ÷ Q`, onde Q é o lado USDC. **O lado token não entra na conta.**

| Q (USDC na pool) | Tokens @ \$0,000125 | \$250 | \$500 | \$1.250 | \$5.000 |
|---|---|---|---|---|---|
| **\$31.250** (o nosso) | 250.000.000 | 0,80% | 1,60% | **4,00%** | 16,00% |
| \$62.500 | 500.000.000 | 0,40% | 0,80% | 2,00% | 8,00% |
| \$100.000 | 800.000.000 | 0,25% | 0,50% | 1,25% | 5,00% |

**Regra: para um ticket de \$T custar no máximo 2%, Q ≥ 50 × T.** Com \$31.250 a pool
serve confortavelmente até **~\$625 de ticket**; o pack de \$1.250 custa 4%.

🔴 **E não se escolhem os três.** Você escolhe dois de {tokens na pool, USDC na pool,
preço de abertura} — o terceiro sai da conta. A arrecadação fixa o USDC e a pré-venda
fixa o preço, então os **250.000.000 estão forçados**. Não é decisão, é consequência.

🔴 **Achado que continua valendo: preço não é alavanca.** Para abrir no preço da
pré-venda, `USDC = tokens × preço` — dobrar o preço dobra os dois lados, então a razão
`token vendido / token na pool` é invariante ao preço.

---

## 3b. PACKS da pré-venda

Valor entra em **USD**, sai em **OLEFOOT**, vira **reais** para o Pix do Mercado Pago.

**Decisão de 2026-09-28 (opção 2): o número anunciado é o número ENTREGUE.** A casa
cobre a taxa de 5%.

| Pack | **RECEBE** (anunciado) | Tesouraria debita | Pix a R\$5,42/USD |
|---|---|---|---|
| **\$10** | **80.000** | 84.210,52 | R\$54,20 |
| **\$50** | **400.000** | 421.052,63 | R\$271,00 |
| **\$250** | **2.000.000** | 2.105.263,15 | R\$1.355,00 |
| **\$500** | **4.000.000** | 4.210.526,31 | R\$2.710,00 |
| **\$1.250** | **10.000.000** | 10.526.315,78 | R\$6.775,00 |
| **Outro** | digitado, mínimo \$10 | | aceita digitar em USD **ou em R\$** |

✨ **A \$0,000125 cada centavo de dólar entrega exatamente 80 tokens.** Nenhum pack em
centavo inteiro tem arredondamento no lado do comprador. Se o preço mudar e essa divisão
deixar de fechar, o self-test acusa.

✅ **E o preço efetivo é \$0,000125 exato, em todos os cinco packs** — o anunciado é o
verdadeiro, não há rodapé a escrever.

### O que a decisão custa

| | |
|---|---|
| Pré-venda entrega | 250.000.000 |
| Tesouraria debita | **263.157.894,7** |
| Coberto pelo balde de Liquidez | **13.157.894,7 = 0,263% do supply** |
| Founders recebem de taxa | 13.157.894,7 (contra 12.500.000 na opção 1 — **um pouco mais**) |

**O balde de Liquidez paga a taxa duas vezes:** 13,16M no gross-up da pré-venda e
13,16M no depósito da pool. Total **26.315.788 = 4,7% do balde**, que fica com
284.646.940 de sobra. É caro? Não: compra número redondo na tela e preço honesto, e numa
pré-venda a pergunta *"por que recebi menos do que dizia?"* custa mais que isso.

### Arredondamento — cada direção é decisão

| | Direção | Por quê |
|---|---|---|
| Tokens entregues | exato (80/centavo) | não há fração a arredondar no lado do comprador |
| Bruto a debitar | pra **cima** | a sobra fica com a tesouraria; o comprador nunca recebe menos |
| Reais a cobrar | pra **cima**, no centavo | a casa nunca cobra menos que o dólar valia; erro máximo R\$0,01 |
| "Outro" digitado em R\$ → USD | pra **baixo** | fração de centavo de dólar fica de fora, nunca cobrada a mais |

### Travas

🔴 **Preço é sempre do servidor.** `payments.ts` já manda isso no comentário e o projeto
pagou para aprender — "preço PIX client-side" foi um dos furos de dinheiro fechados no
card. O cliente manda **qual** pack, nunca **quanto custa**.

| Trava | Estado |
|---|---|
| Mínimo \$10 | ✅ em código |
| Valor não inteiro recusado | ✅ |
| Cotação inválida recusa em vez de cobrar errado | ✅ |
| Alocação insuficiente recusa (não vende token que não existe) | ✅ |
| **Teto por conta** | ✅ em código, 🔴 **número a definir** |

⚠️ **O maior pack é 4% da pré-venda — 25 compradores esgotam tudo.** Sem teto a
pré-venda repete a concentração do airdrop, onde 1 carteira ficou com 26,3%.
**Correção de uma sugestão minha:** eu havia sugerido \$2.500, raciocinando sobre uma
arrecadação maior. Com \$31.250 de meta isso dá **12 compradores**. O teto tem que ser
baixo:

| Teto/conta | Compradores mínimos | % da pré-venda cada |
|---|---|---|
| \$2.500 | 12 | 8,0% |
| \$1.250 | 25 | 4,0% |
| **\$500** | **62** | **1,6%** |
| \$250 | 125 | 0,8% |

**Recomendo teto em degrau:** \$500/conta até 50% vendido, depois libera até \$1.250.
Distribuição larga na largada, cauda preenchida por ticket grande.

→ `server/src/lib/presale/packs.ts` · `npm run test:presale-packs` (32 testes)

---

## 3c. Política de trava da pré-venda

**Decisões do fundador (2026-09-28):** token da pré-venda entra **travado**; libera por
**tempo** ou **comprando de novo**; a porta de compra vai até **85% da posição**; e a
compra que destrava tem que ser **entrada nova (Pix/USDT)**, nunca market buy.

### A fórmula, e o furo que ela tinha

A proposta: *"comprou \$1.000, faz compra nova de \$250, libera 25%"*. No preço de
lançamento isso dá 2.000.000 de 8.000.000 — exatamente o que \$250 compra. **Multiplicador
m = 1, a fronteira exata do não-arbitragem.**

🐞 **Mas a razão de dólar sozinha quebra se o preço mudar.** Com o preço dobrado, \$250
compraria 1.000.000 e a fórmula continuaria liberando 2.000.000 — pagar \$250 e soltar
\$500 em token. Todo mundo faria no dia 1.

**A correção:** a liberação é o **MENOR** entre a razão de dólar e a **paridade em token**
no preço atual.

| Preço | Razão de dólar | Paridade em token | Libera | Quem segurou |
|---|---|---|---|---|
| lançamento | 2.000.000 | 2.000.000 | **2.000.000** | empatam (m = 1) |
| dobrou | 2.000.000 | 1.000.000 | **1.000.000** | paridade |
| caiu à metade | 2.000.000 | 4.000.000 | **2.000.000** | razão de dólar |

A proposta original fica intacta no preço de lançamento; fora dele, o menor segura o
abuso dos dois lados.

### 🔑 A compra que destrava não precisa ser de token

Como a régua é "quanto esse dinheiro valeria em token no preço atual", **card, lenda e
pack do jogo contam igual**. Isso faz a trava empurrar receita de **produto**, não só de
token — e sem abrir brecha, porque a paridade se aplica do mesmo jeito.

### Por que a compra tem que ser entrada nova

Modelei as duas versões e **o efeito no preço é idêntico**: −1,58% tanto exigindo market
buy quanto liberando por tempo puro, numa posição de \$1.000. O dinheiro do market buy
entra na pool e sai no mesmo movimento.

**A compra não protege o gráfico. Ela FILTRA.** A maioria não paga para destravar, então
a maioria fica travada — o valor está em reduzir o **número** de liberações, não o impacto
de cada uma. E se for market buy, a empresa não recebe nada.

### 🔴 A consequência do 85%, em número

As duas portas somam. Com 10% liberados no lançamento pelo cronograma de tempo:

| | |
|---|---|
| Porta de compra esgotada | 85% |
| Tempo, no dia 0 | +10% |
| **Disponível no dia 0** | **95%** |
| 100% líquido no dia | **50** |

Pior caso, todos os compradores esgotando a porta:

| | |
|---|---|
| Entrada nova (Pix/USDT) | **\$26.562** |
| Disponível no dia 0 | **237.500.000 = 95% da pré-venda** |
| Se tudo vender na pool de \$31.250 | **−73,7%** |
| Se os \$26.562 novos forem **todos** para liquidez antes | **−56,3%** |

⚠️ **Se a intenção do "85%" era que no máximo 85% saia cedo**, falta um ajuste de uma
linha: fazer o teto valer sobre a **liberação total antecipada**, não só sobre a porta de
compra. Aí o máximo no dia 0 é 85% e os 15% finais dependem do tempo de verdade.
Como está escrito agora, é 95%.

E a trava que vale nos dois casos: **todo real de entrada nova tem que ir para a
liquidez** — é o que tira o pior caso de −73,7% para −56,3%.

→ `server/src/lib/presale/travas.ts` · `npm run test:presale-travas` (26 testes)

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

## 5. Claim dos holders antigos — razão 1:1 e degraus

Medido em produção (`airdrop_v1_snapshot`, congelado em 2026-09-21):

| Fato | Valor |
|---|---|
| Credores com saldo | 69 |
| Total congelado | 639.037.272 unidades |
| Maior credor · Top 3 · Top 10 | **26,3%** · **50,8%** · **78,2%** |
| Abaixo de 1M unidades | 22 pessoas = **1,3%** do balde |
| **Nunca logaram na v11** | **46 pessoas = 76,0% do valor** |
| **Com wallet Solana assinada** | **0** |

### ✅ Razão de conversão: 1:1 (decidido em 2026-09-28)

O balde é **exatamente o snapshot**: 639.037.272 tokens para 639.037.272 unidades, sem
bônus de conversão. Os 360.962.728 liberados (7,22%) foram para Liquidez.

| | Opção A (1.000M, razão 1,564854) | **Opção B — escolhida** |
|---|---|---|
| Balde | 1.000.000.000 | **639.037.272** |
| Maior credor, em token | 262.722.918 | **167.889.737** |
| Maior credor, % do supply | 5,25% | **3,36%** |
| vs. a pool no esgotamento | 1,05× a pool | **0,67× a pool** |

O maior credor deixa de valer mais que a pool inteira. Era o risco de uma pessoa
sozinha encerrar o token, e ele saiu da mesa.

### Degraus de liberação

| Faixa | Pessoas | % do balde | Liberação |
|---|---|---|---|
| ≤ 1M unidades | 22 | 1,3% | **100% no lançamento** |
| 1M – 10M | 34 | ~19% | 24 meses linear |
| > 10M | 13 | ~80% | 60 meses linear diário |

Liberar 22 pessoas na hora custa 1,3% do balde e compra 22 evangelistas. Segurar os 13
que são 80% do balde é o que protege o gráfico — e é defensável porque é proporcional
ao risco de cada faixa.

### ✅ O portão de profundidade — cumprido por construção

Eu tinha proposto travar o vesting dos baldes grandes até a pool chegar a **194.000.000
tokens**, porque nenhum calendário fechava contra uma pool de 80M:

| Cenário | Desbloqueio/mês | % da pool de 80M |
|---|---|---|
| Tabela original | 87,4M | 109,2% |
| Degraus, topo em 36m | 82,2M | 102,7% |
| Degraus, topo em 60m | 58,1M | 72,6% |

Condicionar o anúncio da liquidez ao esgotamento da pré-venda entrega **250.000.000**
na pool. O portão está cumprido sem precisar de regra extra, e o desbloqueio cai para
**36,1% da pool por mês** (§3). A regra continua no documento como rede de segurança:
**se a pré-venda não esgotar, o vesting grande não começa.**

## 6. A taxa de transferência de 5% — DECIDIDA

**Decisão do fundador, 2026-09-28: 5% em toda transferência de OLEFOOT, para a wallet
dos founders, desde o momento zero.** Levantei o custo duas vezes e ele reafirmou.
Decisão dele. O que segue não é objeção — é o que a decisão obriga a fazer para
funcionar.

### O que fica travado por ela

| | |
|---|---|
| Padrão do token | **Token-2022** com extensão `TransferFee` (SPL padrão não tem taxa) |
| Extensão | **tem que estar na criação do mint** — não dá pra adicionar depois |
| Alíquota | **500 bps**, ajustável depois via `SetTransferFee` (2 épocas adiante) |
| `maximumFee` | **sem teto** — 5% literal em qualquer tamanho |
| Pool | **Raydium CPMM** ou CLMM. **AMM v4 está fora**, não suporta Token-2022 |
| CEX | risco alto; a maioria restringe token com transfer-fee |
| **Isenção por endereço** | **NÃO EXISTE.** Sem whitelist, sem exceção pra tesouraria ou pool |
| Taxa condicional | só via *transfer hook* — e **a Raydium não suporta transfer hook** |

### 🔴 Não é contabilidade, é bloqueio de transação

Na instrução `transfer_checked_with_fee` **o cliente informa a taxa esperada e o
programa confere**. Divergência de **um lamport** faz a transação falhar. Nosso código
espelha a fórmula exata do `spl-token-2022`:

```
taxa = min( ceil(bruto × bps / 10_000), maximumFee )
```

⚠️ A divisão é por **CIMA**. Truncar daria taxa 1 lamport menor que a do programa e
**toda transferência reverteria**.
→ `server/src/lib/expansao/taxaDeTransferencia.ts`, 20 testes, o gross-up varrido em
3.000 valores seguidos provando que entrega o prometido **e** é o menor bruto que entrega.

### O que a taxa custa a cada balde

Com 5% e **uma** transferência de saída por balde:

| Balde | Face | Entrega | Vai p/ founders |
|---|---|---|---|
| Expansão (bônus) | 1.250.000.000 | 1.187.500.000 | 62.500.000 |
| Claim holders v1 | 1.000.000.000 | 950.000.000 | 50.000.000 |
| Ecossistema in-game | 1.000.000.000 | 950.000.000 | 50.000.000 |
| Equipe | 600.000.000 | 570.000.000 | 30.000.000 |
| Pré-venda | 250.000.000 | 237.500.000 | 12.500.000 |
| Marketing / parcerias | 100.000.000 | 95.000.000 | 5.000.000 |
| **Taxa retida só na 1ª saída** | | | **210.000.000 = 4,20% do supply** |

**Captura efetiva dos founders: 12% alocado + 4,20% de taxa só na primeira volta =
16,20%** — e isso antes de qualquer swap, revenda ou reciclagem, que pagam 5% de novo em
cada hop. **Isto precisa estar no material público da pré-venda.** Não por regulação —
porque alguém vai calcular, e é melhor que o número venha de nós.

### Consequências operacionais que ainda não existem em código

1. 🔴 **Rotina de colheita da taxa.** O Token-2022 **retém** a taxa na conta de destino;
   ela não chega sozinha na wallet dos founders. Precisa de
   `withdrawWithheldTokensFromAccounts` varrendo as contas periodicamente. Sem essa
   rotina a taxa fica presa e a receita é zero.
2. **Gross-up em todo pagamento.** Para entregar a tranche de 20.000.000 a tesouraria
   debita **21.052.632** e retém 1.052.632. Já em código
   (`liquidarComTaxa`), e `auditarClaim` **barra** claim cujo bruto não corresponda.
3. **O teto diário mede o LÍQUIDO**, não o bruto — é o líquido que pode ser vendido na
   pool. Já em código.
4. **ATA + taxa.** O recebedor precisa de ~0,002 SOL para a ATA e a primeira
   transferência já chega 5% menor. Comunicar os dois juntos, senão vira suporte.
5. 🔴 **A pool paga taxa em cada swap E em cada depósito de LP** — confirmado, porque
   não há isenção. Aprofundar a pool com a receita custa 5% a cada injeção, e o depósito
   inicial precisa de gross-up (§3). Não existe escapatória: sem isenção por endereço e
   sem transfer hook na Raydium, a taxa é uniforme para sempre.

## 7. Decisões que precisam da sua assinatura

| # | Decisão | Recomendação |
|---|---|---|
| 1 | Tabela final da §2 | **aprovar** |
| 2 | ~~Razão do claim v1~~ | ✅ **DECIDIDO: opção B, 1:1** |
| 3 | ~~Taxa de transferência~~ | ✅ **DECIDIDO: 5% on-chain desde o momento zero** |
| 4 | ~~Portão de profundidade~~ | ✅ **cumprido por construção** (esgotamento entrega 250M) |
| 5 | Teto mensal do marketing (número) | ⏳ **fundador anuncia na próxima semana** |
| 7 | `maximumFee`: sem teto (5% literal) ou teto absoluto | sem teto, como decidido |
| 8 | Pool: Raydium **CPMM** ou CLMM (AMM v4 está fora) | CPMM |
| 6 | Destino do claim v1 não resgatado após 24 meses | Liquidez, anunciado no dia 1 |
| 9 | **Teto por conta na pré-venda** | 🔴 **\$500 → \$1.250 em degrau** (\$2.500 daria 12 compradores) |
| 11 | ~~Trava da pré-venda~~ | ✅ **85% por compra, entrada nova, m=1** |
| 12 | O teto de 85% é só da porta de compra ou da liberação total? | como está = **95% no dia 0** |
| 10 | ~~Quem absorve os 5% na entrega~~ | ✅ **DECIDIDO: opção 2, a casa cobre** |

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
| 1 | Tabela final (§2) | ✅ **aprovada** |
| 2 | Criar o mint em **devnet** — Token-2022 + TransferFee 500bps | ⏳ |
| 3 | **Rotina de colheita da taxa** (sem ela a receita é zero) | ⏳ |
| 4 | Teste de faucet (§10) | ⏳ |
| 5 | Rota + migration dos packs, ligadas no Pix que já existe | ⏳ módulo puro pronto |
| 6 | Pré-venda até esgotar os 250M (\$31.250) | ⏳ |
| 7 | Migration + rota do ciclo horário + claim | ⏳ motor pronto, **sem persistência** |
| 8 | Pool + anúncio da liquidez | ⏳ gatilho = esgotamento |

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
8. **A taxa de 5% na prática:** quanto custa por swap e por depósito de LP na Raydium
   CPMM. (Isenção por endereço já está respondida: **não existe**.)
9. **A rotina de colheita** (`withdrawWithheldTokensFromAccounts`) varrendo contas e
   entregando na wallet dos founders — sem ela a receita da taxa é zero.
10. A taxa que **nosso código calcula** batendo com a que **o programa cobra**, numa
    transferência real. Se divergir em 1 lamport, a tx reverte. ✅ fórmula em self-test
