'use client';

import { motion } from 'framer-motion';
import { useSocket } from '@/context/SocketContext';
import type { RevealedPlayer } from '@/types/game';

const WINNER_META: Record<
  string,
  { label: string; emoji: string; color: string; bg: string; message: string }
> = {
  citizens: {
    label: 'Citizens Win!',
    emoji: '🛡️',
    color: 'text-blue-400',
    bg: 'from-blue-950/60 to-bg-primary',
    message: 'The town has successfully rooted out all Imposters. Justice prevails!',
  },
  imposters: {
    label: 'Imposters Win!',
    emoji: '🗡️',
    color: 'text-red-400',
    bg: 'from-red-950/60 to-bg-primary',
    message: 'The Imposters have taken control. The town crumbles in darkness.',
  },
  jester: {
    label: 'Jester Wins!',
    emoji: '🃏',
    color: 'text-violet-400',
    bg: 'from-violet-950/60 to-bg-primary',
    message: 'The Jester fooled everyone and got voted out on purpose!',
  },
};

const ROLE_ICONS: Record<string, string> = {
  citizen: '🛡️',
  imposter: '🗡️',
  doctor: '💉',
  jester: '🃏',
};

function PlayerCard({ player, index }: { player: RevealedPlayer; index: number }) {
  const isImposter = player.role === 'imposter';
  const isDead = !player.isAlive;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.06, duration: 0.3 }}
      className={[
        'flex items-center gap-3 p-3 rounded-2xl border-2',
        isImposter
          ? 'border-accent-red/40 bg-red-950/20'
          : 'border-bg-border bg-bg-card',
        isDead ? 'opacity-60' : '',
      ].join(' ')}
    >
      <span className="text-2xl">{isDead ? '🪦' : player.animal}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-bold text-text-primary truncate">{player.name}</p>
          {player.isHost && <span className="text-xs">👑</span>}
          {player.isBoss && <span className="text-xs text-accent-yellow-light">Boss</span>}
        </div>
        <p className="text-xs text-text-muted capitalize">
          {ROLE_ICONS[player.role]} {player.role}
        </p>
      </div>
      <span
        className="w-3 h-3 rounded-full flex-shrink-0 border border-white/10"
        style={{ backgroundColor: player.color }}
      />
    </motion.div>
  );
}

export default function GameOver() {
  const { gameOverInfo, playerId, roomState, socket } = useSocket();

  if (!gameOverInfo) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <p className="text-text-muted animate-pulse">Loading results...</p>
      </div>
    );
  }

  const winnerKey = String(gameOverInfo.winner || '').toLowerCase();
  const meta = WINNER_META[winnerKey] ?? WINNER_META.citizens;
  const me = gameOverInfo.players.find((p) => p.id === playerId);
  const isHost = roomState?.hostId === playerId;
  const myRoleKey = String(me?.role || '').toLowerCase();

  const isJesterWin = winnerKey === 'jester';
  const iAmJester = myRoleKey === 'jester';

  const iDidWin =
    (winnerKey === 'citizens' && myRoleKey !== 'imposter' && !iAmJester) ||
    (winnerKey === 'imposters' && myRoleKey === 'imposter') ||
    (isJesterWin && iAmJester);

  // Group: imposters first, then others
  const imposters = gameOverInfo.players.filter((p) => String(p.role).toLowerCase() === 'imposter');
  const others = gameOverInfo.players.filter((p) => String(p.role).toLowerCase() !== 'imposter');

  return (
    <div className={`min-h-dvh bg-gradient-to-b ${meta.bg} flex flex-col`}>
      {/* Hero section */}
      <div className="flex flex-col items-center gap-4 pt-14 pb-6 px-6 text-center">
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 12 }}
          className="text-7xl animate-float"
        >
          {meta.emoji}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-2"
        >
          <p className="text-xs font-bold text-text-muted uppercase tracking-widest">
            Game Over
          </p>
          <h1 className={`text-4xl font-black ${meta.color}`}>{meta.label}</h1>
          <p className="text-sm text-text-secondary max-w-xs leading-snug">{meta.message}</p>
        </motion.div>

        {/* Jester callout */}
        {isJesterWin && gameOverInfo.jesterName && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="px-4 py-2.5 rounded-2xl bg-violet-900/40 border border-violet-500/40
                       text-violet-200 text-sm font-bold shadow-glow-violet"
          >
            🃏 {iAmJester ? 'You fooled everyone and got voted out!' : `${gameOverInfo.jesterName} fooled everyone!`}
          </motion.div>
        )}

        {/* Personal win / loss badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className={[
            'px-5 py-2.5 rounded-full text-sm font-black border tracking-wide',
            iDidWin
              ? 'bg-accent-green/20 border-accent-green/50 text-accent-green-light shadow-glow-green/30'
              : 'bg-accent-red/20 border-accent-red/40 text-accent-red-light',
          ].join(' ')}
        >
          {isJesterWin && iAmJester ? '👑 YOU WON! (Solo Victory)' : iDidWin ? '🎉 You Won!' : '😔 You Lost'}
        </motion.div>
      </div>

      {/* Full role reveal list */}
      <div className="flex-1 px-5 pb-10 space-y-4">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-xs font-bold text-text-muted uppercase tracking-widest text-center"
        >
          Full Role Reveal
        </motion.p>

        {imposters.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-accent-red font-semibold px-1">🗡️ Imposters</p>
            {imposters.map((p, i) => (
              <PlayerCard key={p.id} player={p} index={i} />
            ))}
          </div>
        )}

        {others.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-text-muted font-semibold px-1">👥 Town</p>
            {others.map((p, i) => (
              <PlayerCard key={p.id} player={p} index={imposters.length + i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
