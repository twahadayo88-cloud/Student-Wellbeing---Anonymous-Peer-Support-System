import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import api from '../services/api';
import useAuth from '../hooks/useAuth';

/**
 * Login Page — premium authentication form with brand design.
 */
export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState(() => {
    const saved = sessionStorage.getItem('auth_error');
    if (saved) { sessionStorage.removeItem('auth_error'); return saved; }
    return null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const response = await api.post('/auth/login', {
        email: formData.email,
        password: formData.password,
      });
      if (response.data.success) {
        const { user, token } = response.data.data;
        login(user, token);
        if (user.role === 'admin' || user.role === 'super_admin') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#09090e] px-4 pt-16">
        <div className="absolute inset-0 bg-[#09090e]" />
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-90 motion-reduce:hidden"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        >
          <source src="/signin_and_login.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/30 via-slate-950/25 to-purple-950/35" />
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="orb orb-pink w-80 h-80 top-1/4 right-1/4 opacity-40" />
          <div className="orb orb-red w-64 h-64 bottom-1/4 left-1/4 opacity-30" style={{ animationDelay: '3s' }} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full max-w-md"
        >
          <div className="glass-card p-8 sm:p-10">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center text-white font-black text-lg shadow-brand"
                style={{ background: 'linear-gradient(135deg, #ec4899, #ef4444, #f59e0b)' }}>
                PB
              </div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">Welcome back</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5">
                Sign in to your PeerBridge account
              </p>
            </div>

            {/* Error alert */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-5 p-3.5 rounded-xl text-sm flex items-center gap-2.5"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label htmlFor="login-email" className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Email
                </label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="you@university.edu"
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="login-password" className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Password
                  </label>
                  <Link to="/forgot-password" className="text-xs font-semibold hover:underline" style={{ color: '#ec4899' }}>
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="input-field pr-10"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <Eye className="w-4 h-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                id="login-submit"
                className="btn-primary w-full py-3 text-base"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing In...
                  </>
                ) : 'Sign In'}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-slate-200 dark:bg-white/8" />
              <span className="text-xs text-slate-400">or</span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-white/8" />
            </div>

            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="font-bold hover:underline" style={{ color: '#ec4899' }}>
                Sign up free
              </Link>
            </p>

            {/* Privacy note */}
            <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-5 flex items-center justify-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              Your identity remains fully anonymous
            </p>
          </div>
        </motion.div>
      </main>
    </>
  );
}
