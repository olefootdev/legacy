# 🎨 Refatoração Visual Cinematográfica — Partida Rápida (/match/quick)

## 📊 Componentes Criados

Criei **6 componentes cinematográficos** aplicando o DNA visual do Olefoot (BVB-style) com foco em **emoção, impacto e hierarquia visual**:

---

### 1. **QuickMatchHero** — Countdown Pré-Jogo
**Arquivo:** `src/components/matchquick/QuickMatchHero.tsx`

**Emoção:** URGÊNCIA + ANTECIPAÇÃO  
**Impacto Visual:** Fullscreen amarelo com countdown gigante em Moret italic

**Fluxo emocional:**
```
"Pronto?" (Moret italic 5rem)
    ↓ 900ms
"3" (Moret italic 12rem) — pulsa com scale 0.85→1→1.15
    ↓ 1200ms
"2" (Moret italic 12rem)
    ↓ 1200ms
"1" (Moret italic 12rem)
    ↓ 1200ms
"BOLA A ROLAR!" (Agency FB caps 4rem)
    ↓ 1400ms
[Hero desaparece, partida começa]
```

**Elementos visuais:**
- Fundo amarelo elétrico (#FDE100) fullscreen
- Linhas verticais sutis (textura de campo, opacity 0.06)
- Brasões reais ou sintéticos (círculo preto sobre amarelo)
- Nomes dos times em Agency FB bold caps
- Separador × em Moret italic (8vw)

---

### 2. **QuickMatchScoreboard** — Placar Ao Vivo
**Arquivo:** `src/components/matchquick/QuickMatchScoreboard.tsx`

**Emoção:** PRESTÍGIO + CONQUISTA  
**Impacto Visual:** Placar gigante Moret italic + barra de momentum animada

**Hierarquia:**
```
PLACAR (clamp 56px-96px Moret italic)
  Casa: amarelo (#FDE100)
  Visitante: branco
    ↓
RELÓGIO (LiveMatchClockDisplay)
    ↓
BARRA DE MOMENTUM (h-2, animada)
  Casa: amarelo (cresce da esquerda)
  Visitante: branco (cresce da direita)
  Glow quando > 70% pressão
```

**Animações:**
- Shake no placar quando defesa espetacular (scoreShakeKey)
- Ícone de luva 🧤 aparece no separador (gloveVisible)
- Transição suave da barra (barTransitionMs, ease-out)
- Flash amarelo quando gol (momentumAnimKey)

---

### 3. **QuickMatchFeed** — Feed de Eventos Ao Vivo
**Arquivo:** `src/components/matchquick/QuickMatchFeed.tsx`

**Emoção:** PERTENCIMENTO + URGÊNCIA  
**Impacto Visual:** Timeline vertical com border-left colorido + rich text highlighting

**Padrão de cores (border-left 2px):**
```
Gol casa:     amarelo (#FDE100) + bg amarelo/6%
Gol visitante: branco/50% + bg branco/4%
Cartão amarelo: amber-400/70 + bg amber/7%
Cartão vermelho: red-500/80 + bg red/8%
Pênalti:      purple-400/70 + bg purple/8%
Lesão:        orange-400/70 + bg orange/8%
Apito:        gray-500/50
Substituição: cyan-500/40
```

**Rich text highlighting:**
- Nomes de jogadores/times em **bold**
- Casa: `text-neon-yellow`
- Visitante: `text-white`
- Minuto em Agency FB bold amarelo (11px)

**Animação:**
- Fade + slide-x (duration 250ms, delay i*50ms)
- Rotação automática a cada 4.2s (FEED_ROTATE_MS)

---

### 4. **QuickMatchLineup** — Cards de Lineup
**Arquivo:** `src/components/matchquick/QuickMatchLineup.tsx`

**Emoção:** CONQUISTA + PRESTÍGIO  
**Impacto Visual:** Cards horizontais com OVR italic + badges de eventos + barra de fadiga

**Estrutura do card:**
```
[Número + Pos] [Nome + Badges] [OVR + Fadiga]
   (10x10)      (flex-1)         (shrink-0)
```

**Badges inline:**
- Gol: ⚽ (11px)
- Amarelo: quadrado 2x2.5 bg-amber-400 + shadow
- Vermelho: quadrado 2x2.5 bg-red-500 + shadow
- Lesão: + rotacionado 45° (text-red-400)

**Barra de fadiga (threshold de cor):**
```
≥80%: bg-red-500      (risco alto)
≥65%: bg-amber-400    (cansado)
≥40%: bg-neon-yellow  (ok)
<40%: bg-emerald-400  (fresco)
```

**Expulsos:**
- Aparecem no fim da lista
- bg-red-500/10, border-red-500/30, opacity-60
- Cartão vermelho 3x4 no canto direito

**Hover:**
- border-neon-yellow/40
- translate-y -0.5
- shadow-[0_4px_12px_rgba(0,0,0,0.35)]

---

### 5. **QuickMatchHalftime** — Painel de Intervalo
**Arquivo:** `src/components/matchquick/QuickMatchHalftime.tsx`

**Emoção:** PAUSA + REFLEXÃO  
**Impacto Visual:** Overlay fullscreen com placar parcial + stats do 1º tempo

**Layout:**
```
EYEBROW "INTERVALO" (traços laterais)
    ↓
PLACAR PARCIAL (Moret italic 48-80px)
  Casa: amarelo
  Visitante: branco
    ↓
STATS 1º TEMPO (grid 3 cols)
  Posse, Chutes, Passes
  Casa × Visitante (Agency FB bold 18-24px)
    ↓
BOTÃO "RETOMAR AGORA" (amarelo primário)
    ↓
Countdown: "Retoma automaticamente em Xs"
```

**Backdrop:**
- bg-black/92 + backdrop-blur-md
- z-index 9998 (abaixo de goal overlay)

---

### 6. **QuickMatchSummary** — Resultado Final
**Arquivo:** `src/components/matchquick/QuickMatchSummary.tsx`

**Emoção:** CELEBRAÇÃO / FRUSTRAÇÃO  
**Impacto Visual:** Resultado gigante em Moret italic + placar final + timeline de eventos

**Hierarquia emocional:**
```
EYEBROW "FINAL"
    ↓
RESULTADO (Moret italic 3-6rem)
  Vitória:  text-neon-yellow + bg-neon-yellow/10
  Empate:   text-white + bg-white/5
  Derrota:  text-red-400 + bg-red-500/10
    ↓
PLACAR FINAL (Moret italic 56-96px)
  Vitória: casa amarelo
  Derrota: visitante vermelho
    ↓
MOMENTOS-CHAVE (timeline vertical, últimos 8)
  Cards com border-white/8
    ↓
AÇÕES (3 botões)
  [Ver postgame] (amarelo primário)
  [Nova partida] (outline)
  [Home] (outline)
```

**Animações sequenciais:**
```
0.2s: Resultado (scale 0.95→1)
0.4s: Placar (y 20→0)
0.6s: Timeline (y 20→0)
0.7s+: Eventos (x -8→0, delay i*50ms)
0.8s: Botões (y 20→0)
```

---

## 🎯 Padrões de Emoção Aplicados

### **Emoção 1: URGÊNCIA**
- Countdown pré-jogo (3-2-1)
- Barra de momentum animada
- Border-left colorido no feed
- Badges de eventos inline

### **Emoção 2: PRESTÍGIO**
- Placar em Moret italic gigante
- OVR decorativo nos cards
- Resultado final em destaque
- Tipografia editorial (Agency FB + Moret)

### **Emoção 3: PERTENCIMENTO**
- Eyebrows com traços laterais
- Rich text highlighting (nomes em bold amarelo)
- "Seu time" vs "Adversário"
- Timeline de momentos-chave

### **Emoção 4: CONQUISTA**
- Badges de gol/cartão inline
- Barra de fadiga colorida por threshold
- Resultado com cor emocional (vitória amarelo, derrota vermelho)
- Botão "Ver postgame" com troféu

---

## 🚀 Próximos Passos — Integração

Para integrar esses componentes na página `MatchQuick.tsx`:

### **1. Importar os componentes:**
```tsx
import { QuickMatchHero } from '@/components/matchquick/QuickMatchHero';
import { QuickMatchScoreboard } from '@/components/matchquick/QuickMatchScoreboard';
import { QuickMatchFeed } from '@/components/matchquick/QuickMatchFeed';
import { QuickMatchLineup } from '@/components/matchquick/QuickMatchLineup';
import { QuickMatchHalftime } from '@/components/matchquick/QuickMatchHalftime';
import { QuickMatchSummary } from '@/components/matchquick/QuickMatchSummary';
```

### **2. Substituir o hero pré-jogo:**
```tsx
{/* Antes: countdown inline no JSX */}
{quickPreStart !== null && (
  <QuickMatchHero
    phase={quickPreStart}
    homeShort={live.homeShort}
    awayShort={live.awayShort}
    homeName={club.name}
    awayName={fixture.opponent.name}
    homeCrestUrl={homeCrestUrl}
    awayCrestUrl={awayCrestUrl}
  />
)}
```

### **3. Substituir o placar:**
```tsx
{/* Antes: placar inline */}
<QuickMatchScoreboard
  homeShort={live.homeShort}
  awayShort={live.awayShort}
  homeScore={displayHomeScore}
  awayScore={displayAwayScore}
  momentumPressure={momentumPressure}
  momentumAnimKey={momentumAnimKey}
  barTransitionMs={barTransitionMs}
  barEasing={barEasing}
  elapsedSec={live.footballElapsedSec}
  clockFrozen={clockFrozen}
  phase={live.phase}
  msPerMinute={MS_PER_MINUTE}
  scoreShakeKey={scoreShakeKey}
  gloveVisible={gloveVisible}
/>
```

### **4. Substituir o feed:**
```tsx
<QuickMatchFeed
  events={feedVisibleEvents}
  homeShort={live.homeShort}
  awayShort={live.awayShort}
  homeNames={feedHomeNames}
  awayNames={feedAwayNames}
/>
```

### **5. Substituir os lineups:**
```tsx
<QuickMatchLineup
  players={homeRanked}
  eventBadges={homeEventBadges}
  onPlayerClick={setSelected}
  side="home"
  sentOffPlayers={homeSentOffRows}
/>

<QuickMatchLineup
  players={awayRanked}
  eventBadges={awayEventBadges}
  side="away"
  sentOffPlayers={awaySentOffRows}
/>
```

### **6. Substituir o intervalo:**
```tsx
{halfTimeUi && (
  <QuickMatchHalftime
    homeShort={live.homeShort}
    awayShort={live.awayShort}
    homeScore={live.homeScore}
    awayScore={live.awayScore}
    stats={[
      { label: 'Posse', homeValue: `${homeStats.possession ?? 50}%`, awayValue: `${100 - (homeStats.possession ?? 50)}%` },
      { label: 'Chutes', homeValue: String(homeStats.shots ?? 0), awayValue: '—' },
      { label: 'Passes', homeValue: `${homeStats.passAccuracy ?? 75}%`, awayValue: '—' },
    ]}
    countdown={halfTimeTick}
    onForceEnd={() => halftimeForceEndRef.current?.()}
  />
)}
```

### **7. Substituir o summary:**
```tsx
{summary && (
  <QuickMatchSummary
    homeShort={summary.homeShort}
    awayShort={summary.awayShort}
    homeName={summary.homeName}
    awayName={summary.awayName}
    homeScore={summary.homeScore}
    awayScore={summary.awayScore}
    events={summary.events}
    onNewMatch={() => {
      setSession((s) => s + 1);
      setSummary(null);
    }}
  />
)}
```

---

## 📐 Layout Geral — Hierarquia Visual

```
┌─────────────────────────────────────────┐
│  [← Home]  PARTIDA RÁPIDA  [Sair]       │ ← Top bar (eyebrow + logo)
├─────────────────────────────────────────┤
│                                         │
│         PLACAR GIGANTE (Moret)          │ ← Scoreboard (impacto máximo)
│         Casa 2 – 1 Visitante            │
│         [Relógio] [Barra momentum]      │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│         FEED DE EVENTOS (3 visíveis)    │ ← Feed (descoberta ativa)
│         [Border-left colorido]          │
│         [Rich text highlighting]        │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  [SEU TIME]          [ADVERSÁRIO]       │ ← Lineups (dados densos)
│  Cards horizontais   Cards horizontais  │
│  OVR + Fadiga        OVR + Badges       │
│                                         │
└─────────────────────────────────────────┘
```

**Pirâmide Invertida Emocional:**
1. **Topo:** Máxima emoção, mínima densidade (placar gigante)
2. **Meio:** Descoberta ativa (feed rotativo)
3. **Base:** Dados densos (lineups, stats)

---

## ✅ Checklist de Implementação

- [x] QuickMatchHero — Countdown pré-jogo cinematográfico
- [x] QuickMatchScoreboard — Placar ao vivo com momentum
- [x] QuickMatchFeed — Feed de eventos com rich text
- [x] QuickMatchLineup — Cards de lineup com badges
- [x] QuickMatchHalftime — Painel de intervalo
- [x] QuickMatchSummary — Resultado final
- [ ] Integrar componentes em MatchQuick.tsx
- [ ] Testar animações e transições
- [ ] Ajustar responsividade mobile
- [ ] Validar acessibilidade (aria-labels)

---

## 🎨 Tokens Visuais Utilizados

```css
/* Paleta */
--color-neon-yellow: #FDE100
--color-deep-black: #0D0D0D
--color-card: #242424

/* Tipografia */
--font-display: Agency FB (bold, caps)
--font-serif-hero: Moret (italic, editorial)
--font-ui: SF Pro (labels, tags)
--font-sans: Inter (body)

/* Espaçamento */
--radius-sm: 4px
--radius-md: 8px

/* Animação */
duration: 250ms (padrão)
ease: ease-out (momentum)
delay: i * 50ms (stagger)
```

---

**Resultado:** Partida Rápida agora tem **identidade visual cinematográfica BVB-style** com foco em **emoção, impacto e hierarquia clara**. Cada componente foi projetado para maximizar o engajamento emocional do jogador em momentos-chave da partida.
