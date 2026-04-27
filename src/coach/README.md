# Coach Agent - Assistente Técnico Inteligente

Sistema completo de Coach Agent com IA que conhece todo o sistema de treinos e staff do Olefoot, aprende com o manager e fornece sugestões contextuais.

---

## 🎯 Visão Geral

O Coach Agent é um **assistente técnico autônomo** que:

- **Conhece todo o sistema**: treinos (individual/coletivo), staff (7 roles), estruturas, economia
- **Aprende com o manager**: memoriza instruções e preferências
- **Sugere ações contextuais**: analisa fadiga, lesões, próximo jogo e recomenda treinos/staff
- **Conversa naturalmente**: usa Claude Haiku (Anthropic) para respostas inteligentes
- **Tem personalidade**: 5 tipos (Pragmatic, Visionary, Motivator, Tactician, Developer)

---

## 📁 Arquitetura

```
src/coach/
├── types.ts                 # Tipos: CoachAgent, CoachMemory, TeamContext
├── defaultCoach.ts          # Criação do coach default + conhecimento do sistema
├── coachConversation.ts     # Engine de conversação (LLM + fallback heurístico)
├── coachApi.ts              # Cliente HTTP para backend
└── README.md                # Esta documentação

server/src/routes/
└── coach.ts                 # Rotas backend (Claude Haiku via Anthropic)

src/pages/
├── CoachChat.tsx            # UI de chat com o coach
└── TeamStaff.tsx            # Card do coach em /team/staff
```

---

## 🧠 Tipos Core

### `CoachAgent`

```typescript
interface CoachAgent {
  id: string;
  name: string;
  personality: CoachPersonality; // Pragmatic, Visionary, Motivator, Tactician, Developer
  specialties: CoachSpecialty[]; // defense, attack, midfield, setpieces, youth, fitness, mentality
  
  // Atributos (0-20, estilo Football Manager)
  tactical: number;
  motivation: number;
  discipline: number;
  attacking: number;
  defending: number;
  
  autonomyLevel: number; // 0-100 (quanto age sem pedir permissão)
  reputation: number;    // 0-100
  
  memory: CoachMemory;
  conversationContext: ConversationMessage[];
}
```

### `CoachMemory`

```typescript
interface CoachMemory {
  managerInstructions: ManagerInstruction[];  // "Sempre priorize treino tático"
  trainingKnowledge: {
    preferredIndividualTypes: IndividualTrainingType[];
    preferredCollectiveTypes: CollectiveTrainingType[];
    preferredGroups: TrainingGroup[];
    typicalDurationHours: number;
  };
  staffKnowledge: {
    priorityRoles: StaffRoleId[];
    playerAssignmentStrategy: string;
  };
  decisionHistory: CoachDecision[];
}
```

### `TeamContext`

```typescript
interface TeamContext {
  totalPlayers: number;
  injuredPlayers: number;
  suspendedPlayers: number;
  averageFatigue: number;
  averageInjuryRisk: number;
  averageOverall: number;
  
  staffLevels: Record<StaffRoleId, number>;
  staffSlotsAvailable: number;
  staffAssignedCount: number;
  
  runningTrainingPlans: number;
  completedTrainingPlans: number;
  trainingCenterLevel: number;
  
  availableExp: number;
  availableBro: number;
  
  nextMatch?: {
    opponent: string;
    isHome: boolean;
    daysUntil: number;
  };
}
```

---

## 🔧 Conhecimento do Sistema

O coach conhece **tudo** sobre o Olefoot através de `COACH_SYSTEM_KNOWLEDGE`:

### Treinos Individuais

| Tipo | Descrição |
|------|-----------|
| `fisico` | Melhora velocidade, físico e reduz fadiga. Ideal após jogos intensos. |
| `mental` | Aumenta mentalidade, confiança e fair play. Importante para jogadores jovens. |
| `tatico` | Desenvolve tático e posicionamento. Essencial para entender formações. |
| `atributos` | Treina passe, drible e finalização. Core técnico do jogador. |
| `especial` | Especialização ofensiva avançada. Para atacantes de elite. |

### Treinos Coletivos

| Tipo | Descrição |
|------|-----------|
| `formacao` | Melhora posicionamento coletivo e entendimento tático do grupo. |
| `empatia` | Aumenta fair play e coesão do time. Reduz cartões. |
| `fisico` | Condicionamento físico coletivo. Prepara o time para sequência de jogos. |

### Grupos

| Grupo | Descrição |
|-------|-----------|
| `defensivo` | Zagueiros e volantes. Foco em marcação e posicionamento. |
| `criativo` | Meio-campo. Foco em passes e criação. |
| `ataque` | Atacantes. Foco em finalização e movimentação. |
| `all` | Plantel completo. Usa para preparação pré-temporada ou integração. |

### Staff (Prioridade de Upgrade)

