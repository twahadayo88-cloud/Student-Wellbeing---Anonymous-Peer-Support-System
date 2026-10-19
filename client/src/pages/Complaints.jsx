import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle, ShieldAlert, ChevronDown } from 'lucide-react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import useAuth from '../hooks/useAuth';
import Sidebar from '../components/layout/Sidebar';
import PageHeader from '../components/layout/PageHeader';
import Footer from '../components/layout/Footer';

const CATEGORIES = [
  { value: 'harassment',       label: 'Harassment' },
  { value: 'abusive_language', label: 'Abusive Language' },
  { value: 'academic_dispute', label: 'Academic Dispute' },
  { value: 'privacy_violation',label: 'Privacy Violation' },
  { value: 'spam_or_scam',     label: 'Spam / Scam' },
  { value: 'other',            label: 'Other' },
];

const STATUS_BADGE = {
  open:         { label: 'Open',          cls: 'bg-amber-500/10 text-amber-500 border border-amber-500/20' },
  under_review: { label: 'Under Review',  cls: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
  escalated:    { label: 'Escalated',     cls: 'bg-pink-500/10 text-pink-500 border border-pink-500/20' },
  resolved:     { label: 'Resolved',      cls: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
  rejected:     { label: 'Rejected',      cls: 'bg-surface-500/10 text-surface-400 border border-surface-500/20' },
  dismissed:    { label: 'Dismissed',     cls: 'bg-surface-500/10 text-surface-400 border border-surface-500/20' },
};

const StatusBadge = ({ status }) => {
  const s = STATUS_BADGE[status] || STATUS_BADGE.open;
  return (
    <span className={`inline-block text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full ${s.cls}`}>
      {s.label}
    </span>
  );
};
StatusBadge.propTypes = { status: PropTypes.string.isRequired };

// ─── Student: Submit Form ─────────────────────────────────────────────────────
const SubmitForm = ({ onSubmitted }) => {
  const [anonymousId, setAnonymousId] = useState('');
  const [evidenceRef, setEvidenceRef] = useState('');
  const [category, setCategory]       = useState('');
  const [reason, setReason]           = useState('');
  const [submitting, setSubmitting]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((!anonymousId.trim() && !evidenceRef.trim()) || !category || reason.trim().length < 10) {
      toast.error('Select a category, describe the issue, and provide a peer ID or evidence reference.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/complaints', {
        anonymous_id: anonymousId.trim(),
        evidence_ref: evidenceRef.trim() || undefined,
        category,
        reason: reason.trim(),
      });
      toast.success('Complaint submitted successfully.');
      setAnonymousId(''); setEvidenceRef(''); setCategory(''); setReason('');
      onSubmitted();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-gray-400 mb-1.5">
          Peer Anonymous ID <span className="text-slate-400 dark:text-surface-400 font-normal lowercase">(optional when reporting content)</span>
        </label>
        <input
          type="text"
          className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-[#09090e] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-pink-500"
          placeholder="e.g. PEER-9A3F2"
          value={anonymousId}
          onChange={e => setAnonymousId(e.target.value)}
        />
        <p className="text-[11px] text-surface-500 mt-1">Find this in the peer&apos;s profile or chat header.</p>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-gray-400 mb-1.5">
          Evidence Reference <span className="text-slate-400 dark:text-surface-400 font-normal lowercase">(optional; required if no peer ID)</span>
        </label>
        <input
          type="text"
          maxLength={255}
          className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-[#09090e] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
          placeholder="Message or post reference URL/ID"
          value={evidenceRef}
          onChange={e => setEvidenceRef(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-gray-400 mb-1.5">
          Category <span className="text-pink-500">*</span>
        </label>
        <div className="relative">
          <select
            className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-[#09090e] text-slate-900 dark:text-white px-4 py-2.5 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-pink-500"
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            <option value="">Select a category…</option>
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3.5 top-3 w-4 h-4 text-slate-400 dark:text-surface-400 pointer-events-none" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-gray-400 mb-1.5">
          Incident Details <span className="text-pink-500">*</span>
          <span className="text-slate-400 dark:text-surface-500 font-normal lowercase ml-1">(min 10 characters)</span>
        </label>
        <textarea
          rows={4}
          maxLength={1000}
          className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-[#09090e] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-500 leading-relaxed"
          placeholder="Describe the incident clearly and factually…"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
        <p className="text-[11px] font-mono text-slate-500 dark:text-surface-500 text-right mt-1">{reason.length}/1000</p>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="btn-primary w-full py-3 rounded-2xl text-xs uppercase tracking-wider font-bold transition active:scale-95 disabled:opacity-50"
      >
        {submitting ? 'Submitting…' : 'Submit Confidential Report'}
      </button>
    </form>
  );
};
SubmitForm.propTypes = { onSubmitted: PropTypes.func.isRequired };

// ─── Student: My Complaints ───────────────────────────────────────────────────
const MyComplaints = ({ refresh }) => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/complaints/my')
      .then(r => setComplaints(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refresh]);

  if (loading) return <div className="py-10 text-center text-slate-500 dark:text-surface-400 text-sm">Loading reports…</div>;
  if (!complaints.length) return (
    <div className="py-10 text-center text-slate-500 dark:text-surface-400 text-sm">No complaints filed yet.</div>
  );

  return (
    <ul className="space-y-3">
      {complaints.map(c => (
        <li key={c.id} className="rounded-2xl p-4 bg-white dark:bg-[#111118] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-bold text-surface-900 dark:text-white capitalize">
              {c.category?.replace(/_/g, ' ')}
            </span>
            <StatusBadge status={c.status} />
          </div>
          <p className="text-xs text-slate-600 dark:text-surface-300 line-clamp-2 mt-1 leading-relaxed">{c.reason}</p>
          <p className="text-[11px] font-mono text-slate-400 dark:text-surface-400 mt-2">{new Date(c.created_at).toLocaleDateString()}</p>
        </li>
      ))}
    </ul>
  );
};
MyComplaints.propTypes = { refresh: PropTypes.number.isRequired };

// ─── Main Page ────────────────────────────────────────────────────────────────
const Complaints = () => {
  const { user } = useAuth();
  const [tab, setTab]       = useState('submit');
  const [refresh, setRefresh] = useState(0);
  const isStudent = user?.role === 'student';

  const handleSubmitted = useCallback(() => {
    setRefresh(r => r + 1);
    setTab('mine');
  }, []);

  if (!isStudent) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-[#09090e]">
        <div className="text-center p-10 glass-card max-w-md mx-auto bg-white dark:bg-[#111118] border border-slate-200 dark:border-slate-800">
          <AlertTriangle className="w-12 h-12 text-pink-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Faculty &amp; Admin Review</h2>
          <p className="text-slate-500 dark:text-surface-400 text-xs leading-relaxed">
            The student complaint intake portal is restricted to students. Faculty and administrators can resolve reports in the Review Portal.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Sidebar />
      <div className="min-h-screen bg-slate-50 dark:bg-[#09090e] px-4 pt-6 pb-12 ml-16 sm:ml-64 transition-colors">
      <div className="max-w-2xl mx-auto w-full space-y-7">
        {/* PAGE HEADER (standardized) */}
        <PageHeader
          title={<>Trust &amp; Safety <span className="brand-text">Complaints</span></>}
          subtitle="Trust-Based Secure Dashboard"
          myId={user?.anonymous_id}
        />

        <div className="flex items-start gap-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl px-5 py-4">
          <ShieldAlert className="w-5 h-5 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed">
            <strong>Genuine emergencies</strong> must be reported immediately to university campus security or real-world emergency responders.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-slate-100 dark:bg-[#111118] border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5">
          {[
            { key: 'submit', label: 'New Complaint' },
            { key: 'mine',   label: 'My Complaints' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all duration-200
                ${tab === t.key
                  ? 'btn-primary text-white shadow-md shadow-pink-500/10'
                  : 'text-slate-600 dark:text-surface-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="glass-card-brand rounded-3xl p-6 sm:p-8 bg-white dark:bg-[#111118] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
          {tab === 'submit' ? (
            <SubmitForm onSubmitted={handleSubmitted} />
          ) : (
            <MyComplaints refresh={refresh} />
          )}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-slate-500 dark:text-surface-500 pb-4">
          Complaints are reviewed by designated faculty (Level 1) and escalated to Higher Authority (Level 2) if unresolved.
        </p>
      </div>
      </div>
      <Footer />
    </>
  );
};
export default Complaints;
