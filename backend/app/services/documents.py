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
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph

from app.core.config import settings
from app.models.settings import AppSettings
from sqlalchemy.orm import Session

# The base-14 PDF fonts (Helvetica/Times) don't include the Indian Rupee
# glyph (U+20B9); DejaVu Sans does, so the invoice (which prints currency
# amounts) uses it instead. Falls back to Helvetica if the font isn't
# installed on the host, in which case amounts render with "Rs." instead.
try:
    pdfmetrics.registerFont(TTFont("DejaVuSans", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
    pdfmetrics.registerFont(TTFont("DejaVuSans-Bold", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))
    INV_FONT = "DejaVuSans"
    INV_FONT_BOLD = "DejaVuSans-Bold"
    RUPEE = "₹"
except Exception:
    INV_FONT = "Helvetica"
    INV_FONT_BOLD = "Helvetica-Bold"
    RUPEE = "Rs. "

NAVY = HexColor("#1a2b57")
GOLD = HexColor("#f2b705")
SLATE = HexColor("#475569")
INVOICE_BLUE = HexColor("#1d3fd6")
RED = HexColor("#dc2626")
LIGHT_GRAY = HexColor("#e5e7eb")

SIGNATORY_NAME = "K Saranya"
SIGNATORY_TITLE = "HR Manager"
CONTACT_PHONE = "+91 89390 69135"
CONTACT_EMAIL = "hr@successroottech.com"
CONTACT_WEBSITE = "www.successroottech.com"

INVOICE_TERMS = [
    "Placements depend on Interview Performance",
    "Placement Location cannot be assured by the Institute.",
    "Placements can only be given when there is a job vacancy for Freshers.",
    "The job joining date will be confirmed by the Respective Companies.",
    "Interviews will be scheduled after Full Payment of Training fees.",
    "Placements are provided without any cost. Training fees are non-refundable.",
]

BODY_STYLE = ParagraphStyle("body", fontName="Helvetica", fontSize=10.5, leading=15, textColor=NAVY)
BOLD_STYLE = ParagraphStyle("bold", parent=BODY_STYLE, fontName="Helvetica-Bold")
HEADING_STYLE = ParagraphStyle("heading", parent=BODY_STYLE, fontName="Helvetica-Bold", fontSize=12.5, spaceBefore=2, spaceAfter=2)
LIST_STYLE = ParagraphStyle("list", parent=BODY_STYLE, leftIndent=10, bulletIndent=0)

INV_BODY_STYLE = ParagraphStyle("inv_body", fontName=INV_FONT, fontSize=10.5, leading=15, textColor=HexColor("#111827"))
INV_BOLD_STYLE = ParagraphStyle("inv_bold", parent=INV_BODY_STYLE, fontName=INV_FONT_BOLD)
INV_HEADING_STYLE = ParagraphStyle("inv_heading", parent=INV_BODY_STYLE, fontName=INV_FONT_BOLD, fontSize=12)
INV_BULLET_STYLE = ParagraphStyle("inv_bullet", parent=INV_BODY_STYLE, fontSize=9.5, leftIndent=12, bulletIndent=0)


def _fmt_amount(value: float) -> str:
    return f"{RUPEE} {value:,.2f}" if RUPEE == "₹" else f"{RUPEE}{value:,.2f}"


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


def next_invoice_number(db: Session) -> str:
    from app.models.student import StudentDocument

    year = date.today().year
    count = db.query(StudentDocument).filter(StudentDocument.document_type == "invoice").count()
    for _ in range(1000):
        count += 1
        candidate = f"SRT/{year}/{count:05d}"
        exists = db.query(StudentDocument).filter(StudentDocument.invoice_number == candidate).first()
        if not exists:
            return candidate
    raise RuntimeError("Could not generate a unique invoice number")


def _draw_invoice_header(c: canvas.Canvas, org_name: str, tagline: str, logo_path: str | None, width: float, top_y: float) -> float:
    logo = _logo_image_reader(logo_path)
    logo_size = 15 * mm
    gap = 3 * mm
    wordmark_font_size = 16
    wordmark_width = c.stringWidth(org_name.upper(), "Helvetica-Bold", wordmark_font_size)
    block_width = (logo_size + gap if logo else 0) + wordmark_width
    block_x = (width - block_width) / 2

    text_x = block_x
    if logo is not None:
        c.drawImage(logo, block_x, top_y - logo_size, width=logo_size, height=logo_size, mask="auto")
        text_x = block_x + logo_size + gap

    c.setFillColor(HexColor("#111827"))
    c.setFont("Helvetica-Bold", wordmark_font_size)
    c.drawString(text_x, top_y - 8 * mm, org_name.upper())

    c.setFillColor(INVOICE_BLUE)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(width / 2, top_y - 14 * mm, tagline.upper())

    c.setStrokeColor(GOLD)
    c.setLineWidth(1.2)
    c.line(width / 2 - 25 * mm, top_y - 16 * mm, width / 2 + 25 * mm, top_y - 16 * mm)

    c.setFillColor(NAVY)
    return top_y - 24 * mm


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


def generate_invoice(
    db: Session, student, course_name: str, title: str, amount: float, due_date, issue_date,
    invoice_number: str, payment_date, payment_made: float, mode: str | None, verification_code: str,
) -> str:
    app_settings = db.get(AppSettings, 1)
    org_name = app_settings.organization_name if app_settings else "Success Root Technologies"
    logo_path = app_settings.logo_path if app_settings else None
    org_address_lines = (app_settings.address or "Chennai").splitlines() if app_settings else ["Chennai"]

    buf = io.BytesIO()
    width, height = A4
    left = 20 * mm
    right = width - 20 * mm
    content_width = width - 40 * mm
    c = canvas.Canvas(buf, pagesize=A4)

    _draw_watermark(c, width, height)
    y = _draw_invoice_header(c, org_name, "From Basics to Brilliance", logo_path, width, height - 15 * mm)

    c.setFillColor(INVOICE_BLUE)
    c.setFont(INV_FONT_BOLD, 26)
    c.drawCentredString(width / 2, y, "INVOICE")
    y -= 10 * mm

    c.setFillColor(HexColor("#111827"))
    c.setFont(INV_FONT, 11)
    c.drawCentredString(width / 2, y, f"Invoice Date: {issue_date.strftime('%d %B %Y')}")
    y -= 6 * mm
    c.drawCentredString(width / 2, y, f"Invoice Number: {invoice_number}")
    y -= 8 * mm

    c.setStrokeColor(LIGHT_GRAY)
    c.setLineWidth(0.7)
    c.line(left, y, right, y)
    y -= 8 * mm

    c.setFont(INV_FONT_BOLD, 10.5)
    c.drawString(left, y, f"Payment Date: {payment_date.strftime('%d/%m/%Y') if payment_date else '-'}")
    c.drawRightString(right, y, f"Due Date : {due_date.strftime('%d/%m/%Y') if due_date else '-'}")
    y -= 12 * mm

    col2_x = width / 2 + 5 * mm
    col_width = width / 2 - left - 5 * mm

    y_left = _draw_paragraph(c, "<b>Invoice From:</b>", INV_BODY_STYLE, left, y, col_width)
    y_left -= 4 * mm
    y_left = _draw_paragraph(c, org_name, INV_BODY_STYLE, left, y_left, col_width)
    for line in org_address_lines:
        if line.strip():
            y_left -= 4 * mm
            y_left = _draw_paragraph(c, line.strip(), INV_BODY_STYLE, left, y_left, col_width)

    y_right = _draw_paragraph(c, f"<b>Student Name</b>: {student.name}", INV_BODY_STYLE, col2_x, y, col_width)
    y_right -= 4 * mm
    y_right = _draw_paragraph(c, f"<b>Course</b>: <b>{course_name}</b>", INV_BODY_STYLE, col2_x, y_right, col_width)
    y_right -= 4 * mm
    y_right = _draw_paragraph(c, f"<b>Mode</b>: <b>{mode or '-'}</b>", INV_BODY_STYLE, col2_x, y_right, col_width)

    y = min(y_left, y_right) - 10 * mm

    col_x = [left, left + 12 * mm, left + 95 * mm, left + 120 * mm, right]
    c.setStrokeColor(HexColor("#9ca3af"))
    c.setLineWidth(0.7)
    c.line(left, y + 4 * mm, right, y + 4 * mm)
    c.setFont(INV_FONT_BOLD, 10)
    c.setFillColor(HexColor("#111827"))
    c.drawString(col_x[0], y, "#")
    c.drawString(col_x[1], y, "ITEMS")
    c.drawString(col_x[2], y, "QTY")
    c.drawString(col_x[3], y, "RATE")
    c.drawRightString(col_x[4], y, "AMOUNT")
    y -= 4 * mm
    c.line(left, y, right, y)
    y -= 8 * mm

    c.setFont(INV_FONT, 10.5)
    c.drawString(col_x[0], y, "1")
    c.drawString(col_x[1], y, title)
    c.drawString(col_x[2], y, "1")
    c.drawString(col_x[3], y, _fmt_amount(amount))
    c.drawRightString(col_x[4], y, _fmt_amount(amount))
    y -= 4 * mm
    c.line(left, y, right, y)
    y -= 10 * mm

    balance_due = amount - (payment_made or 0)

    c.setFont(INV_FONT, 10.5)
    c.drawRightString(right - 30 * mm, y, "Subtotal (Including GST)")
    c.drawRightString(right, y, _fmt_amount(amount))
    y -= 7 * mm

    c.setFont(INV_FONT_BOLD, 11)
    c.drawRightString(right - 30 * mm, y, "TOTAL")
    c.drawRightString(right, y, _fmt_amount(amount))
    y -= 7 * mm

    c.setFont(INV_FONT, 10.5)
    c.drawRightString(right - 42 * mm, y, "Payment Made")
    c.setFillColor(RED)
    c.drawRightString(right - 30 * mm, y, "(-)")
    c.setFillColor(HexColor("#111827"))
    c.drawRightString(right, y, _fmt_amount(payment_made or 0))
    y -= 8 * mm

    c.setFillColor(LIGHT_GRAY)
    c.rect(left, y - 2 * mm, content_width, 8 * mm, fill=1, stroke=0)
    c.setFillColor(HexColor("#111827"))
    c.setFont(INV_FONT_BOLD, 11)
    c.drawRightString(right - 30 * mm, y, "Balance Due")
    c.drawRightString(right, y, "NIL" if balance_due <= 0 else _fmt_amount(balance_due))
    y -= 15 * mm

    y = _draw_paragraph(c, "Terms &amp; Conditions", INV_HEADING_STYLE, left, y, content_width)
    y -= 3 * mm
    for term in INVOICE_TERMS:
        y = _draw_paragraph(c, f"• {term}", INV_BULLET_STYLE, left, y, content_width)
        y -= 2 * mm

    qr_img = _qr_image_reader(_verification_url(verification_code))
    qr_size = 18 * mm
    c.drawImage(qr_img, right - qr_size, 24 * mm, width=qr_size, height=qr_size)
    c.setFont("Helvetica", 6)
    c.setFillColor(SLATE)
    c.drawCentredString(right - qr_size / 2, 21 * mm, "Scan to verify")

    _draw_footer(c, width)
    c.showPage()
    c.save()
    return _save_pdf(buf)


def create_joining_letter_document(db: Session, student, created_by: int | None = None):
    """Generates a joining letter and adds (but does not commit) the StudentDocument row.
    Shared by the manual "Generate Joining Letter" action and the auto-generation that
    fires when a student's initial payment is recorded."""
    from app.models.course import Course
    from app.models.student import StudentDocument

    course = db.get(Course, student.course_id) if student.course_id else None
    code = new_verification_code()
    file_path = generate_joining_letter(db, student, course.name if course else "-", code)
    doc = StudentDocument(
        student_id=student.id,
        document_type="joining_letter",
        title=f"Joining Letter - {student.name}",
        file_path=file_path,
        verification_code=code,
        created_by=created_by,
    )
    db.add(doc)
    db.flush()
    return doc


def create_invoice_document(db: Session, student, created_by: int | None = None, due_date_override: date | None = None):
    """Generates an invoice entirely from the student's current fee/payment state and adds
    (but does not commit) the StudentDocument row. Returns None if the student has no fee
    record yet. due_date_override lets the very first invoice (generated alongside the
    joining letter) use a fixed "pay within N days" date instead of the next EMI's due date,
    since there's often no EMI schedule yet at that point."""
    from app.models.course import Course
    from app.models.fee import FeeEmi, Payment, StudentFee
    from app.models.student import StudentDocument

    # This app's session is autoflush=False, so a Payment/StudentFee change the caller
    # just made (e.g. recording a payment) would otherwise be invisible to the queries
    # below unless flushed first.
    db.flush()

    course = db.get(Course, student.course_id) if student.course_id else None
    fee = db.query(StudentFee).filter(StudentFee.student_id == student.id).first()
    if not fee:
        return None

    last_payment = db.query(Payment).filter(Payment.student_id == student.id).order_by(Payment.payment_date.desc(), Payment.id.desc()).first()
    next_emi = (
        db.query(FeeEmi)
        .filter(FeeEmi.student_fee_id == fee.id, FeeEmi.status != "paid")
        .order_by(FeeEmi.due_date)
        .first()
    )

    title = "Course Fee"
    amount = float(fee.final_fee)
    payment_made = float(fee.final_fee - fee.balance_fee)
    due_date = due_date_override if due_date_override is not None else (next_emi.due_date if next_emi else None)
    payment_date = last_payment.payment_date if last_payment else None
    mode = last_payment.payment_mode.replace("_", " ").title() if last_payment else None

    code = new_verification_code()
    issue_date = date.today()
    invoice_number = next_invoice_number(db)
    file_path = generate_invoice(
        db, student, course.name if course else "-", title, amount, due_date, issue_date,
        invoice_number, payment_date, payment_made, mode, code,
    )
    doc = StudentDocument(
        student_id=student.id,
        document_type="invoice",
        title=title,
        file_path=file_path,
        amount=amount,
        due_date=due_date,
        issue_date=issue_date,
        invoice_number=invoice_number,
        payment_date=payment_date,
        payment_made=payment_made,
        mode=mode,
        verification_code=code,
        created_by=created_by,
    )
    db.add(doc)
    db.flush()
    return doc
