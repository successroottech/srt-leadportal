-- =====================================================================
-- SRT MANAGEMENT PORTAL - PostgreSQL Schema
-- Success Root Technologies
--
-- Run as: psql "postgresql://srtdb:PASSWORD@HOST:5432/srt-leadportal" -f schema.sql
-- Idempotent: safe to re-run (uses IF NOT EXISTS / CREATE OR REPLACE).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid(), crypt()

-- ---------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 1. ROLES & PERMISSIONS
-- =====================================================================
CREATE TABLE IF NOT EXISTS roles (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(50) NOT NULL UNIQUE,      -- admin, hr, telecaller, trainer, student (+ custom)
    description     VARCHAR(255),
    is_system       BOOLEAN NOT NULL DEFAULT FALSE,    -- built-in roles cannot be deleted
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id              SERIAL PRIMARY KEY,
    role_id         INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    module          VARCHAR(50) NOT NULL,               -- e.g. 'leads', 'students', 'fees'
    can_view        BOOLEAN NOT NULL DEFAULT FALSE,
    can_create      BOOLEAN NOT NULL DEFAULT FALSE,
    can_edit        BOOLEAN NOT NULL DEFAULT FALSE,
    can_delete      BOOLEAN NOT NULL DEFAULT FALSE,
    can_export      BOOLEAN NOT NULL DEFAULT FALSE,
    can_approve     BOOLEAN NOT NULL DEFAULT FALSE,
    can_assign      BOOLEAN NOT NULL DEFAULT FALSE,
    can_status_update BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (role_id, module)
);

