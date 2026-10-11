#!/usr/bin/env python3
"""
MOTOR DE POSSES (Partida Viva, Fase 1) — a bateria de calibração.

    python3 server/smartfield/test_motor_posses.py --n 1000

Roda N partidas sintéticas (test_cadeia_lances.entrada), N/3 confrontos
"reais" (elencos com OVR 60–82), 300 confrontos IGUAIS (mando de campo
isolado) e 300 confrontos com a casa 10 pontos PIOR, e FALHA se qualquer
intervalo travado (docs/MOTOR-DE-POSSES.md §5) sair:

  gols por jogo 2,4–3,0 · posse 38–62% em ≥ 90% das partidas e 48–52% de média
  no confronto igual · chutes por time 9–16 · cartões 2–5 · 0 gols de expulso ·
  time 10 pontos pior vence 15–25% · casa vence 42–48% no confronto igual ·
  0×0 ≤ 10% · goleada (≥ 4) ≤ 6% · pênaltis 0,15–0,30 · faltas 18–30 ·
  ações por posse 2,5–5 · p95 ≤ 40 ms · determinismo · cadeias consistentes
  (as mesmas conferências do test_cadeia_lances).
"""
import argparse
import copy
import os
import random
import statistics
import sys
import time

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from match_simulator import simulate  # noqa: E402
from test_cadeia_lances import POS, conferir_cadeias, entrada  # noqa: E402

INTERVALOS = {
    "gols_por_jogo": (2.4, 3.0),
    "posse_dentro_pct": (90.0, 100.0),       # % das partidas com posse da casa em 38–62
    "posse_media_igual": (48.0, 52.0),
    "chutes_por_time": (9.0, 16.0),
    "cartoes_por_jogo": (2.0, 5.0),
    "gols_de_expulso": (0, 0),
    "pior_10_vence_pct": (15.0, 25.0),
    "casa_vence_igual_pct": (42.0, 48.0),
    "zero_a_zero_pct": (0.0, 10.0),
    "goleada_pct": (0.0, 6.0),
    "penaltis_por_jogo": (0.15, 0.30),
    "faltas_por_jogo": (18.0, 30.0),
    "acoes_por_posse": (2.5, 5.0),
    "p95_ms": (0.0, 40.0),
    "determinismo_pct": (100.0, 100.0),
    "cadeias_falhas": (0, 0),
    "gols_historia_pct": (80.0, 100.0),
}


def time_por_ovr(r: random.Random, lado: str, ovr: int):
    out = []
    for i, (pos, role) in enumerate(POS):
        a = lambda: max(35, min(95, int(r.gauss(ovr, 6))))  # noqa: E731
        out.append({
            "id": f"{lado}-{i}", "name": f"{lado.upper()} {i}", "pos": pos, "role": role,
            "finalizacao": a(), "passe": a(), "marcacao": a(), "velocidade": a(), "fisico": a(),
            "confianca": a(), "drible": a(), "tatico": a(), "mentalidade": a(), "fair_play": r.randint(45, 90),
            "fatigue": r.randint(0, 40), "cabeceio": a(), "bola_parada": a(), "penalti": a(),
            "pe": r.choice(["left", "right", "both", None]),
        })
    return out


def confronto(i: int, ovr_casa: int, ovr_fora: int, seed: str):
    r = random.Random(f"{seed}-{i}")
    return {
        "seed": f"{seed}-{i}", "home_short": "CAS", "away_short": "VIS",
        "home_team": {"strength": ovr_casa, "intensity": "balanced", "lineup": time_por_ovr(r, "home", ovr_casa)},
        "away_team": {"strength": ovr_fora, "lineup": time_por_ovr(r, "away", ovr_fora)},
    }


