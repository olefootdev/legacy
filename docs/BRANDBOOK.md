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

.brandbook { padding: 56px 56px 80px; background: var(--deep-black); }

.cover {
  background: var(--neon-yellow);
  color: var(--deep-black);
  padding: 64px 56px;
  margin: -56px -56px 64px;
  position: relative;
  overflow: hidden;
}
.cover::before {
  content: 'OLEFOOT';
  position: absolute;
  bottom: -90px;
  left: -20px;
  font-family: var(--font-display);
  font-weight: 900;
  font-size: 360px;
  line-height: 0.85;
  color: rgba(0,0,0,0.05);
  letter-spacing: -0.04em;
  white-space: nowrap;
}
.cover-meta {
  display: flex;
  justify-content: space-between;
  position: relative;
  z-index: 2;
  font-family: var(--font-display);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.32em;
  font-size: 10px;
}
.cover-body { position: relative; z-index: 2; margin-top: 80px; }
.cover-eyebrow {
  font-family: var(--font-display);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.32em;
  font-size: 11px;
  color: var(--deep-black);
}
.cover-title {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 700;
  font-size: 96px;
  line-height: 0.9;
  letter-spacing: -0.02em;
  color: var(--deep-black);
  margin-top: 18px;
}
.cover-rule { width: 60px; height: 4px; background: var(--deep-black); margin: 22px 0; }
.cover-desc {
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.45;
  font-weight: 500;
  color: rgba(0,0,0,0.75);
  max-width: 460px;
}
.cover-tag {
  display: inline-block;
  margin-top: 36px;
  background: var(--deep-black);
  color: var(--neon-yellow);
  padding: 14px 28px;
  border-radius: 4px;
  font-family: var(--font-display);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.32em;
  font-size: 12px;
}

.chapter {
  margin: 72px 0 48px;
  border-top: 1px solid rgba(253,225,0,0.18);
  padding-top: 40px;
}
.chapter:first-of-type { border-top: none; padding-top: 0; }
.chapter-eyebrow {
  font-family: var(--font-display);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.32em;
  font-size: 11px;
  color: var(--neon-yellow);
  margin-bottom: 12px;
}
.chapter-title {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 700;
  font-size: 38px;
  color: var(--neon-yellow);
  letter-spacing: -0.02em;
  line-height: 1;
  margin-bottom: 8px;
}
.chapter-rule { width: 48px; height: 3px; background: var(--neon-yellow); margin-bottom: 26px; }
.chapter-intro {
  font-family: var(--font-sans);
  color: rgba(255,255,255,0.65);
  font-size: 14px;
  max-width: 580px;
  margin-bottom: 32px;
  line-height: 1.6;
}

.section-sub {
  font-family: var(--font-display);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  font-size: 11px;
  color: rgba(255,255,255,0.55);
  margin: 28px 0 14px;
}

/* SWATCHES */
.palette-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-bottom: 18px; }
.swatch { border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); }
.swatch-color { height: 110px; position: relative; }
.swatch-info { padding: 14px 16px; background: var(--dark-gray); }
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

/* TYPE specimens */
.type-spec {
  border-left: 3px solid var(--neon-yellow);
  padding: 18px 22px;
  margin-bottom: 14px;
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
.type-rule {
  font-family: var(--font-sans);
  font-size: 11px;
  color: rgba(255,255,255,0.5);
  font-weight: 500;
  margin-top: 10px;
}

/* BUTTONS */
.btn-row { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; margin-bottom: 14px; }
.btn-primary {
  background: var(--neon-yellow); color: var(--deep-black);
  font-family: var(--font-display); font-weight: 800;
  text-transform: uppercase; letter-spacing: 0.24em; font-size: 12px;
  padding: 13px 26px; border: none; border-radius: 4px;
  box-shadow: 0 8px 24px rgba(253,225,0,0.18);
  display: inline-block;
}
.btn-outline {
  border: 1px solid rgba(255,255,255,0.20);
  background: rgba(13,13,13,0.6);
  color: rgba(255,255,255,0.85);
  font-family: var(--font-display); font-weight: 800;
  text-transform: uppercase; letter-spacing: 0.24em; font-size: 12px;
  padding: 13px 26px; border-radius: 4px; display: inline-block;
}
.btn-pill-social {
  display: inline-flex; align-items: center; gap: 8px;
  border: 2px solid var(--deep-black);
  background: rgba(0,0,0,0.1); color: var(--deep-black);
  font-family: var(--font-display); font-weight: 800;
  text-transform: uppercase; letter-spacing: 0.22em; font-size: 11px;
  padding: 9px 16px; border-radius: 9999px;
}
.btn-on-yellow { background: var(--neon-yellow); padding: 18px 22px; border-radius: 6px; }

/* CARDS */
.card-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 14px; }
.card-demo {
  border: 1px solid rgba(255,255,255,0.08);
  border-left: 3px solid var(--neon-yellow);
  background: var(--dark-gray);
  border-radius: 8px; padding: 18px;
}
.card-demo .label {
  font-family: var(--font-display); font-weight: 800;
  text-transform: uppercase; letter-spacing: 0.22em; font-size: 10px;
  color: var(--neon-yellow); margin-bottom: 10px;
}
.card-demo .num {
  font-family: var(--font-serif); font-style: italic; font-weight: 700;
  font-size: 32px; color: var(--neon-yellow);
  letter-spacing: -0.02em; line-height: 1;
}

