# 🚀 Olefoot Quick Match Revolution — Handoff Brief para execução (Fable 5)

> **O que é este arquivo:** o briefing completo da nossa análise de
> engajamento/viralidade + o plano de execução para o agente de código local
> (Fable 5) implementar. Auto-contido: dá pra apontar o Fable 5 pra cá e mandar
> executar fase a fase.
>
> **Objetivo macro:** tornar o Olefoot mais **viral, engajado e divertido**,
> começando pela revolução do **Quick Match** (+ Turbo + Liga Global).
>
> **Diretriz inegociável:** **REAPROVEITAR o que já existe.** Não criar do zero o
> que o repo já tem. Cada tarefa aponta o arquivo-base.
>
> **Companion:** ver também `docs/design/quick-match-revolution.md` (a visão
> detalhada) e `docs/design/quick-match-refactor.md` (os 6 componentes visuais já
> criados).

---

## 0. Como o Fable 5 deve trabalhar (LEIA PRIMEIRO)

1. **Fase a fase.** Não tentar tudo de uma vez. Cada fase abaixo é um PR/commit
   coeso. Comece pela Fase 0/1.
2. **Reúso obrigatório.** Antes de criar qualquer arquivo, procurar o equivalente
   no inventário da Seção 4. Estender > recriar.
3. **Não quebrar os modos existentes.** `quick`, `auto` e `test2d` precisam continuar
   funcionando. Mudanças no motor compartilhado exigem rodar os self-tests.
4. **Plano antes de código.** No início de cada fase, listar os arquivos que vai
   tocar e o diff pretendido; só então implementar.
5. **Validar sempre:**
   ```bash
   npm run lint            # checagem TypeScript (no emit)
   npm run test:spirit-machine
   npm run test:shot-resolve
   npm run test:causal
   # ver package.json para a lista completa de self-tests
   ```
6. **Commits pequenos e descritivos**, por fase.
7. **Mobile-first sempre.** O alvo é celular em pé.

---

## 1. Contexto — por que estamos fazendo isto

Estudamos o fenômeno viral **7a0 / Sete a Zero** (simulador de Copa no browser, sem
cadastro, que viralizou na véspera da Copa 2026) cruzado com **Cartola FC** (scout
por jogador, ligas, capitão) e **Elifoot** (tela de jornada, ligas intermináveis).

**Alavancas de viralidade destiladas (aplicar no Olefoot):**
- **Fricção zero** na primeira partida (jogar em segundos; cadastro vira recompensa,
  não pedágio).
- **Todo resultado vira artefato compartilhável** (card + código de escalação/liga).
- **Desafio direto entre amigos** (carregar a escalação do outro e tentar bater).
- **Loop social > conteúdo** (rejogabilidade, ramificação, ego em jogo).
- **Surfar momento cultural** (Copa, clássicos) com eventos sazonais.
- **Nostalgia + combinações impossíveis** (craques de todas as eras).
- **Munição pronta pra criadores** (clipes, replays narrados).
- **Estabilidade sob pico** (serverless/cache; cair na viralização mata a onda).
- **Global + mobile-first** desde o dia 1.

**Comportamento de leitura atual (decisão de UX):** atenção ~8s; leitura longa em
queda; MAS texto **curto/cinético/legendado** é devorado (maioria dos <35 assiste
com legenda ligada). → Narração = **legenda cinética curta** (3–5 palavras/linha),
nunca parágrafo. Som + movimento + haptic carregam a emoção; texto é o tempero.

---

## 2. A visão — três modos, motor compartilhado

| Modo | Espetáculo | Papel |
|---|---|---|
| **Quick** | O **lance** (narração interativa, botões no feed) | A partida que você *joga* |
| **Turbo** (evolução do `auto`) | A **jornada inteira** estilo Elifoot, instantânea | Resolver liga, rodada a rodada, ligas intermináveis |
| **Liga Global** | Ranking de todos os managers | Competição contínua (já existe) |

- **Um motor de resolução** alimenta os três; muda só a apresentação.
- **Scout** (pontos por jogador) é a régua comum entre eles.

---

## 3. Princípios de design (regras que não se quebram)

1. **Imersivo ≠ rápido.** "30s" é piso de **não-filler**, não teto. O tempo dilata
   nos nós de decisão. Imersão = ritmo (tensão→alívio) + agência.
