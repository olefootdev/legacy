"""
cadeia_lances.py — PARTIDA VIVA, Fase 2 (docs/PARTIDA-VIVA-PLANO.md §4.1).

Conta COMO aconteceu cada lance que o simulador JÁ decidiu: quem tocou pra
quem, quem driblou quem, quem roubou, quem cruzou, quem finalizou.

Regras de ouro:
- RNG PRÓPRIO (seed + ":cadeia"), chamado DEPOIS de todos os eventos prontos.
  Nada aqui mexe no placar, no autor, no xG ou no texto do evento. O teste
  `test_cadeia_lances.py` prova isso em 1.000 seeds.
- A cadeia termina no AUTOR do evento e, num gol, o último passe sai de quem o
  simulador conta como assistência (`assist_id`).
- Só joga quem está em campo naquele minuto (expulsões respeitadas).
- Coordenadas em METROS, no referencial do campo: x 0–105 (gol da casa → gol
  visitante), z 0–68. A casa ataca para +x. O cliente desenha direto.

Cada ação: {"t": tipo, "de": id, "para": id|None, "x": m, "z": m}
  t ∈ passe | lancamento | cruzamento | conducao | drible | desarme | falta |
      desvio | escanteio | cobranca | chute | cabeceio
  (`falta` e `desvio` são do time que DEFENDE; `drible`/`desarme` apontam o rival em `para`.)
  (x, z) = onde a bola termina a ação (ou até onde o jogador conduz).
Cadeia: {"inicio": {"x","z"}, "acoes": [...], "finalizacao": "chute"|"cabeceio"|"cobranca"|None}
"""

import random
from typing import Any, Dict, List, Optional, Set, Tuple

C = 105.0
L = 68.0
# Lances que ganham cadeia (o resto é narrativa, cartão, lesão…).
COM_CADEIA = {"goal", "shot", "chance", "save", "woodwork", "counter", "corner", "buildup", "penalty"}
FINALIZA = {"goal", "shot", "chance", "save", "woodwork", "penalty"}


def _attr(p: Dict[str, Any], k: str, padrao: int = 60) -> float:
    v = p.get(k)
    return float(v) if isinstance(v, (int, float)) else float(padrao)


class _Lado:
    """Converte (profundidade 0–1 rumo ao gol adversário, corredor) em metros absolutos."""

    def __init__(self, lado: str):
        self.casa = lado == "home"

    def ponto(self, prof: float, z_rel: float) -> Tuple[float, float]:
        """z_rel: 0 = esquerda do atacante, 1 = direita."""
        x = prof * C if self.casa else (1 - prof) * C
        z = z_rel * L if self.casa else (1 - z_rel) * L
        return round(max(0.5, min(C - 0.5, x)), 1), round(max(0.5, min(L - 0.5, z)), 1)


def _sorteia(rng: random.Random, opcoes: List[Dict[str, Any]], peso) -> Optional[Dict[str, Any]]:
    if not opcoes:
        return None
    pesos = [max(0.01, peso(p)) for p in opcoes]
    r = rng.random() * sum(pesos)
    acc = 0.0
    for p, w in zip(opcoes, pesos):
        acc += w
        if acc >= r:
            return p
    return opcoes[-1]


def _por_funcao(time: List[Dict[str, Any]], funcoes: Tuple[str, ...], fora: Set[str]) -> List[Dict[str, Any]]:
    return [p for p in time if p.get("role") in funcoes and p["id"] not in fora]


def _corredor_z(canal: str, rng: random.Random) -> float:
    if canal == "corredor_esquerdo":
        return 0.14 + rng.random() * 0.06
    if canal == "corredor_direito":
        return 0.80 + rng.random() * 0.06
    return 0.42 + rng.random() * 0.16


