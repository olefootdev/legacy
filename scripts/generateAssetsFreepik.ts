/**
 * OLEFOOT — Gerador de Assets com Freepik API
 *
 * Gera todas as imagens do projeto mantendo identidade visual:
 * - Paleta: Amarelo neon (#FBE100) + Preto profundo (#0A0A0A) + Branco
 * - Estilo: Cinematográfico, profissional, esportivo
 * - Branding: Adiciona logo Olefoot automaticamente
 */

import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

// ============================================================================
// CONFIGURAÇÃO DA API FREEPIK
// ============================================================================

const FREEPIK_API_KEY = process.env.FREEPIK_API_KEY || '';
const FREEPIK_API_URL = 'https://api.freepik.com/v1/ai/text-to-image';

interface FreepikGenerateParams {
  prompt: string;
  negative_prompt?: string;
  styling?: {
    style?: 'photo' | 'digital-art' | '3d' | 'painting' | 'vector' | 'anime';
    color?: 'vibrant' | 'neutral' | 'pastel' | 'dark' | 'light';
    lightning?: 'warm' | 'cold' | 'neutral' | 'studio' | 'dramatic';
  };
  num_images?: number;
  image?: {
    size?: 'square' | 'landscape' | 'portrait' | 'wide' | 'tall';
  };
}

interface FreepikResponse {
  data: Array<{
    base64: string;
    url?: string;
  }>;
}

async function generateImageFreepik(params: FreepikGenerateParams): Promise<Buffer> {
  const response = await fetch(FREEPIK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-freepik-api-key': FREEPIK_API_KEY,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Freepik API error: ${response.status} - ${error}`);
  }

  const data: FreepikResponse = await response.json();

  if (!data.data || data.data.length === 0) {
    throw new Error('Nenhuma imagem gerada pela API');
  }

  // Retornar primeira imagem como Buffer
  return Buffer.from(data.data[0].base64, 'base64');
}

// ============================================================================
// PALETA DE CORES OLEFOOT
// ============================================================================

const OLEFOOT_COLORS = {
  neonYellow: '#FBE100',
  deepBlack: '#0A0A0A',
  darkGray: '#1A1A1A',
  white: '#FFFFFF',
  emerald: '#34D399',
  red: '#EF4444',
  amber: '#FBBF24',
};

// ============================================================================
// CATÁLOGO DE ASSETS A GERAR
// ============================================================================

interface AssetConfig {
  name: string;
  description: string;
  prompt: string;
  negativePrompt: string;
  style: 'photo' | 'digital-art' | '3d' | 'painting' | 'vector';
  size: 'square' | 'landscape' | 'portrait' | 'wide' | 'tall';
  width: number;
  height: number;
  addLogo?: boolean;
  logoPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  logoSize?: number;
  category: 'background' | 'match' | 'illustration' | 'avatar' | 'crest' | 'trophy';
}

