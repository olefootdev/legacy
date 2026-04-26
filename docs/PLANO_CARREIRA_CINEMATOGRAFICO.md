# 🎬 PLANO DE CARREIRA CINEMATOGRÁFICO

Melhorias visuais no **Plano de Carreira** da página `/manager` — ícones maiores, mais emoção, visual impactante.

---

## 🎯 **ANTES × DEPOIS**

### **ANTES** (Ícones pequenos, sem emoção)
```
┌─────────────────────────────────────────────────┐
│ Plano de carreira                        85%    │
│                                                 │
│ ⚪ → ⚪ → ⚪ → 🟡 → ⚪ → ⚪ → ⚪ → ⚪              │
│ 1    2    3    4    5    6    7    8           │
│                                                 │
│ (ícones 32px, sem glow, sem animação)          │
└─────────────────────────────────────────────────┘
```

**Problemas:**
- ❌ Ícones pequenos (32px)
- ❌ Sem glow/destaque
- ❌ Sem animação
- ❌ Difícil ver o tier atual
- ❌ Sem emoção

---

### **DEPOIS** (Ícones grandes, cinematográfico)
```
┌─────────────────────────────────────────────────────────────┐
│ ━━━ PLANO DE CARREIRA                    85% ▓▓▓▓▓▓▓▓░░░   │
│                                                             │
│  ⚪  ━  ⚪  ━  ⚪  ━  ⭕  ━  ⚪  ━  ⚪  ━  ⚪  ━  ⚪          │
│  48px   48px   48px  80px   56px   56px   56px   56px      │
│   1      2      3     4      5      6      7      8        │
│                      ↑                                      │
│                   ATUAL                                     │
│              (glow pulsante)                                │
│                                                             │
│ Clique para ver detalhes da evolução              →        │
└─────────────────────────────────────────────────────────────┘
```

**Melhorias:**
- ✅ Ícones GRANDES (48-80px)
- ✅ Tier atual GIGANTE (80px) com glow pulsante
- ✅ Pulse ring animado
- ✅ Gradiente nos conectores
- ✅ Barra de progresso visual
- ✅ Diagonal accent decorativo
- ✅ Hover lift + glow intenso
- ✅ **CINEMATOGRÁFICO**

---

## 🎨 **ANATOMIA DO PLANO DE CARREIRA**

### **Card Principal**
```
┌─────────────────────────────────────────────────────────────┐
│ [Diagonal accent amarelo no canto]                          │
│                                                             │
│ ━━━ PLANO DE CARREIRA          85% ▓▓▓▓▓▓▓▓░░░            │
│     (barra amarela)                 (barra de progresso)    │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐    │
│ │  Timeline de Tiers (scroll horizontal)              │    │
│ │                                                      │    │
│ │  ⚪ ━ ⚪ ━ ⚪ ━ ⭕ ━ ⚪ ━ ⚪ ━ ⚪ ━ ⚪                  │    │
│ │  48  48  48  80  56  56  56  56                     │    │
│ │                                                      │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ Clique para ver detalhes da evolução              →        │
└─────────────────────────────────────────────────────────────┘
```

**Specs:**
- **Border:** 2px, neon-yellow/30 → 60% hover
- **Background:** Gradiente from-neon-yellow/8 to-black/60
- **Glow:** 0 0 32px rgba(253,225,0,0.2) no hover
- **Padding:** 24-32px
- **Hover:** scale(1.005)

---

### **Tier Node (Ícone)**

#### **Tier Alcançado (não atual)**
```
┌─────────┐
│  ⚪     │  48×48px
│  🏆     │  border: neon-yellow/60
│         │  bg: neon-yellow/10
│ Campeão │  glow: 12px blur
└─────────┘
```

#### **Tier Atual (destaque)**
```
┌───────────┐
│   ⭕      │  80×80px (GIGANTE)
│   🏆      │  border: neon-yellow
│  ╱ ╲     │  bg: neon-yellow/20
│ ╱   ╲    │  glow: 24px blur
│ Campeão  │  animate-pulse
└───────────┘
   ↑ Pulse ring
```

#### **Tier Futuro (bloqueado)**
```
┌─────────┐
│  ⚪     │  48×48px
│  🔒     │  border: white/20
│         │  bg: white/3
│  Lenda  │  opacity: 50%
└─────────┘
```

**Specs:**
- **Tier atual:** 64-80px, glow 24px, animate-pulse
- **Tier alcançado:** 48-56px, glow 12px
- **Tier futuro:** 48px, sem glow, opacity 50%
- **Ícone:** strokeWidth 2.5 (atual), 2.2 (outros)

---

### **Conectores**

#### **Alcançado (gradiente dourado)**
```
━━━━━━━━
(gradiente from-neon-yellow to-amber-400)
+ blur-sm para glow
```

#### **Futuro (cinza)**
```
────────
(bg-white/10)
```

**Specs:**
- **Altura:** 3px
- **Largura:** 24-32px
- **Gradiente:** from-neon-yellow to-amber-400
- **Glow:** blur-sm opacity-50

---

## 🎬 **DRAWER DE CARREIRA (Modal)**

