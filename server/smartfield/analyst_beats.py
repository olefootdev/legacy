"""
analyst_beats.py — Leituras do Analista + decisões com peso real.

Cada beat nasce da matchup matrix (verdade setorial dos 22 jogadores) +
estado do jogo no minuto do beat. A escolha "certa" é inferível do texto
do insight — quem lê o cenário acerta. Skill, não sorte.

Os pesos calculados aqui são a FONTE DE VERDADE: o TS só ecoa de volta
{channel, target_side, weight} no replan do 2º tempo, e o simulador aplica
como multiplicador de xG por canal.

Convenção de peso:
  target_side="home", weight > 0  → boost de xG do home no canal
  target_side="home", weight < 0  → corta xG do home no canal + dá fôlego global ao away
  target_side="away", weight > 0  → REDUZ xG do away no canal (escolha defensiva)
"""

import random
from typing import Any, Dict, List

from matchup_matrix import ATTACK_CHANNELS, CHANNEL_LABELS

# Minutos fixos das decisões do manager — ESPAÇADOS pra criar ritmo (respira →
# tensão → alívio). 2 por tempo + o INTERVALO como reset tático central:
#   1º tempo: 10', 30'  ·  INTERVALO (45')  ·  2º tempo: 60', 80'
# Menos decisões e bem distantes = mais emoção por decisão (anti-frenético).
BEAT_MINUTES_FULL = [10, 30, 60, 80]
BEAT_MINUTES_SECOND_HALF = [60, 80]
BEAT_WINDOW_MS = 6000

# Gênero gramatical dos labels — concordância dos templates PT-BR
CHANNEL_GENDER = {
    "ataque_central": "m",
    "corredor_esquerdo": "m",
    "corredor_direito": "m",
    "criacao": "f",
    "bola_parada": "f",
    "finalizacao_vs_gk": "f",
    "pressao": "f",
}


def _art(ch: str) -> str:
    """Artigo definido: 'o corredor', 'a bola parada'."""
    return "o" if CHANNEL_GENDER.get(ch, "m") == "m" else "a"


def _em(ch: str) -> str:
    """Contração em+artigo: 'no corredor', 'na criação'."""
    return "no" if CHANNEL_GENDER.get(ch, "m") == "m" else "na"


def _por(ch: str) -> str:
    """Contração por+artigo: 'pelo corredor', 'pela bola parada'."""
    return "pelo" if CHANNEL_GENDER.get(ch, "m") == "m" else "pela"

# Clamp de segurança aplicado também no replay (pesos ecoados pelo TS)
WEIGHT_CLAMP = 0.25


def _trend(momentum_curve: List[float]) -> str:
    if len(momentum_curve) < 6:
        return "stable"
    delta = momentum_curve[-1] - momentum_curve[-6]
    if delta > 4:
        return "rising"
    if delta < -4:
        return "falling"
    return "stable"


# Verbo tático ofensivo por canal (curto, pt-BR). target_side=home.
ATTACK_VERB = {
    "ataque_central": "Joga pelo meio",
    "corredor_esquerdo": "Ataca pela esquerda",
    "corredor_direito": "Ataca pela direita",
    "criacao": "Cadencia e cria",
    "bola_parada": "Aposta na bola parada",
    "pressao": "Pressão alta!",
}
# Verbo tático defensivo por canal (trava a ameaça deles). target_side=away.
DEFEND_VERB = {
    "ataque_central": "Fecha o meio deles",
    "corredor_esquerdo": "Fecha a esquerda",
    "corredor_direito": "Fecha a direita",
    "criacao": "Marca a criação deles",
    "bola_parada": "Atenção na bola parada",
    "pressao": "Segura o ímpeto deles",
}

