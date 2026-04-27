# OLEFOOT — Auditoria Técnica do Sistema de Comando de Voz (Parte 1)

**Data:** 2026-04-25  
**Escopo:** Captura de voz → Transcrição → Compreensão → Envio ao jogador  
**Status:** ✅ Sistema funcional, melhorias identificadas

---

## 1. ARQUITETURA ATUAL

### 1.1 Fluxo Completo (Voice Pipeline)

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. CAPTURA DE VOZ (Web Speech API)                                 │
│    • Push-to-talk (segura mic, solta → transcreve)                 │
│    • Máximo 5s por captura                                          │
│    • Hook: useVoiceRecognition.ts                                   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 2. TRANSCRIÇÃO (Browser nativo)                                    │
│    • Web Speech API (Chrome/Edge/Safari)                            │
│    • Lang: pt-BR                                                    │
│    • Retorna: transcript final + confidence                         │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 3. FILTRO DE PROFANIDADE                                            │
│    • profanityFilter.ts — lista PT-BR base + Supabase override      │
│    • 1ª detecção → AVISO árbitro                                    │
│    • 2ª detecção → VERMELHO no melhor jogador                       │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 4. PARSER DE INTENT (100% determinístico, sem LLM)                 │
│    • intentMatcher.ts — 60+ intents mapeados                        │
│    • Regex + keywords + stem PT → ParsedCommand[]                   │
│    • Resolve alvo: @jogador, #setor, camisa, role, ball_carrier    │
│    • Suporta comandos compostos: "pressiona alto e cruza mais"      │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 5. RELAY POR ASSISTENTE (filtro de eficácia)                       │
│    • assistantRelay.ts — cada intent → assistente responsável       │
│    • Eficácia 0-100 multiplica obediência individual                │
│    • Qualidade: clean / basic / partial_loss / distorted            │
│    • Distorted <40% → 40% chance de comando se perder               │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 6. OBEDIÊNCIA (3 camadas multiplicativas)                          │
│    • obedienceRoll.ts                                               │
│    • Team obedience (30-100, evolui com uso)                        │
│    • Individual obedience (skill match + confiança + fadiga)        │
│    • Assistant effectiveness (relay quality)                        │
│    • Output: effectiveObedience → ObedienceTier                     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 7. DISPATCH → FILA DO JOGADOR                                      │
│    • reducer.ts: VOICE_COMMAND_ISSUED                               │
│    • Injeta PendingCommand em liveMatch.voiceCommands[playerId]     │
│    • TacticalSimLoop lê antes do brain default                      │
│    • Aplica overrides: posição + decisão (commandQueue.ts)          │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 8. EXECUÇÃO NO MOTOR TÁTICO                                        │
│    • tacticalPositioning.ts — position override                     │
│    • OnBallDecision.ts — decision bias (shootBoost, dribbleBoost)  │
│    • Duração: 3s-30s (INTENT_DURATION_MS)                           │
│    • Expira → volta ao comportamento default                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. COMPONENTES PRINCIPAIS

### 2.1 Frontend (React)

| Arquivo | Responsabilidade | Status |
|---------|------------------|--------|
| `VoiceCommandPanel.tsx` | UI principal: mic + input + feedback | ✅ Funcional |
| `useVoiceRecognition.ts` | Hook Web Speech API (push-to-talk) | ✅ Funcional |
| `useAudioWaveform.ts` | Waveform visual durante captura | ✅ Funcional |
| `intentMatcher.ts` | Parser determinístico (regex + stem) | ✅ Funcional |
| `profanityFilter.ts` | Filtro de palavrões PT-BR | ✅ Funcional |
| `assistantRelay.ts` | Relay por assistente técnico | ✅ Funcional |
| `obedienceRoll.ts` | Cálculo de obediência (3 camadas) | ✅ Funcional |
| `commandQueue.ts` | Helpers de fila + overrides | ✅ Funcional |
| `managerCommandBus.ts` | Bridge UI táctil ↔ voz | ✅ Funcional |
| `learnedPhrases.ts` | Dicionário aprendido (user-specific) | ✅ Funcional |
| `intentGuess.ts` | Fallback: "você quis dizer…?" | ✅ Funcional |
| `mentions.ts` | Autocomplete @jogador #setor | ✅ Funcional |

