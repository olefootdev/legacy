#!/usr/bin/env python3
"""
O ADVERSÁRIO AUSENTE JOGA PELO PLANO SALVO (Partida Viva, Fase 4) — o portão.
    python3 server/smartfield/test_plano_salvo.py --n 1000

  1. PLANO VAZIO = partida de antes, idêntica (lances e jogadas) — 100%.
  2. A REGRA CUMPRE: cada regra dispara no máximo uma vez, nunca antes do
     `depois`, só na situação do placar DELE; a narração sai no minuto exato.
  3. O PLANO PESA: "perdendo depois dos 60' → ataque + cobrar" aumenta as
     finalizações deles do disparo em diante (contra a mesma partida sem plano).
  4. EQUILÍBRIO: com planos realistas, a vitória da casa e a média de gols
     não saem do lugar (±4 pp; 2,2–3,2 gols) — o plano é personalidade, não bônus.
  5. DETERMINISMO e CUSTO.
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
from plano_salvo import situacao  # noqa: E402
from test_cadeia_lances import entrada  # noqa: E402

ESTILOS = ["defend", "counter", "possession", "press", "attack"]
GRITOS = ["incentivar", "cobrar", "acalmar"]


def base(i):
    d = entrada(i)
    d.pop("mode", None)
    d.pop("first_half", None)
    return d


def plano_realista(i):
    """Como um manager de verdade joga: 1 a 4 decisões, em situações variadas."""
    r = random.Random(f"plano-{i}")
    regras = []
    for _ in range(r.randint(1, 4)):
        regra = {"depois": r.randint(10, 80), "quando": r.choice(["ganhando", "empatando", "perdendo", "qualquer"])}
        if r.random() < 0.7:
            regra["estilo"] = r.choice(ESTILOS)
        if r.random() < 0.5 or "estilo" not in regra:
            regra["grito"] = r.choice(GRITOS)
        regras.append(regra)
    return regras


def chave(e):
    return (e["minute"], e["kind"], e.get("actor_id"))


def gol_do_motor(e):
    """O gol como o motor conta (antes de qualquer escolha): gol natural sempre; pênalti pelo batedor sugerido."""
    if e["kind"].startswith("goal_"):
        return True
    if e["kind"].startswith("penalty_"):
        pen = e.get("penalti") or {}
        if "gol" in pen:
            return bool(pen["gol"])
        return bool((pen.get("por_batedor") or {}).get(pen.get("batedor"), True))
    return False


def placar_ate(plano, minuto):
    h = sum(1 for e in plano["events"] if e["minute"] < minuto and e["actor_side"] == "home" and gol_do_motor(e))
    a = sum(1 for e in plano["events"] if e["minute"] < minuto and e["actor_side"] == "away" and gol_do_motor(e))
    return h, a


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=1000)
    n = ap.parse_args().n
    falhas = []

    # 1) plano vazio
    iguais = 0
    for i in range(min(n, 300)):
        d = base(i)
        a = simulate(copy.deepcopy(d))
        b = simulate({**copy.deepcopy(d), "plano_fora": []})
        if [chave(e) for e in a["events"]] == [chave(e) for e in b["events"]] and a.get("jogadas") == b.get("jogadas"):
            iguais += 1
    k = min(n, 300)
    print(f"1) plano vazio: {iguais}/{k} partidas idênticas às de antes")
    if iguais != k:
        falhas.append(f"plano vazio mudou {k - iguais} partidas")

    # 2) a regra cumpre + 5) determinismo e custo
    erradas, disparos, tempos = 0, 0, []
    for i in range(min(n, 400)):
        d = base(i)
        regras = plano_realista(i)
        t0 = time.process_time()
        p = simulate({**copy.deepcopy(d), "plano_fora": regras})
        tempos.append((time.process_time() - t0) * 1000)
        narr = [e for e in p["events"] if e["kind"] == "narrative" and "plano_salvo" in e]
        vistas = []
        for e in narr:
            r = e["plano_salvo"]
            # O placar do MOTOR no começo do minuto do disparo (antes da posse dele).
            h, a = placar_ate(p, e["minute"])
            sit = situacao(a, h)
            if e["minute"] < r["depois"] or (r["quando"] != "qualquer" and r["quando"] != sit):
                erradas += 1
            vistas.append((r["depois"], r["quando"], r.get("estilo"), r.get("grito")))
        if len(vistas) != len(set(vistas)):
            erradas += 1
        disparos += len(narr)
        if i < 20:
            q = simulate({**copy.deepcopy(d), "plano_fora": regras})
            if [chave(e) for e in q["events"]] != [chave(e) for e in p["events"]]:
                falhas.append(f"seed {i}: o mesmo plano salvo deu outra partida")
    k = min(n, 400)
    print(f"2) regras: {disparos} disparos em {k} partidas · fora de hora/situação ou repetidas: {erradas}")
    if erradas:
        falhas.append(f"{erradas} disparos errados")

    # 3) o plano pesa
    antes, depois, casos = [], [], 0
    regra = [{"depois": 60, "quando": "perdendo", "estilo": "attack", "grito": "cobrar"}]
    for i in range(n):
        d = base(i)
        com = simulate({**copy.deepcopy(d), "plano_fora": regra})
        disparo = next((e["minute"] for e in com["events"] if e["kind"] == "narrative" and "plano_salvo" in e), None)
        if disparo is None:
            continue
        sem = simulate(copy.deepcopy(d))
        conta = lambda p: sum(1 for e in p["events"] if e["minute"] >= disparo and e["actor_side"] == "away"  # noqa: E731
                              and e["kind"].rsplit("_", 1)[0] in ("goal", "shot", "chance", "save", "woodwork", "penalty"))
        antes.append(conta(sem))
        depois.append(conta(com))
        casos += 1
    ma, md = statistics.mean(antes or [0]), statistics.mean(depois or [0])
    print(f"3) 'perdendo depois dos 60' → ataque + cobrar': {casos} partidas dispararam · finalizações deles dali em diante {ma:.2f} → {md:.2f}")
    if casos < n * 0.15 or md <= ma:
        falhas.append("o plano salvo não pesou (ou quase nunca disparou)")

    # 4) equilíbrio
    def bateria(com_plano):
        vit, gols = 0, []
        for i in range(n):
            d = base(i)
            if com_plano:
                d["plano_fora"] = plano_realista(i)
            p = simulate(d)
            h = sum(1 for e in p["events"] if e["kind"] in ("goal_home", "penalty_home"))
            a = sum(1 for e in p["events"] if e["kind"] in ("goal_away", "penalty_away"))
            vit += h > a
            gols.append(h + a)
        return 100 * vit / n, statistics.mean(gols)
    v0, g0 = bateria(False)
    v1, g1 = bateria(True)
    print(f"4) equilíbrio ({n} partidas): vitória da casa {v0:.1f}% → {v1:.1f}% · gols {g0:.2f} → {g1:.2f} (motor cru, antes do momento decisivo)")
    if abs(v1 - v0) > 4 or not 2.2 <= g1 <= 3.2:
        falhas.append(f"plano salvo desequilibrou: casa {v0:.1f}% → {v1:.1f}%, gols {g1:.2f}")

    tempos.sort()
    p95 = tempos[int(len(tempos) * 0.95)]
    print(f"5) custo: p95 {p95:.1f} ms de CPU por partida com plano salvo")
    if p95 > 40:
        falhas.append(f"lento: p95 {p95:.1f} ms")

    if falhas:
        print("\n✗ " + "\n✗ ".join(falhas))
        sys.exit(1)
    print("\n✓ o ausente joga pelo plano salvo: vazio = antes, regra cumpre, pesa, sem desequilibrar, determinístico")


if __name__ == "__main__":
    main()
