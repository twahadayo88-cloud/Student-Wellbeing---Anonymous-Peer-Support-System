import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Shield, Ambulance, Siren } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';

export default function SOSButton() {
  const { socket } = useSocket();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [category, setCategory] = useState(null);
  const [countdown, setCountdown] = useState(10);
  const [isDispatched, setIsDispatched] = useState(false);

  useEffect(() => {
    let timer;
    if (category && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (category && countdown === 0) {
      handleDispatch();
    }
    return () => clearInterval(timer);
  }, [category, countdown]);

  const handleDispatch = () => {
    if (socket && category) {
      socket.emit('emergency_sos', { category });
      setIsDispatched(true);
      setTimeout(() => {
        setIsModalOpen(false);
        setCategory(null);
        setCountdown(10);
        setIsDispatched(false);
      }, 3000);
    }
  };

  const cancelSOS = () => {
    setCategory(null);
    setCountdown(10);
    setIsModalOpen(false);
  };

  const categories = [
    { id: 'self-harm', label: 'Self-Harm / Mental Health', icon: Brain },
    { id: 'harassment', label: 'Harassment / Safety', icon: Shield },
    { id: 'medical', label: 'Medical Emergency', icon: Ambulance },
  ];

  return (
    <>
      {/* Floating Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-6 left-6 z-50 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-full font-bold shadow-xl flex items-center space-x-2 border-2 border-white/20"
      >
        <Siren className="w-5 h-5" />
        <span>Crisis Help</span>
      </motion.button>

      {/* Full-Screen Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-red-950/95 backdrop-blur-md flex items-center justify-center p-6 text-center"
          >
            <div className="max-w-md w-full">
              {!category ? (
                <>
                  <h2 className="text-3xl font-black text-white mb-4">Emergency Support</h2>
                  <p className="text-red-200 mb-8">Select a category to notify your department authorities immediately.</p>
                  <div className="space-y-4">
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setCategory(c.id)}
                        className="w-full bg-white/10 hover:bg-white/20 border border-white/20 p-4 rounded-2xl text-white font-bold flex items-center space-x-4 transition-colors"
                      >
                        <c.icon className="w-6 h-6" />
                        <span>{c.label}</span>
                      </button>
                    ))}
                  </div>
                  <button onClick={cancelSOS} className="mt-8 text-white/60 hover:text-white font-medium underline">
                    Close
                  </button>
                </>
              ) : !isDispatched ? (
                <div className="space-y-8">
                  <div className="relative inline-block">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/10" />
                      <circle
                        cx="64"
                        cy="64"
                        r="58"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray={364}
                        strokeDashoffset={364 - (364 * countdown) / 10}
                        className="text-white transition-all duration-1000"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-4xl font-black text-white">{countdown}</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white uppercase tracking-widest">Help is coming...</h3>
                    <p className="text-red-200 mt-2">Dispatching SOS alert in {countdown} seconds.</p>
                  </div>
                  <button
                    onClick={cancelSOS}
                    className="w-full bg-white text-red-600 font-black py-4 rounded-2xl shadow-lg hover:bg-red-50 transition-colors uppercase"
                  >
                    Abort SOS
                  </button>
                </div>
              ) : (
                <div className="py-12">
                   <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/50">
                     <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                     </svg>
                   </div>
                   <h3 className="text-2xl font-black text-white">SOS Dispatched</h3>
                   <p className="text-emerald-200 mt-2">Your department counselor has been notified.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
