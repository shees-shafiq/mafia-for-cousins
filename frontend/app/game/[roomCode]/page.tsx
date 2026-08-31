'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, ArrowLeft, Zap, SkipForward } from 'lucide-react';
import { useSocket } from '@/context/SocketContext';
import type { RoomState } from '@/types/game';

// Phase components
import RoleReveal from '@/components/RoleReveal';
import DecoyTapper from '@/components/DecoyTapper';
import ResolutionAnnouncement from '@/components/ResolutionAnnouncement';
import VotingPanel from '@/components/VotingPanel';
import GameOver from '@/components/GameOver';
import SpectatorView from '@/components/SpectatorView';
import RolePeekFAB from '@/components/RolePeekFAB';
import HostControls from '@/components/HostControls';
import LeaveButton from '@/components/LeaveButton';

// ─── Loading / Expired Screen ────────────────────────────────────────────────
function LoadingScreen({
  roomCode,
  isTimedOut,
  errorMessage,
}: {
  roomCode: string;
  isTimedOut: boolean;
  errorMessage?: string | null;
}) {
  const router = useRouter();

  return (
    <div className="min-h-dvh night-bg flex flex-col items-center justify-center p-6 gap-5 text-center">
      {!isTimedOut && !errorMessage ? (
        <>
          <div className="w-10 h-10 rounded-full border-2 border-accent-violet border-t-transparent animate-spin" />
          <p className="text-text-muted text-sm animate-pulse">Restoring session...</p>
        </>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card rounded-3xl p-6 max-w-sm w-full space-y-4"
        >
          <div className="w-12 h-12 rounded-2xl bg-accent-red/10 border border-accent-red/30 flex items-center justify-center mx-auto text-accent-red">
            <AlertCircle size={24} />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-text-primary">Session Not Found</h2>
            <p className="text-xs text-text-muted">
              {errorMessage || `Room ${roomCode} is inactive or server restarted. Please rejoin or start a new room.`}
            </p>
          </div>
          <button
            onClick={() => router.replace(`/?code=${roomCode}`)}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-accent-violet to-accent-violet-light font-bold text-white text-sm flex items-center justify-center gap-2 shadow-glow-violet"
          >
            <ArrowLeft size={16} />
            Rejoin / Enter Name
          </button>
        </motion.div>
      )}
    </div>
  );
}

// ─── Fluid Flexbox Global Header (Fix 4: Relocate Host Force Buttons) ────────
function GameHeader({
  roomState,
  isHost,
  isGameActive,
  onForceNight,
  onForceVote,
}: {
  roomState: RoomState;
  isHost: boolean;
  isGameActive: boolean;
  onForceNight: () => void;
  onForceVote: () => void;
}) {
  const phase = roomState.phase;
  const phaseLabel =
    phase === 'role_reveal'
      ? '🎭 Role Reveal'
      : phase === 'night'
      ? '🌙 Night Phase'
      : phase === 'day_announce'
      ? '🌅 Morning News'
      : phase === 'day_vote'
      ? '🗳️ Town Voting'
      : phase === 'game_over'
      ? '🏆 Game Over'
      : '🎮 In Game';

  return (
    <div className="w-full flex justify-between items-center px-4 py-2.5 bg-slate-900/95 border-b border-slate-800 backdrop-blur-md sticky top-0 z-40 select-none">
      {/* Left: Leave Button */}
      <div className="flex items-center justify-start flex-1 min-w-0">
        <LeaveButton isGameActive={isGameActive} />
      </div>

      {/* Center: Phase / Round info */}
      <div className="flex flex-col items-center justify-center text-center px-2 flex-shrink-0">
        <span className="text-xs font-bold text-slate-200 tracking-wider">
          {phaseLabel}
        </span>
        {roomState.round > 0 && phase !== 'game_over' && (
          <span className="text-[10px] text-slate-400 font-medium">
            Round {roomState.round}
          </span>
        )}
      </div>

      {/* Right Slot: Host Force Buttons (Fix 4) */}
      <div className="flex items-center justify-end flex-1 min-w-0">
        {isHost && phase === 'night' && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={onForceNight}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-950/80 border border-amber-500/50 text-amber-200 text-xs font-bold shadow-lg hover:bg-amber-900 transition-colors cursor-pointer"
            title="Host: Force end night"
          >
            <Zap size={13} className="text-amber-400" />
            <span>Force Night</span>
          </motion.button>
        )}
        {isHost && phase === 'day_vote' && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={onForceVote}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-950/80 border border-orange-500/50 text-orange-200 text-xs font-bold shadow-lg hover:bg-orange-900 transition-colors cursor-pointer"
            title="Host: Force end vote"
          >
            <SkipForward size={13} className="text-orange-400" />
            <span>Force Vote</span>
          </motion.button>
        )}
      </div>
    </div>
  );
}