2. **Anti-arroz-de-festa.** Momentos grandes (cadeia de narração, botão interativo)
   são **raros e merecidos**, governados por uma régua de importância.
3. **Consequência sentida.** Erro/acerto muda o jogo de verdade e é mostrado
   ("Carrinho! Lugano é lento → VERMELHO; agora se vira com 10").
4. **Risco real de perder.** Sem chance de derrota, nada emociona (ver Fase 1).
5. **Iniciante se diverte.** Time fraco tem fantasia própria (Muralha/Contra-ataque/
   Goleiro herói); comprar jogador **expande a paleta**, não resgata da miséria.
6. **Local-first.** Narração por templates + atributos. OpenAI só como floreio
   ocasional, nunca no caminho crítico (latência/pico viral).
7. **Tela limpa.** Overlays entram e **saem**; nada de banner persistente.

---

## 4. Inventário de reúso (NÃO recriar — estender)

| Necessidade | Arquivo(s) existente(s) |
|---|---|
| Página do quick + overlays | `src/pages/MatchQuick.tsx` |
| Componentes visuais do quick | `src/components/matchquick/` (Hero, Scoreboard [tem barra de momentum], Feed, Lineup, Halftime, Summary) |
| Escolhas com sucesso por atributo | `src/match/quickInteractiveMoments.ts` ← **base do motor de decisão** |
| Resolução instantânea (Turbo) | `advanceMatchToPostgame` em `src/game/reducer.ts` |
| Loop de minuto | `src/engine/runMatchMinute.ts` |
| Tipos de modo/jogador/evento | `src/engine/types.ts` (`MatchMode`, `PitchPlayerState`) |
| Narrativa / resolução de chute-gol | `src/gamespirit/GameSpirit.ts` + `shared/gamespirit/GameSpirit.ts` |
| Templates de narração | `src/gamespirit/narrativeTemplates.ts` |
| Momentum (home/away -1..+1) | `src/gamespirit/momentum.ts` |
| Quem marcou/assistiu (fonte do scout) | `src/match/impactLedger.ts` |
| Probabilidade / vantagem de mando | `src/match/matchMonteCarlo.ts`, `src/match/contextFactors.ts` |
| Adversário real | `src/match/friendlyMatchmaking.ts` (`genesisAwayPlayers`) |
| Ligas locais / global | `src/match/localLeagues.ts`, `src/match/globalLeagueMVP.ts` + supabase |
| Economia / OLE | `src/systems/economy.ts`, `src/economy/` |
| Conversão de coordenadas / zonas | `src/simulation/field.ts` |
| Sistema de emoção / cards | `docs/OLEFOOT_EMOTION_DESIGN_SYSTEM.md`, `docs/CARDS_CINEMATOGRAFICOS.md`, `docs/GAMEPLAY_ACTION_OUTCOMES.md` |

---

## 5. Dores reais (validadas jogando) — prioridade máxima

1. **Banners pré/pós-jogo ficam persistentes e sujam a tela.**
   - `MatchQuick.tsx`: estados `quickPreStart` (~L873) e `summary` (~L742); há
     **renders de summary duplicados** (~L3668 e ~L4286).
2. **Time da casa sempre ganha → sem stakes.**
   - `matchMonteCarlo.ts` (`homeAdvantage`), `contextFactors.ts`,
     `GameSpirit.ts` (`DEFAULT_HOME_SHOT_WEIGHTS`); possível adversário sintético
     fraco em vez de elenco real.
3. **Feed precisa ser mais curado** (pra acomodar botões inline).
   - `MatchQuick.tsx`: pool/rotação (~L1425–1450, `FEED_ROTATE_MS`, pool de 14).

**Virada de direção do teste:** os botões interativos vão **inline no texto do
feed** (reusar `QuickMatchFeed.tsx`), não num takeover full-screen. Full-screen fica
reservado, no máximo, ao clímax (gol/vermelho).

---

## 6. Plano de execução por fases

> Cada fase: **objetivo → arquivos (reusar) → o que fazer → critério de aceite**.

