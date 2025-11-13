import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

/**
 * Globalni Progress Bar koji pokazuje status učitavanja
 * Koristi framer-motion za glatke animacije
 */

let progressListeners = [];
let currentProgress = 0;
let isLoadingGlobal = false;

// API za kontrolu progress bara iz bilo kojeg dijela app-a
export const ProgressBarAPI = {
  start: () => {
    isLoadingGlobal = true;
    currentProgress = 0;
    progressListeners.forEach(fn => fn({ loading: true, progress: 0 }));
  },
  
  update: (progress) => {
    currentProgress = Math.min(100, Math.max(0, progress));
    progressListeners.forEach(fn => fn({ loading: true, progress: currentProgress }));
  },
  
  complete: () => {
    currentProgress = 100;
    progressListeners.forEach(fn => fn({ loading: true, progress: 100 }));
    
    // Nakon 300ms sakrij progress bar
    setTimeout(() => {
      isLoadingGlobal = false;
      progressListeners.forEach(fn => fn({ loading: false, progress: 0 }));
    }, 300);
  },
  
  reset: () => {
    isLoadingGlobal = false;
    currentProgress = 0;
    progressListeners.forEach(fn => fn({ loading: false, progress: 0 }));
  },
};

export default function ProgressBar() {
  const [state, setState] = useState({ loading: false, progress: 0 });

  useEffect(() => {
    // Registruj listener
    const listener = (newState) => setState(newState);
    progressListeners.push(listener);

    // Cleanup
    return () => {
      progressListeners = progressListeners.filter(fn => fn !== listener);
    };
  }, []);

  return (
    <AnimatePresence>
      {state.loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-50"
        >
          <div className="h-1 bg-gradient-to-r from-transparent via-zinc-800 to-transparent">
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: `${state.progress}%` }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="h-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 shadow-[0_0_10px_rgba(236,72,153,0.5)]"
            />
          </div>
          
          {/* Pulsing glow effect */}
          <motion.div
            initial={{ opacity: 0.3 }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500/20 via-fuchsia-500/20 to-purple-500/20 blur-sm"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Hook za praćenje progress bara u komponentama
 */
export function useProgressBar() {
  return {
    start: ProgressBarAPI.start,
    update: ProgressBarAPI.update,
    complete: ProgressBarAPI.complete,
    reset: ProgressBarAPI.reset,
  };
}

