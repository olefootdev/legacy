# INVENTÁRIO TÉCNICO CATEGORIZADO — OLEFOOT (2026-07-20)

Auditoria de simplificação nas 5 gavetas: 🟢 Funcionando · 🔌 Fio Desencapado · 🟡 Parcial/Bug · 🎭 Mock · 🔴 Órfão. Varredura por 5 agentes paralelos sobre `src/`, `server/src/`, `supabase/`, `smartfield/`, `scripts/`.

**Descoberta transversal nº 1 (a mais importante da auditoria):** os três sistemas de consequência do Manager — **contratos, lesões e cartões/suspensões — estão completos e funcionais, mas só rodam nos motores Classic/Live e na Liga Global. O modo Quick (`FINALIZE_QUICK_PLAN`), que é o modo principal do jogo, não alimenta nenhum deles.** Quem só joga Partida Rápida nunca vê contrato vencer, lesão nova ou suspensão. É o gap central do pilar "Ciclo do Manager".

**Descoberta transversal nº 2:** o motor de agentes 2D inteiro (`TacticalSimLoop` + `teamShape` + `antiChaosEngine` + bias de `agentProfile`) roda **apenas** em `/match/legacy` e `/dev/field-view` — rotas que nenhuma UI navega. O jogo mainstream usa o motor de estatística Python. É o maior "ouro escondido" do projeto.

---

## 🟢 Seção A: O Core Confiável (Manter & Proteger)

| Cadeia | Arquivos-chave | Pilar do Manager | Status |
|---|---|---|---|
| **Partida Quick 2.0** (MatchQuick → MatchQuickEngaged → `FINALIZE_QUICK_PLAN` → Postgame) | `src/pages/MatchQuick.tsx:666`, `src/game/reducer.ts:2274` | Ciclo do Manager | Completa; `test:quick-engaged` + `test:quick-credit` |
| **Pipeline Quick Plan Python** | `server/src/routes/matchPlan.ts`, `src/match/quickPlanClient.ts:23` | Ciclo do Manager | Ativa (flag `VITE_QUICK_PLAN_ENABLED=1` em `.env.production`); depende de python3 no Railway + `sync:smartfield` |
| **Treino → atributo** | `reducer.ts:3580` → `src/systems/trainingPlans.ts:41` → `src/entities/playerEvolution.ts:69` | Progressão de Jogadores | **Íntegra** (muta `attrs`, caps por fase, OVR reflete). Única ressalva: conclusão é manual (botão "Concluir"), sem tick automático — UX, não bug |
| **Progressão por partida** | `src/match/quickEngaged/creditQuickPlan.ts:160` → `applyMatchPerformanceEvolution` | Progressão de Jogadores | Real — atributo + XP por desempenho, persiste em `state.players` |
| **Compra PIX de card** (intent → MP → webhook → split → entrega no elenco) | `server/src/routes/payments.ts`, `supabase/functions/payment-webhook/`, migration `20260618170000` | Mercado/PLAYERVIP | Completa; `test:card-pricing` |
| **Compra de Legacy server-side** | `server/src/routes/market.ts:287` ← `TransferLegaciesTab.tsx:139` | Mercado/PLAYERVIP | Completa (débito atômico OLEFOOT + repasse + `record_olefoot_card_sale`) |
| **PLAYERVIP** (magic link, vendas realtime, comissões, saque) | `App.tsx:511-538`, `PlayerVip.tsx`, `legendImport.ts:790+` | Mercado/PLAYERVIP | Completa |
| **Liga Global diária** | `globalLeague.ts` + edge fn `global-league-tick` (cron 1 min) | Ciclo do Manager | Completa; as 4 edge functions (`global-league-tick`, `payment-webhook`, `payment-reconcile`, `hodl-daily-tick`) estão todas referenciadas por cron/webhook — nenhuma órfã |
| **Legends Cup** | reducer (`CREATE/START/DISMISS/RESET_LEGENDS_CUP`), CTA de compra no pós-jogo `MatchQuickEngaged.tsx:909` | Mercado (canal de venda) | Completa e testada (`test:legends-cup*`). São **6 fases** (Grupos + 5 mata-mata). O CTA vive no pós-jogo, não em `LegendsCup.tsx` — mas o deep-link está bugado (Seção C.3) |
| **Rede/Marcos em EXP** | `src/systems/network/milestones.ts` + RPC `network_milestone_exp()` server-authoritative | Economia | Completa; `test:network-milestones` |
| **Coach AI** (chat, sugestões, proactive actions) | `src/coach/` ← `CoachChat.tsx` (`/coach/chat`), `OleSmartHub`, reducer | Ciclo do Manager | Vivo (memória antiga dizia incerto — confirmado ligado) |
| **Auth + guards** | `RequireRegistration`/`RequireSquad`/`RequireAdmin` (`App.tsx:216+`) | — | Completa. ⚠️ Verificar que o bypass de dev em `App.tsx:253` não vaza pra produção |

