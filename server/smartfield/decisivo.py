"""
decisivo.py — UMA VERDADE SÓ (Partida Viva, Fase 0).

O momento decisivo e o pênalti deixam de ser resolvidos no aparelho. O motor
emite, no próprio lance, os desfechos JÁ decididos para cada opção que o
manager pode escolher; o aparelho só escolhe qual desfecho mostrar, e o
servidor recalcula o placar a partir das escolhas registradas.

Tudo aqui é determinístico pela seed e NÃO toca o fluxo de dados da
simulação (cada sorteio tem o próprio `random.Random`): a partida com ou sem
estes blocos é a mesma partida.

Regras (as mesmas que o aparelho aplicava, agora no servidor):

  MOMENTO DECISIVO — em todo gol natural, o manager escolhe entre 3 opções;
  uma delas é a leitura certa do contexto. Acertar: 82% de base; errar: 30%.
  O duelo de atributo (o nosso × o deles, por opção) dá um empurrão de até
  ±7 pontos percentuais. Atacando, "sucesso" = gol; defendendo, "sucesso" =
  gol evitado.

  PÊNALTI — a chance de gol cresce com a finalização do batedor
  (0,55 + (finalização − 50)/100 × 0,5, entre 0,50 e 0,92); cada batedor
  possível tem o próprio sorteio, então trocar o batedor muda o desfecho.
"""

import os
import random
from typing import Any, Dict, List, Optional, Tuple

# Contexto → (opção certa, quem é o rival do duelo). O texto fica no aparelho,
# por chave (PT/EN): o motor manda só a chave.
CONTEXTOS_ATAQUE: List[Tuple[str, str, str]] = [
    ("cara_a_cara", "driblar", "goleiro"),
    ("zagueiro_fechando", "tocar", "zagueiro"),
    ("sobrou_limpa", "chutar", "goleiro"),
    ("dois_marcadores", "tocar", "zagueiro"),
    ("espaco_na_entrada", "chutar", "goleiro"),
    ("companheiro_livre", "tocar", "zagueiro"),
]
CONTEXTOS_DEFESA: List[Tuple[str, str, str]] = [
    ("dispara_em_velocidade", "carrinho", "zagueiro"),
    ("protege_a_bola", "cercar", "zagueiro"),
    ("ombro_a_ombro", "combate", "zagueiro"),
    ("isolado_na_pequena_area", "carrinho", "goleiro"),
    ("tabelam_na_entrada", "cercar", "meio"),
]
OPCOES_ATAQUE = ("chutar", "driblar", "tocar")
OPCOES_DEFESA = ("cercar", "carrinho", "combate")

# Que atributo NOSSO enfrenta que atributo DELES, em cada opção.
CONFRONTO: Dict[str, Tuple[str, str]] = {
    "chutar": ("finalizacao", "marcacao"),
    "driblar": ("drible", "marcacao"),
    "tocar": ("passe", "marcacao"),
    "cercar": ("marcacao", "drible"),
    "carrinho": ("velocidade", "velocidade"),
    "combate": ("fisico", "fisico"),
}

# Calibração do momento decisivo (as mesmas bases que o aparelho usava). O estudo
# de equilíbrio (scripts/estudo-fase0-equilibrio.ts) pode testar outras bases
# por variável de ambiente sem tocar no código — a decisão de mudar é do fundador.
BASE_CERTA = float(os.environ.get("OLEFOOT_DECISIVO_CERTA", "0.82"))
BASE_ERRADA = float(os.environ.get("OLEFOOT_DECISIVO_ERRADA", "0.30"))


def _por_familia(lineup: List[Dict[str, Any]], role: str) -> Optional[Dict[str, Any]]:
    """O melhor marcador da função (gk/def/mid); sem ninguém da função, o melhor do time."""
    grupo = [p for p in lineup if p.get("role") == role] or lineup
    if not grupo:
        return None
    return max(grupo, key=lambda p: int(p.get("marcacao", 60)))


def _rival(lineup: List[Dict[str, Any]], tipo: str) -> Optional[Dict[str, Any]]:
    return _por_familia(lineup, {"goleiro": "gk", "zagueiro": "def", "meio": "mid"}[tipo])


def forca_no_duelo(nosso: int, deles: int) -> float:
    """70 (o de sempre) + a vantagem no duelo; empate = jogo de antes; teto ±7 pp."""
    return max(30.0, min(100.0, 70.0 + (nosso - deles) * 0.8))


def probabilidade(certa: bool, forca: float) -> float:
    base = BASE_CERTA if certa else BASE_ERRADA
    bonus = (forca - 60.0) / 100.0 * 0.18
    return max(0.12, min(0.95, base + bonus))