### 2.2 Backend (Hono)

**Observação crítica:** Não encontrei integração backend para transcrição de voz.

- ❌ Nenhum endpoint `/transcribe` ou `/voice` no servidor Hono
- ❌ Nenhuma chamada OpenAI Whisper ou serviço de transcrição
- ✅ Sistema usa **Web Speech API nativa do browser** (Chrome/Edge/Safari)

**Implicação:** A transcrição é 100% client-side, sem custo de API, mas limitada à qualidade do browser.

---

## 3. PONTOS FORTES DO SISTEMA ATUAL

### 3.1 Arquitetura Sólida

✅ **Separação de responsabilidades clara**  
- Parser isolado (testável, sem side-effects)
- Obediência em módulo puro (fórmulas matemáticas)
- UI desacoplada do motor tático

✅ **Sistema de aprendizagem inteligente**  
- `learnedPhrases.ts` — usuário confirma "você quis dizer X?" → próxima vez resolve direto
- Sincroniza com Supabase (cross-device)
- Stem-based matching (cobre conjugações)

✅ **Feedback rico na UI**  
- 📨 ENVIADO → ✅ Aceito / ❌ Recusado
- Bolhas de resposta nos jogadores (`PlayerResponseBubble.tsx`)
- Cooldown visível (25s entre comandos)
- Waveform ao vivo durante captura

✅ **Assistentes técnicos como filtro**  
- Eficácia do staff multiplica obediência
- Relay quality: clean/basic/partial_loss/distorted
- Narrativa no feed ("Aux. Tático: 'Entendi — pressiona alto'. Equipe, vai!")

✅ **Obediência evolutiva**  
- Team obedience 30→100 (cresce com uso, decai em partidas mudas)
- Individual: skill match + confiança + fadiga + relação com manager
- Tier visual: DEIXA COMIGO / Vou fazer / Vou tentar / Tá difícil / NÃO POSSO

### 3.2 Parser Robusto

✅ **60+ intents mapeados** (individual, coletivo, criativo, tático)  
✅ **Comandos compostos** ("pressiona alto e cruza mais" → 2 ParsedCommand)  
✅ **Resolução de alvo flexível**  
- Nome fuzzy: "adri" → "Adrien Ayo"
- Camisa: "número 10", "camisa 7"
- Role: "atacantes", "meias", "zagueiros"
- Setor: "@ahmad", "#ataque", "#defesa"
- Ball carrier: "o portador da bola"

✅ **Fallback inteligente**  
- Stem-based (cobre conjugações: "chuta/chutou/chutar" → "chut")
- Guess + confirmação ("você quis dizer FINALIZAR?")
- Aprendizagem persistente (Supabase)

---

## 4. PROBLEMAS IDENTIFICADOS

### 4.1 🔴 CRÍTICO: Dependência do Web Speech API

**Problema:**  
O sistema usa `window.SpeechRecognition` (Chrome/Edge) ou `window.webkitSpeechRecognition` (Safari), que:

1. **Não funciona offline** — requer conexão com servidores Google/Apple
2. **Qualidade inconsistente** — depende do modelo de transcrição do browser
3. **Suporte limitado:**
   - ✅ Chrome/Edge (desktop + Android)
   - ✅ Safari (iOS 14.5+, macOS Big Sur+)
   - ❌ Firefox (não suporta)
   - ❌ Browsers antigos

**Impacto:**  
- Usuários Firefox não conseguem usar voz
- Qualidade de transcrição varia entre browsers
- Sem controle sobre erros de transcrição (ex: "chuta" → "xuta")

**Solução proposta:**  
Implementar fallback híbrido:
- **Primário:** Web Speech API (zero custo, latência baixa)
- **Fallback:** Backend com OpenAI Whisper (quando Web Speech falha ou não suportado)

---

### 4.2 🟡 MÉDIO: Parser determinístico limita flexibilidade

**Problema:**  
O parser usa regex + keywords fixos. Frases fora do padrão não são reconhecidas:

```typescript
// ✅ Funciona
"Adrien invade a área"
"Pressiona alto"
"Chuta"

// ❌ Não funciona (mas deveria)
"Adrien vai pra frente e finaliza"  // "vai pra frente" não está mapeado
"Bota pressão neles"                 // "bota pressão" não é "pressiona"
"Manda bala"                         // gíria não mapeada
```

