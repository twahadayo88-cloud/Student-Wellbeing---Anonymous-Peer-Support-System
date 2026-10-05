import { useState, useEffect } from 'react';
import { Signal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import useAuth from '../hooks/useAuth';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import toast from 'react-hot-toast';
import ChatBox from '../components/chat/ChatBox';
import OnboardingModal from '../components/modals/OnboardingModal';
import ChatRequestModal from '../components/modals/ChatRequestModal';
import BadgeDisplay from '../components/trust/BadgeDisplay';

export default function Dashboard() {
  const { user } = useAuth();
  const { socket, isConnected, connError } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [activePeer, setActivePeer] = useState(null);
  const [myProfile, setMyProfile] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);
  const [pendingRequests, setPendingRequests] = useState({ incoming: [], sent: [] });
  const [selectedPeerForRequest, setSelectedPeerForRequest] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(
    user?.onboarding_required === true && user?.role === 'student'
  );
  const { updateUser } = useAuth();
  const [socketReady, setSocketReady] = useState(false);

  // ─── Real-time Socket Data ──────────────────────────────────────────
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Request full dashboard data on connect
    socket.emit('dashboard:init');
    setSocketReady(true);

    // Handle full dashboard data payload
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

    // Real-time incoming chat request
    const onChatRequestNew = (data) => {
      setPendingRequests(prev => ({
        ...prev,
        incoming: [data, ...prev.incoming],
      }));
    };

    // Sender notified when their request is accepted
    const onChatRequestAccepted = (data) => {
      setPendingRequests(prev => ({
        ...prev,
        sent: prev.sent.map(r =>
          r.id === data.request_id ? { ...r, status: 'accepted' } : r
        ),
      }));
      // Trigger full data refresh to show the new conversation
      socket.emit('dashboard:init');
    };

    // Sender notified when their request is declined
    const onChatRequestDeclined = (data) => {
      setPendingRequests(prev => ({
        ...prev,
        sent: prev.sent.map(r =>
          r.id === data.request_id ? { ...r, status: 'declined' } : r
        ),
      }));
    };

    // Badge tier upgrade notification
    const onBadgeUpgraded = (data) => {
      toast.success(
        `🏆 Congratulations! You reached ${data.new_tier.toUpperCase()} tier!`,
        { duration: 6000, icon: '🥇' }
      );
      setMyProfile(prev => prev ? { ...prev, badge_tier: data.new_tier } : prev);
    };

    // Real-time match
    const onMatchNew = (data) => {
      setRecommendations(prev => [data, ...prev]);
    };

    const onConversationRefresh = () => {
      socket.emit('dashboard:init');
    };

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

  // ─── Respond to chat request (HTTP, since it has auth side-effects) ───
  const handleResponseToRequest = async (requestId, status) => {
    try {
      await api.post('/chat/respond', { request_id: requestId, status });
      // Remove from incoming list immediately (handle both ID naming conventions)
      setPendingRequests(prev => ({
        ...prev,
        incoming: prev.incoming.filter(r => (r.id !== requestId && r.request_id !== requestId)),
      }));

      // Force immediate conversations refresh
      if (status === 'accepted') {
        socket.emit('dashboard:init');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error responding to request');
    }
  };

  const stats = [
    { label: 'Active Conversations', value: conversations.length ?? '—', color: 'from-primary-500 to-primary-600' },
    { label: 'Matching Peers', value: recommendations.length ?? '—', color: 'from-accent-500 to-accent-600' },
    { label: 'Pending Requests', value: pendingRequests.incoming.length ?? '—', color: 'from-amber-500 to-amber-600' },
    { 
      label: 'Badge Tier', 
      value: myProfile?.badge_tier ? (
        <div className="mt-1"><BadgeDisplay tier={myProfile.badge_tier} size="md" /></div>
      ) : '—', 
      color: 'from-emerald-500 to-emerald-600' 
    },
  ];

  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay }
  });

  // ─── Graceful Disconnect Fallback ──────────────────────────────────
  if (!isConnected && !socketReady) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen pt-24 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin mx-auto" />
            <p className="text-surface-600 dark:text-surface-400 font-medium">
              {connError ? 'Connection lost — Reconnecting...' : 'Connecting to PeerBridge...'}
            </p>
            {connError && (
              <p className="text-xs text-red-500">{connError}</p>
            )}
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">


        {/* Welcome Header */}
        <motion.div {...fadeUp()} className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Welcome back</h1>
            <p className="text-surface-500 dark:text-surface-400 mt-1">Trust-Based Secure Dashboard</p>
          </div>
          <div className="mt-4 md:mt-0 glass-card px-4 py-2 flex items-center space-x-3 border-primary-500/30">
            <span className="text-xs text-surface-500 uppercase tracking-wider font-semibold">My ID</span>
            <code className="text-primary-600 font-mono font-bold text-sm bg-primary-50 dark:bg-primary-900/40 px-2 py-1 rounded">
              {myProfile?.anonymous_id || '...'}
            </code>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {stats.map((stat, i) => (
            <motion.div key={stat.label} {...fadeUp(i * 0.1)} className="glass-card p-6">
              <p className="text-sm text-surface-500 dark:text-surface-400 mb-2">{stat.label}</p>
              <p className={`text-3xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>{stat.value}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Column: Matching & Faculty */}
          <div className="lg:col-span-2 space-y-8">
            <section>
              <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-6">Recommended Peers</h2>
              {isLoadingMatches ? (
                <div className="h-64 flex items-center justify-center animate-pulse text-surface-400">Loading intelligent matches...</div>
              ) : recommendations.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recommendations.map((peer) => (
                    <div key={peer.anonymous_id} className="glass-card p-5 hover:border-primary-500/50 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <span className="font-mono font-bold text-primary-600 dark:text-primary-400">{peer.anonymous_id}</span>
                        <BadgeDisplay tier={peer.badge_tier} size="sm" showLabel={false} />
                      </div>
                      <div className="text-xs text-surface-500 dark:text-surface-400 mb-4 h-16 overflow-hidden">
                        <p className="font-semibold mb-1">{peer.department} | Sem {peer.semester}</p>
                        <p>{Array.isArray(peer.subjects) ? peer.subjects.join(', ') : ''}</p>
                      </div>
                      <button
                        onClick={() => setSelectedPeerForRequest(peer)}
                        className="btn-primary w-full py-2 text-xs"
                      >
                        Send Chat Request
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 bg-surface-50 dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 text-center">
                  <Signal className="w-12 h-12 mb-4 block mx-auto text-surface-400" />
                  <h3 className="font-bold text-surface-900 dark:text-white mb-2">No direct peer matches found</h3>
                  <p className="text-surface-500 text-sm max-w-sm mx-auto">No student matches are available right now. Check back later or post an academic help request.</p>
                </div>
              )}
            </section>
          </div>

          {/* Sidebar: Conversations & Requests */}
          <div className="space-y-8">
            <section className="glass-card p-6">
              <h2 className="text-lg font-bold text-surface-900 dark:text-white mb-4">Chat Requests</h2>
              <div className="space-y-4">
                {pendingRequests.incoming.length === 0 && pendingRequests.sent.length === 0 && (
                  <p className="text-xs text-surface-400 text-center py-4">No active requests</p>
                )}

                {pendingRequests.incoming.map(req => (
                  <div key={req.id || req.request_id} className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl">
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">Incoming Request</p>
                    <p className="text-[10px] text-surface-900 dark:text-white mb-2 font-medium italic">&quot;{req.subject_context}&quot;</p>
                    <div className="flex gap-2">
                       <button onClick={() => handleResponseToRequest(req.id || req.request_id, 'accepted')} className="btn-primary py-1 px-3 text-[10px] flex-1">Accept</button>
                       <button onClick={() => handleResponseToRequest(req.id || req.request_id, 'declined')} className="btn-secondary py-1 px-3 text-[10px] flex-1">Decline</button>
                    </div>
                  </div>
                ))}

                {pendingRequests.sent.map(req => (
                  <div key={req.id} className="p-3 bg-surface-100 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700 rounded-xl">
                    <p className="text-[10px] font-bold text-surface-500 uppercase">Sent to {req.receiver_anonymous_id}</p>
                    <p className="text-[10px] text-surface-400 mt-1">Status: <span className="text-amber-500 font-bold capitalize">{req.status}</span></p>
                  </div>
                ))}
              </div>
            </section>

            <section className="glass-card p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-surface-900 dark:text-white">Active Chats</h2>
                <Link to="/chat" className="text-[10px] font-bold text-primary-600 dark:text-primary-400 hover:underline">View Messages</Link>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {conversations.length === 0 ? (
                  <p className="text-xs text-surface-400 text-center py-4">No active conversations</p>
                ) : (
                  conversations.map((conv, idx) => (
                    <div
                      key={idx}
                      onClick={() => setActivePeer({
                        anonymous_id: conv.peer_anonymous_id,
                        conversation_id: conv.conversation_id
                      })}
                      className="p-3 rounded-xl border border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800 cursor-pointer transition-colors flex items-center space-x-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-400 shadow-sm flex items-center justify-center text-white font-bold text-xs uppercase">
                        {conv.peer_anonymous_id.substring(0, 2)}
                      </div>
                      <span className="text-xs font-semibold text-surface-900 dark:text-white">{conv.peer_anonymous_id}</span>
                    </div>
                  ))
                )}
              </div>

            </section>
          </div>
        </div>
      </main>
      <Footer />

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

      <AnimatePresence>
        {activePeer && (
          <ChatBox peer={activePeer} onClose={() => setActivePeer(null)} />
        )}
      </AnimatePresence>
    </>
  );
}
