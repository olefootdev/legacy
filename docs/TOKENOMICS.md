# TOKENOMICS — $OLEFOOT na Solana

> Revisão 2 — 2026-09-28. Régua do token, como `VOLT2.md` é a régua do visual e
> `FRONTEIRA-TOKEN.md` é a régua da fronteira de dados. Número aqui vira constante em
> código; constante em código não se muda sem mudar este arquivo.
>
> 🔴 **Proposta interna. Nada aqui é público até o fundador decidir.**

---

## 0. Vocabulário (fechado)

| Palavra | O que é | Onde vive |
|---|---|---|
| **VERBA / VRB** | saldo mole do jogo | `finance.ole`, cliente |
| **OLEXP** | unidade de expansão da rede (contador, NÃO negociável) | `server/src/lib/expansao/` |
| **OLEFOOT** | o token na Solana | on-chain |
| **BRO** | crédito de Pix | servidor |
| **Pontos** | classificação de liga | servidor |

---

## 1. VERBA nunca vira OLEFOOT

**Decisão do fundador, absoluta:** o saldo do jogo não se converte em token. Os
1,28 bilhão de VERBA em `finance.ole` **não são passivo de token**. Quem quiser
OLEFOOT entra por um **REFUND PROGRAM** com validação de conta — caso a caso, não
automático.

Isso é a mesma regra que `docs/FRONTEIRA-TOKEN.md` já enforça
(`fronteira_token_violacoes()`): `finance` é escrito pelo cliente, logo `finance`
nunca alimenta decisão de token. O REFUND é a única porta, e ela é humana.

### 🔴 O REFUND PROGRAM precisa de três travas ou vira conversão pela porta dos fundos

1. **Teto em tokens, de balde nomeado.** Sem teto, alguém monta a planilha
   "1,28B de VERBA a qual taxa?" e o mercado precifica o pior caso. Um passivo sem
   tamanho é descontado como se fosse infinito.
2. **Taxa discricionária e NÃO publicada como fórmula.** No minuto em que existir
   "X VERBA = Y OLEFOOT" escrito, é conversão — e a regra da seção 1 morre na
   prática, mesmo que o texto continue lá.
3. 🔑 **O token do refund é COMPRADO no mercado, nunca mintado de balde.** Se sair de
   balde, VERBA virou autoridade de emissão disfarçada — exatamente o que a decisão
   proíbe. Comprando, VERBA nunca se torna supply, e cada refund é pressão de compra.

*Retratação parcial:* eu tinha usado "1,28B de VERBA se lê na mesma escala que 5B de
OLEFOOT" como argumento para cortar supply. Com a separação da seção 1 esse argumento
enfraquece — sobrou só a leitura de marca, não o passivo. O argumento de supply que
**continua de pé** é outro e está na seção 4: profundidade de pool.

---

## 2. O balde de 25% para EXPANSÃO — e ele fecha na conta

**Decisão do fundador:** existe balde de 25% (1,25B), com liberação de **5% na
pré-venda**, e o resto ajustado por etapa. Retifico minha proposta anterior de não ter
balde: o balde é necessário para o bônus pagar no dia 1, antes de haver receita
acumulada.

**E os dois números fecham exatamente:**

| | |
|---|---|
| Balde 25% de 5.000M | 1.250.000.000 |
| Tranche de 5% do balde | **62.500.000** |
| Valor a \$0,000125 | **\$7.812,50** |
| 25% da arrecadação da pré-venda (\$31.250) | **\$7.812,50** |
| | ✅ **conferem** |

A tranche de 5% é precisamente os 25% da receita da pré-venda no preço da pré-venda.
O desenho é internamente coerente.

### O que faltava: o balde é fundo rotativo, não saldo

O risco que eu apontei antes (preço cai → cada dólar compra mais token → emite mais
num mercado caindo) **não desaparece com o balde. Desaparece com a realimentação** —
que foi a sua palavra, e é a solução certa. Duas regras:

