import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Filter, BookOpen, Users, Star, GraduationCap, CheckCircle } from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/layout/Navbar';
import PageHeader from '../components/layout/PageHeader';
import Footer from '../components/layout/Footer';
import RequestCard from '../components/academic/RequestCard';
import PostRequestModal from '../components/academic/PostRequestModal';
import RequestDetailModal from '../components/academic/RequestDetailModal';
import FacultyTrends from '../components/academic/FacultyTrends';
import api from '../services/api';
import useAuth from '../hooks/useAuth';
import { toast } from 'react-hot-toast';
import { useSocket } from '../context/SocketContext';

const AcademicBoard = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const { socket } = useSocket();
  const [requests, setRequests] = useState([]);
  const [trends, setTrends] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [activeTab, setActiveTab] = useState('board');
  const [filterSubject, setFilterSubject] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isHelper, setIsHelper] = useState(false);

  const subjects = [
    'Computer Science', 'Mathematics', 'Physics', 'Biology',
    'Chemistry', 'Economics', 'Psychology', 'Literature', 'History'
  ];

  useEffect(() => {
    fetchRequests();
    if (user?.role === 'faculty') {
      fetchTrends();
    }
    checkHelperStatus();

    if (!socket) return;

    const onNewRequest = (data) => {
      setRequests(prev => [data, ...prev]);
      toast(`New ${data.subject} help request!`, { icon: 'ℹ️' });
    };

    const onRequestUpdated = (data) => {
      setRequests(prev => prev.map(req =>
        req.id === data.request_id ? { ...req, status: data.status } : req
      ));
    };

    const onRequestsRefresh = () => fetchRequests();
    const onAcademicError = (data) => toast.error(data.message || 'Unable to send help offer');

    socket.on('academic:new_request', onNewRequest);
    socket.on('academic:request_updated', onRequestUpdated);
    socket.on('academic:requests_refresh', onRequestsRefresh);
    socket.on('academic:error', onAcademicError);

    return () => {
      socket.off('academic:new_request', onNewRequest);
      socket.off('academic:request_updated', onRequestUpdated);
      socket.off('academic:requests_refresh', onRequestsRefresh);
      socket.off('academic:error', onAcademicError);
    };
  }, [user, socket]);

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/academic/requests', { params: { subject: filterSubject } });
      setRequests(res.data.data);
    } catch (err) {
      toast.error('Failed to load requests');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTrends = async () => {
    try {
      const res = await api.get('/academic/trends');
      setTrends(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const checkHelperStatus = async () => {
    try {
      // Logic to check if user is registered as helper
      // For now we'll check if they have a listing
      const res = await api.get('/academic/helpers', { params: { my: true } });
      if (res.data.data && res.data.data.length > 0) {
        setIsHelper(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePostRequest = async (data) => {
    try {
      const res = await api.post('/academic/request', data);
      if (res.data.data.moderation.status === 'clean') {
        toast.success('Request posted successfully!');
        fetchRequests();
      } else if (res.data.data.moderation.status === 'hold') {
        toast.warning('Post held for moderation.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to post request');
    }
  };

  const handleOfferHelp = (requestId) => {
    if (socket) {
      socket.emit('academic:offer_help', { request_id: requestId });
      toast.success('Offer sent. Chat opens after the helper accepts.');
    }
  };

  const handleRegisterHelper = async () => {
    try {
      // Placeholder: default subjects
      await api.post('/academic/helper/register', { subjects: ['Computer Science', 'Mathematics'] });
      setIsHelper(true);
      toast.success('Registered as a helper!');
    } catch (err) {
      toast.error('Registration failed');
    }
  };

  return (
    <>
      {isAdmin ? <Navbar /> : <Sidebar />}
      <main className={`min-h-screen px-4 pb-16 sm:px-6 lg:px-8 relative ${isAdmin ? 'pt-24' : 'ml-16 pt-6 sm:ml-64'}`}>
        <div className="max-w-5xl mx-auto w-full">
        {/* PAGE HEADER (standardized) */}
        <PageHeader
          title={
            <span className="flex items-center">
              <div
                className="w-10 h-10 rounded-xl mr-3 flex items-center justify-center text-white shadow-md shadow-pink-500/20 shrink-0"
                style={{ background: 'linear-gradient(135deg, #ec4899, #ef4444, #f59e0b)' }}
              >
                <GraduationCap className="w-6 h-6" />
              </div>
              Academic Support Board
            </span>
          }
          subtitle="Trust-Based Secure Dashboard"
          myId={user?.anonymous_id}
          actions={
            <>
              {user?.role === 'faculty' && (
                <div className="flex bg-slate-100/80 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/10 rounded-xl p-1">
                  <button
                    onClick={() => setActiveTab('board')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                      activeTab === 'board'
                        ? 'btn-primary text-white'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    Board
                  </button>
                  <button
                    onClick={() => setActiveTab('trends')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                      activeTab === 'trends'
                        ? 'btn-primary text-white'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    Trends
                  </button>
                </div>
              )}

              {user?.role !== 'faculty' && (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="btn-primary px-5 py-2.5 rounded-xl font-bold text-xs flex items-center shadow-lg shadow-pink-500/20"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Ask for Help
                </button>
              )}
            </>
          }
        />

        {activeTab === 'board' ? (
          <>
            {/* Filters & Actions */}
            <div className="glass-card rounded-2xl p-4 sm:p-5 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-white/10">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search subject..."
                    className="input-field pl-9 py-2 text-xs w-full md:w-64"
                    onChange={(e) => setFilterSubject(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && fetchRequests()}
                  />
                </div>
                <select 
                  className="input-field py-2 text-xs"
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                >
                  <option value="">All Subjects</option>
                  {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="flex items-center space-x-3">
                {!isHelper ? (
                  <button
                    onClick={handleRegisterHelper}
                    className="flex items-center space-x-2 text-pink-600 dark:text-pink-400 hover:bg-pink-500/10 px-4 py-2 rounded-xl transition-colors text-xs font-bold border border-pink-500/20"
                  >
                    <Star className="w-4 h-4" />
                    <span>Become a Helper</span>
                  </button>
                ) : (
                  <div className="flex items-center space-x-2 text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-xl">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wide">Active Helper</span>
                  </div>
                )}
              </div>
            </div>

            {/* Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="h-64 glass-card animate-pulse rounded-2xl" />
                ))}
              </div>
            ) : requests.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {requests.map((request) => (
                  <RequestCard 
                    key={request.id} 
                    request={request} 
                    onOfferHelp={handleOfferHelp}
                    onViewDetail={(r) => setSelectedRequest(r)}
                    isHelper={isHelper}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 glass-card rounded-3xl border border-white/10">
                <BookOpen className="w-14 h-14 text-pink-500/40 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">No help requests found</h3>
                <p className="text-xs text-slate-400 mt-1">Be the first to ask or choose a different subject filter.</p>
              </div>
            )}
          </>
        ) : (
          <FacultyTrends data={trends} />
        )}

        <PostRequestModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handlePostRequest}
        />

        <RequestDetailModal
          isOpen={!!selectedRequest}
          onClose={() => setSelectedRequest(null)}
          request={selectedRequest}
          onOfferHelp={handleOfferHelp}
          isHelper={isHelper}
        />
        </div>
      </main>
      <Footer />
    </>
  );
};

export default AcademicBoard;
