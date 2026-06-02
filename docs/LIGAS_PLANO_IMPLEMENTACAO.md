# Liga Global + Ligas Premiadas — Plano de Implementação

**Status:** Plano de execução aprovado
**Data:** 2026-05-31
**Contexto/benchmark:** ver [LIGAS_DIARIAS_EVOLUCAO.md](LIGAS_DIARIAS_EVOLUCAO.md)
**Schemas-base:** [00002_admin_leagues_competitions.sql](../supabase/migrations/00002_admin_leagues_competitions.sql), [20260427135532_global_league_mvp.sql](../supabase/migrations/20260427135532_global_league_mvp.sql)

---

## 0. Decisões Aprovadas

1. **Liga Global** é o único campeonato-espinha. Continua com season longa + 3 divisões + all-time stats. Ganha **ciclo diário**: micro-liga até 19:00 → mata-mata até 21:30 → **1 campeão por dia, 7 por semana**, somando dezenas de coroas até o campeão da Season.
2. **Ligas Premiadas** são produto paralelo on-demand. Entry fee em EXP, **min/max de participantes**, pote crescendo em tempo real, prêmio splitado. Substituem o conceito de "Flash Leagues" — Premium com `min=8` é o flash.
3. **Widget "Últimas 3 Premiadas Vencidas"** vai pra home — esses são os 3 campeões diários visíveis. Liga Global tem widget próprio ("Campeão de Hoje" + recap semanal).
4. **Sem CTA "Entrar no Mata-Mata"** — quem se qualificou na micro-liga já está dentro. O reforço de engajamento vem do **aumento de competitividade dentro das 3 divisões diárias**: visual de "faltam 3 posições pro top 32", barra de pressão, push focado.
5. **House cut em coletor separado** (`house_cut_ledger`) — sink rastreável, pré-requisito pra migrar pra OLEFOOT/BRL.

---

## 1. Arquitetura Final (2 produtos, não 4)

