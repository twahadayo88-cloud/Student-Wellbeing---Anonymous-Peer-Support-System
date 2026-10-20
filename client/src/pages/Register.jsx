import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import api from '../services/api';

/**
 * Register Page — user registration form.
 */
export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // 1. Password Match
    if (formData.password !== formData.confirmPassword) {
      return setError('Passwords do not match');
    }

    // 2. Password Complexity Check (Matches Backend Regex)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(formData.password)) {
      return setError('Password must be at least 8 characters and include uppercase, lowercase, number, and special character');
    }

    // 3. Simple Domain Check hint (Backend does the heavy lifting, but we can tip the user)
    const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
    if (personalDomains.some(d => formData.email.toLowerCase().endsWith(d))) {
      return setError('Personal email addresses are not allowed. Please use your university email.');
    }

    try {
      setIsLoading(true);
      const response = await api.post('/auth/register', {
        email: formData.email,
        password: formData.password,
      });

      if (response.data.success) {
        setSuccess(true);
        setTimeout(() => navigate('/login'), 2000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#09090e] px-4 pb-12 pt-20">
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
        {/* Decorative Orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="orb orb-pink -top-20 -left-20" />
          <div className="orb orb-red top-1/2 -right-24" />
          <div className="orb orb-purple bottom-10 left-1/3" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative w-full max-w-md z-10"
        >
          <div className="glass-card-brand p-8 sm:p-10 shadow-2xl relative overflow-hidden">
            <div className="text-center mb-8">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-extrabold text-xl mx-auto mb-4 shadow-lg shadow-pink-500/30"
                style={{ background: 'linear-gradient(135deg, #ec4899, #ef4444, #f59e0b)' }}
              >
                PB
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Create Account
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5 font-medium">
                Join <span className="brand-text font-bold">PeerBridge</span> — your identity stays anonymous
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-5 p-3.5 bg-red-500/10 dark:bg-red-500/15 text-red-600 dark:text-red-400 rounded-xl text-xs border border-red-500/30 font-medium"
              >
                {error}
              </motion.div>
            )}
            
            {success && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-5 p-3.5 bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs border border-emerald-500/30 font-medium"
              >
                Registration successful! Redirecting to sign in...
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="register-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  University Email
                </label>
                <input
                  id="register-email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="name@university.edu"
                />
                <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                  * Official university domains only
                </p>
              </div>

              <div>
                <label htmlFor="register-password" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="register-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="input-field pr-10"
                    placeholder="Create a strong password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
                  8+ chars with uppercase, lowercase, number & symbol
                </p>
              </div>

              <div>
                <label htmlFor="register-confirm" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="register-confirm"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="input-field pr-10"
                    placeholder="Re-enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((visible) => !visible)}
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    aria-pressed={showConfirmPassword}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  id="register-submit"
                  className="btn-primary w-full py-3 text-sm font-bold tracking-wide"
                  disabled={isLoading || success}
                >
                  {isLoading ? 'Creating account...' : 'Create Account'}
                </button>
              </div>
            </form>

            <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6 font-medium">
              Already have an account?{' '}
              <Link to="/login" className="text-pink-600 dark:text-pink-400 font-semibold hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </motion.div>
      </main>
    </>
  );
}
