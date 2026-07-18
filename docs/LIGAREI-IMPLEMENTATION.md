# LIGA REI — Memo de Implementação

**Data:** 2026-06-11 · **Status:** conceito aprovado pelo fundador, plano para implementação
**Rota alvo:** `/liga-rei` (torneio) + roda partidas em `/match/turbo`
**Relação:** irmã da [Liga Turbo](LIGATURBO-IMPLEMENTATION.md). Liga Turbo = pontos corridos (liga).
**Liga Rei = MATA-MATA com TODOS os times reais de TODAS as divisões.** Ambas rodam sobre o mesmo motor Turbo.

> **O torneio do jogo inteiro.** O manager cria uma Liga Rei que puxa TODOS os times reais (todas as
> divisões da Liga Global), chaveia num mata-mata, e sobe a chave jogando SÓ as próprias partidas no
> Modo Turbo (~60–90s cada) — as outras resolvem instantâneas. Vencer é chegar à final batendo os
> monstros da 1ª divisão. Perder é dar de cara com um time forte cedo e querer evoluir o elenco.

---

## 1. Decisões canônicas (herdadas do Turbo + novas do fundador)

Herdadas da [Liga Turbo](LIGATURBO-IMPLEMENTATION.md) — valem igual aqui:
- Estética retrô **dentro** do Legacy Tech (preto `#0D0D0D` + amarelo `#FDE100`; VETADO verde-terminal).
- Motor = GameSpirit + Fantasy v6 via **Quick Plan Pipeline Python** (determinístico por seed).
- **JAMAIS clubes reais licenciáveis** — só times de managers reais (fonte: `global_league_teams`).
- Mini-universo sandbox: elencos são snapshot no momento da criação; eventos rodam só dentro do torneio.

Novas / específicas da Liga Rei:
1. **Puxa TODOS os times, todas as divisões** — diferente da Liga Ole (que limita a 32). O campo é o
   jogo inteiro, chaveado por força/divisão.
2. **Mata-mata** — sem empate: pênaltis decidem (a Liga Ole já faz isso via `resolveAutoMatch`).
3. **Manager joga só as PRÓPRIAS partidas no Turbo**; as demais da rodada resolvem instantâneas
   (Elo determinístico). Isso mantém o modo RÁPIDO e **sem carga no servidor Python** (1 chamada
   por rodada, não N).
4. **"Vai somando os resultados"** — a chave acumula os resultados rodada a rodada e o manager acumula
   prêmio/renome/palmarès por fase superada (escala como a Liga Ole: 50k→1M).
5. **[DECIDIDO 2026-06-11] Prêmio é EXP/OLE REAL, capado** (teto diário/semanal + cooldown). Não é
   palmarès-só — logo a economia É tocada e precisa de balanceamento ANTES de ligar. Ver §7.
6. **[DECIDIDO 2026-06-11] Campo qualificado**, não chave literal — puxa todos mas classifica os
   melhores/ativos pra uma chave limpa (cap 64 no v1). Ver §3.

---

## 2. Análise da Liga Ole — o que reaproveitar (inventário verificado)

A Liga Ole (`src/match/ligaOle/`) é um mata-mata de 32 times **rodando 100% client-side**, puro e
determinístico. **~90% é reaproveitável.** O que trava é só o número fixo em 32.