.card-row {
  display: flex;
  border: 1px solid rgba(255,255,255,0.08);
  border-left: 3px solid var(--neon-yellow);
  background: var(--dark-gray);
  border-radius: 8px; overflow: hidden; margin-bottom: 10px;
}
.card-row .photo {
  width: 88px; flex-shrink: 0;
  background: linear-gradient(135deg, #2a2a2a 0%, #0a0a0a 100%);
  position: relative; display: flex; align-items: center; justify-content: center;
}
.card-row .photo .ovr {
  position: absolute; top: 6px; left: 8px;
  font-family: var(--font-serif); font-style: italic; font-weight: 700;
  font-size: 26px; color: var(--neon-yellow); line-height: 1;
  letter-spacing: -0.04em; text-shadow: 0 3px 8px rgba(0,0,0,0.95);
}
.card-row .photo .silhouette {
  font-family: var(--font-serif); font-style: italic; font-weight: 700;
  font-size: 50px; color: rgba(255,255,255,0.15);
}
.card-row .pos-chip {
  position: absolute; bottom: 5px; left: 5px;
  background: rgba(0,0,0,0.75); color: rgba(255,255,255,0.9);
  font-family: var(--font-display); font-weight: 700;
  text-transform: uppercase; font-size: 8px; letter-spacing: 0.18em;
  padding: 1px 5px;
}
.card-row .info {
  flex: 1; padding: 12px 14px; display: flex;
  flex-direction: column; justify-content: center; min-width: 0;
}
.card-row .info .player-name {
  font-family: var(--font-display); font-weight: 800;
  text-transform: uppercase; letter-spacing: 0.04em;
  font-size: 13px; color: #fff; line-height: 1.1;
}
.card-row .info .player-meta {
  font-family: var(--font-display); font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.22em;
  font-size: 9px; color: rgba(255,255,255,0.45); margin-top: 5px;
}
.card-row .impact {
  align-self: center; padding-right: 16px;
  font-family: var(--font-serif); font-style: italic; font-weight: 700;
  font-size: 20px; color: var(--neon-yellow); letter-spacing: -0.02em;
}

/* DO / DONT */
.do-dont { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.dd-card { padding: 14px 16px; border-radius: 6px; }
.dd-do { border-left: 3px solid var(--success); background: rgba(34,197,94,0.06); }
.dd-dont { border-left: 3px solid var(--danger); background: rgba(239,68,68,0.06); }
.dd-card .head {
  font-family: var(--font-display); font-weight: 800;
  text-transform: uppercase; letter-spacing: 0.22em; font-size: 10px; margin-bottom: 8px;
}
.dd-do .head { color: var(--success); }
.dd-dont .head { color: var(--danger); }
.dd-card .body { font-family: var(--font-sans); font-size: 13px; color: rgba(255,255,255,0.85); }

/* DEVICES */
.device-stage {
  background: linear-gradient(180deg, #050505 0%, var(--deep-black) 100%);
  padding: 48px 36px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.06);
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 18px;
}

/* iPhone */
.iphone-frame {
  width: 280px;
  background: #000;
  border-radius: 36px;
  padding: 10px;
  box-shadow: 0 30px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08);
  position: relative;
}
.iphone-screen {
  background: var(--deep-black);
  border-radius: 28px;
  height: 560px;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}
.iphone-notch {
  position: absolute;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  width: 100px;
  height: 22px;
  background: #000;
  border-radius: 14px;
  z-index: 10;
}
/* iPhone home content */
.iph-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 36px 16px 12px;
}
.iph-logo {
  font-family: var(--font-display); font-weight: 900;
  color: var(--neon-yellow); font-size: 13px; letter-spacing: 0.04em;
}
.iph-icons {
  display: flex; gap: 6px; color: rgba(255,255,255,0.55);
  font-size: 9px;
}
.iph-icons span {
  width: 18px; height: 18px; border-radius: 50%;
  background: rgba(255,255,255,0.08); display: flex;
  align-items: center; justify-content: center;
}

.iph-hero {
  margin: 8px 12px;
  background: linear-gradient(135deg, rgba(0,0,0,0.7), rgba(0,0,0,0.85));
  border: 1px solid rgba(253,225,0,0.18);
  border-left: 3px solid var(--neon-yellow);
  border-radius: 10px;
  padding: 14px;
  position: relative;
  overflow: hidden;
}
.iph-hero-eyebrow {
  display: inline-block;
  background: rgba(253,225,0,0.12);
  border: 1px solid rgba(253,225,0,0.45);
  border-radius: 9999px;
  padding: 3px 8px;
  color: var(--neon-yellow);
  font-family: var(--font-display);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  font-size: 7px;
}
.iph-hero-title {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 700;
  font-size: 17px;
  line-height: 1.05;
  color: #fff;
  margin-top: 8px;
}
.iph-hero-title em { color: var(--neon-yellow); font-style: italic; }
.iph-hero-sub {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 700;
  font-size: 13px;
  color: #fff;
  margin-top: 6px;
}
.iph-hero-features {
  margin-top: 8px;
  display: flex; flex-wrap: wrap; gap: 6px;
  font-family: var(--font-display);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 6px;
  color: rgba(255,255,255,0.65);
}
.iph-hero-features span::before { content: "• "; color: var(--neon-yellow); }

.iph-feature {
  margin: 6px 12px;
  background: rgba(26,26,26,0.85);
  border: 1px solid rgba(255,255,255,0.08);
  border-left: 3px solid var(--neon-yellow);
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  gap: 8px;
  align-items: center;
}
.iph-feature .icon {
  width: 22px; height: 22px;
  background: var(--deep-black);
  border: 1px solid rgba(253,225,0,0.45);
  border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  color: var(--neon-yellow);
  font-family: var(--font-display); font-weight: 900;
  font-size: 8px;
}
.iph-feature .text {
  flex: 1;
  font-family: var(--font-display);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 7px;
  color: #fff;
}
.iph-feature .text small {
  display: block;
  font-family: var(--font-sans);
  font-size: 7px;
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
  color: rgba(255,255,255,0.55);
  margin-top: 2px;
}

