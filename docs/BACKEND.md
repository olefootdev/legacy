# Backend OLEFOOT

API HTTP mínima em **Node + Hono** que usa o **Supabase** (service role) para persistir estado do jogo.

## Estrutura

```
server/
├── .env.example          # variáveis servidor (copiar para .env)
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts           # bootstrap Hono + CORS
    ├── lib/
    │   └── supabaseAdmin.ts   # client service_role (nunca exposto ao browser)
    └── routes/
        ├── health.ts      # GET /health
        └── matches.ts     # POST /matches, POST /matches/:id/events

supabase/
├── config.toml            # projeto toyyjdfabddcxaxysmun
└── migrations/
    └── 00001_initial_schema.sql   # profiles, clubs, players, matches, match_events + RLS
```

## Pré-requisitos

- Node ≥ 18
- npm
- [Supabase CLI](https://supabase.com/docs/guides/cli) (para migrations)

## 1. Configurar variáveis

```bash
# Na raiz (client Vite)
cp .env.example .env
# Preencher VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY

# No servidor
cp server/.env.example server/.env
# Preencher SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

> **Nunca** commitar `.env` — o `.gitignore` já os exclui.

## 2. Supabase — link e migrations

```bash
# Linkar ao projecto (precisa de login prévio: npx supabase login)
npx supabase link --project-ref toyyjdfabddcxaxysmun

# Aplicar migrations ao Supabase remoto
npx supabase db push

# (Opcional) Gerar tipos TypeScript a partir do schema
npx supabase gen types typescript --linked > src/supabase/database.types.ts
```

## 3. Instalar e correr a API

```bash
cd server
npm install
npm run dev        # tsx watch — reinicia ao editar
```

A API arranca em `http://localhost:4000` (ou `PORT` definido em `.env`).

### Endpoints

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/health` | Heartbeat — `{ status: "ok", ts }` |
| `POST` | `/matches` | Cria partida — body: `{ mode, home_club_id, away_club_id? }` |
| `POST` | `/matches/:id/events` | Insere evento — body: `{ type, minute, payload? }` |

### Exemplo rápido

```bash
# Health
curl http://localhost:4000/health

# Criar partida
curl -X POST http://localhost:4000/matches \
  -H "Content-Type: application/json" \
  -d '{"mode":"live","home_club_id":"UUID_DO_CLUBE"}'

# Inserir evento
curl -X POST http://localhost:4000/matches/MATCH_UUID/events \
  -H "Content-Type: application/json" \
  -d '{"type":"GOAL","minute":34,"payload":{"scorer":"player_uuid"}}'
```

## 4. Build de produção

```bash
cd server
npm run build      # compila para server/dist/
npm start          # node dist/index.js
```

## Schema SQL resumido

| Tabela | Chave | Relações |
|---|---|---|
| `clubs` | `id uuid` | — |
| `profiles` | `id uuid` (= `auth.users.id`) | → `clubs.id` |
| `players` | `id uuid` | → `clubs.id` |
| `matches` | `id uuid` | → `clubs.id` (home + away) |
| `match_events` | `id uuid` | → `matches.id` |

RLS habilitado em todas. Políticas usam `public.my_club_id()` para filtrar por `profiles.club_id` do utilizador autenticado.

## Variáveis de ambiente

| Var | Onde | Obrigatória |
|---|---|---|
| `VITE_SUPABASE_URL` | Client (Vite bundle) | Sim (para persistir do browser) |
| `VITE_SUPABASE_ANON_KEY` | Client (Vite bundle) | Sim |
| `SUPABASE_URL` | `server/.env` | Sim |
| `SUPABASE_SERVICE_ROLE_KEY` | `server/.env` | Sim |
| `DATABASE_URL` | `server/.env` | Não (futuro) |
| `PORT` | `server/.env` | Não (default 4000) |
| `CORS_ORIGIN` | `server/.env` | Não (default `http://localhost:3000`) |
