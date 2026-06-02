# LIGA GLOBAL → Multi-Horizonte: Daily + Season + Flash + Premium

**Status:** Relatório de implementação
**Data:** 2026-05-31
**Autor:** Análise estratégica (auditoria de código + benchmarking de mercado)
**Documentos relacionados:** [LEAGUES.md](LEAGUES.md), [ECONOMIA_EXP_BRO.md](ECONOMIA_EXP_BRO.md), [BACKEND.md](BACKEND.md)

---

## 0. Resumo Executivo

O Olefoot tem hoje **uma única competição contínua** (Liga Global, 3 divisões, partidas de 5 em 5 min). Esse modelo é sólido como ritual de fundo, mas tem um gargalo de retenção crítico: **um usuário novo entra na 3ª divisão e enxerga o topo a meses de distância**. Resultado: as 3-5 visitas/dia que queremos não acontecem porque não existe um motivo de "agora" — só de "no longo prazo".

Os benchmarks (MU Online, The Crims, Cartola Express, Bet365, Fortnite Cash Cups, Genshin, Sorare, Gamdom Daily KOTH) convergem para o mesmo padrão: **múltiplos horizontes coexistem com prêmios separados**. Cada horizonte resolve um problema de retenção distinto:

| Horizonte | Resolve | Inspiração |
|---|---|---|
| **Season** (anual / trimestral) | Prestígio máximo, identidade de manager | MU Online seasons, Sorare Champions |
| **Daily Cup** (24h, campeão todo dia) | "Agora tem chance" — reset emocional diário | Genshin reset 4h, Gamdom Daily KOTH |
| **Flash League** (5-15-30-60 min on-demand) | Densidade de eventos sem tempo morto | Bet365 in-play (sem o vício), Rocket League Auto Tournaments |
| **Premium League** (entrada em EXP, prêmio splitado) | Treino de monetização + status competitivo | Cartola Express, Fortnite Cash Cup, Sorare Reward Boxes |

**Boa notícia:** **80% da fundação já existe no código**. O motor `global-league-tick` é reutilizável, `pg_cron` + Edge Function já é o padrão validado, e — descoberta crítica — o schema **`00002_admin_leagues_competitions.sql` já desenha `competitions` com `league_subtype = 'premium'` e `knockout_advance_count ∈ {8,16,32,64,128}`** ([docs/LEAGUES.md:7](LEAGUES.md)). Esse schema admin nunca foi plugado ao motor da Liga Global — é a ponte que falta construir.

**Roadmap em 4 fases**, ~3 semanas de engenharia focada (detalhamento na §6):
1. **Fase 1** — Daily Cup gratuita (mata-mata 32, classificação até 19h, campeão diário)
2. **Fase 2** — Premium League em EXP (split 60/25/15, não 50/25/25 — ver §7)
3. **Fase 3** — Flash Leagues on-demand (3 durações: 15 / 30 / 60 min)
4. **Fase 4** — Histórico de campeões + Hall da Fama (Season + Daily) para sustentar prestígio

---

## 1. Tese Estratégica

### O problema da "única ladder"

Liga Global é a única competição automática do jogo. Funciona como prestígio de longo prazo, mas tem 3 falhas estruturais:

1. **Onboarding emocional inexistente.** Memória do projeto confirma: novos usuários caem em Division 3 via trigger (`auto_division_3_for_new_teams`). Não há "primeira conquista possível na primeira semana".
2. **Horizonte único = ritual único.** Cartola se sustenta porque tem rodada toda semana; Genshin porque tem reset toda madrugada. O Olefoot só tem o fim de temporada — uma vez por season.
3. **Sem campeão visível "de hoje".** A imprensa de futebol vive de "quem ganhou ontem". A Liga Global não produz manchete diária. **Sem manchete, sem hábito.**

### A tese: **3-5 visitas/dia surgem de 3-5 motivos diferentes**

Cada visita resolve uma necessidade emocional distinta:

- **Manhã (1 visita)** — "Como estou na Liga Global? Subi posição na noite?" → consulta de placar
- **Almoço (1 visita)** — "Vou disputar a classificação da Daily Cup antes das 19h" → curto, competitivo
- **Tarde (1 visita)** — "Flash League de 30 min começando agora com 28 inscritos" → on-demand, instantâneo
- **Noite (1-2 visitas)** — Mata-mata da Daily Cup às 19:30 / 20:00 / 20:30 → 4 rounds, ritual fixo

Esse é exatamente o modelo do **Gamdom (Daily + Monthly KOTH)** e do **Sorare (gameweek + tiers paralelos)** — validado em duas indústrias diferentes.

### Por que isso não canibaliza a Liga Global

Liga Global continua sendo **a Champions League do Olefoot** — prestígio máximo, identidade de manager sério. As novas camadas são **competições paralelas**, não substitutas. O jogador que já está dominando a 1ª divisão da Liga Global continua tendo razão pra entrar (a Liga Global vira "Mundial do Olefoot", as outras viram "Brasileirão da semana"). E o jogador novo finalmente tem onde ganhar algo no curto prazo.

---

## 2. Diagnóstico da Base Atual

