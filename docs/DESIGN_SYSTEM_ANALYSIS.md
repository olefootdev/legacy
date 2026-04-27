# Análise do Design System Olefoot (BVB-Inspired)

**Data:** 2026-04-25  
**Baseado em:** HOME, TRANSFER, LEGEND, design-system.css

---

## 🎨 Filosofia Visual

O design system do Olefoot é inspirado no **BVB Rebrand 2023 (DesignStudio)** com identidade de **futebol elétrico, cinematográfico e esportivo**.

### Palavras-chave
- **Elétrico** — amarelo neon como holofote único
- **Estádio à noite** — preto profundo como gramado escuro
- **Cinematográfico** — composições editoriais, não apenas UI
- **Esportivo** — sharp, angular, sem decoração excessiva

---

## 🎯 Componentes Core

### 1. **MatchdayHero** (Composição Editorial Máxima)

**Localização:** `src/components/matchday/MatchdayHero.tsx`

**Características:**
- Hero full-screen (78vh-88vh)
- Split diagonal 62/38 (amarelo esquerda, preto direita)
- Modo `solidYellow` para fundo amarelo total
- Brasões reais ou sintéticos (3 letras em círculo)
- Stats em grid horizontal
- Highlight de jogador com foto P&B + número gigante
- CTAs centralizados no rodapé
- Scroll cue animado

**Anatomia:**
```
┌─────────────────────────────────────┐
│ ← Olefoot    COMPETIÇÃO    STATUS  │
│                                     │
│  [BRASÃO]         ×        [BRASÃO]│
│   CASA          vs/2×1      AWAY   │
│   Nome          placar      Nome   │
│   Form pills               Form    │
│                                     │
│  Stats: Posse | Chutes | No gol   │
│                                     │
│  [FOTO P&B]    #9 gigante          │
│  Nome jogador                       │
│  "Quote editorial em Moret italic" │
│                                     │
│  [CTA Primary]  [CTA Outline]      │
│                                     │
│  ↓ Scroll cue                      │
└─────────────────────────────────────┘
```

**Uso:**
- `/` (Home) — último resultado ou próxima partida
- `/matchday/preview` — preview standalone
- Modo RESULTADO vs modo PREVIEW

---

### 2. **TransferHeroSlider** (Hero Promocional)

**Localização:** `src/transfer/TransferHeroSlider.tsx`

**Características:**
- Slider automático (6.5s por slide)
- Altura: 220px (mobile) → 340px (desktop)
- Gradientes temáticos por aba
- Tag vertical amarela (▍ + texto SF Pro caps)
- Título em Moret italic (case mixto)
- Subtítulo em SF Pro UI
- CTA opcional
- Fallback com gradiente + label quando sem imagem

**Abas suportadas:**
- `genesis`, `legacies`, `newbies`, `highlights`
- `store-all`, `store-packs`, `store-boosters`, `store-extra`

**Uso:**
- `/transfer` — topo da página
- `/store` — hero promocional

---

### 3. **Legend Page** (Perfil Editorial)

**Localização:** `src/pages/Legend.tsx`

**Características:**
- Hero amarelo total com watermark gigante do nome
- Eyebrow + nome em Moret italic (case mixto)
- Foto P&B 4:5 com sombra
- Quote em Moret italic
- Timeline horizontal (cards pretos)
- DNA DO CAMPEÃO: grid 3×2 de atributos com barras amarelas

**Estrutura:**
```
┌─────────────────────────────────────┐
│ FUNDO AMARELO TOTAL                 │
│                                     │
│ ← Voltar          Olefoot →        │
│                                     │
│ ━━━ O REI DO FUTEBOL ━━━           │
│                                     │
│         Pelé                        │
│    (Moret italic)                   │
│                                     │
│      [FOTO P&B]                     │
│                                     │
│ "Eu nasci para jogar futebol..."   │
│ — Edson Arantes do Nascimento      │
│                                     │
│ [CTA Ver trajetória]               │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ FUNDO PRETO                         │
│                                     │
│ ━━━ TRAJETÓRIA ━━━                 │
│                                     │
│ [1958] [1962] [1970] [1977] →      │
│  Card   Card   Card   Card         │
│                                     │
│ ━━━ DNA DO CAMPEÃO ━━━             │
│                                     │
│ FINALIZAÇÃO  ████████████ 98       │
│ DRIBLE       ███████████  96       │
│ VELOCIDADE   ██████████   94       │
│ PASSE        █████████    92       │
│ FÍSICO       ████████     88       │
│ MENTALIDADE  █████████████ 99      │
└─────────────────────────────────────┘
```

