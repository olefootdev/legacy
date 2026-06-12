# Quick Match 2.0 — Trocar Frenesia por Engajamento

> Spec de redesign da Partida Rápida. Data: 2026-06-11.
> Princípio: **nada do zero** — religar e promover estruturas que já existem.

---

## 1. Diagnóstico — por que o modo atual não convence

| Sintoma | Causa raiz no código |
|---|---|
| Feed sem leitura | `QuickMatchFeed` rotaciona pool de 14 eventos a cada 4.2s — micro-eventos ("zagueiro tocou") competem com gols. O manager não tem o que *ler*, só o que *assistir passar*. |
| Sem lógica entre ações do manager e resultado | `quickInteractiveMoments.ts` dispara momentos por `Math.random() < 0.3` por tick e resolve por `successChance` — a decisão não deriva do cenário do jogo nem altera a simulação. É slot machine, não leitura de jogo. |
| Gol sem justificativa | O motor tick-a-tick em `MatchQuick.tsx` resolve gols por probabilidade agregada. O cruzamento setorial (defesa×ataque, meio criativo×meio defensivo) que o `match_simulator.py` já faz **não é o que roda em produção** (flag `VITE_QUICK_PLAN_ENABLED`). |
| Partida longa demais | 45s + 10s + 45s ≈ 100s reais + overlays. Frenesia: muita coisa acontecendo, nada importando. |
| Progressão invisível | Bônus de performance existem (`quickPerformanceBonuses.ts`) mas se diluem; não há nota pela qualidade das decisões do manager. |

**Tese:** o jogo precisa rodar em **dois planos simultâneos**:
- **Plano físico** → barra de MOMENTO (já existe, alimentada pela `momentum_curve` do Python). Lance a lance é AQUI, visual, sem texto.
- **Plano mental** → feed vira o **Analista**: 4 leituras de cenário por partida, cada uma com uma decisão cujo peso é calculado pelo Python. O manager joga COM A CABEÇA.

---

## 2. Arquitetura — promover o Quick Plan Python a motor oficial

```
KICKOFF
  └─ POST /api/match/quick-plan        (já existe — estender)
       Python match_simulator.py:
       ① MATCHUP MATRIX (novo)         ← item 3 do briefing
       ② Simula 1º tempo (eventos só saem de canais com edge)
       ③ momentum_curve + 2 ANALYST BEATS com decisões pesadas
1º TEMPO (25s reais, incl. 2 janelas de decisão de ~4s, clock pausado)
  └─ QuickPlanPlayer renderiza; MomentumBar = momentum_curve
  └─ Beat ~10s e ~20s: card do Analista + decisão (GameSpirit narra)
INTERVALO (15s, skippável)
  └─ 5 cards: 3 melhores em cima, 2 piores embaixo → sub direto
  └─ Mudança de formação/estratégia (presets já existem no AssistantAI)
  └─ "VOLTAR PARA O JOGO" → POST replan:
       { seed, decisionsLedger, halftimeChanges, firstHalfResult }
       Python recalcula APENAS o 2º tempo com pesos aplicados
2º TEMPO (25s, +2 beats/decisões)
PÓS-JOGO
  └─ Placar + MVP + LEITURA DE JOGO (nota 0-4) + progressão consolidada
```

**Orçamento de tempo real (item 12):** 25 + 15 + 25 = 65s pior caso; intervalo skippável → **~55-60s típico**. Cada tempo de 25s JÁ INCLUI as duas janelas de decisão (clock congela durante a janela, respeitando a regra "engine pausa em modais").

**Determinismo viabiliza tudo:** plano do 1º tempo é conhecido no kickoff → narração dos beats pode ser pré-buscada durante o countdown 3-2-1. Replan do 2º tempo acontece nos 15s do intervalo. Latência zero percebida.

---

## 3. Matchup Matrix (novo módulo Python) — item 3

Extensão do `match_simulator.py` (que já calcula força por role). Antes de qualquer gol, computar **canais de confronto**:

```python
channels = {
  "ataque_central":    home.atk_central  vs away.def_central,
  "corredor_esquerdo": home.flank_left   vs away.flank_right_def,
  "corredor_direito":  home.flank_right  vs away.flank_left_def,
  "criacao":           home.mid_creative vs away.mid_defensive,
  "finalizacao_vs_gk": home.finishing    vs away.gk,
  "bola_parada":       home.set_piece    vs away.aerial_physical,
  "pressao":           home.press        vs away.press_resistance,
}
# cada canal → edge ∈ [-1, +1] + label legível
```

