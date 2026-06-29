# 🗺️ Olefoot — Plano de Melhorias (3 modos)

**Data:** 2026-06-28 · **Escopo:** Liga Global, Partida Rápida, Liga Ole + sistemas compartilhados.
**Método:** varredura paralela (4 auditores) + verificação manual dos achados de maior impacto.
**Status:** PLANO (nada implementado). Pronto pra executar quando o fundador voltar.

> Legenda: esforço 🟢 baixo / 🟡 médio / 🔴 alto · impacto 🔥 / 🔥🔥 / 🔥🔥🔥
> ✅ verificado por mim · ⚠️ relatado pelo auditor, **a confirmar** antes de codar.

---

## ✅ Correção de rota (achado FALSO já descartado)
Um auditor reportou um "bug do minuto 0/1" (eventos do 1º minuto pulados, relógio 0→2) em `QuickPlanPlayer.tsx`. **VERIFIQUEI e é FALSO:** o Python gera eventos em `range(1,91)` (`match_simulator.py:430`) e a guarda `m > 0` só ignora o minuto 0 (sem eventos); o minuto 1 processa normal. **Não perseguir isso.**

---

## 🎯 Veredito geral
Os 3 modos estão **funcionais e sem mock no que o jogador vê**. O motor (atributos 10/10 no Python, agentProfile, legendDNA, economia/fadiga) está vivo. O que dá pra evoluir cai em 4 baldes:
1. **Lógica calculada e invisível** (WO, rivalidade, dinastia, posse real, arco narrativo).
2. **Furos de coerência tática** (formação no 1º tempo, fadiga estática, shootout sem psicologia).
3. **Dívida técnica estrutural** (Python duplicado, 2 sistemas de IA órfãos do modo 2D).
4. **Resiliência/escala** (seed não-determinístico, RPC redundante, sem cleanup).

---

## 🥇 TIER 1 — Quick wins (alto impacto, baixo esforço) — fazer primeiro