### ✅ Reusável direto (agnóstico a tamanho)
| Peça | Path | Papel na Liga Rei |
|---|---|---|
| `resolveAutoMatch(a, b, seed)` | `ligaOleModel.ts` | Resolve confrontos do campo por Elo logístico `1/(1+e^-((OVRa-OVRb)/8))` + placar estocástico + pênaltis no empate. **Zero I/O, determinístico.** |
| `rngFor(seed)` / `hashStr()` | `ligaOleModel.ts` | RNG mulberry32 determinístico |
| `seedSlots(n)` | `ligaOleModel.ts` | Ordem canônica de chave pra qualquer `n` potência de 2 |
| `fetchLigaOleRivals({ count, seed })` | `fetchLigaOleTeams.ts` | Já é parametrizável por `count`; query `global_league_teams` |
| `buildRoundChronicle()` | `ligaOleChronicle.ts` | Narrativa de rodada, agnóstica a tamanho |
| `coachPersonaFor()` / `personaLine()` | `coachPersona.ts` | Persona do técnico rival (seed por teamId) |
| `MatchPreviewModal` | via `LigaOlePreviewModal.tsx` | Pré-jogo genérico (gerir/salvar/forecast) |
| Padrão de reducer | `reducer.ts` (`CREATE_LIGA_OLE`, `START_LIGA_OLE_MATCH`, `FINALIZE_QUICK_PLAN`) | Ciclo criar → jogar → avançar |
| Leaderboard semanal (seed global por semana) | `ligaOleWeekly.ts` | Mesmo campo pra todos numa semana → ranking de quem foi mais longe |
| Teste do modelo | `scripts/test-liga-ole.ts` (`npm run test:liga-ole`) | Espelhar pra `test:liga-rei` |

### ✅✅ O achado de ouro: chaveamento genérico JÁ EXISTE
`server/src/services/globalLeague/dailyKnockout.ts` é um motor de mata-mata **100% genérico** (roda hoje
no server, mas a lógica é pura e espelhável client-side):
- `largestPowerOfTwoAtMost(n)` — resolve "N times → chave potência de 2"
- `selectDailyQualifiers(teams, maxSize)` — classifica e corta o campo pro tamanho da chave
- `standardSeedOrder(n)` / `seedFirstRound(ranked)` — seeding 1×N, 2×(N-1)... (fortes em metades opostas)
- `roundNameFromSize(size)` — "Final", "Semifinal", "Oitavas"... dinâmico por tamanho
- `rankDailyTeams(teams)` — ranqueia por pontos/OVR

**É exatamente o que a Liga Rei precisa** pra suportar "todos os times" com número variável. A Liga Ole
não usa isso (tem os hardcodes dela); a Liga Rei deve usar.

### ❌ Hardcodes da Liga Ole a NÃO herdar
`LIGA_OLE_SIZE = 32`, `LIGA_OLE_ROUNDS = ['Fase de 32'...]` (5 fases fixas), validação `teams.length !== 32`,
check de final `r >= ROUNDS.length - 1`, labels de fase fixos, `LIGA_OLE_ROUND_REWARDS` (5 valores).
Tudo isso vira **dinâmico por tamanho** na Liga Rei.

### Recomendação arquitetural
Extrair `src/match/knockout/` genérico (portar a lógica pura do `dailyKnockout.ts` pro client) e fazer
**Liga Ole e Liga Rei consumirem o mesmo motor**, só mudando `size` e a política de prêmio. Isso paga
dívida técnica (dois mata-matas divergentes) e destrava 64/128 sem reescrever nada.

```ts
// src/match/knockout/genericKnockout.ts
export interface KnockoutState<T> {
  size: number;                    // 16 | 32 | 64 | 128 (potência de 2)
  seed: string;
  teams: Record<string, T>;
  managerTeamId: string;
  roundIndex: number;
  participants: string[][];        // ids por rodada
  results: Record<string, KnockoutResult>;
  status: 'active' | 'champion' | 'eliminated';
  reachedRound: string;            // roundNameFromSize()
}
export function createKnockout<T extends { id: string; overall: number }>(args: {
  teams: T[]; managerTeamId: string; seed: string; size?: number;   // size auto = maior pot.2 ≤ elegíveis
  rewards?: (roundIndex: number, totalRounds: number) => number;
}): KnockoutState<T>
export function advanceKnockout<T>(s: KnockoutState<T>, managerResult: KnockoutResult): KnockoutState<T>
// Liga Ole  = createKnockout({ size: 32, ... })
// Liga Rei  = createKnockout({ /* size auto por campo real */ ... })
```

