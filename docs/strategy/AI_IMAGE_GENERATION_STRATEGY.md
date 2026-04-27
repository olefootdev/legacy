# Estratégia de Geração de Imagens com IA para Olefoot

## 🎯 Objetivo
Automatizar a criação dos 54 assets identificados usando APIs de geração de imagens por IA.

---

## 🤖 APIs Disponíveis e Comparação

### 1. **Freepik API (Pikaso AI)**
- **Endpoint:** `https://api.freepik.com/v1/ai/text-to-image`
- **Modelo:** Flux (Freepik proprietário)
- **Preço:** 
  - Plano Free: 3 imagens/dia
  - Plano Premium: €9.99/mês (50 imagens/dia)
  - Plano Enterprise: Custom pricing
- **Qualidade:** Alta (especializado em design gráfico)
- **Licença:** Uso comercial permitido (Premium+)
- **Formatos:** PNG, JPG, WebP
- **Resolução máxima:** 2048×2048px
- **Vantagens:**
  - ✅ Especializado em design profissional
  - ✅ Estilos pré-definidos (fotografia, ilustração, 3D)
  - ✅ Boa qualidade para assets de UI/UX
  - ✅ Suporte a negative prompts
- **Desvantagens:**
  - ❌ Limite diário baixo no plano free
  - ❌ Documentação limitada
  - ❌ Sem controle fino de composição

**Viabilidade para Olefoot:** ⭐⭐⭐⭐ (4/5)

---

### 2. **Stability AI (Stable Diffusion)**
- **Endpoint:** `https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image`
- **Modelo:** SDXL 1.0, SD 3.0, SD 3.5
- **Preço:**
  - Pay-as-you-go: $0.002-0.08 por imagem (depende do modelo)
  - ~$10 = 500-5000 imagens
- **Qualidade:** Muito alta (state-of-the-art)
- **Licença:** Uso comercial permitido
- **Formatos:** PNG, JPEG, WebP
- **Resolução máxima:** 1024×1024px (SDXL), 2048×2048px (SD 3.5)
- **Vantagens:**
  - ✅ Melhor custo-benefício
  - ✅ Controle fino (CFG scale, steps, sampler)
  - ✅ Suporte a ControlNet, LoRA, inpainting
  - ✅ Documentação excelente
  - ✅ Sem limites diários (pay-per-use)
- **Desvantagens:**
  - ❌ Requer prompts mais técnicos
  - ❌ Pode gerar artefatos em textos

**Viabilidade para Olefoot:** ⭐⭐⭐⭐⭐ (5/5) — **RECOMENDADO**

---

### 3. **OpenAI DALL-E 3**
- **Endpoint:** `https://api.openai.com/v1/images/generations`
- **Modelo:** DALL-E 3
- **Preço:**
  - Standard (1024×1024): $0.040 por imagem
  - HD (1024×1792): $0.080 por imagem
  - ~$10 = 125-250 imagens
- **Qualidade:** Excelente (melhor compreensão de prompts naturais)
- **Licença:** Uso comercial permitido
- **Formatos:** PNG
- **Resolução máxima:** 1792×1024px (landscape) ou 1024×1792px (portrait)
- **Vantagens:**
  - ✅ Melhor interpretação de linguagem natural
  - ✅ Menos artefatos visuais
  - ✅ Ótimo para fotografia realista
  - ✅ Integração fácil (mesma API do ChatGPT)
- **Desvantagens:**
  - ❌ Mais caro que Stability AI
  - ❌ Menos controle técnico
  - ❌ Censura mais agressiva (pode bloquear prompts de esporte)

**Viabilidade para Olefoot:** ⭐⭐⭐⭐ (4/5)

---

### 4. **Midjourney (via API não-oficial)**
- **Status:** Sem API oficial pública
- **Alternativa:** Discord bot automation (não recomendado para produção)
- **Preço:** $10-60/mês (planos de assinatura)
- **Qualidade:** Excelente (melhor estética artística)
- **Vantagens:**
  - ✅ Qualidade visual superior
  - ✅ Estilos artísticos únicos
- **Desvantagens:**
  - ❌ Sem API oficial
  - ❌ Difícil de automatizar
  - ❌ Licença comercial requer plano Pro ($60/mês)