**Impacto:**  
- Usuário precisa aprender frases específicas
- Comandos naturais falham
- Sistema de "guess" ajuda, mas requer confirmação manual

**Solução proposta:**  
Camada híbrida:
1. **Parser determinístico** (atual) — rápido, zero custo, cobre 80% dos casos
2. **LLM fallback** (OpenAI GPT-4o-mini) — quando parser falha, envia pro backend:
   ```
   User: "Adrien vai pra frente e finaliza"
   LLM: { intent: "invade_box", target: "Adrien" } + { intent: "take_shot", target: "Adrien" }
   ```
3. **Aprendizagem automática** — LLM resolve → salva em `learnedPhrases` → próxima vez parser resolve direto

---

### 4.3 🟡 MÉDIO: Sem validação de contexto tático

**Problema:**  
O parser aceita qualquer comando, mesmo se taticamente inválido:

```typescript
// ✅ Parser aceita, mas é burrice tática
"Goleiro invade a área"              // GK não deve invadir
"Zagueiro dribla"                    // DEF tem drible baixo
"Atacante marca o 10"                // ATK longe do adversário
```

**Impacto:**  
- Jogador rola obediência baixa (skill mismatch)
- Comando é recusado, mas usuário não entende POR QUÊ
- Feedback genérico: "Tá difícil..." (não explica o problema)

**Solução proposta:**  
Validação pré-dispatch:
1. **Skill check** — se `skillMatch < 30`, bloqueia e explica:
   ```
   "❌ Goleiro não tem skill pra invadir a área (drible 12)"
   ```
2. **Context check** — se jogador está longe/sem bola/fora de posição:
   ```
   "❌ Atacante está no meio-campo, não pode marcar o 10 adversário"
   ```
3. **Sugestão alternativa:**
   ```
   "💡 Tenta: 'Zagueiro marca o 10' (skill 85)"
   ```

---

### 4.4 🟡 MÉDIO: Cooldown global penaliza comandos táticos

**Problema:**  
Cooldown de 25s é **global** — bloqueia QUALQUER comando, mesmo se for pra jogador diferente:

```typescript
// Cenário real:
00:00 → "Adrien invade a área" ✅
00:05 → "Gui cruza a bola" ❌ BLOQUEADO (cooldown 20s restantes)
```

**Impacto:**  
- Manager não consegue dar múltiplos comandos rápidos (ex: "invade" + "cruza" + "chuta")
- Comandos coletivos ("pressiona alto") bloqueiam comandos individuais por 25s
- Sensação de sistema travado

**Solução proposta:**  
Cooldown **por jogador** + cooldown coletivo separado:

```typescript
// Cooldown individual: 8s por jogador
// Cooldown coletivo: 25s (team-wide commands)

00:00 → "Adrien invade a área" ✅ (cooldown Adrien: 8s)
00:03 → "Gui cruza a bola" ✅ (cooldown Gui: 8s)
00:05 → "Adrien chuta" ❌ BLOQUEADO (cooldown Adrien: 3s restantes)
00:10 → "Pressiona alto" ✅ (cooldown coletivo: 25s)
00:12 → "Adrien chuta" ✅ (cooldown individual expirou)
00:15 → "Recua" ❌ BLOQUEADO (cooldown coletivo: 20s restantes)
```

---

### 4.5 🟢 BAIXO: Sem feedback de execução em tempo real

**Problema:**  
Após aceitar o comando, jogador some na multidão — manager não sabe se ele está EXECUTANDO:

```typescript
// Fluxo atual:
1. "Adrien invade a área" → ✅ "DEIXA COMIGO!"
2. [silêncio por 8s]
3. ??? Adrien está invadindo? Desistiu? Perdeu a bola?
```

**Impacto:**  
- Manager não sabe se comando está ativo
- Sem feedback visual contínuo (só bolha inicial)
- Difícil debugar se comando não funcionou

**Solução proposta:**  
Indicador visual persistente:
1. **Ícone flutuante no jogador** (enquanto `PendingCommand` ativo)
   ```
   🎯 [8s] ← contador regressivo
   ```
2. **Trail colorido** (caminho do jogador enquanto executa)
3. **Resolução final:**
   ```
   ✅ "Adrien invadiu a área e finalizou!"
   ❌ "Adrien perdeu a bola antes de invadir"
   ```

