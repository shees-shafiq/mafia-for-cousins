'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Vote, RotateCcw, Moon } from 'lucide-react';
import { useSocket } from '@/context/SocketContext';

/**
 * HostControls — Compact floating pill at bottom-left (opposite to RolePeekFAB).
 * Non-intrusive, host-only, persists even when host is eliminated.
 */
export default function HostControls() {
  const { roomState, playerId, socket, roomCode } = useSocket();

  const isHost = roomState?.hostId === playerId;
  const phase = roomState?.phase;

  if (!isHost || !phase) return null;

  const me = roomState.players.find((p) => p.id === playerId);
  const isAlive = me?.isAlive ?? true;

  // Emit admin action
  const emit = (event: string) => {
    socket?.emit(event, { roomCode, playerId });
  };

  // Determine what button to show depending on phase and alive status
  let action: { label: string; icon: React.ReactNode; event: string; style: string } | null = null;

  if (phase === 'day_announce' && !isAlive) {
    // Only show floating button if Host is DEAD (in SpectatorView), because living Host already has the main in-page button
    const isNightAnnounce = roomState.announceType === 'night';
    action = isNightAnnounce
      ? {
          label: 'Open Voting',
          icon: <Vote size={14} className="text-blue-400" />,
          event: 'begin_voting',
          style: 'bg-blue-950/80 border-blue-500/40 text-blue-200 hover:bg-blue-900/90',
        }
      : {
          label: 'Begin Night',
          icon: <Moon size={14} className="text-indigo-400" />,
          event: 'advance_to_night',
          style: 'bg-indigo-950/80 border-indigo-500/40 text-indigo-200 hover:bg-indigo-900/90',
        };
  } else if (phase === 'game_over') {
    // Show single persistent Play Again button for Host
    action = {
      label: 'Play Again',
      icon: <RotateCcw size={14} className="text-accent-violet-light" />,
      event: 'restart_game',
      style: 'bg-purple-950/90 border-accent-violet/50 text-purple-100 hover:bg-purple-900 shadow-glow-violet',
    };
  }

  if (!action) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={`host-pill-${phase}`}
        initial={{ scale: 0.8, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 12 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        className="fixed bottom-6 left-5 z-40 select-none"
      >
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => emit(action!.event)}
          className={`px-3.5 py-2.5 rounded-full border shadow-xl backdrop-blur-md
                     flex items-center gap-2 text-xs font-bold tracking-wide
                     cursor-pointer transition-all ${action.style}`}
          title="Host Control"
        >
          <span className="text-[11px]">👑</span>
          {action.icon}
          <span>{action.label}</span>
        </motion.button>
      </motion.div>
    </AnimatePresence>
  );
}
