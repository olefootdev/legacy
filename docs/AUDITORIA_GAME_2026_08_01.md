# Auditoria do OLEFOOT GAME — 2026-08-01

Levantamento pedido pelo fundador junto com o rollout do **layer final** (artifact
`61b96f79`): o que dá pra unificar, que botão não leva a lugar nenhum, e que
funcionalidade foi construída e nunca ligada.

**Nada aqui foi executado.** Toda alteração de rota está esperando o teu OK item a item —
mexer em rota quebra link salvo e link compartilhado, e essa decisão é tua.

Para cada item: **o que é**, **a recomendação**, e o **risco** de aplicá-la.

---

## 1. Construído, pago e desligado

Código que existe, funciona, e nenhum manager consegue alcançar.

### 1.1 `/manager/missoes` — 602 linhas, zero links

`Missions.tsx` roda o `MISSION_CATALOG` inteiro com o `progressionStore`. Nenhum arquivo do
app aponta pra ela. O manager cumpre missão e nunca vê.

→ **RELIGAR.** Já fiz metade: o bloco de Missões diárias que entrou na Home hoje tem um
link "Todas as missões" apontando pra cá. Falta a entrada no menu do Manager.
**Risco: nenhum** — só acrescenta caminho.

### 1.2 `/ajuda/como-jogar` — 262 linhas, zero links

`HowToPlay.tsx` é o tutorial. O `HelpHub` existe, a rota existe, mas ninguém linka. Um
jogador novo não tem como achar o "como se joga".

→ **RELIGAR** a partir do `HelpHub`. **Risco: nenhum.**

### 1.3 Desafios diários — dado vivo sem tela (✅ resolvido hoje)

O caso mais caro que achei, e por isso registro aqui: `state.dailyChallenges` estava
completo — a Home resetava os desafios todo dia, a partida empurrava progresso pelo
`UPDATE_CHALLENGE_PROGRESS`, e o reducer creditava EXP e Renome no
`CLAIM_CHALLENGE_REWARD`. Só que **nenhuma tela mostrava isso**. A mecânica inteira rodava
no escuro.

→ **FEITO** nesta sessão: `DailyMissions` na Home.

---

## 2. Candidatos a unificação

### 2.1 Ranking em três telas

| Rota | O que responde |
|---|---|
| `/competicao/ranking` | ranking de clubes por escopo de liga |
| `/competicao/standings` | tabela da Liga Rápida / Clássica (PvP) |
| `/match/global/all-time` | Hall da Fama, histórico entre temporadas |

Não são cópias — são três recortes da **mesma pergunta do jogador**: "quem tá ganhando, e
onde eu estou". Hoje ele precisa saber que existem três endereços diferentes.

→ **UNIFICAR em abas** dentro de `/competicao/ranking` (Clubes · PvP · Hall da Fama),
mantendo as rotas antigas como redirect. **Não apagar nada** — as três consultas continuam.
**Risco: baixo** com os redirects; **médio** sem eles.

### 2.2 Liga Global espalhada em 7 rotas

`/match/global`, `/match/global/history`, `/match/global/all-time`,
`/match/global/club/:id`, `/liga-global/registro`, `/liga-global/playoffs`,
`/liga-global/hoje` — e ainda em **dois prefixos diferentes** (`/match/global` e
`/liga-global`), o que é confusão de endereço, não de produto.

→ **UNIFICAR** sob um prefixo só, com `hoje`/`playoffs`/`histórico` como abas de
`/match/global`. `registro` e `club/:id` continuam telas próprias (têm função distinta).
**Risco: médio** — `/liga-global/registro` é a rota mais linkada do grupo (5 arquivos) e
pode estar em material divulgado. Redirect obrigatório.

### 2.3 Wallet: 4 rotas, 1–2 links cada

`/wallet` + `/wallet/referrals`, `/wallet/colecao`, `/wallet/extract`. As três sub-abas já
são componentes `*Tab` — o nome entrega que **eram para ser abas**, e viraram rotas.

