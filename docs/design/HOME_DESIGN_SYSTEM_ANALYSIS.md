# Análise do Design System da Home — Olefoot

## Visão Geral

A página Home do Olefoot implementa um design system inspirado no rebrand do Borussia Dortmund (BVB) pela DesignStudio, com identidade visual forte, esportiva e cinematográfica. Este documento analisa os padrões visuais e fornece diretrizes para implementação em outras áreas.

---

## 1. Paleta de Cores (BVB-inspired)

### Cores Principais
```css
--stadium-night:  #0D0D0D    /* Preto profundo (fundo principal) */
--surface-dark:   #242424    /* Cinza escuro (cards) */
--yellow:         #FDE100    /* Amarelo neon (destaque primário) */
--text-primary:   #FFFFFF    /* Branco (texto principal) */
--text-secondary: #A0A0A0    /* Cinza médio (texto secundário) */
--border:         rgba(255, 255, 255, 0.08)  /* Bordas sutis */
```

### Uso na Home
- **Fundo geral**: `--stadium-night` (#0D0D0D)
- **Cards/Painéis**: `--surface-dark` (#242424) com borda `border-white/8`
- **Destaque/CTA**: `--yellow` (#FDE100) — botões primários, eyebrows, acentos
- **Borda de destaque**: `border-l-4 border-l-neon-yellow` (faixa amarela à esquerda)

### Semântica de Cor
```css
--success: #00FF66  /* Verde (vitória) */
--warning: #FFB300  /* Laranja (empate) */
--danger:  #FF3D3D  /* Vermelho (derrota) */
--info:    #3B82F6  /* Azul (informação) */
```

---

## 2. Tipografia — Hierarquia Editorial

### Famílias de Fonte
```css
--font-display:     'Druk Wide Bold'     /* Títulos, labels, UI forte */
--font-serif-hero:  'Moret'              /* Números editoriais, placares */
--font-ui:          'Inter'              /* Eyebrows, labels pequenos */
--font-sans:        'Inter'              /* Corpo de texto */
```

### Escalas Tipográficas

#### Display (Títulos Principais)
```css
--text-display-xl: 96px   /* Hero headlines */
--text-display-lg: 64px   /* Section titles */
--text-display-md: 48px   /* Card titles */
--text-display-sm: 32px   /* Subtítulos */
```

#### Editorial (Números/Placares)
```css
--text-editorial-xl: 84px   /* Placares gigantes */
--text-editorial-lg: 48px   /* Números de destaque */
--text-editorial-md: 32px   /* Stats */
--text-editorial-sm: 24px   /* Métricas */
```

#### UI (Interface)
```css
--text-ui-lg: 16px   /* Botões grandes */
--text-ui-md: 14px   /* Botões padrão */
--text-ui-sm: 12px   /* Labels */
--text-ui-xs: 11px   /* Eyebrows, tags */
```

### Padrões de Uso na Home

#### Eyebrow (Sobretítulo)
```tsx
<div className="ole-eyebrow !text-neon-yellow" style={{ fontFamily: 'var(--font-ui)' }}>
  <span>Próxima partida · {fixture.kickoffLabel}</span>
</div>
```
- Fonte: `--font-ui` (Inter)
- Tamanho: `10px` ou `11px`
- Peso: `600` (semibold)
- Tracking: `0.22em` (muito espaçado)
- Transform: `uppercase`
- Cor: `--yellow` ou `text-black/70` (sobre amarelo)

#### Headline Editorial (Moret Italic)
```tsx
<p className="italic text-neon-yellow leading-none tabular-nums"
   style={{
     fontFamily: 'var(--font-serif-hero)',
     fontWeight: 700,
     fontSize: 'clamp(2.5rem, 6vw, 3.75rem)',
     letterSpacing: '-0.03em',
   }}>
  {supportLabel}%
</p>
```
- Fonte: `--font-serif-hero` (Moret)
- Estilo: `italic`
- Peso: `700`
- Tracking: `-0.03em` (tight)
- Uso: Números grandes, placares, valores de destaque

#### Display Headline (Druk)
```tsx
<h3 className="text-xl font-display font-black uppercase tracking-wider text-white">
  Amistoso
</h3>
```
- Fonte: `--font-display` (Druk Wide Bold)
- Peso: `900` (black)
- Transform: `uppercase`
- Tracking: `0.2em` (wide)
- Uso: Títulos de seção, CTAs, labels fortes

---

## 3. Componentes Reutilizáveis

### 3.1 DashboardGrid + DashboardSection

Sistema de grid responsivo 12 colunas.

```tsx
<DashboardGrid>
  <DashboardSection size="wide">   {/* 12 cols */}
  <DashboardSection size="md">     {/* 6 cols tablet, 6 desktop */}
  <DashboardSection size="sm">     {/* 6 cols tablet, 3 desktop */}
  <DashboardSection size="lg">     {/* 12 cols tablet, 8 desktop */}
</DashboardGrid>
```

**Breakpoints:**
- Mobile (`<640px`): 1 coluna (stack vertical)
- Tablet (`640-1279px`): 12 colunas
- Desktop (`≥1280px`): 12 colunas

**Mapeamento de tamanhos:**
| Size   | Mobile | Tablet | Desktop | Uso                          |
|--------|--------|--------|---------|------------------------------|
| `sm`   | 1 col  | 6 cols | 3 cols  | KPI, card compacto (4/row)   |
| `md`   | 1 col  | 6 cols | 6 cols  | Feature block (2/row)        |
| `lg`   | 1 col  | 12 cols| 8 cols  | Conteúdo principal (⅔ row)   |
| `wide` | 1 col  | 12 cols| 12 cols | Hero, full-width             |

### 3.2 Card Pattern (Sports Panel)

Padrão visual de card usado em toda a Home:

```tsx
<div className="bg-[var(--color-card)] border border-white/8 border-l-4 border-l-neon-yellow rounded-sm overflow-hidden">
  {/* Header */}
  <div className="px-5 sm:px-6 py-5 sm:py-6 border-b border-white/10 flex flex-col items-center text-center gap-2">
    <div className="ole-eyebrow !text-neon-yellow">
      <span>Título da Seção</span>
    </div>
    <p className="text-white/55 uppercase" style={{
      fontFamily: 'var(--font-ui)',
      fontSize: '11px',
      letterSpacing: '0.22em',
      fontWeight: 600,
    }}>
      Subtítulo descritivo
    </p>
  </div>
  
  {/* Body */}
  <div className="px-6 py-4">
    {/* Conteúdo */}
  </div>
  
  {/* Footer (opcional) */}
  <div className="px-5 sm:px-6 pb-5 sm:pb-6 pt-2">
    <button className="w-full py-3 bg-neon-yellow text-black hover:bg-white">
      CTA Principal
    </button>
  </div>
</div>
```

**Anatomia:**
1. **Fundo**: `bg-[var(--color-card)]` (#242424)
2. **Borda geral**: `border border-white/8` (sutil)
3. **Borda de destaque**: `border-l-4 border-l-neon-yellow` (faixa amarela esquerda)
4. **Border-radius**: `rounded-sm` (4px — sharp esportivo)
5. **Divisores internos**: `border-white/10`

### 3.3 MatchdayHero

Hero cinematográfico full-width com split diagonal amarelo/preto.

**Características:**
- Split diagonal 62/38 (desktop) com `clip-path`
- Modo `solidYellow` para fundo amarelo total (sem split)
- Brasões reais ou sintéticos (círculo com sigla)
- Placar em Moret italic gigante
- MVP com foto P&B + número decorativo atrás
- Stats strip (5 colunas desktop, 2 mobile)
- Action buttons centralizados no rodapé
- Scroll cue (botão circular com chevron)

**Uso:**
```tsx
<MatchdayHero
  data={{
    competition: 'Brasileirão · Rodada 14',
    statusPrimary: 'Final',
    statusSecondary: 'Vitória',
    statusVariant: 'preview',
    solidYellow: true,  // Fundo amarelo total
    home: { short: 'FLA', name: 'Flamengo', score: 2, crestUrl: '...' },
    away: { short: 'PAL', name: 'Palmeiras', score: 1, crestUrl: '...' },
    stats: [
      { label: 'Vitórias', value: '8' },
      { label: 'Empates', value: '3' },
      // ...
    ],
    highlight: {
      name: 'Gabriel Barbosa',
      number: 9,
      quote: 'Dois gols em 15 minutos.',
      photoUrl: '...',
    },
    actions: [
      { label: 'Ver postgame', href: '/postgame', variant: 'primary' },
    ],
    scrollCueTargetId: 'home-below-fold',
  }}
/>
```

---

## 4. Padrões de Botões

### Botão Primário (Amarelo)
```tsx
<button className="bg-neon-yellow text-black hover:bg-white px-5 py-2.5 font-display font-bold uppercase tracking-[0.2em] text-[11px] sm:text-[12px] transition-colors shadow-[0_4px_12px_rgba(253,225,0,0.25)]"
        style={{ borderRadius: 'var(--radius-sm)' }}>
  Partida rápida
</button>
```
- Fundo: `bg-neon-yellow`
- Texto: `text-black`
- Hover: `hover:bg-white`
- Shadow: `0 4px 12px rgba(253,225,0,0.25)` (glow amarelo)
- Fonte: `font-display` (Druk)
- Tracking: `0.2em`

### Botão Outline (Preto com borda)
```tsx
<button className="bg-deep-black border border-[var(--color-border)] text-white px-5 py-2.5 font-display font-bold uppercase tracking-[0.2em] text-[11px] sm:text-[12px] hover:border-neon-yellow/60 hover:text-neon-yellow transition-colors"
        style={{ borderRadius: 'var(--radius-sm)' }}>
  Ver táticas
</button>
```
- Fundo: `bg-deep-black`
- Borda: `border border-[var(--color-border)]`
- Hover: `hover:border-neon-yellow/60 hover:text-neon-yellow`

### Botão Toggle (Tabs)
```tsx
<button className={cn(
  'px-3 py-1.5 border transition-colors',
  active
    ? 'border-neon-yellow bg-neon-yellow text-black'
    : 'border-[var(--color-border)] bg-deep-black text-white/65 hover:border-neon-yellow/50'
)}
style={{
  fontFamily: 'var(--font-display)',
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  borderRadius: 'var(--radius-sm)',
}}>
  Label
</button>
```

---

## 5. Spacing System (4px base)

```css
--space-xs:  4px
--space-sm:  8px
--space-md:  12px
--space-lg:  16px
--space-xl:  20px
--space-2xl: 24px
--space-3xl: 32px
--space-4xl: 40px
--space-5xl: 48px
--space-6xl: 64px
```

**Uso na Home:**
- Gap entre cards: `gap-4 lg:gap-6` (16px → 24px)
- Padding interno de card: `px-5 sm:px-6 py-5 sm:py-6` (20-24px)
- Margin entre seções: `space-y-8` (32px)

---

## 6. Border-Radius (Sharp Esportivo)

```css
--radius-none: 0px
--radius-sm:   4px   /* Padrão para cards, botões */
--radius-md:   8px   /* Máximo permitido */
```

**Regra:** Nunca ultrapassar 8px. O design BVB é sharp e angular.

---

## 7. Animações e Motion

### Framer Motion — Stagger de Cards
```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.1 }}
>
  {/* Card */}
</motion.div>
```

**Delays progressivos:**
- Card 1: `delay: 0.1`
- Card 2: `delay: 0.2`
- Card 3: `delay: 0.3`
- etc.

### Live Pulse (Indicador ao vivo)
```css
.live-dot {
  animation: ole-live-pulse 1.5s infinite;
}

@keyframes ole-live-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}
```

### Hover Glow (Amarelo)
```css
.ole-yellow-glow::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at center,
    rgba(253, 225, 0, 0.15) 0%,
    transparent 70%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
}
.ole-yellow-glow:hover::before {
  opacity: 1;
}
```

---

## 8. Padrões de Lista/Feed

### Últimos Resultados (Placar Horizontal)
```tsx
<div className="group relative flex overflow-hidden border border-white/10 bg-dark-gray hover:border-neon-yellow/30">
  {/* Barra de cor (V/E/D) */}
  <div className="w-1 shrink-0 bg-emerald-400" />
  
  {/* Casa */}
  <div className="flex-1 py-2.5 pl-3 pr-1 text-right">
    <span className="font-display font-bold text-xs uppercase text-neon-yellow">
      Flamengo
    </span>
  </div>
  
  {/* Placar */}
  <div className="shrink-0 px-3 border-x border-white/10 bg-black/40">
    <div className="flex items-center gap-1.5 font-display font-black tabular-nums">
      <span className="text-xl text-white">2</span>
      <span className="text-base text-neon-yellow">:</span>
      <span className="text-xl text-white">1</span>
    </div>
  </div>
  
  {/* Visitante */}
  <div className="flex-1 py-2.5 pr-3 pl-1 text-left">
    <span className="font-display font-bold text-xs uppercase text-gray-400">
      Palmeiras
    </span>
  </div>
  
  {/* Badge resultado */}
  <div className="shrink-0 w-14 flex flex-col items-center justify-center border-l border-white/10 bg-emerald-500/15">
    <span className="font-display font-black text-2xl text-emerald-300">V</span>
  </div>
</div>
```

### Notificações (Inbox Feed)
```tsx
<div className="flex items-start gap-4 p-4 hover:bg-white/5">
  {/* Timestamp */}
  <div className="text-gray-500 font-display font-bold text-sm w-12 text-right shrink-0">
    15min
  </div>
  
  {/* Barra de cor */}
  <div className="w-1 min-h-[2.5rem] bg-dark-gray relative shrink-0 rounded-sm">
    <div className="absolute inset-0 bg-neon-yellow opacity-50" />
  </div>
  
  {/* Conteúdo */}
  <div className="min-w-0 flex-1">
    <span className="text-[10px] font-bold uppercase tracking-widest text-neon-yellow">
      Staff
    </span>
    <h4 className="font-bold text-md mt-0.5">Título da notificação</h4>
    <p className="text-xs text-gray-400 mt-1">Corpo da mensagem...</p>
  </div>
</div>
```

---

## 9. Ranking Table (Football Manager Style)

```tsx
<div className="divide-y divide-white/5">
  {ranking.map((row) => (
    <div key={row.team} className="flex items-center gap-3 p-3 hover:bg-white/5">
      {/* Posição */}
      <div className={cn(
        'w-8 h-8 flex items-center justify-center text-xs font-display font-black rounded',
        row.rank <= 3 ? 'bg-neon-yellow text-black' : 'bg-white/10 text-white',
      )}>
        {row.rank <= 3 ? <Trophy className="w-4 h-4" /> : `#${row.rank}`}
      </div>
      
      {/* Time */}
      <div className="flex-1 min-w-0">
        <div className={cn(
          'text-sm font-display font-bold truncate',
          row.isMe ? 'text-neon-yellow' : 'text-white'
        )}>
          {row.team} {row.isMe ? '(Você)' : ''}
        </div>
        <div className="text-[10px] text-gray-500">{row.exp} EXP</div>
      </div>
      
      {/* Favorito */}
      <button className={cn(
        'p-1.5 rounded border',
        isFavorite ? 'border-neon-yellow text-neon-yellow' : 'border-white/10 text-gray-500'
      )}>
        <Star className={cn('w-4 h-4', isFavorite && 'fill-neon-yellow')} />
      </button>
    </div>
  ))}
</div>
```

---

## 10. Como Implementar em Outras Áreas

### Checklist de Implementação

#### 1. Estrutura de Layout
- [ ] Usar `DashboardGrid` + `DashboardSection` para layout responsivo
- [ ] Aplicar `-mx-3 -mt-3 sm:-mx-4 sm:-mt-4 lg:-mx-8 lg:-mt-8` em heroes full-bleed
- [ ] Espaçamento entre seções: `space-y-8` (32px)

#### 2. Cards/Painéis
- [ ] Fundo: `bg-[var(--color-card)]`
- [ ] Borda: `border border-white/8`
- [ ] Destaque: `border-l-4 border-l-neon-yellow`
- [ ] Border-radius: `rounded-sm` (4px)
- [ ] Divisores: `border-white/10`

#### 3. Tipografia
- [ ] Eyebrows: `font-ui`, `10-11px`, `uppercase`, `tracking-[0.22em]`, `text-neon-yellow`
- [ ] Headlines: `font-display`, `font-black`, `uppercase`, `tracking-wider`
- [ ] Números grandes: `font-serif-hero`, `italic`, `tabular-nums`
- [ ] Corpo: `font-sans`, `text-sm` ou `text-xs`, `text-gray-400`

#### 4. Botões
- [ ] Primário: `bg-neon-yellow text-black hover:bg-white`
- [ ] Outline: `bg-deep-black border border-white/15 hover:border-neon-yellow`
- [ ] Fonte: `font-display font-bold uppercase tracking-[0.2em]`
- [ ] Tamanho: `text-[11px] sm:text-[12px]`

#### 5. Cores
- [ ] Fundo: `bg-deep-black` (#0D0D0D)
- [ ] Cards: `bg-[var(--color-card)]` (#242424)
- [ ] Destaque: `text-neon-yellow` (#FDE100)
- [ ] Texto primário: `text-white`
- [ ] Texto secundário: `text-gray-400` ou `text-white/55`

#### 6. Animações
- [ ] Cards: `motion.div` com `initial/animate` + delay progressivo
- [ ] Hover: `transition-colors duration-200`
- [ ] Scale: `hover:scale-[1.01] active:scale-[0.99]`

---

## 11. Exemplos de Aplicação

### Página de Elenco (/team)
```tsx
<DashboardGrid>
  {/* Hero com formação tática */}
  <DashboardSection size="wide">
    <MatchdayHero data={tacticalPreview} />
  </DashboardSection>
  
  {/* Lista de jogadores */}
  <DashboardSection size="md">
    <div className="bg-[var(--color-card)] border border-white/8 border-l-4 border-l-neon-yellow rounded-sm">
      <div className="px-6 py-6 border-b border-white/10">
        <div className="ole-eyebrow !text-neon-yellow">
          <span>Plantel · 25 jogadores</span>
        </div>
      </div>
      <div className="divide-y divide-white/5">
        {players.map(player => (
          <PlayerCard key={player.id} player={player} />
        ))}
      </div>
    </div>
  </DashboardSection>
  
  {/* Stats do time */}
  <DashboardSection size="sm">
    <div className="bg-[var(--color-card)] border border-white/8 border-l-4 border-l-neon-yellow rounded-sm p-6">
      <div className="ole-eyebrow !text-neon-yellow mb-4">
        <span>Overall médio</span>
      </div>
      <p className="italic text-neon-yellow leading-none tabular-nums"
         style={{
           fontFamily: 'var(--font-serif-hero)',
           fontSize: 'clamp(2.5rem, 6vw, 3.75rem)',
         }}>
        78
      </p>
    </div>
  </DashboardSection>
</DashboardGrid>
```

### Página de Transferências (/transfer)
```tsx
<DashboardGrid>
  {/* Featured player */}
  <DashboardSection size="wide">
    <div className="relative bg-neon-yellow overflow-hidden rounded-sm min-h-[400px]">
      {/* Foto P&B + número decorativo (padrão MatchdayHero MVP) */}
      <div className="absolute right-0 bottom-0 h-full aspect-[4/5]">
        <img src={player.photo} className="ole-player-photo-bw" />
      </div>
      <div className="relative z-10 p-8">
        <div className="ole-eyebrow" style={{ color: 'black' }}>
          <span>Destaque do mercado</span>
        </div>
        <h2 className="ole-headline text-black mt-4">
          {player.name}
        </h2>
        <button className="mt-6 bg-black text-neon-yellow px-6 py-3 font-display font-bold uppercase">
          Ver perfil
        </button>
      </div>
    </div>
  </DashboardSection>
  
  {/* Lista de transferências */}
  <DashboardSection size="md">
    {/* Card padrão com lista */}
  </DashboardSection>
</DashboardGrid>
```

---

## 12. Regras de Ouro

1. **Amarelo é destaque, não decoração** — use com propósito (CTAs, eyebrows, métricas importantes)
2. **Sharp, não round** — border-radius máximo 8px
3. **Preto profundo** — `#0D0D0D`, não `#000000`
4. **Tipografia hierárquica** — Druk para força, Moret para editorial, Inter para UI
5. **Espaçamento generoso** — não economize padding/gap
6. **Borda amarela à esquerda** — assinatura visual dos cards importantes
7. **Motion sutil** — stagger de entrada, hover suave, sem exageros
8. **Foto P&B** — filtro `grayscale(1) contrast(1.05)` em fotos de jogadores
9. **Uppercase com tracking** — `uppercase tracking-[0.2em]` em labels/botões
10. **Números em Moret italic** — placares, stats, valores de destaque

---

## 13. Recursos

### Arquivos de Referência
- `/src/pages/Home.tsx` — implementação completa
- `/src/components/matchday/MatchdayHero.tsx` — hero cinematográfico
- `/src/components/dashboard/` — grid system
- `/src/styles/design-system.css` — tokens e utilities
- `/docs/OLEFOOT_DESIGN_BRIEF.md` — brief original do design system

### Ferramentas
- Framer Motion — animações
- Tailwind CSS — utilities
- Lucide React — ícones
- clsx/cn — conditional classes

---

**Última atualização:** 2026-04-25
