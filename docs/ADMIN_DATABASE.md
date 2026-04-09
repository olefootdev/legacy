# Base de dados Admin / onboarding — Olefoot (Supabase)

Este documento acompanha a migration **`supabase/migrations/00003_admin_platform_schema.sql`**, desenhada em cima do que já existe em **`00001_initial_schema.sql`** (perfil, clube de **jogo**, plantel, partidas) e **`00002_admin_leagues_competitions.sql`** (épocas e competições de jogo).

---

## BLOCO 1 — Diagnóstico e modelagem

### Lógica geral

- **`public.clubs`** continua a ser o **clube gerido no jogo** (motor, `profiles.club_id`, competições 00002).
- **`sports_leagues` / `sports_clubs`** são o **catálogo real** (import JSON do Admin, Cadastro) — nomes com prefixo `sports_` para nunca colidir com o clube de jogo.
- **`profiles`** (já existente) estende-se com **`onboarding_status`**, **`display_name`** e **`sports_club_id`** (clube real escolhido). Mantém-se **`club_id`** para o clube de jogo.
- **`public.players`** (00001) mantém-se para **plantel** ligado a `clubs`. O Create Player no Admin ganha **`player_blueprints`** (rascunhos/templates), separado do plantel.
- **Game Spirit** ganha tabelas **normais + `payload` JSONB** onde o formato ainda evolui; **`game_spirit_snapshots`** permite import/export compatível com o blob actual em `localStorage`.
- **`game_saves`** guarda **JSONB** do estado (`OlefootGameState` ou versão futura), com **slots** por utilizador.
- **Financeiro** usa **`finance_ledger_entries`** alinhado a `PlatformLedgerKind` / linhas do painel Financeiro (sem duplicar toda a contabilidade na v1).
- **Sessão local (Admin):** **não** há tabela dedicada — continua no browser; para auditoria futura, usar **`sports_data_imports`** ou logs no servidor.

### Essenciais agora

| Área | Tabelas |
|------|---------|
| Onboarding / Sports Data | `sports_leagues`, `sports_clubs`, `sports_data_imports` + colunas em `profiles` |
| Utilizador / settings | `user_settings`, `platform_accounts` (migração futura do painel Usuários) |
| Create Player | `player_blueprints` |
| Game Spirit | `game_spirit_profiles`, `game_spirit_rules`, `game_spirit_templates`, `game_spirit_knowledge`, `game_spirit_snapshots` |
| Save | `game_saves` |
| Banners | `admin_banners` |
| Financeiro | `finance_ledger_entries` |

### Opcionais / fase 2

- Particionar `finance_ledger_entries` por mês; materializar agregados para o painel Resumo.
- Normalizar `platform_accounts.payload` em colunas (BRO, OLE, OLEXP…) quando o produto estabilizar.
- `ltree` ou full-text em `sports_clubs` se a busca no Admin crescer.
- Ligação explícita `player_blueprints` → `public.players` ao “publicar” no plantel.

### Sem persistência em SQL (por agora)

- **Sessão local** do Admin (estado só no browser).
- **Resumo** agregado: derivado de queries ou cache, não tabela própria na v1.

---

## BLOCO 2 — SQL completo

O SQL executável está em:

**`supabase/migrations/00003_admin_platform_schema.sql`**

Inclui:

- `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- FKs para `auth.users` e entre tabelas novas
- `CHECK` em estados e enums lógicos (texto)
- Índices para listagens Admin e onboarding
- Função + triggers `updated_at` onde há `updated_at`
- **RLS** habilitado; leitura pública **anon + authenticated** só em `sports_*` activos e `admin_banners` activos no intervalo de datas
- **Grants** mínimos para `anon` / `authenticated`

Aplicar com:

```bash
npx supabase db push
# ou SQL Editor no dashboard (colar o ficheiro)
```

---

## BLOCO 3 — Tipos e domínio

### Convenções de nomenclatura

- **Snake_case** em SQL; prefixo **`sports_`** para catálogo real.
- **IDs:** `uuid` gerados com `gen_random_uuid()`; **`external_id`** (texto) para upsert estável vindo do JSON (`SportsLeague.id`, `SportsClub.id`).
- **Timestamps:** `timestamptz`, `created_at` / `updated_at` onde faz sentido.
- **JSONB:** `metadata`, `payload`, `content`, `state` — evitar pôr tudo em JSON; colunas usadas em `WHERE`/`JOIN` ficam tipadas.

### Estados principais (CHECK / texto)

| Campo | Valores |
|-------|---------|
| `profiles.onboarding_status` | `pending`, `in_progress`, `completed`, `skipped` |
| `player_blueprints.status` | `draft`, `published`, `archived` |
| `admin_banners.status` | `draft`, `scheduled`, `active`, `archived` |
| `admin_banners.position` | `home`, `wallet`, `matchday`, `global` |
| `platform_accounts.status` | `active`, `suspended` |
| `sports_data_imports.source` | `admin_json`, `api`, `seed`, `manual` |
| `finance_ledger_entries.kind` | `fiat_deposit`, `fiat_withdrawal`, `treasury_adjust`, `user_balance_adjust`, `exp_grant`, `exp_spend`, `transfer_fee`, `other` |
| `finance_ledger_entries.flow_status` | `processing`, `completed`, `failed` (opcional) |

### Obrigatório vs opcional (resumo)

- **Obrigatório na escrita:** chaves naturais de negócio (`external_id` em ligas; `(league_id, external_id)` em clubes); `user_id` + `slot_index` em `game_saves`; `state` JSONB não vazio na prática.
- **Opcional:** `logo_url`, `portrait_url`, intervalos de banner, `checksum` em save, `created_by` onde o sistema insere.

---

## BLOCO 4 — Plano de evolução

### Agora (v1)

- Correr migration 00003; popular `sports_*` a partir do mesmo formato que `sportsDataSeed.json` / import Admin.
- Ligar Cadastro a `select` em `sports_leagues` / `sports_clubs` (anon OK para catálogo activo).
- Game Spirit: opcionalmente sincronizar snapshots a partir do export actual do Admin.

### Fase 2

- RLS mais fina em Game Spirit (ex. só `published`); coluna `published_at` em snapshots/templates.
- Políticas `authenticated` para escrita em `sports_*` apenas para role `admin` (via `app_metadata` em JWT, **não** `user_metadata`).
- Particionamento / arquivo de `finance_ledger_entries` e `game_spirit_snapshots`.
- Trigger ou job para manter `platform_accounts.payload` coerente com o ledger.

### Sem quebrar a base

- Novas colunas com `DEFAULT` e `IF NOT EXISTS`.
- Novos `kind` em ledger: estender `CHECK` ou migrar para tabela de tipos.
- `game_saves.schema_version` + migrações de estado no cliente antes de reescrever JSON.

---

## Segurança (lembrete)

- **Service role** só no servidor; nunca no bundle Vite/Expo.
- Autorização séria: **`app_metadata` / RLS**, não `user_metadata` (editável pelo utilizador).
- Tabelas novas têm **RLS ON**; escritas Admin sensíveis devem passar por **API com service_role** até as políticas estarem maduras.

---

## Referência rápida de ficheiros

| Ficheiro | Conteúdo |
|----------|----------|
| `00001_initial_schema.sql` | `profiles`, `clubs`, `players`, `matches`, `match_events` |
| `00002_admin_leagues_competitions.sql` | Épocas, competições, fixtures (clube = jogo) |
| `00003_admin_platform_schema.sql` | Admin / onboarding / blueprints / spirit / saves / banners / ledger |
