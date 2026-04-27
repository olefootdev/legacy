# 🔍 Olefoot — Relatório de Análise e Melhorias

**Gerado em:** 2026-04-24
**Branch analisada:** `cursor/match-sim-admin-gamespirit-positions`
**Arquivos-chave analisados:**
- `src/gamespirit/GameSpirit.ts` (motor por minuto)
- `src/gamespirit/spiritStateMachine.ts` (RNG ponderado)
- `src/engine/runMatchMinute.ts` (loop minuto)
- `src/match/causal/matchCausalTypes.ts` (taxonomia de eventos)
- `src/match/playerInMatch.ts` (atributos)
- `src/tactics/playingStyle.ts` (estilo tático)
- `src/engine/test2d/teamShape.ts` (forma de time)
- `src/pages/MatchQuick.tsx`, `src/pages/MatchAuto.tsx`

---

## 📊 Diagnóstico do Código Atual

### Funções centrais encontradas

| Função | Arquivo | O que faz | Avaliação |
|---|---|---|---|
| `gameSpiritTick()` | `GameSpirit.ts:404` | Resolve 1 minuto: ação → resultado → narrativa | ✅ Estrutura sólida, mas RNG raso |
| `pickAction()` | `GameSpirit.ts:76` | Escolhe entre `shot/progress/recycle/press/clear` | ⚠️ Limiares fixos (`Math.random() > 0.52 - shotBias`) |
| `rollHomeShotLogicalOutcome()` | `spiritStateMachine.ts:114` | Sample ponderado de `goal/save/post/wide/...` | ✅ Bem feito |
| `rollTackleOutcome()` | `spiritStateMachine.ts:145` | clean/foul_soft/foul_hard/miss | ⚠️ Defensor não tem stat aplicada (`marcacao` ignorada) |
| `runMatchMinute()` | `runMatchMinute.ts:136` | Empacota tick + fadiga + lesão + cartão | ✅ |
| `deriveTeamIntention()` | `teamShape.ts:51` | 9 intenções de time → modificadores de forma | ✅ Bom design |
| `requestGameSpiritDecision()` | `gameSpiritDecisionClient.ts:30` | OpenAI opcional p/ narrativa | ✅ Feature-flagged, fora do hot loop |

### Atributos de jogador (`MatchPlayerAttributes` em `playerInMatch.ts:24`)

`passeCurto, passeLongo, cruzamento, marcacao, velocidade, fairPlay, drible, finalizacao, fisico, tatico, mentalidade, confianca` — **12 atributos 0-100**.

### Gaps identificados

**Atributos definidos mas pouco/nada usados no engine:**
- `drible` — só entra como média de time, nunca por jogador num drible
- `cruzamento` — não amostrado em nenhuma ação
- `marcacao` — não modula `rollTackleOutcome` (só `fairPlay` e mentalidade de time)
- `confianca` — armazenado, nunca lido em decisões
- `velocidade` — não influencia interceptação ou fuga
- `passeCurto`/`passeLongo` — perda de passe usa só `errorTax` aditivo

**Eventos do futebol real ausentes ou só narrativos:**
- ❌ `dribble_attempt` / `dribble_success` (referenciado em narração apenas)
- ❌ `pass_attempt` discreto (passes são implícitos no movimento da bola)
- ❌ `interception` como evento (citado em texto, sem tipo)
- ❌ `corner_kick`, `throw_in`, `offside` (sem evento discreto)
- ❌ `substitution` como evento de partida (estado mantido, mas não emitido)

**Patterns ingênuos:**
- `Math.random() > 0.52 - shotBias` (`GameSpirit.ts:100`) — pivot único 0.52 pra todo contexto
- `Math.random() < 0.45` em chance de falta — não considera atributo do faltador
- Time visitante: ações amostradas com `pos: random()` do roster (`GameSpirit.ts:737-913`) — sem consideração per-jogador
- Erro do GK: 1.2-7% só com `gkSkill01`, sem fadiga nem pressão de jogo

---

## ⚽ Comparação com Futebol Real

Médias por **partida** (somando os 2 times) em ligas top-tier:

| Evento | Real (média) | Olefoot atualmente |
|---|---|---|
| Passes | ~900-1000 | implícitos, não contados |
| Finalizações | ~24-26 | gerados via `shot_attempt` ✅ |
| Chutes a gol | ~8-10 | derivado do shot outcome ✅ |
| Faltas | ~20-24 | gerados via tackle ✅ |
| Dribles tentados | ~30-35 | apenas narrativa ❌ |
| Interceptações | ~30 | apenas narrativa ❌ |
| Escanteios | ~10 | ❌ ausente |
| Laterais | ~40 | ❌ ausente |
| Impedimentos | ~4-5 | ❌ ausente |
| Cartões amarelos | ~3-4 | gerados ✅ |
| Substituições | até 10 (5 por time) | estado, sem evento ❌ |

