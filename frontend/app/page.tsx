'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Users, ArrowRight, AlertCircle } from 'lucide-react';
import { useSocket } from '@/context/SocketContext';

type View = 'home' | 'join';

// ─── Connection dot ───────────────────────────────────────────────────────────
function ConnectionDot({ connected }: { connected: boolean }) {
  return (
    <div className="fixed top-4 right-4 flex items-center gap-1.5">
      <span
        className={`w-2 h-2 rounded-full ${
          connected ? 'bg-accent-green animate-pulse' : 'bg-accent-red'
        }`}
      />
      <span className="text-[10px] text-text-muted">
        {connected ? 'Connected' : 'Connecting...'}
      </span>
    </div>
  );
}

// ─── Inner component (uses useSearchParams — must be inside <Suspense>) ───────
function LandingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { createRoom, joinRoom, roomCode, error, clearError, isConnected } = useSocket();

  // Read ?code= from URL (set by QR / direct-link flow)
  const prefilledCode = (searchParams.get('code') ?? '').toUpperCase().slice(0, 4);

  const [view, setView] = useState<View>(prefilledCode ? 'join' : 'home');
  const [name, setName] = useState('');
  const [code, setCode] = useState(prefilledCode);
  const [createCode, setCreateCode] = useState('');
  const [localError, setLocalError] = useState('');

  const nameRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  // Auto-focus name field when arriving from a QR/direct-link (join view pre-loaded)
  useEffect(() => {
    if (prefilledCode) {
      nameRef.current?.focus();
    }
  }, [prefilledCode]);

  // Navigate to lobby once we have a room
  useEffect(() => {
    if (roomCode) {
      router.push(`/lobby/${roomCode}`);
    }
  }, [roomCode, router]);

  // Surface server errors
  useEffect(() => {
    if (error) {
      setLocalError(error);
      clearError();
    }
  }, [error, clearError]);

  const validateName = () => {
    const trimmed = name.trim();
    if (!trimmed) { setLocalError('Please enter your name.'); return null; }
    if (trimmed.length < 2) { setLocalError('Name must be at least 2 characters.'); return null; }
    return trimmed;
  };

  const handleCreate = () => {
    const n = validateName();
    if (!n) return;
    const custom = createCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (custom && (custom.length < 3 || custom.length > 6)) {
      setLocalError('Custom code must be 3 to 6 characters (or leave empty).');
      return;
    }
    setLocalError('');
    createRoom(n, custom || undefined);
  };

  const handleJoin = () => {
    const n = validateName();
    if (!n) return;
    const c = code.trim().toUpperCase();
    if (c.length < 3 || c.length > 6) { setLocalError('Room code must be 3 to 6 characters.'); return; }
    setLocalError('');
    joinRoom(n, c);
  };

  return (
    <div className="min-h-dvh ambient-bg flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <ConnectionDot connected={isConnected} />

      {/* Ambient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full
                        bg-accent-violet/8 blur-3xl animate-float" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full
                        bg-accent-red/6 blur-3xl animate-float"
             style={{ animationDelay: '1.5s' }} />
      </div>

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8 space-y-2 select-none"
      >
        <div className="text-6xl animate-float">🎭</div>
        <h1 className="text-3xl font-black text-shimmer tracking-tight">
          Mafia
        </h1>
        <p className="text-xs text-text-muted font-medium">
          The Social Deduction Party Game
        </p>
      </motion.div>

      {/* Card container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="w-full max-w-sm glass-card rounded-3xl p-6 space-y-5"
      >
        {/* Mode tabs */}
        <div className="grid grid-cols-2 p-1 bg-bg-card rounded-2xl border border-bg-border">
          <button
            onClick={() => { setView('home'); setLocalError(''); }}
            className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
              view === 'home'
                ? 'bg-accent-violet text-white shadow-glow-violet'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Create Room
          </button>
          <button
            onClick={() => { setView('join'); setLocalError(''); }}
            className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
              view === 'join'
                ? 'bg-accent-violet text-white shadow-glow-violet'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Join Room
          </button>
        </div>

        {/* QR pre-fill banner */}
        <AnimatePresence>
          {prefilledCode && view === 'join' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl
                         bg-accent-green/10 border border-accent-green/30
                         text-accent-green-light text-xs font-medium"
            >
              <span>📷</span>
              <span>
                Room <strong>{prefilledCode}</strong> pre-filled — just enter your name!
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error banner */}
        <AnimatePresence>
          {localError && !localError.toLowerCase().includes('name') && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl
                         bg-accent-red/10 border border-accent-red/30
                         text-accent-red-light text-xs font-medium"
            >
              <AlertCircle size={14} className="flex-shrink-0" />
              {localError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Name input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
            Your Name
          </label>
          <input
            ref={nameRef}
            type="text"
            value={name}
            maxLength={12}
            onChange={(e) => { setName(e.target.value); setLocalError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && (view === 'join' ? handleJoin() : handleCreate())}
            placeholder="Enter your name..."
            className={`w-full px-4 py-3.5 rounded-xl bg-bg-hover border-2 ${
              localError && (localError.toLowerCase().includes('name') || localError.toLowerCase().includes('taken'))
                ? 'border-accent-red/70 focus:border-accent-red'
                : 'border-bg-border focus:border-accent-violet/60'
            } text-text-primary text-base font-semibold placeholder:text-text-muted focus:outline-none transition-colors`}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <div className="flex justify-between items-center px-0.5">
            {localError && (localError.toLowerCase().includes('name') || localError.toLowerCase().includes('taken')) ? (
              <p className="text-[11px] font-semibold text-accent-red flex items-center gap-1">
                <AlertCircle size={11} />
                Please choose another name or nickname
              </p>
            ) : (
              <span />
            )}
            <p className="text-[10px] text-text-muted">{name.length}/12</p>
          </div>
        </div>

        {/* Custom Room Code (optional for host) */}
        {view === 'home' && (
          <div className="space-y-1.5">
            <div className="flex justify-between items-center px-0.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
                Room Code <span className="text-[10px] lowercase font-normal text-text-muted/80">(optional)</span>
              </label>
              <span className="text-[10px] text-text-muted">Auto-generated if blank</span>
            </div>
            <input
              type="text"
              value={createCode}
              maxLength={6}
              onChange={(e) => {
                setCreateCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                setLocalError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="e.g. COUSIN (3-6 letters)"
              className="w-full px-4 py-3 rounded-xl bg-bg-hover border-2 border-bg-border
                         text-text-primary text-base font-bold uppercase tracking-widest text-center
                         placeholder:text-text-muted placeholder:tracking-normal placeholder:text-xs placeholder:font-normal
                         focus:outline-none focus:border-accent-violet/60 transition-colors"
              autoComplete="off"
            />
          </div>
        )}

        {/* Join code (conditional) */}
        <AnimatePresence>
          {view === 'join' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-1.5 overflow-hidden"
            >
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
                Room Code
              </label>
              <input
                ref={codeRef}
                type="text"
                value={code}
                maxLength={4}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''));
                  setLocalError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                placeholder="ABCD"
                className="w-full px-4 py-3.5 rounded-xl bg-bg-hover border-2 border-bg-border
                           text-text-primary text-2xl font-black tracking-[0.5em] text-center
                           placeholder:text-text-muted placeholder:tracking-normal placeholder:text-base
                           focus:outline-none focus:border-accent-violet/60 transition-colors uppercase"
                autoComplete="off"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Buttons */}
        <div className="space-y-3">
          {view === 'home' ? (
            <>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleCreate}
                disabled={!isConnected}
                className="w-full py-4 rounded-2xl font-bold text-base text-white
                           bg-gradient-to-r from-accent-violet to-accent-violet-light
                           shadow-glow-violet disabled:opacity-40
                           flex items-center justify-center gap-2
                           transition-all"
              >
                <Swords size={18} />
                Create Game
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  setView('join');
                  setTimeout(() => codeRef.current?.focus(), 100);
                }}
                disabled={!isConnected}
                className="w-full py-4 rounded-2xl font-bold text-base
                           bg-bg-card border-2 border-bg-border text-text-secondary
                           disabled:opacity-40
                           flex items-center justify-center gap-2
                           transition-all hover:border-text-muted/40"
              >
                <Users size={18} />
                Join Game
              </motion.button>
            </>
          ) : (
            <>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleJoin}
                disabled={!isConnected}
                className="w-full py-4 rounded-2xl font-bold text-base text-white
                           bg-gradient-to-r from-accent-violet to-accent-violet-light
                           shadow-glow-violet disabled:opacity-40
                           flex items-center justify-center gap-2"
              >
                Join Room
                <ArrowRight size={18} />
              </motion.button>
              {/* Only show Back if this is NOT a prefilled QR-code flow */}
              {!prefilledCode && (
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => { setView('home'); setCode(''); setLocalError(''); }}
                  className="w-full py-3 rounded-2xl text-sm text-text-muted
                             bg-transparent border-2 border-bg-border"
                >
                  ← Back
                </motion.button>
              )}
            </>
          )}
        </div>
      </motion.div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-8 text-xs text-text-muted text-center"
      >
        Best played with 4–20 players in the same room
      </motion.p>
    </div>
  );
}

// ─── Page export — wraps in Suspense (required by useSearchParams in App Router) ─
export default function LandingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh ambient-bg flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-accent-violet border-t-transparent animate-spin" />
        </div>
      }
    >
      <LandingContent />
    </Suspense>
  );
}
