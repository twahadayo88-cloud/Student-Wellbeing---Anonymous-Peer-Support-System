import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Check, Eye, History, RefreshCw, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import useAuth from '../hooks/useAuth';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';

const demoFacultyComplaints = [
  {
    id: 'DEMO-01',
    category: 'academic_dispute',
    reason: 'A group-project contribution disagreement needs a neutral review. Both students have been asked to share their perspective.',
    status: 'under_review',
    is_flagged: false,
    reporter_anonymous_id: 'CalmOwl#2041',
    reported_anonymous_id: 'BrightFox#7812',
  },
  {
    id: 'DEMO-02',
    category: 'privacy_violation',
    reason: 'A student reports that a private message was shared with classmates without permission.',
    status: 'open',
    is_flagged: true,
    reporter_anonymous_id: 'QuietPanda#3560',
    reported_anonymous_id: 'KindHawk#9124',
    evidence_ref: 'Sample evidence reference',
  },
  {
    id: 'DEMO-03',
    category: 'abusive_language',
    reason: 'A student requests help addressing repeated disrespectful comments in a class discussion.',
    status: 'under_review',
    is_flagged: false,
    reporter_anonymous_id: 'BlueKoala#6385',
    reported_anonymous_id: 'SwiftDeer#4729',
  },
];

