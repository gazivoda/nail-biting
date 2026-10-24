"""Render the evidence report without substituting unknown metrics with scores.

uv run --no-project --with reportlab python docs/seo/audits/2026-10-23/render-report.py
"""

from pathlib import Path
import re
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate


def inline(text):
    text = escape(text)
    text = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", r'<link href="\2" color="#245944">\1</link>', text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    return re.sub(r"`([^`]+)`", r'<font name="Courier" size="8">\1</font>', text)


def render():
    folder = Path(__file__).resolve().parent
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("ReportTitle", fontName="Helvetica-Bold", fontSize=23, leading=28, textColor=colors.HexColor("#245944"), spaceAfter=18))
    styles.add(ParagraphStyle("ReportSection", fontName="Helvetica-Bold", fontSize=14, leading=18, spaceBefore=16, spaceAfter=7, keepWithNext=True))
    styles.add(ParagraphStyle("ReportSubsection", fontName="Helvetica-Bold", fontSize=11, leading=15, spaceBefore=10, spaceAfter=5, keepWithNext=True))
    styles.add(ParagraphStyle("ReportBody", fontName="Helvetica", fontSize=9.5, leading=14, spaceAfter=8))
    styles.add(ParagraphStyle("ReportBullet", parent=styles["ReportBody"], leftIndent=12, firstLineIndent=0, bulletIndent=0))

    story = []
    for block in re.split(r"\n\s*\n", (folder / "REPORT.md").read_text()):
        block = block.strip()
        if not block:
            continue
        if block.startswith("### "):
            story.append(Paragraph(inline(block[4:]), styles["ReportSubsection"]))
        elif block.startswith("## "):
            story.append(Paragraph(inline(block[3:]), styles["ReportSection"]))
        elif block.startswith("# "):
            story.append(Paragraph(inline(block[2:]), styles["ReportTitle"]))
        elif re.match(r"(?:- |\d+\. )", block):
            for line in block.splitlines():
                match = re.match(r"(-|\d+\.) (.*)", line)
                if match:
                    story.append(Paragraph(inline(match[2]), styles["ReportBullet"], bulletText=match[1]))
        else:
            story.append(Paragraph(inline(" ".join(block.splitlines())), styles["ReportBody"]))

    def footer(canvas, document):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor("#d8ddd7"))
        canvas.line(document.leftMargin, 35, document.pagesize[0] - document.rightMargin, 35)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor("#53615a"))
        canvas.drawString(document.leftMargin, 23, "STOP BITING  /  SEO + GEO  /  23 OCT 2026")
        canvas.drawRightString(document.pagesize[0] - document.rightMargin, 23, str(document.page))
        canvas.restoreState()

    output = folder / "REPORT.pdf"
    document = SimpleDocTemplate(str(output), pagesize=(8.5 * inch, 11 * inch), leftMargin=48, rightMargin=48, topMargin=44, bottomMargin=49, title="Stop Biting: SEO and GEO traffic review", author="Stop Biting", pageCompression=1)
    document.build(story, onFirstPage=footer, onLaterPages=footer)
    print(f"Generated {output} ({output.stat().st_size:,} bytes)")


if __name__ == "__main__":
    render()
