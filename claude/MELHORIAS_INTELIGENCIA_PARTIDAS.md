# Bateria de Melhorias — Inteligência & Diversão nas Partidas

> **Objetivo:** elevar a inteligência e a diversão das partidas da OLEFOOT **como o produto está hoje**,
> sem reescrever o motor. Estas três frentes nasceram da análise da base atual (análise de jogadores,
> simulação, status e calibração com dados reais) e foram priorizadas como melhorias emergenciais.
>
> **Status:** backlog priorizado (não iniciado). Cada item lista o gap, o que entregar e os arquivos-âncora.

---

## Contexto: o que já existe hoje

| Frente | Estado atual | Âncora no código |
|---|---|---|
| Simulação | Resolução de chute probabilística + **xG por chute** (0,01–0,50) | `src/match/goalContext.ts`, `shared/gamespirit/spiritStateMachine.ts` |
| Status do jogador | SSOT de saúde (fadiga, lesão, suspensão), moral, *form streak* | `src/systems/playerHealth/`, `src/systems/playerMoral/` |
| Consequências | `APPLY_MATCH_CONSEQUENCES`, `TICK_HEALTH_RECOVERY` via reducer | `src/systems/playerHealth/reducer.ts`, `src/game/types.ts` |
| Calibração real | StatsBomb (offline) → taxas de conversão por zona | `scripts/calibration/`, `src/engine/classic/calibrationData.ts` |

**Lacuna central:** o motor *gera* partidas, mas não *resume* nem *antecipa* nada a nível de partida,
e o status do jogador não é atualizado de forma contínua/visível antes do jogo.

---

## Melhoria 1 — Saída a nível de PARTIDA (probabilidade V/E/D)

### Gap
Hoje só existe xG **por chute**. Não há probabilidade de vitória/empate/derrota, distribuição de placar,
nem gols esperados por time. O conceito de "leitura da partida" não existe no código.

### O que entregar
1. **Agregador Monte Carlo** sobre o `GameSpirit` atual: rodar a mesma partida `N` vezes (ex.: 1.000–5.000)
   e contabilizar:
   - % vitória mandante / empate / vitória visitante;
   - distribuição de placar (heatmap de resultados mais prováveis);
   - gols esperados (xG acumulado) por time.
2. **RNG com semente** para os modos `quick`/`auto` (hoje usam `Math.random()` direto em
   `shared/gamespirit/spiritStateMachine.ts`), garantindo reprodutibilidade da agregação.
3. **Painel pré-jogo + barra ao vivo**: mostrar a probabilidade antes do apito e atualizá-la conforme
   o placar e o minuto evoluem (recomputar a partir do estado corrente). Isso é diversão direta:
   o jogador "sente" a virada acontecendo.

### Por que traz inteligência + diversão
Transforma números soltos de chute numa narrativa de probabilidade que o usuário entende e acompanha,
e dá base para conteúdo (prognóstico, "zebra", momentum visível).

### Âncoras
- Resolução de chute / RNG: `shared/gamespirit/spiritStateMachine.ts` (`pickByWeights`, `DEFAULT_HOME_SHOT_WEIGHTS`)
- xG por chute: `src/match/goalContext.ts` (`estimateShotXG`)
- Tick de minuto (loop a ser repetido em batch): `src/engine/runMatchMinute.ts`, `src/engine/matchBulk.ts`
- Contexto da partida: `shared/gamespirit/GameSpirit.ts` (`buildSpiritContext`)

---

## Melhoria 2 — Pipeline de atualização contínua (lesões, suspensões, escalação)

### Gap
A SSOT de saúde/moral já existe e é robusta, mas a atualização e a **visibilidade** dela são pontuais
(acontecem no pós-jogo e na recuperação por tick). Falta um pipeline contínuo e legível que mantenha
**lesões, suspensões e escalação provável** sempre atualizados e expostos antes da partida.

