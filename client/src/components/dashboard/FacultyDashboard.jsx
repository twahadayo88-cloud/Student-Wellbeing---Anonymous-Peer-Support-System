import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ShieldCheck, 
  BookOpen, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  UserCheck, 
  ArrowRight,
  RefreshCw,
  Info,
  Megaphone
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function FacultyDashboard({ user }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [pendingResources, setPendingResources] = useState([]);
  const [pendingAnnouncements, setPendingAnnouncements] = useState([]);
  const [academicTrends, setAcademicTrends] = useState([]);
  const [activeTab, setActiveTab] = useState('announcements');

  const loadFacultyData = async () => {
    setLoading(true);
    try {
      const [profileRes, complaintsRes, resourcesRes, noticesRes, trendsRes] = await Promise.allSettled([
        api.get('/profile/me'),
        api.get('/complaints/faculty/mine'),
        api.get('/resources/faculty/pending'),
        api.get('/notices/faculty/review'),
        api.get('/academic/trends'),
      ]);

      if (profileRes.status === 'fulfilled') {
        setProfile(profileRes.value.data?.data || null);
      } else {
        toast.error('Could not load your faculty profile. Please refresh to try again.');
      }
      if (complaintsRes.status === 'fulfilled') {
        setComplaints(complaintsRes.value.data?.data || []);
      }
      if (resourcesRes.status === 'fulfilled') {
        setPendingResources(resourcesRes.value.data?.data || []);
      }
      if (noticesRes.status === 'fulfilled') {
        setPendingAnnouncements(noticesRes.value.data?.data || []);
      }
      if (trendsRes.status === 'fulfilled') {
        setAcademicTrends(trendsRes.value.data?.data || []);
      }
    } catch (err) {
      toast.error('Failed to load some faculty dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFacultyData();
  }, []);

  const facultyName = [profile?.name, profile?.full_name, user?.name]
    .find((name) => typeof name === 'string' && name.trim() && name.trim().toLowerCase() !== 'anonymous faculty')
    ?.trim() || 'Respected Faculty Member';

  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay }
  });

  const facultyStats = [
    {
      id: 'complaints',
      label: 'Assigned Complaints',
      count: complaints.length,
      subtext: complaints.filter(c => c.status === 'pending').length + ' require review',
      icon: ShieldCheck,
      color: 'from-amber-500 to-orange-600',
      badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
      link: '/complaint-review',
      actionLabel: 'Review Complaints'
    },
    {
      id: 'resources',
      label: 'Pending Resources',
      count: pendingResources.length,
      subtext: 'Awaiting faculty approval',
      icon: BookOpen,
      color: 'from-blue-500 to-indigo-600',
      badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
      link: '/resources',
      actionLabel: 'Approve Materials'
    },
    {
      id: 'announcements',
      label: 'Campus Announcements',
      count: pendingAnnouncements.length ? `${pendingAnnouncements.length} In Review` : 'Active',
      subtext: 'Broadcast official department notices',
      icon: Megaphone,
      color: 'from-purple-500 to-pink-600',
      badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
      link: '/announcements',
      actionLabel: 'Do Announcement'
    },
    {
      id: 'academic',
      label: 'Academic Support Activity',
      count: academicTrends.length ? `${academicTrends.length} Active Trends` : 'Board Open',
      subtext: 'Click card to open Academic Support Board',
      icon: TrendingUp,
      color: 'from-emerald-500 to-teal-600',
      badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
      link: '/academic',
      actionLabel: 'Go to Academic Board'
    }
  ];

  return (
    <div className="space-y-8 pb-12">
      <motion.section
        {...fadeUp(0)}
        className="relative isolate overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-r from-purple-50 via-white to-pink-50 p-6 shadow-xl dark:border-slate-800 dark:from-purple-950/80 dark:via-slate-950 dark:to-pink-950/70 dark:shadow-2xl sm:p-8"
      >
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-pink-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-1/3 h-64 w-64 rounded-full bg-purple-500/15 blur-3xl" />
        <div className="relative z-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
          <div className="min-w-0 max-w-2xl">
            <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-pink-700 dark:text-pink-300">
              <UserCheck className="h-3.5 w-3.5" />
              FACULTY WORKSPACE
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Welcome, <span className="brand-text">{facultyName}</span>
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {profile?.designation ? `${profile.designation} · ` : 'Faculty · '}
              {profile?.department ? `${profile.department} Department` : 'University Faculty'}
              {' '}— support your department, review student work, and keep your community informed.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/announcements" className="btn-primary inline-flex items-center gap-2 text-xs">
                <Megaphone className="h-3.5 w-3.5" />
                Post Announcement
              </Link>
              <Link to="/profile" className="btn-secondary inline-flex items-center gap-2 text-xs">
                <Clock className="h-3.5 w-3.5 text-pink-400" />
                Office Hours &amp; Profile
              </Link>
              <button
                type="button"
                onClick={loadFacultyData}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-pink-300 hover:bg-pink-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-pink-400/40 dark:hover:bg-white/10"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          <div className="relative mx-auto flex h-40 w-40 shrink-0 items-center justify-center sm:h-48 sm:w-48 lg:mr-8">
            <div className="absolute inset-0 rounded-full border border-dashed border-pink-400/30" />
            <div className="absolute inset-5 rounded-full border border-purple-400/30" />
            <div className="absolute inset-0 rounded-full bg-pink-500/10 blur-2xl" />
            <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-pink-500 via-rose-500 to-amber-400 shadow-xl shadow-pink-500/20 sm:h-24 sm:w-24">
              <BookOpen className="h-10 w-10 text-white sm:h-12 sm:w-12" strokeWidth={1.5} />
              <video
                className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-hidden="true"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              >
                <source src="/faculty_dashboard.mp4" type="video/mp4" />
              </video>
            </div>
            <div className="absolute left-0 top-8 flex h-10 w-10 items-center justify-center rounded-2xl border border-pink-400/30 bg-white text-pink-600 shadow-lg dark:bg-slate-900/90 dark:text-pink-300">
              <Megaphone className="h-5 w-5" />
            </div>
            <div className="absolute bottom-5 right-0 flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-400/30 bg-white text-amber-600 shadow-lg dark:bg-slate-900/90 dark:text-amber-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5 text-xs dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Clock className="h-4 w-4 text-pink-300" />
            <span className="text-slate-600 dark:text-slate-400">Office hours</span>
            <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-white">
              {profile?.office_hours || 'Not set yet'}
            </span>
          </div>
          <p className="text-slate-600 dark:text-slate-400">
            Department announcements are delivered directly to your students.
          </p>
        </div>
      </motion.section>

      {/* ─── Metric Cards Grid (Entire Card Clickable) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {facultyStats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.id}
              {...fadeUp(0.1 + i * 0.05)}
              onClick={() => navigate(stat.link)}
              className="group flex cursor-pointer select-none flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-lg transition-all hover:-translate-y-1 hover:border-pink-300 hover:shadow-pink-500/10 dark:border-slate-800/90 dark:bg-[#111118] dark:shadow-xl dark:hover:border-pink-500/40 sm:p-6"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="rounded-2xl border border-pink-500/30 bg-gradient-to-br from-pink-500/20 to-amber-500/20 p-3 text-pink-400 shadow-md">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${stat.badgeColor}`}>
                    {stat.count}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-700 transition-colors group-hover:text-pink-600 dark:text-slate-300 dark:group-hover:text-pink-300">
                  {stat.label}
                </h3>
                <p className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
                  {stat.count}
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  {stat.subtext}
                </p>
              </div>

              <div
                className="mt-5 inline-flex items-center justify-between text-xs font-bold text-pink-400 transition-transform group-hover:translate-x-1"
              >
                <span>{stat.actionLabel}</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ─── Faculty Role & Action Guide ─── */}
      <motion.div {...fadeUp(0.3)} className="glass-card p-6 sm:p-7 border-l-4 border-l-primary-500">
        <div className="flex items-start gap-3.5 mb-4">
          <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-surface-900 dark:text-white">
              Faculty Capabilities & Platform Role
            </h2>
            <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
              Faculty focuses exclusively on announcements, academic materials oversight, and student conflict mediation:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          <div className="rounded-xl bg-surface-50/70 dark:bg-surface-800/40 p-4 border border-surface-200/50 dark:border-surface-700/50">
            <div className="flex items-center gap-2 font-semibold text-sm text-surface-900 dark:text-white mb-2">
              <Megaphone className="w-4 h-4 text-purple-500" />
              1. Announcements
            </div>
            <p className="text-xs text-surface-600 dark:text-surface-400 leading-relaxed">
              Post authoritative announcements to all students in your department without AI filtering.
            </p>
          </div>

          <div className="rounded-xl bg-surface-50/70 dark:bg-surface-800/40 p-4 border border-surface-200/50 dark:border-surface-700/50">
            <div className="flex items-center gap-2 font-semibold text-sm text-surface-900 dark:text-white mb-2">
              <BookOpen className="w-4 h-4 text-blue-500" />
              2. Resource Approvals
            </div>
            <p className="text-xs text-surface-600 dark:text-surface-400 leading-relaxed">
              Review and approve study guides, past exams, and lecture notes uploaded by students.
            </p>
          </div>

          <div className="rounded-xl bg-surface-50/70 dark:bg-surface-800/40 p-4 border border-surface-200/50 dark:border-surface-700/50">
            <div className="flex items-center gap-2 font-semibold text-sm text-surface-900 dark:text-white mb-2">
              <ShieldCheck className="w-4 h-4 text-amber-500" />
              3. Level-1 Complaints
            </div>
            <p className="text-xs text-surface-600 dark:text-surface-400 leading-relaxed">
              Act as first-line confidential mediator for peer disputes before administrative escalation.
            </p>
          </div>

          <div 
            onClick={() => navigate('/academic')}
            className="rounded-xl bg-surface-50/70 dark:bg-surface-800/40 p-4 border border-surface-200/50 dark:border-surface-700/50 cursor-pointer hover:border-emerald-500/40 transition-colors"
          >
            <div className="flex items-center gap-2 font-semibold text-sm text-surface-900 dark:text-white mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              4. Academic Board
            </div>
            <p className="text-xs text-surface-600 dark:text-surface-400 leading-relaxed">
              Click to view live academic requests and subject difficulty trends across your department.
            </p>
          </div>
        </div>
      </motion.div>

      {/* ─── Workload Queues Tabs ─── */}
      <motion.div {...fadeUp(0.4)} className="glass-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-surface-200 dark:border-surface-800 gap-4">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-surface-900 dark:text-white">
              Faculty Workload Queues
            </h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-semibold">
              Live
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('announcements')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'announcements'
                  ? 'bg-primary-600 text-white'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-200'
              }`}
            >
              Announcements ({pendingAnnouncements.length})
            </button>
            <button
              onClick={() => setActiveTab('resources')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'resources'
                  ? 'bg-primary-600 text-white'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-200'
              }`}
            >
              Resources ({pendingResources.length})
            </button>
            <button
              onClick={() => setActiveTab('complaints')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'complaints'
                  ? 'bg-primary-600 text-white'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-200'
              }`}
            >
              Complaints ({complaints.length})
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="mt-5">
          {activeTab === 'announcements' && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  Official announcements broadcasted to students and reported community content for review.
                </p>
                <Link
                  to="/announcements"
                  className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  Do Announcement
                </Link>
              </div>

              {pendingAnnouncements.length === 0 ? (
                <div className="py-10 text-center text-surface-500 text-sm bg-surface-50/50 dark:bg-surface-800/20 rounded-xl">
                  <CheckCircle2 className="w-9 h-9 mx-auto text-emerald-500 mb-2 opacity-80" />
                  <p className="font-semibold text-surface-700 dark:text-surface-300">Announcements Queue Clear</p>
                  <p className="text-xs mt-1 text-surface-400">No reported notices or appeals requiring review right now.</p>
                </div>
              ) : (
                <div className="divide-y divide-surface-200 dark:divide-surface-800">
                  {pendingAnnouncements.slice(0, 5).map((notice) => (
                    <div key={notice.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="font-semibold text-sm text-surface-900 dark:text-white">
                          {notice.title}
                        </span>
                        <p className="text-xs text-surface-500 dark:text-surface-400 mt-1 line-clamp-1">
                          {notice.body}
                        </p>
                      </div>
                      <Link
                        to="/announcements"
                        className="btn-primary text-xs py-1.5 px-3 self-start sm:self-auto"
                      >
                        Review Announcement
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'resources' && (
            <div>
              {pendingResources.length === 0 ? (
                <div className="py-10 text-center text-surface-500 text-sm bg-surface-50/50 dark:bg-surface-800/20 rounded-xl">
                  <CheckCircle2 className="w-9 h-9 mx-auto text-emerald-500 mb-2 opacity-80" />
                  <p className="font-semibold text-surface-700 dark:text-surface-300">Resource Queue Clear</p>
                  <p className="text-xs mt-1 text-surface-400">No student study materials waiting for approval.</p>
                </div>
              ) : (
                <div className="divide-y divide-surface-200 dark:divide-surface-800">
                  {pendingResources.slice(0, 5).map((res) => (
                    <div key={res.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-surface-900 dark:text-white">
                            {res.title}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                            {res.subject || 'Resource'}
                          </span>
                        </div>
                        <p className="text-xs text-surface-500 dark:text-surface-400 mt-1 line-clamp-1">
                          {res.description || 'Uploaded by student'}
                        </p>
                      </div>
                      <Link
                        to="/resources"
                        className="btn-primary text-xs py-1.5 px-3 self-start sm:self-auto"
                      >
                        Review Material
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'complaints' && (
            <div>
              {complaints.length === 0 ? (
                <div className="py-10 text-center text-surface-500 text-sm bg-surface-50/50 dark:bg-surface-800/20 rounded-xl">
                  <CheckCircle2 className="w-9 h-9 mx-auto text-emerald-500 mb-2 opacity-80" />
                  <p className="font-semibold text-surface-700 dark:text-surface-300">Complaints Queue Clear</p>
                  <p className="text-xs mt-1 text-surface-400">No active student complaints assigned to you.</p>
                </div>
              ) : (
                <div className="divide-y divide-surface-200 dark:divide-surface-800">
                  {complaints.slice(0, 5).map((comp) => (
                    <div key={comp.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-primary-600 dark:text-primary-400">
                            #{comp.id}
                          </span>
                          <span className="text-xs uppercase font-semibold px-2 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300">
                            {comp.category || 'General'}
                          </span>
                        </div>
                        <p className="text-xs text-surface-600 dark:text-surface-300 mt-1.5 line-clamp-1">
                          {comp.reason}
                        </p>
                      </div>
                      <Link
                        to="/complaint-review"
                        className="btn-primary text-xs py-1.5 px-3 self-start sm:self-auto"
                      >
                        Mediate
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* ─── Faculty Quick Action Links ─── */}
      <motion.div {...fadeUp(0.5)} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          to="/announcements"
          className="glass-card p-4 flex items-center gap-3.5 hover:border-purple-500/50 hover:bg-surface-50/50 dark:hover:bg-surface-800/40 transition-all group"
        >
          <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 group-hover:scale-105 transition-transform">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-surface-900 dark:text-white">Do Announcement</h4>
            <p className="text-[11px] text-surface-500 dark:text-surface-400">Broadcast official notice</p>
          </div>
        </Link>

        <Link
          to="/academic"
          className="glass-card p-4 flex items-center gap-3.5 hover:border-emerald-500/50 hover:bg-surface-50/50 dark:hover:bg-surface-800/40 transition-all group"
        >
          <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 group-hover:scale-105 transition-transform">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-surface-900 dark:text-white">Academic Board</h4>
            <p className="text-[11px] text-surface-500 dark:text-surface-400">View department trends</p>
          </div>
        </Link>

        <Link
          to="/resources"
          className="glass-card p-4 flex items-center gap-3.5 hover:border-blue-500/50 hover:bg-surface-50/50 dark:hover:bg-surface-800/40 transition-all group"
        >
          <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 group-hover:scale-105 transition-transform">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-surface-900 dark:text-white">Approve Resources</h4>
            <p className="text-[11px] text-surface-500 dark:text-surface-400">Review student uploads</p>
          </div>
        </Link>

        <Link
          to="/profile"
          className="glass-card p-4 flex items-center gap-3.5 hover:border-primary-500/50 hover:bg-surface-50/50 dark:hover:bg-surface-800/40 transition-all group"
        >
          <div className="p-3 rounded-xl bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300 group-hover:scale-105 transition-transform">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-surface-900 dark:text-white">Office Hours</h4>
            <p className="text-[11px] text-surface-500 dark:text-surface-400">Set availability schedule</p>
          </div>
        </Link>
      </motion.div>
    </div>
  );
}
