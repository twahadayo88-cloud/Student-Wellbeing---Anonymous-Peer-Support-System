import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useContext, useState, useRef, useEffect } from 'react';
import { ThemeContext } from '../../context/ThemeContext';
import useAuth from '../../hooks/useAuth';

/**
 * Navbar — premium top navigation bar with glassmorphism,
 * profile avatar dropdown, mobile menu, and active-link indicators.
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

  // Get user initials for avatar (from anonymous_id only — privacy-first)
  const getInitials = () => {
    if (user?.anonymous_id) {
      return user.anonymous_id.slice(0, 2).toUpperCase();
    }
    return 'PB';
  };

  // Check if a link is active
  const isActive = (path) => {
    if (path.includes('?')) {
      const [basePath, query] = path.split('?');
      return location.pathname === basePath && location.search === `?${query}`;
    }
    return location.pathname === path && !location.search;
  };

  // Nav link classes
  const navLinkClass = (path) =>
    `relative px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
      isActive(path)
        ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30'
        : 'text-surface-600 dark:text-surface-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-surface-100 dark:hover:bg-surface-800/60'
    }`;

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isStudent = user?.role === 'student';
  const isFaculty = user?.role === 'faculty';

  const authenticatedLinks = isAdmin 
    ? [
        { to: '/admin', label: 'Admin Panel', id: 'nav-admin' },
        { to: '/complaint-review', label: 'Escalated Complaints', id: 'nav-complaint-review' },
        { to: '/notices', label: 'Notice Board', id: 'nav-notices' },
      ]
    : [
        { to: '/dashboard', label: 'Dashboard', id: 'nav-dashboard' },
        { to: '/chat', label: 'Messages', id: 'nav-chat' },
        { to: '/leaderboard', label: 'Leaderboard', id: 'nav-leaderboard' },
        { to: '/chat?tab=academic', label: 'Academic Board', id: 'nav-academic' },
        ...(isStudent ? [
          { to: '/mood',       label: '😊 Mood',       id: 'nav-mood' },
          { to: '/complaints', label: '🚩 Complaints', id: 'nav-complaints' },
          { to: '/resources',  label: 'Resources',     id: 'nav-resources' },
          { to: '/notices', label: 'Notice Board', id: 'nav-notices' },
        ] : []),
        ...(isFaculty ? [
          { to: '/complaint-review', label: 'Faculty Complaints', id: 'nav-complaint-review' },
          { to: '/resources', label: 'Resource Review', id: 'nav-resources' },
          { to: '/notices', label: 'Notice Board', id: 'nav-notices' },
        ] : [])
      ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 dark:border-surface-800/60 bg-white/70 dark:bg-surface-950/70 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* ─── Logo ─── */}
          <Link to="/" className="flex items-center gap-2.5 group" id="nav-logo">
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 via-primary-600 to-accent-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-primary-500/25 group-hover:shadow-primary-500/40 transition-shadow duration-300">
              PB
              {/* Shine effect */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-white/0 via-white/20 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <span className="text-lg font-bold text-surface-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors duration-200">
              PeerBridge
            </span>
          </Link>

          {/* ─── Desktop Nav ─── */}
          <div className="hidden md:flex items-center gap-1.5">
            {isAuthenticated ? (
              <>
                {/* Nav Links */}
                {authenticatedLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    id={link.id}
                    className={navLinkClass(link.to)}
                  >
                    {link.label}
                  </Link>
                ))}

                {/* Divider */}
                <div className="w-px h-6 bg-surface-200 dark:bg-surface-700 mx-2" />

                {/* Theme Toggle */}
                <button
                  id="theme-toggle"
                  onClick={toggleTheme}
                  className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-all duration-200"
                  aria-label="Toggle theme"
                >
                  {isDark ? (
                    <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-surface-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                    </svg>
                  )}
                </button>

                {/* ─── Profile Avatar + Dropdown ─── */}
                <div className="relative ml-1" ref={profileRef}>
                  <button
                    id="nav-profile-avatar"
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 p-1 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 transition-all duration-200 group"
                    aria-label="Profile menu"
                    aria-expanded={profileOpen}
                  >
                    {/* Avatar Circle */}
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-xs font-bold shadow-md ring-2 ring-white dark:ring-surface-900 group-hover:ring-primary-200 dark:group-hover:ring-primary-800 transition-all duration-200">
                      {getInitials()}
                    </div>
                    {/* Chevron */}
                    <svg
                      className={`w-4 h-4 text-surface-400 transition-transform duration-200 ${
                        profileOpen ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown */}
                  {profileOpen && (
                    <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 shadow-2xl shadow-surface-900/10 dark:shadow-black/30 overflow-hidden animate-fade-in origin-top-right">
                      {/* User Info Header */}
                      <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-800 bg-surface-50 dark:bg-surface-800/50">
                        <p className="text-sm font-semibold text-surface-900 dark:text-white truncate">
                          Anonymous User
                        </p>
                        <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5 truncate font-mono">
                          {user?.anonymous_id || '—'}
                        </p>
                        {user?.role && (
                          <span className={`inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            user.role === 'faculty' || user.role === 'admin'
                              ? 'bg-accent-100 dark:bg-accent-900/40 text-accent-600 dark:text-accent-400'
                              : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {user.role}
                          </span>
                        )}
                      </div>

                      {/* Menu Items */}
                      <div className="py-1.5">
                        <Link
                          to="/profile"
                          id="nav-profile"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors duration-150"
                          onClick={() => setProfileOpen(false)}
                        >
                          <svg className="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          My Profile
                        </Link>
                        {!isAdmin && (
                          <Link
                            to="/dashboard"
                            id="nav-dropdown-dashboard"
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors duration-150"
                            onClick={() => setProfileOpen(false)}
                          >
                            <svg className="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                            Dashboard
                          </Link>
                        )}
                      </div>

                      {/* Logout */}
                      <div className="border-t border-surface-100 dark:border-surface-800 py-1.5">
                        <button
                          id="nav-logout"
                          onClick={handleLogout}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-150"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Theme Toggle (unauthenticated) */}
                <button
                  id="theme-toggle"
                  onClick={toggleTheme}
                  className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-all duration-200"
                  aria-label="Toggle theme"
                >
                  {isDark ? (
                    <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-surface-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                    </svg>
                  )}
                </button>

                {/* Auth Buttons */}
                <Link
                  to="/login"
                  id="nav-login"
                  className="text-sm font-medium text-surface-600 dark:text-surface-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors px-3 py-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  id="nav-register"
                  className="btn-primary text-sm py-2 px-5 shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 transition-shadow"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* ─── Mobile Menu Button ─── */}
          <div className="flex items-center gap-2 md:hidden">
            {/* Theme Toggle (mobile) */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              aria-label="Toggle theme"
            >
              {isDark ? (
                <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-surface-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>

            {/* Hamburger / Close */}
            <button
              id="mobile-menu-toggle"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              aria-label="Toggle mobile menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? (
                <svg className="w-6 h-6 text-surface-700 dark:text-surface-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-surface-700 dark:text-surface-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ─── Mobile Menu Panel ─── */}
      {mobileOpen && (
        <div className="md:hidden border-t border-surface-200 dark:border-surface-800 bg-white/95 dark:bg-surface-950/95 backdrop-blur-xl animate-slide-down">
          <div className="px-4 py-4 space-y-1">
            {isAuthenticated ? (
              <>
                {/* Mobile Profile Header */}
                <div className="flex items-center gap-3 px-3 py-3 mb-2 rounded-xl bg-surface-50 dark:bg-surface-800/50">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-sm font-bold shadow-md">
                    {getInitials()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-surface-900 dark:text-white truncate">
                      Anonymous User
                    </p>
                    <p className="text-xs text-surface-500 dark:text-surface-400 truncate font-mono">
                      {user?.anonymous_id || '—'}
                    </p>
                  </div>
                </div>

                {/* Mobile Nav Links */}
                {!isAdmin && (
                  <>
                    <Link
                      to="/dashboard"
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        isActive('/dashboard')
                          ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30'
                          : 'text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                      Dashboard
                    </Link>

                    <Link
                      to="/leaderboard"
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        isActive('/leaderboard')
                          ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30'
                          : 'text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3l3.057-3L12 3.5 15.943 0 19 3v18H5V3z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 0v4m0-4h4m-4 0H8" />
                      </svg>
                      Leaderboard
                    </Link>

                    <Link
                      to="/chat?tab=academic"
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        isActive('/chat?tab=academic')
                          ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30'
                          : 'text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5z" />
                        <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                      </svg>
                      Academic Board
                    </Link>
                  </>
                )}

                <Link
                  to="/profile"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive('/profile')
                      ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30'
                      : 'text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  My Profile
                </Link>

                {/* Divider + Logout */}
                <div className="pt-2 mt-2 border-t border-surface-200 dark:border-surface-800">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="block px-3 py-2.5 rounded-xl text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  className="block px-3 py-2.5 rounded-xl text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 transition-colors text-center"
                >
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
