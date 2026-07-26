import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import PublicRegister from "./pages/PublicRegister";

import AdminDashboard from "./pages/admin/Dashboard";
import Roles from "./pages/admin/Roles";
import AdminStaff from "./pages/admin/Staff";
import Courses from "./pages/admin/Courses";
import AdminExpenses from "./pages/admin/Expenses";
import AdminFees from "./pages/admin/Fees";
import AdminProfit from "./pages/admin/Profit";
import AdminAttendance from "./pages/admin/Attendance";
import LeaveApprovals from "./pages/admin/LeaveApprovals";
import FeedbackAdmin from "./pages/admin/Feedback";
import AuditLogs from "./pages/admin/AuditLogs";
import LeadsDashboard from "./pages/admin/LeadsDashboard";
import CandidatesDashboard from "./pages/admin/CandidatesDashboard";
import BatchDashboard from "./pages/admin/BatchDashboard";
import DailyFollowupPage from "./pages/shared/DailyFollowupPage";
import AdminSettings from "./pages/admin/Settings";
import ChatPage from "./pages/shared/ChatPage";

import HrDashboard from "./pages/hr/Dashboard";

import TelecallerDashboard from "./pages/telecaller/Dashboard";

import TrainerDashboard from "./pages/trainer/Dashboard";

import StudentDashboard from "./pages/student/Dashboard";
import MyCourse from "./pages/student/MyCourse";
import MyAttendance from "./pages/student/MyAttendance";
import MyFees from "./pages/student/MyFees";
import MyFeedback from "./pages/student/MyFeedback";

import LeadsPage from "./pages/shared/LeadsPage";
import CandidatesPage from "./pages/shared/CandidatesPage";
import StudentsPage from "./pages/shared/StudentsPage";
import BatchesPage from "./pages/shared/BatchesPage";
import StaffAttendanceSelf from "./pages/shared/StaffAttendanceSelf";
import StaffLeaveSelf from "./pages/shared/StaffLeaveSelf";
import NotificationsPage from "./pages/shared/NotificationsPage";

function RoleHome() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={`/${user.role}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <SettingsProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<PublicRegister />} />
          <Route path="/" element={<RoleHome />} />

          <Route element={<ProtectedRoute roles={["admin"]} />}>
            <Route element={<Layout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/roles" element={<Roles />} />
              <Route path="/admin/staff" element={<AdminStaff />} />
              <Route path="/admin/leads" element={<LeadsPage allowManage />} />
              <Route path="/admin/leads-dashboard" element={<LeadsDashboard />} />
              <Route path="/admin/candidates" element={<CandidatesPage allowManage />} />
              <Route path="/admin/candidates-dashboard" element={<CandidatesDashboard />} />
              <Route path="/admin/students" element={<StudentsPage />} />
              <Route path="/admin/courses" element={<Courses />} />
              <Route path="/admin/batches" element={<BatchesPage allowManage />} />
              <Route path="/admin/batch-dashboard" element={<BatchDashboard />} />
              <Route path="/admin/daily-followup" element={<DailyFollowupPage allowManage />} />
              <Route path="/admin/attendance" element={<AdminAttendance />} />
              <Route path="/admin/fees" element={<AdminFees />} />
              <Route path="/admin/expenses" element={<AdminExpenses />} />
              <Route path="/admin/profit" element={<AdminProfit />} />
              <Route path="/admin/leave" element={<LeaveApprovals />} />
              <Route path="/admin/feedback" element={<FeedbackAdmin />} />
              <Route path="/admin/notifications" element={<NotificationsPage />} />
              <Route path="/admin/audit-logs" element={<AuditLogs />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
              <Route path="/admin/chat" element={<ChatPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={["hr"]} />}>
            <Route element={<Layout />}>
              <Route path="/hr" element={<HrDashboard />} />
              <Route path="/hr/staff" element={<AdminStaff />} />
              <Route path="/hr/attendance" element={<AdminAttendance />} />
              <Route path="/hr/leave" element={<LeaveApprovals />} />
              <Route path="/hr/candidates" element={<CandidatesPage allowManage />} />
              <Route path="/hr/candidates-dashboard" element={<CandidatesDashboard />} />
              <Route path="/hr/students" element={<StudentsPage />} />
              <Route path="/hr/notifications" element={<NotificationsPage />} />
              <Route path="/hr/chat" element={<ChatPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={["telecaller"]} />}>
            <Route element={<Layout />}>
              <Route path="/telecaller" element={<TelecallerDashboard />} />
              <Route path="/telecaller/leads" element={<LeadsPage />} />
              <Route path="/telecaller/followups" element={<LeadsPage todayOnly />} />
              <Route path="/telecaller/candidates" element={<CandidatesPage />} />
              <Route path="/telecaller/attendance" element={<StaffAttendanceSelf />} />
              <Route path="/telecaller/leave" element={<StaffLeaveSelf />} />
              <Route path="/telecaller/notifications" element={<NotificationsPage />} />
              <Route path="/telecaller/chat" element={<ChatPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={["trainer"]} />}>
            <Route element={<Layout />}>
              <Route path="/trainer" element={<TrainerDashboard />} />
              <Route path="/trainer/batches" element={<BatchesPage />} />
              <Route path="/trainer/daily-followup" element={<DailyFollowupPage allowManage />} />
              <Route path="/trainer/attendance" element={<StaffAttendanceSelf />} />
              <Route path="/trainer/leave" element={<StaffLeaveSelf />} />
              <Route path="/trainer/notifications" element={<NotificationsPage />} />
              <Route path="/trainer/chat" element={<ChatPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={["student"]} />}>
            <Route element={<Layout />}>
              <Route path="/student" element={<StudentDashboard />} />
              <Route path="/student/course" element={<MyCourse />} />
              <Route path="/student/attendance" element={<MyAttendance />} />
              <Route path="/student/fees" element={<MyFees />} />
              <Route path="/student/leave" element={<StaffLeaveSelf studentMode />} />
              <Route path="/student/feedback" element={<MyFeedback />} />
              <Route path="/student/notifications" element={<NotificationsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
      </SettingsProvider>
    </BrowserRouter>
  );
}