def montar_cadeia(ev: Dict[str, Any], time: List[Dict[str, Any]], rival: List[Dict[str, Any]],
                  rng: random.Random) -> Optional[Dict[str, Any]]:
    base = ev["kind"].rsplit("_", 1)[0]
    if base not in COM_CADEIA or not time:
        return None
    lado = _Lado(ev["actor_side"])
    autor = next((p for p in time if p["id"] == ev.get("actor_id")), None)
    if autor is None:
        return None
    canal = ev.get("channel") or "ataque_central"
    zona = ev.get("zone") or "att"
    finaliza = base in FINALIZA
    assist = None
    if base == "goal" and ev.get("assist_id") and ev["assist_id"] != autor["id"]:
        assist = next((p for p in time if p["id"] == ev["assist_id"]), None)

    acoes: List[Dict[str, Any]] = []
    usados = {autor["id"]} | ({assist["id"]} if assist else set())

    def a(t: str, de: Dict[str, Any], para: Optional[Dict[str, Any]], prof: float, zr: float) -> None:
        x, z = lado.ponto(prof, zr)
        acoes.append({"t": t, "de": de["id"], "para": para["id"] if para else None, "x": x, "z": z})

    def colega(funcoes: Tuple[str, ...], attr: str) -> Dict[str, Any]:
        escolhido = _sorteia(rng, _por_funcao(time, funcoes, usados), lambda p: _attr(p, attr) ** 2)
        if escolhido is None:
            escolhido = _sorteia(rng, [p for p in time if p["id"] not in usados and p.get("role") != "gk"] or time,
                                 lambda p: _attr(p, attr))
        usados.add(escolhido["id"])
        return escolhido

    def marcador() -> Optional[Dict[str, Any]]:
        return _sorteia(rng, _por_funcao(rival, ("def",), set()) or [p for p in rival if p.get("role") != "gk"],
                        lambda p: _attr(p, "marcacao"))

    prof_fim = 0.86 + rng.random() * 0.05 if zona == "att" else (0.70 + rng.random() * 0.06 if zona == "mid" else 0.55)
    z_fim = 0.40 + rng.random() * 0.20

    # ── PÊNALTI: alguém sofre a falta na área, o autor cobra ───────────────────
    if base == "penalty":
        sofre = autor if rng.random() < 0.5 else colega(("attack", "mid"), "drible")
        zag = marcador()
        inicio = lado.ponto(0.78, z_fim)
        a("conducao", sofre, None, 0.86, z_fim)
        if zag:
            a("falta", zag, sofre, 0.87, z_fim)
        a("cobranca", autor, None, 1.0, 0.5)
        return {"inicio": {"x": inicio[0], "z": inicio[1]}, "acoes": acoes, "finalizacao": "cobranca"}

    # ── BOLA PARADA: escanteio do especialista, cabeceio de quem sobe melhor ──
    if canal == "bola_parada" or base == "corner":
        cobrador = assist or _sorteia(rng, [p for p in time if p["id"] != autor["id"] and p.get("role") != "gk"],
                                      lambda p: _attr(p, "bola_parada", 55) ** 3) or autor
        usados.add(cobrador["id"])
        zr_canto = 0.0 if rng.random() < 0.5 else 1.0
        # O escanteio nasce de uma jogada: o ponta leva, cruza, a zaga desvia pra fora.
        ponta = _sorteia(rng, [p for p in time if p.get("role") in ("attack", "mid") and p["id"] not in usados] or [cobrador],
                         lambda p: _attr(p, "drible"))
        zr_lado = (0.08 + rng.random() * 0.1) if zr_canto == 0.0 else (0.82 + rng.random() * 0.1)
        inicio = lado.ponto(0.60 + rng.random() * 0.1, zr_lado)
        a("conducao", ponta, None, 0.78 + rng.random() * 0.08, zr_lado)
        a("cruzamento", ponta, None, 0.88 + rng.random() * 0.05, 0.5 + (zr_lado - 0.5) * (0.3 + rng.random() * 0.4))
        zag = marcador()
        if zag:
            a("desvio", zag, None, 1.0, zr_canto)
        if base == "corner" and not finaliza:
            a("escanteio", cobrador, autor, 0.90, 0.45 + rng.random() * 0.1)
            return {"inicio": {"x": inicio[0], "z": inicio[1]}, "acoes": acoes, "finalizacao": None}
        a("escanteio", cobrador, autor, 0.91, z_fim)
        cabeca = _attr(autor, "cabeceio", 55) >= 58 or rng.random() < 0.4
        fim = "cabeceio" if cabeca else "chute"
        a(fim, autor, None, 1.0, 0.5)
        return {"inicio": {"x": inicio[0], "z": inicio[1]}, "acoes": acoes, "finalizacao": fim}

    # ── CONSTRUÇÃO: começa atrás e sobe ───────────────────────────────────────
    contra = base == "counter" or canal in ("finalizacao_vs_gk", "pressao")
    if canal == "pressao" or (contra and rng.random() < 0.5):
        # Roubada alta: alguém do time desarma o portador adversário.
        vitima = _sorteia(rng, [p for p in rival if p.get("role") in ("def", "mid")] or rival, lambda p: 1.0)
        ladrao = colega(("mid", "attack"), "marcacao") if canal == "pressao" else colega(("def", "mid"), "marcacao")
        prof_rb = 0.62 if canal == "pressao" else 0.36
        zr_rb = _corredor_z(canal, rng)
        inicio = lado.ponto(prof_rb - 0.03, zr_rb)
        a("desarme", ladrao, vitima, prof_rb, zr_rb)
        portador = ladrao
    else:
        portador = colega(("def",), "passe") if zona != "att" or rng.random() < 0.4 else colega(("mid",), "passe")
        prof0 = 0.30 if portador.get("role") == "def" else 0.46
        zr0 = 0.3 + rng.random() * 0.4
        inicio = lado.ponto(prof0, zr0)

    lateral = canal in ("corredor_esquerdo", "corredor_direito")
    zr_corredor = _corredor_z(canal, rng)

    if lateral:
        # Bola no corredor → o ponta encara → cruza (ou corta pra dentro, pelo pé bom).
        ponta = assist or colega(("attack", "mid"), "drible")
        if ponta["id"] != portador["id"]:
            a("passe" if not contra else "lancamento", portador, ponta, 0.62, zr_corredor)
        zag = marcador()
        if zag and _attr(ponta, "drible") >= 55 + rng.random() * 20:
            a("drible", ponta, zag, 0.78, zr_corredor)
        else:
            a("conducao", ponta, None, 0.76, zr_corredor)
        pe = ponta.get("pe")
        corta = (pe == "right" and canal == "corredor_esquerdo") or (pe == "left" and canal == "corredor_direito")
        if ponta["id"] == autor["id"]:
            a("conducao", autor, None, prof_fim, 0.5 + (zr_corredor - 0.5) * 0.4)
        elif corta and rng.random() < 0.6:
            a("conducao", ponta, None, 0.84, 0.5 + (zr_corredor - 0.5) * 0.5)
            a("passe", ponta, autor, prof_fim, z_fim)
        else:
            a("cruzamento", ponta, autor, prof_fim + 0.02, z_fim)
    else:
        # Pelo meio: armador acha o autor entre as linhas / nas costas.
        armador = assist or (colega(("mid",), "passe") if rng.random() < 0.8 else None)
        if armador and armador["id"] != portador["id"]:
            a("lancamento" if contra else "passe", portador, armador, 0.56 if not contra else 0.62, 0.5 + (rng.random() - 0.5) * 0.3)
        quem = armador or portador
        if quem["id"] != autor["id"]:
            a("lancamento" if contra else "passe", quem, autor, prof_fim - 0.06, z_fim)
        zag = marcador()
        if zag and _attr(autor, "drible") >= 62 and rng.random() < 0.55:
            a("drible", autor, zag, prof_fim, z_fim)
        else:
            a("conducao", autor, None, prof_fim, z_fim)

    fim = None
    if finaliza:
        cruzou = acoes and acoes[-1]["t"] == "cruzamento"
        fim = "cabeceio" if cruzou and (_attr(autor, "cabeceio", 55) >= 58 or rng.random() < 0.5) else "chute"
        a(fim, autor, None, 1.0, 0.5)
    return {"inicio": {"x": inicio[0], "z": inicio[1]}, "acoes": acoes[:7], "finalizacao": fim}


