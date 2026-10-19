import React from 'react';
import { Award, Shield, Star, Zap, Trophy, Crown, Medal } from 'lucide-react';
import { motion } from 'framer-motion';

const BADGE_CONFIG = {
  platinum: {
    icon: Crown,
    color: 'text-purple-400 dark:text-purple-300',
    bg: 'bg-purple-500/10 dark:bg-purple-500/15',
    border: 'border-purple-500/30 dark:border-purple-500/40',
    shadow: 'shadow-purple-500/20',
    label: 'Platinum Helper',
    description: 'Top 1% Elite contributor'
  },
  gold: {
    icon: Trophy,
    color: 'text-amber-500 dark:text-amber-300',
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    border: 'border-amber-500/30 dark:border-amber-500/40',
    shadow: 'shadow-amber-500/20',
    label: 'Gold Helper',
    description: 'Reliable & highly trusted'
  },
  silver: {
    icon: Star,
    color: 'text-slate-500 dark:text-slate-300',
    bg: 'bg-slate-400/10 dark:bg-slate-400/15',
    border: 'border-slate-400/30 dark:border-slate-400/40',
    shadow: 'shadow-slate-500/10',
    label: 'Silver Helper',
    description: 'Frequent & helpful peer'
  },
  bronze: {
    icon: Medal,
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-600/10 dark:bg-orange-600/15',
    border: 'border-orange-600/30 dark:border-orange-600/40',
    shadow: 'shadow-orange-500/10',
    label: 'Bronze Member',
    description: 'New community helper'
  }
};

const BadgeDisplay = ({ tier = 'bronze', showLabel = true, size = 'md' }) => {
  const normalizedTier = (tier || 'bronze').toLowerCase();
  const config = BADGE_CONFIG[normalizedTier] || BADGE_CONFIG.bronze;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs font-mono',
    md: 'px-2.5 py-1 text-xs font-medium',
    lg: 'px-3.5 py-1.5 text-sm font-medium'
  };

  const iconSizes = {
    sm: 12,
    md: 15,
    lg: 20
  };

  return (
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-1.5 rounded-full border backdrop-blur-md shadow-sm ${config.bg} ${config.border} ${config.shadow} ${sizeClasses[size]} transition-all hover:scale-105 cursor-help group relative`}
    >
      <Icon size={iconSizes[size]} className={`${config.color} shrink-0`} />
      {showLabel && (
        <span className={`${config.color} capitalize tracking-wide font-semibold`}>
          {normalizedTier}
        </span>
      )}

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 bg-[#111118]/95 dark:bg-[#111118]/95 border border-white/10 text-slate-200 text-xs p-2.5 rounded-xl shadow-2xl backdrop-blur-md z-50 pointer-events-none">
        <p className="font-bold mb-0.5 text-white flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span>
          {config.label}
        </p>
        <p className="text-slate-400 text-[11px] leading-relaxed">{config.description}</p>
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#111118]"></div>
      </div>
    </motion.div>
  );
};

export default BadgeDisplay;
