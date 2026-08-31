'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Check } from 'lucide-react';
import { useSocket } from '@/context/SocketContext';
import PlayerGrid from './PlayerGrid';
import type { PublicPlayer } from '@/types/game';

// ─── Sub-views ────────────────────────────────────────────────────────────────

/** Tapping sequence view — one tile highlighted at a time */
function TappingView({
  decoySequence,
  players,
  currentIndex,
  onTap,
}: {
  decoySequence: string[];
  players: PublicPlayer[];
  currentIndex: number;
  onTap: (player: PublicPlayer) => void;
}) {
  const currentDecoyId = decoySequence[currentIndex];
  const remaining = decoySequence.length - currentIndex;

  return (
    <div className="flex flex-col gap-5">
      {/* Progress pills */}
      <div className="flex gap-1.5 justify-center">
        {decoySequence.map((_, i) => (
          <motion.span
            key={i}
            animate={{
              backgroundColor:
                i < currentIndex ? '#10b981' : i === currentIndex ? '#f59e0b' : '#1e1e32',
            }}
            className="h-2 rounded-full flex-1 max-w-[32px]"
          />
        ))}
      </div>

      <p className="text-center text-xs font-semibold text-text-muted">
        Tap the{' '}
        <span className="text-accent-yellow-light font-bold">highlighted</span> player
        {remaining > 1 ? ` (${remaining} remaining)` : ''}
      </p>

      <PlayerGrid
        players={players}
        mode="decoy"
        highlightId={currentDecoyId}
        onTap={onTap}
      />
    </div>
  );
}

/** Universal Neutral Action View with Dynamic Morphing Action Button */
function UniversalActionView({
  players,
  myId,
  role,
  selectedTargetId,
  onSelectTarget,
  onSubmitAction,
  waitingCount,
  totalCount,
}: {
  players: PublicPlayer[];
  myId: string;
  role: string;
  selectedTargetId: string | null;
  onSelectTarget: (player: PublicPlayer) => void;
  onSubmitAction: () => void;
  waitingCount: number;
  totalCount: number;
}) {
  const isImposter = role === 'imposter';
  // Imposters cannot target themselves; Doctors and Citizens/Jesters (fake) can tap anyone
  const activeIds = isImposter
    ? players.filter((p) => p.isAlive && p.id !== myId).map((p) => p.id)
    : players.filter((p) => p.isAlive).map((p) => p.id);

  const isSelected = selectedTargetId !== null;

  return (
    <div className="flex flex-col gap-5 pb-24">
      <PlayerGrid
        players={players}
        mode="target"
        myId={myId}
        activeIds={activeIds}
        selectedId={selectedTargetId}
        onTap={onSelectTarget}
      />

      {/* Floating Bottom Bar with Dynamic Morphing Button */}
      <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-bg-primary via-bg-primary/95 to-transparent backdrop-blur-sm z-30 flex flex-col items-center gap-2 max-w-md mx-auto">
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={onSubmitAction}
          className={[
            'w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2.5 select-none transition-all duration-200 cursor-pointer',
            isSelected
              ? 'bg-gradient-to-r from-accent-violet to-accent-violet-light text-white shadow-glow-violet border-2 border-accent-violet-light/50'
              : 'bg-bg-card border-2 border-indigo-500/40 text-text-primary hover:border-indigo-400/60 shadow-lg shadow-indigo-950/40',
          ].join(' ')}
        >
          {isSelected ? (
            <>
              <Check size={20} strokeWidth={3} />
              <span>Confirm Selection</span>
            </>
          ) : (
            <>
              <Moon size={18} className="text-indigo-400" />
              <span>Sleep</span>
            </>
          )}
        </motion.button>

        <p className="text-[11px] text-text-muted text-center font-medium">
          {waitingCount}/{totalCount} players still deciding
        </p>
      </div>
    </div>
  );
}

/** Submitted view — waiting for others */
function SubmittedView({
  players,
  myId,
}: {
  players: PublicPlayer[];
  myId: string;
}) {
  const submitted = players.filter((p) => p.isAlive && p.hasSubmittedAction).length;
  const total = players.filter((p) => p.isAlive).length;

  return (
    <div className="flex flex-col items-center gap-6">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 280 }}
        className="text-5xl"
      >
        ✅
      </motion.div>
      <div className="text-center space-y-1">
        <p className="font-bold text-text-primary text-lg">Action submitted</p>
        <p className="text-text-muted text-sm">Waiting for everyone to finish...</p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xs space-y-2">
        <div className="flex justify-between text-xs text-text-muted">
          <span>Players submitted</span>
          <span className="font-bold text-text-secondary">
            {submitted}/{total}
          </span>
        </div>
        <div className="h-2 bg-bg-border rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(submitted / total) * 100}%` }}
            className="h-full bg-accent-violet rounded-full"
          />
        </div>
      </div>

      {/* Dimmed player grid for context */}
      <PlayerGrid players={players} mode="disabled" myId={myId} />
    </div>
  );
}

