import io
import os
import secrets
import uuid

import qrcode
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from app.core.config import settings
from app.models.settings import AppSettings
from sqlalchemy.orm import Session


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


def _letterhead(c: canvas.Canvas, org_name: str, width: float, y: float) -> float:
    c.setFont("Helvetica-Bold", 16)
    c.drawString(20 * mm, y, org_name)
    c.setFont("Helvetica", 9)
    c.line(20 * mm, y - 4 * mm, width - 20 * mm, y - 4 * mm)
    return y - 14 * mm


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

    buf = io.BytesIO()
    width, height = A4
    c = canvas.Canvas(buf, pagesize=A4)
    y = _letterhead(c, org_name, width, height - 20 * mm)

    c.setFont("Helvetica-Bold", 13)
    c.drawCentredString(width / 2, y, "JOINING LETTER")
    y -= 12 * mm

    c.setFont("Helvetica", 11)
    lines = [
        f"Date: {student.joining_date or ''}",
        "",
        f"Dear {student.name},",
        "",
        f"We are pleased to confirm your admission to the \"{course_name}\" program at {org_name}.",
        f"Your Student ID is {student.student_code}.",
        f"Joining Date: {student.joining_date or '-'}",
        f"Expected Completion Date: {student.expected_completion_date or '-'}",
        "",
        "We look forward to supporting you throughout your learning journey.",
        "",
        "Welcome aboard!",
    ]
    for line in lines:
        c.drawString(20 * mm, y, line)
        y -= 7 * mm

    qr_img = _qr_image_reader(_verification_url(verification_code))
    c.drawImage(qr_img, width - 45 * mm, 15 * mm, width=25 * mm, height=25 * mm)
    c.setFont("Helvetica", 7)
    c.drawString(width - 45 * mm, 12 * mm, "Scan to verify")
    c.showPage()
    c.save()
    return _save_pdf(buf)


def generate_invoice(db: Session, student, title: str, amount: float, due_date, issue_date, verification_code: str) -> str:
    app_settings = db.get(AppSettings, 1)
    org_name = app_settings.organization_name if app_settings else "Success Root Technologies"

    buf = io.BytesIO()
    width, height = A4
    c = canvas.Canvas(buf, pagesize=A4)
    y = _letterhead(c, org_name, width, height - 20 * mm)

    c.setFont("Helvetica-Bold", 13)
    c.drawCentredString(width / 2, y, "INVOICE")
    y -= 12 * mm

    c.setFont("Helvetica", 11)
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
    for line in details:
        c.drawString(20 * mm, y, line)
        y -= 7 * mm

    qr_img = _qr_image_reader(_verification_url(verification_code))
    c.drawImage(qr_img, width - 45 * mm, 15 * mm, width=25 * mm, height=25 * mm)
    c.setFont("Helvetica", 7)
    c.drawString(width - 45 * mm, 12 * mm, "Scan to verify")
    c.showPage()
    c.save()
    return _save_pdf(buf)