# ── SKILLS COM NOME (Partida Viva, Fase 10) ──────────────────────────────────
# Depois da jogada montada, cada ação ganha (ou não) o NOME de uma skill — só
# quando o jogador TEM o atributo pra ela. Drible de quem tem drible 85 pode ser
# um elástico; o de quem tem 60 é só um drible. Sem rng: a escolha entre
# variações usa o minuto e a posição da ação, então nenhuma cadeia e nenhum
# placar mudam. O nome vai como CÓDIGO; o celular escreve no idioma do jogo.

def _distancia_ao_gol(lado_casa: bool, x: float) -> float:
    return (C - x) if lado_casa else x


def _skill(ac: Dict[str, Any], i: int, acoes: List[Dict[str, Any]], ev: Dict[str, Any],
           por_id: Dict[str, Dict[str, Any]]) -> Optional[Tuple[str, int]]:
    """(código, nota do atributo que justifica) ou None."""
    p = por_id.get(ac["de"])
    if not p:
        return None
    t = ac["t"]
    casa = ev.get("actor_side") == "home"
    variar = (int(ev.get("minute", 0)) * 7 + i * 3)
    anterior = acoes[i - 1] if i > 0 else None
    seguinte = acoes[i + 1] if i + 1 < len(acoes) else None
    at = lambda k, d=60: int(_attr(p, k, d))  # noqa: E731

    if t == "drible":
        if at("drible") >= 85 and at("velocidade") >= 80:
            return "arrancada", at("drible")
        if at("drible") >= 82:
            return ("elastico", "caneta", "chapeu")[variar % 3], at("drible")
        if at("drible") >= 78:
            return "corte_seco", at("drible")
    elif t == "conducao":
        corrida = abs(ac["x"] - anterior["x"]) if anterior else 0.0
        if at("velocidade") >= 85 and corrida >= 15:
            return "disparada", at("velocidade")
    elif t in ("passe", "lancamento"):
        dentro = _distancia_ao_gol(casa, ac["x"]) <= 18
        if seguinte and seguinte["t"] in ("chute", "cabeceio") and seguinte["de"] == ac["para"] and at("passe") >= 84:
            return "passe_milimetrico", at("passe")
        if t == "lancamento" and at("passe") >= 80:
            return "lancamento_longo", at("passe")
        if dentro and at("passe") >= 80:
            return "enfiada", at("passe")
    elif t == "cruzamento":
        nota = max(at("passe") - 4, at("bola_parada", 55))
        if nota >= 84:
            return "cruzamento_medida", nota
    elif t == "chute":
        de_onde = _distancia_ao_gol(casa, anterior["x"]) if anterior else 12.0
        de_fora = de_onde >= 20 or ev.get("zone") == "mid"
        if de_fora and at("finalizacao") >= 78 and at("fisico") >= 70:
            return "bomba", at("finalizacao")
        if float(ev.get("xg") or 0) >= 0.38 and at("drible") >= 80 and at("finalizacao") >= 80:
            return "cavadinha", at("finalizacao")
        if anterior and anterior["t"] in ("cruzamento", "passe") and anterior.get("para") == ac["de"] and at("finalizacao") >= 80:
            return "de_primeira", at("finalizacao")
        if at("finalizacao") >= 86:
            return "chute_colocado", at("finalizacao")
    elif t == "cabeceio":
        if at("cabeceio", 55) >= 82:
            return "cabecada_contrape", at("cabeceio", 55)
        if at("fisico") >= 85:
            return "testada", at("fisico")
    elif t == "desarme":
        if at("marcacao") >= 82:
            return "desarme_limpo", at("marcacao")
    elif t == "escanteio":
        if at("bola_parada", 55) >= 86:
            return "cobranca_perfeita", at("bola_parada", 55)
    elif t == "cobranca":
        if at("penalti", 55) >= 82:
            return "cobranca_fria", at("penalti", 55)
    return None