-- =====================================================================
-- 2. USERS (Admin / HR / Telecaller / Trainer staff logins)
-- =====================================================================
CREATE TABLE IF NOT EXISTS users (
    id                  SERIAL PRIMARY KEY,
    staff_code          VARCHAR(30) UNIQUE,
    name                VARCHAR(150) NOT NULL,
    email               VARCHAR(150) UNIQUE,
    mobile              VARCHAR(20) UNIQUE,
    alt_mobile          VARCHAR(20),
    password_hash       VARCHAR(255) NOT NULL,
    role_id             INTEGER NOT NULL REFERENCES roles(id),
    department          VARCHAR(100),
    joining_date        DATE,
    salary              NUMERIC(12,2),
    address             TEXT,
    profile_photo       VARCHAR(255),
    employment_status   VARCHAR(30) DEFAULT 'active',    -- active, resigned, terminated, on_notice
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    must_reset_password BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at       TIMESTAMPTZ,
    last_active_at      TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_users_contact CHECK (email IS NOT NULL OR mobile IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);

DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS login_history (
    id              BIGSERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
    student_id      INTEGER,                             -- set for student logins (FK added after students table)
    login_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    logout_at       TIMESTAMPTZ,
    ip_address      VARCHAR(64),
    user_agent      VARCHAR(255)
);

-- =====================================================================
-- 3. COURSES
-- =====================================================================
CREATE TABLE IF NOT EXISTS courses (
    id              SERIAL PRIMARY KEY,
    course_code     VARCHAR(30) UNIQUE NOT NULL,
    name            VARCHAR(150) NOT NULL,
    description     TEXT,
    duration_weeks  INTEGER,
    regular_fee     NUMERIC(12,2) NOT NULL DEFAULT 0,
    offer_fee       NUMERIC(12,2),
    category        VARCHAR(100),
    syllabus_file   VARCHAR(255),
    image_file      VARCHAR(255),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_courses_updated ON courses;
CREATE TRIGGER trg_courses_updated BEFORE UPDATE ON courses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS course_materials (
    id              SERIAL PRIMARY KEY,
    course_id       INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title           VARCHAR(150) NOT NULL,
    material_type   VARCHAR(20) NOT NULL CHECK (material_type IN ('pdf','word','excel','video','link','other')),
    file_path       VARCHAR(255),
    external_link   VARCHAR(500),
    uploaded_by     INTEGER REFERENCES users(id),
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS course_syllabus_modules (
    id              SERIAL PRIMARY KEY,
    course_id       INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    module_name     VARCHAR(150) NOT NULL,
    sequence        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS course_syllabus_topics (
    id              SERIAL PRIMARY KEY,
    module_id       INTEGER NOT NULL REFERENCES course_syllabus_modules(id) ON DELETE CASCADE,
    topic_name      VARCHAR(150) NOT NULL,
    sequence        INTEGER NOT NULL DEFAULT 0
);

-- =====================================================================
-- 4. BATCHES
-- =====================================================================
CREATE TABLE IF NOT EXISTS batches (
    id                          SERIAL PRIMARY KEY,
    batch_code                  VARCHAR(30) UNIQUE NOT NULL,
    name                        VARCHAR(150) NOT NULL,
    course_id                   INTEGER NOT NULL REFERENCES courses(id),
    trainer_id                  INTEGER REFERENCES users(id),
    start_date                  DATE,
    expected_completion_date    DATE,
    actual_completion_date      DATE,
    batch_start_time            TIME,
    batch_end_time              TIME,
    class_days                  VARCHAR(100),            -- e.g. 'Mon,Wed,Fri'
    batch_mode                  VARCHAR(20) NOT NULL DEFAULT 'offline' CHECK (batch_mode IN ('offline','online','hybrid')),
    location                    VARCHAR(150),
    status                      VARCHAR(20) NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','active','on_hold','completed','cancelled')),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_batches_course ON batches(course_id);
CREATE INDEX IF NOT EXISTS idx_batches_trainer ON batches(trainer_id);
DROP TRIGGER IF EXISTS trg_batches_updated ON batches;
CREATE TRIGGER trg_batches_updated BEFORE UPDATE ON batches
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Per-batch syllabus progress (cloned from course_syllabus_topics when batch is created)
CREATE TABLE IF NOT EXISTS batch_topics (
    id                      SERIAL PRIMARY KEY,
    batch_id                INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    module_name             VARCHAR(150) NOT NULL,
    topic_name              VARCHAR(150) NOT NULL,
    sequence                INTEGER NOT NULL DEFAULT 0,
    planned_date            DATE,
    actual_completion_date  DATE,
    status                  VARCHAR(20) NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed','rescheduled','skipped')),
    completion_percentage   NUMERIC(5,2) NOT NULL DEFAULT 0,
    notes                   TEXT,
    materials               VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS idx_batch_topics_batch ON batch_topics(batch_id);

CREATE TABLE IF NOT EXISTS class_sessions (
    id                  SERIAL PRIMARY KEY,
    batch_id            INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    class_date          DATE NOT NULL,
    planned_start_time  TIME,
    planned_end_time    TIME,
    actual_start_time   TIME,
    actual_end_time     TIME,
    status              VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','missed','cancelled','rescheduled')),
    topics_covered      TEXT,
    trainer_remarks     TEXT,
    admin_remarks       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (batch_id, class_date)
);

-- =====================================================================
-- 5. STUDENTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS students (
    id                          SERIAL PRIMARY KEY,
    student_code                VARCHAR(30) UNIQUE NOT NULL,
    user_id                     INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL, -- login account
    name                        VARCHAR(150) NOT NULL,
    mobile                      VARCHAR(20) NOT NULL,
    alt_mobile                  VARCHAR(20),
    email                       VARCHAR(150),
    dob                         DATE,
    gender                      VARCHAR(20),
    address                     TEXT,
    qualification               VARCHAR(150),
    college_name                VARCHAR(150),
    graduation_year             INTEGER,
    profile_photo               VARCHAR(255),
    admission_type              VARCHAR(30) DEFAULT 'course' CHECK (admission_type IN ('course','job_service','both')),
    course_id                   INTEGER REFERENCES courses(id),
    batch_id                    INTEGER REFERENCES batches(id),
    joining_date                DATE,
    expected_completion_date    DATE,
    actual_completion_date      DATE,
    course_status                VARCHAR(30) NOT NULL DEFAULT 'ongoing' CHECK (course_status IN ('ongoing','completed','dropped','on_hold')),
    placement_required           BOOLEAN NOT NULL DEFAULT FALSE,
    resume_status                VARCHAR(30),
    interview_status             VARCHAR(30),
    selected_company              VARCHAR(150),
    job_role                      VARCHAR(150),
    job_joining_date               DATE,
    salary_package                NUMERIC(12,2),
    placement_status              VARCHAR(30) DEFAULT 'not_applicable' CHECK (placement_status IN ('not_applicable','pending','in_progress','placed','not_placed')),
    lead_id                        INTEGER,                -- originating lead, if converted
    is_active                      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_students_mobile UNIQUE (mobile)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_students_email ON students(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_students_course ON students(course_id);
CREATE INDEX IF NOT EXISTS idx_students_batch ON students(batch_id);
DROP TRIGGER IF EXISTS trg_students_updated ON students;
CREATE TRIGGER trg_students_updated BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE login_history
    ADD CONSTRAINT fk_login_history_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- Batch transfer / assignment history
CREATE TABLE IF NOT EXISTS student_batch_history (
    id              SERIAL PRIMARY KEY,
    student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    batch_id        INTEGER NOT NULL REFERENCES batches(id),
    action          VARCHAR(20) NOT NULL CHECK (action IN ('assigned','transferred_out','transferred_in')),
    remarks         TEXT,
    changed_by      INTEGER REFERENCES users(id),
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_documents (
    id              SERIAL PRIMARY KEY,
    student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    document_type   VARCHAR(100) NOT NULL,
    file_path       VARCHAR(255) NOT NULL,
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 6. FEES / EMI / PAYMENTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS student_fees (
    id                  SERIAL PRIMARY KEY,
    student_id          INTEGER NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
    total_course_fee    NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount             NUMERIC(12,2) NOT NULL DEFAULT 0,
    final_fee            NUMERIC(12,2) NOT NULL DEFAULT 0,
    initial_payment      NUMERIC(12,2) NOT NULL DEFAULT 0,
    balance_fee           NUMERIC(12,2) NOT NULL DEFAULT 0,
    number_of_emis        INTEGER NOT NULL DEFAULT 0,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_student_fees_updated ON student_fees;
CREATE TRIGGER trg_student_fees_updated BEFORE UPDATE ON student_fees
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS fee_emis (
    id                  SERIAL PRIMARY KEY,
    student_fee_id      INTEGER NOT NULL REFERENCES student_fees(id) ON DELETE CASCADE,
    emi_number          INTEGER NOT NULL,
    amount              NUMERIC(12,2) NOT NULL,
    due_date            DATE NOT NULL,
    paid_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
    status              VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','partial','paid','overdue')),
    UNIQUE (student_fee_id, emi_number)
);
CREATE INDEX IF NOT EXISTS idx_fee_emis_due ON fee_emis(due_date);

CREATE TABLE IF NOT EXISTS payments (
    id                  SERIAL PRIMARY KEY,
    receipt_number      VARCHAR(40) UNIQUE NOT NULL,
    student_id          INTEGER NOT NULL REFERENCES students(id),
    course_id           INTEGER REFERENCES courses(id),
    payment_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    amount              NUMERIC(12,2) NOT NULL,
    payment_mode        VARCHAR(20) NOT NULL CHECK (payment_mode IN ('cash','upi','bank_transfer','debit_card','credit_card','cheque','online')),
    transaction_number  VARCHAR(100),
    collected_by        INTEGER REFERENCES users(id),
    remarks             TEXT,
    receipt_file        VARCHAR(255),
    emi_id               INTEGER REFERENCES fee_emis(id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

-- =====================================================================
-- 7. LEADS  (telecalling)
-- =====================================================================
CREATE TABLE IF NOT EXISTS leads (
    id                      SERIAL PRIMARY KEY,
    name                    VARCHAR(150) NOT NULL,
    mobile                  VARCHAR(20) NOT NULL,
    alt_mobile              VARCHAR(20),
    email                   VARCHAR(150),
    lead_type               VARCHAR(20) NOT NULL DEFAULT 'course' CHECK (lead_type IN
        ('course','job','internal_staff')),
    interested_course_id    INTEGER REFERENCES courses(id),
    source                  VARCHAR(30) NOT NULL DEFAULT 'other' CHECK (source IN
        ('website','google_ads','facebook','instagram','linkedin','whatsapp','walk_in','reference','justdial','indiamart','other')),
    assigned_telecaller_id  INTEGER REFERENCES users(id),
    status                  VARCHAR(30) NOT NULL DEFAULT 'new' CHECK (status IN
        ('new','assigned','contacted','interested','follow_up','demo_scheduled','demo_completed',
         'admission_confirmed','converted','not_interested','invalid_number','no_response','closed')),
    follow_up_date          DATE,
    follow_up_time          TIME,
    remarks                 TEXT,
    created_by              INTEGER REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_contacted_at       TIMESTAMPTZ,
    converted_student_id    INTEGER REFERENCES students(id),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_leads_mobile UNIQUE (mobile)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_email ON leads(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_telecaller ON leads(assigned_telecaller_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_followup ON leads(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_leads_type ON leads(lead_type);
DROP TRIGGER IF EXISTS trg_leads_updated ON leads;
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE students ADD CONSTRAINT fk_students_lead FOREIGN KEY (lead_id) REFERENCES leads(id);

CREATE TABLE IF NOT EXISTS lead_followups (
    id              SERIAL PRIMARY KEY,
    lead_id         INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    followup_date   DATE,
    followup_time   TIME,
    remarks         TEXT,
    status_at_time  VARCHAR(30),
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_followups_lead ON lead_followups(lead_id);

-- =====================================================================
-- 8. CANDIDATES (training & placement)
-- =====================================================================
CREATE TABLE IF NOT EXISTS candidates (
    id                      SERIAL PRIMARY KEY,
    candidate_code          VARCHAR(30) UNIQUE NOT NULL,
    name                    VARCHAR(150) NOT NULL,
    mobile                  VARCHAR(20) NOT NULL,
    email                   VARCHAR(150),
    qualification           VARCHAR(150),
    skills                  TEXT,
    experience               VARCHAR(100),
    preferred_job_role       VARCHAR(150),
    preferred_location        VARCHAR(150),
    resume_file                VARCHAR(255),
    assigned_telecaller_id     INTEGER REFERENCES users(id),
    assigned_trainer_id        INTEGER REFERENCES users(id),
    status                     VARCHAR(30) NOT NULL DEFAULT 'new' CHECK (status IN
        ('new','assigned','contacted','documents_pending','training_required','training_in_progress',
         'ready_for_interview','interview_scheduled','selected','rejected','joined','on_hold','closed')),
    follow_up_date              DATE,
    remarks                     TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_candidates_mobile UNIQUE (mobile)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_candidates_email ON candidates(email) WHERE email IS NOT NULL;
DROP TRIGGER IF EXISTS trg_candidates_updated ON candidates;
CREATE TRIGGER trg_candidates_updated BEFORE UPDATE ON candidates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS candidate_interviews (
    id              SERIAL PRIMARY KEY,
    candidate_id    INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    interview_date  DATE,
    company         VARCHAR(150),
    job_role        VARCHAR(150),
    status          VARCHAR(30) DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','selected','rejected','no_show')),
    salary_package  NUMERIC(12,2),
    remarks         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 9. ATTENDANCE
-- =====================================================================
CREATE TABLE IF NOT EXISTS staff_attendance (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    login_time      TIMESTAMPTZ,
    logout_time     TIMESTAMPTZ,
    total_hours     NUMERIC(5,2),
    late_login      BOOLEAN NOT NULL DEFAULT FALSE,
    early_logout    BOOLEAN NOT NULL DEFAULT FALSE,
    break_minutes   INTEGER NOT NULL DEFAULT 0,
    overtime_hours  NUMERIC(5,2) NOT NULL DEFAULT 0,
    last_seen_at    TIMESTAMPTZ,
    status          VARCHAR(20) NOT NULL DEFAULT 'present' CHECK (status IN
        ('present','absent','leave','half_day','late','holiday','week_off')),
    UNIQUE (user_id, attendance_date)
);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON staff_attendance(attendance_date);

CREATE TABLE IF NOT EXISTS staff_attendance_breaks (
    id                      SERIAL PRIMARY KEY,
    staff_attendance_id     INTEGER NOT NULL REFERENCES staff_attendance(id) ON DELETE CASCADE,
    break_start             TIMESTAMPTZ NOT NULL DEFAULT now(),
    break_end               TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_breaks_att ON staff_attendance_breaks(staff_attendance_id);

CREATE TABLE IF NOT EXISTS staff_attendance_sessions (
    id                      SERIAL PRIMARY KEY,
    staff_attendance_id     INTEGER NOT NULL REFERENCES staff_attendance(id) ON DELETE CASCADE,
    login_time              TIMESTAMPTZ NOT NULL DEFAULT now(),
    logout_time             TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_sessions_att ON staff_attendance_sessions(staff_attendance_id);

CREATE TABLE IF NOT EXISTS student_attendance (
    id                  SERIAL PRIMARY KEY,
    student_id          INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    batch_id            INTEGER NOT NULL REFERENCES batches(id),
    class_session_id    INTEGER REFERENCES class_sessions(id) ON DELETE SET NULL,
    attendance_date     DATE NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','leave','late')),
    remarks             TEXT,
    marked_by           INTEGER REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, batch_id, attendance_date)
);
CREATE INDEX IF NOT EXISTS idx_student_attendance_date ON student_attendance(attendance_date);

-- =====================================================================
-- 10. LEAVE & PERMISSION
-- =====================================================================
CREATE TABLE IF NOT EXISTS leave_requests (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
    student_id          INTEGER REFERENCES students(id) ON DELETE CASCADE,
    request_kind        VARCHAR(10) NOT NULL CHECK (request_kind IN ('leave','permission')),
    leave_type          VARCHAR(30) CHECK (leave_type IN ('casual','sick','paid','unpaid','emergency','half_day')),
    permission_type     VARCHAR(30) CHECK (permission_type IN ('late_arrival','early_departure','personal','official')),
    start_date          DATE NOT NULL,
    end_date            DATE NOT NULL,
    start_time          TIME,
    end_time            TIME,
    reason              TEXT,
    supporting_document VARCHAR(255),
    status              VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
    approved_by         INTEGER REFERENCES users(id),
    approval_remarks    TEXT,
    applied_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at          TIMESTAMPTZ,
    CONSTRAINT chk_leave_requester CHECK (
        (user_id IS NOT NULL AND student_id IS NULL) OR (user_id IS NULL AND student_id IS NOT NULL)
    )
);
CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_student ON leave_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);

-- =====================================================================
-- 11. EXPENSES
-- =====================================================================
CREATE TABLE IF NOT EXISTS expenses (
    id                  SERIAL PRIMARY KEY,
    expense_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    category            VARCHAR(50) NOT NULL,
    description         TEXT,
    amount              NUMERIC(12,2) NOT NULL,
    payment_mode        VARCHAR(20) CHECK (payment_mode IN ('cash','upi','bank_transfer','debit_card','credit_card','cheque','online')),
    paid_to             VARCHAR(150),
    invoice_file        VARCHAR(255),
    entered_by          INTEGER REFERENCES users(id),
    approval_status     VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected')),
    approved_by         INTEGER REFERENCES users(id),
    remarks             TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- =====================================================================
-- 12. NOTIFICATIONS
-- =====================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
    student_id          INTEGER REFERENCES students(id) ON DELETE CASCADE,
    title               VARCHAR(200) NOT NULL,
    message             TEXT,
    category            VARCHAR(50),                     -- lead_followup, fee_due, batch, leave, feedback, system...
    reference_table     VARCHAR(50),
    reference_id        INTEGER,
    status              VARCHAR(15) NOT NULL DEFAULT 'unread' CHECK (status IN ('unread','read','dismissed')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at             TIMESTAMPTZ,
    CONSTRAINT chk_notif_recipient CHECK (
        (user_id IS NOT NULL AND student_id IS NULL) OR (user_id IS NULL AND student_id IS NOT NULL)
    )
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_student ON notifications(student_id, status);

-- =====================================================================
-- 13. FEEDBACK & COMPLAINTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS feedback_complaints (
    id              SERIAL PRIMARY KEY,
    student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    type            VARCHAR(30) NOT NULL CHECK (type IN
        ('course_feedback','trainer_feedback','facility_feedback','general_complaint','technical_complaint','fee_complaint')),
    subject         VARCHAR(200) NOT NULL,
    description     TEXT,
    rating          INTEGER CHECK (rating BETWEEN 1 AND 5),
    attachment      VARCHAR(255),
    status          VARCHAR(20) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','under_review','in_progress','resolved','closed')),
    admin_response  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_feedback_updated ON feedback_complaints;
CREATE TRIGGER trg_feedback_updated BEFORE UPDATE ON feedback_complaints
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- 14. AUDIT LOG
-- =====================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id),
    student_id      INTEGER REFERENCES students(id),
    action          VARCHAR(30) NOT NULL,      -- create, update, delete, login, logout, status_change, approve, reject, assign, transfer
    module          VARCHAR(50) NOT NULL,
    record_id       VARCHAR(50),
    previous_value  JSONB,
    updated_value   JSONB,
    ip_address      VARCHAR(64),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);

-- =====================================================================
-- 14. APP SETTINGS (single-row: branding + configurable business rules)
-- =====================================================================
CREATE TABLE IF NOT EXISTS app_settings (
    id                  INTEGER PRIMARY KEY DEFAULT 1,
    portal_name         VARCHAR(150) NOT NULL DEFAULT 'SRT Management Portal',
    organization_name   VARCHAR(150) NOT NULL DEFAULT 'Success Root Technologies',
    logo_path           VARCHAR(255),
    work_start_hour     INTEGER NOT NULL DEFAULT 9,
    work_end_hour       INTEGER NOT NULL DEFAULT 18,
    support_email       VARCHAR(150),
    support_phone       VARCHAR(20),
    address             TEXT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_app_settings_singleton CHECK (id = 1)
);
INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 15. INTERNAL CHAT (staff direct + group messaging)
-- =====================================================================
CREATE TABLE IF NOT EXISTS chat_conversations (
    id              SERIAL PRIMARY KEY,
    type            VARCHAR(10) NOT NULL CHECK (type IN ('direct', 'group')),
    name            VARCHAR(150),
    image_path      VARCHAR(255),
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id                  BIGSERIAL PRIMARY KEY,
    conversation_id     INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    sender_id           INTEGER NOT NULL REFERENCES users(id),
    body                TEXT,
    message_type        VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (message_type IN
        ('text', 'image', 'document', 'voice', 'video')),
    attachment_path     VARCHAR(255),
    attachment_name     VARCHAR(255),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_chat_message_content CHECK (body IS NOT NULL OR attachment_path IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS chat_participants (
    id                      SERIAL PRIMARY KEY,
    conversation_id         INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    user_id                 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_admin                BOOLEAN NOT NULL DEFAULT FALSE,
    last_read_message_id    BIGINT REFERENCES chat_messages(id) ON DELETE SET NULL,
    joined_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_chat_participant UNIQUE (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON chat_participants(user_id);

-- =====================================================================
-- SEED: system roles
-- =====================================================================
INSERT INTO roles (name, description, is_system, is_active)
VALUES
    ('admin', 'Full system access', TRUE, TRUE),
    ('hr', 'Staff, attendance, leave and candidate management', TRUE, TRUE),
    ('telecaller', 'Lead and candidate calling', TRUE, TRUE),
    ('trainer', 'Batch, class and syllabus management', TRUE, TRUE),
    ('student', 'Student self-service portal', TRUE, TRUE)
ON CONFLICT (name) DO NOTHING;
