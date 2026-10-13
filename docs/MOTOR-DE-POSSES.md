# MOTOR DE POSSES — o desenho (Fase 1 da Partida Viva)

> v1 · 11/10/2026 · só desenho, sem código. Resposta ao raio-x de 11/10
> (`docs/raio-x-partida-viva.html`): "o que acontece no campo não decide nada, e o que
> decide não acontece no campo". A Fase 0 (UMA VERDADE SÓ, feita em 11/10) tirou o placar
> do celular; esta fase troca o coração do motor sem mexer na tela.

---

## 0. Em uma frase

A partida deixa de ser 90 moedas por minuto e vira **~95 posses de bola**, cada uma
uma cadeia de **duelos de atributo com lugar no campo**, decidida uma vez só no servidor,
com **dados próprios por posse** — e sai no **mesmo formato** que o aparelho já lê.

## 1. O modelo

### 1.1 A unidade é a posse
- Uma posse começa quando um time ganha a bola (reinício, roubada, rebote, tiro de meta)
  e termina num **fim de posse** (§1.6). Dura de 1 a 8 ações.
- Por jogo: **88 a 104 posses** (44–52 por time), número que o DNA inclina: `posse`
  alto segura a bola (menos trocas); `pressao` alta do adversário rouba mais (mais trocas).
- O relógio é consequência: cada ação consome segundos (§2.7) e a posse recebe o minuto em
  que começou — é esse minuto que o aparelho usa.

### 1.2 A grade 3×3
Terço (`def` · `mid` · `att`, do ponto de vista de quem tem a bola) × corredor
(`esq` · `cen` · `dir`). As duas dimensões já existem no motor (`zone` e `channel`);
o que muda é que a bola **anda** pela grade (sem progressão não há posse).

| | esq | cen | dir |
|---|---|---|---|
| **att** | A-E | A-C | A-D |
| **mid** | M-E | M-C | M-D |
| **def** | D-E | D-C | D-D |

Vizinhança: avançar = +1 terço (mesmo corredor ou vizinho); inverter = mesmo terço,
corredor oposto (só por lançamento); recuar = −1 terço.

### 1.3 Ocupação por formação
Cada formação (`FORMATION_BASES`, `src/match-engine/formations/catalog.ts`) distribui os 11
nas 9 células com **pesos de presença** (0–1). Exemplo 4-3-3 defendendo:

| célula | quem ocupa (peso) |
|---|---|
| D-C | zag1 0,9 · zag2 0,9 · vol 0,5 |
| D-E / D-D | le / ld 0,9 · pe / pd 0,2 |
| M-C | vol 0,6 · mc1 0,8 · mc2 0,8 |
| M-E / M-D | le / ld 0,3 · pe / pd 0,7 |
| A-C | ata 0,9 · mc1 0,2 · mc2 0,2 |
| A-E / A-D | pe / pd 0,6 |

A classe do SMART-PROFILE desloca o peso (regista −1 terço, falso 9 → M-C, ponta driblador
+0,2 em A-E/A-D, box-to-box espalha). A posse do adversário usa a ocupação **defensiva**
do time sem bola; a nossa, a **ofensiva**. **O marcador de um duelo é o ocupante de maior
peso da célula**, com fadiga e cartão pendente abatendo o peso — nunca um sorteio.

### 1.4 O portador decide por pesos
Quem recebe a bola numa célula escolhe uma ação por **sorteio ponderado** (softmax,
§2.2). As ações: `passe_curto` (célula vizinha), `conducao` (avança 1 terço no corredor),
`drible` (vence o ocupante e avança), `lancamento` (+2 terços ou inversão), `cruzamento`
(só de A-E/A-D para A-C), `chute` (só no terço de ataque; de M-C com finalização ≥ 78),
`recuo` (−1 terço, zera a pressão). Os pesos vêm de: atributos do portador, célula, DNA,
classe, ordens do manager e pressão sofrida.

