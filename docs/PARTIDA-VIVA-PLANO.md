# PARTIDA VIVA — o modo de jogo visual do OLEFOOT

> v2 · 09/10/2026 · análise do que foi tentado + pesquisa (Football Manager, mercado, IA) + revisão
> crítica externa incorporada + plano. Nome de trabalho: **Partida Viva**.
> Sonho do fundador: ver os jogadores se mexendo em campo — passe, roubada, chute, o rosto no token —
> com o celular deitado e o manager no comando.

---

## 0. Resumo em 6 linhas

1. O problema nunca foi motor: foram **duas verdades** (o campo simulava uma coisa, o placar vinha de outra) e **nenhuma tela** que o manager alcançasse.
2. A Partida Viva tem **uma verdade só**: o plano Python no servidor decide o jogo **e conta cada jogada** (quem passou, quem roubou, quem chutou).
3. Um **coreógrafo** pequeno em TypeScript transforma a jogada em movimento natural (forma do time + inércia + curva).
4. **PixiJS v8** desenha: 22 fichas com rosto, bola com rastro, câmera que acompanha. **Rive** nas celebrações. **Som** que reage ao perigo.
5. O manager comanda em **duas camadas**: o campo reage na hora; o resultado muda pelo replan no servidor a partir do minuto seguinte.
6. **Fase 1 em ~1 semana** já mostra o campo vivo no celular deitado, a partir do pré-jogo real. Modo completo em ~9–10 semanas.

---

## 1. O diagnóstico

| # | Por que não funcionou | Onde aconteceu |
|---|---|---|
| 1 | **Duas verdades.** O campo visual (Yuka + steering) rodava simulação própria; o placar vinha do GameSpirit e depois do Python. O que se via não era o que acontecia. | `TacticalSimLoop.ts` ↔ `GameSpirit.ts`; `visualBeatFromCausal.ts` era a cola |
| 2 | **Motor antes da tela.** A tela foi apagada antes do motor. Até hoje `runMatchMinute` calcula posições no modo `test2d` para ninguém ver. | `Live2dMatchShell.tsx` apagado em 12/05; `TacticalSimLoop` (6.472 linhas) sem host desde então |
| 3 | **Laboratório em vez de produto.** Field Lab, Field Lab Aérea, Field Lab Legacy, AgentsFieldView, FieldViewPreview, MatchClassic, MatchAuto — nenhuma virou "o botão que o manager aperta". | 263 arquivos (~51 mil linhas) removidos em `1813e1d` (05/10) |
| 4 | **3D cedo demais.** Babylon no navegador do celular antes de existir um campo 2D funcionando. | `src/render-babylon/*`, `web/match-pitch/` — removidos em `dbc74eb` (13/04) |
| 5 | **A verdade atual não tem coordenadas.** O plano Python sabe minuto, `zone: def|mid|att`, `channel` e autor — não sabe de onde veio a bola nem quem tocou antes. | `src/match/quickPlanTypes.ts:112` |

**Yuka e Python nunca foram renderização.** O Python decide o jogo; o Yuka calcula para onde cada um anda.
Trocar um pelo outro nunca resolveu porque faltava a camada que **desenha** — e essa camada é a parte
fácil e substituível.

### O que está vivo hoje
- **Partida Rápida 2.0** (`/match/quick` → `MatchQuickEngaged` + `QuickPlanPlayer`): feed, cartões do
  Analista, barra de momento, comemoração. **É a verdade e é auditável** (seed, custódia `plano_id`,
  SMART-PROFILE aplicado no servidor). Não tem campo.
- **Pênalti V2** (`/match/penalty`): único visual animado que funciona numa partida.
- **PranchetaViva** (`src/components/fundacao/PranchetaViva.tsx`, onboarding): canvas leve que prova que
  um time animado roda liso no celular.
- `/match`, `/match/legacy`, `/match/auto`, `/match/classic` → todos redirecionam pra Quick.

---

## 2. O que se aproveita (e o que não)

### Aproveitar
| Peça | Arquivo | Na Partida Viva |
|---|---|---|
| Plano Python determinístico | `server/smartfield/match_simulator.py`, `server/src/routes/matchPlan.ts` | **A verdade.** Ganha a "cadeia de lances" (§4.1). O loop já começa em `start_minute` (hoje 1 ou 46) — generalizar pra qualquer minuto é pequeno. |
| SMART-PROFILE | `server/src/lib/smartProfile/*` | Classe, traços e ideias passam a mexer também na *forma de jogar visível*. |
| Matchup Matrix + Analyst Beats | `quickPlanTypes.ts`, `quickBeatDirector.ts` | Leituras do auxiliar **desenhadas no campo**. |
| Momentos decisivos | `src/match/quickClutch.ts` | Duelo, Cara a Cara, Falta — congelam a cena no campo. |
| Geometria | `src/tactical/*`, `src/simulation/field.ts` | Coordenadas, `uiPercentToWorld`, `clampToPitch`. |
| Formações | `src/match-engine/formations/catalog.ts` | `FORMATION_BASES` dos 7 esquemas: âncora de cada ficha. |
| Forma do time | `src/engine/test2d/teamShape.ts`, `tacticalPositioning.ts` | **Portar as funções, não o arquivo** (868 linhas acopladas a voiceCommand, SmartField, speedBoost). |
| Trajetória da bola | `src/engine/test2d/ballTrajectory.ts` | Rasteiro, lançamento, cruzamento, chute — 129 linhas limpas. |
| Atributo → movimento | `src/engine/ultralive2d/applyAttrsToMovement.ts`, `src/match/playerSpeedTuning.ts` | Velocidade e aceleração da ficha. |
| Zonas | `src/match/tacticalField18.ts` | **A língua comum** entre Python e tela (18 zonas). |
| Retrato | `src/lib/playerPortrait.ts` (`playerTokenSrc`, `portraitFocus`) | O rosto na ficha. `portraitTokenUrl` já é o recorte 1:1 feito pra isso. |
| Perfis de decisão | `src/playerDecision/PlayerProfile.ts`, `agentProfile` | Fórmulas de escolha (passa/dribla/chuta) migram pra cadeia no Python. |

### Não ressuscitar
- **`TacticalSimLoop.ts` inteiro** — é a "segunda verdade". Tirar ideias e fórmulas, não o arquivo.
- **Yuka como motor** de 22 agentes livres (gera bolo; o `antiChaosEngine` existia pra remendar). O steering
  que a Partida Viva precisa é pequeno e próprio (§4.2).
