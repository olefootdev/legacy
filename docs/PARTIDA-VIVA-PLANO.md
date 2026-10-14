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

### Fase 8 — "Sua lenda jogou" (§8, item 2: Câmera do Craque pra lenda/PLAYERVIP)
- ✅ **Código feito em 10/10** — depende das colunas `lendas`/`lendas_gols` (migration 20261010180000).
  - **Ligação:** o id do jogador-lenda no elenco É o `legacy_players.id` (`legacy-<slug>-<fase>`), e a
    carta aponta pro atleta (`beneficiary_user_id` — as 26 cartas já têm). Nada novo no cadastro.
  - **Ao gravar o filme** (`POST /api/filme`), o servidor marca as lendas que JOGARAM — titulares e quem
    entrou do banco; quem ficou no banco não conta — e os gols de cada uma (gol contado pela chave da
    comemoração, sem duplicar). O atleta recebe 1 aviso por dia no máximo ("Juca marcou 2 gols! OLE 3 × 1
    RIV"), sem o nome do clube de quem escalou.
  - **PLAYERVIP:** o cockpit ganha "Partidas da sua lenda" (placar, data, selo GOL). Abre
    `/playervip/filme/:id` — fora do cadastro do jogo (o atleta pode não ter clube) — com a Câmera do Craque
    JÁ na lenda e o time dela em amarelo.
  - **Acesso:** `GET /api/filme/:id` agora abre também pro atleta de uma lenda que jogou (papel `lenda`,
    com `seguir`); pra qualquer outro, 404.
  - Portão: `npm run test:filme` (25 checagens).
  - Fora: quem COMPRA a carta assistir a lenda nos jogos de outros managers (precisa de regra de
    privacidade entre managers — decisão do fundador).

### Fase 9 — O jogo explica (§5.1 #8 + §7)
- ✅ **Feita em 10/10.** Escolha consciente: com 0 filmes no banco (nenhuma partida LEGACY terminou desde a
  Fase 7), nada de 2.5D/clima (regra: enfeite só com o jogo redondo) — e sim o que deixa a partida mais
  inteligente.
  - **O duelo como cena:** no momento decisivo, o duelo é atributo × atributo, por escolha (atacando:
    Finalização/Drible/Passe do nosso × Goleiro/Marcação deles; defendendo: Marcação × Drible, Velocidade
    × Velocidade, Físico × Físico). O rival vem do contexto ("cara a cara" = goleiro; "zagueiro fechando" =
    zagueiro…). No campo (LEGACY) a câmera enquadra os dois, o resto apaga, nomes em fita; no trilho e na
    Rápida, cada botão mostra "84 × 64".
  - **🔴 Achado: o atributo NÃO pesava.** `resolveClutch` aceitava o atributo do protagonista mas era
    chamado sem ele (todo mundo = 70). Agora entra `forcaNoDuelo` = 70 + (nosso − deles) × 0,8: duelo
    empatado = jogo de antes; +20 de vantagem ≈ +3 pp; teto ±7 pp. A escolha certa segue mandando.
    Vale pra Rápida também (é o mesmo momento decisivo).
  - **O auxiliar no intervalo:** aponta UM problema do 1º tempo pelos lances mostrados ("Eles chegaram 3
    vezes pela esquerda") e sugere a estratégia ("Seguir: Defensiva"), que vai pro replan do 2º tempo.
    Regra + modelo de texto, sem LLM (`auxiliarDoIntervalo.ts`). Visto no navegador.
  - Fix: a lesão sem nome no lance mostrava "starter is hurt" — agora busca o nome no elenco.
  - Portão: `npm run test:auxiliar-duelo` (13). Não visto rodando: o enquadramento do duelo no campo
    (nas 2 partidas de teste os gols vieram de decisão do Analista, que não vira momento decisivo).

### Fase 10 — LEGACY LEAGUE + skills com nome + narração em inglês (10/10)
Decisões do fundador (10/10): Liga Global e Liga Ole SEGUEM no motor delas; nasce a **LEGACY LEAGUE**,
que só se joga na Partida Viva. 2.5D e Rive: ainda não (testar toda a lógica antes).
- **Narração em inglês** — o motor narra no idioma do jogador (`idioma.py`; header `X-Olefoot-Idioma`
  → `body.lang`; cache separado por idioma): lances, motivos, rótulos dos canais, leitura e botões do
  Analista. Português sai idêntico ao de antes; o inglês usa as MESMAS escolhas determinísticas
  (listas do mesmo tamanho, mesmo índice). Portão: em 120 partidas, a partida em inglês é a mesma do
  português — só o texto muda (`test_cadeia_lances`). O motivo em inglês mantém "individual" (o cliente
  reconhece o lance de craque por ela).
- **Skills com nome** — `nomear_skills` (cadeia_lances.py) nomeia a ação SÓ quando o jogador tem atributo
  pra ela (drible 85 + velocidade 80 = Arrancada; drible 82 = Elástico/Caneta/Chapéu; passe 84 antes do
  chute = Passe milimétrico; chute de fora com finalização 78 + físico 70 = Bomba…; 18 skills) e manda a
  nota que justifica. Sem rng: nenhuma cadeia e nenhum placar mudam. No campo LEGACY aparecem no TRILHO
  esquerdo (nunca por cima do campo), na hora da ação: "✦ Elástico · Juca · drible 86". Portão: ~15% das
  ações num elenco forte, 0 num time de atributos 62, skill sempre no tipo de ação certo.
- **LEGACY LEAGUE** — `/legacy-league` (menu PLAY, embaixo do LEGACY). Temporada semanal ISO, tabela
  3/1/0 (pontos, saldo, gols, menos jogos), campeão da semana passada. Até 3 partidas por dia; o SERVIDOR
  abre a partida e sorteia o adversário (time de outro manager real, de preferência inédito na semana).
  A partida abre direto no campo (`/match/ao-vivo?liga=<id>`), a seed carrega `-LL<id>`, e ela só VALE
  com custódia válida (evolucao_sombra) + o filme (partidas_filme) — prova de que foi vista em campo.
  Empate que foi aos pênaltis = 1 ponto. Partida aberta e não jogada expira em 3 h. Sem prêmio em moeda
  (economia é decisão do fundador): a recompensa é a da partida + tabela + título da semana.
  Tabela `legacy_league_partidas` (migration 20261011000000, RLS fechada). Portão: `test:legacy-league` (18).
- Também: `stubDoElenco` (friendlyMatchmaking) virou a conversão única "elenco → adversário".

### Correções do 1º teste do fundador (10/10)
O fundador jogou 2 partidas LEGACY no celular. O que ele viu → o que era → o que mudou:
1. **"Os jogadores não fazem a formação antes do apito"** — a entrada durava ~5 s e o relógio da Rápida
   já corria (1,7 s/tique): a partida começava com os times saindo do túnel. Agora: túnel → perfilados
   (apresentação) → cada um corre pra **posição de saída no seu campo** (atacante da casa na bola) →
   **apito quando todos chegam** (máx. 6 s) → só então a Rápida começa (`onApito`; trava de 16 s).
   Antes do apito a bola não rola.
2. **"O relógio está minúsculo"** — o minuto virou o maior número do trilho (40 px) + "1º/2º tempo".
3. **"Travou no 16' / no 11'"** — as duas paradas foram no 1º gol NATURAL = momento decisivo: o campo
   congela de propósito esperando a escolha no trilho, e não ficava claro que era com ele. Reproduzido
   local (gol e falha): sem erro. Agora: título "SUA DECISÃO", faixa de baixo "SUA DECISÃO ← escolha no
   painel", toque + vibração, **prazo de 15 s** com barra — sem resposta o jogador decide sozinho (maior
   vantagem no duelo). O jogo nunca fica parado.
4. **"Os eventos não condizem com a cronologia"** — a Rápida publica o lance ANTES do campo encená-lo:
   placar, lambe "GOL" e narração apareciam antes da bola entrar. Agora o palco segura placar/lambe/
   narração até o campo mostrar (gol: quando a bola entra; lance: quando a encenação acaba; teto 9 s).
5. **"Barulho constante ao fundo parece bug"** — era o murmúrio da torcida (ruído marrom contínuo).
   Agora a torcida é muda e só aparece no perigo (bola perto do gol), no chute e no gol.

### Fase 11 — Bola parada de verdade (2º teste do fundador, 10/10)
1ª partida LEGACY completa validada de ponta a ponta (custódia válida, 2×0, filme, aviso pro FCH).
O fundador apontou: escanteio sem ninguém ir à bola, sem defensores na área; faltas e pênaltis "não existem".
- **Medido (300 partidas):** escanteio 2,6/jogo (existia, mal encenado: cobrador TELETRANSPORTADO); falta
  cobrada 0/jogo (não existia); cartão 1,4/jogo (sem jogada); pênalti 0,17/jogo e escondido pela tela da Rápida.
- **Motor** (`cadeia_lances.py`, só a jogada — nenhum placar muda): cartão ganha a falta (quem sofre conduz,
  quem leva o cartão derruba); metade das bolas paradas com finalização vira FALTA perto da área (direta
  pelo autor, ou cruzada pra cabeçada — quem cobra é a assistência). Nova ação `cobranca_falta` + skill
  "Falta no ângulo". Por jogo: ~1,7 falta cobrada + ~1,3 falta de cartão.
- **Campo** (`bolaParada.ts`): antes de cada bola parada o jogo PARA (preparação no cronograma: escanteio
  2,8 s, falta 3 s, pênalti 2,6 s) e os times se posicionam — cobrador CORRE até a bola (corte de TV a 12 m,
  o resto à vista); escanteio com 1º pau, 2º pau, marca do pênalti e rebote, cada atacante com marcador,
  goleiro e zagueiro no 1º pau; falta com barreira de 3–4 a 9,15 m na linha do gol; pênalti com todos fora
  da área (linha + meia-lua). Cartão: "AMARELO"/"VERMELHO" em quem derrubou.
- **Pênalti no LEGACY:** sai da tela da Rápida — "Pênalti! Quem bate?" no trilho (finalização de cada um,
  prazo 15 s, sem escolha bate o melhor); o campo mostra a falta, o posicionamento e a cobrança do batedor
  ESCOLHIDO (gol ou defesa). O do adversário defendido também vira cena.
- Portões: `test:partida-viva` (escanteio, barreira, pênalti, cartão) e `test_cadeia_lances` (placar intacto).

### Fase 12 — O jogo entre os lances, números ao vivo, regras e perfil (10/10)
Pedido do fundador: os passos 1–4 do "mais realista" (o 5, narração jogada a jogada, ficou de fora: informação demais).
1. **Posse minuto a minuto** — o motor já decidia, a cada minuto, quem tem a bola, em que terço, se roubou
   e QUEM carrega; agora expõe isso (`plan.fluxo`, ~2,8 KB, só registro: nenhum sorteio a mais, placar
   intacto). O campo joga a posse do plano: o time fica no terço certo (def 30 m · meio 50 m · ataque 70 m
   do próprio gol) e a bola chega em quem o plano diz que a carregou. Replans emendam o fluxo.
2. **Números ao vivo + consequência** — posse, chutes, xG e escanteios no trilho (dos lances JÁ mostrados,
   com a mesma regra de cronologia do placar). 10' depois de um grito/ordem/troca/estilo, a narração conta o
   efeito NAQUELA janela: "📊 Depois do grito Cobrar (31'–41'): posse 58%, 3 roubadas, chutes 2×1".
3. **Regras** — a troca de posse vira regra no campo: roubada; LATERAL (meio); TIRO DE META ou IMPEDIMENTO
   (quando quem perdeu estava no ataque: o atacante passa da linha do último zagueiro, bandeira, falta pra
   defesa). Uma regra por vez (no modo Lances os minutos voam: a próxima troca é silenciosa).
   **Acréscimos** no 45' e no 90' (relógio "45+2′"), somando gols, cartões, lesões, pênaltis e trocas.
   Fora: substituição do adversário (o time adversário chega só com os 11 — sem banco pra trocar).
4. **Decisão pelo perfil** (`jogoAmbiente.ts`) — o driblador (classe ou drible ≥ 78) encara no ataque; o
   armador (regista/maestro ou passe ≥ 80) inverte com lançamento; o velocista recebe em profundidade; o
   cansado (fôlego < 30%) só toca curto; o goleiro sai nos cruzamentos na pequena área.
- Portões: `test:partida-viva` (posse do plano, regras, perfil, filme idêntico com fluxo) e `test_cadeia_lances`.

### Fase 13 — Contínuo, lambe do gol e substituição em lista (10/10)
- **Lambe do GOL** voltou ao DS 2027: o cabeçalho do trilho (relógio grande + números + skill) tinha
  crescido e espremia/cortava o lambe. Agora, no gol, o cabeçalho recolhe e o lambe ocupa o trilho: papel
  cal torto, sombra DURA deslocada (rua), selo redondo com a foto em P&B, GOL/GOAL em Anton (tamanho
  pela largura), nome na voz, fita amarela com minuto e placar.
- **Contínuo** (o fundador: "quero que seja contínuo durante toda a partida"): no LEGACY o minuto sem lance
  dura ~1,1 s (era 0,24 s — o jogo "voava e parava"), com o campo jogando a posse do plano; a Leitura do
  Analista NÃO para mais o relógio (fica no trilho com prazo; escolher vale pros próximos lances); o
  momento decisivo é câmera lenta (0,18×) com prazo de 10 s, não congelamento. Pausa só na prancheta
  (pedida pelo manager) e no intervalo.
- **Substituição em lista** (pedido do fundador): "Trocas" no trilho direito → EM CAMPO (por posição: GOL,
  LD, ZAG, ZAG, LE, VOL, MC, MC, PE, PD, ATA, com fôlego) e NO BANCO (posição, nota, fôlego). Toca em quem
  sai (ou na ficha no campo) e em quem entra → "⇄ Trocar: A → B" → muda no campo e o servidor refaz o
  futuro. O arrastar saiu. A troca vale em qualquer momento de bola rolando (antes: só fora de janela de reação).

### Depois (se fizer sentido)
- Three.js **2.5D** (visual de transmissão) — troca só o palco.
- Clima e refletores por shader — **só depois** que o jogo estiver redondo (régua DS 2027: sem enfeite).
- Liga Global e Liga Ole usando a Partida Viva.

**Total: ~9–10 semanas.** A Fase 1 entrega o sonho em forma bruta em ~1 semana.

---

### Fechamento da parte simples (10/10, noite) — trava, abertura, celular

- ✅ **Trava do 16'** ("o Adriano tocando pro Savinho"): um lance novo zerava a fila do
  coreógrafo e jogava fora as limpezas pendentes → jogadores PRESOS no alvo. Agora
  `limparCena()`. Também: fôlego vazio virava NaN; cansado isolado parava com a bola;
  driblador encarava a linha de fundo; sem pingue-pongue; laço do palco à prova de
  exceção (telemetria `partida_viva_erro`). (b5f8e25)
- ✅ **Abertura sem cerimônia**: times já na posição, contagem 3-2-1, apito. (b5f8e25)
- ✅ **Escanteio sem cobrador**: o campo anda atrás do relógio da Rápida (câmera lenta,
  celular perdendo quadro) e a posse do minuto seguinte atropelava a bola parada.
  Agora `encenandoAte`: com lance em cena, a posse muda em silêncio. (7e373ad)
- ✅ **Celular**: botão Tela cheia (Android), jogo instalável na tela de início (iPhone),
  palco mede a área visível, margem do entalhe só do lado da câmera. (b24eef0, 12920bf, 7e373ad)
- ✅ **Portão novo**: `npm run test:estresse-partida-viva` — partidas reais do motor tocadas
  no campo, inclusive com o campo atrasado (HOLD=0.6); caça laço, NaN, jogador preso,
  bola parada esquecida e escanteio sem cobrador.
- **Regra nova**: nunca zerar a fila do coreógrafo sem `limparCena()`; nada do jogo
  ambiente mexe na bola com um lance do plano em cena.
- ✅ **Revisão dos comandos (11/10)**: `docs/raio-x-partida-viva.html` (nota geral 4,8) →
  proposta do Motor de Posses (`docs/MOTOR-DE-POSSES.md`) e a Fase 0 abaixo.

### Fase 0 — UMA VERDADE SÓ (11/10, sem push: o fundador decide pelos números)
O placar oficial nascia de sorteios no celular (estilo ~40% de quase-gol virava gol com o
estilo padrão; lenda, formação, reações, leitura, substituição e expulsão viravam gol
ou tiravam gol; momento decisivo 82/30 e pênalti resolvidos no aparelho; cartões e
lesões semeados no aparelho) e a custódia só conferia um teto. Agora:
- **O motor emite o desfecho de cada escolha** (`server/smartfield/decisivo.py`): todo gol
  natural traz `decisivo.opcoes[opção] = o gol acontece?` (contexto, melhor opção, duelo
  nosso × deles — a mesma régua 82/30 ± duelo de antes, agora no servidor); o pênalti da
  casa traz `penalti.por_batedor` (11 + banco), o do adversário vem decidido (`penalti.gol`)
  e **o placar do motor passa a contar o pênalti**.
- **O aparelho só escolhe** (`src/match/placarAoVivo.ts` → `server/src/lib/partida/placar.ts`,
  o MESMO arquivo da custódia): `golDoLance(lance, escolhas)` é a única porta de gol
  (`marcarGol` no `QuickPlanPlayer`). Saíram `resolveStyleOnEvent`, `resolveLegacyBoost`,
  `resolveFormationOnEvent`, `applyManDownPenalty`, `applySubNudge`,
  `applyDecisionToRemainingEvents`, `resolveClutch`, `sprinkleDisciplineEvents`, crítico ×2/×3
  e os dois sorteios de pênalti. O expulso não leva castigo extra no aparelho (o motor já
  joga com 10).
- **Comando = causa, pelo servidor**: estilo (`{tipo:'estilo'}` → eixos do DNA, persistente),
  lenda (`{tipo:'lenda'}` → 15', até 3, só id `legacy-…`), formação (papéis novos), leitura
  do Analista, reação (a favor/contra, com o canal do lance), substituição, lesão, gritos e
  ordens pedem um replan `from_minute` (minuto+3) — **na Rápida também**, não só no LEGACY.
  O relógio **espera** o replan e emenda exatamente no início dele (`emendarEventos`, a mesma
  costura da custódia); 8 s sem resposta → o pedido é abandonado. Um pedido por vez.
- **Dados por minuto** (`seed|minuto`, os 3 modos): o replan não sorteia o futuro de novo,
  só os pesos mudam (semente da Prova de Causa).
- **Custódia exata** (`custodia.ts`): placar, gols e finalizações de cada titular têm de ser
  EXATAMENTE os recalculados dos planos emitidos + escolhas relatadas (`escolhas` no relato);
  o estado de cada replan é **derivado da cadeia de planos** no servidor (placar, cartões,
  expulsos, momento do plano) e o `estado` do celular só vale sem custódia; replans em ordem
  crescente, um só de intervalo, teto de 32 por partida; o banco é conferido como a escalação.
- **Portões**: `npm run test:uma-verdade` (varredura de `src/` + 200 partidas com escolhas
  aleatórias, intervalo e 2 replans de comando: placar e números por jogador do aparelho ==
  custódia em 200/200; estado derivado == aparelho em 600/600 replans; placar forjado
  suspeito em 200/200), `test:custodia` (31), `test_cadeia_lances.py` (300, nenhum placar
  muda com/sem cadeia), `test:partida-viva`, `test:estresse-partida-viva` (achou e corrigiu:
  reserva que entra no lugar de quem estava posicionado numa bola parada assume a posição —
  `coreografo.trocar`), `lint`.
- **Equilíbrio — 1.000 partidas por linha, mesmos confrontos, manager passivo exceto no
  momento decisivo** (`npm run estudo:fase0`; `scripts/fase0/equilibrio.json`; ANTES = motor
  e aparelho de `100fd32`, código real congelado em `scripts/fase0/antigo/`):

  | linha | gols casa | gols fora | total | vitória casa | empate | derrota | 0×0 | cartões |
  |---|---|---|---|---|---|---|---|---|
  | ANTES · momento decisivo aleatório · 4-4-2 | 2,00 | 0,64 | 2,64 | 74% | 16% | 10% | 7% | 3,26 |
  | ANTES · aleatório · 4-3-3 | 2,16 | 0,78 | 2,94 | 73% | 15% | 12% | 5% | 3,26 |
  | ANTES · esperto (sempre a certa) · 4-3-3 | 2,65 | 0,36 | 3,01 | 88% | 8% | 3% | 4% | 3,27 |
  | ANTES · errado · 4-3-3 | 1,91 | 0,99 | 2,90 | 63% | 20% | 18% | 6% | 3,26 |
  | DEPOIS · aleatório | 0,88 | 0,66 | 1,54 | 39% | 36% | 26% | 23% | 1,51 |
  | DEPOIS · esperto | 1,41 | 0,23 | 1,64 | 65% | 29% | 6% | 23% | 1,51 |
  | DEPOIS · errado | 0,59 | 0,90 | 1,49 | 25% | 34% | 41% | 23% | 1,51 |
  | DEPOIS · motor cru (sem o filtro do momento decisivo) | 1,70 | 1,30 | 3,00 | 46% | 24% | 30% | 7% | 1,51 |
  | *variante não aplicada* · bases 0,92/0,60 · aleatório | 1,24 | 0,36 | 1,60 | 57% | 32% | 12% | 22% | 1,51 |
  | *variante não aplicada* · bases 0,92/0,60 · esperto / errado | 1,54 / 1,08 | 0,13 / 0,53 | — | 70% / 48% | — | 3% / 20% | — | — |
  | *variante não aplicada* · bases 0,95/0,75 · aleatório | 1,40 | 0,24 | 1,64 | 64% | 28% | 7% | 22% | 1,51 |

  Leitura: a casa fazia ~2,2 gols e ganhava ~73% por sorteios do aparelho; sem eles, o motor
  cru dá 3,0 gols e 46% de vitória da casa, e o **momento decisivo em todo gol (82/30) corta
  pela metade** (1,5 gols, 23% de 0×0). Subir as bases devolve a vantagem da casa (o
  adversário não escolhe: cada acerto nosso é gol sofrido evitado) mas não os gols nem os
  0×0 — o filtro em todo gol é o problema, não a régua. Os cartões caem de 3,3 pra 1,5 porque
  o aparelho semeava 2 por jogo. O que mudar — a base do momento decisivo
  (`OLEFOOT_DECISIVO_CERTA`/`_ERRADA`, variantes em `scripts/fase0/variantes/`), o momento
  decisivo só em duelo equilibrado (Fase 2 do Motor de Posses) ou nada — é decisão do fundador.
- **Não feito / fora**: disputa de pênaltis (90' empatado) segue sorteada no aparelho
  (próximo candidato pra mesma receita: tabela por batedor); cartões e lesões agora são só os
  do motor (menos cartões; "toda falta vira amarelo" é da Fase 1); replan tarde demais (>8 s)
  deixa a partida divergir da custódia (sai `suspeita`, sem crédito); a Rápida agora pede
  replan a cada comando (custo de servidor; rate limit 20/min por IP); nenhuma migration.
- Commit `805eed1` (11/10, sem push).

### Fase 1 — MOTOR DE POSSES v1 (11/10, servidor; sem push)
O coração do motor trocado sem mexer na tela: `server/smartfield/motor_posses.py` é o padrão do
`match_simulator.simulate`; `motor: "minutos"` no pedido ou `OLEFOOT_MOTOR=minutos` no ambiente
volta ao motor por minutos (chave de retorno sem redeploy). Desenho e desvios: `docs/MOTOR-DE-POSSES.md`.
- **O modelo**: uma posse por minuto (90), cada uma até 7 ações numa grade 3×3 (terço × corredor);
  a formação ocupa as células (quem marca é o ocupante, não um sorteio); o portador decide por
  pesos (atributos, célula, DNA, intensidade, comandos, urgência) e cada ação é um duelo:
  drible × marcação, passe × linha de passe, lançamento × leitura, cruzamento × físico e cabeceio ×
  marcação, chute × goleiro (atributo próprio derivado). Perdeu, a bola muda de lado ali. Falta em
  duelo físico com cartão PESSOAL (segundo amarelo é vermelho; o expulso sai do mapa e não age em
  cadeia nenhuma); pênalti por falta na célula central do ataque; escanteio e falta perto da área
  viram a posse seguinte, com a cobrança de verdade. Cansaço por ação abate o atributo.
  Sem o ×1,18 fixo da casa: mando = confiança + duelo + xG, calibrado no confronto igual.
- **A cadeia É a posse**: as últimas ≤ 5 ações + a finalização; 83% dos gols em 3–6 ações; a
  assistência é o último passe de verdade; skills com nome nas ações reais (21% das ações).
- **Saída idêntica** (MatchPlan v1.1 + `decisivo`/`penalti` da Fase 0): o aparelho, o campo, a
  custódia e os portões da Fase 0 não mudaram uma linha. O estresse do campo achou duas formas de
  cadeia que o coreógrafo não esperava (cruzamento terminando no corredor; escanteio em cima de
  escanteio repetindo o cruzamento e levando o cobrador pra longe): corrigidas no motor.
- **Bateria** (`npm run test:motor-posses`: 1.000 sintéticas + 333 reais + 500 iguais + 500 com 10
  pontos de diferença; portão de merge) — todos os intervalos travados dentro:

  | métrica | medido | travado |
  |---|---|---|
  | gols por jogo | 2,72 | 2,4–3,0 |
  | posse da casa em 38–62% · média no confronto igual | 99% das partidas · 51,0% | ≥ 90% · 48–52% |
  | chutes por time | 9,97 | 9–16 |
  | cartões por jogo | 3,66 | 2–5 |
  | gols de expulso | 0 | 0 |
  | time 10 pontos pior vence | 18,8% | 15–25% |
  | casa vence no confronto igual | 44,0% | 42–48% |
  | 0×0 · goleada (≥ 4) | 7,9% · 3,4% | ≤ 10% · ≤ 6% |
  | pênaltis · faltas por jogo | 0,24 · 18,8 | 0,15–0,30 · 18–30 |
  | ações por posse | 2,55 | 2,5–5 |
  | p95 (CPU) | 18,5 ms | ≤ 40 ms |
  | determinismo · cadeias consistentes | 100% · 0 falhas | — |

- **Portões**: `test_cadeia_lances.py` (300: nenhum placar muda com/sem cadeia; cadeias
  consistentes; inglês idêntico), `test:estresse-partida-viva` (40 partidas do motor novo, dois
  ritmos), `test:uma-verdade` (200/200, 600/600 replans), `test:partida-viva`, `lint`,
  `estudo_comandos.py --n 300` no motor novo: replan vazio +1,0 pp, nenhum comando passa de
  +2,7 pp, cobrar custa cartão (2,02 → 2,36) — comando segue sendo escolha com custo, não atalho.
- **Equilíbrio com o motor novo** (`scripts/fase0/variantes/fase1-motor-posses.json`, 1.000
  partidas, manager passivo exceto no momento decisivo): motor cru **1,39 × 1,12 (2,50 gols), 44%
  de vitória da casa, 9% de 0×0, 4,0 cartões**; com o filtro do momento decisivo em todo gol
  (régua 82/30): aleatório 0,72 × 0,62, 35%; esperto 1,16 × 0,26, 60%; errado 0,50 × 0,80, 21%.
  **A decisão da régua do momento decisivo (Fase 0) continua sua** — o motor cru está na faixa
  realista; o filtro corta pela metade.
- **Fora desta fase (Fase 1b)**: classe do SMART-PROFILE na ocupação (a classe não chega ao
  Python), lesão que sai do mapa, atributo `goleiro` na ficha, Prova de Causa e Mundo Paralelo
  (Fase 3 do desenho), o campo encenando as posses sem chute (Fase 2). Mobile não visto.

### Fase 1b — classe, lesão e goleiro (13/10, servidor; sem push)
- **A classe vira comportamento**: a rota manda a classe oficial (`classesDaPartida`) ao motor. Ela
  muda ONDE o jogador pesa na grade (regista recua um terço, falso 9 vem ao meio, box-to-box cobre
  as duas áreas, lateral apoiador sobe…) e O QUE ele prefere com a bola. Em 120 partidas, com a
  classe: regista 113 → 285 lançamentos, ponta driblador 164 → 351 dribles, matador 233 → 345
  chutes, velocista 44 → 73 conduções (intervalo novo na bateria: "classe vira comportamento").
- **Lesão sai do mapa**: o lesionado deixa de jogar e de aparecer em cadeia até o replan da troca
  trazer quem entra; cansado se machuca mais; goleiro não. (Só a casa: o adversário não tem banco.)
- **Goleiro com atributo próprio** quando a ficha trouxer `goleiro`; senão, o derivado (§2.5).
- Bateria de 1.333 + 500 + 500: todos os intervalos dentro (2,75 gols, casa 46,4% no igual,
  10 pontos pior vence 22,6%, p95 21 ms).

### Fase 2 — O campo encena a verdade (13/10; sem push)
O jogo entre os lances era inventado: todo passe acertava, a pressão nunca desarmava, e lateral,
tiro de meta e impedimento eram sorteados no aparelho. Agora:
- **Servidor**: o plano traz `jogadas` — a posse de cada minuto em metros (como começou, as ações
  com `ok: 0` onde falharam, como acabou, como a próxima recomeça; ~31 KB) — e `folego` (os 22 a
  cada 5 minutos). Reinícios que acontecem de fato: bola errada no corredor sai pela LATERAL;
  lançamento errado pro ataque às vezes é IMPEDIMENTO. A posse que segue no minuto seguinte fica
  nos mesmos pés. Ações herdadas da posse anterior (contexto do lance) não entram na jogada.
- **Campo** (`src/partidaViva/jogadaReal.ts`): entre os lances, toca a jogada do minuto — passe que
  chega em quem a jogada diz, passe interceptado que o rival corta ali, drible perdido que o marcador
  rouba, desarme, falta com apito. **Comprime** quando o minuto é curto (modo Lances): toca o FIM da
  posse, mantendo a roubada do começo. **Reinício só quando aconteceu** (lateral, tiro de meta,
  impedimento, falta). O fôlego do servidor chega no anel e no passo de cada ficha. O jogo ambiente
  (`jogoAmbiente.ts`) só serve plano antigo (motor por minutos).
- **Portões**: `test:partida-viva` (novas conferências: bola termina em quem a jogada diz; passe
  errado muda a posse ali; reinício só quando aconteceu; drible perdido; desarme + lançamento;
  nenhum toque inventado; fôlego do servidor; mesmo filme; compressão sem perder o fio),
  estresse do campo com as jogadas reais (40, dois ritmos), `test:uma-verdade`, `test:filme`, lint.
- **Visto no navegador** (servidor e front locais; filme gerado de um plano real do motor de posses,
  tocado no palco de verdade): a construção, o chute com faixas de cinema, a reposição do goleiro, a
  falta cruzada na área que virou o gol do 7' e a saída do meio-campo. Celular não visto.

### Fase 3 — Causa e prova (13/10; sem push)
- **"Marcar o 10" de verdade**: a ordem "marcar de perto" tem ALVO (o rival mais perigoso, maior
  finalização). Quem recebe a ordem vira o ocupante PRIORITÁRIO das células onde o alvo joga — todo
  duelo do alvo passa a ser contra ele — e os colegas do alvo o procuram menos (linha de passe
  fechada). Em 200 replans: o alvo toca 23% menos na bola e o marcador desarma 3,5× mais.
- **Prova de Causa** (`server/smartfield/prova_de_causa.py`): todo replan pedido por um comando
  (grito, ordem, estilo, lenda) ou decisão (leitura do Analista, reação) volta com a PROVA — as 10
  posses seguintes simuladas com e sem a causa, a partir do mesmo estado e com os mesmos dados.
  Fechada a janela, o feed mostra a frase (`src/match/provaDeCausa.ts`): "🔬 Prova — a ordem pra
  Caio (23'–32'): Freitas tocou 1× na bola (sem a marcação: 4) · Caio desarmou 3 (sem: 0) · chutes
  1×0 (sem: 1×2). Sem o comando: Freitas tinha a chance clara no 27'." Na Rápida e no LEGACY.
  Substitui a medição simples da Fase 12 pra esse comando. Comando sem efeito: "nada mudou".
- **Mundo Paralelo** (`src/partidaViva/mundoParalelo.ts`, só no campo): quando a prova tem um lance
  que só existiu SEM o comando, o trilho oferece "E se eu não tivesse mandado?". O jogo pausa, um
  coreógrafo novo encena as jogadas do servidor sem o comando, do minuto antes daquele lance até ele,
  e o palco toca os quadros em tom apagado com a fita "MUNDO PARALELO" (até 14 s); depois o jogo
  volta de onde parou. Determinístico.
- **O analista lê as diferenças**: no intervalo, o auxiliar diz qual comando do 1º tempo mais mudou
  o jogo, com os números contra o mesmo jogo sem ele.
- **Correção achada no caminho**: o estado do replan levava só contagens — o EXPULSO voltava ao
  campo no plano novo e o amarelo zerava. Agora o estado leva quem foi expulso e quem tem amarelo
  (cliente e custódia derivam igual; o motor tira do mapa e o 2º amarelo é vermelho).
- **Portões**: `npm run test:prova-de-causa` (causa nula idêntica em 300/300; marcar tira 23% dos
  toques do alvo; nenhuma divergência antes do replan; determinística; p95 35 ms de CPU com as duas
  simulações), `test:uma-verdade` (prova em 400/400 replans de comando, Mundo Paralelo em 104/104
  sem NaN e determinístico), `test:auxiliar-duelo` (frase e leitura), bateria, cadeias, estresse,
  custódia, lint. `estudo_comandos.py --n 1000` (o estudo tem de rodar com 1.000 — com 300 o erro é
  de ±4 pp): replan vazio +0,9 pp, nenhum comando passa de +3,4 pp, cobrar custa cartão (2,05 → 2,37);
  estudo agora faz a troca e o replan na lesão, como o aparelho.
- **Não visto rodando**: o Mundo Paralelo e o card da prova numa partida real (sem login no navegador
  local não há elenco pra montar o campo). Celular não visto.

### Fase 4 — O filme como arena (13/10; sem push; migration aplicada em 13/10)
- **Assumir o lance** (`server/smartfield/arena.py` + `server/src/lib/arena.ts` +
  `server/src/routes/arena.ts` + `src/pages/ArenaDoLance.tsx`, rota `/match/arena/:id`): você pega o
  filme de outro manager (ou o seu), escolhe o minuto, dá ordens (estilo, grito, marcação individual)
  e decide os momentos decisivos e o batedor **sem ver o desfecho** — o aparelho recebe os momentos
  sem nenhum booleano. Ao fechar, o servidor refaz a MESMA simulação (determinística), conta três
  placares e devolve o plano pro campo tocar: **ele fez** (o dono, pela custódia: planos emitidos +
  as escolhas que o filme agora carrega — filme que não bate com a custódia não vira arena),
  **você fez** (o seu plano + as suas escolhas) e **parado** (o banco calado, escolha automática).
  "Você fez 2×1 onde ele fez 1×1" + quanto as suas ordens valeram contra ficar parado + a Prova de
  Causa das 10 posses. As ordens do dono ANTES do minuto continuam valendo (você herda o jogo como
  estava); as dele depois não entram. Você comanda o time da casa do filme.
  Propriedade conhecida: o desfecho de cada opção é sorteado por minuto e opção, então quem estudou o
  filme sabe como terminou a opção que o DONO escolheu num momento que se repete no mesmo minuto — é
  estudar o tape; as outras opções seguem escondidas.
- **O filme da arena** (`src/partidaViva/arena.ts` `roteiroDaArena`): o plano + as suas escolhas
  viram um roteiro que o MESMO palco do LEGACY toca; cada gol passa por `golDoLance` (a mesma porta do
  jogo ao vivo e da custódia); a escolha que não deu vira defesa/bola fora com a mesma jogada.
- **Desafio assíncrono e ranking semanal**: o dono abre o filme como desafio (`POST /api/arena/abrir`
  — só se a arena consegue jogá-lo); qualquer manager logado vê os abertos em `/match/arena`. Um tiro
  por filme (jogar de novo mostra, mas não conta). Ranking da semana (mesma semana da LEGACY League):
  soma do saldo positivo sobre o dono do filme; o dono jogando o próprio filme não pontua.
- **Lenda como agente**: o atleta de uma lenda assume os lances dela pelo PLAYERVIP
  (`/playervip/arena/:id`); as escolhas dele nos momentos da lenda são guardadas e, nas partidas de
  todo mundo, quando o técnico não responde no prazo, a lenda decide como o atleta decidiria
  (`decisivo.auto` no motor; `escolhaAutomatica` respeita — cliente e custódia iguais). Precisa de
  pelo menos 2 escolhas e preferência clara; não mexe em nenhum sorteio, só em qual desfecho já
  calculado vale sem resposta.
- **O adversário ausente joga pelo plano salvo** (`server/smartfield/plano_salvo.py` +
  `server/src/lib/planoSalvo.ts`): o time de fora de outro manager real deixa de jogar só pelo DNA. O
  plano salvo são as decisões que ELE tomou na última partida LEGACY com comando (custódia), presas à
  situação do placar ("perdendo, depois dos 60', foi pro ataque e cobrou"); até 4 regras, cada uma
  dispara uma vez, com a régua dos comandos da casa. A narração avisa quando o plano dispara.
- **Migration APLICADA em produção (13/10, a pedido do fundador)**: `supabase/migrations/20261013000000_arena_do_filme.sql`
  (coluna `partidas_filme.arena_aberta` + tabela `arena_tentativas`, RLS fechada, verificação no fim).
  Sem ela: assumir e ver o resultado funcionam; desafio aberto, ranking e lenda como agente esperam.
  O pedido do motor passa a ser guardado no `resumo` (jsonb) de cada plano emitido — só partidas
  jogadas DEPOIS deste código podem ser assumidas; o filme passa a levar as escolhas.
- **Portões**: `npm run test:arena` (Python 300: banco calado = parado 300/300, nada antes do minuto,
  herança do dono, ordens pesam, lenda decide como o atleta sem mexer em desfecho, p95 26 ms; conta
  com partidas reais: custódia, momentos sem desfecho, veredito determinístico, ler o lance certo dá
  saldo 42 × 6 do automático; filme da arena 150/150 com placar do filme = placar do servidor, sem
  NaN nem bola parada), `npm run test:plano-salvo` (1.000 partidas: plano vazio = partida idêntica
  300/300; 638 disparos, nenhum fora de hora; "perdendo depois dos 60' → ataque + cobrar" leva as
  finalizações deles de 3,43 a 3,59; vitória da casa 40,6% → 41,1%, gols 2,59 → 2,62 — personalidade,
  não bônus), bateria, cadeias, prova,
  uma-verdade, custódia, estresse, lint.
- **Visto no navegador**: o filme de uma arena real tocando no palco do 55' em diante (escanteio,
  chute com faixa de cinema, o gol do 72' com o placar 0×1 do servidor) e a página `/match/arena` no
  desktop e no celular (375 px). **Não visto**: a prancheta, os momentos e o veredito com uma conta
  logada (precisa de filme na nuvem gravado com este código e da sessão).

### Os critérios do plano — medição de 13/10 (docs/raio-x-partida-viva.html, "Como saber que deu certo")
| Critério | Meta | Medido | Situação |
|---|---|---|---|
| Placar realista (1.000 partidas) | 2,4–3,0 gols; posse 38–62%; 0 gol de expulso; o 10 pts pior vence ~20% | bateria travada da Fase 1 (`npm run test:motor-posses`) | ✅ dentro |
| Gols com comando ativo nas 10 posses anteriores | 35%–50% | **22,4%** (1.000 partidas no ritmo REAL dos managers: 3,4 comandos/partida; 8 comandos → 39,8%; 1 comando → 13,1%) — `npm run estudo:gol-com-comando` | ❌ fora — o comando pesa, mas os managers comandam pouco |
| Replanejamento | < 150 ms | p95 ~35 ms de CPU com a prova (Fase 3) | ✅ dentro |
| Partida no modo Lances | ≤ 4 min de tela | 13/10: 6min13s. **14/10, depois da compressão: 3min56s** (mediana, manager típico, 1×; p90 4min30s; ágil 3min31s). Em 2×: 2min31s, 100% até 4 min — `npm run estudo:tempo-de-tela` | ✅ dentro (mediana) |
| Retorno D1 e semana de quem usou o Mundo Paralelo × quem não usou | maior em quem usou | eventos `mundo_paralelo_oferecido`/`_visto` (+ `arena_*`) ligados em 13/10; consulta em `scripts/estudo-retorno-mundo-paralelo.sql` (só leitura) | ⏳ precisa de ≥ 1 semana de dados depois do deploy |

- Os dois "fora" são decisões de produto, não defeitos: (1) mais gols com comando = o jogo puxar o
  manager a comandar mais (ex.: o Analista oferecer a ordem certa no momento) ou rever a meta; (2) caber
  em 4 min em 1× — o fundador escolheu COMPRIMIR (14/10), feito abaixo.

### Compressão dos lances de baixa tensão (14/10, "comprime!")
- `src/partidaViva/compressao.ts`: ALTA TENSÃO encena inteira (gol, pênalti, trave, contra-ataque, peso
  alto, e chute/chance/defesa com xG ≥ 0,20). BAIXA TENSÃO mostra só o final (as duas últimas ações —
  nunca começando numa falta) e a bola parada é COMPACTA: a preparação cai a 30% e o corte de TV deixa
  cada um perto do seu lugar (`montarBolaParada(..., corte)`), sem respiro no início e com folga curta.
- O minuto que abre com lance encenado vai direto ao lance (`MINUTO_COM_LANCE_MS` = 0,2 s): a posse do
  minuto É o lance — antes ela tocava 1,1 s e o lance mostrava a mesma jogada de novo.
- Só visual e só no LEGACY: placar, autor e desfecho iguais; o filme grava o lance já comprimido; a arena e
  o Mundo Paralelo usam a mesma compressão.
- Antes → depois (1.000 partidas, típico, 1×): 6min13s → 3min56s; lances 3min19s → 1min39s; relógio
  1min46s → 1min09s. Estresse (40 partidas, dois ritmos) passa COM os lances comprimidos (o 1º teste pegou
  escanteio sem cobrador a 9 m; corrigido com o corte proporcional). Visto no campo (filme gerado do motor):
  o escanteio compacto do 48' sai da bandeirinha com a área armada.

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