// ─── Phase → Component map ────────────────────────────────────────────────────
function PhaseView({ phase, isAlive }: { phase: string; isAlive: boolean }) {
  // Game Over screen must be seen by ALL players (alive and dead)
  if (phase === 'game_over') return <GameOver />;

  // During active game phases, eliminated players see SpectatorView
  if (!isAlive) return <SpectatorView />;

  switch (phase) {
    case 'role_reveal':
      return <RoleReveal />;
    case 'night':
      return <DecoyTapper />;
    case 'day_announce':
      return <ResolutionAnnouncement />;
    case 'day_vote':
      return <VotingPanel />;
    default:
      return null;
  }
}

// ─── Main Game Hub ────────────────────────────────────────────────────────────
export default function GamePage() {
  const params = useParams();
  const urlCode = (params?.roomCode as string | undefined)?.toUpperCase() ?? '';
  const router = useRouter();

  const { roomState, playerId, socket, roomCode, error } = useSocket();
  const [isTimedOut, setIsTimedOut] = useState(false);

  // Session guard: if no stored session exists at all, redirect to landing with code prefilled
  useEffect(() => {
    const storedPlayerId = sessionStorage.getItem('mafia_player_id');
    const storedCode = sessionStorage.getItem('mafia_room_code')?.toUpperCase();
    if (!storedPlayerId || storedCode !== urlCode) {
      router.replace(`/?code=${urlCode}`);
    }
  }, [urlCode, router]);

  // Timeout fallback: if still not restored after 3.5s, show friendly rejoin card
  useEffect(() => {
    if (roomState && playerId) return;
    const timer = setTimeout(() => {
      setIsTimedOut(true);
    }, 3500);
    return () => clearTimeout(timer);
  }, [roomState, playerId]);

  // If game goes back to lobby (e.g. Host clicks Play Again), navigate there
  useEffect(() => {
    if (roomState?.phase === 'lobby') {
      router.push(`/lobby/${urlCode}`);
    }
  }, [roomState?.phase, router, urlCode]);

  const handleForceNight = useCallback(() => {
    socket?.emit('force_end_night', { roomCode: urlCode, playerId });
  }, [socket, urlCode, playerId]);

  const handleForceVote = useCallback(() => {
    socket?.emit('force_end_vote', { roomCode: urlCode, playerId });
  }, [socket, urlCode, playerId]);

  // Show loading / timeout card while session is restoring (no roomState yet)
  if (!roomState || !playerId) {
    return <LoadingScreen roomCode={urlCode} isTimedOut={isTimedOut} errorMessage={error} />;
  }

  const me = roomState.players.find((p) => p.id === playerId);
  const isAlive = me?.isAlive ?? true;
  const isHost = roomState.hostId === playerId;
  const phase = roomState.phase;

  // Determine if the FAB should be shown:
  const showFAB = phase !== 'role_reveal' && phase !== 'game_over' && phase !== 'lobby';

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Global fluid flexbox header */}
      <GameHeader
        roomState={roomState}
        isHost={isHost}
        isGameActive={phase !== 'game_over'}
        onForceNight={handleForceNight}
        onForceVote={handleForceVote}
      />

      {/* Main phase view */}
      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col"
          >
            <PhaseView phase={phase} isAlive={isAlive} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Floating role-peek button — visible during active game phases */}
      {showFAB && <RolePeekFAB />}

      {/* Persistent host panel — visible to host even when dead */}
      <HostControls />
    </div>
  );
}
