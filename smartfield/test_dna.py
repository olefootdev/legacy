"""
Teste do DNA do clube no Quick Plan (Fase 0 da "Fundação do Clube").

Prova duas coisas:
  1. NEUTRO: sem DNA, ou com todos os eixos em 0.5, o plano é idêntico.
  2. DIREÇÃO: cada eixo mexe no jogo pro lado que o manager pediu, medido na
     média de muitas partidas (mesmos seeds e elencos dos dois lados da régua).

Rodar: npm run test:club-dna   (ou python3 smartfield/test_dna.py)
"""
import json
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import match_simulator as ms  # noqa: E402

N = 300
ATTRS = ["finalizacao", "passe", "marcacao", "velocidade", "fisico", "confianca",
         "drible", "tatico", "mentalidade", "fair_play"]
ROLES = ["gk", "def", "def", "def", "def", "mid", "mid", "mid", "attack", "attack", "attack"]


def lineup(prefix, base, rng):
    return [{"id": f"{prefix}{i}", "name": f"{prefix}{i}", "pos": "X", "role": r,
             **{k: max(30, min(95, base + rng.randint(-10, 10))) for k in ATTRS},
             "fatigue": 0} for i, r in enumerate(ROLES)]


def partida(n, dna=None, dna_away=None):
    rng = random.Random(n)
    home = {"strength": 72, "intensity": "balanced", "lineup": lineup("h", 68, rng)}
    if dna is not None:
        home["dna"] = dna
    away = {"strength": 72, "lineup": lineup("a", 68, rng)}
    if dna_away is not None:
        away["dna"] = dna_away
    return ms.simulate({"seed": f"dna-{n}", "home_short": "BEN", "away_short": "OPE",
                        "home_team": home, "away_team": away})


def neutro():
    return {k: 0.5 for k in ms.DNA_EIXOS}


def com(**eixos):
    d = neutro()
    d.update(eixos)
    return d


def media(dna, campo):
    tot = 0.0
    for n in range(N):
        p = partida(n, dna)
        if campo == "conceded_shots":
            tot += p["team_stats"]["away"]["shots"]
        elif campo == "xg_per_shot":
            h = p["team_stats"]["home"]
            tot += h["xg"] / h["shots"] if h["shots"] else 0
        else:
            tot += p["team_stats"]["home"][campo]
    return tot / N


def limpo(p):
    p = dict(p)
    for k in ("generated_at_ms", "duration_ms", "dna_applied"):
        p.pop(k, None)
    return json.dumps(p, sort_keys=True)


falhas = []


def checa(nome, ok, detalhe):
    print(("  OK  " if ok else "  FALHA ") + nome + "  " + detalhe)
    if not ok:
        falhas.append(nome)


print("1) Neutro = plano de sempre")
iguais = all(limpo(partida(n)) == limpo(partida(n, neutro())) for n in range(60))
checa("sem DNA == DNA neutro (60 seeds)", iguais, "")
p = partida(1, com(posse=0.8))
eco = p["dna_applied"]["home"]
checa("motor ecoa o DNA usado (centrado)", eco["posse"] > 0.6 and abs(sum(eco.values()) / 7 - 0.5) < 0.02
      and p["dna_applied"]["away"] is None, f"posse {eco['posse']:.3f}")
p = partida(1, {k: 0.9 for k in ms.DNA_EIXOS})
checa("orçamento: tudo em 0.9 vira neutro", limpo(p) == limpo(partida(1)) or all(abs(v - 0.5) < 1e-9 for v in p["dna_applied"]["home"].values()), "")

print(f"2) Direção (média de {N} partidas, alto × baixo)")
casos = [
    ("posse → mais posse", com(posse=0.9), com(posse=0.1), "possession_pct", +1),
    ("pressão → mais roubadas no ataque", com(pressao=0.9), com(pressao=0.1), "high_recoveries", +1),
    ("vertical → mais finalizações", com(vertical=0.9), com(vertical=0.1), "shots", +1),
    ("criatividade → chance melhor (xG por chute)", com(criatividade=0.9), com(criatividade=0.1), "xg_per_shot", +1),
    ("disciplina → menos faltas", com(disciplina=0.9), com(disciplina=0.1), "fouls", -1),
    ("solidez → menos chutes sofridos", com(solidez=0.9), com(solidez=0.1), "conceded_shots", -1),
    ("intensidade → mais chances criadas", com(intensidade=0.9), com(intensidade=0.1), "chances_created", +1),
]
for nome, alto, baixo, campo, sinal in casos:
    a, b = media(alto, campo), media(baixo, campo)
    ok = (a - b) * sinal > 0
    checa(nome, ok, f"alto {a:.2f} × baixo {b:.2f}")

print(f"3) Adversário com DNA (média de {N} partidas)")
def media_away(dna_away, campo):
    return sum(partida(n, None, dna_away)["team_stats"]["home"][campo] for n in range(N)) / N
a, b = media_away(com(posse=0.9), "possession_pct"), media_away(com(posse=0.1), "possession_pct")
checa("rival de posse tira a bola da casa", a < b, f"casa com {a:.1f}% × {b:.1f}%")
def rival(dna_away, campo):
    return sum(partida(n, None, dna_away)["team_stats"]["away"][campo] for n in range(N)) / N
a, b = rival(com(pressao=0.9), "high_recoveries"), rival(com(pressao=0.1), "high_recoveries")
checa("rival que pressiona rouba mais no ataque", a > b, f"{a:.2f} × {b:.2f}")
a, b = media_away(com(solidez=0.9), "shots"), media_away(com(solidez=0.1), "shots")
checa("rival sólido: casa chuta menos", a < b, f"{a:.2f} × {b:.2f}")
p = partida(2, com(posse=0.8), com(pressao=0.8))
checa("motor ecoa os dois DNAs", p["dna_applied"]["home"] is not None and p["dna_applied"]["away"] is not None, "")

print()
if falhas:
    print(f"{len(falhas)} falha(s): {', '.join(falhas)}")
    sys.exit(1)
print("DNA chega ao motor e obedece. Tudo certo.")
