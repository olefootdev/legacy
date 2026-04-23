# GameSpirit — Migração OpenAI → Anthropic + Catálogo Offline

Doc-vivo: serve de fonte-única pra essa refatoração grande. Atualiza
conforme avançamos.

## Motivação

1. **Custo linear com usuários é insustentável**. Hoje cada partida emite
   20–40 beats narrativos que batem OpenAI em tempo real. A 5k usuários ativos,
   estima-se $18k–36k/mês só em narração de partida.
2. **Claude é melhor pra o que o GameSpirit precisa**: storytelling, voz de
   personagem, contexto longo, persona estável. Para decisões determinísticas
   simples, Haiku é rápido e barato.
3. **Independência de vendor**. Ter Anthropic como único provedor simplifica
   billing, SDK, prompts e tooling (nosso ambiente de desenvolvimento já é
   Claude-nativo).

## Princípio arquitetural

> **Geração offline. Consumo determinístico. Online só pra enriquecimento.**

- **Partida** nunca bate API. Consome catálogo pré-gerado.
- **Geração de catálogo** acontece via admin (botão) ou cron semanal.
- **Chamadas online** ficam reservadas para: Create Player, Growth Analyst,
  Teach, Position Coach, crônica pós-partida (tudo on-demand, usuário clica).

## Mapeamento atual (OpenAI)

### (A) Substituir por catálogo offline — zero API em partida

| Chamada | Arquivo | Ação |
|---|---|---|
| Narração de gol/vermelho | `server/src/routes/narrativeMoment.ts:82` | Consumir `narrative_templates` do Supabase |
| Narração de beat (parte do `getGameDecision`) | `server/src/services/openai/getGameDecision.ts:102` | Separar `narration` do `decision` — narração vai pra catálogo, decisão continua como LLM call (ou cai no fallback local que já existe) |

### (B) Migrar para Anthropic (Sonnet/Haiku) — on-demand

| Chamada | Arquivo | Modelo novo |
|---|---|---|
| GameSpirit Decision (tática) | `getGameDecision.ts:102` | Haiku 4.5 (decisão curta, cache 15s) |
| Create Player (persona) | `gameSpirit.ts:95` | Sonnet 4.6 (compreensão de prompt natural) |
| Growth Analyst | `gameSpirit.ts:160` | Sonnet 4.6 (análise numérica + narrativa) |
| Teach (3 kinds) | `gameSpirit.ts:225` | Haiku 4.5 (JSON estruturado simples) |
| Position Coach | `positionCoach.ts:302` | Sonnet 4.6 (DNA por posição, contexto longo) |

### (C) Remover

| Chamada | Arquivo | Motivo |
|---|---|---|
| verify-openai | `server/scripts/verify-openai.ts` | Substituir por `verify-anthropic.ts` equivalente |

## Arquitetura — catálogo offline

### Fluxo

```
┌──────────────────────────────────────┐    ┌───────────────────────────┐
│  Admin clica "Gerar narrativas"      │    │  Partida (test2d/quick)    │
│  ou cron semanal (Cloudflare)        │    │                            │
│            ↓                         │    │  Motor detecta beat        │
│  Script chama Anthropic em batch     │    │       ↓                    │
│  Gera ~1500 templates variados       │    │  pickNarrative(category,   │
│            ↓                         │    │                context)    │
│  Grava em narrative_templates        │──→ │       ↓                    │
│  (Supabase)                          │    │  Template + variáveis      │
│                                      │    │  → string final            │
└──────────────────────────────────────┘    └───────────────────────────┘
     custo previsível: ~$1.15/geração            custo zero (JS local)
```

### Schema Supabase — `narrative_templates`

```sql
create table public.narrative_templates (
  id uuid primary key default gen_random_uuid(),
  category text not null,         -- 'goal', 'shot_saved', 'foul_yellow', ...
  intensity text not null,        -- 'low' | 'medium' | 'high' | 'world_class'
  context_tags text[],            -- ['last_minute','rival','comeback']
  template text not null,         -- "{player} arrisca de fora — {outcome}"
  variables jsonb,                -- { outcome: ['morre no poste', 'beija a rede'], ... }
  persona_vibe text,              -- 'analytical' | 'visceral' | 'poetic' | 'casual'
  generated_at timestamptz default now(),
  batch_id uuid,
  usage_count int default 0,
  quality_rating numeric default 0.5
);

create index idx_templates_category_intensity
  on public.narrative_templates (category, intensity);
create index idx_templates_batch on public.narrative_templates (batch_id);
```

### Taxonomia V1

