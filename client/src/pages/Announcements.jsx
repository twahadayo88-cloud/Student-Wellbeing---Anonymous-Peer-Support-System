import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Megaphone, 
  Send, 
  RefreshCw, 
  Search, 
  Clock, 
  UserCheck, 
  AlertCircle, 
  CheckCircle2, 
  Bookmark, 
  ThumbsUp, 
  Building2,
  Calendar
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import useAuth from '../hooks/useAuth';
import Sidebar from '../components/layout/Sidebar';
import PageHeader from '../components/layout/PageHeader';
import Footer from '../components/layout/Footer';

export default function Announcements() {
  const { user } = useAuth();
  const isFaculty = user?.role === 'faculty' || user?.role === 'admin' || user?.role === 'super_admin';

  const [announcements, setAnnouncements] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('feed'); // 'feed' | 'create'
  const [busy, setBusy] = useState(false);

  // Form state for creating announcement
  const [form, setForm] = useState({
    title: '',
    body: '',
    expiry_days: 30,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, announcementsRes] = await Promise.allSettled([
        api.get('/profile/me'),
        api.get('/notices', { params: { category: 'announcements' } }),
      ]);

      if (profileRes.status === 'fulfilled') {
        setProfile(profileRes.value.data?.data || null);
      }
      if (announcementsRes.status === 'fulfilled') {
        setAnnouncements(announcementsRes.value.data?.data || []);
      }
    } catch (err) {
      toast.error('Failed to load announcements.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!profile?.department) {
      toast.error('Please set your department in Profile before posting an announcement.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/notices', {
        ...form,
        category: 'announcements',
      });
      toast.success('Official announcement published to your department!');
      setForm({ title: '', body: '', expiry_days: 30 });
      setTab('feed');
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to publish announcement.');
    } finally {
      setBusy(false);
    }
  };

  const react = async (postId, reaction) => {
    try {
      await api.put(`/notices/${postId}/reaction`, { reaction });
      loadData();
    } catch (err) {
      toast.error('Could not save reaction.');
    }
  };

  const save = async (postId, currentlySaved) => {
    try {
      await api.put(`/notices/${postId}/save`, { saved: !currentlySaved });
      toast.success(currentlySaved ? 'Removed from saved announcements.' : 'Announcement saved.');
      loadData();
    } catch (err) {
      toast.error('Could not save announcement.');
    }
  };

  const filteredAnnouncements = announcements.filter(item => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return item.title?.toLowerCase().includes(q) || item.body?.toLowerCase().includes(q);
  });

  const userDepartment = profile?.department;

  return (
    <>
      <Sidebar />
      <main className="min-h-screen ml-16 sm:ml-64 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto w-full">
        {/* PAGE HEADER (standardized) */}
        <PageHeader
          title={<>Department <span className="brand-text">Announcements</span></>}
          subtitle="Trust-Based Secure Dashboard"
          myId={profile?.anonymous_id || user?.anonymous_id}
          actions={
            <>
              <button
                onClick={loadData}
                disabled={loading}
                className="btn-secondary text-xs inline-flex items-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              {isFaculty && (
                <button
                  onClick={() => setTab(tab === 'create' ? 'feed' : 'create')}
                  className="btn-primary text-xs inline-flex items-center gap-2"
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  {tab === 'create' ? 'View Announcements' : 'Post Announcement'}
                </button>
              )}
            </>
          }
        />

        {/* Department Status Banner */}
        <div className="mb-8 p-4 rounded-2xl glass-card border border-surface-200/80 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-pink-500/20 to-amber-500/20 text-pink-500 border border-pink-500/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-surface-500 dark:text-surface-400 font-medium">Your Active Department</p>
              <p className="text-sm font-bold text-surface-900 dark:text-white font-mono">
                {userDepartment ? `${userDepartment} Department` : 'No Department Selected'}
              </p>
            </div>
          </div>

          {!userDepartment ? (
            <div className="flex items-center gap-2 text-amber-500 dark:text-amber-400 text-xs font-semibold">
              <AlertCircle className="w-4 h-4" />
              <span>Set department in profile to receive and view announcements</span>
              <Link to="/profile" className="underline ml-1 text-pink-500 hover:text-pink-400">Go to Profile →</Link>
            </div>
          ) : (
            <div className="text-xs text-surface-500 dark:text-surface-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Announcements are strictly isolated to students & faculty of {userDepartment}
            </div>
          )}
        </div>

        {/* Create Announcement Form (Faculty Only) */}
        {tab === 'create' && isFaculty && (
          <div className="mb-10 glass-card-brand p-6 sm:p-8">
            <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-surface-200 dark:border-white/10">
              <Megaphone className="w-5 h-5 text-pink-500" />
              <h2 className="text-lg font-bold text-surface-900 dark:text-white">
                Publish Official Announcement to {userDepartment || 'Department'}
              </h2>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-surface-700 dark:text-surface-300 mb-1.5">
                  Announcement Title
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  placeholder="e.g., Midterm Exam Schedule & Syllabus Details"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-xl border border-surface-200 dark:border-white/10 bg-surface-50 dark:bg-[#09090e] px-4 py-2.5 text-sm text-surface-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-surface-700 dark:text-surface-300 mb-1.5">
                  Announcement Details / Body
                </label>
                <textarea
                  required
                  minLength={10}
                  maxLength={2500}
                  rows={5}
                  placeholder="Write the full official announcement details here..."
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  className="w-full rounded-xl border border-surface-200 dark:border-white/10 bg-surface-50 dark:bg-[#09090e] px-4 py-2.5 text-sm text-surface-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500 transition-all leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-surface-700 dark:text-surface-300 mb-1.5">
                    Expiry Window
                  </label>
                  <select
                    value={form.expiry_days}
                    onChange={(e) => setForm({ ...form, expiry_days: Number(e.target.value) })}
                    className="w-full rounded-xl border border-surface-200 dark:border-white/10 bg-surface-50 dark:bg-[#09090e] px-3 py-2 text-sm text-surface-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500"
                  >
                    <option value={7}>7 Days</option>
                    <option value={30}>30 Days</option>
                    <option value={60}>60 Days</option>
                    <option value={90}>90 Days</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <div className="text-xs text-surface-500 dark:text-surface-400 pb-2">
                    Notice will be visible only to students enrolled in <strong className="text-pink-500">{userDepartment}</strong>.
                  </div>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setTab('feed')}
                  className="btn-secondary text-xs px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || !userDepartment}
                  className="btn-primary text-xs px-5 py-2 inline-flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {busy ? 'Publishing…' : 'Publish Announcement'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              placeholder={`Search ${userDepartment || ''} announcements...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-surface-200 dark:border-white/10 bg-white dark:bg-[#111118] py-2.5 pl-10 pr-4 text-sm text-surface-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500 transition-all"
            />
          </div>
        </div>

        {/* Announcements List */}
        {loading ? (
          <div className="py-20 text-center text-surface-500">
            <div className="w-8 h-8 rounded-full border-2 border-pink-500 border-t-transparent animate-spin mx-auto mb-3" />
            <p className="text-sm">Loading department announcements…</p>
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="py-20 text-center glass-card p-8">
            <CheckCircle2 className="w-12 h-12 text-pink-500 mx-auto mb-3 opacity-80" />
            <h3 className="text-base font-bold text-surface-900 dark:text-white">
              No Announcements for {userDepartment || 'Your Department'}
            </h3>
            <p className="text-xs text-surface-500 dark:text-surface-400 mt-1 max-w-md mx-auto">
              {search.trim()
                ? 'No announcements match your search query.'
                : 'Faculty has not posted any official announcements for this department recently.'}
            </p>
            {isFaculty && (
              <button
                onClick={() => setTab('create')}
                className="btn-primary mt-4 text-xs inline-flex items-center gap-1.5"
              >
                <Megaphone className="w-3.5 h-3.5" />
                Create First Announcement
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAnnouncements.map((item) => (
              <div
                key={item.id}
                className="glass-card p-5 sm:p-6 hover:border-pink-500/40 transition-all border-l-4 border-l-pink-500 hover:shadow-lg hover:shadow-pink-500/5 group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                      <Megaphone className="w-3 h-3" />
                      Official Announcement
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono text-surface-600 dark:text-surface-400 bg-surface-100 dark:bg-white/5 border border-surface-200 dark:border-white/10">
                      <Building2 className="w-3 h-3 text-pink-500" />
                      {item.department || userDepartment}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-surface-400">
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5" />
                      Expires {new Date(item.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-2 group-hover:text-pink-500 transition-colors">
                  {item.title}
                </h3>
                <p className="text-sm text-surface-700 dark:text-surface-300 whitespace-pre-line leading-relaxed mb-4">
                  {item.body}
                </p>

                <div className="pt-3 border-t border-surface-100 dark:border-white/10 flex items-center justify-between text-xs text-surface-500">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <UserCheck className="w-3.5 h-3.5 text-pink-500" />
                    <span className="font-medium text-surface-600 dark:text-surface-300">Verified Faculty Broadcast</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => react(item.id, 'like')}
                      className={`inline-flex items-center gap-1.5 transition-colors ${
                        item.liked_by_me ? 'text-pink-500 font-semibold' : 'hover:text-pink-500'
                      }`}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>{item.reaction_count || 0}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => save(item.id, item.saved_by_me)}
                      className={`inline-flex items-center gap-1.5 transition-colors ${
                        item.saved_by_me ? 'text-amber-500 font-semibold' : 'hover:text-amber-500'
                      }`}
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>{item.saved_by_me ? 'Saved' : 'Save'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </main>
      <Footer />
    </>
  );
}
