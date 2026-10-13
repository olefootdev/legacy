#!/usr/bin/env python3
"""
O FILME COMO ARENA (Partida Viva, Fase 4) — o portão.   python3 server/smartfield/test_arena.py --n 300

  1. BANCO CALADO: assumir sem dar ordem nenhuma dá `voce` IDÊNTICO a `parado`
     (mesmos lances, mesmas jogadas) — em 100% das partidas.
  2. MESMOS DADOS: com ordens, `voce` e `parado` nunca divergem antes do minuto
     assumido, e nada do plano começa antes dele.
  3. A HERANÇA: as ordens do dono antes do minuto continuam valendo (o estilo
     dele no 30' muda o jogo do 60' em diante em parte das partidas); as do
     dono DEPOIS do minuto não entram.
  4. ORDEM PESA: um conjunto fixo de ordens muda o jogo (chutes da casa) em
     média — não é enfeite.
  5. DETERMINISMO: a mesma arena duas vezes é igual.
  6. LENDA COMO AGENTE: com as escolhas do atleta, o momento decisivo do
     jogador dele ganha `auto` = a opção mais escolhida; nenhum desfecho muda
     (as mesmas opções, os mesmos sorteios) — só qual vale sem resposta.
  7. CUSTO: a arena (2 simulações) cabe no tempo de um replan.
"""
import argparse
import copy
import os
import statistics
import sys
import time

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from arena import assumir  # noqa: E402
from match_simulator import simulate  # noqa: E402
from test_cadeia_lances import entrada  # noqa: E402
from test_prova_de_causa import estado_em  # noqa: E402


def base(i):
    inp = entrada(i)
    inp.pop("mode", None)
    inp.pop("first_half", None)
    return inp


def pedido(i, minuto, minhas, dele=None):
    inp = base(i)
    full = simulate(copy.deepcopy(inp))
    return {**inp, "comandos": dele or [], "arena": {"minuto": minuto, "estado": estado_em(full, minuto), "comandos": minhas}}


def sem_relogio(r):
    """A arena sem os carimbos de tempo do plano (generated_at_ms, duration_ms)."""
    return {**r, "voce": {k: v for k, v in r["voce"].items() if k not in ("generated_at_ms", "duration_ms")}}


