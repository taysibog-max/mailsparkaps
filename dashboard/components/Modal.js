import { motion, AnimatePresence } from 'framer-motion';

export default function Modal({ open, onClose, title, children }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center bg-black/60"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="bg-neutral-900 border border-white/10 rounded-2xl p-4 w-[min(92vw,720px)]"
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold">{title}</h3>
              <button className="btn btn-outline" onClick={onClose}>Close</button>
            </div>
            <div className="mt-2">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