---

## 📐 Tokens de Design

### Cores (src/index.css)

```css
--color-neon-yellow: #FDE100;      /* Holofote único */
--color-neon-green:  #00FF66;      /* Sucesso */
--color-deep-black:  #0D0D0D;      /* Gramado escuro */
--color-dark-gray:   #1A1A1A;
--color-panel:       #1A1A1A;
--color-card:        #242424;
--color-card-hi:     #2E2E2E;
--color-text-soft:   #A0A0A0;
--color-text-muted:  #555555;

/* Semânticos */
--color-success: #00C851;
--color-warning: #FFB300;
--color-danger:  #FF3D3D;
--color-info:    #2979FF;

/* Threshold Football Manager */
--attr-elite: #00FF66;  /* 80+   */
--attr-good:  #FDE100;  /* 65–79 */
--attr-avg:   #FFB300;  /* 50–64 */
--attr-weak:  #FF3D3D;  /* <50   */
```

### Tipografia

```css
--font-display:     "Agency FB", Impact, Oswald;     /* Gritos */
--font-serif-hero:  "Moret", Georgia;                /* Emoção */
--font-ui:          "SF Pro Display", -apple-system; /* Organização */
--font-sans:        "Inter", ui-sans-serif;          /* História */
```

**Hierarquia:**
- **Agency FB** (display) — títulos, placares, números, caps lock
- **Moret italic** (serif-hero) — quotes, subtítulos emocionais, case mixto
- **SF Pro** (ui) — labels, eyebrows, stats, caps 0.18em tracking
- **Inter** (sans) — corpo de texto, parágrafos

### Escala Tipográfica

```css
--text-xs:     11px;
--text-sm:     13px;
--text-base:   15px;
--text-lg:     18px;
--text-xl:     22px;
--text-2xl:    32px;
--text-3xl:    48px;
--text-hero:   80px;
--text-score:  96px;   /* Placar */
--text-rating: 56px;   /* Overall */
```

### Spacing (4px base)

```css
--space-xs:  4px;
--space-sm:  8px;
--space-md:  12px;
--space-lg:  16px;
--space-xl:  20px;
--space-2xl: 24px;
--space-3xl: 32px;
--space-4xl: 40px;
--space-5xl: 48px;
--space-6xl: 64px;
```

### Border Radius (Sharp Esportivo)

```css
--radius-none: 0px;
--radius-sm:   4px;
--radius-md:   8px;  /* Máximo permitido */
```

### Diagonal (Assinatura BVB)

```css
--angle: 34deg;  /* Inclinação característica */
```

---

## 🧩 Utilities CSS

### Eyebrow (Label Superior)

```css
.ole-eyebrow {
  font-family: var(--font-ui);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.35em;
  color: var(--color-neon-yellow);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.ole-eyebrow::before,
.ole-eyebrow::after {
  content: "";
  height: 1px;
  width: 32px;
  background: var(--color-neon-yellow);
  opacity: 0.4;
}
```

**Uso:**
```jsx
<div className="ole-eyebrow">PRÓXIMA PARTIDA</div>
```

### Headline (Título Principal)

```css
.ole-headline {
  font-family: var(--font-display);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: -0.01em;
  line-height: 0.95;
}

.ole-headline-italic {
  font-family: var(--font-serif-hero);
  font-style: italic;
  font-weight: 400;
  letter-spacing: -0.005em;
}
```

**Uso:**
```jsx
<h1 className="ole-headline text-5xl">
  VITÓRIA<span className="ole-headline-italic text-neon-yellow">.</span>
</h1>
```

### Scoreboard (Placar)

```css
.ole-scoreboard {
  font-family: var(--font-display);
  font-weight: 900;
  font-size: var(--text-score);
  line-height: 0.9;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: #fff;
}

.ole-scoreboard__separator {
  color: var(--color-text-muted);
  font-size: 0.5em;
  padding: 0 0.3em;
}

.ole-scoreboard--live {
  color: var(--color-neon-yellow);
}
```

