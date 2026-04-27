# OLEFOOT — Auditoria Visual de Assets e Placeholders

**Data:** 26 de abril de 2026  
**Designer:** Varredura completa do projeto  
**Objetivo:** Identificar todas as imagens, placeholders e oportunidades visuais que precisam ser criadas ou atualizadas

---

## 📋 SUMÁRIO EXECUTIVO

- **Total de páginas analisadas:** 59
- **Assets existentes identificados:** 30+
- **Placeholders temporários:** 3 críticos
- **Oportunidades de melhoria visual:** 15+

---

## 🎯 ASSETS CRÍTICOS — PRIORIDADE ALTA

### 1. **Login Hero Background**
- **Arquivo:** `/public/login-hero.png`
- **Páginas:** Login.tsx, Cadastro.tsx, ResetPassword.tsx
- **Resolução atual:** Desconhecida (precisa verificar)
- **Resolução recomendada:** 1920×1080px (Full HD) ou 2560×1440px (2K)
- **Proposta visual:** 
  - Imagem cinematográfica de estádio de futebol vazio ao entardecer
  - Gramado impecável em primeiro plano com linhas nítidas
  - Arquibancadas desfocadas ao fundo (bokeh)
  - Iluminação dramática com raios de sol atravessando as estruturas
  - Paleta: verde escuro do gramado + amarelo neon dos holofotes + preto profundo das sombras
- **Proposta de uso:** Background hero full-bleed com gradientes sobrepostos (preto 88% → 35% → 90%) para garantir legibilidade do texto branco e amarelo neon

### 2. **Player Portrait Placeholder**
- **Código:** `Home.tsx:228` — `'https://picsum.photos/seed/home-placeholder/400/520'`
- **Páginas:** Home.tsx (hero do último jogo)
- **Resolução:** 400×520px (proporção 10:13 — padrão card de jogador)
- **Proposta visual:**
  - Silhueta de jogador genérico em pose atlética (corrida ou comemoração)
  - Fundo: gradiente radial preto → cinza escuro
  - Overlay: número "OVR 70" em Moret italic gigante, amarelo neon, opacity 15%
  - Borda sutil amarela neon (2px) para manter identidade visual
- **Proposta de uso:** Fallback quando jogador não tem foto real ou quando plantel está vazio (primeira visita)

### 3. **Olefoot Logo Principal**
- **Arquivo:** `/public/test-pitch/olefoot-logo-game.svg`
- **Páginas:** Login.tsx, Cadastro.tsx
- **Resolução:** SVG (escalável)
- **Status:** ✅ Existe, mas está em pasta `/test-pitch/` (organização)
- **Proposta de melhoria:**
  - Mover para `/public/brand/olefoot-logo-game.svg` (consistência)
  - Criar variantes: `olefoot-logo-game-white.svg`, `olefoot-logo-game-black.svg`
  - Garantir que funciona bem em fundos claros e escuros

---

## 🏟️ ASSETS DE MATCH ENGINE — PRIORIDADE MÉDIA

### 4. **Bola de Futebol (Match)**
- **Arquivo:** `/public/test-pitch/olefoot-Ball.png`
- **Páginas:** MatchPenalty.tsx, Live2dMatchShell.tsx (usa `/assets/soccer-ball-256.png`)
- **Resolução atual:** 256×256px
- **Resolução recomendada:** 512×512px (retina) ou SVG animável
- **Proposta visual:**
  - Bola oficial estilo Champions League (pentágonos pretos + hexágonos brancos)
  - Textura realista com reflexos sutis
  - Sombra suave embaixo (drop shadow) para dar profundidade
  - Versão com motion blur para animações de chute
- **Proposta de uso:** Sprite sheet 4×4 (16 frames) para rotação suave durante partidas ao vivo

