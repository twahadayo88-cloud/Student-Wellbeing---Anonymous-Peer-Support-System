/**
 * Spinner — simple loading indicator.
 */
export default function Spinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-[3px]',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div
      className={`${sizes[size]} border-pink-500/20 border-t-pink-500 border-r-amber-500 rounded-full animate-spin shadow-sm shadow-pink-500/20 ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