**Uso:**
```jsx
<div className="ole-scoreboard">
  3<span className="ole-scoreboard__separator">×</span>1
</div>
```

### Cards

```css
.ole-card {
  background: var(--color-card);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-md);
}

.ole-card-accent {
  background: var(--color-card);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-md);
  border-left: 4px solid var(--color-neon-yellow);
}

.ole-card-hover {
  transition: all 150ms;
}

.ole-card-hover:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.45);
}
```

### Tabelas (Football Manager Style)

```css
.ole-table {
  width: 100%;
  border-collapse: collapse;
}

.ole-table thead th {
  font-family: var(--font-ui);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-weight: 600;
  color: rgba(255,255,255,0.5);
  background: var(--color-card);
  padding: 0.75rem 0.5rem;
  text-align: left;
  position: sticky;
  top: 0;
  z-index: 10;
}

.ole-table tbody tr:nth-child(odd) {
  background: var(--color-deep-black);
}

.ole-table tbody tr:nth-child(even) {
  background: var(--color-card);
}

.ole-table tbody tr:hover {
  background: var(--color-card-hi);
}

.ole-table tbody tr[data-is-user="true"] {
  background: rgba(253,225,0,0.05) !important;
  border-left: 3px solid var(--color-neon-yellow);
}
```

### Atributos com Tier

```css
.ole-attr {
  font-family: var(--font-display);
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

.ole-attr[data-tier="elite"] { color: var(--attr-elite); }
.ole-attr[data-tier="good"]  { color: var(--attr-good); }
.ole-attr[data-tier="avg"]   { color: var(--attr-avg); }
.ole-attr[data-tier="weak"]  { color: var(--attr-weak); }
```

**Helper:**
```ts
export const attrTier = (n: number) =>
  n >= 80 ? 'elite' : n >= 65 ? 'good' : n >= 50 ? 'avg' : 'weak';
```

**Uso:**
```jsx
<span className="ole-attr" data-tier={attrTier(85)}>85</span>
```

### Clip-paths Angulares

```css
.clip-angular-btn {
  clip-path: polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%);
}

.clip-angular-card {
  clip-path: polygon(
    0 0,
    100% 0,
    100% calc(100% - 16px),
    calc(100% - 16px) 100%,
    0 100%
  );
}

.ole-hero-split {
  /* Mobile: 92/75 */
  clip-path: polygon(0 0, 92% 0, 75% 100%, 0% 100%);
}

@media (min-width: 640px) {
  .ole-hero-split {
    /* Tablet: 75/50 */
    clip-path: polygon(0 0, 75% 0, 50% 100%, 0% 100%);
  }
}

@media (min-width: 1024px) {
  .ole-hero-split {
    /* Desktop: 62/38 (editorial original) */
    clip-path: polygon(0 0, 62% 0, 38% 100%, 0% 100%);
  }
}
```

### Diagonal Accent

```css
.diagonal-accent {
  position: absolute;
  background: var(--color-neon-yellow);
  opacity: 0.06;
  transform: skewX(calc(-1 * var(--angle))) rotate(8deg);
  pointer-events: none;
}
```

### Live Dot (Pulsante)

```css
.live-dot {
  animation: ole-live-pulse 1.5s infinite;
}

@keyframes ole-live-pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.4;
    transform: scale(0.85);
  }
}
```

### Yellow Glow (Hover)

```css
.ole-yellow-glow::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at center,
    rgba(253,225,0,0.15) 0%,
    transparent 70%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.ole-yellow-glow:hover::before {
  opacity: 1;
}
```

### Watermark Gigante

```css
.ole-watermark {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-family: var(--font-display);
  font-weight: 900;
  font-size: clamp(160px, 32vw, 480px);
  line-height: 0.85;
  letter-spacing: -0.02em;
  color: currentColor;
  opacity: 0.03;
  pointer-events: none;
  user-select: none;
  text-transform: uppercase;
  overflow: hidden;
  white-space: nowrap;
}
```

### Foto P&B (Estética BVB)

```css
.ole-player-photo-bw {
  filter: grayscale(1) contrast(1.05);
}
```

### Divider Vertical Amarelo

```css
.ole-y-divider-3 {
  background: var(--color-neon-yellow);
  width: 3px;
}
```

---