### 2.1 O que JÁ FUNCIONA (reutilizar)

#### Motor Liga Global — pronto e batendo todo minuto
- [`supabase/functions/global-league-tick/index.ts`](../supabase/functions/global-league-tick/index.ts) — 890 linhas; máquina de estados completa (`waiting_teams` → `active` → `season_ended`).
- Agendamento via `pg_cron` a cada 1 min ([20260427160000_global_league_cron.sql:42-43](../supabase/migrations/20260427160000_global_league_cron.sql)).
- Função `simulateFixture()` resolve uma partida com Poisson goals, cards, lesões. **Reutilizável** pra qualquer competição.
- Tabelas `global_league_teams` / `_rounds` / `_fixtures` / `_events` / `_state`.
- Stats all-time **nunca zeram** ([20260506000000_global_league_alltime_stats.sql](../supabase/migrations/20260506000000_global_league_alltime_stats.sql)) — base pronta para Hall da Fama.

#### Schema admin/leagues — desenhado, **não plugado**
**Achado mais importante deste relatório.** A migration [`00002_admin_leagues_competitions.sql`](../supabase/migrations/00002_admin_leagues_competitions.sql) já tem TODO o esquema relacional pra competições paralelas, incluindo Premium League. Resumo de [docs/LEAGUES.md:7](LEAGUES.md):

> "Com `league_subtype = premium`, obrigatório `knockout_advance_count ∈ {8,16,32,64,128}`: primeira fase `league`, segunda `knockout`, com `fixtures` na fase mata-mata."
>
> "Com `kind = cup`, `league_subtype` fica `NULL`: apenas fases `knockout`; cada confronto pode ter `leg` 1 ou 2, agregado em `aggregate_home_goals` / `aggregate_away_goals`."

Esse schema suporta:
- Liga round-robin (`league_subtype = round_robin`)
- Liga premium (round-robin + knockout dos top N)
- Cup mata-mata puro (ida e volta com agregado)
- Tie-break por **EXP snapshot** — perfeito pra Premium League

**Por que está parado**: ninguém escreveu o motor que consome essas tabelas. A Liga Global vive em schema próprio (`global_league_*`) e nunca tocou em `competitions`. **Acender esse schema é a ponte que destrava 70% das fases 1-3 do roadmap.**

#### Disputa de Pênaltis — **componente pronto, motor não tem**
- Memória `project_penalty_shootout_mode.md` confirma componente UI pronto.
- Memória `project_penalty_prototype_state.md`: protótipo Manager POV aprovado em 2026-04-28.
- **Gap:** `simulateFixture()` em `global-league-tick` não tem disputa de pênaltis (não há `penalty_score_home/away`). Mata-mata sem pênaltis = empate que prorroga sem fim. **Fase 1 precisa cravar isso.**

#### Daily challenges + streak — base de engajamento já existe
- [`src/game/dailyChallenges.ts`](../src/game/dailyChallenges.ts) — 3 desafios/dia determinísticos, recompensa EXP (1.5k–3.5k).
- [`src/game/quickMatchStreak.ts`](../src/game/quickMatchStreak.ts) — multiplier 1.0x → 3.0x (10+ wins).
- **Como integrar:** Daily Cup vira **o** desafio diário grande. Streak fica como modificador de recompensa.

#### Tokens, carteiras e economia
- [`docs/ECONOMIA_EXP_BRO.md`](ECONOMIA_EXP_BRO.md) — moedas separadas (OLE, EXP, BRO, OLEXP, GAT).
- Sem `entry_fee` codificado em lugar nenhum — primeira vez que vamos taxar entrada precisa de hook seguro.

### 2.2 O que NÃO existe (construir)

| Capacidade | Onde colocar | Esforço |
|---|---|---|
| Tabela `tournament_entries` (quem inscreveu, em que torneio) | Nova migration sobre schema admin | Baixo |
| `entry_fee` + `prize_pool` em `competitions` | Coluna nova em `competitions` | Baixo |
| Função `chargeEntry()` (debita EXP em tx atômica com inscrição) | Edge function ou RPC postgres | Médio |
| Distribuição automática de prêmios pós-final | Hook ao fim de `knockout` em `competitions` | Médio |
| Motor `daily-cup-tick` (paralelo ao global-league-tick) | Nova Edge Function | Médio |
| Pênaltis no `simulateFixture` (campos + lógica) | Patch em `global-league-tick/index.ts` | Médio |
| UI de bracket React | `src/pages/DailyCup/*` ou `src/pages/Tournament/*` | Médio-Alto |
| Histórico de campeões (Daily + Season) | Nova tabela `tournament_champions` | Baixo |
| Calibração on-demand (Flash League quando lobby enche) | Worker que monitora inscrições | Médio |
| Telemetria de retenção (DAU split por horizonte) | Adicionar eventos no `analytics` existente | Baixo |

---

## 3. Arquitetura Proposta — 4 Produtos Coexistindo