→ **UNIFICAR** como abas dentro de `/wallet`, redirects nas antigas. **Risco: baixo.**

### 2.4 Oito rotas `/dev/*` em produção

`/dev/penalty-preview`, `/dev/setpiece-preview`, `/dev/legacy-card`,
`/dev/ceremony-preview`, `/dev/field-view`, `/dev/agents-field`, `/dev/agents-debug`,
`/dev/field-lab` (+2 variantes). São laboratórios de desenvolvimento servidos ao público —
qualquer pessoa com o endereço entra.

→ **FECHAR** atrás de `import.meta.env.DEV`, mantendo o código. **Atenção:**
`/match/legacy` aponta pro mesmo `FieldViewPreview` e a nota do projeto diz que o motor 2D
é intocável — essa rota **fica**. **Risco: baixo**, desde que `/match/legacy` seja
preservada.

---

## 3. Promessas sem lastro

### 3.1 O menu JOGAR anuncia 3 modos que não existem

`MatchModeBottomSheet` lista 5 modos. **Dois** são jogáveis (Pênalti, Rápida). Três estão
"Em breve":

- **Classic** — `/match/classic` existe só para exibir um cartaz de "Em breve".
- **Legacy** — marcado como indisponível, mas `/match/legacy` **funciona** (é o motor 2D).
- **Cards** — "jogo por cartas táticas". Não existe código nenhum. (`src/components/cards/`
  são cards de interface, não jogo de cartas.)

→ **DECISÃO TUA:** o menu principal do jogo está 60% ocupado por coisa que não abre. Sugiro
mostrar só o que abre, e mover o resto para um "no forno" fora do caminho de quem quer
jogar agora. Se o "Em breve" é intencional como teaser, fica — mas então vale acertar o
**Legacy**, que está anunciado como indisponível enquanto funciona.

### 3.2 Rodapé do Manager promete o que já existe

`Manager.tsx:1049`: *"Indicações pelo teu código aparecem aqui em breve (próxima fase)."*
A próxima fase chegou: o `ReferralInvite` na Home já mostra o link e o placar da rede.

→ **APAGAR a frase** e trocar por um link pro bloco que funciona. **Risco: nenhum.**

---

## 4. Estado do rollout do design system (mapa da fase 2)

De **76 páginas** em `src/pages/`, apenas **Home** e **ClubHub** usam a linguagem do layer
final (`.ole-poster`, `.ole-rail`, `.ole-eyebrow-poster`, `.ole-bleed`, `font-impact`). As
outras ~74 seguem no estilo antigo.

A boa notícia: **os tokens e os componentes já existem** (`src/index.css` +
`src/components/ui/`). A fase 2 é aplicar, não inventar.

Ordem sugerida — pelo que o manager vê mais, não pelo que é mais fácil:

| Bloco | Linhas | Por quê nessa ordem |
|---|---|---|
| 1. Clube | ~4.100 | é onde o manager passa o dia |
| 2. Competição | ~4.700 | segunda tela mais aberta |
| 3. Mercado | ~5.000 | **o marketplace é pedido explícito da diretriz** |
| 4. Liga Global | ~3.200 | ganha junto com a unificação do item 2.2 |
| 5. Manager + Wallet | ~7.400 | Config sozinho tem 1.190 linhas |
| 6. Partida / Pós-jogo | ~6.700 | maior risco: `MatchQuick.tsx` tem 4.355 linhas |

---

## 5. Proposta: talento do REVELA vira card jogável

**Metade da ponte já está construída e ninguém ligou os dois lados.**

O que já existe:

- `TalentStatus` no portal inclui `'carded'`, descrito na própria interface como *"Já virou
  card jogável"* (`revela/src/pages/TalentPage.tsx:38`).
- Os atributos do talento usam **as mesmas 10 chaves canônicas** do `PlayerAttributes` do
  jogo. O comentário em `revela/src/data/types.ts` diz isso na cara: *a ficha que o OLE
  SCOUT preenche é a mesma ficha que vira card lá*.
- O OVR já é calculado no servidor, ponderado por posição.

