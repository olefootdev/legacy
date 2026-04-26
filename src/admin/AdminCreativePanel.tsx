import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Image,
  Download,
  Copy,
  CheckCircle,
  Sparkles,
  Palette,
  FileImage,
  Layers,
  Monitor,
  Smartphone,
  Tablet,
  FolderOpen,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreativeAsset {
  id: string;
  name: string;
  category: 'background' | 'match' | 'illustration' | 'ui' | 'social';
  priority: 'critical' | 'high' | 'medium' | 'low';
  dimensions: {
    desktop: string;
    tablet?: string;
    mobile?: string;
  };
  path: string;
  prompt: string;
  usage: string;
  colorPalette: string[];
  style: string;
  exists: boolean;
}

const CREATIVE_ASSETS: CreativeAsset[] = [
  // ========================================================================
  // BACKGROUNDS — Prioridade Crítica
  // ========================================================================
  {
    id: 'login-hero',
    name: 'Login Hero Background',
    category: 'background',
    priority: 'critical',
    dimensions: {
      desktop: '1920×1080px',
      tablet: '1440×810px',
      mobile: '960×540px',
    },
    path: '/public/assets/backgrounds/login-hero.webp',
    prompt: `Cinematic masterpiece: futuristic-retro football stadium at twilight,
    empty pristine emerald green grass with glowing neon yellow (#FBE100) painted lines,
    holographic architecture mixing brutalist concrete with sleek LED panels,
    dramatic golden hour sunlight breaking through storm clouds creating god rays,
    deep shadows with rich blacks (#0A0A0A), atmospheric haze,
    Blade Runner meets classic football nostalgia, anamorphic lens flares,
    shallow depth of field, moody epic atmosphere, shot on ARRI Alexa 65, 8K, photorealistic`,
    usage: 'Background principal da tela de Login e Cadastro',
    colorPalette: ['#FBE100', '#0A0A0A', '#1A1A1A', '#FFFFFF'],
    style: 'Cinematográfico, fotorrealista, futurista-retrô',
    exists: false,
  },
  {
    id: 'home-hero',
    name: 'Home Hero Background',
    category: 'background',
    priority: 'critical',
    dimensions: {
      desktop: '1920×1080px',
      tablet: '1440×810px',
      mobile: '960×540px',
    },
    path: '/public/assets/backgrounds/home-hero.webp',
    prompt: `Epic wide shot of modern football stadium interior at night,
    pristine green pitch illuminated by powerful floodlights,
    empty stands creating dramatic scale, neon yellow (#FBE100) accent lights,
    deep black (#0A0A0A) shadows, volumetric lighting with fog,
    cinematic atmosphere, professional sports photography, 8K, ultra detailed`,
    usage: 'Background do hero da Home (último jogo)',
    colorPalette: ['#FBE100', '#0A0A0A', '#34D399', '#FFFFFF'],
    style: 'Cinematográfico, noturno, dramático',
    exists: false,
  },
  {
    id: 'stadium-day',
    name: 'Stadium Day',
    category: 'background',
    priority: 'high',
    dimensions: {
      desktop: '1920×1080px',
    },
    path: '/public/assets/backgrounds/stadium-day.webp',
    prompt: `Bright sunny day at football stadium, vibrant green grass,
    clear blue sky, professional sports photography, high contrast,
    neon yellow (#FBE100) details, clean modern aesthetic, 8K`,
    usage: 'Variação de background para partidas diurnas',
    colorPalette: ['#FBE100', '#34D399', '#3B82F6', '#FFFFFF'],
    style: 'Fotográfico, vibrante, diurno',
    exists: false,
  },
  {
    id: 'stadium-rain',
    name: 'Stadium Rain',
    category: 'background',
    priority: 'medium',
    dimensions: {
      desktop: '1920×1080px',
    },
    path: '/public/assets/backgrounds/stadium-rain.webp',
    prompt: `Atmospheric football stadium in heavy rain, wet grass with water reflections,
    dark moody clouds, raindrops visible, dramatic lighting,
    neon yellow (#FBE100) lights glowing through rain,
    cinematic mood, deep blacks (#0A0A0A), 8K photorealistic`,
    usage: 'Background especial para clima chuvoso',
    colorPalette: ['#FBE100', '#0A0A0A', '#6B7280', '#FFFFFF'],
    style: 'Cinematográfico, atmosférico, chuvoso',
    exists: false,
  },

  // ========================================================================
  // MATCH ASSETS — Prioridade Alta
  // ========================================================================
  {
    id: 'player-placeholder',
    name: 'Player Placeholder',
    category: 'match',
    priority: 'critical',
    dimensions: {
      desktop: '400×520px',
    },
    path: '/public/assets/match/player-placeholder.webp',
    prompt: `Minimalist silhouette of athletic soccer player in dynamic running pose,
    solid black figure against dark gradient background (pure black #0A0A0A to charcoal #1A1A1A),
    subtle neon yellow (#FBE100) rim light on edges,
    professional sports design, clean composition, high contrast, modern aesthetic`,
    usage: 'Placeholder quando jogador não tem foto',
    colorPalette: ['#FBE100', '#0A0A0A', '#1A1A1A'],
    style: 'Minimalista, silhueta, alto contraste',
    exists: true,
  },
  {
    id: 'soccer-ball',
    name: 'Soccer Ball',
    category: 'match',
    priority: 'high',
    dimensions: {
      desktop: '512×512px',
    },
    path: '/public/assets/match/soccer-ball.webp',
    prompt: `Professional soccer ball close-up, classic black pentagon and white hexagon pattern,
    realistic leather texture with subtle reflections, soft drop shadow,
    clean white background, product photography, 8K, studio lighting`,
    usage: 'Ícone de bola em partidas, loading states',
    colorPalette: ['#000000', '#FFFFFF'],
    style: 'Fotográfico, produto, limpo',
    exists: false,
  },
  {
    id: 'goalkeeper-save',
    name: 'Goalkeeper Save',
    category: 'match',
    priority: 'medium',
    dimensions: {
      desktop: '800×600px',
    },
    path: '/public/assets/match/goalkeeper-save.webp',
    prompt: `Dramatic side view of goalkeeper in mid-air diving save,
    generic gray and black uniform, blurred goal net background,
    motion blur on limbs, professional sports action photography,
    golden hour lighting, shallow depth of field, 8K photorealistic`,
    usage: 'Modal de defesa em disputa de pênaltis',
    colorPalette: ['#FBE100', '#0A0A0A', '#6B7280'],
    style: 'Fotográfico, ação, dramático',
    exists: false,
  },
  {
    id: 'penalty-kick',
    name: 'Penalty Kick',
    category: 'match',
    priority: 'medium',
    dimensions: {
      desktop: '800×600px',
    },
    path: '/public/assets/match/penalty-kick.webp',
    prompt: `Back view of soccer player taking penalty kick, foot about to strike ball,
    goalkeeper in background on goal line, dramatic stadium lighting,
    professional sports photography, shallow depth of field, 8K photorealistic`,
    usage: 'Modal de cobrança de pênalti',
    colorPalette: ['#FBE100', '#0A0A0A', '#34D399'],
    style: 'Fotográfico, tensão, dramático',
    exists: false,
  },
  {
    id: 'goal-celebration',
    name: 'Goal Celebration',
    category: 'match',
    priority: 'medium',
    dimensions: {
      desktop: '800×600px',
    },
    path: '/public/assets/match/goal-celebration.webp',
    prompt: `Soccer player celebrating goal with arms wide open, running towards camera,
    blurred stadium crowd with bokeh lights, professional sports photography,
    dramatic lighting, joy and triumph, 8K photorealistic`,
    usage: 'Feedback visual de gol marcado',
    colorPalette: ['#FBE100', '#34D399', '#FFFFFF'],
    style: 'Fotográfico, emoção, vibrante',
    exists: false,
  },

  // ========================================================================
  // ILUSTRAÇÕES — Empty States
  // ========================================================================
  {
    id: 'empty-stadium',
    name: 'Empty Stadium Illustration',
    category: 'illustration',
    priority: 'medium',
    dimensions: {
      desktop: '400×300px',
    },
    path: '/public/assets/illustrations/empty-stadium.svg',
    prompt: `Minimalist isometric line art illustration of empty football stadium,
    simple geometric shapes, neon yellow (#FBE100) stroke lines on pure black (#0A0A0A) background,
    2px line weight, clean vector style, professional UI design, modern aesthetic`,
    usage: 'Empty state quando não há histórico de partidas',
    colorPalette: ['#FBE100', '#0A0A0A'],
    style: 'Line art, isométrico, minimalista',
    exists: false,
  },
  {
    id: 'empty-locker',
    name: 'Empty Locker Illustration',
    category: 'illustration',
    priority: 'low',
    dimensions: {
      desktop: '400×300px',
    },
    path: '/public/assets/illustrations/empty-locker.svg',
    prompt: `Minimalist isometric line art of empty soccer locker room,
    neon yellow (#FBE100) lines on black (#0A0A0A),
    2px stroke, clean vector, professional UI design`,
    usage: 'Empty state quando plantel está vazio',
    colorPalette: ['#FBE100', '#0A0A0A'],
    style: 'Line art, isométrico, minimalista',
    exists: false,
  },
  {
    id: 'locked-trophy',
    name: 'Locked Trophy Illustration',
    category: 'illustration',
    priority: 'low',
    dimensions: {
      desktop: '400×300px',
    },
    path: '/public/assets/illustrations/locked-trophy.svg',
    prompt: `Minimalist line art of trophy with padlock,
    neon yellow (#FBE100) stroke on black (#0A0A0A),
    2px line weight, clean vector, professional UI design`,
    usage: 'Troféus ainda não conquistados',
    colorPalette: ['#FBE100', '#0A0A0A'],
    style: 'Line art, minimalista',
    exists: false,
  },

  // ========================================================================
  // UI ELEMENTS
  // ========================================================================
  {
    id: 'loading-ball',
    name: 'Loading Ball Animation',
    category: 'ui',
    priority: 'medium',
    dimensions: {
      desktop: '128×128px',
    },
    path: '/public/assets/ui/loading-ball.webp',
    prompt: `Animated soccer ball spinning, clean design,
    neon yellow (#FBE100) accents, transparent background,
    suitable for loading animation, 8K quality`,
    usage: 'Loading states, transições',
    colorPalette: ['#FBE100', '#000000', '#FFFFFF'],
    style: 'Limpo, animável, transparente',
    exists: false,
  },
  {
    id: 'trophy-gold',
    name: 'Trophy Gold 3D',
    category: 'ui',
    priority: 'low',
    dimensions: {
      desktop: '512×512px',
    },
    path: '/public/assets/ui/trophy-gold.webp',
    prompt: `3D render of elegant golden trophy cup, polished gold material,
    pure black (#0A0A0A) background, studio three-point lighting,
    professional product visualization, octane render, 8K photorealistic`,
    usage: 'Troféu de 1º lugar, conquistas',
    colorPalette: ['#FBE100', '#0A0A0A'],
    style: '3D render, luxo, fotorrealista',
    exists: false,
  },

  // ========================================================================
  // SOCIAL MEDIA
  // ========================================================================
  {
    id: 'og-image',
    name: 'Open Graph Image',
    category: 'social',
    priority: 'high',
    dimensions: {
      desktop: '1200×630px',
    },
    path: '/public/assets/social/og-image.webp',
    prompt: `Social media banner for football manager game,
    Olefoot logo prominent, futuristic stadium background,
    neon yellow (#FBE100) and black (#0A0A0A) color scheme,
    professional esports aesthetic, 8K quality`,
    usage: 'Meta tag og:image para compartilhamento',
    colorPalette: ['#FBE100', '#0A0A0A', '#FFFFFF'],
    style: 'Marketing, profissional, impactante',
    exists: false,
  },
  {
    id: 'twitter-card',
    name: 'Twitter Card',
    category: 'social',
    priority: 'medium',
    dimensions: {
      desktop: '1200×600px',
    },
    path: '/public/assets/social/twitter-card.webp',
    prompt: `Twitter card for football manager game,
    Olefoot branding, stadium atmosphere,
    neon yellow (#FBE100) highlights, professional design, 8K`,
    usage: 'Meta tag twitter:image',
    colorPalette: ['#FBE100', '#0A0A0A', '#FFFFFF'],
    style: 'Marketing, social media',
    exists: false,
  },
];

