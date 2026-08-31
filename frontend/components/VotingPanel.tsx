'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Flag, SkipForward, Check, Lock } from 'lucide-react';
import { useSocket } from '@/context/SocketContext';
import PlayerGrid from './PlayerGrid';
import type { PublicPlayer } from '@/types/game';

export default function VotingPanel() {
  const {
    roomState,
    playerId,
    myRole,
    submitDayVote,
    callEndGame,
    endGameVoteCount,
    endGameVoteRequired,
    voteProgress,
  } = useSocket();

  const [selectedVoteId, setSelectedVoteId] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [hasCalledEnd, setHasCalledEnd] = useState(false);

  const players = roomState?.players ?? [];
  const voteCounts = roomState?.voteCounts ?? {};
  const config = roomState?.config;
  const isSecretMode = config?.revealMode === 'secret';
  const isJester = myRole?.role === 'jester';

  const livingPlayers = players.filter((p) => p.isAlive);
  const me = players.find((p) => p.id === playerId);
  const iAmAlive = me?.isAlive ?? false;

  // Wipe local UI state when the server confirms this player hasn't voted yet (e.g., a new day begins)
  useEffect(() => {
    if (me && !me.hasVoted) {
      setHasVoted(false);
      setSelectedVoteId(null);
      setHasCalledEnd(false);
    }
  }, [me?.hasVoted]);

  // Track if current player has locked in their vote
  const isAlreadyVoted = hasVoted || (me?.hasVoted ?? false);

  // Live Progress calculation synced with all votes and skips
  const totalNeeded = voteProgress?.totalNeeded ?? livingPlayers.length;
  const rawVotesCast =
    voteProgress?.votesCast ??
    roomState?.totalVotesCast ??
    livingPlayers.filter((p) => p.hasVoted).length;

  // Optimistic minimum if player has voted locally
  const votesCast = isAlreadyVoted ? Math.max(rawVotesCast, 1) : rawVotesCast;

  // Fix 3: Live Skip Counter from server room state
  const serverSkipCount =
    roomState?.skipCount ??
    Math.max(
      0,
      (roomState?.totalVotesCast ?? 0) - Object.values(voteCounts).reduce((a, b) => a + b, 0)
    );
  const skipCount =
    isAlreadyVoted && !selectedVoteId ? Math.max(serverSkipCount, 1) : serverSkipCount;

  // Secret Mode Victory Tracker calculation with safe initial fallback
  const localRequiredVotes = Math.floor(livingPlayers.length / 2) + 1;
  const effectiveRequiredVotes = endGameVoteRequired > 0 ? endGameVoteRequired : localRequiredVotes;
  const remainingVictoryVotes = Math.max(0, effectiveRequiredVotes - endGameVoteCount);

  // Deselecting a vote tile
  const handleTileTap = useCallback(
    (player: PublicPlayer) => {
      if (!player.isAlive || isAlreadyVoted) return;
      // Only Jester can vote for themselves
      if (player.id === playerId && !isJester) return;

      // Toggle deselection if already selected
      setSelectedVoteId((prev) => (prev === player.id ? null : player.id));
    },
    [playerId, isJester, isAlreadyVoted]
  );

  // Lock vote & submit Confirm or Skip Vote
  const handleConfirmOrSkipVote = useCallback(() => {
    if (isAlreadyVoted) return;
    setHasVoted(true);
    submitDayVote(selectedVoteId); // if selectedVoteId is null, backend registers skip
  }, [selectedVoteId, submitDayVote, isAlreadyVoted]);

  const handleCallEnd = useCallback(() => {
    setHasCalledEnd(true);
    callEndGame();
  }, [callEndGame]);

  const selectedPlayer = players.find((p) => p.id === selectedVoteId);

  return (
    <div className="min-h-dvh day-bg flex flex-col">
      {/* Top Header */}
      <div className="px-5 pt-4 pb-3">
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-xl font-black text-text-primary flex items-center gap-2"
        >
          {isAlreadyVoted ? (
            <>
              <span>Vote Locked — Watching Town</span>
              <Lock size={16} className="text-accent-yellow" />
            </>
          ) : iAmAlive ? (
            'Who is the Imposter?'
          ) : (
            'Spectating the vote...'
          )}
        </motion.h1>
        <p className="text-xs text-text-muted mt-0.5">
          {isAlreadyVoted
            ? 'Your decision is locked. Watch the live votes come in below...'
            : iAmAlive
            ? selectedVoteId
              ? 'Tap Confirm Vote or tap tile again to deselect.'
              : 'Discuss, then tap a player to vote or tap Skip Vote.'
            : "You can't vote — you've been eliminated."}
        </p>
      </div>

      {/* Live Vote Progress Bar */}
      <div className="px-5 mb-4">
        <div className="flex justify-between text-xs text-text-muted mb-1.5 font-medium">
          <span>Votes cast</span>
          <span className="font-bold text-text-secondary">
            {votesCast} / {totalNeeded}
          </span>
        </div>
        <div className="h-2 bg-bg-border rounded-full overflow-hidden">
          <motion.div
            animate={{ width: `${totalNeeded > 0 ? (votesCast / totalNeeded) * 100 : 0}%` }}
            transition={{ duration: 0.3 }}
            className="h-full bg-accent-yellow rounded-full"
          />
        </div>
      </div>

      {/* Fix 3: Player Grid stays visible in real-time read-only spectator mode after voting */}
      <div className={`flex-1 px-5 pb-36 transition-opacity duration-300 ${isAlreadyVoted ? 'opacity-85' : 'opacity-100'}`}>
        <PlayerGrid
          players={players}
          mode={iAmAlive && !isAlreadyVoted ? 'vote' : 'spectate'}
          myId={playerId ?? undefined}
          voteCounts={voteCounts}
          myVoteId={selectedVoteId ?? undefined}
          onTap={iAmAlive && !isAlreadyVoted ? handleTileTap : undefined}
        />

        {/* Secret Roles — Declare Victory button & Tracker */}
        {isSecretMode && iAmAlive && (
          <div className="mt-6 space-y-2">
            <motion.button
              whileTap={{ scale: 0.96 }}
              disabled={hasCalledEnd}
              onClick={handleCallEnd}
              className={[
                'w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2',
                'border-2 transition-all select-none',
                hasCalledEnd
                  ? 'border-bg-border bg-bg-card text-text-muted cursor-default'
                  : 'border-accent-red/50 bg-accent-red/10 text-accent-red-light hover:bg-accent-red/20 cursor-pointer',
              ].join(' ')}
            >
              <Flag size={16} />
              {hasCalledEnd ? 'Victory vote cast ✓' : 'Declare Victory'}
            </motion.button>

            <p className="text-center text-xs text-text-muted">
              {remainingVictoryVotes === 0
                ? 'Supermajority reached! Resolving victory...'
                : `${remainingVictoryVotes} more player${
                    remainingVictoryVotes !== 1 ? 's' : ''
                  } need${
                    remainingVictoryVotes === 1 ? 's' : ''
                  } to declare victory.`}
            </p>
          </div>
        )}

        {/* Spectator eliminated notice */}
        {!iAmAlive && (
          <div className="mt-6 text-center text-xs text-text-muted">
            You are spectating — eliminated players cannot vote.
          </div>
        )}
      </div>

      {/* Fix 3: Dynamic Morphing Action Button with Live Skip Counter & Read-Only locked state */}
      {iAmAlive && (
        <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-bg-primary via-bg-primary/95 to-transparent backdrop-blur-sm z-30 flex flex-col items-center gap-1.5 max-w-md mx-auto">
          {isAlreadyVoted ? (
            /* Locked / Read-only state for voters */
            <div className="w-full flex flex-col items-center gap-1">
              <div
                className={[
                  'w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 select-none border border-slate-700/60 bg-bg-card/90 shadow-md',
                  selectedVoteId
                    ? 'text-accent-violet-light border-accent-violet/30'
                    : 'text-text-secondary border-bg-border',
                ].join(' ')}
              >
                {selectedVoteId ? (
                  <>
                    <Check size={17} strokeWidth={2.5} className="text-accent-violet-light" />
                    <span>Voted for {selectedPlayer?.name || 'Player'}</span>
                  </>
                ) : (
                  <>
                    <SkipForward size={16} className="text-accent-yellow" />
                    <span>Skipped Vote</span>
                    {skipCount > 0 && (
                      <span className="ml-1.5 bg-slate-800 text-amber-300 border border-slate-700 font-mono text-xs px-2 py-0.5 rounded-full font-bold shadow-inner">
                        {skipCount}
                      </span>
                    )}
                  </>
                )}
              </div>
              <span className="text-[11px] text-text-muted font-medium flex items-center gap-1">
                <Lock size={10} />
                Vote locked • Waiting for others ({votesCast}/{totalNeeded})
              </span>
            </div>
          ) : (
            /* Interactive morphing button */
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={handleConfirmOrSkipVote}
              className={[
                'w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2.5 select-none transition-all duration-200 cursor-pointer',
                selectedVoteId
                  ? 'bg-gradient-to-r from-accent-violet to-accent-violet-light text-white shadow-glow-violet border-2 border-accent-violet-light/50'
                  : 'bg-bg-card border-2 border-accent-yellow/40 text-text-primary hover:border-accent-yellow/60 shadow-lg',
              ].join(' ')}
            >
              {selectedVoteId ? (
                <>
                  <Check size={20} strokeWidth={3} />
                  <span>Confirm Vote ({selectedPlayer?.name || 'Selected'})</span>
                </>
              ) : (
                <>
                  <SkipForward size={18} className="text-accent-yellow" />
                  <span>Skip Vote</span>
                  {skipCount > 0 && (
                    <span className="ml-1.5 bg-slate-800 text-amber-300 border border-slate-700 font-mono text-xs px-2 py-0.5 rounded-full font-bold shadow-inner">
                      {skipCount}
                    </span>
                  )}
                </>
              )}
            </motion.button>
          )}
        </div>
      )}
    </div>
  );
}