Atributos-fonte já existem no payload (`finalizacao, passe, marcacao, velocidade, fisico, confianca` por jogador + `pos`). Laterais/pontas identificáveis por `pos` (LD/LE/PD/PE).

**Regra de ouro:** `pick_zone()`/geração de gol só pode escolher canais com `edge > 0` (exceção: "momento de brilho" individual, prob. baixa, gateado por `confianca` alta — pra zebra existir). Cada evento do plano carrega `channel` + `reason`. **Nenhum gol sem justificativa setorial.**

A matrix também é o insumo dos Analyst Beats e do cálculo de peso das decisões.

---

## 4. Analyst Beats — o novo feed (itens 2 e 4)

Matar: rotação de micro-eventos. O feed passa a ter **no máximo ~10 itens por partida**:

1. 4 × **Leitura do Analista** (uma a cada ~10s de jogo corrido)
2. Gols (com canal: "Gol pela esquerda — exatamente onde eles sofriam")
3. Cartão vermelho / lesão (eventos que mudam o jogo)
4. **Veredito das decisões** ("Sua leitura estava certa ✓ — a pressão alta gerou o gol")

### Pipeline de cada beat

```
Python (no plano):
  beat = {
    minute, insight_data: { canal_dominante, canal_sofrendo, momentum_trend },
    choices: [
      { id, label, hidden_weight: +0.18, channel: "corredor_esquerdo" },
      { id, label, hidden_weight: -0.10, channel: "ataque_central" },
      { id, label, hidden_weight: +0.04, channel: "pressao" },
    ]
  }
GameSpirit (narração — template local instantâneo; OpenAI via
narrativeKeyMomentClient como enriquecimento opcional pré-buscado):
  "O Bahia sofre pelas laterais, mas o seu time ainda não invadiu a área.
   O corredor esquerdo está aberto."
UI: card amarelo do catálogo de decision moments + 3 botões inline
    (botões inline no feed JÁ EXISTEM — Fase 2 do Quick Revolution)
```

### Peso real da decisão (item 4 — "LITERALMENTE Python calcula")

- Cada choice mapeia pra um canal da matrix. `hidden_weight` = alinhamento entre a escolha e os edges reais (escolher atacar onde o edge é positivo = peso alto).
- **A resposta certa é inferível do texto do insight** — quem lê o cenário acerta. Skill, não sorte.
- Peso aplicado como multiplicador de xG no canal pelo segmento seguinte: boas escolhas ↑ chance de gol, ruins contam contra (`weight < 0` aumenta xG adversário no canal exposto).
- No 1º tempo os pesos são aplicados localmente no `QuickPlanPlayer` (ajuste de xG dos eventos restantes do plano); no replan do intervalo o Python re-simula o 2º tempo com o ledger completo — a verdade final é sempre do Python.

### Substituir, não somar

`quickInteractiveMoments.ts` (triggers probabilísticos) **sai de cena** no quick novo. Os 4 beats agendados assumem. Pênalti/bola parada continuam como overlays quando o plano os contém (já pausam o engine).

---

## 5. Os 5 cards + intervalo (itens 5 e 7)

### Durante o jogo
Substituir as duas lineups completas por **5 cards** (`QuickPlayerRowCard` já pronto):
- **Top 3** por impact rating ao vivo (já calculado) — em cima
- **Bottom 2** — embaixo, com affordance visual de "candidato a sair"

### Intervalo (15s, `HALFTIME_MS: 10_000 → 15_000`)
- Os 2 piores cards ganham botão **SUBSTITUIR** → abre banco (filtrado por `playerHealth`, exaustos >85 fora — regra SSOT já existe)
- Mudança de formação/estratégia: reusar `handleTacticalChange` + presets (`PRESSAO_ALTA`, `BLOCO_BAIXO`, `JOGO_DIRETO`, `POSSE_CONTROLADA`)
- **"VOLTAR PARA O JOGO"** dispara o replan: o Python recebe ledger de decisões + mudanças e recalcula o 2º tempo de verdade (lineup nova → matchup matrix nova → plano novo). Seed do 2º tempo = `hash(seed + decisionsLedger)` pra manter determinismo/replay.

Backend: estender `matchPlan.ts` com modo `second_half` no body (129 linhas hoje; mudança pequena).

---

## 6. Progressão consolidada no pós-jogo (item 9)

Tudo entregue numa tela só (`QuickMatchSummary` estendido):

