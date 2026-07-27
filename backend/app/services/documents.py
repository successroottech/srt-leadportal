import io
import os
import secrets
import uuid
from datetime import date

import qrcode
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph

from app.core.config import settings
from app.models.settings import AppSettings
from sqlalchemy.orm import Session

NAVY = HexColor("#1a2b57")
GOLD = HexColor("#f2b705")
SLATE = HexColor("#475569")

SIGNATORY_NAME = "K Saranya"
SIGNATORY_TITLE = "HR Manager"
CONTACT_PHONE = "+91 89390 69135"
CONTACT_EMAIL = "hr@successroottech.com"
CONTACT_WEBSITE = "www.successroottech.com"

BODY_STYLE = ParagraphStyle("body", fontName="Helvetica", fontSize=10.5, leading=15, textColor=NAVY)
BOLD_STYLE = ParagraphStyle("bold", parent=BODY_STYLE, fontName="Helvetica-Bold")
HEADING_STYLE = ParagraphStyle("heading", parent=BODY_STYLE, fontName="Helvetica-Bold", fontSize=12.5, spaceBefore=2, spaceAfter=2)
LIST_STYLE = ParagraphStyle("list", parent=BODY_STYLE, leftIndent=10, bulletIndent=0)


def new_verification_code() -> str:
    return secrets.token_hex(12)


def _verification_url(code: str) -> str:
    return f"{settings.PUBLIC_BASE_URL}/verify/{code}"


def _qr_image_reader(url: str) -> ImageReader:
    qr = qrcode.QRCode(border=1, box_size=6)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return ImageReader(buf)

def _logo_image_reader(logo_path: str | None) -> ImageReader | None:
    if not logo_path:
        return None
    fs_path = os.path.join(settings.UPLOAD_DIR, os.path.basename(logo_path))
    if not os.path.exists(fs_path):
        return None
    return ImageReader(fs_path)


def _draw_watermark(c: canvas.Canvas, width: float, height: float) -> None:
    c.saveState()
    c.setFillColor(NAVY)
    c.setFillAlpha(0.05)
    c.translate(width / 2, height / 2)
    c.rotate(35)
    c.setFont("Helvetica-Bold", 160)
    c.drawCentredString(0, 0, "SRT")
    c.restoreState()


def _draw_header(c: canvas.Canvas, org_name: str, tagline: str, logo_path: str | None, width: float, top_y: float) -> float:
    logo = _logo_image_reader(logo_path)
    text_x = 20 * mm
    if logo is not None:
        logo_size = 16 * mm
        c.drawImage(logo, 20 * mm, top_y - logo_size, width=logo_size, height=logo_size, mask="auto")
        text_x = 20 * mm + logo_size + 4 * mm

    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(text_x, top_y - 6 * mm, org_name.upper())
    c.setFillColor(GOLD)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(text_x, top_y - 11 * mm, tagline.upper())

    c.setStrokeColor(NAVY)
    c.setLineWidth(0.8)
    line_y = top_y - 18 * mm
    c.line(20 * mm, line_y, width - 20 * mm, line_y)
    c.setFillColor(NAVY)
    return line_y - 8 * mm


def _draw_footer(c: canvas.Canvas, width: float) -> None:
    y = 12 * mm
    c.setFont("Helvetica", 8.5)
    c.setFillColor(SLATE)
    text = f"{CONTACT_PHONE}      {CONTACT_EMAIL}      {CONTACT_WEBSITE}"
    c.drawCentredString(width / 2, y, text)

    tw = c.stringWidth(text, "Helvetica", 8.5)
    start_x = width / 2 - tw / 2
    email_start = start_x + c.stringWidth(f"{CONTACT_PHONE}      ", "Helvetica", 8.5)
    email_width = c.stringWidth(CONTACT_EMAIL, "Helvetica", 8.5)
    c.linkURL(f"mailto:{CONTACT_EMAIL}", (email_start, y - 1, email_start + email_width, y + 7), relative=0)
    web_start = email_start + email_width + c.stringWidth("      ", "Helvetica", 8.5)
    web_width = c.stringWidth(CONTACT_WEBSITE, "Helvetica", 8.5)
    c.linkURL(f"https://{CONTACT_WEBSITE}", (web_start, y - 1, web_start + web_width, y + 7), relative=0)


def _draw_paragraph(c: canvas.Canvas, text: str, style: ParagraphStyle, x: float, y: float, max_width: float) -> float:
    p = Paragraph(text, style)
    _, h = p.wrap(max_width, 1000)
    p.drawOn(c, x, y - h)
    return y - h


def _save_pdf(buf: io.BytesIO) -> str:
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}.pdf"
    path = os.path.join(settings.UPLOAD_DIR, stored_name)
    with open(path, "wb") as f:
        f.write(buf.getvalue())
    return f"/uploads/{stored_name}"


