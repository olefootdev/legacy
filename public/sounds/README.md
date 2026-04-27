# Arquivos de Som para Comandos de Voz

Este diretório contém os arquivos de áudio para feedback de comandos de voz.

## Arquivos Necessários

Os seguintes arquivos devem ser adicionados a este diretório:

### 1. `voice_sent.mp3`
- **Duração:** ~100ms
- **Descrição:** Som curto e discreto quando comando é enviado
- **Referência:** Som de "whoosh" suave ou "pop" leve
- **Volume:** Moderado (0.4)

### 2. `voice_success.mp3`
- **Duração:** ~200ms
- **Descrição:** Som de confirmação quando comando é executado com sucesso
- **Referência:** Som de "ding" positivo ou "chime" ascendente
- **Volume:** Moderado (0.4)

### 3. `voice_error.mp3`
- **Duração:** ~150ms
- **Descrição:** Som de erro quando comando falha
- **Referência:** Som de "buzz" curto ou "beep" descendente
- **Volume:** Moderado (0.4)

### 4. `voice_processing.mp3`
- **Duração:** ~80ms
- **Descrição:** Som muito curto ao iniciar processamento
- **Referência:** Som de "tick" ou "click" suave
- **Volume:** Baixo (0.3)

## Como Gerar os Sons

### Opção 1: Usar Biblioteca de Sons Gratuitos
- [Freesound.org](https://freesound.org/)
- [Zapsplat.com](https://www.zapsplat.com/)
- Buscar por: "ui click", "notification", "success", "error"

### Opção 2: Gerar com Ferramentas Online
- [SFXR](https://sfxr.me/) - Gerador de sons 8-bit
- [ChipTone](https://sfbgames.itch.io/chiptone) - Gerador de sons retro

### Opção 3: Usar Sons do Sistema
Temporariamente, você pode usar sons do sistema operacional ou deixar os arquivos vazios (o código trata gracefully se o arquivo não existir).

## Formato Recomendado

- **Formato:** MP3 (melhor compatibilidade)
- **Taxa de amostragem:** 44.1kHz
- **Bitrate:** 128kbps
- **Canais:** Mono (suficiente para UI sounds)

## Implementação

Os sons são pré-carregados pelo hook `useVoiceFeedback` e tocados via `HTMLAudioElement` com volume de 0.4 (40%).

```typescript
// Uso no código
const feedback = useVoiceFeedback();

// Toca som + vibração
feedback.triggerFeedback('sent');    // voice_sent.mp3
feedback.triggerFeedback('success'); // voice_success.mp3
feedback.triggerFeedback('error');   // voice_error.mp3
```

## Fallback

Se os arquivos não existirem, o sistema continua funcionando normalmente (apenas sem som). A vibração e animações visuais ainda funcionam.