```
┌──────────────────────────────────────────────────────────────────────┐
│                          OLEFOOT LADDERS                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌────────────┐  │
│  │ LIGA GLOBAL │  │  DAILY CUP   │  │FLASH LEAGUES│  │  PREMIUM   │  │
│  │  (Season)   │  │  (24 horas)  │  │ (5–60 min)  │  │  (EXP buyin)│  │
│  ├─────────────┤  ├──────────────┤  ├─────────────┤  ├────────────┤  │
│  │ Anual/Trim. │  │  Diário      │  │  On-demand  │  │  3-5x/dia  │  │
│  │ 3 divisões  │  │  Free        │  │  Lobby enche│  │  EXP entry │  │
│  │ Sempre on   │  │  Top 32 → KO │  │  Campeão    │  │  Split 60/ │  │
│  │ All-time    │  │  Pênaltis    │  │  por horário│  │  25/15     │  │
│  │             │  │  às 19h cut  │  │             │  │            │  │
│  └─────────────┘  └──────────────┘  └─────────────┘  └────────────┘  │
│                                                                      │
│                    🏆 HALL DA FAMA (Season + Daily)                  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.1 Liga Global (mantida, refinada)

**Cadência:** 24/7, mesmo modelo atual.
**Mudanças propostas:**
1. **Visibilidade reforçada**: card "minha posição na Liga Global" em todas as telas, com countdown pra próxima partida (já tem todo o dado, só falta destaque).
2. **Trimestres claros**: cortar a temporada em **trimestres de ~90 dias**, cada trimestre fechando com prêmio simbólico (badge + boost EXP). Hoje o `season_ended` faz soft reset; aproveita pra emitir um "season recap" automático. **Isso é o que a literatura de live-ops chama de "Season Pass" embarcado** (Genshin / Fortnite).
3. **Identidade vs Daily**: Liga Global é "minha carreira". Daily é "evento de hoje". Não competem pelo mesmo slot mental.
4. **Widget "Últimos 3 Campeões Diários" ao lado da Liga Global** na home: mostra os 3 últimos vencedores da Daily Cup com avatar + horário. Reforça o "eu também posso ganhar" sem disputar slot mental com a Liga Global como prestígio máximo.

### 3.2 Daily Cup — o coração da retenção diária

**Cadência:** diário, mesmo formato 7 dias por semana.

**Estrutura proposta (calibrada por Fortnite Cash Cup + Gamdom KOTH):**

| Janela | O que acontece |
|---|---|
| **00:00–19:00 (Classificação aberta)** | Qualquer manager pode disputar partidas de Daily Cup. Cada vitória soma 3 pts, empate 1, derrota 0. Empate desempata por saldo de gols. **Sem inscrição** — automático ao jogar Quick/Live no modo Daily. |
| **19:00 (Corte)** | Top 32 do dia são selados. Visualização de bracket aparece pra todos. Quem ficou de fora vê o "próximo será meu". |
| **19:30 (Oitavas, BO1)** | 16 partidas paralelas. Cada uma sai em ~5 min. Empate → pênaltis. |
| **20:00 (Quartas, BO1)** | 8 partidas. Mesmo formato. |
| **20:30 (Semis)** | 4 partidas. |
| **21:00 (Final)** | 1 partida ao vivo, broadcast destaque, decisão por pênaltis se empatar. |
| **21:30 (Coroação)** | Push de "Campeão Olefoot do Dia: @user" + página do campeão + badge permanente. |

**Fase de Qualificação ativa (não só jogar):** durante 00:00-19:00, **vitórias em Quick/Live são o eixo principal** da classificação, mas ações administrativas adicionam micro-pontos — ajuste tático aplicado, treino concluído de jogador, transferência fechada no mercado. Isso garante que o ritual diário inclua "cuidar do clube", não só "jogar partidas" — alinhado com a identidade de manager. Cap total de pontos administrativos por dia (calibrar com dado real após launch) para não desbalancear quem só joga.

**Princípio de notificação push (vale pros 4 produtos):** nunca notificar sobre "a competição" ou "o jogo inteiro". Sempre sobre o **próximo evento específico do usuário** — "Seu time joga em 10 min nas oitavas, ajuste a tática", "Você está em 33º, falta 1 vitória pro top 32", "Pote da Premium Gold cresceu pra 1.8M EXP, 3 vagas restam". Push focado mantém o gatilho funcional sem virar spam.

**Por que esse ritmo funciona** (Fortnite valida): 30 min entre matches dá tempo de **ver replay, ajustar tática, descansar atenção**. É curto pra manter o ritual, longo o suficiente pra não cansar.

**Prêmio Daily Cup (free):**
- 🥇 Campeão: 50.000 EXP + badge "Campeão do Dia DD/MM" + foto na home por 24h
- 🥈 Vice: 20.000 EXP
- 🥉 Semifinalistas: 10.000 EXP cada
- Top 8: 5.000 EXP cada
- Top 32: 2.000 EXP cada (recompensa de classificação)

**Insight do The Crims (End Game +50%):** nas **duas últimas horas da classificação (17:00-19:00)**, vitórias na Daily Cup valem **2× pontos**. Cria pico de tráfego na janela final.

### 3.3 Flash Leagues — densidade sem tempo morto (estilo Bet365, sem o vício)

**Cadência:** sob demanda. Sempre há **3 modalidades** rodando em paralelo:

| Modalidade | Tamanho | Duração | Formato |
|---|---|---|---|
| **Flash 8** | 8 inscritos | ~15 min | Mata-mata direto (quartas → semi → final) |
| **Flash 16** | 16 inscritos | ~30 min | Mata-mata direto |
| **Flash 32** | 32 inscritos | ~60 min | Liguinha (1 rodada) → top 8 mata-mata |

**Como começa:** worker monitora inscrições. Quando atinge o tamanho mínimo **OU** passou 5 min com pelo menos 50% das vagas, dispara. Padrão **Rocket League Auto Tournaments** ([Epic Games Help](https://www.epicgames.com/help/en-US/rocket-league-c-202300000001622)).

**Prêmio Flash (free):** menor que Daily Cup. Foco é **densidade de oportunidades**, não premiação grande. Champion ganha 5.000 EXP em Flash 8, 10.000 em Flash 16, 20.000 em Flash 32.

**Insight Sorare:** Flash 8 / 16 / 32 são os **tiers** — o jogador novo escolhe Flash 8 (mais fácil de ganhar), o veterano vai pro Flash 32. Resolve o problema "newbie vs whale" sem matchmaking complicado.

### 3.4 Premium Leagues — o motor de monetização (treino com EXP)

**Tese:** antes de cobrar OLEFOOT / BRL, **treinamos a mecânica com EXP**. Se funciona com EXP, é tendência forte que funcionará com moeda real. Vantagens:
1. Sem regulação de apostas (não é dinheiro real → Lei 14.790/2023 não se aplica).
2. EXP tem custo de oportunidade real pro jogador (não dá pra farmar infinito sem jogar).
3. House cut em EXP **sustenta a economia interna** (sink controlado, ver [ECONOMIA_EXP_BRO.md](ECONOMIA_EXP_BRO.md)).

**Estrutura Premium Liga (3 tiers de buyin):**

| Tier | Buyin EXP | Slots | Duração | Prêmio Total | Split sugerido |
|---|---|---|---|---|---|
| **Bronze** | 5.000 EXP | 32 | ~1h | 160.000 EXP | Veja abaixo |
| **Silver** | 25.000 EXP | 32 | ~1h | 800.000 EXP | Veja abaixo |
| **Gold** | 100.000 EXP | 16 | ~30min | 1.600.000 EXP | Veja abaixo |

**Pote visível em tempo real (UX que vende sozinha):** o card de inscrição deve mostrar **"Pote atual: 120.000 EXP" com o número crescendo ao vivo** conforme novos jogadores entram, contagem de vagas restantes e timer "começa em 4 min". É o gatilho competitivo do Cartola Express ("campeão leva R$ 50 mil") trazido pra moeda interna. Sem isso, o jogador não percebe a escala do prêmio — com isso, vira manchete dentro do jogo. Implementação leve: usar o Realtime do Supabase já em uso no projeto.

**Sobre o split 50/25/25 proposto pelo fundador:**

A pesquisa de Daily Fantasy Sports (DraftKings, Cartola Express) mostra **house cut típica entre 8-15%**. O split **50/25/25 com 25% pra OLEFOOT é alto pro mercado** — risco de o jogador competitivo perceber e migrar pra alternativas free.

**Recomendação:** **60% / 25% / 15%** como padrão inicial.

- 🥇 Champion: **60%** do pool (96.000 EXP no Bronze)
- 🥈 Vice: **25%** do pool (40.000 EXP)
- 🏦 House (OLEFOOT): **15%** do pool (24.000 EXP — sink permanente)

Justificativa:
- Champion subiu de 50% → 60%: prêmio absoluto **mais visível**, narrativa mais forte ("ganhou 96k EXP em 1h"), maior atratividade.
- House caiu 25% → 15%: alinhado com mercado. Sustenta a economia sem espantar.
- Vice mantido em 25%: é o consolo importante — sem isso, semifinalista fica frustrado.

**A/B test:** rodar 50/25/25 em metade dos torneios e 60/25/15 na outra por 2 semanas. Métrica: taxa de re-inscrição (próxima Premium nas próximas 24h). Manter o que renovar mais.

**House cut como sink rastreável:** os 15% (ou 25%) que vão pra "house" não somem — entram numa tabela contábil dedicada (`house_cut_ledger`, ver §4) que serve como **medidor de saúde econômica**. Antes de migrar pra OLEFOOT/BRL, queremos meses de dados sobre **quanto EXP foi queimado, em que tier, com que frequência**. É o ensaio operacional pra moeda real — não dá pra fazer sem rastrear.

**Cap importante**: nas primeiras 4 semanas, **EXP gasto em entry não pode passar de 40% do EXP ganho na semana**. Trigger no banco bloqueia. Evita "afunilar" o jogador em torneios premium e matar outras mecânicas.

### 3.5 Evolução de longo prazo (fase 5+, fora do escopo de 3 semanas)

Ordem proposta de evolução, **uma trava por vez**:
1. **OLEFOOT como buyin** — quando o token estiver listado e líquido. Mesmo split, mesma engenharia.
2. **BRO (centavos) como buyin** — após validação jurídica como "torneio de habilidade", não aposta.
3. **Cross-club Premium** — torneios entre clubes (5v5), prêmio dividido entre membros.
4. **Patrocinadores reais** — Patrocinador X banca o pool da Daily Cup de Sábado. Receita publicidade.

---

## 4. Modelo de Dados — Delta

### 4.1 Aproveitar o schema admin existente

A migration `00002_admin_leagues_competitions.sql` já dá:
- `competitions` (kind, league_subtype, knockout_advance_count, max_clubs)
- `competition_phases` (kind: league | knockout)
- `competition_standings`
- `competition_participants` (com `exp_snapshot` pra tie-break)
- `fixtures` (com leg, agregado, tie-break por EXP)

**Plug-in necessário:**

```sql
-- migration: 20260605_competitions_economy.sql

