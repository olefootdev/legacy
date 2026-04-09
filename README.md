# Olefoot Legacy

**Olefoot** é uma plataforma de gestão desportiva com simulação de partidas, progressão de clube, wallet, Admin (incl. Sports Data para onboarding) e visualização 3D do campo (Babylon), com cliente web (Vite + React) e app móvel (Expo). Este repositório concentra o código de desenvolvimento; a árvore atual é um **monorepo pragmático** (app principal na raiz + pacotes em subpastas).

---

## O que é o Olefoot

- **Web (manager):** estado do jogo, UI de carreira, partidas, carteira, integrações Supabase no cliente (anon + RLS).
- **Viewer:** `web/match-pitch` — gramado 3D para WebView ou deploy estático.
- **Mobile:** Expo — navegação, progressão e WebView para o pitch.
- **API:** `server/` — Hono, operações privilegiadas (ex. service role), Game Spirit no servidor quando aplicável.

Documentação técnica completa: **[docs/README.md](docs/README.md)** · Plano de reorganização futura: **[docs/REPO_REORGANIZATION_PLAN.md](docs/REPO_REORGANIZATION_PLAN.md)** · Contribuição: **[CONTRIBUTING.md](CONTRIBUTING.md)**.

---

## Estrutura do projeto (estado atual)

```
.
├── src/                 # App web principal (React + lógica de jogo acoplada à UI)
├── public/
├── index.html
├── vite.config.ts
├── package.json
├── web/match-pitch/     # Viewer Vite + Babylon (porta 5174)
├── mobile/              # Expo
├── server/              # API Hono (porta 4000)
├── supabase/            # Migrations + config CLI
├── docs/                # Documentação técnica (índice em docs/README.md)
├── scripts/             # Notas de desenvolvimento (scripts/README.md)
└── legacy/              # Não versionada — clone local opcional de outro repo (.gitignore)
```

| Caminho | Função |
|---------|--------|
| Raiz (`src/`, Vite) | Manager + motor/simulação partilhados com a UI (histórico do projeto). |
| `web/match-pitch/` | Viewer do campo. |
| `mobile/` | App Expo. |
| `server/` | API HTTP. |
| `supabase/` | Schema e ferramentas Supabase. |

---

## Como correr (desenvolvimento)

### Web manager

```bash
npm install
npm run dev
```

**URL:** `http://localhost:5173` (porta padrão no `vite.config.ts`; se estiver ocupada, o Vite tenta a seguinte).

### API (opcional)

```bash
npm run dev:server
```

**URL:** `http://localhost:4000` · Ver `server/.env.example`.

### Viewer do pitch (opcional)

Na raiz:

```bash
npm run dev:pitch
```

Primeira vez no viewer: `cd web/match-pitch && npm install`. Depois podes usar na raiz `npm run dev:pitch` ou `cd web/match-pitch && npm run dev`.  
**URL:** `http://localhost:5174` (`0.0.0.0` para LAN).

### Mobile (opcional)

1. Garante o pitch acessível (acima) se usares WebView com URL local.  
2. `cd mobile && npm install && npm start`  
3. Variáveis: `mobile/.env.example` · Fluxo detalhado: [docs/EXPO_MATCH_PITCH.md](docs/EXPO_MATCH_PITCH.md).

### Portas (referência única)

| Serviço | Porta |
|---------|--------|
| Web manager | **5173** |
| Viewer | **5174** |
| API | **4000** |
| Preview Vite (raiz) | **4173** |

### Outros comandos (raiz)

| Comando | Descrição |
|---------|-----------|
| `npm run build` / `npm run preview` | Build e preview da web |
| `npm run lint` | Typecheck raiz + `web/match-pitch` |

---

## Variáveis de ambiente

| Ficheiro | Uso |
|----------|-----|
| [`.env.example`](.env.example) | Web — Supabase anon, Gemini, API-Football (proxy dev), URL da API. |
| [`server/.env.example`](server/.env.example) | Service role, OpenAI, CORS, `PORT`. |
| [`mobile/.env.example`](mobile/.env.example) | URLs públicas Expo. |
| [`web/match-pitch/.env.example`](web/match-pitch/.env.example) | Overrides opcionais do viewer. |

Copiar para `.env` **só localmente**. Nunca commitar `.env`.

---

## Notas de segurança

- `VITE_*` e `EXPO_PUBLIC_*` são **públicos** no bundle — sem service role nem segredos.
- Preferir chamadas sensíveis no `server/` em produção (ex. Gemini).  
- `supabase/config.toml`: `project.id` placeholder no repo; projeto real via `supabase link` local.  
- Checklist para PRs: [docs/SECURITY.md](docs/SECURITY.md).

---

## Licença

Define um ficheiro `LICENSE` na raiz do fork quando a equipa fixar a licença.
