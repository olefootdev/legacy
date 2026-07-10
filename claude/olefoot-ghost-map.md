# 👻 Olefoot — Ghost Mapping Report

**Data:** 2026-07-10
**Arquivos varridos:** 1076 (.ts/.tsx) — eram 863 na auditoria anterior
**Score anterior:** 75/100 (2026-05-02)
**Score atual:** 78/100
**Evolução:** +3 pontos — mas por motivos mistos (ver veredito)
**Método:** 3 varreduras paralelas grep-backed (motor / app-UI / economia). Sem acusação sem evidência.

---

## ✅ Correções aplicadas nesta sessão (2026-07-10, pós-diagnóstico)

- **Ponte #1 (afiliado):** migration `20260710120000_fix_affiliate_commission_payout.sql` — `claim_my_affiliate_commissions` agora INSERE `wallet_credits` por moeda (espelha `claim_career_bonus`). ⚠️ **precisa ser aplicada no Supabase** (não deployável daqui).
- **Ponte #2 (Cápsula Lendária):** removida do Store (produto 100% placeholder — preço/estoque fake, compra = `console.log`). `MythicPackHero.tsx` + `MythicPackModal.tsx` deletados.
- **Ponte #5 (órfãos do motor):** 9 arquivos deletados — `matchLearningIntegration`, `utilityBridge`, `utilityShootDecision`, `replaySystem`, `globalMatchRealtime`, `dailyDigest`, `cycleCoachBridge`, `matchTickClient`, `positionAttributeWeights`.
- **Ponte #6 (executeCoachCommand):** função de "sucesso falso" deletada + import não-usado removido de `CoachCommandInput.tsx`.
- Lint (tsc) verde após tudo. Vite compila.

**Ainda abertas (precisam backend/deploy ou trabalho dedicado):** #3 2FA TOTP (segurança — backend), #4 ranking real na Home (precisa hoistar `myRank`), #7 OLEXP/GAT server-authority (infra grande, plano em docs/), #8 posse/confiança pós-jogo hardcoded, #9 DISCOVERABLE em Manager.tsx, #10 podar rotas órfãs.

---

## 🎯 Veredito Geral

> O **motor de partida evoluiu muito** (o maior órfão de 2026-05-02 — `agentProfile` — está ligado; o DNA agora muda resultado de verdade). Mas a varredura foi mais funda desta vez e revelou que a **camada de economia/loja mente para o jogador** em pontos críticos (comissão de afiliado que não credita, cápsula lendária que não compra). O motor subiu; a confiança da carteira puxou o score pra baixo.

---

## ✅ O que MELHOROU desde 2026-05-02 (provado)

- **`agentProfile` LIGADO** — era o órfão nº1 ("cache nunca populado"). Hoje: `TacticalSimLoop.ts:6299` popula o cache num loop por match (`for (const ag of [...homeAgents, ...awayAgents]) agentProfileCache.set(...)`), lido em `:3702`, e `applyAgentBiasToScore()` é chamado em `collectiveIndividualDecision.ts:399`. 🧬→🟢
- **DNA agora é VIVO, não decorativo** — `ego` entra em `OnBallDecision.ts:527`; `composure` em `OutcomeResolver.ts:68/80/97` e `Reception.ts`; `riskTaking` em `collectiveIndividualDecision.ts:517`. Valores mudam probabilidade de verdade.
- **Aprendizado ao vivo ligado** — `LiveLearningBridge` instanciado em `TacticalSimLoop.ts:458`.
- **GameSpirit quase determinístico** — só 2 `Math.random` reais (usa rng seedado quando disponível). `InteractionResolver` = 0.
- **Zero alucinações de comentário** — grep por "Integrated with / Wired to / Hooked into" veio vazio.
- **pressingTrap / momentumBuff / desperationBehavior / positionKnowledge** seguem vivos.

---

## 1. 🔴 Lógicas Órfãs (arquivos de lógica, zero import externo — verificado)

