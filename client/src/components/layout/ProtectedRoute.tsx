import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { Role } from '@/types';

const FullPageLoader = () => (
  <div className="grid min-h-screen place-items-center bg-canvas">
    <div className="flex flex-col items-center gap-3 text-muted">
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
      <p className="text-sm">Preparing your portal…</p>
    </div>
  </div>
);

/**
 * Route guard: authentication + optional role allow-list (§37).
 * Accepts children (wrapped shell) or falls back to the nested <Outlet /> so it
 * can be used either as a layout wrapper or as a pathless parent route.
 */
export const ProtectedRoute = ({ roles, children }: { roles?: Role[]; children?: ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace state={{ from: location.pathname }} />;
  }
  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
