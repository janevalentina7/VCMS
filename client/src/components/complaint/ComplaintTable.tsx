import { Link } from 'react-router-dom';
import { Eye, MapPin, PencilLine, ShieldCheck, UserPlus, Wrench, CalendarDays, User } from 'lucide-react';
import { cn, formatDate, truncate } from '@/lib/utils';
import { categoryIcon } from '@/lib/constants';
import { PriorityMeter, StatusBadge, Badge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import type { ComplaintSummary, Role } from '@/types';

interface ComplaintTableProps {
  complaints: ComplaintSummary[];
  role: Role;
  onAssign?: (complaint: ComplaintSummary) => void;
  onStatusChange?: (complaint: ComplaintSummary) => void;
  onEdit?: (complaint: ComplaintSummary) => void;
  onApprove?: (complaint: ComplaintSummary) => void;
  emptyState?: React.ReactNode;
}

/**
 * Complaint register. Columns follow §7 (Complaint ID, Category, Location,
 * Priority, Status, Date, Officer, Action); the wrapper keeps the table
 * horizontally scrollable on small screens while cards handle mobile detail.
 */
export const ComplaintTable = ({ complaints, role, onAssign, onStatusChange, onEdit, onApprove, emptyState }: ComplaintTableProps) => {
  if (!complaints.length) return <>{emptyState}</>;

  return (
    <>
      {/* ── Desktop / tablet table ─────────────────────────────────────── */}
      <div className="table-wrap hidden md:block">
        <table className="table">
          <caption className="sr-only">Registered complaints</caption>
          <thead>
            <tr>
              <th scope="col">Complaint ID</th>
              <th scope="col">Category</th>
              <th scope="col">Location</th>
              <th scope="col">Priority</th>
              <th scope="col">Status</th>
              <th scope="col">Date</th>
              <th scope="col">Assigned Officer</th>
              <th scope="col" className="text-right">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {complaints.map((complaint) => {
              const Icon = categoryIcon(complaint.categoryIcon);
              return (
                <tr key={complaint.id}>
                  <td>
                    <Link to={`/complaints/${complaint.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">
                      {complaint.complaintId}
                    </Link>
                    <p className="mt-0.5 max-w-[170px] truncate text-2xs text-muted" title={complaint.citizenName}>
                      {complaint.citizenName}
                    </p>
                  </td>
                  <td>
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0" style={{ color: complaint.categoryColour ?? undefined }} aria-hidden />
                      <span className="text-xs font-medium text-ink">{complaint.categoryName}</span>
                    </span>
                  </td>
                  <td>
                    <span className="flex items-start gap-1.5 text-xs text-muted">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="max-w-[180px] truncate" title={complaint.location}>
                        {complaint.location}
                      </span>
                    </span>
                  </td>
                  <td>
                    <span className="flex flex-col gap-1">
                      <Badge className="w-fit border-line bg-elevated text-muted">{complaint.priorityLabel}</Badge>
                      <PriorityMeter priority={complaint.priority} />
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={complaint.status} label={complaint.statusLabel} />
                  </td>
                  <td className="whitespace-nowrap text-xs text-muted">{formatDate(complaint.complaintDate)}</td>
                  <td>
                    {complaint.assignedOfficerName ? (
                      <span className="flex items-center gap-1.5 text-xs text-ink">
                        <User className="h-3.5 w-3.5 text-muted" aria-hidden />
                        {complaint.assignedOfficerName}
                      </span>
                    ) : (
                      <span className="text-xs italic text-muted">Not assigned</span>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        to={`/complaints/${complaint.id}`}
                        className="btn btn-ghost btn-sm px-2"
                        aria-label={`View complaint ${complaint.complaintId}`}
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden />
                        <span className="hidden lg:inline">View</span>
                      </Link>

                      {role === 'admin' && complaint.status === 'pending' && onApprove && (
                        <Button variant="ghost" size="sm" className="px-2 text-success hover:bg-success-soft" onClick={() => onApprove(complaint)}>
                          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                          <span className="hidden lg:inline">Approve</span>
                        </Button>
                      )}
                      {role === 'admin' && onAssign && complaint.status !== 'resolved' && complaint.status !== 'rejected' && (
                        <Button variant="ghost" size="sm" className="px-2 text-primary hover:bg-primary-soft" onClick={() => onAssign(complaint)}>
                          <UserPlus className="h-3.5 w-3.5" aria-hidden />
                          <span className="hidden lg:inline">{complaint.assignedOfficerName ? 'Reassign' : 'Assign'}</span>
                        </Button>
                      )}
                      {role === 'admin' && onEdit && (
                        <Button variant="ghost" size="sm" className="px-2" onClick={() => onEdit(complaint)}>
                          <PencilLine className="h-3.5 w-3.5" aria-hidden />
                          <span className="hidden lg:inline">Edit</span>
                        </Button>
                      )}
                      {(role === 'admin' || role === 'officer') && onStatusChange && (
                        <Button variant="ghost" size="sm" className="px-2 text-info hover:bg-info-soft" onClick={() => onStatusChange(complaint)}>
                          <Wrench className="h-3.5 w-3.5" aria-hidden />
                          <span className="hidden lg:inline">Update</span>
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Mobile cards ───────────────────────────────────────────────── */}
      <ul className="space-y-3 md:hidden">
        {complaints.map((complaint) => {
          const Icon = categoryIcon(complaint.categoryIcon);
          return (
            <li key={complaint.id} className="card p-3.5">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/complaints/${complaint.id}`} className="font-mono text-xs font-bold text-primary">
                  {complaint.complaintId}
                </Link>
                <StatusBadge status={complaint.status} label={complaint.statusLabel} />
              </div>

              <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-ink">
                <Icon className="h-4 w-4 shrink-0" style={{ color: complaint.categoryColour ?? undefined }} aria-hidden />
                {complaint.categoryName}
              </p>
              <p className="mt-1 text-xs text-muted">{truncate(complaint.description, 92)}</p>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-2xs text-muted">
                <div>
                  <dt className="font-semibold uppercase tracking-wide">Location</dt>
                  <dd className="truncate text-ink" title={complaint.location}>
                    {complaint.location}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase tracking-wide">Priority</dt>
                  <dd className="text-ink">{complaint.priorityLabel}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 font-semibold uppercase tracking-wide">
                    <CalendarDays className="h-3 w-3" aria-hidden /> Date
                  </dt>
                  <dd className="text-ink">{formatDate(complaint.complaintDate)}</dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase tracking-wide">Officer</dt>
                  <dd className="truncate text-ink">{complaint.assignedOfficerName ?? 'Not assigned'}</dd>
                </div>
              </dl>

              <div className="mt-3 flex flex-wrap gap-2">
                <Link to={`/complaints/${complaint.id}`} className="btn btn-secondary btn-sm flex-1 justify-center">
                  <Eye className="h-3.5 w-3.5" aria-hidden /> View
                </Link>
                {role === 'admin' && complaint.status === 'pending' && onApprove && (
                  <Button variant="success" size="sm" className="flex-1 justify-center" onClick={() => onApprove(complaint)}>
                    Approve
                  </Button>
                )}
                {role === 'admin' && onAssign && complaint.status !== 'resolved' && complaint.status !== 'rejected' && (
                  <Button variant="secondary" size="sm" className="flex-1 justify-center" onClick={() => onAssign(complaint)}>
                    {complaint.assignedOfficerName ? 'Reassign' : 'Assign'}
                  </Button>
                )}
                {(role === 'officer' || (role === 'admin' && onStatusChange)) && onStatusChange && (
                  <Button variant="secondary" size="sm" className="flex-1 justify-center" onClick={() => onStatusChange(complaint)}>
                    Update
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
};

export default ComplaintTable;
