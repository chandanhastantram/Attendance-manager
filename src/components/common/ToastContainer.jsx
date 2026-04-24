import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Info } from 'lucide-react';
import useToastStore from '../../stores/useToastStore.js';

const icons = { success: Check, error: X, info: Info };
const colors = { success: 'var(--green)', error: 'var(--red)', info: 'var(--primary)' };

export default function ToastContainer() {
  const toasts = useToastStore(s => s.toasts);
  return (
    <div className="toast-wrap">
      <AnimatePresence>
        {toasts.map(t => {
          const Icon = icons[t.type] || icons.info;
          return (
            <motion.div key={t.id} className="toast"
              initial={{ opacity:0, y:-16, scale:0.94 }}
              animate={{ opacity:1, y:0, scale:1 }}
              exit={{ opacity:0, y:-16, scale:0.94 }}
              transition={{ duration:0.2 }}
            >
              <Icon size={17} color={colors[t.type]}/>
              {t.message}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
