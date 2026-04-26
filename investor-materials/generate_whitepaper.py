"""Olefoot Investor Whitepaper generator. Marina Sousa voice."""
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.lib.colors import Color, HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak,
    Table, TableStyle, KeepTogether, Flowable,
)
from reportlab.pdfgen import canvas

# --- Palette ---
VERDE_CAMPO = HexColor("#187032")
PRETO_NOITE = HexColor("#0C0C18")
DOURADO = HexColor("#FFD700")
BRANCO = HexColor("#FFFFFF")
CINZA_TEXTO = HexColor("#333333")
CINZA_CLARO = HexColor("#F2F2F2")
VERMELHO = HexColor("#B00020")

YEAR = datetime.now().year
MONTH_TAG = datetime.now().strftime("%Y-%m")
OUT = f"/Users/jonhnes/Projects/olefootv-11/investor-materials/olefoot-whitepaper-{MONTH_TAG}.pdf"

# --- Styles ---
styles = {
    "H1": ParagraphStyle("H1", fontName="Helvetica-Bold", fontSize=22,
                         leading=26, textColor=VERDE_CAMPO, spaceAfter=10),
    "H2": ParagraphStyle("H2", fontName="Helvetica-Bold", fontSize=16,
                         leading=20, textColor=VERDE_CAMPO, spaceBefore=10, spaceAfter=8),
    "H3": ParagraphStyle("H3", fontName="Helvetica-Bold", fontSize=13,
                         leading=16, textColor=VERDE_CAMPO, spaceBefore=6, spaceAfter=4),
    "body": ParagraphStyle("body", fontName="Helvetica", fontSize=11,
                           leading=16, textColor=CINZA_TEXTO, alignment=TA_JUSTIFY, spaceAfter=8),
    "lead": ParagraphStyle("lead", fontName="Helvetica-Oblique", fontSize=12,
                           leading=17, textColor=PRETO_NOITE, spaceAfter=10),
    "pillar_title": ParagraphStyle("pt", fontName="Helvetica-Bold", fontSize=13,
                                    leading=16, textColor=VERDE_CAMPO, spaceAfter=2),
    "pillar_sub": ParagraphStyle("ps", fontName="Helvetica-Oblique", fontSize=10.5,
                                  leading=14, textColor=PRETO_NOITE, spaceAfter=6),
    "tag": ParagraphStyle("tag", fontName="Helvetica-Oblique", fontSize=9,
                          leading=12, textColor=CINZA_TEXTO),
    "cover_title": ParagraphStyle("ct", fontName="Helvetica-Bold", fontSize=58,
                                   leading=64, textColor=DOURADO, alignment=TA_CENTER),
    "cover_sub": ParagraphStyle("cs", fontName="Helvetica", fontSize=18,
                                 leading=22, textColor=BRANCO, alignment=TA_CENTER, spaceBefore=12),
    "cover_tag": ParagraphStyle("ctag", fontName="Helvetica-Bold", fontSize=10,
                                 leading=14, textColor=DOURADO, alignment=TA_CENTER, spaceBefore=30),
    "cover_date": ParagraphStyle("cdate", fontName="Helvetica", fontSize=10,
                                  leading=14, textColor=BRANCO, alignment=TA_CENTER),
}

# --- Visual Flowables ---

class SectionRule(Flowable):
    """Full-width green 1.5pt rule."""
    def __init__(self, width):
        super().__init__()
        self.width = width
    def wrap(self, aw, ah): return (self.width, 6)
    def draw(self):
        self.canv.setStrokeColor(VERDE_CAMPO)
        self.canv.setLineWidth(1.5)
        self.canv.line(0, 3, self.width, 3)

class HighlightBox(Flowable):
    """Gray bg, 3pt green left border, label + value."""
    def __init__(self, width, label, value, body):
        super().__init__()
        self.width = width
        self.label = label
        self.value = value
        self.body = body
        self.height = 70
    def wrap(self, aw, ah): return (self.width, self.height)
    def draw(self):
        c = self.canv
        c.setFillColor(CINZA_CLARO)
        c.rect(0, 0, self.width, self.height, stroke=0, fill=1)
        c.setFillColor(VERDE_CAMPO)
        c.rect(0, 0, 3, self.height, stroke=0, fill=1)
        c.setFillColor(VERDE_CAMPO)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(14, self.height - 16, self.label.upper())
        c.setFillColor(PRETO_NOITE)
        c.setFont("Helvetica-Bold", 20)
        c.drawString(14, self.height - 40, self.value)
        c.setFillColor(CINZA_TEXTO)
        c.setFont("Helvetica", 9)
        c.drawString(14, 12, self.body)

class Timeline(Flowable):
    """Horizontal timeline with labeled phases."""
    def __init__(self, width, phases):
        super().__init__()
        self.width = width
        self.phases = phases
        self.height = 80
    def wrap(self, aw, ah): return (self.width, self.height)
    def draw(self):
        c = self.canv
        y = 50
        c.setStrokeColor(VERDE_CAMPO)
        c.setLineWidth(2)
        c.line(20, y, self.width - 20, y)
        n = len(self.phases)
        step = (self.width - 40) / max(n - 1, 1)
        for i, (title, sub) in enumerate(self.phases):
            x = 20 + i * step
            c.setFillColor(DOURADO)
            c.circle(x, y, 6, stroke=0, fill=1)
            c.setFillColor(VERDE_CAMPO)
            c.setFont("Helvetica-Bold", 10)
            c.drawCentredString(x, y + 12, title)
            c.setFillColor(CINZA_TEXTO)
            c.setFont("Helvetica", 8)
            c.drawCentredString(x, y - 18, sub)

# --- Page decorations ---

def draw_cover_bg(canv, doc):
    canv.saveState()
    canv.setFillColor(PRETO_NOITE)
    canv.rect(0, 0, A4[0], A4[1], stroke=0, fill=1)
    # Gold accent line
    canv.setStrokeColor(DOURADO)
    canv.setLineWidth(2)
    canv.line(3 * cm, 4 * cm, A4[0] - 3 * cm, 4 * cm)
    # Field-green footer band
    canv.setFillColor(VERDE_CAMPO)
    canv.rect(0, 0, A4[0], 1.2 * cm, stroke=0, fill=1)
    canv.restoreState()

