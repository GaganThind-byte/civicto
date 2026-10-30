'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock3,
  HardHat,
  Home,
  LogOut,
  Plus,
  ShieldCheck,
  ThumbsUp,
  Users,
  Wrench,
} from 'lucide-react';
import {
  assignmentRules,
  buildSlaDeadline,
  getAllowedNextStatuses,
  getRecommendedAssignment,
  statusLabels,
  type TicketStatus,
} from '@/lib/complaint-workflow';
import type { AppRole } from '@/lib/auth';

type WorkspaceUser = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  team: string | null;
};

type ComplaintRow = {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  category: string;
  status: TicketStatus;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  location: string;
  residentId?: string;
  photoBeforeUrl?: string;
  photoAfterUrl?: string;
  duplicateReports: number;
  voteCount: number;
  votedByMe: boolean;
  aiVerificationStatus?: string;
  aiVerificationNotes?: string;
  residentId?: string;
  createdAt: string;
};

type DirectoryUser = Omit<WorkspaceUser, 'id'> & { id: string; createdAt: string };
type Notice = { kind: 'success' | 'error'; text: string } | null;

const roleTitles: Record<AppRole, string> = {
  ADMIN: 'Community admin',
  STAFF: 'Maintenance team',
  RESIDENT: 'Resident portal',
};

const roleDescriptions: Record<AppRole, string> = {
  ADMIN: 'A live view of your community service operation.',
  STAFF: 'Your assigned work, priorities, and repair handoffs.',
  RESIDENT: 'Browse community requests, support shared issues, and follow repairs.',
};

const roleIcons = { ADMIN: ShieldCheck, STAFF: HardHat, RESIDENT: Home };
const teams = Object.values(assignmentRules).filter((team, index, values) => values.indexOf(team) === index);
const adminStatuses = Object.keys(statusLabels) as TicketStatus[];

function slaState(complaint: ComplaintRow) {
  if (['RESOLVED', 'VERIFIED', 'CLOSED'].includes(complaint.status)) return 'Complete';
  const deadline = buildSlaDeadline(new Date(complaint.createdAt), complaint.urgency);
  const remaining = deadline.getTime() - Date.now();
  if (remaining <= 0) return 'Breached';
  if (remaining <= 60 * 60 * 1000) return 'Due soon';
  return 'On track';
}

function friendlyDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

