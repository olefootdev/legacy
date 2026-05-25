# OLEFOOT PYTHON MODE — Insights Service

Camada de inteligência analítica do Olefoot. Consome as tabelas
`club_consequences`, `manager_presence` e `manager_login_bonus_claims`
do Supabase pra entregar projeções, agregações e narrativas que o cliente
TS sozinho não conseguiria computar eficientemente.

## Endpoints (MVP)

| Método | Path | Descrição |
|---|---|---|
| GET | `/health` | Status do serviço + flags de config |
| GET | `/club/{manager_id}/consequences` | Lista consequências ativas agrupadas por dimensão |
| GET | `/club/{manager_id}/summary` | Contagens + alertas + jogador mais impactado |
| GET | `/club/{manager_id}/night-report` | Resumo do que aconteceu nas últimas 10h (slot 5:30 BRT) |

Todos os endpoints exigem JWT do Supabase no header `Authorization: Bearer <token>`.
O `manager_id` no path tem que bater com o `sub` do JWT (anti-IDOR).

## Stack

- Python 3.11+
- FastAPI 0.115
- httpx (cliente Supabase REST/PostgREST)
- PyJWT (verificação de tokens)
- Pydantic 2 (schemas)

## Local dev

```bash
cd insights/
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# preenche SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET
uvicorn app.main:app --reload --port 4001
```

Docs interativos: `http://localhost:4001/docs`

## Dev mode sem JWT

Se você deixar `SUPABASE_JWT_SECRET=""` no `.env`, o serviço aceita
`X-Manager-Id: <uuid>` direto no header (sem verificar token).
**Nunca rode assim em produção.**

## Deploy Railway

```bash
cd insights/
railway link    # vincula projeto
railway up      # build + deploy
```

Variáveis no Railway (Project → Variables):

| Variável | Origem |
|---|---|
| `SUPABASE_URL` | Supabase: Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase: Project Settings → API → service_role (secret) |
| `SUPABASE_JWT_SECRET` | Supabase: Project Settings → API → JWT Secret |
| `CORS_ORIGINS` | Lista comma-separated: `https://olefoot.com,http://localhost:5173` |

## Arquitetura

```
[Browser/TS client]
       ↓ Authorization: Bearer <supabase JWT>
[Hono server  /api/insights/*]   ← proxy + autenticação centralizada
       ↓ X-Manager-Id ou JWT
[Python /insights  (este serviço)]
       ↓ service_role
[Supabase Postgres]
       - club_consequences
       - manager_presence
       - manager_login_bonus_claims
```

O Hono valida o token e proxia. O Python usa service_role pra bypassar RLS
(porque já filtra por `manager_id` derivado do JWT — controle de acesso em
nível de app).

## Tests

```bash
cd insights/
pytest tests/
```

Mínimo: testa decay match com o TS (step / linear / exponential).

## Sincronismo com TS

A lógica de decay (`app/decay.py`) DEVE espelhar
`src/systems/consequences/store.ts::evaluateConsequence`. Se mudar uma,
muda a outra — senão UI mostra um valor e o servidor outro.

Testes de paridade: ver `tests/test_decay.py`.

## Próximos endpoints (não no MVP)

- `GET /squad/{manager_id}/rotation-plan?next_hours=6` — sugestão de
  rotação minimizando fadiga
- `GET /player/{player_id}/risk-now` — probabilidade de lesão
- `GET /player/{player_id}/evolution` — projeção 7/30/90 dias
- `GET /club/{manager_id}/finance-forecast` — Monte Carlo de receita