def generate_joining_letter(db: Session, student, course_name: str, verification_code: str) -> str:
    app_settings = db.get(AppSettings, 1)
    org_name = app_settings.organization_name if app_settings else "Success Root Technologies"
    logo_path = app_settings.logo_path if app_settings else None

    buf = io.BytesIO()
    width, height = A4
    left = 20 * mm
    content_width = width - 40 * mm
    c = canvas.Canvas(buf, pagesize=A4)

    _draw_watermark(c, width, height)
    y = _draw_header(c, org_name, "From Basics to Brilliance", logo_path, width, height - 15 * mm)

    c.setFont("Helvetica-Bold", 13)
    c.setFillColor(NAVY)
    c.drawCentredString(width / 2, y, f"JOINING LETTER - {org_name}")
    y -= 10 * mm

    academic_year = student.joining_date.year if student.joining_date else date.today().year

    y = _draw_paragraph(c, f"Dear <b>{student.name}</b>", BOLD_STYLE, left, y, content_width)
    y -= 6 * mm

    intro = (
        f"<b>Congratulations!!!</b> We are happy to inform you that your admission to "
        f"<b>{org_name}</b> for the <b>{course_name}</b> course for the academic year "
        f"{academic_year} has been confirmed."
    )
    y = _draw_paragraph(c, intro, BODY_STYLE, left, y, content_width)
    y -= 7 * mm

    y = _draw_paragraph(c, "About Us", HEADING_STYLE, left, y, content_width)
    y -= 2 * mm
    about_us = (
        f"<b>{org_name}</b>, founded with a mission to bridge the skill gap in the tech industry, is a "
        "leading provider of training and placement support in the software development and analytics "
        "domain. We specialize in equipping students from IT and non-IT backgrounds with practical, "
        "job-oriented skills in Python, Power BI, SQL, web development, and more. Our training programs "
        "are meticulously designed to prepare you for high-quality job opportunities in growing sectors "
        "like data analytics, automation, reporting, and development."
    )
    y = _draw_paragraph(c, about_us, BODY_STYLE, left, y, content_width)
    y -= 7 * mm

    y = _draw_paragraph(c, "Admission Details", HEADING_STYLE, left, y, content_width)
    y -= 2 * mm
    y = _draw_paragraph(c, f"<b>Student Name</b>: <b>{student.name}</b>", BODY_STYLE, left + 5 * mm, y, content_width - 5 * mm)
    y -= 2 * mm
    y = _draw_paragraph(c, f"<b>Course Name</b>: <b>{course_name}</b>", BODY_STYLE, left + 5 * mm, y, content_width - 5 * mm)
    y -= 7 * mm

    y = _draw_paragraph(c, "Placement Terms &amp; Conditions", HEADING_STYLE, left, y, content_width)
    y -= 2 * mm
    terms = [
        ("Placement Assurance", "Placement assistance is dependent on the candidate's interview performance and project work."),
        ("Vacancy Requirements", "Placements will be facilitated based on the availability of openings suited for freshers or trainees."),
        ("Job Confirmation", "Joining dates will be determined by the respective hiring companies."),
        ("Fee Compliance", "Interviews will be scheduled only upon full payment of training fees."),
        ("Certification Requirements", "Job assistance will be provided only upon successful completion of the course assessments and final project submission."),
        ("Cost", "Placement support is provided at no additional cost. Training fees are non-refundable."),
    ]
    for i, (lead, rest) in enumerate(terms, start=1):
        y = _draw_paragraph(c, f"{i}. <b>{lead}</b>: {rest}", LIST_STYLE, left, y, content_width)
        y -= 2 * mm
    y -= 5 * mm

    closing = (
        "We are confident that our comprehensive training program will empower you to achieve a "
        "successful career in your chosen field."
    )
    y = _draw_paragraph(c, closing, BODY_STYLE, left, y, content_width)
    y -= 10 * mm

    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(NAVY)
    c.drawString(left, y, "Warm regards,")
    y -= 7 * mm
    c.drawString(left, y, f"{SIGNATORY_NAME} ( {SIGNATORY_TITLE} )")
    c.setFont("Helvetica", 11)
    c.drawString(width - 85 * mm, y, "Signature of Candidate: ________")

    qr_img = _qr_image_reader(_verification_url(verification_code))
    qr_size = 22 * mm
    c.drawImage(qr_img, width - 20 * mm - qr_size, 22 * mm, width=qr_size, height=qr_size)
    c.setFont("Helvetica", 6.5)
    c.setFillColor(SLATE)
    c.drawCentredString(width - 20 * mm - qr_size / 2, 19 * mm, "Scan to verify")

    _draw_footer(c, width)
    c.showPage()
    c.save()
    return _save_pdf(buf)


def generate_invoice(db: Session, student, title: str, amount: float, due_date, issue_date, verification_code: str) -> str:
    app_settings = db.get(AppSettings, 1)
    org_name = app_settings.organization_name if app_settings else "Success Root Technologies"
    logo_path = app_settings.logo_path if app_settings else None

    buf = io.BytesIO()
    width, height = A4
    left = 20 * mm
    content_width = width - 40 * mm
    c = canvas.Canvas(buf, pagesize=A4)

    _draw_watermark(c, width, height)
    y = _draw_header(c, org_name, "From Basics to Brilliance", logo_path, width, height - 15 * mm)

    c.setFont("Helvetica-Bold", 13)
    c.setFillColor(NAVY)
    c.drawCentredString(width / 2, y, "INVOICE")
    y -= 10 * mm

    details = [
        f"Invoice Date: {issue_date}",
        f"Due Date: {due_date or '-'}",
        "",
        f"Billed To: {student.name} ({student.student_code})",
        f"Mobile: {student.mobile}",
        "",
        f"Description: {title}",
        f"Amount Due: Rs. {amount:,.2f}",
    ]
    c.setFont("Helvetica", 11)
    for line in details:
        c.drawString(left, y, line)
        y -= 7 * mm

    qr_img = _qr_image_reader(_verification_url(verification_code))
    qr_size = 22 * mm
    c.drawImage(qr_img, width - 20 * mm - qr_size, 22 * mm, width=qr_size, height=qr_size)
    c.setFont("Helvetica", 6.5)
    c.setFillColor(SLATE)
    c.drawCentredString(width - 20 * mm - qr_size / 2, 19 * mm, "Scan to verify")

    _draw_footer(c, width)
    c.showPage()
    c.save()
    return _save_pdf(buf)
