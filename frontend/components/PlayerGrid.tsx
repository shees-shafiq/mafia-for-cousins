'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { WifiOff } from 'lucide-react';
import type { PublicPlayer } from '@/types/game';

// ─── Types ────────────────────────────────────────────────────────────────────

export type GridMode =
  | 'lobby'      // static display or long-pressable for host
  | 'decoy'      // exactly one tile is highlighted; others dimmed
  | 'target'     // neutral interactive targeting grid for all roles
  | 'vote'       // voting mode, shows vote counts
  | 'spectate'   // eliminated — all tiles read-only
  | 'disabled';  // submitted, waiting

interface PlayerGridProps {
  players: PublicPlayer[];
  mode: GridMode;
  myId?: string;

  /** ID of the currently active decoy tile (mode === 'decoy') */
  highlightId?: string;

  /** IDs that can be tapped (mode === 'target') */
  activeIds?: string[];

  /** Currently selected target ID in neutral target mode */
  selectedId?: string | null;

  /** Vote counts per playerId (mode === 'vote') */
  voteCounts?: Record<string, number>;

  /** The playerId I voted for (mode === 'vote') */
  myVoteId?: string;

  onTap?: (player: PublicPlayer) => void;
  onLongPress?: (player: PublicPlayer) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTileVariant(
  player: PublicPlayer,
  mode: GridMode,
  highlightId?: string,
  activeIds?: string[],
  selectedId?: string | null,
  myVoteId?: string
) {
  if (!player.isAlive) return 'dead';
  if (mode === 'decoy') {
    return player.id === highlightId ? 'decoy' : 'dimmed';
  }
  if (mode === 'target') {
    if (selectedId && player.id === selectedId) return 'selected';
    return activeIds?.includes(player.id) ? 'target' : 'dimmed';
  }
  if (mode === 'vote') {
    return player.id === myVoteId ? 'voted' : 'vote';
  }
  if (mode === 'disabled') return 'dimmed';
  if (mode === 'spectate') return 'spectate';
  return 'normal';
}

// ─── Single Player Tile Component ─────────────────────────────────────────────

function PlayerTile({
  player,
  idx,
  mode,
  myId,
  highlightId,
  activeIds,
  selectedId,
  voteCounts,
  myVoteId,
  onTap,
  onLongPress,
}: {
  player: PublicPlayer;
  idx: number;
  mode: GridMode;
  myId?: string;
  highlightId?: string;
  activeIds?: string[];
  selectedId?: string | null;
  voteCounts: Record<string, number>;
  myVoteId?: string;
  onTap?: (player: PublicPlayer) => void;
  onLongPress?: (player: PublicPlayer) => void;
}) {
  const variant = getTileVariant(player, mode, highlightId, activeIds, selectedId, myVoteId);
  const isDecoyTarget = variant === 'decoy';
  const isSelected = variant === 'selected';
  const isActionTarget = variant === 'target' || isSelected;
  const isVoteTarget = variant === 'vote' || variant === 'voted';
  const isDead = !player.isAlive;
  const isMe = player.id === myId;
  const isOffline = player.connected === false;
  const voteCount = voteCounts[player.id] || 0;

  // In night mode (target/decoy), keep visual layout 100% neutral and role-safe
  const showOfflineBadge = isOffline && mode !== 'target' && mode !== 'decoy';

  const isInteractive =
    !isDead &&
    (onTap !== undefined || onLongPress !== undefined) &&
    (isDecoyTarget || isActionTarget || isVoteTarget || (mode === 'lobby' && onLongPress !== undefined));

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressedRef = useRef(false);

  const handleTouchStart = () => {
    if (!onLongPress) return;
    isLongPressedRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressedRef.current = true;
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.(40);
      }
      onLongPress(player);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleClick = () => {
    if (isLongPressedRef.current) {
      isLongPressedRef.current = false;
      return;
    }
    if (onTap && (!isDead || mode === 'spectate')) {
      onTap(player);
    }
  };

  return (
    <motion.button
      type="button"
      disabled={!isInteractive}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.04, duration: 0.25 }}
      whileTap={isInteractive ? { scale: 0.94 } : {}}
      className={[
        'relative flex flex-col items-center justify-center gap-1.5',
        'rounded-2xl border-2 p-3 text-center select-none',
        'transition-all duration-200',
        isDead
          ? 'bg-bg-card/40 border-bg-border/30 opacity-40 cursor-default'
          : isDecoyTarget
          ? 'bg-accent-yellow/10 border-accent-yellow/80 animate-pulse-glow cursor-pointer'
          : isSelected
          ? 'bg-white/15 border-white ring-2 ring-white/80 shadow-glow-white cursor-pointer'
          : isActionTarget
          ? 'bg-bg-card border-bg-border cursor-pointer hover:border-white/40'
          : variant === 'voted'
          ? 'bg-accent-violet/10 border-accent-violet/80 shadow-glow-violet cursor-pointer'
          : isVoteTarget
          ? 'bg-bg-card border-bg-border cursor-pointer hover:border-text-muted'
          : 'bg-bg-card/50 border-bg-border/40',
        showOfflineBadge ? 'opacity-70 border-dashed border-accent-red/50' : '',
      ].join(' ')}
      aria-label={`Player tile: ${player.name}`}
    >
      {/* Decoy glow ring */}
      {isDecoyTarget && (
        <span className="absolute inset-0 rounded-2xl ring-2 ring-accent-yellow/60 ring-offset-2 ring-offset-bg-primary animate-pulse" />
      )}

