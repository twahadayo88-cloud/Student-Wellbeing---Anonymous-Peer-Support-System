import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Meh, AlertCircle, CheckCircle2, Bell } from 'lucide-react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import useAuth from '../hooks/useAuth';
import Sidebar from '../components/layout/Sidebar';
import PageHeader from '../components/layout/PageHeader';
import Footer from '../components/layout/Footer';

const MOOD_OPTIONS = [
  { score: 1, emoji: '😞', label: 'Very Low',    color: '#ef4444', bg: 'bg-red-50 dark:bg-red-900/20',     ring: 'ring-red-400'    },
  { score: 2, emoji: '😔', label: 'Low',          color: '#f97316', bg: 'bg-orange-50 dark:bg-orange-900/20', ring: 'ring-orange-400' },
  { score: 3, emoji: '😐', label: 'Neutral',      color: '#eab308', bg: 'bg-yellow-50 dark:bg-yellow-900/20', ring: 'ring-yellow-400' },
  { score: 4, emoji: '🙂', label: 'Good',         color: '#22c55e', bg: 'bg-green-50 dark:bg-green-900/20',  ring: 'ring-green-400'  },
  { score: 5, emoji: '😄', label: 'Excellent',    color: '#6366f1', bg: 'bg-indigo-50 dark:bg-indigo-900/20', ring: 'ring-indigo-400' },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const score = Number(payload[0].value).toFixed(1);
    const option = MOOD_OPTIONS[Math.round(score) - 1] || MOOD_OPTIONS[2];
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl px-4 py-3">
        <p className="text-xs text-gray-500 mb-1">{label}</p>
        <p className="text-lg">{option.emoji} <span className="font-bold text-gray-800 dark:text-white">{score}</span></p>
        <p className="text-xs text-gray-500">{option.label}</p>
      </div>
    );
  }
  return null;
};

CustomTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.number })),
  label: PropTypes.string,
};

