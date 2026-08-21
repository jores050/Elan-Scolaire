from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.utils import simpleSplit
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "images" / "guide-preview"
PDF = OUT / "pedagogical-preview.pdf"
W, H = A4
L, R = 1.65 * cm, W - 1.65 * cm

NAVY = colors.HexColor("#061A2E")
GREEN = colors.HexColor("#008762")
GREEN_DARK = colors.HexColor("#004638")
MINT = colors.HexColor("#EAF8F2")
BLUE = colors.HexColor("#1769E0")
PALE_BLUE = colors.HexColor("#EDF4FF")
YELLOW = colors.HexColor("#FFD21A")
ORANGE = colors.HexColor("#F28C28")
INK = colors.HexColor("#142033")
MUTED = colors.HexColor("#5C6979")
LINE = colors.HexColor("#DCE5EC")
WHITE = colors.white

FONT_DIR = Path("C:/Windows/Fonts")
pdfmetrics.registerFont(TTFont("Elan", str(FONT_DIR / "arial.ttf")))
pdfmetrics.registerFont(TTFont("Elan-Bold", str(FONT_DIR / "arialbd.ttf")))
REGULAR, BOLD = "Elan", "Elan-Bold"


def write(c, value, x, y, font=REGULAR, size=10, color=INK, width=None, leading=None):
    c.setFont(font, size)
    c.setFillColor(color)
    lines = simpleSplit(value, font, size, width or R - x)
    step = leading or size * 1.32
    for line in lines:
        c.drawString(x, y, line)
        y -= step
    return y


def pill(c, label, x, y, fill=GREEN, color=WHITE, width=None):
    width = width or max(2.2 * cm, pdfmetrics.stringWidth(label, BOLD, 8) + 1.0 * cm)
    c.setFillColor(fill)
    c.roundRect(x, y - 0.5 * cm, width, 0.58 * cm, 0.22 * cm, fill=1, stroke=0)
    c.setFont(BOLD, 8)
    c.setFillColor(color)
    c.drawCentredString(x + width / 2, y - 0.31 * cm, label.upper())
    return width


def base(c, label, title, subtitle, page):
    c.setFillColor(WHITE)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.rect(0, H - 0.24 * cm, W, 0.24 * cm, fill=1, stroke=0)
    pill(c, label, L, H - 1.25 * cm)
    y = write(c, title, L, H - 2.45 * cm, BOLD, 25, NAVY, R - L, 29)
    y = write(c, subtitle, L, y - 0.18 * cm, REGULAR, 11.5, MUTED, R - L, 15)
    c.setStrokeColor(LINE)
    c.line(L, 1.55 * cm, R, 1.55 * cm)
    write(c, "ÉLAN SCOLAIRE  •  RÉUSSIR LES MATHS 3e", L, 1.02 * cm, BOLD, 7.5, GREEN)
    c.setFont(BOLD, 8)
    c.setFillColor(MUTED)
    c.drawRightString(R, 1.02 * cm, f"APERÇU {page:02d}")
    return y


def box(c, x, top, w, h, fill=WHITE, stroke=LINE, radius=0.3 * cm):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(0.7)
    c.roundRect(x, top - h, w, h, radius, fill=1, stroke=1)


def numbered(c, n, title, body, x, top, w, fill=MINT, accent=GREEN):
    box(c, x, top, w, 1.65 * cm, fill, fill)
    c.setFillColor(accent)
    c.circle(x + 0.62 * cm, top - 0.8 * cm, 0.34 * cm, fill=1, stroke=0)
    c.setFont(BOLD, 9)
    c.setFillColor(WHITE)
    c.drawCentredString(x + 0.62 * cm, top - 0.91 * cm, str(n))
    write(c, title, x + 1.18 * cm, top - 0.55 * cm, BOLD, 10.5, INK, w - 1.55 * cm)
    write(c, body, x + 1.18 * cm, top - 1.08 * cm, REGULAR, 8.4, MUTED, w - 1.55 * cm)