.iph-cta {
  margin: 10px 12px 0;
  background: var(--neon-yellow);
  color: var(--deep-black);
  border-radius: 6px;
  padding: 10px 12px;
  text-align: center;
  font-family: var(--font-display);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.24em;
  font-size: 10px;
  box-shadow: 0 4px 14px rgba(253,225,0,0.28);
}
.iph-cta-outline {
  margin: 6px 12px 0;
  border: 1px solid rgba(255,255,255,0.20);
  background: rgba(13,13,13,0.6);
  color: rgba(255,255,255,0.85);
  border-radius: 6px;
  padding: 10px 12px;
  text-align: center;
  font-family: var(--font-display);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.24em;
  font-size: 10px;
}

.iph-bottomnav {
  margin-top: auto;
  background: var(--deep-black);
  border-top: 1px solid rgba(253,225,0,0.18);
  display: flex;
  justify-content: space-around;
  padding: 8px 0 14px;
}
.iph-bottomnav span {
  flex: 1;
  text-align: center;
  font-family: var(--font-display);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  font-size: 7px;
  color: rgba(255,255,255,0.45);
}
.iph-bottomnav span.active {
  color: var(--neon-yellow);
}

/* iPad */
.ipad-frame {
  width: 540px;
  background: #000;
  border-radius: 22px;
  padding: 12px;
  box-shadow: 0 30px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08);
}
.ipad-screen {
  background: var(--neon-yellow);
  border-radius: 12px;
  height: 380px;
  overflow: hidden;
  position: relative;
  padding: 18px 24px;
  display: flex;
  flex-direction: column;
}
.ipad-screen::before {
  content: 'PELÉ';
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-weight: 900;
  font-size: 280px;
  line-height: 0.85;
  color: rgba(0,0,0,0.04);
  letter-spacing: -0.04em;
  white-space: nowrap;
  z-index: 0;
}
.ipad-search {
  position: relative;
  z-index: 1;
  align-self: center;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  border: 2px solid var(--deep-black);
  background: rgba(0,0,0,0.05);
  border-radius: 9999px;
  padding: 6px 14px;
  font-family: var(--font-display);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  font-size: 9px;
  color: var(--deep-black);
}
.ipad-search .badge {
  background: var(--deep-black);
  color: var(--neon-yellow);
  border-radius: 9999px;
  padding: 1px 6px;
  font-size: 8px;
}

.ipad-eyebrow {
  position: relative; z-index: 1;
  text-align: center;
  margin-top: 12px;
  font-family: var(--font-display);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.32em;
  font-size: 8px;
  color: rgba(0,0,0,0.65);
}
.ipad-name {
  position: relative; z-index: 1;
  text-align: center;
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 700;
  font-size: 56px;
  line-height: 0.9;
  color: var(--deep-black);
  margin-top: 6px;
  letter-spacing: -0.02em;
}
.ipad-rule {
  position: relative; z-index: 1;
  width: 30px; height: 2px;
  background: var(--deep-black);
  margin: 8px auto;
}
.ipad-signature {
  position: relative; z-index: 1;
  text-align: center;
  font-family: var(--font-display);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.28em;
  font-size: 8px;
  color: rgba(0,0,0,0.7);
}

.ipad-photo-wrap {
  position: relative; z-index: 1;
  align-self: center;
  margin-top: 14px;
  width: 130px; height: 165px;
  background: linear-gradient(135deg, #2a2a2a 0%, #0a0a0a 100%);
  border-radius: 4px;
  position: relative;
}
.ipad-photo-wrap .ovr {
  position: absolute; top: 6px; left: 8px;
  background: rgba(0,0,0,0.9);
  padding: 2px 6px;
}
.ipad-photo-wrap .ovr .num {
  font-family: var(--font-serif); font-style: italic; font-weight: 700;
  font-size: 22px; color: var(--neon-yellow); line-height: 1;
}
.ipad-photo-wrap .ovr .label {
  font-family: var(--font-display); font-weight: 800;
  text-transform: uppercase; letter-spacing: 0.22em;
  font-size: 5px; color: rgba(255,255,255,0.85); margin-top: 1px;
}
.ipad-photo-wrap .lenda {
  position: absolute; top: 6px; right: 6px;
  background: var(--neon-yellow);
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid rgba(0,0,0,0.3);
  font-family: var(--font-display); font-weight: 800;
  text-transform: uppercase; letter-spacing: 0.22em;
  font-size: 6px; color: var(--deep-black);
}
.ipad-photo-wrap .silhouette {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-serif); font-style: italic; font-weight: 700;
  font-size: 60px; color: rgba(255,255,255,0.18);
}

.ipad-cta {
  position: relative; z-index: 1;
  align-self: center;
  margin-top: 12px;
  background: var(--deep-black);
  color: var(--neon-yellow);
  padding: 8px 18px;
  border-radius: 4px;
  font-family: var(--font-display);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.24em;
  font-size: 9px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.25);
}

/* Device caption */
.device-caption {
  text-align: center;
  margin-top: 18px;
}
.device-caption .label {
  font-family: var(--font-display);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.32em;
  font-size: 10px;
  color: var(--neon-yellow);
}
.device-caption .desc {
  font-family: var(--font-sans);
  font-size: 12px;
  color: rgba(255,255,255,0.55);
  margin-top: 4px;
}

