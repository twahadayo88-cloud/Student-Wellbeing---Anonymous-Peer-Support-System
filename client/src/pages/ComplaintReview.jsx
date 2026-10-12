import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Check, Eye, History, RefreshCw, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import useAuth from '../hooks/useAuth';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';

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

  return (
    <>
      <Navbar />
      <main className="min-h-screen px-4 pb-12 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">{title}</h1>
            <p className="mt-1 text-sm text-surface-500">
              {isFaculty
                ? 'Only complaints assigned to your account are shown.'
                : 'Only escalated cases are shown. Reporter identities remain pseudonymous.'}
            </p>
          </div>
          <button type="button" onClick={load} disabled={loading} className="btn-secondary inline-flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </header>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

        {!isFaculty && pendingReveals.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-surface-900 dark:text-white">Pending Identity Approvals</h2>
            {pendingReveals.map(item => (
              <div key={item.record_id} className="glass-card flex flex-wrap items-center justify-between gap-4 p-4">
                <div>
                  <p className="text-sm font-semibold">Complaint #{item.complaint_id}</p>
                  <p className="mt-1 text-xs text-surface-500">Justification: {item.justification}</p>
                </div>
                <button type="button" onClick={() => approveReveal(item.record_id)} className="btn-primary inline-flex items-center gap-2">
                  <Eye className="h-4 w-4" /> Approve reveal
                </button>
              </div>
            ))}
          </section>
        )}

        {loading ? (
          <div className="glass-card p-12 text-center text-surface-500">Loading complaints...</div>
        ) : complaints.length === 0 ? (
          <div className="glass-card p-12 text-center text-surface-500">No complaints in this queue.</div>
        ) : (
          <div className="space-y-4">
            {complaints.map(item => (
              <article key={item.id} className="glass-card space-y-4 border-l-4 border-l-amber-500 p-5">
                <header className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold capitalize text-surface-900 dark:text-white">{item.category.replace(/_/g, ' ')}</p>
                    <p className="mt-1 text-xs text-surface-500">
                      Case #{item.id} · Reporter {item.reporter_anonymous_id || 'unavailable'} · Reported {item.reported_anonymous_id || 'content'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.is_flagged ? <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">Priority review</span> : null}
                    <span className="rounded-full bg-surface-100 px-2.5 py-1 text-xs font-semibold capitalize text-surface-600 dark:bg-surface-800 dark:text-surface-300">{item.status.replace(/_/g, ' ')}</span>
                  </div>
                </header>

                <p className="whitespace-pre-wrap text-sm text-surface-700 dark:text-surface-300">{item.reason}</p>
                {item.evidence_ref && <p className="text-xs text-surface-500">Evidence reference: {item.evidence_ref}</p>}
                {item.faculty_note && <p className="rounded-lg bg-surface-50 p-3 text-xs text-surface-600 dark:bg-surface-800/60 dark:text-surface-300">Review note: {item.faculty_note}</p>}

                <textarea
                  rows={2}
                  maxLength={1000}
                  value={notes[item.id] || ''}
                  onChange={event => setNotes(current => ({ ...current, [item.id]: event.target.value }))}
                  placeholder={isFaculty ? 'Add a resolution, rejection, or escalation note' : 'Add a resolution or rejection note'}
                  className="w-full rounded-lg border border-surface-200 bg-white/70 p-3 text-sm dark:border-surface-700 dark:bg-surface-900/60"
                />

                <div className="flex flex-wrap gap-2">
                  {isFaculty ? (
                    <>
                      <button type="button" onClick={() => review(item.id, 'resolve')} className="btn-secondary inline-flex items-center gap-2"><Check className="h-4 w-4" /> Resolve</button>
                      <button type="button" onClick={() => review(item.id, 'reject')} className="btn-secondary inline-flex items-center gap-2"><X className="h-4 w-4" /> Reject</button>
                      <button type="button" onClick={() => review(item.id, 'escalate')} className="btn-primary inline-flex items-center gap-2"><ArrowUpRight className="h-4 w-4" /> Escalate</button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => resolve(item.id, 'resolve')} className="btn-secondary inline-flex items-center gap-2"><Check className="h-4 w-4" /> Resolve</button>
                      <button type="button" onClick={() => resolve(item.id, 'reject')} className="btn-secondary inline-flex items-center gap-2"><X className="h-4 w-4" /> Reject</button>
                      {item.reported_anonymous_id && (
                        <button
                          type="button"
                          onClick={() => requestReveal(item.id)}
                          disabled={(justifications[item.id] || '').trim().length < 20}
                          className="btn-secondary inline-flex items-center gap-2"
                        >
                          <Eye className="h-4 w-4" /> Request identity reveal
                        </button>
                      )}
                    </>
                  )}
                  {!isFaculty && <button type="button" onClick={() => toggleAudit(item.id)} className="btn-secondary inline-flex items-center gap-2"><History className="h-4 w-4" /> {audits[item.id] ? 'Hide history' : 'View history'}</button>}
                </div>

                {!isFaculty && item.reported_anonymous_id && (
                  <textarea
                    rows={2}
                    maxLength={1000}
                    value={justifications[item.id] || ''}
                    onChange={event => setJustifications(current => ({ ...current, [item.id]: event.target.value }))}
                    placeholder="Identity reveal justification (at least 20 characters)"
                    className="w-full rounded-lg border border-surface-200 bg-white/70 p-3 text-sm dark:border-surface-700 dark:bg-surface-900/60"
                  />
                )}

                {audits[item.id] && (
                  <ol className="space-y-2 border-t border-surface-200 pt-4 dark:border-surface-700">
                    {audits[item.id].map(entry => (
                      <li key={entry.id} className="text-xs text-surface-600 dark:text-surface-300">
                        <span className="font-semibold">{entry.action}</span> · {new Date(entry.created_at).toLocaleString()} · {entry.details?.note || entry.details?.faculty_note || ''}
                      </li>
                    ))}
                  </ol>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
      <Footer />
    </>
  );
}