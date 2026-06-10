from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor

prs = Presentation()
slide_layout = prs.slide_layouts[1]  # Title and Content
slide = prs.slides.add_slide(slide_layout)

# Title
title = slide.shapes.title
title.text = "MifosX4MM — Week 1: Learning & Exploring"

# Bullet content
body = slide.shapes.placeholders[1].text_frame
body.clear()
body.word_wrap = True

bullets = [
    "Purpose: Full-stack microfinance platform (Apache Fineract + web/mobile).",
    "Architecture: Fastify API gateway, Keycloak, Fineract, KYC, mobile-money, reporting, Next.js UI.",
    "Core Data: Fineract (MySQL); reporting reads SQL for PAR metrics.",
    "Dev Run: pnpm docker:up → pnpm dev; pnpm seed to load test data.",
    "Learning Outcomes: Run full stack, trace web→gateway→Fineract, decode JWT, run PAR30 SQL.",
    "Extensible: Pluggable KYC providers; clear typed contracts in packages/shared-types.",
]

for i, b in enumerate(bullets):
    if i == 0:
        p = body.paragraphs[0]
        p.text = b
        p.level = 0
    else:
        p = body.add_paragraph()
        p.text = b
        p.level = 0

# Add a small footer with key files (as notes links are also added in speaker notes)
left = Inches(0.5)
top = Inches(5.2)
width = Inches(9)
height = Inches(0.6)
footer = slide.shapes.add_textbox(left, top, width, height)
f_tf = footer.text_frame
f_run = f_tf.paragraphs[0].add_run()
f_run.text = "Key files: docs/ARCHITECTURE.md | apps/api/src/index.ts | apps/web/src/app/(protected)/dashboard/page.tsx"
font = f_run.font
font.size = Pt(10)
font.italic = True
font.color.rgb = RGBColor(80, 80, 80)

# Speaker notes
notes = slide.notes_slide.notes_text_frame
notes.text = (
    "MifosX4MM pairs Apache Fineract’s core banking with modern frontends and pluggable services. "
    "Week 1: run the full stack locally, trace requests end-to-end, and demonstrate KPIs like PAR30.\n\n"
    "Demo checklist:\n"
    "1) Login & Dashboard: http://localhost:3000 (admin / Admin@1234)\n"
    "2) Clients & Loans pages: open a client and show repayment schedule\n"
    "3) API + JWT: run login curl, paste token to jwt.io, call /api/v1/dashboard/stats\n\n"
    "Known risks: reporting endpoint exposure if misconfigured; KYC stub stores in-memory; KBZ Pay signature verification must be configured.\n\n"
    "Files for follow-up: docs/ARCHITECTURE.md, docs/ONBOARDING.md, packages/shared-types/src/index.ts"
)

# Add clickable links in the notes (pptx doesn't support clickable links in notes reliably across viewers),
# but we can add hyperlinks to the footer text runs in the slide content.
try:
    # Add hyperlinks to the footer run by splitting and adding separate runs
    f_tf.clear()
    p = f_tf.paragraphs[0]
    run1 = p.add_run()
    run1.text = "Architecture"
    run1.font.size = Pt(10)
    run1.font.color.rgb = RGBColor(0, 102, 204)
    run1.hyperlink.address = "docs/ARCHITECTURE.md"

    run2 = p.add_run()
    run2.text = "  |  "
    run2.font.size = Pt(10)
    run2.font.color.rgb = RGBColor(80, 80, 80)

    run3 = p.add_run()
    run3.text = "API entry"
    run3.font.size = Pt(10)
    run3.font.color.rgb = RGBColor(0, 102, 204)
    run3.hyperlink.address = "apps/api/src/index.ts"

    run4 = p.add_run()
    run4.text = "  |  "
    run4.font.size = Pt(10)
    run4.font.color.rgb = RGBColor(80, 80, 80)

    run5 = p.add_run()
    run5.text = "Dashboard"
    run5.font.size = Pt(10)
    run5.font.color.rgb = RGBColor(0, 102, 204)
    run5.hyperlink.address = "apps/web/src/app/(protected)/dashboard/page.tsx"
except Exception as e:
    # Not fatal; continue
    print("Warning adding hyperlinks:", e)

# Save presentation
out_path = "mifos-week1-summary.pptx"
prs.save(out_path)
print(f"Saved {out_path}")
