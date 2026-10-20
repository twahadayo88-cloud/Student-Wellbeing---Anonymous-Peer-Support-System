import { useState, useEffect, useContext } from 'react';
import { Moon, Sun, Signal } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeContext } from '../context/ThemeContext';
import Footer from '../components/layout/Footer';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import PageHeader from '../components/layout/PageHeader';
import useAuth from '../hooks/useAuth';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import toast from 'react-hot-toast';
import ChatBox from '../components/chat/ChatBox';
import OnboardingModal from '../components/modals/OnboardingModal';
import ChatRequestModal from '../components/modals/ChatRequestModal';
import BadgeDisplay from '../components/trust/BadgeDisplay';
import FacultyDashboard from '../components/dashboard/FacultyDashboard';
import ChatRequestsCenter from '../components/dashboard/ChatRequestsCenter';

/** DiceBear Notionists avatar URL */
const dicebearUrl = (seed) =>
  `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(seed || 'peer')}&backgroundColor=transparent`;

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] },
});

export default function Dashboard() {
  const { user } = useAuth();
  const { socket, isConnected, connError } = useSocket();
  const { isDark, toggleTheme } = useContext(ThemeContext);
  const [searchParams] = useSearchParams();

  const [conversations, setConversations] = useState([]);
  const [activePeer, setActivePeer] = useState(null);
  const [myProfile, setMyProfile] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);
  const [pendingRequests, setPendingRequests] = useState({ incoming: [], sent: [] });
  const [selectedPeerForRequest, setSelectedPeerForRequest] = useState(null);
  const [selectedPeerForDetails, setSelectedPeerForDetails] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(
    user?.onboarding_required === true && user?.role === 'student'
  );
  const { updateUser } = useAuth();
  const [socketReady, setSocketReady] = useState(false);
  const [searchQuery] = useState('');
  const [departmentFilter] = useState('All areas');
  const [respondingRequestId, setRespondingRequestId] = useState(null);
  const isRequestsView = user?.role === 'student' && searchParams.get('view') === 'requests';

  // --- Real-time Socket Data ------------------------------------------
  useEffect(() => {
    if (!socket || !isConnected) return;
    socket.emit('dashboard:init');
    setSocketReady(true);

    const onDashboardData = (data) => {
      setMyProfile(prev => ({
        ...prev,
        anonymous_id: data.anonymous_id,
        badge_tier: data.badge_tier || 'bronze',
      }));
      setConversations(data.active_chats || []);
      setPendingRequests(data.pending_requests || { incoming: [], sent: [] });
      setRecommendations(data.recommended_peers || []);
      setIsLoadingMatches(false);
      if (data.onboarding_required !== undefined) {
        setShowOnboarding(data.onboarding_required && user?.role === 'student');
      }
    };

    const onChatRequestNew = (data) => {
      setPendingRequests(prev => ({
        ...prev,
        incoming: [
          { ...data, status: data.status || 'pending' },
          ...prev.incoming.filter((request) => (request.id || request.request_id) !== (data.id || data.request_id)),
        ],
      }));
    };

    const onChatRequestAccepted = (data) => {
      setPendingRequests(prev => ({
        ...prev,
        sent: prev.sent.map(r => r.id === data.request_id ? { ...r, status: 'accepted' } : r),
      }));
      socket.emit('dashboard:init');
    };

    const onChatRequestDeclined = (data) => {
      setPendingRequests(prev => ({
        ...prev,
        sent: prev.sent.map(r => r.id === data.request_id ? { ...r, status: 'declined' } : r),
      }));
      socket.emit('dashboard:init');
    };

    const onBadgeUpgraded = (data) => {
      toast.success(`ðŸ† You reached ${data.new_tier.toUpperCase()} tier!`, { duration: 6000 });
      setMyProfile(prev => prev ? { ...prev, badge_tier: data.new_tier } : prev);
    };

    const onMatchNew = (data) => setRecommendations(prev => [data, ...prev]);
    const onConversationRefresh = () => socket.emit('dashboard:init');

    socket.on('dashboard:data', onDashboardData);
    socket.on('dashboard:error', () => setIsLoadingMatches(false));
    socket.on('chat_request:new', onChatRequestNew);
    socket.on('chat_request:accepted', onChatRequestAccepted);
    socket.on('chat_request:declined', onChatRequestDeclined);
    socket.on('badge:tier_upgraded', onBadgeUpgraded);
    socket.on('match:new', onMatchNew);
    socket.on('conversation:refresh', onConversationRefresh);

    return () => {
      socket.off('dashboard:data', onDashboardData);
      socket.off('dashboard:error');
      socket.off('chat_request:new', onChatRequestNew);
      socket.off('chat_request:accepted', onChatRequestAccepted);
      socket.off('chat_request:declined', onChatRequestDeclined);
      socket.off('badge:tier_upgraded', onBadgeUpgraded);
      socket.off('match:new', onMatchNew);
      socket.off('conversation:refresh', onConversationRefresh);
    };
  }, [socket, isConnected, user?.role]);

  const handleResponseToRequest = async (requestId, status) => {
    setRespondingRequestId(requestId);
    try {
      await api.post('/chat/respond', { request_id: requestId, status });
      setPendingRequests((prev) => ({
        ...prev,
        incoming: prev.incoming.map((request) =>
          (request.id || request.request_id) === requestId
            ? { ...request, status }
            : request
        ),
      }));
      socket?.emit('dashboard:init');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error responding to request');
    } finally {
      setRespondingRequestId(null);
    }
  };

  // --- Faculty Dashboard View ---------------------------------------
  if (user?.role === 'faculty') {
    return (
      <>
        <Sidebar />
        <main className="ml-16 min-h-screen bg-slate-50 pb-12 pt-4 dark:bg-[#09090e] sm:ml-64 sm:pt-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <FacultyDashboard user={user} />
          </div>
        </main>
        <div className="ml-16 sm:ml-64">
          <Footer />
        </div>
      </>
    );
  }

  // --- Loading / Disconnect State ------------------------------------
  if (!isConnected && !socketReady) {
    return (
      <>
        {user?.role !== 'student' ? <Navbar /> : <Sidebar />}
        <main className={`min-h-screen pt-20 flex items-center justify-center bg-slate-50 dark:bg-[#09090e] ${user?.role === 'student' ? 'ml-16 sm:ml-64' : ''}`}>
          <div className="text-center space-y-4">
            <div className="w-14 h-14 rounded-full mx-auto"
              style={{ border: '3px solid transparent', borderTopColor: '#ec4899', animation: 'spin 0.8s linear infinite' }} />
            <p className="text-slate-600 dark:text-slate-400 font-semibold">
              {connError ? 'Connection lost — Reconnecting...' : 'Connecting to PeerBridge...'}
            </p>
            {connError && <p className="text-xs text-red-500">{connError}</p>}
          </div>
        </main>
        <div className={user?.role === 'student' ? 'ml-16 sm:ml-64' : ''}>
          <Footer />
        </div>
      </>
    );
  }

  const incomingCount = pendingRequests.incoming.filter((request) => request.status === 'pending').length;
  const sidebarRequestCount = incomingCount + pendingRequests.sent.filter((request) => request.status === 'pending').length;
  const filteredRecommendations = recommendations.filter((peer) => {
    const searchable = [
      peer.anonymous_id,
      peer.department,
      ...(Array.isArray(peer.subjects) ? peer.subjects : []),
    ].filter(Boolean).join(' ').toLowerCase();
    const matchesSearch = searchable.includes(searchQuery.trim().toLowerCase());
    const matchesDepartment = departmentFilter === 'All areas' ||
      peer.department === departmentFilter ||
      (Array.isArray(peer.subjects) && peer.subjects.includes(departmentFilter));
    return matchesSearch && matchesDepartment;
  });

  return (
    <>
      {user?.role !== 'student' && <Navbar />}
      {user?.role === 'student' && <Sidebar incomingCount={sidebarRequestCount} />}
      <main className={`min-h-screen pb-16 bg-slate-50 dark:bg-[#09090e] ${user?.role === 'student' ? 'ml-16 pt-4 sm:ml-64 sm:pt-6' : 'pt-20'}`}>
        <div className="max-w-5xl mx-auto w-full px-4 sm:px-6">

          {/* PAGE HEADER (standardized) */}
          {!isRequestsView && <motion.div {...fadeUp(0)}>
            <PageHeader
              title={<>Welcome back, <span className="brand-text">{myProfile?.anonymous_id?.split('#')[0] || 'Peer'}</span></>}
              subtitle="Trust-Based Secure Dashboard"
              myId={myProfile?.anonymous_id}
              tone="light"
              actions={
                user?.role === 'student' && (
                  <>
                    <button
                      type="button"
                      onClick={toggleTheme}
                      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
                      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:border-pink-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-pink-500/50"
                    >
                      {isDark ? <Sun size={17} /> : <Moon size={17} />}
                    </button>
                  </>
                )
              }
            />
          </motion.div>}

          {isRequestsView ? (
            <ChatRequestsCenter
              requests={pendingRequests}
              onRespond={handleResponseToRequest}
              respondingRequestId={respondingRequestId}
            />
          ) : (
          <>
          {/* --- Hero Graphic Banner + Integrated Bento Metrics --- */}
          <motion.div {...fadeUp(0.1)} className="max-w-5xl mx-auto w-full overflow-hidden rounded-3xl border border-purple-100 bg-gradient-to-r from-purple-50 via-white to-pink-50 p-6 shadow-xl dark:border-slate-800 dark:from-purple-900/40 dark:via-slate-900 dark:to-pink-900/40 dark:shadow-2xl md:p-8 mb-8">
            {/* Top Row — Identity & Illustration */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="min-w-0">
                <span className="px-3 py-1 bg-pink-500/10 border border-pink-500/30 text-pink-700 dark:text-pink-400 text-[11px] rounded-full font-semibold mb-2 inline-block">
                  PeerBridge Network
                </span>
                <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-wide">
                  Connect &amp; Collaborate with Peer Members
                </h2>
                <p className="text-xs text-slate-600 dark:text-gray-300 mt-1">
                  Find top peers, share study materials, and build real-time academic connections.
                </p>
              </div>
              {/* Student dashboard video illustration */}
              <div className="relative w-40 h-40 md:w-48 md:h-48 shrink-0 self-center">
                <div className="absolute inset-0 rounded-full opacity-40 blur-3xl"
                  style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.55), rgba(168,85,247,0.25), transparent 70%)' }} />
                <video
                  className="relative h-full w-full rounded-full border border-pink-400/30 object-cover shadow-xl shadow-pink-500/20 motion-reduce:hidden"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-hidden="true"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                >
                  <source src="/student_dashboard.mp4" type="video/mp4" />
                </video>
              </div>
            </div>
            {/* Bottom Row — Integrated Bento Metrics Bar */}
            <div className="pt-5 border-t border-slate-200 dark:border-white/10 grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-white/80 border border-slate-200 backdrop-blur-md dark:bg-slate-950/60 dark:border-white/10">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-gray-400">Active Conversations</p>
                <p className="text-2xl font-black mt-1 text-rose-700 dark:text-pink-400">{conversations.length}</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/80 border border-slate-200 backdrop-blur-md dark:bg-slate-950/60 dark:border-white/10">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-gray-400">Matching Peers</p>
                <p className="text-2xl font-black mt-1 text-purple-700 dark:text-purple-400">{recommendations.length}</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/80 border border-slate-200 backdrop-blur-md dark:bg-slate-950/60 dark:border-white/10">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-gray-400">Pending Requests</p>
                <p className="text-2xl font-black mt-1 text-amber-700 dark:text-amber-400">{incomingCount}</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/80 border border-slate-200 backdrop-blur-md dark:bg-slate-950/60 dark:border-white/10">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-gray-400">Badge Tier</p>
                {myProfile?.badge_tier ? (
                  <div className="mt-1"><BadgeDisplay tier={myProfile.badge_tier} size="md" /></div>
                ) : (
                  <span className="text-lg font-black text-slate-500 dark:text-gray-400">—</span>
                )}
              </div>
            </div>
          </motion.div>


          {/* --- Main Content Grid --- */}
          <div className={`grid grid-cols-1 gap-6 ${user?.role === 'student' ? '' : 'lg:grid-cols-3'}`}>

            {/* --- Recommended Peers (2/3 width) --- */}
            <div className={user?.role === 'student' ? 'space-y-6' : 'lg:col-span-2 space-y-6'}>
              <motion.section {...fadeUp(0.3)}>
                <div className="max-w-xl mx-auto w-full flex flex-col items-center space-y-6 pt-2">
                  {/* Section Heading */}
                  <h2 className="w-full text-base font-bold text-slate-800 border-b border-slate-200 pb-2 mb-6 text-left dark:border-slate-800/80 dark:text-gray-200">
                    Recommended Peers Feed
                  </h2>

                  {isLoadingMatches ? (
                    <div className="w-full space-y-6">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-800/90 dark:bg-[#111118] dark:shadow-2xl">
                          <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800/60 dark:bg-slate-900/30">
                            <div className="skeleton w-10 h-10 rounded-full" />
                            <div className="skeleton h-4 w-32 rounded" />
                          </div>
                          <div className="p-5 space-y-3">
                            <div className="skeleton h-3 w-36 rounded" />
                            <div className="skeleton h-8 w-full rounded-xl" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : filteredRecommendations.length > 0 ? (
                    <div className="w-full space-y-6">
                      {filteredRecommendations.map((peer) => (
                        <motion.div
                          key={peer.anonymous_id}
                          initial={{ opacity: 0, scale: 0.97 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg transition duration-300 group hover:border-pink-300 dark:border-slate-800/90 dark:bg-[#111118] dark:shadow-2xl dark:hover:border-pink-500/30"
                        >
                          {/* Card Top Header */}
                          <div className="flex justify-between items-center border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800/60 dark:bg-slate-900/30">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 dark:bg-slate-800 dark:border-slate-700">
                                <img src={dicebearUrl(peer.anonymous_id)} alt="Peer avatar"
                                  className="w-full h-full object-cover"
                                  onError={(e) => { e.target.style.display = 'none'; }} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-900 dark:text-white font-mono truncate">
                                  {peer.anonymous_id}
                                </p>
                                <p className="text-xs text-slate-600 dark:text-gray-400 mt-0.5 truncate">
                                  {peer.department}{peer.semester ? ` | Sem ${peer.semester}` : ''}
                                </p>
                              </div>
                            </div>
                            {/* Badge Tier Icon */}
                            <button
                              type="button"
                              onClick={() => setSelectedPeerForDetails(peer)}
                              aria-label={`Show ${peer.badge_tier || 'bronze'} badge details`}
                              className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
                            >
                              <BadgeDisplay tier={peer.badge_tier} size="sm" showLabel={false} />
                            </button>
                          </div>

                          {/* Card Body — Specialties & Subjects Tags */}
                          <div className="p-5 space-y-3">
                            <p className="text-xs text-slate-600 dark:text-gray-400 font-medium">Specialties &amp; Subjects:</p>
                            <div className="flex flex-wrap gap-2">
                              {Array.isArray(peer.subjects) && peer.subjects.slice(0, 3).map(s => (
                                <span key={s} className="text-xs px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-mono font-medium dark:bg-slate-800/90 dark:border-slate-700/60 dark:text-gray-200">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Card Bottom Action */}
                          <div className="px-5 pb-5 pt-1">
                            <button
                              onClick={() => setSelectedPeerForRequest(peer)}
                              className="w-full py-3 bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 rounded-2xl text-xs font-bold text-white shadow-lg shadow-pink-500/10 hover:opacity-95 transition"
                            >
                              Send Chat Request
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : recommendations.length > 0 ? (
                    <div className="w-full rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800/90 dark:bg-[#111118]">
                      <h3 className="mb-2 text-lg font-bold text-slate-900 dark:text-white">No peers match those filters</h3>
                      <p className="text-sm text-slate-600 dark:text-gray-400">Try a different search or select another area.</p>
                    </div>
                  ) : (
                    <div className="w-full rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800/90 dark:bg-[#111118]">
                      <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                        style={{ background: 'rgba(236,72,153,0.1)', border: '1px solid rgba(236,72,153,0.2)' }}>
                        <Signal className="w-7 h-7" style={{ color: '#ec4899' }} />
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white mb-2 text-lg">No matches yet</h3>
                      <p className="text-slate-600 dark:text-gray-400 text-sm max-w-xs mx-auto">
                        No peer matches available right now. Post an academic help request to get matched.
                      </p>
                              <Link to="/academic" className="btn-primary mt-5 text-sm px-6 py-2">
                                Browse Academic Board
                              </Link>
                            </div>
                          )}
                        </div>
                      </motion.section>
            </div>

            {/* --- Sidebar (Requests + Chats) --- */}
            {user?.role !== 'student' && <div className="space-y-5">

              {/* Chat Requests */}
              <motion.section {...fadeUp(0.35)} className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-black text-slate-900 dark:text-white">Chat Requests</h2>
                  {incomingCount > 0 && (
                    <span className="badge-pending">
                      {incomingCount} new
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  {pendingRequests.incoming.length === 0 && pendingRequests.sent.length === 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">No active requests</p>
                  )}

                  {pendingRequests.incoming.map(req => (
                    <div key={req.id || req.request_id} className="p-3.5 rounded-xl"
                      style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Incoming</p>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 mb-3 italic line-clamp-2">
                        &ldquo;{req.subject_context}&rdquo;
                      </p>
                      {String(req.status || '').toLowerCase() === 'pending' ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleResponseToRequest(req.id || req.request_id, 'accepted')}
                            disabled={respondingRequestId === (req.id || req.request_id)}
                            className="btn-primary py-1.5 px-3 text-[10px] flex-1 disabled:opacity-60"
                          >
                            {respondingRequestId === (req.id || req.request_id) ? 'Updating...' : 'Accept'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResponseToRequest(req.id || req.request_id, 'declined')}
                            disabled={respondingRequestId === (req.id || req.request_id)}
                            className="btn-secondary py-1.5 px-3 text-[10px] flex-1 disabled:opacity-60"
                          >
                            Decline
                          </button>
                        </div>
                      ) : (
                        <p className="text-[10px] font-bold capitalize text-slate-500">Status: {req.status}</p>
                      )}
                    </div>
                  ))}

                  {pendingRequests.sent.map(req => (
                    <div key={req.id} className="p-3 rounded-xl"
                      style={{ background: 'rgba(17,17,24,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                        Sent to <span className="font-mono brand-text">{req.receiver_anonymous_id}</span>
                      </p>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 capitalize">
                        Status: <span className={`font-bold ${
                          req.status === 'accepted' ? 'text-emerald-500' :
                          req.status === 'declined' ? 'text-red-500' : 'text-amber-500'
                        }`}>{req.status}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </motion.section>

              {/* Active Chats */}
              <motion.section {...fadeUp(0.4)} className="glass-card p-5">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-base font-black text-slate-900 dark:text-white">Active Chats</h2>
                  <Link to="/chat" className="text-[10px] font-bold hover:underline" style={{ color: '#ec4899' }}>
                    View all →
                  </Link>
                </div>

                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {conversations.length === 0 ? (
                    <div className="text-center py-6">
                      <div className="w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center"
                        style={{ background: 'rgba(236,72,153,0.08)', border: '1px solid rgba(236,72,153,0.15)' }}>
                        <svg className="w-5 h-5 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">No active conversations</p>
                    </div>
                  ) : (
                    conversations.map((conv, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActivePeer({
                          anonymous_id: conv.peer_anonymous_id,
                          conversation_id: conv.conversation_id,
                        })}
                        className="w-full p-3 rounded-xl flex items-center gap-3 text-left hover:bg-slate-100 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-white/8"
                      >
                        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-pink-500 to-amber-500">
                          <img src={dicebearUrl(conv.peer_anonymous_id)} alt="peer"
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.style.display = 'none'; }} />
                        </div>
                        <span className="text-xs font-bold font-mono brand-text truncate">
                          {conv.peer_anonymous_id}
                        </span>
                        <div className="ml-auto w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                      </button>
                    ))
                  )}
                </div>
              </motion.section>
            </div>}
          </div>

          {/* --- Quick Actions Strip --- */}
          {user?.role !== 'student' && <motion.div {...fadeUp(0.5)} className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { to: '/chat', label: 'Messages', icon: 'ðŸ’¬', color: 'from-pink-500/10 to-rose-500/10', border: 'rgba(236,72,153,0.15)' },
              { to: '/academic', label: 'Academic Board', icon: 'ðŸŽ“', color: 'from-violet-500/10 to-purple-500/10', border: 'rgba(168,85,247,0.15)' },
              { to: '/mood', label: 'Mood Tracker', icon: 'ðŸŒŸ', color: 'from-amber-500/10 to-yellow-500/10', border: 'rgba(245,158,11,0.15)' },
              { to: '/leaderboard', label: 'Leaderboard', icon: 'ðŸ†', color: 'from-emerald-500/10 to-teal-500/10', border: 'rgba(16,185,129,0.15)' },
            ].map((action) => (
              <Link key={action.to} to={action.to}
                className={`glass-card p-4 flex flex-col items-center gap-2 text-center group hover:scale-[1.03] transition-transform`}
                style={{ border: `1px solid ${action.border}` }}>
                <span className="text-2xl group-hover:scale-110 transition-transform">{action.icon}</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{action.label}</span>
              </Link>
            ))}
          </motion.div>}
          </>
          )}
        </div>
      </main>
      <div className={user?.role === 'student' ? 'ml-16 sm:ml-64' : ''}>
        <Footer />
      </div>

      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => {
          setShowOnboarding(false);
          setMyProfile(prev => ({ ...prev, onboarding_required: false }));
          updateUser({ onboarding_required: false });
        }}
        anonymousId={myProfile?.anonymous_id}
      />

      {selectedPeerForRequest && (
        <ChatRequestModal
          isOpen={!!selectedPeerForRequest}
          onClose={() => setSelectedPeerForRequest(null)}
          peer={selectedPeerForRequest}
          onSuccess={() => {
            api.get('/chat/pending').then(r => {
              if (r.data.success) setPendingRequests(r.data.data);
            });
          }}
        />
      )}

      {selectedPeerForDetails && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setSelectedPeerForDetails(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="peer-badge-details-title"
            className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-[#111118] dark:text-slate-100"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedPeerForDetails(null)}
              aria-label="Close peer details"
              className="absolute right-4 top-4 rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              ×
            </button>
            <h2 id="peer-badge-details-title" className="mb-5 text-lg font-bold">Peer details</h2>
            <div className="mb-5 flex items-center gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-full border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                <img src={dicebearUrl(selectedPeerForDetails.anonymous_id)} alt="Peer avatar" className="h-full w-full object-cover" />
              </div>
              <div>
                <p className="font-mono font-bold">{selectedPeerForDetails.anonymous_id}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {selectedPeerForDetails.department}{selectedPeerForDetails.semester ? ` | Sem ${selectedPeerForDetails.semester}` : ''}
                </p>
              </div>
            </div>
            <div className="mb-5">
              <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">Badge</p>
              <BadgeDisplay tier={selectedPeerForDetails.badge_tier} size="md" />
            </div>
            <div className="mb-6">
              <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">Specialties &amp; Subjects</p>
              <div className="flex flex-wrap gap-2">
                {Array.isArray(selectedPeerForDetails.subjects) && selectedPeerForDetails.subjects.length > 0 ? (
                  selectedPeerForDetails.subjects.map((subject) => (
                    <span key={subject} className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-mono text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">{subject}</span>
                  ))
                ) : (
                  <span className="text-sm text-slate-600 dark:text-slate-400">No subjects listed</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedPeerForDetails(null);
                setSelectedPeerForRequest(selectedPeerForDetails);
              }}
              className="w-full rounded-xl bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 py-3 text-sm font-bold text-white hover:opacity-95"
            >
              Send Chat Request
            </button>
          </section>
        </div>
      )}

      <AnimatePresence>
        {activePeer && (
          <ChatBox key={activePeer.conversation_id || activePeer.anonymous_id} peer={activePeer} onClose={() => setActivePeer(null)} />
        )}
      </AnimatePresence>
    </>
  );
}
