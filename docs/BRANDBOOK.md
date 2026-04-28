<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Oswald:wght@400;500;600;700&family=Playfair+Display:ital,wght@1,500;1,700;1,900&display=swap');

:root {
  --neon-yellow: #FDE100;
  --deep-black: #0D0D0D;
  --dark-gray: #1A1A1A;
  --success: #22C55E;
  --warning: #F59E0B;
  --danger: #EF4444;
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-display: 'Oswald', 'Impact', sans-serif;
  --font-serif: 'Playfair Display', 'Georgia', serif;
}

* { box-sizing: border-box; }

body {
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.55;
  color: #fff;
  background: var(--deep-black);
  margin: 0;
  padding: 0;
}

h1, h2, h3, h4 { margin: 0; font-weight: 700; }
p { margin: 0; }

/* Quebras de página */
.page {
  page-break-after: always;
  min-height: 100vh;
  padding: 56px 56px 64px;
  background: var(--deep-black);
}
.page:last-child { page-break-after: auto; }

.page-cover {
  background: var(--neon-yellow);
  color: var(--deep-black);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
  overflow: hidden;
}

.page-cover::before {
  content: 'OLEFOOT';
  position: absolute;
  bottom: -80px;
  left: -20px;
  font-family: var(--font-display);
  font-weight: 900;
  font-size: 380px;
  line-height: 0.85;
  color: rgba(0,0,0,0.05);
  letter-spacing: -0.04em;
  white-space: nowrap;
}

.cover-top { position: relative; z-index: 2; }
.cover-bottom { position: relative; z-index: 2; }

.eyebrow {
  font-family: var(--font-display);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.32em;
  font-size: 11px;
}
.eyebrow-yellow { color: var(--neon-yellow); }
.eyebrow-black  { color: var(--deep-black); }

.headline-moret {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 0.95;
}

.section-title {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 700;
  font-size: 38px;
  color: var(--neon-yellow);
  letter-spacing: -0.02em;
  line-height: 1;
  margin-bottom: 8px;
}
.section-rule {
  width: 48px;
  height: 3px;
  background: var(--neon-yellow);
  margin-bottom: 28px;
}
.section-intro {
  font-family: var(--font-sans);
  color: rgba(255,255,255,0.65);
  font-size: 14px;
  max-width: 580px;
  margin-bottom: 36px;
  line-height: 1.6;
}

.divider-yellow {
  height: 1px;
  background: linear-gradient(to right, transparent, rgba(253,225,0,0.55), transparent);
  margin: 28px 0;
}

/* Color swatches */
.palette-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  margin-bottom: 26px;
}
.swatch {
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.08);
}
.swatch-color {
  height: 120px;
  position: relative;
}
.swatch-info {
  padding: 14px 16px;
  background: var(--dark-gray);
}
.swatch-name {
  font-family: var(--font-display);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 11px;
  color: #fff;
}
.swatch-hex {
  font-family: var(--font-sans);
  font-weight: 500;
  font-size: 12px;
  color: rgba(255,255,255,0.55);
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
}
.swatch-token {
  font-family: var(--font-sans);
  font-size: 11px;
  color: rgba(255,255,255,0.35);
  margin-top: 2px;
  font-style: italic;
}

/* Type specimens */
.type-spec {
  border-left: 3px solid var(--neon-yellow);
  padding: 18px 22px;
  margin-bottom: 16px;
  background: var(--dark-gray);
  border-radius: 4px;
}
.type-meta {
  font-family: var(--font-display);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  font-size: 10px;
  color: var(--neon-yellow);
  margin-bottom: 8px;
}
.type-sample-moret {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.02em;
  line-height: 1;
  margin-bottom: 6px;
}
.type-sample-display {
  font-family: var(--font-display);
  font-weight: 800;
  text-transform: uppercase;
  color: #fff;
  letter-spacing: 0.18em;
  margin-bottom: 6px;
}
.type-sample-inter {
  font-family: var(--font-sans);
  color: #fff;
  margin-bottom: 6px;
}
.type-rule {
  font-family: var(--font-sans);
  font-size: 11px;
  color: rgba(255,255,255,0.5);
  font-weight: 500;
}

/* Buttons */
.btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  align-items: center;
  margin-bottom: 18px;
}
.btn-primary {
  background: var(--neon-yellow);
  color: var(--deep-black);
  font-family: var(--font-display);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.24em;
  font-size: 12px;
  padding: 13px 26px;
  border: none;
  border-radius: 4px;
  box-shadow: 0 8px 24px rgba(253,225,0,0.18);
  display: inline-block;
}
.btn-outline {
  border: 1px solid rgba(255,255,255,0.20);
  background: rgba(13,13,13,0.6);
  color: rgba(255,255,255,0.85);
  font-family: var(--font-display);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.24em;
  font-size: 12px;
  padding: 13px 26px;
  border-radius: 4px;
  display: inline-block;
}
.btn-pill-social {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 2px solid var(--deep-black);
  background: rgba(0,0,0,0.1);
  color: var(--deep-black);
  font-family: var(--font-display);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  font-size: 11px;
  padding: 9px 16px;
  border-radius: 9999px;
}
.btn-ghost-link {
  color: rgba(255,255,255,0.55);
  font-family: var(--font-display);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  font-size: 11px;
  text-decoration: none;
}

