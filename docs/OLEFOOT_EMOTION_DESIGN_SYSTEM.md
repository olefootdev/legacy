# Olefoot Emotion Design System

**Design system cinematográfico e editorial inspirado no BVB (Borussia Dortmund)**

## Filosofia

O Olefoot Emotion é um design system que combina elementos editoriais de revistas esportivas com a energia visual do futebol moderno. Características principais:

- **Cinematográfico**: Watermarks gigantes, hierarquia tipográfica dramática
- **Editorial**: Eyebrows, quotes italic, réguas decorativas
- **Energético**: Amarelo neon (BVB), contrastes fortes, animações suaves
- **Profissional**: Tipografia Moret + Display, espaçamento generoso

---

## Componentes Core

### 1. EditorialHero

**Localização**: `/src/components/EditorialHero.tsx`

Hero editorial amarelo com watermark gigante usado em todas as páginas principais do clube.

**Anatomia**:
```
┌─────────────────────────────────────┐
│  [Watermark gigante em background]  │
│                                      │
│         Eyebrow (pequeno)            │
│                                      │
│         TÍTULO (Display)             │
│         Subtitle (Moret italic)      │
│                                      │
│         ─────── (régua)              │
│                                      │
│         [Ícone opcional]             │
│                                      │
│    "Quote italic centerpiece"        │
│                                      │
│         Stats dinâmicas              │
└─────────────────────────────────────┘
```

**Props**:
- `watermark`: Texto gigante em background (ex: "TREINO", "STAFF")
- `eyebrow`: Texto pequeno acima do título (ex: "Gestão do clube · Desenvolvimento")
- `title`: Título principal em Display (ex: "Treino")
- `subtitle`: Subtítulo em Moret italic (ex: "Evolução contínua")
- `quote`: Frase centerpiece em italic (ex: "seleciona o tipo...")
- `stats`: Estatísticas dinâmicas (ex: "3 planos ativos · 12 concluídos")
- `icon`: Ícone React opcional

**Exemplo de uso**:
```tsx
<EditorialHero
  watermark="TREINO"
  eyebrow="Gestão do clube · Desenvolvimento"
  title="Treino"
  subtitle="Evolução contínua"
  quote="seleciona o tipo, escolhe jogadores ou grupo e inicia o plano de treino"
  stats="3 planos ativos · 12 concluídos · 5 slots disponíveis"
  icon={
    <div className="group/icon relative h-24 w-24 overflow-hidden border-2 border-black/60 bg-black/60 sm:h-28 sm:w-28">
      <div className="flex h-full w-full items-center justify-center">
        <Dumbbell className="h-12 w-12 sm:h-14 sm:w-14 text-neon-yellow/90" />
      </div>
    </div>
  }
/>
```

---

## Paleta de Cores

### Cores Principais
- **Neon Yellow**: `#FFD700` - Cor primária (BVB)
- **Neon Green**: `#00FF88` - Cor secundária (sucesso, ações positivas)
- **Deep Black**: `#0A0A0A` - Background principal
- **Dark Gray**: `#1A1A1A` - Background secundário

### Cores de Texto
- **White**: `#FFFFFF` - Texto principal
- **Text Soft**: `rgba(255, 255, 255, 0.65)` - Texto secundário
- **Text Muted**: `rgba(255, 255, 255, 0.4)` - Texto terciário
- **Black**: `#000000` - Texto em backgrounds amarelos

### Cores de Estruturas (City)
- **Stadium**: Neon Yellow
- **Training Center**: Neon Green
- **Medical Dept**: Red 500
- **Youth Academy**: Blue 400
- **Megastore**: Purple 400

---

## Tipografia

### Famílias
1. **Display** (`var(--font-display)`): Títulos, labels, uppercase
   - Peso: 700-900 (Bold/Black)
   - Uso: Headlines, botões, badges
   - Características: Condensada, tracking amplo

2. **Serif Hero / Moret** (`var(--font-serif-hero)`): Editorial, números
   - Peso: 700 (Bold)
   - Uso: Subtítulos italic, números grandes (OVR), quotes
   - Características: Italic dramático, serifa editorial

3. **Sans** (`var(--font-sans)`): Corpo de texto
   - Peso: 400-600 (Regular/Semibold)
   - Uso: Parágrafos, descrições, stats
   - Características: Legível, neutro

### Hierarquia Tipográfica

**Hero Editorial**:
```css
/* Watermark */
font-size: clamp(120px, 24vw, 360px);
font-family: var(--font-display);
font-weight: 900;
text-transform: uppercase;
opacity: 0.04;

/* Eyebrow */
font-size: 10px;
font-family: var(--font-display);
font-weight: 700;
text-transform: uppercase;
letter-spacing: 0.22em;

/* Title */
font-size: clamp(2.75rem, 8vw, 6rem);
font-family: var(--font-display);
font-weight: 700;
text-transform: uppercase;
letter-spacing: 0.005em;

/* Subtitle */
font-size: clamp(2.25rem, 7vw, 5rem);
font-family: var(--font-serif-hero);
font-weight: 700;
font-style: italic;
letter-spacing: -0.01em;

/* Quote */
font-size: clamp(15px, 2vw, 19px);
font-family: var(--font-serif-hero);
font-style: italic;
line-height: 1.4;

/* Stats */
font-size: clamp(0.85rem, 1vw, 0.95rem);
font-family: var(--font-sans);
line-height: 1.55;
```

