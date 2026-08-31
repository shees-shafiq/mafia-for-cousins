'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '@/context/SocketContext';

const HOLD_DURATION = 1500; // ms

const ROLE_META: Record<
  string,
  { label: string; icon: string; color: string; description: string; isImposter?: boolean }
> = {
  citizen: {
    label: 'Citizen',
    icon: '🛡️',
    color: 'text-blue-400',
    description: 'Find the Imposters and vote them out.',
  },
  imposter: {
    label: 'Imposter',
    icon: '🗡️',
    color: 'text-red-400',
    description: "Blend in. Eliminate Citizens. Don't get caught.",
    isImposter: true,
  },
  doctor: {
    label: 'Doctor',
    icon: '💉',
    color: 'text-emerald-400',
    description: 'Each night, choose one player to protect from death.',
  },
  jester: {
    label: 'Jester',
    icon: '🃏',
    color: 'text-violet-400',
    description: 'Act suspicious. Your goal is to get voted out!',
  },
};

// ─── SVG progress ring ────────────────────────────────────────────────────────
function ProgressRing({ progress }: { progress: number }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  return (
    <svg width="100" height="100" className="absolute inset-0 m-auto -rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#1e1e32" strokeWidth="5" />
      <circle
        cx="50" cy="50" r={r}
        fill="none" stroke="#7c3aed" strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - progress)}
      />
    </svg>
  );
}

export default function RoleReveal() {
  const { myRole, roomState, playerId, advanceToNight } = useSocket();

  const [isFlipped, setIsFlipped] = useState(false);
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const meta = myRole ? (ROLE_META[myRole.role] ?? ROLE_META.citizen) : null;
  const isHost = roomState?.hostId === playerId;
  const isImposterRole = meta?.isImposter ?? false;

  const startHold = useCallback(() => {
    if (isFlipped) return;
    setHolding(true);
    startTimeRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const pct = Math.min((Date.now() - startTimeRef.current) / HOLD_DURATION, 1);
      setProgress(pct);
      if (pct >= 1) {
        clearInterval(intervalRef.current!);
        setIsFlipped(true);
        setHolding(false);
      }
    }, 16);
  }, [isFlipped]);

  const endHold = useCallback(() => {
    if (isFlipped) return;
    clearInterval(intervalRef.current!);
    setHolding(false);
    setProgress(0);
  }, [isFlipped]);

  useEffect(() => () => clearInterval(intervalRef.current!), []);

  if (!meta) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <p className="text-text-muted animate-pulse">Loading your role...</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh night-bg flex flex-col items-center justify-center p-6 gap-8 select-none">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-1"
      >
        <p className="text-xs font-bold text-text-muted uppercase tracking-widest">
          🎭 Role Assignment
        </p>
        <h1 className="text-2xl font-black text-text-primary">Check your role privately</h1>
        <p className="text-sm text-text-secondary">
          Tilt your screen away from others, then hold to reveal.
        </p>
      </motion.div>

      {/* ── 3D Flip Card ──────────────────────────────────────────────────────
          The ONLY correct structure for CSS 3D cards:
          1. Outer container sets perspective.
          2. Inner div has transform-style: preserve-3d and receives the rotateY.
          3. Each face is absolute + backface-visibility: hidden.
          4. The BACK face has an inline transform: rotateY(180deg) so it starts
             face-down. This is what unmirrored text requires.
          5. NO Framer Motion AnimatePresence or conditional rendering inside
             the faces — that re-mounts DOM and breaks the CSS transitions.
      ────────────────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-64 mx-auto"
        style={{ perspective: '1000px' }}
      >
        <motion.div
          className="relative w-full"
          style={{
            transformStyle: 'preserve-3d',
            height: '384px', // h-96
            transition: 'transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1)',
          }}
          animate={{ rotateY: isFlipped ? 180 : 0 }}
        >
          {/* ── FRONT FACE — hold-to-reveal button ── */}
          <div
            className="absolute inset-0 w-full h-full rounded-3xl border-2 border-bg-border
                       bg-bg-card flex flex-col items-center justify-center gap-6 p-8 shadow-lg"
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
          >
            <div className="relative w-24 h-24 flex items-center justify-center">
              {holding && <ProgressRing progress={progress} />}
              <motion.button
                onPointerDown={startHold}
                onPointerUp={endHold}
                onPointerLeave={endHold}
                whileTap={{ scale: 0.92 }}
                className="w-16 h-16 rounded-full bg-accent-violet/20 border-2
                           border-accent-violet/60 flex items-center justify-center
                           cursor-pointer shadow-glow-violet z-10 relative"
              >
                <span className="text-2xl">👁</span>
              </motion.button>
            </div>

            <p className="text-sm font-semibold text-text-secondary text-center">
              {holding ? 'Keep holding...' : 'Press & hold to reveal your role'}
            </p>

            {/* Neutral front — NO role colour bleeding */}
            <span className="text-4xl text-text-muted opacity-20">?</span>
          </div>

          {/* ── BACK FACE — role reveal (pre-rotated 180° so text reads normally) ── */}
          <div
            className={[
              'absolute inset-0 w-full h-full rounded-3xl border-2',
              'flex flex-col items-center justify-center gap-4 p-6',
              isImposterRole
                ? 'bg-red-950 border-red-700/60'
                : myRole?.role === 'doctor'
                ? 'bg-emerald-950 border-emerald-700/60'
                : myRole?.role === 'jester'
                ? 'bg-violet-950 border-violet-700/60'
                : 'bg-blue-950 border-blue-700/60',
            ].join(' ')}
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              // Pre-rotate 180° so the face starts hidden and text is not mirrored
              transform: 'rotateY(180deg)',
              // Imposter glow — only on the back face, never bleeds through
              ...(isImposterRole
                ? { boxShadow: '0 0 40px rgba(220, 38, 38, 0.5)' }
                : {}),
            }}
          >
            <span className="text-6xl">{meta.icon}</span>

            <div className="text-center space-y-1">
              <p className="text-xs font-bold text-white/50 uppercase tracking-widest">
                You are a
              </p>
              <p className={`text-4xl font-black ${meta.color}`}>{meta.label}</p>
              <p className="text-sm text-white/70 leading-snug max-w-[180px]">
                {meta.description}
              </p>
            </div>

            {/* Godfather badge */}
            {myRole?.isBoss && (
              <span className="px-3 py-1 rounded-full bg-yellow-500/20
                               border border-yellow-400/40 text-yellow-300
                               text-xs font-bold">
                👑 You are the Godfather
              </span>
            )}

            {/* Imposter teammates */}
            {myRole?.teammates && myRole.teammates.length > 0 && (
              <div className="w-full space-y-1.5">
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider text-center">
                  Accomplices
                </p>
                {myRole.teammates.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between px-3 py-2 rounded-xl
                               bg-red-900/50 border border-red-700/30"
                  >
                    <span className="text-sm font-semibold text-white">{t.name}</span>
                    {t.isBoss && (
                      <span className="text-xs text-yellow-300">👑</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* CTA / host button — shown after flip */}
      <AnimatePresence>
        {isFlipped && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-xs space-y-3 text-center"
          >
            <p className="text-xs text-text-muted">
              {isHost
                ? 'When everyone has seen their role, begin the night.'
                : 'Waiting for the host to begin the night phase...'}
            </p>
            {isHost && (
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={advanceToNight}
                className="w-full py-4 rounded-2xl bg-accent-violet font-bold text-white text-base
                           shadow-glow-violet hover:bg-accent-violet-light transition-colors"
              >
                🌙 Begin Night
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