// ─── Main DecoyTapper Component ───────────────────────────────────────────────

type NightUiPhase = 'tapping' | 'choosing' | 'submitted';

export default function DecoyTapper() {
  const {
    roomState,
    myRole,
    myDecoySequence,
    playerId,
    isDecoysComplete,
    isActionSubmitted,
    onDecoySequenceComplete,
    submitNightAction,
  } = useSocket();

  const [uiPhase, setUiPhase] = useState<NightUiPhase>('tapping');
  const [decoyIndex, setDecoyIndex] = useState(0);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  const players = roomState?.players ?? [];
  const decoySequence = myDecoySequence ?? [];
  const role = myRole?.role ?? 'citizen';

  const livingPlayers = players.filter((p) => p.isAlive);
  const pendingCount = livingPlayers.filter((p) => !p.hasSubmittedAction).length;
  const totalLiving = livingPlayers.length;

  // Sync from context (handles reconnect mid-night)
  useEffect(() => {
    if (isActionSubmitted) {
      setUiPhase('submitted');
    } else if (isDecoysComplete && uiPhase === 'tapping') {
      setUiPhase('choosing');
    }
  }, [isDecoysComplete, isActionSubmitted, uiPhase]);

  const handleDecoyTap = useCallback(
    (player: PublicPlayer) => {
      if (uiPhase !== 'tapping') return;
      if (player.id !== decoySequence[decoyIndex]) return; // wrong tile — ignore

      const nextIndex = decoyIndex + 1;
      setDecoyIndex(nextIndex);

      if (nextIndex >= decoySequence.length) {
        // All decoys done — transition to universal action selection
        setUiPhase('choosing');
        onDecoySequenceComplete();
      }
    },
    [uiPhase, decoySequence, decoyIndex, onDecoySequenceComplete]
  );

  const handleSelectTarget = useCallback(
    (player: PublicPlayer) => {
      if (uiPhase !== 'choosing') return;
      // Toggle selection or select new target
      setSelectedTargetId((prev) => (prev === player.id ? null : player.id));
    },
    [uiPhase]
  );

  const handleSubmitAction = useCallback(() => {
    if (uiPhase !== 'choosing') return;
    setUiPhase('submitted');
    // If a target is selected, submits target ID; if null, submits sleep (null)
    submitNightAction(selectedTargetId);
  }, [uiPhase, selectedTargetId, submitNightAction]);

  if (!playerId) return null;

  return (
    <div className="min-h-dvh night-bg flex flex-col">
      {/* Header */}
      <div className="px-5 pt-4 pb-3">
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-xl font-black text-text-primary"
        >
          {uiPhase === 'tapping'
            ? 'Complete your task...'
            : uiPhase === 'submitted'
            ? 'Resting...'
            : 'Choose your target...'}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="text-xs text-text-muted mt-0.5"
        >
          {uiPhase === 'tapping'
            ? 'Tap the glowing name to proceed.'
            : uiPhase === 'choosing'
            ? selectedTargetId
              ? 'Tap Confirm Selection or tap name again to deselect.'
              : 'Select a player to target, or tap Sleep.'
            : 'Waiting for dawn to break...'}
        </motion.p>
      </div>

      {/* Content area */}
      <div className="flex-1 px-5 pb-28">
        <AnimatePresence mode="wait">
          {uiPhase === 'tapping' && (
            <motion.div
              key="tapping"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <TappingView
                decoySequence={decoySequence}
                players={players}
                currentIndex={decoyIndex}
                onTap={handleDecoyTap}
              />
            </motion.div>
          )}

          {uiPhase === 'choosing' && (
            <motion.div
              key="universal-action"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <UniversalActionView
                players={players}
                myId={playerId}
                role={role}
                selectedTargetId={selectedTargetId}
                onSelectTarget={handleSelectTarget}
                onSubmitAction={handleSubmitAction}
                waitingCount={pendingCount}
                totalCount={totalLiving}
              />
            </motion.div>
          )}

          {uiPhase === 'submitted' && (
            <motion.div
              key="submitted"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <SubmittedView players={players} myId={playerId} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