### 1.5 Cada ação é um duelo
| ação | nosso | deles (ocupante da célula alvo) | resultado |
|---|---|---|---|
| drible | `drible` (+velocidade/4) | `marcacao` (+fisico/4) | ganhou: avança, marcador fica pra trás; perdeu: desarme → posse deles ali |
| passe curto | `passe` | **linha de passe** = média de `marcacao`+`tatico` dos ocupantes da célula alvo | perdeu: interceptação → posse deles |
| lançamento | `passe` (+tatico/4) | `tatico` do ocupante de maior peso do terço alvo | perdeu: bola deles no terço alvo |
| cruzamento | `passe` (+pe bom 0/+4) | `fisico` do zagueiro de maior peso em A-C | ganhou: segue **cabeceio** |
| cabeceio | `cabeceio` | `marcacao` do mesmo zagueiro | ganhou: chute de cabeça (xG próprio) |
| chute | `finalizacao` (+confianca/5) | **goleiro** (§2.5, atributo próprio) | gol · defesa · fora · trave · bloqueio |
| condução | `velocidade` | `velocidade` do ocupante | perdeu: perde a bola |

Perdeu o duelo, a bola muda de lado **ali** — o contra-ataque nasce onde roubou (a posse
seguinte começa na célula espelhada). O cansaço de ambos abate o atributo (§2.6).

### 1.6 Fim de posse
`gol` · `defesa` (posse do goleiro deles, terço def) · `fora` (tiro de meta) ·
`escanteio` (nova posse nossa em A-E/A-D, ação única `escanteio` → cabeceio) · `falta`
(bola parada nossa; cartão pelo §2.4; perto da área vira `cobranca_falta`) · `perda`
(desarme, interceptação, condução perdida) · `pênalti` (falta em A-C de drible vencido:
§2.4) · `fim do tempo`.

### 1.7 Cartões pessoais e expulsão
O cartão é do **jogador**, não do time: amarelo por falta dura, segundo amarelo = vermelho,
vermelho direto raro. O expulso **sai do mapa**: a ocupação é recalculada sem ele (a célula
dele perde o peso; o time fica com 10 e a linha de passe do adversário afrouxa), e ele
não pode ser portador, marcador, cobrador nem batedor. "0 gols de expulso" é invariante
de teste, não torcida.

### 1.8 Fadiga por posse
Cada ação cobra fôlego de quem agiu e de quem marcou; pressão alta cobra do time inteiro
a cada posse do adversário. Atributos caem com a fadiga (§2.6), então o time que corre
o jogo todo murcha aos 70' de verdade — e o anel de fôlego do campo passa a ser verdade
(hoje é estático).

### 1.9 Custo
~95 posses × ~4 ações × (1 decisão + 1 duelo + ocupação) ≈ **1.500 operações**; 20–40 ms
no Railway (medido na bateria, §5). Replan de comando: só as posses a partir do minuto
(≈ metade), <20 ms.

## 2. Fórmulas iniciais (com números — ponto de partida da calibração)

Notação: atributos 1–99; `d = (A − D) / 100`; `σ(x) = 1/(1+e^(−x))`; `dz(eixo)` = desvio
do DNA em −0,5…+0,5 (`match_simulator.py:221`); `cmd(...)` = ajuste de comando.

### 2.1 Quantas posses, onde começa
- `trocas_por_tempo = 48 · (1 − 0,18·dz_nosso(posse) + 0,14·dz_deles(pressao))` → posses de
  cada time ≈ 44–52.
- Reinício depois de gol/defesa/fora: `def-cen` do time que recomeça. Depois de roubada:
  a célula espelhada de onde foi roubada.

