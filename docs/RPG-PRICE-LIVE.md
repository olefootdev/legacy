# RPG-PRICE-LIVE — o Olefoot como economia viva

*2026-10-01 · análise a pedido do fundador, junto com a entrega do Mercado de Elenco em OLEFOOT.*

> **STATUS (mesmo dia, decisão do fundador: "executa todas as 7"):** TUDO NO AR.
> O gap nº 1 fechou (`player_value_snapshots` + rating por partida no servidor,
> push automático pós-jogo) e as 7 viraram código: ① Ticker + OLE-100 + índice
> horário em `/mercado/vivo` · ② royalty de formador 3% dentro da liquidação
> (`player_formador`) · ③ salário invertido (`yield_reivindicar`, contado pelo
> BANCO nos snapshots de partida, teto 30/dia) · ④ empréstimo com opção
> (`squad_loans`, devolução automática com a evolução) · ⑤ leilão-relâmpago do
> MVP (cron diário 20h SP, escrow de lance, 50% pro dono) · ⑥ cotas de clube
> até 49% com dividendo automático em toda venda (`club_shares`) · ⑦ IPO de
> clube (banner de estreia no ClubHub → vitrine de times prontos).
> Decisão 2 também: `presale_config.liquidez_adicionada` (nasce FALSE) trava
> qualquer liberação da pré-venda até a liquidez entrar — toggle no admin.
> Migrations `rpg_price_live_fundacao` + `squad_market_v2` aplicadas em prod.

## O conceito em uma linha

**RPG** (atributo que evolui) → **PRICE** (atributo vira preço) → **LIVE** (o preço se move em tempo
real com o jogo). Nenhum football manager do mercado fecha esse ciclo: FIFA/FC tem mercado mas os
atributos são estáticos por edição; Football Manager tem evolução mas o "mercado" é contra a IA;
jogos cripto têm token mas o NFT não joga. O Olefoot já tem as três camadas no código — o que
faltava era conectá-las, e a primeira conexão subiu hoje.

## O que JÁ existe (medido no código)

| Camada | Onde | Estado |
|---|---|---|
| Atributo evolui por treino | `trainingPlans.ts` + `COMPLETE_DUE_TRAININGS` (staff, CT, estilo, duração multiplicam) | ✅ vivo |
| Atributo evolui por performance | `applyMatchPerformanceEvolution` (rating→swing, passe, desarme, km) | ✅ vivo |
| Preço responde ao jogo | `recomputeMarketValue` pós-jogo: OVR, forma, idade, raridade, escassez, lesão — determinístico | ✅ vivo |
| Histórico por jogador | `playerSeasonLedger` (jogos, gols, treinos por tipo, baseline de valor) + `playerEvolutionTimeline` (96 pontos de attrs+preço) | ✅ vivo (⚠️ timeline só em localStorage) |
| P2P com lock no servidor | `market_offers` + `buy-prospect` (só prospects, em EXP) | ✅ vivo |
| Moeda com preço real | OLEFOOT $0,000125 (pré-venda) · saldo off-chain `legacy_olefoot_credits` em wei | ✅ vivo |
| **Mercado de elenco em OLEFOOT** | `squad_listings` + `squad_market_liquidar` + `/clube/valores` | ✅ **entregue hoje** |

O ciclo do fundador — *"compra um zagueiro por $1, treina, vende por $3"* — fecha assim: $1 ≈ 100
centavos de BRO ≈ **8.000 OLEFOOT**; o treino sobe OVR dentro do teto (`mint + 15`); o preço
dinâmico acompanha; o vendedor anuncia por 24.000 OLEFOOT com o valor de referência exposto ao
lado (ágio visível); o comprador leva o jogador **vivo**, treinado.

## O gap nº 1 antes de escalar o LIVE

O rating por partida é calculado, move o preço **e é descartado** (não há tabela de rating), e a
série temporal de preço (`playerEvolutionTimeline`) vive só no localStorage. Pra um mercado com
cara de bolsa, o histórico precisa ser verdade pública no servidor — senão gráfico de preço some
quando o dono troca de navegador, e auditoria de "por que valorizou" não existe. É a primeira
infra a construir das sugestões abaixo.

