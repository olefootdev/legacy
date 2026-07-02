# 🎭 Olefoot × Fable — Design Brief: Escolha, Consequência e Personalidade
**Gerado em:** 2026-07-02
**Base:** varredura real do código (quickTacticalLive, quickInteractiveMoments, quickBeatDirector, momentum, storyMotor, contextFactors, rivalryEncounters, engagementScore, AgentProfileFactory, SpiritContext)
**Nota honesta:** pulei a pesquisa web de Football Manager desta skill — o eixo pedido é a filosofia Fable, que está coberta por conhecimento direto da franquia. FM entra só como contraponto pontual.

---

## 🧭 A tese

Fable nunca foi sobre gráficos ou combate — foi sobre **três promessas**:

1. **Toda escolha deixa marca visível** (halo/chifres, cicatrizes, o vilarejo que você salvou ou vendeu).
2. **O mundo lembra de você** (renome: NPCs aplaudem, vaiam, fogem — antes de você fazer qualquer coisa).
3. **NPCs têm opinião, não script** (cada aldeão tem um medidor de afeto que suas ações movem).

O Olefoot já tem a infraestrutura invisível pra isso: seeds determinísticos, `agentProfile` com 5 sub-perfis, `rivalryEncounters`, `contextFactors` com derby/importância, momentum com decay físico. **O que falta não é motor — é MEMÓRIA e ROSTO.** O jogo simula consequências e depois as esquece a cada partida.

> Fable-para-futebol em uma frase: *o clube é o herói; a temporada é a quest; a torcida é o vilarejo.*

---

## ⚽ AS 3 MECÂNICAS FABLE TRADUZIDAS

### MECÂNICA 1 — Alinhamento Visível → **DNA Tático do Clube** (halo/chifres do futebol)

Em Fable, você não "tem 73 de maldade" — você **vê chifres crescendo**. No Olefoot, cada escolha no dock de 5 estilos, cada decision moment e cada analyst beat já é registrada com peso (`QuickPlanDecision`, `BeatVerdict`). Hoje esse histórico morre no pós-jogo.

**Tradução:** um eixo persistente **Romântico ↔ Pragmático** (–100 a +100) alimentado pelas escolhas reais:

- Escolher `attack`/`possession` no dock, aceitar o contra-ataque arriscado, recusar cera → empurra pro Romântico.
- `defend`/`counter`, segurar resultado, escolha de beat conservadora → Pragmático.
- **Marca visível:** aura no escudo (dourada/aço), linha do narrador na entrada em campo ("O time que nunca recua entra no gramado"), e viés real nos agentes: `RiskProfile.aggressionBias` e o `riskTaking` do `pickAction()` (que já aceita ±0.10 de bias) recebem ±0.05 do DNA do clube.

O ponto Fable: **não existe lado certo.** Romântico gera mais gols e mais gols sofridos; Pragmático vence feio e a torcida canta menos (crowdSupport −2%). Igual halo/chifres: identidade, não score.

```ts
// src/game/clubDna.ts — NOVO (persiste em OlefootGameState)
export interface ClubDnaState {
  axis: number;          // -100 (pragmático) .. +100 (romântico)
  lastShift: number;     // último delta, pra animar a UI
  matchesSampled: number;
}

const STYLE_DNA: Record<QuickLiveStyle, number> = {
  attack: +4, press: +3, possession: +2, counter: -2, defend: -4,
};

export function applyMatchToDna(
  dna: ClubDnaState,
  styleChoices: QuickLiveStyle[],
  decisions: { riskTier: 'bold' | 'safe' | 'neutral' }[],
): ClubDnaState {
  let delta = styleChoices.reduce((s, c) => s + (STYLE_DNA[c] ?? 0), 0);
  delta += decisions.reduce((s, d) =>
    s + (d.riskTier === 'bold' ? 3 : d.riskTier === 'safe' ? -3 : 0), 0);
  // Inércia: DNA muda devagar, como a moralidade de Fable (cap ±8 por partida)
  const capped = Math.max(-8, Math.min(8, delta));
  return {
    axis: Math.max(-100, Math.min(100, dna.axis + capped)),
    lastShift: capped,
    matchesSampled: dna.matchesSampled + 1,
  };
}

// Viés nos agentes (plugar onde pickAction lê o riskTaking do legend):
export function dnaRiskBias(axis: number): number {
  return (axis / 100) * 0.05; // -0.05..+0.05, soma ao shot bias existente
}
```

