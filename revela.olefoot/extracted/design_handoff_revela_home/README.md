# Handoff: OLEFOOT REVELA — Home + Team Builder

## Overview
REVELA is the public layer of the OLEFOOT football ecosystem: a place to **discover rising players (revelações)**, **recognize legends**, follow rankings/"resenha", **build a team** mixing new talents with legends, and enter the Game. This handoff covers the full responsive Home page, including an interactive multi-step **Team Builder** and a live **Top 10** ranking.

The emotional core: *"I discovered this player before everyone else."* The page is deliberately split into **two visual universes** inside one brand:
- **REVELA** (future/street/energy) → yellow-dominant, loud condensed display type, stickers, posters.
- **LEGENDS** (past/legacy/eternal) → deep black, editorial serif, cinematic, generous spacing.

## About the Design Files
The files in this bundle are **design references created in HTML** — a prototype showing intended look and behavior, **not production code to copy directly**. The task is to **recreate this design in the target codebase's existing environment** (React, Vue, SwiftUI, native, etc.) using its established patterns, component library, routing, and data layer. If no environment exists yet, choose the most appropriate framework (React + TypeScript recommended) and implement there.

The prototype is authored as a single "Design Component" HTML file with an inline logic class. Treat that logic class as a **spec for state/behavior**, not as code to port line-by-line.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, and interactions are all intentional and specified below. Recreate the UI pixel-perfectly using the codebase's libraries. The only placeholders are **player/legend photos**, which use drag-and-drop image slots — wire these to real image URLs from your data layer.

---

## Design Tokens

### Colors (brand: "Legacy Tech")
| Token | Hex | Use |
|---|---|---|
| Neon Yellow | `#FDE100` | REVELA background, primary accent, CTAs |
| Deep Black | `#0D0D0D` | Stage background (LEGENDS), text on yellow, dark cards |
| Dark Gray (surface) | `#141414` / `#1A1A1A` | Card/input surfaces on dark |
| Off-white | `#EDEBE4` / `#F5F1E6` / `#F2ECDC` | Body text on dark; "Torcida" section bg (`#F2ECDC`); legend token accent |
| Resenha bg | `#15130C` | Neutral editorial section |
| Success | `#22C55E` | Verified badge, confirm/saved states, "like" states off |
| Warning | `#F59E0B` | Scouted badge |
| Danger | `#EF4444` | HOT badge, like active |
| Bronze (tier accent) | `#8A6A34` / `#B98A3E` | Série Bronze division only (functional tier/medal color) |

Rule from the brand book: **do not invent colors** beyond these. Category/rarity colors must have a function.

### Typography (3 families, non-mixing roles)
- **Anton** (Google Fonts) — REVELA display face. Uppercase, condensed, poster-scale. Used for hero headline, section titles in the yellow universe, big numbers (OVR tokens, "2018", rank numbers), team names. `letter-spacing` ~ `-.02em` to `.02em`, `line-height` ~ `.82–.9`.
- **Oswald** (400–700) — labels, eyebrows, CTAs, nav, buttons, filter chips, body-ish UI text. Always uppercase + wide tracking (`.1em–.3em`) for labels/CTAs.
- **Playfair Display** italic (Moret substitute) — **only** for: player/legend proper names, OVR/rating numbers on cards, and quotes. Used heavily in LEGENDS. **Do not** use Playfair for small data numbers (e.g. Top 10 points use Oswald).
- **Inter** (400–700) — running body text, descriptions, helper/metadata.

Google Fonts import:
`Anton` · `Oswald:wght@400;500;600;700` · `Playfair+Display:ital,wght@0,700;0,800;1,500;1,600;1,700;1,800;1,900` · `Inter:wght@400;500;600;700`