```
┌────────────────────────────────────────────────────────────────────┐
│                      OLEFOOT — LADDERS                             │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│   ┌──────────────────────────────┐  ┌─────────────────────────┐    │
│   │      LIGA GLOBAL (Season)    │  │   LIGAS PREMIADAS       │    │
│   │  ┌─────────────────────────┐ │  │   (paralelas/on-demand) │    │
│   │  │  Ciclo diário 24h:      │ │  │                         │    │
│   │  │  00-19h micro-liga      │ │  │  Buyin EXP              │    │
│   │  │  19h corte top 32       │ │  │  Min/max times          │    │
│   │  │  19:30-21:00 mata-mata  │ │  │  Pote em tempo real     │    │
│   │  │  21:30 Campeão do Dia   │ │  │  Split 50/25/25 ou      │    │
│   │  └─────────────────────────┘ │  │  60/25/15 (A/B test)    │    │
│   │  Season agrega coroas        │  │  3 últimas no widget    │    │
│   │  3 divisões mantidas         │  │                         │    │
│   └──────────────────────────────┘  └─────────────────────────┘    │
│                                                                    │
│                🏆 HALL DA FAMA (Coroas + Títulos Premium)          │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 2. Liga Global Redesenhada

### 2.1 Ciclo Diário (camada nova dentro da Liga Global)

| Janela | O que acontece | Tabela impactada |
|---|---|---|
| **00:00–19:00** | Micro-liga diária. Toda partida Quick/Live de manager soma pontos no `daily_points` da divisão dele. Empate 1, vitória 3, bonus de saldo de gols. | `global_league_teams.daily_points` (nova col) |
| **19:00** | Corte. **Top 32 do dia** (somando as 3 divisões, com tiebreak por divisão superior). Bracket gerado. | `global_league_rounds` (`round_type='daily_ko'`) |
| **19:30** | Oitavas (16 partidas). Empate → pênaltis. | `global_league_fixtures` + `penalty_score_*` |
| **20:00** | Quartas | idem |
| **20:30** | Semis | idem |
| **21:00** | Final ao vivo | idem |
| **21:30** | Campeão do Dia coroado: badge "Coroa DD/MM", incremento em `season_crowns`, push push push. | `daily_crowns` (nova tabela) |
| **00:00 do dia seguinte** | `daily_points` zera. Posição na Liga Global (season) **não** zera. | reset job |

### 2.2 Season agrega Coroas

A Liga Global continua existindo como hoje (3 divisões, promo/rele, all-time stats). Mas agora cada dia que um manager vence o mata-mata, ganha **1 Coroa** registrada em `daily_crowns`.

No fim da Season:
- Campeão da Season da Divisão 1 → **Olefoot World Champion** (continua sendo o título máximo).
- Manager com mais Coroas na Season → **Coroa de Ouro da Temporada** (prêmio paralelo, badge especial, EXP grande).
- Top 3 em coroas → badges secundários.

Isso resolve dois problemas em uma só estrutura:
- Manager veterano dominando a Div 1 continua mirando a Season.
- Manager novato em Div 3 pode acumular Coroas no caminho — cada dia é um sub-objetivo viável.

### 2.3 Competitividade dentro das 3 divisões (substitui o CTA "entrar")

O reforço de engajamento NÃO é "entrar num torneio" (você já está). É **fazer a corrida pelo top 32 ser tensa e visível**. UI:

- Card persistente "**Sua posição na corrida**" mostrando: posição atual no ranking diário GERAL (1-N), distância pro 32º, próximo manager à frente.
- Barra de pressão visual entre 14h-19h: cor muda conforme falta tempo / faltam vitórias.
- Push focado: "Você é o 35º. Uma vitória te coloca no mata-mata. Corte em 1h 22min."
- Filtro por divisão: "minha divisão" vs "geral" — quem está em Div 3 pode ver que está em 28º geral apesar de ser Div 3, sentimento de "eu vou".

**Sobre opção de mudar divisão**: na sua mensagem você falou em "ficar muito mais competitivo as 3 divisões diárias". Interpretei como **tornar a corrida intra-divisão mais pesada**, sem permitir mudança manual (promo/rele continuam automáticos no fim da Season). Se a leitura era outra, me avisa.

---

## 3. Ligas Premiadas (produto novo on-demand)

### 3.1 Como funciona

- Manager vê uma lista de **templates de Ligas Premiadas** disponíveis: Bronze, Silver, Gold (e potencialmente mais tarde com OLEFOOT/BRL).
- Cada template tem: `entry_fee_exp`, `min_teams`, `max_teams`, `prize_split`, `duration`.
- Manager clica "Inscrever" → debita EXP → entra na fila.
- **Pote em tempo real**: card mostra "**Pote: 120.000 EXP**" subindo a cada inscrição. WebSocket via Supabase Realtime.
- Atinge `min_teams` **OU** passou X minutos com pelo menos 70% das vagas → dispara mata-mata.
- Final → campeão e vice recebem prêmio automaticamente. House cut vai pro `house_cut_ledger`.
- Campeão entra no **widget "Últimas 3 Premiadas Vencidas"** na home.

### 3.2 Templates iniciais

| Template | Entry | Min | Max | Duração | Formato | Sugestão Split |
|---|---|---|---|---|---|---|
| **Bronze Rápida** | 2.500 EXP | 8 | 16 | ~15 min | Mata-mata BO1 + pênaltis | 60/25/15 |
| **Silver Cheia** | 10.000 EXP | 16 | 32 | ~30 min | Mata-mata BO1 + pênaltis | 60/25/15 |
| **Gold Confronto** | 50.000 EXP | 8 | 16 | ~30 min | Mata-mata BO1 + pênaltis | 50/25/25 (A/B contra Silver) |

**Min/max servem pra**:
- **Min** garante prêmio mínimo viável (Bronze com 4 inscritos não vale o esforço).
- **Max** evita "Premium fantasma" com 200 inscritos que duraria 3 horas — preserva o ritmo curto que segura atenção.

### 3.3 Por que sem Flash separada

A Bronze Rápida (8-16 inscritos, ~15 min, buyin baixo) **é** a Flash League. Não precisa de produto separado — vira variante de template. Reduz superfície de UI, schema, manutenção.

---

## 4. Aproveitamento da Base Existente

Tabela do que reutilizamos vs construímos:

| Capacidade | Status | Onde está / onde vai |
|---|---|---|
| Motor de simulação de partida | ✅ REUSAR | `simulateFixture()` em [global-league-tick/index.ts](../supabase/functions/global-league-tick/index.ts) |
| Cron 1 min | ✅ REUSAR | [20260427160000_global_league_cron.sql](../supabase/migrations/20260427160000_global_league_cron.sql) |
| Tabelas `global_league_*` | ✅ REUSAR + ESTENDER | Acrescentar `daily_points`, `daily_position`, novas `round_type` |
| Schema `competitions` admin | ✅ ACENDER | [00002_admin_leagues_competitions.sql](../supabase/migrations/00002_admin_leagues_competitions.sql) já desenhado — nunca foi plugado a motor |
| 3 divisões + promo/rele | ✅ REUSAR | Inalterado |
| All-time stats | ✅ REUSAR | Coroas viram um campo all-time também |
| Daily challenges existentes | ✅ REUSAR | Vão coexistir, não competem |
| Streak multiplier Quick | ✅ REUSAR | Continua aplicando no EXP da partida |
| Componente UI de pênaltis | ✅ REUSAR | Memória `project_penalty_prototype_state.md` — pronto |
| Função penaltis no motor | ❌ NOVO | Patch em `simulateFixture()` — Poisson + sudden death |
| Trigger zerar `daily_points` | ❌ NOVO | Job pg_cron 00:00 BRT |
| Tabela `daily_crowns` | ❌ NOVO | Migration leve |
| Tabela `tournament_champions` | ❌ NOVO | Migration leve, alimenta widget |
| Tabela `tournament_entries` | ❌ NOVO | Inscrições Premium |
| Tabela `house_cut_ledger` | ❌ NOVO | Sink rastreável |
| RPC `enter_premium_tournament()` | ❌ NOVO | Débito atômico de EXP |
| Pote em tempo real | ❌ NOVO | Realtime channel `competition_<id>` |
| UI bracket React | ❌ NOVO | `src/pages/Ligas/Bracket.tsx` (componente único reusado por Liga Global + Premium) |
| Widget "Próximos eventos" | ❌ NOVO | Componente no header/home |
| Widget "Últimas 3 Premiadas" | ❌ NOVO | Componente home |

**Resumo:** ~6 tabelas novas (todas pequenas), 1 patch em motor, 1 RPC, 4-5 componentes UI. **Zero retrabalho** no que já está em produção.

---

## 5. Modelo de Dados — Migrations Necessárias

### 5.1 Estender `global_league_teams` (ciclo diário)

```sql
-- migration: 20260602_global_league_daily_cycle.sql