### **ANTES** (Lista simples)
```
┌─────────────────────────────┐
│ Evolução ao longo dos tiers │
│                             │
│ ⚪ Fraldinha                 │
│    Nível inicial            │
│                             │
│ ⚪ Juvenil                   │
│    A partir de 500 EXP      │
│                             │
│ 🟡 Profissional [AGORA]     │
│    A partir de 2K EXP       │
└─────────────────────────────┘
```

**Problemas:**
- ❌ Ícones pequenos (40px)
- ❌ Sem destaque visual
- ❌ Tier atual não se destaca

---

### **DEPOIS** (Cards cinematográficos)
```
┌─────────────────────────────────────────────────┐
│ Evolução ao longo dos tiers                     │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │  ⚪  Fraldinha                              │ │
│ │  56px  Nível inicial                    ✓  │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │  ⚪  Juvenil                                │ │
│ │  56px  A partir de 500 EXP              ✓  │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ [Diagonal accent]                           │ │
│ │  ⭕  PROFISSIONAL  ⚫ AGORA                 │ │
│ │  64px  A partir de 2K EXP               ✓  │ │
│ │  (glow pulsante + pulse ring)               │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │  ⚪  Campeão                                │ │
│ │  48px  A partir de 5K EXP                  │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**Melhorias:**
- ✅ Ícones GRANDES (48-64px)
- ✅ Tier atual: card especial com diagonal accent
- ✅ Glow pulsante + pulse ring
- ✅ Badge "AGORA" com bolinha animada
- ✅ Border 2px (não 1px)
- ✅ Gradiente no fundo do tier atual

---

## 🎨 **SPECS TÉCNICAS**

### **Timeline Strip (Card Principal)**

```tsx
// Border + Background
border-2 border-neon-yellow/30
bg-gradient-to-br from-neon-yellow/8 via-neon-yellow/3 to-black/60

// Hover
hover:border-neon-yellow/60
hover:shadow-[0_0_32px_rgba(253,225,0,0.2)]
hover:scale-[1.005]

// Diagonal accent
position: absolute
right: -48px, top: -48px
size: 192×192px
bg-neon-yellow opacity-6%
rotate(34deg) skewX(-12deg)
```

### **Tier Node (Ícone)**

```tsx
// Tier Atual (destaque)
size: 64-80px (sm:80px)
border-3 border-neon-yellow
bg-neon-yellow/20
shadow-[0_0_24px_rgba(253,225,0,0.6)]
animate-pulse

// Ícone interno
size: 32-40px (sm:40px)
text-neon-yellow
drop-shadow-[0_0_8px_rgba(253,225,0,0.8)]
strokeWidth: 2.5

// Pulse ring
position: absolute, inset-0
border-2 border-neon-yellow
animate-ping opacity-75
```

### **Drawer Tier Card (Atual)**

```tsx
// Card
border-2 border-neon-yellow/60
bg-gradient-to-r from-neon-yellow/15 to-neon-yellow/5
shadow-[0_0_20px_rgba(253,225,0,0.2)]

// Ícone
size: 64×64px
border-3 border-neon-yellow
bg-neon-yellow/20
shadow-[0_0_20px_rgba(253,225,0,0.6)]

// Badge "AGORA"
bg-neon-yellow
text-black
font-mono text-[9px]
+ bolinha pulsante (animate-pulse)
```

---

## 🎬 **ANIMAÇÕES**

### **Tier Atual**
```css
/* Glow pulsante */
animate-pulse

/* Pulse ring */
@keyframes ping {
  75%, 100% {
    transform: scale(2);
    opacity: 0;
  }
}

/* Hover no card */
group-hover:scale-105
```

### **Conectores**
```css
/* Gradiente animado */
transition: all 500ms

/* Glow no conector alcançado */
blur-sm opacity-50
```

### **Badge "AGORA"**
```css
/* Bolinha pulsante */
.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
```

---

## ✅ **CHECKLIST DE MELHORIAS**

### **Timeline Strip**
- [x] Ícones GRANDES (48-80px)
- [x] Tier atual GIGANTE (80px)
- [x] Glow pulsante no tier atual
- [x] Pulse ring animado
- [x] Gradiente nos conectores
- [x] Barra de progresso visual
- [x] Diagonal accent decorativo
- [x] Hover lift + glow
- [x] Border 2px

### **Drawer de Carreira**
- [x] Ícones GRANDES (48-64px)
- [x] Card especial para tier atual
- [x] Diagonal accent no tier atual
- [x] Glow pulsante + pulse ring
- [x] Badge "AGORA" com bolinha animada
- [x] Border 2px nos cards
- [x] Gradiente no fundo

---

## 🚀 **RESULTADO**

**ANTES:** Ícones pequenos (32-40px), sem emoção, difícil ver o tier atual.

**DEPOIS:** Ícones GRANDES (48-80px), tier atual GIGANTE com glow pulsante, pulse ring, gradientes, diagonal accent — **CINEMATOGRÁFICO**.

---

**Criado em:** 2026-04-25  
**Versão:** 1.0 — Plano de Carreira Cinematográfico