def momento_decisivo(
    seed: str,
    minute: int,
    kind: str,
    actor: Dict[str, Any],
    home_lineup: List[Dict[str, Any]],
    away_lineup: List[Dict[str, Any]],
    agentes: Optional[Dict[str, Dict[str, int]]] = None,
) -> Dict[str, Any]:
    """O bloco `decisivo` de um gol natural: contexto, duelo e o desfecho de cada opção.

    `agentes` (Fase 4, LENDA COMO AGENTE): id → quantas vezes o ATLETA de verdade
    escolheu cada opção quando assumiu os lances da lenda dele. Se o nosso jogador
    do duelo tem preferência, ela vira `auto` — o que ele faz quando o técnico não
    responde no prazo (a lenda decide como o atleta decidiria). Não mexe em
    nenhum sorteio: só em qual desfecho já calculado vale sem escolha.
    """
    ataque = kind == "goal_home"
    pool = CONTEXTOS_ATAQUE if ataque else CONTEXTOS_DEFESA
    r_ctx = random.Random(f"{seed}|decisivo|{minute}|{kind}|ctx")
    contexto, melhor, rival = pool[int(r_ctx.random() * len(pool)) % len(pool)]
    if ataque:
        nosso, deles = actor, _rival(away_lineup, rival)
    else:
        nosso, deles = _rival(home_lineup, rival), actor
    opcoes = OPCOES_ATAQUE if ataque else OPCOES_DEFESA
    por_opcao: Dict[str, List[int]] = {}
    desfechos: Dict[str, bool] = {}
    for key in opcoes:
        an, ad = CONFRONTO[key]
        n = int((nosso or {}).get(an, 60))
        d = int((deles or {}).get(ad, 60))
        por_opcao[key] = [n, d]
        p = probabilidade(key == melhor, forca_no_duelo(n, d))
        sucesso = random.Random(f"{seed}|decisivo|{minute}|{kind}|{key}").random() < p
        desfechos[key] = sucesso if ataque else (not sucesso)
    auto = preferencia_do_agente((agentes or {}).get(str((nosso or {}).get("id", ""))), opcoes)
    return {
        **({"auto": auto} if auto else {}),
        "intent": "attack" if ataque else "defend",
        "contexto": contexto,
        "melhor": melhor,
        "rival": rival,
        "duelo": {
            "nosso": {"id": (nosso or {}).get("id", ""), "nome": (nosso or {}).get("name", "")},
            "deles": {"id": (deles or {}).get("id", ""), "nome": (deles or {}).get("name", "")},
            "por_opcao": por_opcao,
        },
        # True = o gol acontece (atacando: converteu; defendendo: não segurou).
        "opcoes": desfechos,
    }


def preferencia_do_agente(contagem: Optional[Dict[str, Any]], opcoes: Tuple[str, ...]) -> Optional[str]:
    """A opção mais escolhida pelo atleta entre as deste momento (mínimo 2 escolhas; empate = nenhuma)."""
    if not isinstance(contagem, dict):
        return None
    votos = sorted(((int(contagem.get(k, 0) or 0), k) for k in opcoes), reverse=True)
    if not votos or votos[0][0] < 2 or (len(votos) > 1 and votos[0][0] == votos[1][0]):
        return None
    return votos[0][1]


def chance_de_penalti(finalizacao: int) -> float:
    return max(0.5, min(0.92, 0.55 + (int(finalizacao) - 50) / 100.0 * 0.5))


def cobranca(seed: str, minute: int, batedor: Dict[str, Any]) -> bool:
    """Um batedor, um sorteio próprio: trocar o batedor troca o desfecho."""
    r = random.Random(f"{seed}|pen|{minute}|{batedor.get('id', '')}")
    return r.random() < chance_de_penalti(batedor.get("finalizacao", 60))


def penalti_da_casa(seed: str, minute: int, sugerido: Dict[str, Any], candidatos: List[Dict[str, Any]]) -> Dict[str, Any]:
    """O bloco `penalti` do pênalti da casa: o desfecho por batedor possível (11 + banco)."""
    por_batedor: Dict[str, bool] = {}
    for p in candidatos:
        pid = p.get("id")
        if isinstance(pid, str) and pid and pid not in por_batedor:
            por_batedor[pid] = cobranca(seed, minute, p)
    if sugerido.get("id") not in por_batedor:
        por_batedor[sugerido["id"]] = cobranca(seed, minute, sugerido)
    return {"batedor": sugerido["id"], "por_batedor": por_batedor}


def penalti_de_fora(seed: str, minute: int, batedor: Dict[str, Any]) -> Dict[str, Any]:
    """O pênalti do adversário: o motor decide (o manager não escolhe nada)."""
    return {"batedor": batedor.get("id", ""), "gol": cobranca(seed, minute, batedor)}
