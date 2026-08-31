'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye } from 'lucide-react';
import { useSocket } from '@/context/SocketContext';

const ROLE_META: Record<
  string,
  { label: string; icon: string; color: string; bg: string; description: string }
> = {
  citizen: {
    label: 'Citizen',
    icon: '🛡️',
    color: 'text-accent-blue',
    bg: 'from-blue-900/40 to-bg-card',
    description: 'Survive and vote out all Imposters.',
  },
  imposter: {
    label: 'Imposter',
    icon: '🗡️',
    color: 'text-accent-red',
    bg: 'from-red-900/40 to-bg-card',
    description: 'Eliminate Citizens without being caught.',
  },
  doctor: {
    label: 'Doctor',
    icon: '💉',
    color: 'text-accent-green',
    bg: 'from-emerald-900/40 to-bg-card',
    description: 'Protect one player from death each night.',
  },
  jester: {
    label: 'Jester',
    icon: '🃏',
    color: 'text-accent-violet-light',
    bg: 'from-violet-900/40 to-bg-card',
    description: 'Win by getting voted out by the town!',
  },
};

export default function RolePeekFAB() {
  const { myRole } = useSocket();
  const [visible, setVisible] = useState(false);

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePressStart = useCallback(() => {
    holdTimer.current = setTimeout(() => setVisible(true), 150);
  }, []);

  const handlePressEnd = useCallback(() => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setVisible(false);
  }, []);

  if (!myRole) return null;

  const meta = ROLE_META[myRole.role] ?? ROLE_META.citizen;

  return (
    <>
      {/* FAB button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 20 }}
        onPointerDown={handlePressStart}
        onPointerUp={handlePressEnd}
        onPointerLeave={handlePressEnd}
        className="fixed bottom-6 right-5 z-50 w-14 h-14 rounded-full
                   bg-bg-card border-2 border-bg-border
                   flex items-center justify-center
                   shadow-glow-violet cursor-pointer select-none
                   active:scale-90 transition-transform"
        aria-label="Hold to peek your role"
      >
        <Eye size={22} className="text-accent-violet-light" />
      </motion.button>

      {/* Overlay */}
      <AnimatePresence>
        {visible && (
          <motion.div
            key="role-peek"
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 flex items-center justify-center
                       bg-black/70 backdrop-blur-sm p-8"
          >
            <div
              className={`w-full max-w-xs rounded-3xl border-2 border-bg-border
                          bg-gradient-to-b ${meta.bg} p-6 flex flex-col items-center gap-4`}
            >
              <span className="text-6xl">{meta.icon}</span>
              <div className="text-center space-y-1">
                <p className="text-xs font-bold text-text-muted uppercase tracking-widest">
                  Your Role
                </p>
                <p className={`text-3xl font-black ${meta.color}`}>{meta.label}</p>
                <p className="text-sm text-text-secondary leading-snug">{meta.description}</p>
              </div>

              {/* Boss badge */}
              {myRole.isBoss && (
                <span className="px-3 py-1 rounded-full bg-accent-yellow/20 border border-accent-yellow/40
                                 text-accent-yellow-light text-xs font-bold">
                  👑 Godfather
                </span>
              )}

              {/* Teammates */}
              {myRole.teammates.length > 0 && (
                <div className="w-full space-y-1.5">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider text-center">
                    Your Team
                  </p>
                  {myRole.teammates.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between px-3 py-2 rounded-xl
                                 bg-accent-red/10 border border-accent-red/20"
                    >
                      <span className="text-sm font-semibold text-text-primary">{t.name}</span>
                      {t.isBoss && (
                        <span className="text-xs text-accent-yellow-light">👑 Boss</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-text-muted mt-2">Release to dismiss</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