Cobertura de testes: ~45 self-tests `tsx` cobrindo motor, relógio, crédito pós-jogo, ligas, pricing e marcos. Ressalva estrutural: são scripts standalone, **sem runner unificado nem CI**.

---

## 🔌 Seção B: Fios Desencapados (O Ouro Escondido)

| Recurso | Localização | O que falta para ligar | Esforço |
|---|---|---|---|
| **Motor de agentes 2D completo** (`TacticalSimLoop`, `teamShape`, `antiChaosEngine`, bias de `agentProfile` em `OnBallDecision.ts:570`/`collectiveIndividualDecision.ts:398`) | `src/simulation/TacticalSimLoop.ts`, `src/engine/test2d/` | Só roda em `/match/legacy` + `/dev/field-view` — nenhuma UI navega até lá (`MatchModeBottomSheet.tsx:58` confirma). Expor a rota no picker ou integrar ao Quick | **Alto** |
| **`agentProfile`** | Populado ✅ (`persistence.ts:294`), consumido ✅ — mas só pela engine legacy acima | Herda o destino do motor 2D | Alto |
| **6 tipos de ledger da wallet** (`SPOT_EXP`, `SPOT_BRO`, `TRANSFER`, `PURCHASE`, `MATCH_REWARD`, `STRUCTURE_UPGRADE`) | `src/wallet/types.ts:10`; único produtor é `referral.ts:129` (só `REFERRAL_*`) | `ExtractTab.tsx` já sabe filtrar todos — falta emitir `appendLedger` na compra, recompensa de partida e upgrade de estrutura | **Médio** |
| **`/api/assistant/ask` + componente `OlefootAIAssistant`** | `server/src/routes/assistant.ts:141`, `src/components/assistant/OlefootAIAssistant.tsx` (0 importadores) | Backend E componente prontos; só montar o componente (o `OlefootAssistant` do HelpHub é outro, scriptado) | **Baixo** |
| **Pipeline de refund inteiro** (tabela `payment_refunds` + RPC `reverse_payment_intent`) | migrations `20260703120000/130000` | 0 referências no app; criar tela/fluxo admin de estorno | Médio |
| **RPC `admin_list_withdrawals`** | migration `20260712120000` | Sem client — painel admin de saques PLAYERVIP não a chama | Baixo |
| **`/api/voice/transcribe` + `/api/voice/parse-intent`** | `server/src/routes/voice.ts:33,94` | `parse-intent` só é chamado pelo cluster órfão `VoiceCommandPanel`/`LiveMatchManagerPanel` (nenhuma página monta); `transcribe` tem 0 callers | Médio |
| **`/api/narrative/key-moment`** | `server/src/routes/narrativeMoment.ts:19` | 0 chamadas; o keyMoment do Classic é lógica local | Médio |
| **GameSpirit Phase 1** (`/api/gamespirit` via orquestrador) | `gameSpiritPhase1Orchestrator.ts`, flag `VITE_OLEFOOT_GAMESPIRIT_PHASE1` (OFF) | Setar flag — mas só age dentro do TacticalSimLoop (engine legacy) | Baixo (flag) / Alto (mainstream) |
| **`/api/match/tick`** e **`POST /matches` + `/matches/:id/events`** | `gameSpirit.ts:29`, `matches.ts:21,79` | 0 consumidores (persistência real vai direto ao Supabase). Ligar OU demolir | Médio |
| **`/api/admin/legend-portrait`** | `legendImport.ts:400` | 0 referências | Baixo |
| **`useAgentsFieldSim`** + 8 hooks órfãos | `src/hooks/` | 0 importadores cada (`useLiveMatchStats`, `useMatchSimulation`, `useMatchSounds`, `useOfflineTranscription`, `useStatHighlights`, `useThrottle`, `useVoiceTacticalState`, `useCommandProgress`) | — (candidatos a demolição se não houver plano) |
| **`legendsCupCoach.ts`** | `src/match/legendsCup/legendsCupCoach.ts` | Usa `idealStyle` mas 0 importadores | Baixo |