---

## 7 sugestões pra algo revolucionário

### 1 · O TICKER — bolsa ao vivo com índice OLE-100
O preço já muda a cada partida; falta EXPOR isso como espetáculo. Feed público de variações
("CT do Vasco da Gama +12% após 2 gols na Liga Global"), sparkline em cada card, e o **índice
OLE-100** (os 100 jogadores mais valiosos do mundo, recalculado por hora — o cron do ciclo da
expansão já roda de hora em hora e pode puxar isso). Todo jogo que acontece move um mercado que
todos assistem. *Pré-requisito: persistir timeline/rating no servidor (o gap nº 1).*

### 2 · ROYALTY DE FORMADOR — treinar vira renda vitalícia
Cada jogador carrega a cadeia de donos (`squad_listings` já registra vendedor→comprador). Em toda
revenda, **3% do preço volta pra quem mais elevou o OVR na posse dele** — o "mecanismo de
solidariedade" da FIFA real, dentro do jogo. Treinar deixa de ser flip único e vira carteira de
royalties: o manager-formador é uma profissão. Nenhum jogo tem isso.

### 3 · SALÁRIO INVERTIDO — o elenco PAGA o dono (yield por performance)
Jogador escalado com rating ≥ 7,0 rende micro-OLEFOOT ao clube por partida, de um pool horário —
a MESMA infra do `expansao_ciclo` que já liquida bônus por hora. O time vira ativo produtivo:
não é só "vale X", é "rende Y por rodada". RPG-PRICE-LIVE literal — o ativo joga e paga.

### 4 · EMPRÉSTIMO COM OPÇÃO DE COMPRA — liquidez sem vender
Aluga um jogador por N partidas por X OLEFOOT. Ele joga no time do locatário, mas **a evolução
fica no jogador** — o dono lucra o aluguel E a valorização do treino alheio. Opção de compra
embutida a preço travado no contrato. Mercado de aluguel = renda pra elenco profundo e porta de
entrada barata pra manager novo.

### 5 · LEILÃO-RELÂMPAGO DO MVP — escassez programada diária
O MVP da rodada (a telemetria já elege MVP por partida) entra num leilão de 15 minutos em
OLEFOOT, uma cópia única, todo dia no mesmo horário. O `liveAuctionEngine` já existe no cliente —
falta ligá-lo no servidor. Evento diário de comparecimento + pia de OLEFOOT + imprensa interna
("por quanto saiu o MVP de ontem?").

### 6 · COTAS DE TIME — venda 20% em vez de 100%
O Vault já tem **livro de cotas append-only em produção** (vault_livro_de_cotas, numeric(78,0)).
Plugando o time nele: o dono vende 20% do clube, cotistas recebem a fração dos prêmios de liga e
da venda futura de jogadores. Clube grande vira fundo com torcida-acionista — e a venda de time
inteiro (entregue hoje) vira só o caso 100%.

### 7 · IPO DE CLUBE — estreia comprando uma franquia pronta
Manager novo escolhe no onboarding: começar do zero OU **comprar um time pronto da vitrine** (o
motor é a venda de time inteiro que subiu hoje). Managers veteranos constroem times PRA vender —
"incorporadora de clube" vira profissão; os satélites da Ativação 3× geram oferta natural de
times ociosos. O onboarding deixa de ser tutorial e vira a primeira decisão de investimento.

---

## Ordem que eu atacaria

1. **Gap nº 1** (rating/timeline no servidor) — destrava o Ticker e dá auditoria a tudo.
2. **Ticker + OLE-100** (nº 1) — transforma o que já existe em espetáculo; custo baixo.
3. **Royalty de formador** (nº 2) — diferencial de produto; a cadeia já nasce gravada.
4. **MVP relâmpago** (nº 5) — evento diário barato de montar, caro de ignorar.
5. Yield (nº 3) → Empréstimo (nº 4) → Cotas (nº 6) → IPO (nº 7), nessa ordem: cada um usa o anterior.
