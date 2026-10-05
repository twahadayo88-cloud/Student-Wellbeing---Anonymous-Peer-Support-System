import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Meh, AlertCircle, CheckCircle2, Bell } from 'lucide-react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import useAuth from '../hooks/useAuth';

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

  const isStudent = user?.role === 'student';
  const [consecutiveLowEntries, setConsecutiveLowEntries] = useState(0);

  const fetchData = useCallback(async () => {
    if (!isStudent) return;
    try {
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
      // Non-blocking — don't toast on background fetch errors
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">
            Mood &amp; Wellbeing
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Your individual check-ins stay private. Administrators see department-level aggregates only.
          </p>
        </div>

        {/* Reminder nudge */}
        {reminder?.needsReminder && !checkedInToday && (
          <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl px-5 py-4">
            <Bell className="w-5 h-5 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              {reminder.missedDays
                ? `You haven't checked in for ${reminder.missedDays} day${reminder.missedDays > 1 ? 's' : ''}. How are you feeling today?`
                : "This is your first check-in! Welcome 🎉"}
            </p>
          </div>
        )}

        {/* Personal pattern insight — visible only to the student, no alert, no notification */}
        {consecutiveLowEntries >= 3 && (
          <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-2xl px-5 py-4">
            <span className="text-xl shrink-0">💙</span>
            <div>
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                You&apos;ve logged {consecutiveLowEntries} consecutive low-mood check-ins.
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                It&apos;s okay to have hard days. Take it one step at a time — you&apos;re not alone.
              </p>
            </div>
          </div>
        )}

        {/* Check-in card */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-6">
          {checkedInToday ? (
            <div className="flex flex-col items-center py-6 gap-3">
              <CheckCircle2 className="w-14 h-14 text-green-500" />
              <p className="text-lg font-bold text-gray-800 dark:text-white">Checked in today!</p>
              <p className="text-sm text-gray-500">See you again tomorrow.</p>
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
                  How are you feeling right now?
                </h2>
                <div className="grid grid-cols-5 gap-2">
                  {MOOD_OPTIONS.map(opt => (
                    <button
                      key={opt.score}
                      onClick={() => setSelected(opt.score)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-2xl border-2 transition-all duration-200
                        ${selected === opt.score
                          ? `${opt.bg} ring-2 ${opt.ring} border-transparent scale-105 shadow-md`
                          : 'border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600'
                        }`}
                    >
                      <span className="text-3xl">{opt.emoji}</span>
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Optional note <span className="text-gray-400 font-normal">(private, kept anonymous)</span>
                </label>
                <textarea
                  rows={3}
                  maxLength={500}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
                  placeholder="Anything on your mind? (optional)"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
                <p className="text-xs text-gray-400 text-right mt-1">{note.length}/500</p>
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting || !selected}
                className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all duration-200 active:scale-95"
              >
                {submitting ? 'Saving…' : 'Submit Check-in'}
              </button>
            </>
          )}
        </div>

        {/* 7-day Trend Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-5">Your 7-Day Trend</h2>
          {loading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : trendData.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center gap-2">
              <Meh className="w-10 h-10 text-gray-300" />
              <p className="text-sm text-gray-400">No check-ins in the last 7 days.</p>
            </div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(156,163,175,0.15)" />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickFormatter={d => d?.slice(5)} // MM-DD
                  />
                  <YAxis
                    domain={[1, 5]}
                    ticks={[1, 2, 3, 4, 5]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="avg_score"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: '#6366f1', strokeWidth: 0 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Score legend */}
          <div className="mt-4 flex justify-between px-2">
            {MOOD_OPTIONS.map(opt => (
              <div key={opt.score} className="flex flex-col items-center gap-0.5">
                <span className="text-base">{opt.emoji}</span>
                <span className="text-xs text-gray-400">{opt.score}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Privacy note */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-500 pb-4">
          Faculty cannot access mood data. Admin and Super Admin can view anonymized department-level trends only.
        </p>

      </div>
    </div>
  );
};

export default MoodTracker;
