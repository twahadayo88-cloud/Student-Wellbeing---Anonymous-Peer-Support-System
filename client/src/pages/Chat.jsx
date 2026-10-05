import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Megaphone, MessageSquare, Plus, Users, GraduationCap, Trophy } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import ChatBox from '../components/chat/ChatBox';
import AcademicBoard from './AcademicBoard';
import useAuth from '../hooks/useAuth';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';

export default function Chat() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
      setActivePeer({ 
        anonymous_id: data.receiver_anonymous_id,
        conversation_id: data.request_id // Use request_id sent by backend
      });
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
      <Navbar />
      <main className="min-h-screen pt-20 pb-0 px-0 sm:px-0 lg:px-0 w-full flex bg-surface-50 dark:bg-surface-950">
        
        {/* Toast Notification */}
        {notification && (
          <div className={`fixed top-24 right-6 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg border ${
            notification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 text-emerald-700 dark:text-emerald-400'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 text-red-600'
          }`}>
            {notification.msg}
          </div>
        )}
        
        {/* ULTRA-LEFT ICON SIDEBAR (WhatsApp Style) */}
        <div className="w-16 h-[calc(100vh-5rem)] bg-surface-100 dark:bg-surface-900 border-r border-surface-200 dark:border-surface-800 flex flex-col items-center py-4 space-y-6 flex-shrink-0 z-10">
          <button 
            onClick={() => {
              setActiveTab('chats');
              setIsCreatingBroadcast(false);
              setSearchParams({});
            }}
            className={`p-3 rounded-xl transition-all ${activeTab === 'chats' ? 'bg-primary-500/20 text-primary-500 shadow-inner' : 'text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-100'}`}
            title="Chats"
          >
            <MessageSquare size={24} />
          </button>
          
          <button 
            onClick={() => {
              setActiveTab('announcements');
              setActivePeer(null); // Clear active chat when switching to announcements
              setSearchParams({});
            }}
            className={`p-3 rounded-xl transition-all relative ${activeTab === 'announcements' ? 'bg-primary-500/20 text-primary-500 shadow-inner' : 'text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-100'}`}
            title="Announcements & Communities"
          >
            <Users size={24} />
            {announcements.filter(a => !readAnnouncements.includes(a.id)).length > 0 && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-surface-100 dark:border-surface-900"></span>
            )}
          </button>
          
          <button 
            onClick={() => {
              setActiveTab('academic');
              setActivePeer(null);
              setActiveAnnouncement(null);
              setIsCreatingBroadcast(false);
              setSearchParams({ tab: 'academic' });
            }}
            className={`p-3 rounded-xl transition-all ${activeTab === 'academic' ? 'bg-primary-500/20 text-primary-500 shadow-inner' : 'text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-100'}`}
            title="Academic Board"
          >
            <GraduationCap size={24} />
          </button>

          {/* Leaderboard */}
          <button
            onClick={() => navigate('/leaderboard')}
            className="p-3 rounded-xl transition-all text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-100"
            title="Leaderboard"
          >
            <Trophy size={24} />
          </button>
        </div>

        {/* MIDDLE PANEL: List View (Hidden when Academic Board is active) */}
        {activeTab !== 'academic' && (
        <div className="w-full md:w-80 h-[calc(100vh-5rem)] bg-white dark:bg-surface-900/50 border-r border-surface-200 dark:border-surface-800 flex flex-col flex-shrink-0">
          
          {/* Chats Tab */}
          {activeTab === 'chats' && (
            <>
              <div className="p-4 border-b border-surface-200 dark:border-surface-800">
                <h1 className="text-xl font-bold text-surface-900 dark:text-white">Chats</h1>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {isLoading ? (
                  <div className="animate-pulse space-y-2 pt-2 px-2">
                    {[1,2,3,4].map(n => <div key={n} className="h-16 bg-surface-100 dark:bg-surface-800 rounded-xl" />)}
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <div className="w-12 h-12 bg-surface-100 dark:bg-surface-800 rounded-full flex items-center justify-center mb-3">
                      <MessageSquare className="w-6 h-6 text-surface-400" />
                    </div>
                    <p className="text-xs text-surface-400">No active chats. Start one from the dashboard.</p>
                  </div>
                ) : (
                  conversations.map((conv, idx) => {
                    const isActive = activePeer?.anonymous_id === conv.peer_anonymous_id;
                    const time = conv.last_message_time ? new Date(conv.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                    
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setActivePeer({ 
                            anonymous_id: conv.peer_anonymous_id,
                            conversation_id: conv.conversation_id 
                          });
                          setIsCreatingBroadcast(false);
                          setActiveAnnouncement(null);
                          // Clear unread count locally
                          setConversations(prev => prev.map(c => c.conversation_id === conv.conversation_id ? { ...c, unread_count: 0 } : c));
                        }}
                        className={`w-full p-3 rounded-2xl transition-all flex items-center space-x-4 group ${
                          isActive
                            ? 'bg-surface-100 dark:bg-surface-800/80 shadow-sm'
                            : 'hover:bg-surface-50 dark:hover:bg-surface-800/40'
                        }`}
                      >
                        <div className="relative flex-shrink-0">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-400 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                            {conv.peer_anonymous_id.slice(0, 2).toUpperCase()}
                          </div>
                          {conv.unread_count > 0 && (
                            <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-surface-900 shadow-sm">
                               {conv.unread_count > 9 ? '9+' : conv.unread_count}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 flex flex-col justify-center text-left">
                          <div className="flex justify-between items-center mb-1">
                            <p className="text-[15px] font-bold text-surface-900 dark:text-white truncate pr-2">
                               {conv.peer_anonymous_id}
                            </p>
                            <span className={`text-[11px] whitespace-nowrap ${conv.unread_count > 0 ? 'text-emerald-500 font-bold' : 'text-surface-400 font-medium'}`}>
                               {time}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <p className={`text-sm truncate pr-2 ${conv.unread_count > 0 ? 'text-surface-900 dark:text-surface-100 font-semibold' : 'text-surface-500 dark:text-surface-400'}`}>
                               {conv.last_message || 'Start your conversation...'}
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
              <div className="p-4 border-b border-surface-200 dark:border-surface-800 flex justify-between items-center">
                <h1 className="text-xl font-bold text-surface-900 dark:text-white">Announcements</h1>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                {isFaculty && (
                   <button 
                     onClick={() => {
                       setIsCreatingBroadcast(true);
                       setActiveAnnouncement(null);
                       setActivePeer(null);
                     }}
                     className={`w-full p-3 rounded-2xl transition-all flex items-center space-x-4 ${
                       isCreatingBroadcast 
                        ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800/50' 
                        : 'bg-surface-50 dark:bg-surface-800/40 hover:bg-surface-100 dark:hover:bg-surface-800/80 border border-transparent'
                     }`}
                   >
                     <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-primary-600 dark:text-primary-400">
                        <Plus size={24} />
                     </div>
                     <div className="text-left">
                        <p className="font-bold text-surface-900 dark:text-white text-[15px]">New Announcement</p>
                        <p className="text-xs text-surface-500">Broadcast to your department</p>
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
                    className={`w-full p-3 rounded-2xl transition-all text-left flex items-start space-x-3 relative ${
                      activeAnnouncement === ann
                        ? 'bg-surface-100 dark:bg-surface-800/80 shadow-sm'
                        : 'hover:bg-surface-50 dark:hover:bg-surface-800/40'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 relative flex-shrink-0">
                      <Megaphone size={20} />
                    </div>
                    <div className="min-w-0 flex-1 relative flex flex-col justify-center h-12">
                      <div className="flex justify-between items-start">
                        <p className="text-[15px] font-bold text-surface-900 dark:text-white truncate">{ann.sender_anonymous_id || 'System'}</p>
                        {!readAnnouncements.includes(ann.id) && (
                          <span className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0 mt-1.5 ml-2"></span>
                        )}
                      </div>
                      <div className="flex justify-between items-center mt-0.5">
                        <p className="text-xs text-surface-500 truncate">{ann.message}</p>
                        <p className="text-[10px] text-surface-400 ml-2 whitespace-nowrap">{new Date(ann.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  </button>
                ))}
                
                {!isLoading && announcements.length === 0 && (
                   <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <div className="w-12 h-12 bg-surface-100 dark:bg-surface-800 rounded-full flex items-center justify-center mb-3 text-surface-400">
                      <Megaphone className="w-6 h-6" />
                    </div>
                    <p className="text-xs text-surface-400">No announcements yet.</p>
                  </div>
                )}
              </div>
            </>
          )}

        </div>
        )}

        {/* RIGHT PANEL: Main Content Area */}
        <div className={`flex-1 h-[calc(100vh-5rem)] relative ${activeTab === 'academic' ? 'bg-surface-50 dark:bg-surface-950 overflow-y-auto' : 'bg-surface-50 dark:bg-[#0b141a]'}`}>
          
          {/* SCENARIO 0: Academic Board (Full Width) */}
          {activeTab === 'academic' ? (
             <div className="w-full h-full overflow-y-auto custom-scrollbar">
                <AcademicBoard />
             </div>
          ) : isCreatingBroadcast ? (
             <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-surface-50 dark:bg-[#0b141a]">
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="max-w-2xl w-full text-center"
                >
                   <div className="w-24 h-24 bg-surface-200 dark:bg-surface-800 rounded-full flex items-center justify-center mx-auto mb-8 text-surface-400">
                      <Users size={48} />
                   </div>
                   <h2 className="text-3xl font-light text-surface-900 dark:text-white mb-4">Create Announcement</h2>
                   <p className="text-surface-500 mb-10 text-lg">Send an official announcement to all students in your department.</p>
                   
                   <div className="bg-white dark:bg-surface-900 rounded-2xl shadow-sm border border-surface-200 dark:border-surface-800 overflow-hidden text-left">
                      <textarea
                        value={broadcastMsg}
                        onChange={(e) => setBroadcastMsg(e.target.value)}
                        placeholder="Type your announcement here..."
                        className="w-full h-40 bg-transparent p-6 text-surface-900 dark:text-white focus:ring-0 outline-none resize-none"
                      />
                      <div className="bg-surface-50 dark:bg-surface-800/50 p-4 border-t border-surface-200 dark:border-surface-800 flex justify-end">
                         <button 
                           onClick={handleBroadcast} 
                           disabled={!broadcastMsg.trim()}
                           className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-2.5 rounded-full font-bold transition-colors"
                         >
                           Send
                         </button>
                      </div>
                   </div>
                   <p className="text-xs text-surface-400 mt-6 flex items-center justify-center gap-2">
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                     Announcements are secure and end-to-end delivered
                   </p>
                </motion.div>
             </div>
          ) : activeAnnouncement ? (
             /* SCENARIO 2: Viewing an Announcement */
             <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-surface-50 dark:bg-[#0b141a]">
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="max-w-2xl w-full"
                >
                   <div className="bg-white dark:bg-surface-900 rounded-2xl shadow-sm border border-surface-200 dark:border-surface-800 overflow-hidden">
                      <div className="bg-primary-500 p-8 text-center relative overflow-hidden">
                         <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -translate-y-1/2 translate-x-1/2" />
                         <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-white mx-auto mb-4 backdrop-blur-sm">
                            <Megaphone size={32} />
                         </div>
                         <span className="inline-block px-3 py-1 bg-black/20 text-white text-[10px] font-bold uppercase tracking-widest rounded-full">Official Announcement</span>
                      </div>
                      
                      <div className="p-8">
                         <p className="text-surface-700 dark:text-surface-300 text-lg leading-relaxed whitespace-pre-wrap mb-8">
                            {activeAnnouncement.message}
                         </p>
                         
                         <div className="flex items-center justify-between border-t border-surface-100 dark:border-surface-800 pt-6">
                            <div className="flex items-center space-x-3">
                               <div className="w-10 h-10 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-xs font-bold text-surface-600 dark:text-surface-300">
                                 {activeAnnouncement.sender_anonymous_id?.slice(0, 2).toUpperCase() || 'SYS'}
                               </div>
                               <div>
                                 <p className="text-sm font-bold text-surface-900 dark:text-white">{activeAnnouncement.sender_anonymous_id || 'System Admin'}</p>
                                 <p className="text-xs text-surface-500 capitalize">{activeAnnouncement.sender_role || 'administrator'}</p>
                               </div>
                            </div>
                            <span className="text-xs text-surface-400">
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
                {/* Embedded Header/Modes area could go here, or we pass it to ChatBox */}
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
             <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 border-b-[6px] border-emerald-500">
                <div className="w-64 h-48 mb-8 relative">
                   <div className="absolute inset-0 flex items-center justify-center">
                     <svg viewBox="0 0 100 100" className="w-full h-full text-surface-200 dark:text-surface-800">
                       <circle cx="50" cy="50" r="40" fill="currentColor" />
                       <path d="M30 50h40M50 30v40" stroke="var(--color-surface-50)" strokeWidth="4" />
                     </svg>
                   </div>
                </div>
                <h2 className="text-3xl font-light text-surface-900 dark:text-white mb-4">PeerBridge for Web</h2>
                <p className="text-surface-500 max-w-md text-sm leading-relaxed mb-8">Send and receive messages securely. Coordinate with peers, view department announcements, and stay connected.</p>
                
                <p className="text-xs text-surface-400 flex items-center gap-2 mt-auto">
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                   Your personal messages are end-to-end encrypted
                </p>
             </div>
          )}

        </div>
      </main>
    </>
  );
}