### 2.2 Decisão do portador (pesos → softmax com temperatura 1)
```
w_passe_curto = 1,00 + passe/100 + 0,40·dz(posse) − 0,30·pressao_na_celula + cmd(acalmar +0,25)
w_conducao    = 0,40 + velocidade/120 + 0,20·dz(vertical) + classe(velocista +0,30)
w_drible      = 0,25 + 1,20·drible/100 + classe(ponta_driblador +0,50) − 0,20·fadiga/100 + cmd(incentivar +0,15)
w_lancamento  = 0,20 + passe/120 + 0,40·dz(vertical) + classe(regista +0,40, maestro +0,25) + cmd(cobrar +0,10)
w_cruzamento  = (A-E|A-D) ? 0,30 + passe/100 + 0,05·(cabeceio_do_melhor_na_area − 60) : 0
w_chute       = (att) ? 0,20 + finalizacao/100 + celula(A-C +0,50) + classe(matador +0,40) + 0,30·dz(vertical) + urgencia : 0
                (mid-cen com finalizacao ≥ 78: 0,10 + (finalizacao−78)/60)
w_recuo       = 0,15 + 0,40·pressao_na_celula + 0,20·dz(solidez) − 0,20·dz(vertical) + cmd(segurar +0,30)
```
`pressao_na_celula` = peso de ocupação defensiva do adversário na célula (0–1,8).
`urgencia` = `(minuto ≥ 65 && perdendo) ? 0,25·(minuto−65)/25 : 0`.
A ordem **"marcar o 10"** faz o nosso jogador ser o ocupante prioritário (peso 1,0) da célula
do 10 em toda posse deles. **Retranca** soma +0,3 de peso dos dois meias em D-C.

### 2.3 Duelos
Probabilidade de o portador vencer: `p = base + 0,38·σ(d/0,12) − 0,19` (empate = `base`;
+20 de vantagem ≈ +12 pp; teto ±19 pp).

| duelo | base |
|---|---|
| passe curto | 0,86 |
| condução | 0,80 |
| lançamento | 0,62 |
| cruzamento (chegar na área) | 0,55 |
| drible | 0,46 |
| cabeceio (na direção do gol) | 0,38 |

Falta no duelo perdido pelo **defensor** (ele chegou atrasado): `p_falta = 0,10 +
0,30·(100 − fair_play)/100 + 0,06·dz_deles(pressao) + cmd(cobrar +0,05)`.

### 2.4 Cartões e pênalti
- Amarelo numa falta: `p = 0,22 + 0,30·(100 − fair_play)/100 + (terço def próprio ? 0,10 : 0)
  + (drible vencido ? 0,12 : 0)`. Segundo amarelo do mesmo jogador = vermelho.
- Vermelho direto: `p = 0,015 + 0,02·(100 − fair_play)/100`, só em falta no terço def próprio.
- Pênalti: falta em A-C do atacante que **venceu** o duelo: `p = 0,35`; o resto é falta
  perto da área (cobrança direta ou cruzada). Esperado: 0,15–0,30 pênaltis por jogo.
- O momento decisivo e os desfechos por opção/batedor continuam os de `decisivo.py`.

### 2.5 Chute × goleiro (atributo próprio)
- xG da célula: A-C 0,16 · A-E/A-D 0,08 · M-C 0,035 · cabeceio 0,11 · pênalti 0,76.
- `xg = xg_celula · (0,55 + 0,9·finalizacao/100 + 0,2·confianca/100) · (1 − 0,45·pressao_na_celula/1,8)
  · (1 − 0,25·(goleiro − 60)/40) · (1 + 0,30·dz(criatividade)) · urgência`, preso em 0,02–0,65.
- `goleiro` = atributo próprio da ficha do goleiro; enquanto não existir na ficha,
  `goleiro = 0,55·marcacao + 0,25·velocidade + 0,20·confianca` (hoje é `marcacao·0,6 +
  confianca·0,4`, `match_simulator.py:832`).
- Desfecho: `shot_outcome_weights(xg)` (`xg_model.py:46`) como hoje; trave 10% dos não-gols
  com xg > 0,25. **Sem ×1,18 fixo da casa**: o mando vira `+2 confiança` e `+0,04` nos
  pesos de ataque da casa — calibrado pra casa vencer 42–48% em confronto igual.

### 2.6 Fadiga
- Custo por ação: agir +0,12 · marcar +0,08 · condução/drible +0,20 (×1,4 com `press`, ×0,7
  com `defend`); posse do adversário sob pressão alta: +0,05 em todos os pressionadores.
