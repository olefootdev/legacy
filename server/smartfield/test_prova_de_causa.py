#!/usr/bin/env python3
"""
PROVA DE CAUSA (Partida Viva, Fase 3) — o portão.   python3 server/smartfield/test_prova_de_causa.py --n 300

docs/MOTOR-DE-POSSES.md §7, risco 3 ("Prova de Causa que não prova"):
  1. CAUSA NULA: um comando que não faz nada (ordem pra quem não está em campo)
     dá janelas IDÊNTICAS com e sem ele — em 100% dos pares.
  2. MARCAR O 10: "marcar de perto" com alvo derruba o envolvimento do alvo nas
     10 posses (toques do rival marcado), em média, e mais desarmes do marcador.
  3. A divergência só começa no início do replan (nunca antes).
  4. Determinismo: a mesma prova duas vezes é igual.
  5. Custo: a prova (2 simulações) cabe no tempo de um replan.
"""
import argparse
import copy
import os
import statistics
import sys
import time

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from match_simulator import simulate  # noqa: E402
from test_cadeia_lances import entrada  # noqa: E402


def estado_em(plano, minuto):
    ev = [e for e in plano["events"] if e["minute"] < minuto]
    conta = lambda k: sum(1 for e in ev if e["kind"] == k)  # noqa: E731
    return {"home_score": conta("goal_home") + conta("penalty_home"), "away_score": conta("goal_away") + conta("penalty_away"),
            "momentum_end": plano["momentum_curve"][minuto - 2], "cards_home": conta("yellow_home"), "cards_away": conta("yellow_away"),
            "sent_off_home": conta("red_home"), "sent_off_away": conta("red_away"),
            "expulsos": [e["actor_id"] for e in ev if e["kind"].startswith("red_")],
            "amarelados": [e["actor_id"] for e in ev if e["kind"].startswith("yellow_")]}


def pedido(i, comando, causa, minuto=20):
    inp = entrada(i)
    inp.pop("mode", None)
    inp.pop("first_half", None)
    full = simulate(copy.deepcopy(inp))
    ini = minuto + 3
    return {**inp, "mode": "from_minute", "from_minute": ini, "estado": estado_em(full, ini),
            "comandos": [{"minuto": minuto, **comando}], "prova_de_causa": causa}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=300)
    n = ap.parse_args().n
    falhas = []

    # 1) causa nula
    nulas = 0
    for i in range(n):
        p = simulate(pedido(i, {"tipo": "ordem", "ordem": "segurar", "jogador": "ninguem-em-campo"}, {"tipo": "comando", "jogador": "ninguem-em-campo"}))
        pr = p.get("prova")
        if pr and not pr["so_com"] and not pr["so_sem"] and pr["divergiu_em"] is None and pr["com"] == pr["sem"]:
            nulas += 1
    if nulas != n:
        falhas.append(f"causa nula: só {nulas}/{n} janelas idênticas")
    print(f"1) causa nula: {nulas}/{n} janelas idênticas com e sem um comando que não faz nada")

    # 2) marcar o 10
    toques_com, toques_sem, desarmes_com, desarmes_sem, antes, tempos = [], [], [], [], 0, []
    for i in range(n):
        inp = entrada(i)
        alvo = max((p for p in inp["away_team"]["lineup"] if p["role"] == "attack"), key=lambda p: p["finalizacao"])["id"]
        marcador = "home-1"  # um zagueiro
        cmd = {"tipo": "ordem", "ordem": "marcar", "jogador": marcador, "alvo": alvo}
        req = pedido(i, cmd, {"tipo": "comando", "jogador": marcador, "alvo": alvo})
        t0 = time.process_time()
        p = simulate(req)
        tempos.append((time.process_time() - t0) * 1000)
        pr = p["prova"]
        toques_com.append(pr["com"]["por_jogador"][alvo]["toques"])
        toques_sem.append(pr["sem"]["por_jogador"][alvo]["toques"])
        desarmes_com.append(pr["com"]["por_jogador"][marcador].get("desarme", 0))
        desarmes_sem.append(pr["sem"]["por_jogador"][marcador].get("desarme", 0))
        if pr["divergiu_em"] is not None and pr["divergiu_em"] < pr["janela"][0]:
            antes += 1
        if i < 20 and simulate(copy.deepcopy(req))["prova"] != pr:
            falhas.append(f"seed {i}: a mesma prova saiu diferente (determinismo)")
    mc, ms = statistics.mean(toques_com), statistics.mean(toques_sem)
    dc, ds = statistics.mean(desarmes_com), statistics.mean(desarmes_sem)
    queda = 100 * (ms - mc) / max(0.01, ms)
    print(f"2) marcar o 10: toques do alvo em 10 posses {ms:.2f} → {mc:.2f} ({queda:.0f}% a menos) · desarmes do marcador {ds:.2f} → {dc:.2f}")
    if queda < 15:
        falhas.append(f"marcar o 10 tirou só {queda:.0f}% dos toques do alvo (mínimo 15%)")
    if dc <= ds:
        falhas.append("o marcador não desarmou mais com a ordem")
    print(f"3) divergência antes do replan: {antes}")
    if antes:
        falhas.append(f"{antes} provas divergiram antes do início do replan")
    tempos.sort()
    p95 = tempos[int(len(tempos) * 0.95)]
    print(f"5) replan com prova: p95 {p95:.1f} ms de CPU")
    if p95 > 60:
        falhas.append(f"replan com prova lento: p95 {p95:.1f} ms (teto 60)")

    if falhas:
        print("\n✗ " + "\n✗ ".join(falhas))
        sys.exit(1)
    print("\n✓ a prova de causa prova: nula é nula, marcar tira o alvo do jogo, sem divergência antes, determinística")


if __name__ == "__main__":
    main()
