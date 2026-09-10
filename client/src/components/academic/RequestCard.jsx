import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Book, AlertCircle, CheckCircle, MessageSquare } from 'lucide-react';
import BadgeDisplay from '../trust/BadgeDisplay';

const RequestCard = ({ request, onOfferHelp, onViewDetail, isHelper }) => {
  const urgencyColors = {
    low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse'
  };

  const statusColors = {
    open: 'text-blue-500',
    matched: 'text-yellow-500',
    in_progress: 'text-purple-500',
    resolved: 'text-green-500',
    closed: 'text-gray-500'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5, scale: 1.02 }}
      onClick={() => onViewDetail(request)}
      className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all cursor-pointer group"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center space-x-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wider ${urgencyColors[request.urgency]}`}>
            {request.urgency}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
            <Clock className="w-3 h-3 mr-1" />
            {new Date(request.created_at).toLocaleDateString()}
          </span>
        </div>
        <div className={`flex items-center text-xs font-semibold uppercase ${statusColors[request.status]}`}>
          {request.status.replace('_', ' ')}
        </div>
      </div>

      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 line-clamp-1">
        {request.title}
      </h3>
      
      <div className="flex items-center text-sm text-indigo-600 dark:text-indigo-400 mb-3 font-medium">
        <Book className="w-4 h-4 mr-1" />
        {request.subject}
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 line-clamp-3">
        {request.description}
      </p>

      <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-gray-700">
        <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
            @{request.anonymous_id}
          </span>
          {request.badge_tier && (
            <BadgeDisplay tier={request.badge_tier} size="xs" showLabel={false} />
          )}
        </div>

        {isHelper && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOfferHelp(request.id);
            }}
            disabled={request.status !== 'open'}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              request.status === 'open' 
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                : 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>{request.status === 'open' ? 'Offer Help' : 'Matched'}</span>
          </button>
        )}

        {request.status === 'resolved' && (
          <div className="flex items-center text-green-500 text-sm font-medium">
            <CheckCircle className="w-4 h-4 mr-1" />
            Resolved
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default RequestCard;
