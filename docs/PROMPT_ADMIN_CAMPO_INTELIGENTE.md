# Especificação — Admin, padrões de jogador, jogador especial (BRO) e padrões táticos

Este documento complementa `[PROMPT_MOTOR_VISUAL_BABYLON_YUKA.md](./PROMPT_MOTOR_VISUAL_BABYLON_YUKA.md)`. Objetivo: **o que é cadastrado no Admin vira comportamento e zona no gramado na partida**, não fica “só no banco”.

---

## 0. Onde isso é implementado (leitura obrigatória)

**O Admin não é parte do app de jogo do jogador** (Expo / mobile / “game” do manager).

- **Admin = aplicação à parte**: por exemplo um **site interno** (Vite, Next.js, etc.) em subdomínio tipo `admin.olefoot…` ou rota isolada em deploy separado, com **autenticação de staff** (criadores, devs, operação). Ninguém que só baixa o OLEFOOT para jogar deveria ver essas telas.
- **O jogo** só **consome** os dados publicados pelo Admin via **API/backend** (ou CDN versionada): `TacticalPattern`, `PlayerFieldProfile`, catálogo de zonas, etc. O binário do cliente **não** embute ferramentas de cadastro tático para o público.

**Por que deixar explícito:** sem este bloco, quem implementar pode achar que deve colocar “Criar jogador especial” e “Padrões táticos” **dentro do mesmo app React Native** — o que mistura produto, segurança e UX errados.

**Exceção opcional:** um build “dev tools” só para equipe (flag de ambiente) pode reutilizar componentes de campo; mesmo assim, **não** é o fluxo do jogador final.

---

## 1. Princípio mestre

**Um único sistema de coordenadas e zonas** do campo, usado em:

- Admin (desenho / seleção no campo),
- `formation` + `tactics` no servidor ou cliente,
- Partida ao vivo (Yuka + Babylon).

Se o Admin grava “zona X”, o runtime da partida **deve** resolver o mesmo polígono ou grade (IDs estáveis). Nada de coordenadas soltas sem `fieldSchemaVersion`.

---

## 2. Módulos Admin (produto)

### 2.1 Admin · Meu Time · **Padrão dos jogadores** (por jogador)

**Público:** criadores / desenvolvedores do jogo (não o manager casual).

**Função:** Para cada jogador (ou template de posição), definir **o que ele faz no espaço**: reações, prioridades, vínculos com zona, hints para GameSpirit/Yuka.

**UI sugerida:**

- **Campo interativo** (mesma projeção 2D do jogo): clique em zona, arrastar polígonos ou selecionar células de uma **grade lógica** (ex. 8×5).
- Painel por **posição** ou por **jogador** (ID):
  - Zonas preferenciais / proibidas / de pressão,
  - Peso de comportamentos (ex.: “priorizar linha de passe”, “não abandonar corredor”),
  - **Comandos de ensino** em formato estruturado (não só texto livre): lista de `TeachingRule` com condição + ação + prioridade.
- Modo **treino / simulação rápida** (opcional MVP+): reproduzir 10–20 segundos de jogo com fantoches para validar.

**Saída de dados (exemplo conceitual):**

```ts
type PlayerFieldProfile = {
  playerId: string;
  fieldSchemaVersion: string;
  zones: ZoneBinding[];      // refs para catálogo de zonas
  teachingRules: TeachingRule[];
  yukaWeights?: Partial<Record<string, number>>; // seek, separation, etc.
  updatedAt: string;
};
```

**Runtime:** Na partida, ao instanciar o agente (Yuka), carregar `PlayerFieldProfile` e mesclar com o **Padrão Tático** ativo do time (ver §2.3).

---

### 2.2 Admin · Criar jogador · **Especial** (monetização BRO)

**Função:** Mesma **estrutura de formação / perfil de campo** que um jogador normal, **mais**:

- **Preço em BRO** (Brazil Olefoot) na criação.
- **Split de pagamento** fixo no contrato de criação (percentuais auditáveis):


| Beneficiário   | %   |
| -------------- | --- |
| Olefoot        | 25% |
| Agente         | 10% |
| Jogador (pool) | 50% |
| Comunidade     | 15% |


- **ID do facilitador** obrigatório no momento da criação → comissões roteadas para a **wallet** desse ID (definir se “facilitador” = parte do split Agente ou campo adicional; abaixo assume **facilitador mapeado ao bucket Agente ou sub-split documentado**).

**Regras de implementação:**

- Persistir `creationTx` ou `paymentIntentId`, `facilitatorId`, `splitsSnapshot` (imutável após mint/criação).
- Idempotência em webhook de pagamento.
- **Compliance:** revisão jurídica local (este doc não é assessoria legal).

**Ligação com partida:** O jogador especial carrega o mesmo `PlayerFieldProfile`; a diferença é **onboarding econômico**, não IA diferente — a menos que regras de ensino também sejam premium (explicitar no produto).

---

### 2.3 Admin · **Padrões táticos** (core do jogo)

**Função:** Cadastrar **modelos de jogo** que alteram:

