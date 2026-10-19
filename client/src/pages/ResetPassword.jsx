import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, ShieldAlert, Check, X } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import api from '../services/api';

/**
 * Reset Password Page — allows user to set a new password after OTP verification.
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const email = localStorage.getItem('reset_email');

  useEffect(() => {
    if (!email) {
      navigate('/forgot-password');
    }
  }, [email, navigate]);

  const passwordRequirements = [
    { label: 'At least 8 characters', test: (p) => p.length >= 8 },
    { label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
    { label: 'One number', test: (p) => /[0-9]/.test(p) },
    { label: 'One special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validate all requirements
    const failedReqs = passwordRequirements.filter(req => !req.test(formData.password));
    if (failedReqs.length > 0) {
      setError('Password does not meet all requirements.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/auth/reset-password', {
        email,
        newPassword: formData.password
      });

      if (response.data.success) {
        localStorage.removeItem('reset_email');
        navigate('/login');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password. Please try again.');
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
        <div className="orb orb-red top-1/2 -right-24 pointer-events-none" />

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
                Create New Password
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5 font-medium">
                Choose a strong password to protect your account
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

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input-field"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="input-field"
                  placeholder="••••••••"
                />
              </div>

              {/* Password Requirements UI */}
              <div className="bg-slate-100/70 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/5 p-4 rounded-xl space-y-2">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 font-mono">
                  Requirements
                </p>
                {passwordRequirements.map((req, idx) => {
                  const isMet = req.test(formData.password);
                  return (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      {isMet ? (
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <X className="w-4 h-4 text-slate-400 dark:text-slate-600 shrink-0" />
                      )}
                      <span className={isMet ? 'text-slate-900 dark:text-slate-200 font-medium' : 'text-slate-400 dark:text-slate-500'}>
                        {req.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  className="btn-primary w-full py-3 text-sm font-bold tracking-wide flex items-center justify-center gap-2" 
                  disabled={isLoading || passwordRequirements.some(req => !req.test(formData.password)) || formData.password !== formData.confirmPassword}
                >
                  {isLoading ? 'Resetting...' : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Reset Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </>
  );
}
