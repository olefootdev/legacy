# 🎬 CARDS CINEMATOGRÁFICOS OLEFOOT

Sistema de cards com **IMPACTO VISUAL REAL** — futebol, emoção, tecnologia.

---

## 🎯 **ANTES × DEPOIS**

### **ANTES** (Cards genéricos)
```
┌─────────────────────────┐
│ 🔹 Carreira             │
│ Profissional            │
│                         │
│ 1.2K EXP                │
│                         │
│ Próximo: Campeão    →   │
└─────────────────────────┘
```
- Ícone pequeno (16px)
- Texto normal
- Sem personalidade
- Sem glow/animação
- **GENÉRICO**

---

### **DEPOIS** (Cards cinematográficos)
```
┌─────────────────────────────────┐
│  ╔═══╗                          │
│  ║ 🏆 ║  CARREIRA                │
│  ╚═══╝  Profissional            │
│                                  │
│         1.2K                     │
│         EXP                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Próximo: Campeão           →   │
└─────────────────────────────────┘
   ↑ GLOW AMARELO PULSANTE
```
- Ícone GIGANTE (64px) com skew -6deg
- Número ENORME em Moret italic (48px)
- Diagonal accent decorativo
- Glow intenso no hover (32px blur)
- Border 2px (não 1px)
- Animação de entrada + hover
- **CINEMATOGRÁFICO**

---

## 🎨 **ELEMENTOS VISUAIS**

### **1. ActionCard** (Cards de Ação)

#### **Anatomia:**
```
┌─────────────────────────────────────┐
│ [Diagonal accent]                   │
│                                     │
│  ╔═══════╗                          │
│  ║       ║  TÍTULO                  │
│  ║ ÍCONE ║  Subtítulo               │
│  ║ 64px  ║                          │
│  ╚═══════╝                          │
│                                     │
│         MÉTRICA                     │
│         GIGANTE                     │
│         (Moret italic 48px)         │
│                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Footer texto              →        │
└─────────────────────────────────────┘
```

#### **Specs técnicas:**
- **Ícone:** 64×64px, skew -6deg, glow 24px
- **Métrica:** Moret italic, clamp(2rem, 5vw, 3rem)
- **Border:** 2px, opacity 30% → 60% hover
- **Glow:** 0 0 32px rgba(253,225,0,0.25)
- **Hover:** scale(1.02), rotate(-3deg) no ícone
- **Animação:** duration 300ms

---

### **2. SmartShortcut** (Atalhos Contextuais)

#### **Anatomia:**
```
┌─────────────────────────────────────┐
│  ⭕ ÍCONE    LABEL PRINCIPAL         │
│  (glow)     Subtítulo descritivo  → │
└─────────────────────────────────────┘
```

#### **Specs técnicas:**
- **Ícone:** 48×48px círculo, border 2px, glow 16px
- **Glow:** Pulsante no hover (animate-pulse)
- **Border:** 2px, opacity 40% → 80% hover
- **Hover:** scale(1.01), translate-x(4px) na seta

---

### **3. TrophyCard** (Troféus)

#### **Anatomia:**
```
┌─────────────────────────────────────┐
│ [Radial glow no fundo]              │
│                                     │
│  ╔═══════╗              [CATEGORIA] │
│  ║       ║                          │
│  ║ 🏆    ║  NOME DO TROFÉU          │
│  ║ 56px  ║                          │
│  ╚═══════╝  Descrição do troféu    │
│             em 2 linhas max         │
│                                     │
│             [Brilho decorativo]     │
└─────────────────────────────────────┘
```

#### **Specs técnicas:**
- **Ícone:** 56×56px, skew -6deg, gradiente dourado
- **Glow:** 0 0 32px rgba(253,225,0,0.3) → 48px hover
- **Radial:** ellipse 60% 50%, opacity 15%
- **Hover:** scale(1.03), rotate(-6deg) no ícone
- **Badge:** clip-angular-badge (clip-path polygon)

---

## 🎨 **PALETA DE TONS**

