/**
 * Footer — site-wide footer.
 */
export default function Footer() {
  return (
    <footer className="border-t border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-[#09090e]/80 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-extrabold text-xs shadow-md shadow-pink-500/20"
              style={{ background: 'linear-gradient(135deg, #ec4899, #ef4444, #f59e0b)' }}
            >
              PB
            </div>
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              <span className="brand-text font-bold">PeerBridge</span> &copy; {new Date().getFullYear()}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wide">
            Anonymous-first <span className="text-pink-500">•</span> Privacy by design <span className="text-pink-500">•</span> Built for student wellbeing
          </p>
        </div>
      </div>
    </footer>
  );
}