| Categoria | Intensidades | Templates | Total |
|---|---|---|---|
| `goal` | normal, late, world_class, comeback, own_goal | 40 | 200 |
| `shot_saved` | routine, good, world_class | 20 | 60 |
| `shot_missed` | close, wild | 15 | 30 |
| `foul_yellow` | tactical, rash, last_man | 15 | 45 |
| `foul_red` | dangerous, second_yellow | 10 | 20 |
| `substitution` | fresh_legs, injury_forced, tactical | 10 | 30 |
| `momentum_shift` | home_rising, away_rising | 10 | 20 |
| `half_time` | winning, losing, drawing | 10 | 30 |
| `full_time` | thriller, goalless, rout | 15 | 45 |
| `pressure_moment` | last_5_min, penalty_incoming | 10 | 20 |

Aproximadamente **500 templates × 3 persona_vibes = 1500 linhas** cobrem
quase tudo. Catálogo cresce com refreshes semanais (nunca substitui).

### Gatilhos de geração

1. **Admin button** — Painel admin tem "Narrativas" com botão "Gerar novo
   batch". Permite escolher categorias, quantidade, vibe. Insere novo
   `batch_id`; os antigos entram em rotação de menor prioridade.

2. **Cron semanal** — Cloudflare Workers schedule (`[triggers] crons` em
   `wrangler.toml`). Toda segunda 3h UTC, "refresh" das categorias mais
   usadas (`usage_count` alto merece mais variedade pra não repetir).

3. **Sob demanda em partida especial** — desativado por padrão. Exceção:
   final de temporada pode rodar regeneração pré-jogo.

### Runtime — `pickNarrative()`

`src/gamespirit/narrativeCatalog.ts`:

```ts
export async function hydrateNarrativeCatalog(): Promise<void>
export function pickNarrative(
  category: NarrativeCategory,
  context: NarrativeContext,
  seed: number,  // simulationSeed pra lockstep
): string
```

- Hidrata uma vez ao montar partida (1 fetch Supabase).
- Escolha **determinística** usando `simulationSeed` — crítico pra futuro
  lockstep multiplayer.
- Prioriza templates menos usados e com maior `quality_rating`.
- Preenche variáveis via token replacement `{player}`, `{minute}`, etc.

### Fallback hardcoded

`src/gamespirit/narrativeCatalogFallback.ts` contém 20–30 templates por
categoria em memória. Se Supabase falhar ou catálogo estiver vazio, usa
isto. Jogo **nunca** fica sem narração por falha de infra.

## Arquitetura — Anthropic SDK

### Estrutura

```
server/
├── src/
│   ├── lib/
│   │   ├── anthropic.ts           (novo — wrapper unificado)
│   │   └── openAiError.ts         (mantido temporariamente — deletar no fim)
│   ├── services/
│   │   └── anthropic/             (novo)
│   │       ├── client.ts
│   │       ├── getGameDecision.ts (substitui services/openai/)
│   │       ├── generatePlayerPersona.ts
│   │       ├── growthAnalyst.ts
│   │       ├── teach.ts
│   │       ├── positionCoach.ts
│   │       └── narrativeCatalog.ts (batch generator)
│   └── routes/
│       ├── gameSpirit.ts          (migrado)
│       ├── narrativeMoment.ts     (deprecado? ou redirecionar pra catálogo)
│       └── positionCoach.ts       (migrado)
└── scripts/
    ├── verify-anthropic.ts        (novo)
    └── generate-narrative-catalog.ts (novo — admin run)
```

### Wrapper `anthropic.ts`

```ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const MODELS = {
  sonnet: 'claude-sonnet-4-6' as const,
  haiku: 'claude-haiku-4-5-20251001' as const,
};

export async function callAnthropic<T>(opts: {
  model: keyof typeof MODELS;
  system: string;
  user: string;
  jsonSchema?: object;
  maxTokens?: number;
  temperature?: number;
}): Promise<T>
```

Features: error handling unificado, cache opcional, validação JSON.

## Custo estimado pós-migração

**Catálogo offline**:
- Geração inicial completa (1500 templates): ~$1.15 com Haiku batch
- Refresh semanal parcial (~300): $0.30/semana = $1.20/mês
- **Total narrativa: ~$2.35/mês**, independente de usuários

**On-demand (média por ação, Sonnet predominante)**:
| Ação | Custo por chamada | Frequência estimada |
|---|---|---|
| GameSpirit Decision (tática) | $0.001 (Haiku + cache) | 1–2/partida |
| Create Player | $0.03 (Sonnet) | ~10/dia admin |
| Growth Analyst | $0.02 (Sonnet) | ~1/dia |
| Teach | $0.005 (Haiku) | ~5/dia admin |
| Position Coach | $0.02 (Sonnet) | ~20/dia |

**Total on-demand**: ~$20–30/mês em uso de admin + ~$100/mês em
decisões táticas se 10k partidas/dia (cache reduz muito).

**Comparação**:
- Hoje: $600–36.000/mês (escala com usuários)
- Pós-migração: $30–150/mês (pisos praticamente fixos)

## Fases de implementação

### Fase 1 — Infra Anthropic (1 dia)

