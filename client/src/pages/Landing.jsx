import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, UserRound, Compass, MessageSquare, BookOpen, HeartPulse, HeartHandshake } from 'lucide-react';
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
    desc: 'Connect with a pseudonymous profile so your real name is not shown to other students.',
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
    desc: 'Identity-reveal requests are restricted to administrators and require a second approval.',
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
  { value: 'Private by design', label: 'Anonymous profile', icon: UserRound },
  { value: 'Find your people', label: 'Peer matching', icon: Compass },
  { value: 'Learn together', label: 'Academic support', icon: BookOpen },
  { value: 'Check in with you', label: 'Wellbeing tools', icon: HeartPulse },
];

/**
 * Landing Page — premium homepage for PeerBridge.
 */
export default function Landing() {
  return (
    <>
      <Navbar />

      {/* ─── Hero Section ─── */}
      <section className="relative flex min-h-[calc(100svh-3.75rem)] items-center justify-center overflow-hidden pt-16 isolate">
        <div className="absolute inset-0 bg-[#080910]" />
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-[0.72] motion-reduce:hidden"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        >
          <source src="/landing_background.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-[#080910]/35 via-[#080910]/65 to-[#080910]/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#080910]/45 via-transparent to-[#080910]/45" />

        {/* Ambient color and subtle grid */}
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

        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
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
          <motion.h1 {...fadeUp(0.1)} className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white mb-6 leading-[1.05]">
            Your safe space for
            <br />
            <span className="brand-text">peer support</span>
          </motion.h1>

          {/* Subheading */}
          <motion.p {...fadeUp(0.2)} className="text-lg sm:text-xl text-slate-200 max-w-2xl mx-auto mb-10 leading-relaxed">
            Connect anonymously with fellow students. Share your thoughts, seek support, and help others — all within a secure, privacy-first platform built for student wellbeing.
          </motion.p>

          {/* CTA buttons */}
          <motion.div {...fadeUp(0.3)} className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link to="/register" id="hero-signup" className="btn-primary text-base px-10 py-3.5 rounded-xl">
              Get Started — It&apos;s Free
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <Link to="/login" id="hero-login" className="btn-secondary text-base px-10 py-3.5">
              Log In
            </Link>
          </motion.div>

          {/* Stats strip */}
          <motion.div {...fadeUp(0.4)} className="flex flex-wrap justify-center gap-x-8 gap-y-5">
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border-white/10 bg-white/[0.06] text-pink-300">
                  <stat.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="text-left">
                  <p className="text-sm font-extrabold text-white leading-tight">{stat.value}</p>
                  <p className="text-xs text-slate-200 font-medium">{stat.label}</p>
                </div>
              </div>
            ))}
          </motion.div>

        </div>
      </section>

      {/* ─── How PeerBridge Works ─── */}
      <section className="bg-white px-4 py-20 dark:bg-[#0d0d14] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5 }}
            className="mx-auto mb-12 max-w-2xl text-center"
          >
            <span className="mb-3 inline-flex rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-purple-700 dark:border-purple-500/20 dark:bg-purple-500/10 dark:text-purple-300">
              A simple way to connect
            </span>
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Start with support. Grow together.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:text-base">
              PeerBridge brings anonymous peer connections, study support, and wellbeing tools into one student space.
            </p>
          </motion.div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                number: '01',
                icon: <UserRound className="h-5 w-5" />,
                title: 'Create your private profile',
                description: 'Join with a pseudonymous profile and share only what you are comfortable sharing.',
                color: 'from-pink-500 to-rose-500',
              },
              {
                number: '02',
                icon: <Compass className="h-5 w-5" />,
                title: 'Find the right support',
                description: 'Explore peer matches, academic requests, and shared learning resources.',
                color: 'from-violet-500 to-purple-500',
              },
              {
                number: '03',
                icon: <MessageSquare className="h-5 w-5" />,
                title: 'Connect at your pace',
                description: 'Send a chat request, exchange support, and check in with your wellbeing.',
                color: 'from-amber-500 to-orange-500',
              },
            ].map((step, index) => (
              <motion.article
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80 p-6 dark:border-white/10 dark:bg-white/[0.03] sm:p-7"
              >
                <div className="mb-8 flex items-center justify-between">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${step.color} text-white shadow-lg`}>
                    {step.icon}
                  </div>
                  <span className="font-mono text-sm font-bold tracking-widest text-slate-400 dark:text-slate-600">
                    {step.number}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {step.description}
                </p>
                {index < 2 && (
                  <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-pink-500/5 blur-2xl" />
                )}
              </motion.article>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link to="/register" className="btn-primary inline-flex items-center gap-2">
              Create your free account <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Platform Features ─── */}
      <section className="relative overflow-hidden bg-slate-50 px-4 py-20 dark:bg-[#09090e] sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute -left-40 top-0 h-96 w-96 rounded-full bg-pink-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5 }}
            className="mx-auto mb-10 max-w-2xl text-center"
          >
            <span className="mb-3 inline-flex rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-pink-700 dark:border-pink-500/20 dark:bg-pink-500/10 dark:text-pink-300">
              Built around you
            </span>
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Support for every part of student life
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:text-base">
              A private, supportive space to connect with peers, grow academically, and look after your wellbeing.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <motion.article
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.4, delay: (i % 3) * 0.07 }}
                className="glass-card group rounded-2xl p-6 transition-all hover:-translate-y-1 hover:border-pink-300/70 dark:hover:border-pink-500/30"
              >
                <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${feature.accent} text-white shadow-lg transition-transform duration-300 group-hover:scale-110`}>
                  {feature.icon}
                </div>
                <h3 className="mb-2 text-base font-bold text-slate-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {feature.desc}
                </p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Section ─── */}
      <section className="relative isolate overflow-hidden bg-slate-900 px-4 py-24">
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-90 motion-reduce:hidden"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        >
          <source src="/landing.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-slate-100/55 to-pink-100/60 dark:from-slate-950/45 dark:via-slate-950/50 dark:to-purple-950/55" />

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="glass-card rounded-3xl border border-white/70 bg-white/90 p-8 shadow-2xl dark:border-white/10 dark:bg-[#111118]/90 sm:p-14">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-6 flex items-center justify-center text-white shadow-brand"
                style={{ background: 'linear-gradient(135deg, #ec4899, #ef4444, #f59e0b)' }}>
                <HeartHandshake className="w-7 h-7" aria-hidden="true" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mb-4">
                Ready to join PeerBridge?
              </h2>
              <p className="text-slate-600 dark:text-slate-300 mb-8 text-lg leading-relaxed">
                Find peer connections, academic support, shared resources, and wellbeing tools in one place.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/register" className="btn-primary text-base px-10 py-3.5">
                  Create Free Account
                </Link>
                <Link to="/login" className="btn-secondary text-base px-10 py-3.5">
                  Sign In
                </Link>
              </div>
              <p className="mt-6 text-xs text-slate-600 dark:text-slate-400">
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