### Spacing / radius / effects
- Section padding: `clamp(44px,6vw,90px)` vertical, `clamp(16px,4vw,54px)` horizontal.
- Container max-width: 1180–1440px, centered.
- Radius: buttons `5–9px`; cards `10–20px`; pills/chips `20–40px`.
- Signature shadow (REVELA): **hard offset shadow**, no blur — `8px 8px 0` / `10px 10px 0` / `12px 12px 0 rgba(13,13,13,.9)`. Buttons lift with `translate(-2px,-2px)` + `5px 5px 0` shadow on hover.
- Card signature: 3–4px **yellow left rail** (`border-left:3px/4px solid #FDE100`) on content overlays.
- Section opener motif: a small yellow rule (`34–36px × 3–4px`) + Oswald eyebrow.

### Keyframes
- `revPulse` (live dot, 1.5s), `revFloat` (hero card, 6.5s translateY ±12px), `revToast` (toast in/out, 2.2–2.4s), `revMarq` (marquee scroll, 26s linear infinite).

---

## Screens / Views
This is a single scrolling page. Sections top → bottom:

### 1. Nav (sticky)
Yellow bar (`rgba(253,225,0,.92)` + blur), 2px black bottom border. Left: "OLEFOOT" (Anton 24px) + "REVELA" pill (black bg, yellow text, Oswald). Center: anchor links (Oswald 13px, `.14em`) → DESCOBRIR / TORCIDA / REVEAL WALL / LENDAS / RESENHA. Right: "CRIAR PERFIL" button (black bg, yellow text).

### 2. Hero — living poster (bg `#FDE100`)
- Ghost word "Revela" (Anton, `min(40vw,560px)`, `rgba(13,13,13,.06)`) behind, static.
- Left column: pill eyebrow "A NOVA CENA DO FUTEBOL · AO VIVO" (black pill, pulsing dot); H1 Anton `clamp(48px,8.8vw,132px)` line-height `.9` — "DESCUBRA / QUEM ESTÁ / CHEGANDO." ; Oswald subhead; two CTAs (EXPLORAR TALENTOS solid black, COMO FUNCIONA outline); two stats (Anton numbers: `{totalRev}` animated count-up to 12.480, "1.247").
- Right column: floating player card (`revFloat`), 3px black border, hard shadow, 4/5 photo slot, gradient scrim, OVR sticker (rotated), "CARD READY" tag, "EM ALTA" red sticker, supporters sticker with animated `{heroSup}` → 5.610, yellow-rail name plate "Enzo Martins" (Anton).

### 3. Marquee (bg `#0D0D0D`, yellow text)
Anton scrolling ticker: "REVELAR ✱ DESCOBRIR ✱ APOIAR ✱ ACOMPANHAR ✱ RECONHECER ✱" (`revMarq`, on black — keep this one; a former yellow-bg marquee was removed).

### 4. Descoberta — "Você ainda não conhece esses nomes." (bg `#FDE100`)
- Anton title + hint "ARRASTE · PASSE O MOUSE · REVELE".
- **Horizontal scroll rail** of talent cards (`overflow-x:auto`, `scroll-snap-type:x mandatory`), each `clamp(230px,24vw,286px)` wide. Card: 3px black border, hard shadow, 3/4 photo, gradient scrim, **OVR badge top-left** (dark rounded, Playfair yellow number + "OVR"), **status sticker top-right** (colored, see status vocabulary), yellow-rail name plate. Footer strip: supporters count (Anton) + APOIAR button.
- **Hover reveal**: on card hover, an overlay fades in showing name + 3 attribute bars that animate width 0→value (`transition:width .8s`).
- Below rail: centered CTA **"CRIAR PERFIL DE JOGO"** (black button) + subline "É de graça. O próximo nome pode ser o seu."

Status vocabulary (sticker bg/fg): `NEW` off-white/black · `RISING` yellow/black · `HOT` red/white · `VERIFICADO` green/dark · `SCOUTED` black/yellow · `CARD READY` yellow/black.

### 5. Torcida Digital — "Os mais apoiados da semana" (bg `#F2ECDC`, black text)
Ranked list (top 5 talents by supporter count), reorders live as users press APOIAR. Row: Anton rank number, Anton name, Oswald meta + trend, Playfair supporters count. Row 1 highlighted yellow; hover row → yellow.

