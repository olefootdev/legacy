# Arquitetura do repositório Olefoot

Este documento descreve **como o código está organizado hoje**, sem impor uma migração futura para `apps/` / `packages/` (isso pode ser feito em fases).

## Camadas (mental model)

1. **UI + estado do jogo (raiz)**  
   React, router, `src/game` (persistência local, reducer), páginas de match, wallet, cadastro, admin. Grande parte da lógica de “carreira” e simulação vive aqui por histórico e velocidade de iteração.

2. **Visual do campo**  
   `web/match-pitch` consome dados via bridge (WebView / URL). Não duplica regras de negócio do jogo; foca em render Babylon.

3. **Cliente móvel**  
   `mobile` orquestra navegação, progressão (Zustand), e carrega o mesmo viewer quando necessário.

4. **API e persistência remota**  
   `server` fala com Supabase com credenciais privilegiadas. O browser usa apenas URL + **anon key** (RLS).

5. **Infraestrutura de dados**  
   `supabase/migrations` define o schema; `supabase/config.toml` é ajustado localmente com a CLI.

## Fluxos principais

- **Onboarding / Sports Data:** dados curados em `localStorage` via `src/admin/sportsDataStore.ts`, painel Admin, consumo em `Cadastro`.
- **Partida:** estado em `src/game`, motor em `src/engine` / `src/match-engine` / GameSpirit conforme o modo (live, quick, auto).
- **Game Spirit (IA):** prompts no cliente (Gemini via Vite) para alguns fluxos de Admin; ensino estruturado pode passar pelo `server` com OpenAI.

## O que não está isolado (ainda)

O “game engine” não é um pacote npm separado: partilha módulos com a UI. Extrair para `packages/game-core` seria um projeto de várias PRs, quando as fronteiras estiverem estáveis.
