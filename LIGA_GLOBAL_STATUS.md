# STATUS — Liga Global (pausa de ~2h)

_Última atualização: durante a sessão de debug. Ler isto ao voltar._

## TL;DR

- ✅ **Edge Function (`global-league-tick`) em produção está CORRETA e funcionando** — o usuário deployou a versão com o fix do lock (`lockedRows`). Playoffs rodaram, transição pra liga ocorreu. **Não mexer nela.**
- ⚠️ **Frontend em produção provavelmente REGREDIU.** Foi deployado um build da branch `claude/audit-global-league-AGRZB`, que está no base antigo (`2eb0f49`) e **não tem 6 commits de trabalho que estão no `main`** (~89 arquivos, ~9.900 linhas: telas de histórico GlobalLeague, SmartHub, painel admin de season, overhaul do classic engine, etc.).
- 🔧 **Próximo passo NÃO é deployar nada** — é **reconciliar** meus 3 fixes em cima do `main` e deployar a partir do `main` reconciliado.

## Estado das branches

| Ref | Commit | O que tem |
|---|---|---|
| merge-base | `2eb0f49` | base comum |
| `origin/main` | `4044db0` | 6 commits de trabalho paralelo (Liga Global + classic) |
| `origin/claude/audit-global-league-AGRZB` | `600530d` | meus 3 fixes, em cima do base antigo |

**Commits do `main` que a minha branch NÃO tem:**
```
4044db0 fix(global-league): CLI --fullReset purga rounds/fixtures/events órfãos
88294fb fix(global-league): zerar tudo para estreia oficial + travar vazamento do auto-register
f44697d Harden global league season operations
655af8e Fix classic match MVP readiness
acc356d feat(global-league): season_ended screen, nova temporada admin, SmartHub widgets
035454c feat(global-league): MVP cycle, lock idempotente, amarelos/suspensoes, próxima partida na Home
```

**Meus 3 commits (na branch `claude/audit-global-league-AGRZB`):**
```
600530d fix(global-league-tick): lock da rodada nunca confirmava — liga em loop
3960c22 chore(deploy): deploy:cloudflare cross-platform (Windows/macOS/Linux)
e14a84d fix(global): liga volta a pontuar/salvar e mostra a rodada certa
```

## O que está deployado AGORA em produção

- **Edge Function**: versão com `lockedRows` (meu fix `600530d`). ✅ Correta. Foi deployada manualmente (dashboard/CLI).
- **Frontend (Cloudflare Worker `olefoot-game`)**: build da branch `claude/audit-global-league-AGRZB`. ⚠️ Regredido — falta o trabalho dos 6 commits do `main`.
- **Banco**: as rodadas presas em `live` foram resetadas manualmente via SQL. Playoffs rodaram, liga em andamento.

## Reconciliação — meus 3 fixes vs o que o `main` já fez

Investiguei (read-only) cada arquivo sobreposto:

| Meu fix | `main` já resolveu? | Ação na reconciliação |
|---|---|---|
| **Edge Function lock** (`lockCount`→`lockedRows`) — `600530d` | ❌ NÃO. `main` ainda tem `count: 'exact', head: true` e `if (!lockCount...)` no `global-league-tick/index.ts` (linhas ~627-633). | **APLICAR no `main`.** Crítico — se alguém deployar o edge function a partir do `main`, re-introduz o bug do loop. |
| **Remover `persistGlobalLeagueSnapshot`** (overwrite) — parte do `e14a84d` | ❌ NÃO. `main`/`store.ts` ainda importa e chama (`GLOBAL_LEAGUE_PERSIST_ACTIONS`, linhas 8/12/188-189). | **APLICAR no `main`.** Bug real ainda presente. |
| **`pickDisplayRound`** (mostra rodada certa) — parte do `e14a84d` | ⚠️ PARCIAL. `main`/`MatchGlobal.tsx` introduziu `lastFinishedRound` (`source = lastFinishedRound ?? currentLeagueRound`) — resolve a seção da **liga**. Mas o bloco de **playoffs** (linha ~768) ainda usa o ponteiro `currentPlayoffRound`. | **AVALIAR.** A solução do `main` cobre a liga. Considerar aplicar `pickDisplayRound` só pra unificar/cobrir o playoff, ou aceitar o do `main`. Baixa prioridade. |
| **`upsertGlobalTeamInSupabase`** insert-if-absent — parte do `e14a84d` | ⚠️ DIFERENTE. `main`/`useAutoRegisterGlobalLeague.ts` usa "identity-only upsert" (comentário linha ~62) + reseta `registeredRef` em falha. | **AVALIAR.** Verificar se o "identity-only upsert" do `main` ainda manda `id` com `onConflict: manager_id` (se sim, ainda muta a PK — meu fix de insert-if-absent ainda agrega). Se o `main` resolveu de verdade, meu fix é redundante. |
| **Deploy script cross-platform** — `3960c22` (`scripts/deploy-cloudflare.mjs` + `package.json`) | ❌ NÃO existe no `main`. | **APLICAR no `main`.** Adição limpa; só pode haver conflito pequeno no `package.json` (main adicionou outros scripts). |

**Resumo:** 2 fixes meus são definitivamente necessários no `main` (Edge Function lock, `persistGlobalLeagueSnapshot`), 1 é adição limpa (deploy script), 2 se sobrepõem ao trabalho do `main` e precisam de avaliação caso a caso.

## PLANO quando voltar (em ordem)

1. **Responder 2 perguntas** (ver abaixo) — definem se houve regressão e se vem mais trabalho no `main`.
2. **Mitigação imediata do frontend regredido** (se confirmado): rollback rápido pelo dashboard da Cloudflare → Workers → `olefoot-game` → Deployments → reverter pra versão anterior (a que era build do `main`). Isso restaura as features perdidas. O frontend volta sem meus fixes, mas o `main` já tem fix parcial de display e o Edge Function (que é o que mais importa) continua correto.
3. **Reconciliar de verdade**: criar uma branch a partir do `origin/main`, aplicar:
   - Edge Function lock fix (do `600530d`) — reaplicar no `global-league-tick/index.ts` do `main`
   - Remoção do `persistGlobalLeagueSnapshot` (do `e14a84d`) — reaplicar no `store.ts`/`globalLeague.ts` do `main`
   - Deploy script cross-platform (do `3960c22`) — copiar `scripts/deploy-cloudflare.mjs`, ajustar `package.json`
   - Avaliar `pickDisplayRound` e `upsertGlobalTeamInSupabase` (decidir manter o do main ou complementar)
4. **`npm run lint`** na branch reconciliada.
5. **Build + deploy** do frontend a partir da branch reconciliada.
6. **Deploy do Edge Function** a partir da branch reconciliada (garante que git == produção).
7. Verificar: `net._http_response` mostrando `process-round`; tabela `global_league_teams` com pontos subindo.

## Perguntas em aberto pro usuário

1. **Quem fez os commits `035454c` → `4044db0` no `main`?** Você ou alguém do time? Ainda vem mais coisa pro `main`?
2. **A produção estava rodando o `main` antes de hoje?** (Confirmar abrindo o site: as telas de histórico da GlobalLeague / SmartHub / season_ended sumiram depois do último deploy? Se sumiram → regressão confirmada.)

## Notas / lições

- Os 3 commits meus estão **só** em `origin/claude/audit-global-league-AGRZB`. Não foram mergeados.
- O Edge Function em produção é o único lugar onde meu fix do lock está "vivo" — o git `main` ainda tem o bug.
- Não deployar o Edge Function a partir do `main` sem antes aplicar o fix do lock.