- **Babylon / Unity WebGL / Godot web** — download grande, memória no iPhone, app à parte.
- **Restos mortos:** ramo `test2d` de `runMatchMinute`, `defaultLiveMatchShell: 'test2d'`
  (`initialState.ts:151`), mapeamento em `persistence.ts:392`, `mobile/…/MatchPitchWebView.tsx`, e os
  docs `PROMPT_MOTOR_VISUAL_BABYLON_YUKA.md`, `PROMPT_CURSOR_CAMPO_BABYLON_INTEGRADO.md`,
  `MATCH_SIMULATION_PIPELINE.md`, `MATCH_LIVE_*`, `EXPO_MATCH_PITCH.md`, `INTEGRACAO_MATCH_PITCH_EXPO.md`.

### O perfil do jogador: o que chega ao motor hoje
| Dado | Chega ao Python? | Na Partida Viva vira… |
|---|---|---|
| 10 atributos | ✅ (fisico/drible pouco) | velocidade da ficha, força do passe, quem ganha o duelo, quem chuta |
| `cabeceio, bolaParada, penalti` | ❌ caem no `matchAttributesFromPlayerEntity` | quem cobra escanteio/falta, quem ganha a bola aérea |
| `behavior` → `cognitiveArchetype` | ✅ (±3) | criador arrisca o passe vertical; finalizador chuta de longe |
| SMART-PROFILE (classe, traços, ideias) | ✅ só como delta de atributo | **comportamento visível**: regista recua pra buscar, velocista ataca as costas, matador ronda a área |
| `agentProfile` (5 subperfis) | ❌ | risco por placar, drible-vs-passe, timing de corrida |
| `skills` equipadas | ❌ (`skillIds` nunca preenchido) | skill com nome no campo ("Chute Colocado!") |
| fadiga (`playerHealth`) | ✅ | ficha mais lenta, **anel de fôlego** esvaziando, sugestão de troca |
| `strongFoot` | ❌ | de que lado recebe, corta pra dentro |
| retrato | — (fora do snapshot da partida) | rosto na ficha; sem foto → **iniciais na cor do time** (nunca foto aleatória do picsum) |

**Régua do fundador:** o que não chega ao motor é enfeite. A Partida Viva faz o perfil inteiro *aparecer*.

---

## 3. O que a pesquisa ensina

- **Football Manager.** Cada jogador decide a cada ~¼ s pelos atributos (Visão = quais passes enxerga;
  Passe/Técnica/Compostura = execução). O 2D "de bolinhas" nasceu em 2003 e sobreviveu ao 3D. Lances-chave /
  estendidos / completos, velocidade ajustável, gritos, auxiliar. **FM25 cancelado; FM26 (Unity, nov/2025)
  teve a pior recepção da série — por interface, não por motor.** Visual rico com interface ruim derruba o jogo.
- **Mobile.** Ninguém transmite 90 min. Padrão: melhores momentos + 1×/2×/4× + pular. **New Star Soccer**:
  nas chances o jogo congela e você arrasta pra chutar — referência de diversão.
- **Arquitetura.** Eventos (Elifoot, Hattrick) · agentes (FM — rico, caro, difícil de deixar bonito) ·
  **híbrida: decide estatisticamente, depois coreografa.** O OLEFOOT já tem metade da híbrida (o Python).
  Ferramentas: steering de Reynolds, "Simple Soccer" do Buckland, xT (grade 16×12), pitch control, passo fixo + seed.
- **IA.** Narração por IA da Bundesliga (AWS) é por evento e leva segundos. **LLM nunca roda por tick.**
- **Tela deitada.** `screen.orientation.lock` só no Android em tela cheia. **No iPhone não existe.**
  Quem tem trava de rotação gira o celular e a tela não gira → o palco precisa girar sozinho (§4.4).

---

## 4. A arquitetura

```
 escalação + SMART-PROFILE + tática + comandos
                 │
                 ▼
   ┌───────────────────────────────┐  SERVIDOR (já existe)
   │ match_simulator.py            │  decide: gols, chutes, defesas, cartões,
   │  └─ NOVO: cadeia de lances    │  momento, MVP ─► O PLACAR
   └───────────────────────────────┘  + cada posse vira cadeia: A→B (zona 7) → C rouba
                 │ MatchPlan v2 (~60 KB)
                 ▼
   ┌───────────────────────────────┐  CLIENTE · coreógrafo TS, passo fixo 10 Hz
   │ Coreógrafo                    │  forma do time + destino da jogada
   │  segue a cadeia, nunca decide │  + steering próprio: inércia, curva, separação
   └───────────────────────────────┘  + bola (ballTrajectory)
                 │ posições a 10 Hz
                 ▼
   ┌───────────────────────────────┐  CLIENTE · PixiJS v8 (WebGPU/WebGL), 60 fps
   │ Palco                         │  interpola (Hermite), câmera com amortecimento,
   │  + Rive (momentos) + Som      │  fichas com rosto, rastro, linha do passe
   └───────────────────────────────┘
```

### 4.1 A cadeia de lances (a peça que falta)

O Python emite **a jogada**, não posições. Para cada posse relevante, a sequência que leva ao desfecho
que ele **já decidiu**:

```ts
interface LanceAcao {
  t: number;              // segundo dentro do minuto
  tipo: 'passe' | 'lancamento' | 'cruzamento' | 'conducao' | 'drible'
      | 'desarme' | 'interceptacao' | 'falta' | 'chute' | 'defesa' | 'lateral' | 'escanteio';
  de: string;             // player_id
  para?: string;          // receptor / adversário envolvido
  zona: number;           // 1..18 (tacticalField18)
  sucesso: boolean;
  skill?: string;         // skill equipada que disparou
}
interface Lance { minuto: number; lado: 'home'|'away'; acoes: LanceAcao[]; desfecho: MatchEventKind; }
```

**Por que não "o Python manda as 22 posições 10× por segundo"** (sugestão da revisão externa, recusada):
90 min × 60 s × 10 = 54 mil quadros × 23 posições = vários MB por partida, e obriga o Python a virar um
simulador de 22 agentes — exatamente o `TacticalSimLoop` que nunca saiu do laboratório. A jogada é leve,
auditável e o placar nunca diverge do que se vê.

Regras:
- **RNG separado.** A cadeia usa um segundo fluxo da seed, depois do desfecho decidido. **Nenhum placar
  muda** — regressão de 1.000 seeds antes/depois exige distribuição idêntica.