export function RoleDashboard({ user }: { user: WorkspaceUser }) {
  const router = useRouter();
  const [complaints, setComplaints] = useState<ComplaintRow[]>([]);
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [busyId, setBusyId] = useState('');
  const [photoFiles, setPhotoFiles] = useState<Record<string, File | null>>({});
  const [accountForm, setAccountForm] = useState({ name: '', email: '', password: '', role: 'STAFF' as 'STAFF' | 'RESIDENT', team: teams[0] });
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  async function loadComplaints() {
    const response = await fetch('/api/complaints', { cache: 'no-store' });
    if (response.status === 401) {
      router.replace('/login');
      return;
    }
    const payload = await response.json();
    if (response.ok) setComplaints(payload.complaints ?? []);
    else setNotice({ kind: 'error', text: payload.error ?? 'Unable to load complaints.' });
  }

  async function loadDirectory() {
    const response = await fetch('/api/admin/users', { cache: 'no-store' });
    const payload = await response.json();
    if (response.ok) setDirectory(payload.users ?? []);
  }

  useEffect(() => {
    void loadComplaints();
    if (user.role === 'ADMIN') void loadDirectory();
  }, []);

  async function updateStatus(complaint: ComplaintRow, status: TicketStatus) {
    setBusyId(complaint.id);
    setNotice(null);
    try {
      const response = await fetch(`/api/complaints/${complaint.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? 'Could not update this ticket.');
      setNotice({ kind: 'success', text: `${complaint.ticketNumber} moved to ${statusLabels[status]}.` });
      await loadComplaints();
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Could not update this ticket.' });
    } finally {
      setBusyId('');
    }
  }

  async function verifyRepair(complaint: ComplaintRow) {
    const photo = photoFiles[complaint.id];
    if (!photo) {
      setNotice({ kind: 'error', text: 'Add an after-repair photo before confirming this fix.' });
      return;
    }

    async function submitRepairPhoto(complaint: ComplaintRow) {
      const photo = photoFiles[complaint.id];
      if (!photo) {
        setNotice({ kind: 'error', text: 'Add an after-repair photo for AI review.' });
        return;
      }

      const formData = new FormData();
      formData.append('afterPhoto', photo);
      setBusyId(complaint.id);
      setNotice(null);
      try {
        const response = await fetch(`/api/complaints/${complaint.id}/repair-photo`, {
          method: 'POST',
          body: formData,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? 'Could not review this repair photo.');
        setNotice({
          kind: payload.review.approved ? 'success' : 'error',
          text: payload.review.approved
            ? `${complaint.ticketNumber} passed AI photo review and is marked resolved.`
            : `AI could not confirm the repair: ${payload.review.reason}`,
        });
        setPhotoFiles((current) => ({ ...current, [complaint.id]: null }));
        await loadComplaints();
      } catch (error) {
        setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Could not review this repair photo.' });
      } finally {
        setBusyId('');
      }
    }

    async function upvoteComplaint(complaint: ComplaintRow) {
      setBusyId(complaint.id);
      setNotice(null);
      try {
        const response = await fetch(`/api/complaints/${complaint.id}/vote`, { method: 'POST' });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? 'Could not support this complaint.');
        setNotice({ kind: 'success', text: `Your support was added to ${complaint.ticketNumber}.` });
        await loadComplaints();
      } catch (error) {
        setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Could not support this complaint.' });
      } finally {
        setBusyId('');
      }
    }

    const formData = new FormData();
    formData.append('residentConfirmedFix', 'true');
    formData.append('afterPhoto', photo);
    formData.append('notes', 'Resident confirmed the repair.');
    setBusyId(complaint.id);

    try {
      const response = await fetch(`/api/complaints/${complaint.id}/verify`, { method: 'POST', body: formData });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? 'Could not verify the repair.');
      setNotice({ kind: 'success', text: `${complaint.ticketNumber} repair confirmed.` });
      setPhotoFiles((current) => ({ ...current, [complaint.id]: null }));
      await loadComplaints();
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Could not verify the repair.' });
    } finally {
      setBusyId('');
    }
  }

  async function createAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreatingAccount(true);
    setNotice(null);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountForm),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Could not create the account.');
      setNotice({ kind: 'success', text: `Account created for ${payload.user.name}. Share their temporary password securely.` });
      setAccountForm((current) => ({ ...current, name: '', email: '', password: '' }));
      await loadDirectory();
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Could not create the account.' });
    } finally {
      setIsCreatingAccount(false);
    }
  }

  async function handleSignOut() {
    await signOut({ redirect: false });
    router.replace('/login');
    router.refresh();
  }

  const activeComplaints = complaints.filter((item) => !['RESOLVED', 'VERIFIED', 'CLOSED'].includes(item.status));
  const criticalCount = activeComplaints.filter((item) => item.urgency === 'CRITICAL').length;
  const breachedCount = activeComplaints.filter((item) => slaState(item) === 'Breached').length;
  const resolvedCount = complaints.filter((item) => ['RESOLVED', 'VERIFIED', 'CLOSED'].includes(item.status)).length;
  const RoleIcon = roleIcons[user.role];
  const orderedComplaints = [...complaints].sort((left, right) => {
    const urgencyOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return urgencyOrder[left.urgency] - urgencyOrder[right.urgency]
      || new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });

  return (
    <div className={`workspace role-${user.role.toLowerCase()}`}>
      <aside className="workspace-sidebar">
        <Link href="/" className="workspace-brand">
          <span className="workspace-brand-mark"><Building2 size={18} /></span>
          <span>Civicto</span>
        </Link>
        <div className="workspace-nav-label">WORKSPACE</div>
        <nav className="workspace-nav" aria-label="Workspace navigation">
          <Link href={user.role === 'ADMIN' ? '/admin' : user.role === 'STAFF' ? '/staff' : '/resident'} className="active">
            <Activity size={17} /> Overview
          </Link>
          {user.role === 'RESIDENT' ? (
            <Link href="/submit"><Plus size={17} /> New request</Link>
          ) : <a href="#work-queue"><ClipboardList size={17} /> {user.role === 'ADMIN' ? 'All requests' : 'My team queue'}</a>}
          {user.role === 'ADMIN' ? <a href="#accounts"><Users size={17} /> People & access</a> : null}
        </nav>

        <div className="sidebar-team">
          <span className="sidebar-team-icon"><Wrench size={16} /></span>
          <span><small>{user.role === 'STAFF' ? 'YOUR TEAM' : 'SERVICE DESK'}</small><strong>{user.team ?? 'Community operations'}</strong></span>
        </div>

        <div className="sidebar-user">
          <div className="user-monogram">{user.name.slice(0, 1).toUpperCase()}</div>
          <span className="sidebar-user-copy"><strong>{user.name}</strong><small>{roleTitles[user.role]}</small></span>
          <button type="button" className="icon-button sidebar-logout" aria-label="Sign out" title="Sign out" onClick={() => void handleSignOut()}>
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      <main className="workspace-main">
        <header className="workspace-topbar">
          <div className="breadcrumb"><span>Community</span><span>/</span><strong>{roleTitles[user.role]}</strong></div>
          <div className="topbar-user"><span className="online-dot" /> Signed in as <strong>{user.name}</strong><button type="button" className="icon-button topbar-signout" aria-label="Sign out" title="Sign out" onClick={() => void handleSignOut()}><LogOut size={16} /></button></div>
        </header>

        <div className="dashboard-content">
          <section className="dashboard-heading">
            <div>
              <span className="overline">{user.role === 'STAFF' ? user.team : 'CIVICTO / OPERATIONS'}</span>
              <h1>{user.role === 'ADMIN' ? 'Good morning,' : user.role === 'STAFF' ? 'Your workbench' : 'Your home, in good hands.'}<br />{user.role === 'ADMIN' ? <em>{user.name.split(' ')[0]}.</em> : null}</h1>
              <p>{roleDescriptions[user.role]}</p>
            </div>
            <div className="heading-mark"><RoleIcon size={27} strokeWidth={1.7} /><span>{user.role}</span></div>
          </section>

          {notice ? <div className={`workspace-notice ${notice.kind}`} role="status">{notice.kind === 'success' ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}{notice.text}</div> : null}

          <section className="stat-grid" aria-label="Complaint summary">
            <article className="stat-card stat-card-primary"><div className="stat-card-top"><span>{user.role === 'RESIDENT' ? 'Open requests' : 'Active work'}</span><ClipboardList size={18} /></div><strong>{activeComplaints.length.toString().padStart(2, '0')}</strong><small>{user.role === 'RESIDENT' ? 'Your requests in progress' : 'Across your visible queue'}</small></article>
            <article className="stat-card"><div className="stat-card-top"><span>Critical</span><AlertTriangle size={18} /></div><strong>{criticalCount.toString().padStart(2, '0')}</strong><small>Needs immediate attention</small></article>
            <article className="stat-card"><div className="stat-card-top"><span>SLA breached</span><Clock3 size={18} /></div><strong className={breachedCount ? 'text-danger' : ''}>{breachedCount.toString().padStart(2, '0')}</strong><small>Past the response deadline</small></article>
            <article className="stat-card"><div className="stat-card-top"><span>Completed</span><CheckCircle2 size={18} /></div><strong>{resolvedCount.toString().padStart(2, '0')}</strong><small>Resolved or verified</small></article>
          </section>

          {user.role === 'ADMIN' ? (
            <section className="admin-team-strip" aria-label="Team workload">
              <div className="section-title-row"><div><span className="overline">DISTRIBUTION</span><h2>Work across teams</h2></div><span className="section-side-note">{teams.length} service teams</span></div>
              <div className="team-strip-grid">
                {teams.map((team) => {
                  const count = activeComplaints.filter((item) => getRecommendedAssignment(item.category) === team).length;
                  return <div className="team-strip-item" key={team}><span>{team}</span><strong>{count.toString().padStart(2, '0')}</strong><div className="team-meter"><span style={{ width: `${activeComplaints.length ? Math.max(4, count / activeComplaints.length * 100) : 0}%` }} /></div></div>;
                })}
              </div>
            </section>
          ) : null}

          {user.role === 'ADMIN' ? (
            <section id="accounts" className="admin-account-section">
              <div className="section-title-row"><div><span className="overline">ACCESS CONTROL</span><h2>People & access</h2></div><span className="section-side-note">{directory.length} accounts</span></div>
              <div className="account-layout">
                <form className="account-form" onSubmit={createAccount}>
                  <div className="form-heading"><span className="form-icon"><Plus size={18} /></span><div><h3>Add a person</h3><p>Create a resident or field team login.</p></div></div>
                  <label><span>Full name</span><input value={accountForm.name} onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })} autoComplete="name" required /></label>
                  <label><span>Email</span><input type="email" value={accountForm.email} onChange={(event) => setAccountForm({ ...accountForm, email: event.target.value })} autoComplete="email" required /></label>
                  <label><span>Temporary password</span><input type="password" minLength={12} value={accountForm.password} onChange={(event) => setAccountForm({ ...accountForm, password: event.target.value })} autoComplete="new-password" required /></label>
                  <div className="field-row">
                    <label><span>Role</span><select value={accountForm.role} onChange={(event) => setAccountForm({ ...accountForm, role: event.target.value as 'STAFF' | 'RESIDENT' })}><option value="STAFF">Maintenance staff</option><option value="RESIDENT">Resident</option></select></label>
                    {accountForm.role === 'STAFF' ? <label><span>Team</span><select value={accountForm.team} onChange={(event) => setAccountForm({ ...accountForm, team: event.target.value })}>{teams.map((team) => <option key={team}>{team}</option>)}</select></label> : null}
                  </div>
                  <button className="button-dark" type="submit" disabled={isCreatingAccount}>{isCreatingAccount ? 'Creating account' : 'Create account'}<ArrowRight size={16} /></button>
                </form>
                <div className="directory-panel">
                  <div className="directory-heading"><div><h3>Directory</h3><p>People with access to this community.</p></div><Users size={19} /></div>
                  <div className="directory-list">
                    {directory.map((member) => <div className="directory-row" key={member.id}><span className="directory-avatar">{member.name.slice(0, 1).toUpperCase()}</span><span className="directory-name"><strong>{member.name}</strong><small>{member.email}</small></span><span className={`role-pill role-pill-${member.role.toLowerCase()}`}>{member.role === 'STAFF' ? member.team : member.role}</span></div>)}
                    {directory.length === 0 ? <p className="empty-state">No accounts yet. Add the first resident or team member.</p> : null}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section id="work-queue" className="queue-section">
            <div className="section-title-row"><div><span className="overline">{user.role === 'RESIDENT' ? 'COMMUNITY FEED' : user.role === 'STAFF' ? 'ASSIGNED TO YOUR TEAM' : 'SERVICE OPERATIONS'}</span><h2>{user.role === 'RESIDENT' ? 'Community requests' : user.role === 'STAFF' ? 'Team queue' : 'All complaints'}</h2></div>{user.role === 'RESIDENT' ? <Link href="/submit" className="button-accent"><Plus size={16} /> New request</Link> : <span className="section-side-note">{complaints.length} total tickets</span>}</div>
            <div className="queue-table-head"><span>REQUEST</span><span>TEAM / LOCATION</span><span>PRIORITY</span><span>STATUS</span><span>{user.role === 'RESIDENT' ? 'UPDATE' : 'ACTION'}</span></div>
            <div className="queue-list">
              {orderedComplaints.map((complaint) => {
                const nextStatuses = (user.role === 'ADMIN' ? adminStatuses : getAllowedNextStatuses(complaint.status))
                  .filter((status) => status !== complaint.status && status !== 'RESOLVED' && status !== 'VERIFIED');
                return (
                  <article className="queue-ticket" key={complaint.id}>
                    <div className="ticket-main"><span className="ticket-number">{complaint.ticketNumber}</span><h3>{complaint.title}</h3><p>{complaint.category} <span>·</span> {friendlyDate(complaint.createdAt)}</p>{complaint.photoBeforeUrl || complaint.photoAfterUrl ? <div className="evidence-row">{complaint.photoBeforeUrl ? <a href={complaint.photoBeforeUrl} target="_blank" rel="noreferrer"><Camera size={13} /> Before</a> : null}{complaint.photoAfterUrl ? <a href={complaint.photoAfterUrl} target="_blank" rel="noreferrer"><Camera size={13} /> After</a> : null}</div> : null}</div>
                    <div className="ticket-location"><strong>{getRecommendedAssignment(complaint.category)}</strong><span>{complaint.location}</span></div>
                    <div><span className={`priority-tag priority-${complaint.urgency.toLowerCase()}`}><i />{complaint.urgency}</span><span className={`sla-line sla-${slaState(complaint).toLowerCase().replace(' ', '-')}`}>{slaState(complaint) === 'Breached' ? 'SLA breached' : slaState(complaint) === 'Due soon' ? 'Due soon' : slaState(complaint)}</span>{user.role === 'RESIDENT' ? <small className="community-count">{complaint.voteCount} supporting · {complaint.duplicateReports} similar reports</small> : null}</div>
                    <div><span className={`status-tag status-${complaint.status.toLowerCase().replaceAll('_', '-')}`}>{statusLabels[complaint.status]}</span></div>
                    <div className="ticket-action">
                      {user.role === 'RESIDENT' && complaint.status === 'RESOLVED' && complaint.residentId === user.id ? <div className="verify-action"><label className="photo-picker" title="Attach after-repair photo"><Camera size={16} /><input type="file" accept="image/*" onChange={(event) => setPhotoFiles((current) => ({ ...current, [complaint.id]: event.target.files?.[0] ?? null }))} /></label><button type="button" className="button-confirm" disabled={busyId === complaint.id} onClick={() => void verifyRepair(complaint)}>{busyId === complaint.id ? 'Saving' : 'Confirm fix'}</button></div>
                        : user.role === 'RESIDENT' && !['RESOLVED', 'VERIFIED', 'CLOSED'].includes(complaint.status) ? <button type="button" className={`vote-button${complaint.votedByMe ? ' voted' : ''}`} disabled={complaint.votedByMe || busyId === complaint.id} onClick={() => void upvoteComplaint(complaint)}><ThumbsUp size={15} />{complaint.votedByMe ? 'Supported' : 'Support'}</button>
                          : user.role !== 'RESIDENT' && complaint.status === 'IN_PROGRESS' ? <div className="verify-action"><label className="photo-picker" title="Attach after-repair photo"><Camera size={16} /><input type="file" accept="image/*" onChange={(event) => setPhotoFiles((current) => ({ ...current, [complaint.id]: event.target.files?.[0] ?? null }))} /></label><button type="button" className="button-confirm" disabled={busyId === complaint.id} onClick={() => void submitRepairPhoto(complaint)}>{busyId === complaint.id ? 'Reviewing…' : 'AI review'}</button></div>
                            : user.role !== 'RESIDENT' && nextStatuses.length > 0 ? <select className="ticket-status-select" value="" disabled={busyId === complaint.id} onChange={(event) => { if (event.target.value) void updateStatus(complaint, event.target.value as TicketStatus); }}><option value="">{busyId === complaint.id ? 'Saving…' : 'Update'}</option>{nextStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select>
                              : <span className="no-action">{complaint.status === 'RESOLVED' ? complaint.residentId === user.id ? 'Awaiting your check' : 'AI approved · awaiting resident' : complaint.aiVerificationStatus === 'REJECTED' ? 'AI photo review needed' : '—'}</span>}
                    </div>
                  </article>
                );
              })}
              {orderedComplaints.length === 0 ? <div className="empty-queue"><span className="empty-queue-icon"><CheckCircle2 size={21} /></span><strong>{user.role === 'RESIDENT' ? 'No requests yet' : 'Queue is clear'}</strong><p>{user.role === 'RESIDENT' ? 'Your new service requests will appear here.' : 'There are no complaints in your visible queue right now.'}</p>{user.role === 'RESIDENT' ? <Link href="/submit" className="button-accent"><Plus size={16} /> Create a request</Link> : null}</div> : null}
            </div>
          </section>

          <footer className="workspace-footer"><span>CIVICTO COMMUNITY OPERATIONS</span><span>Role-based access active <span className="online-dot" /></span></footer>
        </div>
      </main>
    </div>
  );
}