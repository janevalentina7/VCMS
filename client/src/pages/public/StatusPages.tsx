import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, ShieldAlert, SearchX } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="grid min-h-screen place-items-center bg-canvas px-4 py-10">
    <div className="w-full max-w-lg">{children}</div>
  </div>
);

/** Shown when a signed-in user opens a section their role cannot access (§37). */
export const UnauthorizedPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const from = (location.state as { from?: string } | null)?.from;

  return (
    <Shell>
      <div className="card card-pad text-center">
        <EmptyState
          icon={<ShieldAlert className="h-7 w-7" />}
          title="You don’t have access to this section"
          description={
            from
              ? `Your account role (${user?.roleLabel ?? 'guest'}) is not permitted to open ${from}. If you believe this is a mistake, contact the village office administrator.`
              : 'Your account role does not permit access to this page. If you believe this is a mistake, contact the village office administrator.'
          }
        />
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate(-1)}>
            Go back
          </Button>
          <Link to="/dashboard" className="btn btn-primary">
            <Home className="h-4 w-4" aria-hidden /> Open my dashboard
          </Link>
        </div>
      </div>
    </Shell>
  );
};

export const NotFoundPage = () => (
  <Shell>
    <div className="card card-pad text-center">
      <EmptyState
        icon={<SearchX className="h-7 w-7" />}
        title="Page not found"
        description="The page you are looking for has been moved or never existed. Check the address or return to the dashboard."
      />
      <Link to="/" className="btn btn-primary mt-2">
        <Home className="h-4 w-4" aria-hidden /> Back to home
      </Link>
    </div>
  </Shell>
);

export const ServerErrorPage = () => (
  <Shell>
    <div className="card card-pad text-center">
      <EmptyState
        icon={<ShieldAlert className="h-7 w-7" />}
        title="Something went wrong"
        description="The portal ran into an unexpected problem. Please refresh the page or try again in a moment."
      />
      <Button variant="primary" className="mt-2" onClick={() => window.location.reload()}>
        Reload the page
      </Button>
    </div>
  </Shell>
);

export default { UnauthorizedPage, NotFoundPage, ServerErrorPage };
