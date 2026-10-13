#!/usr/bin/env python3
"""
QUANTOS GOLS NASCEM COM UM COMANDO DO MANAGER VALENDO?   python3 server/smartfield/estudo_gol_com_comando.py --n 1000

Critério do plano (docs/raio-x-partida-viva.html, "Como saber que deu certo"):
  35% a 50% dos gols com um comando do manager ativo nas 10 posses anteriores
  (nem zero — o comando não pesa —, nem tudo — o jogo vira só comando).

Como medimos (motor novo, Motor de Posses):
  - RITMO REAL: os minutos dos comandos vêm das partidas LEGACY reais em que o
    manager comandou (quick_plans_emitidos, 10–13/10/2026: 5 partidas, 17
    comandos, de 1 a 8 por partida, muitas vezes em rajada). Cada partida
    sintética usa um desses ritmos, deslocado no tempo; o tipo do comando é
    sorteado entre grito, estilo e ordem (como no dock do LEGACY).
  - A partida é jogada como no aparelho: plano inteiro, replan a cada comando
    (do minuto + 3), replan do intervalo; o estado de cada replan sai da partida
    costurada até ali. Momento decisivo sem resposta = escolha automática.
  - "Comando ativo nas 10 posses anteriores" = um comando que passou a valer
    (minuto + 3) dentro das 10 posses que antecedem o gol (uma posse por minuto).
"""
import argparse
import copy
import os
import random
import statistics
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from match_simulator import simulate  # noqa: E402
from test_cadeia_lances import entrada  # noqa: E402

# Minutos em que os managers reais comandaram (minuto do replan − 3), por partida.
RITMOS_REAIS = [[60, 65, 68], [9, 10, 11, 37, 38, 39, 42, 77], [39], [22, 31, 34], [16, 18]]
JANELA = 10
GRITOS = ["incentivar", "cobrar", "acalmar"]
ESTILOS = ["defend", "counter", "possession", "press", "attack"]


def escolha_automatica(d):
    """Espelho de escolhaAutomatica (server/src/lib/partida/placar.ts)."""
    opcoes = list(d["opcoes"].keys())
    if d.get("auto") in opcoes:
        return d["auto"]
    melhor, vant = opcoes[0], float("-inf")
    for k in opcoes:
        par = (d.get("duelo") or {}).get("por_opcao", {}).get(k)
        v = par[0] - par[1] if par else 0
        if v > vant:
            vant, melhor = v, k
    return melhor


def gol(e):
    """O gol acontece? (a porta única golDoLance, sem escolha do manager)."""
    k = e["kind"]
    if k.startswith("goal_"):
        d = e.get("decisivo")
        return True if not d or not d.get("opcoes") else bool(d["opcoes"][escolha_automatica(d)])
    if k.startswith("penalty_"):
        p = e.get("penalti") or {}
        if "gol" in p:
            return bool(p["gol"])
        tabela = p.get("por_batedor")
        return True if not tabela else bool(tabela.get(p.get("batedor"), True))
    return False


def costurar(planos):
    eventos, momento = [], [50.0] * 90
    for p in planos:
        ini = p["start_minute"] if p.get("mode") != "full" else 1
        eventos = [e for e in eventos if e["minute"] < ini] + p["events"]
        for i, v in enumerate(p.get("momentum_curve", [])):
            if ini - 1 + i < 90:
                momento[ini - 1 + i] = v
    return eventos, momento


def estado(eventos, momento, minuto):
    antes = [e for e in eventos if e["minute"] < minuto]
    conta = lambda lado: sum(1 for e in antes if e["actor_side"] == lado and gol(e))  # noqa: E731
    expulsos = [e["actor_id"] for e in antes if e["kind"].startswith("red_")]
    return {"home_score": conta("home"), "away_score": conta("away"), "momentum_end": momento[max(0, minuto - 4)],
            "cards_home": sum(1 for e in antes if e["kind"] == "yellow_home"),
            "cards_away": sum(1 for e in antes if e["kind"] == "yellow_away"),
            "sent_off_home": sum(1 for e in antes if e["kind"] == "red_home"),
            "sent_off_away": sum(1 for e in antes if e["kind"] == "red_away"),
            "expulsos": expulsos,
            "amarelados": [e["actor_id"] for e in antes if e["kind"].startswith("yellow_") and e["actor_id"] not in expulsos]}


