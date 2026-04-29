import { useState } from 'react';
import { LegacyPlayerCard, type LegacyPlayerCardStats } from '@/components/legacy/LegacyPlayerCard';

/**
 * Sandbox visual do <LegacyPlayerCard /> — `/dev/legacy-card`.
 *
 * Permite ajustar campos e ver o card em diferentes tamanhos. Não plugado
 * em nenhum fluxo real — só validação de design contra o PDF de referência.
 */

const SAMPLE_STATS: LegacyPlayerCardStats = {
  pac: 86,
  sho: 84,
  pas: 88,
  dri: 90,
  def: 66,
  phy: 85,
};

const SAMPLE_VARIANTS = [
  {
    name: 'Legadão',
    position: 'CAM',
    ovr: 88,
    countryEmoji: '🇧🇷',
    edition: { current: 1, total: 77 },
  },
  {
    name: 'Iniciado',
    position: 'GOL',
    ovr: 67,
    countryEmoji: '🇧🇷',
    edition: { current: 12, total: 250 },
  },
  {
    name: 'Mestre',
    position: 'ATA',
    ovr: 92,
    countryEmoji: '🇦🇷',
    edition: { current: 7, total: 50 },
  },
] as const;

export function LegacyCardPreview() {
  const [variantIdx, setVariantIdx] = useState(0);
  const [withPhoto, setWithPhoto] = useState(false);
  const variant = SAMPLE_VARIANTS[variantIdx]!;

  return (
    <div
      className="min-h-screen w-full"
      style={{
        background: 'radial-gradient(ellipse at top, #1A1A1A 0%, #0D0D0D 70%, #000000 100%)',
        padding: '40px 20px 80px',
      }}
    >
      <div className="max-w-[1200px] mx-auto flex flex-col gap-8">
        {/* Header */}
        <header className="flex flex-col gap-2">
          <div
            className="font-display uppercase text-neon-yellow"
            style={{ fontSize: 11, letterSpacing: '0.4em' }}
          >
            Olefoot · Design System · Legacy
          </div>
          <h1
            className="font-serif-hero italic text-white"
            style={{ fontSize: 48, lineHeight: 1, letterSpacing: '-0.01em' }}
          >
            Card Legadão <span className="text-neon-yellow">SVG</span>
          </h1>
          <p className="text-white/60 max-w-[560px]" style={{ fontSize: 14, lineHeight: 1.5 }}>
            Sandbox isolado para validar a referência visual do PDF
            <code className="text-neon-yellow/80 mx-1">olefoot-legacy-design.pdf</code>
            antes de plugar nos chapters da cerimônia.
          </p>
        </header>

        {/* Controles */}
        <div className="flex flex-wrap gap-3 items-center">
          <span
            className="font-display uppercase text-white/50"
            style={{ fontSize: 11, letterSpacing: '0.3em' }}
          >
            Variante:
          </span>
          {SAMPLE_VARIANTS.map((v, i) => (
            <button
              key={v.name}
              type="button"
              onClick={() => setVariantIdx(i)}
              className="font-display uppercase tracking-wider px-4 py-2 -skew-x-6 transition-all"
              style={{
                background: i === variantIdx ? 'var(--color-neon-yellow)' : 'rgba(255,255,255,0.06)',
                color: i === variantIdx ? '#000' : 'rgba(255,255,255,0.85)',
                border: '1px solid rgba(255,255,255,0.12)',
                fontSize: 12,
                letterSpacing: '0.18em',
              }}
            >
              <span className="inline-block skew-x-6">{v.name}</span>
            </button>
          ))}
          <span className="mx-3 text-white/20">|</span>
          <button
            type="button"
            onClick={() => setWithPhoto((p) => !p)}
            className="font-display uppercase tracking-wider px-4 py-2 -skew-x-6 transition-all"
            style={{
              background: withPhoto ? 'var(--color-neon-yellow)' : 'rgba(255,255,255,0.06)',
              color: withPhoto ? '#000' : 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(255,255,255,0.12)',
              fontSize: 12,
              letterSpacing: '0.18em',
            }}
          >
            <span className="inline-block skew-x-6">
              {withPhoto ? 'Com foto' : 'Sem foto'}
            </span>
          </button>
        </div>

        {/* Cards em 3 tamanhos */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px_180px] gap-8 items-start">
          {/* Tamanho hero */}
          <div className="flex flex-col gap-3">
            <div
              className="font-display uppercase text-white/40"
              style={{ fontSize: 10, letterSpacing: '0.3em' }}
            >
              Hero (Top 3 / Reveal)
            </div>
            <div style={{ maxWidth: 560 }}>
              <LegacyPlayerCard
                name={variant.name}
                position={variant.position}
                ovr={variant.ovr}
                countryEmoji={variant.countryEmoji}
                edition={variant.edition}
                stats={SAMPLE_STATS}
                photoUrl={withPhoto ? '/hero-legacy-full.png' : null}
              />
            </div>
          </div>

          {/* Tamanho médio */}
          <div className="flex flex-col gap-3">
            <div
              className="font-display uppercase text-white/40"
              style={{ fontSize: 10, letterSpacing: '0.3em' }}
            >
              Médio (Plantel)
            </div>
            <LegacyPlayerCard
              name={variant.name}
              position={variant.position}
              ovr={variant.ovr}
              countryEmoji={variant.countryEmoji}
              edition={variant.edition}
              stats={SAMPLE_STATS}
              photoUrl={withPhoto ? '/hero-legacy-full.png' : null}
            />
          </div>

          {/* Mini */}
          <div className="flex flex-col gap-3">
            <div
              className="font-display uppercase text-white/40"
              style={{ fontSize: 10, letterSpacing: '0.3em' }}
            >
              Mini (Pioneiros)
            </div>
            <LegacyPlayerCard
              name={variant.name}
              position={variant.position}
              ovr={variant.ovr}
              countryEmoji={variant.countryEmoji}
              edition={variant.edition}
              stats={SAMPLE_STATS}
              photoUrl={withPhoto ? '/hero-legacy-full.png' : null}
            />
          </div>
        </div>

        {/* Notas de design */}
        <div
          className="border border-white/10 p-5 flex flex-col gap-2"
          style={{ background: 'rgba(255,255,255,0.02)' }}
        >
          <div
            className="font-display uppercase text-neon-yellow"
            style={{ fontSize: 11, letterSpacing: '0.35em' }}
          >
            Próximos passos
          </div>
          <ol className="text-white/70 list-decimal pl-5 flex flex-col gap-1" style={{ fontSize: 13, lineHeight: 1.6 }}>
            <li>Validar tipografia (font-display + font-serif-hero) e alinhamento de bordas dourado.</li>
            <li>Plugar no Top3Chapter (variante hero) e SquadDraftChapter (variante mini).</li>
            <li>Reaplicar a paleta nos chapters de Roleta, Daily Bonus e Outro.</li>
            <li>Substituir backdrop por arte custom de coliseu/torcida (asset futuro).</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