export default function ComplaintReview() {
  const { user } = useAuth();
  const isFaculty = user?.role === 'faculty';
  const [complaints, setComplaints] = useState([]);
  const [pendingReveals, setPendingReveals] = useState([]);
  const [notes, setNotes] = useState({});
  const [justifications, setJustifications] = useState({});
  const [audits, setAudits] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (isFaculty) {
        const response = await api.get('/complaints/faculty/mine');
        setComplaints(response.data.data || []);
      } else {
        const [complaintResponse, revealResponse] = await Promise.all([
          api.get('/complaints/admin/escalated'),
          api.get('/complaints/admin/reveal-pending'),
        ]);
        setComplaints(complaintResponse.data.data || []);
        setPendingReveals(revealResponse.data.data || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load the complaint queue.');
    } finally {
      setLoading(false);
    }
  }, [isFaculty]);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (complaintId, action) => {
    try {
      await api.patch(`/complaints/${complaintId}/review`, { action, note: notes[complaintId] || '' });
      toast.success(`Complaint ${{ resolve: 'resolved', reject: 'rejected', escalate: 'escalated' }[action]}.`);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update complaint.');
    }
  };

  const resolve = async (complaintId, action) => {
    try {
      await api.post(`/complaints/${complaintId}/resolve`, { action, note: notes[complaintId] || '' });
      toast.success(`Complaint ${action === 'reject' ? 'rejected' : 'resolved'}.`);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update complaint.');
    }
  };

  const toggleAudit = async (complaintId) => {
    if (audits[complaintId]) {
      setAudits(current => ({ ...current, [complaintId]: null }));
      return;
    }
    try {
      const response = await api.get(`/complaints/${complaintId}/audit`);
      setAudits(current => ({ ...current, [complaintId]: response.data.data || [] }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load audit history.');
    }
  };

  const requestReveal = async (complaintId) => {
    try {
      await api.post(`/complaints/${complaintId}/reveal-request`, {
        justification: justifications[complaintId] || '',
      });
      toast.success('Reveal request recorded; another administrator must approve it.');
      setJustifications(current => ({ ...current, [complaintId]: '' }));
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not request identity reveal.');
    }
  };

  const approveReveal = async (recordId) => {
    try {
      const response = await api.post(`/complaints/reveal-approve/${recordId}`);
      toast.success(`Identity revealed: ${response.data.data?.email || 'user no longer exists'}`);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not approve reveal. A different administrator must approve it.');
    }
  };

  if (!['faculty', 'admin', 'super_admin'].includes(user?.role)) {
    return <div className="p-8 text-center text-surface-500">This review portal is not available for your role.</div>;
  }

  const title = isFaculty ? 'Assigned Complaints' : 'Escalated Complaints';
  const showingDemoComplaints = isFaculty && !loading && !error && complaints.length === 0;
  const visibleComplaints = showingDemoComplaints ? demoFacultyComplaints : complaints;

  return (
    <>
      {isFaculty ? <Sidebar /> : <Navbar />}
      <main className={`min-h-screen bg-[#09090e] px-4 pb-12 sm:px-6 lg:px-8 ${isFaculty ? 'ml-16 pt-6 sm:ml-64' : 'pt-24'}`}>
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-500 text-xs font-bold uppercase tracking-wider mb-2">
              <History className="w-3.5 h-3.5" />
              Administrative Trust Portal
            </div>
            <h1 className="text-3xl font-extrabold text-white">{title.replace('Complaints', '')} <span className="brand-text">Complaints</span></h1>
            <p className="mt-1 text-sm text-surface-400">
              {isFaculty
                ? 'Only complaints assigned to your department/account are shown.'
                : 'Escalated safety cases under Level 2 administration. Identity reveal requires dual-party validation.'}
            </p>
          </div>
          <button type="button" onClick={load} disabled={loading} className="btn-secondary text-xs inline-flex items-center gap-2">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </header>

        {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>}

        {!isFaculty && pendingReveals.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400">Pending Identity Approvals</h2>
            {pendingReveals.map(item => (
              <div key={item.record_id} className="glass-card-brand flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl">
                <div>
                  <p className="text-sm font-mono font-bold text-white">Complaint #{item.complaint_id}</p>
                  <p className="mt-1 text-xs text-surface-300">Justification: {item.justification}</p>
                </div>
                <button type="button" onClick={() => approveReveal(item.record_id)} className="btn-primary text-xs inline-flex items-center gap-2">
                  <Eye className="h-4 w-4" /> Approve Reveal
                </button>
              </div>
            ))}
          </section>
        )}

        {loading ? (
          <div className="glass-card p-12 text-center text-surface-400">
            <div className="w-8 h-8 rounded-full border-2 border-pink-500 border-t-transparent animate-spin mx-auto mb-3" />
            Loading review queue...
          </div>
        ) : visibleComplaints.length === 0 ? (
          <div className="glass-card p-12 text-center text-surface-400">No complaints in this queue.</div>
        ) : (
          <div className="space-y-4">
            {showingDemoComplaints && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                Demo data only: these sample complaints are fictional and read-only. No real complaints are currently assigned to you.
              </div>
            )}
            {visibleComplaints.map(item => (
              <article key={item.id} className="glass-card space-y-4 border-l-4 border-l-pink-500 p-6 rounded-2xl border border-white/5 hover:border-pink-500/30 transition-all">
                <header className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-bold capitalize text-white">{item.category.replace(/_/g, ' ')}</p>
                    <p className="mt-1 text-xs font-mono text-surface-400">
                      Case #{item.id} · Reporter <span className="text-pink-400">{item.reporter_anonymous_id || 'anonymous'}</span> · Reported <span className="text-amber-400">{item.reported_anonymous_id || 'content'}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {showingDemoComplaints && <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-300">Demo</span>}
                    {item.is_flagged ? <span className="rounded-full bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 text-xs font-bold text-rose-400">Priority review</span> : null}
                    <span className="rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-xs font-mono font-semibold capitalize text-surface-300">{item.status.replace(/_/g, ' ')}</span>
                  </div>
                </header>

                <p className="whitespace-pre-wrap text-sm text-surface-200 leading-relaxed">{item.reason}</p>
                {item.evidence_ref && <p className="text-xs font-mono text-surface-400">Evidence reference: {item.evidence_ref}</p>}
                {item.faculty_note && <p className="rounded-xl bg-white/5 border border-white/5 p-3 text-xs text-surface-300">Review note: {item.faculty_note}</p>}

                {!showingDemoComplaints && (
                  <>
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={notes[item.id] || ''}
                  onChange={event => setNotes(current => ({ ...current, [item.id]: event.target.value }))}
                  placeholder={isFaculty ? 'Add a resolution, rejection, or escalation note' : 'Add a resolution or rejection note'}
                  className="w-full rounded-xl border border-white/10 bg-[#09090e] p-3 text-sm text-white outline-none focus:ring-2 focus:ring-pink-500 leading-relaxed"
                />

                <div className="flex flex-wrap gap-2 pt-1">
                  {isFaculty ? (
                    <>
                      <button type="button" onClick={() => review(item.id, 'resolve')} className="btn-secondary text-xs inline-flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-400" /> Resolve</button>
                      <button type="button" onClick={() => review(item.id, 'reject')} className="btn-secondary text-xs inline-flex items-center gap-2"><X className="h-3.5 w-3.5 text-rose-400" /> Reject</button>
                      <button type="button" onClick={() => review(item.id, 'escalate')} className="btn-primary text-xs inline-flex items-center gap-2"><ArrowUpRight className="h-3.5 w-3.5" /> Escalate</button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => resolve(item.id, 'resolve')} className="btn-secondary text-xs inline-flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-400" /> Resolve</button>
                      <button type="button" onClick={() => resolve(item.id, 'reject')} className="btn-secondary text-xs inline-flex items-center gap-2"><X className="h-3.5 w-3.5 text-rose-400" /> Reject</button>
                      {item.reported_anonymous_id && (
                        <button
                          type="button"
                          onClick={() => requestReveal(item.id)}
                          disabled={(justifications[item.id] || '').trim().length < 20}
                          className="btn-secondary text-xs inline-flex items-center gap-2 disabled:opacity-50"
                        >
                          <Eye className="h-3.5 w-3.5 text-pink-500" /> Request Identity Reveal
                        </button>
                      )}
                    </>
                  )}
                  {!isFaculty && <button type="button" onClick={() => toggleAudit(item.id)} className="btn-secondary text-xs inline-flex items-center gap-2"><History className="h-3.5 w-3.5" /> {audits[item.id] ? 'Hide History' : 'View Audit Trail'}</button>}
                </div>

                {!isFaculty && item.reported_anonymous_id && (
                  <textarea
                    rows={2}
                    maxLength={1000}
                    value={justifications[item.id] || ''}
                    onChange={event => setJustifications(current => ({ ...current, [item.id]: event.target.value }))}
                    placeholder="Identity reveal justification (at least 20 characters required by safety charter)"
                    className="w-full rounded-xl border border-white/10 bg-[#09090e] p-3 text-sm text-white outline-none focus:ring-2 focus:ring-pink-500"
                  />
                )}

                {audits[item.id] && (
                  <ol className="space-y-2 border-t border-white/10 pt-4">
                    {audits[item.id].map(entry => (
                      <li key={entry.id} className="text-xs text-surface-400 font-mono">
                        <span className="font-bold text-pink-400">{entry.action}</span> · {new Date(entry.created_at).toLocaleString()} · {entry.details?.note || entry.details?.faculty_note || ''}
                      </li>
                    ))}
                  </ol>
                )}
                  </>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
      <div className={isFaculty ? 'ml-16 sm:ml-64' : ''}>
        <Footer />
      </div>
    </>
  );
}