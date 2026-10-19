import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useContext, useState, useRef, useEffect } from 'react';
import { ThemeContext } from '../../context/ThemeContext';
import useAuth from '../../hooks/useAuth';

/** DiceBear Notionists avatar URL generator */
const dicebearUrl = (seed) =>
  `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(seed || 'PeerBridge')}&backgroundColor=transparent`;

/**
 * Navbar — premium top navigation bar with brand gradient identity,
 * DiceBear avatar, glassmorphism, and dark/light mode toggle.
 */
export default function Navbar() {
  const { isDark, toggleTheme } = useContext(ThemeContext);
  const { isAuthenticated, logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const profileRef = useRef(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    setProfileOpen(false);
    navigate('/');
  };

  // Seed for avatar
  const avatarSeed = user?.anonymous_id || 'PeerBridge';

  // Check if a link is active
  const isActive = (path) => {
    if (path.includes('?')) {
      const [basePath, query] = path.split('?');
      return location.pathname === basePath && location.search === `?${query}`;
    }
    return location.pathname === path && !location.search;
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isStudent = user?.role === 'student';
  const isFaculty = user?.role === 'faculty';

  const authenticatedLinks = isAdmin
    ? [
      { to: '/admin', label: 'Admin Panel', id: 'nav-admin', icon: ShieldIcon },
      { to: '/complaint-review', label: 'Escalated', id: 'nav-complaint-review', icon: AlertIcon },
      { to: '/announcements', label: 'Announcements', id: 'nav-announcements', icon: BellIcon },
      { to: '/notices', label: 'Community', id: 'nav-notices', icon: BoardIcon },
    ]
    : isFaculty
      ? [
        { to: '/dashboard', label: 'Dashboard', id: 'nav-dashboard', icon: GridIcon },
        { to: '/announcements', label: 'Announcements', id: 'nav-announcements', icon: BellIcon },
        { to: '/academic', label: 'Academic', id: 'nav-academic', icon: AcademicIcon },
        { to: '/notices', label: 'Community', id: 'nav-notices', icon: BoardIcon },
        { to: '/resources', label: 'Resources', id: 'nav-resources', icon: BookIcon },
        { to: '/complaint-review', label: 'Complaints', id: 'nav-complaint-review', icon: AlertIcon },
      ]
      : [
        { to: '/dashboard', label: 'Dashboard', id: 'nav-dashboard', icon: GridIcon },
        { to: '/chat', label: 'Messages', id: 'nav-chat', icon: ChatIcon },
        { to: '/announcements', label: 'Announcements', id: 'nav-announcements', icon: BellIcon },
        { to: '/academic', label: 'Academic', id: 'nav-academic', icon: AcademicIcon },
        { to: '/notices', label: 'Community', id: 'nav-notices', icon: BoardIcon },
        { to: '/resources', label: 'Resources', id: 'nav-resources', icon: BookIcon },
        { to: '/mood', label: 'Mood', id: 'nav-mood', icon: HeartIcon },
        { to: '/leaderboard', label: 'Leaderboard', id: 'nav-leaderboard', icon: TrophyIcon },
      ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/8 dark:border-white/5 bg-white/80 dark:bg-[#09090e]/80 backdrop-blur-xl">
      {/* Top brand accent line */}
      <div className="h-[1.5px] w-full bg-gradient-to-r from-transparent via-pink-500 to-transparent opacity-60" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-15 py-3">

          {/* ─── Logo ─── */}
          <Link to="/" className="flex items-center gap-2.5 group" id="nav-logo">
            <div className="relative w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center text-white font-black text-sm shadow-brand group-hover:shadow-brand-lg transition-all duration-300"
              style={{ background: 'linear-gradient(135deg, #ec4899, #ef4444, #f59e0b)' }}>
              PB
              <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <span className="text-lg font-black text-slate-900 dark:text-white group-hover:text-transparent group-hover:bg-clip-text transition-all duration-300"
              style={{ '--hover-gradient': 'linear-gradient(135deg, #ec4899, #ef4444, #f59e0b)' }}>
              <span className="group-hover:brand-text">PeerBridge</span>
            </span>
          </Link>

          {/* ─── Desktop Nav ─── */}
          <div className="hidden lg:flex items-center gap-1">
            {isAuthenticated ? (
              <>
                {authenticatedLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    id={link.id}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                      isActive(link.to)
                        ? 'text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/6'
                    }`}
                    style={isActive(link.to) ? {
                      background: 'linear-gradient(135deg, #ec4899, #ef4444, #f59e0b)',
                      boxShadow: '0 2px 12px rgba(236,72,153,0.3)'
                    } : {}}
                  >
                    {link.icon && <link.icon size={13} />}
                    {link.label}
                  </Link>
                ))}

                {/* Divider */}
                <div className="w-px h-5 bg-slate-200 dark:bg-white/10 mx-1.5" />

                {/* Theme Toggle */}
                <ThemeToggleBtn isDark={isDark} toggleTheme={toggleTheme} />

                {/* ─── Profile Avatar + Dropdown ─── */}
                <div className="relative ml-1" ref={profileRef}>
                  <button
                    id="nav-profile-avatar"
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-white/6 transition-all duration-200 group"
                    aria-label="Profile menu"
                    aria-expanded={profileOpen}
                  >
                    {/* DiceBear Avatar */}
                    <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-transparent group-hover:ring-pink-500/40 transition-all duration-200 bg-gradient-to-br from-pink-500 to-amber-500">
                      <img
                        src={dicebearUrl(avatarSeed)}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                    {/* Chevron */}
                    <svg
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown */}
                  {profileOpen && (
                    <div className="absolute right-0 mt-2 w-64 rounded-2xl overflow-hidden animate-fade-in origin-top-right"
                      style={{
                        background: isDark ? 'rgba(13,13,20,0.95)' : 'rgba(255,255,255,0.95)',
                        backdropFilter: 'blur(24px)',
                        border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(226,232,240,0.8)',
                        boxShadow: isDark
                          ? '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(236,72,153,0.1)'
                          : '0 20px 60px rgba(0,0,0,0.12)',
                      }}>
                      {/* User Info Header */}
                      <div className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-white/6">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-pink-500 to-amber-500 flex-shrink-0">
                            <img
                              src={dicebearUrl(avatarSeed)}
                              alt="Avatar"
                              className="w-full h-full object-cover"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 dark:text-white">Anonymous User</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
                              {user?.anonymous_id || '—'}
                            </p>
                          </div>
                        </div>
                        {user?.role && (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                            user.role === 'faculty' || user.role === 'admin' || user.role === 'super_admin'
                              ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {user.role}
                          </span>
                        )}
                      </div>

                      {/* Menu Items */}
                      <div className="py-1.5">
                        <Link
                          to="/profile"
                          id="nav-profile"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                          onClick={() => setProfileOpen(false)}
                        >
                          <UserIcon size={15} className="text-slate-400" />
                          My Profile
                        </Link>
                        {!isAdmin && (
                          <Link
                            to="/dashboard"
                            id="nav-dropdown-dashboard"
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                            onClick={() => setProfileOpen(false)}
                          >
                            <GridIcon size={15} className="text-slate-400" />
                            Dashboard
                          </Link>
                        )}
                      </div>

                      {/* Logout */}
                      <div className="border-t border-slate-100 dark:border-white/6 py-1.5">
                        <button
                          id="nav-logout"
                          onClick={handleLogout}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/8 transition-colors"
                        >
                          <LogoutIcon size={15} />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <ThemeToggleBtn isDark={isDark} toggleTheme={toggleTheme} />
                <Link
                  to="/login"
                  id="nav-login"
                  className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors px-4 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/6"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  id="nav-register"
                  className="btn-primary text-sm py-2 px-5"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* ─── Mobile Controls ─── */}
          <div className="flex items-center gap-2 lg:hidden">
            <ThemeToggleBtn isDark={isDark} toggleTheme={toggleTheme} />
            <button
              id="mobile-menu-toggle"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/6 transition-colors"
              aria-label="Toggle mobile menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? (
                <svg className="w-5 h-5 text-slate-700 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-slate-700 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ─── Mobile Menu Panel ─── */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-200 dark:border-white/6 animate-slide-down"
          style={{
            background: isDark ? 'rgba(9,9,14,0.97)' : 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(20px)',
          }}>
          <div className="px-4 py-4 space-y-1 max-h-[80vh] overflow-y-auto">
            {isAuthenticated ? (
              <>
                {/* Mobile Profile Header */}
                <div className="flex items-center gap-3 p-3 mb-3 rounded-2xl"
                  style={{ background: isDark ? 'rgba(17,17,24,0.6)' : 'rgba(248,250,252,1)', border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(226,232,240,0.8)' }}>
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-pink-500 to-amber-500 flex-shrink-0">
                    <img src={dicebearUrl(avatarSeed)} alt="Avatar" className="w-full h-full object-cover"
                      onError={(e) => { e.target.style.display = 'none'; }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">Anonymous User</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">{user?.anonymous_id || '—'}</p>
                    {user?.role && (
                      <span className={`inline-flex items-center gap-1 mt-0.5 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        user.role === 'faculty' || user.role === 'admin'
                          ? 'bg-purple-500/15 text-purple-500 dark:text-purple-400'
                          : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {user.role}
                      </span>
                    )}
                  </div>
                </div>

                {/* Mobile Nav Links */}
                {authenticatedLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      isActive(link.to) ? 'text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/6'
                    }`}
                    style={isActive(link.to) ? { background: 'linear-gradient(135deg, #ec4899, #ef4444, #f59e0b)' } : {}}
                  >
                    {link.icon && <link.icon size={16} />}
                    {link.label}
                  </Link>
                ))}

                <Link to="/profile"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isActive('/profile') ? 'text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/6'
                  }`}
                  style={isActive('/profile') ? { background: 'linear-gradient(135deg, #ec4899, #ef4444, #f59e0b)' } : {}}>
                  <UserIcon size={16} />
                  My Profile
                </Link>

                <div className="pt-2 mt-2 border-t border-slate-200 dark:border-white/8">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/8 transition-colors"
                  >
                    <LogoutIcon size={16} />
                    Sign Out
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="block px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/6 transition-colors">
                  Log In
                </Link>
                <Link to="/register" className="btn-primary block text-center py-2.5 px-4 text-sm rounded-xl">
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

/* ─── Theme Toggle Button ─── */
function ThemeToggleBtn({ isDark, toggleTheme }) {
  return (
    <button
      id="theme-toggle"
      onClick={toggleTheme}
      className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/6 transition-all duration-200 group"
      aria-label="Toggle theme"
    >
      {isDark ? (
        <svg className="w-4 h-4 text-amber-400 group-hover:rotate-12 transition-transform duration-300" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-slate-500 group-hover:-rotate-12 transition-transform duration-300" fill="currentColor" viewBox="0 0 20 20">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      )}
    </button>
  );
}

/* ─── Inline Icon Components ─── */
function GridIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}
function ChatIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}
function BellIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}
function AcademicIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5z" />
      <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
    </svg>
  );
}
function BoardIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
    </svg>
  );
}
function BookIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}
function HeartIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function TrophyIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  );
}
function ShieldIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}
function AlertIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}
function UserIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
function LogoutIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}
