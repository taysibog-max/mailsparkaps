import { motion } from 'framer-motion';

/**
 * Loading Skeleton komponente sa Tailwind i Framer Motion animacijama
 */

export function SkeletonLine({ width = 'w-full', height = 'h-4', className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0.5 }}
      animate={{ opacity: [0.5, 0.8, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      className={`${width} ${height} bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 rounded ${className}`}
    />
  );
}

export function SkeletonCard({ rows = 3 }) {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-4 space-y-3">
      <SkeletonLine width="w-3/4" height="h-5" />
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonLine key={i} width={i % 2 === 0 ? 'w-full' : 'w-5/6'} height="h-4" />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="rounded-lg border border-white/10 divide-y divide-white/5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-3 py-3 flex items-center justify-between">
          <SkeletonLine width="w-1/2" height="h-4" />
          <SkeletonLine width="w-20" height="h-4" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonGrid({ cards = 6, cols = 3 }) {
  return (
    <div className={`grid md:grid-cols-2 xl:grid-cols-${cols} gap-4`}>
      {Array.from({ length: cards }).map((_, i) => (
        <SkeletonCard key={i} rows={2} />
      ))}
    </div>
  );
}

export function SkeletonButton() {
  return (
    <SkeletonLine width="w-32" height="h-10" className="rounded-lg" />
  );
}

/**
 * Animirana loader ikona (spinner)
 */
export function LoadingSpinner({ size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12',
  };

  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      className={`${sizeClasses[size]} ${className}`}
    >
      <svg className="text-fuchsia-500" fill="none" viewBox="0 0 24 24">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </motion.div>
  );
}