1. **treinador**: Multiplica ganhos de TODOS os treinos. **Prioridade máxima**.
2. **preparador_fisico**: Acelera recuperação de fadiga.
3. **nutricao**: Reduz fadiga e risco de lesão após partidas.
4. **tatico**: Melhora ganhos de treino tático.
5. **mental**: Aumenta mentalidade e confiança.
6. **olheiro**: Aumenta recompensas EXP de scouting.
7. **preparador_goleiros**: Buff específico para goleiros.

---

## 🤖 Backend (Claude Haiku)

### Rotas

#### `POST /api/coach/chat`

Conversação natural com o coach.

**Request:**
```json
{
  "coach": CoachAgent,
  "teamContext": TeamContext,
  "userMessage": "Sugere um treino",
  "conversationHistory": [
    { "role": "user", "content": "Olá" },
    { "role": "assistant", "content": "Olá, manager!" }
  ]
}
```

**Response:**
```json
{
  "ok": true,
  "response": "**Sugestão de Treino:**\n\n⚠️ Fadiga média alta (68%). Recomendo:\n• Treino físico individual de 12-24h...",
  "instruction": {
    "instruction": "Sempre priorize treino tático",
    "category": "training",
    "priority": "high",
    "timestamp": 1234567890,
    "active": true
  },
  "usage": {
    "inputTokens": 1234,
    "outputTokens": 567
  }
}
```

#### `POST /api/coach/suggest-training`

Sugestão estruturada de plano de treino.

**Response:**
```json
{
  "ok": true,
  "suggestion": {
    "mode": "individual",
    "trainingType": "fisico",
    "group": "all",
    "durationHours": 24,
    "reasoning": "Fadiga média alta (68%). Treino físico de 24h para recuperação.",
    "priority": "high"
  }
}
```

#### `POST /api/coach/suggest-staff`

Sugestões de ações de staff (upgrades, atribuições).

**Response:**
```json
{
  "ok": true,
  "suggestions": [
    {
      "type": "upgrade",
      "role": "treinador",
      "action": "Upgrade Treinador para nível 2",
      "reasoning": "Multiplica TODOS os ganhos de treino. Prioridade máxima.",
      "priority": "high",
      "cost": { "currency": "exp", "amount": 3500000 }
    }
  ]
}
```

---

## 💬 Frontend (React)

### `CoachConversationEngine`

Engine principal de conversação.

```typescript
const engine = new CoachConversationEngine(coach, gameState);

// Chama LLM (Claude Haiku) via backend
const response = await engine.chat("Analisa o time");

// Fallback heurístico se API falhar
// (usa templates + análise de intenção)
```

### `CoachChat` (UI)

Página de chat completa em `/coach/chat`.

**Features:**
- Histórico de mensagens (user + assistant)
- Quick actions (botões rápidos)
- Contexto rápido (jogadores, fadiga, treinos, staff)
- Instruções ativas do manager
- Typing indicator

### `TeamStaff` (Card do Coach)

Card do coach em `/team/staff` com:
- Avatar (Bot icon)
- Nome + personalidade + reputação
- Stats (Tático, Motivação, Disciplina, Ataque, Defesa)
- Botão "Conversar" → `/coach/chat`
- Contador de instruções ativas

---

## 🎓 Sistema de Aprendizado

O coach **aprende** com o manager através de instruções:

### Detecção de Instruções

Keywords: `sempre`, `nunca`, `prefiro`, `quero que`, `não gosto`, `lembre`, `importante`, `priorize`

**Exemplo:**
```
Manager: "Sempre priorize treino tático para jovens"
Coach: ✅ Entendido e memorizado. Vou aplicar essa orientação nas minhas sugestões futuras.
```

### Categorias

- `training`: instruções sobre treinos
- `staff`: instruções sobre staff
- `lineup`: instruções sobre escalação
- `tactics`: instruções sobre táticas
- `general`: instruções gerais

### Prioridades

- `high`: sempre, nunca, crítico, essencial, obrigatório
- `medium`: prefiro, importante, priorize
- `low`: outras instruções

### Extração de Conhecimento

O coach extrai automaticamente:
- **Tipos de treino preferidos**: "prefiro treino físico" → adiciona `fisico` às preferências
- **Duração típica**: "sempre 48h" → `typicalDurationHours = 48`
- **Roles prioritárias**: "foca em preparador físico" → adiciona à lista de prioridades

---

## 🎭 Personalidades

### Pragmatic (Mourinho)
- **Foco**: Defesa sólida, resultados, disciplina
- **Stats**: Defending 1.3x, Discipline 1.2x, Tactical 1.1x
- **Treinos**: tático, mental, formação, físico
- **Duração**: 36h (treinos longos)

### Visionary (Guardiola)
- **Foco**: Posse de bola, padrões ofensivos, desenvolvimento
- **Stats**: Tactical 1.4x, Attacking 1.2x, Motivation 1.1x
- **Treinos**: tático, atributos, formação, empatia
- **Duração**: 48h (treinos detalhados)