def page_program(c):
    y = base(c, "Le parcours", "14 jours pour repartir sur de bonnes bases", "Chaque jour mène à une action précise : comprendre, essayer, corriger et progresser.", 1)
    y -= 0.45 * cm
    box(c, L, y, R - L, 2.45 * cm, NAVY, NAVY)
    write(c, "13 séances guidées + 1 test final", L + 0.65 * cm, y - 0.72 * cm, BOLD, 16, WHITE)
    write(c, "30 à 45 minutes par jour • méthode claire • exercices progressifs", L + 0.65 * cm, y - 1.5 * cm, REGULAR, 10.5, colors.HexColor("#D8E6F2"))
    y -= 2.9 * cm
    days = [
        ("01", "Priorités", "Calculer dans le bon ordre"), ("02", "Fractions", "Maîtriser les opérations"),
        ("03", "Calcul littéral", "Réduire une expression"), ("04", "Développer", "Utiliser la distributivité"),
        ("05", "Équations", "Trouver l'inconnue"), ("06", "Proportionnalité", "Choisir la bonne méthode"),
        ("07", "Pourcentages", "Résoudre des cas concrets"), ("08", "PGCD / PPCM", "Simplifier et organiser"),
        ("09", "Géométrie", "Mobiliser les propriétés"), ("10", "Pythagore", "Calculer et démontrer"),
        ("11", "Statistiques", "Lire et interpréter"), ("12", "Consolidation", "Mélanger les méthodes"),
        ("13", "Passerelle 3e", "Préparer les nouvelles notions"), ("14", "Test final", "Mesurer les acquis"),
    ]
    col_w = (R - L - 0.35 * cm) / 2
    for i, (n, title, desc) in enumerate(days):
        x = L + (i % 2) * (col_w + 0.35 * cm)
        top = y - (i // 2) * 1.72 * cm
        numbered(c, n, title, desc, x, top, col_w, PALE_BLUE if i >= 12 else MINT, BLUE if i >= 12 else GREEN)


def page_priority_meaning(c):
    y = base(c, "Jour 1 • Comprendre", "Une expression est une consigne de calcul", "Avant d'appliquer une règle, l'élève apprend à lire ce que les signes lui demandent.", 2)
    y -= 0.35 * cm
    box(c, L, y, R - L, 3.15 * cm, colors.HexColor("#FFF8D8"), colors.HexColor("#F3D55B"))
    write(c, "Pourquoi faut-il un ordre ?", L + 0.55 * cm, y - 0.65 * cm, BOLD, 11, NAVY)
    write(c, "Dans 18 - 2 × (5 + 1), trois opérations sont présentes.", L + 0.55 * cm, y - 1.35 * cm, BOLD, 13, INK)
    write(c, "Si chacun les effectue dans l'ordre qu'il veut, on obtient plusieurs réponses. Les priorités opératoires donnent donc à tous la même règle de lecture.", L + 0.55 * cm, y - 2.05 * cm, REGULAR, 10.5, MUTED, R - L - 1.1 * cm, 15)
    y -= 3.65 * cm
    write(c, "Les mots à connaître", L, y, BOLD, 15, NAVY)
    y -= 0.48 * cm
    vocabulary = [
        ("Somme", "résultat d'une addition", "8 + 3"),
        ("Différence", "résultat d'une soustraction", "8 - 3"),
        ("Produit", "résultat d'une multiplication", "8 × 3"),
        ("Quotient", "résultat d'une division", "8 ÷ 2"),
    ]
    col_w = (R - L - 0.35 * cm) / 2
    for i, (word, meaning, example) in enumerate(vocabulary):
        x = L + (i % 2) * (col_w + 0.35 * cm)
        top = y - (i // 2) * 2.55 * cm
        box(c, x, top, col_w, 2.2 * cm, MINT if i < 2 else PALE_BLUE, MINT if i < 2 else PALE_BLUE)
        write(c, word, x + 0.45 * cm, top - 0.62 * cm, BOLD, 12, GREEN_DARK if i < 2 else BLUE)
        write(c, meaning, x + 0.45 * cm, top - 1.22 * cm, REGULAR, 8.8, MUTED, col_w - 2.8 * cm)
        write(c, example, x + col_w - 2.15 * cm, top - 1.27 * cm, BOLD, 13, NAVY)
    y -= 5.45 * cm
    box(c, L, y, R - L, 3.0 * cm, NAVY, NAVY)
    write(c, "Premier réflexe : je ne calcule pas tout de suite.", L + 0.55 * cm, y - 0.75 * cm, BOLD, 13.5, WHITE)
    write(c, "Je repère les parenthèses, puis les multiplications et divisions, puis les additions et soustractions.", L + 0.55 * cm, y - 1.55 * cm, REGULAR, 10.5, colors.HexColor("#D3E4F0"), R - L - 1.1 * cm, 15)
    write(c, "Je peux entourer ou souligner la première opération à faire.", L + 0.55 * cm, y - 2.45 * cm, BOLD, 9.5, YELLOW)


def page_priority_rules(c):
    y = base(c, "Jour 1 • La règle", "Dans quel ordre faut-il calculer ?", "L'ordre est une hiérarchie. Deux opérations de même niveau se font de gauche à droite.", 3)
    y -= 0.35 * cm
    rules = [
        ("1", "Parenthèses", "Commence par les parenthèses les plus intérieures. Exemple : 3 × (8 - (2 + 1)) commence par 2 + 1."),
        ("2", "Puissances", "Calcule ensuite les puissances. Dans 5 + 2² × 3, on calcule d'abord 2² = 4."),
        ("3", "Multiplications et divisions", "Elles ont la même priorité. Effectue-les de gauche à droite."),
        ("4", "Additions et soustractions", "Elles ont aussi la même priorité. Termine de gauche à droite."),
    ]
    for n, title, body in rules:
        box(c, L, y, R - L, 2.45 * cm, MINT if int(n) % 2 else PALE_BLUE, MINT if int(n) % 2 else PALE_BLUE)
        c.setFillColor(GREEN if int(n) % 2 else BLUE)
        c.circle(L + 0.72 * cm, y - 1.15 * cm, 0.38 * cm, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont(BOLD, 10)
        c.drawCentredString(L + 0.72 * cm, y - 1.28 * cm, n)
        write(c, title, L + 1.38 * cm, y - 0.72 * cm, BOLD, 12, NAVY)
        write(c, body, L + 1.38 * cm, y - 1.42 * cm, REGULAR, 9.3, MUTED, R - L - 1.85 * cm, 13)
        y -= 2.72 * cm
    box(c, L, y, R - L, 4.4 * cm, colors.HexColor("#FFF1E6"), colors.HexColor("#FFD2B0"))
    write(c, "Attention : même priorité = gauche vers droite", L + 0.55 * cm, y - 0.7 * cm, BOLD, 11, ORANGE)
    write(c, "24 ÷ 6 × 2", L + 0.55 * cm, y - 1.55 * cm, BOLD, 15, NAVY)
    write(c, "24 ÷ 6 = 4, puis 4 × 2 = 8. La réponse est 8.", L + 0.55 * cm, y - 2.25 * cm, REGULAR, 10, INK)
    write(c, "10 - 3 + 2", L + 0.55 * cm, y - 3.05 * cm, BOLD, 15, NAVY)
    write(c, "10 - 3 = 7, puis 7 + 2 = 9. La réponse est 9.", L + 0.55 * cm, y - 3.75 * cm, REGULAR, 10, INK)


def page_priority_example(c):
    y = base(c, "Jour 1 • Exemple commenté", "Voir le raisonnement, ligne après ligne", "À chaque ligne, une seule étape change : l'élève peut ainsi suivre et vérifier.", 4)
    y -= 0.35 * cm
    box(c, L, y, R - L, 2.15 * cm, NAVY, NAVY)
    write(c, "Calculer A = 18 - 2 × (5 + 1)", L + 0.55 * cm, y - 0.85 * cm, BOLD, 18, WHITE)
    write(c, "Je cherche l'opération qui a la plus grande priorité.", L + 0.55 * cm, y - 1.55 * cm, REGULAR, 9.5, colors.HexColor("#D3E4F0"))
    y -= 2.65 * cm
    steps = [
        ("Étape 1", "A = 18 - 2 × 6", "Je calcule 5 + 1, car cette addition est entre parenthèses."),
        ("Étape 2", "A = 18 - 12", "Je calcule 2 × 6, car la multiplication passe avant la soustraction."),
        ("Étape 3", "A = 6", "Il ne reste qu'une soustraction. Je calcule 18 - 12."),
    ]
    for label, formula, reason in steps:
        box(c, L, y, R - L, 2.65 * cm, MINT, MINT)
        pill(c, label, L + 0.45 * cm, y - 0.38 * cm, GREEN, WHITE, 2.2 * cm)
        write(c, formula, L + 3.1 * cm, y - 0.72 * cm, BOLD, 15, NAVY)
        write(c, reason, L + 0.48 * cm, y - 1.65 * cm, REGULAR, 9.5, MUTED, R - L - 0.96 * cm, 14)
        y -= 2.95 * cm
    box(c, L, y, R - L, 4.0 * cm, colors.HexColor("#FFF8D8"), colors.HexColor("#F3D55B"))
    write(c, "Erreur fréquente", L + 0.55 * cm, y - 0.65 * cm, BOLD, 11, NAVY)
    write(c, "Faire 18 - 2 en premier donne 16 × 6 = 96.", L + 0.55 * cm, y - 1.45 * cm, BOLD, 12.5, INK)
    write(c, "Pourquoi c'est faux ?", L + 0.55 * cm, y - 2.18 * cm, BOLD, 10, ORANGE)
    write(c, "La soustraction a été faite avant la parenthèse et avant la multiplication. L'ordre des écritures n'est donc pas toujours l'ordre des calculs.", L + 0.55 * cm, y - 2.85 * cm, REGULAR, 9.5, MUTED, R - L - 1.1 * cm, 14)


def page_rational(c):
    y = base(c, "Jour 1 • Nombres rationnels", "Calculer avec des fractions sans se perdre", "Un nombre rationnel s'écrit a/b, avec a entier et b entier non nul.", 5)
    y -= 0.35 * cm
    box(c, L, y, R - L, 3.05 * cm, MINT, MINT)
    write(c, "Que signifie a/b ?", L + 0.55 * cm, y - 0.7 * cm, BOLD, 11, GREEN)
    write(c, "a est le numérateur : il indique le nombre de parts prises.", L + 0.55 * cm, y - 1.4 * cm, REGULAR, 10.5, INK)
    write(c, "b est le dénominateur : il indique en combien de parts égales l'unité est partagée.", L + 0.55 * cm, y - 2.05 * cm, REGULAR, 10.5, INK, R - L - 1.1 * cm)
    write(c, "b ne peut jamais être égal à 0, car on ne divise pas par zéro.", L + 0.55 * cm, y - 2.68 * cm, BOLD, 9.5, GREEN_DARK)
    y -= 3.5 * cm
    write(c, "Additionner deux fractions", L, y, BOLD, 15, NAVY)
    y -= 0.5 * cm
    for i, (t, b) in enumerate([
        ("Même dénominateur", "On additionne les numérateurs et on garde le dénominateur."),
        ("Dénominateurs différents", "On cherche d'abord un dénominateur commun."),
        ("À la fin", "On simplifie la fraction si le numérateur et le dénominateur ont un diviseur commun."),
    ], 1):
        numbered(c, i, t, b, L, y, R - L)
        y -= 1.92 * cm
    y -= 0.2 * cm
    box(c, L, y, R - L, 5.0 * cm, NAVY, NAVY)
    pill(c, "Exemple", L + 0.55 * cm, y - 0.4 * cm, YELLOW, NAVY, 2.2 * cm)
    write(c, "-3/4 + 5/6", L + 0.55 * cm, y - 1.45 * cm, BOLD, 17, WHITE)
    write(c, "Le plus petit dénominateur commun à 4 et 6 est 12.", L + 0.55 * cm, y - 2.15 * cm, REGULAR, 9.5, colors.HexColor("#D3E4F0"))
    write(c, "-3/4 = -9/12     et     5/6 = 10/12", L + 0.55 * cm, y - 2.95 * cm, BOLD, 12.5, WHITE)
    write(c, "Donc -9/12 + 10/12 = 1/12.", L + 0.55 * cm, y - 3.8 * cm, BOLD, 14, YELLOW)
    write(c, "Vérification : le résultat est positif mais proche de zéro, ce qui est cohérent.", L + 0.55 * cm, y - 4.45 * cm, REGULAR, 9, colors.HexColor("#CFE0EE"))


def page_root_meaning(c):
    y = base(c, "Cours détaillé • 3e", "À quoi sert une racine carrée ?", "On part d'une situation connue avant d'introduire le symbole √.", 6)
    y -= 0.35 * cm
    box(c, L, y, R - L, 4.0 * cm, PALE_BLUE, PALE_BLUE)
    write(c, "Une question de longueur", L + 0.55 * cm, y - 0.68 * cm, BOLD, 11, BLUE)
    write(c, "Un carré a une aire de 25 cm². Combien mesure son côté ?", L + 0.55 * cm, y - 1.5 * cm, BOLD, 14, NAVY, R - L - 1.1 * cm)
    write(c, "On cherche le nombre positif qui, multiplié par lui-même, donne 25.", L + 0.55 * cm, y - 2.35 * cm, REGULAR, 10.5, MUTED, R - L - 1.1 * cm)
    write(c, "Comme 5 × 5 = 25, le côté mesure 5 cm. On écrit √25 = 5.", L + 0.55 * cm, y - 3.18 * cm, BOLD, 11.5, GREEN_DARK, R - L - 1.1 * cm)
    y -= 4.5 * cm
    box(c, L, y, R - L, 3.25 * cm, NAVY, NAVY)
    write(c, "Définition", L + 0.55 * cm, y - 0.7 * cm, BOLD, 11, YELLOW)
    write(c, "Pour a ≥ 0, √a est l'unique nombre positif ou nul dont le carré est égal à a.", L + 0.55 * cm, y - 1.5 * cm, BOLD, 13, WHITE, R - L - 1.1 * cm, 18)
    write(c, "Autrement dit : (√a)² = a.", L + 0.55 * cm, y - 2.55 * cm, REGULAR, 11, colors.HexColor("#D3E4F0"))
    y -= 3.75 * cm
    write(c, "Carrés parfaits à connaître", L, y, BOLD, 15, NAVY)
    y -= 0.55 * cm
    values = [("1²", "1"), ("2²", "4"), ("3²", "9"), ("4²", "16"), ("5²", "25"), ("6²", "36"), ("7²", "49"), ("8²", "64"), ("9²", "81"), ("10²", "100")]
    cell_w = (R - L - 0.8 * cm) / 5
    for i, (square, value) in enumerate(values):
        x = L + (i % 5) * (cell_w + 0.2 * cm)
        top = y - (i // 5) * 2.0 * cm
        box(c, x, top, cell_w, 1.65 * cm, MINT, MINT)
        write(c, square, x + 0.3 * cm, top - 0.58 * cm, BOLD, 10, GREEN)
        write(c, f"= {value}", x + 0.3 * cm, top - 1.18 * cm, BOLD, 12, NAVY)
    y -= 4.45 * cm
    box(c, L, y, R - L, 2.7 * cm, colors.HexColor("#FFF1E6"), colors.HexColor("#FFD2B0"))
    write(c, "Deux précisions importantes", L + 0.55 * cm, y - 0.68 * cm, BOLD, 11, ORANGE)
    write(c, "√25 = 5, jamais -5 : le symbole √ désigne la racine positive.", L + 0.55 * cm, y - 1.4 * cm, BOLD, 10.5, INK)
    write(c, "En revanche, l'équation x² = 25 possède deux solutions : x = 5 ou x = -5.", L + 0.55 * cm, y - 2.1 * cm, REGULAR, 9.5, MUTED)


def page_course(c):
    y = base(c, "Cours détaillé • 3e", "Simplifier une racine carrée", "Simplifier signifie écrire la même valeur sous une forme plus facile à utiliser.", 7)
    y -= 0.35 * cm
    box(c, L, y, R - L, 2.2 * cm, MINT, MINT)
    write(c, "Propriété utilisée", L + 0.55 * cm, y - 0.62 * cm, BOLD, 10, GREEN)
    write(c, "Si a ≥ 0 et b ≥ 0, alors √(a × b) = √a × √b.", L + 0.55 * cm, y - 1.35 * cm, BOLD, 14, NAVY)
    y -= 2.65 * cm
    write(c, "Méthode", L, y, BOLD, 15, NAVY)
    y -= 0.45 * cm
    for i, (t, b) in enumerate([
        ("Repérer", "Chercher le plus grand carré parfait qui divise le nombre."),
        ("Décomposer", "Écrire le nombre comme carré parfait × reste, sans changer sa valeur."),
        ("Appliquer", "Séparer la racine du produit, puis calculer la racine exacte."),
    ], 1):
        numbered(c, i, t, b, L, y, R - L)
        y -= 1.92 * cm
    y -= 0.15 * cm
    box(c, L, y, R - L, 4.45 * cm, NAVY, NAVY)
    pill(c, "Exemple résolu", L + 0.55 * cm, y - 0.4 * cm, YELLOW, NAVY, 3.2 * cm)
    write(c, "Simplifier √48", L + 0.55 * cm, y - 1.5 * cm, BOLD, 18, WHITE)
    write(c, "√48 = √(16 × 3) = √16 × √3 = 4√3", L + 0.55 * cm, y - 2.55 * cm, BOLD, 16, WHITE)
    write(c, "16 convient car 48 ÷ 16 = 3 et √16 = 4. Le nombre 3 reste sous la racine.", L + 0.55 * cm, y - 3.45 * cm, REGULAR, 10, colors.HexColor("#D3E4F0"), R - L - 1.1 * cm, 14)
    y -= 4.9 * cm
    box(c, L, y, R - L, 2.65 * cm, colors.HexColor("#FFF1E6"), colors.HexColor("#FFD2B0"))
    write(c, "Erreur à éviter", L + 0.55 * cm, y - 0.7 * cm, BOLD, 11, ORANGE)
    write(c, "√(a + b) n'est pas égal à √a + √b.", L + 0.55 * cm, y - 1.45 * cm, BOLD, 13, NAVY)
    write(c, "Contre-exemple : √(9 + 16) = √25 = 5, alors que √9 + √16 = 3 + 4 = 7.", L + 0.55 * cm, y - 2.08 * cm, REGULAR, 9.5, MUTED, R - L - 1.1 * cm)


def page_exercises(c):
    y = base(c, "Entraînement progressif", "Des exercices qui montent en difficulté", "L'élève commence par appliquer, puis doit choisir seul la bonne méthode.", 8)
    y -= 0.3 * cm
    levels = [
        ("Niveau 1", "J'applique", GREEN, MINT, ["1. Simplifie √75.", "2. Simplifie √108.", "3. Calcule 3√5 + 2√5."]),
        ("Niveau 2", "Je raisonne", BLUE, PALE_BLUE, ["4. Compare 4√3 et √50.", "5. Écris √12 + √27 sous la forme a√3.", "6. Encadre √70 entre deux entiers."]),
        ("Défi", "Je mobilise", ORANGE, colors.HexColor("#FFF3E8"), ["Une parcelle carrée a une aire de 192 m². Donne la longueur exacte de son côté, puis une valeur approchée au dixième."]),
    ]
    for label, title, accent, fill, questions in levels:
        height = 4.75 * cm if len(questions) == 3 else 3.8 * cm
        box(c, L, y, R - L, height, fill, fill)
        pill(c, label, L + 0.45 * cm, y - 0.38 * cm, accent, WHITE, 2.25 * cm)
        write(c, title, L + 3.0 * cm, y - 0.72 * cm, BOLD, 13, NAVY)
        yy = y - 1.55 * cm
        for q in questions:
            c.setFillColor(WHITE)
            c.circle(L + 0.7 * cm, yy + 0.09 * cm, 0.13 * cm, fill=1, stroke=0)
            yy = write(c, q, L + 1.12 * cm, yy + 0.22 * cm, BOLD if len(questions) == 1 else REGULAR, 10.5, INK, R - L - 1.55 * cm, 15) - 0.22 * cm
        y -= height + 0.45 * cm
    box(c, L, y, R - L, 1.7 * cm, NAVY, NAVY)
    write(c, "Objectif : ne pas seulement obtenir la réponse, mais savoir justifier chaque étape.", L + 0.55 * cm, y - 0.93 * cm, BOLD, 10.5, WHITE, R - L - 1.1 * cm)


def page_correction(c):
    y = base(c, "Corrigé expliqué", "Comprendre l'erreur pour ne plus la refaire", "La correction donne le chemin du raisonnement, pas seulement le résultat.", 9)
    y -= 0.35 * cm
    box(c, L, y, R - L, 2.05 * cm, PALE_BLUE, PALE_BLUE)
    write(c, "Exercice", L + 0.5 * cm, y - 0.62 * cm, BOLD, 9, BLUE)
    write(c, "Simplifie √75.", L + 0.5 * cm, y - 1.35 * cm, BOLD, 16, NAVY)
    y -= 2.5 * cm
    steps = [
        ("01", "Chercher le carré parfait", "75 = 25 × 3"),
        ("02", "Séparer les racines", "√75 = √25 × √3"),
        ("03", "Calculer la racine exacte", "√25 = 5"),
        ("04", "Écrire la réponse", "√75 = 5√3"),
    ]
    for n, title, result in steps:
        box(c, L, y, R - L, 2.05 * cm, WHITE, LINE)
        c.setFillColor(GREEN)
        c.roundRect(L + 0.4 * cm, y - 1.58 * cm, 1.05 * cm, 1.15 * cm, 0.2 * cm, fill=1, stroke=0)
        write(c, n, L + 0.65 * cm, y - 1.13 * cm, BOLD, 12, WHITE)
        write(c, title, L + 1.8 * cm, y - 0.75 * cm, BOLD, 10.5, INK)
        write(c, result, L + 1.8 * cm, y - 1.43 * cm, BOLD, 12, GREEN_DARK)
        y -= 2.3 * cm
    box(c, L, y, R - L, 3.25 * cm, colors.HexColor("#FFF8D8"), colors.HexColor("#F3D55B"))
    write(c, "Diagnostic rapide", L + 0.5 * cm, y - 0.65 * cm, BOLD, 11, NAVY)
    write(c, "Si l'élève écrit √75 = √25 + √3, il confond produit et somme.", L + 0.5 * cm, y - 1.42 * cm, BOLD, 10.5, INK, R - L - 1 * cm)
    write(c, "À revoir : décomposition en facteurs et propriété √(a × b) = √a × √b.", L + 0.5 * cm, y - 2.3 * cm, REGULAR, 9.5, MUTED, R - L - 1 * cm)


def page_real(c):
    y = base(c, "Situation réelle", "Relier les mathématiques à la vie quotidienne", "Une consigne concrète oblige l'élève à identifier lui-même les calculs utiles.", 10)
    y -= 0.35 * cm
    box(c, L, y, R - L, 5.0 * cm, GREEN_DARK, GREEN_DARK)
    pill(c, "Budget de rentrée", L + 0.55 * cm, y - 0.42 * cm, YELLOW, NAVY, 3.55 * cm)
    write(c, "Awa dispose de 30 000 FCFA.", L + 0.55 * cm, y - 1.62 * cm, BOLD, 17, WHITE)
    write(c, "Elle dépense 2/5 de cette somme pour les fournitures, puis 6 500 FCFA pour un sac. Combien lui reste-t-il ?", L + 0.55 * cm, y - 2.55 * cm, REGULAR, 11, WHITE, R - L - 1.1 * cm, 16)
    write(c, "Explique les étapes et vérifie si le résultat est cohérent.", L + 0.55 * cm, y - 4.15 * cm, BOLD, 10, colors.HexColor("#CFEBDD"))
    y -= 5.5 * cm
    write(c, "Ce que l'élève doit savoir faire", L, y, BOLD, 15, NAVY)
    y -= 0.5 * cm
    for i, (t, b) in enumerate([
        ("Traduire", "Calculer 2/5 de 30 000."),
        ("Organiser", "Soustraire les deux dépenses."),
        ("Contrôler", "Comparer la réponse à la somme de départ."),
    ], 1):
        numbered(c, i, t, b, L, y, R - L)
        y -= 1.92 * cm
    y -= 0.15 * cm
    box(c, L, y, R - L, 3.1 * cm, PALE_BLUE, PALE_BLUE)
    write(c, "Passerelle vers la 3e", L + 0.5 * cm, y - 0.68 * cm, BOLD, 10, BLUE)
    write(c, "Le même réflexe sera utilisé en proportionnalité, fonctions et problèmes du BEPC.", L + 0.5 * cm, y - 1.55 * cm, BOLD, 12.5, NAVY, R - L - 1 * cm, 17)
    write(c, "La révision prépare donc directement le travail de l'année.", L + 0.5 * cm, y - 2.45 * cm, REGULAR, 9.5, MUTED)


def page_followup(c):
    y = base(c, "Guide + application", "Du travail écrit au suivi parental", "Le guide fait travailler. L'application aide à corriger, orienter et suivre.", 11)
    y -= 0.35 * cm
    flow = [
        ("1", "Il travaille", "L'élève résout les exercices dans son cahier.", GREEN, MINT),
        ("2", "Il envoie", "Une photo de son travail est ajoutée dans l'application.", BLUE, PALE_BLUE),
        ("3", "Il comprend", "L'analyse signale les erreurs et indique les notions à revoir.", ORANGE, colors.HexColor("#FFF3E8")),
        ("4", "Vous suivez", "Le parent voit les progrès et les prochains objectifs.", GREEN_DARK, MINT),
    ]
    for n, title, body, accent, fill in flow:
        box(c, L, y, R - L, 2.55 * cm, fill, fill)
        c.setFillColor(accent)
        c.circle(L + 0.78 * cm, y - 1.23 * cm, 0.42 * cm, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont(BOLD, 11)
        c.drawCentredString(L + 0.78 * cm, y - 1.37 * cm, n)
        write(c, title, L + 1.55 * cm, y - 0.87 * cm, BOLD, 13, NAVY)
        write(c, body, L + 1.55 * cm, y - 1.55 * cm, REGULAR, 9.5, MUTED, R - L - 2.05 * cm)
        y -= 2.9 * cm
    box(c, L, y, R - L, 3.35 * cm, NAVY, NAVY)
    write(c, "Résultat", L + 0.55 * cm, y - 0.72 * cm, BOLD, 10, YELLOW)
    write(c, "Le parent n'a pas besoin de refaire le cours pour savoir comment aider.", L + 0.55 * cm, y - 1.48 * cm, BOLD, 13.5, WHITE, R - L - 1.1 * cm, 17)
    write(c, "Il voit ce qui est acquis, ce qui bloque et la prochaine étape.", L + 0.55 * cm, y - 2.75 * cm, REGULAR, 10, colors.HexColor("#D3E4F0"))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(PDF), pagesize=A4)
    for drawer in [page_program, page_priority_meaning, page_priority_rules, page_priority_example, page_rational, page_root_meaning, page_course, page_exercises, page_correction, page_real, page_followup]:
        drawer(c)
        c.showPage()
    c.save()
    print(PDF)


if __name__ == "__main__":
    main()
