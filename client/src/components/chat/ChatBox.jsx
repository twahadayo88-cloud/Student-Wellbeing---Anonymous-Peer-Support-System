import { useState, useEffect, useRef } from 'react';
import { Flag, Ban, Check, CheckCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../../context/SocketContext';
import useAuth from '../../hooks/useAuth';
import api from '../../services/api';
import FeedbackModal from '../modals/FeedbackModal';

export default function ChatBox({ peer, onClose, initialMode = 'chat_only', isInline = false }) {
  const { user } = useAuth();
  const { socket, isConnected, connError } = useSocket();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const messagesExchanged = messages.length > 0;
  const hasConversation = Number.isInteger(Number(peer?.conversation_id)) && Number(peer?.conversation_id) > 0;

  useEffect(() => {
    setMessages([]);
    setInput('');
    setError(null);
    if (!hasConversation) return;

    // Load historical messages
    const fetchMessages = async () => {

      try {
        const res = await api.get(`/communication/conversations/${peer.conversation_id}/messages`);
        if (res.data.success) {
          setMessages(res.data.data);

          // Emit message_seen for any unread historical messages
          if (socket) {
            res.data.data.forEach(msg => {
              if (msg.direction === 'peer' && !msg.seen_at) {
                socket.emit('message_seen', {
                  message_id: msg.id,
                  sender_anonymous_id: peer.anonymous_id
                });
              }
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch messages', err);
        setError('Connection failed: Unable to retrieve chat history.');
      }
    };
    if (hasConversation) fetchMessages();
  }, [peer, socket, hasConversation]);

  useEffect(() => {
    if (!socket || !peer) return;

    const handleReceive = (data) => {
      if (data.sender_anonymous_id === peer.anonymous_id) {
        setMessages((prev) => [...prev, { ...data, sender: data.sender_anonymous_id, direction: 'peer' }]);
        socket.emit('message_seen', {
          message_id: data.id,
          sender_anonymous_id: data.sender_anonymous_id
        });
      }
    };

    const handleSent = (data) => {
      setMessages((prev) => [...prev, { ...data, sender: data.sender_anonymous_id, direction: 'me', seen_at: null }]);
      setInput(''); // clear input after successfully sent
    };

    // Read receipt: peer has read our message
    const handleMessageRead = (data) => {
      setMessages((prev) => prev.map(msg =>
        msg.id === data.message_id ? { ...msg, seen_at: data.seen_at } : msg
      ));
    };

    const handleTyping = (data) => {
      if (data.sender_anonymous_id === peer.anonymous_id) {
        setIsTyping(true);
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
      }
    };

    const handleTypingStop = (data) => {
      if (data?.sender_anonymous_id === peer.anonymous_id) {
        setIsTyping(false);
      }
    };

    const handleError = (data) => {
      setError(data.error);
      setTimeout(() => setError(null), 4000); // clear error after 4s
    };

    socket.on('receive_message', handleReceive);
    socket.on('message_sent', handleSent);
    socket.on('message_read', handleMessageRead);
    socket.on('peer_typing_start', handleTyping);
    socket.on('peer_typing_stop', handleTypingStop);
    socket.on('message_error', handleError);

    return () => {
      socket.off('receive_message', handleReceive);
      socket.off('message_sent', handleSent);
      socket.off('message_read', handleMessageRead);
      socket.off('peer_typing_start', handleTyping);
      socket.off('peer_typing_stop', handleTypingStop);
      socket.off('message_error', handleError);
    };
  }, [socket, peer]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, error]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;
    if (!hasConversation) {
      setError('This chat is not active yet. Wait for the request to be accepted.');
      return;
    }
    socket.emit('send_message', {
      conversation_id: peer.conversation_id,
      receiver_anonymous_id: peer.anonymous_id,
      message: input,
      chat_mode: initialMode
    });
  };

  const handleBlock = async () => {
    if (!window.confirm("Are you sure you want to block this user? You will no longer receive messages from them.")) return;
    try {
      await api.post('/communication/block', { anonymous_id: peer.anonymous_id });
      setError('User Blocked');
      setTimeout(() => onClose(), 2000);
    } catch (err) {
      setError('Failed to block user');
    }
  };

  const handleReport = async () => {
    const reason = window.prompt("Reason for reporting this user:");
    if (!reason) return;
    try {
      await api.post('/communication/report', { anonymous_id: peer.anonymous_id, reason });
      setError('Report Submitted');
    } catch (err) {
      setError('Failed to report user');
    }
  };

  // Debounced typing indicator — emit typing_start on keypress, typing_stop after 1.5s idle
  const typingStopTimeoutRef = useRef(null);
  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (socket && hasConversation && peer?.anonymous_id) {
      socket.emit('typing_start', { receiver_anonymous_id: peer.anonymous_id });
      clearTimeout(typingStopTimeoutRef.current);
      typingStopTimeoutRef.current = setTimeout(() => {
        socket.emit('typing_stop', { receiver_anonymous_id: peer.anonymous_id });
      }, 1500);
    }
  };

  if (!peer) return null;

  const dicebearUrl = peer.anonymous_id
    ? `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(peer.anonymous_id)}&backgroundColor=transparent`
    : null;

  return (
    <motion.div
      initial={isInline ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.95 }}
      animate={isInline ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={isInline ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.95 }}
      className={`flex flex-col overflow-hidden ${
        isInline
          ? 'relative w-full h-full min-w-0 flex-1 bg-slate-50 dark:bg-[#0d0d14]'
          : 'fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-[360px] shadow-2xl z-50 h-[520px] rounded-2xl bg-slate-100 dark:bg-[#111118] border border-slate-200 dark:border-white/10'
      }`}
    >
      {/* Brand Header — sticky inside right container */}
      <div
        className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between bg-slate-100 dark:bg-[#111118] border-b border-slate-200 dark:border-slate-800 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#09090e] border border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
            {dicebearUrl ? (
              <img src={dicebearUrl} alt={peer.anonymous_id} className="w-full h-full object-cover" />
            ) : (
              <span className="font-mono font-bold text-xs">{peer.anonymous_id?.substring(0, 2).toUpperCase()}</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
            <h3 className="text-slate-900 dark:text-white font-extrabold text-sm tracking-tight font-mono">
              {peer.anonymous_id}
            </h3>
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
            </div>
            {isTyping ? (
              <p className="text-[11px] text-pink-500 dark:text-pink-400 font-bold tracking-wider animate-pulse">typing...</p>
            ) : (
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider truncate max-w-[220px]">
                {[peer.department, peer.semester ? `Sem ${peer.semester}` : null].filter(Boolean).join(' · ') ||
                  initialMode.replace('_', ' ')}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-1 text-slate-500 dark:text-slate-400">
          <button
            onClick={handleReport}
            title="Report User"
            className="hover:text-pink-500 dark:hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10"
          >
            <Flag className="w-4 h-4" />
          </button>
          <button
            onClick={handleBlock}
            title="Block User"
            className="hover:text-pink-500 dark:hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10"
          >
            <Ban className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (messagesExchanged) {
                setShowFeedback(true);
              } else {
                onClose();
              }
            }}
            className="hover:text-pink-500 dark:hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <FeedbackModal
        isOpen={showFeedback}
        onClose={onClose}
        peerAnonymousId={peer.anonymous_id}
        conversationId={peer.conversation_id}
      />

      {!isConnected && (
        <div className="bg-amber-500 text-white text-[11px] text-center py-1 font-semibold flex flex-col">
          <span>Connecting to secure channel...</span>
          {connError && <span className="opacity-80 font-normal">{connError}</span>}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 space-y-4 bg-slate-50 dark:bg-[#0d0d14] transition-colors">
        {messages.map((msg, idx) => {
          const isMe = msg.direction === 'me' || msg.sender === user?.anonymous_id;
          return (
            <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed shadow-md ${
                  isMe
                    ? 'ml-auto text-right bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 text-white rounded-tr-none'
                    : 'mr-auto text-left bg-slate-200 dark:bg-[#1c1c28] border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-gray-200 rounded-tl-none'
                }`}
              >
                {msg.message || msg.text}
                <div className={`text-[10px] mt-1.5 flex items-center justify-end gap-1 ${isMe ? 'text-pink-100' : 'text-slate-500'}`}>
                  {msg.timestamp && (
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  )}
                  {isMe && (
                    msg.seen_at
                      ? <CheckCheck className="w-3.5 h-3.5 text-sky-200" />
                      : <Check className="w-3.5 h-3.5 text-pink-200/70" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {isTyping && (
          <div className="flex justify-start">
             <div className="bg-slate-200 dark:bg-[#1c1c28] border border-slate-300 dark:border-slate-800/80 text-pink-500 rounded-2xl rounded-tl-none px-4 py-2.5 text-sm shadow-sm flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-pink-500 animate-bounce inline-block"></span>
                <span className="w-2 h-2 rounded-full bg-red-500 animate-bounce inline-block" style={{ animationDelay: '0.2s' }}></span>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce inline-block" style={{ animationDelay: '0.4s' }}></span>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-red-500/90 text-white text-xs px-4 py-2 text-center font-medium backdrop-blur-md"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 shrink-0 bg-slate-100 dark:bg-[#111118] border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 transition-colors">
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder={`Message ${peer.anonymous_id}...`}
          className="flex-1 min-w-0 bg-white dark:bg-[#09090e] border border-slate-300 dark:border-slate-800 text-xs px-4 py-3 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-pink-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!input.trim() || !hasConversation}
          className="px-5 py-3 bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl text-xs font-bold text-white hover:opacity-90 transition-opacity flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-pink-500/20"
        >
          Send
        </button>
      </form>
    </motion.div>
  );
}