# Variantes de rótulo por canal (a UI não repete o mesmo botão toda vez).
# Comando curto de beira de campo — voz de comissão técnica brasileira.
ATTACK_VERB_ALT = {
    "ataque_central": ["Joga pelo meio", "Avança pelo centro", "Ataca pelo meio"],
    "corredor_esquerdo": ["Ataca pela esquerda", "Sobe pela esquerda", "Joga pela esquerda"],
    "corredor_direito": ["Ataca pela direita", "Sobe pela direita", "Joga pela direita"],
    "criacao": ["Roda a bola e cria", "Toca e arma a jogada", "Cadencia no meio"],
    "bola_parada": ["Aposta na bola parada", "Manda na área", "Capricha na bola alçada"],
    "pressao": ["Pressão na saída deles", "Marca na frente", "Sufoca o adversário"],
}
DEFEND_VERB_ALT = {
    "ataque_central": ["Fecha o meio", "Tranca o centro", "Reforça a marcação no meio"],
    "corredor_esquerdo": ["Fecha a esquerda", "Marca o ponta deles", "Protege a esquerda"],
    "corredor_direito": ["Fecha a direita", "Marca o ponta deles", "Protege a direita"],
    "criacao": ["Marca a criação deles", "Anula o camisa 10 deles", "Cola no armador"],
    "bola_parada": ["Atenção na bola parada", "Cuidado na bola alçada", "Marca o homem na área"],
    "pressao": ["Segura o ímpeto deles", "Sai jogando com calma", "Tira a bola da pressão"],
}

# Leitura humana do MOMENTO (faixa de momentum) — voz de narrador brasileiro.
def _momentum_phrase(mom: float, home_short: str, away_short: str) -> str:
    if mom >= 70:
        return f"O {home_short} tá sufocando o {away_short}"
    if mom >= 58:
        return f"O {home_short} cresceu e tá empilhando chegada"
    if mom >= 45:
        return "Jogo aberto, taco a taco"
    if mom >= 33:
        return f"O {away_short} tomou conta do jogo"
    return f"O {away_short} tá sufocando — liga o alerta"

# Por que ESTE canal está aberto pra atacar (banco por canal, gíria brasileira).
ATTACK_DESC = {
    "ataque_central": [
        "a zaga deles abre no meio", "tem espaço entre os zagueiros",
        "o miolo tá livre pra enfiar a bola", "dá pra jogar nas costas da zaga",
    ],
    "corredor_esquerdo": [
        "a esquerda tá escancarada", "o lateral deles largou a esquerda",
        "dá pra vazar pela esquerda em velocidade", "a ponta esquerda tá liberada",
    ],
    "corredor_direito": [
        "a direita tá livre pra subir", "o lado direito tá aberto",
        "dá pra rasgar pela direita", "o lateral deles abandonou a direita",
    ],
    "criacao": [
        "seu camisa 10 tá com tempo pra pensar", "o meio deles não pega o seu armador",
        "a bola corre fácil no meio", "dá pra trocar passe e abrir o jogo",
    ],
    "bola_parada": [
        "na bola alçada vocês levam vantagem", "dá pra mandar na área no escanteio",
        "tem gente alta pra ganhar no alto", "a falta na entrada pede capricho",
    ],
}
# Por que ESTE canal deles te ameaça (banco por canal, gíria brasileira).
DEFEND_DESC = {
    "ataque_central": [
        "o centroavante deles tá ganhando as dividas", "eles tão enfiando a bola no meio",
        "a sua zaga tá balançando no miolo", "eles acham o passe nas costas dos zagueiros",
    ],
    "corredor_esquerdo": [
        "eles tão vazando pela sua direita", "o ponta deles tá solto na sua direita",
        "a sua direita tá aberta", "eles cruzam à vontade pela direita",
    ],
    "corredor_direito": [
        "eles atacam forte pela sua esquerda", "o ponta deles te castiga pela esquerda",
        "a sua esquerda virou ponto fraco", "eles sobem fácil pela sua esquerda",
    ],
    "criacao": [
        "o camisa 10 deles tá ditando o ritmo", "eles tocam e te tiram da posição",
        "o meio deles tá mandando no jogo", "eles sempre acham o homem livre",
    ],
    "bola_parada": [
        "a bola parada deles assusta", "eles têm gente alta pra cabecear",
        "cuidado com a jogada ensaiada", "nas faltas eles sobem com perigo",
    ],
    "pressao": [
        "a marcação deles te sufoca na saída", "eles roubam a bola lá na frente",
        "você não tá conseguindo sair jogando", "eles te pressionam e abafam atrás",
    ],
}


