import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle, Bookmark, Check, Compass, MapPin, Megaphone, MessageCircle, RefreshCw, Search, Send, ThumbsUp, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import useAuth from '../hooks/useAuth';
import { useSocket } from '../context/SocketContext';

const CATEGORIES = [
  { value: 'study_groups', label: 'Study Groups' },
  { value: 'lost_found', label: 'Lost & Found' },
  { value: 'events', label: 'Events' },
  { value: 'announcements', label: 'Announcements' },
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
    <article className="overflow-hidden rounded-xl border border-surface-200 bg-white/80 dark:border-surface-800 dark:bg-surface-900/70">
      <div className="space-y-4 p-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800 dark:bg-teal-950/60 dark:text-teal-200">{CATEGORY_LABELS[post.category]}</span>
            {post.is_official ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"><Megaphone className="h-3.5 w-3.5" /> Official</span> : null}
            {post.is_flagged ? <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-300">Flagged</span> : null}
          </div>
          <span className="text-xs text-surface-500">{new Date(post.created_at).toLocaleString()}</span>
        </header>

        <div>
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white">{post.title}</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-surface-700 dark:text-surface-300">{post.body}</p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-surface-500">
          <span>By {post.author_anonymous_id || 'PeerBridge'}</span>
          {post.location_name && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{post.location_name}</span>}
          {clusterKey && <span>{clusterCount} posts in this nearby cluster</span>}
          {post.distance_km !== null && post.distance_km !== undefined && <span>{Number(post.distance_km).toFixed(1)} km away</span>}
          <span>{post.reports_count} reports</span>
          <span>Expires {new Date(post.expires_at).toLocaleDateString()}</span>
        </div>

        {isFaculty ? (
          <div className="space-y-3 border-t border-surface-200 pt-4 dark:border-surface-700">
            {post.ai_reason && <p className="text-xs text-surface-500">Review reason: {post.ai_reason}</p>}
            {post.appeal_reason && <p className="text-sm text-amber-700 dark:text-amber-300">Appeal: {post.appeal_reason}</p>}
            <textarea rows={2} maxLength={1000} value={reviewNote} onChange={event => setReviewNote(event.target.value)} placeholder="Optional review note" className="w-full rounded-lg border border-surface-200 bg-white p-3 text-sm dark:border-surface-700 dark:bg-surface-950" />
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => review('publish')} className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white"><Check className="mr-1 inline h-4 w-4" /> Publish</button>
              <button type="button" disabled={busy} onClick={() => review('reject')} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 dark:border-red-900 dark:text-red-300"><X className="mr-1 inline h-4 w-4" /> Reject</button>
            </div>
          </div>
        ) : (
          <footer className="flex flex-wrap items-center gap-2 border-t border-surface-200 pt-4 dark:border-surface-700">
            <button type="button" onClick={() => react('like')} className="rounded-lg px-3 py-2 text-sm text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800"><ThumbsUp className="mr-1 inline h-4 w-4" />{post.reaction_count}</button>
            <button type="button" onClick={save} className="rounded-lg px-3 py-2 text-sm text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800"><Bookmark className={`mr-1 inline h-4 w-4 ${post.saved_by_me ? 'fill-current' : ''}`} />{post.save_count}</button>
            {post.status && post.status !== 'published' && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold capitalize text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">{post.status}</span>}
            {post.status === 'published' && !isOwner && <button type="button" onClick={report} className="rounded-lg px-3 py-2 text-sm text-surface-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"><AlertTriangle className="mr-1 inline h-4 w-4" /> Report</button>}
            {post.status === 'published' && isStudent && !isOwner && post.author_role === 'student' && !post.is_official && <button type="button" onClick={requestChat} className="rounded-lg px-3 py-2 text-sm text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-950/40"><MessageCircle className="mr-1 inline h-4 w-4" /> Request chat</button>}
            {post.status === 'published' && isOwner && <button type="button" onClick={extend} className="rounded-lg px-3 py-2 text-sm text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-950/40">Extend 30 days</button>}
            {isOwner && post.status === 'rejected' && post.appeal_available ? (
              <div className="flex min-w-full gap-2 pt-2">
                <input value={appealReason} onChange={event => setAppealReason(event.target.value)} placeholder="Appeal reason (10+ characters)" maxLength={1000} className="min-w-0 flex-1 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-950" />
                <button type="button" onClick={appeal} className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-800 dark:border-amber-900 dark:text-amber-200">Appeal</button>
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
          : await api.get('/notices', { params: appliedFilters });
      setPosts(response.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not load notice posts.');
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
      toast.success('Post submitted. Clean posts publish immediately; flagged posts go to review.');
      setForm({ category: '', title: '', body: '', location_name: '', latitude: null, longitude: null, expiry_days: 30 });
      setTab('mine');
      await load('mine');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not submit post.');
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
    { id: 'feed', label: 'Board' },
    ...(isStudent || isFaculty ? [{ id: 'mine', label: 'My Posts' }] : []),
    { id: 'create', label: isFaculty ? 'Official Announcement' : 'New Post' },
    ...(isFaculty ? [{ id: 'review', label: 'Review Queue' }] : []),
  ];

  return (
    <main className="min-h-screen px-4 pb-12 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-7">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Campus community</p>
            <h1 className="mt-1 text-3xl font-bold text-surface-900 dark:text-white">Community Notice Board</h1>
            <p className="mt-1 text-sm text-surface-500">Posts publish after automated checks; reported content is reviewed by Faculty.</p>
          </div>
          <button type="button" onClick={() => load()} disabled={loading} className="btn-secondary inline-flex items-center gap-2"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-surface-200 dark:border-surface-800">
          {tabs.map(item => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${tab === item.id ? 'border-emerald-600 text-emerald-700 dark:text-emerald-300' : 'border-transparent text-surface-500'}`}>{item.label}</button>)}
        </nav>

        {tab === 'feed' && (
          <div className="flex flex-wrap gap-2">
            <label className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-surface-400" /><input value={filters.search} onChange={event => setFilters(current => ({ ...current, search: event.target.value }))} placeholder="Search posts" className="w-full rounded-lg border border-surface-200 bg-white py-2.5 pl-9 pr-3 text-sm dark:border-surface-700 dark:bg-surface-900" /></label>
            <select value={filters.category} onChange={event => setFilters(current => ({ ...current, category: event.target.value }))} className="rounded-lg border border-surface-200 bg-white px-3 py-2.5 text-sm dark:border-surface-700 dark:bg-surface-900"><option value="">All categories</option>{CATEGORIES.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}</select>
            <button type="button" onClick={() => locate('filter')} className="btn-secondary inline-flex items-center gap-2"><Compass className="h-4 w-4" /> Near me</button>
            {filters.latitude != null && <button type="button" onClick={() => {
              const cleared = { ...filters, latitude: null, longitude: null };
              setFilters(cleared);
              setAppliedFilters(cleared);
              setTab('feed');
            }} className="btn-secondary">Clear location</button>}
            <button type="button" onClick={() => { setAppliedFilters(filters); setTab('feed'); }} className="btn-primary">Apply</button>
          </div>
        )}

        {tab === 'create' ? (
          <form onSubmit={submitPost} className="grid grid-cols-1 gap-4 rounded-xl border border-surface-200 bg-white/70 p-5 md:grid-cols-2 dark:border-surface-800 dark:bg-surface-900/50">
            <label className="text-sm font-medium">Category<select name="category" value={form.category} onChange={updateForm} required className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-3 py-2.5 dark:border-surface-700 dark:bg-surface-950"><option value="">Select required category</option>{CATEGORIES.filter(category => category.value !== 'announcements' || !isStudent).map(category => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
            <label className="text-sm font-medium">Expires in<select name="expiry_days" value={form.expiry_days} onChange={updateForm} className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-3 py-2.5 dark:border-surface-700 dark:bg-surface-950"><option value={7}>7 days</option><option value={30}>30 days</option><option value={60}>60 days</option><option value={90}>90 days</option></select></label>
            <label className="text-sm font-medium md:col-span-2">Title<input name="title" required maxLength={120} value={form.title} onChange={updateForm} className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-3 py-2.5 dark:border-surface-700 dark:bg-surface-950" /></label>
            <label className="text-sm font-medium md:col-span-2">Post<textarea name="body" required minLength={10} maxLength={2000} rows={5} value={form.body} onChange={updateForm} className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-3 py-2.5 dark:border-surface-700 dark:bg-surface-950" /></label>
            <label className="text-sm font-medium">Location name (optional)<input name="location_name" maxLength={100} value={form.location_name} onChange={updateForm} placeholder="Campus building or area" className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-3 py-2.5 dark:border-surface-700 dark:bg-surface-950" /></label>
            <div className="flex items-end"><button type="button" onClick={() => locate('form')} className="btn-secondary inline-flex items-center gap-2"><MapPin className="h-4 w-4" /> Add approximate location</button></div>
            {form.latitude != null && <p className="text-xs text-surface-500 md:col-span-2">Approximate coordinates added; public locations are rounded to a nearby cluster.</p>}
            <button type="submit" disabled={busy} className="btn-primary inline-flex items-center justify-center gap-2 md:col-span-2"><Send className="h-4 w-4" /> {busy ? 'Submitting…' : isFaculty && form.category === 'announcements' ? 'Publish Official Announcement' : 'Submit Post'}</button>
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
  );
};

export default NoticeBoard;