### FASE 0 — Limpeza dos banners (rápido, alto impacto visual)
- **Objetivo:** tela limpa; nenhum overlay persiste após seu momento.
- **Arquivos:** `src/pages/MatchQuick.tsx`; `src/components/matchquick/QuickMatchHero.tsx`,
  `QuickMatchSummary.tsx`.
- **Fazer:** garantir desmontagem limpa de `quickPreStart` e `summary`; **consolidar
  os renders duplicados de summary** (L3668 e L4286) num só; revisar z-index/lifecycle.
- **Aceite:** durante o jogo não há banner de pré/pós sobreposto; summary aparece uma
  única vez; ao iniciar nova partida a tela zera.

### FASE 1 — Balance de mando + adversário real (a mais crítica)
- **Objetivo:** resultado importa — dá pra perder e empatar de verdade.
- **Arquivos:** `src/match/matchMonteCarlo.ts`, `src/match/contextFactors.ts`,
  `src/gamespirit/GameSpirit.ts` / `shared/gamespirit/GameSpirit.ts`,
  `src/match/friendlyMatchmaking.ts`, `src/game/reducer.ts` (START_LIVE_MATCH).
- **Fazer:** rebaixar `homeAdvantage` a valor realista; usar **força real do
  adversário** (`genesisAwayPlayers`) em vez de roster sintético fraco; revisar
  `DEFAULT_HOME_SHOT_WEIGHTS` para não favorecer a casa indevidamente.
- **Aceite:** em N partidas com times de força parecida, a casa **não** vence >~50–55%;
  derrotas e empates ocorrem; self-tests de shot/causal/spirit passam.

### FASE 2 — `scout.ts` (régua compartilhada)
- **Objetivo:** pontos fantasy por jogador, base de narração + turbo + ligas.
- **Arquivos:** **novo** `src/match/scout.ts`; fonte: `src/match/impactLedger.ts`,
  eventos de `src/engine/types.ts`.
- **Fazer:** converter impacto/eventos em pontos (gol, assistência, passe-chave,
  desarme, defesa, cartão; **capitão x2**). Função pura e testável.
- **Aceite:** dado um conjunto de eventos, retorna scout determinístico por jogador;
  cobertura por um self-test novo (`npm run test:scout` no padrão dos existentes).

### FASE 3 — Curadoria do feed + botões inline
- **Objetivo:** feed só com o que importa; botões de ação embutidos no item.
- **Arquivos:** `src/pages/MatchQuick.tsx` (rotação ~L1425–1450),
  `src/components/matchquick/QuickMatchFeed.tsx`, `src/match/quickInteractiveMoments.ts`.
- **Fazer:** **scoring de importância** por evento → filtra o feed; renderizar botões
  (`▸ Opção A ▸ B ▸ C`) dentro do item de feed do momento de nota alta; timer 2–3s +
  **auto-pick** no estouro; racionar a ~3–5 nós/partida.
- **Aceite:** feed enxuto; botões aparecem só em momentos relevantes; estouro de
  timer escolhe sozinho; jogo nunca trava.

### FASE 4 — Botões gerados pelos atributos do elenco (loop com economia)
- **Objetivo:** menu de ações = espelho da qualidade do time; comprar jogador
  desbloqueia jogadas.
- **Arquivos:** `src/match/quickInteractiveMoments.ts`, `src/engine/types.ts`
  (atributos de `PitchPlayerState`), `src/systems/economy.ts` / `src/economy/`.
- **Fazer:** derivar as opções disponíveis dos atributos dos jogadores em campo
  (criativo → `Passe genial/Drible/Lançamento`; defensivo → `Chutão/Recuar/Segurar`);
  garantir **fantasia do time fraco** (Muralha/Contra-ataque/Goleiro herói).
- **Aceite:** times sem criação não exibem opções criativas; após "contratar" um meia
  criativo (mock/real), a opção criativa passa a aparecer na partida seguinte.

### FASE 5 — Narrador reativo (motor emocional)
- **Objetivo:** o narrador reage à SUA decisão (cutuca no erro, exalta no acerto).
- **Arquivos:** `src/gamespirit/narrativeTemplates.ts`, `src/gamespirit/GameSpirit.ts`,
  docs de emoção.
