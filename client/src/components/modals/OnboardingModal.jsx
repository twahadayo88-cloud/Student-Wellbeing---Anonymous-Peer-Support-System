import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';

/**
 * 3-Step Smart Onboarding Flow
 * Strictly enforced on first login to ensure maximum anonymity compliance.
 */
export default function OnboardingModal({ isOpen, onClose, anonymousId }) {
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [department, setDepartment] = useState('');
  const [semester, setSemester] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [subjectInput, setSubjectInput] = useState('');
  const [consentMood, setConsentMood] = useState(false);
  const [consentAnalytics, setConsentAnalytics] = useState(false);

  // Reset state if reopened
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setAgreed(false);
    }
  }, [isOpen]);

  const handleComplete = async () => {
    try {
      setIsSubmitting(true);

      const formData = {
        department,
        semester: semester ? parseInt(semester, 10) : null,
        subjects,
        consent_data_collection: consentAnalytics,
        consent_mood_tracking: consentMood,
        consent_ai_analysis: consentAnalytics
      };

      await api.post('/profile/complete-onboarding', formData);
      onClose(); // Hide modal, update parent context
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
      alert('Error saving data. Please check your inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSubject = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = subjectInput.trim();
      if (val && !subjects.includes(val) && subjects.length < 5) {
        setSubjects([...subjects, val]);
        setSubjectInput('');
      }
    }
  };

  if (!isOpen) return null;

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col items-center text-center space-y-4"
          >
            <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-2">
              <svg className="w-8 h-8 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-surface-900 dark:text-white">Anonymity & Safety</h2>
            <p className="text-surface-600 dark:text-surface-400 text-sm">
              PeerBridge uses strict identity decoupling. Other peers will ONLY see your handle: <strong className="text-primary-500">{anonymousId}</strong>.
            </p>
            <ul className="text-left text-xs text-surface-500 space-y-2 bg-surface-50 dark:bg-surface-900 p-4 rounded-xl w-full">
              <li>• No real names or emails in chats.</li>
              <li>• Report harmful content through the platform review flow.</li>
              <li>• Be supportive and empathetic.</li>
            </ul>
            <label className="flex items-center gap-2 cursor-pointer pt-2">
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="rounded text-primary-600" />
              <span className="text-xs text-surface-700 dark:text-surface-300">I agree to the anonymity rules.</span>
            </label>
            <button disabled={!agreed} onClick={() => setStep(2)} className="btn-primary w-full mt-2 disabled:opacity-50">
              Next: Academic Setup
            </button>
          </motion.div>
        );
      case 2:
        return (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col space-y-4"
          >
            <h2 className="text-2xl font-bold text-surface-900 dark:text-white text-center">Academic Profile</h2>
            <div>
              <label className="block text-xs font-bold text-surface-500 uppercase mb-1">Department</label>
              <input type="text" value={department} onChange={e => setDepartment(e.target.value)} className="input-field w-full text-sm" placeholder="e.g. Computer Science" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-surface-500 uppercase mb-1">Semester</label>
                <input type="number" value={semester} onChange={e => setSemester(e.target.value)} className="input-field w-full text-sm" placeholder="1-8" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-surface-500 uppercase mb-1">Subjects (Max 5)</label>
              <input
                type="text"
                value={subjectInput}
                onChange={e => setSubjectInput(e.target.value)}
                onKeyDown={handleAddSubject}
                className="input-field w-full text-sm"
                placeholder="Type and press Enter"
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {subjects.map(s => (
                  <span key={s} className="px-2 py-1 bg-surface-100 dark:bg-surface-800 rounded-md text-[10px] flex items-center gap-1">
                    {s} <button onClick={() => setSubjects(subjects.filter(x => x !== s))} className="text-red-500 hover:text-red-600 transition-colors"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setStep(1)} className="btn-secondary flex-1">Back</button>
              <button disabled={!department || !semester} onClick={() => setStep(3)} className="btn-primary flex-1 disabled:opacity-50">Next: Privacy</button>
            </div>
          </motion.div>
        );
      case 3:
        return (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col space-y-6"
          >
            <h2 className="text-2xl font-bold text-surface-900 dark:text-white text-center">Privacy Consent</h2>
            <div className="space-y-4">
              <label className="flex items-start gap-3 p-3 rounded-xl border border-surface-200 dark:border-surface-800 cursor-pointer hover:bg-surface-50">
                <input type="checkbox" checked={consentMood} onChange={e => setConsentMood(e.target.checked)} className="mt-1 w-4 h-4 text-primary-600 rounded" />
                <div>
                  <h4 className="text-sm font-bold">Mood Data Contribution</h4>
                  <p className="text-[10px] text-surface-500">I allow my anonymized mood scores to be used for campus-wide wellbeing trends.</p>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 rounded-xl border border-surface-200 dark:border-surface-800 cursor-pointer hover:bg-surface-50">
                <input type="checkbox" checked={consentAnalytics} onChange={e => setConsentAnalytics(e.target.checked)} className="mt-1 w-4 h-4 text-primary-600 rounded" />
                <div>
                  <h4 className="text-sm font-bold">System Analytics</h4>
                  <p className="text-[10px] text-surface-500">I allow system usage data to be collected for platform optimization.</p>
                </div>
              </label>
            </div>
            <p className="text-[10px] text-surface-400 text-center italic">You can change these settings anytime in your profile.</p>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setStep(2)} className="btn-secondary flex-1" disabled={isSubmitting}>Back</button>
              <button onClick={handleComplete} disabled={isSubmitting} className="btn-primary flex-1 shadow-lg shadow-primary-500/20">
                {isSubmitting ? 'Finalizing...' : 'Complete Entry'}
              </button>
            </div>
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-950/80 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md bg-white dark:bg-surface-950 rounded-2xl shadow-xl overflow-hidden glass-border p-6"
      >
        {/* Progress Bar */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map(i => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= step ? 'bg-primary-500' : 'bg-surface-200 dark:bg-surface-800'}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {renderStep()}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