## 📱 Padrões de Layout

### DashboardGrid (Home)

**Localização:** `src/components/dashboard/`

Grid responsivo com seções de tamanhos variados:
- `size="wide"` — full width
- `size="md"` — 2 colunas no desktop
- `size="sm"` — 3 colunas no desktop

**Uso:**
```jsx
<DashboardGrid id="home-below-fold">
  <DashboardSection size="wide">
    {/* Próxima partida */}
  </DashboardSection>
  
  <DashboardSection size="md">
    {/* Ranking preview */}
  </DashboardSection>
  
  <DashboardSection size="sm">
    {/* Inbox */}
  </DashboardSection>
</DashboardGrid>
```

### Hero + Cards (Padrão /city, /team)

```
┌─────────────────────────────────────┐
│ HERO PRINCIPAL (grande)             │
│ - Foto placeholder                  │
│ - Nome + nível                      │
│ - Stats principais                  │
│ - CTA primário                      │
└─────────────────────────────────────┘

┌──────────────┐ ┌──────────────┐
│ CARD MENOR 1 │ │ CARD MENOR 2 │
│ - Foto       │ │ - Foto       │
│ - Nome       │ │ - Nome       │
│ - 2 stats    │ │ - 2 stats    │
│ - 2 botões   │ │ - 2 botões   │
└──────────────┘ └──────────────┘

┌──────────────┐ ┌──────────────┐
│ CARD MENOR 3 │ │ CARD MENOR 4 │
└──────────────┘ └──────────────┘
```

---

## 🎬 Animações

### Motion Presets

```jsx
// Fade in + slide up
<motion.div
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4 }}
>

// Stagger children
{items.map((item, i) => (
  <motion.div
    key={item.id}
    initial={{ opacity: 0, x: -16 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: i * 0.04 }}
  >
))}

// Scale + fade (hero slider)
<motion.div
  initial={{ opacity: 0, scale: 1.02 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0, scale: 0.99 }}
  transition={{ duration: 0.45, ease: 'easeOut' }}
>
```

### Reduce Motion

```css
html.olefoot-reduce-motion *,
html.olefoot-reduce-motion *::before,
html.olefoot-reduce-motion *::after {
  animation-duration: 0.001ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 50ms !important;
  scroll-behavior: auto !important;
}
```

---

## 🎯 Padrões de Uso

### Quando usar MatchdayHero
- Página inicial (último resultado ou próxima partida)
- Preview de partida standalone
- Qualquer composição editorial de alto impacto

### Quando usar TransferHeroSlider
- Topo de páginas de mercado (/transfer)
- Topo de loja (/store)
- Promoções e drops

### Quando usar Legend
- Perfis de lendas do futebol
- Hall of Fame
- Perfis de jogadores históricos

### Quando usar Hero + Cards
- Páginas de gestão (/city, /team)
- Estruturas do clube
- Qualquer página com item principal + subitens

---

## ✅ Checklist de Implementação

Ao criar uma nova página, garantir:

- [ ] Eyebrow (`.ole-eyebrow`) para labels superiores
- [ ] Headline (`.ole-headline` + `.ole-headline-italic`) para títulos
- [ ] Cards (`.ole-card`, `.ole-card-accent`) para containers
- [ ] Atributos com tier (`.ole-attr` + `data-tier`) para números
- [ ] Tabelas (`.ole-table`) para rankings/listas
- [ ] Tipografia correta (Agency FB caps, Moret italic, SF Pro labels)
- [ ] Cores semânticas (amarelo=destaque, verde=sucesso, vermelho=perigo)
- [ ] Border-radius máximo 8px
- [ ] Spacing em múltiplos de 4px
- [ ] Animações com motion (fade + slide)
- [ ] Reduce motion respeitado
- [ ] Mobile-first (breakpoints: 640px, 1024px)
- [ ] Overflow-x prevenido

---

## 📚 Referências

- **BVB Rebrand 2023** — DesignStudio
- **EA FC** — cards de jogador
- **Football Manager** — threshold de atributos, tabelas
- **Nike** — tipografia bold, layouts limpos
- **Olefoot Brief v2** — `docs/OLEFOOT_DESIGN_BRIEF.md`

---

**Última atualização:** 2026-04-25  
**Mantido por:** Claude Code (Opus 4.7)
