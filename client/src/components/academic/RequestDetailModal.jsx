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

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden border border-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header / Banner */}
            <div className={`h-32 ${urgencyColors[request.urgency]} relative overflow-hidden flex items-end p-6`}>
                <div className="absolute top-0 right-0 p-4">
                    <button 
                        onClick={onClose}
                        className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex items-center space-x-3 text-white">
                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                        <Book className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-xs font-bold uppercase tracking-widest opacity-80">{request.subject}</div>
                        <h2 className="text-2xl font-bold line-clamp-1">{request.title}</h2>
                    </div>
                </div>
            </div>

            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Requested by</div>
                    <div className="flex items-center space-x-2">
                        <span className="font-mono text-sm font-bold text-gray-900 dark:text-white">@{request.anonymous_id}</span>
                        {request.badge_tier && <BadgeDisplay tier={request.badge_tier} size="xs" showLabel={false} />}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase mb-1">Status</div>
                  <div className="flex items-center justify-end text-sm font-bold text-indigo-600 dark:text-indigo-400">
                    <div className="w-2 h-2 rounded-full bg-current animate-pulse mr-2" />
                    {request.status.replace('_', ' ')}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-2 text-indigo-500" />
                        Description
                    </h3>
                    <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                            {request.description}
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 bg-indigo-50/50 dark:bg-indigo-900/10 p-3 rounded-xl">
                    <div className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        Posted {new Date(request.created_at).toLocaleDateString()}
                    </div>
                    <div className="flex items-center">
                        <Shield className="w-3 h-3 mr-1 text-green-500" />
                        Verified Request
                    </div>
                </div>
              </div>

              <div className="mt-8">
                {isHelper && (
                  <button
                    onClick={() => {
                        onOfferHelp(request.id);
                        onClose();
                    }}
                    disabled={request.status !== 'open'}
                    className={`w-full flex items-center justify-center space-x-3 py-4 rounded-2xl font-bold text-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] ${
                      request.status === 'open'
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-xl shadow-indigo-200 dark:shadow-none'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <MessageSquare className="w-6 h-6" />
                    <span>{request.status === 'open' ? 'Offer Professional Help' : 'Already Matched'}</span>
                  </button>
                )}
                {!isHelper && (
                    <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-900/20">
                        <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                            Only registered helpers can offer help. Register as a helper on the dashboard to contribute!
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
