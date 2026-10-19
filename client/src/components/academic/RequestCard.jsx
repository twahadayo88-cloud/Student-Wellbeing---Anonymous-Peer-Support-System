import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Book, AlertCircle, CheckCircle, MessageSquare } from 'lucide-react';
import BadgeDisplay from '../trust/BadgeDisplay';

const RequestCard = ({ request, onOfferHelp, onViewDetail, isHelper }) => {
  const urgencyBadges = {
    low: 'badge-active',
    medium: 'bg-sky-500/10 text-sky-500 border border-sky-500/20',
    high: 'badge-pending',
    critical: 'badge-error animate-pulse'
  };

  const statusColors = {
    open: 'text-emerald-500',
    matched: 'text-amber-500',
    in_progress: 'text-purple-400',
    resolved: 'text-emerald-400',
    closed: 'text-slate-500'
  };

  const dicebearUrl = request?.anonymous_id
    ? `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(request.anonymous_id)}&backgroundColor=transparent`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      onClick={() => onViewDetail(request)}
      className="glass-card p-6 rounded-2xl hover:border-pink-500/40 hover:shadow-glow-pink transition-all cursor-pointer group flex flex-col justify-between"
    >
      <div>
        <div className="flex justify-between items-start mb-3.5">
          <div className="flex items-center space-x-2">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${urgencyBadges[request.urgency] || urgencyBadges.low}`}>
              {request.urgency}
            </span>
            <span className="text-xs text-slate-400 flex items-center font-medium">
              <Clock className="w-3 h-3 mr-1 text-slate-400" />
              {new Date(request.created_at).toLocaleDateString()}
            </span>
          </div>
          <div className={`flex items-center text-xs font-bold uppercase tracking-wider ${statusColors[request.status]}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5"></span>
            {request.status.replace('_', ' ')}
          </div>
        </div>

        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-1.5 line-clamp-1 group-hover:text-pink-500 transition-colors">
          {request.title}
        </h3>
        
        <div className="flex items-center text-xs text-pink-600 dark:text-pink-400 mb-3 font-semibold">
          <Book className="w-3.5 h-3.5 mr-1.5 shrink-0" />
          <span>{request.subject}</span>
        </div>

        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mb-5 line-clamp-3 leading-relaxed">
          {request.description}
        </p>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
        <div className="flex items-center space-x-2 text-xs">
          <div className="w-6 h-6 rounded-lg bg-pink-500/10 border border-pink-500/20 overflow-hidden flex items-center justify-center shrink-0">
            {dicebearUrl ? (
              <img src={dicebearUrl} alt={request.anonymous_id} className="w-full h-full object-cover" />
            ) : (
              <span className="font-mono text-[9px] text-pink-500">PB</span>
            )}
          </div>
          <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold text-xs">
            @{request.anonymous_id}
          </span>
          {request.badge_tier && (
            <BadgeDisplay tier={request.badge_tier} size="sm" showLabel={false} />
          )}
        </div>

        {isHelper && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOfferHelp(request.id);
            }}
            disabled={request.status !== 'open'}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              request.status === 'open' 
                ? 'btn-primary' 
                : 'bg-slate-200/50 text-slate-400 cursor-not-allowed dark:bg-white/5'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{request.status === 'open' ? 'Offer Help' : 'Matched'}</span>
          </button>
        )}

        {request.status === 'resolved' && (
          <div className="flex items-center text-emerald-500 text-xs font-bold">
            <CheckCircle className="w-3.5 h-3.5 mr-1" />
            Resolved
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default RequestCard;