**a) Todo OLEFOOT que volta reentra no balde primeiro**, até o tamanho da tranche,
antes de qualquer coisa ir para tesouraria. Entradas que já existem no produto:

| Fonte | Mecânica |
|---|---|
| Compra de card / lenda | preço em OLEFOOT → token volta |
| Aporte no Vault | taxa em OLEFOOT |
| Buy-in de liga premiada | já funciona em EXP, mesma mecânica |
| Compra via Pix | a casa compra OLEFOOT no mercado p/ entregar |
| REFUND PROGRAM | a casa compra no mercado (seção 1, trava 3) |

**b) Piso do balde.** Se o balde cair abaixo de 20% da tranche, a liquidação do ciclo
**troca de régua**: deixa de ser denominada em dólar e passa a ser fração do balde
restante. Assim o balde nunca fica insolvente e nunca é obrigado a emitir num mercado
caindo. Implementável em `fecharCiclo()`, que já retorna `HELD` quando não há pool —
é só um segundo motivo de HOLD.

🔒 **Continua valendo:** não existe valor fixo por OLEXP em lugar nenhum. Liquidação é
`pool ÷ equiparado`, por ciclo (`equiparacao.ts`).

---

## 3. A arrecadação (ponto 3)

| | |
|---|---|
| Supply | 5.000.000.000 |
| Pré-venda 5% | 250.000.000 |
| Preço | \$0,000125 |
| **ARRECADAÇÃO** | **\$31.250,00** |
| **FDV no preço da pré-venda** | **\$625.000,00** |

**FDV de \$625k é honesto** e é ponto a favor destes números — muito mais defensável
que os lançamentos de FDV inflado. O problema não é o FDV. É o que \$31.250 constrói.

### O que o dinheiro cobre

| Destino | Valor |
|---|---|
| USDC na pool (60%) | \$18.750 |
| Domínio + Cloudflare + Helius + infra (ano) | ~\$500 |
| **Sobra para operação** | **~\$12.000** |

Não cobre: auditoria, market maker, listagem em CEX, marketing pago.

---

## 4. 🔴 O achado contraintuitivo: preço não é alavanca

O lado token da pool vem do balde de Liquidez; o lado USDC vem da arrecadação. Para
**abrir no preço da pré-venda**, `USDC = tokens × preço`:

| Tokens na pool | USDC necessário | % da arrecadação | TVL | Tranche de 62,5M derruba |
|---|---|---|---|---|
| 100M | \$12.500 | 40% | \$25.000 | **−62,1%** |
| 150M | \$18.750 | 60% | \$37.500 | **−50,2%** |
| 250M | \$31.250 | 100% | \$62.500 | **−36,0%** |

E a tabela de preços que eu rodei mostra o seguinte: a \$0,000125 ou a \$0,002, **a
tranche sempre derruba os mesmos −55,6%** no mesmo desenho. Porque dobrar o preço
dobra o USDC dos dois lados — **a razão `token vendido / token na pool` é invariante
ao preço.**

**Consequência prática: aumentar o preço da pré-venda não protege o gráfico.** Só três
coisas protegem: mais token na pool, menos token saindo por dia, ou mais supply
cortado.

### Cenário recomendado

**Pool = 150M tokens (o balde de Liquidez inteiro) + \$18.750 USDC**, abrindo em
\$0,000125, TVL \$37.500. Sobram \$12.500 para operação.

---

## 5. A trava que faz um lançamento de \$31k sobreviver

A tranche de 62,5M jogada na pool de uma vez = **−50%**. Para absorvê-la com no máximo
−15% seria preciso \$92.289 no lado USDC — **5,9× o que existe.**

**Mas a arquitetura já resolve isso, e eu não tinha ligado os pontos:** o bônus acumula
em **OLEXP**, que é contador não-negociável e tem **zero impacto de mercado**. O CLAIM
é passo separado e já auditado. Então a trava é no claim:

### Teto diário de claim como % da reserva da pool

