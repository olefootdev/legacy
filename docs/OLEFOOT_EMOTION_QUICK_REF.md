# Olefoot Emotion - Quick Reference

## TL;DR

Design system cinematográfico com heroes editoriais amarelos, watermarks gigantes e tipografia Moret italic.

## Componente Principal

```tsx
import { EditorialHero } from '@/components/EditorialHero';

<EditorialHero
  watermark="TEXTO"           // Gigante em background
  eyebrow="Categoria"         // Pequeno acima
  title="Título"              // Display grande
  subtitle="Subtítulo"        // Moret italic (opcional)
  quote="frase centerpiece"   // Quote italic (opcional)
  stats="dados dinâmicos"     // Stats (opcional)
  icon={<Icon />}             // Ícone (opcional)
/>
```

## Cores

- **Neon Yellow**: `#FFD700` - Primária
- **Neon Green**: `#00FF88` - Secundária
- **Deep Black**: `#0A0A0A` - Background
- **White**: `#FFFFFF` - Texto

## Tipografia

- **Display**: Títulos uppercase, bold/black
- **Moret**: Subtítulos italic, números grandes
- **Sans**: Corpo de texto

## Páginas Implementadas

✅ `/clube/staff` - STAFF
✅ `/clube/treino` - TREINO
✅ `/clube/ailabs` - AI LABS
✅ `/clube/estruturas` - ESTRUTURAS

## Ícones Comuns

- `Dumbbell` - Treino
- `FlaskConical` - AI Labs
- `Building2` - Estruturas
- `Users` - Elenco/Staff
- `GraduationCap` - Academia

## Animações

```tsx
// Hero fade in
initial={{ opacity: 0, y: 12 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.5 }}

// Stagger
transition={{ delay: index * 0.05 }}
```

## Layout

- Container: `max-w-6xl`
- Content: `max-w-3xl`
- Spacing: `space-y-6`
- Hero padding: `py-8 sm:py-12 lg:py-14`
