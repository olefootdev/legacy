# Deploy do olefoot-server no Railway

Este servidor (Hono/Node) hospeda endpoints que o front chama em runtime para
match tick, game spirit, admin tools e Pinata. **A Liga MVP não depende dele**
(usa Edge Function do Supabase), mas live match e admin precisam.

## Passo a passo (dashboard Railway)

1. **New Project → Deploy from GitHub repo** → escolher `olefootdev/legacy`.
2. Em **Settings → Root Directory**: `server` (o app fica em `/server`, não na raiz).
3. **Settings → Build/Deploy**: Railway detecta `railway.json` automaticamente
   (NIXPACKS, `npm ci && npm run build`, start `npm start`, healthcheck `/health`).
4. **Variables** — adicionar todas:

   | Variável | Valor / observação |
   |---|---|
   | `NODE_ENV` | `production` |
   | `PORT` | injetado pela Railway (não precisa setar) |
   | `CORS_ORIGIN` | `https://olefoot-game.olefoot.workers.dev` (o front em CF). **Obrigatória em prod**, sem ela o servidor sai com exit(1). |
   | `SUPABASE_URL` | `https://sgggsylmrdglkhbhcqeg.supabase.co` |
   | `SUPABASE_ANON_KEY` | (anon JWT) |
   | `SUPABASE_SERVICE_ROLE_KEY` | service role do projeto Supabase |
   | `ANTHROPIC_API_KEY` | requerido para `/api/gamespirit` e `/api/game-spirit/teach` |
   | `ANTHROPIC_MODEL_HAIKU` | ex: `claude-haiku-4-5-20251001` |
   | `ANTHROPIC_MODEL_SONNET` | ex: `claude-sonnet-4-6` |
   | `OPENAI_API_KEY` | requerido para `/api/admin/player-from-prompt` (admin) |
   | `PINATA_JWT` | requerido para upload Genesis Portraits (admin) |
   | `PINATA_GATEWAY_PREFIX` | URL pública do gateway Pinata |
   | `OLEFOOT_PINATA_UPLOAD_TOKEN` | mínimo 16 caracteres; mesmo valor que `VITE_OLEFOOT_PINATA_UPLOAD_TOKEN` no front |
   | `GAMESPIRIT_AI_LOG_SUPABASE` | `false` (opcional, ativa logs no Supabase) |

5. **Deploy** → aguarda build → Railway gera URL pública tipo
   `https://olefoot-server-production.up.railway.app`.

## Após o deploy

Mande a URL gerada que eu:
1. Adiciono `VITE_OLEFOOT_API_URL=<url>` no `.env` do front.
2. Rebuild Vite (`npm run build`).
3. `npx wrangler deploy` para subir front com a URL embutida.

## Smoke test rápido

```bash
curl https://<url>.up.railway.app/health
# → deve retornar { ok: true } (ou similar)
```

Se 503: a env `CORS_ORIGIN` está faltando ou inválida — server faz exit(1).