      {/* Selected ring for universal neutral targeting */}
      {isSelected && (
        <span className="absolute inset-0 rounded-2xl ring-2 ring-white/40 ring-offset-2 ring-offset-bg-primary" />
      )}

      {/* Offline indicator (Safe constraint 4: only outside of night target/decoy grid) */}
      {showOfflineBadge && (
        <span className="absolute top-1.5 left-1.5 px-1 py-0.5 rounded bg-accent-red/20 border border-accent-red/40 text-[8px] font-bold text-accent-red flex items-center gap-0.5">
          <WifiOff size={8} />
          offline
        </span>
      )}

      {/* Animal / gravestone icon */}
      <span className="text-2xl leading-none">
        {isDead ? '🪦' : player.animal}
      </span>

      {/* Player name */}
      <span
        className={[
          'text-xs font-semibold leading-tight max-w-full truncate px-1',
          isDead ? 'text-text-muted' : 'text-text-primary',
        ].join(' ')}
      >
        {player.name}
        {isMe && (
          <span className="ml-1 text-text-muted font-normal">(you)</span>
        )}
      </span>

      {/* Color dot */}
      {!isDead && (
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: player.color }}
        />
      )}

      {/* Vote count badge */}
      {mode === 'vote' && voteCount > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1
                     bg-accent-red text-white text-xs font-bold
                     rounded-full flex items-center justify-center
                     shadow-glow-red"
        >
          {voteCount}
        </motion.span>
      )}

      {/* "Selected" check for neutral target or vote */}
      {isSelected && (
        <span className="absolute top-1.5 left-2 text-white font-bold text-xs">✓</span>
      )}
      {variant === 'voted' && (
        <span className="absolute top-1.5 left-2 text-accent-violet-light font-bold text-xs">✓</span>
      )}

      {/* Submitted indicator */}
      {(mode === 'decoy' || mode === 'target') && player.hasSubmittedAction && !isDead && (
        <span className="absolute bottom-1 right-1.5 w-1.5 h-1.5 rounded-full bg-accent-green" />
      )}

      {/* Host crown */}
      {player.isHost && (
        <span className="absolute top-1 right-1.5 text-xs" title="Host">👑</span>
      )}
    </motion.button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PlayerGrid({
  players,
  mode,
  myId,
  highlightId,
  activeIds,
  selectedId,
  voteCounts = {},
  myVoteId,
  onTap,
  onLongPress,
}: PlayerGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 w-full">
      {players.map((player, idx) => (
        <PlayerTile
          key={player.id}
          player={player}
          idx={idx}
          mode={mode}
          myId={myId}
          highlightId={highlightId}
          activeIds={activeIds}
          selectedId={selectedId}
          voteCounts={voteCounts}
          myVoteId={myVoteId}
          onTap={onTap}
          onLongPress={onLongPress}
        />
      ))}
    </div>
  );
}