- Quem passa, recebe e desarma sai dos atributos e perfis. É aqui que o perfil vira coisa vista.
- **Portão de consistência** (automático, a cada commit): gols nas cadeias == placar; todo `de/para` está
  em campo naquele minuto; nenhuma ação em zona impossível.

### 4.2 O coreógrafo (cliente)
- Passo fixo 10 Hz, determinístico pela seed.
- Os 22 seguem a **forma do time** (âncora da formação + deslocamento por bola/posse/fase).
- Só quem está na jogada ganha destino (receptor corre pro espaço, marcador fecha).
- **Movimento natural é requisito, não detalhe** (ponto acertado pela revisão externa): inércia,
  desaceleração ao virar, raio de curva, separação leve entre fichas. Steering próprio de ~100 linhas —
  sem Yuka. Sem isso o jogo parece "jogadores sobre trilhos".
- Velocidade = `velocidade` + fadiga. Força do passe = `passe`. Visível.
- Entre lances, o jogo corre acelerado com o bloco se mexendo.
- Nenhum arquivo acima de ~400 linhas.

### 4.3 O palco
| Camada | Tecnologia | O quê |
|---|---|---|
| Campo | **PixiJS v8** | Gramado com listras e linhas desenhado **uma vez** numa textura — custo zero por quadro |
| Fichas | PixiJS v8 | Sprite circular pré-renderizado: rosto (`portraitFocus`) + anel na cor do time + número + sombra. **Anel de fôlego** que esvazia. |
| Bola | PixiJS v8 | Sombra no chão + altura (lançamento/cruzamento) + **rastro** com opacidade decrescente |
| Leitura de jogo | PixiJS v8 | **Linha pontilhada do passe** que o meia está vendo; corredor aceso do auxiliar |
| Câmera | PixiJS v8 | **Amortecimento** seguindo a bola; zoom fecha quando a jogada chega na área (zonas de xG alto) |
| Topo | React | Placar, relógio, **barra de momento + xG acumulado** (dados já vêm do plano) |
| Momentos | **Rive** | Gol, cartão, substituição, momento decisivo — por cima do campo |
| Som | **Web Audio API** | Torcida que sobe com o perigo do lance; chute, apito, trave |

- Pixi usado de forma **imperativa** dentro de um `ref` do React (sem `@pixi/react`): o React cuida dos
  botões, o Pixi só desenha. Estado da partida fora do Zustand por quadro.
- Identidade DS 2027: cor chapada, tipo grande, sem enfeite.
- **Upgrade futuro sem trocar nada embaixo:** Three.js em **2.5D** (câmera inclinada, fichas como cartões
  virados pra câmera) = visual de transmissão. Troca só esta camada.

### 4.3.1 Layout em trilhos — o campo não divide espaço com nada (regra aprovada 09/10)

Com o celular deitado, o campo (105 × 68, proporção 1,54) é mais "quadrado" que a tela (~2,16). Sobram
duas faixas laterais **de qualquer jeito** — é ali que mora toda a interface.

```
┌──────────────┬──────────────────────────────────────┬────────┐
│ TRILHO ESQ.  │                                      │ TRILHO │
│ placar · min │                                      │  DIR.  │
│ momento      │              SÓ O CAMPO              │ Som    │
│ ──────────── │   (fichas, bola, linha do passe,     │ Pressão│
│ narração     │    fitas de skill, prancheta)        │ Gritar │
│  ou          │                                      │ Pranch.│
│ cartão do    │                                      │ 1×     │
│ jogador      │                                      │ Pausar │
└──────────────┴──────────────────────────────────────┴────────┘
```

- **Trilho esquerdo** (~20% da largura): placar, minuto e barra de momento fixos no topo; abaixo, um
  **slot de contexto** que alterna entre *narração* (lista, a mais recente em destaque) e o *cartão do
  jogador* tocado (nota, classe, fôlego, ordens). Fechar o cartão ou tocar em campo vazio volta pra narração.
- **Trilho direito** (~80 px): comandos, um embaixo do outro.
- **No campo, só o que é do jogo.** Nenhum painel, cartão, botão ou placar flutua sobre o gramado.
- **Momentos de cinema trocam o conteúdo dos trilhos, não cobrem o campo:**
  - *Duelo:* card do seu jogador + escolhas no trilho esquerdo; card do adversário + tempo de decisão no
    trilho direito (os comandos somem enquanto o jogo está congelado). O campo congelado fica inteiro à vista.
  - *Gol:* o cartaz (lambe) do autor ocupa o trilho esquerdo; o campo congela em preto e branco.
  - *Narração* vira **legenda dentro da faixa preta** de cinema; o selo de xG e o REPLAY ficam na faixa de cima.
- As faixas de cinema só aparecem com o jogo congelado ou em câmera lenta.
- Botões são elementos próprios do jogo (não herdam estilo de página).
- Referência visual aprovada: prévia "partida_viva_preview_trilhos" (09/10).

### 4.4 Tela deitada
1. Ao tocar em **"Assistir ao vivo"**: Android → `requestFullscreen()` + `orientation.lock('landscape')`.
2. iPhone (ou se o lock falhar): o palco é sempre 16:9 horizontal; em viewport retrato ele **gira 90° por
   CSS** com o toque remapeado. Funciona com ou sem trava de rotação. Animação curta "deite o celular" na entrada.
3. Ao sair, destrava e volta ao retrato.

### 4.5 Onde roda o Python: no servidor (decisão mantida)
A revisão externa sugeriu rodar o Python no celular (Pyodide/WASM, offline). **Recusado:**
- **Dinheiro e trapaça.** OLE, EXP, token, prêmios de liga e custódia do plano (`plano_id`). Simulação no
  aparelho do jogador é manipulável — o portão do SMART-PROFILE existe por isso.
- **Peso.** Pyodide baixa 10 MB+ e demora a iniciar — o mesmo problema do Unity.
- **Latência não é problema.** O Python leva ~5 ms; uma chamada por partida + uma por comando; o campo
  continua tocando enquanto isso.
- Melhoria barata a considerar: hoje cada chamada sobe um processo Python novo (`spawn` em
  `matchPlan.ts:178`). Com replans frequentes, um processo Python **residente** corta ~100 ms por chamada.

---

## 5. O modo de comando — duas camadas

**Camada 1, na hora (cliente):** o campo reage no mesmo instante — o bloco sobe, a aura de pressão acende,
o time abre. **Camada 2, a verdade (servidor):** replan a partir do minuto atual + 2. O manager sente o
comando na hora; o resultado muda pelo único lugar que decide.

