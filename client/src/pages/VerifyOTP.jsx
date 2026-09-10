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
      <div className="min-h-screen flex items-center justify-center pt-16 px-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 right-1/4 w-72 h-72 bg-primary-400/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 left-1/4 w-72 h-72 bg-accent-400/10 rounded-full blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative w-full max-w-md"
        >
          <div className="glass-card p-8">
            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">
                PB
              </div>
              <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Verify Your Identity</h1>
              <p className="text-surface-500 dark:text-surface-400 text-sm mt-1">
                We&apos;ve sent a 6-digit code to <span className="font-medium text-surface-900 dark:text-surface-100">{email}</span>.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-3 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm border border-red-200 dark:border-red-800 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="otp-input" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5 text-center">
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
                  className="input-field text-center text-2xl tracking-[0.5em] font-bold"
                  placeholder="000000"
                />
              </div>

              <div className="flex items-center justify-center gap-2 text-sm text-surface-500 dark:text-surface-400 bg-surface-50 dark:bg-surface-800/50 py-2 rounded-lg">
                <Clock className="w-4 h-4" />
                <span>Code expires in: <span className={`font-mono font-bold ${timeLeft < 60 ? 'text-red-500' : 'text-primary-500'}`}>{formatTime(timeLeft)}</span></span>
              </div>

              <button type="submit" className="btn-primary w-full" disabled={isLoading || timeLeft === 0}>
                {isLoading ? 'Verifying...' : 'Verify OTP'}
              </button>
            </form>

            <p className="text-center text-sm text-surface-500 dark:text-surface-400 mt-6">
              Didn&apos;t receive the code?{' '}
              <Link to="/forgot-password" className="text-primary-600 dark:text-primary-400 font-medium hover:underline">
                Resend Email
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </>
  );
}
