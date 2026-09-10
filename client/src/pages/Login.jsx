import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Navbar from '../components/layout/Navbar';
import api from '../services/api';
import useAuth from '../hooks/useAuth';

/**
 * Login Page — user authentication form.
 */
export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState(() => {
    const saved = sessionStorage.getItem('auth_error');
    if (saved) {
      sessionStorage.removeItem('auth_error');
      return saved;
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(false);

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
        // user now contains { anonymous_id, role } — privacy-safe
        login(user, token);
        
        // Redirect based on role
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
      <div className="min-h-screen flex items-center justify-center pt-16 px-4">
        {/* Background */}
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
              <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Welcome back</h1>
              <p className="text-surface-500 dark:text-surface-400 text-sm mt-1">
                Sign in to your PeerBridge account
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm border border-red-200 dark:border-red-800">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
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
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                  Password
                </label>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="Enter your password"
                />
                <div className="flex justify-end mt-1.5">
                  <Link to="/forgot-password" className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium">
                    Forgot password?
                  </Link>
                </div>
              </div>

              <button type="submit" id="login-submit" className="btn-primary w-full" disabled={isLoading}>
                {isLoading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>

            <p className="text-center text-sm text-surface-500 dark:text-surface-400 mt-6">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="text-primary-600 dark:text-primary-400 font-medium hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </>
  );
}
