import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import useAuth from '../hooks/useAuth';

const SocketContext = createContext();

export function SocketProvider({ children }) {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connError, setConnError] = useState(null);
  const [suspensionBanner, setSuspensionBanner] = useState(null);

  useEffect(() => {
    // Only connect if we have a valid token
    if (token && !socket) {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const socketUrl = apiUrl.replace('/api', '');
      
      const newSocket = io(socketUrl, {
        auth: { token },
      });

      newSocket.on('connect', () => {
        setIsConnected(true);
        setConnError(null);
      });

      newSocket.on('connect_error', (err) => {
        console.error('Socket connect_error:', err.message);
        setConnError(err.message);
      });

      newSocket.on('disconnect', () => {
        setIsConnected(false);
      });

      newSocket.on('user:suspended', (data) => {
        const msg = data.message || 'Your account has been suspended for 24 hours due to a safety violation.';
        // Show banner first, then log out after 3 seconds
        setSuspensionBanner(msg);
        setTimeout(() => {
          sessionStorage.setItem('auth_error', msg);
          sessionStorage.removeItem('pb_token');
          sessionStorage.removeItem('pb_user');
          window.location.href = '/login';
        }, 3000);
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
        // Clear state on unmount so a new connection can be made if remounted
        setSocket(null);
        setIsConnected(false);
      };
    }

    if (!token && socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, connError, onlineUsers }}>
      {/* Suspension Banner — shown before logout redirect */}
      {suspensionBanner && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
          background: 'linear-gradient(90deg, #dc2626, #b91c1c)',
          color: 'white', padding: '16px 24px',
          textAlign: 'center', fontWeight: 'bold', fontSize: '15px',
          boxShadow: '0 4px 24px rgba(220,38,38,0.5)',
          animation: 'slideDown 0.3s ease'
        }}>
          ⚠️ {suspensionBanner} — Logging out in 3 seconds...
        </div>
      )}
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
