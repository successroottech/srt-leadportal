from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models.user import User
from app.models.expense import Expense
from app.schemas.expense import ExpenseCreate, ExpenseUpdate, ExpenseOut, ExpenseDecision
from app.services.audit import log_action

router = APIRouter()

MANAGE_ROLES = ("admin", "hr")


@router.get("", response_model=list[ExpenseOut])
def list_expenses(category: str | None = None, approval_status: str | None = None,
                   date_from: date | None = None, date_to: date | None = None,
                   db: Session = Depends(get_db), _: User = Depends(require_roles(*MANAGE_ROLES))):
    q = db.query(Expense)
    if category:
        q = q.filter(Expense.category == category)
    if approval_status:
        q = q.filter(Expense.approval_status == approval_status)
    if date_from:
        q = q.filter(Expense.expense_date >= date_from)
    if date_to:
        q = q.filter(Expense.expense_date <= date_to)
    return q.order_by(Expense.expense_date.desc()).all()


@router.post("", response_model=ExpenseOut)
def create_expense(payload: ExpenseCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(*MANAGE_ROLES))):
    expense = Expense(entered_by=user.id, **payload.model_dump())
    db.add(expense)
    db.flush()
    log_action(db, user_id=user.id, action="create", module="expenses", record_id=expense.id)
    db.commit()
    db.refresh(expense)
    return expense


@router.put("/{expense_id}", response_model=ExpenseOut)
def update_expense(expense_id: int, payload: ExpenseUpdate, db: Session = Depends(get_db), user: User = Depends(require_roles(*MANAGE_ROLES))):
    expense = db.get(Expense, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(expense, field, value)
    log_action(db, user_id=user.id, action="update", module="expenses", record_id=expense.id)
    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/{expense_id}")
def delete_expense(expense_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles("admin"))):
    expense = db.get(Expense, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(expense)
    log_action(db, user_id=user.id, action="delete", module="expenses", record_id=expense_id)
    db.commit()
    return {"detail": "Expense deleted"}


@router.post("/{expense_id}/decision", response_model=ExpenseOut)
def decide_expense(expense_id: int, payload: ExpenseDecision, db: Session = Depends(get_db), user: User = Depends(require_roles("admin"))):
    expense = db.get(Expense, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    if payload.approval_status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Status must be approved or rejected")
    expense.approval_status = payload.approval_status
    expense.approved_by = user.id
    if payload.remarks:
        expense.remarks = payload.remarks
    log_action(db, user_id=user.id, action="approve" if payload.approval_status == "approved" else "reject",
               module="expenses", record_id=expense_id)
    db.commit()
    db.refresh(expense)
    return expense