**Falsos positivos corrigidos** (memória dizia desligado, mas estão VIVOS — não mexer): `idealStyle()`/`styleFit()` (ligados via `QuickPlanPlayer`→`resolveStyleOnEvent` no motor mainstream), `classicCoach`, `opponentRoster`, `quickNarrate`, `insights`, coach cluster, RPCs de playervip/liga-ole/referral/card-sales.

---

## 🟡 Seção C: Funcionalidades com Bug / Parciais

1. **Consequências ausentes no Quick** *(prioridade máxima)* — `creditQuickPlan.ts:150-193` só aplica fadiga/injuryRisk; não emite `injury`/`yellow_card`/`red_card` nem decrementa `contractMatchesRemaining` (isso só existe em `reducer.ts:2027` no `END_MATCH_TO_POST` e em `useGlobalConsequencesSync.ts`). Toda a infra downstream funciona (bloqueio de escalação `squadEligibility.ts:115-121`, acúmulo de amarelos, auto-renew debitando OLEFOOT) — falta só o produtor de eventos no pipeline Quick.
2. **Anti-auto-sorteio do amistoso quebrado** — `friendlyMatchmaking.ts:303` compara `manager_id` (que é **EMAIL**, gravado em `useAutoRegisterGlobalLeague.ts:35`) com `session.user.id` (**UUID**): nunca bate, manager pode enfrentar o próprio clube no fallback.
3. **Deep-link `?legacy=` da Legends Cup** — o CTA (`MatchQuickEngaged.tsx:909`) manda o id, mas `TransferLegaciesTab.tsx:108-116` só procura em `fetchListedLegacyPlayerRows()` (lendas **listadas à venda**); lenda não listada → `find` retorna undefined e nada abre. Agrava: consumo gated por `marketTab==='legacies'` + flags `LEGACY_MARKET && LEGACY_DNA`.
4. **Ranking da Home vazio** — `worldRanking.ts:28` tem `WORLD_TEAMS = []` (mock removido) e a integração real com `ranking_world_teams` nunca foi feita (0 fetch no código). Ranking mostra "1 de 1".
5. **Duas carteiras conceituais vivas** — `finance.ole` (EXP off-chain, Zustand) vs OLEFOOT (`legacy_olefoot_credits`, Supabase). Compra de legacy e auto-renew debitam OLEFOOT; o resto do jogo usa `finance.ole`. Sem reconciliação — usuário vê saldos desconexos.
6. **Desafios de partida fake** — `matchChallenges.ts:81` Hat-Trick retorna `false` fixo (nunca completa); `:54` Virada Épica não checa histórico de placar.
7. **Stats hardcoded no pós-jogo Classic** — `reducer.ts:1849,1906`: `possession: 60` e `wasLosingAtHalftime: false` fixos.
8. **2FA TOTP não valida no backend** — `useAdmin2FA.ts:113` / `twoFactorAuth.ts:64` (`user@olefoot` fixo).
9. **Persistência client-side esbarrando em RLS** — `managerGameState.ts:197,234` escreve direto em `manager_game_state` com TODO "mover pra RPC".
10. **`globalMatchScheduler.ts:284,319,320`** — fixtures reais, consequências e persistência com TODO.
11. **Modos legados semi-abandonados** — `/match` (LiveMatch), `/match/classic`, `/match/auto` têm rota ativa mas estão como `'soon'` sem `to` no `MatchModeBottomSheet.tsx:33-64`; `/match` ainda referenciado em `Layout.tsx:213`. Ironia: são esses motores que hospedam contratos/lesões (item 1).
12. **Pênalti V2** — comentário `BUG:` em `PenaltyKickModalV2.tsx:183` sobre mapeamento rng→outcome; conferir faixa `post_in` 0.64–0.72.

