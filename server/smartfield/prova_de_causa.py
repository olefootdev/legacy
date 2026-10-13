"""
prova_de_causa.py — PROVA DE CAUSA (Partida Viva, Fase 3; docs/MOTOR-DE-POSSES.md §3).

Quando o manager dá um comando, o servidor simula as próximas 10 posses DUAS
vezes, a partir do mesmo estado e com os MESMOS dados (`seed|minuto`): com o
comando e sem ele. O que mudou entre as duas é a prova de que o comando foi
causa — não sorteio. Sai estruturado (ids e números); o aparelho escreve a
frase no idioma do jogador.

A comparação NÃO promete igualdade depois da primeira divergência (mudou uma
decisão, a ordem de consumo dos dados do minuto muda): por isso a janela é de
10 posses, não do jogo inteiro.
"""
from typing import Any, Dict, List, Optional

JANELA = 10
FINALIZACOES = ("goal", "shot", "chance", "save", "woodwork", "penalty")


def _base(kind: str) -> str:
    return kind.rsplit("_", 1)[0]


def _metricas(plano: Dict[str, Any], ini: int, fim: int, casa: set, sujeitos: List[str]) -> Dict[str, Any]:
    jog = [j for j in plano.get("jogadas", []) if ini <= j["m"] <= fim]
    ev = [e for e in plano.get("events", []) if ini <= e["minute"] <= fim]
    m: Dict[str, Any] = {
        "posses_casa": sum(1 for j in jog if j["lado"] == "h"),
        "posses": len(jog),
        "chutes_casa": sum(1 for e in ev if _base(e["kind"]) in FINALIZACOES and e["actor_side"] == "home"),
        "chutes_fora": sum(1 for e in ev if _base(e["kind"]) in FINALIZACOES and e["actor_side"] == "away"),
        "xg_casa": round(sum(e.get("xg") or 0 for e in ev if _base(e["kind"]) in FINALIZACOES and e["actor_side"] == "home"), 2),
        "xg_fora": round(sum(e.get("xg") or 0 for e in ev if _base(e["kind"]) in FINALIZACOES and e["actor_side"] == "away"), 2),
        "roubadas_casa": sum(1 for j in jog for a in j["acoes"] if a["t"] == "desarme" and a["de"] in casa),
        "faltas_casa": sum(1 for j in jog for a in j["acoes"] if a["t"] == "falta" and a["de"] in casa),
        "cartoes_casa": sum(1 for e in ev if _base(e["kind"]) in ("yellow", "red") and e["actor_side"] == "home"),
    }
    # Por sujeito (o jogador da ordem, e o rival marcado): o que ele fez e quantas bolas recebeu.
    por: Dict[str, Dict[str, int]] = {}
    for pid in sujeitos:
        acoes: Dict[str, int] = {}
        recebeu = 0
        for j in jog:
            for a in j["acoes"]:
                if a["de"] == pid:
                    acoes[a["t"]] = acoes.get(a["t"], 0) + 1
                if a.get("para") == pid and a["t"] in ("passe", "lancamento", "cruzamento", "escanteio") and a.get("ok") != 0:
                    recebeu += 1
        acoes["recebeu"] = recebeu
        # Toques que deram certo: bola jogada (ação sem falha) ou recebida.
        acoes["toques"] = sum(1 for j in jog for a in j["acoes"] if a["de"] == pid and a.get("ok") != 0
                              and a["t"] not in ("falta", "desvio")) + recebeu
        acoes["perdeu"] = sum(1 for j in jog for a in j["acoes"] if a["de"] == pid and a.get("ok") == 0)
        por[pid] = acoes
    m["por_jogador"] = por
    return m


def _momentos(plano: Dict[str, Any], ini: int, fim: int) -> List[Dict[str, Any]]:
    return [{"m": e["minute"], "k": _base(e["kind"]), "lado": e["actor_side"], "a": e.get("actor_id")}
            for e in plano.get("events", []) if ini <= e["minute"] <= fim and _base(e["kind"]) in FINALIZACOES]


def comparar(com: Dict[str, Any], sem: Dict[str, Any], ini: int, causa: Dict[str, Any], casa_ids: List[str]) -> Dict[str, Any]:
    fim = min(90, ini + JANELA - 1)
    sujeitos = [x for x in (causa.get("jogador"), causa.get("alvo")) if isinstance(x, str) and x]
    casa = set(casa_ids)
    m_com = _metricas(com, ini, fim, casa, sujeitos)
    m_sem = _metricas(sem, ini, fim, casa, sujeitos)
    mc, ms = _momentos(com, ini, fim), _momentos(sem, ini, fim)
    chave = lambda x: (x["m"], x["k"], x["lado"], x["a"])  # noqa: E731
    so_com = [x for x in mc if chave(x) not in {chave(y) for y in ms}]
    so_sem = [x for x in ms if chave(x) not in {chave(y) for y in mc}]
    divergiu_em: Optional[int] = None
    for jc, js in zip([j for j in com.get("jogadas", []) if ini <= j["m"] <= fim], [j for j in sem.get("jogadas", []) if ini <= j["m"] <= fim]):
        if jc != js:
            divergiu_em = jc["m"]
            break
    return {
        "janela": [ini, fim],
        "causa": {k: v for k, v in causa.items() if k in ("tipo", "jogador", "alvo", "ordem", "grito", "estilo")},
        "com": m_com,
        "sem": m_sem,
        "so_com": so_com[:6],
        "so_sem": so_sem[:6],
        "divergiu_em": divergiu_em,
        # MUNDO PARALELO: o que teria acontecido sem o comando (o campo pode encenar).
        "jogadas_sem": [j for j in sem.get("jogadas", []) if ini <= j["m"] <= fim],
        "eventos_sem": [e for e in sem.get("events", []) if ini <= e["minute"] <= fim],
    }


def sem_a_causa(input_data: Dict[str, Any], causa: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """O mesmo pedido sem a causa (o último comando, ou a última decisão). None = não sabe tirar."""
    tipo = causa.get("tipo")
    if tipo == "comando":
        cmds = list(input_data.get("comandos") or [])
        if not cmds:
            return None
        # O comando mais recente (maior minuto; empate: o último da lista).
        idx = max(range(len(cmds)), key=lambda i: (int((cmds[i] or {}).get("minuto", 0) or 0), i))
        return {**input_data, "comandos": cmds[:idx] + cmds[idx + 1:]}
    if tipo == "decisao":
        dec = list(input_data.get("decisions") or [])
        if not dec:
            return None
        return {**input_data, "decisions": dec[:-1]}
    return None
