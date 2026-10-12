import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle, ShieldAlert, ChevronDown } from 'lucide-react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import useAuth from '../hooks/useAuth';
import Navbar from '../components/layout/Navbar';
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
  open:         { label: 'Open',          cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  under_review: { label: 'Under Review',  cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  escalated:    { label: 'Escalated',     cls: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
  resolved:     { label: 'Resolved',      cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  rejected:     { label: 'Rejected',      cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
  dismissed:    { label: 'Dismissed',     cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
};

const StatusBadge = ({ status }) => {
  const s = STATUS_BADGE[status] || STATUS_BADGE.open;
  return (
    <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${s.cls}`}>
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
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Peer Anonymous ID <span className="text-gray-400 font-normal">(optional when reporting content)</span>
        </label>
        <input
          type="text"
          className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="e.g. PEER-9A3F2"
          value={anonymousId}
          onChange={e => setAnonymousId(e.target.value)}
        />
        <p className="text-xs text-gray-400 mt-1">Find this in the peer&apos;s profile or chat header.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Evidence reference <span className="text-gray-400 font-normal">(optional; required if no peer ID)</span>
        </label>
        <input
          type="text"
          maxLength={255}
          className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="Message or post reference"
          value={evidenceRef}
          onChange={e => setEvidenceRef(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Category <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <select
            className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2.5 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            <option value="">Select a category…</option>
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description <span className="text-red-500">*</span>
          <span className="text-gray-400 font-normal ml-1">(min 10 characters)</span>
        </label>
        <textarea
          rows={4}
          maxLength={1000}
          className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="Describe the incident clearly and factually…"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
        <p className="text-xs text-gray-400 text-right mt-1">{reason.length}/1000</p>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm transition active:scale-95"
      >
        {submitting ? 'Submitting…' : 'Submit Complaint'}
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

  if (loading) return <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>;
  if (!complaints.length) return (
    <div className="py-10 text-center text-gray-400 text-sm">No complaints filed yet.</div>
  );

  return (
    <ul className="space-y-3">
      {complaints.map(c => (
        <li key={c.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-gray-800 dark:text-white capitalize">
              {c.category?.replace(/_/g, ' ')}
            </span>
            <StatusBadge status={c.status} />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{c.reason}</p>
          <p className="text-xs text-gray-400 mt-1">{new Date(c.created_at).toLocaleDateString()}</p>
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
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="text-center p-10">
          <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            The complaint portal is for students. Faculty and admins use the role-based review portal.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-4 pt-28 pb-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">Complaints</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Report inappropriate behaviour anonymously. Your identity is protected.
          </p>
        </div>

        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-2xl px-5 py-4">
          <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-800 dark:text-red-300">
            <strong>Genuine emergencies</strong> must be reported to real-world emergency services. PeerBridge does not handle emergencies.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 rounded-2xl p-1">
          {[
            { key: 'submit', label: 'New Complaint' },
            { key: 'mine',   label: 'My Complaints' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all duration-200
                ${tab === t.key
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          {tab === 'submit' ? (
            <SubmitForm onSubmitted={handleSubmitted} />
          ) : (
            <MyComplaints refresh={refresh} />
          )}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-500 pb-4">
          Complaints are reviewed by faculty (Level 1) and escalated to Higher Authority (Level 2) as needed.
          False reports may result in account action.
        </p>
            </div>
          </div>
            <Footer />
          </>
        );
      };
      export default Complaints;
