# Supabase — OLEFOOT

## Visão geral

O Supabase persiste estado de jogo relevante: utilizadores, clubes, plantéis, partidas e eventos de partida.  
A persistência é **opcional no MVP** — sem `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, o jogo funciona normalmente com localStorage.

## MCP (Cursor / IDE)

Configuração do servidor MCP Supabase (HTTP + `project_ref`): [SUPABASE_MCP.md](./SUPABASE_MCP.md).

## Variáveis de ambiente

| Variável | Onde | Descrição |
|---|---|---|
| `VITE_SUPABASE_URL` | Client (bundle) | URL do projecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Client (bundle) | Chave pública (anon) — segura, RLS protege |
| `SUPABASE_SERVICE_ROLE_KEY` | Servidor / CI **apenas** | Chave privilegiada — nunca no bundle |
| `GAMESPIRIT_AI_LOG_SUPABASE` | Servidor | `1` para gravar decisões OpenAI em `game_spirit_ai_logs` (migration 00004) |
| `DATABASE_URL` | Servidor / CI **apenas** | Ligação direta ao PostgreSQL |

Copiar `.env.example` para `.env` e preencher.

## Connection string (PostgreSQL)

Para **psql**, **Drizzle/Prisma**, ou ferramentas que falem **TCP direto** com o Postgres (não confundir com a URL da API REST nem com `VITE_SUPABASE_URL`):

1. Dashboard Supabase → **Project Settings** → **Database**.
2. Em **Connection string**, escolhe o modo **URI** e copia o modelo com `postgresql://postgres:[YOUR-PASSWORD]@db.<project_ref>.supabase.co:5432/postgres`.
3. Define a password da base em **Database password** (se ainda não tiveres, redefine lá).
4. Guarda só em **`server/.env`** (ou CI secreto) como `DATABASE_URL=...`. **Nunca** no `.env` da raiz do Vite nem no repositório.

**IPv4:** Se o painel avisar que o host **direct** (porta `5432`) **não é compatível com IPv4**, usa a secção **Pooler** → **Session pooler** (ou Transaction pooler) e copia o host/porta/utilizador que o dashboard mostrar — costuma ser o caminho certo em redes residenciais só IPv4. Alternativa: add-on IPv4 pago, conforme o teu plano.

A app web Olefoot em geral **não precisa** de `DATABASE_URL`: basta `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` e, no servidor Node, `SUPABASE_SERVICE_ROLE_KEY` para operações privilegiadas.

## Agent Skills (opcional)

Para skills oficiais Supabase no Cursor/Claude: `npx skills add supabase/agent-skills` (o repo já pode ter `.agents/skills/supabase/`). Ver [SUPABASE_MCP.md](./SUPABASE_MCP.md).

## Schema (migrations)

```
supabase/migrations/00001_initial_schema.sql   — perfil, clube de jogo, plantel, partidas
supabase/migrations/00002_admin_leagues_competitions.sql — épocas, competições, fixtures
supabase/migrations/00003_admin_platform_schema.sql    — catálogo sports, onboarding, blueprints, spirit, saves, banners, ledger
supabase/migrations/00004_online_game_persistence.sql  — alinha matches/eventos/plantel ao motor; logs OpenAI (`game_spirit_ai_logs`)
```

**00001 — núcleo jogo**

- **`profiles`** — FK `auth.users`, `club_id` (clube de jogo); a partir de 00003 também `onboarding_status`, `sports_club_id`, `display_name`
- **`clubs`** — clube gerido no jogo
- **`players`** — plantel: `club_id`, atributos em JSONB, `schema_version`
- **`matches`**, **`match_events`** — partidas e eventos append-only

**00002** — temporadas, divisões, competições, classificações, fixtures (sempre referenciando **`clubs` de jogo**).

**00003** — Admin / onboarding: **`sports_leagues`**, **`sports_clubs`**, **`user_settings`**, **`platform_accounts`**, **`player_blueprints`**, Game Spirit, **`game_saves`**, **`admin_banners`**, **`finance_ledger_entries`**. Ver [ADMIN_DATABASE.md](./ADMIN_DATABASE.md).

**00004** — Partidas online: colunas em **`matches`** (`away_name`, `simulation_seed`, `post_match_data`), **`mode`** com `test2d`, **`match_events.kind`**, plantel alinhado ao motor, **`game_spirit_ai_logs`** (sem políticas públicas — só backend).

RLS habilitado; políticas variam por tabela (catálogo sports e banners activos legíveis por `anon`/`authenticated` onde indicado na migration).

## Aplicar migrations (“subir o banco”)

Na **raiz do repo**, com a conta Supabase que **é dona** do projeto:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

- **`YOUR_PROJECT_REF`:** Settings → General → Reference ID (ex. `xtuveikgwlgbcleloxia`).
- Se `link` der erro de **privilégios**, confirma que fizeste login com o utilizador certo (`npx supabase projects list`).
- O ficheiro **`supabase/config.toml`** usa `project_id` (local) no formato atual da CLI; não uses o bloco antigo `[project]` com `id`.

**Sem CLI:** Dashboard → **SQL** → colar e executar, **por ordem**, `00001` … `00004` em `supabase/migrations/`.

Depois do `db push`, tipos TypeScript (opcional):

```bash
npx supabase gen types typescript --linked > src/supabase/database.types.ts
```

## Integração no fluxo do jogo

| Momento | O que acontece |
|---|---|
| `START_LIVE_MATCH` | `insert` em `matches` (status `live`) |
| `SIM_SYNC` (cada minuto) | Novos `MatchEventEntry` enfileirados em batch (flush a cada 3 s) |
| `FINALIZE_MATCH` | `update` em `matches` (status `finished`, placar, `post_match_data`); `upsert` de todos os jogadores |

Todas as chamadas são fire-and-forget (não bloqueiam o reducer síncrono).

## Partida ao vivo — sem motor de história

O modo `live` **não** usa `GameSpirit` / `storyMotor` / `advanceLiveStoryMinute` para decidir placar.  
A fonte de verdade é o **`TacticalSimLoop`**: cada agente (Yuka + `AgentBrain` / `PlayerDecisionEngine`) decide, a bola voa com o `BallSystem`, remates são resolvidos em `ActionResolver` → golos reais.  
O Babylon renderiza o `MatchTruthSnapshot`; nenhuma decisão de golo vive no render.

## Ficheiros tocados

```
.env.example                              — vars Supabase adicionadas
vite.config.ts                            — chunk split @supabase
supabase/config.toml                      — config Supabase CLI
supabase/migrations/00001_initial_schema.sql
src/supabase/client.ts                    — createClient wrapper
src/supabase/database.types.ts            — tipos manuais (substituir por gen)
src/supabase/matchPersistence.ts          — insertMatch / queueMatchEvents / finalizeMatch / persistPlayers
src/engine/types.ts                       — +supabaseMatchId em LiveMatchSnapshot
src/entities/types.ts                     — PastResult sem campos de story
src/game/reducer.ts                       — wire Supabase; limpeza GameSpirit no live
src/simulation/TacticalSimLoop.ts         — removido spirit score authority + beat hints
src/components/MatchBabylonLayer.tsx       — removido spiritPendingRestart
src/pages/LiveMatch.tsx                   — removido halftime story + prematch panel
src/engine/matchSession.ts               — comentário atualizado
```
