# SRT Management Portal — Software Requirements Specification

This document is the original Software Requirements Specification (SRS) provided by
Success Root Technologies for the SRT Management Portal. It is preserved here as the
reference source of truth for scope and business rules. Section 19 at the end maps
each SRS area to its current implementation status.

## 1. Project Overview

**Project Name:** SRT Management Portal
**Organization:** Success Root Technologies
**Portal Type:** Web-based and mobile-responsive management portal

The portal manages the complete operations of Success Root Technologies, including:
leads and telecalling, student admissions, course and batch management, trainer
activities, staff attendance, student attendance, fee collection, expenses and
profit reports, candidate placement tracking, leave and permission requests,
notifications, and feedback and complaints.

## 2. User Roles

1. Admin
2. HR
3. Telecaller
4. Trainer
5. Student

Each role has a separate dashboard and permission set.

## 3. Common Login Features

Secure login by email or mobile, password reset, change password, profile
management, role-based access, login/logout history, in-app notifications,
mobile-responsive dashboard, session timeout, account active/inactive status.

## 4. Admin Login

Full control: dashboard, role management, staff management, leads dashboard,
attendance dashboard, fee dashboard, profit dashboard, course master, batch
management, batch dashboard, daily batch follow-up, student master, candidate
management, lead management, expense management, leave & permission management,
notifications, reports & export.

## 5. HR Login

Staff, attendance, leave/permission, candidate management, interviews,
placement tracking, reports. Cannot delete the Admin account, change Admin
permissions, view/change system configuration, or delete financial
transactions without Admin permission.

## 6. Telecaller Login

Assigned leads, lead creation and status updates, duplicate lead prevention,
today's follow-ups, notifications, attendance, leave/permission. Cannot delete
leads, export leads, edit another telecaller's leads, change lead ownership,
or view all leads unless permitted.

## 7. Trainer Login

Assigned batches, class start/end, attendance marking, syllabus/topic
progress, class materials, notifications, attendance, leave/permission.

## 8. Student Login

Dashboard, course syllabus, notifications, fee details, leave, feedback and
complaints.

## 9–14. Attendance, Fee Payment, Notifications, Search & Filters, Audit Log, Security

See original specification for full field-level detail — all of this is
reflected directly in `database/schema.sql` and the corresponding API/UI.

## 15. Recommended Development Phases

- **Phase 1 – Core MVP:** login/roles, staff, leads, telecaller dashboard,
  courses, batches, students, trainer/student dashboards, basic attendance
  and fee tracking, in-app notifications.
- **Phase 2 – Operations & Finance:** detailed attendance, leave/permission,
  expenses, profit dashboard, EMI management, fee reminders, candidates,
  bulk uploads, reports/exports.
- **Phase 3 – Advanced:** WhatsApp/SMS/email integration, online payments,
  mobile app, biometric attendance, automated follow-ups, advanced
  analytics, certificates, ticketing.

## 16–18. Main Menu, Technology Structure, Business Rules

Implemented as specified — see `docs/DATABASE.md` and `docs/API.md`.

---

## 19. Implementation Status (this build)

| Area | Status |
|---|---|
| Roles & permission matrix | ✅ Implemented (`roles`, `role_permissions`) |
| Staff management | ✅ Implemented |
| Leads + duplicate prevention + conversion | ✅ Implemented |
| Candidates + interviews | ✅ Implemented |
| Courses + syllabus | ✅ Implemented |
| Batches + syllabus progress + class sessions | ✅ Implemented |
| Students + fee/EMI + batch transfer | ✅ Implemented |
| Staff & student attendance | ✅ Implemented (manual login/logout + marking) |
| Fee collection, EMI schedule, payment receipts | ✅ Implemented |
| Expenses + approval workflow | ✅ Implemented |
| Profit & loss dashboard | ✅ Implemented |
| Leave & permission workflow | ✅ Implemented |
| In-app notifications | ✅ Implemented |
| Feedback & complaints | ✅ Implemented |
| Audit log | ✅ Implemented |
| Reports export (Excel/CSV/PDF/Print) | ⏳ Not yet built — data is available via API/DB for a future export layer |
| WhatsApp / SMS / Email integration | ⏳ Phase 3, intentionally excluded (no third-party APIs per project instruction) |
| Online fee payment gateway | ⏳ Phase 3, intentionally excluded (no third-party APIs) |
| Mobile app / biometric attendance | ⏳ Phase 3 |
| Docker / CI-CD | ⏳ To be added in a later pass (explicitly deferred by the project owner) |

This build covers Phase 1 fully and the large majority of Phase 2. Phase 3 items
depend on third-party services and were intentionally left out per the "no
third-party APIs" instruction; the schema and API are structured so they can be
added later without breaking changes.
