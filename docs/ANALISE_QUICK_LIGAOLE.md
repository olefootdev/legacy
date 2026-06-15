# 🔍 Olefoot — Análise: Partida Rápida & Liga Ole

**Gerado em:** 2026-06-15
**Foco:** tornar os dois modos mais **virais, engajados e inteligentes**
**Base:** leitura do código em produção (`VITE_QUICK_PLAN_ENABLED=1` no `.env.production` — motor novo está NO AR)

---

## 📊 Diagnóstico — o que já está MUITO bom

Não vou repetir o óbvio: vocês já têm um motor cinematográfico determinístico de respeito. O que está sólido:

| Sistema | Onde | Veredito |
|---|---|---|
| Plano pré-computado (Python ~5ms) | `quickPlanClient.ts`, `match_simulator.py` | ✅ Arquitetura certa — replayable por seed |
| Beats do analista com decisões pesadas | `quickBeatDirector.ts:applyDecisionToRemainingEvents` | ✅ Decisão do manager muda o placar de verdade |
| Manager IQ (leitura → multiplicador) | `quickBeatDirector.ts:computeReadingScore` (0.85x–1.18x) | ✅ Recompensa quem lê o jogo |
| Intervalo vivo (5 cards + sub + formação + replan) | `QuickHalftimePanel.tsx`, `resumeFromHalftime` | ✅ Melhor momento do modo |
| Disputa de pênaltis determinística | `penaltyShootout.ts:simulateShootout` | ✅ Nenhum jogo empata, coração na boca |
| Streak + performance bonus | `quickStreakChallenges.ts`, `creditQuickPlan.ts` | ✅ Loop de retenção começou |
| Liga Ole: bracket semeado por força, 32 managers reais | `ligaOleModel.ts`, `fetchLigaOleTeams.ts` | ✅ Premissa forte: "só gente real" |

**Conclusão do diagnóstico:** a INTELIGÊNCIA do minuto-a-minuto está bem resolvida. O que falta não é mais profundidade de motor — é **transformar o resultado em algo que sai do app (viral)** e **dar APOSTA/CONSEQUÊNCIA ao jogador (engajamento)**. Os três eixos abaixo, em ordem de ROI.

---

## 🚀 EIXO 1 — VIRAL (maior buraco hoje, maior ROI)

### V1 — Card compartilhável de verdade (PRIORIDADE MÁXIMA)
**Problema:** `QuickMatchSummary.tsx` mostra um resumo bonito mas **morre dentro do app**. Não há `navigator.share`, nem export de imagem. Cada partida épica é um post de Instagram/WhatsApp que vocês estão jogando no lixo.

**Proposta:** gerar uma imagem 1080×1920 (story) no fim do jogo com:
- Placar gigante em Moret + brasões
- O lance decisivo ("Gol de [Jogador] aos 88'")
- Selo de Manager IQ ("Você leu 4/4 jogadas") ou arco narrativo ("VIRADA ÉPICA")
- QR/link curto `olefoot.com/r/<código>` (reaproveita o referral path-based que já existe)

**Como:** render off-screen num `<canvas>` (ou SVG→PNG), `canvas.toBlob()` → `navigator.share({ files })` no mobile, fallback download no desktop.
**Impacto:** cada vitória vira aquisição. Liga o resultado ao sistema de afiliados que já está em prod.
**Complexidade:** Média. **É o item número 1.**

### V2 — Clipe do GOOOL (15s)
**Problema:** a narração cinética full-screen (§3.2) é o momento mais "postável" e não fica gravado.
**Proposta:** botão "Salvar lance" que regrava o overlay de gol (já é determinístico por seed!) e exporta como vídeo curto / GIF via `MediaRecorder` capturando o canvas. Como é replayable por seed, dá pra re-renderizar limpo, sem a UI por cima.
**Complexidade:** Alta — mas o GIF estático já entrega 70% do valor com 30% do esforço.

### V3 — "Você venceu o time de @manager_real"
**Problema:** Liga Ole tem 31 managers REAIS e o jogo nunca diz isso na cara do jogador. O ativo social mais forte está mudo.
**Proposta:** no pós-jogo da Liga Ole, nominalizar: "Eliminou o **Botafogo do @joão** nas Quartas". Notificar o derrotado no inbox ("Seu time caiu pro [clube] na Liga Ole"). Isso cria rixa orgânica e traz o perdedor de volta.
**Complexidade:** Baixa (o `manager_id` já vem em `fetchLigaOleRivals`).

---

## 🔥 EIXO 2 — ENGAJAMENTO (consequência e aposta)

### E1 — Liga Ole precisa de APOSTA por rodada (hoje só o campeão ganha)
**Problema:** prêmio só na Final (`memorablePrizes.ts`: 3.5k EXP + 5k BRO). Perder na Fase de 32 = **zero**. Sem nada em jogo por rodada, não há tensão crescente nem motivo pra arriscar.
**Proposta:** pote escalonado + buy-in opcional:
- Entrada custa EXP (ex.: 200 EXP) → entra num pote.
- Cada fase vencida libera uma fatia crescente (Oitavas 5%, Quartas 10%, Semi 20%, Final 65%).
- "Cash out" não existe — perdeu, perdeu o que investiu. Isso é o que prende.
- Liga Premiada já fez isso (buy-in + pote realtime). **Reaproveite o padrão**, não reinvente.
**Complexidade:** Média. **Maior alavanca de retenção dos dois modos.**

