# Documentação Olefoot

Entrada para conteúdo **fora** do README principal. O README na raiz resume execução, portas e segurança; aqui está o detalhe por tema.

## Arranque e integração

| Documento | Conteúdo |
|-----------|----------|
| [EXPO_MATCH_PITCH.md](./EXPO_MATCH_PITCH.md) | URLs do viewer por plataforma (simulador / físico). |
| [INTEGRACAO_MATCH_PITCH_EXPO.md](./INTEGRACAO_MATCH_PITCH_EXPO.md) | Fluxo WebView + pitch. |
| [BACKEND.md](./BACKEND.md) | API `server/`, variáveis, exemplos `curl`. |
| [SUPABASE.md](./SUPABASE.md) | Projeto Supabase, RLS, notas de uso. |
| [SUPABASE_MCP.md](./SUPABASE_MCP.md) | MCP Supabase no Cursor / Claude CLI. |
| [ADMIN_DATABASE.md](./ADMIN_DATABASE.md) | Schema Admin / onboarding / Game Spirit / saves (migration 00003). |

## Arquitetura e evolução do repo

| Documento | Conteúdo |
|-----------|----------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Camadas atuais (web, pitch, mobile, API, DB). |
| [REPO_REORGANIZATION_PLAN.md](./REPO_REORGANIZATION_PLAN.md) | Alvo `apps/` / `services/` / `infra/` e fases de migração. |
| [../scripts/README.md](../scripts/README.md) | Ordem sugerida de `npm run` em dev. |

## Jogo, economia e admin

| Documento | Conteúdo |
|-----------|----------|
| [ECONOMY_OLEFOOT.md](./ECONOMY_OLEFOOT.md) | Modelo económico. |
| [ECONOMIA_EXP_BRO.md](./ECONOMIA_EXP_BRO.md) | Notas de experiência / progressão. |
| [ADMIN_TACTICAL_BRO.md](./ADMIN_TACTICAL_BRO.md) | Admin e tática. |
| [ADMIN_CREATE_PLAYER_INTEGRATION.md](./ADMIN_CREATE_PLAYER_INTEGRATION.md) | Create player / integrações. |
| [LEAGUES.md](./LEAGUES.md) | Ligas e competições. |

## Motor, simulação e campo

| Documento | Conteúdo |
|-----------|----------|
| [MATCH_SIMULATION_PIPELINE.md](./MATCH_SIMULATION_PIPELINE.md) | Pipeline de simulação. |
| [MATCH_CAUSAL_PIPELINE.md](./MATCH_CAUSAL_PIPELINE.md) | Causalidade no match. |
| [GAMEPLAY_ACTION_OUTCOMES.md](./GAMEPLAY_ACTION_OUTCOMES.md) | Resultados de ações. |
| [SPATIAL_GOALS.md](./SPATIAL_GOALS.md) | Golos espaciais. |
| [STRUCTURAL_REORGANIZATION.md](./STRUCTURAL_REORGANIZATION.md) | **Parâmetros de simulação** (timing no campo; não é reorganização do Git). |

## Prompts e integração visual (referência)

| Documento | Conteúdo |
|-----------|----------|
| [PROMPT_MOTOR_VISUAL_BABYLON_YUKA.md](./PROMPT_MOTOR_VISUAL_BABYLON_YUKA.md) | Motor visual Babylon/Yuka. |
| [PROMPT_CURSOR_CAMPO_BABYLON_INTEGRADO.md](./PROMPT_CURSOR_CAMPO_BABYLON_INTEGRADO.md) | Campo integrado. |
| [PROMPT_ADMIN_CAMPO_INTELIGENTE.md](./PROMPT_ADMIN_CAMPO_INTELIGENTE.md) | Admin / campo. |

## Segurança

| Documento | Conteúdo |
|-----------|----------|
| [SECURITY.md](./SECURITY.md) | Checklist e boas práticas para contribuidores. |
