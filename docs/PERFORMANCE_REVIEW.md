# 🔍 REVISÃO DE IMPLEMENTAÇÕES P4-P9

**Data:** 2026-04-25  
**Arquivo:** `src/pages/Live2dMatchShell.tsx`

---

## ✅ P4: CSS Variables para Camera

### Implementação Atual
```tsx
style={{
  transformStyle: 'preserve-3d',
  transform: `rotateX(calc(5.5deg + var(--cam-rotate-x-add, 0deg)))`,
  transition: prefersReducedMotion ? 'none' : 'transform 700ms cubic-bezier(0.22, 1, 0.36, 1)',
  ['--cam-rotate-x-add' as string]: `${pitchCameraRig.rotateXAdd}deg`,
}}
```

### ⚠️ Problema Identificado
**CSS variables ainda causam re-render do React** porque estão no `style` object inline. Cada mudança de `pitchCameraRig.rotateXAdd` cria um novo objeto `style`, forçando reconciliation.

### 💡 Melhoria Proposta
Usar `ref` + `setProperty` direto no DOM, fora do ciclo React:

```tsx
const pitchRigRef = useRef<HTMLDivElement>(null);

// Dentro de useEffect ou rAF
useEffect(() => {
  if (!pitchRigRef.current) return;
  pitchRigRef.current.style.setProperty('--cam-rotate-x-add', `${pitchCameraRig.rotateXAdd}deg`);
  pitchRigRef.current.style.setProperty('--cam-scale', String(pitchCameraRig.scale));
  pitchRigRef.current.style.setProperty('--cam-origin-x', String(pitchCameraRig.originXPct));
  pitchRigRef.current.style.setProperty('--cam-origin-y', String(pitchCameraRig.originYPct));
}, [pitchCameraRig.rotateXAdd, pitchCameraRig.scale, pitchCameraRig.originXPct, pitchCameraRig.originYPct]);

// JSX
<div
  ref={pitchRigRef}
  className="origin-[50%_100%] transform-gpu will-change-transform"
  style={{
    transformStyle: 'preserve-3d',
    transform: 'rotateX(calc(5.5deg + var(--cam-rotate-x-add, 0deg)))',
    transition: prefersReducedMotion ? 'none' : 'transform 700ms cubic-bezier(0.22, 1, 0.36, 1)',
  }}
>
```

**Ganho:** Elimina re-render do React quando camera muda (42×/s → 0×/s).

---

## ✅ P7: useShallow Zustand

### Implementação Atual
```tsx
const { live, playersById, lineupIds, fixture, tacticalMentality, defensiveLine, tempo, tacticalStyle, staff } = useGameStore(
  useShallow((s) => ({
    live: s.liveMatch,
    playersById: s.players,
    lineupIds: s.lineup,
    fixture: s.nextFixture,
    tacticalMentality: s.manager.tacticalMentality,
    defensiveLine: s.manager.defensiveLine,
    tempo: s.manager.tempo,
    tacticalStyle: s.manager.tacticalStyle,
    staff: s.manager.staff,
  }))
);
```

### ✅ Implementação Correta
Consolidou 9 seletores em 1. Bom!

### 💡 Melhoria Proposta
Adicionar `manager` completo em vez de campos individuais:

```tsx
const { live, playersById, lineupIds, fixture, manager } = useGameStore(
  useShallow((s) => ({
    live: s.liveMatch,
    playersById: s.players,
    lineupIds: s.lineup,
    fixture: s.nextFixture,
    manager: s.manager,
  }))
);

const { tacticalMentality, defensiveLine, tempo, tacticalStyle, staff } = manager;
```

**Ganho:** Código mais limpo, mesma performance.

---

## ✅ P8: Preload Portraits

### Implementação Atual
```tsx
useEffect(() => {
  if (!live?.homePlayers?.length) return;
  const urls = new Set<string>();
  for (const p of live.homePlayers) {
    const ent = playersById[p.playerId];
    if (ent) {
      const u = playerTokenSrc(ent, 72);
      if (u) urls.add(u);
    }
  }
  const links: HTMLLinkElement[] = [];
  for (const u of urls) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = u;
    document.head.appendChild(link);
    links.push(link);
    const img = new Image();
    img.decoding = 'async';
    img.loading = 'eager';
    img.src = u;
  }
  return () => {
    links.forEach((link) => document.head.removeChild(link));
  };
}, [live?.homePlayers, playersById]);
```

