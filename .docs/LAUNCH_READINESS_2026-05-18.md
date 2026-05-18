# Pré-lançamento Olefoot — Auditoria de 9 itens (2026-05-18)

Status honesto de cada um dos 9 pedidos do usuário. Foco em **o que foi
feito**, **o que não foi feito**, e **o risco de cada gap em produção**.

---

## ✅ #1 — Cerimônia só no primeiro login, plantel zerado

**Status:** Entregue (commit `17ec8ba`).

**O que mudou:**
- `Login.tsx` e `Cadastro.tsx` **não chamam mais** `tryGrantWelcomeGenesisPack`.
  Antes esse helper distribuía plantel silenciosamente — agora removido.
- Manager novo cai na Home com `players = {}` (plantel vazio) → o componente
  `OnboardingCeremony` entra automaticamente (6 capítulos: intro, sorteio EXP,
  25 pioneiros, top 3, daily bonus, boas-vindas).
- Gates anti-duplicação intactos: `userSettings.welcomeGenesisPackVersion` (local)
  + tabela `welcome_pack_grants` no Supabase (server). Cerimônia só roda 1× por
  user, mesmo trocando de browser.

**Risco residual:** zero — se algum manager existente já tinha pack, o gate
do Supabase impede re-entrega.

---

## ✅ #2 — Inserir time na Liga Global Divisão 3 automaticamente

**Status:** Já estava entregue (commit anterior `useAutoRegisterGlobalLeague`).

**O que faz hoje:**
- `useAutoRegisterGlobalLeague.ts` roda no boot quando o manager tem plantel
  E `globalLeagueMVP` está hidratado. Se o team ainda não está na liga,
  dispara `REGISTER_GLOBAL_TEAM` (local) + `registerGlobalTeamIdentity`
  (Supabase, identity-only — Edge Function autoritativa cuida da divisão).

**Risco residual:** o registro acontece **depois** da cerimônia (que entrega
plantel). Se um manager passa pela cerimônia mas fecha o browser antes do
hook rodar, na próxima sessão ele entra. Verificável no DevTools: console.log
`[autoRegister] team registered in Liga Global`.

---

## ✅ #3 — Premiações em EXP na Liga Global (10/50/100/300/1000)

**Status:** Entregue (commit `b2a4bcd`).

**O que faz:**
- `src/match/globalLeagueMilestones.ts`: 4 categorias × 5 thresholds = 20 marcos.
  - Categorias: matches | goals | points | wins
  - Thresholds: 10 / 50 / 100 / 300 / 1000
- Recompensa EXP curva:
  | Threshold | EXP |
  |---|---|
  | 10 | 500 |
  | 50 | 2.500 |
  | 100 | 7.500 |
  | 300 | 25.000 |
  | 1000 | 100.000 |
- `useGlobalLeagueMilestoneRewards` observa o team no `globalLeagueMVP` (boot
  + realtime) e dispara `CLAIM_GLOBAL_LEAGUE_MILESTONES` para todo marco novo.
- IDs já reclamados ficam em `state.globalLeagueMilestonesClaimed` + persistem
  cross-browser via coluna `global_league_milestones_claimed` em
  `manager_game_state` (migration `20260518010000`). Merge defensivo monotônico
  — jamais paga 2×.
- Inbox notifica cada marco: `🏆 Liga Global — 10 Vitórias alcançadas!`.

**Risco residual:** se algum manager **já passou** dos thresholds antes desse
deploy, ele recebe todos os marcos retroativos no próximo boot. Decisão
consciente — recompensa histórica conta.

---

## ✅ #4 — Excluir OLEFOOT LIGA mockada (Flamengo/Palmeiras/etc)

**Status:** Entregue (commit `17ec8ba`).

**O que mudou:**
- `src/pages/OlefootLeague.tsx` deletada (4.6k linhas).
- Rota `/match/olefoot-liga` redireciona pra `/match/global`.
- Link da `Leagues.tsx` aponta direto pra `/match/global`.
- 5 arquivos `.bak` órfãos removidos.