export function AdminCreativePanel() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [checkingFiles, setCheckingFiles] = useState(false);
  const [assetStatus, setAssetStatus] = useState<Record<string, boolean>>({});

  // Verificar quais assets existem
  useEffect(() => {
    checkExistingAssets();
  }, []);

  const checkExistingAssets = async () => {
    setCheckingFiles(true);
    const status: Record<string, boolean> = {};

    for (const asset of CREATIVE_ASSETS) {
      try {
        // Tentar carregar a imagem para ver se existe
        const response = await fetch(asset.path.replace('/public', ''));
        status[asset.id] = response.ok;
      } catch {
        status[asset.id] = false;
      }
    }

    setAssetStatus(status);
    setCheckingFiles(false);
  };

  const categories = [
    { id: 'all', label: 'Todos', count: CREATIVE_ASSETS.length },
    { id: 'background', label: 'Backgrounds', count: CREATIVE_ASSETS.filter(a => a.category === 'background').length },
    { id: 'match', label: 'Match', count: CREATIVE_ASSETS.filter(a => a.category === 'match').length },
    { id: 'illustration', label: 'Ilustrações', count: CREATIVE_ASSETS.filter(a => a.category === 'illustration').length },
    { id: 'ui', label: 'UI Elements', count: CREATIVE_ASSETS.filter(a => a.category === 'ui').length },
    { id: 'social', label: 'Social Media', count: CREATIVE_ASSETS.filter(a => a.category === 'social').length },
  ];

  const filteredAssets = selectedCategory === 'all'
    ? CREATIVE_ASSETS
    : CREATIVE_ASSETS.filter(a => a.category === selectedCategory);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openInFinder = (assetPath: string) => {
    // Converter caminho para formato do sistema
    const systemPath = assetPath.replace('/public/', '');
    alert(`📂 Salve sua imagem em:\n\n${assetPath}\n\nOu arraste para:\npublic${systemPath}`);
  };

  const priorityColors = {
    critical: 'text-red-400 bg-red-500/10 border-red-500/30',
    high: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    medium: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    low: 'text-gray-400 bg-gray-500/10 border-gray-500/30',
  };

  const priorityLabels = {
    critical: 'Crítico',
    high: 'Alto',
    medium: 'Médio',
    low: 'Baixo',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl font-black uppercase tracking-wide text-white">
            <Sparkles className="h-6 w-6 text-neon-yellow" />
            Creative Assets
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            Todos os banners e imagens que precisam ser criados para o Olefoot.
            <br />
            Gere manualmente e salve em <code className="rounded bg-white/5 px-1 py-0.5 text-neon-yellow">/public</code>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={checkExistingAssets}
            disabled={checkingFiles}
            className={cn(
              'inline-flex items-center gap-2 rounded border px-3 py-2 text-sm font-bold uppercase tracking-wider transition-all',
              checkingFiles
                ? 'border-neon-yellow/40 bg-neon-yellow/10 text-neon-yellow cursor-wait'
                : 'border-white/20 bg-black/40 text-white hover:border-neon-yellow/40 hover:text-neon-yellow',
            )}
          >
            <RefreshCw className={cn('h-4 w-4', checkingFiles && 'animate-spin')} />
            {checkingFiles ? 'Verificando...' : 'Verificar'}
          </button>
          <div className="flex items-center gap-2 rounded border border-white/10 bg-black/40 px-3 py-2">
            <FileImage className="h-4 w-4 text-neon-yellow" />
            <span className="text-sm font-bold text-white">{Object.values(assetStatus).filter(Boolean).length}/{CREATIVE_ASSETS.length}</span>
            <span className="text-xs text-gray-500">prontos</span>
          </div>
        </div>
      </div>

      {/* Filtros por Categoria */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded border px-3 py-2 text-sm font-bold uppercase tracking-wider transition-all',
              selectedCategory === cat.id
                ? 'border-neon-yellow bg-neon-yellow/15 text-neon-yellow'
                : 'border-white/10 bg-black/30 text-gray-400 hover:border-white/20 hover:text-white',
            )}
          >
            {cat.label}
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-black',
                selectedCategory === cat.id
                  ? 'bg-neon-yellow text-black'
                  : 'bg-white/10 text-gray-500',
              )}
            >
              {cat.count}
            </span>
          </button>
        ))}
      </div>

      {/* Grid de Assets */}
      <div className="grid gap-4 lg:grid-cols-2">
        {filteredAssets.map((asset, idx) => (
          <motion.div
            key={asset.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={cn(
              'relative overflow-hidden rounded-lg border bg-gradient-to-br from-black/60 to-black/40 p-5',
              asset.exists
                ? 'border-emerald-500/30'
                : 'border-white/10',
            )}
          >
            {/* Status Badge */}
            {assetStatus[asset.id] && (
              <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1">
                <CheckCircle className="h-3 w-3 text-emerald-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Existe
                </span>
              </div>
            )}

            {/* Header */}
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex-1">
                <h3 className="font-display text-lg font-black uppercase tracking-wide text-white">
                  {asset.name}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                      priorityColors[asset.priority],
                    )}
                  >
                    {priorityLabels[asset.priority]}
                  </span>
                  <span className="text-xs text-gray-500">
                    {asset.category}
                  </span>
                </div>
              </div>

              {/* Botão Abrir Pasta */}
              <button
                onClick={() => openInFinder(asset.path)}
                className="inline-flex items-center gap-1.5 rounded border border-neon-yellow/60 bg-neon-yellow/15 px-3 py-2 text-xs font-bold uppercase tracking-wider text-neon-yellow transition-all hover:bg-neon-yellow/25"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Onde Salvar
              </button>
            </div>

            {/* Dimensões */}
            <div className="mb-4 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Dimensões
              </p>
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1.5 rounded border border-white/10 bg-black/40 px-2 py-1">
                  <Monitor className="h-3 w-3 text-neon-yellow" />
                  <span className="text-xs font-mono text-white">
                    {asset.dimensions.desktop}
                  </span>
                </div>
                {asset.dimensions.tablet && (
                  <div className="flex items-center gap-1.5 rounded border border-white/10 bg-black/40 px-2 py-1">
                    <Tablet className="h-3 w-3 text-blue-400" />
                    <span className="text-xs font-mono text-white">
                      {asset.dimensions.tablet}
                    </span>
                  </div>
                )}
                {asset.dimensions.mobile && (
                  <div className="flex items-center gap-1.5 rounded border border-white/10 bg-black/40 px-2 py-1">
                    <Smartphone className="h-3 w-3 text-emerald-400" />
                    <span className="text-xs font-mono text-white">
                      {asset.dimensions.mobile}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Path */}
            <div className="mb-4">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Caminho
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded border border-white/10 bg-black/60 px-2 py-1.5 font-mono text-xs text-neon-yellow">
                  {asset.path}
                </code>
                <button
                  onClick={() => copyToClipboard(asset.path, `path-${asset.id}`)}
                  className="rounded border border-white/10 bg-black/40 p-1.5 text-gray-400 transition-colors hover:border-neon-yellow/40 hover:text-neon-yellow"
                  title="Copiar caminho"
                >
                  {copiedId === `path-${asset.id}` ? (
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Uso */}
            <div className="mb-4">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Onde usar
              </p>
              <p className="text-xs leading-relaxed text-gray-300">
                {asset.usage}
              </p>
            </div>

            {/* Paleta de Cores */}
            <div className="mb-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Paleta de cores
              </p>
              <div className="flex gap-2">
                {asset.colorPalette.map((color) => (
                  <div
                    key={color}
                    className="group relative cursor-pointer"
                    onClick={() => copyToClipboard(color, `color-${asset.id}-${color}`)}
                  >
                    <div
                      className="h-8 w-8 rounded border-2 border-white/20 transition-transform hover:scale-110"
                      style={{ backgroundColor: color }}
                    />
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black px-2 py-1 text-[10px] font-mono text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {color}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Estilo */}
            <div className="mb-4">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Estilo visual
              </p>
              <p className="text-xs text-gray-400">{asset.style}</p>
            </div>

            {/* Prompt */}
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                <Palette className="h-3 w-3" />
                Prompt sugerido
              </p>
              <div className="relative">
                <div className="max-h-32 overflow-y-auto rounded border border-white/10 bg-black/60 p-3">
                  <p className="text-xs leading-relaxed text-gray-300">
                    {asset.prompt}
                  </p>
                </div>
                <button
                  onClick={() => copyToClipboard(asset.prompt, `prompt-${asset.id}`)}
                  className="absolute right-2 top-2 rounded border border-white/10 bg-black/80 p-1.5 text-gray-400 transition-colors hover:border-neon-yellow/40 hover:text-neon-yellow"
                  title="Copiar prompt"
                >
                  {copiedId === `prompt-${asset.id}` ? (
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Footer Info */}
      <div className="rounded-lg border border-neon-yellow/20 bg-neon-yellow/5 p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 shrink-0 text-neon-yellow" />
          <div className="flex-1 space-y-2 text-sm text-gray-300">
            <p className="font-bold text-white">Como usar:</p>
            <ol className="list-inside list-decimal space-y-1 text-xs">
              <li>Copie o <strong>prompt sugerido</strong> do asset que quer criar</li>
              <li>Gere a imagem usando Freepik, Midjourney, DALL-E ou outra ferramenta</li>
              <li>Salve a imagem no <strong>caminho indicado</strong> em <code className="rounded bg-white/10 px-1 py-0.5 text-neon-yellow">/public</code></li>
              <li>Converta para WebP se possível (melhor performance)</li>
              <li>Gere versões responsivas (tablet, mobile) quando indicado</li>
            </ol>
            <p className="mt-3 text-[11px] text-gray-500">
              💡 <strong>Workflow:</strong>
            </p>
            <ol className="list-inside list-decimal space-y-1 text-xs mt-2">
              <li>Clique em <strong>"Onde Salvar"</strong> para ver o caminho</li>
              <li>Copie o <strong>prompt sugerido</strong></li>
              <li>Gere a imagem no Freepik, Midjourney, DALL-E, etc</li>
              <li>Salve a imagem no caminho indicado (dentro de <code className="rounded bg-white/10 px-1 py-0.5 text-neon-yellow">/public</code>)</li>
              <li>Clique em <strong>"Verificar"</strong> para atualizar o status</li>
            </ol>
            <p className="mt-3 text-[11px] text-gray-500">
              🎨 <strong>Dica:</strong> Use sempre a paleta de cores Olefoot (#FBE100 amarelo neon + #0A0A0A preto profundo) para manter identidade visual consistente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