**Viabilidade para Olefoot:** ⭐⭐ (2/5) — Não recomendado para automação

---

### 5. **Replicate (Marketplace de Modelos)**
- **Endpoint:** `https://api.replicate.com/v1/predictions`
- **Modelos:** SDXL, Flux, Playground v2.5, etc.
- **Preço:** $0.0005-0.05 por imagem (varia por modelo)
- **Qualidade:** Varia (depende do modelo)
- **Licença:** Depende do modelo
- **Vantagens:**
  - ✅ Acesso a múltiplos modelos
  - ✅ Preço competitivo
  - ✅ Fácil de testar diferentes modelos
- **Desvantagens:**
  - ❌ Qualidade inconsistente
  - ❌ Latência variável

**Viabilidade para Olefoot:** ⭐⭐⭐ (3/5)

---

## 🏆 Recomendação Final: **Stability AI (Stable Diffusion)**

### Por quê?
1. **Melhor custo-benefício:** $10 = 500-5000 imagens (vs $10 = 125 imagens no DALL-E 3)
2. **Controle técnico:** CFG scale, steps, negative prompts, ControlNet
3. **Sem limites diários:** Pay-per-use (vs 50 imagens/dia no Freepik)
4. **Licença comercial clara:** Uso comercial permitido sem restrições
5. **Documentação excelente:** SDKs oficiais em Python, Node.js, Go

---

## 📋 Plano de Implementação

### Fase 1: Setup (1 dia)
```bash
# Instalar SDK oficial
npm install stability-sdk

# Configurar API key
export STABILITY_API_KEY="sk-..."
```

### Fase 2: Criar Script de Geração (2 dias)
```typescript
// scripts/generateAssets.ts
import { StabilityAI } from 'stability-sdk';

const client = new StabilityAI({ apiKey: process.env.STABILITY_API_KEY });

const ASSET_PROMPTS = {
  loginHero: {
    prompt: "cinematic wide shot of empty football stadium at golden hour, pristine green grass with white lines in foreground, blurred stands in background, dramatic sunlight rays through stadium structure, photorealistic, 8k, professional sports photography",
    negativePrompt: "people, players, crowd, text, watermark, low quality, blurry",
    width: 1920,
    height: 1080,
    style: "photographic",
  },
  playerPlaceholder: {
    prompt: "silhouette of athletic soccer player in dynamic running pose, black gradient background, minimalist, professional sports design, studio lighting",
    negativePrompt: "face, details, text, logo, realistic",
    width: 400,
    height: 520,
    style: "digital-art",
  },
  // ... mais 52 prompts
};

async function generateAsset(key: string, config: any) {
  const response = await client.textToImage({
    text_prompts: [
      { text: config.prompt, weight: 1 },
      { text: config.negativePrompt, weight: -1 },
    ],
    cfg_scale: 7,
    width: config.width,
    height: config.height,
    steps: 30,
    samples: 1,
    style_preset: config.style,
  });

  const buffer = Buffer.from(response.artifacts[0].base64, 'base64');
  await fs.writeFile(`public/generated/${key}.png`, buffer);
  console.log(`✅ Generated: ${key}.png`);
}

// Gerar todos os assets
for (const [key, config] of Object.entries(ASSET_PROMPTS)) {
  await generateAsset(key, config);
  await sleep(1000); // Rate limiting
}
```

### Fase 3: Otimização (1 dia)
```bash
# Converter PNG → WebP (compressão 80%)
for file in public/generated/*.png; do
  cwebp -q 80 "$file" -o "${file%.png}.webp"
done

# Gerar versões responsivas
for file in public/generated/*.webp; do
  # Mobile (50%)
  convert "$file" -resize 50% "${file%.webp}-mobile.webp"
  # Tablet (75%)
  convert "$file" -resize 75% "${file%.webp}-tablet.webp"
done
```

### Fase 4: Validação Manual (1 dia)
- Revisar cada imagem gerada
- Regenerar assets com qualidade insatisfatória (ajustar prompts)
- Testar integração no código

---

## 💰 Estimativa de Custo

### Cenário: Gerar 54 assets com Stability AI

