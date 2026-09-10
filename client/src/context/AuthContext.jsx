import { createContext, useState, useEffect, useCallback } from 'react';

/**
 * AuthContext — manages authentication state across the app.
 *
 * PRIVACY-FIRST: The user object ONLY contains:
 *   - anonymous_id: the user's anonymous display identity
 *   - role: student | faculty | admin
 *
 * NEVER stored in context or localStorage:
 *   - email
 *   - user internal id
 *   - password
 *
 * Provides:
 *  - user: { anonymous_id, role } | null
 *  - token: JWT access token
 *  - isAuthenticated: boolean
 *  - isLoading: true during initial auth check
 *  - login(userData, token): save auth state
 *  - logout(): clear auth state
 */
export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, check sessionStorage for existing session
  useEffect(() => {
    try {
      const storedToken = sessionStorage.getItem('pb_token');
      const storedUser = sessionStorage.getItem('pb_user');

      if (storedToken && storedUser) {
        const parsed = JSON.parse(storedUser);
        // Validate that stored user has the expected privacy-safe shape
        if (parsed && parsed.anonymous_id && parsed.role) {
          setToken(storedToken);
          setUser(parsed);
        } else {
          // Legacy format (may contain email/id) — purge it
          sessionStorage.removeItem('pb_token');
          sessionStorage.removeItem('pb_user');
        }
      }

      // Cleanup legacy localStorage to prevent session bleeding
      localStorage.removeItem('pb_token');
      localStorage.removeItem('pb_user');
    } catch {
      // Corrupted storage — clear it
      sessionStorage.removeItem('pb_token');
      sessionStorage.removeItem('pb_user');
      localStorage.removeItem('pb_token');
      localStorage.removeItem('pb_user');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback((userData, accessToken) => {
    // Only store privacy-safe fields
    const safeUser = {
      anonymous_id: userData.anonymous_id,
      role: userData.role,
      onboarding_required: userData.onboarding_required,
    };
    setUser(safeUser);
    setToken(accessToken);
    sessionStorage.setItem('pb_token', accessToken);
    sessionStorage.setItem('pb_user', JSON.stringify(safeUser));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    sessionStorage.removeItem('pb_token');
    sessionStorage.removeItem('pb_user');
  }, []);

  const updateUser = useCallback((updates) => {
    setUser((prev) => {
      if (!prev) return null;
      const newUser = { ...prev, ...updates };
      sessionStorage.setItem('pb_user', JSON.stringify(newUser));
      return newUser;
    });
  }, []);

  const value = {
    user,
    token,
    isAuthenticated: !!token,
    isLoading,
    login,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
