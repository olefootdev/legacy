/**
 * Font Loading Strategy — Olefoot
 *
 * Garante que as fontes da identidade visual sejam carregadas
 * corretamente em todos os navegadores, com fallbacks robustos.
 */

// Fontes críticas da identidade Olefoot
const CRITICAL_FONTS = [
  { family: 'Inter', weight: '400', style: 'normal' },
  { family: 'Inter', weight: '700', style: 'normal' },
  { family: 'Oswald', weight: '700', style: 'normal' },
  { family: 'Montserrat', weight: '800', style: 'normal' },
];

// Timeout para carregamento de fontes (3 segundos)
const FONT_LOAD_TIMEOUT = 3000;

/**
 * Verifica se uma fonte está carregada
 */
async function checkFontLoaded(family: string, weight: string, style: string): Promise<boolean> {
  if (!('fonts' in document)) {
    console.warn('[fonts] Font Loading API não disponível');
    return false;
  }

  try {
    await document.fonts.load(`${style} ${weight} 16px "${family}"`);
    return document.fonts.check(`${style} ${weight} 16px "${family}"`);
  } catch (err) {
    console.error(`[fonts] Erro ao verificar ${family}:`, err);
    return false;
  }
}

/**
 * Carrega fontes críticas com timeout
 */
async function loadCriticalFonts(): Promise<void> {
  if (!('fonts' in document)) {
    console.warn('[fonts] Font Loading API não disponível, usando fallbacks');
    return;
  }

  const loadPromises = CRITICAL_FONTS.map(async (font) => {
    try {
      const loaded = await Promise.race([
        checkFontLoaded(font.family, font.weight, font.style),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), FONT_LOAD_TIMEOUT)),
      ]);

      if (!loaded) {
        console.warn(`[fonts] Timeout ao carregar ${font.family} ${font.weight}`);
      } else {
        console.log(`[fonts] ✓ ${font.family} ${font.weight} carregada`);
      }

      return loaded;
    } catch (err) {
      console.error(`[fonts] Erro ao carregar ${font.family}:`, err);
      return false;
    }
  });

  const results = await Promise.all(loadPromises);
  const successCount = results.filter(Boolean).length;

  console.log(`[fonts] ${successCount}/${CRITICAL_FONTS.length} fontes críticas carregadas`);

  // Se nenhuma fonte crítica foi carregada, adiciona classe de fallback
  if (successCount === 0) {
    document.documentElement.classList.add('fonts-fallback');
    console.warn('[fonts] Usando fontes de sistema (fallback)');
  } else {
    document.documentElement.classList.add('fonts-loaded');
  }
}

/**
 * Monitora carregamento de fontes e adiciona classe quando pronto
 */
export function initFontLoading(): void {
  // Adiciona classe inicial
  document.documentElement.classList.add('fonts-loading');

  // Carrega fontes críticas
  loadCriticalFonts()
    .then(() => {
      document.documentElement.classList.remove('fonts-loading');
    })
    .catch((err) => {
      console.error('[fonts] Erro fatal ao carregar fontes:', err);
      document.documentElement.classList.remove('fonts-loading');
      document.documentElement.classList.add('fonts-fallback');
    });

  // Listener para quando todas as fontes terminarem de carregar
  if ('fonts' in document) {
    document.fonts.ready.then(() => {
      console.log('[fonts] Todas as fontes carregadas');
    });
  }
}

/**
 * Verifica se as fontes estão carregadas (para uso em componentes)
 */
export function areFontsLoaded(): boolean {
  return document.documentElement.classList.contains('fonts-loaded');
}

/**
 * Aguarda até que as fontes estejam carregadas
 */
export async function waitForFonts(timeout = 5000): Promise<boolean> {
  if (areFontsLoaded()) return true;

  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (areFontsLoaded()) {
        clearInterval(checkInterval);
        clearTimeout(timeoutId);
        resolve(true);
      }
    }, 100);

    const timeoutId = setTimeout(() => {
      clearInterval(checkInterval);
      resolve(false);
    }, timeout);
  });
}