| Comando | Como | Reação na hora | Efeito na verdade |
|---|---|---|---|
| **Mentalidade** (retranca → tudo ao ataque) | régua lateral | bloco sobe/desce | replan |
| **Gritos** (incentivar, cobrar, acalmar, pressão total) | 4 botões com recarga | aura / ícone de emoção | moral/intensidade por N min; fadiga sobe |
| **Instrução de time** (pressão alta/baixa, largura, cadenciar, focar corredor E/C/D) | painel | forma do time muda | pesos da Matchup Matrix |
| **Tocar na ficha** | cartão: nota ao vivo, fôlego, instrução individual ("segura", "ataca o espaço", "marca o 10") | ficha muda de comportamento | atributo situacional |
| **Substituição** | arrastar do banco pro campo | troca de ficha | replan com o novo jogador |
| **Prancheta** (pausar) | toque no campo | campo escurece; linhas do bloco, vetores de passe, espaço do adversário | — |
| **Auxiliar** (Analyst Beats) | corredor aceso + 2 escolhas | — | já existe; passa a ser desenhado |
| **Momento decisivo** (Duelo, Cara a Cara, Falta) | jogo congela; escolhe/arrasta | — | já existe em `quickClutch` |

Servidor: generalizar `mode: 'second_half'` para **`mode: 'from_minute'`** (o loop do Python já parte de
`start_minute`). O passado nunca muda; só o futuro. Custódia e anti-trapaça continuam valendo.

## 5.1 Direção cinematográfica — o diretor que sabe o futuro (aprovada 09/10)

A vantagem que nenhuma transmissão de TV tem: **o plano já sabe o que vai acontecer** (`xg`,
`weight_tier`, o gol) antes da jogada começar. O diretor de TV reage; o nosso **prepara o momento**.
O cinematográfico vem de **ritmo, enquadramento e silêncio** — não de efeito (DS 2027: sem brilho, sem glow).

| # | Recurso | Gatilho (dado que já existe) | Fase |
|---|---|---|---|
| 1 | **Faixas de cinema + foco**: barras pretas entram ~2 s antes; quem está fora da jogada perde o brilho; câmera fecha antes da bola chegar | `weight_tier` big/epic do lance | 3 |
| 2 | **Câmera lenta proporcional ao xG** (chance clara ~0,35×; chute difícil quase nada) + **silêncio da torcida no chute** | `xg` do evento | 3 |
| 3 | **Gol congela e vira lambe**: imagem em P&B, cartaz com a foto real do autor (`portraitUrl`), nome em Pirata One, fita com minuto e placar | evento de gol | 3 |
| 4 | **Comemoração**: autor corre pra bandeirinha, time se amontoa, adversário apaga | evento de gol | 3 |
| 5 | **Replay pela seed** (selo REPLAY, câmera no autor, lento) + **a jogada desenhada a giz** (toques numerados, nomes, "GOL") | cadeia de lances (§4.1) | 5 |
| 6 | **Entrada em campo**: túnel, fila, rostos apresentados com nome e número, cada um pra sua posição | escalação | 5 |
| 7 | **Assinatura por classe do SMART-PROFILE**: velocista deixa linhas de velocidade; regista, arco de giz no lançamento; matador, rastro pontilhado na área; skill em fita colada no campo | classe + skill da cadeia | 3 (depende da Fase 2) |
| 8 | **Duelo como cena**: congela, cards frente a frente (atributo × atributo), você decide; a escolha muda a jogada | `quickClutch` + cadeia | 4 |
| 9 | **Som e vibração**: torcida sobe com o perigo, chute seco, apito com eco, trave; vibração no gol/trave/roubada (Android) | Web Audio + `navigator.vibrate` | 5 |

**Não fazer:** brilho, partículas, chuva, 3D — antes do jogo estar redondo (ver "Depois").
Referência visual aprovada: prévia "partida_viva_preview_cinematografico" (09/10), já no layout em trilhos.

## 6. Modos de assistir
| Modo | Duração | Pra quem |
|---|---|---|
| **Rápida** (a de hoje) | ~1 min | quem só quer o resultado — continua existindo |
| **Lances** (padrão) | ~3–4 min | só as jogadas que importam, inteiras no campo; o resto acelerado |
| **Completa** | ~10 min | o modo FM; 1×/2×/4× e "pular pro próximo lance" |

## 7. IA — onde entra
- **Fora do loop.** Nenhum LLM decide lance nem roda por segundo.
- **Narração:** templates PT/EN por lance (já existem no Quick); LLM opcional só no gol e no intervalo.
- **Intervalo:** o auxiliar aponta *um* problema ("perdemos 8 bolas pela esquerda"). Regra + template; LLM
  só reescreve o texto.
- **Comando falado** (opcional, fim): "aperta a saída deles" → parâmetro validado → replan.

---

## 8. 🔎 O ponto surpreendente: a partida vira um FILME — de graça

Revisando a arquitetura, apareceu uma consequência que não estava no pedido e muda o produto:

**seed + plano + comandos = a partida inteira, reproduzível para sempre, sem gravar vídeo nem posição.**
Como o Python é determinístico e o coreógrafo também, qualquer partida pode ser **reassistida** a partir de
alguns KB que o servidor já guarda (`plano_id`). Isso abre três coisas que nenhum manager mobile tem:

1. **"Seu time jogou enquanto você dormia — assista."** Nas partidas contra time de outro manager (Quick
   contra time real, Liga Global), o dono do time adversário hoje só vê o placar. Com o filme, ele recebe
   *a partida que o time dele jogou* — com os rostos dos jogadores dele. É o maior gancho de retorno que o
   OLEFOOT pode ter, e o custo é quase zero: o filme já existe.
2. **Câmera do Craque.** Um modo que segue **um jogador** a partida inteira. Para lenda e PLAYERVIP isso é
   ouro: o atleta real (e quem tem o card dele) assiste **o seu jogador** jogando — toques, passes, o gol.
   Liga o motor ao produto que vende.
3. **Replay de gol pela seed.** O gol pode ser revisto de outro ângulo (2D agora, 2.5D depois) sem gravar nada.

> O card de gol compartilhável segue **parado até o fundador pedir** (decisão de 15/06). Os itens acima são
> dentro do jogo; compartilhar fora fica para quando ele quiser.

**Condição para o filme existir:** o coreógrafo precisa ser **estritamente determinístico** (mesma seed →
mesmas posições, em qualquer aparelho). Isso vira regra desde a Fase 1: sem `Math.random`, sem depender
de frame rate na simulação (só na interpolação), passo fixo sempre.

