# Sistema de Comandos de Voz - Implementação Completa

## Resumo

Sistema completo de reconhecimento de comandos de voz para partidas ao vivo, baseado no vocabulário do futebol brasileiro (725 verbetes).

## Componentes Implementados

### 1. Migração Supabase (`supabase/migrations/20260426_learned_phrases.sql`)

**Tabela `learned_phrases`:**
- Armazena frases do vocabulário mapeadas para `VoiceIntent`
- Campos: `phrase`, `intent`, `category`, `confidence`, `language`, `is_active`, `usage_count`
- Índices para performance em busca e filtragem
- RLS (Row Level Security) configurado
- **150+ frases pré-populadas** do vocabulário do futebol

**Funções SQL:**
- `search_learned_phrases()` - busca fuzzy com similaridade
- `increment_phrase_usage()` - contador de uso

**Exemplos de frases mapeadas:**
- "chuta", "finaliza", "enche o pé" → `take_shot`
- "dribla", "finta", "caneta" → `dribble_attempt`
- "cruza", "levanta", "chuveirinho" → `cross_ball`
- "pressiona alto", "sufoca" → `team_press_high`
- "quebra a linha", "vai pra pequena" → `break_line`

### 2. Painel Admin (`src/admin/panels/AdminVoiceLibraryPanel.tsx`)

**Funcionalidades:**
- ✅ Visualizar todas as frases da biblioteca
- ✅ Adicionar novas frases
- ✅ Editar frases existentes (phrase, intent, confidence)
- ✅ Excluir frases
- ✅ Ativar/desativar frases
- ✅ Busca por texto
- ✅ Filtro por Intent
- ✅ Filtro por Categoria
- ✅ Estatísticas: total, ativas, uso total, confiança média

**Localização:** `/admin#voiceLibrary`

### 3. Integração com Parser (`src/voiceCommand/phraseLibrary.ts`)

**API:**
```typescript
// Carrega biblioteca (cache 5min)
await loadPhraseLibrary()

// Busca melhor match (threshold 0.7)
const match = await matchPhrase("chuta forte")
// → { phrase: { intent: 'take_shot', ... }, similarity: 0.95 }

// Busca top N matches
const matches = await matchPhrases("finaliza", 3, 0.6)

// Incrementa contador de uso
await incrementPhraseUsage(phraseId)

// Busca por intent específico
const phrases = await getPhrasesByIntent('take_shot')
```

**Algoritmo de Matching:**
- Normalização: lowercase, remove acentos
- Levenshtein distance para similaridade
- Ajuste pela confiança da frase
- Threshold configurável (padrão 0.7)

### 4. Integração no Admin Dashboard

**Nova aba adicionada:**
- Seção: "IA & Moderação"
- Aba: "Biblioteca de Voz"
- Hash: `#voiceLibrary`

## Como Usar

### 1. Aplicar Migração

```bash
# Via Supabase CLI
supabase db push

# Ou via painel Supabase
# SQL Editor → colar conteúdo de 20260426_learned_phrases.sql
```

### 2. Acessar Painel Admin

```
https://seu-dominio.com/admin#voiceLibrary
```

### 3. Integrar no Parser de Voz

```typescript
import { matchPhrase, incrementPhraseUsage } from '@/voiceCommand/phraseLibrary';

// No parser de voz
async function parseVoiceCommand(transcript: string) {
  // Tenta match com biblioteca
  const match = await matchPhrase(transcript, 0.7);
  
  if (match) {
    // Incrementa contador
    await incrementPhraseUsage(match.phrase.id);
    
    // Retorna intent
    return {
      intent: match.phrase.intent,
      confidence: match.similarity,
      phrase: match.phrase.phrase,
    };
  }
  
  // Fallback para parser determinístico
  return parseWithRegex(transcript);
}
```

## Vocabulário Implementado

**Categorias:**
- Individual Ofensivo: chute, drible, passe, cruzamento
- Individual Defensivo: marcação, desarme, falta tática
- Coletivo: pressão, recuo, posse, linha alta
- Criativo: quebra linha, corre por trás, acelera
- Físico/Mental: poupa, acalma

**Variações Regionais:**
- "bica", "bicuda", "petardo" → chute
- "caneta", "chapéu", "elástico" → drible
- "açúcar", "bandeja" → passe

## Estatísticas

- **725 verbetes** do vocabulário do futebol
- **150+ frases** pré-populadas na migração
- **40+ VoiceIntent** suportados
- **5 categorias** de comandos

## Próximos Passos

1. ✅ Migração aplicada
2. ✅ Painel Admin funcional
3. ✅ API de matching implementada
4. ⏳ Integrar com parser de voz existente
5. ⏳ Testes com usuários reais
6. ⏳ Ajustar thresholds baseado em feedback

## Arquivos Criados/Modificados

**Criados:**
- `supabase/migrations/20260426_learned_phrases.sql`
- `src/admin/panels/AdminVoiceLibraryPanel.tsx`
- `src/voiceCommand/phraseLibrary.ts`
- `scripts/extractPdfText.cjs` (utilitário)

**Modificados:**
- `src/admin/AdminDashboard.tsx` (nova aba)

## Notas Técnicas

- Cache de 5 minutos para evitar queries repetidas
- Levenshtein distance para fuzzy matching
- Confiança ajustável por frase (0.0 - 1.0)
- RLS configurado (apenas admins editam)
- Índices otimizados para busca