- Efeito: atributo efetivo `= atributo · (1 − máx(0, fadiga − 55)/300)`; velocidade `−30%` a 100.
- Reserva entra com a fadiga dele; o replan não zera o fôlego no intervalo (hoje zera).

### 2.7 Relógio
Ação: passe curto 4 s · condução 6 s · drible 5 s · lançamento 6 s · cruzamento 5 s · chute
3 s · bola parada 20 s (+ cobrança). Gol: 60 s parados. Acréscimos = paradas somadas.
Uma posse média: 4 ações ≈ 22 s; 95 posses ≈ 35 min de bola em jogo, o resto é reinício.

## 3. Semente por posse e a Prova de Causa

- Os dados de cada posse vêm de `Random(f"{seed}|p{i}")`, consumidos numa **ordem fixa**
  (decisão, duelo, falta, cartão, desfecho do chute). A Fase 0 já fez isso por minuto
  (`match_simulator.py: dados_do_minuto`); aqui é por posse, que é a unidade da decisão.
- O índice `i` segue a partida, não o pedido: a posse 61 tem os mesmos dados no plano
  inteiro, no replan do intervalo e no replan de um comando. Um comando muda **pesos**
  (§2.2) e ocupação (§1.3), nunca os dados.
- **Prova de Causa:** ao chegar um comando no minuto m, o servidor simula as próximas 10
  posses duas vezes — com e sem o comando — a partir do **mesmo estado** e com os **mesmos**
  `seed|p{i}`. As posses em que o desfecho mudou viram o card: "Sua ordem de marcar o 10 →
  3 desarmes do Caio nele, 0 passes dele pra área. Sem ela, ele cruzava no 61' e no 67'."
  Custa ~1 ms (20 posses). O "e se eu não tivesse mandado?" (Mundo Paralelo) é a mesma
  simulação, encenada pelo campo com um fantasma.
- O que a Prova de Causa NÃO promete: igualdade além da primeira divergência (mudou uma
  decisão, a ordem dos dados seguintes muda). Por isso são 10 posses, não 90.

## 4. Esquema de saída IDÊNTICO (o aparelho não muda na Fase 1)

O plano continua sendo `MatchPlan` v1.1 (`src/match/quickPlanTypes.ts`): `events[]`,
`momentum_curve[90]`, `matchup_matrix`, `analyst_beats`, `mvp_projection`,
`possession_home_pct`, `fluxo`, `team_stats`, `narrative_arc`, `classes`, e por evento
`cadeia`, `decisivo`, `penalti`, `assist_id`. A tradução:

| posse termina em | `kind` | `cadeia` |
|---|---|---|
| gol | `goal_*` (+ `decisivo`) | as ações reais da posse, toque a toque |
| defesa | `save_*` | idem |
| fora / bloqueio com xg > 0,22 | `chance_*` ou `shot_*` (régua de hoje, `match_simulator.py:883`) | idem |
| trave | `woodwork_*` | idem |
| escanteio (sem chute) | `corner_*` | a jogada até a bola sair |
| perda no terço de ataque após ≥ 3 ações | `buildup_*` | idem |
| roubada + ≥ 2 terços em ≤ 3 ações | `counter_*` | idem |
| falta com cartão | `yellow_*` / `red_*` (autor = quem levou) | quem sofreu conduz, quem levou derruba |
| pênalti | `penalty_*` (+ `penalti`) | a falta + a cobrança |
| perda comum | sem evento (só `fluxo`) | — |

- `fluxo[minuto] = [minuto, lado, terço, roubou?, portador]` sai da posse que cobre o
  minuto (hoje é um sorteio por minuto, `match_simulator.py:688`): o campo continua lendo
  `aplicarPosse` (`src/partidaViva/jogoAmbiente.ts:35`) sem mudar uma linha.
- `momentum_curve` continua sendo a pressão acumulada (mesma fórmula de `:1114`), agora
  alimentada por posses.
