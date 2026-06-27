# 👻 Quick Match — Ghost Mapping (foco Partida Rápida)

**Data:** 2026-06-19
**Caminho de produção auditado:** `MatchQuickEngaged` → `QuickPlanPlayer.tsx` → `quickPlanClient.ts` → `match_simulator.py` (Python pré-computa; flag `VITE_QUICK_PLAN_ENABLED=1` LIGADA em prod).

---

## 🎯 Veredito

A camada de DECISÃO do manager está bem conectada (estilo, formação, beats, sub, legacy mudam o placar evento-a-evento). O buraco está na camada de ATRIBUTO: **só 6 dos 10 atributos do jogador cruzam a ponte pro Python**. 40% da ficha de cada jogador é decorativa no resultado da Partida Rápida.

---

## 🟢 O que JÁ está conectado (não mexer — funciona)

| Sistema | Evidência | Efeito no placar |
|---|---|---|
| Estilo tático ao vivo | `resolveStyleOnEvent` chamado no tick (QuickPlanPlayer:755, evento trocado em :768) | ✅ converte/perde lance |
| Formação ao vivo | `resolveFormationOnEvent` (:776) | ✅ |
| Analyst beats | `handleBeatChoice`→`res.events` (:970) no 1º tempo + ledger → `build_decision_modifiers` no replan Python do 2º tempo | ✅ duplo |
| Substituição | `applySubNudge` (:894) | 🟡 fraco (ver ponte #3) |
| Expulsão / momentos forçados | `applyManDownPenalty` (:905) | ✅ |
| Buff de legacy | `resolveLegacyBoost` (manual) + `applyLegacyBoostToLineup` (passivo→Python) | ✅ (ligado nesta sessão) |

---

## 🧬 DNA PERDIDO (o achado central)

### 1. 4 atributos NUNCA chegam ao motor — 💀 DNA Decorativo
**Prova:** `quickPlanClient.ts:25-37` (`QuickPlanPlayerPayload`) e `:66-84` (`playerToQuickPlanPayload`) só mandam **finalizacao, passe, marcacao, velocidade, fisico, confianca**. E `grep tatico|drible|mentalidade|fairplay smartfield/match_simulator.py` → **nada**.

| Atributo | O que deveria pesar | Hoje |
|---|---|---|
| `drible` | 1v1, criação de chance, romper marcação | **ignorado** |
| `tatico` | controle de meio, menos perda de bola, leitura | **ignorado** |
| `mentalidade` | clutch no fim, pênalti, jogo grande | **ignorado** |
| `fairPlay` | propensão a falta/cartão | **ignorado** (cartão é `rng < 0.025` fixo, `match_simulator.py`) |

**Impacto concreto:** um craque com drible 95 / tático 90 joga IDÊNTICO a um de drible 40 / tático 40 se os 6 atributos enviados forem iguais. Metade do mercado de atributos (e da evolução de jogador) não muda nada na Partida Rápida.

### 2. `cognitiveArchetype` / `behavior` / `archetype` / `strongFoot` — 👻 DNA Fantasma
**Prova:** `grep` desses campos em QuickPlanPlayer + quickPlanClient + MatchQuickEngaged + quickBeatDirector → **zero**. São calculados, salvos no PlayerEntity e mostrados na UI, mas o motor de Partida Rápida nunca os lê.

### 3. `fairPlay` → cartões: 🎭 Desmerecimento
**Prova:** `sprinkleDisciplineEvents` (quickBeatDirector:286) recebe só `{id,name,fatigue}`. Cartão depende de fadiga, **não** de fairPlay. Jogador sujo e jogador limpo têm o mesmo risco.

---

## 🌉 Pontes a construir (priorizadas)

| # | Ponte | Esforço | Ganho |
|---|---|---|---|
| **1** | **Enviar os 4 atributos faltantes ao Python e usá-los** (payload + match_simulator) | 🟡 médio | 🔥🔥🔥 |
| **2** | **fairPlay → risco de cartão** (em `sprinkleDisciplineEvents`, client — independe do Python) | 🟢 baixo | 🔥🔥 |
| **3** | **Substituição que importa**: `applySubNudge` pesar pernas frescas (Δfadiga) + encaixe de posição, não só ΔOVR≥3 | 🟢 baixo | 🔥🔥 |
| **4** | **cognitiveArchetype/behavior → viés leve** de estilo (agressivo→mais chutes, armador→mais posse) no boost passivo do lineup | 🟡 médio | 🔥 |

### Detalhe da Ponte #1 (a mais valiosa)
No Python, com os 4 atributos disponíveis:
- `drible` → peso do ator na zona de ataque (`pick_actor`) + bônus de xG em jogada construída.
- `tatico` → entra no `_mid_quality` (controle de meio que acabei de adicionar) e reduz turnovers → mais posse.
- `mentalidade` → escala a resposta à **urgência por placar** (#4 do motor) e a conversão de pênalti — clutch real.
- `fairPlay` → substitui o `rng < 0.025` fixo por probabilidade ponderada (baixo fairPlay = mais cartão).

Isso ressuscita 40% da ficha de uma vez e dá sentido à evolução/scout de jogador no modo mais jogado.

---

## 📊 Métricas (foco Quick)
- Atributos enviados ao motor: **6/10** (60%).
- DNA fantasma: cognitiveArchetype, behavior, archetype, strongFoot (4 campos).
- Constantes mágicas substituíveis: cartão (`0.025`) → fairPlay.
- Sistemas de decisão conectados: 6/6 (estilo, formação, beats, sub, expulsão, legacy). **A decisão funciona; o atributo é que vaza.**

---

## 💡 Conclusão
O Quick Match não tem "lógica órfã" de decisão — o que o manager ESCOLHE pesa. O fantasma é de ATRIBUTO: a ponte `PlayerEntity → payload Python` é estreita demais (6 de 10). Construir a Ponte #1 é o maior ganho de fidelidade com o menor risco, e fecha o ciclo treino/scout/evolução → resultado.

---

# 👻 UPDATE — Auditoria de Intenção do Fundador (Ghost Mapping)

**Data:** 2026-06-27
**Arquivos varridos:** 1065 `.ts/.tsx` (era 863 em 2026-05-02)
**Foco do pedido:** "o que foi solicitado na origem e IGNORADO pelo Claude Code — trazer a essência de volta."
**Pontes do motor (2026-05-02) — reverificadas:** ✅ TODAS VIVAS.
- `agentDecisionIntegration` → `applyAgentBiasToScore` importado em `collectiveIndividualDecision.ts:20`.
- `legendDNA` → `ego` chega à decisão individual em `OnBallDecision.ts:527` (egoBias real).
- `GameSpirit` Math.random caiu de ~8 → **3** ocorrências.
**Pontes de atributo (2026-06-19) — reverificadas:** ✅ os 4 atributos faltantes foram conectados (commit `6a75ed4`, payload 6/10 → 10/10).

> O MOTOR evoluiu muito. O que ainda dói agora **não é o motor — é a EXPERIÊNCIA.**

---

## 🎯 Veredito Geral

> A essência que o fundador pediu para o Quick — **a camada de CELEBRAÇÃO / VIRALIZAÇÃO / RETENÇÃO** — foi construída, testada, e depois ABANDONADA quando a produção migrou do motor legado (`MatchQuick.tsx` tick-by-tick) para o motor novo (`MatchQuickEngaged` → Python). Três sistemas inteiros viraram fantasma de uma migração silenciosa: o Claude Code portou o NÚCLEO (placar, evolução, dinheiro, win-streak) e deixou para trás a alma do produto (o "efeito uau" e os ganchos de retorno).

**A pegadinha que escondeu isso:** o código "existe" e compila. Os componentes estão importados — só que **na página errada** (a desligada). Um `grep` de "está importado?" diz VIVO; um `grep` de "a página de PRODUÇÃO monta?" diz MORTO.

**Flag confirmada:** `VITE_QUICK_PLAN_ENABLED=1` em `.env.production` E `.env.local` → **produção roda o caminho Engaged**. (Uma auditoria rápida anterior errou ao supor a flag "OFF por padrão"; ela está ON.)

---

## 1. 🔴 A ALMA ÓRFÃ — 3 sistemas construídos, vivos no legado, MORTOS em produção

Os 3 painéis abaixo são renderizados **só** em `src/pages/MatchQuick.tsx` (o `MatchQuickLegacy`, que a flag desliga). O caminho de produção `MatchQuickEngaged` → `QuickPlanPlayer.tsx` **não importa nenhum** (`grep` → vazio).

### 1.1 `QuickPerformanceBonusPanel` — 💀 Celebração morta
- **A Promessa:** painel de "Efeito Uau" no pós-jogo revelando conquistas (Clean Sheet, Hat-trick, Virada, Goleada, Eficiência) — o momento de orgulho que vira print.
- **A Realidade:** em produção a lógica RODA (`computeQuickPlanCredit` → `evaluatePerformanceBonuses`, `creditQuickPlan.ts:114`) e até CREDITA o dinheiro. Mas o resultado vira **uma linha de texto enterrada no inbox** (`reducer.ts:2304`) com **`hideFromHomeFeed: true`** (`reducer.ts:2306`) — escondida do feed da Home. O painel celebratório (`MatchQuick.tsx:4039`) nunca monta.
- **Intenção perdida:** o jogador GANHA o bônus mas NUNCA VÊ a comemoração. O "uau" foi calculado e jogado no lixo.

### 1.2 `QuickStreakChallengesPanel` — 👻 Retenção fantasma
- **A Promessa:** desafios semanais nomeados ("Muralha: 3 jogos sem sofrer", etc.) — o gancho de "volta amanhã pra completar".
- **A Realidade:** `updateStreakProgress` (de `quickStreakChallenges`) só é chamado no `FINALIZE_MATCH` legado. O `FINALIZE_QUICK_PLAN` de produção (`reducer.ts:2263`) chama `updateStreak` (o MULTIPLICADOR de vitória) mas **nunca** `updateStreakProgress` (os DESAFIOS). Em produção os desafios semanais **não progridem jamais**.
- **Intenção perdida:** o loop de retenção de médio prazo (volta amanhã) não existe no modo mais jogado.

### 1.3 `QuickNarrativeArcIndicator` — 👻 Drama fantasma
- **A Promessa:** indicador ao vivo do arco da partida ("VIRADA!", "DOMÍNIO", "RESISTÊNCIA") — a tensão emocional que prende.
- **A Realidade:** `getArcFeedSpeed`/arco só são usados em `MatchQuick.tsx` (legado, e ainda por cima num bloco `className="...hidden"` na linha 3034). `QuickPlanPlayer` não lê arco nenhum.
- **Intenção perdida:** a partida de produção não tem leitura dramática visível — é placar seco.

---

## 2. 🧟 Resíduos da migração (dead code seguro de remover)

| Arquivo / Export | Status | Prova |
|---|---|---|
| `components/matchquick/QuickMatchSpeedControl.tsx` | 🔴 Órfão | 0 imports externos |
| `components/matchquick/CompetitiveModeToggle.tsx` | 🔴 Órfão | 0 imports externos |
| `components/matchquick/CompetitivePointsResult.tsx` | 🔴 Órfão | 0 imports externos |
| `match/quickImpactModel.ts` | 🔴 Casca | só re-export; 0 consumidores |
| `quickNarrativeArcs.ts:118` `getArcMusicIntensity()` | 🟠 Dead export | nunca chamado (áudio dinâmico nunca ligado) |
| `quickStreakChallenges.ts:107` `getCompletedChallengeRewards()` | 🟠 Dead export | nunca chamado |
| `reducer.ts:1835` `possession: 60 // TODO` | 🟡 Stub | posse hardcoded alimenta detecção de "dominance" |

---

## 3. 🌉 Pontes a Construir (trazer a essência de volta)

| # | Ponte | Origem → Destino | Esforço | Ganho |
|---|---|---|---|---|
| **1** | **Bônus de performance VISÍVEL no pós-jogo Engaged** (montar painel a partir de `credit.bonusNames`/`evolution`, com revelação progressiva) | `creditQuickPlan` → pós-jogo `QuickPlanPlayer` | 🟢 baixo | 🔥🔥🔥 Ressuscita o "efeito uau" no modo mais jogado |
| **2** | **Desafios semanais progridem no Engaged** (chamar `updateStreakProgress` no `FINALIZE_QUICK_PLAN`) | `quickStreakChallenges` → `reducer.ts:2263` | 🟢 baixo | 🔥🔥🔥 Liga o loop "volta amanhã" |
| **3** | **Arco narrativo no `QuickPlanPlayer`** (detectar arco dos eventos do plano e mostrar indicador) | `situationalIntelligence/quickNarrativeArcs` → `QuickPlanPlayer` | 🟡 médio | 🔥🔥 Drama visível na partida |
| **4** | **Parar de esconder o bônus do feed** (`hideFromHomeFeed: false` + card compartilhável) | `reducer.ts:2304` | 🟢 baixo | 🔥🔥 Compartilhamento orgânico |
| **5** | Remover os 4 resíduos órfãos (seção 2) | — | 🟢 baixo | 🧹 Higiene |

---

## 4. 📊 Métricas

- **Motor (decisão + atributo):** ~90/100 — pontes 2026-05-02 e 2026-06-19 confirmadas vivas.
- **Experiência (celebração + retenção + drama):** ~30/100 — 3 sistemas órfãos por migração.
- **Score de conexão Quick (ponderado):** **78/100** (era 75/100 geral em 2026-05-02; o motor subiu, mas a alma viral caiu).
- Órfãos totais: 4 · Dead exports: 2 · Sistemas vivos-só-no-legado: 3 · Stub: 1.

---

## 5. 💡 Conclusão para o Fundador (sem bajulação)

A essência que você pediu na origem — **fazer cada Partida Rápida virar um momento que dá orgulho de mostrar e vontade de voltar** — foi construída por inteiro. O Claude Code só cometeu o pecado clássico da migração: **levou o esqueleto (placar, dinheiro, evolução) pro motor novo e deixou a alma (uau + retenção + drama) presa no motor velho que ninguém mais executa.** Não foi mentira nem alucinação — foi omissão silenciosa. O código existe, compila, e está morto.

As 3 pontes mais valiosas (#1, #2, #4) são de esforço BAIXO porque a lógica já está pronta e testada — é literalmente reconectar o cabo na página certa. Em uma sessão, o modo mais jogado do Olefoot recupera o "efeito uau" e o gancho de retorno que você projetou.

---

## 🌉 UPDATE 2026-06-27 — Pontes 1, 2 e 3 CONSTRUÍDAS

A alma órfã foi reconectada ao motor de produção (Engaged). tsc limpo + 5 self-tests do Quick verdes (quick-credit/engaged/beats/clutch/matchup).

### ✅ Ponte #1 — Bônus de Performance VISÍVEL (o "efeito uau")
- `creditQuickPlan.ts`: `QuickPlanCreditResult` agora devolve `bonuses: PerformanceBonus[]` (não só nomes). Hat-trick reativado via eventos SINTÉTICOS a partir de `homeStats.goals`; "Virada Épica" reativada via `wasLosing` real.
- `QuickPlanPlayer.tsx`: `wasLosingRef` marca quando a casa fica atrás (3 incrementos do visitante) → entra em `result.stats.wasLosing`.
- `reducer.ts` (FINALIZE_QUICK_PLAN): expõe `lastQuickBonuses: credit.bonuses`. `types.ts`: campo novo.
- `MatchQuickEngaged.tsx`: monta `QuickPerformanceBonusPanel` no pós-jogo (revelação progressiva via motion já embutida no componente). Passa `goals` por jogador.

### ✅ Ponte #2 — Desafios Semanais PROGRIDEM no Engaged (gancho de retorno)
- `reducer.ts` (FINALIZE_QUICK_PLAN): chama `updateStreakProgress`/`shouldRefreshChallenges`/`generateWeeklyChallenges` (espelha o legado), expõe `streakChallenges`.
- `MatchQuickEngaged.tsx`: monta `QuickStreakChallengesPanel` no pós-jogo (progresso visível).

### ✅ Ponte #3 — Arco Narrativo AO VIVO (drama visível)
- `quickNarrativeArcs.ts`: novo `detectLiveArc()` (usa minuto/placar/momento/finalizações — sem depender de MatchEventEntry[] que o Engaged não tem). Limiares espelham `detectNarrativeArc`.
- `QuickPlanPlayer.tsx`: renderiza `QuickNarrativeArcIndicator` logo abaixo da MomentumBar durante `phase === 'playing'` (some sozinho em 'balanced').

**Resíduos (seção 2) e Ponte #4 (parar de esconder do feed + card compartilhável):** ainda pendentes. NÃO removi o dead code nem mexi no `hideFromHomeFeed` desta vez (escopo = pontes 1/2/3).
