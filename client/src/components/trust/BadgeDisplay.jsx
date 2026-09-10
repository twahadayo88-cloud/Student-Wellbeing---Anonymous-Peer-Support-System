import React from 'react';
import { Award, Shield, Star, Zap, Trophy, Crown, Medal } from 'lucide-react';
import { motion } from 'framer-motion';

const BADGE_CONFIG = {
  platinum: {
    icon: Crown,
    color: 'text-purple-500 dark:text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    label: 'Platinum Helper',
    description: 'Top 1% Elite contributor'
  },
  gold: {
    icon: Trophy,
    color: 'text-yellow-500 dark:text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    label: 'Gold Helper',
    description: 'Reliable & highly trusted'
  },
  silver: {
    icon: Star,
    color: 'text-slate-400 dark:text-slate-300',
    bg: 'bg-slate-400/10',
    border: 'border-slate-400/30',
    label: 'Silver Helper',
    description: 'Frequent & helpful peer'
  },
  bronze: {
    icon: Medal,
    color: 'text-amber-800 dark:text-amber-700',
    bg: 'bg-amber-800/10',
    border: 'border-amber-800/30',
    label: 'Bronze Member',
    description: 'New community helper'
  }
};

const BadgeDisplay = ({ tier = 'bronze', showLabel = true, size = 'md' }) => {
  const normalizedTier = (tier || 'bronze').toLowerCase();
  const config = BADGE_CONFIG[normalizedTier] || BADGE_CONFIG.bronze;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'p-1 text-xs',
    md: 'p-1.5 text-sm',
    lg: 'p-2.5 text-base'
  };

  const iconSizes = {
    sm: 14,
    md: 18,
    lg: 24
  };

  return (
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-2 rounded-full border ${config.bg} ${config.border} ${sizeClasses[size]} transition-all hover:brightness-110 cursor-help group relative`}
    >
      <Icon size={iconSizes[size]} className={`${config.color}`} />
      {showLabel && (
        <span className={`font-medium ${config.color} capitalize`}>
          {normalizedTier}
        </span>
      )}

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 bg-slate-900 border border-slate-700 text-slate-200 text-xs p-2 rounded shadow-xl z-50">
        <p className="font-bold mb-1 text-white">{config.label}</p>
        <p className="opacity-80">{config.description}</p>
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900"></div>
      </div>
    </motion.div>
  );
};

export default BadgeDisplay;
