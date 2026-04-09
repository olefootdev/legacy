# OLEFOOT — jogo (Vite) + pitch WebView (Expo)

## Monorepo

| Pasta | Descrição |
|-------|-----------|
| Raiz (`/`) | App web do manager: React + Vite (`npm run dev`, porta **3000**). |
| `web/match-pitch/` | Viewer Babylon do gramado (Vite, porta **5174**). Build estático para CDN/HTTPS. |
| `mobile/` | App Expo: abas (Home, Time, Cidade, Carteira, Mercado, Loja, **Missões**, Ao vivo), progressão EXP (`src/progression/`, Zustand + persist) e `MatchPitchWebView`. |

## Jogo web (raiz)

```bash
npm install
npm run dev
```

Abre em `http://localhost:3000`.

## Pitch viewer (WebView)

```bash
cd web/match-pitch
npm install
npm run dev
```

- Local: `http://localhost:5174`
- Build: `npm run build` → artefatos em `web/match-pitch/dist/` para deploy HTTPS.

## App Expo (partida ao vivo com WebView)

```bash
cd mobile
npm install
npm run dev:pitch
```

Em **outro terminal**, na pasta `mobile`:

```bash
npm start
```

Depois abra iOS Simulator ou Android Emulator (ou dispositivo físico).

### URLs do WebView (dev)

- **iOS Simulator:** `http://localhost:5174`
- **Android Emulator:** `http://10.0.2.2:5174`
- **Dispositivo físico na mesma rede:** defina no `.env` do Expo:

```bash
EXPO_PUBLIC_PITCH_URL=http://192.168.x.x:5174
```

(Substitua pelo IP da máquina que roda o viewer.)

### Produção

1. Faça `npm run build` em `web/match-pitch` e publique `dist/` em HTTPS.
2. Configure `EXPO_PUBLIC_PITCH_URL=https://seu-dominio/olefoot-pitch/` no app Expo.

### HTTP em Android (dev)

`mobile/app.json` inclui `android.usesCleartextTraffic: true` para desenvolvimento. Não use cleartext em produção; veja [`docs/EXPO_MATCH_PITCH.md`](docs/EXPO_MATCH_PITCH.md).

### Progressão (Expo)

- **Ranking:** só `exp_balance` (gastar reduz saldo).
- **Nível 1–25:** `exp_lifetime_earned` (monotônico).
- **Resgate de missão:** soma `rewardExp` em **ambos** os saldos.
- Código: `mobile/src/progression/` (`useProgressionStore`, `MISSION_CATALOG`, resets diário/semanal).
- Persistência: AsyncStorage via `zustand/middleware/persist`.

### Ponte `MatchTruthSnapshot`

- O WebView carrega o viewer; o React Native pode enviar JSON com `injectJavaScript` chamando `window.__RN_MATCH_PITCH(snapshot)`.
- Tipos: `mobile/src/types/matchTruth.ts` e `web/match-pitch/src/matchTruthTypes.ts` (alinhados ao bridge do jogo web).

## Scripts úteis

| Comando | Onde |
|---------|------|
| `npm run dev` | Raiz — jogo manager |
| `npm run dev` | `web/match-pitch` — viewer |
| `npm run dev:pitch` | `mobile` — atalho para subir o viewer a partir do Expo |
| `npm run lint` | Raiz — TypeScript do jogo web |
| `npm run lint` | `mobile` — TypeScript do Expo (`src/`, alias `@/*`) |

## Repositório público (GitHub)

- **Não versionar** `.env`, `.env.local`, nem cópias com chaves reais. O `.gitignore` já ignora `.env*` exceto `.env.example` e `server/.env.example`.
- **Nunca** colocar no remoto: `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `API_FOOTBALL_KEY` com valor, passwords de base de dados, nem exports de saves com dados pessoais.
- Copia `.env.example` → `.env` e `server/.env.example` → `server/.env` **só na tua máquina** ou em CI privado com secrets do GitHub Actions.

---

Documentação adicional: economia em `docs/ECONOMY_OLEFOOT.md`, Admin/tático em `docs/ADMIN_TACTICAL_BRO.md`.