### 5. **Goleiro Defendendo (Penalty)**
- **Arquivo:** `/public/test-pitch/goleiro-defende-view.jpg`
- **Página:** MatchPenalty.tsx
- **Resolução atual:** Desconhecida
- **Resolução recomendada:** 800×600px (landscape 4:3)
- **Proposta visual:**
  - Goleiro em mergulho espetacular (vista lateral)
  - Uniforme genérico (sem marca) em cores neutras (cinza + preto)
  - Fundo: gol + rede desfocada
  - Tratamento: alto contraste + vinheta escura nas bordas
- **Proposta de uso:** Exibir em modal de resultado de pênalti (defesa bem-sucedida)

### 6. **Jogador Cobrando Pênalti**
- **Arquivo:** `/public/test-pitch/teste-image-real.jpg`
- **Página:** MatchPenalty.tsx
- **Resolução atual:** Desconhecida
- **Resolução recomendada:** 800×600px (landscape 4:3)
- **Proposta visual:**
  - Jogador em momento de chute (pé levantado, corpo inclinado)
  - Vista de trás do jogador (câmera atrás da bola)
  - Goleiro ao fundo na linha do gol
  - Iluminação dramática (floodlights do estádio)
- **Proposta de uso:** Exibir em modal de cobrança de pênalti (momento de tensão)

### 7. **Gol Sofrido (Penalty)**
- **Arquivo:** `/public/test-pitch/tomamos-o-gol.jpg`
- **Página:** MatchPenalty.tsx (inferido)
- **Resolução recomendada:** 800×600px
- **Proposta visual:**
  - Bola no fundo da rede (close-up)
  - Goleiro caído ao lado (derrota)
  - Tratamento: dessaturação parcial + overlay vermelho sutil (10% opacity)
- **Proposta de uso:** Feedback visual de gol sofrido

### 8. **Jogador Comemorando Gol**
- **Arquivo:** `/public/test-pitch/jogador-ganhou.png`
- **Página:** MatchPenalty.tsx (inferido)
- **Resolução recomendada:** 800×600px
- **Proposta visual:**
  - Jogador em comemoração icônica (braços abertos, correndo)
  - Fundo: torcida desfocada (bokeh de luzes)
  - Overlay: partículas douradas sutis (confete digital)
- **Proposta de uso:** Feedback visual de gol marcado

### 9. **Jogador Perdeu (Penalty)**
- **Arquivo:** `/public/test-pitch/jogador-perdeu.png`
- **Página:** MatchPenalty.tsx (inferido)
- **Resolução recomendada:** 800×600px
- **Proposta visual:**
  - Jogador com mãos na cabeça (frustração)
  - Tratamento: dessaturação + vinheta escura
- **Proposta de uso:** Feedback visual de pênalti perdido

---

## 🏆 ASSETS DE BRANDING — PRIORIDADE MÉDIA

### 10. **Olefoot Logo Amarelo (Completo)**
- **Arquivo:** `/public/brand/olefoot-yellow-01.svg`
- **Páginas:** Layout.tsx (footer, header mobile)
- **Status:** ✅ Existe
- **Proposta de uso:** Identidade principal em fundos escuros

### 11. **Olefoot Logo Preto**
- **Arquivo:** `/public/brand/olefoot-black-01.svg`
- **Status:** ✅ Existe
- **Proposta de uso:** Versão para fundos claros (documentos, impressos)

### 12. **Olefoot Ícone (Amarelo)**
- **Arquivo:** `/public/brand/olefoot-icone-yellow-01.svg`
- **Páginas:** Layout.tsx (header desktop)
- **Resolução:** SVG
- **Status:** ✅ Existe
- **Proposta de uso:** Favicon, app icon, avatar em redes sociais

### 13. **Olefoot Ícone (Preto)**
- **Arquivo:** `/public/brand/olefoot-black-icone.svg`
- **Status:** ✅ Existe
- **Proposta de uso:** Versão alternativa para fundos claros

### 14. **Olefoot Ball (Branding)**
- **Arquivo:** `/public/brand/olefoot-ball.png`
- **Status:** ✅ Existe
- **Proposta de uso:** Elemento decorativo em loading states, empty states

