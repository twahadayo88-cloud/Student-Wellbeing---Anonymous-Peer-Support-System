import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Trophy, Medal, Filter, Search, Hash,
  MessageSquare, GraduationCap, LayoutDashboard
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/layout/Navbar';
import BadgeDisplay from '../components/trust/BadgeDisplay';

const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const departments = ['All', ...new Set(leaderboard.map(item => item.department).filter(Boolean))];

  useEffect(() => {
    let cancelled = false;
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await api.get('/trust/leaderboard');
        if (!cancelled) setLeaderboard(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
        if (!cancelled) {
          setLeaderboard([]);
          setError(error.response?.data?.message || 'Leaderboard data is unavailable.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchLeaderboard();
    return () => { cancelled = true; };
  }, []);

  const filteredLeaderboard = leaderboard.filter(item =>
    (selectedDept === 'All' || item.department === selectedDept) &&
    (item.anonymous_id || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRankIcon = (rank) => {
    if (rank === 1) return <Medal className="text-amber-400 drop-shadow" size={22} />;
    if (rank === 2) return <Medal className="text-slate-300 drop-shadow" size={22} />;
    if (rank === 3) return <Medal className="text-orange-400 drop-shadow" size={22} />;
    return <span className="text-surface-500 font-bold text-sm">#{rank}</span>;
  };

  const getRankBg = (rank) => {
    if (rank === 1) return 'from-amber-500/20 to-yellow-500/5 border-amber-500/30';
    if (rank === 2) return 'from-slate-400/20 to-slate-500/5 border-slate-400/30';
    if (rank === 3) return 'from-orange-500/20 to-orange-400/5 border-orange-400/30';
    return 'from-surface-100/10 to-transparent border-surface-200/20 dark:border-surface-800/30';
  };

  // Left icon sidebar navigation items
  const sidebarItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: MessageSquare, label: 'Messages', path: '/chat' },
    { icon: Trophy, label: 'Leaderboard', path: '/leaderboard', active: true },
    { icon: GraduationCap, label: 'Academic Board', path: '/chat?tab=academic' },
  ];

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-20 pb-0 px-0 w-full flex bg-surface-50 dark:bg-surface-950">

        {/* ─── LEFT ICON SIDEBAR (matching Chat page) ─── */}
        <div className="w-16 h-[calc(100vh-5rem)] bg-surface-100 dark:bg-surface-900 border-r border-surface-200 dark:border-surface-800 flex flex-col items-center py-4 space-y-6 flex-shrink-0 z-10">
          {sidebarItems.map((item) => (
            <button
              key={item.label}
              onClick={() => { if (item.path) window.location.assign(item.path); }}
              title={item.label}
              className={`p-3 rounded-xl transition-all ${item.active
                ? 'bg-primary-500/20 text-primary-500 shadow-inner cursor-default'
                : 'text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-100'
                }`}
            >
              <item.icon size={24} />
            </button>
          ))}
        </div>

        {/* ─── MAIN CONTENT AREA ─── */}
        <div className="flex-1 h-[calc(100vh-5rem)] overflow-y-auto bg-surface-50 dark:bg-surface-950">
          <div className="max-w-5xl mx-auto px-6 py-8">

            {/* Header */}
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-surface-900 dark:text-white flex items-center gap-3">
                  <Trophy className="text-amber-400" size={30} />
                  Peer Recognition Board
                </h1>
                <p className="text-surface-400 mt-1 text-sm">
                  Celebrating our most helpful community members for{' '}
                  <span className="text-primary-500 font-semibold">
                    {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </span>
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" size={16} />
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="pl-9 pr-4 py-2.5 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none appearance-none cursor-pointer text-surface-800 dark:text-surface-200 shadow-sm"
                  >
                    {departments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search helper..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2.5 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none text-surface-800 dark:text-surface-200 shadow-sm w-52"
                  />
                </div>
              </div>
            </div>

            {/* Top 3 Spotlight Cards */}
            {!loading && filteredLeaderboard.length >= 3 && searchTerm === '' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
                {[2, 1, 3].map((rank) => {
                  const item = filteredLeaderboard.find(i => i.rank_position === rank);
                  if (!item) return null;
                  return (
                    <motion.div
                      key={item.id || item.anonymous_id}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: rank * 0.08 }}
                      className={`relative p-6 rounded-2xl border bg-gradient-to-br ${getRankBg(rank)} ${rank === 1 ? 'md:scale-105 md:z-10 shadow-lg' : ''
                        } text-center backdrop-blur-sm`}
                    >
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                        {getRankIcon(rank)}
                      </div>
                      <div className="w-14 h-14 bg-surface-200 dark:bg-surface-800 rounded-full mx-auto mb-3 mt-2 flex items-center justify-center border-2 border-surface-300 dark:border-surface-700 text-lg font-bold text-surface-600 dark:text-surface-300">
                        {item.anonymous_id.slice(0, 2).toUpperCase()}
                      </div>
                      <h3 className="text-base font-bold text-surface-900 dark:text-white mb-0.5 truncate">{item.anonymous_id}</h3>
                      <p className="text-surface-500 text-xs mb-4">{item.department}</p>
                      <div className="flex flex-col items-center gap-2">
                        <BadgeDisplay tier={item.badge_tier || 'bronze'} size="md" />
                        <div className="grid grid-cols-2 gap-3 w-full mt-3 pt-3 border-t border-surface-200/30 dark:border-surface-700/30">
                          <div>
                            <p className="text-[10px] text-surface-500 uppercase tracking-wider">Helped</p>
                            <p className="text-lg font-bold text-surface-900 dark:text-white">{item.help_count}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-surface-500 uppercase tracking-wider">Rating</p>
                            <p className="text-lg font-bold text-primary-500">★ {parseFloat(item.avg_rating).toFixed(1)}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Full List Table */}
            <div className="bg-white dark:bg-surface-900/60 rounded-2xl border border-surface-200 dark:border-surface-800 overflow-hidden shadow-sm">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-surface-100 dark:border-surface-800 text-surface-500 text-[11px] font-bold uppercase tracking-widest bg-surface-50 dark:bg-surface-800/40">
                <div className="col-span-1 text-center">Rank</div>
                <div className="col-span-4">Peer Helper</div>
                <div className="col-span-3">Department</div>
                <div className="col-span-2 text-center">Badge</div>
                <div className="col-span-1 text-center">Helped</div>
                <div className="col-span-1 text-right">Rating</div>
              </div>

              <AnimatePresence mode="popLayout">
                {loading ? (
                  <div className="space-y-0 divide-y divide-surface-100 dark:divide-surface-800">
                    {[1, 2, 3, 4, 5].map(n => (
                      <div key={n} className="grid grid-cols-12 gap-4 px-6 py-4 animate-pulse">
                        <div className="col-span-1 flex justify-center"><div className="w-6 h-6 bg-surface-200 dark:bg-surface-700 rounded-full" /></div>
                        <div className="col-span-4 flex items-center gap-3">
                          <div className="w-8 h-8 bg-surface-200 dark:bg-surface-700 rounded-lg" />
                          <div className="h-4 bg-surface-200 dark:bg-surface-700 rounded w-32" />
                        </div>
                        <div className="col-span-3"><div className="h-4 bg-surface-200 dark:bg-surface-700 rounded w-24" /></div>
                        <div className="col-span-2 flex justify-center"><div className="w-8 h-8 bg-surface-200 dark:bg-surface-700 rounded-full" /></div>
                        <div className="col-span-1 flex justify-center"><div className="h-4 bg-surface-200 dark:bg-surface-700 rounded w-6" /></div>
                        <div className="col-span-1 flex justify-end"><div className="h-4 bg-surface-200 dark:bg-surface-700 rounded w-8" /></div>
                      </div>
                    ))}
                  </div>
                ) : filteredLeaderboard.length === 0 ? (
                  <div className="py-20 text-center">
                    <Trophy className="w-12 h-12 text-surface-300 dark:text-surface-700 mx-auto mb-4" />
                    <p className="text-surface-500 text-sm font-medium">{error || 'No rankings available yet.'}</p>
                    {!error && <p className="text-surface-400 text-xs mt-1">Be the first to help a peer and earn your spot!</p>}
                  </div>
                ) : (
                  filteredLeaderboard.map((item, index) => (
                    <motion.div
                      key={item.id || item.anonymous_id}
                      initial={{ x: -10, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: index * 0.04 }}
                      className={`grid grid-cols-12 gap-4 px-6 py-4 items-center border-b border-surface-100 dark:border-surface-800/60 last:border-0 hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors ${item.rank_position <= 3 ? 'bg-gradient-to-r ' + getRankBg(item.rank_position) : ''
                        }`}
                    >
                      <div className="col-span-1 flex justify-center">
                        {getRankIcon(item.rank_position)}
                      </div>
                      <div className="col-span-4 flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-primary-400 to-accent-500 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
                          {item.anonymous_id.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-semibold text-surface-900 dark:text-surface-100 text-sm truncate">
                          {item.anonymous_id}
                        </span>
                      </div>
                      <div className="col-span-3 text-sm text-surface-500 truncate">
                        {item.department}
                      </div>
                      <div className="col-span-2 flex justify-center">
                        <BadgeDisplay tier={item.badge_tier || 'bronze'} showLabel={false} size="sm" />
                      </div>
                      <div className="col-span-1 text-center font-bold text-surface-900 dark:text-white text-sm">
                        {item.help_count}
                      </div>
                      <div className="col-span-1 text-right font-bold text-primary-500 text-sm">
                        ★ {parseFloat(item.avg_rating).toFixed(1)}
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>

            {/* Footer note */}
            {!loading && filteredLeaderboard.length > 0 && (
              <p className="text-center text-xs text-surface-400 mt-6 flex items-center justify-center gap-2">
                <Hash size={12} />
                Rankings reset monthly. All identities remain anonymous.
              </p>
            )}
          </div>
        </div>
      </main>
    </>
  );
};

export default Leaderboard;