/* PORTRAIT EDITORIAL */
.portrait-stage {
  background: linear-gradient(180deg, #1a1814 0%, #0a0907 100%);
  padding: 48px 36px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.06);
  position: relative;
  overflow: hidden;
}
.portrait-stage::before {
  /* grain */
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px);
  background-size: 4px 4px;
  opacity: 0.55;
}
.portrait-stage::after {
  /* light beam */
  content: '';
  position: absolute;
  top: -40%; left: -10%;
  width: 70%; height: 200%;
  background: radial-gradient(ellipse at center, rgba(253,225,0,0.10) 0%, transparent 60%);
  pointer-events: none;
}

.portrait-grid {
  display: grid;
  grid-template-columns: 1fr 240px;
  gap: 32px;
  position: relative;
  z-index: 1;
  align-items: stretch;
}

.portrait-text {
  display: flex; flex-direction: column; justify-content: center;
}
.portrait-eyebrow {
  font-family: var(--font-display);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.36em;
  font-size: 10px;
  color: var(--neon-yellow);
}
.portrait-rule { width: 36px; height: 2px; background: var(--neon-yellow); margin: 14px 0; }
.portrait-headline {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 700;
  font-size: 42px;
  line-height: 0.95;
  letter-spacing: -0.02em;
  color: #f5e6c8;
}
.portrait-headline em { color: var(--neon-yellow); font-style: italic; }
.portrait-quote {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 500;
  font-size: 14px;
  line-height: 1.5;
  color: rgba(245,230,200,0.7);
  margin-top: 18px;
  padding-left: 14px;
  border-left: 2px solid rgba(253,225,0,0.55);
}
.portrait-author {
  font-family: var(--font-display);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.32em;
  font-size: 9px;
  color: rgba(245,230,200,0.55);
  margin-top: 10px;
}
.portrait-meta {
  margin-top: 24px;
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
  font-family: var(--font-display);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  font-size: 9px;
  color: rgba(245,230,200,0.55);
}
.portrait-meta strong {
  display: block;
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 700;
  font-size: 24px;
  color: var(--neon-yellow);
  letter-spacing: -0.02em;
  margin-bottom: 2px;
}

.portrait-figure {
  position: relative;
  background: linear-gradient(180deg, #2a261c 0%, #14110a 100%);
  border: 1px solid rgba(245,230,200,0.18);
  border-radius: 8px;
  padding: 20px 18px 24px;
  overflow: hidden;
}
.portrait-figure::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px);
  background-size: 3px 3px;
  pointer-events: none;
}
.portrait-figure svg { width: 100%; height: auto; display: block; position: relative; }
.portrait-caption {
  position: relative; z-index: 1;
  margin-top: 16px;
  text-align: center;
  font-family: var(--font-display);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.32em;
  font-size: 8px;
  color: rgba(245,230,200,0.45);
}

/* CHAPTER FOOTER (acima de cada chapter) */
.chapter-footer {
  margin-top: 42px;
  padding-top: 16px;
  border-top: 1px solid rgba(255,255,255,0.05);
  display: flex;
  justify-content: space-between;
  font-family: var(--font-display);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  font-size: 9px;
  color: rgba(255,255,255,0.30);
}

/* Misc */
code {
  font-family: 'SF Mono', Menlo, monospace;
  background: rgba(0,0,0,0.4);
  padding: 1px 6px; border-radius: 3px;
  font-size: 11px;
}
</style>

<div class="brandbook">

<!-- ─── COVER ─── -->
<div class="cover">
  <div class="cover-meta">
    <span>Olefoot · Game</span>
    <span>v1.0 — Abr/2026</span>
  </div>
  <div class="cover-body">
    <span class="cover-eyebrow">— Brandbook —</span>
    <h1 class="cover-title">Legacy Tech</h1>
    <div class="cover-rule"></div>
    <p class="cover-desc">
      Manual visual da Olefoot. Cores, tipografia, componentes, page archetypes
      e princípios do museu vivo do futebol.
    </p>
    <div class="cover-tag">Manual de Identidade</div>
  </div>
</div>

<!-- ─── 01 FILOSOFIA ─── -->
<div class="chapter">
  <div class="chapter-eyebrow">— Cap. 01 · Filosofia —</div>
  <h2 class="chapter-title">A síntese Legacy Tech</h2>
  <div class="chapter-rule"></div>
  <p class="chapter-intro">
    Três correntes destilam o sistema visual da Olefoot. Juntas, entregam um
    produto que <strong style="color:#fff;">respeita o jogador</strong> — hierarquia clara, tipografia
    poderosa, dados legíveis e momentos cinematográficos sem ruído.
  </p>

  <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 18px; margin-bottom: 26px;">
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

  <h3 class="section-sub">Os 6 princípios</h3>
  <ol style="font-family: var(--font-sans); font-size: 14px; color: rgba(255,255,255,0.85); line-height: 1.85; padding-left: 24px;">
    <li>Preto absoluto é o palco, amarelo neon é a luz.</li>
    <li>Moret italic sempre que houver número, nome próprio ou citação.</li>
    <li>Agency uppercase tracking-wide sempre que houver chamada ou label.</li>
    <li>Inter regular sempre que houver leitura corrida.</li>
    <li>Régua amarela 12×3px abre seções; rail 3px à esquerda marca cards-âncora.</li>
    <li>Não se inventa cor — se não está nos tokens, não vai pro UI.</li>
  </ol>
</div>

