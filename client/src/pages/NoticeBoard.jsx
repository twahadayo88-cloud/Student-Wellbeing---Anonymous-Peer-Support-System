import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle, Bookmark, Check, Compass, MapPin, Megaphone, MessageCircle, RefreshCw, Search, Send, ThumbsUp, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import useAuth from '../hooks/useAuth';
import { useSocket } from '../context/SocketContext';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/layout/Navbar';
import PageHeader from '../components/layout/PageHeader';
import Footer from '../components/layout/Footer';

const CATEGORIES = [
  { value: 'study_groups', label: 'Study Groups' },
  { value: 'lost_found', label: 'Lost & Found' },
  { value: 'events', label: 'Events' },
];

const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map(category => [category.value, category.label]));

function NoticeCard({ post, userId, isStudent, isFaculty, clusterCount, onRefresh }) {
  const [appealReason, setAppealReason] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [busy, setBusy] = useState(false);
  const isOwner = post.user_id === userId;
  const clusterKey = post.latitude == null ? null : `${post.latitude},${post.longitude}`;

  const react = async reaction => {
    try {
      await api.put(`/notices/${post.id}/reaction`, { reaction });
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not save reaction.');
    }
  };

  const save = async () => {
    try {
      await api.put(`/notices/${post.id}/save`, { saved: !post.saved_by_me });
      toast.success(post.saved_by_me ? 'Removed from saved posts.' : 'Post saved.');
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not save post.');
    }
  };

  const report = async () => {
    const reason = window.prompt('Why are you reporting this post?');
    if (!reason) return;
    try {
      const response = await api.post(`/notices/${post.id}/report`, { reason });
      toast.success(response.data.data?.held ? 'Post held for review after reaching three reports.' : 'Report submitted.');
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not report post.');
    }
  };

  const requestChat = async () => {
    try {
      await api.post('/chat/request', {
        receiver_anonymous_id: post.author_anonymous_id,
        subject_context: `Community post: ${post.title}`,
      });
      toast.success('Student chat request sent.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not send chat request.');
    }
  };

  const extend = async () => {
    try {
      await api.post(`/notices/${post.id}/extend`);
      toast.success('Post expiry extended by 30 days.');
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not extend this post.');
    }
  };

  const appeal = async () => {
    try {
      await api.post(`/notices/${post.id}/appeal`, { reason: appealReason });
      toast.success('Appeal submitted for faculty review.');
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not submit appeal.');
    }
  };

  const review = async decision => {
    setBusy(true);
    try {
      await api.patch(`/notices/faculty/${post.id}/review`, { decision, note: reviewNote });
      toast.success(`Post ${decision === 'publish' ? 'published' : 'rejected'}.`);
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not review post.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="overflow-hidden rounded-2xl glass-card p-5 sm:p-6 transition-all hover:border-pink-500/30 hover:shadow-glow-pink">
      <div className="space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="badge-active text-[10px] font-bold uppercase tracking-wider">{CATEGORY_LABELS[post.category]}</span>
            {post.is_official ? <span className="badge-verified text-[10px] font-bold tracking-wider inline-flex items-center gap-1"><Megaphone className="h-3 w-3" /> Official</span> : null}
            {post.is_flagged ? <span className="badge-error text-[10px] font-bold tracking-wider">Flagged</span> : null}
          </div>
          <span className="text-xs text-slate-400 font-mono">{new Date(post.created_at).toLocaleString()}</span>
        </header>

        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">{post.title}</h2>
          <p className="mt-2 whitespace-pre-wrap text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">{post.body}</p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400 font-medium">
          <span className="font-mono text-pink-500 font-bold">@{post.author_anonymous_id || 'PeerBridge'}</span>
          {post.location_name && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-pink-500" />{post.location_name}</span>}
          {clusterKey && <span>{clusterCount} in nearby cluster</span>}
          {post.distance_km !== null && post.distance_km !== undefined && <span>{Number(post.distance_km).toFixed(1)} km away</span>}
          <span>Expires {new Date(post.expires_at).toLocaleDateString()}</span>
        </div>

        {isFaculty ? (
          <div className="space-y-3 border-t border-slate-100 dark:border-white/5 pt-4">
            {post.ai_reason && <p className="text-xs text-slate-400">Review reason: {post.ai_reason}</p>}
            {post.appeal_reason && <p className="text-xs text-amber-500 font-medium">Appeal: {post.appeal_reason}</p>}
            <textarea rows={2} maxLength={1000} value={reviewNote} onChange={event => setReviewNote(event.target.value)} placeholder="Optional review note" className="input-field w-full text-xs" />
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => review('publish')} className="btn-primary py-2 px-3.5 text-xs font-bold inline-flex items-center"><Check className="mr-1 h-3.5 w-3.5" /> Publish</button>
              <button type="button" disabled={busy} onClick={() => review('reject')} className="btn-danger py-2 px-3.5 text-xs font-bold inline-flex items-center"><X className="mr-1 h-3.5 w-3.5" /> Reject</button>
            </div>
          </div>
        ) : (
          <footer className="flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-white/5 pt-4">
            <button type="button" onClick={() => react('like')} className="btn-secondary py-1.5 px-3 text-xs font-bold inline-flex items-center text-slate-600 dark:text-slate-300 hover:text-pink-500"><ThumbsUp className="mr-1.5 h-3.5 w-3.5 text-pink-500" />{post.reaction_count}</button>
            <button type="button" onClick={save} className="btn-secondary py-1.5 px-3 text-xs font-bold inline-flex items-center text-slate-600 dark:text-slate-300 hover:text-amber-500"><Bookmark className={`mr-1.5 h-3.5 w-3.5 ${post.saved_by_me ? 'fill-current text-amber-500' : 'text-slate-400'}`} />{post.save_count}</button>
            {post.status && post.status !== 'published' && <span className="badge-pending text-xs">{post.status}</span>}
            {post.status === 'published' && !isOwner && <button type="button" onClick={report} className="btn-ghost py-1.5 px-3 text-xs font-medium text-slate-400 hover:text-red-500 inline-flex items-center"><AlertTriangle className="mr-1 h-3.5 w-3.5" /> Report</button>}
            {post.status === 'published' && isStudent && !isOwner && post.author_role === 'student' && !post.is_official && <button type="button" onClick={requestChat} className="btn-primary py-1.5 px-3 text-xs font-bold inline-flex items-center"><MessageCircle className="mr-1.5 h-3.5 w-3.5" /> Request chat</button>}
            {post.status === 'published' && isOwner && <button type="button" onClick={extend} className="btn-secondary py-1.5 px-3 text-xs font-bold text-pink-500">Extend 30 days</button>}
            {isOwner && post.status === 'rejected' && post.appeal_available ? (
              <div className="flex min-w-full gap-2 pt-2">
                <input value={appealReason} onChange={event => setAppealReason(event.target.value)} placeholder="Appeal reason (10+ characters)" maxLength={1000} className="input-field flex-1 text-xs" />
                <button type="button" onClick={appeal} className="btn-primary py-1.5 px-3 text-xs font-bold">Appeal</button>
              </div>
            ) : null}
          </footer>
        )}
      </div>
    </article>
  );
}

NoticeCard.propTypes = {
  post: PropTypes.shape({
    id: PropTypes.number.isRequired,
    user_id: PropTypes.number.isRequired,
    author_anonymous_id: PropTypes.string,
    author_role: PropTypes.string,
    category: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    body: PropTypes.string.isRequired,
    status: PropTypes.string,
    is_official: PropTypes.oneOfType([PropTypes.bool, PropTypes.number]),
    is_flagged: PropTypes.oneOfType([PropTypes.bool, PropTypes.number]),
    reports_count: PropTypes.number,
    reaction_count: PropTypes.number,
    save_count: PropTypes.number,
    liked_by_me: PropTypes.oneOfType([PropTypes.bool, PropTypes.number]),
    saved_by_me: PropTypes.oneOfType([PropTypes.bool, PropTypes.number]),
    location_name: PropTypes.string,
    latitude: PropTypes.number,
    longitude: PropTypes.number,
    distance_km: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    expires_at: PropTypes.string.isRequired,
    created_at: PropTypes.string.isRequired,
    ai_reason: PropTypes.string,
    appeal_reason: PropTypes.string,
    appeal_available: PropTypes.oneOfType([PropTypes.bool, PropTypes.number]),
  }).isRequired,
  userId: PropTypes.number.isRequired,
  isStudent: PropTypes.bool,
  isFaculty: PropTypes.bool,
  clusterCount: PropTypes.number,
  onRefresh: PropTypes.func.isRequired,
};

const NoticeBoard = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isStudent = user?.role === 'student';
  const isFaculty = user?.role === 'faculty';
  const [tab, setTab] = useState('feed');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ category: '', search: '', latitude: null, longitude: null, radius_km: 10 });
  const [appliedFilters, setAppliedFilters] = useState({ category: '', search: '', latitude: null, longitude: null, radius_km: 10 });
  const [form, setForm] = useState({ category: '', title: '', body: '', location_name: '', latitude: null, longitude: null, expiry_days: 30 });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (requestedTab = tab) => {
    setLoading(true);
    try {
      const response = requestedTab === 'mine'
        ? await api.get('/notices/mine')
        : requestedTab === 'review' && isFaculty
          ? await api.get('/notices/faculty/review')
          : await api.get('/notices', { params: { ...appliedFilters, exclude_announcements: true } });
      setPosts(response.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not load community posts.');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, isFaculty, tab]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return undefined;
    const refreshForNotice = () => load();
    const onExpiring = data => toast(`Your post “${data.title}” expires within 24 hours.`, { icon: '⏳' });
    socket.on('notice:new', refreshForNotice);
    socket.on('notice:expiring', onExpiring);
    return () => {
      socket.off('notice:new', refreshForNotice);
      socket.off('notice:expiring', onExpiring);
    };
  }, [load, socket]);

  const locate = target => {
    if (!navigator.geolocation) return toast.error('Location is not available in this browser.');
    navigator.geolocation.getCurrentPosition(position => {
      const coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      if (target === 'form') setForm(current => ({ ...current, ...coordinates }));
      else {
        setFilters(current => ({ ...current, ...coordinates }));
        setAppliedFilters(current => ({ ...current, ...coordinates }));
        setTab('feed');
      }
      toast.success('Approximate location added.');
    }, () => toast.error('Could not read your location.'));
  };

  const updateForm = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));

  const submitPost = async event => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post('/notices', form);
      toast.success('Community post submitted.');
      setForm({ category: '', title: '', body: '', location_name: '', latitude: null, longitude: null, expiry_days: 30 });
      setTab('mine');
      await load('mine');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not submit community post.');
    } finally {
      setBusy(false);
    }
  };

  const clusterCounts = {};
  posts.forEach(post => {
    if (post.latitude == null || post.longitude == null) return;
    const cluster = `${post.latitude},${post.longitude}`;
    clusterCounts[cluster] = (clusterCounts[cluster] || 0) + 1;
  });

  const tabs = [
    { id: 'feed', label: 'Community Board' },
    ...(isStudent || isFaculty ? [{ id: 'mine', label: 'My Posts' }] : []),
    { id: 'create', label: 'New Community Post' },
    ...(isFaculty ? [{ id: 'review', label: 'Review Queue' }] : []),
  ];

  return (
    <>
      {isAdmin ? <Navbar /> : <Sidebar />}
      <main className={`min-h-screen px-4 pb-16 sm:px-6 lg:px-8 bg-slate-50 dark:bg-[#09090e] transition-colors ${isAdmin ? 'pt-24' : 'ml-16 pt-6 sm:ml-64'}`}>
      <div className="mx-auto max-w-5xl w-full space-y-7">
        {/* PAGE HEADER (standardized) */}
        <PageHeader
          tone="light"
          title="Community Notice Board"
          subtitle="Trust-Based Secure Dashboard"
          myId={user?.anonymous_id}
          actions={
            <button
              type="button"
              onClick={() => load()}
              disabled={loading}
              className="btn-secondary py-2.5 px-4 text-xs font-bold inline-flex items-center gap-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          }
        />

        <nav className="flex gap-2 overflow-x-auto pb-1 border-b border-slate-200/80 dark:border-white/10">
          {tabs.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`whitespace-nowrap px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                tab === item.id
                  ? 'btn-primary text-white shadow-md shadow-pink-500/20'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {tab === 'feed' && (
          <div className="flex flex-wrap gap-2.5 glass-card p-3 rounded-2xl border border-white/10">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                value={filters.search}
                onChange={event => setFilters(current => ({ ...current, search: event.target.value }))}
                placeholder="Search community posts..."
                className="input-field w-full pl-9 py-2 text-xs"
              />
            </div>
            <select
              value={filters.category}
              onChange={event => setFilters(current => ({ ...current, category: event.target.value }))}
              className="input-field py-2 text-xs"
            >
              <option value="">All categories</option>
              {CATEGORIES.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}
            </select>
            <button type="button" onClick={() => locate('filter')} className="btn-secondary py-2 px-3.5 text-xs font-bold inline-flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5 text-pink-500" /> Near me
            </button>
            {filters.latitude != null && (
              <button
                type="button"
                onClick={() => {
                  const cleared = { ...filters, latitude: null, longitude: null };
                  setFilters(cleared);
                  setAppliedFilters(cleared);
                  setTab('feed');
                }}
                className="btn-ghost py-2 px-3 text-xs font-bold text-slate-400"
              >
                Clear location
              </button>
            )}
            <button
              type="button"
              onClick={() => { setAppliedFilters(filters); setTab('feed'); }}
              className="btn-primary py-2 px-4 text-xs font-bold"
            >
              Apply
            </button>
          </div>
        )}

        {tab === 'create' ? (
          <form onSubmit={submitPost} className="grid grid-cols-1 gap-4.5 rounded-2xl glass-card-brand p-6 sm:p-7 md:grid-cols-2 border border-white/10 shadow-xl">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Category
              <select name="category" value={form.category} onChange={updateForm} required className="input-field mt-1.5 w-full text-xs">
                <option value="">Select required category</option>
                {CATEGORIES.filter(category => category.value !== 'announcements' || !isStudent).map(category => (
                  <option key={category.value} value={category.value}>{category.label}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Expires in
              <select name="expiry_days" value={form.expiry_days} onChange={updateForm} className="input-field mt-1.5 w-full text-xs">
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider md:col-span-2">
              Title
              <input name="title" required maxLength={120} value={form.title} onChange={updateForm} placeholder="Brief subject header" className="input-field mt-1.5 w-full text-xs" />
            </label>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider md:col-span-2">
              Post Content
              <textarea name="body" required minLength={10} maxLength={2000} rows={5} value={form.body} onChange={updateForm} placeholder="Details about your notice..." className="input-field mt-1.5 w-full text-xs resize-none" />
            </label>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Location name (optional)
              <input name="location_name" maxLength={100} value={form.location_name} onChange={updateForm} placeholder="Campus building or area" className="input-field mt-1.5 w-full text-xs" />
            </label>
            <div className="flex items-end">
              <button type="button" onClick={() => locate('form')} className="btn-secondary py-2.5 px-4 text-xs font-bold w-full inline-flex items-center justify-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-pink-500" /> Add approximate location
              </button>
            </div>
            {form.latitude != null && (
              <p className="text-[11px] text-slate-400 md:col-span-2 font-mono">
                * Approximate coordinates added; public locations rounded to nearby clusters for privacy.
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="btn-primary inline-flex items-center justify-center gap-2 md:col-span-2 py-3 text-xs font-bold shadow-lg shadow-pink-500/20"
            >
              <Send className="h-4 w-4" /> {busy ? 'Submitting…' : 'Submit Community Post'}
            </button>
          </form>
        ) : tab === 'feed' || tab === 'mine' || tab === 'review' ? (
          loading ? <div className="rounded-xl border border-surface-200 p-12 text-center text-surface-500 dark:border-surface-800">Loading posts…</div> : posts.length ? (
            <div className="space-y-4">{posts.map(post => {
              const cluster = post.latitude == null ? null : `${post.latitude},${post.longitude}`;
              return <NoticeCard key={post.id} post={post} userId={user.user_id} isStudent={isStudent} isFaculty={tab === 'review'} clusterCount={cluster ? clusterCounts[cluster] : 0} onRefresh={() => load()} />;
            })}</div>
          ) : <div className="rounded-xl border border-surface-200 p-12 text-center text-surface-500 dark:border-surface-800">No posts in this view.</div>
        ) : null}
            </div>
          </main>
            <Footer />
          </>
        );
      };
      export default NoticeBoard;