> Fontes: WhoScored.com, FBref, Wyscout glossary — médias agregadas Premier League/LaLiga 2023-25.

**Veredito:** O motor cobre bem o eixo "ação→tiro→gol" e disciplina. Falta volume de eventos secundários (dribles, interceptações, set pieces) que dão **textura realista** à partida sem complicar a UI.

---

## 🎮 O que Football Manager faz (e como simplificar)

Pontos extraídos de [Passion4FM](https://www.passion4fm.com/football-manager-player-attributes/), [FM-Arena ME thread](https://fm-arena.com/thread/16007-understanding-the-match-engine-are-meta-tactics-and-meta-attributes-the-cause-or-consequence-of-imbalances/), e [FM Scout](https://www.fmscout.com/a-player-attributes-guide-2022.html):

**FM faz:**
1. **Decisões a cada 0.25s** baseadas em atributos × posição × instrução tática × clima/moral.
2. **~50 atributos por jogador** (3 categorias: técnico, mental, físico) — cada um pesa diferente por **role**.
3. **Atributos pesados por posição**: ex. `Decisões` e `Antecipação` valem o dobro pra zagueiro central.
4. **Tudo escondido**: jogador vê o jogo, não as probabilidades.

**Como o Olefoot pode adaptar (e até melhorar):**
- Manter **12 atributos** (já é simplificação ótima vs 50 do FM), mas garantir que **todos sejam usados**.
- Aplicar **pesos por posição** (zagueiro: marcacao×2, atacante: finalizacao×2) em vez de média plana.
- **Inverter a opacidade do FM**: Olefoot pode mostrar a probabilidade do tiro pré-resolução (FM esconde, jogadores reclamam disso há 15 anos).
- **Decisões a cada minuto** já é certo — não tente subir frequência, isso explode complexidade sem ganho perceptível.

---

## 🚀 Melhorias Propostas

### MELHORIA 1 — Usar atributos do defensor em `rollTackleOutcome`

**Prioridade:** Alta · **Impacto:** Defensores bons defendem · **Complexidade:** Simples

**Problema:** `marcacao` e `velocidade` do defensor não entram no roll de desarme — só `fairPlay` (que reduz hard fouls) e `mentality` do time.

**Onde:** `src/gamespirit/spiritStateMachine.ts:145` (`rollTackleOutcome`).

```ts
export interface TackleRollInput {
  mentality?: number;
  fairPlay?: number;
  defenderMarcacao?: number;   // NOVO: 0-100
  defenderVelocidade?: number; // NOVO: 0-100
  attackerDrible?: number;     // NOVO: 0-100
}

export function rollTackleOutcome(input: TackleRollInput = {}): TackleOutcome {
  const m = clamp01((input.mentality ?? 50) / 100);
  const fp = clamp01((input.fairPlay ?? 60) / 100);
  const skill = clamp01(((input.defenderMarcacao ?? 50) + (input.defenderVelocidade ?? 50)) / 200);
  const dribble = clamp01((input.attackerDrible ?? 50) / 100);

  // Vantagem líquida: desarme - drible
  const edge = skill - dribble; // -1 a +1

  let clean = 0.46 + edge * 0.20 + (m - 0.5) * 0.06;
  let miss = 0.25 - edge * 0.15;
  let foulSoft = 0.19 + (1 - fp) * 0.06;
  let foulHard = 0.10 + (1 - fp) * 0.08 - skill * 0.04;

  // Renormaliza
  const sum = clean + miss + foulSoft + foulHard;
  return pickByWeights([
    ['clean', clean / sum],
    ['miss', miss / sum],
    ['foul_soft', foulSoft / sum],
    ['foul_hard', foulHard / sum],
  ]);
}
```

**Como integrar:** Em `GameSpirit.ts` no branch `press` (linha ~744-813), passar `defender.attributes.marcacao`, `defender.attributes.velocidade`, e `ballCarrier.attributes.drible` para `rollTackleOutcome`.

---

### MELHORIA 2 — Eventos discretos de drible e interceptação

**Prioridade:** Alta · **Impacto:** Estatísticas pós-jogo realistas · **Complexidade:** Média

**Problema:** Drible e interceptação só existem como narração. Postgame mostra "0 dribles" mesmo que 30 tenham sido narrados.

**Onde:** `src/match/causal/matchCausalTypes.ts:14`, adicionar tipos:

```ts
export type CausalMatchEvent =
  | { kind: 'shot_attempt'; /* ... */ }
  // ... existentes
  | { kind: 'dribble_attempt'; minute: number; carrierId: string; defenderId: string; success: boolean }
  | { kind: 'interception'; minute: number; defenderId: string; zone: 'def' | 'mid' | 'att' }
  | { kind: 'corner_kick'; minute: number; side: 'home' | 'away' }
  | { kind: 'throw_in'; minute: number; side: 'home' | 'away'; zone: 'def' | 'mid' | 'att' };
```

E na função de roll de progresso (`GameSpirit.ts:694`):

```ts
function rollProgressOutcome(
  carrierDrible: number,
  defenderMarcacao: number,
  pressTrigger: number
): { kind: 'progress' | 'dribble_success' | 'intercepted' | 'pass_loss' } {
  const skillEdge = (carrierDrible - defenderMarcacao) / 100;
  const r = Math.random();

  if (pressTrigger > 0.6 && r < 0.18 - skillEdge * 0.10) return { kind: 'intercepted' };
  if (r < 0.35 + skillEdge * 0.15) return { kind: 'dribble_success' };
  if (r < 0.45 + skillEdge * 0.10) return { kind: 'progress' };
  return { kind: 'pass_loss' };
}
```

**Como integrar:** Substituir o cálculo atual de `progress` na ação `progress`. Cada outcome empurra um evento causal apropriado, alimentando o painel de estatísticas pós-jogo.

---

### MELHORIA 3 — Set pieces simplificados (escanteio, lateral)

**Prioridade:** Média · **Impacto:** Variedade tática + 1-2 gols extras por temporada · **Complexidade:** Média

**Problema:** Não existem escanteios. Jogo sai do "tiro defletido" direto pro próximo lance.

**Como:** Em `shot_result` com outcome `block` ou `wide` (em `GameSpirit.ts:570-690`), 35% dos casos viram escanteio:

```ts
// Após shot_result com outcome 'block' ou 'wide':
if ((outcome === 'block' || outcome === 'wide') && Math.random() < 0.35) {
  pushEvent({ kind: 'corner_kick', minute, side: attackingSide });
  // Próximo tick é forçado: ação = 'shot' com bias de cabeçada
  ctx.nextActionHint = { kind: 'set_piece_corner', side: attackingSide };
}
```

E no `pickAction`:

```ts
if (ctx.nextActionHint?.kind === 'set_piece_corner') {
  ctx.nextActionHint = undefined; // consome hint
  return 'shot'; // resolve cabeçada via shotProfile = 'header'
}
```

Adicionar `'header'` ao `strikeProfile` em `shot_attempt` e ajustar pesos em `adjustHomeShotWeights` (cabeçada: +20% goal weight se atacante alto/`fisico` > 70).

---

### MELHORIA 4 — Pesos de atributo por posição

**Prioridade:** Média · **Impacto:** Posicionamento importa de verdade · **Complexidade:** Simples

**Problema:** `legacyAttack01 = avg(attributes) / 100` trata todos atributos como iguais. Um atacante com `marcacao` 95 e `finalizacao` 30 fica = atacante com inverso.

**Onde:** `src/match/playerInMatch.ts` ou novo `src/match/positionWeights.ts`:

```ts
export const POSITION_ATTR_WEIGHTS: Record<Role, Partial<Record<keyof MatchPlayerAttributes, number>>> = {
  gk:     { marcacao: 1.5, mentalidade: 1.5, fisico: 1.0, confianca: 1.2 },
  def:    { marcacao: 2.0, fisico: 1.5, velocidade: 1.2, tatico: 1.3, fairPlay: 1.0 },
  mid:    { passeCurto: 1.8, passeLongo: 1.5, tatico: 1.5, mentalidade: 1.2, drible: 1.0 },
  attack: { finalizacao: 2.0, drible: 1.5, velocidade: 1.5, mentalidade: 1.3, cruzamento: 1.0 },
};

export function weightedOverall(attrs: MatchPlayerAttributes, role: Role): number {
  const weights = POSITION_ATTR_WEIGHTS[role];
  let sum = 0, totalW = 0;
  for (const [k, w] of Object.entries(weights)) {
    sum += (attrs[k as keyof MatchPlayerAttributes] ?? 50) * w;
    totalW += w;
  }
  return totalW > 0 ? sum / totalW : 50;
}
```

**Como integrar:** Substituir todas chamadas de "média de atributos" no `GameSpirit.ts` (linhas 510, 514, 600) por `weightedOverall(player.attributes, player.role)`.

---

### MELHORIA 5 — Momentum de partida (3-5 min)

**Prioridade:** Média · **Impacto:** Sensação de "fase boa/ruim" · **Complexidade:** Simples

**Problema:** Cada minuto é independente. Futebol tem **fases** (5-10 min de pressão).

**Como:** Adicionar `momentum: { home: number; away: number }` ao `SpiritContext` (-1 a +1):

```ts
// src/gamespirit/momentum.ts
export function updateMomentum(prev: number, lastEvent: CausalMatchEvent): number {
  const decay = prev * 0.92; // decai naturalmente
  let delta = 0;
  if (lastEvent.kind === 'shot_result' && lastEvent.outcome === 'goal') delta = +0.4;
  else if (lastEvent.kind === 'shot_attempt') delta = +0.08;
  else if (lastEvent.kind === 'possession_change') delta = -0.05;
  else if (lastEvent.kind === 'card_shown' && lastEvent.color === 'red') delta = -0.5;
  return Math.max(-1, Math.min(1, decay + delta));
}
```

**Como integrar:** No `pickAction`, adicionar `+ momentum * 0.10` ao `shotBias`. Time em momentum positivo arrisca mais. Mostrar barra de momentum na UI durante MatchQuick — **isto é a inovação que FM não tem visualmente**.

---

### MELHORIA 6 — Fadiga modula erro do goleiro e passes

**Prioridade:** Baixa · **Impacto:** Final de jogo mais dramático · **Complexidade:** Trivial

**Onde:** `spiritStateMachine.ts` (rolls de GK e perda de passe):

```ts
// gkErrorRate atual: (100 - gkSkill) / 100 * 0.07
// Novo: amplificar com fadiga > 70
const gkFatigue01 = (gkPlayer.fatigue ?? 0) / 100;
const fatiguePenalty = Math.max(0, gkFatigue01 - 0.7) * 0.5; // 0 a +15%
const gkErrorRate = baseError + fatiguePenalty;
```

Mesma lógica em pass-loss (`GameSpirit.ts:697`): `+ avgFatigue01 * 0.10`.

---

## 📋 Checklist de Implementação

- [ ] **M1**: `marcacao`/`velocidade`/`drible` em `rollTackleOutcome` — `spiritStateMachine.ts:145`
- [ ] **M2**: Eventos `dribble_attempt`/`interception` — `matchCausalTypes.ts:14` + `GameSpirit.ts:694`
- [ ] **M3**: Escanteios + cabeçada — `GameSpirit.ts:570` + novo `set_piece_corner` hint
- [ ] **M4**: `weightedOverall(role)` — novo `src/match/positionWeights.ts`, refatorar `GameSpirit.ts:510,514,600`
- [ ] **M5**: Momentum — novo `src/gamespirit/momentum.ts` + UI bar em `MatchQuick.tsx`
- [ ] **M6**: Fadiga em GK/passe — `spiritStateMachine.ts` (saves) + `GameSpirit.ts:697`

**Ordem sugerida:** M1 → M4 (atributos passam a importar) → M2 (estatísticas pós-jogo) → M5 (UX/feel) → M3 → M6.

---

## 💡 Visão de Longo Prazo

1. **Transparência radical**: barra de probabilidade pré-tiro ("38% gol, 22% defesa, 40% fora") — FM esconde, Olefoot mostra. **Diferencial enorme**.
2. **Eventos narrativos contextuais simples**: "Chuva forte → -10% precisão de passe longo", "Derby → +15% intensidade tackles". 5-6 modificadores chegam num catálogo sem virar planilha.
3. **Confiança individual dinâmica**: `confianca` (já existe!) sobe com gol, cai com erro grave. Atacante com confiança >80 ganha +5% finalização. Mostrável como "🔥" no card.
4. **Rivalidades persistentes**: jogador X marcou 3 gols contra time Y → narrativa pré-jogo + bônus mental. Estado pequeno, drama grande.
5. **Estatísticas heatmap minimalista pós-jogo**: dividir o campo em 6 zonas, mostrar onde cada time concentrou ações. Visual, sem 50 abas como FM.

> **"Simples visualmente, inteligente por baixo"** — o engine atual está mais perto disto do que parece. Fechar os 6 itens acima dobra a fidelidade do match feel sem adicionar UI nova.

---

**Sources:**
- [How Football Manager Match Engine Works](https://www.footballmanagerguru.com/how-football-manager-match-engine-works/)
- [FM Player Attributes Explained — Passion4FM](https://www.passion4fm.com/football-manager-player-attributes/)
- [FM24 Attribute Coefficients per Position — FM-Arena](https://fm-arena.com/thread/14201-fm24-experiment-update-new-match-engines-most-important-attributes-for-each-respecitve-positions-with-their-coefficients/)
- [Football Manager 2019 ME Improvements](https://www.footballmanager.com/news/football-manager-2019-match-engine-improvements)
- [FM Scout Player Attribute Guide](https://www.fmscout.com/a-player-attributes-guide-2022.html)
- [WhoScored.com — Match stats reference](https://www.whoscored.com/)
- [Wyscout Glossary — match-level metrics](https://dataglossary.wyscout.com/metrics/)
