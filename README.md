# Olefoot

Plataforma **sports legacy**: gestão de clube, simulação de partidas, onboarding (Sports Data), integração com visual 3D (Babylon) e app móvel (Expo). O núcleo do jogo e da UI do manager vive na **app web** (Vite + React) na raiz do repositório.

**Repositório público de código:** desenvolvimento e contribuições concentram-se aqui. Documentação de produto de alto nível pode existir noutro repositório da organização.

---

## Estrutura do projeto

| Caminho | Função |
|---------|--------|
| **`/`** (raiz) | App web principal: manager, estado do jogo (`src/game`), Admin, wallet UI, motor de partida e GameSpirit ligados à UI. |
| **`web/match-pitch/`** | Viewer do gramado (Vite + Babylon), pensado para WebView e deploy estático. |
| **`mobile/`** | App Expo: navegação, progressão, carteira, WebView para o pitch. |
| **`server/`** | API HTTP (Hono): Supabase (service role), partidas, Game Spirit (OpenAI) no servidor. |
| **`supabase/`** | Migrations e `config.toml` (CLI). O `project.id` local é preenchido com `supabase link`. |
| **`docs/`** | Documentação técnica (economia, match, Expo, backend). |
| **`.agents/`** | Skills e recursos para Cursor (ferramenta de desenvolvimento, não runtime da app). |

A pasta **`legacy/`** não é versionada (`.gitignore`). Se precisares do repositório público separado da organização, clona-o à parte ou para `legacy/` localmente — **não há submódulo Git** neste monorepo, para evitar clones quebrados sem `.gitmodules`.

---

## Como correr (desenvolvimento)

### 1. App web (manager)

```bash
npm install
npm run dev
```

- URL típica: **http://localhost:5173** (Vite; se a porta estiver ocupada, o Vite sugere outra — `strictPort: false`).

### 2. API local (opcional)

```bash
npm run dev:server
# ou: cd server && npm install && npm run dev
```

- Por defeito: **http://localhost:4000** (`PORT` em `server/.env`).

### 3. Viewer do pitch (opcional)

```bash
cd web/match-pitch && npm install && npm run dev
```

- **http://localhost:5174** (host `0.0.0.0` para dispositivos na LAN).

### 4. App mobile (opcional)

```bash
cd mobile && npm install && npm run dev:pitch
```

Noutro terminal: `cd mobile && npm start`. Ver [`docs/EXPO_MATCH_PITCH.md`](docs/EXPO_MATCH_PITCH.md) e `mobile/.env.example` para `EXPO_PUBLIC_PITCH_URL` / `EXPO_PUBLIC_OLEFOOT_WEB_URL`.

### Portas de referência

| Serviço | Porta padrão |
|---------|----------------|
| Web manager (Vite) | 5173 |
| Pitch viewer | 5174 |
| API (`server`) | 4000 |
| Vite preview (build local) | 4173 |

Mais detalhes: [`scripts/README.md`](scripts/README.md).

---

## Variáveis de ambiente

| Ficheiro | Uso |
|----------|-----|
| [`.env.example`](.env.example) | Raiz — Vite, Supabase client, Gemini, API-Football (proxy dev), URLs. |
| [`server/.env.example`](server/.env.example) | Servidor — Supabase service role, OpenAI, CORS. |
| [`mobile/.env.example`](mobile/.env.example) | Expo — URLs públicas do pitch / web. |
| [`web/match-pitch/.env.example`](web/match-pitch/.env.example) | Opcional — overrides do viewer. |

Copiar cada um para `.env` na pasta correspondente **apenas localmente**. Nunca commitar `.env`.

---

## Segurança

- Tudo com prefixo **`VITE_`** ou **`EXPO_PUBLIC_`** acaba **exposto no browser / bundle** — não coloques service role nem segredos aí.
- **`GEMINI_API_KEY`** na raiz é injetada no build Vite; em produção o ideal é proxy no servidor ou chamadas só no backend.
- **`API_FOOTBALL_KEY`** em dev usa o proxy do Vite (chave no processo Node, não no fetch do cliente quando o proxy está ativo).
- Não commits de `supabase/config.toml` com **project ref real** em forks públicos; usa `supabase link` local.
- Ver também a secção histórica em commits anteriores: não vazar tokens em issues ou PRs.

---

## Scripts úteis (raiz)

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | App web manager |
| `npm run dev:server` | API Hono |
| `npm run dev:pitch` | Viewer em `web/match-pitch` |
| `npm run build` / `preview` | Build e preview da app web |
| `npm run lint` | Typecheck raiz + `web/match-pitch` |

---

## Documentação adicional

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — visão em camadas do repositório.
- Economia: `docs/ECONOMY_OLEFOOT.md` · Backend: `docs/BACKEND.md` · Admin/tático: `docs/ADMIN_TACTICAL_BRO.md`.

---

## Licença

Ver ficheiro `LICENSE` na raiz (se existir no teu fork).
