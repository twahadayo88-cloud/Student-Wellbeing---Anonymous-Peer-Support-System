import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, ShieldAlert } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import api from '../services/api';

/**
 * Verify OTP Page — verifies the 6-digit code sent to email.
 */
export default function VerifyOTP() {
  const navigate = useNavigate();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(900); // 15 minutes in seconds
  const email = localStorage.getItem('reset_email');

  useEffect(() => {
    if (!email) {
      navigate('/forgot-password');
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [email, navigate]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError('Please enter a 6-digit code.');
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      const response = await api.post('/auth/verify-otp', { email, otp });
      if (response.data.success) {
        navigate('/reset-password');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired code.');
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
        <div className="orb orb-purple top-1/2 -right-24 pointer-events-none" />

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
                Verify Identity
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5 font-medium">
                We sent a 6-digit code to{' '}
                <span className="font-semibold text-slate-900 dark:text-white font-mono break-all">{email}</span>
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-6 p-3.5 bg-red-500/10 dark:bg-red-500/15 text-red-600 dark:text-red-400 rounded-xl text-xs border border-red-500/30 font-medium flex items-start gap-2"
              >
                <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="otp-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 text-center">
                  Verification Code
                </label>
                <input
                  id="otp-input"
                  type="text"
                  maxLength="6"
                  required
                  autoFocus
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                  className="input-field text-center text-2xl tracking-[0.4em] font-mono font-bold py-3"
                  placeholder="000000"
                />
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-100/70 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/5 py-2.5 rounded-xl font-medium">
                <Clock className="w-4 h-4 text-pink-500" />
                <span>
                  Code expires in:{' '}
                  <span className={`font-mono font-bold ${timeLeft < 60 ? 'text-red-500' : 'text-pink-500'}`}>
                    {formatTime(timeLeft)}
                  </span>
                </span>
              </div>

              <button
                type="submit"
                className="btn-primary w-full py-3 text-sm font-bold tracking-wide"
                disabled={isLoading || timeLeft === 0}
              >
                {isLoading ? 'Verifying...' : 'Verify OTP'}
              </button>
            </form>

            <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6 font-medium">
              Didn&apos;t receive the code?{' '}
              <Link to="/forgot-password" className="text-pink-600 dark:text-pink-400 font-semibold hover:underline">
                Resend Email
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </>
  );
}