---

## 🎨 OPORTUNIDADES VISUAIS — PRIORIDADE BAIXA

### 15. **Brasões de Clubes (Crest System)**
- **Código:** `Home.tsx`, `MatchdayHero.tsx` — sistema de crests
- **Status:** Sistema implementado, mas usa fallback de iniciais quando crest não existe
- **Proposta visual:**
  - Criar 20 brasões genéricos de clubes IA (estilo minimalista geométrico)
  - Paleta: monocromático (1 cor principal + preto/branco)
  - Formas: escudo, círculo, losango, hexágono
  - Elementos: estrelas, raios, asas, coroas, bolas
- **Resolução:** 256×256px (PNG transparente) ou SVG
- **Proposta de uso:** Atribuir aleatoriamente aos clubes IA do ranking

### 16. **Empty States Illustrations**
- **Páginas:** Home.tsx (sem histórico), Team.tsx (sem reservas), Transfer.tsx (mercado vazio)
- **Resolução:** 400×300px (landscape 4:3)
- **Proposta visual:**
  - Ilustrações line-art minimalistas (stroke 2px, amarelo neon)
  - Temas: estádio vazio, vestiário vazio, troféu trancado
  - Estilo: isométrico simplificado (inspiração: Streamline Icons)
- **Proposta de uso:** Substituir textos genéricos de "sem dados" por ilustrações amigáveis

### 17. **Troféus 3D (Trophy System)**
- **Páginas:** Manager.tsx (sala de troféus)
- **Status:** Usa ícones Lucide (Trophy, Lock)
- **Proposta visual:**
  - Renderizar 8 troféus 3D únicos (Blender)
  - Materiais: ouro polido, prata escovada, bronze oxidado
  - Iluminação: studio lighting (3-point)
  - Exportar: PNG transparente 512×512px + versão WebP
- **Proposta de uso:** Substituir ícones flat por renders 3D realistas

### 18. **Avatares de Treinador (Manager Avatars)**
- **Páginas:** Manager.tsx (perfil do manager)
- **Status:** Usa avatar customizado do usuário ou ícone User genérico
- **Proposta visual:**
  - Criar 12 avatares de treinador genéricos (estilo cartoon/ilustração)
  - Diversidade: gênero, etnia, idade, estilo (terno, agasalho, boné)
  - Paleta: cores vibrantes mas profissionais
- **Resolução:** 256×256px (PNG transparente)
- **Proposta de uso:** Galeria de avatares pré-definidos para usuários sem foto

### 19. **Backgrounds de Estádio (Stadium Variations)**
- **Proposta:** 5 variações de estádio para diferentes contextos
  - **Dia ensolarado:** Luz natural, sombras nítidas, céu azul
  - **Noite com holofotes:** Iluminação artificial dramática, céu escuro
  - **Chuva:** Gramado molhado, reflexos, atmosfera pesada
  - **Neve:** Gramado coberto, névoa, iluminação fria
  - **Pôr do sol:** Golden hour, sombras longas, céu laranja/rosa
- **Resolução:** 1920×1080px (landscape 16:9)
- **Proposta de uso:** Rotacionar backgrounds em partidas ao vivo (Live2dMatchShell.tsx)

### 20. **Ícones de Posição (Player Positions)**
- **Proposta:** Ícones SVG para cada posição do campo
  - GOL (goleiro), ZAG (zagueiro), LAT (lateral), VOL (volante)
  - MEI (meia), ATA (atacante), PON (ponta)
- **Estilo:** Line-art minimalista, stroke 2px, amarelo neon
- **Resolução:** 48×48px (SVG)
- **Proposta de uso:** Exibir em cards de jogador, lineup, tática

