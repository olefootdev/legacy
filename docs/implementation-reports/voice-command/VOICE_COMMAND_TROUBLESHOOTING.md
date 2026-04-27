# 🔧 TROUBLESHOOTING: Sistema de Comandos de Voz

## ❌ PROBLEMA: "Não está funcionando"

Este guia ajuda a identificar e resolver problemas com o sistema de comandos de voz.

---

## 🔍 DIAGNÓSTICO PASSO A PASSO

### **1. Verificar se o Componente Está Renderizado**

Abra o DevTools (F12) → Elements → Procure por:
```html
<div class="...">
  <input type="text" placeholder="@ jogador | @@ setor..." />
  <button><!-- Microfone --></button>
</div>
```

**Se NÃO encontrar:**
- ❌ O componente `CoachCommandInput` não está sendo renderizado
- ✅ **Solução:** Adicionar o componente na página de partida

---

### **2. Verificar Permissão de Microfone**

**Sintomas:**
- Botão de microfone amarelo pulsante
- Ao clicar, nada acontece
- Console mostra: "Permissão de microfone negada"

**Solução:**
1. Clicar no ícone de **cadeado** na barra de endereço
2. Procurar "Microfone"
3. Mudar para "Permitir"
4. Recarregar a página

**Teste rápido:**
```javascript
// Cole no console do DevTools:
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(() => console.log('✅ Microfone OK'))
  .catch(err => console.error('❌ Erro:', err));
```

---

### **3. Verificar Web Speech API**

**Sintomas:**
- Botão de microfone cinza (desabilitado)
- Mensagem: "Browser não suporta voz"

**Solução:**
- ✅ **Chrome/Edge:** Suportado
- ✅ **Safari (iOS 14.5+):** Suportado
- ❌ **Firefox:** Não suportado nativamente

**Teste rápido:**
```javascript
// Cole no console:
console.log('SpeechRecognition:', 
  'SpeechRecognition' in window || 
  'webkitSpeechRecognition' in window ? '✅' : '❌'
);
```

---

### **4. Verificar Conexão com Supabase**

**Sintomas:**
- Comando não é reconhecido
- Console mostra: "Erro ao buscar na biblioteca"

**Solução:**
```javascript
// Cole no console:
import { getSupabase } from '@/supabase/client';
const sb = getSupabase();
if (sb) {
  sb.from('learned_phrases').select('*').limit(1)
    .then(r => console.log('✅ Supabase OK:', r))
    .catch(e => console.error('❌ Erro:', e));
} else {
  console.error('❌ Supabase não configurado');
}
```

**Se falhar:**
1. Verificar arquivo `.env`:
   ```
   VITE_SUPABASE_URL=https://...
   VITE_SUPABASE_ANON_KEY=...
   ```
2. Reiniciar servidor: `npm run dev`

---

### **5. Verificar Biblioteca de Comandos**

**Sintomas:**
- Comando não é reconhecido
- Mensagem: "❌ Não entendi..."

**Solução:**
1. Abrir `/admin` → "Vocabulário de Futebol"
2. Verificar se há comandos cadastrados
3. Testar reconhecimento no painel

**Se biblioteca estiver vazia:**
```sql
-- Adicionar comandos básicos no Supabase:
INSERT INTO learned_phrases (phrase, intent, canonical_phrase, confidence, is_active)
VALUES 
  ('chuta', 'take_shot', 'chuta', 1.0, true),
  ('manda bala', 'take_shot', 'chuta', 0.95, true),
  ('passa', 'pass_to_player', 'passa', 1.0, true),
  ('dribla', 'dribble_attempt', 'dribla', 1.0, true),
  ('pressiona', 'team_press_high', 'pressiona alto', 1.0, true);
```

---

### **6. Verificar Props do Componente**

**Sintomas:**
- Comando é reconhecido mas não executa
- Console mostra: "undefined is not a function"

**Verificar se props estão corretas:**
```typescript
<CoachCommandInput
  players={liveMatch.homePlayers}           // ✅ Array de jogadores
  playersById={playersById}                 // ✅ Record<string, PlayerEntity>
  ballCarrierId={liveMatch.ballCarrier?.playerId} // ✅ string | undefined
  side="home"                               // ✅ "home" | "away"
  minute={liveMatch.minute}                 // ✅ number
  teamObedience={tacticalObedience || 30}   // ✅ number (0-100)
  managerRelationByPlayer={managerRelationByPlayer || {}} // ✅ Record<string, number>
  onCommandExecuted={(result) => {          // ✅ função
    console.log('Comando executado:', result);
  }}
/>
```

---

### **7. Verificar Estado do Reducer**

**Sintomas:**
- Comando é reconhecido mas não aparece no jogo
- Jogador não responde

**Verificar estado no DevTools:**
```javascript
// Redux DevTools ou Zustand DevTools:
state.liveMatch.voiceCommands
// Deve ter: { "player_123": { intent: "take_shot", ... } }

state.tacticalObedience
// Deve ser número entre 30-100

state.liveMatch.events[0]
// Deve ter evento: "45' — Comando: 'chuta' → Adriano 'Vou fazer'"
```

**Se estado não atualiza:**
- ❌ Dispatch não está funcionando
- ✅ **Solução:** Verificar se `useGameDispatch()` está importado corretamente

