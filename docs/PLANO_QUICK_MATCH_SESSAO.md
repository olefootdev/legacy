# Plano — Quick Match: Pré-Jogo Universal + Gestão de Elenco (1 sessão)

> Status: proposta para 1 sessão. Base já no ar: `LigaOlePreviewModal` com
> GERIR ELENCO (IA), SALVAR ELENCO, voltar-sem-perder, e atalho de mercado
> (entregue em 2026-06-19, só na Liga Ole).

## Contexto atual

| Fluxo | Arquivo | Pré-jogo? |
|---|---|---|
| Liga Ole | `src/pages/LigaOle.tsx` → `LigaOlePreviewModal` | ✅ sim (edita escalação, vê cansados) |
| Quick (amistoso) | `FriendlyMatchBox` → `QuickSearchModal` → `/match/quick` | ❌ entra direto |
| Auto / Quick Plan | `MatchQuick.tsx` (gate `MatchQuickEngaged`) | ❌ |

- Escalação base: `buildDefaultLineupWithMeta()` (`src/entities/lineup.ts`) já filtra fadiga > 85 em cascata, mas o manager **não vê nem ajusta** antes de Quick/Auto.
- Fadiga SSOT: `playerHealth.fatigue` (`src/systems/fatigue.ts`), threshold `FATIGUE_EXHAUSTED_THRESHOLD = 85`.
- Persistência: `SET_LINEUP` no reducer grava `lineup` + `formationScheme`.

**Diagnóstico:** a peça mais valiosa (o pré-jogo com gestão de cansados) só vive na Liga Ole. O caminho mais comum (Partida Rápida) não tem essa tela.

---

## Objetivo da sessão
Transformar o `LigaOlePreviewModal` num **pré-jogo universal** reutilizável em todo Quick Match, e enriquecê-lo com previsão de fadiga, presets e batedores.

## Plano (1 sessão, ~5–6h)

### Fase 1 — Extrair `MatchPreviewModal` genérico (~1.5h) ⭐ núcleo
- [ ] Renomear/generalizar `LigaOlePreviewModal` → `MatchPreviewModal` em `src/components/match/`.
  - Props já são quase genéricas (`opponentName/Short/Overall`, `onConfirm/onCancel/onGoToMarket`). Manter retrocompat com um wrapper `LigaOlePreviewModal` ou trocar os 2 call-sites.
- [ ] Manter intacto: GERIR ELENCO, SALVAR, voltar-sem-perder, atalho mercado (já testado na Liga Ole).
- **Aceite:** Liga Ole continua idêntica usando o componente renomeado.

### Fase 2 — Plugar o pré-jogo na Partida Rápida (~1.5h) ⭐ núcleo
- [ ] No fluxo `QuickSearchModal` "Confirmar e jogar": em vez de `navigate('/match/quick')` direto, abrir `MatchPreviewModal` com o stub do adversário já resolvido.
- [ ] `onConfirm` → `SET_LINEUP` (já faz) → `navigate('/match/quick')`.
- [ ] `onCancel` → volta pro `QuickSearchModal` (sem perder escalação — `persistWorking` já cobre).
- **Aceite:** toda Partida Rápida passa pelo pré-jogo; cansados visíveis e ajustáveis antes do apito.

### Fase 3 — Previsão de fadiga pós-jogo (~1h)
- [ ] Em cada titular, estimar fadiga final (ex.: `+12` por jogo, `+30` se exausto — alinhar com `FINALIZE_MATCH`) e mostrar "sai em ~92%".
- [ ] Badge "vai estourar" pra quem cruza o threshold pós-jogo.
- **Aceite:** manager decide descanso vendo o custo do jogo, não só o estado atual.

### Fase 4 — Presets de escalação (~1h)
- [ ] Salvar até 2–3 presets nomeados em `manager` (store/persistência): "Titular cheio", "Time B".
- [ ] Botão "Carregar preset" no pré-jogo. O SALVAR ELENCO atual vira "Salvar como preset".
- **Aceite:** trocar entre escalações em 1 toque, persiste entre sessões.

### Fase 5 — Capitão + batedores (nice-to-have, ~1h)
- [ ] Selecionar batedor de pênalti/falta/escanteio e capitão no pré-jogo.
- [ ] Alimentar o shootout existente (`PenaltyShootout`) com o batedor escolhido em vez de heurística.
- **Aceite:** ordem de pênaltis respeita a escolha do manager.

---

## Sequência recomendada
Fase 1 → 2 (entrega o valor central: pré-jogo em todo Quick) → 3 (fadiga) → 4 (presets) → 5 (batedores). Dá pra parar após a Fase 2 e já ter ganho enorme.

## Fora de escopo
- Substituições ao vivo (já existem no `MatchQuick.tsx`).
- Pré-jogo no modo `auto`/Quick Plan Python (avaliar depois; o Python pré-computa).
- Táticas avançadas (pressão/linha) — outro projeto.

## Riscos / atenção
- **Não duplicar lógica de cansaço:** reusar `buildFatigueByIdMap`/`getEffectiveFatigue`, não recriar thresholds.
- **`MatchQuickEngaged` vs `MatchQuickLegacy`:** confirmar qual está ativo antes de plugar a Fase 2 (gate em `MatchQuick.tsx:665`).
- **Pausa do motor em modais** (regra do projeto): o pré-jogo é antes do kickoff, então não afeta o loop — mas garantir que `START_*_MATCH` só dispare no confirm.
- Memória [[feedback_match_engine_pause_on_modal]] e [[project_quick_live_tactics]] são referência.
