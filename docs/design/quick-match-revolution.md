# 🎮 Quick Match Revolution — Visão de Modo de Jogo

> **Status:** Spec de visão (memória da conversa de design). Ainda não implementado.
> **Diretriz mestre:** **REAPROVEITAR tudo que já existe** no quick match / engine /
> economia / ligas. Não criar nada do zero à toa. Cada item abaixo aponta o
> arquivo/sistema existente que serve de base.
> **Branch:** `claude/olefoot-engagement-analysis-fiz0i3`

---

## 1. Por quê (lições de engajamento)

Análise do fenômeno viral **7a0 / Sete a Zero** (simulador de Copa, browser, sem
cadastro) + **Cartola FC** (fantasy, scout por jogador, ligas, capitão) +
**Elifoot** (tela de jornada, ligas intermináveis) destilou as alavancas:

- **Fricção zero** na primeira partida.
- **Todo resultado vira artefato compartilhável** (print + código).
- **Desafio direto entre amigos** (não só vaidade).
- **Loop social > conteúdo**: rejogabilidade, ramificação, ego em jogo.
- **Mobile-first** e leve (aguentar pico viral).

Comportamento atual de leitura (dado de mercado): atenção ~8s, leitura longa em
queda (-39% 2014→2024), MAS texto **curto/cinético/legendado** é devorado (56% dos
<35 assistem com legenda ligada). → A narração precisa ser **legenda cinética
curta**, nunca parágrafo.

---

## 2. Os três modos (papéis distintos, motor compartilhado)

| Modo | Espetáculo | Papel | Base que já existe |
|---|---|---|---|
| **Quick** | O **lance** — narração interativa em tela cheia | A partida que você *joga* | `src/pages/MatchQuick.tsx` + `src/components/matchquick/*` |
| **Turbo** (auto evoluído) | A **jornada inteira** estilo Elifoot, instantânea | Resolver liga, rodada após rodada | `advanceMatchToPostgame` em `src/game/reducer.ts` (já resolve instantâneo) |
| **Liga Global** | Ranking de todos os managers | Competição contínua | `src/match/globalLeagueMVP.ts`, `src/supabase/globalLeague.ts` |

**Motor de resolução único** alimenta os três; muda só a **apresentação**.
O **scout** (pontos por jogador) é a régua comum entre eles.

---

## 3. O coração: Quick Match interativo

### 3.1 Resolução híbrida (não 100% pré-resolvida)
- **Fluxo ambiente** (toques sem importância) → pré-resolvido/instantâneo
  (reaproveita o motor do `auto`: `advanceMatchToPostgame` / `runMatchMinute`).
- **Nós de decisão** → **ramificam ao vivo** com base na escolha + atributos.
- **"30s" = piso de não-filler, não teto.** Tempo real flutua (~30–70s) porque o
  tempo **dilata** nos nós de decisão. Imersão = ritmo (tensão→alívio) + agência,
  não velocidade.

### 3.2 Narração em **tela cheia** (não no feed)
- Takeover cinematográfico: frases grandes, **uma por vez**, cadência crescente,
  clímax explode (GOOOL / PRA FORA! / DEFENDEÇÃO / NA TRAVE).
- **Reaproveitar:** padrão de overlays full-screen que já existe —
  `QuickMatchHero` (countdown), `GoalScorerOverlay`, `RedCardOverlay`,
  `QuickMatchHalftime`. O novo overlay de narração segue o mesmo padrão (overlay
  sequenciado), **não é arquitetura nova**.
- **Regras de texto:** linhas de 3–5 palavras, movimento é o gancho, sequência
  cabe em ~8s, som+haptic carregam a emoção, sempre pulável com 1 toque, clímax é
  **visual** (não frase pra ler).
- **Motor de cadeia:** reconstrói a jogada de trás pra frente — início/fim reais
  vêm do **scout** (assistente + artilheiro), o meio é preenchido por quem está em
  campo, escalado por **posição + atributo**.
  **Reaproveitar:** `src/gamespirit/narrativeTemplates.ts` +
  `shared/gamespirit/GameSpirit.ts` (resolução de chute/gol) +
  `src/match/impactLedger.ts` (quem marcou/assistiu).
- **Local-first:** templates locais + atributos. OpenAI só como floreio ocasional
  (hoje `MatchQuick.tsx` ~L1713 chama API p/ gols — manter fora do caminho crítico
  por causa de latência/pico viral).

### 3.3 Quase-gol = mesma emoção
- Mesma build de suspense, desfecho diferente. Gera emoção até em 0×0.

---

## 4. Decisões interativas (botões simples)

Exemplos:
```
Júlio César vai sair com a bola   ▸ Direita  ▸ Chutão   ▸ Esquerda
Palhinha recebe no meio-campo     ▸ Passe curto  ▸ Segurar  ▸ Recuar
@adauto recebe em profundidade    ▸ Drible  ▸ Chutar  ▸ Devolver
Atacante avança, @lugano cerca    ▸ Desarme  ▸ Carrinho  ▸ Cercar   (defesa também)
```