ALTER TABLE public.competitions
  ADD COLUMN entry_fee_exp BIGINT DEFAULT 0,
  ADD COLUMN prize_pool_exp BIGINT DEFAULT 0,
  ADD COLUMN house_cut_pct NUMERIC(5,2) DEFAULT 15.00,
  ADD COLUMN champion_pct NUMERIC(5,2) DEFAULT 60.00,
  ADD COLUMN vice_pct NUMERIC(5,2) DEFAULT 25.00,
  ADD COLUMN cadence TEXT DEFAULT 'one_off',  -- 'daily' | 'flash' | 'premium' | 'season'
  ADD COLUMN auto_start_threshold INTEGER,    -- min inscritos pra Flash League
  ADD COLUMN classification_cut_at TIMESTAMPTZ;  -- 19:00 da Daily Cup

CREATE TABLE public.tournament_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.competitions(id),
  club_id UUID NOT NULL REFERENCES public.clubs(id),
  entry_fee_paid BIGINT NOT NULL DEFAULT 0,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  refunded BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (competition_id, club_id)
);

CREATE TABLE public.tournament_champions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.competitions(id),
  club_id UUID NOT NULL REFERENCES public.clubs(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  rank INTEGER NOT NULL,   -- 1 = champion, 2 = vice, 3 = semi, etc
  prize_exp BIGINT NOT NULL DEFAULT 0,
  prize_paid_at TIMESTAMPTZ,
  cadence TEXT NOT NULL,   -- 'daily' | 'flash' | 'premium' | 'season'
  competition_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tournament_champions_user_cadence
  ON public.tournament_champions (user_id, cadence, competition_date DESC);

CREATE TABLE public.house_cut_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.competitions(id),
  amount_exp BIGINT NOT NULL,
  cadence TEXT NOT NULL,        -- 'premium' | 'flash_paid' (futuro) | 'season' (futuro)
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_house_cut_collected ON public.house_cut_ledger (collected_at DESC);
```

`house_cut_ledger` é a **tabela contábil do sink de EXP**. Cada Premium League encerrada insere uma linha com a parte da casa. Dashboard admin lê dela pra responder "quanto EXP queimamos no último mês?" — pré-requisito pra calibrar economia antes de migrar pra OLEFOOT/BRL.

### 4.2 RPC para entry atômica

```sql
CREATE OR REPLACE FUNCTION public.enter_premium_tournament(
  p_competition_id UUID,
  p_club_id UUID
) RETURNS public.tournament_entries
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_fee BIGINT;
  v_current_exp BIGINT;
  v_entry public.tournament_entries;
BEGIN
  SELECT entry_fee_exp INTO v_fee FROM public.competitions
   WHERE id = p_competition_id AND cadence = 'premium';
  IF v_fee IS NULL THEN RAISE EXCEPTION 'competition not found or not premium'; END IF;

  -- debit EXP atomically (assume wallet table; ajustar pro nosso schema real)
  UPDATE public.wallets
     SET exp_balance = exp_balance - v_fee
   WHERE club_id = p_club_id AND exp_balance >= v_fee
   RETURNING exp_balance INTO v_current_exp;
  IF v_current_exp IS NULL THEN RAISE EXCEPTION 'insufficient EXP'; END IF;

  INSERT INTO public.tournament_entries (competition_id, club_id, entry_fee_paid)
    VALUES (p_competition_id, p_club_id, v_fee)
    RETURNING * INTO v_entry;

  UPDATE public.competitions
     SET prize_pool_exp = prize_pool_exp + v_fee
   WHERE id = p_competition_id;

  RETURN v_entry;
END $$;
```

> **Auditoria importante**: validar que o schema real de `wallets` / `clubs` bate com esses nomes. Hoje as moedas estão em `src/wallet/types.ts` (front), mas a persistência em Supabase pode estar em outra tabela — confirmar antes de aplicar.

### 4.3 Bracket virtualizado em `fixtures`

O schema admin já suporta knockout via `competition_phases.phase_kind = 'knockout'` e `fixtures.leg`. **Não precisa de tabela nova de bracket** — a UI consome `fixtures` ordenadas por `(phase_id, leg, position)`.

---

## 5. Pênaltis no Motor — destrava o mata-mata

Sem pênaltis, mata-mata empata e a fila trava. Hoje `simulateFixture()` em [global-league-tick/index.ts](../supabase/functions/global-league-tick/index.ts) não tem isso.

**Patch sugerido:**

```ts
// global-league-tick/index.ts (acrescentar a simulateFixture)
function simulateShootout(homeOvr: number, awayOvr: number, rng: () => number) {
  let h = 0, a = 0;
  for (let i = 0; i < 5; i++) {
    if (rng() < scoreProb(homeOvr)) h++;
    if (rng() < scoreProb(awayOvr)) a++;
  }
  while (h === a) {  // sudden death
    if (rng() < scoreProb(homeOvr)) h++;
    if (rng() < scoreProb(awayOvr)) a++;
  }
  return { home: h, away: a };
}

function scoreProb(ovr: number) {
  // 70% médio, modulado por OVR (50 → 60%, 90 → 80%)
  return 0.50 + (ovr - 50) * 0.0075;
}
```

E adicionar à `fixtures` (na schema admin) duas colunas opcionais: `penalty_score_home INT`, `penalty_score_away INT`. Só preenchem em knockout que empata no tempo normal.

**Cross-link com prototótipo existente:** memória `project_penalty_prototype_state.md` confirma o frontend de pênaltis já aprovado em 2026-04-28. Pra motor automático (Daily Cup / Flash) usamos o modelo Poisson acima. Pra finais com humano no comando, podemos reaproveitar o componente PenaltyKickModal já testado.

---

## 6. Roadmap Faseado

**Premissa:** prod já está rodando, base de usuários ativa, **toda mudança precisa cobrir store → engine → componente → UI** ([feedback_production_updates.md](https://...)).

### Fase 1 — Daily Cup gratuita (5-7 dias)

**Objetivo:** primeira competição diária com campeão, sem cobrar nada.

- [ ] Migration `tournament_champions` + `tournament_entries`.
- [ ] Patch pênaltis em `simulateFixture()` + colunas `penalty_score_*`.
- [ ] Edge Function `daily-cup-tick` paralela ao `global-league-tick`, agendada por `pg_cron` (corte às 19h, rounds 19:30 / 20:00 / 20:30 / 21:00).
- [ ] Hook em Quick/Live: ao terminar partida, se está na janela de classificação, soma ponto no daily.
- [ ] UI bracket React em `src/pages/DailyCup/` (consome `fixtures` da phase knockout).
- [ ] Card "Campeão de hoje: @user" na home, troca às 21:30.
- [ ] Widget "Últimos 3 Campeões Diários" na home, ao lado do card da Liga Global.
- [ ] Widget "Próximo evento" persistente no header durante 19:00-21:30: countdown pra próxima rodada + CTA "Entrar no Mata-Mata" sempre visível.
- [ ] Push notification focada no próximo jogo do usuário (oitavas, quartas, semi, final).
- [ ] Trigger de prêmio: `INSERT INTO tournament_champions` + `UPDATE wallet`.
- [ ] Teste E2E: simular 32 inscritos, rodar mata-mata completo, verificar campeão único, prêmios distribuídos.

**Métrica de sucesso da Fase 1:** % de DAU que abre a Daily Cup nos primeiros 7 dias. Target: 40%+.

### Fase 2 — Premium League em EXP (5-7 dias)

**Objetivo:** primeira competição paga (EXP), validando split de prêmio.

- [ ] Migration economy adicionando `entry_fee_exp`, `prize_pool_exp`, `*_pct` em `competitions`.
- [ ] RPC `enter_premium_tournament()` com debit atômico.
- [ ] UI de inscrição: botão "Entrar (5.000 EXP)" na Daily Cup; tela dedicada `/torneios/premium`.
- [ ] Trigger de distribuição: ao acabar o knockout, ler ranking, debitar `prize_pool_exp`, distribuir pelos 3 splits.
- [ ] A/B test 50/25/25 vs 60/25/15.
- [ ] Cap 40% de EXP semanal em entry — trigger no banco.
- [ ] Telemetria: taxa de re-inscrição em 24h.

**Métrica de sucesso da Fase 2:** % de jogadores que se inscreveram em uma Premium League e voltam a se inscrever em <24h. Target: 35%+.

### Fase 3 — Flash Leagues on-demand (5 dias)

**Objetivo:** densidade de oportunidades (1 torneio começando "agora" sempre).

- [ ] Worker em Edge Function: monitora `tournament_entries` por competição com `cadence = 'flash'`. Se atinge `auto_start_threshold` OU 5 min com 50% das vagas, dispara.
- [ ] 3 templates pré-cadastrados em `competitions`: Flash 8, Flash 16, Flash 32. Após cada um terminar, edge function cria o próximo automaticamente.
- [ ] UI Lobby: lista live de "torneios começando agora", com timer/contagem regressiva.
- [ ] Bracket compacto pra Flash 8 (sem visualização complexa).

**Métrica de sucesso da Fase 3:** tempo médio entre login e início de uma flash league. Target: <5 min.

### Fase 4 — Hall da Fama + Polimento (3-5 dias)

**Objetivo:** prestígio acumulável que sustenta retenção de longo prazo.

- [ ] Página `/hall-da-fama` consumindo `tournament_champions`.
- [ ] Filtro por cadência: campeões da semana / mês / season / all-time.
- [ ] Badge dinâmico no avatar: "Campeão Daily Cup 3×", "Premium Gold 1×".
- [ ] Recap automático ao fim de season da Liga Global (top 10, manchete, badge).
- [ ] Push notification opcional: "Daily Cup começa em 30 min, você está em 12º" (corte 19h aproximando).

**Métrica de sucesso da Fase 4:** % de DAU que acessa Hall da Fama no mês. Target: 25%+.

---

## 7. Métricas de Sucesso e Telemetria

Adicionar ao analytics existente os seguintes eventos:

| Evento | Quando | Propósito |
|---|---|---|
| `daily_cup_match_played` | partida Quick/Live entra na classificação Daily | acompanhar funil |
| `daily_cup_qualified` | jogador entrou no top 32 às 19h | conversão classificatória |
| `daily_cup_champion` | jogador venceu final | celebração + share |
| `premium_entry` | inscrição em Premium League | volume + ticket médio |
| `premium_champion` | venceu Premium | tempo entre títulos |
| `flash_lobby_joined` | entrou em lobby Flash | tempo de espera |
| `flash_started` | flash league disparou | conversão lobby→partida |
| `hall_view` | acessou Hall da Fama | retenção de longo prazo |

**KPIs guardrail (não regredir):**
- DAU Liga Global (medir antes de lançar Fase 1).
- Tempo médio de sessão (deve subir).
- Churn 7 dias pós-cadastro (deve cair com Daily Cup dando primeira conquista possível).

**KPIs aspiracionais:**
- Sessões/dia/usuário: hoje ~1.5 (estimativa). Target Fase 4: **3.0–3.5**.
- DAU/MAU stickiness: hoje provavelmente <0.30. Target: 0.45+.
- % de DAU que ganhou pelo menos 1 título no último mês: target 15%.

---

## 8. Riscos & Calibragens

### 8.1 Canibalização da Liga Global

**Risco:** jogador foca em Daily Cup e abandona Liga Global.
**Mitigação:** prêmios da Liga Global precisam crescer também (badge "Top 100 Mundial", boost EXP para divisões superiores). A Liga Global deve ser **o sonho**, não a competição que o jogador esquece.

### 8.2 Inflação de EXP

**Risco:** prêmios Daily Cup grandes demais inflam a economia EXP.
**Mitigação:** **House cut da Premium é o sink primário**. 15% de cada Premium League queima EXP da economia. Modelar mensalmente: prêmios Daily Cup distribuídos vs EXP queimado em Premium. Manter razão saudável (~1.5 distribuído : 1 queimado).

### 8.3 Bots / multi-account em Premium

**Risco:** jogador cria contas secundárias pra "subir" o pool e ganhar com a principal.
**Mitigação:**
- Cap de 1 conta por dispositivo + verificação de email.
- Detecção de padrão: se mesmo IP joga em ambos os lados da final, marca pra revisão.
- Premium League grande (32 slots) — colusão fica matematicamente difícil.

### 8.4 Regulação (quando virar BRL/OLEFOOT)

**Risco:** ao migrar buyin pra moeda real, cair na Lei 14.790/2023.
**Mitigação:**
- Manter caráter de **torneio de habilidade** (skill-based), não sorteio. Documentar.
- Consultar jurídico ANTES de Fase 5.
- Cartola Express opera nessa zona; estudar como eles se posicionam.

### 8.5 Calibração do "ritual das 19h"

**Risco:** horário fixo único exclui fusos diferentes.
**Mitigação:** começar com 19h horário Brasil (público dominante). Quando houver volume internacional, replicar Daily Cup por região (já é assim no Genshin: America / Europe / Asia, [thegamer.com](https://www.thegamer.com/genshin-impact-daily-reset-time-guide/)).

### 8.6 Telemetria insuficiente pra tomar decisão

**Risco:** rodar 2 semanas, achar que melhorou, mas faltar instrumentação.
**Mitigação:** **Fase 0 implícita** — antes de Fase 1, garantir que os 8 eventos da §7 estão sendo registrados, mesmo que vazios. Sem dado, sem decisão.

---

## 9. Anexo — Benchmarks consultados

| Game / Mecânica | Cadência | Insight aplicado |
|---|---|---|
| MU Online (race do dia 1) | Season 3-12 meses | Recompensa primeiros a chegar no topo da season |
| The Crims (End Game +50%) | Round ~52 dias | Burst final na Daily Cup (17h-19h: 2× pontos) |
| Cartola FC tradicional | Semanal (Brasileirão) | Deadline fixo cria hábito — adotamos 19h |
| Cartola Express | Por rodada | Buyin baixo + prêmio absoluto chamativo (Premium League) |
| Bet365 in-play | 24/7 | Densidade de eventos (Flash Leagues) **sem** o gatilho compulsivo |
| Fortnite Cash Cup | Semanal, janela 3h | Ritmo de 30 min entre matches do mata-mata |
| Genshin daily reset | Diário 4h | Horário fixo cria ritual; Daily Cup às 19h |
| Sorare tiers | 2 gameweeks/sem | Múltiplas competições paralelas (Flash 8 / 16 / 32) |
| Gamdom Daily KOTH | Daily + Monthly | Pools separados Daily + Season coexistindo |
| Rocket League Auto Tournaments | On-demand | Lobby enche → dispara (Flash Leagues) |

### Fontes principais
- [MU Online Reset Guide — TopMuOnline](https://www.topmuonline.com/guides/muonline-reset)
- [The Crims Game Guide](https://thecrims.tawk.help/article/game-guide-shorter-version-52-days)
- [Cartola Express — TechTudo](https://www.techtudo.com.br/guia/2024/04/cartola-express-o-que-e-como-funciona-e-dicas-para-mandar-bem-edjogos.ghtml)
- [Bet365 Review — SportsHandle](https://sportshandle.com/bet365-sportsbook/)
- [FNCS 2026 Cash Cup — Liquipedia](https://liquipedia.net/fortnite/Fortnite_Champion_Series/2026/Major_1/Summit/Cash_Cup)
- [Genshin Daily Reset — TheGamer](https://www.thegamer.com/genshin-impact-daily-reset-time-guide/)
- [Sorare Football Guide](https://en.sorarefootballguide.com/sorare-preise-und-preispool)
- [Gamdom King of the Hill](https://help.gamdom.com/en/articles/9721638-king-of-the-hill)
- [Rocket League Auto Tournaments — Epic Games](https://www.epicgames.com/help/en-US/rocket-league-c-202300000001622)

---

## 10. Próximos passos imediatos (depois deste relatório)

1. **Decidir o split** (50/25/25 do fundador vs 60/25/15 deste relatório vs A/B test). Decisão de produto, não engenharia.
2. **Confirmar schema de wallets** real (`src/wallet/` + persistência Supabase) — antes de escrever a RPC `enter_premium_tournament`.
3. **Mockar UI da Daily Cup** (bracket + countdown 19h) — pode ir em paralelo com a engine.
4. **Decidir nome marketing das competições** — "Daily Cup" é descrição técnica; copy precisa ter nome próprio (ex: "Copa do Dia", "Olefoot Cup", "Diária Brutal", etc).
5. **Cravar Fase 1** — 5-7 dias de engenharia focada. Deploy faseado: 1 dia de teste interno → 1 dia com 10% dos usuários → rollout total.

---

## 11. Ajustes Incorporados de Revisão Externa (2026-05-31)

Após este relatório, o plano foi revisado contra um parecer estratégico externo. Critério: **incorporar princípios psicológicos e UX baratos de implementar; descartar mudanças de engenharia caras ou específicas demais que não se encaixam no contexto real do Olefoot**.

**Incorporado (já adicionado nas seções acima):**

| Ajuste | Onde entrou | Por que vale |
|---|---|---|
| Fase de Qualificação **ativa** (admin soma pontos) | §3.2 | Ritual diário inclui "cuidar do clube" — alinha com identidade de manager. Implementação leve: ganchos em ações já existentes |
| **Pote em tempo real** no card de inscrição | §3.4 | Gatilho do Cartola Express trazido pra moeda interna. Realtime do Supabase já está no projeto |
| **Widget "Últimos 3 Campeões Diários"** ao lado da Liga Global | §3.1 / §6 Fase 1 | Efeito "eu também posso ganhar" sem disputar slot com a Liga Global |
| **Princípio de push focado** (próximo evento do usuário, não a competição) | §3.2 | Vale pros 4 produtos. Push útil sem virar spam |
| **`house_cut_ledger` (coletor separado e auditável)** | §4 | Ensaio operacional pra OLEFOOT/BRL: queremos meses de dado de sink antes de migrar |
| **CTA "Entrar no Mata-Mata" persistente** durante janela noturna | §6 Fase 1 | Resolve o gargalo "esqueci que tinha torneio hoje" |

**Descartado (com motivo registrado):**

- **"Interface horizontal com menus colapsáveis"** — redesign de layout fora do escopo de 3 semanas. O jogo está em produção; refatorar layout agora arrisca regressões em telas que já funcionam.
- **Split 50/25/25 como decisão fixa** — parecer externo defende manter; este relatório defende A/B test 50/25/25 vs 60/25/15. **Mantemos o A/B test** — decisão deve sair de dado, não de opinião isolada.
- **Números, horários e durações específicas do parecer** — descartados porque o parecer não tinha contexto da economia EXP real do Olefoot nem dos benchmarks que sustentam os números deste relatório (Fortnite Cash Cup, Gamdom KOTH, Cartola Express).

> **Tese final:** o modelo proposto não é uma reinvenção, é uma **convergência de padrões validados em 4 indústrias diferentes** (MMO, DFS, BR esports, gacha live-ops). A engenharia é tratável — boa parte do schema relacional já existe esperando ser plugada. O risco real é de produto: definir bem o split, calibrar a economia EXP, e não deixar a Liga Global morrer no processo.