---

## 🎭 Seção D: Mapeamento de Mocks & Fakes

### Renderizando AGORA

| # | O que a UI mostra | Onde | Classificação |
|---|---|---|---|
| D1 | **Livro de ordens NPC do exchange ressuscita a cada load de save** — 8 ordens de clubes inventados (SC Atlântico, Porto Real FC…), preço `Math.random()`. O expurgo zerou o estado inicial, mas `persistence.ts:78` ainda chama `seedNpcExpExchangeOrders(8)` quando o array vem vazio (sempre) | `src/game/persistence.ts:78` + `src/economy/expExchange.ts:17-57` → `/mercado/exchange` | **REMOVER JÁ** (trocar para `const npcOrders = npcRaw;`) |
| D2 | **Inbox do manager 100% fabricado** — 15 mensagens com nomes reais ("Real Madrid ofereceu 1.5M por Mbappé", Haaland, Neymar, CR7), `read`/`timestamp` via `Math.random()` | `ManagerMessages.tsx:16` ← `socialTrade.ts:141-184` → `/manager/mensagens` | **REMOVER JÁ** (empty-state; não há fonte real hoje) |
| D3 | **Clubes-fantasma dão lances nos leilões** — "Real Madrid/Barcelona/Bayern" com orçamentos fictícios via `startAIEngine`, dispara para QUALQUER leilão, inclusive listagem real de manager | `liveAuctionEngine.ts:142-200` + `socialTrade.ts:68-90` → `/mercado/leiloes` | **REMOVER** `startAIEngine`/`AI_BIDDERS` (mercado é P2P) ou SUBSTITUIR por lances reais |
| D4 | **Card de destaque da Home com OVR 70 fixo + imagem picsum.photos** quando elenco vazio | `Home.tsx:281-296` | **REMOVER JÁ** (empty-state) |

### Minas latentes (não montadas, mas perigosas)

| # | O que é | Onde | Classificação |
|---|---|---|---|
| D5 | `useNpcMarketActivity()` — se alguém montar, injeta no Supabase `market_activities` (feed REAL da Home) atividades de 12 clubes + 20 jogadores inventados a cada ~30min | `src/market/npcMarketActivity.ts` (arquivo inteiro, 0 importadores) | **DELETAR o arquivo** |
| D6 | `generateMockActivities` — dead code com Mbappé/Haaland/Vini/Bellingham | `socialTrade.ts:93-138` | **DELETAR** |

### Verificado LIMPO (expurgos anteriores funcionaram)
Ranking da Home (mock virou `[]` — o problema agora é C.4, não mock), "Patrimônio Total" e sparklines da Wallet, feed de mercado da Home (100% Supabase — condicional a D5 ficar desmontado), NPC offers no Transfer ("mercado é exclusivamente Genesis"), Missions, ManagerScouts, YouthProspects, PremiumLeagues. `Math.random()` no motor de partida/animação é legítimo — ignorado.

---

## 🔴 Seção E: Plano de Demolição (Limpeza de Código)

Nota sobre "as 13 páginas órfãs": a varredura com grep de importadores encontrou **5 páginas verdadeiramente órfãs** (zero importadores). As demais candidatas ou são importadas por páginas vivas (`MatchQuickEngaged` ← MatchQuick, `TransferLegaciesTab` ← Transfer, `TeamMeuTimeHeader` ← Team/City, `useLegacyMatchEngine` ← FieldViewPreview) ou são páginas `/dev/*` com rota montada (dev-only, não órfãs). ⚠️ `FieldViewPreview` NÃO é dev-only: atende a rota de produção `/match/legacy` (`App.tsx:642`).