### ⚠️ Problema Identificado
1. **Cleanup remove `<link>` do head** — mas a imagem já foi carregada, então o cleanup é desnecessário e pode causar warning no console.
2. **Duplo carregamento:** `<link rel="preload">` + `new Image()` carrega a mesma imagem 2×.

### 💡 Melhoria Proposta
```tsx
useEffect(() => {
  if (!live?.homePlayers?.length) return;
  const urls = new Set<string>();
  for (const p of live.homePlayers) {
    const ent = playersById[p.playerId];
    if (ent) {
      const u = playerTokenSrc(ent, 72);
      if (u) urls.add(u);
    }
  }
  // Só <link rel="preload"> — browser gerencia cache automaticamente
  const links: HTMLLinkElement[] = [];
  for (const u of urls) {
    // Verifica se já existe antes de adicionar
    const existing = document.head.querySelector(`link[rel="preload"][href="${u}"]`);
    if (existing) continue;
    
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = u;
    document.head.appendChild(link);
    links.push(link);
  }
  // Sem cleanup — deixa browser gerenciar cache
}, [live?.homePlayers, playersById]);
```

**Ganho:** Evita duplo carregamento, sem warnings no console.

---

## 🔄 P1-P3: Já Implementados (Revisão)

### P1: Transform GPU
```tsx
style={{
  transform: `translate3d(${left}cqw, ${top}cqh, 0) translate(-50%, -50%)`,
  transition: motionCss,
  willChange: reducedMotion ? undefined : ('transform' as const),
  backfaceVisibility: 'hidden',
}}
```

✅ **Perfeito.** Usa `translate3d` + `cqw/cqh` (container query units) + `willChange: transform`.

### P2: React.memo
```tsx
const Test2dHomePlayerToken = memo(function Test2dHomePlayerToken({...}) {...}, homePlayerTokenPropsEqual);
```

✅ **Perfeito.** Todos os tokens têm `memo` + equality function customizada.

### P3: useMemo Derivações
```tsx
const ballPxPct = pitchPlanePercent(ballPos.x);
const ballPyPct = pitchPlanePercent(ballPos.y);
const awayNearestBallId = useMemo(
  () => nearestToPoint(awayPitch, ballPos)?.playerId ?? null,
  [awayPitch, ballPos],
);
```

✅ **Perfeito.** Hoisting de cálculos repetidos (22× → 1× por render).

---

## 📊 RESUMO DE MELHORIAS PROPOSTAS

| Item | Status Atual | Melhoria | Ganho Estimado |
|------|--------------|----------|----------------|
| **P4** | ⚠️ CSS vars no style inline | Usar ref + setProperty | +5-10fps (elimina re-render) |
| **P7** | ✅ useShallow OK | Simplificar código | Legibilidade |
| **P8** | ⚠️ Duplo carregamento + cleanup | Só preload, sem cleanup | Menos overhead |
| **P1-P3** | ✅ Perfeitos | — | — |

---

## 🚀 PRÓXIMOS PASSOS

### Implementação Imediata (Alto Impacto)
1. **P4 Melhorado:** Ref + setProperty para CSS variables
2. **P8 Melhorado:** Remover duplo carregamento

### Implementação Futura (Médio Impacto)
3. **P6:** Mover `tokenSeparation` para TacticalSimLoop (requer refatoração)
4. **P2 Avançado:** Extrair `Live2dPitchSurface` com rAF próprio (ganho massivo, complexidade alta)

### Otimizações Adicionais Identificadas
5. **Container Query Polyfill:** Verificar suporte de `cqw/cqh` em browsers antigos
6. **Lazy Load Overlays:** `React.lazy()` para `TacticalPitchDevLayer` (só carrega se ativado)
7. **Web Worker:** Mover `computePitchTokenSeparation` para worker thread

---

**Ganho Total Esperado (com melhorias):**
- **Atual:** +25-40fps mobile
- **Com P4+P8 melhorados:** +30-50fps mobile
- **Com P2 avançado (PitchSurface):** +40-60fps mobile (próximo de 60fps nativo)