### 6. Como Funciona (bg `#0D0D0D`, yellow) — *(formerly "Road to Card")*
- Ghost "CARD" behind. Left: eyebrow "O PROJETO OLEFOOT"; H2 Anton "COMO FUNCIONA"; intro "A Olefoot existe com o objetivo de criar novas oportunidades no futebol usando tecnologias de ponta."; big **"2018"** (Anton) + "Desde 2018 no mercado".
- Right: dark card listing **7 numbered steps** (Anton number chip + Oswald label): 1 Criação de perfil · 2 Validação de Conta · 3 Revisão pelo OLE SCOUT · 4 Divulgação na Plataforma · 5 Criação de CARD DIGITAL · 6 Compartilhar com os amigos · 7 Bem-vindo ao time.

### 7. Reveal Wall — "Uma geração inteira surgindo." (bg `#FDE100`)
Responsive grid (`repeat(auto-fill,minmax(clamp(110px,15vw,168px),1fr))`) of **the 11 top-rated revelações** (sorted by OVR desc). Each tile: 3/4 photo behind a **yellow overlay that fades on hover** (pure CSS `style-hover:opacity 0`) revealing the photo; overlay shows position + OVR (Anton) top, name bottom; a bottom gradient keeps the name legible when revealed.

### 8. LEGENDS — "Lendas que fizeram a história" (bg `#0D0D0D`)
Flat black (ghost text removed, no gradient transition before it). Centered editorial header (Playfair italic H2, quote). Grid `auto-fit minmax(280px,1fr)` of legend cards: **grayscale** 3/4 photo, gradient scrim, "LENDA · {ovr} OVR" outline tag, era (Oswald), name (Playfair italic large), yellow 28×2px rule, honor text (Inter). Hover lifts `translateY(-8px)` slow (`.5s`). Legends: Pelé (99), Garrincha (97), Sócrates (95).

### 9. A Resenha (bg `#15130C`, neutral editorial)
2-col (`auto-fit minmax`): left feature card (photo slot, "CAPA DA SEMANA" tag, Playfair headline, Inter dek); right list of 4 content rows (Playfair italic number + Oswald tag + Playfair title), hover shifts `translateX(5px)`.

### 10. O GAME — "CRIE O SEU TIME" — **interactive builder** (bg `#FDE100`)
A dark rounded card (`#0D0D0D`, hard shadow) with a 3-step flow + a step bar (1 CADASTRO · 2 ESCALAÇÃO · 3 COMPARTILHAR). See **Team Builder** section below.

### 11. Top 10 Clubes (bg `#0D0D0D`) — horizontal
Header with tabs **MÊS / SEMANA / DIÁRIO** (switch data). Horizontal scroll rail of 10 club cards, each `clamp(160px,20vw,200px)`: Anton rank (rank 1 card is yellow-filled), Oswald trend, Anton club name, **Oswald points** (`{pts} PTS`).

### 12. As 3 Divisões — "Suba as divisões da Olefoot" (bg `#0D0D0D`)
Grid `auto-fit minmax(clamp(240px,28vw,300px),1fr)`, aligned to bottom. 3 tier cards with top accent bar: Série Ouro (yellow, 32 clubes, "↓ 4 CLUBES DESCEM"), Série Prata (off-white, 64 clubes, "↑ SOBE · ↓ DESCE"), Série Bronze (bronze, ilimitado, "↑ 8 CLUBES SOBEM"). Big Anton tier number, Playfair name, Oswald tagline/clubs, Inter desc.

### 13. Game CTA — "ENTRE EM CAMPO." (bg `#FDE100`)
Faint static giant word behind (animation removed). Anton headline `clamp(52px,10vw,150px)`, Oswald sub, two CTAs (JOGAR AGORA solid black, CRIAR MEU PERFIL outline).

### 14. Footer (bg `#0D0D0D`)
OLEFOOT + REVELA pill, Playfair quote, copyright.

---

## Team Builder (detailed spec)

A gated 3-step flow inside the "CRIE O SEU TIME" card. State machine: `gameStep ∈ {register, build, share}`.