---

## 9. O plano em fases

Cada fase termina com **algo que o fundador vê rodando no celular, a partir do fluxo real do jogo**.

### Fase 0 — Limpar a trilha (2–3 dias)
- Apagar os restos mortos (§2). Marcar os docs antigos como superados por este.
- **Achado da análise de alcance (09/10):** o motor visual antigo (`TacticalSimLoop`, `playerDecision`,
  `agents`, `polishAI`, `simulation/*`, ~26 mil linhas) **nunca roda** — o esbuild a partir de
  `src/main.tsx` + servidor + todos os testes não o alcança. Ele só continuava "vivo" para o TypeScript por
  **dois fios de tipo**: `LiveMatchClockDisplay` → `TacticalSimLoop` e `GameSpirit`/`tacticalFoul` →
  `InteractionResolver.AgentSnapshot`. Cortando os dois, o bloco inteiro sai sem mudar comportamento.
- O modo `test2d` sai do tipo `MatchMode` e dos ramos de `runMatchMinute` (nenhuma tela o aciona desde abril;
  todo chamador de `defaultLiveMatchShell` já sobrescreve o modo).
- **Doadores para a Fase 3** (`teamShape`, `tacticalPositioning`, `ballTrajectory`, `applyAttrsToMovement`)
  saem do código vivo e ficam no histórico do git: **recuperar de `12e57c7`** (último commit antes da limpeza),
  ex.: `git show 12e57c7:src/engine/test2d/teamShape.ts`.
- ✅ **Executada em 09/10:** 99 arquivos removidos (~27,8 mil linhas), modo `test2d` fora do tipo `MatchMode`,
  aba "Ao vivo" (viewer Babylon morto) fora do app mobile, docs antigos marcados como SUPERADO, `CLAUDE.md`
  corrigido. Portão: `tsc` (web, carteira, servidor, mobile) zero erros, build ok, **82 testes passando antes e
  depois — lista idêntica** (`spirit-machine`, `awareness` e `analytics` já falhavam na base).
- Portão: `tsc` zero erros, build ok, e **a mesma lista de testes passando antes e depois**.

### Fase 1 — O campo respira (~1 semana) · fatia vertical, ponta a ponta
- Botão **"Assistir ao vivo"** no pré-jogo, ao lado da Rápida. Flag **por rota**.
- Palco deitado (§4.4) + **PixiJS v8** + 22 fichas **com rosto** e anel de fôlego nas posições da formação.
- Bola animada pelos eventos que o plano já tem hoje (zona + canal → ponto aproximado).
- Placar, relógio e comemoração reaproveitados do Quick.
- Coreógrafo determinístico desde já (§8).
- ✅ Pronto quando: o fundador deita o celular, vê os 22 rostos, vê o gol acontecer onde o placar diz.
- 🟡 **Implementada em 09/10 (beta, sem commit) — falta o fundador ver no celular.**
  - Entrada: botão **"Ver em campo"** no topo da Partida Rápida (contagem e jogo) + rota `/match/ao-vivo`.
  - Mesma partida, mesma verdade: o `QuickPlanPlayer` publica o lance JÁ resolvido (`onAoVivo` → canal);
    o palco só desenha. Placar, decisões, intervalo, pênaltis e crédito seguem da Rápida.
  - Código em `src/partidaViva/` (tipos, escalação, coreógrafo 10 Hz, palco PixiJS 8.20.1, orientação, canal).
    PixiJS em chunk próprio (94 KB gz) — o pacote principal não cresceu.
  - Self-test `npm run test:partida-viva` (9 conferências; validado contra o bug do "escorrimento" reproduzido).
  - **Limitações conhecidas da Fase 1:** (1) nas decisões (Analista, momento decisivo, lesão, intervalo,
    pênaltis) o palco sai da frente e volta sozinho — levar pros trilhos é a Fase 4; (2) substituições não
    trocam a ficha em campo; (3) a jogada é aproximada por zona + canal (a cadeia real é a Fase 2); (4) o
    determinismo vale por seed + sequência de quadros (o "filme" completo depende da Fase 2).

### Fase 2 — A cadeia de lances (~1,5 semana) · servidor
- `match_simulator.py` emite `lances[]` com RNG separado.
- Regressão de 1.000 seeds + portão de consistência.
- Especialistas entram: `cabeceio`, `bolaParada`, `penalti`, `strongFoot` escolhem quem faz o quê.
- ✅ Pronto quando: cada gol é uma jogada de 3–6 toques com nomes reais, e nenhum placar mudou.
- 🟡 **Implementada em 09/10 (sem commit) — falta deploy do servidor e ver no celular.**
  - `server/smartfield/cadeia_lances.py`: RNG próprio (`seed:cadeia:mode`), roda DEPOIS de tudo decidido.
    O simulador ganhou só 3 toques: especialistas no elenco (lidos só pela cadeia), `assist_id` no gol e a
    chamada final (desligável com `sem_cadeia`, usada no teste).
  - **Desvio do plano:** em vez da grade de 18 zonas, a cadeia sai com o ponto da bola em **metros** no
    referencial do campo (x 0–105, z 0–68, casa ataca +x). A grade do jogo (`tacticalField18`) é rotulada
    por função, não é uma grade limpa — metros são exatos e o cliente desenha direto.
  - **Portão (`python3 server/smartfield/test_cadeia_lances.py`):** 1.000 partidas idênticas ao simulador
    anterior do git em tudo menos a cadeia (placar, autor, xG, texto, momento, MVP); 2.474/2.474 gols viram
    jogada de 3–6 ações; 2.308/2.308 assistências batem com o último passe; ninguém fora de campo age.
    Mutação de prova (cadeia mexendo no xG) é pega na hora.
  - Escanteio deixou de ser "cobrança → cabeceio": nasce de uma jogada (ponta conduz, cruza, zaga desvia).
  - Especialistas: `cabeceio`, `bola_parada`, `penalti` e `pe` (pé bom) chegam do cliente e decidem quem
    cobra, quem cabeceia e se o ponta corta pra dentro. Não mexem no placar → não abrem brecha de trapaça.
  - Cliente: o coreógrafo encena toque a toque (corte inicial, receptor atacando o espaço, drible deixa o
    marcador pra trás, desarme rouba de verdade). O desfecho visual segue o lance MOSTRADO pela Rápida.
    Com o campo aberto, a Rápida segura cada lance o tempo da jogada (`segurarLance`, só apresentação);
    no gol, a jogada cabe em ~4,2 s (a comemoração da Rápida dura 5 s).

