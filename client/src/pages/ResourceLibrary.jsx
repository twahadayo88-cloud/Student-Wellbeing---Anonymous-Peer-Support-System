import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Bookmark, Check, Download, ExternalLink, FileText, RefreshCw, Search, Star, Upload, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import useAuth from '../hooks/useAuth';
import Sidebar from '../components/layout/Sidebar';
import PageHeader from '../components/layout/PageHeader';
import Footer from '../components/layout/Footer';

const CATEGORIES = ['Lecture Notes', 'Practice', 'Reference', 'Wellbeing', 'Other'];
const TABS = [
  { id: 'browse', label: 'Browse' },
  { id: 'recommended', label: 'For You' },
  { id: 'bookmarks', label: 'Saved' },
  { id: 'mine', label: 'My Uploads' },
  { id: 'upload', label: 'Upload' },
];

function ResourceCard({ resource, facultyMode, onRefresh }) {
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [reviewReason, setReviewReason] = useState('');
  const [relevanceScore, setRelevanceScore] = useState('');
  const [qualityScore, setQualityScore] = useState('');
  const [reviews, setReviews] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(Boolean(resource.is_bookmarked));

  const bookmark = async () => {
    try {
      if (saved) await api.delete(`/resources/${resource.id}/bookmark`);
      else await api.put(`/resources/${resource.id}/bookmark`);
      setSaved(!saved);
      toast.success(saved ? 'Removed from saved resources.' : 'Resource saved.');
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update bookmark.');
    }
  };

  const submitReview = async () => {
    setBusy(true);
    try {
      await api.post(`/resources/${resource.id}/reviews`, { rating, review });
      toast.success('Rating saved.');
      setReview('');
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save rating.');
    } finally {
      setBusy(false);
    }
  };

  const approve = async (status) => {
    if (!relevanceScore || !qualityScore) {
      toast.error('Score both subject relevance and resource quality before reviewing.');
      return;
    }
    setBusy(true);
    try {
      await api.patch(`/resources/${resource.id}/approval`, {
        status,
        note: reviewReason,
        relevance_score: Number(relevanceScore),
        quality_score: Number(qualityScore),
      });
      toast.success(`Resource ${status}.`);
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not review resource.');
    } finally {
      setBusy(false);
    }
  };

  const showReviews = async () => {
    try {
      const response = await api.get(`/resources/${resource.id}/reviews`);
      setReviews(response.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load reviews.');
    }
  };

  return (
    <article className="glass-card hover:border-pink-500/30 transition-all space-y-4 p-6 hover:shadow-lg hover:shadow-pink-500/5 group border-l-4 border-l-pink-500">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-surface-900 dark:text-white group-hover:text-pink-500 transition-colors">{resource.title}</h2>
          <p className="mt-1 text-xs text-surface-500 dark:text-surface-400 font-mono">
            {resource.subject || 'General'}{resource.semester ? ` · Sem ${resource.semester}` : ''} · <span className="text-pink-500 font-medium">{resource.category}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {resource.status && (
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${
              resource.status === 'approved'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
            }`}>
              {resource.status}
            </span>
          )}
          {resource.average_rating !== undefined && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500" title={`${Number(resource.average_rating || 0).toFixed(1)} average rating`}>
              <Star className="h-3.5 w-3.5 fill-current" />
              <span className="text-xs font-bold font-mono">{Number(resource.average_rating || 0).toFixed(1)}</span>
              <span className="text-[10px] text-amber-400/80">({resource.review_count || 0})</span>
            </div>
          )}
        </div>
      </header>

      <p className="whitespace-pre-wrap text-sm text-surface-700 dark:text-surface-300 leading-relaxed">{resource.description}</p>
      {resource.moderation_reason && <p className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-600 dark:text-amber-400 font-medium">Flagged for faculty review: {resource.moderation_reason}</p>}
      {resource.review_note && <p className="text-xs text-surface-500 dark:text-surface-400 italic">Review note: {resource.review_note}</p>}
      {(resource.relevance_score || resource.quality_score) && (
        <p className="text-xs text-surface-500 dark:text-surface-400">
          Faculty assessment: subject relevance {resource.relevance_score}/5 · quality {resource.quality_score}/5
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-surface-200 dark:border-white/10 pt-4">
        {resource.file_path !== undefined || resource.original_file_name ? (
          <a className="btn-secondary text-xs inline-flex items-center gap-2 font-mono" href={`${api.defaults.baseURL}/resources/${resource.id}/file`} onClick={event => {
            const token = sessionStorage.getItem('pb_token');
            if (token) {
              event.preventDefault();
              api.get(`/resources/${resource.id}/file`, { responseType: 'blob' }).then(response => {
                const url = URL.createObjectURL(response.data);
                const link = document.createElement('a');
                link.href = url;
                link.download = resource.original_file_name || resource.title;
                link.click();
                URL.revokeObjectURL(url);
              }).catch(() => toast.error('Could not download resource.'));
            }
          }}>
            <Download className="h-4 w-4 text-pink-500" /> {resource.original_file_name || 'Download File'}
          </a>
        ) : resource.external_url ? (
          <a className="btn-secondary text-xs inline-flex items-center gap-2" href={resource.external_url} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4 text-pink-500" /> Open Link
          </a>
        ) : null}

        {!facultyMode && resource.status === 'approved' && (
          <>
            <button type="button" onClick={bookmark} className="btn-secondary text-xs inline-flex items-center gap-1.5" aria-label={saved ? 'Remove saved resource' : 'Save resource'}>
              <Bookmark className={`h-3.5 w-3.5 ${saved ? 'fill-pink-500 text-pink-500' : ''}`} /> {saved ? 'Saved' : 'Save'}
            </button>
            <button type="button" onClick={showReviews} className="btn-secondary text-xs">{reviews ? 'Hide Reviews' : 'Reviews'}</button>
          </>
        )}
      </div>

      {facultyMode ? (
        <div className="space-y-3 border-t border-surface-200 dark:border-white/10 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400">
            Faculty assessment (1 = poor, 5 = excellent)
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-surface-600 dark:text-surface-400">
              Subject relevance
              <select value={relevanceScore} onChange={event => setRelevanceScore(event.target.value)} className="w-full rounded-xl border border-surface-200 dark:border-white/10 bg-white dark:bg-[#09090e] px-3 py-2 text-sm text-surface-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500">
                <option value="">Select score</option>
                {[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value}/5</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs text-surface-600 dark:text-surface-400">
              Resource quality
              <select value={qualityScore} onChange={event => setQualityScore(event.target.value)} className="w-full rounded-xl border border-surface-200 dark:border-white/10 bg-white dark:bg-[#09090e] px-3 py-2 text-sm text-surface-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500">
                <option value="">Select score</option>
                {[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value}/5</option>)}
              </select>
            </label>
          </div>
          <textarea value={reviewReason} onChange={event => setReviewReason(event.target.value)} maxLength={1000} rows={2} placeholder="Rejection reason (required to reject)" className="w-full rounded-xl border border-surface-200 dark:border-white/10 bg-white/70 dark:bg-[#09090e] p-3 text-sm text-surface-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500" />
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => approve('approved')} className="btn-primary text-xs inline-flex items-center gap-2"><Check className="h-4 w-4" /> Approve</button>
            <button type="button" disabled={busy} onClick={() => approve('rejected')} className="btn-secondary text-xs inline-flex items-center gap-2"><X className="h-4 w-4" /> Reject</button>
          </div>
        </div>
      ) : resource.status === 'approved' && (
        <div className="space-y-2 border-t border-surface-200 dark:border-white/10 pt-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400">Rate this resource</label>
          <div className="flex items-center gap-3">
            <select value={rating} onChange={event => setRating(Number(event.target.value))} className="rounded-xl border border-surface-200 dark:border-white/10 bg-white dark:bg-[#09090e] px-3 py-2 text-sm text-surface-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500" aria-label="Rating">
              {[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} star{value === 1 ? '' : 's'}</option>)}
            </select>
            <input value={review} onChange={event => setReview(event.target.value)} maxLength={1000} placeholder="Optional review message" className="min-w-0 flex-1 rounded-xl border border-surface-200 dark:border-white/10 bg-white dark:bg-[#09090e] px-3 py-2 text-sm text-surface-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500" />
            <button type="button" disabled={busy} onClick={submitReview} className="btn-primary text-xs px-4 py-2">Submit</button>
          </div>
          {reviews && <ul className="space-y-2 pt-2">{reviews.map(entry => <li key={entry.id} className="rounded-xl bg-surface-50 dark:bg-white/5 border border-surface-200 dark:border-white/5 p-3 text-xs"><strong className="font-mono text-pink-500">{entry.reviewer_anonymous_id || 'Peer'} · {entry.rating}/5</strong>{entry.review && <p className="mt-1 text-surface-600 dark:text-surface-300">{entry.review}</p>}</li>)}</ul>}
        </div>
      )}
    </article>
  );
}

export default function ResourceLibrary() {
  const { user } = useAuth();
  const isFaculty = user?.role === 'faculty';
  const [tab, setTab] = useState(isFaculty ? 'review' : 'browse');
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ search: '', subject: '', semester: '', category: '' });
  const [form, setForm] = useState({ title: '', description: '', subject: '', semester: '', category: '', external_url: '' });
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadResources = useCallback(async (targetTab = tab) => {
    setLoading(true);
    setError('');
    try {
      let response;
      if (targetTab === 'review' && isFaculty) response = await api.get('/resources/faculty/pending');
      else if (targetTab === 'mine') response = await api.get('/resources/mine');
      else if (targetTab === 'bookmarks') response = await api.get('/resources/bookmarks');
      else if (targetTab === 'recommended') response = await api.get('/resources/recommendations');
      else response = await api.get('/resources', { params: filters });
      setResources(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load resources.');
      setResources([]);
    } finally {
      setLoading(false);
    }
  }, [filters, isFaculty, tab]);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  const submitUpload = async event => {
    event.preventDefault();
    if (!form.title.trim() || !form.description.trim() || !form.category || (!file && !form.external_url.trim())) {
      toast.error('Complete the title, description, category, and provide a file or link.');
      return;
    }
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => value && body.append(key, value));
    if (file) body.append('file', file);
    setSubmitting(true);
    try {
      await api.post('/resources', body, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Resource submitted for faculty approval.');
      setForm({ title: '', description: '', subject: '', semester: '', category: '', external_url: '' });
      setFile(null);
      setTab('mine');
      await loadResources('mine');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not upload resource.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateForm = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  const tabs = isFaculty ? [{ id: 'review', label: 'Approval Queue' }] : TABS;

  return (
    <>
      <Sidebar />
      <main className="min-h-screen ml-16 sm:ml-64 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl w-full space-y-7">
        {/* PAGE HEADER (standardized) */}
        <PageHeader
          title={<>Resource &amp; <span className="brand-text">Study Library</span></>}
          subtitle="Trust-Based Secure Dashboard"
          myId={user?.anonymous_id}
        />

        <div className="flex gap-2 overflow-x-auto border-b border-surface-200 dark:border-white/10 pb-2">
          {tabs.map(item => (
            <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition-all ${tab === item.id ? 'btn-primary text-white shadow-md shadow-pink-500/10' : 'text-surface-500 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-white/5'}`}>
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'recommended' && (
          <p className="rounded-xl border border-surface-200 dark:border-white/10 bg-surface-50 dark:bg-white/5 p-3 text-xs text-surface-600 dark:text-surface-400">
            Recommendations are ranked using your subject, semester, resource feedback, and—if mood tracking is enabled—your latest mood. Mood is read through the Mood Tracker service and is not used without consent.
          </p>
        )}

        {!isFaculty && ['browse', 'recommended', 'bookmarks'].includes(tab) && (
          <form onSubmit={event => { event.preventDefault(); loadResources('browse'); setTab('browse'); }} className="grid grid-cols-1 gap-3 rounded-2xl glass-card p-4 sm:grid-cols-2 lg:grid-cols-5 border border-surface-200/80 dark:border-white/10">
            <label className="relative lg:col-span-2">
              <Search className="absolute left-3 top-3 h-4 w-4 text-surface-400" />
              <input value={filters.search} onChange={event => setFilters(current => ({ ...current, search: event.target.value }))} placeholder="Search title, description, subject" className="w-full rounded-xl border border-surface-200 dark:border-white/10 bg-white dark:bg-[#09090e] py-2.5 pl-9 pr-3 text-sm text-surface-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500" />
            </label>
            <input value={filters.subject} onChange={event => setFilters(current => ({ ...current, subject: event.target.value }))} placeholder="Subject" className="rounded-xl border border-surface-200 dark:border-white/10 bg-white dark:bg-[#09090e] px-3 py-2.5 text-sm text-surface-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500" />
            <input value={filters.semester} onChange={event => setFilters(current => ({ ...current, semester: event.target.value }))} placeholder="Semester" className="rounded-xl border border-surface-200 dark:border-white/10 bg-white dark:bg-[#09090e] px-3 py-2.5 text-sm text-surface-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500" />
            <select value={filters.category} onChange={event => setFilters(current => ({ ...current, category: event.target.value }))} className="rounded-xl border border-surface-200 dark:border-white/10 bg-white dark:bg-[#09090e] px-3 py-2.5 text-sm text-surface-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500"><option value="">All categories</option>{CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}</select>
            <button type="submit" className="btn-primary inline-flex items-center justify-center gap-2 text-xs"><Search className="h-4 w-4" /> Filter</button>
          </form>
        )}

        {tab === 'upload' && !isFaculty ? (
          <form onSubmit={submitUpload} className="glass-card-brand grid grid-cols-1 gap-4 p-6 sm:p-8 md:grid-cols-2 rounded-2xl">
            <label className="text-xs font-semibold uppercase tracking-wider text-surface-700 dark:text-surface-300">Title<input name="title" value={form.title} onChange={updateForm} maxLength={160} required placeholder="e.g. Distributed Systems Final Review Notes" className="mt-1 w-full rounded-xl border border-surface-200 dark:border-white/10 bg-white dark:bg-[#09090e] px-3 py-2.5 text-sm text-surface-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500" /></label>
            <label className="text-xs font-semibold uppercase tracking-wider text-surface-700 dark:text-surface-300">Category<select name="category" value={form.category} onChange={updateForm} required className="mt-1 w-full rounded-xl border border-surface-200 dark:border-white/10 bg-white dark:bg-[#09090e] px-3 py-2.5 text-sm text-surface-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500"><option value="">Select category</option>{CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}</select></label>
            <label className="text-xs font-semibold uppercase tracking-wider text-surface-700 dark:text-surface-300">Subject (optional)<input name="subject" value={form.subject} onChange={updateForm} maxLength={100} placeholder="e.g. CS401" className="mt-1 w-full rounded-xl border border-surface-200 dark:border-white/10 bg-white dark:bg-[#09090e] px-3 py-2.5 text-sm text-surface-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500" /></label>
            <label className="text-xs font-semibold uppercase tracking-wider text-surface-700 dark:text-surface-300">Semester (optional)<input name="semester" value={form.semester} onChange={updateForm} maxLength={30} placeholder="e.g. Fall 2026" className="mt-1 w-full rounded-xl border border-surface-200 dark:border-white/10 bg-white dark:bg-[#09090e] px-3 py-2.5 text-sm text-surface-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500" /></label>
            <label className="text-xs font-semibold uppercase tracking-wider text-surface-700 dark:text-surface-300 md:col-span-2">Description<textarea name="description" value={form.description} onChange={updateForm} required maxLength={3000} rows={4} placeholder="Summarize content and key topics covered..." className="mt-1 w-full rounded-xl border border-surface-200 dark:border-white/10 bg-white dark:bg-[#09090e] px-3 py-2.5 text-sm text-surface-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500 leading-relaxed" /></label>
            <label className="text-xs font-semibold uppercase tracking-wider text-surface-700 dark:text-surface-300">File (PDF, TXT, DOCX, PPTX; max 5 MB)<input type="file" accept=".pdf,.txt,.docx,.pptx,.xlsx,.jpg,.jpeg,.png" onChange={event => setFile(event.target.files?.[0] || null)} className="mt-2 block w-full text-xs text-surface-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-pink-500/10 file:text-pink-500 hover:file:bg-pink-500/20" /></label>
            <label className="text-xs font-semibold uppercase tracking-wider text-surface-700 dark:text-surface-300">Or External Link<input type="url" name="external_url" value={form.external_url} onChange={updateForm} placeholder="https://..." className="mt-1 w-full rounded-xl border border-surface-200 dark:border-white/10 bg-white dark:bg-[#09090e] px-3 py-2.5 text-sm text-surface-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500" /></label>
            <button type="submit" disabled={submitting} className="btn-primary inline-flex items-center justify-center gap-2 md:col-span-2 text-xs py-3 mt-2"><Upload className="h-4 w-4" /> {submitting ? 'Submitting…' : 'Submit for Faculty Approval'}</button>
          </form>
        ) : null}

        {tab !== 'upload' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-surface-900 dark:text-white">{tab === 'review' ? 'Pending Faculty Review' : tab === 'mine' ? 'My Submissions' : tab === 'bookmarks' ? 'Saved Resources' : tab === 'recommended' ? 'Recommended for You' : 'Approved Resources'}</h2>
              <button type="button" onClick={() => loadResources()} disabled={loading} className="btn-secondary text-xs inline-flex items-center gap-2"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
            </div>
            {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-500 font-medium">{error}</div>}
            {loading ? <div className="glass-card p-12 text-center text-surface-500"><div className="w-8 h-8 rounded-full border-2 border-pink-500 border-t-transparent animate-spin mx-auto mb-3" />Loading resources…</div> : resources.length ? (
              <div className="grid gap-4">{resources.map(resource => <ResourceCard key={resource.id} resource={resource} facultyMode={tab === 'review'} onRefresh={() => loadResources()} />)}</div>
            ) : (
              <div className="glass-card flex flex-col items-center gap-3 p-12 text-center text-surface-500"><FileText className="h-8 w-8 text-pink-500/60" />No resources in this view yet.</div>
            )}
          </section>
        )}
      </div>
    </main>
      <Footer />
    </>
  );
}

ResourceCard.propTypes = {
  resource: PropTypes.shape({
    id: PropTypes.number.isRequired,
    title: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    subject: PropTypes.string,
    semester: PropTypes.string,
    category: PropTypes.string.isRequired,
    status: PropTypes.string,
    is_bookmarked: PropTypes.oneOfType([PropTypes.bool, PropTypes.number]),
    average_rating: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    review_count: PropTypes.number,
    moderation_reason: PropTypes.string,
    review_note: PropTypes.string,
    relevance_score: PropTypes.number,
    quality_score: PropTypes.number,
    file_path: PropTypes.string,
    original_file_name: PropTypes.string,
    external_url: PropTypes.string,
  }).isRequired,
  facultyMode: PropTypes.bool,
  onRefresh: PropTypes.func.isRequired,
};