.btn-on-yellow {
  background: var(--neon-yellow);
  padding: 18px 22px;
  border-radius: 6px;
  display: inline-block;
}

/* Cards */
.card-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  margin-bottom: 26px;
}
.card-demo {
  border: 1px solid rgba(255,255,255,0.08);
  border-left: 3px solid var(--neon-yellow);
  background: var(--dark-gray);
  border-radius: 8px;
  padding: 20px;
}
.card-demo .label {
  font-family: var(--font-display);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  font-size: 10px;
  color: var(--neon-yellow);
  margin-bottom: 10px;
}
.card-demo .num {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 700;
  font-size: 36px;
  color: var(--neon-yellow);
  letter-spacing: -0.02em;
  line-height: 1;
}
.card-demo .name {
  font-family: var(--font-display);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 14px;
  color: #fff;
  margin-top: 4px;
}

.card-row {
  display: flex;
  border: 1px solid rgba(255,255,255,0.08);
  border-left: 3px solid var(--neon-yellow);
  background: var(--dark-gray);
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 12px;
}
.card-row .photo {
  width: 96px;
  background: linear-gradient(135deg, #2a2a2a 0%, #0a0a0a 100%);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.card-row .photo .ovr {
  position: absolute;
  top: 8px;
  left: 10px;
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 700;
  font-size: 28px;
  color: var(--neon-yellow);
  line-height: 1;
  letter-spacing: -0.04em;
  text-shadow: 0 3px 8px rgba(0,0,0,0.95);
}
.card-row .photo .silhouette {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 700;
  font-size: 56px;
  color: rgba(255,255,255,0.15);
}
.card-row .pos-chip {
  position: absolute;
  bottom: 6px;
  left: 6px;
  background: rgba(0,0,0,0.75);
  color: rgba(255,255,255,0.9);
  font-family: var(--font-display);
  font-weight: 700;
  text-transform: uppercase;
  font-size: 9px;
  letter-spacing: 0.18em;
  padding: 2px 6px;
}
.card-row .info {
  flex: 1;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}
.card-row .info .player-name {
  font-family: var(--font-display);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 14px;
  color: #fff;
  line-height: 1.1;
}
.card-row .info .player-meta {
  font-family: var(--font-display);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  font-size: 10px;
  color: rgba(255,255,255,0.45);
  margin-top: 6px;
}
.card-row .impact {
  align-self: center;
  padding-right: 18px;
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 700;
  font-size: 22px;
  color: var(--neon-yellow);
  letter-spacing: -0.02em;
}

/* Page archetypes */
.archetype-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.archetype {
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  overflow: hidden;
  background: var(--dark-gray);
}
.archetype-preview {
  height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  position: relative;
  overflow: hidden;
}
.archetype-preview.hero {
  background: var(--neon-yellow);
  color: var(--deep-black);
}
.archetype-preview.catalog {
  background: var(--deep-black);
  border: 1px solid rgba(253,225,0,0.15);
}
.archetype-preview.hub {
  background: linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%);
}
.archetype-preview.live {
  background: var(--deep-black);
  background-image: radial-gradient(circle at 50% 30%, rgba(253,225,0,0.1) 0%, transparent 60%);
}
.archetype-info {
  padding: 14px 18px;
  border-top: 1px solid rgba(253,225,0,0.18);
}
.archetype-info .name {
  font-family: var(--font-display);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 11px;
  color: var(--neon-yellow);
}
.archetype-info .desc {
  font-family: var(--font-sans);
  font-size: 12px;
  color: rgba(255,255,255,0.55);
  margin-top: 6px;
  line-height: 1.5;
}

/* Mini hero in archetype */
.mini-hero h3 {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 700;
  font-size: 38px;
  letter-spacing: -0.02em;
  line-height: 0.9;
}
.mini-hero .photo {
  width: 70px;
  height: 90px;
  background: rgba(0,0,0,0.85);
  position: relative;
}
.mini-hero .photo .ovr-mini {
  position: absolute;
  top: 4px;
  left: 6px;
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 700;
  font-size: 18px;
  color: var(--neon-yellow);
  line-height: 1;
}
.mini-hero .eyebrow-mini {
  font-family: var(--font-display);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.32em;
  font-size: 9px;
}

.mini-row {
  display: flex;
  gap: 8px;
  width: 80%;
}
.mini-row .item {
  flex: 1;
  height: 18px;
  background: var(--dark-gray);
  border-left: 2px solid var(--neon-yellow);
  border-radius: 2px;
}