| Arquivo | Linhas | Diagnóstico |
|---|---|---|
| `src/agents/matchLearningIntegration.ts` | 135 | **Duplicata morta** — o aprendizado vivo é `liveLearningBridge`+`MatchLearningEngine`. Deletar. |
| `src/playerDecision/utilityShootDecision.ts` | 192 | Modelo de "instinto de finalização" (`shootInstinctUtility`, `SHOOT_INSTINCT_THRESHOLD`) **nunca chamado**. Sem equivalente vivo — intenção perdida. |
| `src/playerDecision/utilityBridge.ts` | 98 | Lib de scoring de candidatos (`scoreCandidate/sampleFromCandidates/pickBest`) que a decisão real não usa. |
| `src/match/replaySystem.ts` | 287 | Sistema de replay completo, zero import. |
| `src/match/globalMatchRealtime.ts` | 286 | Realtime de partida global, zero import. |
| `src/systems/dailyDigest.ts` | 152 | Resumo diário, zero import. |
| `src/match/cycleCoachBridge.ts` | 60 | "Bridge" que não liga nada. |
| `src/match/matchTickClient.ts` | 58 | Zero import. |
| `src/engine/test2d/positionAttributeWeights.ts` | 50 | Pesos por posição, zero import. |
| `src/match/coachCommands.ts:240` (`executeCoachCommand`) | — | **Retorna `success:true` FALSO** — todos os branches são stub `// TODO enviar comando`. Único import é não-usado em `CoachCommandInput.tsx:18`. O comando de voz real usa outro caminho (`VOICE_COMMAND_ISSUED`, `reducer.ts:1701`). |

Semi-mortos (só referenciados por ferramentas admin/reference, não pelo jogo): `advanceLiveStoryMinute.ts`, `prematchCoachSuggestion.ts`, `playerFromPrompt.ts`.

---

## 2. 🤖 Alucinações / "Sucesso Falso"

Comentários de instalação: **0** (limpo). Mas há **sucesso funcional falso** — código que diz "deu certo" sem fazer nada:

- `src/store/MythicPackHero.tsx:14` — `handlePurchase` = `console.log('Compra da Cápsula Lendária')`, fecha modal. **Compra fake.**
- `src/match/coachCommands.ts:240-334` — `executeCoachCommand` retorna mensagens de sucesso ("ativou skill", "mensagem enviada") sobre stubs.
- `src/admin/useAdmin2FA.ts:107` — `verify2FA` aceita **qualquer** 6 dígitos (`// TODO validação TOTP real`).

---

## 3. 💰 Economia — o ponto mais doloroso

### 3.1 🔴 Comissão de afiliado NÃO CREDITA (dinheiro queimado)
`claim_my_affiliate_commissions` (`supabase/migrations/20260527000100_affiliate_commissions.sql:236-247`) apenas marca `claimed_at = now()` e RETORNA o total — **nunca insere `wallet_credits`, nunca toca saldo.** Compare com `claim_career_bonus` (`career_progress.sql:260`) que insere corretamente. O cliente (`ManagerNetwork.tsx:380`, `ManagerCareer.tsx:196`) soma, mostra "X resgatados", dá `refresh()` → pendente zera, **saldo não muda**. Todo "Resgatar" de comissão de depósito **queima o valor**. É a comissão principal do MMN. (Justamente o botão da tela que acabamos de repaginar.)

### 3.2 🟡 OLEXP/GAT staking ainda client-only
`accrueOlexpDaily`/`accrueGatDaily` (`src/wallet/olexp.ts:159`) rodam só no cliente via `WORLD_CATCH_UP`. Sem tabela de posições no servidor (grep em migrations = nada). Limpar localStorage fabrica rendimento. (O *token* OLEXP no servidor é real; a *posição de staking* é ficção — dois "OLEXP" diferentes.)

### 3.3 🟡 3 sistemas de XP fragmentados
`finance.expLifetimeEarned` (carteira, real) · `progressionStore.expBalance` (contador órfão que carteira nenhuma lê) · `PlayerProgressionManager.totalXP` (só signature moves). O `expBalance` é um saldo morto.

### 3.4 🟡 Nível do jogador é cosmético
`evolutionXp` acumula de treino real, mas `getPlayerLevel` só alimenta UI — atributos sobem direto no treino, o nível não destrava nada.

✅ **Reais e ligados:** renda passiva, prêmios de liga, HODL (cron server), bônus de carreira (diferido pro próximo mount), débitos de compra (moeda certa em todos os casos checados).

---

## 4. 🎭 Números falsos na UI (hardcoded)

