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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-950/80 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm bg-white dark:bg-surface-950 rounded-2xl shadow-xl overflow-hidden glass-border p-6 text-center"
      >
        {!submitted ? (
          <>
            <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-2">Chat Feedback</h2>
            <p className="text-surface-500 text-sm mb-6">
              Was your session with <span className="font-mono font-bold text-primary-500">{peerAnonymousId}</span> helpful?
            </p>

            <div className="flex justify-center gap-2 mb-8">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="p-1 transition-all"
                >
                  <Star 
                    className={`w-8 h-8 transition-all ${
                      rating >= star 
                        ? 'scale-110 text-amber-500 fill-amber-500' 
                        : 'text-surface-300 dark:text-surface-700 grayscale hover:grayscale-0'
                    }`} 
                  />
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="btn-secondary flex-1"
                disabled={isSubmitting}
              >
                Skip
              </button>
              <button
                onClick={handleSubmit}
                className="btn-primary flex-1"
                disabled={isSubmitting || rating === 0}
              >
                {isSubmitting ? 'Sending...' : 'Submit'}
              </button>
            </div>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-8"
          >
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
               <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
               </svg>
            </div>
            <h3 className="text-lg font-bold text-surface-900 dark:text-white">Thank You!</h3>
            <p className="text-surface-500 text-sm mt-1">Your feedback helps maintain community trust.</p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