def espelho(e):
    """O mesmo time dos dois lados (ids trocados): só o mando sobra."""
    e2 = copy.deepcopy(e)
    casa = copy.deepcopy(e["home_team"]["lineup"])
    for p in casa:
        p["id"] = p["id"].replace("home-", "away-")
        p["name"] = p["name"].replace("HOME", "AWAY")
    e2["away_team"] = {"strength": e["home_team"]["strength"], "lineup": casa}
    return e2


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=1000)
    args = ap.parse_args()
    n = max(60, args.n)

    gols = chutes = cartoes = faltas = penaltis = posses = acoes = 0
    zero = goleada = 0
    posse_dentro = 0
    gols_expulso = 0
    tempos = []
    falhas = []
    contagem = {}
    jogos = 0

    def contar(inp, plano):
        nonlocal gols, chutes, cartoes, faltas, penaltis, posses, acoes, zero, goleada, posse_dentro, gols_expulso, jogos
        jogos += 1
        h, a = plano["home_score"], plano["away_score"]
        gols += h + a
        if h == 0 and a == 0:
            zero += 1
        if abs(h - a) >= 4:
            goleada += 1
        ts = plano["team_stats"]
        chutes += ts["home"]["shots"] + ts["away"]["shots"]
        cartoes += ts["home"]["cards"] + ts["away"]["cards"] + sum(1 for e in plano["events"] if e["kind"].startswith("red_"))
        faltas += ts["home"]["fouls"] + ts["away"]["fouls"]
        penaltis += sum(1 for e in plano["events"] if e["kind"].startswith("penalty_"))
        posses += plano["posses"]["home"] + plano["posses"]["away"]
        acoes += plano["posses"]["acoes"]
        if 38.0 <= plano["possession_home_pct"] <= 62.0:
            posse_dentro += 1
        fora = {"home": set(), "away": set()}
        for e in plano["events"]:
            k = e["kind"]
            if k.startswith("red_"):
                fora[k.rsplit("_", 1)[1]].add(e["actor_id"])
            if k.startswith("goal_") and e.get("actor_id") in fora[e["actor_side"]]:
                gols_expulso += 1
            if k.startswith("penalty_") and e.get("actor_id") in fora[e["actor_side"]]:
                gols_expulso += 1
        conferir_cadeias(inp, plano, falhas, inp["seed"], contagem)

    t0 = time.time()
    # A) sintéticas (as mesmas entradas dos portões de hoje)
    for i in range(n):
        inp = entrada(i)
        t1 = time.process_time()  # tempo de CPU: a carga da máquina não entra
        plano = simulate(copy.deepcopy(inp))
        tempos.append((time.process_time() - t1) * 1000)
        contar(inp, plano)
    # B) confrontos "reais"
    for i in range(n // 3):
        r = random.Random(f"real-{i}")
        inp = confronto(i, r.randint(62, 80), r.randint(60, 82), "real")
        plano = simulate(copy.deepcopy(inp))
        contar(inp, plano)
    # C) confronto igual: só o mando
    vit_igual = 0
    posse_igual = []
    n_igual = max(300, n // 2)
    for i in range(n_igual):
        r = random.Random(f"igual-{i}")
        inp = espelho(confronto(i, r.randint(62, 80), 70, "igual"))
        plano = simulate(copy.deepcopy(inp))
        if plano["home_score"] > plano["away_score"]:
            vit_igual += 1
        posse_igual.append(plano["possession_home_pct"])
    # D) o time 10 pontos pior (metade como casa, metade como visitante)
    pior_vence = 0
    n_pior = max(300, n // 2)
    for i in range(n_pior):
        r = random.Random(f"pior-{i}")
        base = r.randint(62, 76)
        if i % 2 == 0:
            inp = confronto(i, base, base + 10, "pior")
            plano = simulate(copy.deepcopy(inp))
            if plano["home_score"] > plano["away_score"]:
                pior_vence += 1
        else:
            inp = confronto(i, base + 10, base, "pior")
            plano = simulate(copy.deepcopy(inp))
            if plano["away_score"] > plano["home_score"]:
                pior_vence += 1
    # E) determinismo
    iguais = 0
    for i in range(50):
        inp = entrada(i)
        a = simulate(copy.deepcopy(inp))
        b = simulate(copy.deepcopy(inp))
        for k in ("generated_at_ms", "duration_ms"):
            a.pop(k, None)
            b.pop(k, None)
        if a == b:
            iguais += 1

    tempos.sort()
    medidas = {
        "gols_por_jogo": gols / jogos,
        "posse_dentro_pct": 100.0 * posse_dentro / jogos,
        "posse_media_igual": statistics.mean(posse_igual),
        "chutes_por_time": chutes / jogos / 2,
        "cartoes_por_jogo": cartoes / jogos,
        "gols_de_expulso": gols_expulso,
        "pior_10_vence_pct": 100.0 * pior_vence / n_pior,
        "casa_vence_igual_pct": 100.0 * vit_igual / n_igual,
        "zero_a_zero_pct": 100.0 * zero / jogos,
        "goleada_pct": 100.0 * goleada / jogos,
        "penaltis_por_jogo": penaltis / jogos,
        "faltas_por_jogo": faltas / jogos,
        "acoes_por_posse": acoes / max(1, posses),
        "p95_ms": tempos[int(len(tempos) * 0.95)],
        "determinismo_pct": 100.0 * iguais / 50,
        "cadeias_falhas": len(falhas),
        "gols_historia_pct": 100.0 * contagem.get("gols_historia", 0) / max(1, contagem.get("gols", 1)),
    }
    fora = []
    print(f"\nMOTOR DE POSSES — bateria ({jogos} partidas + {n_igual} iguais + {n_pior} com 10 pontos de diferença · {time.time() - t0:.0f} s)\n")
    print(f"{'métrica':<24} {'medido':>9}   intervalo")
    for k, (lo, hi) in INTERVALOS.items():
        v = medidas[k]
        ok = lo <= v <= hi
        if not ok:
            fora.append(k)
        print(f"{'✓' if ok else '✗'} {k:<22} {v:>9.2f}   {lo}–{hi}")
    for f in falhas[:12]:
        print("  -", f)
    if fora:
        print(f"\n✗ fora do intervalo: {', '.join(fora)}")
        sys.exit(1)
    print("\n✓ todos os intervalos travados dentro")


if __name__ == "__main__":
    main()