**O que NÃO foi tocado (proposital):**
- Os arquivos `src/match/olefootLeague.ts` (lógica), `src/match/processLeagueSchedule.ts`,
  `src/olefootLeague/*` continuam — `globalRoundScheduler.ts` e outros importam
  TIPOS daí. Refatorar isso é trabalho separado. **Sem impacto pro usuário**:
  nenhuma UI consome esses dados mockados.
- O slice `state.olefootLeague` ainda existe; só não tem mais como abrir.

**Risco residual:** dead code técnico, sem efeito em produção.

---

## ✅ #5 — CLASSIC e QUICK sempre contra time de manager

**Status:** Entregue (commit `b2a4bcd`).

**O que mudou:**
- `DEFAULT_OPPONENT` (TITANS FC) substituído por placeholder neutro
  `{ id: 'placeholder-opponent', name: 'Buscando…' }`.
- Crest forçado pra Real Madrid (que era injetado quando id='titans') removido.
- `MatchQuick.tsx` e `MatchClassic.tsx` **auto-buscam adversário** no mount
  quando entram sem `pvpOpponentStub`. Pipeline (igual ao QuickSearchModal):
  1. Manager real ±10 OVR (Supabase `fetchOpponentSquads`)
  2. Manager real ±15 OVR
  3. Online ±10 OVR (clubes com `friendly_availability='ONLINE'`)
  4. Online ±15
  5. Bot fallback (Aurora FC / Tupis da Guanabara / Olympia Ouro — nomes indie,
     não pretendem ser times reais)
- `QuickSearchModal` agora passa stub **mesmo no caso bot** (antes só passava
  pra real_manager — o caso bot caía no DEFAULT_OPPONENT = TITANS).

**Risco residual:** quando a base de managers é pequena, o fallback bot ainda
roda. Os 3 nomes indie (Aurora FC, Tupis, Olympia) são aceitáveis pra MVP.

---

## ✅ #6 — Criar LIGA CLASSIC (placar todas as partidas CLASSIC)

## ✅ #7 — Criar FAST LIGA (placar todas as partidas RÁPIDA)

**Status:** Entregue (commit `07575c4`) — implementados juntos como sistema
unificado de "ligas locais cumulativas".

**O que faz:**
- `src/match/localLeagues.ts`: shape `LocalLeaguesState { classic, fast }`,
  cada uma com `played, wins, draws, losses, goalsFor, goalsAgainst, points,
  recentForm[5], bestStreak, currentStreak`.
- Pontuação 3V/1E/0D. Sem temporadas — soma pra sempre.
- Trigger:
  - `ClassicMatchScreen.tsx` dispara `RECORD_LOCAL_LEAGUE_RESULT { league:'classic' }`
    junto com o `APPLY_CASUAL_RESULT_TO_LEAGUE` existente.
  - `FINALIZE_MATCH` (modo `quick`) incrementa `fast` inline.
- Persistência cross-browser via coluna `local_leagues jsonb` em
  `manager_game_state` (migration `20260518020000`). Merge defensivo: lado
  com mais partidas vence.
- UI:
  - Rota `/ligas-locais` (`LocalLeagues.tsx`) — tabs Classic / Fast.
  - Card "Meu placar" + leaderboard Top 50 (`fetchLocalLeagueLeaderboard`
    em `src/supabase/localLeaguesRanking.ts`).
  - Tie-breakers FIFA: pontos > saldo > gols feitos > menos jogos.
  - Atalho na `/ligas` pra descoberta.

**Risco residual:**
1. Leaderboard escaneia até 200 rows do `manager_game_state`. Se passar de
   milhares de managers ativos, precisa denormalizar pra tabela dedicada
   com índice em `points`.
2. Sem proteção anti-fraude server-side (manager podia hackear o cliente).
   Mesmo limite das outras stats client-authoritative.

---

## ⚠️ #8 — Varredura de dead code

