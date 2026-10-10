#!/usr/bin/env python3
"""
PARTIDA VIVA, Fase 2 — portão da cadeia de lances.

1. NENHUM PLACAR MUDA: para N seeds, o plano COM cadeia é idêntico ao plano SEM
   cadeia em tudo (placar, eventos, autores, xG, textos, momento, MVP…), menos
   no campo `cadeia`. Opcional: `--base caminho/para/match_simulator_antigo.py`
   compara também contra a versão anterior do simulador (sem `assist_id`).
2. CONSISTÊNCIA: toda cadeia de finalização termina no autor; o passe pro autor
   de um gol sai de quem o simulador conta como assistência; todo `de`/`para`
   está em campo naquele minuto e do lado certo; todo ponto cabe no campo.
3. HISTÓRIA: a maioria dos gols é uma jogada de 3 a 6 ações.

    python3 server/smartfield/test_cadeia_lances.py            # 1000 seeds
    python3 server/smartfield/test_cadeia_lances.py --n 200 --base /tmp/old/match_simulator.py
"""
import argparse
import copy
import importlib.util
import os
import random
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from match_simulator import simulate  # noqa: E402

POS = [("GOL", "gk"), ("ZAG", "def"), ("ZAG", "def"), ("LE", "def"), ("LD", "def"),
       ("VOL", "mid"), ("MC", "mid"), ("MC", "mid"), ("PE", "attack"), ("ATA", "attack"), ("PD", "attack")]
VOLATEIS = ("generated_at_ms", "duration_ms")


def time_aleatorio(r: random.Random, lado: str):
    out = []
    for i, (pos, role) in enumerate(POS):
        a = lambda: r.randint(35, 92)  # noqa: E731
        out.append({
            "id": f"{lado}-{i}", "name": f"{lado.upper()} {i}", "pos": pos, "role": role,
            "finalizacao": a(), "passe": a(), "marcacao": a(), "velocidade": a(), "fisico": a(),
            "confianca": a(), "drible": a(), "tatico": a(), "mentalidade": a(), "fair_play": a(),
            "fatigue": r.randint(0, 60), "cabeceio": a(), "bola_parada": a(), "penalti": a(),
            "pe": r.choice(["left", "right", "both", None]),
        })
    return out


def entrada(i: int):
    r = random.Random(f"entrada-{i}")
    d = {
        "seed": f"teste-{i}",
        "home_short": "CAS", "away_short": "VIS",
        "home_team": {"strength": r.randint(55, 90), "intensity": r.choice(["defensive", "balanced", "offensive"]),
                      "lineup": time_aleatorio(r, "home")},
        "away_team": {"strength": r.randint(55, 90), "lineup": time_aleatorio(r, "away")},
        "is_derby": r.random() < 0.1,
    }
    if r.random() < 0.3:
        d["home_team"]["dna"] = {k: round(r.random(), 3) for k in ("posse", "pressao", "vertical", "solidez")}
    if r.random() < 0.25:
        d["mode"] = "second_half"
        d["first_half"] = {"home_score": r.randint(0, 2), "away_score": r.randint(0, 2), "momentum_end": r.randint(30, 70)}
    return d


def sem(plano, chaves=("cadeia",)):
    p = copy.deepcopy(plano)
    for k in VOLATEIS:
        p.pop(k, None)
    for ev in p.get("events", []):
        for c in chaves:
            ev.pop(c, None)
    return p


def carregar(caminho):
    spec = importlib.util.spec_from_file_location("simulador_base", caminho)
    mod = importlib.util.module_from_spec(spec)
    sys.path.insert(0, os.path.dirname(caminho))
    spec.loader.exec_module(mod)  # type: ignore
    return mod.simulate


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=1000)
    ap.add_argument("--base", default=None)
    args = ap.parse_args()
    simular_base = carregar(args.base) if args.base else None

    falhas = []
    gols = gols_historia = finalizacoes = com_assist = assist_ok = total_cadeias = 0
    for i in range(args.n):
        inp = entrada(i)
        com = simulate(copy.deepcopy(inp))
        semc = simulate({**copy.deepcopy(inp), "sem_cadeia": True})
        if sem(com) != sem(semc):
            falhas.append(f"seed {i}: plano com cadeia difere do plano sem cadeia")
        if simular_base:
            antigo = simular_base(copy.deepcopy(inp))
            if sem(com, ("cadeia", "assist_id")) != sem(antigo, ("cadeia", "assist_id")):
                falhas.append(f"seed {i}: plano difere do simulador base")

        ids = {"home": {p["id"] for p in inp["home_team"]["lineup"]}, "away": {p["id"] for p in inp["away_team"]["lineup"]}}
        fora = {"home": set(), "away": set()}
        for ev in com["events"]:
            k = ev["kind"]
            if k.startswith("red_"):
                fora["home" if k.endswith("_home") else "away"].add(ev.get("actor_id"))
            cad = ev.get("cadeia")
            if not cad:
                continue
            total_cadeias += 1
            lado = ev["actor_side"]
            outro = "away" if lado == "home" else "home"
            acoes = cad["acoes"]
            if not acoes:
                falhas.append(f"seed {i} {ev['minute']}' {k}: cadeia vazia")
                continue
            for ac in acoes:
                if not (0 <= ac["x"] <= 105 and 0 <= ac["z"] <= 68):
                    falhas.append(f"seed {i} {ev['minute']}' {k}: ponto fora do campo {ac}")
                quem = ac["de"]
                lado_de = outro if ac["t"] in ("falta", "desvio") else lado
                if quem not in ids[lado_de] or quem in fora[lado_de]:
                    falhas.append(f"seed {i} {ev['minute']}' {k}: '{ac['t']}' por quem não está em campo ({quem})")
                if ac.get("para"):
                    lado_para = outro if ac["t"] in ("drible", "desarme") else lado
                    if ac["para"] not in ids[lado_para] or ac["para"] in fora[lado_para]:
                        falhas.append(f"seed {i} {ev['minute']}' {k}: '{ac['t']}' pra quem não está em campo ({ac['para']})")
            if cad["finalizacao"]:
                finalizacoes += 1
                if acoes[-1]["de"] != ev["actor_id"]:
                    falhas.append(f"seed {i} {ev['minute']}' {k}: finalização não é do autor")
            if k.startswith("goal_"):
                gols += 1
                if 3 <= len(acoes) <= 6:
                    gols_historia += 1
                if ev.get("assist_id"):
                    com_assist += 1
                    passe = next((ac for ac in reversed(acoes) if ac.get("para") == ev["actor_id"]), None)
                    if passe and passe["de"] == ev["assist_id"]:
                        assist_ok += 1
                    else:
                        falhas.append(f"seed {i} {ev['minute']}' gol: o passe pro autor não veio da assistência")

    print(f"{args.n} partidas · {total_cadeias} cadeias · {finalizacoes} finalizações · {gols} gols")
    print(f"gols contados como jogada de 3–6 ações: {gols_historia}/{gols} ({100 * gols_historia / max(1, gols):.1f}%)")
    print(f"gols com assistência e passe certo: {assist_ok}/{com_assist}")
    if gols and gols_historia / gols < 0.8:
        falhas.append(f"só {100 * gols_historia / gols:.1f}% dos gols viram jogada de 3–6 ações (mínimo 80%)")
    if falhas:
        print(f"\n✗ {len(falhas)} falha(s):")
        for f in falhas[:25]:
            print("  -", f)
        sys.exit(1)
    print("\n✓ nenhum placar mudou · ✓ cadeias consistentes")


if __name__ == "__main__":
    main()