<!-- ─── 02 CORES ─── -->
<div class="chapter">
  <div class="chapter-eyebrow">— Cap. 02 · Cores —</div>
  <h2 class="chapter-title">Paleta</h2>
  <div class="chapter-rule"></div>
  <p class="chapter-intro">
    A identidade vive em três cores primitivas + um trio de estados. Tudo o
    que está fora desta lista é proibido.
  </p>

  <h3 class="section-sub">Identidade primária</h3>
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

  <h3 class="section-sub">Estados semânticos</h3>
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
</div>

<!-- ─── 03 TIPOGRAFIA ─── -->
<div class="chapter">
  <div class="chapter-eyebrow">— Cap. 03 · Tipografia —</div>
  <h2 class="chapter-title">As três famílias</h2>
  <div class="chapter-rule"></div>
  <p class="chapter-intro">
    Cada família tem um papel exclusivo. Não se misturam. Moret carrega
    emoção, Agency carrega identidade, Inter carrega informação.
    <em style="color: rgba(255,255,255,0.55);">Substitutos no PDF: Playfair Display, Oswald, Inter.</em>
  </p>

  <div class="type-spec">
    <div class="type-meta">Moret Italic · Serif Hero · Emoção</div>
    <div style="font-family: var(--font-serif); font-style: italic; font-weight: 700; color: #fff; letter-spacing: -0.02em; line-height: 1; font-size: 76px;">Pelé</div>
    <div style="font-family: var(--font-serif); font-style: italic; font-weight: 700; color: var(--neon-yellow); letter-spacing: -0.02em; font-size: 44px; margin-top: 6px;">99</div>
    <div style="font-family: var(--font-serif); font-style: italic; font-weight: 700; color: rgba(255,255,255,0.85); font-size: 18px; margin-top: 8px;">"Eu nasci para jogar futebol."</div>
    <div class="type-rule">Uso: nomes próprios, OVR, score, rating, citações. Sempre proper-case ou minúsculo. Letter-spacing −0.02 a −0.04em.</div>
  </div>

  <div class="type-spec">
    <div class="type-meta">Oswald · Display · Identidade</div>
    <div style="font-family: var(--font-display); font-weight: 800; text-transform: uppercase; color: #fff; letter-spacing: 0.18em; font-size: 28px;">TREINAR COM PELÉ</div>
    <div style="font-family: var(--font-display); font-weight: 800; text-transform: uppercase; color: var(--neon-yellow); letter-spacing: 0.18em; font-size: 16px; margin-top: 6px;">DNA DO CAMPEÃO</div>
    <div style="font-family: var(--font-display); font-weight: 800; text-transform: uppercase; color: rgba(255,255,255,0.55); letter-spacing: 0.32em; font-size: 11px; margin-top: 6px;">— Olefoot · Hall of Fame —</div>
    <div class="type-rule">Uso: CTAs, headlines section, eyebrows, labels, badges, nav. Sempre uppercase + tracking-wide. Pesos 700–900.</div>
  </div>

  <div class="type-spec">
    <div class="type-meta">Inter · Sans · Informação</div>
    <div style="font-family: var(--font-sans); font-size: 18px; color: #fff; font-weight: 600;">A bola está rolando.</div>
    <div style="font-family: var(--font-sans); font-size: 14px; color: rgba(255,255,255,0.85); margin-top: 6px;">Manda um recado pra Pelé. As mensagens aparecem no museu pra todos os outros managers verem.</div>
    <div style="font-family: var(--font-sans); font-size: 11px; color: rgba(255,255,255,0.55); font-weight: 500; margin-top: 6px;">Status do jogo · Somos: 1.247 clubes</div>
    <div class="type-rule">Uso: texto corrido, descrições, helper, metadata. Tracking normal. Pesos 400–600.</div>
  </div>
</div>

<!-- ─── 04 BOTÕES E CARDS ─── -->
<div class="chapter">
  <div class="chapter-eyebrow">— Cap. 04 · Componentes —</div>
  <h2 class="chapter-title">Botões e Cards</h2>
  <div class="chapter-rule"></div>
  <p class="chapter-intro">
    Uma única ação dominante por surface. Outline para secundárias. Pílulas para sociais.
    Cards têm rail amarelo de 3px à esquerda como assinatura.
  </p>

  <h3 class="section-sub">Botões em fundo escuro</h3>
  <div class="btn-row">
    <span class="btn-primary">Treinar com Pelé</span>
    <span class="btn-outline">Compartilhar</span>
    <span style="color: rgba(255,255,255,0.55); font-family: var(--font-display); font-weight: 700; text-transform: uppercase; letter-spacing: 0.22em; font-size: 11px;">| Como jogar</span>
  </div>

  <h3 class="section-sub">Botões em fundo amarelo (hero)</h3>
  <div class="btn-on-yellow">
    <div class="btn-row" style="margin-bottom: 0;">
      <span style="background: var(--deep-black); color: var(--neon-yellow); font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.24em; font-size: 12px; padding: 13px 26px; border-radius: 4px;">Store</span>
      <span class="btn-pill-social">♡ &nbsp;1.1k</span>
      <span class="btn-pill-social">⤴ &nbsp;Compartilhar</span>
    </div>
  </div>

  <h3 class="section-sub">Stat cards (Moret italic)</h3>
  <div class="card-grid">
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

  <h3 class="section-sub">view-player-card · pattern horizontal</h3>
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
</div>

