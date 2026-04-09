# Prompt de especificação — OLEFOOT: simulação tática + Yuka + Babylon (visual 2D)

Use este documento como **briefing único** para implementação (humano ou IA). Ele assume **reuso do que já existe** no projeto OLEFOOT (Expo / React Native, rotas, UI, estado de partida, GameSpirit ou motor mock) e adiciona **movimento inteligente com Yuka** e **camada visual com Babylon.js**, priorizando **experiência 2D** (câmera, profundidade leve, pós-processamento), sem obrigar modelo 3D pesado no MVP.

---

## 1. Contexto e objetivo

**Contexto:** O app já possui fluxo de gestão, carteira, telas de partida e um núcleo de estado/simulação (ou GameSpirit) que decide eventos, placar, fadiga, comandos do manager, etc.

**Objetivo desta fase:** Fazer a partida **parecer uma transmissão**: jogadores **correm no campo** respeitando **blocos táticos**, **reformação após eventos** (lateral, escanteio, tiro de meta, bola fora), **interações lógicas** (marcação, corredores, disputa simplificada), com movimento **fluido e crível** via **Yuka**, e **câmera / apresentação** via **Babylon** (orthographic ou perspectiva leve sobre plano 2D).

**Não é objetivo (MVP):** física realista FIFA, animação facial, VAR, multiplayer online.

**Documentos relacionados:** [Admin, zonas, padrões táticos e jogador especial (BRO)](./PROMPT_ADMIN_CAMPO_INTELIGENTE.md) — cadastro no Admin ligado ao mesmo `fieldSchemaVersion` do gramado.

---

## 2. Princípios de arquitetura

1. **Simulação e render são irmãos, não gêmeos:** um módulo produz `MatchTruth` (estado lógico + vetores); Babylon **só lê** snapshots; Yuka **só atua** no espaço da simulação.
2. **2D first:** campo como **plano** (mesh plano ou ground) + “jogadores” como **billboards**, **sprites em plano**, ou **capsulas baixas**; câmera com **follow**, **lerp**, **shake**, **zoom** e opcional **slow-motion visual** (time scale só na câmera ou interpolação, não quebrar o relógio da simulação).
3. **Tática manda no alvo; Yuka manda na curva:** posição desejada vem de `formation` + `tactics` + `matchState`; Yuka converte em **velocidade/aceleração** suave (seek, arrive, separation, limites).
4. **GameSpirit (ou motor existente)** continua responsável por **narrativa, consequência de ações do manager, eventos de jogo**; a nova camada **não substitui** regras de gol/cartão — **alimenta** posse, zonas e intenções quando necessário.

---

## 3. Stack técnica


| Camada                              | Tecnologia                                                                                                                                                           |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App shell existente                 | Expo, React Native, Expo Router (manter)                                                                                                                             |
| Visual da partida (web ou embutido) | **Babylon.js** (`@babylonjs/core`, `@babylonjs/loaders`, opcional `@babylonjs/gui`, materiais)                                                                       |
| Agente / movimento                  | **Yuka** (steering, percepção simples, FSM se útil)                                                                                                                  |
| Ponte RN ↔ Babylon                  | **WebView** ou **expo-web** com rota dedicada `/match-3d` (escolher uma estratégia e documentar); sincronização via `postMessage` ou store compartilhado serializado |


**Nota:** Se o alvo for só web no Vite, adaptar o item “ponte RN” para embed no mesmo host.

---

## 4. Módulos sugeridos (pastas e responsabilidades)

Criar (ou fundir com `src/` existente) a seguinte estrutura lógica:

### 4.1 `src/simulation/` — Verdade do jogo no espaço

- **Coordenadas normalizadas** (0–1 ou metros virtuais) independentes de pixel.
- Integração numérica leve: posição/velocidade da bola; limites do campo.
- API: `step(dt)`, `getSnapshot(): MatchTruthSnapshot`.

### 4.2 `src/formation/` — Slots táticos e reformação

- **FormationLayout:** dado esquema (ex. 4-3-3), lado, fase (`JogoNormal`, `Lateral`, `Escanteio`, `TiroMeta`, …), posição da bola → calcula **slot alvo** por `playerId`.
- **Presets de bola parada:** após evento, todos recebem slots temporários; após reinício, volta ao modo dinâmico.
- **Parâmetros do manager:** mentalidade, linha defensiva, pressão → ajustam profundidade/largura do bloco (números que o layout consome).

### 4.3 `src/matchState/` — Máquina de estados da partida

- Estados: bola viva, parada, reinício, intervalo (se aplicável).
- Transições disparadas pelo motor existente (GameSpirit/mock) **ou** por regras de bola fora.
- Ao entrar em estado parado: chama `formation.applyPreset(eventType)`.
- Ao voltar bola viva: `formation.resumeDynamic()`.

### 4.4 `src/tactics/` — Blocos e vínculos por posição

- Regras do tipo: zagueiros ancorados à linha defensiva; alas em corredor; meias entre linhas; atacantes com profundidade máxima/mínima.
- Função: `clampTargetToRoleZone(player, rawTarget, context)`.
- Não desenha nada; só geometria lógica.

### 4.5 `src/agents/` — Yuka + intenção

