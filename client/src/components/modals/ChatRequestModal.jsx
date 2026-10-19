import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';

export default function ChatRequestModal({ isOpen, onClose, peer, onSuccess }) {
  const [subject, setSubject] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const targetId = peer?.anonymous_id || peer?.anonymousId;

  useEffect(() => {
    setSubject('');
    setError('');
    setIsSubmitting(false);
  }, [isOpen, targetId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !targetId) return;

    setIsSubmitting(true);
    setError('');

    try {
      await api.post('/chat/request', {
        receiver_anonymous_id: targetId,
        subject_context: subject.trim()
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send chat request');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const dicebearUrl = targetId
    ? `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(targetId)}&backgroundColor=transparent`
    : null;

  return (
    <div className="modal-overlay flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="w-full max-w-md glass-card-brand rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-7 relative border border-white/10"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-pink-500/20 to-amber-500/20 border border-pink-500/30 flex items-center justify-center overflow-hidden shrink-0">
            {dicebearUrl ? (
              <img src={dicebearUrl} alt={targetId} className="w-full h-full object-cover" />
            ) : (
              <span className="font-mono text-pink-500 font-bold text-xs">ID</span>
            )}
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Request Chat Session
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Start anonymous peer discussion
            </p>
          </div>
        </div>

        <p className="text-slate-600 dark:text-slate-300 text-xs mb-5 leading-relaxed bg-slate-100/60 dark:bg-white/[0.03] p-3 rounded-xl border border-slate-200/60 dark:border-white/5">
          Connecting with <span className="font-mono font-bold text-pink-500">{targetId || '...'}</span>. Both identities remain completely anonymous.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Subject Context
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Help with CS101 assignment or midterm review"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="input-field w-full text-sm"
              maxLength={100}
            />
          </div>

          {error && (
            <p className="text-red-500 text-xs p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 font-medium">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1 py-2.5 text-xs font-bold"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex-1 py-2.5 text-xs font-bold"
              disabled={isSubmitting || !subject.trim()}
            >
              {isSubmitting ? 'Sending...' : 'Send Request'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