O que **não** existe: qualquer coisa que crie o card. Hoje o talento é marcado `carded` e o
jogo nunca fica sabendo. O selo é uma promessa que o produto não cumpre.

### Mapeamento (talento → `legacy_players`)

| REVELA | legacy_players | Observação |
|---|---|---|
| `name`, `pos` | `name`, `pos` | direto |
| `attributes` | `attributes` | mesmas 10 chaves — sem conversão |
| `overall` | — | recalculado por `overallFromAttributes(attrs, pos)` |
| `portrait` | `portrait_public_url` | **retrato 2:3 vertical** (regra do card Legacy) |
| `country`, `bio` | `country`, `bio` | direto |
| `birthYear` | `age` | derivar do ano |
| — | `rarity_label`, `card_supply`, `price_*` | **decisão comercial, não automática** |
| — | `listed_on_market` | entra `false`: ninguém vai à venda sem tu mandar |

### Como disparar

Igual ao que já é a prática: **pelo admin, por SLUG**, do mesmo jeito que a aprovação de
talento acontece hoje. Nada automático — um talento virar carta é decisão editorial e
comercial tua, não efeito colateral de um `UPDATE`.

### O que falta

1. Migration com a função de promoção (talento → linha em `legacy_players`) — **eu escrevo,
   tu aplicas no SQL Editor**, como é a regra do projeto.
2. Botão no painel admin.
3. Decidir raridade, supply e preço de lançamento por talento.

**Nada disso foi feito nesta sessão** — é proposta esperando teu OK.

---

## Resumo para decidir

| # | Item | Recomendação | Risco |
|---|---|---|---|
| 1.1 | `/manager/missoes` órfã | religar no menu | nenhum |
| 1.2 | `/ajuda/como-jogar` órfã | religar no HelpHub | nenhum |
| 2.1 | Ranking em 3 telas | unificar em abas + redirect | baixo |
| 2.2 | Liga Global em 7 rotas | um prefixo só + abas | médio |
| 2.3 | Wallet em 4 rotas | virar abas | baixo |
| 2.4 | 8 rotas `/dev/*` públicas | fechar em DEV (menos `/match/legacy`) | baixo |
| 3.1 | 3 modos "Em breve" no menu JOGAR | decisão tua | — |
| 3.2 | Frase vencida no Manager | apagar | nenhum |
| ✅ | **Exchange (câmbio EXP↔BRO)** | **REMOVIDO 2026-08-01** por decisão do fundador | resolvido |
| 5 | REVELA → card jogável | migration + botão admin | médio |


---

## Apêndice — Exchange removido (2026-08-01)

O `/mercado/exchange` era **só câmbio de moeda EXP↔BRO** — nunca trocou jogador. (OLEXP e
GAT, aliás, já tinham saído do jogo em 16/07/2026; sobraram só os redirects.) Decisão do
fundador: remover.

**A armadilha que quase custou dinheiro de manager.** Anunciar um lote no Exchange
**debitava o EXP na hora** (`EXP_EXCHANGE_ANNOUNCE_SELL` → `addOle(finance, -expAmount)`), e
esse EXP só voltava pelo botão "cancelar" **daquela tela**. Apagar a tela sem mais nada
deixaria o EXP preso num save que ninguém mais consegue abrir.

Feito, nesta ordem:
1. `expPresoEmOrdensDoExchange()` em `persistence.ts` — no primeiro carregamento, devolve à
   carteira o EXP das ordens do próprio clube e zera o livro. Ordem de terceiro não é
   devolvida (não é dinheiro do manager).
2. Página `TransferExchange.tsx` apagada (683 linhas).
3. `/mercado/exchange` e `/transfer/exchange` viram **redirect** pro Mercado — link salvo ou
   compartilhado não cai em 404, mesmo padrão de `/wallet/olexp`.
4. Card do MarketHub e CTA do Transfer removidos.
5. Self-test `npm run test:exchange-refund` — 7 casos, cobrindo ordem própria, de terceiro,
   mistura, save vazio e lixo no save.