### Deleção segura (zero importadores confirmado)

```bash
cd /Users/jonhnes/Projects/olefootv-11

# Páginas órfãs
rm src/pages/GlobalLeagueCrowns.tsx \
   src/pages/MatchGlobalSetup.tsx \
   src/pages/MatchPenalty.tsx \
   src/pages/TeamEvolutionLine.tsx \
   src/pages/TeamTactics.tsx

# Artefatos de build .js/.map commitados em src/ (todos têm .ts irmão)
rm src/engine/types.js \
   src/gamespirit/types.js src/gamespirit/types.js.map \
   src/gamespirit/spiritSnapshotTypes.js src/gamespirit/spiritSnapshotTypes.js.map \
   src/gamespirit/narrativeTemplates.js src/gamespirit/narrativeTemplates.js.map \
   src/gamespirit/narrativeVariation.js src/gamespirit/narrativeVariation.js.map \
   src/gamespirit/spiritStateMachine.js src/gamespirit/spiritStateMachine.js.map \
   src/gamespirit/narrationSeed.js src/gamespirit/narrationSeed.js.map \
   src/gamespirit/GameSpirit.js src/gamespirit/GameSpirit.js.map \
   src/gamespirit/contextualNarrative.js src/gamespirit/contextualNarrative.js.map \
   src/gamespirit/GameSpirit.ts.new

# Minas de mock (Seção D)
rm src/market/npcMarketActivity.ts
```

`MatchPenalty.tsx` é distinto de `MatchPenaltyV2` (a viva); os hits no App.tsx são substring. Remover `TeamTactics`/`TeamEvolutionLine` não afeta `TeamMeuTimeHeader` (continua vivo via Team/City).

### Segunda onda (candidatos, exigem decisão)
- **9 hooks órfãos** em `src/hooks/` (lista na Seção B) — deletar os sem plano de uso.
- **`legendsCupCoach.ts`** e **`generateMockActivities`** (`socialTrade.ts:93-138`).
- **`.d.ts` gerados** em `src/gamespirit/` — conferir tooling antes de apagar em lote.
- **`shared/gamespirit/`** — só `SpiritRng.ts` é importado; o resto é dívida de migração planejada (README + comentário em `matchTickController.ts:10`), decisão arquitetural, não lixo.
- **Rotas backend sem consumidor** (`/api/match/tick`, `POST /matches`, `voice`, `narrativeMoment`, `legend-portrait`) — demolir OU ligar (Seção B).

### NÃO deletar (parecem lixo mas não são)
- `server/smartfield/*.py` — duplicação **intencional** de deploy (Railway roda com root `server/`; `sync:smartfield` copia; `smartfield/` raiz é a fonte canônica).
- Scripts operacionais em `scripts/` (genesis/pinata/migração v1/juca) — one-offs rodados à mão, valor operacional.
- Páginas `/dev/*` — montadas em rota; remover exige decisão de tirar as rotas.

---

## Priorização final (lente do rebrand Manager Core)

1. **Ligar consequências no Quick** (C.1) — destrava contratos+lesões+suspensões no modo principal; a infra toda já existe, falta o produtor de eventos no `creditQuickPlan`.
2. **Matar os 4 mocks vivos** (D1–D4) — meia hora de trabalho, remove tudo que engana o usuário.
3. **Executar a demolição segura** (Seção E) — reduz ruído antes de qualquer refatoração.
4. **Corrigir email vs UUID** (C.2) — raiz de identidade que trava amistoso e o "add pelo ranking".
5. **Deep-link Legends Cup** (C.3) — é o canal de venda; o CTA hoje aponta pro vazio quando a lenda não está listada.
6. **Emitir os 6 tipos de ledger** (Seção B) — extrato da wallet vira espelho real da economia consolidada.
7. **Decisão estratégica**: o motor de agentes 2D (`/match/legacy`) — promover, manter como lab, ou aceitar que o mainstream é estatístico.