### O que entregar
1. **Recálculo contínuo de disponibilidade**: consolidar, num único ponto de leitura, quem está
   `outForMatches > 0`, `suspendedMatches > 0` ou `atRisk` (fadiga ≥ 80 / injuryRisk ≥ 70), reaproveitando
   a SSOT existente — sem nova fonte de verdade.
2. **Escalação provável automática**: ao abrir o pré-jogo, sugerir o XI considerando desfalques
   (lesão/suspensão) e risco (fadiga), sinalizando substituições forçadas.
3. **Feed de status**: cartões visuais de "novidades do elenco" (entrou em recuperação, saiu de suspensão,
   risco de lesão subindo) — alimentado pelas ações que já existem no reducer.
4. **Garantir o tick de recuperação** roda de forma previsível entre rodadas (`TICK_HEALTH_RECOVERY`),
   incluindo o bônus do departamento médico.

### Por que traz inteligência + diversão
Dá peso real às decisões de elenco: rodar jogadores, gerir fadiga e evitar suspensões vira estratégia
viva, e o usuário enxerga as consequências antes de entrar em campo.

### Âncoras
- SSOT de saúde: `src/systems/playerHealth/types.ts`, `src/systems/playerHealth/reducer.ts`
- Lesão/severidade: `src/systems/injury.ts`
- Moral/forma: `src/systems/playerMoral/types.ts`
- Ações de ciclo: `APPLY_MATCH_CONSEQUENCES`, `TICK_HEALTH_RECOVERY`, `FINALIZE_MATCH` em `src/game/types.ts`
- Persistência/hidratação da SSOT: `src/game/persistence.ts`

---

## Melhoria 3 — Fatores contextuais reais

### Gap
A simulação modela fadiga e moral internos, mas ignora variáveis de contexto que mudam o resultado
de um jogo real e dão sabor narrativo.

### O que entregar
Injetar modificadores de contexto no `SpiritContext`/início de partida, como camada *em cima* do motor:
- **Mando de campo** e fator torcida (parcialmente já existe via `crowdPressure`/support — expandir e expor).
- **Descanso / calendário**: dias desde o último jogo, congestão de calendário (penaliza times "rodados").
- **Confronto direto (H2H)** e rivalidade (modificador de intensidade/moral).
- **Importância do jogo** (decisão, final de liga) elevando mentalidade/pressão.
- **Desfalques confirmados** (vinculado à Melhoria 2) afetando força efetiva do time.

Cada fator entra como **multiplicador transparente e auditável** sobre o contexto, nunca como número mágico.

### Por que traz inteligência + diversão
Aproxima a leitura da partida do futebol real, cria histórias ("time desgastado", "clássico pegado",
"decisão") e melhora diretamente a qualidade das probabilidades da Melhoria 1.

### Âncoras
- Contexto da partida: `shared/gamespirit/GameSpirit.ts` (`buildSpiritContext`, `SpiritContext`)
- Torcida/pressão já existente: `crowdSpiritFromSupport`, `CrowdSpiritPressure`
- Calibração de referência (médias reais): `src/engine/classic/calibrationData.ts`

---

## Sequenciamento sugerido

1. **Melhoria 2** primeiro (status contínuo) — destrava dados de desfalque/força efetiva.
2. **Melhoria 3** (fatores contextuais) — usa os desfalques e enriquece o contexto.
3. **Melhoria 1** (probabilidade V/E/D) — agrega tudo num número que o usuário vê e sente.

> Observação: nenhuma das três exige reescrever o motor. São **camadas sobre o `GameSpirit` atual**,
> reaproveitando SSOT, calibração e o loop de minuto já existentes.

---

## Não-escopo (deliberadamente fora desta bateria)

- Conexão com API de esportes ao vivo (fixtures/escalações reais).
- Mapeamento de jogadores reais → atributos do modelo.
- Backtesting/calibração contra resultados reais (Brier score, log loss).

Esses pontos pertencem à trilha de **predição de jogos reais** e serão tratados separadamente.
Esta bateria foca em mais inteligência e diversão **dentro do jogo como ele é hoje**.