| Impacto máx./dia | Tokens/dia | Tranche de 62,5M sai em | Balde de 1,25B em |
|---|---|---|---|
| 0,5% | 376.412 | 166 dias | 9,1 anos |
| **1,0%** | **755.672** | **83 dias** | **4,5 anos** |
| 2,0% | 1.522.881 | 41 dias | 2,2 anos |

**Recomendo 1,0%.** E a verdade de produto que vem com isso, que precisa estar na
comunicação desde o primeiro dia: **o bônus acumula rápido em OLEXP e converte devagar
em OLEFOOT.** Se alguém prometer conversão rápida, a promessa é falsa e o gráfico
cobra. Como o teto é % da pool e a pool cresce com a realimentação da seção 2, o ritmo
acelera sozinho conforme a receita entra.

Duas regras a gravar em `auditarClaim()`:
1. **Teto diário global** = 1% da reserva de token da pool.
2. **A conversão é pelo valor de liquidação do ciclo**, nunca pelo preço no momento do
   claim — senão as pessoas sentam no claim esperando queda para levar mais token.

---

## 6. O que a trava do claim NÃO resolve: o vesting

O teto cobre o bônus. Não cobre os cronogramas de vesting, que são liberação
automática. Contra a pool de 150M, a partir do dia 31:

| Origem | Tokens/dia |
|---|---|
| Claim holders antigos (1.000M ÷ 730) | 1.369.863 |
| Pré-venda (225M ÷ 180) | 1.250.000 |
| Marketing (475M ÷ 730) | 650.685 |
| Ecossistema (1.000M ÷ ~1.643) | 608.643 |
| Comunidade | teto **sem número** |
| **TOTAL** | **3.879.190/dia = 116,4M/mês** |

**116,4M/mês contra reserva de 150M = 77,6% da pool por mês.**

Alongando tudo (claim 36 meses, pré-venda 12, marketing 36, eco 5 anos) cai para
75,6M/mês = **50,4%**. Melhora, mas continua alto — e aqui está a conclusão honesta:

🔴 **A 5 bilhões de supply com \$18.750 de pool, nenhum cronograma de vesting deixa a
razão saudável.** A pool é 3% do supply; qualquer vesting razoável dos outros 97%
atropela. As saídas reais são três, e só três:

1. **Mais liquidez** — precisa de mais capital do que \$31k levanta.
2. **Menos supply** — é o argumento de supply que sobrevive à seção 1.
3. **Aceitar que o token vai ser fino e volátil no primeiro ano**, e desenhar para
   isso: não prometer preço, estrangular toda saída, e crescer a pool pela
   realimentação.

**(3) é viável e honesto** para um projeto pré-lançamento com 7 jogadores ativos, e é
exatamente a sua intuição de retro-alimentar. O que ela depende de verdade:

| Receita/mês | 50% vira pool | Crescimento do lado USDC |
|---|---|---|
| \$2.000 | \$1.000 | +5,3%/mês |
| \$5.000 | \$2.500 | +13,3%/mês |
| \$10.000 | \$5.000 | +26,7%/mês |
| \$25.000 | \$12.500 | +66,7%/mês |

**A saúde da pool é função da receita do jogo, não do lançamento.** O teto de claim
compra o tempo para a receita aprofundar a pool. É esse o plano, e ele é defensável.

---

## 7. O claim dos holders antigos, contra a base medida

Medido em produção (`airdrop_v1_snapshot`, congelado desde 2026-09-21):

| Fato | Valor |
|---|---|
| Credores com saldo | **69** |
| Total congelado | **639.037.272** unidades |
| Mediana | 1.655.027 |
| Maior credor | 167.889.737 = **26,3%** |
| Top 3 · Top 10 | **50,8%** · **78,2%** |
| Abaixo de 1M un. | 22 pessoas = **1,3%** do balde |
| **Nunca logaram na v11** | **46 pessoas = 76,0% do valor** |
| **Com wallet Solana assinada** | **0** |
| Ativos em 90 dias | 4 |