- **Fazer:** camada de feedback pós-decisão; **calibragem por nível** (iniciante =
  didático; veterano = zoeira pesada); **memória do padrão** do manager ("de novo o
  carrinho?"); consequência reformula o resto (ex.: vermelho encolhe o menu).
- **Aceite:** mesma jogada gera feedback diferente por acerto/erro; tom escala por
  nível; nunca ofensivo; vermelho reduz opções subsequentes.

### FASE 6 — Barra de momentum **vertical** (âncora espacial)
- **Objetivo:** ver onde a bola está + quem domina, mobile-first.
- **Arquivos:** `src/gamespirit/momentum.ts`, `src/simulation/field.ts`,
  `src/components/matchquick/QuickMatchScoreboard.tsx` (já tem barra horizontal).
- **Fazer:** barra vertical fininha (gol seu embaixo, deles em cima); **marcador
  deslizante** = posição da bola, **cor/brilho** = momentum; é o "fluxo ambiente"
  entre decisões; haptic na zona de perigo.
- **Aceite:** marcador acompanha a fase da jogada; esquenta no ataque, esfria/
  avermelha na defesa; não compete com o feed.

### FASE 7 — Turbo (jornada Elifoot) + ligas intermináveis
- **Objetivo:** resolver rodada inteira instantânea, animando as linhas; ligas
  criadas por usuários, promoção/rebaixamento.
- **Arquivos:** `advanceMatchToPostgame` (`reducer.ts`), `src/match/localLeagues.ts`
  + `src/supabase/localLeaguesRanking.ts`, docs `LEAGUES.md`,
  `LIGAS_PLANO_IMPLEMENTACAO.md`, `LIGAS_DIARIAS_EVOLUCAO.md`.
- **Fazer:** tela de jornada (row-drop: placar → artilheiro do scout); seu jogo
  destacado; **tap numa partida abre o quick**; público → renda (economia/OLE);
  fixtures auto-gerados + tabela persistente + sobe/desce divisão.
- **Aceite:** rodada resolve e anima; artilheiros vêm do scout; liga avança sozinha
  com próxima rodada sempre disponível.

### FASE 8 — Card + código compartilhável (gatilho viral)
- **Objetivo:** todo resultado vira artefato + desafio.
- **Arquivos:** `src/components/matchquick/QuickMatchSummary.tsx`, `Postgame`,
  docs `CARDS_CINEMATOGRAFICOS.md`.
- **Fazer:** card de resultado (placar + scout do craque/"mitada" + narrativa) em 1
  clique; **código** copiável de escalação/liga pra puxar amigos.
- **Aceite:** gera imagem/card; código carrega a mesma escalação/cenário no amigo.

---

## 7. Guardrails e armadilhas

- **Não quebrar** `auto`/`test2d` ao mexer no motor compartilhado (rodar self-tests).
- **Performance/pico viral:** narração local-first; nada de chamada de API por lance.
- **Coordenadas:** respeitar engine 0–100 vs world meters (`src/simulation/field.ts`);
  casa ataca +X, visitante espelhado.
- **Mobile-first:** validar layout retrato; barra vertical e botões com área de toque
  adequada.
- **Tela limpa:** todo overlay novo precisa de desmontagem (lição da Fase 0).
- **Iniciante:** nunca punir sem dar fantasia/saída divertida.

---

## 8. Como tirar o máximo do Fable 5 (dirigindo a execução)

- **Peça o plano antes:** "Liste os arquivos que vai tocar na Fase X e o diff
  pretendido antes de codar."
- **Uma fase por vez**, com commit ao final e self-tests verdes.
- **Force o reúso:** "Antes de criar arquivo novo, mostre o equivalente que já existe
  no inventário e por que não serve (se for o caso)."
- **Exija critério de aceite atendido:** aponte a seção da fase e peça evidência
  (saída de teste, ou descrição do comportamento).
- **Comece pela Fase 0 + Fase 1** — limpeza visual + stakes reais. São as que mais
  mudam a percepção imediata do jogo.
- **Sequência de maior alavancagem:** 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8.

---

## 9. Resumo de uma frase

Transformar o Quick Match num **futebol interativo, narrado e mobile-first**, onde
**cada decisão importa e é sentida**, ligado a **scout + economia + ligas
intermináveis (Turbo/Elifoot) + Liga Global**, tudo **reaproveitando** o que o repo
já tem — para deixar o Olefoot **viral, engajado e divertido**.