**Sobrou de propósito:** o estado `expExchange`, as actions no reducer e
`src/economy/expExchange.ts`. Removê-los agora quebraria a leitura de saves antigos antes de
a devolução ter rodado na máquina de cada manager. Some numa limpeza posterior, quando não
houver mais saves com ordens abertas.

**Achado à parte:** o livro tinha uma trilha de ordens de NPC (`npcOrders` +
`replenishNpcExpOrders`) viva no reducer, mas o estado nascia vazio ("sem mocks"). Máquina
ligada e nunca alimentada — foi junto com a remoção.


---

## Apêndice — Duas escalas de raridade conflitantes (achado de 2026-08-01)

Ao repaginar a Loja, apareceu um problema que não é de estética: **o jogo tinha duas escalas
de cor para raridade ao mesmo tempo**.

| Onde | Comum | Raro | Épico | Topo |
|---|---|---|---|---|
| `Badge` do DS (usado no PackCard) | amarelo | **verde** | **roxo** | **laranja** |
| Loja (`rarityStyles`) | cinza | **ciano** | **fúcsia** | âmbar |
| `StoreItemList`, `StoreFeaturedBoxes` | cinza | ciano | fúcsia | âmbar |

O jogador via **a mesma palavra em duas cores diferentes** conforme a tela — "épico" roxo num
lugar, fúcsia no outro. A cor, que deveria ensinar valor, não ensinava nada.

E existe regra canônica escrita, com a assinatura do fundador, em
`src/entities/rarityLabels.ts`:

> *"Visual: prestígio = GRAU DE AMARELO (épico sólido → premium sem amarelo)."*

Nenhuma das duas escalas seguia a regra. Unifiquei as três na escada de amarelo:

- **Comum** — sem amarelo (osso sobre preto)
- **Raro** — um fio de amarelo
- **Épico** — trilho e etiqueta amarelos
- **Mítico / Lendário** — amarelo sólido, texto preto, sombra dura

**O que isso muda fora da Loja:** o `Badge` é do design system. A mudança alcança o
`PackCard` (único outro consumidor das variantes de raridade hoje). Verde e vermelho
continuam onde são **informação** — "incluso/positivo" e "erro" — agora com os tokens
`--color-success` / `--color-danger` em vez de cores soltas do Tailwind.


---

## Confirmação pedida — LIGA GLOBAL e LIGA OLE (2026-08-01)

### Liga Ole — **ligada e saudável**

- Dados reais: rivais por `fetchLigaOleRivals`, tabela semanal em `ligaOleWeekly` (Supabase),
  avanço de fase pelo `FINALIZE_QUICK_PLAN` no pós-jogo.
- Bem alcançável: banner na Home, `LigaOleBanner` e três CTAs no pós-jogo Engaged.
- **DS: FEITO agora** — as manchetes saíram da serifa itálica para Anton. Zero cor fora da
  paleta (já estava limpa).

### Liga Global — **ligada, mas espalhada**

- Dados reais: estado `globalLeagueMVP` hidratado do backend; a Edge Function
  `global-league-tick` é a autoridade (o cliente só lê). Confirmado no código: *"A Liga Global
  é autoritativa no backend… o frontend só lê"*.
- Seis das sete telas leem do mesmo estado; só a `GlobalLeagueDaily` consulta o Supabase
  direto (tally de decreto).
- **DS: NÃO FEITO.** É o maior bolso de padrão antigo que resta:

| Tela | Linhas | Serifa | Cor fora da paleta |
|---|---|---|---|
| `MatchGlobal` | 1.360 | 21 | 20 |
| `GlobalLeagueRegistration` | 423 | 3 | 7 |
| `GlobalLeagueDaily` | 392 | 2 | 0 |
| `GlobalLeagueClubProfile` | 312 | 6 | 4 |
| `GlobalLeaguePlayoffs` | 298 | 3 | 7 |
| `GlobalLeagueHistory` | 231 | 9 | 2 |
| `GlobalLeagueAllTime` | 218 | 3 | 4 |