<!-- ─── 05 PADRÕES EDITORIAIS ─── -->
<div class="chapter">
  <div class="chapter-eyebrow">— Cap. 05 · Padrões editoriais —</div>
  <h2 class="chapter-title">Eyebrow + Headline duo</h2>
  <div class="chapter-rule"></div>
  <p class="chapter-intro">
    Assinatura visual da Olefoot. Cada hero, cada modal, cada postgame.
    A linha curta Agency posiciona; o nome Moret italic carrega o peso emocional.
  </p>

  <div style="background: var(--neon-yellow); padding: 48px 36px; border-radius: 8px; margin-bottom: 26px; text-align: center;">
    <div style="display: inline-flex; align-items: center; gap: 12px; margin-bottom: 18px;">
      <span style="display: block; height: 1px; width: 32px; background: rgba(0,0,0,0.55);"></span>
      <span style="font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.32em; font-size: 11px; color: var(--deep-black);">O Rei do Futebol</span>
      <span style="display: block; height: 1px; width: 32px; background: rgba(0,0,0,0.55);"></span>
    </div>
    <div style="font-family: var(--font-serif); font-style: italic; font-weight: 700; font-size: 88px; color: var(--deep-black); line-height: 0.9; letter-spacing: -0.02em;">Pelé</div>
    <div style="width: 48px; height: 3px; background: var(--deep-black); margin: 18px auto 14px;"></div>
    <div style="font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.28em; font-size: 11px; color: rgba(0,0,0,0.75);">Tricampeão do Mundo · 1958 · 1962 · 1970</div>
  </div>

  <h3 class="section-sub">Section header com rail amarelo</h3>
  <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 22px;">
    <span style="width: 4px; height: 32px; background: var(--neon-yellow); display: block;"></span>
    <h3 style="font-family: var(--font-serif); font-style: italic; font-weight: 700; font-size: 36px; color: var(--neon-yellow); line-height: 1; letter-spacing: -0.02em;">DNA do Campeão</h3>
  </div>
</div>

<!-- ─── 06 MOCKUP iPHONE — HOME ─── -->
<div class="chapter">
  <div class="chapter-eyebrow">— Cap. 06 · Mobile —</div>
  <h2 class="chapter-title">iPhone · Home</h2>
  <div class="chapter-rule"></div>
  <p class="chapter-intro">
    Tela inicial mobile-first. O hero amarelo atrai, a frase Moret italic
    emociona, os cards Agency afirmam o tom técnico, e o CTA dominante
    leva pra primeira partida.
  </p>

  <div class="device-stage">
    <div class="iphone-frame">
      <div class="iphone-notch"></div>
      <div class="iphone-screen">
        <div class="iph-header">
          <span class="iph-logo">OLEFOOT</span>
          <div class="iph-icons"><span></span><span></span><span></span></div>
        </div>
        <div class="iph-hero">
          <span class="iph-hero-eyebrow">● Jogue agora</span>
          <div class="iph-hero-title">A gente sabe que <em>você já virou noite</em> para ser o melhor clube do mundo</div>
          <div class="iph-hero-sub">Bem vindo ao OLEFOOT</div>
          <div class="iph-hero-features">
            <span>Assistente IA</span>
            <span>Crie jogadores</span>
            <span>Tempo real</span>
          </div>
        </div>
        <div class="iph-feature">
          <div class="icon">AI</div>
          <div class="text">Crie jogadores com IA<small>Descreva o perfil e gere atributos reais</small></div>
        </div>
        <div class="iph-feature">
          <div class="icon">⚡</div>
          <div class="text">Análise tática em tempo real<small>IA sugere mudanças instantâneas</small></div>
        </div>
        <div class="iph-cta">Entrar</div>
        <div class="iph-cta-outline">Cadastrar</div>
        <div style="text-align: center; margin: 8px 0; font-family: var(--font-display); font-weight: 700; text-transform: uppercase; letter-spacing: 0.22em; font-size: 7px; color: rgba(255,255,255,0.45); text-decoration: underline;">Esqueci minha senha</div>
        <div class="iph-bottomnav">
          <span class="active">Home</span>
          <span>Clube</span>
          <span>Comp.</span>
          <span>Mercado</span>
          <span>Manager</span>
        </div>
      </div>
    </div>
    <div class="device-caption">
      <div class="label">iPhone · Mobile-first</div>
      <div class="desc">Hero card + features + duo de CTAs (amarelo dominante / outline) + bottom nav 5 items</div>
    </div>
  </div>
</div>

<!-- ─── 07 MOCKUP iPAD — LENDA ─── -->
<div class="chapter">
  <div class="chapter-eyebrow">— Cap. 07 · Tablet —</div>
  <h2 class="chapter-title">iPad · Página Lenda</h2>
  <div class="chapter-rule"></div>
  <p class="chapter-intro">
    O museu vivo do futebol em tela maior. Hero amarelo cinematográfico
    com search bar destacada, nome Moret italic gigante, foto B&W com
    OVR badge e CTA preto sobre amarelo.
  </p>

  <div class="device-stage">
    <div class="ipad-frame">
      <div class="ipad-screen">
        <div class="ipad-search">
          <span>⌕</span>
          <span>Buscar lenda</span>
          <span class="badge">3</span>
          <span style="color: rgba(0,0,0,0.55); margin-left: 4px;">▾</span>
        </div>
        <div class="ipad-eyebrow">— O Rei do Futebol —</div>
        <div class="ipad-name">Pelé</div>
        <div class="ipad-rule"></div>
        <div class="ipad-signature">Tricampeão do Mundo · 1958 · 1962 · 1970</div>
        <div class="ipad-photo-wrap">
          <div class="ovr">
            <div class="num">99</div>
            <div class="label">OVR</div>
          </div>
          <div class="lenda">Lenda</div>
          <div class="silhouette">P</div>
        </div>
        <div class="ipad-cta">Treinar com Pelé ›</div>
      </div>
    </div>
    <div class="device-caption">
      <div class="label">iPad · Hero editorial</div>
      <div class="desc">Search topo + eyebrow + nome Moret + signature + foto+OVR + CTA preto</div>
    </div>
  </div>
