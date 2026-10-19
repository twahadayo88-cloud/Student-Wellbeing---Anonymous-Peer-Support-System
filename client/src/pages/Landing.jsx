import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, GraduationCap, LockKeyhole, Star, Globe2, HeartHandshake } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] },
});

const features = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    title: 'Anonymous First',
    desc: 'Your real identity stays hidden behind a privacy-first pseudonym. Share freely without fear.',
    accent: 'from-pink-500 to-rose-500',
    glow: 'rgba(236,72,153,0.2)',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: 'Privacy by Design',
    desc: 'GDPR-compliant architecture. End-to-end data safety with zero identity exposure.',
    accent: 'from-red-500 to-orange-500',
    glow: 'rgba(239,68,68,0.2)',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
    title: 'AI Moderation',
    desc: 'Smart content filtering keeps the community safe, supportive, and empowering.',
    accent: 'from-amber-500 to-yellow-400',
    glow: 'rgba(245,158,11,0.2)',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
    title: 'Trust-Based Matching',
    desc: 'Smart peer matching based on subject alignment and verified trust scores.',
    accent: 'from-violet-500 to-purple-500',
    glow: 'rgba(168,85,247,0.2)',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
      </svg>
    ),
    title: 'Academic Support',
    desc: 'Raise help requests, get peer tutoring, and access curated resources anonymously.',
    accent: 'from-emerald-500 to-teal-500',
    glow: 'rgba(16,185,129,0.2)',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    ),
    title: 'Wellbeing Tracker',
    desc: 'Daily mood check-ins and wellbeing insights to help you stay mentally balanced.',
    accent: 'from-rose-500 to-pink-500',
    glow: 'rgba(244,63,94,0.2)',
  },
];

const stats = [
  { value: '10K+', label: 'Students', icon: GraduationCap },
  { value: '98%', label: 'Anonymous', icon: LockKeyhole },
  { value: '4.9', label: 'Community rating', icon: Star },
  { value: '24/7', label: 'Available', icon: Globe2 },
];

/**
 * Landing Page — premium homepage for PeerBridge.
 */
export default function Landing() {
  return (
    <>
      <Navbar />

      {/* ─── Hero Section ─── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16 isolate">
        <div className="absolute inset-0 bg-[#080910]" />
        <div
          className="absolute inset-0 bg-cover bg-center opacity-55"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=2400&q=90')" }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#080910]/55 via-[#080910]/80 to-[#080910]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#080910]/65 via-transparent to-[#080910]/65" />

        {/* Ambient color, subtle grid, and image shading */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="orb orb-pink w-[500px] h-[500px] -top-32 -right-32 opacity-35" />
          <div className="orb orb-red w-[400px] h-[400px] top-1/2 -left-32 opacity-30" style={{ animationDelay: '2s' }} />
          <div className="orb orb-purple w-[300px] h-[300px] bottom-0 right-1/4 opacity-25" style={{ animationDelay: '4s' }} />
          <div className="absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage: 'linear-gradient(rgba(236,72,153,1) 1px, transparent 1px), linear-gradient(90deg, rgba(236,72,153,1) 1px, transparent 1px)',
              backgroundSize: '64px 64px',
            }} />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-20">
          {/* Trust badge */}
          <motion.div {...fadeUp(0)} className="mb-8">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest"
              style={{
                background: 'rgba(236,72,153,0.1)',
                border: '1px solid rgba(236,72,153,0.25)',
                color: '#ec4899',
              }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Anonymous & Secure Platform
            </span>
          </motion.div>

          {/* Main headline */}
          <motion.h1 {...fadeUp(0.1)} className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-slate-900 dark:text-white mb-6 leading-[1.05]">
            Your safe space for
            <br />
            <span className="brand-text">peer support</span>
          </motion.h1>

          {/* Subheading */}
          <motion.p {...fadeUp(0.2)} className="text-lg sm:text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Connect anonymously with fellow students. Share your thoughts, seek support, and help others — all within a secure, privacy-first platform built for student wellbeing.
          </motion.p>

          {/* CTA buttons */}
          <motion.div {...fadeUp(0.3)} className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link to="/register" id="hero-signup" className="btn-primary text-base px-10 py-3.5 rounded-xl">
              Get Started — It's Free
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <Link to="/login" id="hero-login" className="btn-secondary text-base px-10 py-3.5">
              Log In
            </Link>
          </motion.div>

          {/* Stats strip */}
          <motion.div {...fadeUp(0.4)} className="flex flex-wrap justify-center gap-8 mb-20">
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border-white/10 bg-white/[0.06] text-pink-300">
                  <stat.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="text-left">
                  <p className="text-xl font-black text-white leading-none">{stat.value}{stat.label === 'Community rating' ? <span className="text-amber-300">★</span> : null}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{stat.label}</p>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Feature cards */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 text-left"
          >
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.6 + i * 0.08 }}
                className="glass-card p-6 group cursor-default"
                style={{ '--glow': feature.glow }}
              >
                {/* Icon */}
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feature.accent} text-white flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  {feature.icon}
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── CTA Section ─── */}
      <section className="relative overflow-hidden py-24 px-4">
        {/* Background */}
        <div className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, rgba(88,28,135,0.15) 0%, rgba(9,9,14,0.05) 50%, rgba(131,24,67,0.15) 100%)',
          }} />
        <div className="absolute inset-0 dark:block hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(88,28,135,0.3) 0%, #09090e 50%, rgba(131,24,67,0.3) 100%)',
          }} />

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="glass-card p-10 sm:p-14">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-6 flex items-center justify-center text-white shadow-brand"
                style={{ background: 'linear-gradient(135deg, #ec4899, #ef4444, #f59e0b)' }}>
                <HeartHandshake className="w-7 h-7" aria-hidden="true" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mb-4">
                Ready to join PeerBridge?
              </h2>
              <p className="text-slate-500 dark:text-slate-400 mb-8 text-lg leading-relaxed">
                Thousands of students already trust PeerBridge for anonymous peer support. Your journey starts here.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/register" className="btn-primary text-base px-10 py-3.5">
                  Create Free Account
                </Link>
                <Link to="/login" className="btn-secondary text-base px-10 py-3.5">
                  Sign In
                </Link>
              </div>
              <p className="mt-6 text-xs text-slate-400 dark:text-slate-500">
                No real name required. Your privacy is guaranteed.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </>
  );
}