| # | Modo | Melhoria | Onde | Esf. | Imp. |
|---|---|---|---|---|---|
| 1 | Global | **Zerar playoff stats no reset de temporada** ✅ (bug confirmado: `applyPromotionRelegation` zera sazonal mas não `playoffPoints/Wins/...`) | `globalLeagueMVP.ts:735-759` | 🟢 | 🔥🔥🔥 |
| 2 | Quick | **Posse REAL** (contar eventos por lado no Python e retornar `possession_home_pct`) em vez do proxy de média de momento | `match_simulator.py` + `quickPlanTypes.ts` + `creditQuickPlan` | 🟢 | 🔥🔥 |
| 3 | Quick | **Formação inicial respeitada no 1º tempo** ✅ (hoje `buildQuickPlanInputs` ignora `lineup.formation`; só vale do intervalo em diante) | `MatchQuickEngaged.tsx` + `buildQuickPlanInputs.ts` | 🟢 | 🔥🔥 |
| 3b| Quick | **`hideFromHomeFeed:false`** no bônus + (Ponte #4 residual) | `reducer.ts` (~2304) | 🟢 | 🔥🔥 |
| 4 | Global | **Exibir motivo de WO** ("WO — faltavam X jogadores" em vez de "0-3") | `components/matchglobal/` (fixture) | 🟢 | 🔥🔥 |
| 5 | Liga Ole | **Mostrar dinastia + valor final do prêmio ANTES da partida** (já calculado, só não exibido pré-jogo) | `LigaOle.tsx:614-621` | 🟢 | 🔥 |
| 6 | Liga Ole | **Risco/recompensa da aposta lado a lado** (Vitória +2× / Derrota −stake) | `LigaOle.tsx:646` | 🟡 | 🔥🔥 |
| 7 | Limpeza | **Remover dead code**: `roundsToTitle()` (Liga Ole, sem caller ✅), tipos/utils órfãos listados no Tier 4 | vários | 🟢 | 🧹 |

---

## 🥈 TIER 2 — Sprint (profundidade tática / realismo)

| # | Modo | Melhoria | Onde | Esf. | Imp. |
|---|---|---|---|---|---|
| 8 | Quick | **Fadiga dinâmica** — hoje a fadiga é estática no Python (lida 1× no início); time não cansa ao longo do jogo. Crescer fadiga por minuto recompensa rodízio/subs de verdade | `match_simulator.py` (loop) | 🟡 | 🔥🔥🔥 |
| 9 | Quick | **MVP melhor** — hoje só goleador (0-0 → null; `assists` sempre 0). Considerar nota geral (defesas/clean sheet/leitura) + rastrear assist | `match_simulator.py` | 🟡 | 🔥🔥 |
| 10 | Quick | **Shootout com psicologia** — pênalti não vê o placar nem o goleiro adversário; sem momentum entre cobranças. Adicionar pressão por contexto | `quickEngaged/penaltyShootout.ts` | 🟡 | 🔥 |
| 11 | Quick | **Atributos visíveis no pós-jogo** — drible/tático/mentalidade/fairPlay JÁ pesam no motor mas são invisíveis. Mostrar "Driblador da partida", "Frieza do batedor", risco de cartão | `QuickPlanPlayer` pós-jogo | 🟡 | 🔥🔥 |
| 12 | Global | **Rivalidade histórica** — `rivalryEncounters` é computado e nunca exibido. Card "Rivais" no perfil do clube | `GlobalLeagueClubProfile.tsx` | 🟢 | 🔥🔥 |
| 13 | Global | **Coroa do Dia no painel principal** — hero/CTA em `/match/global` (hoje só na rota `/liga-global/hoje`) | `MatchGlobal.tsx` | 🟡 | 🔥🔥 |
| 14 | Quick | **Arco narrativo no pós-jogo** — `detect_narrative_arc` (Python) classifica comeback/domínio/equilíbrio mas o resultado não vira card | `QuickShareCard`/pós-jogo | 🟢 | 🔥 |

---

## 🥉 TIER 3 — Resiliência, escala e estrutura

| # | Área | Melhoria | Onde | Esf. | Imp. |
|---|---|---|---|---|---|
| 15 | **Python** | **Eliminar duplicação `.py`** ✅ — `smartfield/match_simulator.py` ≡ `server/smartfield/match_simulator.py` (sincronizados à mão). Fonte única + cópia no build OU check de `diff` no CI | build/CI | 🟡 | 🔥🔥 |
| 16 | Liga Ole | **Seed determinístico na clássica** ✅ — hoje `ligaole-${short}-${Date.now()}` (`LigaOle.tsx:375`); reload antes de jogar recria bracket diferente. Usar hash manager+dia | `LigaOle.tsx:375` | 🟢 | 🔥 |
| 17 | Liga Ole | **Gravar Liga da Semana só no fim** — hoje RPC `recordLigaOleWeeklyRun` dispara a cada fase (4×/campanha). Gravar 1× no campeão/eliminado | `LigaOle.tsx:347-358` | 🟢 | 🔥🔥 |
| 18 | Liga Ole | **Cleanup de `liga_ole_weekly_runs`** — sem expiração; cresce indefinidamente. Migration que apaga semanas antigas | nova migration | 🟢 | 🔥 |
| 19 | Global | **Proteger/remover `/match/global/setup`** — página de mock sem link; acesso direto sobrescreve dados reais | `App.tsx` + `MatchGlobalSetup.tsx` | 🟡 | 🔥🔥 |
| 20 | Global | **Fallback de polling no realtime** — broadcast é best-effort; manager offline pode perder resultado | `useGlobalLeagueCrowdSync.ts` | 🟡 | 🔥 |

---

## 🧟 TIER 4 — Dead code / órfãos (limpeza ou decisão)

**Confirmados sem caller (seguros de remover):**
- `roundsToTitle()` — `ligaOle/ligaOleModel.ts` (0 imports). ✅
- Quick legado: `MatchQuickLegacy` + helpers (`simulateMatchN`, `simulateLiveRemainder`, `buildAwayQuickRoster`…) em `MatchQuick.tsx` — **desligado pela flag `VITE_QUICK_PLAN_ENABLED`**. Mantido como fallback; decidir se aposenta de vez.

**Sistemas órfãos do modo LIVE 2D (`test2d`) — fora dos 3 modos, mas são dívida (⚠️ a confirmar uso futuro):**
- `src/offBallAI/*` (bendingRuns, visionCone, separationForce, passSafety, interceptionPredictor, supportSpots, scanToken) — ~400 LOC, 0 imports externos. IA posicional construída e nunca plugada no `PlayerDecisionEngine`/`TacticalSimLoop`.
- `src/agents/matchLearningIntegration.ts` → `applyMatchLearningToPlayers` — 0 callers (agentes não evoluem entre partidas).
- `src/match/cycleCoachBridge.ts` → `installCycleCoachBridge` — 0 callers (Coach não comanda em tempo real).
- Tipos/utils sem consumidor: `interactions/contest.ts`, `voiceCommand/llmInterpret.ts`, `match/narrativeKeyMomentClient.ts`, `match/possessionMetrics.ts`, `match/replaySystem.ts`.

> **Decisão do fundador necessária:** off-ball AI + match-learning + coach bridge são "Sprint futuro" ou lixo? Se futuro, documentar; se não, arquivar. São pontes potentes pro modo ao vivo 2D (não pros 3 modos deste plano).

---

## 📌 Notas de bugs/inconsistências por modo (referência)

**Liga Global**
- ✅ Reset não zera `playoff*` (Tier 1 #1).
- ⚠️ Tiebreaker de playoff cai em nome alfabético (sem gol-fora/seeding) — empate raro mas não-determinístico.
- ⚠️ `availablePlayerCount` sincronizado e nunca exibido (causa do WO invisível).

**Partida Rápida**
- ✅ Formação inicial ignorada no 1º tempo.
- ✅ MVP só goleador / `assists:0` hardcoded.
- ✅ Posse = média de momento (não real).
- ✅ Fadiga estática no Python.
- (Furo do minuto 0/1: **FALSO**, descartado.)

**Liga Ole**
- ✅ Seed `Date.now()` na clássica.
- ⚠️ Aposta/seed perdidos se recarregar entre `START_LIGA_OLE_MATCH` e a partida (persistência transitória) — a confirmar.
- ⚠️ Empate→pênaltis implementado mas sem teste e2e dedicado (vale um `test:liga-ole` cobrindo shootout).

---

## 🏁 Ordem sugerida de execução
1. **Lote A (1 sessão):** Tier 1 inteiro (#1–#7) — correções de integridade + visibilidade, tudo 🟢/🟡 baixo risco, alto retorno.
2. **Lote B (1 sessão):** Quick profundo — #8 fadiga dinâmica + #9 MVP + #11 atributos visíveis (mexe no Python; rodar `test:quick-*` + `diff` das cópias `.py`).
3. **Lote C (1 sessão):** Global visibilidade (#12 rivalidade, #13 coroa do dia) + Liga Ole resiliência (#16/#17/#18).
4. **Lote D:** Estrutura — #15 (de-duplicar Python) + decisão sobre órfãos do Tier 4.

Cada lote: branch própria, `npm run lint` + self-tests do modo + build, e deploy só com validação visual do fundador.