- `src/pages/Home.tsx:1062` — ranking pós-jogo fixo em **#1 / 0%** (`// TODO pegar do sistema real`).
- `src/game/reducer.ts:1860` — posse fixa em **60%** no pós-jogo; `:1917` `wasLosingAtHalftime:false`.
- `src/hooks/useVoiceCommandDispatch.ts:95` — obediência ao comando de voz usa `confianca:70` fixo (moral do jogador nunca pesa).
- `src/pages/MatchGlobalSetup.tsx:19` — `generateMockTeams()` com nomes reais (Flamengo/Palmeiras) e OVR `Math.random()`.

---

## 5. 🚪 Rotas Órfãs (registradas, nada navega até elas)

- `/olefoot/ranked` (`App.tsx:617`) — zero refs.
- `/liga-global/coroas` (`App.tsx:621`) — zero refs.
- `/match/global/setup` (`App.tsx:610`) — zero refs + mock teams.
- `/match/penalty-legacy` (`App.tsx:607`) — supersedido por `/match/penalty`.
- `/match/classic` (`App.tsx:626`) — dead-end intencional ("Em breve").

---

## 6. 🌉 Pontes a Construir (ranqueadas por impacto)

| # | Ponte | Origem → Destino | Esforço | Ganho |
|---|---|---|---|---|
| 1 | **Comissão afiliado credita saldo** | `claim_my_affiliate_commissions` SQL → INSERT `wallet_credits` | 🟢 | 🔥🔥🔥 |
| 2 | **Cápsula Lendária compra de verdade** | `MythicPackHero.handlePurchase` → debita+concede | 🟡 | 🔥🔥🔥 |
| 3 | **2FA admin real (TOTP)** | `useAdmin2FA.verify2FA` → backend | 🟡 | 🔥🔥 (segurança) |
| 4 | **Ranking real na Home** | `Home.tsx:1062` → sistema de ranking | 🟢 | 🔥🔥 |
| 5 | **Deletar órfãos do motor** | matchLearningIntegration/utilityBridge/utilityShootDecision/replaySystem/etc | 🟢 | 🔥 (clareza) |
| 6 | **executeCoachCommand: deletar ou ligar** | `coachCommands.ts:240` + import em `CoachCommandInput.tsx:18` | 🟢 | 🔥 |
| 7 | **OLEXP/GAT staking server-authoritative** | `olexp.ts` accrual → cron+tabela (padrão HODL) | 🔴 | 🔥🔥 |
| 8 | **Posse/confiança/ranking reais no pós-jogo** | reducer/voice hardcodes → estado real | 🟡 | 🔥 |
| 9 | **DISCOVERABLE_MANAGERS real** | `Manager.tsx:1320` → managers online | 🟡 | 🔥 |
| 10 | **Podar rotas órfãs** | /olefoot/ranked, /liga-global/coroas, /match/global/setup, /match/penalty-legacy | 🟢 | 🔥 |

---

## 7. 📊 Métricas

- Órfãos de lógica confirmados: **9 arquivos** (+3 semi-mortos admin) | Sucesso falso: **3** | Rotas órfãs: **5**
- DNA: 🟢 **VIVO** (era decorativo) | agentProfile: 🟢 **LIGADO** (era órfão) | Alucinações de comentário: **0**
- Bugs de dinheiro: **1 crítico** (afiliado) + **1 loja fake** (cápsula) | XP fragmentado em **3** sistemas
- **Score: 78/100** (+3 vs 75)

---

## 8. 💡 Conclusão (sem bajulação)

O **cérebro da partida está muito melhor** — o trabalho de acender `agentProfile` e fazer o DNA (ego/composure/riskTaking) pesar em fórmulas reais é exatamente a "inteligência" que faltava em 2026-05-02. Isso sozinho justificaria subir o score.

O que segura em 78 é a **camada de dinheiro/loja**: a comissão de afiliado é o pior achado do relatório — não é código morto, é **código que finge pagar e queima o valor**, na engrenagem principal do MMN. Somado à Cápsula Lendária (produto em destaque que não compra) e ao 2FA que aceita qualquer código, o jogo tem 3 pontos onde a UI mente. São poucos, são cirúrgicos, mas são de alta confiança — e o fundador acabou de repaginar a própria tela onde o bug do afiliado vive.

**Prioridade absoluta: ponte #1 (afiliado credita saldo).** Depois #2 e #3. O resto é limpeza (deletar órfãos) e honestidade (ranking/posse reais).