### Fase 3 — O jogo se mexe de verdade (~2 semanas)
- Forma do time portada (funções de `teamShape`/`tacticalPositioning`).
- **Movimento natural**: inércia, curva, separação. **Câmera com amortecimento** e zoom na área.
  **Linha do passe.**
- SMART-PROFILE vira comportamento (regista recua, velocista ataca as costas, matador ronda a área).
- Modos Lances / Completa, 1×/2×/4×, pular.
- ✅ Pronto quando: dá pra apontar "esse é o meu 10, olha ele achando o passe".
- 🟡 **Implementada em 09/10 (sem commit) — falta deploy e ver no celular.**
  - **Forma do time** (`src/partidaViva/forma.ts`, portada do `teamShape` doador): 9 intenções (construção,
    progressão, ataque pelos lados/centro, pressão alta, blocos médio/baixo, transições) → altura da linha,
    largura, compactação e gatilho de pressão, com viés por esquema. Quem está perto sai pra pressionar.
  - **SMART-PROFILE vira comportamento:** o servidor devolve a classe oficial dos 22 com o plano
    (`classesDaPartida`, mesmo classificador `classeDe`) e o campo aplica: regista recua, falso 9 sai da área,
    velocista ataca as costas, matador ronda a área, pivô fixa no centro, ponta driblador abre, lateral
    apoiador passa por fora, meia de chegada entra na área, box-to-box acompanha a bola, volante destruidor
    pressiona.
  - **Direção (§5.1, itens 1–4 e 7):** faixas de cinema com selo de xG e narração como legenda; câmera lenta
    proporcional ao xG no chute; gol congela em P&B (1,1 s) com o lambe no trilho; linha do passe pontilhada;
    assinaturas — linhas de velocidade (velocista/ponta), arco de giz no lançamento do regista/maestro,
    rastro pontilhado do matador.
  - **Modos:** Lances (ritmo da Rápida) e Completa (~4 min de relógio + lances), 1×/2×/4× e Pular (corre
    até o próximo lance, gol ou decisão). Só ritmo de exibição — o desfecho nunca muda.
  - Testes: `npm run test:partida-viva` com 21 conferências (forma, classes, câmera lenta, congelamento,
    cinema, linha do passe). Movimento ainda não visto em celular de verdade.
  - Fora desta fase: silêncio da torcida (som é Fase 5); replay e jogada a giz (Fase 5); duelo como cena (Fase 4).

### Fase 4 — O manager comanda (~2 semanas)
- Replan `from_minute` no servidor (+ processo Python residente se a latência pedir).
- Comando em **duas camadas** (§5): mentalidade, gritos, instruções, toque na ficha, substituição, prancheta.
- Auxiliar e momentos decisivos desenhados no campo.
- ✅ Pronto quando: um comando muda o que se vê **na hora** e o resultado nos minutos seguintes.
- 🟡 **Implementada em parte em 09/10 (sem commit) — Fase 4a.**
  - **Decisões nos trilhos:** Leitura do Analista, reação ("olha o contra-ataque"), momento decisivo e
    lesão/expulsão aparecem no trilho esquerdo; o campo fica à vista (no momento decisivo, congela com
    faixas de cinema). A resposta volta pelo canal (`responder`) e cai na MESMA função do botão da Rápida
    (`handleBeatChoice`, `reactToLeadIn`, `resolveClutchChoice`, `resolveInjury`, `resolveRedCard`).
    Só intervalo, batedor de pênalti, substituição manual, disputa e fim ainda tiram o palco da frente.
  - **Comando em duas camadas — estilo de jogo:** botão "Tática" no trilho direito abre os 5 estilos no
    trilho esquerdo. Camada 1: a forma da casa muda NA HORA (`ajustarPorEstilo`: pressão sobe o bloco e
    liga o gatilho; retranca baixa e fecha; ataque sobe e abre…). Camada 2: o mesmo `changeStyle` da Rápida,
    que já molda os lances seguintes (`resolveStyleOnEvent`) — verificado: o toque no campo trocou o estilo
    na Rápida e ela registrou "Estilo: Pressão — 1,6× fadiga".
  - **Toque na ficha:** cartão do jogador no trilho (rosto, classe do SMART-PROFILE com descrição, fôlego)
    e anel de seleção no campo. Mapeamento do toque no palco girado testado ponto a ponto (`pontoLocal`).
  - **Desvio consciente — `from_minute` NÃO foi feito.** A Rápida já aplica as decisões ao resultado no
    próprio aparelho, de forma determinística pela seed (estilo, Analista no replan do intervalo, momento
    decisivo, lenda, formação). Um replan no servidor a cada comando mudaria a Partida Rápida de TODO mundo
    (não só quem assiste em campo) e pede estudo de balanceamento. Fica pra **Fase 4b**, junto com o que
    depende dele: gritos (moral/intensidade), ordens individuais ("segura", "ataca o espaço"), substituição
    arrastando do banco e a prancheta com pausa.
- ✅ **Fase 4b feita em 09/10 — comandos que mudam o RESULTADO (só no LEGACY).**
  - **Gritos** (Tática → Grito): *Incentivar* (+ímpeto, cansa), *Cobrar* (aperta a saída, mais falta),
    *Acalmar* (toca a bola, acelera menos). Valem 10', um a cada 15' (recarga também no servidor).
    Viram ajuste TEMPORÁRIO nos eixos do DNA da casa que o motor já usa (teto ±0,15) —
    `server/smartfield/comandos_ao_vivo.py`. Nada de mecânica nova.
  - **Ordens individuais** (toque na ficha da casa): *Segurar posição*, *Atacar o espaço*, *Marcar de perto* —
    ±4 em atributos, sempre a partir da base do jogador (trocar de ordem não acumula).
  - **Camada 1 (na hora):** fita no campo ("APERTA!", "ESPAÇO" presa no jogador), `ajustarPorGrito`
    na forma e a ordem por cima da classe em `alvoNaForma`.
  - **Camada 2 (resultado):** `mode: 'from_minute'` no servidor, começando em **minuto+3** (o passado
    e o que já estava a caminho não mudam). No 1º tempo nenhum replan começa depois do 45' — o do
    intervalo leva os comandos. Só vale a resposta do comando mais recente. A Partida Rápida comum
    não muda: `comandos` só existem quando o LEGACY pede.
  - **Custódia:** cada replan entra em `planos` na ordem de emissão; `lancesDaPartida` costura do
    `minutoInicial` de cada um em diante (15 testes em `runCustodiaSelfTest`).
  - **Estudo de balanceamento** (`estudo_comandos.py --n 600`, portão: nada passa de +6 pp, replan vazio ≈ 0,
    cobrar custa cartão) — vitória sem comando 45,8%: replan vazio +0,3 · incentivar −0,3 · cobrar −0,2
    (cartões 0,71→0,84) · acalmar −1,8 · esperto +2,0 · atacar o espaço −4,2 · segurar −3,2 · tudo +0,7.
    Comando é ESCOLHA com custo, não atalho. Ficam pra depois: substituição arrastando do banco e prancheta.