def draw_standard_page(canv, doc):
    canv.saveState()
    # Header bar
    canv.setFillColor(VERDE_CAMPO)
    canv.rect(0, A4[1] - 0.6 * cm, A4[0], 0.6 * cm, stroke=0, fill=1)
    # Confidential badge
    canv.setFillColor(VERMELHO)
    canv.setFont("Helvetica-Bold", 8)
    canv.drawRightString(A4[0] - 1.5 * cm, A4[1] - 1.2 * cm, "CONFIDENCIAL")
    # Footer
    canv.setFillColor(CINZA_TEXTO)
    canv.setFont("Helvetica", 8)
    canv.drawString(2.5 * cm, 1.2 * cm,
                    f"OLEFOOT © {YEAR} — Documento Confidencial")
    canv.drawRightString(A4[0] - 2.5 * cm, 1.2 * cm, f"Página {doc.page - 1}")
    # Thin green rule above footer
    canv.setStrokeColor(VERDE_CAMPO)
    canv.setLineWidth(0.5)
    canv.line(2.5 * cm, 1.5 * cm, A4[0] - 2.5 * cm, 1.5 * cm)
    canv.restoreState()

# --- Helpers ---

CONTENT_WIDTH = A4[0] - 5 * cm

def p(text, style="body"):
    return Paragraph(text, styles[style])

def pillar(icon, title, subtitle, what, how, why, moat):
    t = Table(
        [[Paragraph(f'<font size="16" color="#187032"><b>{icon}</b></font>', styles["body"]),
          Paragraph(title, styles["pillar_title"])]],
        colWidths=[1.2 * cm, CONTENT_WIDTH - 1.2 * cm]
    )
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"),
                           ("LEFTPADDING", (0, 0), (-1, -1), 0),
                           ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 2)]))
    items = [t, p(subtitle, "pillar_sub")]
    for label, body in [("O que é", what), ("Como funciona", how),
                        ("Por que importa", why), ("Diferencial competitivo", moat)]:
        items.append(p(f"<b><font color='#187032'>{label}:</font></b> {body}"))
    items.append(Spacer(1, 10))
    return KeepTogether(items)