### Motivator (Klopp)
- **Foco**: Intensidade, pressing, energia do grupo
- **Stats**: Motivation 1.5x, Attacking 1.2x, Discipline 0.9x
- **Treinos**: físico, mental, físico coletivo, empatia
- **Duração**: 24h (treinos intensos mas curtos)

### Tactician (Ancelotti)
- **Foco**: Adaptação tática, equilíbrio
- **Stats**: Tactical 1.5x, Defending 1.1x, Attacking 1.1x
- **Treinos**: tático, atributos, formação, físico
- **Duração**: 30h

### Developer
- **Foco**: Desenvolvimento de jovens, longo prazo
- **Stats**: Motivation 1.2x, Tactical 1.1x, Discipline 1.0x
- **Treinos**: atributos, especial, mental, empatia, formação
- **Duração**: 48h (desenvolvimento leva tempo)

---

## 🚀 Uso

### 1. Criar Coach Default

```typescript
import { createDefaultCoachAgent } from '@/coach/defaultCoach';

const coach = createDefaultCoachAgent();
// Coach começa como "Tactician" (equilibrado)
// Stats: 12/12/11/11/11 (júnior)
// Autonomia: 30% (baixa, pede aprovação)
```

### 2. Conversar com o Coach

```typescript
import { CoachConversationEngine } from '@/coach/coachConversation';

const engine = new CoachConversationEngine(coach, gameState);

const response = await engine.chat("Analisa o time");
// Retorna análise completa: jogadores, fadiga, treinos, staff, recomendação
```

### 3. Sugerir Treino

```typescript
import { suggestTraining } from '@/coach/coachApi';

const result = await suggestTraining(coach, teamContext);

if (result.ok) {
  console.log(result.suggestion);
  // { mode: 'individual', trainingType: 'fisico', durationHours: 24, ... }
}
```

### 4. Sugerir Staff

```typescript
import { suggestStaff } from '@/coach/coachApi';

const result = await suggestStaff(coach, teamContext);

if (result.ok) {
  console.log(result.suggestions);
  // [{ type: 'upgrade', role: 'treinador', priority: 'high', ... }]
}
```

---

## 📊 Custo (Claude Haiku)

**Modelo**: `claude-3-5-haiku-20241022`

**Preços**:
- Input: $0.25/1M tokens
- Output: $1.25/1M tokens

**Estimativa por conversa**:
- Input: ~1000 tokens (system prompt + contexto + histórico)
- Output: ~300 tokens (resposta)
- **Custo**: ~$0.0006 por mensagem

**Uso mensal** (1000 managers, 10 conversas/dia):
- 1000 × 10 × 30 = 300k conversas/mês
- 300k × $0.0006 = **$180/mês**

**Escalável até 10k managers** sem preocupação (~$1800/mês).

---

## 🔮 Próximos Passos

### Fase 1: Ações Executáveis ✅
- [x] Coach sugere treinos
- [x] Coach sugere staff
- [ ] Coach pode **iniciar** treinos com aprovação do manager
- [ ] Coach pode **fazer** upgrades de staff com aprovação

### Fase 2: Análise Pós-Jogo
- [ ] Coach revisa performance individual dos jogadores
- [ ] Coach identifica pontos fracos táticos
- [ ] Coach sugere ajustes para próximo jogo

### Fase 3: Evolução do Coach
- [ ] Stats melhoram com uso (1% de chance por partida)
- [ ] Reputação sobe com vitórias
- [ ] Especialidades adquiridas após 50 decisões

### Fase 4: Marketplace de Coaches
- [ ] Geração procedural de coaches (common, rare, legendary)
- [ ] Coaches lendários (Mourinho, Guardiola, Klopp, Ancelotti)
- [ ] Compra/venda de coaches por OLE/BRO

### Fase 5: Autonomia Avançada
- [ ] Coach age sozinho durante partidas (substituições, ajustes táticos)
- [ ] Coach gerencia rotação de elenco automaticamente
- [ ] Coach sugere contratações baseado em lacunas do time

---

## 🐛 Troubleshooting

### Coach não responde

1. Verifica se `ANTHROPIC_API_KEY` está configurada no backend
2. Verifica se backend está rodando (`http://localhost:4000`)
3. Verifica console do browser para erros de rede
4. Fallback heurístico deve funcionar mesmo sem API

### Respostas genéricas

1. Verifica se `teamContext` está sendo passado corretamente
2. Verifica se `coach.memory.managerInstructions` tem instruções ativas
3. Aumenta `temperature` no backend para respostas mais variadas

### Instruções não são salvas

1. Verifica se mensagem contém keywords (`sempre`, `nunca`, `prefiro`)
2. Verifica se `extractInstruction()` está detectando corretamente
3. Verifica se `coach.memory.managerInstructions` está sendo persistido

---

## 📝 Licença

Parte do projeto Olefoot. Uso interno.
