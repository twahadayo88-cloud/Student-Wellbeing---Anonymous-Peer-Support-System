import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, UserRound, GraduationCap, ShieldCheck, Trash2, Save, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/layout/Navbar';
import PageHeader from '../components/layout/PageHeader';
import useAuth from '../hooks/useAuth';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import BadgeDisplay from '../components/trust/BadgeDisplay';

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { socket, isConnected, connError } = useSocket();
  const isStudent = user?.role === 'student';
  const usesSidebar = isStudent || user?.role === 'faculty';

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

  // GDPR
  const [deleteInput, setDeleteInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const isFaculty = profile?.role === 'faculty' || profile?.role === 'admin' || profile?.role === 'super_admin';
  const isAdminUI = user?.role === 'admin' || user?.role === 'super_admin';

  const handleLogout = () => {
    logout();
    navigate('/');
  };

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

    const onBadgeUpgraded = (data) => {
      setProfile(prev => prev ? { ...prev, badge_tier: data.new_tier } : prev);
    };

    socket.on('profile:data', onProfileData);
    socket.on('profile:error', onProfileError);
    socket.on('badge:tier_upgraded', onBadgeUpgraded);

    return () => {
      socket.off('profile:data', onProfileData);
      socket.off('profile:error', onProfileError);
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
        {usesSidebar ? <Sidebar /> : <Navbar />}
        <main className={`flex min-h-screen items-center justify-center bg-slate-50 dark:bg-[#09090e] ${usesSidebar ? 'ml-16 sm:ml-64' : 'pt-20'}`}>
          <div className="text-center space-y-4">
            <div className="w-10 h-10 rounded-full border-4 border-pink-500 border-t-transparent animate-spin mx-auto" />
            <p className="text-slate-500 dark:text-slate-400">
              {!isConnected && !socketReady
                ? connError ? 'Connection lost — Reconnecting...' : 'Connecting...'
                : 'Loading your profile...'}
            </p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      {usesSidebar ? <Sidebar /> : <Navbar />}
      <main className={`min-h-screen bg-slate-50 pb-16 dark:bg-[#09090e] ${usesSidebar ? 'ml-16 pt-4 sm:ml-64 sm:pt-6' : 'pt-20'}`}>
        <div className="max-w-5xl mx-auto w-full px-4 sm:px-6">
          <motion.div {...fadeUp()}>
            <PageHeader
              title={<>My <span className="brand-text">Profile</span></>}
              subtitle="Manage your academic details, privacy, and account"
              myId={profile?.anonymous_id}
              tone="light"
              actions={(
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 dark:border-red-500/30 dark:bg-white/5 dark:text-red-400 dark:hover:bg-red-500/10 sm:px-4 sm:text-sm"
                  >
                    <LogOut size={16} />
                    <span className="hidden sm:inline">Log out</span>
                  </button>
                </div>
              )}
            />
          </motion.div>

        {/* Reconnecting Banner */}
        {socketReady && !isConnected && (
          <div className="mb-4 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-700 dark:text-amber-400 text-sm flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
            Reconnecting — profile saves will use fallback HTTP mode.
          </div>
        )}

        <motion.form {...fadeUp(0.1)} onSubmit={handleSave} className="space-y-6">
          {/* Identity Section */}
          <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-purple-950/80 via-slate-950 to-pink-950/70 p-6 shadow-2xl sm:p-8">
            <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl" />
            <h2 className="relative mb-5 flex items-center gap-2 text-lg font-extrabold tracking-tight text-white"><UserRound className="h-5 w-5 text-pink-400" /> Identity &amp; Verification</h2>
            <div className="relative flex flex-wrap items-center gap-5">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-pink-400/30 bg-gradient-to-br from-pink-500/20 via-red-500/15 to-amber-500/20 shadow-md shadow-pink-500/20 sm:h-20 sm:w-20">
                <img
                  src={`https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(profile?.anonymous_id || 'PB')}&backgroundColor=transparent`}
                  alt="Your anonymous profile avatar"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="space-y-1">
                <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Autonomous Handle
                </span>
                <span className="font-mono text-base font-extrabold text-white sm:text-lg">
                  {profile?.anonymous_id}
                </span>
              </div>
              {!isAdminUI && (
                <div className="sm:ml-auto">
                  <BadgeDisplay tier={profile?.badge_tier || 'bronze'} size="lg" />
                </div>
              )}
            </div>
          </section>

          {/* Form Fields */}
          {!isAdminUI && (
            <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#111118] sm:p-8">
              <h2 className="mb-2 flex items-center gap-2 text-lg font-extrabold text-slate-900 dark:text-white"><GraduationCap className="h-5 w-5 text-pink-500" /> Academic Data</h2>
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
            <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#111118] sm:p-8">
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mb-2 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-500" /> Privacy &amp; Research Consent</h2>

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
                    className="w-5 h-5 text-pink-500 rounded focus:ring-pink-500"
                  />
                  <div>
                    <p className="text-sm font-bold text-surface-900 dark:text-white">Platform Usage Analytics</p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">Helps us optimize the platform based on anonymous usage.</p>
                  </div>
                </label>
            </section>
          )}

          {error && (
            <div className="p-4 bg-red-500/10 text-red-500 rounded-xl text-xs font-semibold border border-red-500/20">
              {error}
            </div>
          )}
          {success && (
            <div className="p-4 bg-emerald-500/10 text-emerald-500 rounded-xl text-xs font-semibold border border-emerald-500/20">
              {success}
            </div>
          )}

          {!isAdminUI && (
            <button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 py-3.5 font-extrabold text-sm text-white shadow-xl shadow-pink-500/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60">
              <Save className="w-4 h-4" /> {saving ? 'Saving profile…' : 'Save All Preferences'}
            </button>
          )}
        </motion.form>

          {!isAdminUI && (
            <motion.section {...fadeUp(0.3)} className="mt-12 p-6 sm:p-7 rounded-2xl border border-red-500/30 bg-red-500/5 dark:bg-red-500/[0.03]">
              <h2 className="text-base font-extrabold text-red-500 mb-2 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Danger Zone — Terminate Account</h2>
              {profile?.deletion_scheduled_at ? (
                <div className="glass-card p-4 rounded-xl border border-red-500/30 mb-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                      <p className="text-sm font-bold text-red-500">Deletion Scheduled</p>
                      <p className="text-xs text-slate-400">Account will be wiped on {new Date(profile.deletion_scheduled_at).toLocaleString()}</p>
                  </div>
                  <button onClick={handleCancelDeletion} disabled={saving} className="btn-secondary text-xs py-2 px-6 font-bold text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10">Restore Account</button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-400 mb-5">Permanent wipe of all profile records following GDPR compliance window. Type <strong className="text-red-400 font-mono">DELETE</strong> to proceed.</p>
                  <div className="flex flex-wrap gap-4">
                    <input type="text" value={deleteInput} onChange={e => setDeleteInput(e.target.value)} className="input-field border-red-500/30 w-full sm:w-64 font-mono text-sm" placeholder="Type DELETE" />
                    <button
                      onClick={handleDelete}
                      disabled={deleteInput !== 'DELETE' || isDeleting}
                      className="btn-danger flex-1 sm:flex-none py-2.5 px-8 font-bold text-xs"
                    >
                      {isDeleting ? 'Deleting…' : 'Delete Account'}
                    </button>
                  </div>
                </>
              )}
            </motion.section>
          )}
        </div>
      </main>
    </>
  );
}