def chave(e):
    return (e["minute"], e["kind"], e.get("actor_id"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=300)
    n = ap.parse_args().n
    falhas = []

    # 1) banco calado
    iguais = 0
    for i in range(n):
        r = assumir(pedido(i, 40 + i % 40, []))
        if [chave(e) for e in r["voce"]["events"]] == [chave(e) for e in r["parado"]["events"]] and r["prova"]["divergiu_em"] is None:
            iguais += 1
    print(f"1) banco calado: {iguais}/{n} arenas idênticas a ficar parado")
    if iguais != n:
        falhas.append(f"banco calado: só {iguais}/{n} iguais")

    # 2) + 4) + 5) + 7)
    ordens = lambda m: [{"minuto": m, "tipo": "estilo", "estilo": "attack"}, {"minuto": m, "tipo": "cobrar"}]  # noqa: E731
    antes, cedo, chutes_v, chutes_p, tempos, mudou = 0, 0, [], [], [], 0
    for i in range(n):
        m = 30 + i % 50
        req = pedido(i, m, ordens(m))
        t0 = time.process_time()
        r = assumir(req)
        tempos.append((time.process_time() - t0) * 1000)
        if r["prova"]["divergiu_em"] is not None and r["prova"]["divergiu_em"] < m:
            antes += 1
        if any(e["minute"] < m for e in r["voce"]["events"]) or any(j["m"] < m for j in r["voce"].get("jogadas", [])):
            cedo += 1
        conta = lambda evs: sum(1 for e in evs if e["actor_side"] == "home" and e["kind"].rsplit("_", 1)[0] in ("goal", "shot", "chance", "save", "woodwork", "penalty"))  # noqa: E731
        chutes_v.append(conta(r["voce"]["events"]))
        chutes_p.append(conta(r["parado"]["events"]))
        if [chave(e) for e in r["voce"]["events"]] != [chave(e) for e in r["parado"]["events"]]:
            mudou += 1
        if i < 20 and sem_relogio(assumir(copy.deepcopy(req))) != sem_relogio(r):
            falhas.append(f"seed {i}: a mesma arena saiu diferente (determinismo)")
    print(f"2) divergência antes do minuto assumido: {antes} · lance/jogada antes do minuto: {cedo}")
    if antes or cedo:
        falhas.append(f"arena mexeu no passado: {antes} divergências, {cedo} lances antes do minuto")
    mv, mp = statistics.mean(chutes_v), statistics.mean(chutes_p)
    print(f"4) ordens pesam: 'atacar + cobrar' muda o jogo em {100 * mudou / n:.0f}% das arenas; finalizações da casa {mp:.2f} → {mv:.2f}")
    if mudou < n * 0.5:
        falhas.append(f"ordens mudaram só {mudou}/{n} arenas")
    if mv <= mp:
        falhas.append("atacar + cobrar não aumentou as finalizações da casa")

    # 3) herança
    herdou, ignorou_depois = 0, 0
    for i in range(min(n, 200)):
        com_dele = assumir(pedido(i, 60, [], dele=[{"minuto": 30, "tipo": "estilo", "estilo": "defend"}]))
        sem_dele = assumir(pedido(i, 60, []))
        if [chave(e) for e in com_dele["voce"]["events"]] != [chave(e) for e in sem_dele["voce"]["events"]]:
            herdou += 1
        depois = assumir(pedido(i, 60, [], dele=[{"minuto": 70, "tipo": "estilo", "estilo": "attack"}]))
        if [chave(e) for e in depois["voce"]["events"]] == [chave(e) for e in sem_dele["voce"]["events"]]:
            ignorou_depois += 1
    k = min(n, 200)
    print(f"3) herança: o estilo do dono no 30' muda o jogo do 60' em {100 * herdou / k:.0f}% · ordem do dono no 70' ignorada em {ignorou_depois}/{k}")
    if herdou < k * 0.3:
        falhas.append(f"a ordem do dono antes do minuto quase não pesou ({herdou}/{k})")
    if ignorou_depois != k:
        falhas.append(f"ordem do dono depois do minuto entrou na arena ({k - ignorou_depois}/{k})")

    # 6) lenda como agente
    com_auto, mudou_desfecho, sem_voto, testados = 0, 0, 0, 0
    for i in range(n):
        inp = base(i)
        plano = simulate(copy.deepcopy(inp))
        golsc = [e for e in plano["events"] if e["kind"] == "goal_home" and e.get("decisivo")]
        if not golsc:
            continue
        g = golsc[0]
        pid = g["decisivo"]["duelo"]["nosso"]["id"]
        testados += 1
        agentes = {pid: {"driblar": 3, "chutar": 1, "tocar": 0}}
        p2 = simulate({**copy.deepcopy(inp), "agentes": agentes})
        g2 = next(e for e in p2["events"] if e["minute"] == g["minute"] and e["kind"] == "goal_home")
        if g2["decisivo"].get("auto") == "driblar":
            com_auto += 1
        if g2["decisivo"]["opcoes"] != g["decisivo"]["opcoes"] or [chave(e) for e in p2["events"]] != [chave(e) for e in plano["events"]]:
            mudou_desfecho += 1
        p3 = simulate({**copy.deepcopy(inp), "agentes": {pid: {"driblar": 1}}})
        g3 = next(e for e in p3["events"] if e["minute"] == g["minute"] and e["kind"] == "goal_home")
        if "auto" not in g3["decisivo"]:
            sem_voto += 1
    print(f"6) lenda como agente: auto = a opção do atleta em {com_auto}/{testados} · desfecho mudou em {mudou_desfecho} · 1 voto só não decide em {sem_voto}/{testados}")
    if com_auto != testados or mudou_desfecho or sem_voto != testados:
        falhas.append("lenda como agente: auto errado, desfecho mexido ou voto único decidindo")

    tempos.sort()
    p95 = tempos[int(len(tempos) * 0.95)]
    print(f"7) arena (2 simulações): p95 {p95:.1f} ms de CPU")
    if p95 > 80:
        falhas.append(f"arena lenta: p95 {p95:.1f} ms (teto 80)")

    if falhas:
        print("\n✗ " + "\n✗ ".join(falhas))
        sys.exit(1)
    print("\n✓ a arena é justa: banco calado = parado, nada antes do minuto, herança do dono, ordens pesam, determinística, lenda decide como o atleta")


if __name__ == "__main__":
    main()