| Item | Quantidade | Custo Unitário | Total |
|------|------------|----------------|-------|
| **Backgrounds (1920×1080)** | 6 | $0.08 | $0.48 |
| **Match Assets (800×600)** | 6 | $0.04 | $0.24 |
| **Ilustrações (400×300)** | 7 | $0.02 | $0.14 |
| **Renders 3D (512×512)** | 8 | $0.02 | $0.16 |
| **Avatares (256×256)** | 12 | $0.01 | $0.12 |
| **Brasões (256×256)** | 20 | $0.01 | $0.20 |
| **Variações/Testes (3x)** | 162 | — | $4.02 |
| **TOTAL** | **216 imagens** | — | **~$5.36** |

**Custo final estimado: $5-10** (incluindo testes e regenerações)

---

## 🎨 Prompts Otimizados por Categoria

### 1. Login Hero Background
```
Prompt: "cinematic wide angle shot of empty football stadium at golden hour, pristine green grass field with white painted lines in sharp focus foreground, blurred stadium stands in background, dramatic sunlight rays piercing through modern stadium architecture, professional sports photography, 8k resolution, shallow depth of field, bokeh effect, photorealistic"

Negative: "people, players, crowd, fans, text, watermark, logos, low quality, blurry, distorted, oversaturated"

Settings:
- Model: SDXL 1.0
- CFG Scale: 7
- Steps: 40
- Style: photographic
- Aspect: 16:9 (1920×1080)
```

### 2. Player Portrait Placeholder
```
Prompt: "minimalist silhouette of athletic soccer player in dynamic running pose, solid black figure against dark gradient background from black to charcoal gray, studio lighting, professional sports design, clean composition, negative space"

Negative: "face, facial features, details, jersey numbers, text, logo, realistic textures, colors"

Settings:
- Model: SDXL 1.0
- CFG Scale: 8
- Steps: 30
- Style: digital-art
- Aspect: 10:13 (400×520)
```

### 3. Soccer Ball (Match)
```
Prompt: "professional soccer ball close-up, classic black pentagon and white hexagon pattern, realistic leather texture with subtle reflections, soft drop shadow underneath, clean white background, product photography, 8k, studio lighting"

Negative: "text, logos, brands, people, grass, field, low quality"

Settings:
- Model: SDXL 1.0
- CFG Scale: 7
- Steps: 35
- Style: photographic
- Aspect: 1:1 (512×512)
```

### 4. Goalkeeper Diving Save
```
Prompt: "dramatic side view of goalkeeper in mid-air diving save, generic gray and black uniform without logos, blurred goal net in background, motion blur on limbs, professional sports action photography, golden hour lighting, shallow depth of field, 8k"

Negative: "text, jersey numbers, brand logos, crowd, fans, low quality, distorted anatomy"

Settings:
- Model: SDXL 1.0
- CFG Scale: 7
- Steps: 40
- Style: photographic
- Aspect: 4:3 (800×600)
```

### 5. Empty State Illustration (Stadium)
```
Prompt: "minimalist isometric line art illustration of empty football stadium, simple geometric shapes, neon yellow stroke lines on black background, 2px line weight, clean vector style, professional UI design"

Negative: "realistic, photographic, detailed, textured, people, 3d render, shadows"

Settings:
- Model: SDXL 1.0
- CFG Scale: 9
- Steps: 25
- Style: line-art
- Aspect: 4:3 (400×300)
```

### 6. Trophy 3D Render
```
Prompt: "3d render of golden trophy cup, polished gold material with reflections, studio three-point lighting, black background, professional product visualization, octane render, 8k, photorealistic"

Negative: "text, engravings, logos, people, hands, low quality, plastic"

Settings:
- Model: SDXL 1.0
- CFG Scale: 7
- Steps: 40
- Style: 3d-model
- Aspect: 1:1 (512×512)
```

### 7. Manager Avatar (Cartoon)
```
Prompt: "cartoon illustration of professional soccer coach character, friendly expression, wearing tracksuit, diverse ethnicity, vibrant colors, clean vector style, professional character design, white background"

Negative: "realistic, photographic, detailed textures, logos, text, low quality"

Settings:
- Model: SDXL 1.0
- CFG Scale: 8
- Steps: 30
- Style: comic-book
- Aspect: 1:1 (256×256)
```

