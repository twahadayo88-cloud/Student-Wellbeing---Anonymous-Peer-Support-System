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

  useEffect(() => {
    // Load historical messages
    const fetchMessages = async () => {
      // FIX: Strictly skip if we don't have a valid numeric conversation ID
      // Anonymous IDs (like 'SilentFox') are used for identifying peers, NOT for fetching messages.
      if (!peer?.conversation_id) {
         console.warn('ChatBox: Skipping message fetch, no numeric conversation_id provided.');
         return;
      }

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
    if (peer?.conversation_id) fetchMessages();
  }, [peer, socket]);

  useEffect(() => {
    if (!socket || !peer) return;

    const handleReceive = (data) => {
      if (data.sender_anonymous_id === peer.anonymous_id) {
        setMessages((prev) => [...prev, { ...data, direction: 'peer' }]);
        socket.emit('message_seen', { 
          message_id: data.id, 
          sender_anonymous_id: data.sender_anonymous_id 
        });
      }
    };

    const handleSent = (data) => {
      setMessages((prev) => [...prev, { ...data, direction: 'me', seen_at: null }]);
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

    const handleSos = (data) => {
      setError(`EMERGENCY ALERT: ${data.alert}`);
    };

    socket.on('receive_message', handleReceive);
    socket.on('message_sent', handleSent);
    socket.on('message_read', handleMessageRead);
    socket.on('peer_typing_start', handleTyping);
    socket.on('peer_typing_stop', handleTypingStop);
    socket.on('message_error', handleError);
    socket.on('sos_trigger', handleSos);

    return () => {
      socket.off('receive_message', handleReceive);
      socket.off('message_sent', handleSent);
      socket.off('message_read', handleMessageRead);
      socket.off('peer_typing_start', handleTyping);
      socket.off('peer_typing_stop', handleTypingStop);
      socket.off('message_error', handleError);
      socket.off('sos_trigger', handleSos);
    };
  }, [socket, peer]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, error]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;
    socket.emit('send_message', {
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
    if (socket && peer?.anonymous_id) {
      socket.emit('typing_start', { receiver_anonymous_id: peer.anonymous_id });
      clearTimeout(typingStopTimeoutRef.current);
      typingStopTimeoutRef.current = setTimeout(() => {
        socket.emit('typing_stop', { receiver_anonymous_id: peer.anonymous_id });
      }, 1500);
    }
  };

  if (!peer) return null;

  return (
    <motion.div
      initial={isInline ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.95 }}
      animate={isInline ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={isInline ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.95 }}
      className={`${
        isInline 
          ? 'relative w-full h-full' 
          : 'fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-[350px] shadow-2xl z-50 h-[500px] border border-surface-200 dark:border-surface-700 rounded-2xl'
      } glass-card overflow-hidden flex flex-col`}
    >
      {/* Header */}
      <div className="bg-primary-600 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">
            {peer.anonymous_id?.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="text-white font-medium text-sm">Peer #{peer.anonymous_id?.substring(0, 4)}</h3>
            {isTyping ? (
              <p className="text-[10px] text-emerald-300 font-bold tracking-wider animate-pulse">typing...</p>
            ) : (
              <p className="text-[10px] text-primary-100 font-bold uppercase tracking-wider">{initialMode.replace('_', ' ')}</p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={handleReport}
            title="Report User"
            className="text-white/60 hover:text-white transition-colors p-1"
          >
            <Flag className="w-4 h-4" />
          </button>
          <button 
            onClick={handleBlock}
            title="Block User"
            className="text-white/60 hover:text-white transition-colors p-1"
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
            className="text-white/80 hover:text-white transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
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
          <span>Connecting to secure server...</span>
          {connError && <span className="opacity-80 font-normal">{connError}</span>}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-surface-50 dark:bg-surface-900/50 space-y-3">
        {messages.map((msg, idx) => {
          const isMe = msg.direction === 'me';
          return (
            <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  isMe
                    ? 'bg-primary-500 text-white rounded-br-none'
                    : 'bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 rounded-bl-none shadow-sm'
                }`}
              >
                {msg.message}
                <div className={`text-[10px] mt-1 flex items-center justify-end gap-1 ${isMe ? 'text-primary-100' : 'text-surface-400'}`}>
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {isMe && (
                    msg.seen_at
                      ? <CheckCheck className="w-3.5 h-3.5 text-sky-300" />
                      : <Check className="w-3.5 h-3.5 text-primary-200/70" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {isTyping && (
          <div className="flex justify-start">
             <div className="bg-white dark:bg-surface-800 text-surface-500 rounded-2xl rounded-bl-none px-4 py-2 text-sm shadow-sm flex items-center space-x-1">
                <span className="animate-bounce inline-block">.</span>
                <span className="animate-bounce inline-block" style={{ animationDelay: '0.2s' }}>.</span>
                <span className="animate-bounce inline-block" style={{ animationDelay: '0.4s' }}>.</span>
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
            className="bg-red-500 text-white text-xs px-4 py-2 text-center"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 bg-white dark:bg-surface-800 border-t border-surface-200 dark:border-surface-700 flex items-center space-x-2">
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder="Type an anonymous message..."
          className="flex-1 bg-surface-100 dark:bg-surface-900 border-none rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none text-surface-900 dark:text-surface-100"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="bg-primary-500 hover:bg-primary-600 disabled:bg-surface-300 dark:disabled:bg-surface-700 text-white w-9 h-9 rounded-full flex items-center justify-center transition-colors"
        >
          <svg className="w-4 h-4 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </motion.div>
  );
}