**Onde integrar:** `PLAY_QUICK_MATCH_FINISH` no [reducer.ts](src/game/reducer.ts) já agrega estilo + decisões; chamar `applyMatchToDna` ali. UI: badge no header do clube (Home + pré-jogo), 1 componente.

---

### MECÂNICA 2 — Renome → **Reputação do Clube com Títulos Públicos**

Em Fable, renome é separado de moralidade: é **o quanto o mundo te conhece**. Aldeões reagem antes de você agir. No Olefoot, o `engagementScore` já mede presença (0–100 → +20 OVR), mas é privado e utilitário. Renome é a versão **pública e narrativa** disso.

**Tradução:** `clubRenown` (0–1000, nunca decai — fama não se perde, como em Fable) alimentado por feitos, não por login:

| Feito | Renome | Fonte no código (já existe) |
|---|---|---|
| Vitória Liga Global | +5 | `applyResultToLeagueSeason` |
| Coroação do dia | +25 | `attemptClaim()` / CoronationModal |
| Campeão de divisão | +100 | reset sazonal da pirâmide |
| Avançar fase Liga Ole | +30/fase | `FINALIZE_QUICK_PLAN` |
| Comprar Legacy no mercado | +50 | fluxo buy-legacy server-side |
| Comeback (perdendo→vitória) | +15 | challenge `comeback` já detecta |

**Faixas = títulos** (o "Herói de Oakvale" do futebol): `0` Clube de Bairro → `150` Nome do Distrito → `400` Força Nacional → `700` Gigante Continental → `1000` Lenda Viva. O título aparece **em todo lugar que o nome do clube aparece** (Inter, nunca Moret — regra de tipografia do projeto), e o mundo reage:

- `crowdSupport` em `contextFactors.ts` ganha fator de renome: estádio rival lota pra te ver (+3% intensidade contra você — fama tem preço, muito Fable).
- Narrador muda de registro por faixa: "o modesto ___" vs "o temido ___" — 1 chave nova no `narrativeTemplates.ts`.
- No matchmaking visual da Liga Ole/Global, o card do adversário mostra o título dele → rivalidade instantânea legível.

```ts
// src/systems/renown.ts — NOVO
export const RENOWN_TIERS = [
  { min: 0,    title: 'Clube de Bairro' },
  { min: 150,  title: 'Nome do Distrito' },
  { min: 400,  title: 'Força Nacional' },
  { min: 700,  title: 'Gigante Continental' },
  { min: 1000, title: 'Lenda Viva' },
] as const;

export function renownTitle(renown: number): string {
  return [...RENOWN_TIERS].reverse().find(t => renown >= t.min)!.title;
}

// Plug em applyContextModifiers(): fama atrai pressão
export function renownCrowdFactor(myRenown: number, oppRenown: number): number {
  const gap = (myRenown - oppRenown) / 1000;      // -1..1
  return 1 + Math.max(0, gap) * 0.03;              // até +3% de caldeirão contra o famoso
}
```

**Onde integrar:** ledger no reducer (mesmo padrão do `updateChallengeProgress`), fator novo no `MatchContextModifiers.breakdown` (já é auditável por design).

---

### MECÂNICA 3 — Cicatrizes → **Memória Permanente: cicatrizes de jogador + nêmesis de clube**