### 21. **Badges de Conquistas (Achievement Badges)**
- **Páginas:** Manager.tsx (troféus de missões)
- **Proposta visual:**
  - 20 badges hexagonais (estilo militar/gaming)
  - Categorias: onboarding, vitórias, mercado, treino, social
  - Materiais: bronze, prata, ouro, platina, diamante
- **Resolução:** 128×128px (PNG transparente)
- **Proposta de uso:** Sistema de gamificação visual

### 22. **Loading Animations**
- **Proposta:** 3 animações de loading customizadas
  - **Bola quicando:** Loop infinito, 60fps, 2s duração
  - **Gramado crescendo:** Progressivo, 0-100%, 3s duração
  - **Troféu girando:** 360° rotation, 4s duração
- **Formato:** Lottie JSON (After Effects → Bodymovin) ou CSS animation
- **Proposta de uso:** Substituir spinners genéricos por animações temáticas

### 23. **Social Media Assets**
- **Proposta:** Kit completo para redes sociais
  - **Open Graph Image:** 1200×630px (compartilhamento Facebook/LinkedIn)
  - **Twitter Card:** 1200×600px (compartilhamento Twitter/X)
  - **Instagram Story Template:** 1080×1920px (9:16 vertical)
  - **YouTube Thumbnail:** 1280×720px (16:9)
- **Elementos:** Logo Olefoot + tagline + screenshot do jogo + CTA
- **Proposta de uso:** Metadados de SEO e campanhas de marketing

### 24. **Onboarding Illustrations**
- **Páginas:** Cadastro.tsx (fluxo de onboarding)
- **Proposta:** 4 ilustrações para steps do cadastro
  - **Step 1 (Perfil):** Treinador com prancheta
  - **Step 2 (Clube):** Estádio sendo construído
  - **Step 3 (Tática):** Quadro tático com formação
  - **Step 4 (Pronto):** Troféu + confete
- **Estilo:** Flat illustration, 2-3 cores, minimalista
- **Resolução:** 400×300px
- **Proposta de uso:** Tornar onboarding mais visual e engajante

### 25. **Match Quick Hero Variations**
- **Arquivo:** `/public/goal-match-quick-01.svg`
- **Status:** ✅ Existe (1 variação)
- **Proposta:** Criar 5 variações de hero para Quick Match
  - Gol marcado (atual)
  - Defesa espetacular
  - Falta perigosa
  - Escanteio
  - Pênalti marcado
- **Formato:** SVG ilustrativo
- **Proposta de uso:** Rotacionar aleatoriamente para variedade visual

### 26. **Match Mobile Hero**
- **Arquivo:** `/public/goal-match-mobile.svg`
- **Status:** ✅ Existe
- **Proposta:** Otimizar para mobile (simplificar detalhes, aumentar contraste)

### 27. **Pitch Overlay (Campo Tático)**
- **Arquivo:** `/public/test-pitch/olefoot-pitch.svg`
- **Status:** ✅ Existe
- **Proposta de uso:** Overlay de campo para visualização tática (Team.tsx)

### 28. **Pit Image (Contexto desconhecido)**
- **Arquivo:** `/public/test-pitch/pit.jpg`
- **Status:** ❓ Uso não identificado no código
- **Ação:** Verificar se está em uso ou pode ser removido

### 29. **Player Photos (Genesis Collection)**
- **Pasta:** `/public/players-photos/genesis/`
- **Arquivos:** GEN-XXX-card.webp, GEN-XXX-token.webp
- **Status:** ✅ Coleção de fotos de jogadores Genesis
- **Proposta:** Expandir coleção com mais 50 jogadores genéricos (diversidade de etnias, idades, posições)

---

## 📐 ESPECIFICAÇÕES TÉCNICAS RECOMENDADAS

### Formatos de Arquivo
- **Logos e ícones:** SVG (escalável, leve)
- **Fotos e renders:** WebP (compressão superior) + fallback PNG
- **Ilustrações:** SVG (line-art) ou PNG transparente
- **Animações:** Lottie JSON ou CSS animations

