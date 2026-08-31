'use client';

import { motion } from 'framer-motion';
import { Sun, Moon, ArrowRight } from 'lucide-react';
import { useSocket } from '@/context/SocketContext';

export default function ResolutionAnnouncement() {
  const { roomState, playerId, advanceToNight, advanceToVote, nightResolution, voteResolution } =
    useSocket();

  const isHost = roomState?.hostId === playerId;
  const announceType = roomState?.announceType;
  const config = roomState?.config;

  // Pick the right resolution data
  const resolution =
    announceType === 'night'
      ? nightResolution
      : announceType === 'vote'
      ? voteResolution
      : null;

  const isNight = announceType === 'night';

  const nightData = isNight && resolution?.type === 'night' ? resolution : null;
  const voteData = !isNight && resolution?.type === 'vote' ? resolution : null;

  const killedPlayers = nightData?.killed ?? [];
  const savedPlayers = nightData?.saved ?? [];
  const peaceful = nightData?.peaceful ?? (killedPlayers.length === 0 && isNight);

  const executedPlayer = voteData?.executedPlayer ?? null;

  return (
    <div className={`flex-1 flex flex-col justify-between min-h-[calc(100dvh-53px)] ${isNight ? 'night-bg' : 'day-bg'}`}>
      {/* Top Header */}
      <div className="px-5 pt-4 pb-2">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2"
        >
          {isNight ? (
            <Moon size={15} className="text-indigo-400" />
          ) : (
            <Sun size={15} className="text-accent-yellow" />
          )}
          <span
            className={`text-xs font-bold uppercase tracking-widest ${
              isNight ? 'text-indigo-400' : 'text-accent-yellow'
            }`}
          >
            {isNight ? 'Dawn — Night Results' : 'Day Phase — Vote Results'}
          </span>
          <span className="ml-auto text-xs text-text-muted">Round {roomState?.round}</span>
        </motion.div>
      </div>

      {/* ── Main Results Content (Fix 5: Centered flex-grow container) ── */}
      <div className="flex-1 flex flex-col justify-center items-center text-center px-5 py-4 w-full max-w-md mx-auto">
        {/* Night Resolution */}
        {isNight && (
          <div className="w-full space-y-4">
            {peaceful ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center gap-3 py-4"
              >
                <span className="text-7xl animate-float">🌅</span>
                <h2 className="text-2xl font-black text-text-primary">Peaceful Night</h2>
                <p className="text-text-muted text-sm max-w-xs leading-relaxed">
                  Nobody was eliminated overnight. The village breathes a sigh of relief.
                </p>
              </motion.div>
            ) : (
              <div className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-1"
                >
                  <span className="text-5xl">💀</span>
                  <h2 className="text-xl font-black text-text-primary">
                    {killedPlayers.length === 1
                      ? `${killedPlayers[0].name} was found dead`
                      : `${killedPlayers.length} players were found dead`}
                  </h2>
                </motion.div>

                <div className="space-y-2.5">
                  {killedPlayers.map((p, i) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.12 }}
                      className="flex items-center gap-3 p-3.5 rounded-2xl bg-red-950/30 border-2 border-accent-red/30 text-left"
                    >
                      <span className="text-3xl">🪦</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-text-primary truncate">{p.name}</p>
                        {p.role && (
                          <p className="text-xs text-text-muted capitalize">
                            Was a <span className="font-semibold text-text-secondary">{p.role}</span>
                          </p>
                        )}
                        {!p.role && config?.revealMode === 'secret' && (
                          <p className="text-xs text-text-muted italic">Role hidden</p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>

                {savedPlayers.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-950/30 border border-accent-green/30"
                  >
                    <span>💉</span>
                    <p className="text-xs text-accent-green-light font-semibold">
                      {savedPlayers[0].name} was saved by the Doctor!
                    </p>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Vote Resolution (Fix 4: No one voted out when executedPlayer is null) */}
        {!isNight && (
          <div className="w-full space-y-4">
            {executedPlayer ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <span className="text-5xl">🗳️</span>
                  <h2 className="text-xl font-black text-text-primary">The Town Has Spoken</h2>
                </div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15, type: 'spring' }}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-amber-950/30 border-2 border-accent-yellow/30 text-left"
                >
                  <span className="text-3xl">🪦</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-text-primary">{executedPlayer.name}</p>
                    <p className="text-xs text-text-muted">was voted out</p>
                    {executedPlayer.role && (
                      <p className="text-xs text-text-secondary mt-0.5 capitalize">
                        Was a <span className="font-semibold">{executedPlayer.role}</span>
                      </p>
                    )}
                    {!executedPlayer.role && config?.revealMode === 'secret' && (
                      <p className="text-xs text-text-muted italic mt-0.5">Role hidden</p>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            ) : (
              /* Fix 4: Neutral undecided / tie / skip message */
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-3 py-4"
              >
                <span className="text-7xl animate-float">⚖️</span>
                <h2 className="text-2xl font-black text-text-primary">No One Voted Out</h2>
                <p className="text-text-muted text-sm max-w-xs leading-relaxed">
                  The town was undecided. No one was voted out today.
                </p>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* ── Host action buttons (Bottom standard padding container) ── */}
      <div className="p-4 pb-8 w-full max-w-md mx-auto select-none">
        {isHost ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-2"
          >
            {isNight ? (
              <button
                type="button"
                onClick={advanceToVote}
                className="w-full py-4 rounded-2xl font-black text-base text-white
                           bg-accent-violet shadow-glow-violet
                           flex items-center justify-center gap-2
                           active:scale-95 transition-transform cursor-pointer"
              >
                <span>Open Voting</span>
                <ArrowRight size={18} />
              </button>
            ) : (
              <button
                type="button"
                onClick={advanceToNight}
                className="w-full py-4 rounded-2xl font-black text-base text-white
                           bg-indigo-800 shadow-glow-blue
                           flex items-center justify-center gap-2
                           active:scale-95 transition-transform cursor-pointer"
              >
                <Moon size={18} />
                <span>Begin Next Night</span>
              </button>
            )}
            <p className="text-[11px] text-text-muted text-center font-medium">
              Only you (the host) can advance the game
            </p>
          </motion.div>
        ) : (
          <div className="py-3 text-center">
            <p className="text-xs text-text-muted animate-pulse font-medium">
              Waiting for host to continue...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
