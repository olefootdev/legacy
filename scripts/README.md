# Scripts e operações comuns

Os comandos vivem no `package.json` da raiz e das subpastas. Este ficheiro resume **portas** e **ordem sugerida** (alinhado com o [README](../README.md) na raiz).

## Ordem típica (tudo local)

1. **API** (se precisares de persistência remota ou Game Spirit no servidor):  
   `npm run dev:server` → porta **4000**

2. **App web manager:**  
   `npm run dev` → **5173**

3. **Pitch viewer** (se testares WebView ou URL direta):  
   `cd web/match-pitch && npm run dev` → **5174**

4. **Expo:**  
   `cd mobile && npm start` (com variáveis em `mobile/.env` conforme `mobile/.env.example`)

## Variáveis que afetam URLs

- `VITE_OLEFOOT_API_URL` — base da API para o cliente web (ex.: `http://localhost:4000`).
- `CORS_ORIGIN` em `server/.env` — deve incluir a origem do Vite (ex.: `http://localhost:5173`).
- `EXPO_PUBLIC_PITCH_URL` — URL do viewer para o simulador / dispositivo.

## CI / automação

Para integração contínua futura, podes adicionar aqui scripts `*.sh` que chamem `npm run lint` e builds; mantém-os sem segredos (apenas `npm ci` e comandos públicos).