### Paleta de Cores (Olefoot Brand)
```css
--neon-yellow: #FDE100 (amarelo neon — cor primária)
--deep-black: #0A0A0A (preto profundo — fundo)
--dark-gray: #1A1A1A (cinza escuro — cards)
--white: #FFFFFF (branco puro — texto)
--emerald-400: #34D399 (verde — vitória)
--red-500: #EF4444 (vermelho — derrota)
--amber-400: #FBBF24 (âmbar — empate)
```

### Tipografia
- **Display:** Bebas Neue (títulos, números grandes)
- **Serif Hero:** Moret (italic, editorial, OVR numbers)
- **UI:** Inter (corpo de texto, labels)
- **Sans:** System fonts (fallback)

### Grid e Espaçamento
- **Breakpoints:** 640px (sm), 768px (md), 1024px (lg), 1280px (xl)
- **Padding padrão:** 16px (mobile), 24px (tablet), 32px (desktop)
- **Border radius:** 4px (sm), 8px (md), 12px (lg)

---

## 🚀 PLANO DE IMPLEMENTAÇÃO

### Fase 1 — Crítico (Semana 1)
1. Login Hero Background (1920×1080px)
2. Player Portrait Placeholder (400×520px)
3. Organizar logos em `/public/brand/`

### Fase 2 — Match Engine (Semana 2)
4. Bola de Futebol (512×512px sprite sheet)
5. Goleiro Defendendo (800×600px)
6. Jogador Cobrando Pênalti (800×600px)
7. Gol Sofrido (800×600px)
8. Jogador Comemorando (800×600px)

### Fase 3 — Branding e UX (Semana 3)
9. Brasões de Clubes IA (20 variações, 256×256px)
10. Empty States Illustrations (3 variações, 400×300px)
11. Loading Animations (Lottie JSON)

### Fase 4 — Polimento (Semana 4)
12. Troféus 3D (8 renders, 512×512px)
13. Avatares de Treinador (12 variações, 256×256px)
14. Social Media Kit (4 formatos)

---

## 📊 RESUMO DE ENTREGAS

| Categoria | Quantidade | Prioridade | Formato | Resolução Típica |
|-----------|------------|------------|---------|------------------|
| **Backgrounds** | 6 | Alta | WebP/PNG | 1920×1080px |
| **Logos e Ícones** | 8 | Alta | SVG | Escalável |
| **Match Assets** | 6 | Média | PNG/WebP | 800×600px |
| **Ilustrações** | 7 | Média | SVG/PNG | 400×300px |
| **Renders 3D** | 8 | Baixa | PNG/WebP | 512×512px |
| **Avatares** | 12 | Baixa | PNG | 256×256px |
| **Animações** | 3 | Baixa | Lottie/CSS | — |
| **Social Media** | 4 | Baixa | PNG/JPG | Variado |

**Total de assets a criar/atualizar:** ~54 arquivos

---

## 💡 RECOMENDAÇÕES FINAIS

1. **Consistência visual:** Todos os assets devem seguir a paleta amarelo neon + preto profundo
2. **Performance:** Usar WebP sempre que possível (50-80% menor que PNG)
3. **Acessibilidade:** Garantir contraste mínimo 4.5:1 (WCAG AA)
4. **Responsividade:** Criar versões mobile-optimized para assets críticos
5. **Organização:** Manter estrutura de pastas clara (`/brand/`, `/match/`, `/players/`, `/ui/`)
6. **Versionamento:** Usar sufixos `-v2`, `-v3` para iterações (não sobrescrever)
7. **Documentação:** Criar `ASSETS_README.md` com guia de uso de cada asset

---

**Próximos passos:**
1. Priorizar assets críticos (Fase 1)
2. Criar briefing detalhado para designer/ilustrador
3. Definir cronograma de entregas
4. Implementar assets progressivamente (não bloquear desenvolvimento)

---

*Documento gerado por auditoria automatizada do código-fonte Olefoot v11*
