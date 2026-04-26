# Sistema de Comandos Táticos — Live Match

**Localização**: Partida ao vivo → Painel "Comandos Táticos"

## 📋 Sintaxe de Comandos

### 1. **Comunicação com Jogadores**

#### `@nome` — Falar com jogador específico
```
@adriano mantenha a posição
@silva pressiona o lateral
@roberto recua pra defesa
```

**Autocomplete**: Digite `@` e comece a escrever o nome — sugestões aparecem automaticamente.

#### `@@setor` — Falar com setor do time
```
@@defesa segura a linha
@@meio controla o jogo
@@ataque pressão alta
```

**Setores disponíveis**:
- `defesa` / `def` / `zag` → zagueiros + laterais
- `meio` / `mei` / `vol` / `mc` → meio-campo
- `ataque` / `ata` / `pont` → atacantes + pontas
- `gol` → goleiro

#### `@@@mensagem` — Falar com todo o time
```
@@@pressão alta agora
@@@segura o resultado
@@@vamos buscar o empate
```

### 2. **Ativação de Skills**

#### `/skill` — Ativar skill (todos que têm equipada)
```
/sobreposicao
/pressaoalta
/bloqueio
```

**Autocomplete**: Digite `/` e comece a escrever — lista de skills disponíveis aparece.

#### `@nome /skill` — Ativar skill em jogador específico
```
@adriano /invadirarea
@silva /sobreposicao
@roberto /marcacaoindividual
```

**Autocomplete duplo**:
1. Digite `@nome` → autocomplete de jogadores
2. Digite `/` → autocomplete de skills **equipadas naquele jogador**

## 🎮 Exemplos Práticos

### Cenário 1: Lateral precisa avançar
```
@adriano /sobreposicao
```
- Ativa a skill "Sobreposição Ofensiva" no Adriano
- Ele avança até linha de fundo e cruza na área
- Atacantes recebem boost de posicionamento (+20%)

### Cenário 2: Defesa está desorganizada
```
@@defesa segura a linha
```
- Mensagem enviada para todos os defensores
- Afeta mentalidade/confiança do setor

### Cenário 3: Time precisa pressionar
```
@@@pressão alta agora
```
- Mensagem para todo o time
- Todos os jogadores recebem a instrução

### Cenário 4: Ativar skill em múltiplos jogadores
```
/pressaoalta
```
- Todos os jogadores que têm a skill "Pressão Alta" equipada ativam simultaneamente

## ✅ Validações

### Skill só ativa se:
1. **Jogador tem a skill equipada** (configurado no Admin → Skills)
2. **Skill não está em cooldown** (cada skill tem tempo de recarga)
3. **Jogador tem energia suficiente** (fadiga < 90%)

### Mensagens de erro:
- `Jogador "nome" não encontrado` → nome digitado incorreto
- `Skill não equipada` → jogador não tem essa skill
- `Nenhum jogador tem a skill equipada` → skill não disponível no time

## 🔧 Configuração de Skills

Para equipar skills nos jogadores:

1. Acesse `/admin` → tab **"Skills"**
2. Selecione o jogador
3. Clique em **"Equipar"** na skill desejada (máximo 3 por jogador)

### Skill Disponível: "Sobreposição Ofensiva"
- **Posição**: Lateral direito/esquerdo
- **Requer**: Velocidade 70, Passe 65, Físico 60
- **Efeitos**:
  - +30% precisão de cruzamento
  - +25% intensidade de sprint
  - +20% posicionamento de atacantes na área (efeito em companheiros)
- **Cooldown**: 15 segundos

## 🎯 Feedback Visual

Após enviar comando:
- ✅ **Sucesso**: Mensagem verde com confirmação
- ❌ **Erro**: Mensagem vermelha com motivo
- ⚡ **Skill ativada**: Ícone de raio amarelo + nome da skill

## 🚀 Próximas Features

- [ ] Cooldown visual das skills (timer)
- [ ] Indicador de energia do jogador
- [ ] Histórico de comandos enviados
- [ ] Resposta do jogador (aceita/rejeita baseado em mentalidade)
- [ ] Efeito visual no campo quando skill ativa
- [ ] Notificação quando skill sai do cooldown

## 📊 Integração com Match Engine

**Status atual**: Comandos são parseados e validados, mas ainda não afetam o jogo ao vivo.

**Próximo passo**: Integrar `executeCoachCommand()` no `TacticalSimLoop.ts` para que:
1. Skills modifiquem behaviors em tempo real
2. Mensagens afetem mentalidade/confiança
3. Cooldowns sejam respeitados
4. Efeitos visuais apareçam no campo

---

**Arquivos criados**:
- `/src/match/coachCommands.ts` — parser + executor de comandos
- `/src/components/matchday/CoachCommandInput.tsx` — UI com autocomplete
- Integrado em `LiveMatchManagerPanel.tsx`