- ✅ **Fase 4c feita em 09/10 — banco, prancheta e o Analista desenhado (só no LEGACY).** Fecha a Fase 4.
  - **Banco** (trilho direito, "Banco N"): arrastar o reserva até quem sai — o alvo é o jogador da casa
    mais perto do dedo (as fichas se mexem) e acende enquanto arrasta. Também: tocar no reserva e depois
    em quem sai, ou "Substituir ⇄" no cartão do jogador. Sem pausar e sem sair do campo. Quem entra chega
    correndo da lateral, perto do banco, com a fita "ENTRA". Lesão e intervalo trocam a ficha do mesmo
    jeito (o palco compara quem está em campo).
  - **Verdade:** a troca vale na hora no aparelho (o mesmo empurrão da Rápida) e o replan `from_minute`
    (minuto+3) refaz o futuro COM quem entrou. O reserva chega com o fôlego dele: `entrou_em` no payload,
    e o servidor só cobra o cansaço desde a entrada (no máximo 5 valem — `fadiga_ate_o_replan`).
  - **Prancheta** ("Prancheta" → "▶ Jogo"): o relógio da Rápida para, o campo escurece e mostra a leitura do
    quadro congelado (`prancheta.ts`): linhas de defesa e ataque dos dois blocos + comprimento, os passes do
    portador (livre = linha cheia; fechado = tracejado), as entrelinhas deles e o buraco na linha de defesa.
    O painel diz o mesmo em palavras — lido UMA vez quando o jogo para. Tática, banco e ordens funcionam com
    o jogo parado.
  - **Analista desenhado:** na Leitura do Analista, o campo ganha a faixa "A CHANCE" (canal da nossa
    oportunidade, no ataque) e "O PERIGO" (canal deles, na nossa defesa) — `corredorEmMetros`.
  - Trilho direito: "Lances/Completa" virou um botão só, pra caber Banco e Prancheta no celular.
  - Visto no navegador (paisagem e retrato girado): troca arrastada com o jogo andando e parado, troca por
    lesão, prancheta, corredores. Fora: momento decisivo com cards frente a frente (§5.1 #8) — segue no trilho.

### Fase 5 — Vivo e bonito (~2 semanas)
- **Som reativo** (Web Audio), **Rive** nas celebrações, ícones de emoção, skills com nome no campo.
- **O filme** (§8): reassistir partida, "seu time jogou enquanto você dormia", Câmera do Craque.
- Narração por lance PT/EN; LLM opcional no gol e no intervalo.
- 🟡 **Implementada em 09/10 (sem commit) — falta ver no celular.**
  - **Som** (`som.ts`, Web Audio, tudo sintetizado — sem arquivo): torcida que sobe com o perigo e CALA na
    câmera lenta do chute, explosão no gol, "uuuh" na trave, chute seco, toque no passe, apito com vibrato.
    Liga no toque de "Ver em campo" (o navegador só libera áudio num toque); botão Som no trilho.
  - **Vibração** (Android): gol, trave, roubada. iPhone não vibra pela web.
  - **Fitas no campo:** DRIBLE, ROUBOU!, FALTA, ESCANTEIO, NA TRAVE, DEFESA — lambe inclinado, cor chapada.
  - **O filme do gol** (`filme.ts`): comemoração → REPLAY (últimos 2,2 s da jogada, lento, câmera no
    autor, selo na faixa de cinema) → **jogada a giz** (campo escurece, caminho tracejado, toques
    numerados com nome, "GOL" no fim). A Rápida espera o campo terminar (`golEsperaCampo`, trava de 20 s);
    "Pular" encurta.
  - **Entrada em campo:** abrindo o campo antes do apito, os times saem do túnel, alinham, os seus
    jogadores são apresentados um a um e o apito manda cada um pra posição (~5 s; a contagem da Rápida
    espera).
  - **Não feito:** Rive (exige animações `.riv` desenhadas num editor por designer — o lambe do gol segue
    em HTML); "seu time jogou enquanto você dormia" e Câmera do Craque (precisam guardar e reabrir o plano
    da partida de outro manager — ideia do §8, fica pra depois do deploy); LLM no gol/intervalo (a narração
    da Rápida já vem do Sonnet quando disponível); skills com nome (a cadeia ainda não diz qual skill disparou).

### Fase 6 — O filme (§8)
- ✅ **Feita em 10/10 — reassistir no campo + Câmera do Craque (no aparelho).**
  - **Como:** o coreógrafo é determinístico, então o filme não grava vídeo nem posição: grava EM QUE PASSO
    cada quadro chegou (`gravacao.ts`). Reassistir = entregar os mesmos quadros nos mesmos passos a um
    coreógrafo novo. Toda mudança no coreógrafo causada por quadro passa por `entregarQuadro` (ao vivo e no
    filme); as trocas de jogador saíram do efeito do React pra dentro dela.
  - **Portão:** `test:partida-viva` grava uma partida sintética (lances, gol, troca, grito, quadros
    repetidos, entregas em passos irregulares), passa por JSON como no aparelho e reassiste: 602 passos
    idênticos posição a posição. O teste achou dois defeitos: lance comparado por referência (relido do
    disco, todo quadro parecia lance novo → `chaveDoLance`) e quadro repetido durante o gol encenando o
    lance (agora gol em cena não encena mais nada — também valia ao vivo).
  - **Onde:** no fim da partida vista em campo, "Reassistir em campo"; no menu PLAY, "Seus filmes · N"
    embaixo do LEGACY; rota `/match/filme` (lista) e `/match/filme/:id`. Guardados em `localStorage`
    (6 filmes, ~90 KB cada; sem espaço, descarta os mais velhos). Sair e voltar ao campo no meio da
    partida vira outro TRECHO (o filme toca os trechos em sequência).
  - **No filme:** intervalo e pênaltis passam direto; "Pular" vai ao próximo lance; o replay e a jogada a
    giz do gol tocam de novo; decisões viram só narração (o Analista continua desenhado).
  - **Câmera do Craque:** botão "Câmera" no filme (lista dos 22) e "Câmera do Craque 🎥" no cartão do
    jogador (ao vivo também). Só o enquadramento muda — o jogo não sabe que é seguido.
  - **Limite conhecido:** com a aba em segundo plano o navegador para de desenhar (rAF) mas o relógio da
    Rápida segue; o filme reproduz fielmente isso (os minutos sem campo chegam juntos).
  - **Não feito — precisa de tabela no servidor:** "seu time jogou enquanto você dormia" (mandar o filme
    pro dono do time adversário) e assistir em outro aparelho. Desenho: `partidas_filme` (dono, adversário,
    seed, resumo, filme jsonb ≤ 200 KB, RLS só servidor) + `POST /api/filme` (placar do filme tem de bater
    com o relato da custódia) + aviso no inbox do adversário.

### Fase 7 — "Seu time jogou enquanto você dormia" (§8, item 1)
- ✅ **Código feito em 10/10** — depende da tabela `partidas_filme` (migration 20261010120000).
  - **Fluxo:** no fim de uma partida vista em campo, o filme (Fase 6) sobe pro servidor
    (`POST /api/filme`). Se o adversário era o time de OUTRO manager (o id do adversário da Rápida já é
    a conta dele), ele recebe uma notificação ("Seu time jogou: RIV 1 × 2 OLE") que abre
    `/match/filme/s/:id` — a partida em campo, com o time DELE em amarelo.
  - **Lista de filmes:** ganha "Jogaram contra o seu time" (com selo NOVO até assistir).
  - **Trava contra notificação falsa:** o adversário tem de estar DENTRO da seed da partida, tem de
    existir plano emitido pelo motor pra (dono, seed), e o time de fora do filme tem de ser o elenco dele
    (8 de 11 ids no `manager_squad`). Teto: 10 avisos por dia por manager, 3 pro mesmo adversário.
    Bot e time da Liga Global (sem conta) não recebem aviso; o filme sobe mesmo assim (backup).
  - **Tabela fechada ao cliente** (RLS, revoke): só as 3 rotas do servidor leem e escrevem; o filme só
    abre pro dono ou pro adversário (outro id recebe 404). Um filme por (dono, seed); ≤ 400 KB.
  - Portão: `npm run test:filme` (17 checagens da conferência).

### Depois (se fizer sentido)
- Three.js **2.5D** (visual de transmissão) — troca só o palco.
- Clima e refletores por shader — **só depois** que o jogo estiver redondo (régua DS 2027: sem enfeite).
- Liga Global e Liga Ole usando a Partida Viva.

**Total: ~9–10 semanas.** A Fase 1 entrega o sonho em forma bruta em ~1 semana.

---

## 10. Regras de ouro
1. **Uma verdade só.** O placar sai do plano no servidor. O visual nunca decide.
2. **Tela primeiro, profundidade depois.** Fatia feia de ponta a ponta > motor perfeito sem tela.
3. **Alcançável desde o dia 1**, pelo fluxo real. Flag por rota, nunca por componente.
4. **Visto no celular a cada fase.** Teste verde não prova que o jogo funciona.
5. **Portão que não se valida sozinho:** gols animados == placar, conferido por teste.
6. **Determinístico sempre** — é o que dá o filme de graça.
7. **Arquivos pequenos** (≤ ~400 linhas).
8. **LLM fora do loop.**
9. **Interface enxuta antes de visual rico** (lição do FM26).
10. **O campo não divide espaço com nada** — interface nos trilhos (§4.3.1).
11. **Cinema é ritmo, não efeito** — o diretor usa o que o plano já sabe (§5.1).

## 11. Riscos
| Risco | Mitigação |
|---|---|
| Cadeia muda o balanceamento | RNG separado + regressão de 1.000 seeds |
| Android de entrada engasga | campo em textura fixa, sprites pré-renderizados, alvo mínimo 30 fps |
| iPhone com trava de rotação | palco girado por CSS — não depende de API |
| Latência do replan | o campo toca o plano já recebido; replan altera só do minuto +2; Python residente |
| "Jogadores sobre trilhos" | steering próprio (inércia, curva, separação) como requisito da Fase 3 |
| Coreógrafo não determinístico (mata o filme) | sem `Math.random`; passo fixo; teste: mesma seed → mesmas posições |
| Adversário sem rosto | iniciais na cor do time |
| Enfeite antes do jogo | clima/shaders/2.5D só depois da Fase 5 |

## 12. Revisão crítica externa — o que entrou e o que não
| Sugestão | Decisão |
|---|---|
| PixiJS v8 + Rive; recusar Unity/Godot/Babylon | ✅ confirmado |
| Interpolação 10 Hz → 60 fps | ✅ já estava; Hermite em vez de linear |
| Steering para movimento natural | ✅ entrou como requisito (próprio, sem Yuka) |
| Câmera com amortecimento e zoom por xG | ✅ Fase 3 |
| Som reativo | ✅ Fase 5 — era uma lacuna do plano |
| Anel de fôlego, linha do passe, ícone de emoção, momento + xG no topo | ✅ |
| Prancheta ao pausar | ✅ Fase 4 |
| Python manda 22 posições a 10 Hz | ❌ é o caminho que falhou; Python manda a jogada (§4.1) |
| Python no celular (Pyodide/WASM) | ❌ trapaça com dinheiro real, peso, latência irrelevante (§4.5) |
| Comando "instantâneo no motor" | 🔁 virou duas camadas: reação visual na hora + verdade no servidor |
| Clima/iluminação por shader | ⏸ depois — enfeite antes do jogo |

## Fontes da pesquisa
FM: footballmanager.com/news/match-engine-ai-fm21 · fmscout.com (entrevista Paul Collyer) · VGC/Sky Sports
(cancelamento FM25) · Wikipedia FM26. Mercado: Nordeus (Top Eleven 3D) · OSFTW (New Star Soccer) ·
Nintendo Life (New Star Manager). Arquitetura: Reynolds, *Steering Behaviors* (red3d.com/cwr/steer) ·
Buckland, *Programming Game AI by Example* (Simple Soccer) · Soccermatics (xT) · Hudl (possession value) ·
Google Research Football (arXiv 1907.11180) · DeepMind TacticAI (2024). IA: AWS × Bundesliga · IJCAI 2026 ·
GetStream. Web: caniuse ScreenOrientation.lock · WebKit bugs 257695 / 206854.
