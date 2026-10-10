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
# Voláteis + metadado novo (Fase 4b) que o simulador antigo não tem.
VOLATEIS = ("generated_at_ms", "duration_ms", "comandos_aplicados")


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

    # LEGACY (Fase 4c): quem entrou do banco não paga o fôlego dos minutos sentado.
    from match_simulator import fadiga_ate_o_replan
    xi = [{"id": f"j{k}", "fatigue": 10.0, "entrou_em": None} for k in range(11)]
    xi[9]["entrou_em"] = 70
    fadiga_ate_o_replan(xi, 0.5, 46, 80)
    if not (xi[0]["fatigue"] == 10 + 0.5 * 34 and xi[9]["fatigue"] == 10 + 0.5 * 10):
        falhas.append(f"fôlego de quem entrou do banco errado: {xi[0]['fatigue']} / {xi[9]['fatigue']}")
    trapaca = [{"id": f"t{k}", "fatigue": 0.0, "entrou_em": 79} for k in range(11)]
    fadiga_ate_o_replan(trapaca, 1.0, 46, 80)
    if sum(1 for j in trapaca if j["fatigue"] < 2) > 5:
        falhas.append("mais de 5 'entraram do banco' foram aceitos")

    # SKILLS COM NOME: só onde cabe, só com atributo, numa frequência que não vira enfeite.
    TIPO_DA_SKILL = {
        "drible": {"arrancada", "elastico", "caneta", "chapeu", "corte_seco"}, "conducao": {"disparada"},
        "passe": {"passe_milimetrico", "enfiada"}, "lancamento": {"lancamento_longo", "passe_milimetrico", "enfiada"},
        "cruzamento": {"cruzamento_medida"}, "chute": {"bomba", "cavadinha", "de_primeira", "chute_colocado"},
        "cabeceio": {"cabecada_contrape", "testada"}, "desarme": {"desarme_limpo"},
        "escanteio": {"cobranca_perfeita"}, "cobranca": {"cobranca_fria"},
    }
    n_acoes = n_skills = 0
    for i in range(min(args.n, 150)):
        for e in simulate(entrada(i))["events"]:
            for ac in (e.get("cadeia") or {}).get("acoes", []):
                n_acoes += 1
                sk = ac.get("skill")
                if not sk:
                    continue
                n_skills += 1
                if sk not in TIPO_DA_SKILL.get(ac["t"], set()):
                    falhas.append(f"seed {i}: skill '{sk}' numa ação '{ac['t']}'")
                if int(ac.get("skill_nota", 0)) < 78:
                    falhas.append(f"seed {i}: skill '{sk}' com nota {ac.get('skill_nota')} (sem atributo pra ela)")
    taxa = 100 * n_skills / max(1, n_acoes)
    if not 4 <= taxa <= 22:
        falhas.append(f"skills em {taxa:.1f}% das ações (faixa 4–22%)")
    fraco = entrada(7)
    for t in ("home_team", "away_team"):
        for p in fraco[t]["lineup"]:
            for k in ("finalizacao", "passe", "marcacao", "velocidade", "fisico", "drible", "cabeceio", "bola_parada", "penalti"):
                p[k] = 62
    fracos = sum(1 for e in simulate(fraco)["events"] for ac in (e.get("cadeia") or {}).get("acoes", []) if ac.get("skill"))
    if fracos:
        falhas.append(f"time de atributos 62 fez {fracos} skill(s) — skill tem de exigir atributo")
    print(f"skills com nome: {n_skills}/{n_acoes} ações ({taxa:.1f}%) · time fraco: {fracos}")

    # NARRAÇÃO EM INGLÊS: a mesma partida, só o texto muda (e o português fica igual).
    TEXTO = {"text", "reason", "label"}
    def sem_texto(v):
        if isinstance(v, dict):
            return {k: sem_texto(x) for k, x in v.items() if k not in TEXTO and k not in VOLATEIS}
        if isinstance(v, list):
            return [sem_texto(x) for x in v]
        return v
    ingles_ok = 0
    for i in range(min(args.n, 120)):
        e = entrada(i)
        pt, en = simulate(copy.deepcopy(e)), simulate({**copy.deepcopy(e), "lang": "en"})
        b_pt = [{**b, "insight": {k: v for k, v in b["insight"].items() if k != "text"}} for b in pt.get("analyst_beats", [])]
        b_en = [{**b, "insight": {k: v for k, v in b["insight"].items() if k != "text"}} for b in en.get("analyst_beats", [])]
        mesmo = sem_texto({**pt, "analyst_beats": b_pt}) == sem_texto({**en, "analyst_beats": b_en})
        textos_en = " ".join(ev.get("text", "") for ev in en["events"])
        if not mesmo:
            falhas.append(f"seed {i}: em inglês a partida mudou (não só o texto)")
        elif any(w in textos_en for w in (" pra ", "Adversário", "goleiro", "GOL!")):
            falhas.append(f"seed {i}: sobrou português na narração em inglês")
        else:
            ingles_ok += 1
    print(f"narração em inglês: {ingles_ok}/{min(args.n, 120)} partidas idênticas, só o texto traduzido")

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