- `matchup_matrix` passa a ser **recalculada por posse** a partir da ocupação (quem está na
  célula), mas o objeto devolvido é a média — mesmo formato, mesmos canais.
- `team_stats` e `id_stats` saem de contagens reais (roubadas, chutes, faltas, xG).
- `cadeia`: mesmo `CadeiaDeLance` (metros, `x` 0–105, `z` 0–68); o ponto de cada ação é o
  centro da célula com jitter determinístico (`seed|p{i}|ac{k}`); `nomear_skills`
  (`cadeia_lances.py:328`) continua nomeando.
- **Portão de formato:** `test_cadeia_lances.py` roda sem mudar (consistência de cadeia,
  assistências, idioma), mais `scripts/estresse-partida-viva.ts` com 40 planos do motor
  novo. Se o aparelho precisar de uma linha nova, a Fase 1 falhou no desenho.

## 5. Bateria de calibração — 1.000 partidas, intervalos travados

`python3 server/smartfield/test_motor_posses.py --n 1000` (a escrever), mesmas entradas de
`test_cadeia_lances.entrada` + 200 confrontos "reais" (elencos com OVR 62–80 contra 60–82).
**Falha se qualquer intervalo sair.** Antes de qualquer merge.

| métrica | intervalo travado |
|---|---|
| gols por jogo (média) | 2,4 – 3,0 |
| posse da casa (média, confronto igual) | 48 – 52% · por partida 38 – 62% em ≥ 90% delas |
| chutes por time por jogo | 9 – 16 |
| cartões por jogo (amarelos + vermelhos) | 2 – 5 |
| gols de jogador expulso | **0** (invariante) |
| time 10 pontos de OVR pior vence | 15 – 25% (alvo ~20%) |
| casa vence em confronto igual | 42 – 48% |
| 0×0 | ≤ 10% · goleada (≥ 4 de diferença) ≤ 6% |
| pênaltis por jogo | 0,15 – 0,30 · faltas 18 – 30 |
| posses por jogo | 88 – 104 · ações por posse 2,5 – 5 |
| duração (p95) | ≤ 40 ms · replan ≤ 20 ms |
| determinismo | 1.000/1.000 planos idênticos em duas rodadas; replan sem comando == plano inteiro da posse em diante |
| consistência | todo `de`/`para` em campo no minuto; 0 ações de expulso; gols em cadeias == placar |

Comparado ao de hoje (medido em 11/10, `scripts/fase0/equilibrio.json`): o motor atual
cru faz ~2,2 gols/jogo e o filtro do momento decisivo deixa ~1,1 pro manager aleatório —
a calibração da Fase 1 tem de mirar os 2,4–3,0 **depois** do momento decisivo, não antes.

## 6. O que se reaproveita e o que morre

### Reaproveita (arquivo : linha)
| peça | onde | como |
|---|---|---|
| DNA (7 eixos, orçamento) | `match_simulator.py:200` `read_dna`, `:221` `dz` | viram pesos de decisão e ocupação |
| gritos, ordens, estilo, lenda | `comandos_ao_vivo.py` inteiro | mesmos comandos; "marcar" vira ocupante prioritário |
| matchup matrix | `matchup_matrix.py:214` | recalculada por posse com a ocupação |
| modelo de xG e desfecho | `xg_model.py:22`, `:46` | chute × goleiro (§2.5) |
| momento decisivo e pênalti | `decisivo.py` inteiro | idêntico |
| narração PT/EN | `match_simulator.py:284`, `:385`, `idioma.py` | idêntica |
| peso editorial, arco | `narrative_weighter.py` | idêntico |
| leituras do Analista e decisões | `analyst_beats.py:275` `build_beat`, `:424` `build_decision_modifiers` | idênticos (pesos por canal) |
| skills com nome | `cadeia_lances.py:261` `_skill`, `:328` `nomear_skills` | sobre a cadeia real |
| formato da cadeia | `quickPlanTypes.ts` `CadeiaDeLance` | idêntico |
| classes | `server/src/lib/smartProfile/classesDaPartida.ts` | entram na ocupação |
| custódia exata e placar | `server/src/lib/partida/placar.ts`, `custodia.ts` | idênticos (o formato não muda) |
| **todo o campo** | `src/partidaViva/*` (coreógrafo, encenação, bola parada, forma, filme, trilhos) | nada muda na Fase 1 |

