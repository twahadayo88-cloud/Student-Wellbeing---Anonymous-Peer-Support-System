import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Bookmark, BookOpen, Check, Download, ExternalLink, FileText, RefreshCw, Search, Star, Upload, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import useAuth from '../hooks/useAuth';

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
    setBusy(true);
    try {
      await api.patch(`/resources/${resource.id}/approval`, { status, note: reviewReason });
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
    <article className="glass-card space-y-4 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-surface-900 dark:text-white">{resource.title}</h2>
          <p className="mt-1 text-xs text-surface-500">
            {resource.subject || 'General'}{resource.semester ? ` · Semester ${resource.semester}` : ''} · {resource.category}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {resource.status && <span className="rounded-full bg-surface-100 px-2.5 py-1 text-xs font-medium capitalize text-surface-600 dark:bg-surface-800 dark:text-surface-300">{resource.status}</span>}
          {resource.average_rating !== undefined && <div className="flex items-center gap-1 text-amber-500" title={`${Number(resource.average_rating || 0).toFixed(1)} average rating`}>
            <Star className="h-4 w-4 fill-current" />
            <span className="text-sm font-semibold">{Number(resource.average_rating || 0).toFixed(1)}</span>
            <span className="text-xs text-surface-400">({resource.review_count || 0})</span>
          </div>}
        </div>
      </header>

      <p className="whitespace-pre-wrap text-sm text-surface-700 dark:text-surface-300">{resource.description}</p>
      {resource.moderation_reason && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">Flagged for faculty review: {resource.moderation_reason}</p>}
      {resource.review_note && <p className="text-xs text-surface-500">Review note: {resource.review_note}</p>}

      <div className="flex flex-wrap items-center gap-2 border-t border-surface-200 pt-3 dark:border-surface-700">
        {resource.file_path !== undefined || resource.original_file_name ? (
          <a className="btn-secondary inline-flex items-center gap-2" href={`${api.defaults.baseURL}/resources/${resource.id}/file`} onClick={event => {
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
            <Download className="h-4 w-4" /> {resource.original_file_name || 'Download file'}
          </a>
        ) : resource.external_url ? (
          <a className="btn-secondary inline-flex items-center gap-2" href={resource.external_url} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" /> Open link
          </a>
        ) : null}

        {!facultyMode && resource.status === 'approved' && (
          <>
            <button type="button" onClick={bookmark} className="btn-secondary inline-flex items-center gap-2" aria-label={saved ? 'Remove saved resource' : 'Save resource'}>
              <Bookmark className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} /> {saved ? 'Saved' : 'Save'}
            </button>
            <button type="button" onClick={showReviews} className="btn-secondary">{reviews ? 'Refresh reviews' : 'Reviews'}</button>
          </>
        )}
      </div>

      {facultyMode ? (
        <div className="space-y-3 border-t border-surface-200 pt-4 dark:border-surface-700">
          <textarea value={reviewReason} onChange={event => setReviewReason(event.target.value)} maxLength={1000} rows={2} placeholder="Rejection reason (required to reject)" className="w-full rounded-lg border border-surface-200 bg-white/70 p-3 text-sm dark:border-surface-700 dark:bg-surface-900/60" />
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => approve('approved')} className="btn-primary inline-flex items-center gap-2"><Check className="h-4 w-4" /> Approve</button>
            <button type="button" disabled={busy} onClick={() => approve('rejected')} className="btn-secondary inline-flex items-center gap-2"><X className="h-4 w-4" /> Reject</button>
          </div>
        </div>
      ) : resource.status === 'approved' && (
        <div className="space-y-2 border-t border-surface-200 pt-4 dark:border-surface-700">
          <label className="block text-xs font-semibold text-surface-600 dark:text-surface-300">Rate this resource</label>
          <div className="flex items-center gap-3">
            <select value={rating} onChange={event => setRating(Number(event.target.value))} className="rounded-lg border border-surface-200 bg-white/70 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900/60" aria-label="Rating">
              {[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} star{value === 1 ? '' : 's'}</option>)}
            </select>
            <input value={review} onChange={event => setReview(event.target.value)} maxLength={1000} placeholder="Optional review" className="min-w-0 flex-1 rounded-lg border border-surface-200 bg-white/70 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900/60" />
            <button type="button" disabled={busy} onClick={submitReview} className="btn-primary">Submit</button>
          </div>
          {reviews && <ul className="space-y-2 pt-2">{reviews.map(entry => <li key={entry.id} className="rounded-lg bg-surface-50 p-3 text-xs dark:bg-surface-800/60"><strong>{entry.reviewer_anonymous_id || 'Peer'} · {entry.rating}/5</strong>{entry.review && <p className="mt-1">{entry.review}</p>}</li>)}</ul>}
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
    <main className="min-h-screen px-4 pb-12 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-7">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-teal-600">PeerBridge Library</p>
            <h1 className="mt-1 text-3xl font-bold text-surface-900 dark:text-white">Resource &amp; Study Library</h1>
            <p className="mt-1 text-sm text-surface-500">Approved study materials, peer ratings, and saved resources.</p>
          </div>
          <BookOpen className="h-8 w-8 text-teal-600" />
        </header>

        <div className="flex gap-1 overflow-x-auto border-b border-surface-200 dark:border-surface-800">
          {tabs.map(item => (
            <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${tab === item.id ? 'border-teal-500 text-teal-700 dark:text-teal-300' : 'border-transparent text-surface-500 hover:text-surface-800 dark:hover:text-surface-200'}`}>
              {item.label}
            </button>
          ))}
        </div>

        {!isFaculty && ['browse', 'recommended', 'bookmarks'].includes(tab) && (
          <form onSubmit={event => { event.preventDefault(); loadResources('browse'); setTab('browse'); }} className="grid grid-cols-1 gap-3 rounded-xl border border-surface-200 bg-white/60 p-4 sm:grid-cols-2 lg:grid-cols-5 dark:border-surface-800 dark:bg-surface-900/40">
            <label className="relative lg:col-span-2"><Search className="absolute left-3 top-3 h-4 w-4 text-surface-400" /><input value={filters.search} onChange={event => setFilters(current => ({ ...current, search: event.target.value }))} placeholder="Search title, description, subject" className="w-full rounded-lg border border-surface-200 bg-white py-2.5 pl-9 pr-3 text-sm dark:border-surface-700 dark:bg-surface-900" /></label>
            <input value={filters.subject} onChange={event => setFilters(current => ({ ...current, subject: event.target.value }))} placeholder="Subject" className="rounded-lg border border-surface-200 bg-white px-3 py-2.5 text-sm dark:border-surface-700 dark:bg-surface-900" />
            <input value={filters.semester} onChange={event => setFilters(current => ({ ...current, semester: event.target.value }))} placeholder="Semester" className="rounded-lg border border-surface-200 bg-white px-3 py-2.5 text-sm dark:border-surface-700 dark:bg-surface-900" />
            <select value={filters.category} onChange={event => setFilters(current => ({ ...current, category: event.target.value }))} className="rounded-lg border border-surface-200 bg-white px-3 py-2.5 text-sm dark:border-surface-700 dark:bg-surface-900"><option value="">All categories</option>{CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}</select>
            <button type="submit" className="btn-primary inline-flex items-center justify-center gap-2"><Search className="h-4 w-4" /> Search</button>
          </form>
        )}

        {tab === 'upload' && !isFaculty ? (
          <form onSubmit={submitUpload} className="glass-card grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
            <label className="text-sm font-medium">Title<input name="title" value={form.title} onChange={updateForm} maxLength={160} required className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-3 py-2.5 dark:border-surface-700 dark:bg-surface-900" /></label>
            <label className="text-sm font-medium">Category<select name="category" value={form.category} onChange={updateForm} required className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-3 py-2.5 dark:border-surface-700 dark:bg-surface-900"><option value="">Select category</option>{CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}</select></label>
            <label className="text-sm font-medium">Subject (optional)<input name="subject" value={form.subject} onChange={updateForm} maxLength={100} className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-3 py-2.5 dark:border-surface-700 dark:bg-surface-900" /></label>
            <label className="text-sm font-medium">Semester (optional)<input name="semester" value={form.semester} onChange={updateForm} maxLength={30} className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-3 py-2.5 dark:border-surface-700 dark:bg-surface-900" /></label>
            <label className="text-sm font-medium md:col-span-2">Description<textarea name="description" value={form.description} onChange={updateForm} required maxLength={3000} rows={4} className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-3 py-2.5 dark:border-surface-700 dark:bg-surface-900" /></label>
            <label className="text-sm font-medium">File (PDF, TXT, DOCX, PPTX, XLSX, JPG, PNG; max 5 MB)<input type="file" accept=".pdf,.txt,.docx,.pptx,.xlsx,.jpg,.jpeg,.png" onChange={event => setFile(event.target.files?.[0] || null)} className="mt-2 block w-full text-sm" /></label>
            <label className="text-sm font-medium">Or external link<input type="url" name="external_url" value={form.external_url} onChange={updateForm} placeholder="https://..." className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-3 py-2.5 dark:border-surface-700 dark:bg-surface-900" /></label>
            <button type="submit" disabled={submitting} className="btn-primary inline-flex items-center justify-center gap-2 md:col-span-2"><Upload className="h-4 w-4" /> {submitting ? 'Submitting…' : 'Submit for Faculty Approval'}</button>
          </form>
        ) : null}

        {tab !== 'upload' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-surface-900 dark:text-white">{tab === 'review' ? 'Pending Faculty Review' : tab === 'mine' ? 'My Submissions' : tab === 'bookmarks' ? 'Saved Resources' : tab === 'recommended' ? 'Recommended for You' : 'Approved Resources'}</h2>
              <button type="button" onClick={() => loadResources()} disabled={loading} className="btn-secondary inline-flex items-center gap-2"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
            </div>
            {error && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</div>}
            {loading ? <div className="glass-card p-10 text-center text-surface-500">Loading resources…</div> : resources.length ? (
              <div className="grid gap-4">{resources.map(resource => <ResourceCard key={resource.id} resource={resource} facultyMode={tab === 'review'} onRefresh={() => loadResources()} />)}</div>
            ) : (
              <div className="glass-card flex flex-col items-center gap-3 p-12 text-center text-surface-500"><FileText className="h-8 w-8 text-surface-300" />No resources in this view yet.</div>
            )}
          </section>
        )}
      </div>
    </main>
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
    file_path: PropTypes.string,
    original_file_name: PropTypes.string,
    external_url: PropTypes.string,
  }).isRequired,
  facultyMode: PropTypes.bool,
  onRefresh: PropTypes.func.isRequired,
};