### Step 1 — CADASTRO (register)
Purpose: capture manager identity before building. Two inputs (dark, yellow focus border): **Nome** and **Telefone (WhatsApp)**. Validation: name length ≥ 2; phone digits (stripped of non-digits) ≥ 10, else inline red error. Button "COMEÇAR A MONTAR →" → persists to storage → `build`.

### Step 2 — ESCALAÇÃO (build)
- **Team name** input (Anton, uppercase).
- **Formation** chips: `4-3-3`, `4-4-2`, `3-5-2`, `4-2-3-1`. Changing formation **resets the lineup** (slot coordinates differ). Active chip yellow.
- **Pitch** (left): dark radial-green field with yellow line markings (box border, halfway line, center circle, penalty boxes), `aspect-ratio:3/4`. 11 slots at percentage `top/left` coordinates per formation (see coordinates below). Each slot is a token:
  - Empty: dashed yellow circle showing the position label (GOL/ZAG/LAT/MEI/VOL/ATA).
  - Filled: solid circle — **talent** = yellow bg / black border; **legend** = black bg / off-white border — showing the player's **OVR** (Oswald) with surname pill below.
  - Selected slot: green ring (`3px solid #22C55E` + soft outline).
  - Tap a slot to select it (tap again to clear it).
- **Pool** (right): filter chips — TODOS / REVELAÇÕES / LENDAS / GOL / DEF / MEI / ATA (position groups: GOL; DEF=ZAG,LAT; MEI=VOL,MEI; ATA=PON,ATA). Scrollable grid (`auto-fill minmax(150px,1fr)`, max-height ~52vh) of player chips: OVR box (talent=yellow, legend=off-white) + name + "{pos} · {REVELAÇÃO|LENDA}" with a colored type dot; assigned players get a yellow border + ✓.
  - Tap a player → assigns to the selected slot, or the first empty slot if none selected; removes them from any prior slot; advances selection to next empty slot. Tapping an already-assigned player removes them.
- **Confirm bar**: "TÉCNICO: {name} · {filled}/11 ESCALADOS" + **CONFIRMAR TIME →** (enabled only when team name set AND ≥1 player). → `share`.
- Selection hint line under pitch guides the interaction.

### Step 3 — COMPARTILHAR (share)
2-col (`auto-fit minmax(300px,1fr)`):
- **Poster** (exportable artifact): yellow header "OLEFOOT REVELA · MEU XI"; team name (Anton), "{formation} · TÉCNICO {name}"; a **read-only mini pitch** rendering the confirmed lineup tokens.
- **Share panel**: intro; **@olefootgame** Instagram link card (→ `https://instagram.com/olefootgame`); a "LEGENDA PRONTA" box with the auto caption; buttons **COPIAR LEGENDA** (clipboard), **COMPARTILHAR** (`navigator.share` w/ clipboard fallback), and a **♡/♥ CURTIR {likes}** toggle (base 128, red when liked); a green confirmation "✓ {name}, seu telefone e o time "{teamName}" já ficam salvos pro seu Game."; and "← EDITAR TIME" back to build.
- Auto caption format: `Montei meu XI na @olefootgame! ⚡ {teamName} — {formation}. Do novo talento à lenda no mesmo time. Vem revelar o próximo craque. #OlefootRevela`

### Formation slot coordinates (top%, left%)
- **4-3-3**: GK 90,50 · ZAG 68,34 · ZAG 68,66 · LAT 66,12 · LAT 66,88 · MEI 46,28 · MEI 46,50 · MEI 46,72 · ATA 20,25 · ATA 20,50 · ATA 20,75
- **4-4-2**: GK 90,50 · LAT 68,12 · ZAG 68,38 · ZAG 68,62 · LAT 68,88 · MEI 45,14 · MEI 45,38 · MEI 45,62 · MEI 45,86 · ATA 20,36 · ATA 20,64
- **3-5-2**: GK 90,50 · ZAG 70,26 · ZAG 70,50 · ZAG 70,74 · LAT 47,8 · MEI 47,30 · MEI 47,50 · MEI 47,70 · LAT 47,92 · ATA 20,36 · ATA 20,64
- **4-2-3-1**: GK 90,50 · LAT 72,12 · ZAG 72,38 · ZAG 72,62 · LAT 72,88 · VOL 54,36 · VOL 54,64 · MEI 33,24 · MEI 33,50 · MEI 33,76 · ATA 14,50

