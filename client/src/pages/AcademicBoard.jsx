import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Filter, BookOpen, Users, Star, GraduationCap, CheckCircle } from 'lucide-react';
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

    socket.on('academic:new_request', (data) => {
      setRequests(prev => [data, ...prev]);
      toast(`New ${data.subject} help request!`, { icon: 'ℹ️' });
    });

    socket.on('academic:chat_initiated', (data) => {
      // Refresh requests to update badges/buttons
      fetchRequests();
      toast.success(data.message, { duration: 5000 });
    });

    socket.on('academic:request_updated', (data) => {
      setRequests(prev => prev.map(req => 
        req.id === data.request_id ? { ...req, status: data.status } : req
      ));
    });

    return () => {
      socket.off('academic:new_request');
      socket.off('academic:chat_initiated');
      socket.off('academic:request_updated');
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
      toast.success('Interest sent! Opening chat...');
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
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center">
            <GraduationCap className="w-10 h-10 mr-3 text-indigo-600" />
            Academic Support Board
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Anonymous peer-to-peer academic assistance and mentorship.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {user?.role === 'faculty' && (
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('board')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'board' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600' : 'text-gray-500'}`}
              >
                Board
              </button>
              <button
                onClick={() => setActiveTab('trends')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'trends' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600' : 'text-gray-500'}`}
              >
                Trends
              </button>
            </div>
          )}
          
          {user?.role !== 'faculty' && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
            >
              <Plus className="w-5 h-5 mr-2" />
              Ask for Help
            </button>
          )}
        </div>
      </div>

      {activeTab === 'board' ? (
        <>
          {/* Filters & Actions */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search subject..."
                  className="pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-indigo-500 w-full md:w-64"
                  onChange={(e) => setFilterSubject(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && fetchRequests()}
                />
              </div>
              <select 
                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
              >
                <option value="">All Subjects</option>
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="flex items-center space-x-4">
              {!isHelper ? (
                <button
                  onClick={handleRegisterHelper}
                  className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-4 py-2 rounded-lg transition-colors font-medium"
                >
                  <Star className="w-4 h-4" />
                  <span>Become a Helper</span>
                </button>
              ) : (
                <div className="flex items-center space-x-2 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-lg">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-bold uppercase tracking-tight">Active Helper</span>
                </div>
              )}
            </div>
          </div>

          {/* Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-64 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-2xl" />
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
            <div className="text-center py-20 bg-gray-50 dark:bg-gray-900/30 rounded-3xl">
              <BookOpen className="w-16 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300">No help requests found</h3>
              <p className="text-gray-500">Be the first to ask or try a different filter.</p>
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
  );
};

export default AcademicBoard;
