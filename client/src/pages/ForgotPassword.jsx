import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Navbar from '../components/layout/Navbar';
import api from '../services/api';

/**
 * Forgot Password — Request OTP for password reset.
 */
export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await api.post('/auth/forgot-password', { email });
      if (response.data.success) {
        // Store email for subsequent steps
        localStorage.setItem('reset_email', email);
        navigate('/verify-otp');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen flex items-center justify-center pt-20 pb-12 px-4 relative overflow-hidden bg-slate-50 dark:bg-[#09090e] transition-colors">
        {/* Decorative Orbs */}
        <div className="orb orb-pink -top-20 -left-20 pointer-events-none" />
        <div className="orb orb-amber top-1/2 -right-24 pointer-events-none" />

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
                Forgot Password
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5 font-medium">
                Enter your registered email and we&apos;ll send you a verification code
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

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="forgot-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="you@university.edu"
                />
              </div>

              <button
                type="submit"
                className="btn-primary w-full py-3 text-sm font-bold tracking-wide"
                disabled={isLoading}
              >
                {isLoading ? 'Sending Code...' : 'Send OTP'}
              </button>
            </form>

            <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6 font-medium">
              Remember your password?{' '}
              <Link to="/login" className="text-pink-600 dark:text-pink-400 font-semibold hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </>
  );
}