ALTER TABLE public.global_league_teams
  ADD COLUMN daily_points INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN daily_goal_diff INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN daily_position INTEGER,                -- cache pra ranking 1..N global do dia
  ADD COLUMN season_crowns INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN all_time_crowns INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_global_teams_daily_rank
  ON public.global_league_teams (daily_points DESC, daily_goal_diff DESC);

CREATE TABLE public.daily_crowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.global_league_teams(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  crowned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  season_id TEXT NOT NULL,
  bracket_round_id UUID                            -- aponta pro round final daquele dia
);
CREATE INDEX idx_daily_crowns_user ON public.daily_crowns (user_id, crowned_at DESC);
CREATE INDEX idx_daily_crowns_season ON public.daily_crowns (season_id, crowned_at DESC);
```

### 5.2 Pênaltis nas fixtures existentes

```sql
ALTER TABLE public.global_league_fixtures
  ADD COLUMN penalty_score_home INTEGER,
  ADD COLUMN penalty_score_away INTEGER,
  ADD COLUMN went_to_penalties BOOLEAN NOT NULL DEFAULT false;
```

### 5.3 Acender as `competitions` para Premium

```sql
-- migration: 20260602_premium_leagues.sql

ALTER TABLE public.competitions
  ADD COLUMN cadence TEXT NOT NULL DEFAULT 'on_demand'  -- 'on_demand' | 'recurring'
                  CHECK (cadence IN ('on_demand','recurring')),
  ADD COLUMN entry_fee_exp BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN prize_pool_exp BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN min_teams INTEGER NOT NULL DEFAULT 8,
  ADD COLUMN max_teams INTEGER NOT NULL DEFAULT 32,
  ADD COLUMN house_cut_pct NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  ADD COLUMN champion_pct NUMERIC(5,2) NOT NULL DEFAULT 60.00,
  ADD COLUMN vice_pct NUMERIC(5,2) NOT NULL DEFAULT 25.00,
  ADD COLUMN registration_opens_at TIMESTAMPTZ,
  ADD COLUMN auto_start_at TIMESTAMPTZ,             -- preenchido quando atinge min_teams
  ADD COLUMN started_at TIMESTAMPTZ,
  ADD COLUMN finished_at TIMESTAMPTZ;