Recomendação: repaginar **junto com a unificação do item 2.2** (as 7 rotas em dois prefixos
diferentes). Fazer as duas coisas na mesma passada evita mexer nessas telas duas vezes.

### ⚠️ Achado durante a auditoria: o HODL pode continuar rodando no servidor

O OLEXP/GAT/HODL saiu do **cliente** em 2026-07-16. O comentário em `worldCatchUp.ts` é
específico: *"nenhum rendimento é emitido **no cliente**"*.

Mas no servidor continuam existindo:
- a Edge Function `supabase/functions/hodl-daily-tick`,
- que chama a RPC `process_hodl_daily_tick`,
- criada em `20260528000200_hodl_olexp_integration.sql` — e **não achei nenhuma migration que
  a derrube**.

Se essa função ainda estiver agendada, ela pode continuar creditando saldo em
`olexp_balances` todo dia, para uma moeda que o jogo não mostra mais. **Não consigo confirmar
daqui** — depende de olhar o agendamento e a tabela no painel do Supabase. Fica como
verificação para o fundador; se estiver ativa, é emissão de moeda fantasma.


---

## Expurgo da rentabilidade — 2026-08-01

Diretriz do fundador: *"não vai ter mais rentabilidade, não vai ter mais OLEXP, não vai ter
mais ganho diário. Vai ser o foco no game, nos CARDS."*

### Removido do cliente

- **Renda passiva de estruturas** (`clubStructures/passiveIncome.ts`,
  `PassiveIncomeWidget.tsx`, a action `CLAIM_PASSIVE_STRUCTURE_INCOME`, o case do reducer e o
  campo `finance.passiveIncome`). Era EXP acumulando por hora offline — "ganho por tempo, sem
  jogar", exatamente o que a diretriz elimina.
  **Já estava morto:** o único lugar que resgatava era o widget, que nunca era renderizado.
  Ninguém perdeu nada — o EXP nunca chegava a ser creditado.
- **A promessa do GAT** na Wallet e no Manager (ver seção anterior).

### Removido do servidor

- Edge Function `supabase/functions/hodl-daily-tick` apagada do repositório.
- Migration `20260801120000_desliga_rentabilidade_hodl_olexp.sql`: desagenda o cron diário e
  derruba `process_hodl_daily_tick`, `create_hodl_lock`, `get_hodl_rewards_for_lock` e
  `get_recent_lottery_draws`. **✅ APLICADA em produção pelo fundador em 2026-08-01.**
  A emissão diária de rendimento está encerrada.

### ⚠️ O que a migration deliberadamente NÃO faz

1. **Não apaga saldo.** `olexp_balances`, `olexp_ledger` e `hodl_locks` ficam. Os locks aceitam
   **BRO**, que é dinheiro com valor real — se houver lock ativo em BRO, é dinheiro de manager
   preso num sistema desligado, e isso precisa de decisão antes de qualquer limpeza. Por isso o
   passo 1 do procedimento é **medir**.
2. **Não toca nos CARDS.** `premium_card_grants`, `get_my_premium_cards` e
   `redeem_premium_card` nasceram na mesma migration do HODL, mas os cards **não são** do
   HODL — vêm de `career_bonus` e `admin`, e o jogo chama os dois RPCs em
   `src/wallet/premiumCards.ts`. Derrubá-los quebraria o foco que a diretriz quer preservar.

### O que FICA de propósito

- **Receita de dia de jogo** do estádio e da megaloja (`structureMatchExpBonuses`). Paga EXP
  por público em jogo em casa — é ganho por **jogar**, mecânica de futebol, e está ligada de
  verdade (reducer + `processLeagueSchedule`).
- **Comissão de 5% em BRO** sobre compras (`REFERRAL_RATE`, RPC
  `get_my_affiliate_commissions`). É real e continua valendo.
