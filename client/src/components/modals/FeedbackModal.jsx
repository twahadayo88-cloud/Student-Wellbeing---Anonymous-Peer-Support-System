import { useState } from 'react';
import { Star } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../../services/api';

export default function FeedbackModal({ isOpen, onClose, peerAnonymousId, conversationId }) {
  const [rating, setRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setIsSubmitting(true);
    try {
      await api.post('/feedback', {
        to_anonymous_id: peerAnonymousId,
        rating,
        request_id: conversationId
      });
      setSubmitted(true);
      setTimeout(() => {
        onClose();
        setSubmitted(false);
        setRating(0);
      }, 2000);
    } catch (err) {
      console.error('Failed to submit feedback', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const dicebearUrl = peerAnonymousId
    ? `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(peerAnonymousId)}&backgroundColor=transparent`
    : null;

  return (
    <div className="modal-overlay flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="w-full max-w-sm glass-card-brand rounded-2xl shadow-2xl overflow-hidden p-6 text-center relative border border-white/10"
      >
        {!submitted ? (
          <>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500/20 via-red-500/15 to-amber-500/20 border border-pink-500/30 flex items-center justify-center p-2 mx-auto mb-3 shadow-md shadow-pink-500/20">
              {dicebearUrl ? (
                <img src={dicebearUrl} alt={peerAnonymousId} className="w-full h-full object-cover" />
              ) : (
                <span className="font-mono text-pink-500 font-bold text-sm">PB</span>
              )}
            </div>

            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-1">
              Session Feedback
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs mb-6">
              Was your session with <span className="font-mono font-bold text-pink-500">{peerAnonymousId}</span> helpful?
            </p>

            <div className="flex justify-center gap-2 mb-7">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="p-1 transition-transform hover:scale-125 focus:outline-none"
                >
                  <Star 
                    className={`w-7 h-7 transition-all ${
                      rating >= star 
                        ? 'text-amber-400 fill-amber-400 drop-shadow-md' 
                        : 'text-slate-300 dark:text-slate-700 hover:text-amber-300'
                    }`} 
                  />
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="btn-secondary flex-1 py-2.5 text-xs font-bold"
                disabled={isSubmitting}
              >
                Skip
              </button>
              <button
                onClick={handleSubmit}
                className="btn-primary flex-1 py-2.5 text-xs font-bold"
                disabled={isSubmitting || rating === 0}
              >
                {isSubmitting ? 'Sending...' : 'Submit'}
              </button>
            </div>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-6"
          >
            <div className="w-14 h-14 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto mb-3 text-emerald-500 shadow-md shadow-emerald-500/20">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Thank You!</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
              Your feedback helps maintain community trust and helper badges.
            </p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