</div>

<!-- ─── 08 RETRATO EDITORIAL ─── -->
<div class="chapter">
  <div class="chapter-eyebrow">— Cap. 08 · Espírito —</div>
  <h2 class="chapter-title">O Lenda Original</h2>
  <div class="chapter-rule"></div>
  <p class="chapter-intro">
    O futuro do futebol vestido com a memória do passado. Camisa antiga
    com a marca da Olefoot — o jogador que ainda não nasceu, olhando o
    horizonte. Editorial vintage para campanhas, capa de revista,
    apresentação institucional.
  </p>

  <div class="portrait-stage">
    <div class="portrait-grid">
      <div class="portrait-text">
        <div class="portrait-eyebrow">Olefoot · Spirit of the Game</div>
        <div class="portrait-rule"></div>
        <div class="portrait-headline">O futuro <em>do passado</em></div>
        <div class="portrait-quote">
          "O futebol arte é o futebol que faz a torcida sonhar.
          O Olefoot é o lugar onde esse sonho continua."
        </div>
        <div class="portrait-author">— Manifesto Olefoot · 2026</div>
        <div class="portrait-meta">
          <div><strong>—</strong>Lenda em construção</div>
          <div><strong>1956+</strong>Era de origem</div>
          <div><strong>∞</strong>Memória ativa</div>
        </div>
      </div>

      <div>
        <div class="portrait-figure">
          <svg viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg">
            <!-- Background sky/horizon -->
            <defs>
              <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#1a1812"/>
                <stop offset="60%" stop-color="#2d2618"/>
                <stop offset="100%" stop-color="#0d0a05"/>
              </linearGradient>
              <linearGradient id="jersey" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#1f1a10"/>
                <stop offset="100%" stop-color="#0a0905"/>
              </linearGradient>
              <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#3a2f22"/>
                <stop offset="100%" stop-color="#1c1610"/>
              </linearGradient>
              <radialGradient id="halo" cx="50%" cy="35%" r="40%">
                <stop offset="0%" stop-color="rgba(253,225,0,0.30)"/>
                <stop offset="100%" stop-color="rgba(253,225,0,0)"/>
              </radialGradient>
            </defs>

            <rect width="200" height="280" fill="url(#sky)"/>
            <ellipse cx="100" cy="100" rx="85" ry="110" fill="url(#halo)"/>

            <!-- Horizon line (campo no fundo) -->
            <rect x="0" y="170" width="200" height="2" fill="rgba(245,230,200,0.15)"/>
            <!-- Distant goal posts -->
            <rect x="40"  y="158" width="1" height="14" fill="rgba(245,230,200,0.18)"/>
            <rect x="58"  y="158" width="1" height="14" fill="rgba(245,230,200,0.18)"/>
            <rect x="40"  y="158" width="18" height="1" fill="rgba(245,230,200,0.18)"/>
            <rect x="142" y="158" width="1" height="14" fill="rgba(245,230,200,0.18)"/>
            <rect x="160" y="158" width="1" height="14" fill="rgba(245,230,200,0.18)"/>
            <rect x="142" y="158" width="18" height="1" fill="rgba(245,230,200,0.18)"/>

            <!-- Torso (jersey old-style com gola) -->
            <path d="M 60 280 L 60 175 Q 60 145 80 138 L 80 130 L 120 130 L 120 138 Q 140 145 140 175 L 140 280 Z" fill="url(#jersey)" stroke="rgba(245,230,200,0.10)" stroke-width="0.5"/>
            <!-- Stripes verticais sutis (camisa antiga) -->
            <rect x="78"  y="138" width="0.7" height="142" fill="rgba(245,230,200,0.06)"/>
            <rect x="100" y="130" width="0.7" height="150" fill="rgba(245,230,200,0.06)"/>
            <rect x="121" y="138" width="0.7" height="142" fill="rgba(245,230,200,0.06)"/>

            <!-- V-neck collar -->
            <path d="M 85 135 L 100 152 L 115 135 Z" fill="#0a0905" stroke="rgba(245,230,200,0.18)" stroke-width="0.6"/>

            <!-- Olefoot badge (no peito esquerdo) -->
            <g transform="translate(82,158)">
              <rect x="0" y="0" width="20" height="24" rx="2" fill="var(--neon-yellow, #FDE100)" stroke="rgba(0,0,0,0.4)" stroke-width="0.4"/>
              <text x="10" y="11" text-anchor="middle"
                    font-family="Oswald, Impact, sans-serif"
                    font-weight="900" font-size="6" fill="#0d0d0d"
                    letter-spacing="0.5">OLE</text>
              <text x="10" y="19" text-anchor="middle"
                    font-family="Oswald, Impact, sans-serif"
                    font-weight="900" font-size="6" fill="#0d0d0d"
                    letter-spacing="0.5">FOOT</text>
            </g>

            <!-- Sleeves (mangas longas vintage) -->
            <path d="M 60 175 L 40 188 L 38 215 L 56 220 L 60 200 Z" fill="url(#jersey)" stroke="rgba(245,230,200,0.08)" stroke-width="0.4"/>
            <path d="M 140 175 L 160 188 L 162 215 L 144 220 L 140 200 Z" fill="url(#jersey)" stroke="rgba(245,230,200,0.08)" stroke-width="0.4"/>
            <!-- Sleeve cuffs (faixas amarelas) -->
            <rect x="38" y="212" width="20" height="3" fill="rgba(253,225,0,0.55)"/>
            <rect x="142" y="212" width="20" height="3" fill="rgba(253,225,0,0.55)"/>

            <!-- Neck/skin -->
            <path d="M 88 130 L 88 110 L 112 110 L 112 130 Z" fill="url(#skin)"/>

            <!-- Head (silhueta) -->
            <ellipse cx="100" cy="92" rx="22" ry="26" fill="url(#skin)"/>
            <!-- Hair (cabelo curto) -->
            <path d="M 78 86 Q 80 64 100 62 Q 120 64 122 86 L 120 80 Q 110 72 100 72 Q 90 72 80 80 Z" fill="#0a0805"/>
            <!-- Subtle face features (perfil sugerido — 3/4 looking forward) -->
            <ellipse cx="92" cy="93" rx="1.5" ry="0.8" fill="rgba(245,230,200,0.45)"/>
            <ellipse cx="108" cy="93" rx="1.5" ry="0.8" fill="rgba(245,230,200,0.45)"/>
            <path d="M 96 102 Q 100 104 104 102" stroke="rgba(245,230,200,0.30)" stroke-width="0.6" fill="none"/>

            <!-- Light beam from above (looking forward) -->
            <path d="M 88 60 L 80 0 L 120 0 L 112 60 Z" fill="rgba(253,225,0,0.06)"/>

            <!-- Foreground vignette grain -->
            <rect width="200" height="280" fill="url(#vignette)"/>
            <radialGradient id="vignette" cx="50%" cy="50%" r="75%">
              <stop offset="60%" stop-color="rgba(0,0,0,0)"/>
              <stop offset="100%" stop-color="rgba(0,0,0,0.55)"/>
            </radialGradient>
          </svg>
          <div class="portrait-caption">— O lenda original · 2026 —</div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ─── 09 DO'S & DON'TS ─── -->