def comp_table():
    data = [
        ["Critério", "EA FC", "Football Manager", "Olefoot"],
        ["IA embarcada na criação", "—", "—", "✓"],
        ["Sessão < 15 min com profundidade", "Parcial", "—", "✓"],
        ["Mobile-first completo", "Parcial", "—", "✓"],
        ["Profundidade estratégica", "—", "✓", "✓"],
        ["Sem pay-to-win", "—", "✓", "✓"],
        ["DNA único por jogador", "—", "Parcial", "✓"],
        ["Motor auditável / causal", "—", "—", "✓"],
        ["Custo de servidor por partida", "Alto", "N/A", "Zero"],
    ]
    t = Table(data, colWidths=[6.2 * cm, 2.6 * cm, 3.6 * cm, 3.0 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), VERDE_CAMPO),
        ("TEXTCOLOR", (0, 0), (-1, 0), BRANCO),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [BRANCO, CINZA_CLARO]),
        ("LINEBELOW", (0, 0), (-1, -1), 0.25, VERDE_CAMPO),
        ("TEXTCOLOR", (-1, 1), (-1, -1), VERDE_CAMPO),
        ("FONTNAME", (-1, 1), (-1, -1), "Helvetica-Bold"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t

# --- Build document ---

def build():
    doc = BaseDocTemplate(
        OUT, pagesize=A4,
        leftMargin=2.5 * cm, rightMargin=2.5 * cm,
        topMargin=2.2 * cm, bottomMargin=2 * cm,
        title="Olefoot Whitepaper — Investidores",
        author="Marina Sousa",
    )

    cover_frame = Frame(0, 0, A4[0], A4[1], leftPadding=2.5 * cm,
                        rightPadding=2.5 * cm, topPadding=5 * cm, bottomPadding=3 * cm,
                        id="cover")
    std_frame = Frame(doc.leftMargin, doc.bottomMargin,
                      doc.width, doc.height, id="std")

    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[cover_frame], onPage=draw_cover_bg),
        PageTemplate(id="std", frames=[std_frame], onPage=draw_standard_page),
    ])

    story = []

    # -------- CAPA --------
    story.append(Spacer(1, 3 * cm))
    story.append(Paragraph("OLEFOOT", styles["cover_title"]))
    story.append(Spacer(1, 0.6 * cm))
    story.append(Paragraph("O Futuro da Simulação Esportiva Inteligente",
                           styles["cover_sub"]))
    story.append(Spacer(1, 2 * cm))
    story.append(Paragraph("— WHITEPAPER —", styles["cover_tag"]))
    story.append(Paragraph("DOCUMENTO CONFIDENCIAL — PARA INVESTIDORES",
                           styles["cover_tag"]))
    story.append(Spacer(1, 4 * cm))
    story.append(Paragraph(
        f"{datetime.now().strftime('%B de %Y').capitalize()} &nbsp;·&nbsp; Versão 1.0",
        styles["cover_date"]))
    story.append(Paragraph("por Marina Sousa, jornalista esportiva",
                           styles["cover_date"]))
    story.append(PageBreak())

    # Switch to standard template
    from reportlab.platypus import NextPageTemplate
    # Actually, we already have two templates; the NextPageTemplate flowable
    # would be cleaner. But the order in addPageTemplates sets cover as default.
    # Insert instruction before first real content:
    story.insert(0, NextPageTemplate("cover"))  # will no-op for current page
    # After PageBreak above, we want std pages:
    story.append(NextPageTemplate("std"))
    # Need a dummy page break? No — the last PageBreak already triggered.
    # But NextPageTemplate applies to next page boundary; the PageBreak before
    # it is the cover's end. We'll place NextPageTemplate *before* the break
    # so std kicks in from page 2. Re-do ordering:
    # (Rebuild simpler below)

    # ---- Simpler approach: rebuild story cleanly ----
    story = []
    story.append(NextPageTemplate("std"))  # after first page break, use std
    story.append(Spacer(1, 3 * cm))
    story.append(Paragraph("OLEFOOT", styles["cover_title"]))
    story.append(Spacer(1, 0.6 * cm))
    story.append(Paragraph("O Futuro da Simulação Esportiva Inteligente",
                           styles["cover_sub"]))
    story.append(Spacer(1, 2 * cm))
    story.append(Paragraph("— WHITEPAPER —", styles["cover_tag"]))
    story.append(Paragraph("DOCUMENTO CONFIDENCIAL — PARA INVESTIDORES",
                           styles["cover_tag"]))
    story.append(Spacer(1, 4 * cm))
    story.append(Paragraph(
        f"{datetime.now().strftime('%B de %Y').capitalize()} &nbsp;·&nbsp; Versão 1.0",
        styles["cover_date"]))
    story.append(Paragraph("por Marina Sousa, jornalista esportiva sênior",
                           styles["cover_date"]))
    story.append(PageBreak())

    # -------- SEÇÃO 1 — SUMÁRIO EXECUTIVO --------
    story.append(Paragraph("1. Sumário Executivo", styles["H1"]))
    story.append(SectionRule(CONTENT_WIDTH))
    story.append(Spacer(1, 10))
    story.append(Paragraph(
        "Em um mercado global de jogos esportivos que movimenta mais de "
        "<b>26 bilhões de dólares</b> ao ano, existe um espaço que as "
        "grandes empresas ignoraram: o jogador que quer pensar, não apenas "
        "apertar botões. O <b>Olefoot</b> foi construído exatamente para ele.",
        styles["lead"]))
    story.append(p(
        "O Olefoot é uma plataforma de simulação de futebol que combina "
        "três coisas que nenhum outro jogo oferece simultaneamente: "
        "<b>inteligência artificial embarcada no DNA de cada jogador</b> "
        "(gerada uma vez na criação, sem custo recorrente), "
        "<b>arquitetura offline-first</b> que faz cada partida rodar "
        "localmente no dispositivo — sem latência, sem custo de servidor — "
        "e um <b>motor de decisão causal auditável</b> que une narrativa, "
        "tática e física em uma única fonte de verdade."))
    story.append(p(
        "O problema: o Football Manager, com seus 11 milhões de usuários "
        "dedicados, é complexo demais para o jogador casual. O EA FC, com "
        "150 milhões de jogadores, prioriza gráfico em vez de inteligência. "
        "Entre esses dois extremos existe um oceano azul — profundidade "
        "estratégica com sessão curta, no celular, com IA transparente. "
        "O jogador brasileiro quer profundidade, mas em dez minutos. "
        "Nenhum jogo existente responde a isso."))
    story.append(p(
        "A solução: uma engenharia de múltiplas camadas já em operação. "
        "Motor GameSpirit (estado, narrativa e decisão), SmartField "
        "(geometria tática em Python pré-computada), agentes Yuka em "
        "simulação 2D ao vivo, sistema de LegendDNA (transferência de "
        "sabedoria de lendas do futebol como camada treinável), e "
        "economia de quatro tokens (OLE, EXP, BRO, OLEXP) pronta para "
        "monetização híbrida. Tudo isso roda <b>hoje</b>."))
    story.append(Spacer(1, 6))
    story.append(HighlightBox(CONTENT_WIDTH, "Oportunidade de mercado",
                              "US$ 26B", "mercado global de sports gaming, crescendo 8–12% a.a."))
    story.append(Spacer(1, 8))
    story.append(p(
        "<b>O que buscamos.</b> Capital e parcerias estratégicas para "
        "acelerar lançamento no Brasil, expandir a base de jogadores e "
        "consolidar o Olefoot como a referência de simulação esportiva "
        "inteligente da América Latina. Este documento apresenta a "
        "oportunidade em detalhe."))
    story.append(PageBreak())

    # -------- SEÇÃO 2 — MERCADO --------
    story.append(Paragraph("2. O Mercado", styles["H1"]))
    story.append(SectionRule(CONTENT_WIDTH))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "O Football Manager tem 11 milhões de usuários dedicados. "
        "O EA FC tem 150 milhões de jogadores casuais. Entre esses "
        "dois mundos, existe um oceano azul inexplorado — e o Olefoot "
        "foi construído exatamente para navegar nele.", styles["lead"]))

    row = Table([[
        HighlightBox(7.8 * cm, "Mercado Global", "US$ 26B",
                     "sports gaming (estimativa 2024–2025)"),
        HighlightBox(7.8 * cm, "CAGR Projetado", "8–12%",
                     "crescimento anual até 2030"),
    ]], colWidths=[8 * cm, 8 * cm])
    row.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0),
                             ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    story.append(row)
    story.append(Spacer(1, 10))
    row2 = Table([[
        HighlightBox(7.8 * cm, "Gamers no Brasil", "105M+",
                     "Newzoo 2024 · 73% em mobile"),
        HighlightBox(7.8 * cm, "Downloads Anuais", "500M+",
                     "jogos mobile de futebol (global)"),
    ]], colWidths=[8 * cm, 8 * cm])
    row2.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0),
                              ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    story.append(row2)
    story.append(Spacer(1, 14))

    story.append(Paragraph("Por que o Brasil é o lançamento perfeito", styles["H3"]))
    story.append(p(
        "O Brasil concentra <b>105 milhões de jogadores de games</b> "
        "(Newzoo 2024), dos quais <b>73% jogam em mobile</b>. É top 10 "
        "mundial por receita e usuários, com crescimento de 12–15% ao ano "
        "no mobile gaming (estimativa de mercado). Soma-se a isso a "
        "identidade futebolística única do país: o brasileiro é o "
        "consumidor global mais engajado de conteúdo de futebol, "
        "insatisfeito com jogos que tratam o esporte como pano de fundo."))

    story.append(Paragraph("O gap que FIFA e Football Manager não preenchem",
                           styles["H3"]))
    story.append(p(
        "<b>Football Manager não entrega:</b> sessão rápida com "
        "profundidade real, mobile-first completo, IA transparente para o "
        "jogador, experiência acessível sem dezenas de horas de tutorial, "
        "foco no mercado ibero-americano."))
    story.append(p(
        "<b>EA FC / FIFA não entrega:</b> simulação estratégica profunda, "
        "progressão baseada em inteligência e não em loot boxes, "
        "jogabilidade offline completa, customização real de atributos e "
        "skills. O jogador competitivo paga; o jogador estratégico fica órfão."))
    story.append(p(
        "O Olefoot combina <b>profundidade do FM + acessibilidade mobile + "
        "IA embarcada + sessão curta de 5 a 10 minutos</b>. É a única "
        "plataforma no mercado que combina esses quatro elementos em um "
        "único produto."))

    story.append(Paragraph("Referências de investimento no setor", styles["H3"]))
    data = [
        ["Empresa/Jogo", "Investimento", "Ano", "Nota"],
        ["Sorare (fantasy football)", "US$ 680M Series B", "2021", "Referência do setor"],
        ["Fanatics (sports gaming)", "US$ 1.5B+", "2022–23", "Expansão para games"],
        ["Dream11 (fantasy sports)", "Unicórnio US$ 8B", "2023", "Modelo validado na Índia"],
        ["Indies esportivos (seed)", "US$ 500K–5M", "típico", "Faixa early-stage"],
    ]
    tbl = Table(data, colWidths=[5 * cm, 4.2 * cm, 2 * cm, 4.3 * cm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), VERDE_CAMPO),
        ("TEXTCOLOR", (0, 0), (-1, 0), BRANCO),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [BRANCO, CINZA_CLARO]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 8))
    story.append(p("<i>Fontes: imprensa especializada, relatórios de mercado "
                   "consolidados (2024–2025).</i>", "tag"))
    story.append(PageBreak())

    # -------- SEÇÃO 3 — PROBLEMA --------
    story.append(Paragraph("3. O Problema que Ninguém Resolveu", styles["H1"]))
    story.append(SectionRule(CONTENT_WIDTH))
    story.append(Spacer(1, 10))
    story.append(Paragraph(
        "Há um buraco no mercado de jogos de futebol que nenhuma grande "
        "empresa quis preencher. Não por falta de demanda — por falta de "
        "coragem de projeto.", styles["lead"]))
    story.append(p(
        "Perguntar a cem fãs de futebol o que eles querem de um jogo "
        "produz uma resposta quase unânime: <i>“Quero sentir que sou "
        "inteligente. Não quero apenas ter sorte ou pagar para ganhar.”</i> "
        "Nenhum jogo existente responde a isso. As grandes franquias "
        "fizeram escolhas opostas, e o jogador que quer pensar ficou no meio."))
    story.append(p(
        "<b>Football Manager</b> é profundo, mas exige dezenas de horas "
        "para se tornar acessível. Abrir o jogo, ler telas cheias de "
        "tabelas e tomar decisões sem feedback visual imediato é uma "
        "experiência de planilha. Mobile, então, é quase impraticável. "
        "O FM assume que o jogador é um técnico em formação — e exclui "
        "quem só tem dez minutos no intervalo do almoço."))
    story.append(p(
        "<b>EA FC / FIFA</b> foi para o extremo oposto: priorizou o "
        "gráfico e o controle manual. A simulação por trás do jogo é "
        "opaca, a progressão depende de loot boxes (pague para ganhar), "
        "e o componente estratégico foi reduzido a menus rasos. O que "
        "era para ser simulação virou arcade pago."))
    story.append(p(
        "<b>Os jogos mobile de futebol</b> são, em sua maioria, clones "
        "do mesmo loop: cartinhas, energia cronometrada, ofertas "
        "agressivas. A lógica de partida é quase inexistente — o "
        "resultado é decidido por atributo somado, não por simulação."))
    story.append(p(
        "Os grandes players do setor ignoraram o jogador estratégico-casual "
        "por uma razão simples: construir para ele é difícil. Requer "
        "inteligência no produto, não só gráficos. Requer um motor "
        "auditável, não uma caixa preta. Requer IA usada com critério, "
        "não decoração. <b>O Olefoot foi construído de trás para frente "
        "— começando pelo jogador que pensa.</b>"))
    story.append(Spacer(1, 6))
    story.append(HighlightBox(
        CONTENT_WIDTH, "A lacuna",
        "Profundidade + IA + Mobile + Sessão curta",
        "Nenhum jogo no mundo combina esses 4 elementos hoje."))
    story.append(PageBreak())

    # -------- SEÇÃO 4 — SOLUÇÃO --------
    story.append(Paragraph("4. A Solução: Olefoot", styles["H1"]))
    story.append(SectionRule(CONTENT_WIDTH))
    story.append(Spacer(1, 10))
    story.append(Paragraph(
        "O Olefoot não é mais um jogo de futebol. É a primeira plataforma "
        "de simulação esportiva com inteligência artificial embarcada no "
        "DNA de cada jogador — e arquitetura que cresce sem explodir "
        "custos.", styles["lead"]))
    story.append(p(
        "Cada função do motor foi desenhada para resolver um problema "
        "específico do mercado. Abaixo, os doze pilares de inovação que "
        "sustentam a plataforma — todos em operação na versão atual do produto:"))
    story.append(Spacer(1, 6))

    story.append(pillar(
        "◆", "IA Embarcada na Criação",
        "Inteligência onde importa — silêncio onde não importa.",
        "O Olefoot usa modelos de linguagem de última geração (Claude, "
        "OpenAI) apenas no momento de criação do jogador — nunca durante "
        "a partida.",
        "No ato de gerar um jogador, a IA produz seu perfil narrativo, "
        "arquétipo, atributos posicionais e bio tática. Essa inteligência "
        "é persistida no DNA do jogador. Durante a partida, o motor lê "
        "esse DNA localmente — sem chamadas de rede.",
        "Resolve o maior problema econômico de jogos com IA: o custo por "
        "sessão. O Olefoot tem <b>custo operacional de IA próximo de zero "
        "por partida disputada</b> — a inteligência é um investimento "
        "único por jogador, não um gasto recorrente por minuto de jogo.",
        "Enquanto concorrentes precisam escolher entre IA cara ou IA "
        "ausente, o Olefoot tem <b>IA presente sem custo marginal</b>. "
        "Isso muda a equação de escala."
    ))
    story.append(pillar(
        "◆", "GameSpirit — Oráculo de Decisão e Narrativa",
        "Uma única fonte de verdade para tática, narração e resultado.",
        "GameSpirit é o motor de decisão tática do Olefoot: uma máquina "
        "de estados determinística que controla o fluxo da partida, "
        "escolhe ações (chute, progressão, recomposição, pressão), "
        "resolve resultados e gera narrativa.",
        "A cada tique de jogo, o GameSpirit avalia contexto (posse, zona "
        "da bola, fadiga, estatísticas do time) e emite simultaneamente "
        "três coisas: a ação tática, o evento causal (registrado em log "
        "imutável) e a narrativa textual. Tudo coeso, tudo auditável.",
        "Resolve o maior defeito da categoria: a desconexão entre o que "
        "o jogador vê, o que a narração diz e o que o resultado mostra. "
        "Cada gol, cada falta, cada momento decisivo tem causa rastreável.",
        "Rivais compõem esses três elementos em sistemas separados que "
        "frequentemente se contradizem. O Olefoot unifica tudo."
    ))
    story.append(pillar(
        "◆", "Arquitetura Offline-First de Alta Performance",
        "A partida mora no dispositivo. O servidor aplaude.",
        "A simulação completa da partida roda no cliente — navegador "
        "ou mobile — sem dependência de servidor em tempo real.",
        "O motor é 100% local em JavaScript/TypeScript: estado do "
        "jogo, física da bola, decisões dos 22 jogadores, narrativa. "
        "O servidor só entra em cena para persistência, economia e "
        "pareamento — nunca para computar a partida em si.",
        "Latência zero, custo operacional zero por partida, "
        "jogabilidade em qualquer condição de rede. Para o jogador "
        "brasileiro em 4G instável, isso é diferencial decisivo. "
        "Para o investidor, significa que <b>o custo de infraestrutura "
        "não cresce linearmente com a base de usuários</b>.",
        "EA FC e FM dependem de servidor para aspectos centrais. "
        "O Olefoot escala sem escala de custos."
    ))
    story.append(pillar(
        "◆", "SmartField — Geometria Tática em Python",
        "O cérebro espacial do jogo, calculado uma vez, consumido para sempre.",
        "SmartField é o motor de geometria tática do Olefoot: um sistema "
        "em Python que modela o campo em 18 zonas táticas, cada uma com "
        "âncoras, raios permitidos, zonas de apoio e de pressão por função.",
        "O engine Python computa a geometria completa — ângulos de gol, "
        "qualidade de finalização por posição, zonas de suporte por "
        "papel — e exporta um snapshot JSON. O runtime em TypeScript "
        "consome esse snapshot sem chamar Python. Rigor científico "
        "offline, performance em runtime.",
        "Permite que cada posição tenha <b>identidade tática real</b>: "
        "um zagueiro se move, decide e pressiona de forma distinta de "
        "um meia. Isso é invisível ao jogador casual e decisivo ao "
        "jogador estratégico.",
        "Nenhum jogo mobile tem geometria tática desse nível. "
        "Nenhum console tem como expô-la de forma auditável."
    ))
    story.append(pillar(
        "◆", "LegendDNA — Transferência de Sabedoria de Lendas",
        "Pelé, Maradona e Ronaldinho ensinam os novos.",
        "Sistema que codifica conhecimento posicional de ~20 figuras "
        "históricas do futebol como pesos de ação e traços treináveis.",
        "Cada lenda tem um perfil estruturado: pesos de ação por zona "
        "(finalização, progressão, pressão, recomposição, contra-ataque), "
        "traços táticos (intensidade de pressão, preferência de "
        "construção, apetite ao risco) e notas de princípio. Jogadores "
        "novos podem <b>herdar DNA de lenda</b> via treino — desbloqueando "
        "multiplicadores de decisão tática.",
        "Transforma a meta-progressão em narrativa de patrimônio "
        "futebolístico. O jogador não apenas evolui atributos: ele "
        "recebe <b>sabedoria</b> de ícones. Diferencial cultural "
        "poderosíssimo no mercado latino.",
        "É uma camada de monetização culturalmente específica. "
        "Nenhum concorrente global ousou fazer isso."
    ))
    story.append(pillar(
        "◆", "Simulação 2D ao Vivo com Agentes Yuka",
        "22 jogadores pensando. A bola é só consequência.",
        "No modo Live 2D, cada jogador é um agente autônomo com "
        "navegação física realista — baseado na biblioteca Yuka de "
        "steering behaviors.",
        "Cada agente recebe um alvo tático do GameSpirit e se desloca "
        "com orientação, desvio de colisão e respeito ao posicionamento "
        "de companheiros e adversários. O movimento não é animação "
        "pré-gravada: é comportamento emergente regulado pela fase "
        "tática da equipe (ataque organizado, transição defensiva, "
        "pressão alta).",
        "Entrega o espetáculo visual de um arcade com a lógica "
        "tática de uma simulação profunda. Torna o replay e a análise "
        "de jogo intrinsecamente ricos.",
        "Jogos mobile usam animação canalizada. O Olefoot usa "
        "comportamento autêntico — o que abre portas para "
        "torneios, esports e conteúdo de criador."
    ))
    story.append(pillar(
        "◆", "Sistema Causal Auditável",
        "Cada gol tem um porquê rastreável.",
        "Cada evento da partida (chute, gol, falta, cartão, troca) é "
        "registrado em um log causal imutável, com autor, contexto e "
        "consequência.",
        "O log causal conecta cada evento à fase tática, ao estado "
        "anímico do time e à jogada anterior. A detecção de contra-ataque, "
        "por exemplo, inspeciona o log para classificar o gol por estilo "
        "(construção posicional vs. transição).",
        "Viabiliza <b>replay com análise</b>, estatísticas ricas, "
        "conteúdo para criadores e integridade competitiva para "
        "torneios. Um gol nunca é ‘sorte’ — é sempre explicável.",
        "Nenhum jogo de futebol mobile oferece esse nível de "
        "rastreabilidade. É fundação para esports."
    ))
    story.append(pillar(
        "◆", "DNA Digital por Posição",
        "Cada posição tem identidade tática própria.",
        "O sistema de atributos (nove dimensões — passe, marcação, "
        "velocidade, drible, finalização, físico, tático, mentalidade, "
        "fair play) é cruzado com formações e slots posicionais para "
        "criar identidade única por jogador.",
        "Sete formações canônicas (4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 4-5-1, "
        "5-3-2, 3-4-3) definem slots normalizados que remapeiam "
        "atributos com pesos posicionais distintos. O mesmo jogador "
        "rende diferente em cada função.",
        "O jogador estratégico encontra o que FM entrega com dez horas "
        "de tutorial — em segundos, com feedback visual imediato.",
        "É profundidade sem complexidade de interface. É a fronteira "
        "do design de produto que ninguém atravessou."
    ))
    story.append(pillar(
        "◆", "Variância Controlada por Inteligência",
        "Não é sorte. É probabilidade ponderada por atributo.",
        "Cada resultado de chute, passe ou duelo é decidido por "
        "probabilidades que incorporam atributos, fadiga, zona do "
        "campo e contexto tático.",
        "O modelo de finalização, por exemplo, amplifica o peso de "
        "gol em até 45% com base em finalização alta, adiciona bônus "
        "de cabeça para atletas com físico acima de 75 em escanteios, "
        "e aplica imposto de erro quando a fadiga ultrapassa 72.",
        "O jogador sente que suas escolhas importam. A probabilidade "
        "não é um dado rolado no escuro: é um reflexo legível do DNA "
        "que ele construiu.",
        "Arcades modernos fazem o contrário — a sorte mascara o "
        "valor da decisão. O Olefoot devolve a decisão ao jogador."
    ))
    story.append(pillar(
        "◆", "Economia de Quatro Tokens",
        "Progressão, mercado, staking e yield — em arquitetura flexível.",
        "Quatro ativos distintos: <b>EXP</b> (progressão do jogador), "
        "<b>OLE</b> (saldo de jogo genérico), <b>BRO</b> (token de "
        "leilão e transferências, pareado a valor externo) e "
        "<b>OLEXP</b> (produto de staking com rendimento).",
        "A camada de leilão separa listagens por token, permitindo "
        "mercados segregados. O OLEXP trabalha com acúmulo de "
        "rendimento em dias úteis sobre principal travado (modelo "
        "compliance-ready, sem dependência obrigatória de blockchain).",
        "Cria múltiplas superfícies de monetização: progressão "
        "(EXP), mercado secundário (BRO), produto financeiro "
        "(OLEXP). Diversifica receita e engajamento.",
        "Projeta o jogo como <b>plataforma econômica</b>, não apenas "
        "jogo. Abre portas para parcerias com fintechs e exchanges."
    ))
    story.append(pillar(
        "◆", "Sistema de Staff e Meta-Progressão",
        "O gestor por trás do time — com carreira própria.",
        "Sete funções de staff (preparador físico, mental, nutrição, "
        "tático, treinador, olheiro, preparador de goleiros), cada uma "
        "evoluindo em níveis com multiplicadores compostos.",
        "O treinador-chefe aplica multiplicador de coaching que "
        "compõe com bônus de cada função de staff. Treinos "
        "específicos com lendas do futebol passam por um fluxo "
        "próprio mediado por IA, retornando resultado narrado.",
        "Meta-jogo rico fora da partida — o jogador contrata, promove "
        "e retém talentos de bastidor. Estende o tempo de sessão e "
        "aumenta a retenção de longo prazo.",
        "Nenhum jogo mobile de futebol tem meta-jogo de staff "
        "com essa granularidade."
    ))
    story.append(pillar(
        "◆", "Catálogo de Missões e Jornada de Aprendizado",
        "Cada clique ensina. Cada conquista valida.",
        "Cerca de 50 missões progressivas guiam o jogador do onboarding "
        "ao domínio tático — sem tutorial forçado.",
        "Missões de onboarding (primeiro login, primeira partida, "
        "primeira escalação) dão EXP imediato. Missões de campanha "
        "consolidam engajamento. Missões específicas de Live 2D "
        "recompensam domínio tático (batidas táticas, viradas de "
        "momentum). Cada ação emite evento para o sistema de "
        "rastreamento.",
        "Onboarding orgânico substitui tutoriais chatos. Curva de "
        "aprendizado suave mantém jogadores casuais, e recompensas "
        "crescentes retêm os estratégicos.",
        "Enquanto concorrentes empurram tutoriais, o Olefoot ensina "
        "jogando. Padrão de design de classe mundial."
    ))
    story.append(PageBreak())

    # -------- Comparativo competitivo --------
    story.append(Paragraph("Comparativo Competitivo", styles["H2"]))
    story.append(Spacer(1, 4))
    story.append(p("Onde o Olefoot está no mapa do mercado:"))
    story.append(comp_table())
    story.append(Spacer(1, 10))
    story.append(p("<i>Avaliação baseada em funcionalidades públicas dos "
                   "produtos citados, 2024–2025.</i>", "tag"))
    story.append(PageBreak())

    # -------- SEÇÃO 5 — TECNOLOGIA --------
    story.append(Paragraph("5. Tecnologia e Arquitetura", styles["H1"]))
    story.append(SectionRule(CONTENT_WIDTH))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "Construímos o alicerce. A próxima fase é a expansão. "
        "E o mercado já está esperando.", styles["lead"]))
    story.append(Paragraph("Stack principal", styles["H3"]))
    story.append(p(
        "Frontend em <b>React + TypeScript</b> com gerenciamento de "
        "estado reativo via <b>Zustand</b>. Build tooling moderno "
        "(<b>Vite</b>), deploy edge-ready em Cloudflare. Backend leve "
        "em <b>Hono</b> (Node) exposto apenas para integrações "
        "não-críticas ao runtime de jogo. Persistência em "
        "<b>Supabase/Postgres</b> com migrations versionadas. "
        "Motor de geometria tática em <b>Python</b> com exportação "
        "de snapshot para consumo em runtime. Biblioteca "
        "<b>Yuka</b> para agentes autônomos no modo Live 2D."))
    story.append(Paragraph("Decisão estratégica: IA na criação, não no runtime",
                           styles["H3"]))
    story.append(p(
        "Essa é a decisão arquitetural mais importante do Olefoot. "
        "Projetos que usam IA em tempo real de jogo têm um tradeoff "
        "brutal: ou pagam centavos por sessão (inviável em escala de "
        "milhões), ou sofrem com latência de segundos (inviável em "
        "partida de futebol). <b>O Olefoot fugiu do tradeoff.</b> "
        "A IA faz o trabalho intelectual uma vez — ao criar o jogador, "
        "ao treinar a DNA de lenda, ao gerar narrativa de campanha — "
        "e o motor local executa a partida com as regras geradas. "
        "Isso é <b>o insight econômico do produto</b>: inteligência "
        "cara no lugar certo, inteligência barata no resto."))
    story.append(Paragraph("Escalabilidade", styles["H3"]))
    story.append(p(
        "O custo marginal de uma partida disputada é próximo de zero. "
        "O custo de servidor escala com operações de mercado, não com "
        "partidas. A largura de banda necessária por sessão é mínima "
        "(sincronização de estado, não streaming). Isso significa "
        "que <b>o Olefoot pode crescer para dezenas de milhões de "
        "usuários com estrutura operacional enxuta</b> — o oposto do "
        "modelo tradicional de simulação online."))
    story.append(Paragraph("Sistema de coordenadas auditável", styles["H3"]))
    story.append(p(
        "Três sistemas de coordenadas coexistem e se convertem "
        "deterministicamente: percentual de UI (0–100), metros de "
        "mundo (105×68m, padrão IFAB) e zonas táticas do SmartField. "
        "Cada uma tem função clara, todas são reversíveis, nenhuma "
        "é opaca. Isso permite <b>replay frame-a-frame</b>, análise "
        "forense de jogadas e integridade competitiva para torneios. "
        "É engenharia de verdade — do tipo que sustenta esports."))
    story.append(Paragraph("Roadmap técnico em três fases", styles["H3"]))
    story.append(Spacer(1, 4))
    story.append(Timeline(CONTENT_WIDTH, [
        ("Fase 1", "MVP em operação"),
        ("Fase 2", "Lançamento BR"),
        ("Fase 3", "Expansão LatAm"),
    ]))
    story.append(Spacer(1, 6))
    story.append(p(
        "<b>Fase 1 (concluída).</b> Motor GameSpirit, modo quick, auto "
        "e Live 2D operacionais. SmartField exportando snapshot "
        "estável. Admin completo para criação de jogadores, times, "
        "ligas e missões. Economia de quatro tokens implementada."))
    story.append(p(
        "<b>Fase 2 (6–12 meses).</b> PvP assíncrono, torneios automáticos, "
        "live ops (eventos sazonais), monetização ativa, otimização "
        "mobile. Meta: <b>500 mil jogadores ativos</b> no Brasil."))
    story.append(p(
        "<b>Fase 3 (12–24 meses).</b> Expansão para América Latina, "
        "parcerias com clubes e federações, camada de criadores "
        "(replays compartilháveis, análise com IA), infraestrutura "
        "de torneios oficiais. Meta: <b>5 milhões de jogadores ativos</b> "
        "na região."))
    story.append(PageBreak())

    # -------- SEÇÃO 6 — MODELO DE NEGÓCIO --------
    story.append(Paragraph("6. Modelo de Negócio", styles["H1"]))
    story.append(SectionRule(CONTENT_WIDTH))
    story.append(Spacer(1, 8))
    story.append(p(
        "O Olefoot combina <b>freemium de base larga</b> com "
        "<b>receita premium segmentada</b> e <b>camada econômica "
        "de plataforma</b>. Nenhuma das três depende exclusivamente "
        "da outra — todas se reforçam."))
    story.append(Paragraph("Freemium — a porta de entrada", styles["H3"]))
    story.append(p(
        "O jogo base é gratuito: criação de time, escalação, disputa "
        "de partidas quick e auto, campanha inicial. Zero atrito para "
        "testar o produto. Meta: máxima penetração."))
    story.append(Paragraph("Premium — monetização por valor, não por parede",
                           styles["H3"]))
    story.append(p(
        "Assinaturas de acesso a ligas oficiais, torneios ranqueados, "
        "slots adicionais de staff, modo Live 2D avançado. O premium "
        "não bloqueia progresso — ele abre experiências adicionais. "
        "<b>Zero loot boxes, zero pay-to-win.</b>"))
    story.append(Paragraph("Geração de conteúdo via IA como crédito", styles["H3"]))
    story.append(p(
        "A criação de jogadores e o treino com lendas consomem "
        "créditos de IA. Créditos são comprados (monetização direta) "
        "ou ganhos (missões, recompensas). Isso alinha o custo real "
        "(chamadas de modelo) com o preço percebido (valor criativo) — "
        "mecanismo único no setor."))
    story.append(Paragraph("Camada econômica — OLEXP e parcerias fintech",
                           styles["H3"]))
    story.append(p(
        "O token OLEXP oferece staking com rendimento em dias úteis, "
        "em modelo compliance-ready. Abre superfície para parcerias "
        "com fintechs, exchanges e produtos financeiros regulados. "
        "Receita recorrente de <i>spread</i> financeiro, não apenas "
        "de venda de jogo."))
    story.append(Paragraph("Licenciamento e parcerias estratégicas", styles["H3"]))
    story.append(p(
        "A camada SmartField e o log causal são ativos licenciáveis "
        "para mídia esportiva, apostas regulamentadas e análise "
        "profissional. Parcerias com clubes e federações viabilizam "
        "<b>modo carreira oficial</b> — fonte de receita premium e "
        "diferenciação cultural."))
    story.append(Spacer(1, 6))
    story.append(HighlightBox(
        CONTENT_WIDTH, "Arquitetura de receita",
        "4 superfícies",
        "Freemium · Premium · Créditos de IA · OLEXP financeiro"))
    story.append(PageBreak())

    # -------- SEÇÃO 7 — VISÃO E ROADMAP --------
    story.append(Paragraph("7. Visão e Roadmap", styles["H1"]))
    story.append(SectionRule(CONTENT_WIDTH))
    story.append(Spacer(1, 8))
    story.append(Timeline(CONTENT_WIDTH, [
        ("Fase 1", "MVP"),
        ("Fase 2", "Lançamento BR"),
        ("Fase 3", "Expansão LatAm"),
        ("Fase 4", "Global"),
    ]))
    story.append(Spacer(1, 8))
    story.append(Paragraph("Fase 1 — MVP (presente)", styles["H3"]))
    story.append(p(
        "O produto <b>já existe e funciona</b>. Motor completo, três "
        "modos de partida, admin rico, economia, progressão, IA "
        "embarcada. Dezenas de milhares de linhas de código de "
        "engenharia consolidada."))
    story.append(Paragraph("Fase 2 — Lançamento e crescimento de base", styles["H3"]))
    story.append(p(
        "PvP assíncrono, torneios automatizados, live ops, marketing "
        "direcionado no Brasil. Marco de 500 mil jogadores ativos, "
        "primeiros parceiros de clube, receita recorrente consolidada."))
    story.append(Paragraph("Fase 3 — Expansão regional", styles["H3"]))
    story.append(p(
        "Argentina, Chile, Colômbia, México — mercados de paixão "
        "futebolística equivalente. Localizações, parcerias locais, "
        "ligas regionais. Meta: 5 milhões de jogadores ativos na LatAm."))
    story.append(Paragraph("Fase 4 — Visão global", styles["H3"]))
    story.append(p(
        "Europa, Ásia, África. Camada de criadores de conteúdo, "
        "infraestrutura oficial de esports, parcerias com federações "
        "internacionais. O Olefoot deixa de ser um jogo — torna-se "
        "a <b>plataforma de referência para simulação esportiva "
        "inteligente</b>."))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "O futebol é a linguagem comum do mundo. Merece um jogo que "
        "pense tão alto quanto ele.", styles["lead"]))
    story.append(PageBreak())

    # -------- SEÇÃO 8 — TIME --------
    story.append(Paragraph("8. O Time", styles["H1"]))
    story.append(SectionRule(CONTENT_WIDTH))
    story.append(Spacer(1, 10))
    story.append(p(
        "O time por trás do Olefoot está sendo apresentado em "
        "reuniões privadas. O histórico técnico do projeto — "
        "evidente na profundidade de código, na sofisticação do "
        "sistema de coordenadas, na integração entre Python e "
        "TypeScript, na arquitetura de IA híbrida — fala por si: "
        "é engenharia de veteranos, não experimento de hobistas."))
    story.append(p(
        "Core técnico com experiência profunda em simulação, "
        "sistemas distribuídos, motores de jogo e integração com "
        "modelos de linguagem. Parceiros editoriais e de mercado "
        "alinhados com a narrativa esportiva brasileira. "
        "Apresentação detalhada sob NDA."))
    story.append(Spacer(1, 14))
    story.append(HighlightBox(
        CONTENT_WIDTH, "Status do produto",
        "Operacional",
        "Todos os sistemas descritos neste documento rodam hoje."))
    story.append(PageBreak())

    # -------- SEÇÃO 9 — CHAMADA PARA AÇÃO --------
    story.append(Paragraph("9. Chamada para Ação", styles["H1"]))
    story.append(SectionRule(CONTENT_WIDTH))
    story.append(Spacer(1, 10))
    story.append(Paragraph(
        "Construímos o alicerce. Estamos prontos para o lançamento. "
        "Estamos abertos a conversar.", styles["lead"]))
    story.append(Paragraph("O que buscamos", styles["H3"]))
    story.append(p(
        "Capital para acelerar a <b>Fase 2</b> — lançamento brasileiro, "
        "marketing de aquisição, operação de torneios e parcerias "
        "estratégicas com clubes. <b>Parceiros de distribuição</b> "
        "mobile e editoriais, e <b>parceiros institucionais</b> "
        "interessados em co-construir a camada de esports e licenciamento."))
    story.append(Paragraph("Próximos passos", styles["H3"]))
    story.append(p(
        "Reunião introdutória de 45 minutos — demonstração ao vivo "
        "do produto, caminhada pela arquitetura, discussão aberta "
        "de modelo e métricas. Documentação financeira detalhada "
        "e apresentação do time disponível sob NDA."))
    story.append(Paragraph("Contato", styles["H3"]))
    story.append(p(
        "<b>Olefoot — Simulação Esportiva Inteligente</b><br/>"
        "Email de investidores: <i>investors@olefoot.com</i><br/>"
        "Plataforma: <i>game.olefoot.com</i><br/>"
        f"Versão do documento: 1.0 — {datetime.now().strftime('%B/%Y').capitalize()}"))
    story.append(Spacer(1, 20))
    story.append(HighlightBox(
        CONTENT_WIDTH, "O momento é agora",
        "O mercado está esperando.",
        "E o Olefoot já está pronto para ocupá-lo."))
    story.append(Spacer(1, 20))
    story.append(p(
        "<i>Este documento é confidencial e destina-se exclusivamente "
        "aos investidores e parceiros endereçados. Não reproduzir "
        "sem autorização.</i>", "tag"))

    doc.build(story)
    return OUT


if __name__ == "__main__":
    out = build()
    import os
    size_kb = os.path.getsize(out) / 1024
    print(f"OK: {out} ({size_kb:.1f} KB)")
