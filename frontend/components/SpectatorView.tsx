'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Ghost, Send } from 'lucide-react';
import { useSocket } from '@/context/SocketContext';
import PlayerGrid from '@/components/PlayerGrid';
import { REACTION_EMOJIS, NEWS_MAX_LENGTH } from '@/types/game';

export default function SpectatorView() {
  const { roomState, myRole, playerId, sendReaction, postNews, lastNewsRound } = useSocket();
  const [newsText, setNewsText] = useState('');

  const livingCount = roomState?.players.filter((p) => p.isAlive).length ?? 0;
  const totalCount = roomState?.players.length ?? 0;
  const phase = roomState?.phase;
  const isVoting = phase === 'day_vote';

  // One ghost-news post per round (server enforces this too)
  const hasPostedThisRound = lastNewsRound !== null && lastNewsRound === roomState?.round;
  const trimmedNews = newsText.trim();
  const canPost = trimmedNews.length > 0 && !hasPostedThisRound;

  const handlePost = () => {
    if (!canPost) return;
    postNews(trimmedNews);
    setNewsText('');
  };

  const phaseLabel: Record<string, string> = {
    night: '🌙 Night Phase in progress...',
    day_announce: '🌅 Day — Results being revealed...',
    day_vote: '🗳️ Day — Voting in progress...',
    role_reveal: 'Role reveal phase...',
    lobby: 'In lobby...',
    game_over: 'Game over!',
  };

  return (
    <div className="min-h-dvh night-bg flex flex-col items-center p-6 gap-5 pb-28">
      {/* Ghost icon */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-2"
      >
        <span className="text-6xl animate-float">👻</span>
        <h1 className="text-2xl font-black text-text-primary">Eliminated</h1>
        <p className="text-text-muted text-sm text-center max-w-xs">
          You&apos;re out — but you can still heckle. Send reactions and post Ghost News!
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

      {/* Reaction bar — emojis float up from your tile on everyone's screen */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="w-full max-w-sm space-y-2"
      >
        <p className="text-xs font-bold text-text-muted uppercase tracking-widest text-center">
          React
        </p>
        <div className="grid grid-cols-8 gap-1.5">
          {REACTION_EMOJIS.map((emoji) => (
            <motion.button
              key={emoji}
              type="button"
              whileTap={{ scale: 0.8 }}
              onClick={() => sendReaction(emoji)}
              className="aspect-square rounded-xl bg-bg-card border border-bg-border text-xl
                         flex items-center justify-center hover:border-accent-violet/50
                         transition-colors cursor-pointer select-none"
              aria-label={`Send ${emoji} reaction`}
            >
              {emoji}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Ghost News composer */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="w-full max-w-sm space-y-2"
      >
        <p className="text-xs font-bold text-text-muted uppercase tracking-widest text-center">
          Ghost News
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newsText}
            maxLength={NEWS_MAX_LENGTH}
            disabled={hasPostedThisRound}
            onChange={(e) => setNewsText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePost()}
            placeholder={hasPostedThisRound ? 'Posted! Try again next round' : 'Say something silly...'}
            className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-bg-hover border-2 border-bg-border
                       text-sm text-text-primary placeholder:text-text-muted
                       focus:outline-none focus:border-accent-violet/60 transition-colors
                       disabled:opacity-50"
          />
          <motion.button
            type="button"
            whileTap={canPost ? { scale: 0.92 } : {}}
            disabled={!canPost}
            onClick={handlePost}
            className="px-3.5 rounded-xl bg-accent-violet text-white font-bold text-sm
                       flex items-center gap-1.5 disabled:opacity-40 cursor-pointer disabled:cursor-default"
            aria-label="Post Ghost News"
          >
            <Send size={14} />
          </motion.button>
        </div>
        <p className="text-[11px] text-text-muted flex justify-between px-1">
          <span>One message per round</span>
          <span>
            {newsText.length}/{NEWS_MAX_LENGTH}
          </span>
        </p>
      </motion.div>

      {/* Live player grid — shows vote counts while voting */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="w-full max-w-sm space-y-3"
      >
        <p className="text-xs font-bold text-text-muted uppercase tracking-widest text-center">
          {isVoting ? 'Live Votes' : 'Survivors'}
        </p>
        <PlayerGrid
          players={roomState?.players ?? []}
          mode="spectate"
          myId={playerId ?? undefined}
          voteCounts={isVoting ? roomState?.voteCounts ?? {} : {}}
        />

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
          className="text-xs text-text-muted text-center"
        >
          You were a{' '}
          <span className="font-bold text-text-secondary capitalize">{myRole.role}</span>
        </motion.div>
      )}
      {/* Host controls are rendered once by the game page (was duplicated here) */}
    </div>
  );
}
