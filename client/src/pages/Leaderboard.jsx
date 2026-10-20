import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Trophy, Medal, Filter, Search, Hash,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/layout/Navbar';
import PageHeader from '../components/layout/PageHeader';
import BadgeDisplay from '../components/trust/BadgeDisplay';
import useAuth from '../hooks/useAuth';

const Leaderboard = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
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
    if (rank === 1) return 'from-amber-500/20 via-pink-500/10 to-transparent border-amber-500/40 shadow-glow-amber';
    if (rank === 2) return 'from-slate-400/20 via-pink-500/5 to-transparent border-slate-400/30';
    if (rank === 3) return 'from-orange-500/20 via-amber-500/5 to-transparent border-orange-400/30';
    return 'from-white/[0.03] to-transparent border-white/5';
  };

  const getDicebear = (seed) =>
    `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=transparent`;

  return (
    <>
      {isAdmin ? <Navbar /> : <Sidebar />}
      <main className={`min-h-screen pb-0 px-0 w-full flex bg-slate-50 dark:bg-[#09090e] transition-colors ${isAdmin ? 'pt-16' : 'ml-16 sm:ml-64'}`}>

        {/* ─── MAIN CONTENT AREA ─── */}
        <div className="flex-1 h-screen overflow-y-auto bg-slate-50/50 dark:bg-[#09090e]">
          <div className="max-w-5xl mx-auto w-full px-6 py-8">

            {/* PAGE HEADER (standardized) */}
            <PageHeader
              tone="light"
              title={
                <span className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md shadow-pink-500/20 shrink-0"
                    style={{ background: 'linear-gradient(135deg, #ec4899, #ef4444, #f59e0b)' }}
                  >
                    <Trophy size={22} />
                  </div>
                  Peer Recognition Board
                </span>
              }
              subtitle="Trust-Based Secure Dashboard"
              myId={user?.anonymous_id}
              actions={
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <select
                      value={selectedDept}
                      onChange={(e) => setSelectedDept(e.target.value)}
                      className="input-field pl-9 py-2 text-xs appearance-none cursor-pointer"
                    >
                      {departments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input
                      type="text"
                      placeholder="Search helper..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="input-field pl-9 py-2 text-xs w-full sm:w-56"
                    />
                  </div>
                </div>
              }
            />

            {/* Top 3 Spotlight Cards */}
            {!loading && filteredLeaderboard.length >= 3 && searchTerm === '' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10 items-end">
                {[2, 1, 3].map((rank) => {
                  const item = filteredLeaderboard.find(i => i.rank_position === rank);
                  if (!item) return null;
                  return (
                    <motion.div
                      key={item.id || item.anonymous_id}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: rank * 0.08 }}
                      className={`relative p-6 rounded-2xl border bg-gradient-to-br ${getRankBg(rank)} ${
                        rank === 1 ? 'md:-translate-y-3 shadow-2xl glass-card-brand' : 'glass-card'
                      } text-center backdrop-blur-md`}
                    >
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                        {getRankIcon(rank)}
                      </div>
                      <div className="w-16 h-16 rounded-2xl mx-auto mb-3 mt-2 overflow-hidden border border-white/20 bg-gradient-to-br from-pink-500/20 to-amber-500/20 p-1 flex items-center justify-center shadow-md">
                        <img
                          src={getDicebear(item.anonymous_id)}
                          alt={item.anonymous_id}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      </div>
                      <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white mb-0.5 truncate font-mono">
                        @{item.anonymous_id}
                      </h3>
                      <p className="text-slate-400 text-xs mb-3 font-medium">{item.department || 'General'}</p>
                      <div className="flex flex-col items-center gap-2">
                        <BadgeDisplay tier={item.badge_tier || 'bronze'} size="sm" />
                        <div className="grid grid-cols-2 gap-3 w-full mt-3 pt-3 border-t border-slate-200/40 dark:border-white/5">
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Helped</p>
                            <p className="text-base font-extrabold text-slate-900 dark:text-white font-mono">{item.help_count}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Rating</p>
                            <p className="text-base font-extrabold text-amber-500 font-mono">★ {parseFloat(item.avg_rating).toFixed(1)}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Full List Table */}
            <div className="bg-white dark:bg-[#111118] border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xl w-full">
              <div className="overflow-x-auto w-full">
              {/* Table Header */}
              <div className="grid min-w-[640px] grid-cols-12 gap-2 px-3 py-3 border-b border-slate-200/80 dark:border-white/5 text-slate-400 text-[11px] font-bold uppercase tracking-wider bg-slate-100/50 dark:bg-white/[0.02]">
                <div className="col-span-1 text-center">Rank</div>
                <div className="col-span-4">Peer Helper</div>
                <div className="col-span-3">Department</div>
                <div className="col-span-2 text-center">Badge</div>
                <div className="col-span-1 text-center">Helped</div>
                <div className="col-span-1 text-right">Rating</div>
              </div>

              <AnimatePresence mode="popLayout">
                {loading ? (
                  <div className="divide-y divide-slate-100 dark:divide-white/5">
                    {[1, 2, 3, 4, 5].map(n => (
                      <div key={n} className="grid min-w-[640px] grid-cols-12 gap-2 px-3 py-3 animate-pulse">
                        <div className="col-span-1 flex justify-center"><div className="w-5 h-5 bg-slate-200 dark:bg-white/10 rounded-full" /></div>
                        <div className="col-span-4 flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-200 dark:bg-white/10 rounded-xl" />
                          <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-28" />
                        </div>
                        <div className="col-span-3"><div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-20" /></div>
                        <div className="col-span-2 flex justify-center"><div className="w-16 h-6 bg-slate-200 dark:bg-white/10 rounded-full" /></div>
                        <div className="col-span-1 flex justify-center"><div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-6" /></div>
                        <div className="col-span-1 flex justify-end"><div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-8" /></div>
                      </div>
                    ))}
                  </div>
                ) : filteredLeaderboard.length === 0 ? (
                  <div className="py-20 text-center">
                    <Trophy className="w-12 h-12 text-pink-500/30 mx-auto mb-3" />
                    <p className="text-slate-600 dark:text-slate-300 text-sm font-semibold">{error || 'No rankings available yet.'}</p>
                    {!error && <p className="text-slate-400 text-xs mt-1">Be the first to help a peer and earn your badge!</p>}
                  </div>
                ) : (
                  filteredLeaderboard.map((item, index) => (
                    <motion.div
                      key={item.id || item.anonymous_id}
                      initial={{ x: -10, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: index * 0.03 }}
                      className={`grid min-w-[640px] grid-cols-12 gap-2 px-3 py-3 items-center border-b border-slate-100 dark:border-white/5 last:border-0 hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors ${
                        item.rank_position <= 3 ? 'bg-gradient-to-r ' + getRankBg(item.rank_position) : ''
                      }`}
                    >
                      <div className="col-span-1 flex justify-center">
                        {getRankIcon(item.rank_position)}
                      </div>
                      <div className="col-span-4 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-pink-500/10 border border-pink-500/20 overflow-hidden flex items-center justify-center shrink-0">
                          <img
                            src={getDicebear(item.anonymous_id)}
                            alt={item.anonymous_id}
                            className="w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        </div>
                        <span className="font-semibold text-slate-800 dark:text-slate-100 text-xs sm:text-sm truncate font-mono">
                          @{item.anonymous_id}
                        </span>
                      </div>
                      <div className="col-span-3 text-xs text-slate-500 dark:text-slate-400 truncate font-medium">
                        {item.department || 'General'}
                      </div>
                      <div className="col-span-2 flex justify-center">
                        <BadgeDisplay tier={item.badge_tier || 'bronze'} showLabel={false} size="sm" />
                      </div>
                      <div className="col-span-1 text-center font-bold text-slate-800 dark:text-white text-xs font-mono">
                        {item.help_count}
                      </div>
                      <div className="col-span-1 text-right font-extrabold text-amber-500 text-xs font-mono">
                        ★ {parseFloat(item.avg_rating).toFixed(1)}
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
              </div>
            </div>

            {/* Footer note */}
            {!loading && filteredLeaderboard.length > 0 && (
              <p className="text-center text-xs text-slate-400 mt-6 flex items-center justify-center gap-1.5 font-medium">
                <Hash size={13} className="text-pink-500" />
                Rankings reset monthly. All identities remain strictly anonymous.
              </p>
            )}
          </div>
        </div>
      </main>
    </>
  );
};

export default Leaderboard;
