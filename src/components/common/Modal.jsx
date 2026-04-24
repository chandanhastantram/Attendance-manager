import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Modal({ isOpen, onClose, title, children }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="overlay"
          initial={{ opacity:0 }}
          animate={{ opacity:1 }}
          exit={{ opacity:0 }}
          onClick={onClose}
        >
          <motion.div
            className="sheet slide-up"
            initial={{ y:'100%' }}
            animate={{ y:0 }}
            exit={{ y:'100%' }}
            transition={{ type:'spring', damping:28, stiffness:320 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="sheet-handle"/>
            {title && <div className="sheet-title">{title}</div>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