---

## Componentes de UI

### Sports Panel
Background padrão para cards e painéis:
```css
.sports-panel {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md);
}

.sports-panel.panel-accent {
  border-color: rgba(255, 215, 0, 0.2);
  background: rgba(255, 215, 0, 0.03);
}
```

### Botões

**Primary (Amarelo)**:
```tsx
<button className="btn-primary">
  <span className="btn-primary-inner">
    <Icon className="w-5 h-5" />
    Texto
  </span>
</button>
```

**Secondary (Outline)**:
```tsx
<button className="btn-secondary">
  <span className="btn-secondary-inner">
    Texto
  </span>
</button>
```

### Ícones Estruturados
Padrão para ícones em heroes:
```tsx
<div className="group/icon relative h-24 w-24 overflow-hidden border-2 border-black/60 bg-black/60 sm:h-28 sm:w-28 transition-all hover:border-black/80 hover:shadow-[0_0_24px_rgba(0,0,0,0.4)]"
     style={{ borderRadius: 'var(--radius-sm)' }}>
  <div className="flex h-full w-full items-center justify-center">
    <Icon className="h-12 w-12 sm:h-14 sm:w-14 text-neon-yellow/90" aria-hidden />
  </div>
</div>
```

---

## Animações

### Framer Motion Presets

**Hero Fade In**:
```tsx
<motion.div
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
>
```

**Watermark Entrance**:
```tsx
<motion.span
  initial={{ opacity: 0, scale: 0.96 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0, scale: 1.04 }}
  transition={{ duration: 0.4 }}
>
```

**Stagger Children**:
```tsx
{items.map((item, index) => (
  <motion.div
    key={item.id}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.05 }}
  >
))}
```

---

## Layout & Spacing

### Container Widths
- **Max Width**: `max-w-6xl` (1152px)
- **Content Width**: `max-w-3xl` (768px) para conteúdo editorial
- **Full Width**: `max-w-[100vw]` para heroes

### Padding & Margin
- **Section Spacing**: `space-y-6` (1.5rem)
- **Card Padding**: `p-4 sm:p-5` (1rem → 1.25rem)
- **Hero Padding**: `py-8 sm:py-12 lg:py-14`

### Responsive Breakpoints
```css
sm: 640px   /* Tablet portrait */
md: 768px   /* Tablet landscape */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
```

---

## Páginas Implementadas

### ✅ Clube
1. **Staff** (`/clube/staff`) - Referência original
2. **Treino** (`/clube/treino`) - Watermark "TREINO"
3. **AI Labs** (`/clube/ailabs`) - Watermark "AI LABS"
4. **Estruturas** (`/clube/estruturas`) - Watermark "ESTRUTURAS"

### 🔄 Pendentes
- **Elenco** (`/clube/elenco`) - Watermark "ELENCO"
- **Academia** (`/clube/academia`) - Watermark "ACADEMIA"

---

## Princípios de Design

### 1. Hierarquia Visual Clara
- Watermark → Eyebrow → Title → Subtitle → Quote → Stats
- Cada elemento tem seu peso e propósito

### 2. Contraste Dramático
- Amarelo neon sobre preto profundo
- Branco puro para texto principal
- Opacidades sutis para hierarquia

### 3. Tipografia Editorial
- Moret italic para momentos editoriais
- Display condensada para impacto
- Sans para legibilidade

### 4. Espaçamento Generoso
- Breathing room entre elementos
- Padding amplo em heroes
- Margens consistentes

### 5. Animações Sutis
- Fade in suave (0.4-0.5s)
- Stagger para listas
- Hover states responsivos

---

## Acessibilidade

### Contraste
- Texto branco em preto: 21:1 (AAA)
- Texto preto em amarelo: 14:1 (AAA)
- Texto soft: 7:1 (AA)

### Semântica
- `aria-hidden` em watermarks decorativos
- `aria-label` em ícones interativos
- Estrutura HTML semântica (h1, section, etc)

### Responsividade
- Mobile-first approach
- Touch targets mínimos de 44x44px
- Texto escalável com clamp()

---

## Manutenção

### Adicionando Nova Página

1. Importe o `EditorialHero`:
```tsx
import { EditorialHero } from '@/components/EditorialHero';
```

2. Substitua `TeamMeuTimeHeader` por `EditorialHero`:
```tsx
<EditorialHero
  watermark="SEU_TEXTO"
  eyebrow="Gestão do clube · Categoria"
  title="Título"
  subtitle="Subtítulo opcional"
  quote="frase centerpiece em italic"
  stats="estatísticas dinâmicas"
  icon={<SeuIcone />}
/>
```

3. Escolha um ícone apropriado:
- Dumbbell (treino)
- FlaskConical (labs)
- Building2 (estruturas)
- Users (elenco)
- GraduationCap (academia)

### Customizações

O `EditorialHero` aceita todas as props como opcionais exceto `watermark`, `eyebrow` e `title`. Você pode omitir `subtitle`, `quote`, `stats` ou `icon` conforme necessário.

---

## Créditos

**Inspiração**: BVB (Borussia Dortmund) - Identidade visual amarelo/preto
**Tipografia**: Moret (editorial), Display condensada
**Framework**: React + Tailwind CSS + Framer Motion
**Design System**: Olefoot Emotion v1.0

---

**Última atualização**: 2024
**Versão**: 1.0.0
**Status**: ✅ Produção