---

### 4.6 🟢 BAIXO: Mentions (@jogador #setor) não são intuitivos

**Problema:**  
Sistema de mentions existe (`mentions.ts`), mas:
- Não há tutorial in-game
- Placeholder genérico: `"Digita @jogador, #setor ou comando"`
- Usuário não descobre sozinho

**Impacto:**  
- Feature poderosa sub-utilizada
- Usuário digita "passa pro Ahmad" em vez de "@ahmad passa"

**Solução proposta:**  
1. **Tooltip interativo** (primeira vez que abre o painel)
2. **Sugestões contextuais:**
   ```
   [Bola com Adrien]
   💡 Tenta: "@gui passa" ou "#ataque pressiona"
   ```
3. **Autocomplete agressivo** (mostra dropdown ao digitar '@' ou '#')

---

## 5. MELHORIAS TÉCNICAS PROPOSTAS

### 5.1 Backend: Endpoint de Transcrição (Whisper)

**Objetivo:** Fallback quando Web Speech API falha ou não suportado.

**Implementação:**

```typescript
// server/src/routes/voice.ts
import { Hono } from 'hono';
import OpenAI from 'openai';

const voice = new Hono();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

voice.post('/transcribe', async (c) => {
  const formData = await c.req.formData();
  const audio = formData.get('audio') as File;
  
  if (!audio) {
    return c.json({ error: 'No audio file' }, 400);
  }

  try {
    const transcription = await openai.audio.transcriptions.create({
      file: audio,
      model: 'whisper-1',
      language: 'pt',
      response_format: 'json',
    });

    return c.json({
      transcript: transcription.text,
      confidence: 0.95, // Whisper não retorna confidence, usar fixo
    });
  } catch (err) {
    console.error('[voice] Whisper error:', err);
    return c.json({ error: 'Transcription failed' }, 500);
  }
});

export default voice;
```

**Frontend (useVoiceRecognition.ts):**

```typescript
// Adicionar fallback Whisper quando Web Speech falha
const fallbackToWhisper = async (audioBlob: Blob) => {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'command.webm');
  
  const res = await fetch('/api/voice/transcribe', {
    method: 'POST',
    body: formData,
  });
  
  if (!res.ok) throw new Error('Whisper failed');
  const { transcript, confidence } = await res.json();
  return { transcript, confidence };
};
```

**Custo estimado:**  
- Whisper: $0.006 / minuto
- Comando médio: 3s → $0.0003 por comando
- 1000 comandos/mês → $0.30

---

### 5.2 Backend: LLM Intent Parser (GPT-4o-mini)

**Objetivo:** Fallback quando parser determinístico falha.

**Implementação:**

```typescript
// server/src/routes/voice.ts
voice.post('/parse-intent', async (c) => {
  const { transcript, context } = await c.req.json();
  
  const prompt = `
Você é um parser de comandos de voz para um jogo de futebol.
Traduza a frase do usuário em intents estruturados.

INTENTS DISPONÍVEIS:
- invade_box, dribble_attempt, take_shot, cross_ball, pass_to_player
- team_press_high, team_retreat, team_hold_possession
- break_line, run_behind, free_play
- player_substitution, formation_change
(lista completa: 60+ intents)

CONTEXTO:
Jogadores em campo: ${context.players.map(p => `${p.name} (#${p.num})`).join(', ')}
Portador da bola: ${context.ballCarrier ?? 'nenhum'}

FRASE DO USUÁRIO:
"${transcript}"

RESPONDA EM JSON:
{
  "commands": [
    { "intent": "invade_box", "target": "Adrien" },
    { "intent": "take_shot", "target": "ball_carrier" }
  ]
}
`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  const parsed = JSON.parse(completion.choices[0].message.content);
  return c.json(parsed);
});
```

**Custo estimado:**  
- GPT-4o-mini: $0.150 / 1M input tokens, $0.600 / 1M output tokens
- Prompt médio: 500 tokens input + 50 tokens output → $0.00010 por comando
- 1000 comandos/mês → $0.10

---

### 5.3 Frontend: Cooldown por Jogador

**Implementação:**

