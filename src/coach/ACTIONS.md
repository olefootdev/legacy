# Coach Agent - Ações Executáveis

Sistema completo de ações executáveis integrado ao chat do Coach Agent.

---

## ✅ Implementado

### 1. **Ações no Chat**

O coach pode agora **sugerir e criar ações executáveis** diretamente na conversa:

#### Botões Quick Actions

```
┌─────────────────────────────────────────┐
│ [Analisa o time]  [⚡ Sugere treino]    │
│ [⚡ Prioridades staff]  [Próximo jogo]  │
└─────────────────────────────────────────┘
```

Botões com ⚡ (raio) criam **ações executáveis** automaticamente.

---

### 2. **Fluxo: Sugerir Treino**

**Manager clica**: "⚡ Sugere treino"

**Coach:**
1. Chama backend (`POST /api/coach/suggest-training`)
2. Claude Haiku analisa situação do time
3. Retorna sugestão estruturada
4. Cria `CoachAction` com `createTrainingAction()`
5. Adiciona ao estado via `COACH_ADD_PENDING_ACTION`
6. Responde no chat:

```
✅ Sugestão de Treino Criada

Tipo: Coletivo - físico
Grupo: all
Duração: 24h
Prioridade: high

Justificativa:
Fadiga média alta (68%). Treino físico coletivo de 24h 
para recuperação antes do próximo jogo.

📋 Criei uma ação pendente para aprovação. 
Verifica o card no canto inferior direito da tela.
```

**Manager:**
- Vê card flutuante no canto inferior direito
- Clica "Aprovar" → treino inicia automaticamente
- Ou clica "Rejeitar" → ação é descartada

---

### 3. **Fluxo: Sugerir Staff**

**Manager clica**: "⚡ Prioridades staff"

**Coach:**
1. Chama backend (`POST /api/coach/suggest-staff`)
2. Claude Haiku analisa staff atual + recursos
3. Retorna array de sugestões (upgrades, atribuições)
4. Cria múltiplas `CoachAction` (máximo 3)
5. Adiciona ao estado
6. Responde no chat:

```
✅ Sugestões de Staff Criadas

1. Upgrade treinador para nível 2 (high)
   Multiplica TODOS os ganhos de treino. Prioridade máxima.

2. Upgrade preparador_fisico para nível 2 (medium)
   Fadiga média alta. Acelera recuperação.

📋 Criei 2 ação(ões) pendente(s) para aprovação.
```

**Manager:**
- Vê 2 cards flutuantes empilhados
- Aprova/rejeita cada um individualmente
- Upgrades são executados automaticamente

---

## 🎯 Código Implementado

### `handleSuggestTraining()`

```typescript
const handleSuggestTraining = async () => {
  setSuggestingAction(true);

  // 1. Adiciona mensagem do manager
  const userMsg = {
    role: 'user',
    content: 'Sugere um plano de treino e executa se eu aprovar',
    timestamp: Date.now(),
  };
  setMessages((prev) => [...prev, userMsg]);

  // 2. Chama backend
  const teamContext = conversationEngine.buildTeamContext();
  const result = await suggestTraining(coach, teamContext);

  // 3. Cria ação executável
  const action = createTrainingAction(
    coach,
    teamContext,
    result.suggestion,
    [] // playerIds
  );

  // 4. Adiciona ao estado
  dispatch({ type: 'COACH_ADD_PENDING_ACTION', action });

  // 5. Responde no chat
  const assistantMsg = {
    role: 'assistant',
    content: `✅ Sugestão criada...`,
    timestamp: Date.now(),
  };
  setMessages((prev) => [...prev, assistantMsg]);

  setSuggestingAction(false);
};
```

### `handleSuggestStaff()`

```typescript
const handleSuggestStaff = async () => {
  setSuggestingAction(true);

  // 1. Chama backend
  const result = await suggestStaff(coach, teamContext);

  // 2. Cria ações para cada sugestão (máximo 3)
  for (const suggestion of result.suggestions.slice(0, 3)) {
    if (suggestion.type === 'upgrade') {
      const action = createUpgradeStaffAction(coach, teamContext, suggestion);
      dispatch({ type: 'COACH_ADD_PENDING_ACTION', action });
    }
  }

  // 3. Responde no chat
  setMessages((prev) => [...prev, assistantMsg]);

  setSuggestingAction(false);
};
```

---

## 🎨 UI Melhorada

### Quick Actions com Indicador

Botões com ⚡ (raio amarelo) indicam **ações executáveis**:

```tsx
<button
  className={cn(
    "bg-white/5 border border-white/10 rounded px-3 py-2",
    action.action && "border-neon-yellow/30 hover:border-neon-yellow/50"
  )}
>
  {action.action && <Zap className="w-3 h-3 inline mr-1 text-neon-yellow" />}
  {action.label}
</button>
```