- Um **Vehicle** (ou equivalente Yuka) por jogador, compartilhando o mesmo espaço 2D/3D (Vector3 com y fixo ou Vector2 mapeado).
- Comportamentos: **Arrive/Seek** ao slot; **Separation** entre companheiros próximos; opcional **Alignment** na linha defensiva.
- **Modos:** `Reforming` (peso alto no slot após parada), `InPlay`, `Pressing` (viés do manager).
- Saída: velocidade desejada → `simulation` aplica e atualiza posição.

### 4.6 `src/interactions/` — Eventos discretos

- Disputa de bola (raio, prioridade, atributo simplificado).
- Passe / interceptação (linha de visão grosseira, risco).
- Acoplamento: quando interação resolve, notifica **motor existente** (posse, evento de narrativa).

### 4.7 `src/render-babylon/` — Apenas apresentação

- Inicializa `Engine`, `Scene`, **câmera ortográfica ou perspectiva fraca** olhando para o plano do campo.
- **MatchViewAdapter:** lê `MatchTruthSnapshot` → atualiza meshes/sprites/billboards e posição da bola.
- **CameraDirector:** follow suave na bola ou no “pacote”; shake em gol; zoom em finalização (via animação de câmera ou FOV).
- **Proibido:** regra de gol, cartão ou economia dentro deste módulo.

### 4.8 `src/bridge/` — Integração com o app

- Serialização JSON do snapshot (versão schema `v1`).
- Se WebView: `postMessage` RN → Web e vice-versa (comandos do manager, pause).
- Throttle: enviar snapshot a 15–30 Hz; UI React pode ficar a 1–5 Hz para HUD.

---

## 5. Contrato de dados (exemplo mínimo)

Definir um tipo estável (TypeScript):

```ts
// Ilustrativo — ajustar ao repo
type MatchTruthSnapshot = {
  t: number; // tempo simulação
  ball: { x: number; y: number; z?: number };
  players: Array<{
    id: string;
    side: 'home' | 'away';
    x: number;
    y: number;
    z?: number;
    heading?: number;
    speed?: number;
    role: string;
  }>;
  matchPhase: 'live' | 'dead_ball' | 'kickoff' | 'throw_in' | /* ... */;
};
```

Babylon consome **somente** isso (+ opcional `cameraCues[]` gerados por GameSpirit para efeitos).

---

## 6. Fluxo por frame (ordem fixa)

1. `matchState` atualiza fase (se evento externo).
2. `formation` recalcula slots conforme fase + tática + bola.
3. `tactics` ajusta alvos por zona/bloco.
4. `agents` (Yuka) calcula steering → atualiza velocidades.
5. `simulation` integra posições, bola, limites.
6. `interactions` testa contatos discretos (intervalo maior que physics tick se necessário).
7. Motor existente / GameSpirit recebe outcomes (posse, faltas, etc.).
8. `render-babylon` interpola visualmente entre snapshots anteriores e atuais (opcional) para suavidade.

---

## 7. Dependências npm (referência)

- `@babylonjs/core`
- `@babylonjs/loaders` (glTF se houver props simples)
- `yuka` (pacote npm do Yuka)

Fixar versões no `package.json` e documentar no README da feature.

---

## 8. Critérios de aceite (MVP desta fase)

- Jogadores **movem-se suavemente** até slots táticos durante jogo normal.
- Em **lateral / escanteio / tiro de meta**, o time **recompõe** posições definidas pelo preset e, após reinício, retorna ao **modo dinâmico**.
- **Blocos táticos** respeitados (defesa não “vaza” inteira sem comando; alas em corredor).
- **Separation** evita sobreposição gritante na linha.
- **Babylon** exibe campo + jogadores + bola com **câmera follow** e pelo menos um **efeito** (shake ou zoom) em gol.
- Nenhuma regra financeira ou de menu dentro de `render-babylon`.
- `tsc`/build do monorepo continua passando.

---

## 9. Ordem de implementação recomendada

1. `simulation` + `formation` (slots + um preset de bola parada).
2. `matchState` FSM mínima (live ↔ lateral).
3. `agents` + Yuka (seek/arrive + separation).
4. `tactics` (zones por role).
5. `render-babylon` leitura de snapshot + câmera básica.
6. `interactions` mínimas (disputa + passe).
7. `bridge` + integração na tela de partida existente.
8. GameSpirit: apenas ganchos para **cameraCues** e eventos que disparam presets.

---

## 10. Instrução final para quem implementa (copiar como prompt curto)

> Implemente no OLEFOOT a camada de **partida espacial** reutilizando o estado e o fluxo de partida já existentes. Adicione os módulos `simulation`, `formation`, `matchState`, `tactics`, `agents` (com **Yuka** para steering), `interactions` e `render-babylon` (com **Babylon.js** em modo **2D/plano**, câmera com follow e efeito em gol). O render não contém regras de jogo; apenas consome `MatchTruthSnapshot`. Preserve o app Expo atual e integre via WebView ou rota web conforme decisão documentada. Entregue MVP conforme critérios de aceite acima.

---

*Documento gerado para alinhar produto, gameplay e engenharia. Ajuste nomes de pastas se o repositório usar `entities/`, `engine/` ou `gamespirit/` — mantendo os limites entre simulação, IA de movimento e render.*