### E2 — Matar o botão "Avançar até o campeão"
**Problema:** auto-skip da jornada destrói o produto. Se dá pra pular, por que jogar?
**Proposta:** trocar por "Simular esta rodada" que **abre mão de metade da recompensa** (trade-off explícito), mantendo o incentivo de jogar de verdade. Quem corre, paga.
**Complexidade:** Baixa.

### E3 — Fechar a Fase D da Partida Rápida (progressão visível)
**Problema:** o motor está no ar mas a memória indica progressão (XP/fadiga/evolução) ainda amarrando. Sem ver o jogador EVOLUIR após uma boa atuação, o loop não fecha.
**Proposta:** garantir que `applyMatchPerformanceEvolution()` + XP de leitura apareçam como **diff visível** no pós-jogo ("[Jogador] +1 Finalização", barra subindo). FM vicia por isso: você vê o número mexer.
**Complexidade:** Média (lógica existe em `creditQuickPlan.ts`; falta o feedback visual do delta).

### E4 — Missão diária ligada à Liga Ole
**Problema:** streak challenges são semanais e genéricos.
**Proposta:** "Avance 1 fase na Liga Ole hoje → +X". Daily objetivo dá motivo de abrir o app todo dia.
**Complexidade:** Baixa (estende `quickStreakChallenges.ts`).

---

## 🧠 EIXO 3 — INTELIGÊNCIA (o adversário e o contexto)

### I1 — Adversário que REAGE à sua escolha de intervalo
**Problema:** `awayMentality` existe mas o replan do 2º tempo não responde tática-contra-tática. Você muda pra ofensivo e o oponente não te pune pelo contra-ataque.
**Proposta:** no `resumeFromHalftime`, passar ao Python um `away_adjustment` derivado da sua escolha: se você foi all-in ofensivo e está ganhando, o away sobe a mentalidade e o `awayDefensePress`. Vira xadrez, não solitaire.
**Complexidade:** Média (o ledger de decisões já vai pro replan; falta o away ler ele).

### I2 — Pré-jogo com "intel" do adversário na Liga Ole
**Problema:** auto-resolução é sigmoid(OVR) puro, sem narrativa. O jogador encara o próximo rival no escuro.
**Proposta:** antes da partida, mostrar 1 linha de scout gerada do resultado auto-resolvido do rival na rodada anterior: "Seu próximo adversário goleou 4–0 — vem embalado". Dá leitura e peso à decisão de formação. Usa dados que **já existem** no `results[]` do bracket.
**Complexidade:** Baixa.

### I3 — Upsets com história (não só número)
**Problema:** quando um zebra ganha no auto-resolve, ninguém fica sabendo.
**Proposta:** detectar surpresas (vencedor com OVR bem menor) e injetar no feed da Liga Ole: "ZEBRA: [time fraco] eliminou o favorito". Dá vida ao bracket que hoje é uma tabela morta.
**Complexidade:** Baixa.

---

## 📋 Checklist priorizado (ordem de ataque)

- [ ] **V1** — Card compartilhável (canvas→share) — `QuickMatchSummary.tsx` + novo `buildShareCard.ts` ⭐
- [ ] **E1** — Buy-in + pote escalonado na Liga Ole — `ligaOleModel.ts` + `reducer.ts` (reusar Liga Premiada) ⭐
- [ ] **E2** — Trocar "Avançar até campeão" por "Simular (−50% prêmio)" — `LigaOle.tsx`
- [ ] **V3** — Nominalizar o manager derrotado + inbox — `LigaOle.tsx`, `fetchLigaOleTeams.ts`
- [ ] **I2** — Scout do próximo adversário — `ligaOleModel.ts` → `LigaOle.tsx`
- [ ] **I3** — Zebras no feed do bracket — `ligaOleModel.ts:resolveAutoMatch`
- [ ] **E3** — Delta de evolução visível no pós-jogo — `QuickMatchSummary.tsx`
- [ ] **I1** — Away reativo ao intervalo — `resumeFromHalftime` + Python replan
- [ ] **E4** — Missão diária Liga Ole — `quickStreakChallenges.ts`
- [ ] **V2** — Clipe/GIF do gol — `MediaRecorder` no overlay de gol

---

## 💡 Visão de longo prazo (o que torna o Olefoot único)

1. **O resultado é conteúdo.** FM e eFootball prendem o jogo dentro do app. Vocês têm seed determinístico → cada partida é um clipe perfeito e reproduzível. Explorem isso: o Olefoot pode ser o primeiro sim de futebol *nativamente postável*.
2. **Managers reais > clubes reais.** A premissa "só gente de verdade" da Liga Ole é o fosso competitivo. Nominalizar rivais, criar rixas e rankings de "quem eliminou quem" é uma rede social de futebol escondida dentro do jogo.
3. **Manager IQ como identidade.** Vocês já medem leitura de jogo. Transformem isso num número público no perfil ("IQ 1.14") — vira status, vira papo de WhatsApp, vira motivo pra jogar melhor.
4. **Aposta com EXP fecha a economia.** Liga Premiada provou o modelo. Liga Ole com buy-in transforma um modo de "passar tempo" num modo de "tô arriscando algo" — é a diferença entre engajamento e vício.
