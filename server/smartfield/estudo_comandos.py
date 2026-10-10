#!/usr/bin/env python3
"""
LEGACY, Fase 4b — estudo de balanceamento dos comandos ao vivo.

Joga cada confronto como o celular joga: plano inteiro → replan a partir de
m+3 a cada comando (estado = placar/momento/cartões até ali) → replan do
intervalo (sempre, como na Rápida). Compara políticas de comando contra a
mesma partida SEM comando (mesmos confrontos, mesmas seeds).

Critérios (o que o portão exige):
  - nenhuma política passa de +6 pp de vitória sobre "sem comando";
  - "replan vazio" (refazer o plano sem efeito) fica perto de 0 — refazer
    o plano não pode virar "sortear de novo" a favor de ninguém;
  - os gritos têm custo visível (cobrar → mais cartão).

    python3 server/smartfield/estudo_comandos.py --n 600
"""
import argparse
import copy
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from match_simulator import simulate  # noqa: E402
from test_cadeia_lances import entrada  # noqa: E402


def placar_ate(eventos, minuto_exclusivo):
    h = sum(1 for e in eventos if e["kind"] == "goal_home" and e["minute"] < minuto_exclusivo)
    a = sum(1 for e in eventos if e["kind"] == "goal_away" and e["minute"] < minuto_exclusivo)
    return h, a


def estado_em(eventos, curva, inicio_curva, minuto):
    h, a = placar_ate(eventos, minuto)
    idx = max(0, min(len(curva) - 1, minuto - inicio_curva - 1))
    conta = lambda k: sum(1 for e in eventos if e["kind"] == k and e["minute"] < minuto)  # noqa: E731
    return {
        "home_score": h, "away_score": a, "momentum_end": curva[idx] if curva else 50,
        "cards_home": conta("yellow_home") + conta("red_home"), "cards_away": conta("yellow_away") + conta("red_away"),
        "sent_off_home": conta("red_home"), "sent_off_away": conta("red_away"),
    }


def jogar(inp, politica):
    """Devolve (gols casa, gols fora, cartões casa) jogando com a política."""
    plano = simulate(copy.deepcopy(inp))
    eventos, curva, ini = list(plano["events"]), list(plano["momentum_curve"]), 1
    comandos = []

    def replan(mode, minuto_inicio, extra):
        nonlocal eventos, curva, ini
        est = estado_em(eventos, curva, ini, minuto_inicio)
        corpo = {**copy.deepcopy(inp), "mode": mode, "comandos": list(comandos), **extra}
        if mode == "second_half":
            corpo["first_half"] = est
        else:
            corpo["estado"] = est
            corpo["from_minute"] = minuto_inicio
        novo = simulate(corpo)
        eventos = [e for e in eventos if e["minute"] < minuto_inicio] + novo["events"]
        curva = curva[: max(0, minuto_inicio - ini)] + novo["momentum_curve"]

    intervalo_feito = False
    for m in range(1, 91):
        if m == 46 and not intervalo_feito:
            replan("second_half", 46, {})
            intervalo_feito = True
        h, a = placar_ate(eventos, m)
        novos = politica(m, h, a)
        if not novos:
            continue
        comandos.extend({**c, "minuto": m} for c in novos if c)
        inicio = m + 3
        # No 1º tempo nenhum replan começa depois do 45' — o do intervalo leva o comando.
        if m <= 45 and inicio > 45:
            continue
        if inicio <= 90:
            replan("from_minute", inicio, {})
    h, a = placar_ate(eventos, 91)
    cartoes = sum(1 for e in eventos if e["kind"] in ("yellow_home", "red_home"))
    return h, a, cartoes


def cada(n, cmd, desde=5):
    return lambda m, h, a: [cmd] if m >= desde and (m - desde) % n == 0 else []


POLITICAS = {
    "sem comando": lambda m, h, a: [],
    "replan vazio (20/40/60/80)": lambda m, h, a: [None] if m in (20, 40, 60, 80) else [],
    "incentivar a cada 15'": cada(15, {"tipo": "incentivar"}),
    "cobrar a cada 15'": cada(15, {"tipo": "cobrar"}),
    "acalmar a cada 15'": cada(15, {"tipo": "acalmar"}),
    "esperto (cobra perdendo, acalma ganhando)": lambda m, h, a: (
        [{"tipo": "cobrar"}] if h < a and m % 15 == 5 else [{"tipo": "acalmar"}] if h > a and m % 15 == 5 else []),
    "ordem: atacar o espaço (ATA, 10')": lambda m, h, a: [{"tipo": "ordem", "ordem": "atacar_espaco", "jogador": "home-9"}] if m == 10 else [],
    "ordem: segurar (2 ZAG, 10')": lambda m, h, a: [
        {"tipo": "ordem", "ordem": "segurar", "jogador": "home-1"}, {"tipo": "ordem", "ordem": "segurar", "jogador": "home-2"}] if m == 10 else [],
    "tudo (cobrar 15' + atacar espaço)": lambda m, h, a: (
        ([{"tipo": "ordem", "ordem": "atacar_espaco", "jogador": "home-9"}] if m == 10 else [])
        + ([{"tipo": "cobrar"}] if m >= 5 and (m - 5) % 15 == 0 else [])),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=600)
    args = ap.parse_args()
    entradas = [entrada(i) for i in range(args.n)]
    for e in entradas:
        e.pop("mode", None); e.pop("first_half", None)  # sempre a partida inteira
    res = {}
    for nome, pol in POLITICAS.items():
        v = e_ = d = gf = gs = cart = 0
        for inp in entradas:
            h, a, c = jogar(inp, pol)
            v += h > a; e_ += h == a; d += h < a; gf += h; gs += a; cart += c
        n = len(entradas)
        res[nome] = (100 * v / n, 100 * e_ / n, 100 * d / n, gf / n, gs / n, cart / n)
    base = res["sem comando"]
    print(f"{'política':44} {'vit%':>6} {'Δvit':>6} {'emp%':>6} {'der%':>6} {'GF':>5} {'GS':>5} {'cart':>5}")
    falhas = []
    for nome, (v, e_, d, gf, gs, c) in res.items():
        dv = v - base[0]
        print(f"{nome:44} {v:6.1f} {dv:+6.1f} {e_:6.1f} {d:6.1f} {gf:5.2f} {gs:5.2f} {c:5.2f}")
        if dv > 6.0:
            falhas.append(f"{nome}: +{dv:.1f} pp de vitória (teto +6)")
        if nome.startswith("replan vazio") and abs(dv) > 3.0:
            falhas.append(f"replan vazio mexe {dv:+.1f} pp (tem que ficar perto de 0)")
    if res["cobrar a cada 15'"][5] <= base[5]:
        falhas.append("cobrar não custou cartão")
    if falhas:
        print("\n✗ " + "\n✗ ".join(falhas))
        sys.exit(1)
    print("\n✓ nenhum comando vira atalho · ✓ replan não é sorteio · ✓ cobrar custa cartão")


if __name__ == "__main__":
    main()