def _cap(s: str) -> str:
    return s[0].upper() + s[1:] if s else s


# Local CURTO por canal (forma preposicionada) — pra leitura do Analista em ≤5
# palavras. A resposta certa continua inferível: o local aponta o botão certo.
SHORT_LOCAL = {
    "ataque_central": "no meio",
    "corredor_esquerdo": "pela esquerda",
    "corredor_direito": "pela direita",
    "criacao": "no meio-campo",
    "bola_parada": "na bola parada",
    "pressao": "na pressão",
}


def _max5(s: str) -> str:
    """Garante no máximo 5 palavras na descrição do Analista (pedido do produto)."""
    parts = s.split()
    return " ".join(parts[:5]) if len(parts) > 5 else s


def _verb(bank_alt: Dict[str, List[str]], bank: Dict[str, str], ch: str, minute: int, tag: str) -> str:
    """Rótulo do botão com variação estável (varia entre beats, fixo no seed)."""
    opts = bank_alt.get(ch)
    if not opts:
        return bank.get(ch, "Ataca")
    return opts[(minute + len(tag)) % len(opts)]


def _attack_choice(minute: int, ch: str, edge: float, tag: str) -> Dict[str, Any]:
    return {
        "id": f"beat-{minute}-{tag}",
        "label": _verb(ATTACK_VERB_ALT, ATTACK_VERB, ch, minute, tag),
        "channel": ch,
        "target_side": "home",
        # Canal forte → peso bom; canal fraco → armadilha (negativo).
        "weight": round(0.06 + edge * 0.30, 3),
    }


def _defend_choice(minute: int, ch: str, threat_edge: float, tag: str) -> Dict[str, Any]:
    return {
        "id": f"beat-{minute}-{tag}",
        "label": _verb(DEFEND_VERB_ALT, DEFEND_VERB, ch, minute, tag),
        "channel": ch,
        "target_side": "away",
        # Travar uma ameaça real vale; travar o que não assusta vale pouco.
        "weight": round(max(0.03, 0.05 + threat_edge * 0.16), 3),
    }