| Bloco | Fonte (existente) |
|---|---|
| Placar + resultado emocional | já existe |
| **LEITURA DE JOGO n/4** + veredito por decisão | novo — ledger de decisões vs edges reais |
| MVP + ratings | `mvp_projection` do plano (validar `ScoutMvpEntry` — regra de memória) |
| Bônus de performance (OLE/XP) | `quickPerformanceBonuses.ts` |
| XP de jogadores + fadiga/recovery | `FINALIZE_MATCH` |
| Streak semanal | `quickStreakChallenges.ts` |

**Manager IQ (meta-progressão, item 8):** média móvel das notas de Leitura → atributo persistente do manager. Leitura alta = multiplicador de evolução do time (+% XP da partida). O jogador melhora *jogando com a cabeça*, e o time evolui junto. Isso cria a curva de longo prazo: partidas de 1 minuto, carreira de meses.

---

## 7. Sugestões virais (item 10)

1. **Card compartilhável "Li o jogo"** — imagem: placar + Leitura 4/4 + MVP + canal do gol. (Já pendente do Quick Revolution; agora tem CONTEÚDO pra mostrar — skill, não sorte.)
2. **Desafio por seed — "Mesma partida, sua leitura"** — o determinismo permite: compartilhe um código; o amigo joga EXATAMENTE o mesmo confronto com os mesmos beats e compara notas de Leitura. PvP assíncrono de pura inteligência, custo zero de infra.
3. **Palpite pré-jogo** — painel Monte Carlo já mostra V/E/D; manager crava o placar antes do kickoff. Acertou = bônus + streak de palpites ("Profeta").
4. **Ghost Manager** — replay das decisões de outro manager no mesmo plano: "Fulano leu 2/4 nesse jogo. E você?" Alimenta a Liga Turbo (mini-universos de managers reais).
5. **Zebra Certificada** — Monte Carlo te dava 18% de vitória, você venceu com Leitura 4/4 → badge rara + card especial. Compartilhável por natureza.
6. **Narração do gol da vitória** — GameSpirit gera UMA frase épica personalizada (nome do herói, canal, contexto) pro card de share. Uma chamada de IA por partida, custo controlado.
7. **Ranking semanal de Leitura** — leaderboard de Manager IQ amarrado às Coroas da Liga Global (infra de ranking já existe).

---

## 8. Plano de implementação (em fases, batch)

| Fase | Entrega | Toca em |
|---|---|---|
| **A — Motor** ✅ 2026-06-12 | Matchup matrix (`matchup_matrix.py`) + analyst beats (`analyst_beats.py`) + eventos com `channel/reason` + replan 2º tempo (`mode: second_half`). Gate calibrado: gol em canal neutro é futebol normal; edge muito negativo exige brilho (confiança ≥80). Seed do 2º tempo = `seed\|h2\|fingerprint(decisões)`. Teste: `npm run test:quick-matchup`. | `match_simulator.py`, `matchPlan.ts`, `quickPlanClient.ts`, `quickPlanTypes.ts` |
| **B — Beats** | 4 analyst beats com decisões pesadas; feed novo (≤10 itens); narração template + prefetch GameSpirit | `QuickPlanPlayer.tsx`, `quickMatchFeed.tsx`, `narrativeKeyMomentClient.ts`; aposentar triggers do `quickInteractiveMoments.ts` no quick |
| **C — Tempo & 5 cards** | 25s/15s/25s; top3+bottom2; sub + tática no intervalo; replan no "Voltar" | `MatchQuick.tsx` (constantes + `QuickPlayerRowCard` + `QuickMatchHalftime`) |
| **D — Progressão** | Leitura de Jogo no summary + Manager IQ + multiplicador de evolução | `QuickMatchSummary`, `quickPerformanceBonuses.ts`, reducer `FINALIZE_MATCH` |
| **E — Viral** | Card compartilhável + desafio por seed + palpite | novo, sobre infra existente |

Riscos/decisões:
- **Flag:** promover `VITE_QUICK_PLAN_ENABLED` a default-on no quick novo (fallback pro motor atual se o endpoint falhar — jogo está em produção, cadeia completa antes do push).
- **Custo IA:** narração default é template local determinístico; OpenAI só enriquece beats e o gol da vitória (≤5 chamadas/partida, todas pré-buscáveis).
- **Railway:** `match_simulator.py` precisa estar no deploy do backend (candidates de path já cobrem `/app/...`).
