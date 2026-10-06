import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { LandingPage } from '@/pages/public/LandingPage';
import { LoginPage } from '@/pages/public/LoginPage';
import { RegisterPage } from '@/pages/public/RegisterPage';
import { UnauthorizedPage, NotFoundPage, ServerErrorPage } from '@/pages/public/StatusPages';
import DashboardPage from '@/pages/DashboardPage';
import ComplaintsPage from '@/pages/complaints/ComplaintsPage';
import NewComplaintPage from '@/pages/complaints/NewComplaintPage';
import ComplaintDetailPage from '@/pages/complaints/ComplaintDetailPage';
import TrackPage from '@/pages/complaints/TrackPage';
import ReportsPage from '@/pages/ReportsPage';
import NotificationsPage from '@/pages/NotificationsPage';
import ProfilePage from '@/pages/ProfilePage';
import SettingsPage from '@/pages/settings/SettingsPage';
import UsersPage from '@/pages/admin/UsersPage';
import OfficersPage from '@/pages/admin/OfficersPage';
import WardsPage from '@/pages/admin/WardsPage';
import CategoriesPage from '@/pages/admin/CategoriesPage';

/**
 * Signed-in visitors landing on "/" go straight to their dashboard, while
 * anonymous visitors see the public landing page.
 */
const RootRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : <LandingPage />;
};

/** Routes that require a session; the shell renders sidebar + topbar. */
const ProtectedLayout = () => (
  <ProtectedRoute>
    <AppShell />
  </ProtectedRoute>
);

const AppRoutes = () => (
  <Routes>
    {/* ── Public ─────────────────────────────────────────────────────── */}
    <Route path="/" element={<RootRoute />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/unauthorized" element={<UnauthorizedPage />} />
    <Route path="/server-error" element={<ServerErrorPage />} />

    {/* ── Authenticated (all roles) ─────────────────────────────────── */}
    <Route element={<ProtectedLayout />}>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/complaints" element={<ComplaintsPage />} />
      <Route element={<ProtectedRoute roles={['citizen', 'admin']} />}>
        <Route path="/complaints/new" element={<NewComplaintPage />} />
      </Route>
      <Route path="/complaints/:id" element={<ComplaintDetailPage />} />
      <Route path="/track" element={<TrackPage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/settings" element={<SettingsPage />} />

      {/* ── Administrator only ──────────────────────────────────────── */}
      <Route element={<ProtectedRoute roles={['admin']} />}>
        <Route path="/users" element={<UsersPage />} />
        <Route path="/officers" element={<OfficersPage />} />
        <Route path="/wards" element={<WardsPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
      </Route>
    </Route>

    {/* ── Fallback ──────────────────────────────────────────────────── */}
    <Route path="/404" element={<NotFoundPage />} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);

export const App = () => (
  <ThemeProvider>
    <AuthProvider>
      <ToastProvider>
        <NotificationProvider>
          <AppRoutes />
        </NotificationProvider>
      </ToastProvider>
    </AuthProvider>
  </ThemeProvider>
);

export default App;