### 4.1 Resultado = escolha (intenção) × atributo do jogador × lenda em campo
- Mesmo botão, resultado diferente conforme **quem** executa. Camada de
  conhecimento/skill (estilo Cartola: saber pra quem pedir o quê).
- **Reaproveitar:** `src/match/quickInteractiveMoments.ts` **JÁ TEM** esse padrão —
  modal com escolhas de cobrador e **chance de sucesso baseada em atributos**
  (finalização, tático) + recompensas (OLE/EXP/momentum). Estender esse módulo em
  vez de criar do zero. (Hoje há ~15%/min de momentos interativos no quick.)

### 4.2 Cabe em 30s
- Decisão com **timer de 2–3s** (pressão = adrenalina).
- **Auto-pick no estouro** (opção segura / favorecida pelo atributo) — jogo nunca
  trava.
- **Racionar a ~3–5 nós/partida** (ataque + defesa). Resto flui no ambiente.

### 4.3 Consequência real e visível (anti escolha-falsa)
- O desfecho **muda de verdade** e mostra o porquê ("Carrinho! Lugano é lento →
  VERMELHO").
- Ramificação = cada partida única (rejogabilidade 7a0) + história compartilhável.

---

## 5. Escolhas geradas pelos atributos do TIME (loop com economia)

- Os 3 botões **não são fixos** — são **gerados pelo elenco em campo**:
  - Time **criativo** → desbloqueia `Passe genial`, `Drible`, `Lançamento`.
  - Time que **só defende** → só `Chutão`, `Recuar`, `Segurar` (criação nem aparece).
- O menu vira **espelho da qualidade do elenco** → o jogador **sente a limitação**.
- **Loop de ROI sentido:** comprar um meia criativo (economia/OLE/transferências)
  → **novo botão aparece** na próxima partida → cria mais → vence mais. Causa-efeito
  visceral entre gastar e jogar.
  **Reaproveitar:** economia/OLE (`docs/ECONOMY_OLEFOOT.md`, `src/systems/economy.ts`,
  `src/economy/`), atributos de `PitchPlayerState` (`src/engine/types.ts`).
- **Guardrail:** time fraco/defensivo precisa ter **fantasia própria** (`Muralha`,
  `Contra-ataque`, `Goleiro herói`) — divertido no seu nível, não punido. Comprar
  **expande a paleta**, não resgata da miséria. (Anti-churn de iniciante.)

---

## 6. Narrador reativo (motor emocional — "mexe com o jogador")

- O narrador **reage à SUA decisão**, com personalidade:
  - Cutuca no erro: *"Nitidamente o manager se precipitou. Agora se vira com dez."*
  - Exalta no acerto: *"QUE LEITURA! Passe genial, gooool!"*
- **Contraste é tudo:** crítica + elogio → o julgamento dele passa a ter peso.
- **Loop de retenção:** provocação → ardência ("eu sei jogar melhor") → revanche →
  replay. Dor com **autoria** (não RNG) = vontade de voltar.
- **Consequência sentida + reformula a partida:** vermelho → time com 10 → **menu de
  botões encolhe** (some criação). Narração e mecânica se reforçam.
- **Calibragem:** zoeira, não ofensa. **Escala pelo nível** (iniciante = cutucada
  didática; veterano = zoeira pesada). **Memória** do padrão ("de novo o carrinho,
  manager?") = intimidade/vínculo.
- **Compartilhável:** levar alfinetada épica vira conteúdo ("olha o que o narrador
  falou de mim kkk").
- **Reaproveitar:** `src/gamespirit/narrativeTemplates.ts`,
  `src/gamespirit/GameSpirit.ts`, sistema de emoção
  (`docs/OLEFOOT_EMOTION_DESIGN_SYSTEM.md`, `docs/GAMEPLAY_ACTION_OUTCOMES.md`).

---

## 7. Barra de momentum **vertical** (âncora espacial)

- Sem pitch, o texto perde o **"onde"**. A barra vertical resolve.
- **Duas camadas numa barra:**
  - **Marcador deslizante** = posição da bola no comprimento do campo.
  - **Cor / preenchimento / brilho** = momentum (quem domina).
- **Vertical = mobile-first** (celular em pé; atacar = subir = positivo). Seu gol
  embaixo, gol deles em cima.
- **É o "fluxo ambiente":** entre decisões, você **vê a bola viajar** na barra —
  cumpre o "assistir o jogo acontecer sem desgrudar", baratíssimo.
- **Instrumento de tensão:** sobe rumo ao gol deles → esquenta (perigo chegando);
  parada perto do seu gol → baixa e vermelha (pavor) + **haptic** na zona de perigo.
- **Fininha e periférica** — não competir com a narração em tela cheia.
- **Custo baixo — dados já existem.** **Reaproveitar:** `src/gamespirit/momentum.ts`
  (home/away -1..+1) + zonas/coordenadas do engine (`src/simulation/field.ts`,
  field zones). A `QuickMatchScoreboard` já renderiza uma barra de momentum
  **horizontal** — reusar a lógica, mudar a orientação.

---

## 8. Turbo (auto evoluído) — jornada estilo Elifoot

- Resolve a rodada toda instantânea e **anima as linhas caindo** (placar, depois
  artilheiro) — o "row drop" É o espetáculo, sem simular nada visível.
- **Seu jogo destacado** na tabela. **Tap numa partida → abre o quick** (ponte
  entre largura e profundidade).
- **Artilheiros vêm do scout** (mesma régua da liga).
- **Números de público = renda → economia/OLE** (bilheteria, igual Elifoot).
- **Ligas intermináveis:** promoção/rebaixamento, fixtures auto-gerados, tabela
  persiste — sempre tem próxima rodada.
- **Reaproveitar:** `advanceMatchToPostgame` (resolução), `src/match/localLeagues.ts`
  + `src/supabase/localLeaguesRanking.ts`, `docs/LEAGUES.md`,
  `docs/LIGAS_PLANO_IMPLEMENTACAO.md`, `docs/LIGAS_DIARIAS_EVOLUCAO.md`.

---

## 9. Scout (régua compartilhada) — peça nova mínima

- Converte `impactLedger` + eventos resolvidos em **pontos fantasy por jogador**
  (gol, assistência, passe-chave, desarme, defesa, cartão; **capitão x2**).
- Alimenta: narração (quem marcou/assistiu), tabela do turbo (artilheiros),
  standings de liga, valorização de jogadores.
- **Reaproveitar como fonte:** `src/match/impactLedger.ts`, eventos de
  `src/engine/types.ts` (goal/assist/card...). Novo módulo enxuto: `src/match/scout.ts`.

---

## 10. Inventário de reúso vs. novo

### Já existe (REUSAR)
- **UI quick:** `src/components/matchquick/` — Hero, Scoreboard (**barra momentum**),
  Feed, Lineup, Halftime, Summary (ver `docs/design/quick-match-refactor.md`).
- **Overlays full-screen:** GoalScorerOverlay, PenaltyKickModalV2, SetPieceModal,
  SubstitutionOverlay, RedCardOverlay (em `MatchQuick.tsx`).
- **Escolhas por atributo:** `src/match/quickInteractiveMoments.ts` (base do motor de
  decisão).
- **Resolução instantânea:** `advanceMatchToPostgame` (`src/game/reducer.ts`),
  `src/engine/runMatchMinute.ts`.
- **Narrativa/spirit:** `narrativeTemplates.ts`, `GameSpirit.ts` (src/ e shared/),
  `momentum.ts`.
- **Impacto/stats:** `src/match/impactLedger.ts`, `src/match/matchMonteCarlo.ts`.
- **Ligas:** `localLeagues.ts`, `globalLeagueMVP.ts` + supabase.
- **Economia:** `src/systems/economy.ts`, `src/economy/`, OLE.
- **Emoção/cards:** `docs/OLEFOOT_EMOTION_DESIGN_SYSTEM.md`,
  `docs/CARDS_CINEMATOGRAFICOS.md`, `docs/GAMEPLAY_ACTION_OUTCOMES.md`.

### Genuinamente novo (mínimo)
1. **Motor de cadeia de narração** (reconstrução por scout + atributos) — local-first.
2. **Overlay de narração full-screen sequenciado** (segue padrão de overlay existente).
3. **Geração de menu de botões por atributos do elenco** (estende
   `quickInteractiveMoments.ts`).
4. **Narrador reativo** (camada de feedback sobre a decisão; usa templates +
   memória do padrão do manager).
5. **Barra de momentum vertical** (reusa `momentum.ts`, muda orientação).
6. **Módulo `scout.ts`** (régua de pontos compartilhada).
7. **Turbo: tela de jornada Elifoot** (animação de linhas sobre resolução do `auto`).

---

## 11. Ordem de ataque sugerida (fases)

1. **`scout.ts`** (régua base; destrava narração, turbo e ligas).
2. **Resolução híbrida no quick** (motor do `auto` + nós ao vivo; remover cobrança
   de falta interativa de baixo payoff).
3. **Overlay de narração full-screen** + motor de cadeia (legenda cinética).
4. **Menu de botões por atributos do elenco** (estende `quickInteractiveMoments`).
5. **Narrador reativo** (feedback + calibragem por nível + memória).
6. **Barra de momentum vertical** (reusa `momentum.ts`).
7. **Turbo (jornada Elifoot)** + loop de ligas intermináveis.
8. **Card/código compartilhável** (resultado + scout do craque da rodada).

---

*Salvo como memória da conversa de design. Próximo passo: transformar em plano de
implementação detalhado por fase quando aprovado.*