CREATE TABLE public.tournament_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.competitions(id),
  club_id UUID NOT NULL REFERENCES public.clubs(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  entry_fee_paid BIGINT NOT NULL DEFAULT 0,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  refunded BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (competition_id, club_id)
);
CREATE INDEX idx_tournament_entries_comp ON public.tournament_entries (competition_id);

CREATE TABLE public.tournament_champions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.competitions(id),
  club_id UUID NOT NULL REFERENCES public.clubs(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  rank INTEGER NOT NULL,
  prize_exp BIGINT NOT NULL DEFAULT 0,
  prize_paid_at TIMESTAMPTZ,
  cadence TEXT NOT NULL,
  competition_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_champions_recent ON public.tournament_champions (created_at DESC);

CREATE TABLE public.house_cut_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.competitions(id),
  amount_exp BIGINT NOT NULL,
  cadence TEXT NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_house_cut_collected ON public.house_cut_ledger (collected_at DESC);
```

### 5.4 RPC de inscrição (débito atômico)

```sql
CREATE OR REPLACE FUNCTION public.enter_premium_tournament(
  p_competition_id UUID,
  p_club_id UUID
) RETURNS public.tournament_entries
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_fee BIGINT;
  v_max INTEGER;
  v_current_count INTEGER;
  v_entry public.tournament_entries;
BEGIN
  SELECT entry_fee_exp, max_teams INTO v_fee, v_max
    FROM public.competitions
   WHERE id = p_competition_id
     AND finished_at IS NULL
   FOR UPDATE;
  IF v_fee IS NULL THEN RAISE EXCEPTION 'competition unavailable'; END IF;

  SELECT count(*) INTO v_current_count
    FROM public.tournament_entries
   WHERE competition_id = p_competition_id AND refunded = false;
  IF v_current_count >= v_max THEN RAISE EXCEPTION 'tournament full'; END IF;

  -- débito atômico (ajustar nome real da tabela de wallet)
  UPDATE public.wallets
     SET exp_balance = exp_balance - v_fee
   WHERE club_id = p_club_id AND exp_balance >= v_fee
   RETURNING exp_balance INTO v_current_count;
  IF v_current_count IS NULL THEN RAISE EXCEPTION 'insufficient EXP'; END IF;

  INSERT INTO public.tournament_entries
    (competition_id, club_id, user_id, entry_fee_paid)
  VALUES
    (p_competition_id, p_club_id, auth.uid(), v_fee)
  RETURNING * INTO v_entry;

  UPDATE public.competitions
     SET prize_pool_exp = prize_pool_exp + v_fee
   WHERE id = p_competition_id;

  RETURN v_entry;
END $$;
```

> **Ação obrigatória antes de aplicar**: confirmar o schema real de carteiras no Supabase (memórias citam `src/wallet/types.ts` no front, mas a persistência exata precisa ser checada com `list_tables`). Eu ajusto o RPC com o nome real.

---

## 6. Plano de Execução — 3 Fases

### Fase A — Liga Global ganha Ciclo Diário (5-7 dias)

**Sem cobrar nada. Sem mexer em Premium. Só o ciclo.**

**Backend**
- [ ] Migration `20260602_global_league_daily_cycle.sql` (estende `global_league_teams` + `daily_crowns`).
- [ ] Migration `20260602_global_league_penalties.sql` (3 colunas em `fixtures`).
- [ ] Patch em `simulateFixture()` ([global-league-tick/index.ts](../supabase/functions/global-league-tick/index.ts)): se `round_type IN ('daily_ko', 'season_ko')` e empate, dispara `simulateShootout()`.
- [ ] Adicionar bloco `processDailyCycle()` na máquina de estados do `global-league-tick`:
  - 00:00 BRT: zera `daily_points`, `daily_goal_diff`, `daily_position`.
  - Cada partida Quick/Live finalizada (hook no fluxo existente): incrementa `daily_points`.
  - 19:00 BRT: gera bracket top 32, cria rounds 19:30/20:00/20:30/21:00.
  - 21:30 BRT: campeão. `INSERT INTO daily_crowns`. Incrementa `season_crowns` + `all_time_crowns`.
- [ ] pg_cron job adicional pra 00:00 BRT (reset) e job de "tick de fase" (já existe, só estende).

**Frontend**
- [ ] Card "**Corrida pelo Mata-Mata Hoje**" na home: mostra posição diária geral + distância pro 32º + countdown 19:00.
- [ ] Tela `/liga-global/hoje`: ranking diário com filtro por divisão.
- [ ] Tela `/liga-global/bracket`: visualização do mata-mata (oitavas → final).
- [ ] Banner home pós-21:30: "Campeão de Hoje: @user, +1 Coroa na Season".
- [ ] Tela `/liga-global/coroas`: ranking de coroas da season + lista de campeões diários.

**Notificações**
- [ ] Push "Você está em 35º — uma vitória te coloca no mata-mata. Corte em 1h."
- [ ] Push "Seu time joga em 10 min nas oitavas — ajuste a tática."
- [ ] Push final dia: "Campeão do Olefoot Hoje: @user. Veja o bracket."

**Métrica de sucesso Fase A:** % de DAU que joga pelo menos 1 Quick/Live entre 14h-19h. Target: +30% vs baseline atual.

---

### Fase B — Ligas Premiadas em EXP (5-7 dias)

**Backend**
- [ ] Migration `20260605_premium_leagues.sql` (estende `competitions` + 3 tabelas novas + `house_cut_ledger`).
- [ ] Confirmar schema real de wallet → ajustar RPC `enter_premium_tournament()`.
- [ ] Seed dos 3 templates iniciais (Bronze Rápida, Silver Cheia, Gold Confronto).
- [ ] Edge function `premium-leagues-tick` (separada do global-league-tick por isolamento):
  - Monitora `competitions` com `cadence='on_demand'` e sem `started_at`.
  - Atinge `min_teams` → seta `auto_start_at` em 60s.
  - 60s depois → gera bracket, dispara primeiro round.
  - Reusa `simulateFixture()` + pênaltis da Fase A.
  - Final → `INSERT INTO tournament_champions` (rank 1 e 2), credita carteiras, `INSERT INTO house_cut_ledger`.
- [ ] Sempre que uma Premium termina, automaticamente cria nova instância do mesmo template (pipeline contínuo).

**Frontend**
- [ ] Tela `/premiadas`: lista das competições abertas. Cada card mostra **pote em tempo real** (Supabase Realtime).
- [ ] Modal de inscrição: confirma buyin, mostra prêmio estimado pra cada posição.
- [ ] Após inscrição: redireciona pra "Sala de Espera" com lista de inscritos + countdown.
- [ ] Reusa o componente de bracket da Fase A.
- [ ] Widget home: "**Últimas 3 Premiadas**" com avatar do campeão + prêmio + nome do template.

**A/B Test integrado**
- [ ] Template Gold com split 50/25/25 vs Silver com 60/25/15.
- [ ] Coluna `prize_split_version TEXT` em `competitions` pra marcar variante.
- [ ] Após 2 semanas: comparar **taxa de re-inscrição em 24h** entre as duas variantes.

**Métrica de sucesso Fase B:** ≥35% dos inscritos numa Premium fazem segunda inscrição em <24h.

---

### Fase C — Polimento + Hall da Fama (3-5 dias)

- [ ] Tela `/hall-da-fama`: agrega `daily_crowns` + `tournament_champions`. Filtros por período.
- [ ] Badge dinâmico no avatar: "X Coroas Olefoot" + "X Premium Vencidas".
- [ ] Recap de fim de season da Liga Global: top 3 coroas + campeão de Div 1.
- [ ] Dashboard admin lendo `house_cut_ledger`: total queimado por dia/mês/template.
- [ ] Telemetria: 8 eventos listados em [LIGAS_DIARIAS_EVOLUCAO.md §7](LIGAS_DIARIAS_EVOLUCAO.md).

---

## 7. Riscos & Calibragens (curtos)

| Risco | Mitigação |
|---|---|
| Liga Global perde foco com Coroas | **Coroas não substituem Season** — quem vence Div 1 da Season ganha título separado e maior. Marketing reforça hierarquia. |
| Inflação de EXP via prêmios Daily Cup-style | Daily não distribui EXP nenhum **agora** — só Coroas (status). Só Premium distribui EXP. Premium sempre tem house cut queimando. Razão "EXP gerado : EXP queimado" monitorada mensalmente. |
| Premium com 6 inscritos e ninguém entrando | `min_teams=8` + janela máxima (ex: 10 min de espera). Não atingiu → cancela + reembolso automático (`refunded=true` + crédito de volta). |
| Múltiplas contas burlando Premium | 1 conta por dispositivo + email confirmado + Premium grande (32 slots) torna colusão estatisticamente difícil. |
| Bracket trava em empate persistente | Patch pênaltis cobre. Sudden death garante fim em ≤8 cobranças adicionais. |
| Push virar spam | Princípio: push só pro próximo evento específico do USUÁRIO, nunca pra competição inteira. Cap de 3 push/dia/usuário. |

---

## 8. O que NÃO faz parte deste plano (e fica registrado)

- **Buyin em OLEFOOT/BRL** — fica pra Fase D futura, depois de 1-2 meses de dado do `house_cut_ledger`.
- **Ligas cross-club (5v5)** — fora de escopo.
- **Calendário com torneios temáticos** ("Copa de Sábado", "Clássicos") — pode entrar depois sobre o mesmo schema de `competitions`.
- **Redesign de layout** — preservar telas que já funcionam em produção.
- **Mudança manual de divisão** — promoção/rebaixamento continua automático ao fim da Season. Se essa for a leitura errada do seu ponto 5, me avisa.

---

## 9. Próximos passos imediatos

1. **Confirmar leitura do ponto 5 do fundador**: "ficar muito mais competitivo as 3 divisões diárias" significa **UI/visualização de corrida mais tensa**, não permitir mudança manual de divisão. Confirmar.
2. **Verificar schema real da wallet** no Supabase via `list_tables` antes de aplicar a RPC.
3. **Decidir nome marketing** das Premiadas (Bronze/Silver/Gold é descritivo; copy precisa de algo próprio do Olefoot — "Copa Relâmpago", "Olefoot Cup Bronze" etc).
4. **Start Fase A** — backend pode começar segunda-feira; frontend em paralelo depois das migrations.

> **Tese final do plano:** a maior parte do que faz esse desenho funcionar **já está construído** (motor, schema de competitions, cron, divisões, daily challenges). O trabalho real são 6 tabelas pequenas, 1 patch no motor, 1 RPC, 4-5 componentes UI e a disciplina de não inflar o escopo. Em 2 semanas a Liga Global tem ciclo diário com Coroa; em mais 1 semana as Premiadas estão queimando EXP. O resto é dado.
