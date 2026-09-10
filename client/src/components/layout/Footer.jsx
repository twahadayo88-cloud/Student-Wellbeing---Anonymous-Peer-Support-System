/**
 * Footer — site-wide footer.
 */
export default function Footer() {
  return (
    <footer className="border-t border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-bold text-xs">
              PB
            </div>
            <span className="text-sm text-surface-500 dark:text-surface-400">
              PeerBridge &copy; {new Date().getFullYear()}
            </span>
          </div>
          <p className="text-xs text-surface-400 dark:text-surface-500">
            Anonymous-first. Privacy by design. Built for student wellbeing.
          </p>
        </div>
      </div>
    </footer>
  );
}