- [ ] `npm install @anthropic-ai/sdk` no server
- [ ] `server/src/lib/anthropic.ts` — wrapper
- [ ] `.env`: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL_SONNET`, `ANTHROPIC_MODEL_HAIKU`
- [ ] `server/scripts/verify-anthropic.ts` — utilitário
- [ ] Teste básico: chamar Haiku de hello world

### Fase 2 — Catálogo offline (3 dias)

- [ ] Migration Supabase `narrative_templates`
- [ ] RPCs: `insert_narrative_batch`, `get_narrative_templates`, `admin_delete_narrative_batch`
- [ ] Script `server/scripts/generate-narrative-catalog.ts` — lê categorias do arquivo config, gera batch via Anthropic Haiku, insere em Supabase
- [ ] Fallback hardcoded `src/gamespirit/narrativeCatalogFallback.ts`
- [ ] Runtime `src/gamespirit/narrativeCatalog.ts` com `pickNarrative()` + hidratação
- [ ] Integração: `getGameDecision.ts` e `narrativeMoment.ts` consumem catálogo em vez de OpenAI
- [ ] Admin panel "Narrativas": botão gerar + preview + estatísticas

### Fase 3 — Migrar on-demand (2 dias)

- [ ] `generatePlayerPersona.ts` (Sonnet) — troca em `gameSpirit.ts:95`
- [ ] `growthAnalyst.ts` (Sonnet) — troca em `gameSpirit.ts:160`
- [ ] `teach.ts` (Haiku) — troca em `gameSpirit.ts:225`
- [ ] `positionCoach.ts` (Sonnet) — troca em `positionCoach.ts:302`
- [ ] `getGameDecision.ts` (Haiku, só decisão — narração já foi pro catálogo) — troca em `services/openai/`

### Fase 4 — Remover OpenAI (0.5 dia)

- [ ] `npm uninstall openai` no server
- [ ] Deletar `server/src/services/openai/`
- [ ] Deletar `server/src/lib/openAiError.ts`
- [ ] Deletar `server/scripts/verify-openai.ts`, `test-openai.ts`, `test-openai-http.ts`
- [ ] Remover `OPENAI_*` de `.env.example`
- [ ] Remover scripts npm `verify-openai`, `test:openai`, `test:openai:http`
- [ ] Grep final: confirmar zero menção a `openai` no código

### Fase 5 — Cron semanal (0.5 dia)

- [ ] `wrangler.toml` → adicionar `[triggers] crons = ["0 3 * * 1"]`
- [ ] Worker handler `scheduled()` chama geração parcial
- [ ] Log de batches no Supabase pra auditoria

## Loop de melhoria (pós-lançamento)

1. Manager dá thumbs up/down em narrativas no feed da partida.
2. `quality_rating` ajusta por exponential moving average.
3. Templates com rating < 0.3 após 50+ usos são marcados pra regeneração.
4. Admin vê ranking de templates ruins e pode aprovar/rejeitar regeneração
   em batch.

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Repetição percebida | Cron semanal amplia catálogo (cresce, não substitui). Rotação por `usage_count`. |
| Qualidade inicial baixa | Primeiro batch curado manualmente (revisar 100 templates "core" antes de lançar). |
| Variáveis não batem contexto | Tags de contexto + validação runtime (esconder template se variável não preencheu). |
| Cold start de catálogo no deploy | Fallback hardcoded sempre ativo; catálogo via Supabase hidrata depois. |
| Regressão de qualidade de persona (OpenAI→Claude) | Suíte de prompts de teste rodada antes de trocar em prod; admin pode reverter. |

## Variáveis de ambiente

```
# server/.env (produção)
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL_SONNET=claude-sonnet-4-6
ANTHROPIC_MODEL_HAIKU=claude-haiku-4-5-20251001

# legacy — remover após Fase 4:
OPENAI_API_KEY=
OPENAI_MODEL=
OPENAI_GAMESPIRIT_MODEL=
```

## Observações finais

- **Lockstep multiplayer**: `pickNarrative()` usa `simulationSeed` — 2
  clientes com mesmo seed e contexto escolhem o mesmo template. Crítico
  pra manter determinismo quando entrar multiplayer.
- **GameSpirit com "espírito" (item 2 do brief do founder)**: memória
  entre partidas + persona do manager influenciando tom do catálogo. Fica
  pra fase seguinte desta migração, uma vez que a arquitetura pré-gerada
  facilita: persona do manager pode ser um **filtro** sobre `persona_vibe`
  dos templates.
- **Legends DNA (item 3)**: herda infra de Anthropic direto. Quando a
  Fase 3 terminar, migrar Legends é copiar `positionCoach.ts` e adaptar.
- **Create Player pipeline (item 4)**: depois da Fase 3, temos todos os
  agentes necessários (scout, atributos, bio, valuation). Constrói
  fluxo UI ligando-os.
