import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';

export default function ChatRequestModal({ isOpen, onClose, peer, onSuccess }) {
  const [subject, setSubject] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const targetId = peer?.anonymous_id || peer?.anonymousId;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-950/80 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md bg-white dark:bg-surface-950 rounded-2xl shadow-xl overflow-hidden glass-border p-6"
      >
        <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-2">Request Chat</h2>
        <p className="text-surface-500 text-sm mb-6">
          Briefly state what you&apos;d like to discuss with <span className="font-mono font-bold text-primary-500">{targetId || '...'}</span>.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
              Subject Context
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Help with CS101 assignment"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="input-field w-full"
              maxLength={100}
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
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
