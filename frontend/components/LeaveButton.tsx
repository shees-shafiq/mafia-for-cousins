'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, AlertTriangle, X } from 'lucide-react';
import { useSocket } from '@/context/SocketContext';

export default function LeaveButton({
  isGameActive = false,
  className = '',
}: {
  isGameActive?: boolean;
  className?: string;
}) {
  const [showModal, setShowModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { leaveGame } = useSocket();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleConfirmLeave = () => {
    setShowModal(false);
    leaveGame();
  };

  return (
    <>
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowModal(true)}
        className={[
          'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border',
          'border-accent-red/30 bg-accent-red/10 text-accent-red-light text-xs font-bold',
          'hover:bg-accent-red/20 transition-colors cursor-pointer select-none',
          className,
        ].join(' ')}
        aria-label="Leave game"
      >
        <LogOut size={14} />
        <span>Leave</span>
      </motion.button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {showModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
                onClick={() => setShowModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, y: 16 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 16 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-xs glass-card rounded-3xl p-6 flex flex-col items-center gap-4 text-center relative"
                >
                  {/* Close X */}
                  <button
                    onClick={() => setShowModal(false)}
                    className="absolute top-4 right-4 w-7 h-7 rounded-full bg-bg-hover flex items-center justify-center text-text-muted hover:text-text-primary"
                    aria-label="Close"
                  >
                    <X size={14} />
                  </button>

                  {/* Warning Icon */}
                  <div className="w-12 h-12 rounded-2xl bg-accent-red/15 border border-accent-red/30 flex items-center justify-center text-accent-red">
                    <AlertTriangle size={24} />
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-lg font-black text-text-primary">
                      {isGameActive ? 'Leave Match?' : 'Leave Lobby?'}
                    </h3>
                    <p className="text-xs text-text-muted leading-relaxed">
                      {isGameActive
                        ? 'Are you sure? If a game is active, your character will be eliminated from town.'
                        : 'Are you sure you want to leave the room?'}
                    </p>
                  </div>

                  <div className="w-full space-y-2 pt-2">
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={handleConfirmLeave}
                      className="w-full py-3.5 rounded-xl font-bold text-sm text-white bg-accent-red shadow-glow-red hover:bg-accent-red/90 transition-colors cursor-pointer"
                    >
                      Leave Game
                    </motion.button>
                    <button
                      onClick={() => setShowModal(false)}
                      className="w-full py-3 rounded-xl font-semibold text-xs text-text-muted bg-transparent border border-bg-border hover:bg-bg-hover transition-colors cursor-pointer"
                    >
                      Stay in Game
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