<div class="chapter">
  <div class="chapter-eyebrow">— Cap. 09 · Regras —</div>
  <h2 class="chapter-title">Do's & Don'ts</h2>
  <div class="chapter-rule"></div>
  <p class="chapter-intro">
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

  <div class="do-dont">
    <div class="dd-card dd-do">
      <div class="head">✓ Faça</div>
      <div class="body"><span style="font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.22em;">Treinar com Pelé</span> em Agency tracking-wide.</div>
    </div>
    <div class="dd-card dd-dont">
      <div class="head">✗ Não faça</div>
      <div class="body"><span style="font-family: var(--font-display); font-weight: 800; font-style: italic;">Treinar com Pelé</span> em Agency italic.</div>
    </div>
  </div>

  <div class="do-dont">
    <div class="dd-card dd-do">
      <div class="head">✓ Faça</div>
      <div class="body">CTA <span style="background: var(--neon-yellow); color: #000; padding: 2px 8px; font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.22em; font-size: 11px; border-radius: 3px;">Store</span> amarelo sólido.</div>
    </div>
    <div class="dd-card dd-dont">
      <div class="head">✗ Não faça</div>
      <div class="body">CTA <span style="background: linear-gradient(45deg, #a855f7, #06b6d4); color: #fff; padding: 2px 8px; font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.22em; font-size: 11px; border-radius: 3px;">Store</span> rainbow.</div>
    </div>
  </div>

  <div class="do-dont">
    <div class="dd-card dd-do">
      <div class="head">✓ Faça</div>
      <div class="body">Card com rail amarelo <code>border-l-[3px] border-l-neon-yellow</code></div>
    </div>
    <div class="dd-card dd-dont">
      <div class="head">✗ Não faça</div>
      <div class="body">Borda colorida arbitrária (purple, cyan, orange).</div>
    </div>
  </div>

  <div class="do-dont">
    <div class="dd-card dd-do">
      <div class="head">✓ Faça</div>
      <div class="body">Texto inativo <span style="color: rgba(255,255,255,0.45);">text-white/45</span> (token).</div>
    </div>
    <div class="dd-card dd-dont">
      <div class="head">✗ Não faça</div>
      <div class="body">Texto inativo <span style="color: #6b7280;">text-gray-500</span> (cor genérica).</div>
    </div>
  </div>

  <div class="do-dont">
    <div class="dd-card dd-do">
      <div class="head">✓ Faça</div>
      <div class="body">"Substituição por Lesão" + ícone Lucide.</div>
    </div>
    <div class="dd-card dd-dont">
      <div class="head">✗ Não faça</div>
      <div class="body">"🚑 Substituição por Lesão" com emoji em CTA.</div>
    </div>
  </div>
</div>

<!-- ─── CLOSING ─── -->
<div style="margin-top: 80px; padding-top: 32px; border-top: 1px solid rgba(253,225,0,0.18); text-align: center;">
  <p style="font-family: var(--font-serif); font-style: italic; font-weight: 500; font-size: 17px; color: rgba(255,255,255,0.65); max-width: 560px; margin: 0 auto;">
    "Eu nasci para jogar futebol, da mesma forma que Beethoven nasceu
    para escrever música e Michelangelo nasceu para pintar."
  </p>
  <p style="font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.32em; font-size: 10px; color: var(--neon-yellow); margin-top: 14px;">
    — Edson Arantes do Nascimento
  </p>
  <p style="font-family: var(--font-display); font-weight: 700; text-transform: uppercase; letter-spacing: 0.32em; font-size: 9px; color: rgba(255,255,255,0.30); margin-top: 36px;">
    Olefoot · Brandbook · Legacy Tech v1.0 · Abr/2026
  </p>
</div>

</div>
