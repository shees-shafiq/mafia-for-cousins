'use client';

import { motion } from 'framer-motion';
import { Ghost } from 'lucide-react';
import { useSocket } from '@/context/SocketContext';
import HostControls from '@/components/HostControls';

export default function SpectatorView() {
  const { roomState, myRole } = useSocket();

  const livingCount = roomState?.players.filter((p) => p.isAlive).length ?? 0;
  const totalCount = roomState?.players.length ?? 0;
  const phase = roomState?.phase;

  const phaseLabel: Record<string, string> = {
    night: '🌙 Night Phase in progress...',
    day_announce: '🌅 Day — Results being revealed...',
    day_vote: '🗳️ Day — Voting in progress...',
    role_reveal: 'Role reveal phase...',
    lobby: 'In lobby...',
    game_over: 'Game over!',
  };

  return (
    <>
      <div className="min-h-dvh night-bg flex flex-col items-center justify-center p-6 gap-6">
        {/* Ghost icon */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-3"
        >
          <span className="text-7xl animate-float">👻</span>
          <h1 className="text-2xl font-black text-text-primary">Eliminated</h1>
          <p className="text-text-muted text-sm text-center max-w-xs">
            You&apos;re out. Watch the game unfold and see if you can spot the Imposters!
          </p>
        </motion.div>

        {/* Phase indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="glass-card rounded-2xl px-5 py-3 text-center"
        >
          <p className="text-sm font-semibold text-text-secondary animate-night-pulse">
            {phaseLabel[phase ?? ''] ?? 'Waiting...'}
          </p>
        </motion.div>

        {/* Player survival stats */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="w-full max-w-sm space-y-3"
        >
          <p className="text-xs font-bold text-text-muted uppercase tracking-widest text-center">
            Survivors
          </p>
          <div className="grid grid-cols-2 gap-3">
            {roomState?.players.map((p) => (
              <div
                key={p.id}
                className={[
                  'flex items-center gap-2 p-2.5 rounded-xl border',
                  p.isAlive
                    ? 'border-bg-border bg-bg-card'
                    : 'border-bg-border/30 bg-bg-card/30 opacity-40',
                ].join(' ')}
              >
                <span className="text-lg">{p.isAlive ? p.animal : '🪦'}</span>
                <span className="text-xs font-semibold text-text-primary truncate">{p.name}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-1.5 text-xs text-text-muted">
            <Ghost size={12} />
            <span>
              {livingCount} of {totalCount} players still alive
            </span>
          </div>
        </motion.div>

        {/* Role reminder */}
        {myRole && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-xs text-text-muted text-center pb-24"
          >
            You were a{' '}
            <span className="font-bold text-text-secondary capitalize">{myRole.role}</span>
          </motion.div>
        )}
      </div>

      {/* Host admin panel — dead host still needs to control the game */}
      <HostControls />
    </>
  );
}
