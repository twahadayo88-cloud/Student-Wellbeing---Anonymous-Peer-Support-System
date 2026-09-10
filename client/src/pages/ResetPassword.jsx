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
              <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Create New Password</h1>
              <p className="text-surface-500 dark:text-surface-400 text-sm mt-1">
                Choose a strong password to protect your account.
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
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
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
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
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
              <div className="bg-surface-50 dark:bg-surface-800/50 p-4 rounded-xl space-y-2">
                <p className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-2">Requirements:</p>
                {passwordRequirements.map((req, idx) => {
                  const isMet = req.test(formData.password);
                  return (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      {isMet ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <X className="w-4 h-4 text-surface-300 dark:text-surface-600" />
                      )}
                      <span className={isMet ? 'text-surface-900 dark:text-surface-100' : 'text-surface-500'}>
                        {req.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <button 
                type="submit" 
                className="btn-primary w-full flex items-center justify-center gap-2" 
                disabled={isLoading || passwordRequirements.some(req => !req.test(formData.password)) || formData.password !== formData.confirmPassword}
              >
                {isLoading ? 'Resetting...' : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    Reset Password
                  </>
                )}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </>
  );
}