Em Fable, dano grave vira cicatriz permanente — seu corpo é o diário da aventura. No Olefoot, o momento existe (pênalti perdido na decisão, gol aos 90', expulsão) e o `CriticalProfile` (compostura sob pressão) existe — mas nada conecta os dois.

**Tradução em duas camadas:**

**3a. Cicatriz de jogador.** Momentos extremos gravam uma marca no jogador (máx. 2 por jogador, a mais nova substitui):

- *"Pênalti perdido na final"* → `CriticalProfile.composure` −8 em shootouts **até ele converter um** → aí a cicatriz vira **medalha** ("redenção", +5 permanente). Arco narrativo automático, zero conteúdo manual.
- *"Gol de placa aos 90'"* → `clutch` +5, narrador cita ("o herói do minuto 90 pede a bola").
- O narrador referencia a cicatriz quando o contexto repete — `enrichNarrative()` já recebe feed recente; passa a receber `scars` também.

**3b. Nêmesis de clube.** `rivalryEncounters: Record<teamId, count>` **já existe e já conta**. Falta acender:

- 3+ confrontos → fixture ganha `isDerby = true` → `derbyIntensity 1.15×` do `contextFactors.ts` acende sozinho. **Essa é a ponte de 1 linha com mais retorno do relatório inteiro.**
- Placar agregado do confronto vira linha de pré-jogo ("Terceira vez. Ele venceu as duas.") e beat extra de pressão no `storyMotor`.

```ts
// src/systems/scars.ts — NOVO
export type ScarKind = 'penalty_miss_final' | 'clutch_goal_90' | 'red_card_derby' | 'redemption';

export interface PlayerScar {
  kind: ScarKind;
  matchLabel: string;   // "Final Liga Ole — 2026-07-02"
  healed: boolean;      // cicatriz virou medalha?
}

export function scarComposureDelta(scars: PlayerScar[]): number {
  return scars.reduce((s, sc) => {
    if (sc.kind === 'penalty_miss_final' && !sc.healed) return s - 8;
    if (sc.kind === 'clutch_goal_90') return s + 5;
    if (sc.kind === 'redemption') return s + 5;
    return s;
  }, 0);
}

// Regra de cura: no shootout, se o marcado converte → healed=true + push scar 'redemption'
```

**Onde integrar:** detecção no `PenaltyShootout` (resultado por batedor já existe) e no evento de gol 85'+; delta aplicado onde `CriticalProfile` é lido no `pickAction()`/resolução de pênalti.

---

## 🎮 PROPOSTAS POR MODO

### Partida Rápida — "o mundo reage em 2 eventos"

O contrato Fable aqui: **aperto o botão → o mundo responde na minha frente.** O motor já faz isso mecanicamente (`resolveStyleOnEvent` flipa eventos, `styleMomentumBias` dobra a curva). O que falta é o motor **confessar** que reagiu:

1. **Eco do agente (a "roda de expressões" invertida).** Em Fable você faz uma expressão e o NPC reage. Aqui, o manager escolhe o estilo e **um agente específico reage no feed em ≤2 eventos**, coerente com seu `agentProfile`: escolheu `press` e o volante tem `RiskProfile` agressivo → *"Fulano abraça a pressão e acelera o time"*; o mesmo comando com um camisa 10 de confiança baixa → *"Beltrano torce o nariz pro sacrifício"*. Custo: ~10 templates novos em `narrativeTemplates.ts` chaveados por `(estilo, arquétipo)`, disparados junto do `styleMomentumBias` que já roda. **Interface não muda** — é 1 linha no feed que já existe. Profundidade sem UI nova.

2. **Consequência dupla explícita.** Quando `resolveStyleOnEvent` flipa um evento (near-miss → gol, ou blindagem de ameaça), o beat de narração cinética ganha um selo curto: **"SUA LEITURA"** (acertou) / **"O PREÇO"** (estilo errado deixou passar). Fable nunca escondeu a consequência — mostrava os chifres. Hoje o flip é invisível e o jogador não sabe que *ele* causou o gol. O dado já existe (`BeatVerdict.kind`), só não é exibido ao vivo.

3. **DNA no pós-jogo.** O card de pós-jogo ganha 1 linha: *"Seu clube ficou +4 Romântico hoje"* com a micro-barra do eixo. Fecha o loop escolha → marca visível na mesma sessão de 2,5 min.

### Liga Ole — rivais com rosto (NPCs de Fable)

O mata-mata tem 32 times de managers **reais** — melhor que NPC: são pessoas. Mas na tela são só nomes. Fable resolve isso dando a cada NPC opinião + fala + memória:

1. **Persona de treinador (procedural, determinística).** Cada adversário ganha 1 de 6 arquétipos derivados por seed do `teamId` + estatísticas reais do time dele (DNA do clube dele, se tiver; senão histórico W/D/L): **O Provocador, O Professor, O Retranqueiro, O Romântico, O Matador, O Imprevisível.** A persona fala 1 linha no pré-jogo e 1 no pós-jogo — respeitando a regra existente do analista (**≤5 palavras**): Provocador derrotado: *"Sorte. Volto ano que vem."* Professor vitorioso: *"O plano funcionou perfeitamente."* Custo: 6 arquétipos × 4 situações (venceu/perdeu/eliminou você/foi eliminado) = 24 linhas + 1 função de seed.

2. **Nêmesis acende o derby (ponte de 1 linha).** `rivalryEncounters ≥ 3` → `isDerby = true` no fixture → todo o maquinário de `derbyIntensity` já existente liga sozinho. O confronto fica objetivamente mais quente e o jogo **diz o porquê**.

3. **Crônica da edição.** Cada Liga Ole escreve 3–4 itens de inbox automáticos por fase, minerados do que o motor já produz: a zebra da rodada (maior gap de OVR vencido), a vingança (reencontro de `rivalryEncounters`), o carrasco (quem te eliminou — vira nêmesis marcado pra próxima edição). É a "história sendo escrita a cada rodada" pedida — sem autor humano, só lendo o ledger.

### Liga Global — o reino de Fable 3

Na Liga Global o jogador é o monarca de Fable 3: decisões públicas, status público, um reino que responde:

1. **Renome + títulos** (Mecânica 2) como camada pública sobre o `engagementScore` privado. O buff +OVR responde "estou forte?"; o título responde **"quem eu sou nesse mundo?"** — e aparece pro rival, o que é o ponto: reputação só existe se os outros veem.

2. **Decreto da Semana (a decisão de reinado).** 1 dilema binário por semana, votado por todos os managers, resultado aplicado à temporada seguinte via `MatchContextModifiers` (que já é multiplicativo e auditável): *"Temporada do Espetáculo (+10% intensidade de derby, prêmios pra artilheiro) ou Temporada de Ferro (+cap do buff de engajamento, prêmios pra defesa menos vazada)?"* Custo baixo (1 tabela Supabase + 1 fator), efeito Fable máximo: **o mundo de todos muda porque a comunidade escolheu** — e quem votou vencido sente a consequência, que é exatamente a fantasia de Fable.

3. **Mercado move status na hora.** Comprar um Legacy já é evento econômico; vira evento **social**: +50 de renome, item de inbox global na divisão (*"[Clube] contratou [Lenda]"*), e o narrador cita a contratação na primeira partida seguinte. A ação de mercado passa a mudar como o mundo te trata — requisito literal do pedido.

---

## 🚦 Prioridade e esforço

| # | Proposta | Impacto | Esforço | Por quê primeiro |
|---|---|---|---|---|
| 1 | Nêmesis → `isDerby` (Liga Ole) | Alto | **~1 linha + UI de aviso** | Maquinário 100% pronto, só plugar |
| 2 | Selo "SUA LEITURA"/"O PREÇO" (Quick) | Alto | Baixo | Dado já existe (`BeatVerdict`), só exibir ao vivo |
| 3 | Eco do agente (Quick) | Alto | Baixo | ~10 templates + 1 dispatch no feed existente |
| 4 | DNA Tático do Clube | Alto | Médio | Novo estado + badge, mas alimenta 1 e 3 |
| 5 | Renome + títulos (Global) | Alto | Médio | Ledger simples, UI em pontos que já existem |
| 6 | Persona de treinador (Liga Ole) | Médio | Baixo | 24 linhas de texto + seed |
| 7 | Cicatrizes + redenção | Médio | Médio | Detecção em 2 pontos + delta no CriticalProfile |
| 8 | Crônica da edição (Liga Ole) | Médio | Médio | Minerador de ledger → inbox |
| 9 | Decreto da Semana (Global) | Alto | Alto | Precisa de Supabase + ciclo sazonal; fazer por último |

## 📋 Checklist de implementação

- [ ] `rivalryEncounters ≥ 3 → isDerby` — [contextFactors.ts](src/match/contextFactors.ts) + fixture load
- [ ] Selo de consequência ao vivo — narração cinética / `resolveStyleOnEvent` em [quickTacticalLive.ts](src/match/quickTacticalLive.ts)
- [ ] Eco do agente — `narrativeTemplates.ts` + dispatch pós-escolha de estilo
- [ ] `src/game/clubDna.ts` novo + hook em `PLAY_QUICK_MATCH_FINISH` + badge
- [ ] `src/systems/renown.ts` novo + fator em `applyContextModifiers` + título na UI
- [ ] Persona de treinador — seed por `teamId` + 24 falas ≤5 palavras
- [ ] `src/systems/scars.ts` novo + detecção no shootout e gol 85'+
- [ ] Crônica da edição — gerador de inbox por fase da Liga Ole
- [ ] Decreto da Semana — tabela Supabase + votação + fator sazonal

## 💡 O jogo atemporal

O norte do pedido — interface vertical simples, agentes soberanos, jogadores reais + criados + IA — é exatamente onde Fable envelheceu bem: ninguém lembra do combate de Fable, todos lembram **de quem eles foram** naquele mundo. Nenhuma das 9 propostas adiciona uma tela nova; todas adicionam **memória e rosto** a superfícies que já existem (feed, inbox, card de time, pós-jogo). A profundidade fica nos agentes (DNA → bias no `pickAction`, cicatriz → `CriticalProfile`), e a interface continua sendo uma linha de texto na vertical. É isso que faz um jogo durar: o motor pode ser trocado; a identidade que o jogador construiu, não.
