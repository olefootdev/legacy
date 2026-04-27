# 🎨 OLEFOOT — Guia de Geração de Assets com Freepik API

## 📋 Visão Geral

Sistema automatizado que gera **todos os assets visuais do Olefoot** mantendo a identidade visual da marca:
- ✅ Paleta de cores oficial (Amarelo neon #FBE100 + Preto #0A0A0A)
- ✅ Logo Olefoot aplicado automaticamente
- ✅ Conversão para WebP (economia de 50-80% de tamanho)
- ✅ Versões responsivas (desktop, tablet, mobile)
- ✅ Prompts salvos para regeneração futura

---

## 🚀 Setup Rápido (5 minutos)

### 1. Instalar Dependências

```bash
npm install sharp
# ou
yarn add sharp
```

### 2. Obter API Key do Freepik

1. Acesse: https://www.freepik.com/api
2. Crie uma conta (ou faça login)
3. Vá em **Dashboard → API Keys**
4. Clique em **Create New Key**
5. Copie a chave gerada

### 3. Configurar API Key

```bash
# Linux/Mac
export FREEPIK_API_KEY="sua-chave-aqui"

# Windows (PowerShell)
$env:FREEPIK_API_KEY="sua-chave-aqui"

# Ou adicione no .env
echo 'FREEPIK_API_KEY=sua-chave-aqui' >> .env
```

### 4. Testar Instalação

```bash
npm run generate:assets test
```

Se funcionar, você verá 3 imagens sendo geradas em `public/assets/`

---

## 📦 Comandos Disponíveis

### Gerar Todos os Assets (Produção)
```bash
npm run generate:assets all
```
- Gera **todos os 20+ assets** do catálogo
- Tempo estimado: ~40-60 minutos
- Custo: ~50 créditos Freepik

### Gerar por Categoria
```bash
# Apenas backgrounds (login hero, estádios)
npm run generate:assets category background

# Apenas assets de partida (bola, goleiro, pênalti)
npm run generate:assets category match

# Apenas ilustrações (empty states)
npm run generate:assets category illustration

# Apenas avatares de treinador
npm run generate:assets category avatar

# Apenas brasões de clubes
npm run generate:assets category crest

# Apenas troféus 3D
npm run generate:assets category trophy
```

### Gerar Asset Individual
```bash
# Gerar apenas o background de login
npm run generate:assets single login-hero

# Gerar apenas a bola de futebol
npm run generate:assets single soccer-ball

# Gerar apenas placeholder de jogador
npm run generate:assets single player-placeholder
```

### Listar Assets Disponíveis
```bash
npm run generate:assets list
```

### Teste Rápido (3 assets)
```bash
npm run generate:assets test
```

---

## 📁 Estrutura de Saída

Após a geração, os arquivos estarão organizados assim:

```
public/assets/
├── background/
│   ├── login-hero.png              # PNG original (backup)
│   ├── login-hero.webp             # WebP desktop (1920×1080)
│   ├── login-hero-tablet.webp      # WebP tablet (1440×810)
│   ├── login-hero-mobile.webp      # WebP mobile (960×540)
│   ├── login-hero.prompt.json      # Prompt usado (regeneração)
│   ├── stadium-night.png
│   ├── stadium-night.webp
│   └── ...
├── match/
│   ├── soccer-ball.png
│   ├── soccer-ball.webp
│   ├── goalkeeper-save.png
│   ├── goalkeeper-save.webp
│   ├── player-placeholder.png
│   ├── player-placeholder.webp
│   └── ...
├── illustration/
│   ├── empty-stadium.png
│   ├── empty-stadium.webp
│   └── ...
├── avatar/
│   ├── coach-01.png
│   ├── coach-01.webp
│   └── ...
├── crest/
│   ├── crest-01.png
│   ├── crest-01.webp
│   └── ...
└── trophy/
    ├── trophy-gold.png
    ├── trophy-gold.webp
    └── ...
```

---

## 🎨 Assets Incluídos no Catálogo

### 🏟️ Backgrounds (3 assets)
- **login-hero** — Estádio ao pôr do sol (1920×1080) — Com logo
- **stadium-night** — Estádio à noite com holofotes (1920×1080) — Com logo
- **stadium-rain** — Estádio com chuva (1920×1080) — Com logo

### ⚽ Match Assets (6 assets)
- **soccer-ball** — Bola profissional (512×512)
- **goalkeeper-save** — Goleiro defendendo (800×600)
- **penalty-kick** — Jogador cobrando pênalti (800×600)
- **goal-celebration** — Comemoração de gol (800×600)
- **player-placeholder** — Silhueta genérica (400×520)

### 🎨 Ilustrações (3 assets)
- **empty-stadium** — Line art de estádio vazio (400×300)
- **empty-locker** — Line art de vestiário vazio (400×300)
- **locked-trophy** — Line art de troféu trancado (400×300)

### 🏆 Troféus 3D (3 assets)
- **trophy-gold** — Troféu dourado (512×512)
- **trophy-silver** — Troféu prateado (512×512)
- **trophy-bronze** — Troféu bronze (512×512)

### 👤 Avatares (2 assets)
- **coach-01** — Treinador com agasalho (256×256)
- **coach-02** — Treinador de terno (256×256)

### 🛡️ Brasões (2 assets)
- **crest-01** — Brasão com estrela (256×256)
- **crest-02** — Brasão com raio (256×256)

**Total: 19 assets base** (+ versões responsivas = ~50 arquivos)

---

## 🔧 Personalização

### Adicionar Novo Asset

Edite `scripts/generateAssetsFreepik.ts` e adicione no array `ASSETS_CATALOG`:

```typescript
{
  name: 'meu-asset',
  description: 'Descrição do asset',
  prompt: `prompt detalhado em inglês, incluindo estilo visual,
  iluminação, paleta de cores Olefoot (deep blacks, neon yellow),
  qualidade (8k, photorealistic), etc`,
  negativePrompt: `coisas a evitar: text, logos, people, low quality, etc`,
  style: 'photo', // ou 'digital-art', '3d', 'vector', 'painting'
  size: 'landscape', // ou 'square', 'portrait', 'wide', 'tall'
  width: 1920,
  height: 1080,
  addLogo: true, // adicionar logo Olefoot?
  logoPosition: 'top-left', // ou 'top-right', 'bottom-left', etc
  logoSize: 120, // tamanho do logo em pixels
  category: 'background', // ou 'match', 'illustration', etc
}
```

### Ajustar Qualidade WebP

Edite a função `convertToWebP` em `generateAssetsFreepik.ts`:

```typescript
.webp({ quality: 80 }) // Alterar de 80 para 60-100
```

- **60-70:** Menor tamanho, qualidade aceitável
- **80:** Padrão (balanço ideal)
- **90-100:** Máxima qualidade, arquivos maiores

### Desabilitar Versões Responsivas

```typescript
await convertToWebP(processedBuffer, webpPath, false); // false = sem responsivas
```

---

## 💰 Custos e Limites

### Planos Freepik API

| Plano | Custo | Imagens/dia | Custo/imagem |
|-------|-------|-------------|--------------|
| **Free** | Grátis | 3 | $0 |
| **Premium** | €9.99/mês | 50 | ~€0.20 |
| **Enterprise** | Custom | Ilimitado | Negociável |

### Estimativa para Olefoot

- **19 assets base** = 19 créditos
- **Testes/regenerações (3x)** = 57 créditos
- **Total estimado:** ~76 créditos

**Recomendação:** Plano Premium (€9.99/mês) é suficiente

---

## 🐛 Troubleshooting

### Erro: "FREEPIK_API_KEY não configurada"
```bash
# Verifique se a variável está definida
echo $FREEPIK_API_KEY

# Se vazio, configure novamente
export FREEPIK_API_KEY="sua-chave-aqui"
```

### Erro: "Freepik API error: 401"
- API key inválida ou expirada
- Verifique no dashboard do Freepik

### Erro: "Freepik API error: 429"
- Limite diário atingido
- Aguarde 24h ou faça upgrade do plano

### Erro: "sharp not found"
```bash
npm install sharp --save
```

### Imagens com cores erradas
- O script ajusta automaticamente para paleta Olefoot
- Se ainda estiver errado, edite `adjustColorPalette()` em `generateAssetsFreepik.ts`

### Logo não aparece
- Verifique se `public/brand/olefoot-yellow-01.svg` existe
- Verifique se `addLogo: true` no config do asset

---

## 📊 Monitoramento de Progresso

Durante a geração, você verá logs assim:

```
🚀 OLEFOOT — Gerador de Assets com Freepik API

📊 Total de assets no catálogo: 19
📦 Assets a gerar: 19

[1/19]
🎨 Gerando: login-hero
   Descrição: Background hero da tela de login
   Categoria: background
   Resolução: 1920×1080
   ⏳ Chamando Freepik API...
   🎨 Ajustando paleta de cores...
   🏷️  Adicionando logo Olefoot...
  ✅ PNG salvo: public/assets/background/login-hero.png
   📦 Convertendo para WebP...
  ✅ Salvo: public/assets/background/login-hero.webp
  ✅ Salvo: public/assets/background/login-hero-tablet.webp
  ✅ Salvo: public/assets/background/login-hero-mobile.webp
✅ Asset completo: login-hero
   ⏳ Aguardando 2s (rate limiting)...

[2/19]
🎨 Gerando: stadium-night
...
```

---

## 🔄 Regenerar Asset Específico

Se não gostar de um asset gerado:

1. **Veja o prompt usado:**
```bash
cat public/assets/background/login-hero.prompt.json
```

2. **Edite o prompt** em `generateAssetsFreepik.ts`

3. **Regenere apenas esse asset:**
```bash
npm run generate:assets single login-hero
```

---

## 🎯 Workflow Recomendado

### Primeira Vez (Setup)
```bash
# 1. Instalar dependências
npm install sharp

# 2. Configurar API key
export FREEPIK_API_KEY="sua-chave-aqui"

# 3. Testar com 3 assets
npm run generate:assets test

# 4. Se OK, gerar prioridades altas (backgrounds)
npm run generate:assets category background

# 5. Validar qualidade manualmente

# 6. Gerar resto
npm run generate:assets all
```

### Manutenção (Adicionar novos assets)
```bash
# 1. Editar scripts/generateAssetsFreepik.ts
# 2. Adicionar novo asset no ASSETS_CATALOG
# 3. Gerar apenas o novo
npm run generate:assets single meu-novo-asset
```

---

## 📝 Checklist de Validação

Após gerar os assets, validar:

- [ ] **Paleta de cores:** Amarelo neon + preto profundo presentes
- [ ] **Logo visível:** Marca Olefoot aparece (quando `addLogo: true`)
- [ ] **Resolução:** Imagens nítidas, sem pixelização
- [ ] **Tamanho arquivo:** WebP < 500KB (backgrounds), < 100KB (ícones)
- [ ] **Versões responsivas:** 3 versões geradas (desktop, tablet, mobile)
- [ ] **Prompt salvo:** Arquivo `.prompt.json` existe
- [ ] **Consistência visual:** Estilo alinhado com outros assets

---

## 🚀 Próximos Passos

1. **Gerar assets críticos:**
```bash
npm run generate:assets category background
```

2. **Integrar no código:**
```tsx
// Antes (placeholder)
<img src="https://picsum.photos/400/520" />

// Depois (asset gerado)
<img src="/assets/match/player-placeholder.webp" />
```

3. **Atualizar imports:**
```tsx
// Home.tsx
const loginHero = '/assets/background/login-hero.webp';

// Login.tsx
style={{ backgroundImage: `url(${loginHero})` }}
```

4. **Testar em produção:**
```bash
npm run build
npm run preview
```

---

## 📚 Recursos Adicionais

- **Freepik API Docs:** https://www.freepik.com/api/docs
- **Sharp Docs:** https://sharp.pixelplumbing.com/
- **WebP Guide:** https://developers.google.com/speed/webp

---

## 💡 Dicas Pro

1. **Gere em horários de baixo uso** (madrugada) para evitar rate limits
2. **Salve os prompts** — eles são ouro para regenerações futuras
3. **Teste com `test` primeiro** — economiza créditos
4. **Use versões responsivas** — economia de banda em mobile
5. **Mantenha PNGs originais** — backup para edições futuras

---

**Pronto para começar?**

```bash
npm run generate:assets test
```

🎨 Boa geração!
