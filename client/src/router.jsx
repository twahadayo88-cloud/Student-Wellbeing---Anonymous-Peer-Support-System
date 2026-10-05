import { Routes, Route } from 'react-router-dom';
import PageWrapper from './components/layout/PageWrapper';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Chat from './pages/Chat';
import AdminPanel from './pages/AdminPanel';
import ForgotPassword from './pages/ForgotPassword';
import VerifyOTP from './pages/VerifyOTP';
import ResetPassword from './pages/ResetPassword';
import AcademicBoard from './pages/AcademicBoard';
import Leaderboard from './pages/Leaderboard';
import MoodTracker from './pages/MoodTracker';
import Complaints from './pages/Complaints';
import ComplaintReview from './pages/ComplaintReview';
import ResourceLibrary from './pages/ResourceLibrary';
import NoticeBoard from './pages/NoticeBoard';
import PrivateRoute from './components/auth/PrivateRoute';

/**
 * Application Router
 * Defines all route-to-page mappings.
 * Future: add ProtectedRoute wrapper for auth-gated pages.
 */
function AppRouter() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<PageWrapper><Landing /></PageWrapper>} />
      <Route path="/login" element={<PageWrapper><Login /></PageWrapper>} />
      <Route path="/register" element={<PageWrapper><Register /></PageWrapper>} />
      <Route path="/forgot-password" element={<PageWrapper><ForgotPassword /></PageWrapper>} />
      <Route path="/verify-otp" element={<PageWrapper><VerifyOTP /></PageWrapper>} />
      <Route path="/reset-password" element={<PageWrapper><ResetPassword /></PageWrapper>} />

      {/* Protected Routes */}
      <Route path="/dashboard" element={<PrivateRoute roles={['student', 'faculty', 'admin', 'super_admin']}><PageWrapper><Dashboard /></PageWrapper></PrivateRoute>} />
      <Route path="/profile" element={<PrivateRoute><PageWrapper><Profile /></PageWrapper></PrivateRoute>} />
      <Route path="/chat" element={<PrivateRoute roles={['student', 'faculty', 'admin', 'super_admin']}><PageWrapper><Chat /></PageWrapper></PrivateRoute>} />
      <Route 
        path="/academic" 
        element={
          <PrivateRoute roles={['student', 'faculty', 'admin', 'super_admin']}>
            <PageWrapper><AcademicBoard /></PageWrapper>
          </PrivateRoute>
        } 
      />
      <Route 
        path="/leaderboard" 
        element={
          <PrivateRoute roles={['student', 'faculty', 'admin', 'super_admin']}>
            <PageWrapper><Leaderboard /></PageWrapper>
          </PrivateRoute>
        } 
      />
      <Route
        path="/mood"
        element={
          <PrivateRoute roles={['student']}>
            <PageWrapper><MoodTracker /></PageWrapper>
          </PrivateRoute>
        }
      />
      <Route
        path="/complaints"
        element={
          <PrivateRoute roles={['student']}>
            <PageWrapper><Complaints /></PageWrapper>
          </PrivateRoute>
        }
      />
      <Route
        path="/complaint-review"
        element={
          <PrivateRoute roles={['faculty', 'admin', 'super_admin']}>
            <PageWrapper><ComplaintReview /></PageWrapper>
          </PrivateRoute>
        }
      />
      <Route
        path="/resources"
        element={
          <PrivateRoute roles={['student', 'faculty']}>
            <PageWrapper><ResourceLibrary /></PageWrapper>
          </PrivateRoute>
        }
      />
      <Route
        path="/notices"
        element={
          <PrivateRoute roles={['student', 'faculty', 'admin', 'super_admin']}>
            <PageWrapper><NoticeBoard /></PageWrapper>
          </PrivateRoute>
        }
      />
      <Route 
        path="/admin" 
        element={
          <PrivateRoute roles={['admin', 'super_admin']}>
            <PageWrapper><AdminPanel /></PageWrapper>
          </PrivateRoute>
        } 
      />

      {/* Catch-all 404 */}
      <Route
        path="*"
        element={
          <PageWrapper>
            <div className="min-h-screen flex items-center justify-center">
              <div className="text-center">
                <h1 className="text-6xl font-bold gradient-text mb-4">404</h1>
                <p className="text-surface-500 text-lg">Page not found</p>
              </div>
            </div>
          </PageWrapper>
        }
      />
    </Routes>
  );
}

export default AppRouter;