**a) O balde não fecha com o livro.** 20% = 1.000M, mas o snapshot é 639.037.272. A
razão implícita é **1,564854 token/unidade** e não está escrita em lugar nenhum. Ou se
escreve a razão, ou se dimensiona o balde no snapshot — balde redondo que não bate com
o ledger é como 361M viram "sobra sem dono".

**b) Uma pessoa pode encerrar o token.** A essa razão o maior credor tem
**262.722.918 tokens = 5,25% do supply — 1,75× a reserva inteira da pool**, liberando
diariamente. Não é risco teórico, é uma linha do banco.

**c) 76% do balde pertence a quem nunca entrou**, e o modelo é resgate sem prazo.
Supply não resgatado precisa de destino escrito, anunciado desde o dia 1.

### Correção: degraus proporcionais ao risco de cada faixa

| Faixa | Pessoas | % do balde | Liberação |
|---|---|---|---|
| ≤ 1M unidades | 22 | 1,3% | **100% no lançamento** |
| 1M – 10M | 34 | ~19% | 12 meses linear |
| > 10M | 13 | ~80% | **36 meses** linear diário |

Liberar 22 pessoas na hora custa 1,3% do balde e compra 22 evangelistas. Segurar 36
meses os 13 que são 80% do balde é o que protege o gráfico. Mais: **teto diário por
carteira em % da profundidade da pool**, não em % do saldo — sem isso o cronograma do
maior credor sozinho é 0,9% da reserva por dia.

---

## 8. O que continua faltando por completo

1. **Nenhum sink.** 1.000M de emissão in-game sem destruição é torneira, não
   tokenomics. Os sinks já existem e só precisam apontar para OLEFOOT (seção 2a).
2. **Mint e freeze authority revogadas no lançamento.** Sem isso toda linha desta
   tabela é inexigível.
3. **LP queimado ou travado**, hash público. Primeiro item que todo comprador confere.
4. **Teto mensal da Comunidade com número.** 750M com teto não numerado é 750M à
   discrição do time — funcionalmente tesouraria, não comunidade.
5. **Advisors 4% (200M) = 80% da pré-venda inteira (250M).** Advisor quase em paridade
   com quem pagou dinheiro é a linha que vai ser printada.

---

## 9. Antes de lançar: o que o teste no faucet (devnet) tem que provar

1. Mint com **9 decimais**; mint authority **revogada**; freeze authority **revogada**
   — e um mint posterior **falhando** no teste.
2. A carteira deriva **o mesmo endereço** em devnet e mainnet.
3. Transferência SPL **assinada pela chave derivada da nossa seed** é aceita. Já
   provamos assinatura ed25519 contra `verifySolanaLinkProof`; **ainda não provamos
   uma transferência SPL**.
4. 🔴 **Quem paga a renda da Associated Token Account.** O recebedor precisa de
   ~0,002 SOL para a ATA existir — **manager com 0 SOL não consegue receber
   OLEFOOT.** É assim que airdrop de token de jogo quebra na prática. A tesouraria
   paga no primeiro claim.
5. Valor que estoura `Number` atravessa como **bigint de ponta a ponta**. O Vault já
   tem `paraInteiro()` recusando `number`; o caminho do claim precisa do mesmo.
6. Limite de tamanho de transação e compute budget ao pagar muitos claims em lote.
7. **O teto diário de claim (seção 5) recusando** um claim acima do teto.

---

## 10. Bloqueio anterior a tudo isso

🔴 **`olefoot.com` venceu em 17/09, DNS na GoDaddy.** Todo subdomínio é NXDOMAIN —
jogo, REVELA, api, dex — e o e-mail @olefoot.com também. Nameservers a restaurar:
`memphis.ns.cloudflare.com` e `rita.ns.cloudflare.com`.

Sem domínio não há pré-venda, não há claim, não há wallet. Item zero.
