# Deploy Checklist — MVP Olefoot

## ✅ Pré-Deploy (Concluído)

- [x] TypeScript sem erros (31 erros corrigidos)
- [x] Build de produção funcional (`npm run build` — 12.23s, 0 erros)
- [x] Variáveis de ambiente configuradas em `.env`

## 🔧 Configuração Cloudflare

### Variáveis de Ambiente (Cloudflare Dashboard)

No painel do Worker/Pages → Settings → Environment Variables, definir:

```bash
VITE_SUPABASE_URL=https://sgggsylmrdglkhbhcqeg.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_WqsliZKauR8yV-AdLX7JMA_he3KUuow
VITE_OLEFOOT_API_URL=https://api.olefoot.com
VITE_ADMIN_EMAIL=olefootdev@gmail.com
```

### Deploy Command

```bash
npm run deploy:cloudflare
```

Isso executa:
1. `npm run build` — gera bundle otimizado em `/dist`
2. `wrangler deploy` — envia para Cloudflare Pages

## 🧪 Testes Pós-Deploy

### Fluxos Críticos

1. **Autenticação**
   - [ ] Login com Supabase
   - [ ] Registro de novo usuário
   - [ ] Persistência de sessão

2. **Match Engine**
   - [ ] Quick Match (resultado instantâneo)
   - [ ] Auto Match (simulação com eventos)
   - [ ] Live Match 2D (pitch completo com Yuka agents)

3. **Economia**
   - [ ] Compra na loja (OLE/BRO)
   - [ ] Wallet sync com Supabase
   - [ ] Créditos pendentes aplicados

4. **Navegação**
   - [ ] Home → Team → Match
   - [ ] BackButton funcionando
   - [ ] Breadcrumbs corretos

5. **Admin**
   - [ ] Acesso restrito (VITE_ADMIN_EMAIL)
   - [ ] GameSpirit teach/reference
   - [ ] Create Player from prompt

## 🚨 Pontos de Atenção

### API Server (olefoot-server)

O frontend depende de `VITE_OLEFOOT_API_URL=https://api.olefoot.com` para:
- GameSpirit decisions (POST /api/gamespirit)
- Position Coach (POST /api/positionCoach)
- Pinata media upload (POST /api/pinataMedia)

**Verificar que o server está deployado e acessível em produção.**

### Supabase RLS

Anon key é pública no bundle — segurança via Row Level Security:
- `genesis_market_players` — leitura pública
- `wallet_credits` — user_id = auth.uid()
- `game_saves` — user_id = auth.uid()

### Bundles Grandes

Chunks principais (gzipped):
- MatchLive: 123.72 kB
- index: 128.13 kB
- AdminDashboard: 81.64 kB

Considerar code-splitting adicional se performance for crítica.

## 📋 Rollback Plan

Se deploy falhar:
1. Cloudflare mantém versão anterior ativa
2. Dashboard → Deployments → Rollback to previous
3. Logs disponíveis em Observability (head_sampling_rate: 0.25)

## 🔗 Links Úteis

- Cloudflare Dashboard: https://dash.cloudflare.com
- Supabase Project: https://supabase.com/dashboard/project/sgggsylmrdglkhbhcqeg
- Wrangler Docs: https://developers.cloudflare.com/workers/wrangler/
