"""
Tradução `kind` → frase humana (PT-BR).

Cada consequência persistente tem um `kind` técnico (ex: `injury_light_out`)
que precisa virar texto legível no painel de transparência ("Lesão muscular
leve · 3 partidas afastado"). Esse módulo concentra o catálogo — quando
o impactCatalog.ts (TS) ganha um kind novo, espelhar aqui.

Manter sincronizado com `src/systems/impactCatalog.ts`.
"""
from typing import TypedDict


class Explanation(TypedDict):
    title: str
    subtitle: str  # texto curto com a causa/consequência
    severity: str  # "info" | "alert" | "celebration" | "neutral"


# Catálogo principal — alinhado com IMPACT_CATALOG do TS.
KIND_EXPLANATIONS: dict[str, Explanation] = {
    # ─── Física: lesões e fadiga ─────────────────────────────────────
    "injury_light_out": {
        "title": "Lesão muscular leve",
        "subtitle": "Afastado por algumas partidas; treinos limitados.",
        "severity": "alert",
    },
    "injury_medium_out": {
        "title": "Lesão de média gravidade",
        "subtitle": "Afastado por várias partidas; reabilitação no Departamento Médico.",
        "severity": "alert",
    },
    "injury_severe_out": {
        "title": "Lesão grave",
        "subtitle": "Longo período de recuperação; perda significativa de forma física.",
        "severity": "alert",
    },
    "exhaustion": {
        "title": "Exaustão pós-partida",
        "subtitle": "Mais de 12km percorridos — fadiga acumulada exige descanso.",
        "severity": "alert",
    },
    "forced_rest": {
        "title": "Descanso forçado",
        "subtitle": "Fadiga crítica; treinador determinou pausa.",
        "severity": "neutral",
    },
    # ─── Disciplina: cartões ──────────────────────────────────────────
    "red_card_suspension": {
        "title": "Suspenso por cartão vermelho",
        "subtitle": "Expulso na última partida; fica fora da próxima rodada.",
        "severity": "alert",
    },
    "red_card_suspension_repeat": {
        "title": "Reincidência de vermelho",
        "subtitle": "Segundo vermelho em 7 dias; suspensão estendida + multa do clube.",
        "severity": "alert",
    },
    # ─── Psicológica: moral ───────────────────────────────────────────
    "morale_boost_mvp": {
        "title": "Moral elevada (MVP)",
        "subtitle": "Eleito o melhor em campo; confiança aumentada nas próximas partidas.",
        "severity": "celebration",
    },
    "morale_boost_hat_trick": {
        "title": "Moral elevada (hat-trick)",
        "subtitle": "Três gols marcados; confiança nas finalizações disparou.",
        "severity": "celebration",
    },
    "morale_drop_card": {
        "title": "Moral abalada (cartão)",
        "subtitle": "Punição visível afetou a concentração nos próximos jogos.",
        "severity": "alert",
    },
    "morale_drop_heavy_defeat": {
        "title": "Moral abalada (goleada)",
        "subtitle": "Derrota pesada com saldo desfavorável; todo o grupo afetado.",
        "severity": "alert",
    },
    "morale_boost_classic_win": {
        "title": "Moral elevada (vitória em clássico)",
        "subtitle": "Vitória em clássico carrega o elenco — bônus de confiança no grupo.",
        "severity": "celebration",
    },
    # ─── Reputacional: mercado e imagem ───────────────────────────────
    "market_interest_spike": {
        "title": "Interesse do mercado disparou",
        "subtitle": "Atuação chamativa atraiu olhares de outros clubes.",
        "severity": "celebration",
    },
    "market_value_boost_mvp": {
        "title": "Valor de mercado em alta",
        "subtitle": "Performance MVP refletiu no preço; valorização registrada.",
        "severity": "celebration",
    },
    # ─── Financeira ───────────────────────────────────────────────────
    "fine_red_card": {
        "title": "Multa por expulsão",
        "subtitle": "Clube aplicou multa contratual pelo cartão vermelho.",
        "severity": "alert",
    },
}


def explain(kind: str) -> Explanation:
    """Retorna explicação canônica do kind; fallback genérico se desconhecido."""
    if kind in KIND_EXPLANATIONS:
        return KIND_EXPLANATIONS[kind]
    # Fallback honesto — não inventa frase
    pretty = kind.replace("_", " ").capitalize()
    return {
        "title": pretty,
        "subtitle": "Efeito ativo. (Sem descrição catalogada — atualizar explanations.py)",
        "severity": "neutral",
    }
