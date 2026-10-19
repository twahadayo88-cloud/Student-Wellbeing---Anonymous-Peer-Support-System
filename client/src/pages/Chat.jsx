import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Megaphone, MessageSquare, Plus } from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import PageHeader from '../components/layout/PageHeader';
import ChatBox from '../components/chat/ChatBox';
import AcademicBoard from './AcademicBoard';
import useAuth from '../hooks/useAuth';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';

export default function Chat() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { socket } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [activePeer, setActivePeer] = useState(null);
  const [activeAnnouncement, setActiveAnnouncement] = useState(null);
  const [chatMode, setChatMode] = useState('chat_only');

  // New Layout State
  const [activeTab, setActiveTab] = useState(() => {
    const tabFromUrl = searchParams.get('tab');
    return tabFromUrl === 'academic' ? 'academic' : tabFromUrl === 'announcements' ? 'announcements' : 'chats';
  }); // 'chats' | 'announcements' | 'academic'
  const [isCreatingBroadcast, setIsCreatingBroadcast] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [readAnnouncements, setReadAnnouncements] = useState([]);

  const isFaculty = user?.role === 'faculty' || user?.role === 'admin' || user?.role === 'super_admin';

  // Persistence Key for Read Status (Per-User to avoid mixups)
  const READ_KEY = `read_broadcasts_${user?.anonymous_id}`;

  // Sync active tab from URL query params (e.g., /chat?tab=academic)
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl === 'academic' && activeTab !== 'academic') {
      setActiveTab('academic');
      setActivePeer(null);
      setActiveAnnouncement(null);
      setIsCreatingBroadcast(false);
    } else if (tabFromUrl === 'announcements' && activeTab !== 'announcements') {
      setActiveTab('announcements');
      setActivePeer(null);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchInitialData();
    // Load local read state
    const saved = localStorage.getItem(READ_KEY);
    if (saved) {
      try {
        setReadAnnouncements(JSON.parse(saved));
      } catch (e) {
        setReadAnnouncements([]);
      }
    }
  }, [user?.anonymous_id]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      // Fetch concurrently but handle failure independently so one doesn't break the other
      const [convRes, annRes] = await Promise.allSettled([
        api.get('/communication/conversations'),
        api.get('/communication/broadcasts')
      ]);

      if (convRes.status === 'fulfilled' && convRes.value.data.success) {
        setConversations(convRes.value.data.data);
      } else if (convRes.status === 'rejected') {
        console.error('Failed to load conversations', convRes.reason);
      }

      if (annRes.status === 'fulfilled' && annRes.value.data.success) {
        setAnnouncements(annRes.value.data.data);
      } else if (annRes.status === 'rejected') {
        console.error('Failed to load announcements', annRes.reason);
      }
    } catch (err) {
      console.error('Critical failure in initial data fetch', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchConversations = async () => {
    try {
      const res = await api.get('/communication/conversations');
      if (res.data.success) {
        setConversations(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load conversations', err);
    }
  };

  useEffect(() => {
    if (!socket) return;

    const onAccepted = (data) => {
      setNotification({ type: 'success', msg: `Your chat request was accepted by ${data.receiver_anonymous_id}!` });
      setTimeout(() => setNotification(null), 4000);
      fetchConversations();
    };

    const onDeclined = (data) => {
      setNotification({ type: 'error', msg: `Your chat request to ${data.receiver_anonymous_id} was declined.` });
      setTimeout(() => setNotification(null), 4000);
    };

    const onBroadcast = (data) => {
      setAnnouncements(prev => [data, ...prev]);
      setNotification({ type: 'success', msg: <> <Megaphone className="w-4 h-4 inline mr-1" /> New announcement from your department!</> });
      setTimeout(() => setNotification(null), 5000);
    };

    socket.on('chat_request:accepted', onAccepted);
    socket.on('chat_request:declined', onDeclined);
    socket.on('system_broadcast', onBroadcast);
    socket.on('conversation:refresh', fetchConversations);

    return () => {
      socket.off('chat_request:accepted', onAccepted);
      socket.off('chat_request:declined', onDeclined);
      socket.off('system_broadcast', onBroadcast);
      socket.off('conversation:refresh', fetchConversations);
    };
  }, [socket]);

  const handleBroadcast = () => {
    if (!socket || !broadcastMsg.trim()) return;
    socket.emit('broadcast_message', { message: broadcastMsg });
    setBroadcastMsg('');
    setIsCreatingBroadcast(false);
    // Faculty also sees their own broadcast locally or via socket?
    // The server emits to the room. If faculty is in the room, they'll see it.
  };

  const modes = [
    {
      id: 'chat_only',
      label: 'Chat Only',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      )
    },
    {
      id: 'study_group',
      label: 'Study Group',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      )
    },
    {
      id: 'campus_meeting',
      label: 'Campus Meeting',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )
    },
  ];

  // Socket listener for real-time sidebar updates
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data) => {
      setConversations((prev) => {
        const foundIndex = prev.findIndex(c => c.peer_anonymous_id === data.sender_anonymous_id || c.peer_anonymous_id === data.receiver_anonymous_id);
        if (foundIndex === -1) return prev;

        const updated = [...prev];
        const conv = updated[foundIndex];

        // Update unread count if we are the receiver and NOT currently viewing this chat
        const isReceiver = data.receiver_anonymous_id === user?.anonymous_id;
        const isNotActive = activePeer?.anonymous_id !== data.sender_anonymous_id;

        updated[foundIndex] = {
          ...conv,
          last_message: data.message,
          last_message_time: data.timestamp,
          unread_count: (isReceiver && isNotActive) ? (conv.unread_count || 0) + 1 : conv.unread_count
        };

        // Move to top
        const item = updated.splice(foundIndex, 1)[0];
        updated.unshift(item);
        return updated;
      });
    };

    socket.on('receive_message', handleNewMessage);
    socket.on('message_sent', handleNewMessage);

    return () => {
      socket.off('receive_message', handleNewMessage);
      socket.off('message_sent', handleNewMessage);
    };
  }, [socket, activePeer, user]);

  return (
    <>
      <Sidebar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:pl-72 bg-slate-100 dark:bg-[#09090e] min-h-screen w-full transition-colors">
        <div className="max-w-5xl mx-auto w-full">

          {/* PAGE HEADER (standardized) */}
          <PageHeader
            title="Peer Chat Workspace"
            subtitle="Trust-Based Secure Dashboard"
            myId={user?.anonymous_id}
          />

          {/* Bounded Main Chat Box */}
          <div className="w-full h-[calc(100vh-190px)] min-h-[500px] bg-white dark:bg-[#111118] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex shadow-2xl text-slate-900 dark:text-white transition-colors">

        {/* Toast Notification */}
        {notification && (
          <div className={`fixed top-4 right-6 z-50 px-5 py-3 rounded-2xl text-sm font-medium shadow-xl border backdrop-blur-md ${
            notification.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
              : 'bg-red-950/80 border-red-500/40 text-red-300'
          }`}>
            {notification.msg}
          </div>
        )}

        {/* MIDDLE PANEL: List View (Hidden when Academic Board is active) */}
        {activeTab !== 'academic' && (
        <div className="w-80 flex-shrink-0 h-full bg-slate-50 dark:bg-[#111118] border-r border-slate-200 dark:border-slate-800 flex flex-col min-w-0 overflow-hidden transition-colors">

          {/* Chats Tab */}
          {activeTab === 'chats' && (
            <>
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h1 className="text-base font-bold tracking-wide">Conversations</h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
                  {conversations.length} Active
                </span>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {isLoading ? (
                  <div className="animate-pulse space-y-2 pt-2 px-2">
                    {[1,2,3,4].map(n => <div key={n} className="h-16 bg-slate-200/70 dark:bg-white/5 rounded-2xl" />)}
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="w-12 h-12 bg-slate-100 dark:bg-white/5 rounded-2xl flex items-center justify-center mb-3 border border-slate-200 dark:border-white/5">
                      <MessageSquare className="w-6 h-6 text-pink-500/80" />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-surface-400">No active chats. Start one from the dashboard or peer board.</p>
                  </div>
                ) : (
                  conversations.map((conv, idx) => {
                    const isActive = activePeer?.anonymous_id === conv.peer_anonymous_id;
                    const time = conv.last_message_time ? new Date(conv.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                    const avatarUrl = `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(conv.peer_anonymous_id || 'peer')}&backgroundColor=transparent`;

                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setActivePeer({
                            anonymous_id: conv.peer_anonymous_id,
                            conversation_id: conv.conversation_id ,
                            department: conv.peer_department,
                            semester: conv.peer_semester,
                            subject_context: conv.subject_context,
                          });
                          setIsCreatingBroadcast(false);
                          setActiveAnnouncement(null);
                          // Clear unread count locally
                          setConversations(prev => prev.map(c => c.conversation_id === conv.conversation_id ? { ...c, unread_count: 0 } : c));
                        }}
                        className={`w-full p-3 rounded-xl transition-all flex items-center space-x-3.5 group border ${
                          isActive
                            ? 'bg-gradient-to-r from-pink-500/10 via-red-500/5 to-transparent border-pink-500/30 shadow-md shadow-pink-500/5'
                            : 'border-transparent hover:bg-slate-100 dark:hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="relative flex-shrink-0">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-[#1c1c28] dark:to-[#12121a] border border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden p-0.5">
                            <img
                              src={avatarUrl}
                              alt="Avatar"
                              className="w-full h-full object-cover"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          </div>
                          {conv.unread_count > 0 && (
                            <span className="absolute -top-1 -right-1 bg-gradient-to-r from-pink-500 to-amber-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#111118] shadow-sm">
                               {conv.unread_count > 9 ? '9+' : conv.unread_count}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 flex flex-col justify-center text-left">
                          <div className="flex justify-between items-center mb-1">
                            <p className="text-sm font-bold text-slate-900 dark:text-white font-mono truncate pr-2 group-hover:text-pink-400 transition-colors">
                               {conv.peer_anonymous_id}
                            </p>
                            <span className={`text-[10px] font-mono whitespace-nowrap ${conv.unread_count > 0 ? 'text-pink-500 dark:text-pink-400 font-bold' : 'text-slate-400 dark:text-surface-500'}`}>
                               {time}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <p className={`text-xs truncate pr-2 ${conv.unread_count > 0 ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-500 dark:text-surface-400'}`}>
                               {conv.subject_context
                                  ? <span className="text-pink-400/90"><span className="text-[9px] font-bold uppercase tracking-wider">Topic:</span> {conv.subject_context}</span>
                                  : conv.last_message || 'Start your conversation...'}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* Announcements Tab */}
          {activeTab === 'announcements' && (
            <>
              <div className="p-4 border-b border-slate-200 dark:border-white/5 flex justify-between items-center">
                <h1 className="text-lg font-bold text-slate-900 dark:text-white">Broadcasts</h1>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                {isFaculty && (
                   <button
                     onClick={() => {
                       setIsCreatingBroadcast(true);
                       setActiveAnnouncement(null);
                       setActivePeer(null);
                     }}
                     className={`w-full p-3 rounded-2xl transition-all flex items-center space-x-3 border ${
                       isCreatingBroadcast
                        ? 'bg-pink-500/10 border-pink-500/30'
                        : 'bg-slate-100 dark:bg-white/[0.02] hover:bg-slate-200 dark:hover:bg-white/[0.05] border-slate-200 dark:border-white/5'
                     }`}
                   >
                     <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-pink-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-pink-500/20">
                        <Plus size={22} />
                     </div>
                     <div className="text-left">
                        <p className="font-bold text-white text-sm">New Broadcast</p>
                        <p className="text-[11px] text-surface-400">Post department bulletin</p>
                     </div>
                   </button>
                )}

                {announcements.map((ann, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setActiveAnnouncement(ann);
                      setIsCreatingBroadcast(false);
                      setActivePeer(null);
                      if (!readAnnouncements.includes(ann.id)) {
                        const updated = [...readAnnouncements, ann.id];
                        setReadAnnouncements(updated);
                        localStorage.setItem(READ_KEY, JSON.stringify(updated));
                      }
                    }}
                    className={`w-full p-3 rounded-2xl transition-all text-left flex items-start space-x-3 relative border ${
                      activeAnnouncement === ann
                        ? 'bg-pink-500/10 border-pink-500/30 shadow-md'
                        : 'border-transparent hover:bg-slate-100 dark:hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 relative flex-shrink-0">
                      <Megaphone size={18} />
                    </div>
                    <div className="min-w-0 flex-1 relative flex flex-col justify-center">
                      <div className="flex justify-between items-start">
                        <p className="text-sm font-bold text-slate-900 dark:text-white font-mono truncate">{ann.sender_anonymous_id || 'Faculty Broadcast'}</p>
                        {!readAnnouncements.includes(ann.id) && (
                          <span className="w-2 h-2 bg-pink-500 rounded-full flex-shrink-0 mt-1 ml-2"></span>
                        )}
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-xs text-slate-500 dark:text-surface-400 truncate">{ann.message}</p>
                        <p className="text-[10px] font-mono text-slate-400 dark:text-surface-500 ml-2 whitespace-nowrap">{new Date(ann.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  </button>
                ))}

                {!isLoading && announcements.length === 0 && (
                   <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="w-12 h-12 bg-slate-100 dark:bg-white/5 rounded-2xl flex items-center justify-center mb-3 border border-slate-200 dark:border-white/5">
                      <Megaphone className="w-6 h-6 text-pink-500/80" />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-surface-400">No broadcasts yet.</p>
                  </div>
                )}
              </div>
            </>
          )}

        </div>
        )}

        {/* RIGHT PANEL: Main Content Area */}
        <div className={`flex-1 min-w-0 h-full relative overflow-hidden ${activeTab === 'academic' ? 'bg-slate-50 dark:bg-[#09090e] overflow-y-auto' : 'bg-slate-50 dark:bg-[#0d0d14] transition-colors'}`}>

          {/* SCENARIO 0: Academic Board (Full Width) */}
          {activeTab === 'academic' ? (
             <div className="w-full h-full overflow-y-auto overflow-x-hidden custom-scrollbar">
                <AcademicBoard />
             </div>
          ) : isCreatingBroadcast ? (
             <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-[#09090e]">
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="max-w-2xl w-full text-center"
                >
                   <div className="w-20 h-20 bg-gradient-to-br from-pink-500/20 to-amber-500/20 border border-pink-500/30 rounded-3xl flex items-center justify-center mx-auto mb-6 text-pink-500 shadow-xl shadow-pink-500/10">
                      <Megaphone size={36} />
                   </div>
                   <h2 className="text-2xl font-bold text-white mb-2">Create Faculty Broadcast</h2>
                   <p className="text-surface-400 mb-8 text-sm">Send an official bulletin instantly to all students in your academic department.</p>

                   <div className="glass-card-brand p-6 rounded-3xl shadow-2xl text-left border border-white/10">
                      <textarea
                        value={broadcastMsg}
                        onChange={(e) => setBroadcastMsg(e.target.value)}
                        placeholder="Type your official broadcast message here..."
                        className="w-full h-40 bg-surface-50 dark:bg-[#09090e] border border-surface-200 dark:border-white/10 rounded-2xl p-4 text-surface-900 dark:text-white placeholder:text-surface-500 focus:ring-2 focus:ring-pink-500 outline-none resize-none text-sm leading-relaxed"
                      />
                      <div className="pt-4 flex items-center justify-between border-t border-surface-200 dark:border-white/10 mt-4">
                         <span className="text-xs text-surface-400 flex items-center gap-1.5">
                           <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                           Encrypted & Verified Faculty Transmission
                         </span>
                         <button
                           onClick={handleBroadcast}
                           disabled={!broadcastMsg.trim()}
                           className="btn-primary text-xs px-6 py-2.5 rounded-xl font-bold transition-all disabled:opacity-50"
                         >
                           Broadcast Now
                         </button>
                      </div>
                   </div>
                </motion.div>
             </div>
          ) : activeAnnouncement ? (
             /* SCENARIO 2: Viewing an Announcement */
             <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-[#09090e]">
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="max-w-2xl w-full"
                >
                   <div className="glass-card-brand rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
                      <div className="p-8 text-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(236,72,153,0.2), rgba(239,68,68,0.15), rgba(245,158,11,0.1))' }}>
                         <div className="w-16 h-16 bg-gradient-to-tr from-pink-500 to-amber-500 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-pink-500/20">
                            <Megaphone size={28} />
                         </div>
                         <span className="inline-block px-3 py-1 bg-pink-500/20 border border-pink-500/30 text-pink-400 text-[10px] font-bold uppercase tracking-widest rounded-full">
                           Official Department Broadcast
                         </span>
                      </div>

                      <div className="p-8">
                         <p className="text-surface-200 text-base leading-relaxed whitespace-pre-wrap mb-8">
                            {activeAnnouncement.message}
                         </p>

                         <div className="flex items-center justify-between border-t border-white/10 pt-6">
                            <div className="flex items-center space-x-3">
                               <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#1c1c28] to-[#12121a] border border-white/10 flex items-center justify-center overflow-hidden p-0.5">
                                 <img
                                   src={`https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(activeAnnouncement.sender_anonymous_id || 'faculty')}&backgroundColor=transparent`}
                                   alt="Avatar"
                                   className="w-full h-full object-cover"
                                 />
                               </div>
                               <div>
                                 <p className="text-sm font-bold text-white font-mono">{activeAnnouncement.sender_anonymous_id || 'System Admin'}</p>
                                 <p className="text-xs text-pink-400 capitalize">{activeAnnouncement.sender_role || 'Faculty Member'}</p>
                               </div>
                            </div>
                            <span className="text-xs text-surface-400 font-mono">
                               {new Date(activeAnnouncement.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                            </span>
                         </div>
                      </div>
                   </div>
                </motion.div>
             </div>
          ) : activePeer ? (
             /* SCENARIO 3: Active Chat */
             <div className="w-full h-full flex flex-col">
                <ChatBox
                  key={(activePeer.conversation_id || activePeer.anonymous_id) + chatMode}
                  peer={activePeer}
                  onClose={() => setActivePeer(null)}
                  initialMode={chatMode}
                  isInline={true}
                />
             </div>
          ) : (
              /* SCENARIO 4: Empty State (Default) */
             <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 bg-slate-50 dark:bg-[#09090e]">
                <div className="w-24 h-24 mb-6 rounded-3xl bg-gradient-to-br from-pink-500/20 via-red-500/10 to-amber-500/20 border border-pink-500/30 flex items-center justify-center shadow-xl shadow-pink-500/10">
                   <MessageSquare className="w-12 h-12 text-pink-500" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                  Peer<span className="brand-text">Bridge</span> Secure Messenger
                </h2>
                <p className="text-slate-500 dark:text-surface-400 max-w-md text-sm leading-relaxed mb-8">
                  Connect anonymously with verified academic peers, share study materials, and access verified department broadcasts.
                </p>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-200/70 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-xs text-slate-600 dark:text-surface-400 font-mono">
                   <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                   Zero-Knowledge Anonymous Encryption Active
                </div>
             </div>
           )}

          </div>
          </div>
        </div>
      </main>
    </>
  );
}
