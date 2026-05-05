# Olefoot — Regras invioláveis

> Leia antes de qualquer implementação.
> Se uma instrução do usuário conflitar com estas regras, sinalize antes de agir.

---

## Regras absolutas (nunca viole)

### Estrutura
- Todo código novo vai dentro de `/agents` e suas subpastas
- Não modifique código fora de `/agents` sem autorização explícita
- Não delete arquivos existentes — crie versões novas se necessário
- Não integre com sistemas legados durante a construção do core

### Tick loop
- A ordem `perceive → decide → validate → execute` é imutável
- `MatchFieldContext.updateTick()` é chamado **uma única vez por tick**, antes de todos os agentes
- Nenhum agente age sem passar por `queryForAgent()` e `validateTarget()`
- Não adicione randomness no decision engine — o sistema é determinístico

### Coordenadas
- Nunca hardcode pixels ou coordenadas fixas
- Use sempre `fieldWidth` e `fieldHeight` como referência
- Zonas são definidas por porcentagem do campo, nunca por valor absoluto

### Identidade tática
- `PlayerIdentityContext` **veta** ações proibidas — não apenas sugere
- Se `forbiddenZones` inclui a zona atual do target, a ação é bloqueada sem exceção
- `shouldIgnoreBall: true` no queryForAgent significa que o agente **ignora** ballPosition naquele tick

### Separação de responsabilidades
- `FieldKnowledge` valida território — não decide intenções
- `AgentDecision` decide intenção — não conhece o campo diretamente
- `PlayerAgent` orquestra — não contém lógica de negócio
- `MatchFieldContext` mantém estado — não executa ações

---

## O que nunca criar

- UI, canvas, elementos visuais de qualquer tipo dentro de `/agents`
- Chamadas para `GameSpirit` dentro dos agentes
- Lógica centralizada que controla múltiplos agentes ao mesmo tempo
- Scripts que "corrigem" a posição dos jogadores externamente
- Randomness no decision engine (ruído no archetype é permitido, mas como modificador de threshold, não como rolagem)

---

## Soft territory — como implementar corretamente

```
// ERRADO — hard clamp
target = clamp(target, primaryZone.bounds)

// CERTO — soft intelligence
if (distanceFromPrimaryZone < softThreshold) {
  // permitir movimento normalmente
} else if (distanceFromPrimaryZone < hardThreshold) {
  // redirecionar suavemente em direção ao recoveryTarget
} else {
  // ignorar intenção original, mover para recoveryTarget
}
```

A diferença entre soft e hard clamp é o que separa movimento robótico de movimento inteligente.

---

## Como tratar phase-aware zones

```
// ERRADO — mesmas zonas sempre
allowedZones = player.context.primaryZone + player.context.secondaryZone

// CERTO — zonas mudam conforme a fase
if (phase === 'POSSESSION') {
  allowedZones = [...primaryZones, ...supportZones, ...expansionZones]
} else if (phase === 'DEFENDING') {
  allowedZones = [...primaryZones] // apenas território primário
} else if (phase === 'TRANSITION_DEFENSE') {
  allowedZones = [...primaryZones, ...recoveryPath]
}
```

---

## Ao final de cada sessão

Obrigatório antes de encerrar:

1. Atualizar `ARCHITECTURE.md` com o que foi implementado
2. Mover itens de "não implementado" para "implementado" ou "incompleto"
3. Registrar a sessão em `SESSION_LOG.md` com:
   - O que foi criado/modificado
   - Problemas encontrados e como foram resolvidos
   - O que ficou pendente
   - O que a próxima sessão deve implementar primeiro

---

## Checklist antes de criar qualquer arquivo

- [ ] Verifiquei que este arquivo não existe ainda (checar ARCHITECTURE.md)
- [ ] O arquivo vai dentro de `/agents` ou subpasta
- [ ] A responsabilidade deste arquivo não pertence a um módulo existente
- [ ] O arquivo tem uma única responsabilidade clara
- [ ] Não estou hardcodando coordenadas
- [ ] Não estou misturando responsabilidades de módulos diferentes