### **Yellow (Principal)**
```css
border: rgba(253, 225, 0, 0.3);
bg: linear-gradient(to-br, rgba(253,225,0,0.08), rgba(0,0,0,0.6));
glow: 0 0 32px rgba(253, 225, 0, 0.25);
icon: bg-neon-yellow text-black;
```

### **Fuchsia (Social/Network)**
```css
border: rgba(217, 70, 239, 0.3);
bg: linear-gradient(to-br, rgba(217,70,239,0.08), rgba(0,0,0,0.6));
glow: 0 0 32px rgba(217, 70, 239, 0.25);
icon: bg-fuchsia-500 text-white;
```

### **Cyan (PRO/Premium)**
```css
border: rgba(6, 182, 212, 0.3);
bg: linear-gradient(to-br, rgba(6,182,212,0.08), rgba(0,0,0,0.6));
glow: 0 0 32px rgba(6, 182, 212, 0.25);
icon: bg-cyan-500 text-black;
```

---

## 🎬 **ANIMAÇÕES**

### **Entrada (Framer Motion)**
```tsx
initial={{ opacity: 0, y: 12 }}
animate={{ opacity: 1, y: 0 }}
transition={{ delay: 0.08, duration: 0.3 }}
```

### **Hover States**
```css
/* Card */
hover:scale-[1.02]
active:scale-[0.98]

/* Ícone */
group-hover:scale-110
group-hover:-rotate-3

/* Glow */
group-hover:shadow-[0_0_48px_rgba(253,225,0,0.5)]

/* Seta */
group-hover:translate-x-1
```

### **Badge Pulsante**
```css
animate-pulse /* Só no badge de notificação */
```

---

## 📐 **HIERARQUIA DE TAMANHOS**

### **Ícones**
- **ActionCard:** 64×64px (gigante)
- **SmartShortcut:** 48×48px (médio)
- **TrophyCard:** 56×56px (grande)

### **Tipografia**
- **Métrica gigante:** clamp(2rem, 5vw, 3rem) — Moret italic
- **Título:** 12-14px — Agency FB caps
- **Subtítulo:** 11px — Inter regular
- **Footer:** 10px — Inter medium

### **Borders**
- **Padrão:** 2px (não 1px)
- **Hover:** opacity 30% → 60%

### **Glows**
- **Ícone:** 24px blur
- **Card:** 32px blur → 48px hover
- **Badge:** 12px blur

---

## ✅ **CHECKLIST DE IMPACTO VISUAL**

Cada card DEVE ter:

- [ ] **Ícone gigante** (48px+) com skew decorativo
- [ ] **Número ENORME** em Moret italic (quando aplicável)
- [ ] **Border 2px** (não 1px)
- [ ] **Glow intenso** no hover (32px+ blur)
- [ ] **Gradiente sutil** no fundo (8-10% opacity)
- [ ] **Diagonal accent** decorativo (opcional)
- [ ] **Animação de entrada** (Framer Motion)
- [ ] **Hover lift** (scale 1.02)
- [ ] **Transições suaves** (300ms duration)

---

## 🚀 **USO**

```tsx
import { ActionCard, SmartShortcut, TrophyCard } from '@/components/cards';

// Action Card (Carreira, Network, PRO)
<ActionCard
  icon={TrendingUp}
  title="Carreira"
  subtitle="Profissional"
  metric="1.2K EXP"
  footer="Próximo: Campeão"
  onClick={() => {}}
  tone="yellow"
  badge="3" // opcional
/>

// Smart Shortcut (Missões prontas, convites)
<SmartShortcut
  icon={Target}
  label="Resgatar 3 missões"
  sub="+1.5K EXP prontos"
  tone="yellow"
  to="/missions"
/>

// Trophy Card (Troféus conquistados)
<TrophyCard
  name="Campeão da Liga"
  description="Venceu o campeonato nacional"
  category="Competição"
  earned={true}
  tone="yellow"
/>
```

---

## 🎯 **RESULTADO**

**ANTES:** Cards genéricos, sem personalidade, difíceis de distinguir.

**DEPOIS:** Cards cinematográficos, com impacto visual, emoção e tecnologia — **a cara do Olefoot**.

---

**Criado em:** 2026-04-25  
**Versão:** 1.0 — Cards Cinematográficos