```typescript
// VoiceCommandPanel.tsx
const [cooldownByPlayer, setCooldownByPlayer] = useState<Record<string, number>>({});
const [cooldownTeam, setCooldownTeam] = useState<number>(0);

const INDIVIDUAL_COOLDOWN_MS = 8_000;  // 8s por jogador
const TEAM_COOLDOWN_MS = 25_000;       // 25s coletivo

// Ao emitir comando individual:
if (tgt.kind === 'player_id') {
  const lastCmd = cooldownByPlayer[tgt.playerId] ?? 0;
  const cooldownLeft = INDIVIDUAL_COOLDOWN_MS - (now - lastCmd);
  if (cooldownLeft > 0) {
    addFeedback({
      kind: 'error',
      message: `⏱ ${player.name} aguarda ${Math.ceil(cooldownLeft / 1000)}s`,
    });
    return;
  }
  setCooldownByPlayer(prev => ({ ...prev, [tgt.playerId]: now }));
}

// Ao emitir comando coletivo:
if (tgt.kind === 'team') {
  const cooldownLeft = TEAM_COOLDOWN_MS - (now - cooldownTeam);
  if (cooldownLeft > 0) {
    addFeedback({
      kind: 'error',
      message: `⏱ Comando coletivo aguarda ${Math.ceil(cooldownLeft / 1000)}s`,
    });
    return;
  }
  setCooldownTeam(now);
}
```

---

### 5.4 Frontend: Indicador Visual de Execução

**Implementação:**

```typescript
// PlayerResponseBubble.tsx — adicionar ícone persistente
{isCommandActive(player.pendingCommand, world.simTime) && (
  <motion.div
    className="absolute -top-8 left-1/2 -translate-x-1/2"
    animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
    transition={{ repeat: Infinity, duration: 1.5 }}
  >
    <div className="rounded-full bg-cyan-500/90 px-2 py-1 text-[9px] font-black text-black">
      🎯 {Math.ceil((player.pendingCommand.expiresAt - world.simTime) / 1000)}s
    </div>
  </motion.div>
)}
```

---

### 5.5 Frontend: Validação Pré-Dispatch

**Implementação:**

```typescript
// VoiceCommandPanel.tsx — antes de dispatch
const validateCommand = (cmd: ParsedCommand, player: PitchPlayerState) => {
  const skillMatch = computeSkillMatch(cmd.intent, player);
  
  if (skillMatch < 30) {
    return {
      valid: false,
      reason: `${player.name} não tem skill pra ${intentLabelPt(cmd.intent)} (skill ${Math.round(skillMatch)})`,
      suggestion: null,
    };
  }
  
  // Context checks
  if (cmd.intent === 'take_shot' && player.x < 50) {
    return {
      valid: false,
      reason: `${player.name} está longe do gol (campo defensivo)`,
      suggestion: 'Tenta: "invade a área" primeiro',
    };
  }
  
  return { valid: true };
};

// Uso:
const validation = validateCommand(cmd, player);
if (!validation.valid) {
  addFeedback({
    kind: 'error',
    message: `❌ ${validation.reason}`,
    detail: validation.suggestion ?? undefined,
  });
  return;
}
```

---

## 6. RESUMO EXECUTIVO

### Status Atual: ✅ FUNCIONAL (80% completo)

**Pontos fortes:**
- Arquitetura sólida e testável
- Parser robusto (60+ intents)
- Sistema de aprendizagem inteligente
- Feedback rico na UI
- Obediência evolutiva (30→100%)

**Limitações críticas:**
1. 🔴 Dependência do Web Speech API (não funciona Firefox, offline)
2. 🟡 Parser determinístico limita flexibilidade
3. 🟡 Sem validação de contexto tático
4. 🟡 Cooldown global penaliza comandos rápidos

**Melhorias prioritárias (Parte 2):**
1. Backend Whisper (fallback transcrição)
2. Backend LLM parser (fallback intent)
3. Cooldown por jogador
4. Validação pré-dispatch
5. Indicador visual de execução

**Custo estimado das melhorias:**
- Whisper: $0.30/mês (1000 comandos)
- GPT-4o-mini: $0.10/mês (1000 comandos)
- **Total: ~$0.40/mês** (desprezível)

---

**Próximo passo:** Parte 2 — Implementação das melhorias + integração com motor tático.