/* Don'ts/Do's */
.do-dont {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.dd-card {
  padding: 16px 18px;
  border-radius: 6px;
}
.dd-do {
  border-left: 3px solid var(--success);
  background: rgba(34,197,94,0.06);
}
.dd-dont {
  border-left: 3px solid var(--danger);
  background: rgba(239,68,68,0.06);
}
.dd-card .head {
  font-family: var(--font-display);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  font-size: 10px;
  margin-bottom: 8px;
}
.dd-do .head { color: var(--success); }
.dd-dont .head { color: var(--danger); }
.dd-card .body {
  font-family: var(--font-sans);
  font-size: 13px;
  color: rgba(255,255,255,0.85);
  line-height: 1.5;
}

/* Footer */
.brand-footer {
  margin-top: 56px;
  padding-top: 24px;
  border-top: 1px solid rgba(255,255,255,0.08);
  display: flex;
  justify-content: space-between;
  font-family: var(--font-display);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  font-size: 9px;
  color: rgba(255,255,255,0.35);
}

/* Page-number footer for cover */
.cover-footer-meta {
  display: flex;
  justify-content: space-between;
  font-family: var(--font-display);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.32em;
  font-size: 10px;
}
</style>

<!-- ─────────────────────────────────────────── PAGE 1: COVER ─────────────────────── -->
<div class="page page-cover">
  <div class="cover-top">
    <div class="cover-footer-meta">
      <span>Olefoot · Game</span>
      <span>v1.0 — Abr/2026</span>
    </div>
  </div>
  <div class="cover-bottom" style="margin-bottom: 40px;">
    <span class="eyebrow eyebrow-black">— Brandbook —</span>
    <h1 class="headline-moret" style="font-size: 96px; color: var(--deep-black); margin-top: 18px; margin-bottom: 18px;">
      Legacy Tech
    </h1>
    <div style="width: 60px; height: 4px; background: var(--deep-black); margin-bottom: 22px;"></div>
    <p style="font-family: var(--font-sans); font-size: 16px; line-height: 1.45; color: rgba(0,0,0,0.75); max-width: 460px; font-weight: 500;">
      Manual visual da Olefoot. Cores, tipografia, componentes e princípios
      do museu vivo do futebol.
    </p>
    <div style="margin-top: 36px; display: inline-block; background: var(--deep-black); color: var(--neon-yellow); padding: 16px 32px; border-radius: 4px; font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.32em; font-size: 12px;">
      Manual de Identidade
    </div>
  </div>
</div>

<!-- ─────────────────────────────────────────── PAGE 2: FILOSOFIA ─────────────────────── -->
<div class="page">
  <div class="eyebrow eyebrow-yellow" style="margin-bottom: 14px;">— Cap. 01 · Filosofia —</div>
  <h2 class="section-title">A síntese Legacy Tech</h2>
  <div class="section-rule"></div>
  <p class="section-intro">
    Três correntes destilam o sistema visual da Olefoot. Juntas, entregam um
    produto que <strong style="color:#fff;">respeita o jogador</strong> — hierarquia clara, tipografia
    poderosa, dados legíveis e momentos cinematográficos sem ruído.
  </p>

  <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 18px; margin-bottom: 32px;">
    <div style="padding: 22px; border-left: 3px solid var(--neon-yellow); background: var(--dark-gray); border-radius: 8px;">
      <h3 style="font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.22em; font-size: 11px; color: var(--neon-yellow); margin-bottom: 10px;">BVB Rebrand 2023</h3>
      <p style="font-size: 13px; color: rgba(255,255,255,0.75); line-height: 1.55;">Preto + amarelo neon. Divisores afiados. Tipografia editorial alta intensidade.</p>
    </div>
    <div style="padding: 22px; border-left: 3px solid var(--neon-yellow); background: var(--dark-gray); border-radius: 8px;">
      <h3 style="font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.22em; font-size: 11px; color: var(--neon-yellow); margin-bottom: 10px;">Sorare</h3>
      <p style="font-size: 13px; color: rgba(255,255,255,0.75); line-height: 1.55;">Cards de jogador como protagonistas. OVR em serif italic. Raridade como linguagem.</p>
    </div>
    <div style="padding: 22px; border-left: 3px solid var(--neon-yellow); background: var(--dark-gray); border-radius: 8px;">
      <h3 style="font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.22em; font-size: 11px; color: var(--neon-yellow); margin-bottom: 10px;">Editorial esportivo</h3>
      <p style="font-size: 13px; color: rgba(255,255,255,0.75); line-height: 1.55;">Serif para emoção, sans display para identidade, tabular-nums para dados.</p>
    </div>
  </div>

  <div class="divider-yellow"></div>

  <h3 style="font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.22em; font-size: 12px; color: #fff; margin-bottom: 18px;">Os 6 princípios</h3>
  <ol style="font-family: var(--font-sans); font-size: 14px; color: rgba(255,255,255,0.85); line-height: 1.85; padding-left: 24px;">
    <li>Preto absoluto é o palco, amarelo neon é a luz.</li>
    <li>Moret italic sempre que houver número, nome próprio ou citação.</li>
    <li>Agency uppercase tracking-wide sempre que houver chamada ou label.</li>
    <li>Inter regular sempre que houver leitura corrida.</li>
    <li>Régua amarela 12×3px abre seções; rail amarelo 3px à esquerda marca cards-âncora.</li>
    <li>Não se inventa cor — se não está nos tokens, não vai pro UI.</li>
  </ol>

  <div class="brand-footer">
    <span>Olefoot · Brandbook</span>
    <span>02 / 08</span>
  </div>
</div>

<!-- ─────────────────────────────────────────── PAGE 3: PALETA ─────────────────────── -->
<div class="page">
  <div class="eyebrow eyebrow-yellow" style="margin-bottom: 14px;">— Cap. 02 · Cores —</div>
  <h2 class="section-title">Paleta</h2>
  <div class="section-rule"></div>
  <p class="section-intro">
    A identidade vive em três cores primitivas + um trio de estados. Tudo o
    que está fora desta lista é proibido.
  </p>

  <h3 style="font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.22em; font-size: 11px; color: rgba(255,255,255,0.55); margin-bottom: 14px;">Identidade primária</h3>
  <div class="palette-grid">
    <div class="swatch">
      <div class="swatch-color" style="background: var(--neon-yellow);">
        <span style="position: absolute; bottom: 12px; right: 14px; font-family: var(--font-serif); font-style: italic; font-weight: 700; font-size: 42px; color: rgba(0,0,0,0.85); line-height: 1;">99</span>
      </div>
      <div class="swatch-info">
        <div class="swatch-name">Neon Yellow</div>
        <div class="swatch-hex">#FDE100</div>
        <div class="swatch-token">--color-neon-yellow</div>
      </div>
    </div>
    <div class="swatch">
      <div class="swatch-color" style="background: var(--deep-black);">
        <span style="position: absolute; bottom: 12px; right: 14px; font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.22em; font-size: 11px; color: var(--neon-yellow);">Palco</span>
      </div>
      <div class="swatch-info">
        <div class="swatch-name">Deep Black</div>
        <div class="swatch-hex">#0D0D0D</div>
        <div class="swatch-token">--color-deep-black</div>
      </div>
    </div>
    <div class="swatch">
      <div class="swatch-color" style="background: var(--dark-gray);">
        <span style="position: absolute; bottom: 12px; right: 14px; font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.22em; font-size: 11px; color: rgba(255,255,255,0.65);">Card</span>
      </div>
      <div class="swatch-info">
        <div class="swatch-name">Dark Gray</div>
        <div class="swatch-hex">#1A1A1A</div>
        <div class="swatch-token">--color-dark-gray</div>
      </div>
    </div>
  </div>

  <h3 style="font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.22em; font-size: 11px; color: rgba(255,255,255,0.55); margin: 22px 0 14px;">Estados semânticos</h3>
  <div class="palette-grid">
    <div class="swatch">
      <div class="swatch-color" style="background: var(--success);">
        <span style="position: absolute; bottom: 12px; right: 14px; font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.22em; font-size: 11px; color: rgba(0,0,0,0.85);">Entra</span>
      </div>
      <div class="swatch-info">
        <div class="swatch-name">Success</div>
        <div class="swatch-hex">#22C55E</div>
        <div class="swatch-token">--color-success</div>
      </div>
    </div>
    <div class="swatch">
      <div class="swatch-color" style="background: var(--warning);">
        <span style="position: absolute; bottom: 12px; right: 14px; font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.22em; font-size: 11px; color: rgba(0,0,0,0.85);">Fadiga</span>
      </div>
      <div class="swatch-info">
        <div class="swatch-name">Warning</div>
        <div class="swatch-hex">#F59E0B</div>
        <div class="swatch-token">--color-warning</div>
      </div>
    </div>
    <div class="swatch">
      <div class="swatch-color" style="background: var(--danger);">
        <span style="position: absolute; bottom: 12px; right: 14px; font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.22em; font-size: 11px; color: rgba(255,255,255,0.95);">Lesão</span>
      </div>
      <div class="swatch-info">
        <div class="swatch-name">Danger</div>
        <div class="swatch-hex">#EF4444</div>
        <div class="swatch-token">--color-danger</div>
      </div>
    </div>
  </div>

  <div class="divider-yellow"></div>

  <h3 style="font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.22em; font-size: 11px; color: rgba(255,255,255,0.55); margin-bottom: 14px;">Hierarquia de superfícies</h3>
  <div style="display: flex; gap: 0; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08);">
    <div style="flex: 1; background: var(--deep-black); padding: 18px; text-align: center;">
      <div style="font-family: var(--font-display); font-weight: 700; text-transform: uppercase; letter-spacing: 0.22em; font-size: 9px; color: rgba(255,255,255,0.45);">Página</div>
      <div style="font-family: var(--font-sans); font-size: 11px; color: rgba(255,255,255,0.55); margin-top: 4px;">deep-black</div>
    </div>
    <div style="flex: 1; background: var(--dark-gray); padding: 18px; text-align: center;">
      <div style="font-family: var(--font-display); font-weight: 700; text-transform: uppercase; letter-spacing: 0.22em; font-size: 9px; color: rgba(255,255,255,0.55);">Card</div>
      <div style="font-family: var(--font-sans); font-size: 11px; color: rgba(255,255,255,0.55); margin-top: 4px;">dark-gray</div>
    </div>
    <div style="flex: 1; background: rgba(13,13,13,0.6); padding: 18px; text-align: center;">
      <div style="font-family: var(--font-display); font-weight: 700; text-transform: uppercase; letter-spacing: 0.22em; font-size: 9px; color: rgba(255,255,255,0.55);">Header</div>
      <div style="font-family: var(--font-sans); font-size: 11px; color: rgba(255,255,255,0.55); margin-top: 4px;">deep-black/60</div>
    </div>
    <div style="flex: 1; background: rgba(13,13,13,0.4); padding: 18px; text-align: center;">
      <div style="font-family: var(--font-display); font-weight: 700; text-transform: uppercase; letter-spacing: 0.22em; font-size: 9px; color: rgba(255,255,255,0.55);">Input</div>
      <div style="font-family: var(--font-sans); font-size: 11px; color: rgba(255,255,255,0.55); margin-top: 4px;">deep-black/40</div>
    </div>
  </div>

  <div class="brand-footer">
    <span>Olefoot · Brandbook · Cores</span>
    <span>03 / 08</span>
  </div>
</div>

<!-- ─────────────────────────────────────────── PAGE 4: TIPOGRAFIA ─────────────────────── -->
<div class="page">
  <div class="eyebrow eyebrow-yellow" style="margin-bottom: 14px;">— Cap. 03 · Tipografia —</div>
  <h2 class="section-title">As três famílias</h2>
  <div class="section-rule"></div>
  <p class="section-intro">
    Cada família tem um papel exclusivo. Não se misturam. Moret carrega
    emoção, Agency carrega identidade, Inter carrega informação.
    <em style="color: rgba(255,255,255,0.55);">Substitutos no PDF: Playfair Display, Oswald, Inter.</em>
  </p>

  <div class="type-spec">
    <div class="type-meta">Moret Italic · Serif Hero · Emoção</div>
    <div class="type-sample-moret" style="font-size: 84px;">Pelé</div>
    <div class="type-sample-moret" style="font-size: 48px; color: var(--neon-yellow);">99</div>
    <div class="type-sample-moret" style="font-size: 22px; color: rgba(255,255,255,0.85);">"Eu nasci para jogar futebol."</div>
    <div class="type-rule" style="margin-top: 10px;">Uso: nomes próprios, OVR, score, rating, citações, headlines emocionais. Sempre proper-case ou minúsculo. Letter-spacing −0.02 a −0.04em.</div>
  </div>

  <div class="type-spec">
    <div class="type-meta">Oswald · Display · Identidade</div>
    <div class="type-sample-display" style="font-size: 32px;">TREINAR COM PELÉ</div>
    <div class="type-sample-display" style="font-size: 18px; color: var(--neon-yellow);">DNA DO CAMPEÃO</div>
    <div class="type-sample-display" style="font-size: 11px; letter-spacing: 0.32em; color: rgba(255,255,255,0.55);">— Olefoot · Hall of Fame —</div>
    <div class="type-rule" style="margin-top: 10px;">Uso: CTAs, headlines section, eyebrows, labels, badges, nav. Sempre uppercase + tracking-wide (0.18 – 0.32em). Pesos 700–900.</div>
  </div>

  <div class="type-spec">
    <div class="type-meta">Inter · Sans · Informação</div>
    <div class="type-sample-inter" style="font-size: 18px; font-weight: 600;">A bola está rolando.</div>
    <div class="type-sample-inter" style="font-size: 14px; color: rgba(255,255,255,0.85);">Manda um recado pra Pelé. As mensagens aparecem no museu pra todos os outros managers verem.</div>
    <div class="type-sample-inter" style="font-size: 11px; color: rgba(255,255,255,0.55); font-weight: 500;">Status do jogo · Somos: 1.247 clubes</div>
    <div class="type-rule" style="margin-top: 10px;">Uso: texto corrido, descrições, helper, metadata. Tracking normal (sem letter-spacing). Pesos 400–600.</div>
  </div>

  <div class="brand-footer">
    <span>Olefoot · Brandbook · Tipografia</span>
    <span>04 / 08</span>
  </div>
</div>

<!-- ─────────────────────────────────────────── PAGE 5: COMPONENTES ─────────────────────── -->
<div class="page">
  <div class="eyebrow eyebrow-yellow" style="margin-bottom: 14px;">— Cap. 04 · Componentes —</div>
  <h2 class="section-title">Botões</h2>
  <div class="section-rule"></div>
  <p class="section-intro">
    Uma única ação dominante por surface. Outline para secundárias. Pílulas para sociais.
  </p>

  <h3 style="font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.22em; font-size: 11px; color: rgba(255,255,255,0.55); margin-bottom: 14px;">Em fundo escuro</h3>
  <div class="btn-row">
    <span class="btn-primary">Treinar com Pelé</span>
    <span class="btn-outline">Compartilhar</span>
    <span class="btn-ghost-link">| Como jogar</span>
  </div>

  <h3 style="font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.22em; font-size: 11px; color: rgba(255,255,255,0.55); margin: 24px 0 14px;">Em fundo amarelo (hero)</h3>
  <div class="btn-on-yellow">
    <div class="btn-row" style="margin-bottom: 0;">
      <span style="background: var(--deep-black); color: var(--neon-yellow); font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.24em; font-size: 12px; padding: 13px 26px; border-radius: 4px;">Store</span>
      <span class="btn-pill-social">♡  1.1k</span>
      <span class="btn-pill-social">⤴  Compartilhar</span>
    </div>
  </div>

  <div class="divider-yellow"></div>

  <h2 class="section-title" style="font-size: 30px; margin-bottom: 4px;">Cards</h2>
  <p class="section-intro" style="margin-bottom: 22px;">
    O rail amarelo de 3px à esquerda é a assinatura. Cor do rail comunica intenção.
  </p>

  <div class="card-grid" style="grid-template-columns: 1fr 1fr 1fr 1fr;">
    <div class="card-demo">
      <div class="label">Posse</div>
      <div class="num">58%</div>
    </div>
    <div class="card-demo">
      <div class="label">Chutes</div>
      <div class="num">12</div>
    </div>
    <div class="card-demo">
      <div class="label">Escanteios</div>
      <div class="num">7</div>
    </div>
    <div class="card-demo">
      <div class="label">Cartões</div>
      <div class="num">2</div>
    </div>
  </div>

  <h3 style="font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.22em; font-size: 11px; color: rgba(255,255,255,0.55); margin: 24px 0 14px;">view-player-card · pattern horizontal</h3>
  <div class="card-row">
    <div class="photo">
      <span class="ovr">94</span>
      <span class="silhouette">P</span>
      <span class="pos-chip">ATA</span>
    </div>
    <div class="info">
      <div class="player-name">17 James Oliver</div>
      <div class="player-meta">36% Cansaço · MVP</div>
    </div>
    <div class="impact">8.60</div>
  </div>
  <div class="card-row" style="border-left-color: var(--warning);">
    <div class="photo">
      <span class="ovr" style="color: var(--warning);">82</span>
      <span class="silhouette">G</span>
      <span class="pos-chip">VOL</span>
    </div>
    <div class="info">
      <div class="player-name">11 Eurico Freddy</div>
      <div class="player-meta">93% Cansaço</div>
    </div>
    <div class="impact" style="color: var(--warning);">6.40</div>
  </div>
  <div class="card-row" style="border-left-color: var(--danger);">
    <div class="photo">
      <span class="ovr" style="color: var(--danger);">75</span>
      <span class="silhouette">M</span>
      <span class="pos-chip">MEI</span>
    </div>
    <div class="info">
      <div class="player-name">9 Maria FC</div>
      <div class="player-meta">Expulso · 67'</div>
    </div>
    <div class="impact" style="color: rgba(255,255,255,0.35);">—</div>
  </div>

  <div class="brand-footer">
    <span>Olefoot · Brandbook · Componentes</span>
    <span>05 / 08</span>
  </div>
</div>

<!-- ─────────────────────────────────────────── PAGE 6: PADRÕES EDITORIAIS ─────────────────────── -->
<div class="page">
  <div class="eyebrow eyebrow-yellow" style="margin-bottom: 14px;">— Cap. 05 · Padrões editoriais —</div>
  <h2 class="section-title">Eyebrow + Headline duo</h2>
  <div class="section-rule"></div>
  <p class="section-intro">
    Assinatura visual da Olefoot. Cada hero, cada modal, cada postgame.
    A linha curta Agency uppercase posiciona; o nome Moret italic carrega o peso emocional.
  </p>

  <div style="background: var(--neon-yellow); padding: 56px 40px; border-radius: 8px; margin-bottom: 28px; text-align: center;">
    <div style="display: inline-flex; align-items: center; gap: 12px; margin-bottom: 18px;">
      <span style="display: block; height: 1px; width: 32px; background: rgba(0,0,0,0.55);"></span>
      <span style="font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.32em; font-size: 11px; color: var(--deep-black);">O Rei do Futebol</span>
      <span style="display: block; height: 1px; width: 32px; background: rgba(0,0,0,0.55);"></span>
    </div>
    <div style="font-family: var(--font-serif); font-style: italic; font-weight: 700; font-size: 90px; color: var(--deep-black); line-height: 0.9; letter-spacing: -0.02em;">Pelé</div>
    <div style="width: 48px; height: 3px; background: var(--deep-black); margin: 18px auto 14px;"></div>
    <div style="font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.28em; font-size: 11px; color: rgba(0,0,0,0.75);">Tricampeão do Mundo · 1958 · 1962 · 1970</div>
  </div>

  <h2 class="section-title" style="font-size: 30px; margin-bottom: 4px;">Section header</h2>
  <p class="section-intro" style="margin-bottom: 22px;">
    Rail amarelo vertical de 3×32px + headline Moret italic. Abre toda seção secundária.
  </p>

  <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 28px;">
    <span style="width: 4px; height: 32px; background: var(--neon-yellow); display: block;"></span>
    <h3 style="font-family: var(--font-serif); font-style: italic; font-weight: 700; font-size: 38px; color: var(--neon-yellow); line-height: 1; letter-spacing: -0.02em;">DNA do Campeão</h3>
  </div>

  <h2 class="section-title" style="font-size: 30px; margin-bottom: 4px;">OVR badge sobre foto</h2>
  <p class="section-intro" style="margin-bottom: 22px;">
    Pattern do view-player-card e do MVP. Moret italic + drop-shadow forte.
  </p>

  <div style="display: flex; gap: 18px; align-items: flex-end;">
    <div style="position: relative; width: 140px; height: 175px; background: linear-gradient(135deg, #2a2a2a, #0a0a0a); border-radius: 6px;">
      <div style="position: absolute; top: 8px; left: 10px;">
        <div style="font-family: var(--font-serif); font-style: italic; font-weight: 700; font-size: 38px; color: var(--neon-yellow); line-height: 1; letter-spacing: -0.04em; text-shadow: 0 3px 8px rgba(0,0,0,0.95);">99</div>
        <div style="font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.22em; font-size: 9px; color: rgba(255,255,255,0.85); margin-top: 2px;">OVR</div>
      </div>
      <div style="position: absolute; top: 10px; right: 10px; background: var(--neon-yellow); padding: 4px 8px; border-radius: 4px;">
        <span style="font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.22em; font-size: 9px; color: var(--deep-black);">MVP</span>
      </div>
      <div style="position: absolute; bottom: 8px; left: 8px; background: rgba(0,0,0,0.75); padding: 3px 8px;">
        <span style="font-family: var(--font-display); font-weight: 700; text-transform: uppercase; letter-spacing: 0.18em; font-size: 9px; color: rgba(255,255,255,0.9);">ATA</span>
      </div>
    </div>
    <div style="flex: 1;">
      <div style="font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.22em; font-size: 9px; color: rgba(255,255,255,0.45);">Joia do Plantel</div>
      <div style="font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; font-size: 22px; color: #fff; margin-top: 4px;">17 James Oliver</div>
      <div style="font-family: var(--font-serif); font-style: italic; font-weight: 700; font-size: 42px; color: var(--neon-yellow); line-height: 1; letter-spacing: -0.03em; margin-top: 6px;">8.72 <span style="font-family: var(--font-display); font-style: normal; font-size: 10px; color: rgba(255,255,255,0.45); letter-spacing: 0.22em; margin-left: 6px;">RATING</span></div>
      <div style="display: flex; gap: 16px; margin-top: 14px;">
        <span style="font-family: var(--font-sans); font-size: 11px; color: rgba(255,255,255,0.85);"><strong style="color: var(--success); font-family: var(--font-display); font-size: 14px;">2</strong> <span style="font-family: var(--font-display); font-weight: 700; text-transform: uppercase; letter-spacing: 0.22em; font-size: 9px;">Gols</span></span>
        <span style="font-family: var(--font-sans); font-size: 11px; color: rgba(255,255,255,0.85);"><strong style="color: var(--neon-yellow); font-family: var(--font-display); font-size: 14px;">1</strong> <span style="font-family: var(--font-display); font-weight: 700; text-transform: uppercase; letter-spacing: 0.22em; font-size: 9px;">Assist.</span></span>
      </div>
    </div>
  </div>

  <div class="brand-footer">
    <span>Olefoot · Brandbook · Padrões editoriais</span>
    <span>06 / 08</span>
  </div>
</div>

<!-- ─────────────────────────────────────────── PAGE 7: PAGE ARCHETYPES ─────────────────────── -->
<div class="page">
  <div class="eyebrow eyebrow-yellow" style="margin-bottom: 14px;">— Cap. 06 · Page archetypes —</div>
  <h2 class="section-title">As 4 famílias de página</h2>
  <div class="section-rule"></div>
  <p class="section-intro">
    Toda página da Olefoot encaixa em um destes 4 arquétipos. Definir o
    tipo antes de desenhar protege a coerência do produto.
  </p>

  <div class="archetype-grid">
    <div class="archetype">
      <div class="archetype-preview hero mini-hero">
        <div class="eyebrow-mini">— O Rei —</div>
        <h3>Pelé</h3>
        <div style="width: 32px; height: 2px; background: var(--deep-black);"></div>
      </div>
      <div class="archetype-info">
        <div class="name">Tipo A · Hero editorial</div>
        <div class="desc">Apresenta uma entidade individual: lenda, jogador, partida. Hero amarelo ou preto + CTA dominante.</div>
      </div>
    </div>

    <div class="archetype">
      <div class="archetype-preview catalog">
        <div style="display: flex; flex-direction: column; gap: 6px; width: 80%;">
          <div style="height: 18px; background: var(--dark-gray); border-left: 2px solid var(--neon-yellow); border-radius: 2px;"></div>
          <div style="height: 18px; background: var(--dark-gray); border-left: 2px solid var(--warning); border-radius: 2px;"></div>
          <div style="height: 18px; background: var(--dark-gray); border-left: 2px solid var(--neon-yellow); border-radius: 2px;"></div>
          <div style="height: 18px; background: var(--dark-gray); border-left: 2px solid rgba(255,255,255,0.15); border-radius: 2px;"></div>
        </div>
      </div>
      <div class="archetype-info">
        <div class="name">Tipo B · Catalog</div>
        <div class="desc">Galeria, mercado, busca. Lista densa de view-player-cards horizontais com filtros pílula.</div>
      </div>
    </div>

    <div class="archetype">
      <div class="archetype-preview hub">
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; width: 80%;">
          <div style="height: 36px; background: var(--dark-gray); border-radius: 4px; border-left: 2px solid var(--neon-yellow);"></div>
          <div style="height: 36px; background: var(--dark-gray); border-radius: 4px;"></div>
          <div style="height: 36px; background: var(--dark-gray); border-radius: 4px;"></div>
          <div style="height: 36px; background: var(--dark-gray); border-radius: 4px;"></div>
          <div style="height: 36px; background: var(--dark-gray); border-radius: 4px; border-left: 2px solid var(--neon-yellow);"></div>
          <div style="height: 36px; background: var(--dark-gray); border-radius: 4px;"></div>
        </div>
      </div>
      <div class="archetype-info">
        <div class="name">Tipo C · Hub navegacional</div>
        <div class="desc">Agrega múltiplas surfaces relacionadas. Tiles em grid, header com escudo, rail amarelo no destaque.</div>
      </div>
    </div>

    <div class="archetype">
      <div class="archetype-preview live">
        <div style="font-family: var(--font-serif); font-style: italic; font-weight: 700; color: var(--neon-yellow); font-size: 48px; line-height: 1;">2 <span style="color: rgba(255,255,255,0.35); font-size: 24px;">–</span> 1</div>
        <div style="font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.22em; font-size: 10px; color: rgba(255,255,255,0.55);">87'</div>
      </div>
      <div class="archetype-info">
        <div class="name">Tipo D · Live / Realtime</div>
        <div class="desc">Match live, scoreboard + clock + feed minute-by-minute + listas Home/Away + overlays cinematográficos.</div>
      </div>
    </div>
  </div>

  <div class="brand-footer">
    <span>Olefoot · Brandbook · Page archetypes</span>
    <span>07 / 08</span>
  </div>
</div>

<!-- ─────────────────────────────────────────── PAGE 8: DO'S & DON'TS ─────────────────────── -->
<div class="page">
  <div class="eyebrow eyebrow-yellow" style="margin-bottom: 14px;">— Cap. 07 · Regras —</div>
  <h2 class="section-title">Do's & Don'ts</h2>
  <div class="section-rule"></div>
  <p class="section-intro">
    A coerência da marca depende destas escolhas. Sempre que houver dúvida,
    consulta este capítulo antes do componente.
  </p>

  <div class="do-dont">
    <div class="dd-card dd-do">
      <div class="head">✓ Faça</div>
      <div class="body"><span style="font-family: var(--font-serif); font-style: italic; font-weight: 700;">Pelé</span> em Moret italic proper-case.</div>
    </div>
    <div class="dd-card dd-dont">
      <div class="head">✗ Não faça</div>
      <div class="body"><span style="font-family: var(--font-serif); font-style: italic; font-weight: 700; text-transform: uppercase;">PELÉ</span> em Moret uppercase.</div>
    </div>
  </div>

  <div class="do-dont" style="margin-top: 14px;">
    <div class="dd-card dd-do">
      <div class="head">✓ Faça</div>
      <div class="body"><span style="font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.22em;">Treinar com Pelé</span> em Agency tracking-wide.</div>
    </div>
    <div class="dd-card dd-dont">
      <div class="head">✗ Não faça</div>
      <div class="body"><span style="font-family: var(--font-display); font-weight: 800; font-style: italic;">Treinar com Pelé</span> em Agency italic.</div>
    </div>
  </div>

  <div class="do-dont" style="margin-top: 14px;">
    <div class="dd-card dd-do">
      <div class="head">✓ Faça</div>
      <div class="body">CTA <span style="background: var(--neon-yellow); color: #000; padding: 2px 8px; font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.22em; font-size: 11px; border-radius: 3px;">Store</span> amarelo sólido.</div>
    </div>
    <div class="dd-card dd-dont">
      <div class="head">✗ Não faça</div>
      <div class="body">CTA <span style="background: linear-gradient(45deg, #a855f7, #06b6d4); color: #fff; padding: 2px 8px; font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.22em; font-size: 11px; border-radius: 3px;">Store</span> com gradient rainbow.</div>
    </div>
  </div>

  <div class="do-dont" style="margin-top: 14px;">
    <div class="dd-card dd-do">
      <div class="head">✓ Faça</div>
      <div class="body">Card com rail amarelo <code style="font-family: var(--font-sans); background: rgba(0,0,0,0.4); padding: 1px 6px; border-radius: 3px; font-size: 11px;">border-l-[3px] border-l-neon-yellow</code></div>
    </div>
    <div class="dd-card dd-dont">
      <div class="head">✗ Não faça</div>
      <div class="body">Borda colorida arbitrária (purple, cyan, orange).</div>
    </div>
  </div>

  <div class="do-dont" style="margin-top: 14px;">
    <div class="dd-card dd-do">
      <div class="head">✓ Faça</div>
      <div class="body">Texto inativo <span style="color: rgba(255,255,255,0.45);">text-white/45</span> (token).</div>
    </div>
    <div class="dd-card dd-dont">
      <div class="head">✗ Não faça</div>
      <div class="body">Texto inativo <span style="color: #6b7280;">text-gray-500</span> (cor genérica).</div>
    </div>
  </div>

  <div class="do-dont" style="margin-top: 14px;">
    <div class="dd-card dd-do">
      <div class="head">✓ Faça</div>
      <div class="body">"Substituição por Lesão" + ícone Lucide.</div>
    </div>
    <div class="dd-card dd-dont">
      <div class="head">✗ Não faça</div>
      <div class="body">"🚑 Substituição por Lesão" com emoji em CTA.</div>
    </div>
  </div>

  <div class="divider-yellow"></div>

  <p style="font-family: var(--font-serif); font-style: italic; font-weight: 500; font-size: 17px; color: rgba(255,255,255,0.65); text-align: center; max-width: 540px; margin: 0 auto;">
    "Eu nasci para jogar futebol, da mesma forma que Beethoven nasceu
    para escrever música e Michelangelo nasceu para pintar."
  </p>
  <p style="font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.32em; font-size: 10px; color: var(--neon-yellow); text-align: center; margin-top: 14px;">
    — Edson Arantes do Nascimento
  </p>

  <div class="brand-footer">
    <span>Olefoot · Brandbook · v1.0 · Abr/2026</span>
    <span>08 / 08</span>
  </div>
</div>