const ASSETS_CATALOG: AssetConfig[] = [
  // ========================================================================
  // BACKGROUNDS — Prioridade Alta
  // ========================================================================
  {
    name: 'login-hero',
    description: 'Background hero da tela de login',
    prompt: `cinematic wide angle shot of empty modern football stadium at golden hour,
    pristine green grass field with sharp white painted lines in foreground,
    blurred stadium stands in background, dramatic warm sunlight rays piercing through
    stadium architecture creating lens flares, professional sports photography,
    shallow depth of field, bokeh effect, moody atmospheric lighting with deep blacks
    and warm golden highlights, 8k resolution, photorealistic, ultra detailed`,
    negativePrompt: `people, players, crowd, fans, text, watermark, logos, brands,
    low quality, blurry, distorted, oversaturated, cartoonish, artificial, plastic,
    daytime harsh light, busy composition`,
    style: 'photo',
    size: 'wide',
    width: 1920,
    height: 1080,
    addLogo: true,
    logoPosition: 'top-left',
    logoSize: 120,
    category: 'background',
  },
  {
    name: 'stadium-night',
    description: 'Estádio à noite com holofotes',
    prompt: `dramatic night shot of football stadium with powerful floodlights,
    pristine green grass illuminated by stadium lights, empty stands in darkness,
    dramatic lighting with strong contrasts, professional sports photography,
    cinematic atmosphere, deep blacks and bright highlights, 8k, photorealistic`,
    negativePrompt: `people, crowd, text, logos, daytime, low quality, blurry`,
    style: 'photo',
    size: 'wide',
    width: 1920,
    height: 1080,
    addLogo: true,
    logoPosition: 'top-left',
    logoSize: 120,
    category: 'background',
  },
  {
    name: 'stadium-rain',
    description: 'Estádio com chuva',
    prompt: `atmospheric shot of football stadium in rain, wet grass with water
    reflections, raindrops visible, moody dark clouds, dramatic lighting,
    professional sports photography, cinematic mood, 8k, photorealistic`,
    negativePrompt: `people, crowd, text, logos, sunny, low quality, blurry`,
    style: 'photo',
    size: 'wide',
    width: 1920,
    height: 1080,
    addLogo: true,
    logoPosition: 'top-left',
    logoSize: 120,
    category: 'background',
  },

  // ========================================================================
  // MATCH ASSETS — Prioridade Média
  // ========================================================================
  {
    name: 'soccer-ball',
    description: 'Bola de futebol profissional',
    prompt: `professional soccer ball close-up, classic black pentagon and white
    hexagon pattern, realistic leather texture with subtle reflections, soft drop
    shadow underneath, clean white background, product photography, 8k, studio lighting`,
    negativePrompt: `text, logos, brands, people, grass, field, low quality, plastic`,
    style: 'photo',
    size: 'square',
    width: 512,
    height: 512,
    category: 'match',
  },
  {
    name: 'goalkeeper-save',
    description: 'Goleiro fazendo defesa espetacular',
    prompt: `dramatic side view of goalkeeper in mid-air diving save, generic gray
    and black uniform without logos, blurred goal net in background, motion blur on
    limbs, professional sports action photography, golden hour lighting, shallow depth
    of field, 8k, photorealistic`,
    negativePrompt: `text, jersey numbers, brand logos, crowd, fans, low quality,
    distorted anatomy, unrealistic pose`,
    style: 'photo',
    size: 'landscape',
    width: 800,
    height: 600,
    category: 'match',
  },
  {
    name: 'penalty-kick',
    description: 'Jogador cobrando pênalti',
    prompt: `back view of soccer player taking penalty kick, foot about to strike ball,
    goalkeeper in background on goal line, dramatic stadium lighting, professional
    sports photography, shallow depth of field, 8k, photorealistic`,
    negativePrompt: `text, logos, crowd, low quality, blurry, unrealistic`,
    style: 'photo',
    size: 'landscape',
    width: 800,
    height: 600,
    category: 'match',
  },
  {
    name: 'goal-celebration',
    description: 'Jogador comemorando gol',
    prompt: `soccer player celebrating goal with arms wide open, running towards camera,
    blurred stadium crowd in background with bokeh lights, professional sports
    photography, dramatic lighting, 8k, photorealistic`,
    negativePrompt: `text, logos, low quality, blurry, unrealistic pose`,
    style: 'photo',
    size: 'landscape',
    width: 800,
    height: 600,
    category: 'match',
  },
  {
    name: 'player-placeholder',
    description: 'Placeholder genérico de jogador',
    prompt: `minimalist silhouette of athletic soccer player in dynamic running pose,
    solid black figure against dark gradient background from pure black to charcoal gray,
    subtle neon yellow rim light on edges, professional sports design, clean composition,
    studio lighting, modern minimalist aesthetic, high contrast`,
    negativePrompt: `face, facial features, jersey details, numbers, text, logos,
    realistic textures, photographic, detailed anatomy, colors other than black and yellow`,
    style: 'digital-art',
    size: 'portrait',
    width: 400,
    height: 520,
    category: 'match',
  },

  // ========================================================================
  // ILUSTRAÇÕES — Empty States
  // ========================================================================
  {
    name: 'empty-stadium',
    description: 'Ilustração de estádio vazio',
    prompt: `minimalist isometric line art illustration of empty football stadium,
    simple geometric shapes, neon yellow stroke lines on pure black background,
    2px line weight, clean vector style, professional UI design, modern minimalist
    aesthetic, isometric perspective`,
    negativePrompt: `realistic, photographic, detailed, textured, people, filled shapes,
    gradients, shadows, 3d render, colors other than yellow and black`,
    style: 'vector',
    size: 'landscape',
    width: 400,
    height: 300,
    category: 'illustration',
  },
  {
    name: 'empty-locker',
    description: 'Ilustração de vestiário vazio',
    prompt: `minimalist isometric line art illustration of empty soccer locker room,
    simple geometric shapes, neon yellow stroke lines on pure black background,
    2px line weight, clean vector style, professional UI design`,
    negativePrompt: `realistic, photographic, detailed, people, filled shapes, gradients`,
    style: 'vector',
    size: 'landscape',
    width: 400,
    height: 300,
    category: 'illustration',
  },
  {
    name: 'locked-trophy',
    description: 'Ilustração de troféu trancado',
    prompt: `minimalist line art illustration of trophy with padlock, simple geometric
    shapes, neon yellow stroke lines on pure black background, 2px line weight,
    clean vector style, professional UI design`,
    negativePrompt: `realistic, photographic, detailed, filled shapes, gradients`,
    style: 'vector',
    size: 'landscape',
    width: 400,
    height: 300,
    category: 'illustration',
  },

  // ========================================================================
  // TROFÉUS 3D
  // ========================================================================
  {
    name: 'trophy-gold',
    description: 'Troféu dourado',
    prompt: `3d render of elegant golden trophy cup, polished gold material with
    reflections, pure black background, studio three-point lighting with dramatic
    rim light, professional product visualization, octane render, physically based
    rendering, 8k resolution, photorealistic`,
    negativePrompt: `text, engravings, logos, people, hands, low quality, plastic,
    cartoonish, unrealistic reflections, colored backgrounds`,
    style: '3d',
    size: 'square',
    width: 512,
    height: 512,
    category: 'trophy',
  },
  {
    name: 'trophy-silver',
    description: 'Troféu prateado',
    prompt: `3d render of elegant silver trophy cup, polished silver material with
    reflections, pure black background, studio lighting, professional product
    visualization, octane render, 8k, photorealistic`,
    negativePrompt: `text, logos, people, low quality, plastic, cartoonish`,
    style: '3d',
    size: 'square',
    width: 512,
    height: 512,
    category: 'trophy',
  },
  {
    name: 'trophy-bronze',
    description: 'Troféu bronze',
    prompt: `3d render of elegant bronze trophy cup, polished bronze material with
    reflections, pure black background, studio lighting, professional product
    visualization, octane render, 8k, photorealistic`,
    negativePrompt: `text, logos, people, low quality, plastic, cartoonish`,
    style: '3d',
    size: 'square',
    width: 512,
    height: 512,
    category: 'trophy',
  },

  // ========================================================================
  // AVATARES DE TREINADOR
  // ========================================================================
  {
    name: 'coach-01',
    description: 'Avatar de treinador 1',
    prompt: `cartoon illustration of professional soccer coach character, friendly
    expression, wearing black tracksuit with yellow details, diverse ethnicity,
    vibrant colors, clean vector style, professional character design, white background`,
    negativePrompt: `realistic, photographic, detailed textures, logos, text, low quality`,
    style: 'digital-art',
    size: 'square',
    width: 256,
    height: 256,
    category: 'avatar',
  },
  {
    name: 'coach-02',
    description: 'Avatar de treinador 2',
    prompt: `cartoon illustration of professional soccer coach character, confident
    expression, wearing suit and tie, diverse ethnicity, vibrant colors, clean vector
    style, professional character design, white background`,
    negativePrompt: `realistic, photographic, detailed textures, logos, text, low quality`,
    style: 'digital-art',
    size: 'square',
    width: 256,
    height: 256,
    category: 'avatar',
  },

  // ========================================================================
  // BRASÕES DE CLUBES (Genéricos)
  // ========================================================================
  {
    name: 'crest-01',
    description: 'Brasão de clube genérico 1',
    prompt: `minimalist geometric football club crest logo, shield shape, single neon
    yellow accent color on black and white base, clean vector design, professional
    sports branding, simple iconic star element, modern flat design, symmetrical`,
    negativePrompt: `realistic, photographic, detailed textures, text, team names,
    complex illustrations, gradients, multiple colors, 3d effects`,
    style: 'vector',
    size: 'square',
    width: 256,
    height: 256,
    category: 'crest',
  },
  {
    name: 'crest-02',
    description: 'Brasão de clube genérico 2',
    prompt: `minimalist geometric football club crest logo, circular shape, single neon
    yellow accent color on black and white base, clean vector design, professional
    sports branding, simple iconic lightning bolt element, modern flat design`,
    negativePrompt: `realistic, photographic, detailed textures, text, team names,
    complex illustrations, gradients, multiple colors`,
    style: 'vector',
    size: 'square',
    width: 256,
    height: 256,
    category: 'crest',
  },
];