### Morre
| peça | onde | por quê |
|---|---|---|
| o laço por minuto e suas moedas | `match_simulator.py:655–1120` (`flip_prob` :659–668, `pick_zone` :178/:682, `pick_actor` :228/:687, `shot_prob` :722, construção sorteada :900–940) | a posse decide |
| ×1,18 da casa sem condição | `match_simulator.py:77`, `:824` | mando vira confiança + peso (§2.5) |
| "toda falta vira amarelo; vermelho só após o 5º" | `match_simulator.py:1007–1055` | cartão pessoal (§2.4) |
| lesão só da casa e sem efeito | `match_simulator.py:1059` | lesão sai do mapa como o expulso (Fase 1b) |
| a cadeia desenhada depois do resultado | `cadeia_lances.py:80` `montar_cadeia` | a cadeia É a posse (fica só `nomear_skills`) |
| o jogo inventado entre lances (Fase 2) | `src/partidaViva/jogoAmbiente.ts:151` `decidirToque` | o campo toca as posses reais |

## 7. Os 3 maiores riscos e como cada um é medido

1. **Calibração — placares 7×5 ou 0×0 em série.** O modelo tem ~30 constantes novas.
   *Medida:* a bateria do §5 como portão de merge; cada constante com o intervalo que ela
   mais move anotado no código; relatório de sensibilidade (±20% em cada base rate → quanto
   muda gols/posse/chutes) gerado uma vez e guardado em `scripts/fase1/sensibilidade.json`.
2. **Regressão silenciosa no aparelho** (um `kind`, uma cadeia ou um `fluxo` fora do que o
   campo espera → campo travado, bola parada sem cobrador).
   *Medida:* `test_cadeia_lances.py` e `test:estresse-partida-viva` com planos do motor novo
   (40 partidas, HOLD 1 e 0,6), `test:uma-verdade` (200 partidas, placar == custódia) e
   `test:partida-viva` (filme). Nenhum muda; todos verdes.
3. **Prova de Causa que não prova** (dados por posse com ordem de consumo instável → o
   "sem o comando" diverge por acaso, não por causa).
   *Medida:* teste de causa nula — 1.000 pares com e sem um comando VAZIO têm de ser
   idênticos; e 1.000 pares com "marcar o 10" têm de divergir só a partir de posses em que
   o 10 participou. Mais: tempo da Prova ≤ 2 ms.

Risco de produto (não técnico): a Fase 1 muda o jogo que os managers sentem mais do que a
Fase 0 mudou. Por isso a bateria compara também com `scripts/fase0/equilibrio.json`, e o
fundador vê os números antes de subir — como na Fase 0.

---

## 8. Implementado em 11/10 (Fase 1) — o que o código fez do desenho

`server/smartfield/motor_posses.py` (padrão do `match_simulator.simulate`; `motor: "minutos"` no
pedido ou `OLEFOOT_MOTOR=minutos` no ambiente volta ao motor por minutos sem redeploy). Bateria:
`npm run test:motor-posses` (= `test_motor_posses.py --n 1000`), **portão de merge**.

