import { ShieldCheck } from 'lucide-react';

/**
 * PageHeader — standardized global page header across all student screens.
 * Ensures consistent width, height, margin, and padding. Wrap it inside
 * a `max-w-5xl mx-auto w-full` container along with the page content.
 *
 * Props:
 *  - title: main heading text (node)
 *  - subtitle: optional small text under the title
 *  - myId: live anonymous_id of the logged-in user (renders "MY ID" badge)
 *  - actions: optional right-side control nodes (buttons, toggles...)
 */
export default function PageHeader({ title, subtitle, myId, actions, tone = 'dark' }) {
  const isDark = tone === 'dark';
  return (
    <header className="flex justify-between items-center mb-6 pt-2 gap-4">
      <div className="min-w-0">
        <h1 className={`text-2xl font-extrabold tracking-tight truncate ${isDark ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
          {title}
        </h1>
        <p className={`text-xs flex items-center gap-1.5 mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500 dark:text-slate-400'}`}>
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          {subtitle || 'Trust-Based Secure Dashboard'}
        </p>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {actions}
        {myId && (
          <span className="bg-slate-900 border border-pink-500/30 px-3.5 py-1.5 rounded-xl text-xs font-mono text-pink-400 shadow-md whitespace-nowrap">
            MY ID: {myId}
          </span>
        )}
      </div>
    </header>
  );
}
