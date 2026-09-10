import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Zap, AlertTriangle, Shield, Check, X, ArrowUpCircle, Eye, GraduationCap, Award, History, RotateCcw, Save } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import useAuth from '../hooks/useAuth';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import BadgeDisplay from '../components/trust/BadgeDisplay';

/**
 * AdminPanel — central command for PeerBridge administrators.
 * Real-time monitoring of stats, SOS alerts, and violations.
 */
export default function AdminPanel() {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();

  const [stats, setStats] = useState({
    total_users: 0,
    active_today: 0,
    active_sos: 0,
    total_violations: 0
  });

  const [users, setUsers] = useState([]);
  const [sosAlerts, setSosAlerts] = useState([]);
  const [violations, setViolations] = useState([]);
  const [moderationQueue, setModerationQueue] = useState([]);
  const [escalations, setEscalations] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [lowScoreUsers, setLowScoreUsers] = useState([]);
  const [academicQueue, setAcademicQueue] = useState([]);
  const [trustRecords, setTrustRecords] = useState([]);
  const [selectedUserTrust, setSelectedUserTrust] = useState(null);
  const [trustHistory, setTrustHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [overrideValue, setOverrideValue] = useState(50);
  const [overrideReason, setOverrideReason] = useState('');

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
    const onSosAlerts = (data) => setSosAlerts(data);
    const onNewSos = (newSos) => {
      setSosAlerts(prev => [newSos, ...prev]);
      setStats(prev => ({ ...prev, active_sos: (prev.active_sos || 0) + 1 }));
    };
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
        user.id === data.user_id ? { ...user, trust_score: data.new_score } : user
      ));
    };

    socket.on('admin:stats', onAdminStats);
    socket.on('admin:sos_alerts', onSosAlerts);
    socket.on('admin:new_sos', onNewSos);
    socket.on('admin:new_violation', onNewViolation);
    socket.on('admin:new_moderation', onNewModeration);
    socket.on('trust:score_updated', onTrustUpdated);

    return () => {
      socket.off('admin:stats', onAdminStats);
      socket.off('admin:sos_alerts', onSosAlerts);
      socket.off('admin:new_sos', onNewSos);
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
    } finally {
      setLoading(false);
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
    try {
      const res = await api.post(`/admin/identity-reveal/${userId}`);
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

  const handleResolveSOS = async (id) => {
    try {
      await api.patch(`/admin/sos/${id}/resolve`);
      setSosAlerts(prev => prev.map(s => s.id === id ? { ...s, status: 'resolved' } : s));
      setStats(prev => ({ ...prev, active_sos: Math.max(0, prev.active_sos - 1) }));
    } catch (err) {
      alert('Failed to resolve SOS');
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
    { label: 'Active SOS', value: stats.active_sos, color: 'from-red-500 to-rose-600', icon: AlertTriangle },
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
          {['overview', 'users', 'sos', 'violations', 'moderation', 'academic', 'trust', 'escalations', 'audit-logs'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
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
                {/* Recent SOS Summary */}
                <div className="glass-card p-6">
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" /> Urgent SOS Alerts
                  </h2>
                  <div className="space-y-3">
                    {sosAlerts.filter(s => s.status === 'pending').slice(0, 5).map(sos => (
                      <div key={sos.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl">
                        <div>
                          <p className="text-sm font-bold text-red-700 dark:text-red-400">{sos.anonymous_id}</p>
                          <p className="text-xs text-surface-600 dark:text-surface-400">{sos.category}</p>
                        </div>
                        <button onClick={() => handleResolveSOS(sos.id)} className="btn-primary py-1.5 px-4 text-xs bg-red-600 hover:bg-red-700 shadow-none">Resolve</button>
                      </div>
                    ))}
                    {sosAlerts.filter(s => s.status === 'pending').length === 0 && (
                      <p className="text-sm text-surface-500 text-center py-6">All clear! No pending SOS alerts.</p>
                    )}
                  </div>
                </div>

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
                        <th className="px-6 py-4">Trust</th>
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
                          <td className="px-6 py-4">
                            <div className="w-12 h-1.5 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500" style={{ width: `${u.trust_score || 50}%` }} />
                            </div>
                          </td>
                          <td className="px-6 py-4 flex items-center gap-2">
                            <select
                              className="bg-transparent text-xs font-bold text-surface-600 outline-none cursor-pointer"
                              value={u.role}
                              onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                            >
                              <option value="student">STUDENT</option>
                              <option value="faculty">FACULTY</option>
                              <option value="counselor_admin">COUNSELOR</option>
                              <option value="dept_admin">DEPT_ADMIN</option>
                              <option value="admin">ADMIN</option>
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

            {activeTab === 'sos' && (
              <div className="space-y-4">
                {sosAlerts.map(sos => (
                  <div key={sos.id} className={`glass-card p-6 border-l-4 ${sos.status === 'pending' ? 'border-l-red-500' : 'border-l-emerald-500'}`}>
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono font-bold text-surface-900 dark:text-white text-lg">{sos.anonymous_id}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            sos.status === 'pending' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                          }`}>
                            {sos.status}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-surface-700 dark:text-surface-300">{sos.category}</p>
                        <p className="text-xs text-surface-500 mt-1">Reported: {new Date(sos.created_at).toLocaleString()}</p>
                      </div>
                      {sos.status === 'pending' && (
                        <div className="flex items-center gap-3">
                           <button onClick={() => handleResolveSOS(sos.id)} className="btn-primary py-2 px-6">Resolve & Schedule Check-in</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {sosAlerts.length === 0 && (
                  <div className="text-center py-20 glass-card">
                    <p className="text-surface-400">No SOS records found in the system.</p>
                  </div>
                )}
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
                          <p className="text-surface-700 dark:text-surface-300 italic mb-4">"{item.content_text}"</p>
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: User Trust List */}
                <div className="lg:col-span-2 glass-card overflow-hidden">
                  <div className="p-4 border-b border-surface-100 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-800/20 flex justify-between items-center">
                    <h3 className="font-bold text-surface-900 dark:text-white flex items-center gap-2">
                      <Award className="w-5 h-5 text-indigo-500" /> Community Reputation
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-surface-50 dark:bg-surface-800/50 text-[10px] uppercase tracking-widest font-bold text-surface-500">
                        <tr>
                          <th className="px-6 py-4">Peer ID</th>
                          <th className="px-6 py-4">Tier</th>
                          <th className="px-6 py-4">Score</th>
                          <th className="px-6 py-4">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                        {users.filter(u => u.role === 'student').map(u => (
                          <tr key={u.id} className={`text-sm hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors ${selectedUserTrust?.id === u.id ? 'bg-indigo-500/5' : ''}`}>
                            <td className="px-6 py-4 font-mono font-bold text-surface-900 dark:text-white">{u.anonymous_id}</td>
                            <td className="px-6 py-4">
                              <BadgeDisplay tier={getTierFromScore(u.trust_score)} size="sm" showLabel={false} />
                            </td>
                            <td className="px-6 py-4 font-bold text-indigo-500">{u.trust_score}</td>
                            <td className="px-6 py-4">
                              <button 
                                onClick={async () => {
                                  setSelectedUserTrust(u);
                                  setOverrideValue(u.trust_score);
                                  try {
                                    const res = await api.get(`/trust/history/${u.id}`);
                                    setTrustHistory(res.data.data);
                                  } catch (e) { setTrustHistory([]); }
                                }}
                                className="text-primary-600 hover:underline text-xs font-bold"
                              >
                                Manage
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right: Management Panel */}
                <div className="space-y-6">
                  {selectedUserTrust ? (
                    <div className="glass-card p-6 border-t-4 border-t-indigo-500">
                      <h3 className="font-bold text-surface-900 dark:text-white mb-4">Manage {selectedUserTrust.anonymous_id}</h3>
                      
                      <div className="space-y-6">
                        {/* Score Override */}
                        <div>
                          <label className="text-xs font-bold text-surface-500 uppercase block mb-2">Override Trust Score (0-100)</label>
                          <div className="flex gap-4 items-center">
                            <input 
                              type="range" min="0" max="100" 
                              value={overrideValue} 
                              onChange={(e) => setOverrideValue(parseInt(e.target.value))}
                              className="flex-1 accent-indigo-500"
                            />
                            <span className="text-xl font-bold text-indigo-500 w-10">{overrideValue}</span>
                          </div>
                          <input 
                            type="text" 
                            placeholder="Reason for override..."
                            value={overrideReason}
                            onChange={(e) => setOverrideReason(e.target.value)}
                            className="input-field w-full mt-3 text-xs"
                          />
                          <button 
                            onClick={async () => {
                              if (!overrideReason.trim()) {
                                alert('Please provide a reason for the trust score override.');
                                return;
                              }
                              try {
                                await api.post(`/trust/override`, {
                                  userId: selectedUserTrust.id,
                                  newScore: overrideValue,
                                  reason: overrideReason
                                });
                                
                                // Synchronously update user list and currently selected user in local state
                                setUsers(prev => prev.map(u => u.id === selectedUserTrust.id ? { ...u, trust_score: overrideValue } : u));
                                setSelectedUserTrust(prev => prev ? { ...prev, trust_score: overrideValue } : null);
                                
                                // Clear input reason
                                setOverrideReason('');
                                
                                // Re-fetch history for the selected user to display the new override event immediately
                                try {
                                  const historyRes = await api.get(`/trust/history/${selectedUserTrust.id}`);
                                  setTrustHistory(historyRes.data.data);
                                } catch (err) {
                                  console.error('Failed to reload trust history', err);
                                }

                                alert('Score updated successfully!');
                              } catch (err) {
                                const errMsg = err.response?.data?.message || err.message || 'Failed to update score';
                                alert(errMsg);
                              }
                            }}
                            className="btn-primary w-full mt-4 py-2 text-xs flex items-center justify-center gap-2"
                          >
                            <Save size={14} /> Update Score
                          </button>
                        </div>

                        {/* Actions */}
                        <div className="pt-4 border-t border-surface-100 dark:border-surface-800">
                          <button 
                            onClick={async () => {
                              if (!window.confirm('Are you sure you want to reset this users trust history? This cannot be undone.')) return;
                              try {
                                await api.delete(`/trust/history/${selectedUserTrust.id}`);
                                setTrustHistory([]);
                                alert('History reset successfully');
                              } catch (e) { alert('Failed to reset history'); }
                            }}
                            className="text-red-500 hover:text-red-600 text-xs font-bold flex items-center gap-2"
                          >
                            <RotateCcw size={14} /> Reset Reputation History
                          </button>
                        </div>

                        {/* Recent History */}
                        <div className="pt-4 border-t border-surface-100 dark:border-surface-800">
                          <h4 className="text-xs font-bold text-surface-500 uppercase flex items-center gap-2 mb-3">
                            <History size={14} /> Recent Events
                          </h4>
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                            {trustHistory.map((h, i) => (
                              <div key={i} className="text-[10px] p-2 bg-surface-50 dark:bg-surface-800/50 rounded-lg border border-surface-100 dark:border-surface-800">
                                <div className="flex justify-between items-start mb-1">
                                  <span className={`font-bold ${h.change_amount > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {h.change_amount > 0 ? '+' : ''}{h.change_amount} pts
                                  </span>
                                  <span className="text-surface-400">{new Date(h.created_at).toLocaleDateString()}</span>
                                </div>
                                <p className="text-surface-600 dark:text-surface-400 leading-tight">{h.reason}</p>
                              </div>
                            ))}
                            {trustHistory.length === 0 && (
                              <p className="text-center text-[10px] text-surface-400 py-4 italic">No history records found.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="glass-card p-12 text-center border-dashed">
                      <Users className="w-12 h-12 text-surface-300 mx-auto mb-4" />
                      <p className="text-sm text-surface-500">Select a community member from the list to manage their reputation.</p>
                    </div>
                  )}
                </div>
              </div>
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

const getTierFromScore = (score) => {
  if (score >= 80) return 'platinum';
  if (score >= 60) return 'gold';
  if (score >= 40) return 'silver';
  return 'bronze';
};