- Formação (slots relativos),
- Comportamento coletivo (bloco, largura, linha de pressão),
- **Ocupação espacial** (quais zonas do campo o modelo “pretende” dominar em cada fase: saída de bola, pressão, transição defensiva).

**UI sugerida:**

- Wizard: nome, tags, **formation base** (4-3-3, 4-4-2…),
- Editor no **campo**: para cada fase (`build_up`, `press`, `low_block`, …), pintar ou associar **zonas de ocupação alvo** por linha (defesa/meio/ataque),
- Sliders globais já existentes no jogo (mentalidade etc.) podem **mapear** para presets numéricos deste padrão.

**Saída de dados:**

```ts
type TacticalPattern = {
  id: string;
  name: string;
  fieldSchemaVersion: string;
  formationKey: string;
  slotTemplate: SlotDefinition[]; // offsets relativos ao pivô (bola ou centro)
  phasePresets: Record<MatchPhaseTactic, PhaseSpatialProfile>;
  behavior: {
    blockDepthBias: number;
    widePlayBias: number;
    pressTriggerZones: string[]; // zone ids
  };
  version: number;
};
```

**Conexão obrigatória com o gramado:**

1. Ao salvar no Admin, rodar **validação**: todos `zoneId` existem no catálogo da `fieldSchemaVersion`.
2. Publicar artefato versionado: `tactical-patterns@v7.json` (ou row no DB com `version`).
3. **Partida ao vivo** carrega `TacticalPattern` **pelo ID** usado pelo clube na rodada; `formation.computeSlots` usa **somente** esse artefato + bola + `matchState`.
4. Teste automático: “smoke test” que instancia snapshot com padrão X e verifica que slots caem dentro do campo e dentro das zonas declaradas.

Sem o passo (3)–(4), o requisito **“não adianta estar no banco”** não está cumprido.

---

## 3. Campo inteligente e movimento por zona

**Definições:**

- **Catálogo de zonas** (`FieldZone`): polígono ou células na grade, `id` estável, metadados (terço, corredor esquerdo, etc.).
- **Player** sabe:
  - posição atual (simulação),
  - **zona atual** (query espacial a cada tick ou a cada N ms),
  - `PlayerFieldProfile` + `TacticalPattern` ativo.

**Pipeline:**

1. `formation` → alvo primário (slot).
2. `tactics` + **zona atual** → ajuste do alvo (clamp, desvio para corredor).
3. `teachingRules` → modifica pesos Yuka ou flags (ex.: “se zona = finalização e posse, aumentar seek ao gol”).
4. Yuka → movimento.
5. Babylon → visual.

Assim, **“saber espacialmente onde estão”** = **query de zona + estado tático**, não GPS real.

---

## 4. Papéis no sistema (resumo)


| Ator           | Ferramenta             | Efeito na partida                                            |
| -------------- | ---------------------- | ------------------------------------------------------------ |
| Criador        | Admin padrão jogador   | Regras e zonas por jogador/posição                           |
| Criador        | Admin padrão tático    | Formação + fases + zonas coletivas                           |
| Facilitador    | ID na criação especial | Split BRO na wallet                                          |
| Manager (jogo) | Sliders / comandos     | Viés em cima do padrão do clube, não substitui artefato base |


---

## 5. Critérios de aceite (Admin + gramado)

- **Admin em app/deploy separado** do cliente do jogador; auth de staff; rotas de cadastro **não** expostas no build público do game.
- Campo no Admin usa o **mesmo `fieldSchemaVersion`** que a partida.
- `TacticalPattern` salvo é **carregável** em partida de teste e altera slots/ zonas observáveis.
- `PlayerFieldProfile` altera comportamento mensurável (ex.: tempo médio na zona X ou taxa de seek ao corredor Y em build de teste).
- Jogador especial: preço BRO + split persistido + `facilitatorId` ligado a pagamento.
- Documentação de API interna: `GET /patterns/:id`, `GET /players/:id/field-profile` (ou equivalente no monorepo).

---

## 6. Prompt curto para implementação (copiar)

> Implemente uma **aplicação administrativa separada** (web, staff-only) — **não** dentro do app de jogo do jogador. Três áreas: (1) **Padrão dos jogadores** — campo interativo + ensinamentos estruturados por jogador/posição, exportando `PlayerFieldProfile` com zonas e regras; (2) **Criar jogador especial** — mesma estrutura + preço BRO e split 25/10/50/15 com **facilitatorId** para wallet; (3) **Padrões táticos** — CRUD de `TacticalPattern` com formação, fases, ocupação de campo e **validação** contra catálogo de zonas. Persistir via API/backend; o **cliente do jogo** só consome esses artefatos. Garantir que a partida ao vivo **carrega** os dados em `formation`/`tactics`/`agents` com o mesmo `fieldSchemaVersion`. Yuka + Babylon conforme doc do motor.

---

*Ajuste percentuais e papéis legais de “facilitador” com o time jurídico antes de produção financeira.*

**Economia (EXP, ranking, BRO, jogadores especiais):** ver [ECONOMIA_EXP_BRO.md](./ECONOMIA_EXP_BRO.md).