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
  const [error, setError] = useState('');

  // Reset state if reopened
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setAgreed(false);
      setError('');
    }
  }, [isOpen]);

  const handleComplete = async () => {
    const trimmedDepartment = department.trim();
    const parsedSemester = Number(semester);
    if (!trimmedDepartment) {
      setError('Enter your department to continue.');
      setStep(2);
      return;
    }
    if (!Number.isInteger(parsedSemester) || parsedSemester < 1 || parsedSemester > 12) {
      setError('Enter a valid semester between 1 and 12.');
      setStep(2);
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      const formData = {
        department: trimmedDepartment,
        semester: parsedSemester,
        subjects,
        consent_data_collection: consentAnalytics,
        consent_mood_tracking: consentMood,
        consent_ai_analysis: consentAnalytics
      };

      await api.post('/profile/complete-onboarding', formData);
      onClose(); // Hide modal, update parent context
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
      setError(err.response?.data?.message || 'Could not save your profile. Please try again.');
      setStep(3);
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

  const dicebearUrl = anonymousId
    ? `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(anonymousId)}&backgroundColor=transparent`
    : null;

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
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-pink-500/20 via-red-500/15 to-amber-500/20 border border-pink-500/30 flex items-center justify-center p-2 mb-1 shadow-lg shadow-pink-500/20">
              {dicebearUrl ? (
                <img src={dicebearUrl} alt={anonymousId} className="w-full h-full object-cover" />
              ) : (
                <span className="font-mono text-pink-500 font-bold">PB</span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Anonymity & Safety
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-relaxed">
              PeerBridge uses strict identity decoupling. Other peers will ONLY see your handle:{' '}
              <span className="font-mono font-bold text-pink-500 bg-pink-500/10 px-2 py-0.5 rounded-md border border-pink-500/20">
                {anonymousId}
              </span>
            </p>
            <ul className="text-left text-xs text-slate-600 dark:text-slate-400 space-y-2.5 bg-slate-100/60 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/5 p-4 rounded-xl w-full">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-500 mt-1 shrink-0" />
                <span>No real names, emails, or personal identifiers in chats.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1 shrink-0" />
                <span>Report harmful content immediately through the platform review flow.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1 shrink-0" />
                <span>Be supportive, constructive, and empathetic to fellow students.</span>
              </li>
            </ul>
            <label className="flex items-center gap-2.5 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                className="w-4 h-4 rounded text-pink-500 focus:ring-pink-500/30 accent-pink-500"
              />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                I agree to the anonymity and safety charter.
              </span>
            </label>
            <button
              disabled={!agreed}
              onClick={() => { setError(''); setStep(2); }}
              className="btn-primary w-full py-2.5 text-xs font-bold disabled:opacity-50"
            >
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
            <div className="text-center">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Academic Profile
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Used strictly to match relevant study peers
              </p>
            </div>
            {error && <p role="alert" className="rounded-lg border-red-500/20 bg-red-500/10 p-2.5 text-xs font-medium text-red-500">{error}</p>}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Department
              </label>
              <input
                type="text"
                value={department}
                onChange={e => { setDepartment(e.target.value); setError(''); }}
                className="input-field w-full text-sm"
                placeholder="e.g. Computer Science & Engineering"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Current Semester
              </label>
              <input
                type="number"
                min="1"
                max="12"
                value={semester}
                onChange={e => { setSemester(e.target.value); setError(''); }}
                className="input-field w-full text-sm font-mono"
                placeholder="1-8"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Subjects / Topics (Max 5)
              </label>
              <input
                type="text"
                value={subjectInput}
                onChange={e => setSubjectInput(e.target.value)}
                onKeyDown={handleAddSubject}
                className="input-field w-full text-sm"
                placeholder="Type topic and press Enter"
              />
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {subjects.map(s => (
                  <span
                    key={s}
                    className="px-2.5 py-1 bg-pink-500/10 dark:bg-pink-500/15 border border-pink-500/30 text-pink-600 dark:text-pink-300 rounded-lg text-xs font-medium flex items-center gap-1.5"
                  >
                    {s}
                    <button type="button" onClick={() => setSubjects(subjects.filter(x => x !== s))}
                             className="text-pink-500 hover:text-red-500 transition-colors"
                           >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
            {error && <p role="alert" className="rounded-lg border-red-500/20 bg-red-500/10 p-2.5 text-xs font-medium text-red-500">{error}</p>}
            <div className="flex gap-3 pt-3">
              <button onClick={() => { setError(''); setStep(1); }} className="btn-secondary flex-1 py-2.5 text-xs font-bold">
                Back
              </button>
              <button
                disabled={!department.trim() || !semester || Number(semester) < 1 || Number(semester) > 12 || !Number.isInteger(Number(semester))}
                onClick={() => { setError(''); setStep(3); }}
                className="btn-primary flex-1 py-2.5 text-xs font-bold disabled:opacity-50"
              >
                Next: Privacy
              </button>
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
            className="flex flex-col space-y-5"
          >
            <div className="text-center">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Privacy Consent
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Granular control over your anonymous insights
              </p>
            </div>
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200/80 dark:border-white/10 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                <input
                  type="checkbox"
                  checked={consentMood}
                  onChange={e => setConsentMood(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded text-pink-500 focus:ring-pink-500/30 accent-pink-500"
                />
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Mood Data Contribution</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Allow aggregated mood scores to be used for campus-wide wellbeing trends.
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200/80 dark:border-white/10 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                <input
                  type="checkbox"
                  checked={consentAnalytics}
                  onChange={e => setConsentAnalytics(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded text-pink-500 focus:ring-pink-500/30 accent-pink-500"
                />
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">System Analytics</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Allow anonymous system usage telemetry for platform optimization.
                  </p>
                </div>
              </label>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center italic">
              You can modify these preferences anytime from your profile.
            </p>
            {error && <p role="alert" className="rounded-lg border-red-500/20 bg-red-500/10 p-2.5 text-xs font-medium text-red-500">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setError(''); setStep(2); }} className="btn-secondary flex-1 py-2.5 text-xs font-bold" disabled={isSubmitting}>
                Back
              </button>
              <button
                onClick={handleComplete}
                disabled={isSubmitting}
                className="btn-primary flex-1 py-2.5 text-xs font-bold"
              >
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
    <div className="modal-overlay flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="w-full max-w-md glass-card-brand rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8 relative border border-white/10"
      >
        {/* Progress Bar */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                i <= step
                  ? 'bg-gradient-to-r from-pink-500 to-amber-500 shadow-sm shadow-pink-500/20'
                  : 'bg-slate-200 dark:bg-white/10'
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {renderStep()}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
