import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Zap, AlertTriangle, Shield, Check, X, ArrowUpCircle, Eye, GraduationCap, History, HeartPulse, RefreshCw } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import useAuth from '../hooks/useAuth';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import BadgeDisplay from '../components/trust/BadgeDisplay';

/**
 * AdminPanel — central command for PeerBridge administrators.
 * Real-time monitoring of platform stats, moderation, and violations.
 */
export default function AdminPanel() {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();

  const [stats, setStats] = useState({
    total_users: 0,
    active_today: 0,
    total_violations: 0
  });

  const [users, setUsers] = useState([]);
  const [violations, setViolations] = useState([]);
  const [moderationQueue, setModerationQueue] = useState([]);
  const [escalations, setEscalations] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [lowScoreUsers, setLowScoreUsers] = useState([]);
  const [academicQueue, setAcademicQueue] = useState([]);
  const [moodTrends, setMoodTrends] = useState({});
  const [moodLoading, setMoodLoading] = useState(false);
  const [moodError, setMoodError] = useState('');
  const [escalatedComplaints, setEscalatedComplaints] = useState([]);
  const [pendingComplaintReveals, setPendingComplaintReveals] = useState([]);
  const [complaintAudits, setComplaintAudits] = useState({});
  const [complaintNotes, setComplaintNotes] = useState({});
  const [noticeAppeals, setNoticeAppeals] = useState([]);
  const [appealNotes, setAppealNotes] = useState({});
  const [repeatOffenders, setRepeatOffenders] = useState([]);
  const [securitySignals, setSecuritySignals] = useState(null);
  const [moderationRules, setModerationRules] = useState([]);
  const [newRuleTerm, setNewRuleTerm] = useState('');
  const [newRuleSeverity, setNewRuleSeverity] = useState('MEDIUM');
  const [policyReviews, setPolicyReviews] = useState([]);
  const [policySummary, setPolicySummary] = useState('');
  const [adminSectionLoading, setAdminSectionLoading] = useState(false);
  const [adminSectionError, setAdminSectionError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const canViewMoodTrends = user?.role === 'admin' || user?.role === 'super_admin';

  const fetchMoodTrends = async () => {
    setMoodLoading(true);
    setMoodError('');
    try {
      const res = await api.get('/mood/aggregated');
      setMoodTrends(res.data.data || {});
    } catch (err) {
      setMoodError(err.response?.data?.message || 'Could not load wellbeing trends.');
    } finally {
      setMoodLoading(false);
    }
  };

  const loadAdminSection = async (section) => {
    setAdminSectionLoading(true);
    setAdminSectionError('');
    try {
      if (section === 'complaints') {
        const [cases, reveals] = await Promise.all([
          api.get('/complaints/admin/escalated'),
          api.get('/complaints/admin/reveal-pending'),
        ]);
        setEscalatedComplaints(cases.data.data || []);
        setPendingComplaintReveals(reveals.data.data || []);
      } else if (section === 'appeals') {
        const response = await api.get('/admin/appeals');
        setNoticeAppeals(response.data.data || []);
      } else if (section === 'repeat-offenders') {
        const response = await api.get('/admin/repeat-offenders');
        setRepeatOffenders(response.data.data || []);
      } else if (section === 'security') {
        const response = await api.get('/admin/security/signals');
        setSecuritySignals(response.data.data || null);
      } else if (section === 'rules') {
        const response = await api.get('/admin/moderation/rules');
        setModerationRules(response.data.data || []);
      } else if (section === 'policy-review') {
        const response = await api.get('/admin/policy-reviews');
        setPolicyReviews(response.data.data || []);
      }
    } catch (err) {
      setAdminSectionError(err.response?.data?.message || 'Could not load this admin view.');
    } finally {
      setAdminSectionLoading(false);
    }
  };

  const loadComplaintAudit = async (complaintId) => {
    try {
      const response = await api.get(`/complaints/${complaintId}/audit`);
      setComplaintAudits(current => ({ ...current, [complaintId]: response.data.data || [] }));
    } catch (err) {
      setAdminSectionError(err.response?.data?.message || 'Could not load complaint history.');
    }
  };

  const resolveEscalatedComplaint = async (complaintId, action) => {
    const note = complaintNotes[complaintId] || '';
    if (note.trim().length < 10) {
      setAdminSectionError('Resolution or rejection note must be at least 10 characters.');
      return;
    }
    try {
      await api.post(`/complaints/${complaintId}/resolve`, { action, note });
      await loadAdminSection('complaints');
    } catch (err) {
      setAdminSectionError(err.response?.data?.message || 'Could not resolve complaint.');
    }
  };

  const approveComplaintReveal = async (recordId) => {
    try {
      const response = await api.post(`/complaints/reveal-approve/${recordId}`);
      window.alert(`Identity revealed: ${response.data.data?.email || 'user no longer exists'}`);
      await loadAdminSection('complaints');
    } catch (err) {
      setAdminSectionError(err.response?.data?.message || 'A different administrator must approve this request.');
    }
  };

  const reviewNoticeAppeal = async (appealId, decision) => {
    try {
      await api.patch(`/admin/appeals/${appealId}`, { decision, note: appealNotes[appealId] || '' });
      await loadAdminSection('appeals');
    } catch (err) {
      setAdminSectionError(err.response?.data?.message || 'Could not review appeal.');
    }
  };

  const addModerationRule = async (event) => {
    event.preventDefault();
    try {
      await api.post('/admin/moderation/rules', { term: newRuleTerm, severity: newRuleSeverity });
      setNewRuleTerm('');
      await loadAdminSection('rules');
    } catch (err) {
      setAdminSectionError(err.response?.data?.message || 'Could not add moderation rule.');
    }
  };

  const updateModerationRule = async (ruleId, updates) => {
    try {
      await api.patch(`/admin/moderation/rules/${ruleId}`, updates);
      await loadAdminSection('rules');
    } catch (err) {
      setAdminSectionError(err.response?.data?.message || 'Could not update moderation rule.');
    }
  };

  const removeModerationRule = async (ruleId) => {
    try {
      await api.delete(`/admin/moderation/rules/${ruleId}`);
      await loadAdminSection('rules');
    } catch (err) {
      setAdminSectionError(err.response?.data?.message || 'Could not delete moderation rule.');
    }
  };

  const savePolicyReview = async (event) => {
    event.preventDefault();
    try {
      await api.post('/admin/policy-reviews', { summary: policySummary });
      setPolicySummary('');
      await loadAdminSection('policy-review');
    } catch (err) {
      setAdminSectionError(err.response?.data?.message || 'Could not record weekly review.');
    }
  };

  // ─── Data Fetching & Sync ──────────────────────────────────────────
  useEffect(() => {
    // Stagger API calls to avoid overwhelming the server
    const loadData = async () => {
      await fetchStats();
      await fetchInitialTables();
      await fetchModerationData();
    };
    loadData();

    // 3. Socket Real-time Updates
    if (!socket || !isConnected) return;

    socket.emit('admin:init');

    const onAdminStats = (data) => setStats(data);
    const onNewViolation = (violation) => {
      setViolations(prev => {
        if (prev.some(v => v.id === violation.id)) return prev;
        return [violation, ...prev].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      });
      setStats(prev => ({ ...prev, total_violations: (prev.total_violations || 0) + 1 }));
    };

    const onNewModeration = (newItem) => {
      setModerationQueue(prev => {
        if (prev.some(item => item.id === newItem.id)) return prev;
        return [newItem, ...prev].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      });
    };

    const onTrustUpdated = (data) => {
      setUsers(prev => prev.map(user => 
        user.id === data.user_id ? { ...user, badge_tier: data.badge_tier } : user
      ));
    };

    socket.on('admin:stats', onAdminStats);
    socket.on('admin:new_violation', onNewViolation);
    socket.on('admin:new_moderation', onNewModeration);
    socket.on('trust:score_updated', onTrustUpdated);

    return () => {
      socket.off('admin:stats', onAdminStats);
      socket.off('admin:new_violation', onNewViolation);
      socket.off('admin:new_moderation', onNewModeration);
      socket.off('trust:score_updated', onTrustUpdated);
    };
  }, [socket, isConnected]);

  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/stats');
      setStats(res.data.data);
    } catch (err) {
      console.error('Failed to fetch stats via HTTP', err);
    }
  };

  const fetchInitialTables = async () => {
    try {
      const [usersRes, violationsRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/violations')
      ]);
      setUsers(usersRes.data.data);
      setViolations(violationsRes.data.data);
    } catch (err) {
      console.error('Failed to fetch admin tables', err);
    }
  };

  const fetchModerationData = async () => {
    try {
      const [queueRes, escalationsRes, lowScoresRes, academicRes, auditLogsRes] = await Promise.all([
        api.get('/admin/moderation/queue'),
        api.get('/admin/escalations'),
        api.get('/admin/low-scores'),
        api.get('/academic/admin/queue'),
        api.get('/admin/audit-logs')
      ]);
      setModerationQueue(queueRes.data.data);
      setEscalations(escalationsRes.data.data);
      setLowScoreUsers(lowScoresRes.data.data);
      setAcademicQueue(academicRes.data.data);
      setAuditLogs(auditLogsRes.data.data);
    } catch (err) {
      console.error('Failed to fetch moderation data', err);
    }
  };

  const handleModerationAction = async (id, action) => {
    try {
      await api.post(`/admin/moderation/${id}/${action}`);
      setModerationQueue(prev => prev.filter(item => item.id !== id));
      // Refresh related data
      fetchModerationData();
    } catch (err) {
      alert(`Failed to ${action} content`);
    }
  };

  const handleRevealIdentity = async (userId) => {
    const justification = window.prompt('Provide a justification (at least 20 characters) for this identity-reveal request:');
    if (!justification || justification.trim().length < 20) return;
    try {
      const res = await api.post(`/admin/identity-reveal/${userId}`, { justification: justification.trim() });
      if (res.data.data?.email) {
        alert(`Real Identity revealed: ${res.data.data.email}`);
      } else {
        alert(res.data.message);
      }
      fetchModerationData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to request identity reveal');
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      await api.patch(`/admin/users/${userId}/role`, { role: newRole });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      alert('Failed to update role');
    }
  };

  const handleUnlockUser = async (userId) => {
    try {
      await api.patch(`/admin/users/${userId}/unlock`);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_locked: false } : u));
      alert('Account unlocked successfully');
    } catch (err) {
      alert('Failed to unlock account');
    }
  };

  const filteredUsers = users.filter(u => {
    const anonId = u.anonymous_id || '';
    const email = u.email || '';
    const query = searchQuery.toLowerCase();
    return anonId.toLowerCase().includes(query) || email.toLowerCase().includes(query);
  });

  const statCards = [
    { label: 'Total Users', value: stats.total_users, color: 'from-blue-500 to-indigo-600', icon: Users },
    { label: 'Active Today', value: stats.active_today, color: 'from-emerald-500 to-teal-600', icon: Zap },
    { label: 'Violations', value: stats.total_violations, color: 'from-amber-500 to-orange-600', icon: AlertTriangle },
  ];

  const fadeUp = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3 }
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Admin Command Center</h1>
          <p className="text-surface-500 mt-1">Real-time platform oversight and moderation.</p>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {statCards.map((card) => (
            <motion.div key={card.label} {...fadeUp} className="glass-card p-6 border-l-4 border-l-transparent hover:border-l-current transition-all">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-1">{card.label}</p>
                  <p className={`text-3xl font-bold bg-gradient-to-r ${card.color} bg-clip-text text-transparent`}>
                    {card.value}
                  </p>
                </div>
                <card.icon className="w-6 h-6 text-surface-400" />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-surface-200 dark:border-surface-800 mb-8 overflow-x-auto no-scrollbar">
          {['overview', 'users', 'violations', 'moderation', 'academic', 'trust', 'escalations', 'complaints', 'appeals', 'repeat-offenders', 'security', 'rules', 'policy-review', 'audit-logs', ...(canViewMoodTrends ? ['wellbeing'] : [])].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (tab === 'wellbeing' && canViewMoodTrends) fetchMoodTrends();
                if (['complaints', 'appeals', 'repeat-offenders', 'security', 'rules', 'policy-review'].includes(tab)) loadAdminSection(tab);
              }}
              className={`px-6 py-3 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${
                activeTab === tab
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
              }`}
            >
              {tab.replace('-', ' ')}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="space-y-6"
          >
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Violations Summary */}
                <div className="glass-card p-6">
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" /> Latest Violations
                  </h2>
                  <div className="space-y-3">
                    {violations.slice(0, 5).map(v => (
                      <div key={v.id} className="flex items-center justify-between p-3 border border-surface-100 dark:border-surface-800 rounded-xl">
                        <div>
                          <p className="text-sm font-bold text-surface-900 dark:text-white">{v.anonymous_id}</p>
                          <p className="text-xs text-surface-500">{v.violation_type || 'Potential Red Flag'}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          v.severity === 'HIGH' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                        }`}>
                          {v.severity}
                        </span>
                      </div>
                    ))}
                    {violations.length === 0 && (
                      <p className="text-sm text-surface-500 text-center py-6">No violations reported yet.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'wellbeing' && canViewMoodTrends && (
              <section className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <HeartPulse className="w-5 h-5 text-rose-500" /> Department Wellbeing Trends
                    </h2>
                    <p className="text-sm text-surface-500 mt-1">Anonymized daily averages for the last 30 days. Individual check-ins and notes are never shown.</p>
                  </div>
                  <button
                    type="button"
                    onClick={fetchMoodTrends}
                    disabled={moodLoading}
                    className="btn-secondary inline-flex items-center gap-2"
                    aria-label="Refresh wellbeing trends"
                  >
                    <RefreshCw className={`w-4 h-4 ${moodLoading ? 'animate-spin' : ''}`} /> Refresh
                  </button>
                </div>

                {moodLoading ? (
                  <div className="glass-card py-16 text-center text-surface-500">Loading department trends...</div>
                ) : moodError ? (
                  <div className="glass-card p-8 text-center">
                    <p className="text-sm text-red-500 mb-4">{moodError}</p>
                    <button type="button" onClick={fetchMoodTrends} className="btn-primary">Retry</button>
                  </div>
                ) : Object.keys(moodTrends).length === 0 ? (
                  <div className="glass-card py-16 text-center text-surface-500">No aggregated check-ins are available for the last 30 days.</div>
                ) : (
                  <div className="space-y-5">
                    {Object.entries(moodTrends).map(([department, entries]) => (
                      <div key={department} className="glass-card p-6">
                        <div className="flex items-center justify-between gap-4 mb-5">
                          <h3 className="font-semibold text-surface-900 dark:text-white">{department || 'Unassigned department'}</h3>
                          <span className="text-xs text-surface-500">{entries.reduce((total, entry) => total + Number(entry.check_in_count || 0), 0)} check-ins</span>
                        </div>
                        <div className="h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={entries} margin={{ top: 5, right: 12, left: -20, bottom: 2 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(156,163,175,0.2)" />
                              <XAxis dataKey="date" tickFormatter={date => String(date).slice(5)} tick={{ fontSize: 11 }} />
                              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} />
                              <Tooltip formatter={value => [Number(value).toFixed(1), 'Average mood']} />
                              <Line type="monotone" dataKey="avg_score" stroke="#e25575" strokeWidth={2.5} dot={{ r: 3 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {activeTab === 'users' && (
              <div className="glass-card overflow-hidden">
                <div className="p-4 border-b border-surface-100 dark:border-surface-800">
                  <input
                    type="text"
                    placeholder="Search by Anonymous ID or Email..."
                    className="input-field w-full md:w-96"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-surface-50 dark:bg-surface-800/50 text-[10px] uppercase tracking-widest font-bold text-surface-500">
                      <tr>
                        <th className="px-6 py-4">Anonymous ID</th>
                        <th className="px-6 py-4">Email</th>
                        <th className="px-6 py-4">Role</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Joined</th>
                        <th className="px-6 py-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                      {filteredUsers.map(u => (
                        <tr key={u.id} className="text-sm hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors">
                          <td className="px-6 py-4 font-mono font-bold text-primary-600">{u.anonymous_id || 'N/A'}</td>
                          <td className="px-6 py-4 text-surface-600 dark:text-surface-400">{u.email}</td>
                          <td className="px-6 py-4">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              u.role === 'student' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              u.is_locked ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                            }`}>
                              {u.is_locked ? 'LOCKED' : 'ACTIVE'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-surface-500 text-xs">
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 flex items-center gap-2">
                            <select
                              className="bg-transparent text-xs font-bold text-surface-600 outline-none cursor-pointer"
                              value={u.role}
                              onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                            >
                              <option value="student">STUDENT</option>
                              <option value="faculty">FACULTY</option>
                              <option value="admin">ADMIN</option>
                              <option value="super_admin">SUPER_ADMIN</option>
                            </select>
                            {u.is_locked ? (
                              <button 
                                onClick={() => handleUnlockUser(u.id)}
                                className="text-xs font-bold bg-emerald-100 text-emerald-600 px-2 py-1 rounded hover:bg-emerald-200 transition-colors"
                              >
                                Unlock
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'violations' && (
              <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-surface-50 dark:bg-surface-800/50 text-[10px] uppercase tracking-widest font-bold text-surface-500">
                      <tr>
                        <th className="px-6 py-4">User</th>
                        <th className="px-6 py-4">Type</th>
                        <th className="px-6 py-4">Severity</th>
                        <th className="px-6 py-4">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                      {violations.map(v => (
                        <tr key={v.id} className="text-sm transition-colors hover:bg-surface-50 dark:hover:bg-surface-800/30">
                          <td className="px-6 py-4 font-mono font-bold text-surface-900 dark:text-white">{v.anonymous_id}</td>
                          <td className="px-6 py-4 text-surface-600 dark:text-surface-400">{v.violation_type || 'Moderate Content'}</td>
                          <td className="px-6 py-4">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full italic ${
                              v.severity === 'HIGH' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                            }`}>
                              {v.severity}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-surface-500 font-mono text-xs">{new Date(v.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'moderation' && (
              <div className="space-y-8">
                {/* Moderation Queue */}
                <section>
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Shield className="w-6 h-6 text-primary-500" /> Pending Moderation Queue
                  </h2>
                  <div className="grid grid-cols-1 gap-4">
                    {moderationQueue.map(item => (
                      <div key={item.id} className="glass-card p-6 flex flex-col md:flex-row justify-between gap-6 border-l-4 border-l-primary-500">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="font-mono font-bold text-surface-900 dark:text-white bg-surface-100 dark:bg-surface-800 px-2 py-1 rounded">{item.anonymous_id}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-100 text-surface-600 uppercase tracking-widest">{item.content_type}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              item.ai_severity === 'HIGH' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                            }`}>{item.ai_severity}</span>
                          </div>
                          <p className="text-surface-700 dark:text-surface-300 italic mb-4">&ldquo;{item.content_text}&rdquo;</p>
                          <p className="text-xs text-surface-500">AI Reason: <span className="font-semibold">{item.ai_reason}</span></p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleModerationAction(item.id, 'approve')} className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors" title="Approve">
                            <Check className="w-5 h-5" />
                          </button>
                          <button onClick={() => handleModerationAction(item.id, 'reject')} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors" title="Reject">
                            <X className="w-5 h-5" />
                          </button>
                          <button onClick={() => handleModerationAction(item.id, 'escalate')} className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition-colors" title="Escalate & Suspend">
                            <ArrowUpCircle className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {moderationQueue.length === 0 && (
                      <div className="glass-card p-12 text-center text-surface-500">
                        Queue is empty. Everything looks safe!
                      </div>
                    )}
                  </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Escalation History */}
                  <section>
                    <h2 className="text-lg font-bold mb-4">Escalation History</h2>
                    <div className="glass-card overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-surface-50 dark:bg-surface-800/50 text-xs font-bold text-surface-500 border-b border-surface-100 dark:border-surface-800">
                            <tr>
                              <th className="px-4 py-3">ID</th>
                              <th className="px-4 py-3">Level</th>
                              <th className="px-4 py-3">Reason</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                            {escalations.slice(0, 10).map(e => (
                              <tr key={e.id}>
                                <td className="px-4 py-3 font-mono">{e.anonymous_id}</td>
                                <td className="px-4 py-3">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                    e.level === 'suspension' || e.level === 'identity_reveal' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                                  }`}>{e.level}</span>
                                </td>
                                <td className="px-4 py-3 text-xs text-surface-600">{e.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </section>

                  {/* Behavior Monitoring */}
                  <section>
                    <h2 className="text-lg font-bold mb-4 text-red-500 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" /> Low Behavior Scores
                    </h2>
                    <div className="space-y-3">
                      {lowScoreUsers.map(u => (
                        <div key={u.user_id} className="glass-card p-4 flex items-center justify-between border-r-4 border-r-red-500">
                          <div>
                            <p className="font-bold text-surface-900 dark:text-white">{u.anonymous_id}</p>
                            <p className="text-xs text-red-500 font-bold">Score: {u.behavior_score}</p>
                          </div>
                          <button 
                            onClick={() => handleRevealIdentity(u.user_id)}
                            className="p-2 bg-surface-100 dark:bg-surface-800 text-surface-600 hover:text-red-500 transition-colors rounded-lg"
                            title="Reveal Identity (Dual Approval)"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                      {lowScoreUsers.length === 0 && (
                        <p className="text-center text-sm text-surface-500 py-10 glass-card">All users are well-behaved.</p>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            )}

            {activeTab === 'academic' && (
              <div className="space-y-6">
                <div className="glass-card p-6">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <GraduationCap className="w-6 h-6 text-indigo-500" />
                    Academic Moderation Queue
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-surface-50 dark:bg-surface-800/50 text-xs font-bold text-surface-500 uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-4">Requester</th>
                          <th className="px-6 py-4">Title</th>
                          <th className="px-6 py-4">Reason</th>
                          <th className="px-6 py-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                        {academicQueue.map((item) => (
                          <tr key={item.id} className="hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                            <td className="px-6 py-4 font-mono text-xs">{item.anonymous_id}</td>
                            <td className="px-6 py-4 text-sm font-medium">{item.title}</td>
                            <td className="px-6 py-4">
                              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                {item.ai_moderation_reason}
                              </span>
                            </td>
                            <td className="px-6 py-4 flex gap-2">
                              <button 
                                onClick={async () => {
                                  try {
                                    await api.post(`/academic/admin/${item.id}/approve`);
                                    setAcademicQueue(prev => prev.filter(q => q.id !== item.id));
                                  } catch (e) { alert('Action failed'); }
                                }}
                                className="p-2 bg-green-100 text-green-600 hover:bg-green-200 rounded-lg transition-colors"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={async () => {
                                  try {
                                    await api.post(`/academic/admin/${item.id}/reject`);
                                    setAcademicQueue(prev => prev.filter(q => q.id !== item.id));
                                  } catch (e) { alert('Action failed'); }
                                }}
                                className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {academicQueue.length === 0 && (
                          <tr>
                            <td colSpan="4" className="px-6 py-10 text-center text-surface-500">
                              Queue is empty. Great job!
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'trust' && (
              <section className="glass-card overflow-hidden">
                <div className="border-b border-surface-200 p-5 dark:border-surface-800">
                  <h2 className="font-bold text-surface-900 dark:text-white">Community Badge Tiers</h2>
                  <p className="mt-1 text-xs text-surface-500">Numeric trust scores are private to the matching engine; this view shows badge tiers only.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-surface-50 text-xs uppercase text-surface-500 dark:bg-surface-800"><tr><th className="p-4">Anonymous ID</th><th className="p-4">Badge</th><th className="p-4">Department</th></tr></thead>
                    <tbody>
                      {users.filter(account => account.role === 'student').map(account => (
                        <tr key={account.id} className="border-t border-surface-100 dark:border-surface-800">
                          <td className="p-4 font-mono">{account.anonymous_id || 'N/A'}</td>
                          <td className="p-4"><BadgeDisplay tier={account.badge_tier || 'bronze'} size="sm" /></td>
                          <td className="p-4">{account.department || 'Unassigned'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {users.filter(account => account.role === 'student').length === 0 && <p className="p-8 text-center text-sm text-surface-500">No student badges available.</p>}
                </div>
              </section>
            )}
            {activeTab === 'escalations' && (
              <div className="glass-card overflow-hidden">
                <div className="p-4 border-b border-surface-100 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-800/20 flex justify-between items-center">
                  <h3 className="font-bold text-surface-900 dark:text-white flex items-center gap-2">
                    <ArrowUpCircle className="w-5 h-5 text-red-500" /> Escalation Records
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-surface-50 dark:bg-surface-800/50 text-[10px] uppercase tracking-widest font-bold text-surface-500">
                      <tr>
                        <th className="px-6 py-4">ID</th>
                        <th className="px-6 py-4">User</th>
                        <th className="px-6 py-4">Level</th>
                        <th className="px-6 py-4">Reason</th>
                        <th className="px-6 py-4">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                      {escalations.map(e => (
                        <tr key={e.id} className="text-sm transition-colors hover:bg-surface-50 dark:hover:bg-surface-800/30">
                          <td className="px-6 py-4 font-mono text-xs text-surface-500">{e.id}</td>
                          <td className="px-6 py-4 font-mono font-bold text-surface-900 dark:text-white">{e.anonymous_id || `User ${e.user_id}`}</td>
                          <td className="px-6 py-4">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              e.level === 'suspension' || e.level === 'identity_reveal' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                            }`}>{e.level}</span>
                          </td>
                          <td className="px-6 py-4 text-surface-600 dark:text-surface-400">{e.reason}</td>
                          <td className="px-6 py-4 text-surface-500 font-mono text-xs">{new Date(e.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                      {escalations.length === 0 && (
                        <tr>
                          <td colSpan="5" className="px-6 py-10 text-center text-surface-500">
                            No escalations found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {adminSectionError && ['complaints', 'appeals', 'repeat-offenders', 'security', 'rules', 'policy-review'].includes(activeTab) && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{adminSectionError}</div>
            )}

            {adminSectionLoading && ['complaints', 'appeals', 'repeat-offenders', 'security', 'rules', 'policy-review'].includes(activeTab) && (
              <div className="glass-card p-8 text-center text-surface-500">Loading Higher Authority data...</div>
            )}

            {activeTab === 'complaints' && !adminSectionLoading && (
              <div className="space-y-6">
                <section className="space-y-4">
                  <h2 className="text-lg font-bold text-surface-900 dark:text-white">Pending Identity-Reveal Approvals</h2>
                  {pendingComplaintReveals.map(request => (
                    <div key={request.record_id} className="glass-card flex flex-wrap items-center justify-between gap-4 p-4">
                      <div>
                        <p className="font-semibold">Complaint #{request.complaint_id}</p>

                    {adminSectionError && ['complaints', 'appeals', 'repeat-offenders', 'security', 'rules', 'policy-review'].includes(activeTab) && (
                      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{adminSectionError}</div>
                    )}

                    {adminSectionLoading && ['complaints', 'appeals', 'repeat-offenders', 'security', 'rules', 'policy-review'].includes(activeTab) && (
                      <div className="glass-card p-8 text-center text-surface-500">Loading Higher Authority data...</div>
                    )}

                    {activeTab === 'complaints' && !adminSectionLoading && (
                      <div className="space-y-6">
                        <section className="space-y-4">
                          <h2 className="text-lg font-bold text-surface-900 dark:text-white">Pending Identity-Reveal Approvals</h2>
                          {pendingComplaintReveals.map(request => (
                            <div key={request.record_id} className="glass-card flex flex-wrap items-center justify-between gap-4 p-4">
                              <div>
                                <p className="font-semibold">Complaint #{request.complaint_id}</p>
                                <p className="mt-1 text-xs text-surface-500">Justification: {request.justification}</p>
                              </div>
                              <button type="button" onClick={() => approveComplaintReveal(request.record_id)} className="btn-secondary inline-flex items-center gap-2"><Eye className="h-4 w-4" /> Approve as second admin</button>
                            </div>
                          ))}
                          {pendingComplaintReveals.length === 0 && <p className="text-sm text-surface-500">No pending identity reveals.</p>}
                        </section>

                        <section className="space-y-4">
                          <h2 className="text-lg font-bold text-surface-900 dark:text-white">Escalated Complaints</h2>
                          {escalatedComplaints.map(item => (
                            <article key={item.id} className="glass-card space-y-4 border-l-4 border-l-amber-500 p-5">
                              <header className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold capitalize">{item.category.replace(/_/g, ' ')} · Case #{item.id}</p>
                                  <p className="mt-1 text-xs text-surface-500">Reporter {item.reporter_anonymous_id} · Reported {item.reported_anonymous_id || 'content'}</p>
                                </div>
                                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">{item.is_flagged ? 'Priority review' : 'Escalated'}</span>
                              </header>
                              <p className="whitespace-pre-wrap text-sm text-surface-700 dark:text-surface-300">{item.reason}</p>
                              {item.evidence_ref && <p className="text-xs text-surface-500">Evidence: {item.evidence_ref}</p>}
                              {item.faculty_note && <p className="rounded-lg bg-surface-50 p-3 text-xs text-surface-600 dark:bg-surface-800/60 dark:text-surface-300">Faculty escalation note: {item.faculty_note}</p>}
                              <textarea rows={2} maxLength={1000} value={complaintNotes[item.id] || ''} onChange={event => setComplaintNotes(current => ({ ...current, [item.id]: event.target.value }))} placeholder="Resolution or rejection note (10+ characters)" className="w-full rounded-lg border border-surface-200 bg-white p-3 text-sm dark:border-surface-700 dark:bg-surface-950" />
                              <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => resolveEscalatedComplaint(item.id, 'resolve')} className="btn-primary inline-flex items-center gap-2"><Check className="h-4 w-4" /> Resolve</button>
                                <button type="button" onClick={() => resolveEscalatedComplaint(item.id, 'reject')} className="btn-secondary inline-flex items-center gap-2"><X className="h-4 w-4" /> Reject</button>
                                <button type="button" onClick={() => loadComplaintAudit(item.id)} className="btn-secondary inline-flex items-center gap-2"><History className="h-4 w-4" /> Load permanent history</button>
                              </div>
                              {complaintAudits[item.id] && (
                                <ol className="space-y-2 border-t border-surface-200 pt-4 dark:border-surface-700">
                                  {complaintAudits[item.id].map(entry => (
                                    <li key={entry.id} className="text-xs text-surface-600 dark:text-surface-300"><strong>{entry.action}</strong> · Actor {entry.actor_id || 'deleted account'} · {new Date(entry.created_at).toLocaleString()} · {JSON.stringify(entry.details)}</li>
                                  ))}
                                  {complaintAudits[item.id].length === 0 && <li className="text-xs text-surface-500">No history records yet.</li>}
                                </ol>
                              )}
                            </article>
                          ))}
                          {escalatedComplaints.length === 0 && <div className="glass-card p-10 text-center text-surface-500">No escalated complaints.</div>}
                        </section>
                      </div>
                    )}

                    {activeTab === 'appeals' && !adminSectionLoading && (
                      <section className="space-y-4">
                        <h2 className="text-lg font-bold">Pending Notice Appeals</h2>
                        {noticeAppeals.map(appeal => (
                          <article key={appeal.id} className="glass-card space-y-3 p-5">
                            <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{appeal.title}</h3><span className="text-xs text-surface-500">Appeal #{appeal.id} · {appeal.anonymous_id}</span></div>
                            <p className="whitespace-pre-wrap text-sm text-surface-600 dark:text-surface-300">{appeal.body}</p>
                            <p className="text-sm text-amber-700 dark:text-amber-300">Appeal reason: {appeal.reason}</p>
                            <textarea rows={2} maxLength={1000} value={appealNotes[appeal.id] || ''} onChange={event => setAppealNotes(current => ({ ...current, [appeal.id]: event.target.value }))} placeholder="Optional decision note" className="w-full rounded-lg border border-surface-200 bg-white p-3 text-sm dark:border-surface-700 dark:bg-surface-950" />
                            <div className="flex gap-2"><button type="button" onClick={() => reviewNoticeAppeal(appeal.id, 'publish')} className="btn-primary">Approve appeal</button><button type="button" onClick={() => reviewNoticeAppeal(appeal.id, 'reject')} className="btn-secondary">Reject appeal</button></div>
                          </article>
                        ))}
                        {noticeAppeals.length === 0 && <div className="glass-card p-10 text-center text-surface-500">No pending notice appeals.</div>}
                      </section>
                    )}

                    {activeTab === 'repeat-offenders' && !adminSectionLoading && (
                      <section className="glass-card overflow-hidden">
                        <div className="border-b border-surface-200 p-5 dark:border-surface-800"><h2 className="font-bold">Repeat Offender Review</h2><p className="mt-1 text-xs text-surface-500">Accounts with at least three recorded violations in the last 90 days.</p></div>
                        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-surface-50 text-xs uppercase text-surface-500 dark:bg-surface-800"><tr><th className="p-4">Anonymous ID</th><th className="p-4">Violations</th><th className="p-4">High severity</th><th className="p-4">Behavior score</th><th className="p-4">Latest</th></tr></thead><tbody>{repeatOffenders.map(row => <tr key={row.user_id} className="border-t border-surface-100 dark:border-surface-800"><td className="p-4 font-mono">{row.anonymous_id}</td><td className="p-4">{row.violation_count}</td><td className="p-4">{row.high_severity_count}</td><td className="p-4">{row.behavior_score}</td><td className="p-4">{new Date(row.last_violation_at).toLocaleString()}</td></tr>)}</tbody></table></div>
                        {repeatOffenders.length === 0 && <p className="p-8 text-center text-sm text-surface-500">No repeat-offender cases meet this threshold.</p>}
                      </section>
                    )}

                    {activeTab === 'security' && !adminSectionLoading && securitySignals && (
                      <section className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2"><div className="glass-card p-5"><p className="text-xs uppercase text-surface-500">Locked / repeated-failure accounts</p><p className="mt-2 text-2xl font-bold">{securitySignals.locked_account_count}</p></div><div className="glass-card p-5"><p className="text-xs uppercase text-surface-500">High-severity violations · 24h</p><p className="mt-2 text-2xl font-bold">{securitySignals.high_severity_violations_24h}</p></div></div>
                        <div className="glass-card overflow-hidden"><div className="border-b border-surface-200 p-5 dark:border-surface-800"><h2 className="font-bold">Accounts Requiring Security Review</h2></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-surface-50 text-xs uppercase text-surface-500 dark:bg-surface-800"><tr><th className="p-4">Anonymous ID</th><th className="p-4">Role signal</th><th className="p-4">Failed attempts</th><th className="p-4">Lock expires</th></tr></thead><tbody>{securitySignals.accounts_requiring_review.map(row => <tr key={row.user_id} className="border-t border-surface-100 dark:border-surface-800"><td className="p-4 font-mono">{row.anonymous_id || 'Profile unavailable'}</td><td className="p-4">{row.is_locked ? 'Locked' : 'Repeated login failures'}</td><td className="p-4">{row.failed_attempts}</td><td className="p-4">{row.lock_until ? new Date(row.lock_until).toLocaleString() : '—'}</td></tr>)}</tbody></table></div>{securitySignals.accounts_requiring_review.length === 0 && <p className="p-8 text-center text-sm text-surface-500">No accounts currently require security review.</p>}</div>
                      </section>
                    )}

                    {activeTab === 'rules' && !adminSectionLoading && (
                      <section className="space-y-4">
                        <form onSubmit={addModerationRule} className="glass-card flex flex-wrap items-end gap-3 p-5">
                          <label className="min-w-[220px] flex-1 text-xs font-semibold">Keyword or phrase<input value={newRuleTerm} onChange={event => setNewRuleTerm(event.target.value)} maxLength={120} required className="input-field mt-1 w-full" /></label>
                          <label className="text-xs font-semibold">Severity<select value={newRuleSeverity} onChange={event => setNewRuleSeverity(event.target.value)} className="input-field mt-1"><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></label>
                          <button type="submit" className="btn-primary">Add rule</button>
                        </form>
                        <div className="glass-card divide-y divide-surface-200 dark:divide-surface-800">{moderationRules.map(rule => <div key={rule.id} className="flex flex-wrap items-center gap-3 p-4"><span className="min-w-[180px] flex-1 font-mono text-sm">{rule.term}</span><select value={rule.severity} onChange={event => updateModerationRule(rule.id, { severity: event.target.value })} className="input-field text-xs"><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(rule.enabled)} onChange={event => updateModerationRule(rule.id, { enabled: event.target.checked })} /> Enabled</label><button type="button" onClick={() => removeModerationRule(rule.id)} className="text-xs font-semibold text-red-600">Delete</button></div>)}{moderationRules.length === 0 && <p className="p-8 text-center text-sm text-surface-500">No custom rules. Built-in safety terms remain active.</p>}</div>
                      </section>
                    )}

                    {activeTab === 'policy-review' && !adminSectionLoading && (
                      <section className="space-y-4">
                        <form onSubmit={savePolicyReview} className="glass-card space-y-3 p-5"><h2 className="font-bold">Record This Week’s Policy Review</h2><textarea value={policySummary} onChange={event => setPolicySummary(event.target.value)} minLength={20} maxLength={5000} rows={4} required placeholder="Summarize policy changes, moderation trends, and actions agreed this week." className="w-full rounded-lg border border-surface-200 bg-white p-3 text-sm dark:border-surface-700 dark:bg-surface-950" /><button type="submit" className="btn-primary">Save weekly review</button></form>
                        <div className="space-y-3">{policyReviews.map(review => <article key={review.id} className="glass-card p-5"><div className="flex justify-between gap-3 text-xs text-surface-500"><span>Week of {new Date(review.review_week).toLocaleDateString()}</span><span>{review.reviewer_email || 'Admin unavailable'}</span></div><p className="mt-3 whitespace-pre-wrap text-sm">{review.summary}</p></article>)}</div>
                        {policyReviews.length === 0 && <p className="text-center text-sm text-surface-500">No weekly reviews have been recorded.</p>}
                      </section>
                    )}
                        <p className="mt-1 text-xs text-surface-500">Justification: {request.justification}</p>
                      </div>
                      <button type="button" onClick={() => approveComplaintReveal(request.record_id)} className="btn-secondary inline-flex items-center gap-2"><Eye className="h-4 w-4" /> Approve as second admin</button>
                    </div>
                  ))}
                  {pendingComplaintReveals.length === 0 && <p className="text-sm text-surface-500">No pending identity reveals.</p>}
                </section>

                <section className="space-y-4">
                  <h2 className="text-lg font-bold text-surface-900 dark:text-white">Escalated Complaints</h2>
                  {escalatedComplaints.map(item => (
                    <article key={item.id} className="glass-card space-y-4 border-l-4 border-l-amber-500 p-5">
                      <header className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold capitalize">{item.category.replace(/_/g, ' ')} · Case #{item.id}</p>
                          <p className="mt-1 text-xs text-surface-500">Reporter {item.reporter_anonymous_id} · Reported {item.reported_anonymous_id || 'content'}</p>
                        </div>
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">{item.is_flagged ? 'Priority review' : 'Escalated'}</span>
                      </header>
                      <p className="whitespace-pre-wrap text-sm text-surface-700 dark:text-surface-300">{item.reason}</p>
                      {item.evidence_ref && <p className="text-xs text-surface-500">Evidence: {item.evidence_ref}</p>}
                      {item.faculty_note && <p className="rounded-lg bg-surface-50 p-3 text-xs text-surface-600 dark:bg-surface-800/60 dark:text-surface-300">Faculty escalation note: {item.faculty_note}</p>}
                      <textarea rows={2} maxLength={1000} value={complaintNotes[item.id] || ''} onChange={event => setComplaintNotes(current => ({ ...current, [item.id]: event.target.value }))} placeholder="Resolution or rejection note (10+ characters)" className="w-full rounded-lg border border-surface-200 bg-white p-3 text-sm dark:border-surface-700 dark:bg-surface-950" />
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => resolveEscalatedComplaint(item.id, 'resolve')} className="btn-primary inline-flex items-center gap-2"><Check className="h-4 w-4" /> Resolve</button>
                        <button type="button" onClick={() => resolveEscalatedComplaint(item.id, 'reject')} className="btn-secondary inline-flex items-center gap-2"><X className="h-4 w-4" /> Reject</button>
                        <button type="button" onClick={() => loadComplaintAudit(item.id)} className="btn-secondary inline-flex items-center gap-2"><History className="h-4 w-4" /> Load permanent history</button>
                      </div>
                      {complaintAudits[item.id] && (
                        <ol className="space-y-2 border-t border-surface-200 pt-4 dark:border-surface-700">
                          {complaintAudits[item.id].map(entry => (
                            <li key={entry.id} className="text-xs text-surface-600 dark:text-surface-300"><strong>{entry.action}</strong> · Actor {entry.actor_id || 'deleted account'} · {new Date(entry.created_at).toLocaleString()} · {JSON.stringify(entry.details)}</li>
                          ))}
                          {complaintAudits[item.id].length === 0 && <li className="text-xs text-surface-500">No history records yet.</li>}
                        </ol>
                      )}
                    </article>
                  ))}
                  {escalatedComplaints.length === 0 && <div className="glass-card p-10 text-center text-surface-500">No escalated complaints.</div>}
                </section>
              </div>
            )}

            {activeTab === 'appeals' && !adminSectionLoading && (
              <section className="space-y-4">
                <h2 className="text-lg font-bold">Pending Notice Appeals</h2>
                {noticeAppeals.map(appeal => (
                  <article key={appeal.id} className="glass-card space-y-3 p-5">
                    <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{appeal.title}</h3><span className="text-xs text-surface-500">Appeal #{appeal.id} · {appeal.anonymous_id}</span></div>
                    <p className="whitespace-pre-wrap text-sm text-surface-600 dark:text-surface-300">{appeal.body}</p>
                    <p className="text-sm text-amber-700 dark:text-amber-300">Appeal reason: {appeal.reason}</p>
                    <textarea rows={2} maxLength={1000} value={appealNotes[appeal.id] || ''} onChange={event => setAppealNotes(current => ({ ...current, [appeal.id]: event.target.value }))} placeholder="Optional decision note" className="w-full rounded-lg border border-surface-200 bg-white p-3 text-sm dark:border-surface-700 dark:bg-surface-950" />
                    <div className="flex gap-2"><button type="button" onClick={() => reviewNoticeAppeal(appeal.id, 'publish')} className="btn-primary">Approve appeal</button><button type="button" onClick={() => reviewNoticeAppeal(appeal.id, 'reject')} className="btn-secondary">Reject appeal</button></div>
                  </article>
                ))}
                {noticeAppeals.length === 0 && <div className="glass-card p-10 text-center text-surface-500">No pending notice appeals.</div>}
              </section>
            )}

            {activeTab === 'repeat-offenders' && !adminSectionLoading && (
              <section className="glass-card overflow-hidden">
                <div className="border-b border-surface-200 p-5 dark:border-surface-800"><h2 className="font-bold">Repeat Offender Review</h2><p className="mt-1 text-xs text-surface-500">Accounts with at least three recorded violations in the last 90 days.</p></div>
                <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-surface-50 text-xs uppercase text-surface-500 dark:bg-surface-800"><tr><th className="p-4">Anonymous ID</th><th className="p-4">Violations</th><th className="p-4">High severity</th><th className="p-4">Behavior score</th><th className="p-4">Latest</th></tr></thead><tbody>{repeatOffenders.map(row => <tr key={row.user_id} className="border-t border-surface-100 dark:border-surface-800"><td className="p-4 font-mono">{row.anonymous_id}</td><td className="p-4">{row.violation_count}</td><td className="p-4">{row.high_severity_count}</td><td className="p-4">{row.behavior_score}</td><td className="p-4">{new Date(row.last_violation_at).toLocaleString()}</td></tr>)}</tbody></table></div>
                {repeatOffenders.length === 0 && <p className="p-8 text-center text-sm text-surface-500">No repeat-offender cases meet this threshold.</p>}
              </section>
            )}

            {activeTab === 'security' && !adminSectionLoading && securitySignals && (
              <section className="space-y-4">
                <p className="text-xs text-surface-500">Potential account-compromise indicators from failed logins and safety events; these are review signals, not confirmed breaches.</p>
                <div className="grid gap-4 sm:grid-cols-3"><div className="glass-card p-5"><p className="text-xs uppercase text-surface-500">Accounts requiring review</p><p className="mt-2 text-2xl font-bold">{securitySignals.accounts_requiring_review_count}</p></div><div className="glass-card p-5"><p className="text-xs uppercase text-surface-500">Locked accounts</p><p className="mt-2 text-2xl font-bold">{securitySignals.locked_account_count}</p></div><div className="glass-card p-5"><p className="text-xs uppercase text-surface-500">High-severity violations · 24h</p><p className="mt-2 text-2xl font-bold">{securitySignals.high_severity_violations_24h}</p></div></div>
                <div className="glass-card overflow-hidden"><div className="border-b border-surface-200 p-5 dark:border-surface-800"><h2 className="font-bold">Accounts Requiring Security Review</h2></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-surface-50 text-xs uppercase text-surface-500 dark:bg-surface-800"><tr><th className="p-4">Anonymous ID</th><th className="p-4">Role signal</th><th className="p-4">Failed attempts</th><th className="p-4">Lock expires</th></tr></thead><tbody>{securitySignals.accounts_requiring_review.map(row => <tr key={row.user_id} className="border-t border-surface-100 dark:border-surface-800"><td className="p-4 font-mono">{row.anonymous_id || 'Profile unavailable'}</td><td className="p-4">{row.is_locked ? 'Locked' : 'Repeated login failures'}</td><td className="p-4">{row.failed_attempts}</td><td className="p-4">{row.lock_until ? new Date(row.lock_until).toLocaleString() : '—'}</td></tr>)}</tbody></table></div>{securitySignals.accounts_requiring_review.length === 0 && <p className="p-8 text-center text-sm text-surface-500">No accounts currently require security review.</p>}</div>
              </section>
            )}

            {activeTab === 'rules' && !adminSectionLoading && (
              <section className="space-y-4">
                <form onSubmit={addModerationRule} className="glass-card flex flex-wrap items-end gap-3 p-5">
                  <label className="min-w-[220px] flex-1 text-xs font-semibold">Keyword or phrase<input value={newRuleTerm} onChange={event => setNewRuleTerm(event.target.value)} maxLength={120} required className="input-field mt-1 w-full" /></label>
                  <label className="text-xs font-semibold">Severity<select value={newRuleSeverity} onChange={event => setNewRuleSeverity(event.target.value)} className="input-field mt-1"><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></label>
                  <button type="submit" className="btn-primary">Add rule</button>
                </form>
                <div className="glass-card divide-y divide-surface-200 dark:divide-surface-800">{moderationRules.map(rule => <div key={rule.id} className="flex flex-wrap items-center gap-3 p-4"><span className="min-w-[180px] flex-1 font-mono text-sm">{rule.term}</span><select value={rule.severity} onChange={event => updateModerationRule(rule.id, { severity: event.target.value })} className="input-field text-xs"><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(rule.enabled)} onChange={event => updateModerationRule(rule.id, { enabled: event.target.checked })} /> Enabled</label><button type="button" onClick={() => removeModerationRule(rule.id)} className="text-xs font-semibold text-red-600">Delete</button></div>)}{moderationRules.length === 0 && <p className="p-8 text-center text-sm text-surface-500">No custom rules. Built-in safety terms remain active.</p>}</div>
              </section>
            )}

            {activeTab === 'policy-review' && !adminSectionLoading && (
              <section className="space-y-4">
                <form onSubmit={savePolicyReview} className="glass-card space-y-3 p-5"><h2 className="font-bold">Record This Week’s Policy Review</h2><textarea value={policySummary} onChange={event => setPolicySummary(event.target.value)} minLength={20} maxLength={5000} rows={4} required placeholder="Summarize policy changes, moderation trends, and actions agreed this week." className="w-full rounded-lg border border-surface-200 bg-white p-3 text-sm dark:border-surface-700 dark:bg-surface-950" /><button type="submit" className="btn-primary">Save weekly review</button></form>
                <div className="space-y-3">{policyReviews.map(review => <article key={review.id} className="glass-card p-5"><div className="flex justify-between gap-3 text-xs text-surface-500"><span>Week of {new Date(review.review_week).toLocaleDateString()}</span><span>{review.reviewer_email || 'Admin unavailable'}</span></div><p className="mt-3 whitespace-pre-wrap text-sm">{review.summary}</p></article>)}</div>
                {policyReviews.length === 0 && <p className="text-center text-sm text-surface-500">No weekly reviews have been recorded.</p>}
              </section>
            )}

            {activeTab === 'audit-logs' && (
              <div className="glass-card overflow-hidden">
                <div className="p-4 border-b border-surface-100 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-800/20 flex justify-between items-center">
                  <h3 className="font-bold text-surface-900 dark:text-white flex items-center gap-2">
                    <History className="w-5 h-5 text-indigo-500" /> System Audit Logs
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-surface-50 dark:bg-surface-800/50 text-[10px] uppercase tracking-widest font-bold text-surface-500">
                      <tr>
                        <th className="px-6 py-4">ID</th>
                        <th className="px-6 py-4">Admin/System</th>
                        <th className="px-6 py-4">Action</th>
                        <th className="px-6 py-4">Target User</th>
                        <th className="px-6 py-4">Details</th>
                        <th className="px-6 py-4">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                      {auditLogs.map(log => (
                        <tr key={log.id} className="text-sm transition-colors hover:bg-surface-50 dark:hover:bg-surface-800/30">
                          <td className="px-6 py-4 font-mono text-xs text-surface-500">{log.id}</td>
                          <td className="px-6 py-4 font-bold text-surface-900 dark:text-white">{log.admin_id ? `Admin ${log.admin_id}` : 'System'}</td>
                          <td className="px-6 py-4">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-100 text-surface-600 uppercase tracking-widest">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono">{log.target_user_id || 'N/A'}</td>
                          <td className="px-6 py-4 text-surface-600 dark:text-surface-400 text-xs">
                            <pre className="whitespace-pre-wrap font-mono bg-surface-50 dark:bg-surface-800/50 p-2 rounded max-w-xs overflow-hidden text-[10px]">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </td>
                          <td className="px-6 py-4 text-surface-500 font-mono text-xs">{new Date(log.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                      {auditLogs.length === 0 && (
                        <tr>
                          <td colSpan="6" className="px-6 py-10 text-center text-surface-500">
                            No audit logs found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </>
  );
}