### 8. Club Crest (Generic)
```
Prompt: "minimalist geometric football club crest logo, shield shape, single color accent (neon yellow), black and white, clean vector design, professional sports branding, simple iconic elements like stars or wings"

Negative: "realistic, photographic, detailed, text, team names, complex, gradients"

Settings:
- Model: SDXL 1.0
- CFG Scale: 9
- Steps: 25
- Style: digital-art
- Aspect: 1:1 (256×256)
```

---

## 🔧 Script Completo de Automação

```typescript
// scripts/generateAllAssets.ts
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Usar Claude para gerar prompts otimizados
async function generateOptimizedPrompt(assetDescription: string) {
  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Generate an optimized Stable Diffusion prompt for: ${assetDescription}
      
      Return JSON with:
      - prompt: detailed positive prompt
      - negativePrompt: what to avoid
      - style: photographic|digital-art|3d-model|line-art
      - cfgScale: 7-9
      - steps: 25-40`
    }]
  });
  
  return JSON.parse(message.content[0].text);
}

// Gerar imagem com Stability AI
async function generateImage(config: any, outputPath: string) {
  const response = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.STABILITY_API_KEY}`,
    },
    body: JSON.stringify({
      text_prompts: [
        { text: config.prompt, weight: 1 },
        { text: config.negativePrompt, weight: -1 },
      ],
      cfg_scale: config.cfgScale,
      width: config.width,
      height: config.height,
      steps: config.steps,
      samples: 1,
      style_preset: config.style,
    }),
  });

  const data = await response.json();
  const buffer = Buffer.from(data.artifacts[0].base64, 'base64');
  await fs.writeFile(outputPath, buffer);
}

// Pipeline completo
async function generateAllAssets() {
  const assets = [
    { name: 'login-hero', description: 'cinematic football stadium at golden hour', width: 1920, height: 1080 },
    { name: 'player-placeholder', description: 'minimalist player silhouette', width: 400, height: 520 },
    // ... adicionar todos os 54 assets
  ];

  for (const asset of assets) {
    console.log(`🎨 Generating: ${asset.name}...`);
    
    // 1. Gerar prompt otimizado com Claude
    const promptConfig = await generateOptimizedPrompt(asset.description);
    
    // 2. Gerar imagem com Stability AI
    const outputPath = path.join('public/generated', `${asset.name}.png`);
    await generateImage({
      ...promptConfig,
      width: asset.width,
      height: asset.height,
    }, outputPath);
    
    // 3. Converter para WebP
    await convertToWebP(outputPath);
    
    console.log(`✅ Done: ${asset.name}`);
    
    // Rate limiting (1 req/sec)
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

generateAllAssets().catch(console.error);
```

---

## ✅ Checklist de Implementação

- [ ] Criar conta Stability AI e obter API key
- [ ] Instalar dependências (`stability-sdk`, `sharp` para conversão)
- [ ] Criar script `generateAllAssets.ts`
- [ ] Definir todos os 54 prompts otimizados
- [ ] Executar geração em batch (estimado: 2-3 horas)
- [ ] Revisar qualidade de cada asset
- [ ] Regenerar assets insatisfatórios (ajustar prompts)
- [ ] Converter PNG → WebP (compressão)
- [ ] Gerar versões responsivas (mobile, tablet)
- [ ] Atualizar código para usar novos assets
- [ ] Testar em produção
- [ ] Documentar prompts usados (para futuras regenerações)

---

## 🚀 Próximos Passos

1. **Aprovar estratégia:** Confirmar uso de Stability AI
2. **Obter API key:** Criar conta em stability.ai
3. **Implementar script:** Desenvolver pipeline de geração
4. **Executar geração:** Rodar script para todos os 54 assets
5. **Validar qualidade:** Revisar manualmente cada imagem
6. **Integrar no código:** Atualizar imports e paths

**Tempo estimado total:** 4-5 dias  
**Custo estimado:** $5-10 USD

---

*Documento técnico — Olefoot AI Image Generation Strategy*