---

## 3. "Todos os times de todas as divisões" — como chavear um campo variável

O campo real cresce (72+ hoje, 193+ criados) e raramente é potência de 2. Solução (via `dailyKnockout`):

1. **Elegíveis:** puxar `global_league_teams` SEM o `.limit(200)` da Liga Ole (ou limite alto), filtrar
   `overall > 0` e times ativos. Trazer `division` + `overall`.
2. **Tamanho da chave:** `size = largestPowerOfTwoAtMost(elegíveis)`, capado (sugestão **64** no v1 — 6
   rodadas, ~6–9 min de campanha; **128** só se o campo ativo justificar).
3. **Classificação/corte:** `selectDailyQualifiers(ranked, size)` — ranqueia por `division` depois `overall`.
   **O time do manager é SEMPRE incluído** (entra classificado pela própria força, na sua faixa real).
4. **Seeding:** `seedFirstRound()` — cabeças de chave (Div 1) espalhados em metades opostas. Assim a
   hierarquia real vira drama: um manager da Div 3 pega times fracos cedo e, se sobreviver, encara os
   monstros da Div 1 nas fases finais. **Esse é o motor de engajamento** (perde pro forte → quer evoluir).
5. **Byes** (se optar por incluir 100% do campo mesmo não-potência-de-2): cabeças de chave passam a 1ª
   rodada. `dailyKnockout` já tem o esqueleto; simplifique no v1 usando corte por qualificação.

**[DECIDIDO] Campo qualificado** (não chave literal): puxa todos, ranqueia por divisão+OVR+atividade,
corta pros 64 melhores/ativos + o manager sempre incluído. Chave limpa, partidas com sentido. Abre pra
128 quando o campo ativo justificar. Descartado: chave literal de 128 com times inativos/fantasma
(rodadas iniciais viram passeio + chave incha).

---

## 4. Fluxo do modo (rápido · engajado · dinâmico · inteligente)

```
CRIAR LIGA REI (1 clique)
  puxa global_league_teams (todos) → rank por divisão+OVR → corta pra size (64)
  → seedFirstRound → KnockoutState { seed: `ligarei-<uid>-<ts>` }  (determinístico)
  → snapshot de elencos congelado (mini-universo)

CADA RODADA
  ┌─ Partida DO manager  → /match/turbo (Quick Plan Python, seed da rodada)
  │     ~60–90s, log retrô + analyst_beats + intervenção no intervalo
  │     empate → pênaltis (shootout existente)
  └─ Outras N-1 partidas → resolveAutoMatch() instantâneo (Elo + seed)
  → advanceKnockout(): vencedores sobem, chave redesenha na frente do manager
  → prêmio/renome da fase creditado  → "PRÓXIMA FASE ▶▶"

FIM
  campeão OU eliminado → resultFlash (reusa ligaOleResultFlash)
  → card compartilhável de campanha + palmarès Turbo
```

**Rápido:** só a partida do manager renderiza (≤6–7 no total pra ganhar tudo). Resto é síncrono e puro.
**Engajado:** win-or-go-home + prêmio escalando + chave que você sobe + David×Golias por seeding.
**Dinâmico:** cada criação = seed nova = chave nova; times sempre atualizados entre torneios.
**Inteligente:** partida do manager usa atributos reais + GameSpirit + analyst_beats; campo por Elo real.