- Três menções residuais a OLEXP no cliente, todas legítimas: o redirect de
  `/wallet/olexp` (link salvo não vira 404), o tipo `CommissionCurrency` que precisa aceitar
  `'OLEXP'` para ler comissões antigas do histórico, e `LEGACY_KEYS` em `wallet/initial.ts`,
  que é justamente o código que **limpa** as chaves velhas dos saves.


### Fechadas: as torneiras de BRO (2026-08-01)

Diretriz complementar do fundador: *"nada de lucro por BRO ou etc mais"*. BRO é dinheiro com
valor real — o jogo pode **receber** (depósito) e **custodiar** (escrow de desafio), mas não
pode **emitir**. Havia duas fontes emitindo:

**1. Campanha da Megaloja — a mais grave.**
`CITY_QUICK_STORE_CAMPAIGN` convertia **540 EXP em 7.500 centavos (R$ 75)** de BRO. Sem
cooldown, sem teto diário, sem limite: a única checagem era ter os 540 EXP. Com um saldo
típico de 10M EXP, isso permitia ~18.500 execuções — cerca de **R$ 1,38 milhão em BRO** a
partir de moeda de jogo. Era uma torneira aberta em produção.
→ O ganho em BRO saiu. A campanha continua existindo e continua custando EXP; o efeito que
faz sentido (reforço do apoio da torcida) permaneceu, e a copy passou a dizer isso.

**2. Troféus memoráveis** pagavam R$ 50 / 25 / 15 por título de liga, copa e supercopa.
→ `broCents` zerado; o EXP continua. Título vale moeda de jogo, não dinheiro real.

Cobertura: `npm run test:no-bro-profit` — 8 asserções.

**Continua de pé (não é emissão):** escrow do desafio amistoso (é o próprio BRO do manager em
custódia, devolvido no cancelamento) e `broCentsDelta`, usado só pelo painel administrativo.

**✅ Confirmado pelo fundador (2026-08-01):** a comissão de **5% em BRO em 3 níveis**
(`REFERRAL_RATE = 0.05`, `REFERRAL_MAX_LEVELS = 3`, RPC `get_my_affiliate_commissions`) está
**correta e permanece**. Não é a rentabilidade que saiu — é o programa de afiliados sobre
compras reais, e continua valendo como está.


---

## Estado do rollout ao fim da sessão (2026-08-01)

### Telas do jogador com o layer final aplicado

**Home** · **Clube** (hub, Elenco, perfil do jogador, Treino, Staff, Academia, Estruturas) ·
**Mercado** (hub, Transfer, Loja) · **Competição** (hub) · **Ajuda** · **Wallet** (shell + 18
componentes) · **Manager** (hub, Network, Scouts, Scouts/Player, Pro, Mensagens) · **Config**
· **Missões** · **Liga Ole**

Todas com **zero** serifa em número, **zero** cor decorativa fora da paleta e **zero** eyebrow
da geração antiga.

### O Transfer recebeu tratamento de prioridade máxima

Pedido do fundador: *"nota 10 de 10, execução perfeita, referência Sorare"*. Além da
linguagem, o card foi reconstruído — ver seção própria abaixo.

### O que falta

| Bloco | Situação |
|---|---|
| **Partida** (`MatchQuick` 4.355L, `MatchQuickEngaged`, `MatchPenaltyV2`, `Postgame`, `MatchAuto`) | maior bolso restante e o mais visto durante o jogo |
| **Liga Global** (7 telas) | recomendado fazer junto com a unificação das rotas (item 2.2) |
| **Competição interna** (`Leagues`, `RankingFull`, `LegendsCup`, `Calendar`, `Legend`, `PremiumLeagues`) | — |
| **Porta de entrada** (`Login`, `Cadastro`, `PlayerVip`) | primeiro contato de quem chega pelo link de indicação |
| **Modais e overlays** (~30 componentes) | cauda longa |
| **Admin** (37 arquivos) | fora do alvo do rollout — não é tela de jogador |

Medindo pelo mesmo critério do início da sessão (`bg-` com cor arbitrária): **104 → 89
arquivos**, e dos 89 restantes **37 são do admin**, que não faz parte do rollout.