// ============================================================================
// FUNÇÕES DE PROCESSAMENTO
// ============================================================================

/**
 * Adiciona logo Olefoot na imagem
 */
async function addLogoWatermark(
  imageBuffer: Buffer,
  logoPath: string,
  position: string = 'top-left',
  size: number = 120,
): Promise<Buffer> {
  const logo = await sharp(logoPath)
    .resize(size, null, { fit: 'inside' })
    .toBuffer();

  const image = sharp(imageBuffer);
  const metadata = await image.metadata();

  let gravity: any = 'northwest';
  const padding = 32;

  switch (position) {
    case 'top-left':
      gravity = 'northwest';
      break;
    case 'top-right':
      gravity = 'northeast';
      break;
    case 'bottom-left':
      gravity = 'southwest';
      break;
    case 'bottom-right':
      gravity = 'southeast';
      break;
    case 'center':
      gravity = 'center';
      break;
  }

  return image
    .composite([
      {
        input: logo,
        gravity,
        blend: 'over',
      },
    ])
    .toBuffer();
}

/**
 * Converte para WebP e gera versões responsivas
 */
async function convertToWebP(
  imageBuffer: Buffer,
  outputPath: string,
  generateResponsive: boolean = true,
): Promise<void> {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();

  // Versão desktop (original)
  await image
    .webp({ quality: 80 })
    .toFile(outputPath);

  console.log(`  ✅ Salvo: ${outputPath}`);

  if (generateResponsive && metadata.width && metadata.width > 640) {
    // Versão tablet (75%)
    const tabletPath = outputPath.replace('.webp', '-tablet.webp');
    await sharp(imageBuffer)
      .resize(Math.round(metadata.width * 0.75), null)
      .webp({ quality: 80 })
      .toFile(tabletPath);
    console.log(`  ✅ Salvo: ${tabletPath}`);

    // Versão mobile (50%)
    const mobilePath = outputPath.replace('.webp', '-mobile.webp');
    await sharp(imageBuffer)
      .resize(Math.round(metadata.width * 0.5), null)
      .webp({ quality: 80 })
      .toFile(mobilePath);
    console.log(`  ✅ Salvo: ${mobilePath}`);
  }
}

