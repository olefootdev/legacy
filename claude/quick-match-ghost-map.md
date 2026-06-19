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