def comandos_da_partida(i, d):
    r = random.Random(f"ritmo-{i}")
    ritmo = RITMOS_REAIS[i % len(RITMOS_REAIS)]
    desloca = r.randint(-15, 15)
    casa = d["home_team"]["lineup"]
    atacante_deles = max((p for p in d["away_team"]["lineup"] if p["role"] == "attack"), key=lambda p: p["finalizacao"])
    out = []
    for m in ritmo:
        minuto = max(2, min(86, m + desloca))
        tipo = r.choice(["grito", "estilo", "ordem"])
        if tipo == "grito":
            out.append({"minuto": minuto, "tipo": r.choice(GRITOS)})
        elif tipo == "estilo":
            out.append({"minuto": minuto, "tipo": "estilo", "estilo": r.choice(ESTILOS)})
        else:
            quem = r.choice([p for p in casa if p["role"] != "gk"])
            ordem = r.choice(["segurar", "atacar_espaco", "marcar"])
            c = {"minuto": minuto, "tipo": "ordem", "ordem": ordem, "jogador": quem["id"]}
            if ordem == "marcar":
                c["alvo"] = atacante_deles["id"]
            out.append(c)
    return sorted(out, key=lambda c: c["minuto"])


def jogar(i):
    d = entrada(i)
    d.pop("mode", None)
    d.pop("first_half", None)
    cmds = comandos_da_partida(i, d)
    planos = [simulate(copy.deepcopy(d))]
    # Replans na ordem em que o aparelho os pede: cada comando (minuto + 3) e o intervalo (46).
    pedidos = sorted([(c["minuto"] + 3, k) for k, c in enumerate(cmds) if c["minuto"] + 3 <= 90] + [(46, None)], key=lambda x: (x[0], x[1] is not None))
    for inicio, k in pedidos:
        eventos, momento = costurar(planos)
        ledger = [c for c in cmds if c["minuto"] + 3 <= inicio]
        if k is None:
            p = simulate({**copy.deepcopy(d), "mode": "second_half", "first_half": estado(eventos, momento, 46), "comandos": ledger})
        else:
            p = simulate({**copy.deepcopy(d), "mode": "from_minute", "from_minute": inicio, "estado": estado(eventos, momento, inicio), "comandos": ledger})
        planos.append(p)
    eventos, _ = costurar(planos)
    gols = [e for e in eventos if (e["kind"].startswith("goal_") or e["kind"].startswith("penalty_")) and gol(e)]
    vigencias = [c["minuto"] + 3 for c in cmds if c["minuto"] + 3 <= 90]
    com = [g for g in gols if any(g["minute"] - JANELA + 1 <= v <= g["minute"] for v in vigencias)]
    return gols, com, len(cmds)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=1000)
    n = ap.parse_args().n
    total = com = total_casa = com_casa = 0
    por_ritmo = {}
    cmds = []
    for i in range(n):
        gols, comc, k = jogar(i)
        total += len(gols)
        com += len(comc)
        total_casa += sum(1 for g in gols if g["actor_side"] == "home")
        com_casa += sum(1 for g in comc if g["actor_side"] == "home")
        cmds.append(k)
        r = por_ritmo.setdefault(k, [0, 0])
        r[0] += len(gols)
        r[1] += len(comc)
        if (i + 1) % 200 == 0:
            print(f"  … {i + 1} partidas", flush=True)
    pct = 100 * com / max(1, total)
    print(f"\n{n} partidas no ritmo real dos managers (média {statistics.mean(cmds):.1f} comandos por partida)")
    print(f"gols: {total} ({total / n:.2f} por partida) · com comando ativo nas {JANELA} posses anteriores: {com} = {pct:.1f}%")
    print(f"só gols da casa: {com_casa}/{total_casa} = {100 * com_casa / max(1, total_casa):.1f}%")
    for k in sorted(por_ritmo):
        t, c = por_ritmo[k]
        print(f"  partidas com {k} comando(s): {100 * c / max(1, t):.1f}% dos gols com comando ativo ({c}/{t})")
    alvo = "DENTRO" if 35 <= pct <= 50 else "FORA"
    print(f"\ncritério do plano (35%–50%): {alvo}")


if __name__ == "__main__":
    main()