### Player pool (id, name, pos, OVR, type)
Revelações (T): enzo/Enzo Martins/ATA/86 · lucas/Lucas Andrade/PON/84 · rafa/Rafa Luz/PON/80 · theo/Théo Lima/ATA/78 · bianca/Bianca Rocha/MEI/81 · duda/Duda Reis/MEI/79 · ravi/Ravi Souza/MEI/76 · yuri/Yuri Nakamura/VOL/80 · kaique/Kaique Silva/ZAG/79 · caio/Caio Vieira/ZAG/76 · bruno/Bruno Sato/ZAG/75 · leo/Léo Campos/LAT/77 · diego/Diego Muralha/GOL/82 · nina/Nina Alves/GOL/74.
Legends (L): pele/Pelé/ATA/99 · garrincha/Garrincha/PON/97 · socrates/Sócrates/MEI/95 · calberto/Carlos Alberto/LAT/94.

---

## Interactions & Behavior
- **Count-up numbers** on mount: hero supporters → 5.610, talentos revelados → 12.480 (cubic ease-out over ~1.4–1.8s via rAF).
- **Attribute bars** in discovery cards animate width 0→value on hover.
- **APOIAR**: one-time per player; increments supporter count, marks "✓ NA TORCIDA" (green), re-sorts the Torcida ranking, fires a bottom toast "VOCÊ ESTÁ NA TORCIDA / {name} avançou no Road to Card" (auto-dismiss ~2.2s).
- **Top 10 tabs** and **formation chips** are instant client state swaps.
- **Reveal Wall** hover: overlay opacity 1→0.
- **Share** copy/share fire a green note toast "Legenda copiada! Marca a gente no post." (~2.4s).
- **Locale**: numbers formatted `pt-BR` (`toLocaleString`) → dot thousands separators.
- Buttons: hover lift + hard offset shadow; links hover lighten.

## State Management
- `gameStep` (register|build|share), `mgrName`, `mgrPhone`, `mgrErr`, `teamName`, `formation`, `slotAssign` (map slotIndex→playerId), `selSlot`, `poolFilter`, `liked`, `note` (toast).
- Home-wide: `sup` (per-player added supporters), `done` (supported set), `hovered` (card id), `rankTab` (mes|semana|diario), `toast`, animated counters (`heroSup`, `totalRev`), `mounted`.
- **Persistence**: on register/confirm, save `{name, phone, teamName, formation}` to storage key `olefoot_revela_manager`. On load, prefill and skip to `build` if name + valid phone exist. In production, persist to the user's account/profile so the Game can pull these fields. Only write your own key.

## Responsive behavior
Mobile-first intent. All multi-column layouts use `repeat(auto-fit,minmax(...,1fr))` so they collapse to one column on narrow screens; the pitch uses `aspect-ratio` (never fixed heights) so it never collapses on mobile. Type uses `clamp()` throughout. Horizontal rails (discovery, Top 10) scroll with snap. Keep min touch targets ≥ 44px.

## Assets
- **Fonts**: Anton, Oswald, Playfair Display, Inter (Google Fonts).
- **Player/legend photos**: placeholders via drag-and-drop image slots (`image-slot.js`, included). In production, replace with real image URLs from your data layer. Slot ids used: `rev-hero-player`, `rev-t-1..6`, `rev-w-1..11`, `rev-l-1..3`, `rev-resenha-hero`.
- No icon library required — glyphs (→, ✓, ♥, ✱, ●, ↑↓, ⚡) are typographic. Swap for your icon set if preferred.
- Instagram link target: `@olefootgame`.

## Files
- `REVELA Home.dc.html` — the full prototype (markup + inline logic class). Primary reference.
- `image-slot.js` — the image placeholder web component used by the prototype (reference only; replace with your image components).
- `REVELA Home v1 (dark).dc.html` — earlier all-dark exploration, kept for reference only (superseded).
