import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, ClipboardList, Mail, Phone, Search, UserCog, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import { useAsync } from '@/hooks';
import Card, { CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import ProgressBar from '@/components/ui/ProgressBar';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import PageHeader from '@/components/layout/PageHeader';
import type { ComplaintSummary, Ward } from '@/types';

interface OfficerRecord {
  id: number;
  name: string;
  email: string;
  mobile: string;
  wardName: string | null;
  designation: string | null;
  status: string;
  activeAssignments: number;
  resolvedCount: number;
  avatarUrl: string | null;
}

/** Officers overview: workload, throughput and their open complaints (§45). */
export const OfficersPage = () => {
  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState<OfficerRecord | null>(null);

  const { data: officers, loading, error, reload } = useAsync<OfficerRecord[]>(
    (signal) => api.get<OfficerRecord[]>('/users/officers?includeInactive=true', signal),
    [],
  );
  const { data: wards = [] } = useAsync<Ward[]>((signal) => api.get<Ward[]>('/wards?withCounts=true', signal), []);

  const { data: openComplaints } = useAsync<ComplaintSummary[]>(
    async (signal) => {
      const result = await api.getWithMeta<ComplaintSummary[]>('/complaints?status=open&pageSize=100', signal);
      return result.data ?? [];
    },
    [],
  );

  const filtered = useMemo(() => {
    const list = officers ?? [];
    if (!term.trim()) return list;
    const needle = term.trim().toLowerCase();
    return list.filter(
      (officer) =>
        officer.name.toLowerCase().includes(needle) ||
        officer.email.toLowerCase().includes(needle) ||
        (officer.wardName ?? '').toLowerCase().includes(needle) ||
        (officer.designation ?? '').toLowerCase().includes(needle),
    );
  }, [officers, term]);

  const totals = useMemo(() => {
    const list = officers ?? [];
    return {
      officers: list.length,
      active: list.filter((officer) => officer.status === 'active').length,
      workload: list.reduce((sum, officer) => sum + officer.activeAssignments, 0),
      resolved: list.reduce((sum, officer) => sum + officer.resolvedCount, 0),
    };
  }, [officers]);

  const officerComplaints = (officerId: number) => (openComplaints ?? []).filter((complaint) => complaint.assignedOfficerId === officerId);

  if (error) {
    return (
      <Card>
        <ErrorState message={error} onRetry={reload} />
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title="Village officers"
        description="Workload and resolution performance for each officer. Assign complaints from the complaint register or the officer card."
        actions={
          <Link to="/users" className="btn btn-primary">
            <UserCog className="h-4 w-4" aria-hidden /> Manage officer accounts
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Total officers', formatNumber(totals.officers), <Users className="h-5 w-5" key="a" aria-hidden />],
          ['Active officers', formatNumber(totals.active), <UserCog className="h-5 w-5" key="b" aria-hidden />],
          ['Open assignments', formatNumber(totals.workload), <ClipboardList className="h-5 w-5" key="c" aria-hidden />],
          ['Complaints resolved', formatNumber(totals.resolved), <Award className="h-5 w-5" key="d" aria-hidden />],
        ].map(([label, value, icon]) => (
          <Card key={String(label)} padded className="flex items-center justify-between gap-3">
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wide text-muted">{label}</p>
              <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">{icon}</span>
          </Card>
        ))}
      </div>

      <Card className="mt-5">
        <CardHeader
          icon={<Search className="h-4 w-4" aria-hidden />}
          title="Find an officer"
          subtitle="Search by name, ward, designation or email"
        />
        <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="For example: Raj Kumar or Ward 4" aria-label="Search officers" />
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {loading &&
          [0, 1, 2].map((index) => (
            <Card key={index}>
              <SkeletonCard />
            </Card>
          ))}

        {!loading && filtered.length === 0 && (
          <Card className="lg:col-span-2 xl:col-span-3">
            <EmptyState title="No officers found" description="Add village officer accounts from the Users page to start assigning complaints." />
          </Card>
        )}

        {!loading &&
          filtered.map((officer) => {
            const open = officerComplaints(officer.id);
            const total = officer.activeAssignments + officer.resolvedCount;
            const rate = total ? (officer.resolvedCount / total) * 100 : 0;
            return (
              <Card key={officer.id} hoverable>
                <div className="flex items-start gap-3">
                  <Avatar name={officer.name} src={officer.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{officer.name}</p>
                    <p className="truncate text-2xs text-muted">{officer.designation ?? 'Village Officer'}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge className={officer.status === 'active' ? 'border-success/35 bg-success-soft text-success' : 'border-line bg-elevated text-muted'}>
                        {officer.status}
                      </Badge>
                      {officer.wardName && <Badge className="border-line bg-elevated text-muted">{officer.wardName.replace(/ —.*/, '')}</Badge>}
                      {officer.activeAssignments > 6 && <Badge className="border-warning/35 bg-warning-soft text-warning">High workload</Badge>}
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-2 text-xs">
                  <a href={`mailto:${officer.email}`} className="flex items-center gap-2 text-muted hover:text-primary">
                    <Mail className="h-3.5 w-3.5" aria-hidden /> {officer.email}
                  </a>
                  <a href={`tel:${officer.mobile}`} className="flex items-center gap-2 text-muted hover:text-primary">
                    <Phone className="h-3.5 w-3.5" aria-hidden /> {officer.mobile}
                  </a>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-line bg-elevated/50 p-2.5">
                    <dt className="text-2xs uppercase tracking-wide text-muted">Open</dt>
                    <dd className="mt-0.5 text-lg font-bold text-ink">{officer.activeAssignments}</dd>
                  </div>
                  <div className="rounded-lg border border-line bg-elevated/50 p-2.5">
                    <dt className="text-2xs uppercase tracking-wide text-muted">Resolved</dt>
                    <dd className="mt-0.5 text-lg font-bold text-ink">{officer.resolvedCount}</dd>
                  </div>
                </dl>

                <ProgressBar className="mt-3" value={rate} label="Resolution rate" showValue />

                <div className="mt-3 flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 justify-center"
                    onClick={() => setSelected(officer)}
                    disabled={open.length === 0}
                  >
                    View open work ({open.length})
                  </Button>
                  <Link to={`/complaints?officerId=${officer.id}`} className="btn btn-secondary btn-sm flex-1 justify-center">
                    All complaints
                  </Link>
                </div>

                {selected?.id === officer.id && open.length > 0 && (
                  <ul className="mt-3 space-y-2 border-t border-line pt-3">
                    {open.slice(0, 5).map((complaint) => (
                      <li key={complaint.id} className="flex items-center justify-between gap-2 text-2xs">
                        <Link to={`/complaints/${complaint.id}`} className="font-mono font-semibold text-primary hover:underline">
                          {complaint.complaintId}
                        </Link>
                        <span className="truncate text-muted">{complaint.location}</span>
                        <StatusBadge status={complaint.status} label={complaint.statusLabel} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
      </div>

      <Card className="mt-5">
        <CardHeader icon={<ClipboardList className="h-4 w-4" aria-hidden />} title="Ward coverage" subtitle="Officers and complaints per ward" />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Ward</th>
                <th scope="col">Code</th>
                <th scope="col">Officers</th>
                <th scope="col">Complaints</th>
                <th scope="col">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {(wards ?? []).map((ward) => (
                <tr key={ward.id}>
                  <td className="text-xs font-medium text-ink">{ward.name}</td>
                  <td className="font-mono text-xs text-muted">{ward.code}</td>
                  <td className="text-xs">{formatNumber(ward.officerCount ?? 0)}</td>
                  <td className="text-xs">{formatNumber(ward.complaintCount ?? 0)}</td>
                  <td>
                    <Badge className={(ward.officerCount ?? 0) > 0 ? 'border-success/35 bg-success-soft text-success' : 'border-warning/35 bg-warning-soft text-warning'}>
                      {(ward.officerCount ?? 0) > 0 ? 'Covered' : 'No officer assigned'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="mt-4 text-center text-2xs text-muted">
        Officer performance is calculated live from the complaint register: resolution rate = resolved ÷ (open + resolved).
      </p>
    </>
  );
};

export default OfficersPage;
