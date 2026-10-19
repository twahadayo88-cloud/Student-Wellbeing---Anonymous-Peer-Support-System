import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, AlertTriangle, ShieldCheck } from 'lucide-react';

const PostRequestModal = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    urgency: 'medium',
    description: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const subjects = [
    'Computer Science', 'Mathematics', 'Physics', 'Biology', 
    'Chemistry', 'Economics', 'Psychology', 'Literature', 'History'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
      setFormData({ title: '', subject: '', urgency: 'medium', description: '' });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="glass-card-brand rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-white/10"
      >
        <div
          className="p-5 flex justify-between items-center text-white"
          style={{ background: 'linear-gradient(135deg, #ec4899, #ef4444, #f59e0b)' }}
        >
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">Post Academic Request</h2>
            <p className="text-white/80 text-xs font-medium">Connect anonymously with peer helpers</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Request Title
            </label>
            <input
              required
              type="text"
              placeholder="e.g. Help understanding dynamic programming memoization"
              className="input-field w-full text-sm"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Subject
              </label>
              <select
                required
                className="input-field w-full text-sm"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              >
                <option value="">Select Subject</option>
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Urgency
              </label>
              <select
                className="input-field w-full text-sm"
                value={formData.urgency}
                onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Description & Details
            </label>
            <textarea
              required
              rows={4}
              placeholder="Provide context on your question or problem. The more detail, the faster an expert peer can assist."
              className="input-field w-full text-sm resize-none"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="bg-pink-500/10 dark:bg-pink-500/15 border border-pink-500/20 p-3.5 rounded-xl flex items-start space-x-3">
            <ShieldCheck className="w-5 h-5 text-pink-500 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              <span className="font-bold text-pink-600 dark:text-pink-400">AI Safety Check:</span> All posts are scanned for safety. Academic integrity is strictly upheld.
            </div>
          </div>

          <div className="pt-2 flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1 py-2.5 text-xs font-bold"
            >
              Cancel
            </button>
            <button
              disabled={isSubmitting}
              type="submit"
              className="btn-primary flex-1 py-2.5 text-xs font-bold flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Post Request</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default PostRequestModal;
