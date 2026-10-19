import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Book, AlertCircle, MessageSquare, Shield, GraduationCap } from 'lucide-react';
import BadgeDisplay from '../trust/BadgeDisplay';

const RequestDetailModal = ({ isOpen, onClose, request, onOfferHelp, isHelper }) => {
  if (!request) return null;

  const urgencyColors = {
    low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  };

  const dicebearUrl = request?.anonymous_id
    ? `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(request.anonymous_id)}&backgroundColor=transparent`
    : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="modal-overlay flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="relative w-full max-w-lg glass-card-brand rounded-3xl shadow-2xl overflow-hidden border border-white/10 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Banner with Brand Gradient */}
            <div
              className="relative overflow-hidden p-6 text-white"
              style={{ background: 'linear-gradient(135deg, #ec4899, #ef4444, #f59e0b)' }}
            >
              <div className="absolute top-4 right-4">
                <button 
                  onClick={onClose}
                  className="p-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center space-x-3.5 pr-8">
                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md shrink-0 shadow-sm">
                  <Book className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                    {request.subject}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold line-clamp-1 tracking-tight">
                    {request.title}
                  </h2>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center space-x-3.5">
                  <div className="w-12 h-12 bg-pink-500/10 border border-pink-500/20 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                    {dicebearUrl ? (
                      <img src={dicebearUrl} alt={request.anonymous_id} className="w-full h-full object-cover" />
                    ) : (
                      <GraduationCap className="w-6 h-6 text-pink-500" />
                    )}
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Requested by</div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">@{request.anonymous_id}</span>
                      {request.badge_tier && <BadgeDisplay tier={request.badge_tier} size="sm" showLabel={false} />}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Status</div>
                  <div className="flex items-center justify-end text-xs font-bold uppercase tracking-wider text-pink-500">
                    <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse mr-1.5" />
                    {request.status.replace('_', ' ')}
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center">
                    <AlertCircle className="w-3.5 h-3.5 mr-1.5 text-pink-500" />
                    Description & Context
                  </h3>
                  <div className="bg-slate-100/60 dark:bg-white/[0.03] p-4 rounded-2xl border border-slate-200/60 dark:border-white/5">
                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                      {request.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-100/60 dark:bg-white/[0.02] p-3 rounded-xl border border-slate-200/40 dark:border-white/5">
                  <div className="flex items-center font-medium">
                    <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                    Posted {new Date(request.created_at).toLocaleDateString()}
                  </div>
                  <div className="flex items-center font-bold text-emerald-500">
                    <Shield className="w-3.5 h-3.5 mr-1" />
                    Verified Peer Request
                  </div>
                </div>
              </div>

              <div className="mt-7">
                {isHelper && (
                  <button
                    onClick={() => {
                      onOfferHelp(request.id);
                      onClose();
                    }}
                    disabled={request.status !== 'open'}
                    className={`w-full flex items-center justify-center space-x-2.5 py-3.5 rounded-xl font-bold text-sm transition-all ${
                      request.status === 'open'
                        ? 'btn-primary shadow-lg shadow-pink-500/20'
                        : 'bg-slate-200/50 dark:bg-white/5 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>{request.status === 'open' ? 'Offer Peer Assistance' : 'Already Matched'}</span>
                  </button>
                )}
                {!isHelper && (
                  <div className="text-center p-3.5 bg-amber-500/10 rounded-xl border border-amber-500/20">
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                      Only registered helpers can offer help. Register as a helper on your dashboard!
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default RequestDetailModal;