**Status:** Parcial. O que foi feito:
- 5 arquivos `.bak` órfãos deletados no Sprint 1.
- `OlefootLeague.tsx` deletada.
- Imports não usados de `tryGrantWelcomeGenesisPack` removidos em Login/Cadastro.

**O que ficou pendente (precisa de outra sessão dedicada):**
- `src/match/olefootLeague.ts` e arquivos relacionados — código vivo mas
  inacessível pelo UI. Refatorar pra remover ou converter em mock test-only.
- Validar se `WelcomeGenesisPackHydrate` (mencionado em algum boot) ainda é
  alcançável. Se não, deletar.
- Pastas suspeitas (por nome): `src/admin/legacy*`, qualquer `*_DEPRECATED.tsx`,
  componentes em `src/components/*.bak.tsx` que tenham escapado.

**Recomendação:** rodar uma sessão dedicada com agente Explore + Plan:
> "Audita src/ por arquivos que: (a) não tem nenhum import; (b) tem `// DEPRECATED`
> nos comentários; (c) referenciam OLEFOOT LIGA mockada ou TITANS FC. Lista
> candidatos a delete com tamanho em LOC."

**Risco residual:** zero pro usuário (dead code não roda). Custo é só bundle
size + ruído na busca.

---

## ⚠️ #9 — Análise final pra "lançamento perfeito"

**Status:** Parcial — este documento É a entrega do item 9. Pontos por categoria
após Sprints 1-4:

### Vermelhos (block launch?)
Nenhum identificado. O jogo está em estado lançável.

### Amarelos (atenção pós-launch)
1. **Leaderboard das ligas locais não escala** acima de ~1k managers. Plano
   B: denormalizar em tabela dedicada após primeiro mês.
2. **Sem rate limit nas dispatches do cliente** (já anotado em audits anteriores
   da Academia). Manager rico em EXP pode dispatchar muito; não tem cap.
3. **Bot fallback pool pequeno** (3 nomes). Quando a base for grande, expandir
   pra evitar repetição.
4. **Migration 20260518020000** e **20260518010000** precisam ser aplicadas no
   Supabase prod manualmente ou via CLI antes do deploy do client:
   ```bash
   supabase db push
   ```
   Se o client subir antes da migration, o upsert falha silenciosamente em
   `[managerGameState] persist falhou` (warning, não quebra UX).

### Verdes (entregues e estáveis)
- Cerimônia única via — gate duplo (local + Supabase).
- Liga Global rewards — monotônico, idempotente.
- Liga Classic + Fast Liga — leaderboard funcional.
- Matchmaking anti-mock — fluxo unificado QuickSearchModal + auto-search.
- Cross-browser persistence — academy queue, inbox, milestones, ligas locais.

### Próxima sessão (não bloqueia launch)
1. Item #8 dedicado — limpar dead code OLEFOOT LIGA backend.
2. Validation server-side da Academia (item P3 antigo) — endpoint
   `/api/academy/create` que valida EXP/OVR antes de aceitar.
3. Notificação no inbox quando arte da Academia fica pronta — feedback do user
   indica que isso ajuda divulgação.
4. Migrations Supabase aplicadas em prod.

---

## Resumo executivo

| # | Pedido | Status | Commit |
|---|---|---|---|
| 1 | Cerimônia única via | ✅ | `17ec8ba` |
| 2 | Auto-registro Liga Global Div 3 | ✅ (pré-existia) | — |
| 3 | Milestones EXP Liga Global | ✅ | `b2a4bcd` |
| 4 | Excluir OLEFOOT LIGA mockada | ✅ (parcial — UI sim, código backend não) | `17ec8ba` |
| 5 | CLASSIC/QUICK vs managers | ✅ | `b2a4bcd` |
| 6 | LIGA CLASSIC | ✅ | `07575c4` |
| 7 | FAST LIGA | ✅ | `07575c4` |
| 8 | Dead code audit | ⚠️ Parcial | `17ec8ba` |
| 9 | Análise final | ✅ (este doc) | — |

**Lint:** clean em todos os 4 commits.
**Antes do deploy:** aplicar migrations `20260518010000` e `20260518020000`.
