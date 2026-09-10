import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import useAuth from '../hooks/useAuth';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';

export default function Profile() {
  const { user } = useAuth();
  const { socket, isConnected, connError } = useSocket();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [socketReady, setSocketReady] = useState(false);

  // Fields
  const [department, setDepartment] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [subjectInput, setSubjectInput] = useState('');
  const [skills, setSkills] = useState([]);
  const [skillInput, setSkillInput] = useState('');
  const [consentMoodTracking, setConsentMoodTracking] = useState(false);
  const [consentMoodData, setConsentMoodData] = useState(false);
  const [consentAnalytics, setConsentAnalytics] = useState(false);

  // Faculty Fields
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [officeHours, setOfficeHours] = useState([]);
  const [officeHourInput, setOfficeHourInput] = useState('');

  // Student Fields
  const [semester, setSemester] = useState('');

  // Trust Score (real-time)
  const [trustScore, setTrustScore] = useState(50);

  // GDPR
  const [deleteInput, setDeleteInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const isFaculty = profile?.role === 'faculty' || profile?.role === 'admin' || profile?.role === 'super_admin';
  const isAdminUI = user?.role === 'admin' || user?.role === 'super_admin';

  // ─── Hydrate form fields from profile ─────────────────────────────
  const hydrateFromProfile = (p) => {
    setProfile(p);
    setDepartment(p.department || '');
    setSubjects(Array.isArray(p.subjects) ? p.subjects : []);
    setSkills(Array.isArray(p.skills) ? p.skills : []);
    setSemester(p.semester || '');
    setConsentMoodTracking(!!p.consent_mood_tracking);
    setConsentMoodData(!!p.consent_data_collection);
    setConsentAnalytics(!!p.consent_ai_analysis);
    setTrustScore(p.trust_score || 50);

    if (p.role === 'faculty' || p.role === 'admin') {
      setName(p.name || '');
      setDesignation(p.designation || '');
      setOfficeHours(Array.isArray(p.office_hours) ? p.office_hours : []);
    }
  };

  // ─── Socket-based profile fetch ────────────────────────────────────
  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.emit('profile:get');
    setSocketReady(true);

    const onProfileData = (p) => {
      hydrateFromProfile(p);
      setLoading(false);
    };

    const onProfileError = (err) => {
      setError(err.message || 'Failed to load profile data.');
      setLoading(false);
    };

    const onTrustScoreUpdated = (data) => {
      // data.trust_score comes from trust_score:updated
      if (data.trust_score !== undefined) setTrustScore(data.trust_score);
    };

    const onTrustScoreChanged = (data) => {
      // data.new_score comes from trust:score_changed
      if (data.new_score !== undefined) setTrustScore(data.new_score);
      if (data.trust_score !== undefined) setTrustScore(data.trust_score);
    };

    const onBadgeUpgraded = (data) => {
      setProfile(prev => prev ? { ...prev, badge_tier: data.new_tier } : prev);
    };

    socket.on('profile:data', onProfileData);
    socket.on('profile:error', onProfileError);
    socket.on('trust_score:updated', onTrustScoreUpdated);
    socket.on('trust:score_changed', onTrustScoreChanged);
    socket.on('badge:tier_upgraded', onBadgeUpgraded);

    return () => {
      socket.off('profile:data', onProfileData);
      socket.off('profile:error', onProfileError);
      socket.off('trust_score:updated', onTrustScoreUpdated);
      socket.off('trust:score_changed', onTrustScoreChanged);
      socket.off('badge:tier_upgraded', onBadgeUpgraded);
    };
  }, [socket, isConnected]);

  // ─── Save via socket emit + consent via HTTP PATCH ────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = { department, subjects, is_first_login: false };
      if (isFaculty) {
        payload.name = name;
        payload.designation = designation;
        payload.office_hours = officeHours;
      } else {
        payload.skills = skills;
        payload.semester = semester ? parseInt(semester, 10) : null;
      }

      if (socket && isConnected) {
        // Save via socket
        socket.emit('profile:update', payload);
      } else {
        // Fallback to HTTP if socket is down
        await api.put('/profile/update', payload);
      }

      // Consent is always HTTP PATCH (no sensitive real-time handling needed)
      await api.patch('/profile/consent', {
        consent_data_collection: consentMoodData,
        consent_mood_tracking: consentMoodTracking,
        consent_ai_analysis: consentAnalytics,
      });

      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelDeletion = async () => {
    try {
      setSaving(true);
      const res = await api.put('/profile/cancel-deletion');
      if (res.data.success) {
        setProfile(prev => ({ ...prev, deletion_scheduled_at: null }));
        setSuccess('Deletion cancelled! Your account is safe.');
      }
    } catch (err) {
      setError('Failed to cancel deletion.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const res = await api.delete('/profile/delete');
      if (res.data.success) {
        setProfile(prev => ({ ...prev, deletion_scheduled_at: new Date(Date.now() + 72 * 3600000).toISOString() }));
        setSuccess('Account scheduled for deletion (72h window).');
      }
    } catch (err) {
      setError('Deletion request failed.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddTag = (e, setter, items, fieldInput, setFieldInput) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = fieldInput.trim();
      if (val && !items.includes(val) && items.length < 10) {
        setter([...items, val]);
        setFieldInput('');
      }
    }
  };

  const removeTag = (idx, setter, items) => {
    setter(items.filter((_, i) => i !== idx));
  };

  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, delay },
  });

  // ─── Graceful Disconnect Fallback ──────────────────────────────────
  if (loading) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen pt-24 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-10 h-10 rounded-full border-4 border-primary-500 border-t-transparent animate-spin mx-auto" />
            <p className="text-surface-500">
              {!isConnected && !socketReady
                ? connError ? 'Connection lost — Reconnecting...' : 'Connecting...'
                : 'Loading your profile...'}
            </p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">

        {/* Reconnecting Banner */}
        {socketReady && !isConnected && (
          <div className="mb-4 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-700 dark:text-amber-400 text-sm flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
            Reconnecting — profile saves will use fallback HTTP mode.
          </div>
        )}

        <motion.div {...fadeUp()} className="mb-8">
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Profile Settings</h1>
          <p className="text-surface-500 mt-1">Manage your academic and privacy preferences.</p>
        </motion.div>

        <motion.form {...fadeUp(0.1)} onSubmit={handleSave} className="space-y-8">
          {/* Identity Section */}
          <section className="glass-card p-6">
            <h2 className="text-lg font-bold text-surface-900 dark:text-white mb-6">Identity Verification</h2>
            <div className="flex flex-wrap gap-4 items-center">
              <div className="px-3 py-1.5 bg-surface-100 dark:bg-surface-800 rounded-lg">
                <span className="text-[10px] uppercase font-bold text-surface-500 block">Identifier</span>
                <span className="font-mono font-bold text-primary-500">{profile?.anonymous_id}</span>
              </div>
              {!isAdminUI && (
                <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-800/30">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 block">Trust Rating</span>
                  <span className="font-bold text-emerald-600">{trustScore} / 100</span>
                </div>
              )}
            </div>
          </section>

          {/* Form Fields */}
          {!isAdminUI && (
            <section className="glass-card p-6 space-y-6">
              <h2 className="text-lg font-bold text-surface-900 dark:text-white mb-2">Academic Data</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {isFaculty && (
                   <div className="md:col-span-2">
                     <label className="block text-sm font-medium mb-1.5">Official Name</label>
                     <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-field w-full" />
                   </div>
                 )}
                 <div>
                    <label className="block text-sm font-medium mb-1.5">Department</label>
                    <input type="text" value={department} onChange={e => setDepartment(e.target.value)} className="input-field w-full" />
                 </div>
                 {!isFaculty && (
                   <div>
                      <label className="block text-sm font-medium mb-1.5">Current Semester</label>
                      <input type="number" min="1" max="12" value={semester} onChange={e => setSemester(e.target.value)} className="input-field w-full" />
                   </div>
                 )}
                 {isFaculty && (
                   <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1.5">Office Hours (e.g. Mon 10:00 - 12:00)</label>
                      <input
                        type="text"
                        value={officeHourInput}
                        onChange={e => setOfficeHourInput(e.target.value)}
                        onKeyDown={e => handleAddTag(e, setOfficeHours, officeHours, officeHourInput, setOfficeHourInput)}
                        placeholder="Add an office hour slot & Enter"
                        className="input-field w-full mb-2"
                      />
                      <div className="flex flex-wrap gap-2">
                        {officeHours.map((oh, i) => (
                          <div key={i} className="px-3 py-1 bg-surface-100 dark:bg-surface-800 rounded-lg text-xs flex items-center gap-2 border border-surface-200 dark:border-surface-800 text-surface-700 dark:text-surface-300">
                            {oh} <button type="button" onClick={() => removeTag(i, setOfficeHours, officeHours)} className="text-red-500 font-bold hover:bg-red-50 p-0.5 rounded transition-colors"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        ))}
                      </div>
                   </div>
                 )}
              </div>

              {!isAdminUI && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                  <div>
                    <label className="block text-sm font-medium mb-3">Academic Subjects (Max 10)</label>
                    <input
                      type="text"
                      value={subjectInput}
                      onChange={e => setSubjectInput(e.target.value)}
                      onKeyDown={e => handleAddTag(e, setSubjects, subjects, subjectInput, setSubjectInput)}
                      placeholder="Type & press Enter"
                      className="input-field w-full mb-3"
                    />
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {subjects.map((s, i) => (
                        <div key={i} className="flex justify-between items-center p-2.5 bg-surface-50 dark:bg-surface-900 rounded-lg text-sm border border-surface-200 dark:border-surface-800">
                          <span className="text-surface-700 dark:text-surface-300 font-medium">{s}</span>
                          <button type="button" onClick={() => removeTag(i, setSubjects, subjects)} className="text-red-500 hover:text-red-600 font-bold p-1"><X className="w-4 h-4" /></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {!isFaculty && (
                    <div>
                      <label className="block text-sm font-medium mb-3">Personal Skills (Max 10)</label>
                      <input
                        type="text"
                        value={skillInput}
                        onChange={e => setSkillInput(e.target.value)}
                        onKeyDown={e => handleAddTag(e, setSkills, skills, skillInput, setSkillInput)}
                        placeholder="Type & press Enter"
                        className="input-field w-full mb-3"
                      />
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {skills.map((s, i) => (
                          <div key={i} className="flex justify-between items-center p-2.5 bg-primary-50 dark:bg-primary-900/10 rounded-lg text-sm border border-primary-100 dark:border-primary-900/30">
                            <span className="text-primary-700 dark:text-primary-400 font-medium">{s}</span>
                            <button type="button" onClick={() => removeTag(i, setSkills, skills)} className="text-red-500 hover:text-red-600 font-bold p-1"><X className="w-4 h-4" /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {!isAdminUI && (
            <section className="glass-card p-6 space-y-4">
                <h2 className="text-lg font-bold text-surface-900 dark:text-white mb-2">Privacy & Research Consent</h2>

                <label className="flex items-center gap-4 p-4 rounded-xl border border-surface-200 dark:border-surface-800 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-900 transition-colors">
                 <input
                    type="checkbox"
                    checked={consentMoodData}
                    onChange={e => setConsentMoodData(e.target.checked)}
                    className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                 />
                 <div>
                    <p className="text-sm font-bold text-surface-900 dark:text-white">Allow detailed mood analytics</p>
                    <p className="text-xs text-surface-500">Includes optional notes in anonymized wellbeing research.</p>
                 </div>
                </label>

                <label className="flex items-center gap-4 p-4 rounded-xl border border-surface-200 dark:border-surface-800 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-900 transition-colors">
                 <input
                    type="checkbox"
                    checked={consentAnalytics}
                    onChange={e => setConsentAnalytics(e.target.checked)}
                    className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                 />
                 <div>
                    <p className="text-sm font-bold text-surface-900 dark:text-white">Platform Usage Analytics</p>
                    <p className="text-xs text-surface-500">Helps us optimize the platform based on how you use it.</p>
                 </div>
                </label>
            </section>
          )}

          {error && <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl text-sm border border-red-100 dark:border-red-900/30">{error}</div>}
          {success && <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl text-sm border border-emerald-100 dark:border-emerald-900/30">{success}</div>}

          {!isAdminUI && (
            <button type="submit" disabled={saving} className="btn-primary w-full py-3 font-bold shadow-lg shadow-primary-500/20">
              {saving ? 'Synchronizing Profile...' : 'Save All Preferences'}
            </button>
          )}
        </motion.form>

          {!isAdminUI && (
            <motion.section {...fadeUp(0.3)} className="mt-12 p-6 rounded-2xl border border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/10">
              <h2 className="text-lg font-bold text-red-600 mb-2">Terminate Account</h2>
              {profile?.deletion_scheduled_at ? (
                <div className="bg-white dark:bg-surface-950 p-4 rounded-xl border border-red-200 mb-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                      <p className="text-sm font-bold text-red-600">Deletion Scheduled</p>
                      <p className="text-xs text-surface-500">Account will be wiped on {new Date(profile.deletion_scheduled_at).toLocaleString()}</p>
                  </div>
                  <button onClick={handleCancelDeletion} disabled={saving} className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-xs py-2 px-6">Restore Account</button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-surface-500 mb-6">Wipes all data according to GDPR 72-hour window. Type <strong>DELETE</strong> to confirm.</p>
                  <div className="flex flex-wrap gap-4">
                    <input type="text" value={deleteInput} onChange={e => setDeleteInput(e.target.value)} className="input-field border-red-300 w-full sm:w-64" placeholder="Type DELETE" />
                    <button
                      onClick={handleDelete}
                      disabled={deleteInput !== 'DELETE' || isDeleting}
                      className="btn-primary bg-red-600 hover:bg-red-700 disabled:opacity-30 flex-1 sm:flex-none py-2 px-8"
                    >
                      {isDeleting ? 'Processing...' : 'Permanently Delete'}
                    </button>
                  </div>
                </>
              )}
            </motion.section>
          )}
        </main>
      <Footer />
    </>
  );
}
