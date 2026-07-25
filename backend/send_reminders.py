"""Send daily in-app reminder notifications (lead follow-ups, fee dues, batch closing).

Run once per day via the srt-reminders.timer systemd unit:
    python send_reminders.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from app.services.reminders import run_daily_reminders


def main():
    db = SessionLocal()
    try:
        result = run_daily_reminders(db)
        print(f"Reminders sent: {result}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
