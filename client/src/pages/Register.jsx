import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
      <div className="min-h-screen flex items-center justify-center pt-16 px-4">
        {/* Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-1/3 w-72 h-72 bg-accent-400/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/3 right-1/3 w-72 h-72 bg-primary-400/10 rounded-full blur-3xl" />
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
              <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Create account</h1>
              <p className="text-surface-500 dark:text-surface-400 text-sm mt-1">
                Join PeerBridge — your identity stays anonymous
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-xs border border-red-200 dark:border-red-800">
                {error}
              </div>
            )}
            
            {success && (
              <div className="mb-4 p-3 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-lg text-xs border border-green-200 dark:border-green-800">
                Registration successful! Redirecting to login...
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="register-email" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
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
                <p className="mt-1 text-[10px] text-surface-500 italic">Personal domains are not permitted.</p>
              </div>

              <div>
                <label htmlFor="register-password" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                  Password
                </label>
                <input
                  id="register-password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="Create a strong password"
                />
                <p className="mt-1 text-[10px] text-surface-500 leading-tight">
                  Must include: 8+ chars, uppercase, lowercase, number, & symbol.
                </p>
              </div>

              <div>
                <label htmlFor="register-confirm" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                  Confirm Password
                </label>
                <input
                  id="register-confirm"
                  name="confirmPassword"
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="Re-enter your password"
                />
              </div>

              <button type="submit" id="register-submit" className="btn-primary w-full" disabled={isLoading || success}>
                {isLoading ? 'Creating...' : 'Create Account'}
              </button>
            </form>

            <p className="text-center text-sm text-surface-500 dark:text-surface-400 mt-6">
              Already have an account?{' '}
              <Link to="/login" className="text-primary-600 dark:text-primary-400 font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </>
  );
}
