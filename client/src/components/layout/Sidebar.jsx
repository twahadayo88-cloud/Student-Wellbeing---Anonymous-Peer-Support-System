import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { useSocket } from '../../context/SocketContext';
import { ShieldIcon, AlertIcon, BellIcon, AcademicIcon, BoardIcon, BookIcon, HeartIcon, TrophyIcon, GridIcon, ChatIcon, UserIcon } from './icons.jsx';

/**
 * Sidebar — sticky left navigation for the app.
 * Mirrors the top Navbar links but in a vertical layout.
 * Uses glassmorphism background and gradient hover effects.
 */
export default function Sidebar({ incomingCount = 0 }) {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const location = useLocation();

  // ─── Real-time live counts & profile from dashboard:init socket data ───
  const [liveStats, setLiveStats] = useState({
    myId: null,
    badgeTier: null,
  });

  useEffect(() => {
    if (!socket || !isConnected) return;
    socket.emit('dashboard:init');

    const onDashboardData = (data) => {
      setLiveStats({
        myId: data.anonymous_id || null,
        badgeTier: data.badge_tier || null,
      });
    };

    const onConversationRefresh = () => socket.emit('dashboard:init');

    socket.on('dashboard:data', onDashboardData);
    socket.on('conversation:refresh', onConversationRefresh);

    return () => {
      socket.off('dashboard:data', onDashboardData);
      socket.off('conversation:refresh', onConversationRefresh);
    };
  }, [socket, isConnected]);

  const isActive = (path) => {
    const [pathname, query] = path.split('?');
    return location.pathname === pathname &&
      (query ? location.search === `?${query}` : !location.search);
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isFaculty = user?.role === 'faculty';

  const links = isAdmin
    ? [
        { to: '/admin', label: 'Admin Panel', icon: ShieldIcon },
        { to: '/complaint-review', label: 'Escalated', icon: AlertIcon },
        { to: '/announcements', label: 'Announcements', icon: BellIcon },
        { to: '/notices', label: 'Community', icon: BoardIcon },
      ]
    : isFaculty
    ? [
        { to: '/dashboard', label: 'Dashboard', icon: GridIcon },
        { to: '/announcements', label: 'Announcements', icon: BellIcon },
        { to: '/academic', label: 'Academic', icon: AcademicIcon },
        { to: '/notices', label: 'Community', icon: BoardIcon },
        { to: '/resources', label: 'Resources', icon: BookIcon },
        { to: '/complaint-review', label: 'Complaints', icon: AlertIcon },
      ]
    : [
        { to: '/dashboard', label: 'Dashboard', icon: GridIcon },
        { to: '/dashboard?view=requests', label: 'Chat Requests', icon: BellIcon, badge: incomingCount },
        { to: '/chat', label: 'Messages', icon: ChatIcon },
        { to: '/announcements', label: 'Announcements', icon: BellIcon },
        { to: '/academic', label: 'Academic Board', icon: AcademicIcon },
        { to: '/notices', label: 'Community Board', icon: BoardIcon },
        { to: '/resources', label: 'Resources', icon: BookIcon },
        { to: '/complaints', label: 'Complaints', icon: AlertIcon },
        { to: '/mood', label: 'Mood', icon: HeartIcon },
        { to: '/leaderboard', label: 'Leaderboard', icon: TrophyIcon },
        { to: '/profile', label: 'My Profile', icon: UserIcon },
      ];

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-16 flex-col border-r border-slate-200 bg-white/90 backdrop-blur-xl dark:border-white/5 dark:bg-[#111118]/95 sm:w-64">
      {/* Logo at top-left */}
      <Link
        to="/dashboard"
        aria-label="PeerBridge dashboard"
        className="group relative flex h-16 shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 text-white shadow-lg shadow-pink-500/20"
      >
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <span className="relative text-center transition duration-300 group-hover:scale-105">
          <span className="block text-sm font-black leading-tight tracking-[0.12em]">PEERBRIDGE</span>
          <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.22em] text-white/80">Connect &amp; grow</span>
        </span>
        <span className="sr-only">PeerBridge</span>
      </Link>
      <nav className="mt-4 flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-2 sm:px-3">
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            title={link.label}
            className={`relative flex items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-sm font-medium transition-colors sm:justify-start sm:px-3 ${
              isActive(link.to)
                ? 'bg-gradient-to-r from-pink-500 to-amber-500 text-white shadow-md shadow-pink-500/30'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/30 dark:hover:text-white'
            }`}
          >
            {link.icon && <link.icon size={16} className="shrink-0" />}
            <span className="hidden flex-1 sm:inline">{link.label}</span>
            {link.badge > 0 && (
              <span className="absolute right-0 top-0 flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 py-0.5 text-[9px] font-bold leading-none text-white sm:static sm:min-w-5 sm:px-1.5 sm:text-[10px]">
                {link.badge}
              </span>
            )}
          </Link>
        )    )}
          </nav>

          {/* Live user identity + badge tier (real-time from dashboard:data) */}
          {liveStats.myId && (
            <div className="mx-2 mb-3 rounded-lg border border-slate-200/70 bg-white/60 px-2.5 py-2 dark:border-white/5 dark:bg-white/[0.03]">
              <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">My ID</p>
              <p className="truncate font-mono text-[11px] font-bold text-pink-500" title={liveStats.myId}>
                {liveStats.myId}
              </p>
              {liveStats.badgeTier && (
                <div className="mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-pink-500 to-amber-500" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {String(liveStats.badgeTier).toLowerCase()} tier
                  </span>
                </div>
              )}
            </div>
          )}
        </aside>
  );
}