def build_beat(
    rng: random.Random,
    minute: int,
    half: int,
    home_matrix: Dict[str, Dict[str, Any]],
    away_matrix: Dict[str, Dict[str, Any]],
    home_short: str,
    away_short: str,
    momentum_curve: List[float],
    home_score: int,
    away_score: int,
) -> Dict[str, Any]:
    atk_edges = {ch: home_matrix[ch]["edge"] for ch in ATTACK_CHANNELS}
    away_edges = {ch: away_matrix[ch]["edge"] for ch in ATTACK_CHANNELS}
    atk_rank = sorted(ATTACK_CHANNELS, key=lambda ch: atk_edges[ch], reverse=True)
    threat_rank = sorted(ATTACK_CHANNELS, key=lambda ch: away_edges[ch], reverse=True)
    best, worst = atk_rank[0], atk_rank[-1]
    threat, threat2 = threat_rank[0], threat_rank[1]
    trend = _trend(momentum_curve)
    diff = home_score - away_score  # >0 ganhando, <0 perdendo
    mom = momentum_curve[-1] if momentum_curve else 50.0

    # INTENÇÃO do momento: o jogo está no ATAQUE da casa, na DEFESA, ou neutro?
    # Momentum manda; placar dá um empurrão (atrás → ataca; na frente → segura).
    score = mom + (-6 if diff < 0 else 5 if diff > 0 and trend != "rising" else 0)
    # Banda neutra ESTREITA (47–53): compromete mais com ataque/defesa, menos "morno".
    if score >= 53:
        intent = "attack"
    elif score <= 47:
        intent = "defend"
    else:
        intent = "neutral"

    lb = CHANNEL_LABELS[best]
    lt = CHANNEL_LABELS[threat]
    mom_phrase = _momentum_phrase(mom, home_short, away_short)
    best_strong = atk_edges[best] > 0.18      # canal realmente dominado
    threat_strong = away_edges[threat] > 0.18  # ameaça realmente perigosa

    # --- Insight CURTO (≤5 palavras): só a leitura essencial do Analista ---
    # Aponta ONDE está a chance (best) ou o perigo (threat). Resposta inferível.
    loc_atk = SHORT_LOCAL.get(best, "no jogo")
    loc_def = SHORT_LOCAL.get(threat, "no jogo")
    if intent == "attack":
        text = rng.choice([
            f"Espaço {loc_atk}.",
            f"Brecha {loc_atk}, vai!",
            f"Ataque {loc_atk}!",
        ])
    elif intent == "defend":
        text = rng.choice([
            f"Perigo {loc_def} deles.",
            f"Cuidado {loc_def}.",
            f"Eles vêm {loc_def}.",
        ])
    else:
        # Neutro NUNCA diz "equilibrado" (a barra já mostra isso): aponta a inclinação.
        text = rng.choice([
            f"Vai abrir {loc_atk}.",
            "Quem marcar primeiro decide.",
            f"Olho {loc_def} deles.",
        ])
    text = _max5(text)

    # --- Opções moldadas pela intenção (ataca = fazer gol; defende = salvar) ---
    a_ch = atk_rank[0] if (minute // 20) % 2 == 0 else atk_rank[1]
    b_ch = threat if (minute // 17) % 2 == 0 else threat2

    if intent == "attack":
        # Dois caminhos pro gol + uma armadilha (forçar o canal fechado).
        c2 = next((c for c in atk_rank if c != a_ch), worst)
        choices = [
            _attack_choice(minute, a_ch, atk_edges[a_ch], "atk1"),
            _attack_choice(minute, c2, atk_edges[c2], "atk2"),
            {
                "id": f"beat-{minute}-trap",
                "label": ATTACK_VERB.get(worst, "Força mesmo assim"),
                "channel": worst, "target_side": "home",
                "weight": round(min(-0.04, atk_edges[worst] * 0.18), 3),
            },
        ]
    elif intent == "defend":
        # Duas formas de SALVAR o gol + um contra-ataque rápido.
        choices = [
            _defend_choice(minute, threat, away_edges[threat], "def1"),
            _defend_choice(minute, threat2, away_edges[threat2], "def2"),
            {**_attack_choice(minute, best, atk_edges[best], "counter"),
             "label": "Sai no contra-ataque"},
        ]
    else:
        choices = [
            _attack_choice(minute, a_ch, atk_edges[a_ch], "atk"),
            _defend_choice(minute, b_ch, away_edges[b_ch], "def"),
        ]
        if diff < 0:
            c_ch = next((c for c in atk_rank if c != a_ch), worst)
            choices.append(_attack_choice(minute, c_ch, atk_edges[c_ch], "push"))
        elif diff > 0:
            choices.append({
                "id": f"beat-{minute}-park", "label": "Segura o resultado",
                "channel": threat, "target_side": "away",
                "weight": round(max(0.03, 0.04 + away_edges[threat] * 0.10), 3),
            })
        else:
            choices.append({
                "id": f"beat-{minute}-trap", "label": ATTACK_VERB.get(worst, "Força mesmo assim"),
                "channel": worst, "target_side": "home",
                "weight": round(min(-0.04, atk_edges[worst] * 0.18), 3),
            })

    # Dedup por canal+lado (evita duas opções idênticas) e embaralha.
    seen = set()
    uniq = []
    for c in choices:
        key = (c["channel"], c["target_side"])
        if key in seen:
            continue
        seen.add(key)
        uniq.append(c)
    while len(uniq) < 3:
        # Completa com um canal ofensivo ainda não usado.
        for c in atk_rank:
            if (c, "home") not in seen:
                uniq.append(_attack_choice(minute, c, atk_edges[c], f"alt{len(uniq)}"))
                seen.add((c, "home"))
                break
        else:
            break
    rng.shuffle(uniq)

    return {
        "id": f"beat-{minute}",
        "minute": minute,
        "half": half,
        "intent": intent,  # attack | defend | neutral — enquadra a UI (CHANCE/PERIGO)
        "insight": {
            "text": text,
            "primary_channel": best,
            "threat_channel": threat,
            "momentum_trend": trend,
        },
        "choices": uniq,
        "window_ms": BEAT_WINDOW_MS,
    }


def build_decision_modifiers(decisions: List[Dict[str, Any]]):
    """Converte o ledger de decisões em multiplicadores de xG por canal + BUFFER global.

    Filosofia (pedido do produto): mesmo com OVRs parecidos, um manager que lê bem
    o jogo precisa de um BUFFER — vantagem que atravessa o time todo, em ataque E
    defesa, não só no canal escolhido. Por isso, além dos multiplicadores por canal,
    boas decisões acumulam um tilt global:
      • escolha ofensiva certa (home, w>0)  → home_global sobe (ataque inteiro respira)
      • escolha defensiva certa (away, w>0)  → away_suppress cai (defesa inteira segura)
      • escolha ruim (home, w<0)            → away_global sobe (você dá fôlego pra eles)

    Retorna (home_mult, away_mult, away_global, home_global, away_suppress):
      home_mult[ch]  — multiplica xG do home em ch
      away_mult[ch]  — multiplica xG do away em ch (escolhas defensivas reduzem)
      away_global    — boost global do away gerado por escolhas RUINS do manager
      home_global    — buffer global de ATAQUE do home (boas escolhas ofensivas)
      away_suppress  — buffer global de DEFESA (boas escolhas defensivas reduzem o away)
    """
    home_mult: Dict[str, float] = {}
    away_mult: Dict[str, float] = {}
    away_global = 1.0
    home_global = 1.0
    away_suppress = 1.0
    for d in decisions or []:
        ch = d.get("channel")
        if ch not in CHANNEL_LABELS:
            continue
        try:
            w = float(d.get("weight", 0))
        except (TypeError, ValueError):
            continue
        w = max(-WEIGHT_CLAMP, min(WEIGHT_CLAMP, w))
        if d.get("target_side") == "away":
            away_mult[ch] = away_mult.get(ch, 1.0) * (1 - max(0.0, w))
            if w > 0:
                away_suppress *= 1 - w * 0.38  # boa defesa segura o time todo (buffer reforçado)
        else:
            home_mult[ch] = home_mult.get(ch, 1.0) * (1 + w)
            if w > 0:
                home_global *= 1 + w * 0.45    # bom ataque levanta o time todo (buffer reforçado)
            else:
                away_global *= 1 + abs(w) * 0.5
    # Tetos de segurança — buffer da DECISÃO CORRETA agora pesa mais (recompensa
    # quem lê bem o jogo), sem virar injustiça: decisão ruim ainda penaliza.
    home_global = min(1.55, home_global)
    away_suppress = max(0.64, away_suppress)
    away_global = min(1.45, away_global)
    return home_mult, away_mult, away_global, home_global, away_suppress


def decisions_fingerprint(decisions: List[Dict[str, Any]]) -> str:
    """String estável do ledger — entra no seed do 2º tempo (replay coerente)."""
    parts = []
    for d in decisions or []:
        try:
            w = round(float(d.get("weight", 0)), 3)
        except (TypeError, ValueError):
            w = 0.0
        parts.append(f"{d.get('channel')}:{d.get('target_side', 'home')}:{w}")
    return "|".join(parts)