### Camada "scout da chave" (engajamento barato, alto impacto)
Antes de cada partida, mostrar o **caminho provável** até a final (quem pode vir nas próximas fases,
com OVR/divisão). Barato de computar (a chave é conhecida) e cria antecipação ("se eu passar, pego o
líder da Div 1 na semi"). Reusa `coachPersonaFor()` pra dar voz aos rivais.

---

## 5. Modelo de dados

```ts
// src/match/ligaRei/types.ts  (ou genérico em src/match/knockout/)
interface LigaReiState extends KnockoutState<LigaReiTeam> {
  createdAt: string;
  fieldSize: number;              // total de elegíveis antes do corte (flex social: "bati 64 times")
  campaign: {
    prizesAccumulated: number;    // soma dos prêmios por fase
    biggestUpset?: { beatTeamId: string; ovrGap: number };  // maior zebra (viral)
    realDurationMs: number;       // speedrun da campanha
  };
}
interface LigaReiTeam { id: string; name: string; short: string; overall: number; division: number;
  managerId?: string; isManager?: boolean; }
```

Fonte do elenco do adversário DA RODADA (só o do manager): `manager_squad` (RLS pública) →
`playerToQuickPlanPayload()` → Python. Campo auto-resolvido usa só `overall` (já em `global_league_teams`).
Persistência no padrão `persistence.ts` (localStorage + Supabase `liga_rei_runs`, RLS `owner = auth.uid()`).

---

## 6. Reuso do pipeline Turbo (dependência)

Liga Rei **depende do renderer de partida Turbo** (Fase A do memo Liga Turbo). Contrato já pronto:
- `POST /api/match/quick-plan` — determinístico por seed, dados puros com `text` por evento
  ([quickPlanTypes.ts](../src/match/quickPlanTypes.ts)).
- `analyst_beats` = decisões táticas em jogo (já construídas). Re-plan `mode:'second_half'` no intervalo.
- Empate → shootout existente (`PenaltyShootout`). **Relógio pausa em TODO modal** (lei do projeto).
- A flag do Quick está OFF por causa de crédito de progressão (Fase D) — **irrelevante pra Liga Rei**,
  que é sandbox e credita por torneio, não pelo `FINALIZE_QUICK_PLAN` do Quick normal.

---

## 7. Prêmios, progressão e economia [DECIDIDO: prêmio real capado]

A Liga Ole credita **EXP REAL + renome** por fase (`grantEarnedExp`, `addRenown`) e escala 50k→1M com
`dinastiaMultiplier` (+12%/título, teto 2×). A Liga Rei **segue esse modelo** — credita EXP/OLE real por
fase superada — mas com **freios obrigatórios**, senão vira torneira de economia:

- **Teto diário/semanal** de EXP/OLE ganhável via Liga Rei (independente de quantos torneios rodar).
- **Cooldown** entre torneios premiados (ex.: N por dia), pra não farmar em loop.
- **Curva de prêmio balanceada** contra Liga Global + Premiadas ANTES de ligar — a Liga Rei não pode
  ser o caminho mais eficiente de EXP do jogo.
- Crédito por **fase superada** (acumula na campanha), não por partida individual.

**Implicação de lançamento:** como toca economia real, o balanceamento é **pré-requisito de launch** —
NÃO é mais um sandbox economicamente puro. O crédito deve ir por um caminho PRÓPRIO da Liga Rei
(espelhando o de Liga Ole no reducer), **não** pelo `FINALIZE_QUICK_PLAN` de progressão do Quick.

Independente disso: **continua não afetando ranking da Liga Global nem playerHealth real** (os elencos
seguem mini-universo/snapshot; só a carteira EXP/OLE do manager é creditada, com os tetos acima).

---

## 8. Viralização

1. **Card de campanha (Legadão):** `👑 REI · bateu 63 times · derrubou [Div 1 líder] na final · campanha em 8min`.
   Destaque pra `biggestUpset` (zebra) — David×Golias é o post que espalha.
2. **Link-desafio com seed:** `/cadastro/<CÓDIGO>?ligarei=<seed>` — o convidado joga a MESMA chave
   (mesmo seed, mesmo campo) e tenta ir tão longe quanto. Determinismo torna justo/verificável.
3. **Leaderboard semanal** (reusa `ligaOleWeekly.ts`): seed global da semana → todos jogam a mesma Liga
   Rei → ranking de quem foi mais longe. Competição assíncrona sem matchmaking.
4. **Momento screenshotável:** golaço/pênalti decisivo exportável no padrão do DS.

---

## 9. Roadmap

### Pré-requisito — Partida Turbo (Fase A do memo Liga Turbo)
- [ ] Renderer de log retrô `/match/turbo` sobre o Quick Plan (digitação, flash no gol, pele Legacy Tech)
- [ ] Verificar endpoint Python em PRODUÇÃO (latência/cold start Railway) — **pré-voo inegociável**

### Fase 1 — Motor de chave genérico
- [ ] `src/match/knockout/genericKnockout.ts` — portar lógica pura de `dailyKnockout.ts` pro client
- [ ] `size` automático (maior potência de 2 ≤ elegíveis, cap 64), seeding por divisão+OVR, prêmio dinâmico
- [ ] `npm run test:liga-rei` — determinismo, sem empate, corte correto, avanço, só a final dá título
- [ ] (Opcional) Refatorar Liga Ole pra consumir o mesmo motor (paga dívida)

### Fase 2 — Liga Rei
- [ ] `fetchLigaReiField()` — variação de `fetchLigaOleRivals` sem limite baixo, traz `division`
- [ ] Reducer: `CREATE_LIGA_REI`, `START_LIGA_REI_MATCH`, avanço no finalize (espelha Liga Ole)
- [ ] UI: hub de chave (reusa `BracketCompact`/`BracketRow`), scout do caminho, resultFlash
- [ ] Partida do manager roda em `/match/turbo`; campo via `resolveAutoMatch`
- [ ] Persistência `liga_rei_runs` + retomada

### Fase 3 — Viral + Palmarès
- [ ] Card de campanha (reusa Legadão) + link-desafio `?ligarei=<seed>` + leaderboard semanal
- [ ] Palmarès Turbo no perfil (títulos, maior zebra, speedrun)

---

## 10. Leis e riscos (pré-push)

1. **Write-back só na carteira** — torneio inteiro não toca `playerHealth`, elenco, ranking nem Liga
   Global. A ÚNICA exceção é o crédito de EXP/OLE capado (§7). Teste automatizado garante o resto.
2. **Balanceamento do prêmio real (§7) é PRÉ-REQUISITO de launch** — teto diário/semanal + cooldown +
   curva validada contra Liga Global/Premiadas antes de ligar. Sem isso, não vai ao ar.
3. **Nunca clubes reais** — só `global_league_teams` (managers). Fallback sintético sem nome de clube.
4. **Endpoint Python em prod de pé** — só 1 chamada/rodada (a do manager), mas ela é ao vivo com plateia.
5. **Campo raso** — se houver poucos times ativos, cair pra chave menor (32/16) em vez de encher de bye.
6. **Relógio pausa em todo modal** (pênalti, intervenção) — feedback canônico.
7. **Cadeia completa** store → engine → componente → UI (jogo em produção).
8. **Snapshot imutável** durante o torneio; transferências reais só entram em torneio novo.

---

## 11. Recomendação de sequência (importante)

A Liga Rei é provavelmente **melhor primeiro-lançamento que a Liga Turbo de pontos corridos**, porque:
- Reaproveita a máquina de mata-mata da Liga Ole quase inteira (só generalizar tamanho).
- Campo resolve por `resolveAutoMatch` → **quase zero carga no Python** (1 partida/rodada), o maior
  risco do lançamento ao vivo praticamente some.
- Mata-mata é mais simples que liga (sem tabela de pontos) e mais viral (win-or-go-home, zebra).
- Só exige o renderer de partida Turbo (que já era o caminho crítico) + generalizar a chave.

Sequência sugerida: **Partida Turbo → Liga Rei (mata-mata) → Liga Turbo (pontos corridos) → Premiada.**

---

*"O torneio do jogo inteiro, jogado numa sentada."*