### Desvios conscientes do desenho
| no papel (§) | no código | por quê |
|---|---|---|
| ~95 posses de duração variável (§1.1) | **uma posse por minuto** (90), cada uma com até 7 ações e ~55 s de bola em jogo | mantém `fluxo` 1:1 com o minuto, os dados por minuto da Fase 0 (`seed|minuto`) e o replan emendando no minuto; 90 cabe no intervalo 88–104 |
| classe do SMART-PROFILE desloca a ocupação (§1.3) | **feito na Fase 1b**: a rota manda a classe; `CLASSE_OCUPA` e `CLASSE_DECIDE` em `motor_posses.py` | — |
| `goleiro` atributo próprio (§2.5) | lido da linha quando vier (`goleiro`); senão derivado: 0,55·marcação + 0,25·velocidade + 0,20·confiança | a ficha ainda não tem o atributo (Fase 1b leu o campo; a ficha é outra frente) |
| falta só no duelo perdido pelo defensor (§2.3) | falta em todo duelo físico (condução/drible), ganho ou perdido (×0,7), e no passe interceptado sob pressão (0,20) | com a regra do papel saíam 4 faltas por jogo; o real é 18–30 |
| mando = +2 confiança + 0,04 nos pesos (§2.5) | + **+4,5 em todo duelo** da casa e **+9% no xG** | o papel dava 35% de vitória no confronto igual; o alvo é 42–48% |
| lesão sai do mapa (§6) | **feito na Fase 1b**: o lesionado sai até o replan da troca; só a casa | o adversário não tem banco |
| `replan sem comando == plano inteiro da posse em diante` (§5) | não vale: o replan parte do estado resumido (placar, momento, cartões) | pressão, fadiga e célula não viajam no estado; o `estudo_comandos` confere que o replan vazio fica perto de 0 |

### Como as cadeias saem (o aparelho não mudou uma linha)
- A cadeia é a posse: as últimas ≤ 5 ações + a finalização (gol em 3–6 ações em 83–87% dos casos).
- Escanteio: a posse seguinte, com a cobrança de verdade; a cadeia traz as ações da jogada **perto da área**,
  o `desvio` na bandeirinha (quem afastou/bloqueou) e a cobrança — a mesma forma do motor antigo, que é
  o que o campo lê (`bolaParada.ts` acha o canto pelo desvio). Escanteio em cima de escanteio começa no
  desvio (achado do estresse: repetir o cruzamento levava o time pra longe e o cobrador não chegava).
- Falta perto da área: `conducao` (quem sofre), `falta` (quem derruba) e `cobranca_falta` direta ou
  `cruzamento` + `cabeceio`. Pênalti: `conducao`, `falta`, `cobranca` (como antes).
- Cartão: a cadeia da falta vai no amarelo; o vermelho sai sem cadeia e DEPOIS dos lances do minuto
  (ninguém age em cadeia depois de expulso — regra do `test_cadeia_lances`).
- Bloqueio de chute é `shot`/`chance` (a cadeia acaba no chute); o escanteio que ele dá é a posse seguinte.

### Calibração final (CAL em `motor_posses.py`)
decisão: temperatura 0,55 · w_passe 1,00 · w_conducao 0,40 · w_drible 0,25 · w_lancamento 0,20 ·
w_cruzamento 0,30 · w_chute 0,20 (+0,50 no centro) · w_recuo 0,15 · chute do meio só com finalização ≥ 78.
duelos: passe 0,88 · condução 0,82 · lançamento 0,62 · cruzamento 0,55 · drible 0,46 · cabeceio 0,38;
ganho 0,38·σ(d/0,12). faltas: base 0,28 + 0,22·(100−fair play)/100 (×0,7 se o duelo foi perdido),
0,20 no passe sob pressão; amarelo 0,07 + 0,16·(100−fp)/100 (+0,05 no terço, +0,08 no drible);
vermelho direto 0,010; pênalti 0,05 por falta em A-C. xG: centro 0,16 · corredor 0,08 · meio 0,035 ·
cabeceio 0,11 · falta direta 0,06; pressão −45% · goleiro −25%/40 pts · livre ×1,25. fadiga: 0,30/min +
agir 0,12 + marcar 0,08 + conduzir 0,20; abate acima de 55 (÷300).

### Bateria (1.000 sintéticas + 333 reais + 500 iguais + 500 com 10 pontos)
Ver `docs/PARTIDA-VIVA-PLANO.md` (Fase 1) — todos os intervalos travados dentro; p95 de CPU ~19 ms.
