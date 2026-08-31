'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Users, Copy, Check, QrCode, X, UserMinus, ShieldAlert } from 'lucide-react';
import QRCode from 'react-qr-code';
import { useSocket } from '@/context/SocketContext';
import HostConfig from '@/components/HostConfig';
import PlayerGrid from '@/components/PlayerGrid';
import LeaveButton from '@/components/LeaveButton';
import type { PublicPlayer } from '@/types/game';

// ─── QR Modal ─────────────────────────────────────────────────────────────────
function QRModal({
  roomCode,
  onClose,
}: {
  roomCode: string;
  onClose: () => void;
}) {
  const inviteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?code=${roomCode}`
      : `/?code=${roomCode}`;

  return (
    <motion.div
      key="qr-modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center
                 bg-black/75 backdrop-blur-sm p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.85, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.85, y: 24 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs glass-card rounded-3xl p-6 flex flex-col
                   items-center gap-5 relative"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-bg-hover
                     flex items-center justify-center text-text-muted
                     hover:text-text-primary transition-colors"
          aria-label="Close QR code"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="text-center space-y-1 pr-6">
          <p className="text-xs font-bold text-text-muted uppercase tracking-widest">
            Invite Players
          </p>
          <p className="text-lg font-black text-text-primary">Scan to Join</p>
        </div>

        {/* QR Code */}
        <div className="p-4 bg-white rounded-2xl shadow-glow-violet">
          <QRCode
            value={inviteUrl}
            size={200}
            bgColor="#ffffff"
            fgColor="#0a0a0f"
            level="M"
          />
        </div>

        {/* Room code and URL callout */}
        <div className="w-full space-y-2 text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="text-3xl font-black text-shimmer tracking-widest">{roomCode}</span>
          </div>
          <p className="text-[10px] text-text-muted break-all leading-snug">{inviteUrl}</p>
        </div>

        <p className="text-xs text-text-secondary text-center leading-snug">
          Point any phone camera at this code.
          <br />
          It will open the game and pre-fill the room code.
        </p>
      </motion.div>
    </motion.div>
  );
}

// ─── Host Manage Player Modal (Long-Press) ────────────────────────────────────
function HostPlayerModal({
  player,
  onClose,
  onKick,
  onPromote,
}: {
  player: PublicPlayer;
  onClose: () => void;
  onKick: (targetId: string) => void;
  onPromote: (targetId: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 16 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs glass-card rounded-3xl p-6 flex flex-col items-center gap-4 text-center relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full bg-bg-hover flex items-center justify-center text-text-muted hover:text-text-primary"
          aria-label="Close"
        >
          <X size={14} />
        </button>

        <div className="flex flex-col items-center gap-1.5 pt-2">
          <span className="text-4xl">{player.animal}</span>
          <h3 className="text-lg font-black text-text-primary">{player.name}</h3>
          <p className="text-xs text-text-muted font-medium">Host Management</p>
        </div>

        <div className="w-full space-y-2.5 pt-2">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              onPromote(player.id);
              onClose();
            }}
            className="w-full py-3.5 rounded-xl font-bold text-sm text-white bg-accent-violet hover:bg-accent-violet/90 flex items-center justify-center gap-2 shadow-glow-violet"
          >
            <Crown size={16} />
            Make Host
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              onKick(player.id);
              onClose();
            }}
            className="w-full py-3.5 rounded-xl font-bold text-sm text-white bg-accent-red hover:bg-accent-red/90 flex items-center justify-center gap-2 shadow-glow-red"
          >
            <UserMinus size={16} />
            Kick Player
          </motion.button>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl font-semibold text-xs text-text-muted bg-transparent border border-bg-border hover:bg-bg-hover"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Lobby Page ──────────────────────────────────────────────────────────
export default function LobbyPage() {
  const params = useParams();
  const urlCode = (params?.roomCode as string | undefined)?.toUpperCase() ?? '';
  const router = useRouter();

  const { roomState, playerId, startGame, error, kickPlayer, promoteHost } = useSocket();
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [playerToManage, setPlayerToManage] = useState<PublicPlayer | null>(null);

  useEffect(() => {
    const storedPlayerId = sessionStorage.getItem('mafia_player_id');
    const storedCode = sessionStorage.getItem('mafia_room_code')?.toUpperCase();

    const hasValidSession = storedPlayerId && storedCode === urlCode;

    if (!hasValidSession) {
      router.replace(`/?code=${urlCode}`);
    }
  }, [urlCode, router]);

  // Timeout fallback
  useEffect(() => {
    if (roomState) return;
    const timer = setTimeout(() => {
      setIsTimedOut(true);
    }, 3500);
    return () => clearTimeout(timer);
  }, [roomState]);

  // Navigate to game when phase changes
  useEffect(() => {
    if (roomState?.phase && roomState.phase !== 'lobby') {
      router.push(`/game/${urlCode}`);
    }
  }, [roomState?.phase, router, urlCode]);

  const isHost = roomState?.hostId === playerId;
  const playerCount = roomState?.players.length ?? 0;
  const canStart = playerCount >= 4;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(urlCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API fallback
    }
  };

  if (!roomState) {
    return (
      <div className="min-h-dvh ambient-bg flex items-center justify-center p-6 text-center">
        {!isTimedOut && !error ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-accent-violet border-t-transparent animate-spin" />
            <p className="text-text-muted text-sm animate-pulse">Connecting to room...</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card rounded-3xl p-6 max-w-sm w-full space-y-4"
          >
            <p className="text-sm font-bold text-text-primary">Room Not Found or Inactive</p>
            <p className="text-xs text-text-muted">
              {error || `Room ${urlCode} may have ended or the server was restarted.`}
            </p>
            <button
              onClick={() => router.replace(`/?code=${urlCode}`)}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-accent-violet to-accent-violet-light font-bold text-white text-sm shadow-glow-violet"
            >
              Rejoin or Create Game
            </button>
          </motion.div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="min-h-dvh ambient-bg flex flex-col justify-between max-w-md mx-auto relative">
        {/* Top Header */}
        <div className="px-5 pt-8 pb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-text-muted uppercase tracking-widest">
              🎭 Game Lobby
            </p>
            <LeaveButton isGameActive={false} />
          </div>

          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-1"
          >
            {/* Room code row */}
            <div className="flex items-center gap-3 mt-1">
              <button
                onClick={copyCode}
                className="flex items-center gap-2 group"
                aria-label="Copy room code"
              >
                <span className="text-5xl font-black text-shimmer tracking-widest">
                  {urlCode}
                </span>
                <span className="text-text-muted group-active:scale-90 transition-transform">
                  {copied ? (
                    <Check size={20} className="text-accent-green" />
                  ) : (
                    <Copy size={20} />
                  )}
                </span>
              </button>

              {/* QR invite button */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowQR(true)}
                className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl
                           bg-accent-violet/15 border border-accent-violet/40
                           text-accent-violet-light text-xs font-bold
                           hover:bg-accent-violet/25 transition-colors"
                aria-label="Show invite QR code"
              >
                <QrCode size={15} />
                QR
              </motion.button>
            </div>

            <p className="text-xs text-text-muted">
              {isHost
                ? 'Share code or tap QR. Hold player tile to manage.'
                : 'Share this code with players in the room'}{' '}
              • {playerCount}/20 joined
            </p>
          </motion.div>
        </div>

        {/* Players section */}
        <div className="px-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Users size={14} className="text-text-muted" />
              <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
                Players
              </span>
            </div>
            <span className="text-xs text-text-muted">{playerCount}/20 joined</span>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <PlayerGrid
              players={roomState.players}
              mode="lobby"
              myId={playerId ?? undefined}
              onLongPress={
                isHost
                  ? (player) => {
                      if (player.id !== playerId) {
                        setPlayerToManage(player);
                      }
                    }
                  : undefined
              }
            />
          </motion.div>

          {playerCount < 4 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-xs text-text-muted text-center mt-3"
            >
              Need {4 - playerCount} more player{4 - playerCount !== 1 ? 's' : ''} to start
            </motion.p>
          )}
        </div>

        {/* Host config panel */}
        {isHost && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="px-5 pb-4"
          >
            <div className="h-px bg-bg-border mb-5" />
            <HostConfig />
          </motion.div>
        )}

        {!isHost && (
          <div className="flex-1 flex items-center justify-center px-5 py-6">
            <p className="text-xs text-text-muted text-center animate-pulse">
              Waiting for the host to configure and start the game...
            </p>
          </div>
        )}

        {/* Start button — host only */}
        {isHost && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="px-5 pb-8 pt-2"
          >
            <motion.button
              whileTap={canStart ? { scale: 0.96 } : {}}
              onClick={startGame}
              disabled={!canStart}
              className={[
                'w-full py-5 rounded-2xl font-black text-lg',
                'flex items-center justify-center gap-2',
                'transition-all duration-200',
                canStart
                  ? 'bg-gradient-to-r from-accent-violet to-accent-violet-light text-white shadow-glow-violet cursor-pointer'
                  : 'bg-bg-card border-2 border-bg-border text-text-muted cursor-not-allowed',
              ].join(' ')}
            >
              <Crown size={22} />
              {canStart
                ? 'Start Game'
                : `Need ${4 - playerCount} more player${4 - playerCount !== 1 ? 's' : ''}`}
            </motion.button>
          </motion.div>
        )}
      </div>

      {/* QR Modal */}
      <AnimatePresence>
        {showQR && (
          <QRModal roomCode={urlCode} onClose={() => setShowQR(false)} />
        )}
      </AnimatePresence>

      {/* Host Player Action Modal */}
      <AnimatePresence>
        {playerToManage && (
          <HostPlayerModal
            player={playerToManage}
            onClose={() => setPlayerToManage(null)}
            onKick={(targetId) => kickPlayer(targetId)}
            onPromote={(targetId) => promoteHost(targetId)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