---

### **8. Verificar Console de Erros**

Abra DevTools (F12) → Console → Procure por:

**Erros comuns:**

```
❌ "Cannot read property 'playerId' of undefined"
→ Jogador não encontrado no array players

❌ "rollObedience is not a function"
→ Importação incorreta de obedienceRoll.ts

❌ "processVoiceCommand is not a function"
→ Importação incorreta de voiceCommandProcessor.ts

❌ "Supabase client not initialized"
→ Variáveis de ambiente não configuradas

❌ "Web Speech API not supported"
→ Browser não suporta ou HTTPS necessário
```

---

## 🚀 TESTE RÁPIDO (5 Minutos)

### **Teste 1: Microfone**
1. Abrir `/match/live`
2. Clicar no botão de microfone
3. **Esperado:** Popup do browser pedindo permissão
4. Permitir
5. **Esperado:** Botão fica roxo

### **Teste 2: Transcrição**
1. Segurar botão de microfone
2. Falar: "teste"
3. Soltar botão
4. **Esperado:** Waveform animado + transcrição aparece

### **Teste 3: Comando Básico**
1. Segurar botão
2. Falar: "chuta"
3. Soltar
4. **Esperado:** Mensagem "✅ [Jogador] vai chutar"

### **Teste 4: Biblioteca**
1. Segurar botão
2. Falar: "manda bala"
3. Soltar
4. **Esperado:** Mensagem "✅ [Jogador] vai chutar (biblioteca)"

### **Teste 5: Dispatch**
1. Abrir DevTools → Console
2. Executar comando
3. **Esperado:** Ver log: `[reducer] VOICE_COMMAND_ISSUED`

---

## 🔧 SOLUÇÕES RÁPIDAS

### **Problema: Botão de microfone não aparece**
```typescript
// Verificar se componente está importado:
import { CoachCommandInput } from '@/components/matchday/CoachCommandInput';

// Verificar se está renderizado:
<CoachCommandInput
  players={players}
  playersById={playersById}
  // ... outras props
/>
```

### **Problema: Permissão negada**
```bash
# Testar em localhost (sempre permitido):
http://localhost:5173

# Ou em HTTPS:
https://seu-dominio.com
```

### **Problema: Biblioteca vazia**
```typescript
// Adicionar comandos via admin:
// 1. Abrir /admin
// 2. Clicar "Vocabulário de Futebol"
// 3. Adicionar comandos básicos
```

### **Problema: Dispatch não funciona**
```typescript
// Verificar se hook está importado:
import { useVoiceCommandDispatch } from '@/hooks/useVoiceCommandDispatch';

// Verificar se está sendo usado:
const { dispatchVoiceCommand } = useVoiceCommandDispatch();
```

### **Problema: Estado não atualiza**
```typescript
// Verificar se reducer tem o case:
case 'VOICE_COMMAND_ISSUED': {
  // ... código do reducer
}
```

---

## 📋 CHECKLIST DE VERIFICAÇÃO

- [ ] Componente `CoachCommandInput` está renderizado na página
- [ ] Botão de microfone está visível (não cinza)
- [ ] Permissão de microfone foi concedida (botão roxo)
- [ ] Web Speech API está disponível (Chrome/Edge/Safari)
- [ ] Supabase está configurado (variáveis de ambiente)
- [ ] Biblioteca de comandos tem entradas (admin)
- [ ] Props do componente estão corretas
- [ ] Hook `useVoiceCommandDispatch` está importado
- [ ] Reducer tem case `VOICE_COMMAND_ISSUED`
- [ ] Console não mostra erros

---

## 🆘 AINDA NÃO FUNCIONA?

### **Teste Mínimo (Sem Dependências):**

```typescript
// Cole no console do DevTools:
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'pt-BR';
recognition.onresult = (e) => {
  console.log('✅ Transcrição:', e.results[0][0].transcript);
};
recognition.start();
// Fale algo e veja se aparece no console
```

**Se isso funcionar:**
- ✅ Web Speech API está OK
- ❌ Problema está no código do componente

**Se isso NÃO funcionar:**
- ❌ Web Speech API não está disponível
- ✅ Usar outro browser (Chrome/Edge)

---

## 📞 INFORMAÇÕES PARA DEBUG

Ao reportar problema, incluir:

1. **Browser:** Chrome 120 / Safari 17 / Edge 120
2. **Sistema:** Windows 11 / macOS 14 / iOS 17
3. **URL:** localhost:5173 / https://...
4. **Erro no console:** (copiar mensagem completa)
5. **Estado do botão:** Cinza / Amarelo / Roxo / Vermelho
6. **Teste mínimo:** Funcionou? Sim / Não

---

## ✅ SISTEMA FUNCIONANDO

**Quando tudo estiver OK, você verá:**

1. ✅ Botão de microfone **roxo** (pronto)
2. ✅ Ao segurar: **waveform animado**
3. ✅ Ao falar: **transcrição em tempo real**
4. ✅ Ao soltar: **vibração + som + mensagem**
5. ✅ No console: **logs de processamento**
6. ✅ No estado: **voiceCommands atualizado**
7. ✅ No feed: **evento de comando**

**Pronto para usar!** 🚀