def nomear_skills(cadeia: Dict[str, Any], ev: Dict[str, Any], jogadores: List[Dict[str, Any]]) -> None:
    """Escreve `skill` + `skill_nota` nas ações que merecem (in place)."""
    por_id = {p["id"]: p for p in jogadores}
    acoes = cadeia.get("acoes") or []
    for i, ac in enumerate(acoes):
        achou = _skill(ac, i, acoes, ev, por_id)
        if achou:
            ac["skill"], ac["skill_nota"] = achou


def anexar_cadeias(events: List[Dict[str, Any]], home: List[Dict[str, Any]], away: List[Dict[str, Any]],
                   seed: str, mode: str) -> None:
    """Escreve `cadeia` nos eventos (in place). RNG próprio — não toca no resto do plano."""
    rng = random.Random(f"{seed}:cadeia:{mode}")
    fora: Dict[str, Set[str]] = {"home": set(), "away": set()}
    for ev in events:
        k = ev.get("kind", "")
        if k.startswith("red_") and ev.get("actor_id"):
            fora["home" if k.endswith("_home") else "away"].add(ev["actor_id"])
            continue
        lado = ev.get("actor_side")
        if lado not in ("home", "away"):
            continue
        time = [p for p in (home if lado == "home" else away) if p["id"] not in fora[lado]]
        rival = [p for p in (away if lado == "home" else home) if p["id"] not in fora["away" if lado == "home" else "home"]]
        cadeia = montar_cadeia(ev, time, rival, rng)
        if cadeia:
            nomear_skills(cadeia, ev, time + rival)
            ev["cadeia"] = cadeia