const MoodTracker = () => {
  const { user } = useAuth();
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [trendData, setTrendData] = useState([]);
  const [reminder, setReminder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [moodConsent, setMoodConsent] = useState(null);
  const [updatingConsent, setUpdatingConsent] = useState(false);

  const isStudent = user?.role === 'student';
  const [consecutiveLowEntries, setConsecutiveLowEntries] = useState(0);

  const fetchData = useCallback(async () => {
    if (!isStudent) return;
    setLoading(true);
    try {
      const profileRes = await api.get('/profile/me');
      const hasConsent = Boolean(profileRes.data.data?.consent_mood_tracking);
      setMoodConsent(hasConsent);
      if (!hasConsent) {
        setTrendData([]);
        setReminder(null);
        setCheckedInToday(false);
        setConsecutiveLowEntries(0);
        return;
      }

      const [trendRes, reminderRes, fullHistoryRes] = await Promise.all([
        api.get('/mood/trend'),
        api.get('/mood/reminder'),
        api.get('/mood/history?days=30'),
      ]);
      setTrendData(trendRes.data.data || []);
      setReminder(reminderRes.data.data);
      setCheckedInToday(Boolean(reminderRes.data.data?.checkedInToday));

      // Pattern detection: count consecutive low entries at end of personal history.
      // This is a self-visible insight only — no alert, no notification to anyone.
      const fullHistory = fullHistoryRes.data.data || [];
      if (fullHistory.length > 0) {
        const lastEntry = fullHistory[fullHistory.length - 1];
        setConsecutiveLowEntries(lastEntry.consecutive_low_count || 0);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to load your mood tracker.');
    } finally {
      setLoading(false);
    }
  }, [isStudent]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async () => {
    if (!selected) {
      toast.error('Please pick a mood before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/mood', {
        mood_score: selected,
        note: note.trim() || undefined,
      });
      if (res.data.data?.alreadyCheckedIn) {
        toast('You already checked in today! See you tomorrow 👋', { icon: '📅' });
        setCheckedInToday(true);
      } else {
        toast.success('Mood logged! Keep it up 🎉');
        setCheckedInToday(true);
        fetchData();
      }
      setNote('');
      setSelected(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save check-in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConsent = async (enabled) => {
    if (!enabled && !window.confirm('Withdraw mood-tracking consent and permanently delete your mood check-ins?')) {
      return;
    }
    setUpdatingConsent(true);
    try {
      await api.patch('/profile/consent', { consent_mood_tracking: enabled });
      setMoodConsent(enabled);
      if (enabled) {
        toast.success('Mood tracking enabled. Your check-ins are stored pseudonymously.');
        await fetchData();
      } else {
        setTrendData([]);
        setReminder(null);
        setCheckedInToday(false);
        setConsecutiveLowEntries(0);
        setNote('');
        setSelected(null);
        toast.success('Consent withdrawn and your mood check-ins were deleted.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update mood-tracking consent.');
    } finally {
      setUpdatingConsent(false);
    }
  };

  if (!isStudent) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="text-center p-10">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Mood Tracker is available for students only.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Sidebar />
      <div className="min-h-screen bg-slate-50 dark:bg-[#09090e] px-4 pt-6 pb-12 transition-colors relative ml-16 sm:ml-64">
        <div className="max-w-2xl mx-auto w-full space-y-7 relative z-10">

          {/* PAGE HEADER (standardized) */}
          <PageHeader
            tone="light"
            title={<span className="flex items-center gap-3"><span className="text-2xl">🌱</span> Mood &amp; Wellbeing</span>}
            subtitle="Your private wellbeing check-ins"
            myId={user?.anonymous_id}
          />

          {moodConsent === false && (
            <section className="glass-card rounded-3xl p-6 sm:p-7 space-y-4 border border-white/10 shadow-xl">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Mood tracking is optional</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                If you opt in, your check-ins are stored under a keyed pseudonymous identifier, not your account ID.
                This lets you view your own history and receive mood-based resource recommendations. The service can
                associate your entries with your account to provide those personal features. Faculty cannot see
                individual entries; department aggregates with fewer than five participants are hidden.
              </p>
              <button
                type="button"
                onClick={() => handleConsent(true)}
                disabled={updatingConsent}
                className="btn-primary px-5 py-3 rounded-xl font-semibold disabled:opacity-50"
              >
                {updatingConsent ? 'Saving…' : 'I consent and want to enable mood tracking'}
              </button>
            </section>
          )}

          {loading && moodConsent === null && (
            <div className="glass-card rounded-3xl p-8 text-center text-slate-500">Loading mood settings…</div>
          )}

          {moodConsent && (
            <>
          {/* Reminder nudge */}
          {reminder?.needsReminder && !checkedInToday && (
            <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-5 py-4">
              <Bell className="w-5 h-5 text-amber-500 shrink-0" />
              <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300 font-medium">
                {reminder.missedDays
                  ? `You haven't checked in for ${reminder.missedDays} day${reminder.missedDays > 1 ? 's' : ''}. How are you feeling today?`
                  : "Welcome to your first private daily check-in! 🎉"}
              </p>
            </div>
          )}

          {/* Personal pattern insight */}
          {consecutiveLowEntries >= 3 && (
            <div className="flex items-start gap-3 bg-pink-500/10 border border-pink-500/20 rounded-2xl px-5 py-4">
              <span className="text-xl shrink-0">💙</span>
              <div>
                <p className="text-xs sm:text-sm font-bold text-pink-600 dark:text-pink-300">
                  You&apos;ve logged {consecutiveLowEntries} consecutive low-mood check-ins.
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  It&apos;s okay to have hard days. Check out our anonymous peer support channels — you&apos;re not alone.
                </p>
              </div>
            </div>
          )}

          {/* Check-in card */}
          <div className="glass-card-brand rounded-3xl p-6 sm:p-7 space-y-6 border border-white/10 shadow-xl">
            {checkedInToday ? (
              <div className="flex flex-col items-center py-6 gap-3">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shadow-md shadow-emerald-500/20">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <p className="text-lg font-extrabold text-slate-900 dark:text-white">Checked in today!</p>
                <p className="text-xs text-slate-400 font-medium">Thank you for caring for your mental wellbeing. See you tomorrow 👋</p>
              </div>
            ) : (
              <>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-4 tracking-tight">
                    How are you feeling right now?
                  </h2>
                  <div className="grid grid-cols-5 gap-2 sm:gap-3">
                    {MOOD_OPTIONS.map(opt => (
                      <button
                        key={opt.score}
                        onClick={() => setSelected(opt.score)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all duration-200
                          ${selected === opt.score
                            ? 'bg-pink-500/15 border-pink-500/40 shadow-glow-pink scale-105'
                            : 'border-slate-200/80 dark:border-white/5 hover:border-pink-500/30 hover:scale-102 bg-white/40 dark:bg-white/[0.02]'
                          }`}
                      >
                        <span className="text-3xl">{opt.emoji}</span>
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Optional note <span className="text-slate-400 font-normal lowercase">(private & pseudonymous)</span>
                  </label>
                  <textarea
                    rows={3}
                    maxLength={500}
                    className="input-field w-full text-xs sm:text-sm resize-none"
                    placeholder="Anything on your mind? (optional reflections)"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                  />
                  <p className="text-[10px] text-slate-400 text-right mt-1 font-mono">{note.length}/500</p>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={submitting || !selected}
                  className="btn-primary w-full py-3.5 rounded-2xl font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-pink-500/20"
                >
                  {submitting ? 'Saving entry…' : 'Submit Check-in'}
                </button>
              </>
            )}
          </div>

          {/* 7-day Trend Chart */}
          <div className="glass-card rounded-3xl p-6 sm:p-7 border border-white/10 shadow-xl">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-5 tracking-tight">
              Your 7-Day Trend
            </h2>
            {loading ? (
              <div className="h-48 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : trendData.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center gap-2">
                <Meh className="w-10 h-10 text-slate-400/40" />
                <p className="text-xs text-slate-400">No check-ins in the last 7 days.</p>
              </div>
            ) : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      tickFormatter={d => d?.slice(5)}
                    />
                    <YAxis
                      domain={[1, 5]}
                      ticks={[1, 2, 3, 4, 5]}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="avg_score"
                      stroke="#ec4899"
                      strokeWidth={3}
                      dot={{ r: 5, fill: '#ef4444', strokeWidth: 2, stroke: '#ffffff' }}
                      activeDot={{ r: 7, fill: '#ec4899' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Score legend */}
            <div className="mt-4 flex justify-between px-2 pt-3 border-t border-slate-100 dark:border-white/5">
              {MOOD_OPTIONS.map(opt => (
                <div key={opt.score} className="flex flex-col items-center gap-0.5">
                  <span className="text-base">{opt.emoji}</span>
                  <span className="text-[11px] text-slate-400 font-mono">{opt.score}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Privacy note */}
          <div className="text-center space-y-3 pb-4">
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Mood entries use a keyed pseudonymous identifier so your personal history and recommendations work.
              Faculty cannot access individual logs. Admin aggregates hide department/day groups with fewer than five participants.
            </p>
            <button
              type="button"
              onClick={() => handleConsent(false)}
              disabled={updatingConsent}
              className="text-xs font-semibold text-rose-500 hover:text-rose-600 disabled:opacity-50"
            >
              Withdraw consent and delete my mood data
            </button>
          </div>
          </>
          )}
        </div>
      </div>
            <Footer />
          </>
        );
      };
      export default MoodTracker;
