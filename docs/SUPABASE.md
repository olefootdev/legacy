# Supabase — OLEFOOT

## Visão geral

O Supabase persiste estado de jogo relevante: utilizadores, clubes, plantéis, partidas e eventos de partida.  
A persistência é **opcional no MVP** — sem `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, o jogo funciona normalmente com localStorage.

## Variáveis de ambiente

| Variável | Onde | Descrição |
|---|---|---|
| `VITE_SUPABASE_URL` | Client (bundle) | URL do projecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Client (bundle) | Chave pública (anon) — segura, RLS protege |
| `SUPABASE_SERVICE_ROLE_KEY` | Servidor / CI **apenas** | Chave privilegiada — nunca no bundle |
| `DATABASE_URL` | Servidor / CI **apenas** | Ligação direta ao PostgreSQL |

Copiar `.env.example` para `.env` e preencher.

## Schema (migrations)

```
supabase/migrations/00001_initial_schema.sql   — perfil, clube de jogo, plantel, partidas
supabase/migrations/00002_admin_leagues_competitions.sql — épocas, competições, fixtures
supabase/migrations/00003_admin_platform_schema.sql    — catálogo sports, onboarding, blueprints, spirit, saves, banners, ledger
```

**00001 — núcleo jogo**

- **`profiles`** — FK `auth.users`, `club_id` (clube de jogo); a partir de 00003 também `onboarding_status`, `sports_club_id`, `display_name`
- **`clubs`** — clube gerido no jogo
- **`players`** — plantel: `club_id`, atributos em JSONB, `schema_version`
- **`matches`**, **`match_events`** — partidas e eventos append-only

**00002** — temporadas, divisões, competições, classificações, fixtures (sempre referenciando **`clubs` de jogo**).

**00003** — Admin / onboarding: **`sports_leagues`**, **`sports_clubs`**, **`user_settings`**, **`platform_accounts`**, **`player_blueprints`**, Game Spirit, **`game_saves`**, **`admin_banners`**, **`finance_ledger_entries`**. Ver [ADMIN_DATABASE.md](./ADMIN_DATABASE.md).

RLS habilitado; políticas variam por tabela (catálogo sports e banners activos legíveis por `anon`/`authenticated` onde indicado na migration).

## Aplicar migrations

```bash
# Instalar CLI (se necessário)
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF

# Aplicar
npx supabase db push

# Gerar tipos (substitui database.types.ts)
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