### Estado de Loading

```tsx
const [suggestingAction, setSuggestingAction] = useState(false);

// Desabilita botões durante sugestão
disabled={loading || suggestingAction}
```

---

## 📊 Fluxo Completo

```
Manager clica "⚡ Sugere treino"
    ↓
Frontend: handleSuggestTraining()
    ↓
Backend: POST /api/coach/suggest-training
    ↓
Claude Haiku: analisa situação + retorna JSON
    ↓
Frontend: createTrainingAction()
    ↓
Reducer: COACH_ADD_PENDING_ACTION
    ↓
UI: Card flutuante aparece (CoachActionApproval)
    ↓
Manager: clica "Aprovar"
    ↓
Reducer: COACH_APPROVE_ACTION + COACH_EXECUTE_ACTION
    ↓
Treino inicia automaticamente
    ↓
Card desaparece com animação
```

---

## 🚀 Vantagens

### 1. **Zero Fricção**
- Manager não precisa sair do chat
- 2 cliques: "Sugere treino" → "Aprovar"
- Execução automática após aprovação

### 2. **Contexto Preservado**
- Sugestão aparece no histórico do chat
- Justificativa completa visível
- Manager pode revisar depois

### 3. **Múltiplas Ações**
- Coach pode sugerir 3 upgrades de staff de uma vez
- Manager aprova/rejeita individualmente
- Cards empilhados no canto da tela

### 4. **Feedback Visual**
- ⚡ indica ações executáveis
- Loading state durante sugestão
- ✅ confirma criação da ação
- 📋 direciona para o card de aprovação

---

## 🎯 Exemplos de Uso

### Exemplo 1: Treino Urgente

```
Manager: [clica "⚡ Sugere treino"]

Coach: ✅ Sugestão de Treino Criada

Tipo: Individual - físico
Grupo: all
Duração: 12h
Prioridade: high

Justificativa:
Fadiga crítica (75%). 3 jogadores acima de 80% de fadiga.
Treino físico leve de 12h para recuperação urgente.

📋 Criei uma ação pendente para aprovação.

[Card aparece no canto]
Manager: [clica "Aprovar"]
[Treino inicia automaticamente]
```

### Exemplo 2: Múltiplos Upgrades

```
Manager: [clica "⚡ Prioridades staff"]

Coach: ✅ Sugestões de Staff Criadas

1. Upgrade treinador para nível 2 (high)
   Multiplica TODOS os ganhos. Tens 5M EXP disponível.

2. Upgrade preparador_fisico para nível 2 (medium)
   Fadiga alta. Acelera recuperação.

3. Upgrade nutricao para nível 2 (low)
   Prevenção de lesões.

📋 Criei 3 ação(ões) pendente(s).

[3 cards aparecem empilhados]
Manager: [aprova #1 e #2, rejeita #3]
[Upgrades executam automaticamente]
```

---

## 🔧 Configuração

### Máximo de Ações Simultâneas

```typescript
// Limita a 3 ações por sugestão
for (const suggestion of suggestions.slice(0, 3)) {
  // ...
}
```

### Timeout de Limpeza

```typescript
// Remove ações executadas/rejeitadas após 1 hora
case 'COACH_CLEAR_EXECUTED_ACTIONS': {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  // ...
}
```

---

## 📝 Próximos Passos

### Fase 1: Ações Avançadas ✅
- [x] Sugerir treino executável
- [x] Sugerir staff executável
- [ ] Sugerir escalação executável
- [ ] Sugerir substituições durante jogo

### Fase 2: Autonomia
- [ ] Coach age sozinho se `autonomyLevel >= 70`
- [ ] Notifica manager após executar
- [ ] Manager pode reverter ações

### Fase 3: Aprendizado
- [ ] Coach aprende com aprovações/rejeições
- [ ] Ajusta sugestões futuras
- [ ] Melhora `autonomyLevel` com acertos

---

## 🐛 Troubleshooting

### Ações não aparecem

1. Verifica se `coach.pendingActions` está populado
2. Verifica se `CoachActionApproval` está no Layout
3. Verifica console para erros de API

### Execução falha

1. Verifica se ação foi aprovada (`status === 'approved'`)
2. Verifica se tem recursos (EXP/BRO) para upgrades
3. Verifica se tem slots disponíveis para treinos

### Cards não desaparecem

1. Verifica se `COACH_EXECUTE_ACTION` foi chamado
2. Verifica se status mudou para `executed`
3. Chama `COACH_CLEAR_EXECUTED_ACTIONS` manualmente

---

Sistema **100% funcional** e integrado! O coach pode agora sugerir e executar ações diretamente no chat com aprovação do manager.