/**
 * Ajusta paleta de cores para garantir identidade Olefoot
 */
async function adjustColorPalette(imageBuffer: Buffer): Promise<Buffer> {
  // Aumentar contraste e saturação para reforçar pretos profundos e amarelos vibrantes
  return sharp(imageBuffer)
    .modulate({
      brightness: 0.95, // Escurecer levemente
      saturation: 1.2,  // Aumentar saturação
    })
    .toBuffer();
}

// ============================================================================
// PIPELINE DE GERAÇÃO
// ============================================================================

async function generateAsset(config: AssetConfig): Promise<void> {
  console.log(`\n🎨 Gerando: ${config.name}`);
  console.log(`   Descrição: ${config.description}`);
  console.log(`   Categoria: ${config.category}`);
  console.log(`   Resolução: ${config.width}×${config.height}`);

  try {
    // 1. Gerar imagem com Freepik API
    console.log(`   ⏳ Chamando Freepik API...`);
    const imageBuffer = await generateImageFreepik({
      prompt: config.prompt,
      negative_prompt: config.negativePrompt,
      styling: {
        style: config.style,
        color: 'dark',
        lightning: 'dramatic',
      },
      image: {
        size: config.size,
      },
      num_images: 1,
    });

    // 2. Ajustar paleta de cores
    console.log(`   🎨 Ajustando paleta de cores...`);
    let processedBuffer = await adjustColorPalette(imageBuffer);

    // 3. Adicionar logo (se configurado)
    if (config.addLogo) {
      console.log(`   🏷️  Adicionando logo Olefoot...`);
      const logoPath = path.join(process.cwd(), 'public/brand/olefoot-yellow-01.svg');
      processedBuffer = await addLogoWatermark(
        processedBuffer,
        logoPath,
        config.logoPosition,
        config.logoSize,
      );
    }

    // 4. Salvar PNG original (backup)
    const outputDir = path.join(process.cwd(), 'public/assets', config.category);
    await fs.mkdir(outputDir, { recursive: true });

    const pngPath = path.join(outputDir, `${config.name}.png`);
    await fs.writeFile(pngPath, processedBuffer);
    console.log(`  ✅ PNG salvo: ${pngPath}`);

    // 5. Converter para WebP + versões responsivas
    console.log(`   📦 Convertendo para WebP...`);
    const webpPath = path.join(outputDir, `${config.name}.webp`);
    await convertToWebP(processedBuffer, webpPath, config.width > 640);

    // 6. Salvar prompt usado (para regeneração futura)
    const promptPath = path.join(outputDir, `${config.name}.prompt.json`);
    await fs.writeFile(
      promptPath,
      JSON.stringify(
        {
          name: config.name,
          description: config.description,
          prompt: config.prompt,
          negativePrompt: config.negativePrompt,
          style: config.style,
          size: config.size,
          dimensions: { width: config.width, height: config.height },
          generatedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );

    console.log(`✅ Asset completo: ${config.name}`);
  } catch (error) {
    console.error(`❌ Erro ao gerar ${config.name}:`, error);
    throw error;
  }
}

/**
 * Gerar todos os assets em batch
 */
async function generateAllAssets(
  categories?: string[],
  limit?: number,
): Promise<void> {
  console.log('🚀 OLEFOOT — Gerador de Assets com Freepik API\n');
  console.log(`📊 Total de assets no catálogo: ${ASSETS_CATALOG.length}`);

  // Filtrar por categoria (se especificado)
  let assetsToGenerate = ASSETS_CATALOG;
  if (categories && categories.length > 0) {
    assetsToGenerate = ASSETS_CATALOG.filter((a) => categories.includes(a.category));
    console.log(`🎯 Filtrando por categorias: ${categories.join(', ')}`);
  }

  // Limitar quantidade (se especificado)
  if (limit && limit > 0) {
    assetsToGenerate = assetsToGenerate.slice(0, limit);
    console.log(`⚠️  Limitando a ${limit} assets (teste)`);
  }

  console.log(`📦 Assets a gerar: ${assetsToGenerate.length}\n`);

  // Gerar assets sequencialmente (rate limiting)
  for (let i = 0; i < assetsToGenerate.length; i++) {
    const config = assetsToGenerate[i];
    console.log(`\n[${i + 1}/${assetsToGenerate.length}]`);

    try {
      await generateAsset(config);

      // Rate limiting: aguardar 2 segundos entre requisições
      if (i < assetsToGenerate.length - 1) {
        console.log(`   ⏳ Aguardando 2s (rate limiting)...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`❌ Falha ao gerar ${config.name}, continuando...`);
      // Continuar com próximo asset mesmo se um falhar
    }
  }

  console.log('\n\n✅ GERAÇÃO COMPLETA!');
  console.log(`📁 Assets salvos em: public/assets/`);
  console.log(`📝 Prompts salvos em: public/assets/*/*.prompt.json`);
}

// ============================================================================
// CLI
// ============================================================================

const args = process.argv.slice(2);
const command = args[0];

if (!FREEPIK_API_KEY) {
  console.error('❌ ERRO: FREEPIK_API_KEY não configurada');
  console.error('   Configure: export FREEPIK_API_KEY="sua-chave-aqui"');
  process.exit(1);
}

switch (command) {
  case 'all':
    // Gerar todos os assets
    generateAllAssets().catch(console.error);
    break;

  case 'category':
    // Gerar apenas uma categoria
    const category = args[1];
    if (!category) {
      console.error('❌ Especifique a categoria: background, match, illustration, avatar, crest, trophy');
      process.exit(1);
    }
    generateAllAssets([category]).catch(console.error);
    break;

  case 'test':
    // Gerar apenas 3 assets (teste)
    generateAllAssets(undefined, 3).catch(console.error);
    break;

  case 'single':
    // Gerar apenas um asset específico
    const assetName = args[1];
    if (!assetName) {
      console.error('❌ Especifique o nome do asset');
      process.exit(1);
    }
    const config = ASSETS_CATALOG.find((a) => a.name === assetName);
    if (!config) {
      console.error(`❌ Asset "${assetName}" não encontrado no catálogo`);
      process.exit(1);
    }
    generateAsset(config).catch(console.error);
    break;

  case 'list':
    // Listar todos os assets disponíveis
    console.log('📋 Assets disponíveis no catálogo:\n');
    const grouped = ASSETS_CATALOG.reduce((acc, asset) => {
      if (!acc[asset.category]) acc[asset.category] = [];
      acc[asset.category].push(asset);
      return acc;
    }, {} as Record<string, AssetConfig[]>);

    Object.entries(grouped).forEach(([category, assets]) => {
      console.log(`\n${category.toUpperCase()} (${assets.length}):`);
      assets.forEach((a) => {
        console.log(`  - ${a.name} (${a.width}×${a.height})`);
      });
    });
    break;

  default:
    console.log(`
🎨 OLEFOOT — Gerador de Assets com Freepik API

USO:
  npm run generate:assets <comando> [opções]

COMANDOS:
  all                    Gerar todos os assets do catálogo
  category <nome>        Gerar apenas uma categoria (background, match, etc)
  test                   Gerar apenas 3 assets (teste rápido)
  single <nome>          Gerar apenas um asset específico
  list                   Listar todos os assets disponíveis

EXEMPLOS:
  npm run generate:assets all
  npm run generate:assets category background
  npm run generate:assets test
  npm run generate:assets single login-hero
  npm run generate:assets list

CONFIGURAÇÃO:
  export FREEPIK_API_KEY="sua-chave-aqui"
    `);
    break;
}
