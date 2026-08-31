'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  RoomState,
  MyRoleInfo,
  NightResolution,
  VoteResolution,
  GameOverInfo,
  GameConfig,
} from '@/types/game';

// ─── Socket URL ───────────────────────────────────────────────────────────────
const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

// ─── Module-level singleton ───────────────────────────────────────────────────
// The socket lives OUTSIDE React so it is never affected by Strict Mode's
// mount → cleanup → remount cycle.  A single connection is shared for the
// entire browser session; browser close / page refresh naturally destroys it.
// SSR-safe: only instantiated when `window` is available (i.e. in the browser).
let _socket: Socket | null = null;

function getSocket(): Socket {
  if (!_socket) {
    _socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return _socket;
}

function clearSession() {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('mafia_player_id');
    sessionStorage.removeItem('mafia_room_code');
  }
}

// ─── Context shape ────────────────────────────────────────────────────────────
interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;

  playerId: string | null;
  roomCode: string | null;
  roomState: RoomState | null;

  myRole: MyRoleInfo | null;
  myDecoySequence: string[] | null;

  nightResolution: NightResolution | null;
  voteResolution: VoteResolution | null;
  gameOverInfo: GameOverInfo | null;

  isDecoysComplete: boolean;
  isActionSubmitted: boolean;

  endGameVoteCount: number;
  endGameVoteRequired: number;
  voteProgress: { votesCast: number; totalNeeded: number } | null;

  error: string | null;
  setError: (e: string | null) => void;
  clearError: () => void;

  createRoom: (playerName: string, customRoomCode?: string) => void;
  joinRoom: (playerName: string, roomCode: string) => void;
  updateConfig: (config: Partial<GameConfig>) => void;
  startGame: () => void;
  advanceToNight: () => void;
  advanceToVote: () => void;
  onDecoySequenceComplete: () => void;
  submitNightAction: (targetId: string | null) => void;
  submitDayVote: (targetId: string | null) => void;
  callEndGame: () => void;
  kickPlayer: (targetId: string) => void;
  promoteHost: (targetId: string) => void;
  leaveGame: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const SocketContext = createContext<SocketContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function SocketProvider({ children }: { children: React.ReactNode }) {
  // Stable ref to the singleton — never changes after first mount
  const socketRef = useRef<Socket | null>(null);

  // ── React state (drives re-renders) ──────────────────────────────────────
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const [playerId, setPlayerId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);

  const [myRole, setMyRole] = useState<MyRoleInfo | null>(null);
  const [myDecoySequence, setMyDecoySequence] = useState<string[] | null>(null);

  const [nightResolution, setNightResolution] = useState<NightResolution | null>(null);
  const [voteResolution, setVoteResolution] = useState<VoteResolution | null>(null);
  const [gameOverInfo, setGameOverInfo] = useState<GameOverInfo | null>(null);

  const [isDecoysComplete, setIsDecoysComplete] = useState(false);
  const [isActionSubmitted, setIsActionSubmitted] = useState(false);

  const [endGameVoteCount, setEndGameVoteCount] = useState(0);
  const [endGameVoteRequired, setEndGameVoteRequired] = useState(0);
  const [voteProgress, setVoteProgress] = useState<{ votesCast: number; totalNeeded: number } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const clearError = useCallback(() => setError(null), []);

  // Mutable refs so emit callbacks never stale-close over state
  const playerIdRef = useRef<string | null>(null);
  const roomCodeRef = useRef<string | null>(null);
  useEffect(() => { playerIdRef.current = playerId; }, [playerId]);
  useEffect(() => { roomCodeRef.current = roomCode; }, [roomCode]);

  // ── Socket event wiring ───────────────────────────────────────────────────
  // Runs once on client mount.  The singleton socket is created (or reused),
  // event handlers are attached, and the cleanup ONLY removes those handlers —
  // it never disconnects the socket.  This means React Strict Mode's
  // double-mount is safe: handlers are removed then re-added, socket stays up.
  useEffect(() => {
    const s = getSocket();
    socketRef.current = s;
    setSocket(s);

    // Sync initial connected state (socket may already be connected on re-mount)
    setIsConnected(s.connected);

    const attemptRestore = () => {
      const storedId = sessionStorage.getItem('mafia_player_id');
      const storedCode = sessionStorage.getItem('mafia_room_code');
      if (storedId && storedCode) {
        console.log('[Socket] Emitting reconnect_session for room:', storedCode);
        s.emit('reconnect_session', { playerId: storedId, roomCode: storedCode });
      }
    };

    // If socket is already connected when component mounts, restore session immediately
    if (s.connected) {
      attemptRestore();
    }

    // ── Connection lifecycle ──────────────────────────────────────────────
    const onConnect = () => {
      setIsConnected(true);
      console.log('[Socket] Connected:', s.id);
      attemptRestore();
    };

    const onDisconnect = (reason: string) => {
      setIsConnected(false);
      console.log('[Socket] Disconnected:', reason);
    };

    // ── Room join / create ────────────────────────────────────────────────
    const handleRoomEntry = (data: {
      roomCode: string;
      playerId: string;
      roomState: RoomState;
    }) => {
      sessionStorage.setItem('mafia_player_id', data.playerId);
      sessionStorage.setItem('mafia_room_code', data.roomCode);
      setPlayerId(data.playerId);
      setRoomCode(data.roomCode);
      setRoomState(data.roomState);
    };

    const onSessionRestored = (data: {
      roomCode: string;
      playerId: string;
      roomState: RoomState;
    }) => {
      setPlayerId(data.playerId);
      setRoomCode(data.roomCode);
      setRoomState(data.roomState);
    };

    const onSessionInvalid = ({ message }: { message: string }) => {
      sessionStorage.removeItem('mafia_player_id');
      sessionStorage.removeItem('mafia_room_code');
      setPlayerId(null);
      setRoomCode(null);
      setRoomState(null);
      setError(message);
    };

    // ── Lobby events ──────────────────────────────────────────────────────
    const onPlayerJoined = ({ roomState }: { roomState: RoomState }) => {
      setRoomState(roomState);
    };

    const onConfigUpdated = ({ config }: { config: GameConfig }) => {
      setRoomState((prev) => (prev ? { ...prev, config } : prev));
    };

    // ── Phase transitions ─────────────────────────────────────────────────
    const onPhaseChange = ({
      phase,
      roomState,
    }: {
      phase: string;
      roomState: RoomState;
    }) => {
      setRoomState(roomState);
      if (phase === 'night') {
        setIsDecoysComplete(false);
        setIsActionSubmitted(false);
        setNightResolution(null);
        setVoteResolution(null);
        setEndGameVoteCount(0);
        setEndGameVoteRequired(0);
      }
      // On game restart → lobby: wipe all private per-game client state
      if (phase === 'lobby') {
        setMyRole(null);
        setMyDecoySequence(null);
        setIsDecoysComplete(false);
        setIsActionSubmitted(false);
        setNightResolution(null);
        setVoteResolution(null);
        setGameOverInfo(null);
        setEndGameVoteCount(0);
        setEndGameVoteRequired(0);
      }
    };

    // ── Private role ──────────────────────────────────────────────────────
    const onPrivateRoleAssign = (roleInfo: MyRoleInfo) => {
      setMyRole(roleInfo);
    };

    // ── Night / decoy events ──────────────────────────────────────────────
    const onActionPhaseStart = ({ decoyTargetIds }: { decoyTargetIds: string[] }) => {
      setMyDecoySequence(decoyTargetIds);
      setIsDecoysComplete(false);
      setIsActionSubmitted(false);
    };

    const onDecoysCompleteAck = () => setIsDecoysComplete(true);
    const onAwaitingAction = () => setIsDecoysComplete(true);

    const onRoomStateUpdate = ({ roomState }: { roomState: RoomState }) => {
      setRoomState(roomState);
    };

    // ── Night resolution ──────────────────────────────────────────────────
    const onNightResolved = ({
      resolution,
      roomState,
    }: {
      resolution: NightResolution;
      roomState: RoomState;
    }) => {
      setNightResolution(resolution);
      setRoomState(roomState);
    };

    // ── Day vote events ───────────────────────────────────────────────────
    const onVoteUpdate = ({
      voteCounts,
      roomState,
    }: {
      voteCounts: Record<string, number>;
      roomState: RoomState;
    }) => {
      setRoomState(roomState);
      if (roomState?.totalVotesCast !== undefined) {
        setVoteProgress({
          votesCast: roomState.totalVotesCast,
          totalNeeded: roomState.players.filter((p) => p.isAlive).length,
        });
      }
    };

    const onVoteResolved = ({
      resolution,
      roomState,
    }: {
      resolution: VoteResolution;
      roomState: RoomState;
    }) => {
      setVoteResolution(resolution);
      setRoomState(roomState);
    };

    const onEndGameVoteUpdate = (data: {
      votes?: number;
      required?: number;
      currentVotes?: number;
      requiredVotes?: number;
      roomState?: RoomState;
    }) => {
      setEndGameVoteCount(data.currentVotes ?? data.votes ?? 0);
      setEndGameVoteRequired(data.requiredVotes ?? data.required ?? 0);
      if (data.roomState) setRoomState(data.roomState);
    };

    const onVictoryVotesUpdate = (data: {
      currentVotes: number;
      requiredVotes: number;
    }) => {
      setEndGameVoteCount(data.currentVotes);
      setEndGameVoteRequired(data.requiredVotes);
    };

    // ── Game over ─────────────────────────────────────────────────────────
    const onGameOver = (data: {
      winner: GameOverInfo['winner'];
      reason: string;
      jesterName: string | null;
      players: GameOverInfo['players'];
      roomState: RoomState;
    }) => {
      setGameOverInfo({
        winner: data.winner,
        reason: data.reason,
        jesterName: data.jesterName,
        players: data.players,
      });
      setRoomState(data.roomState);
    };

    // ── Error events ──────────────────────────────────────────────────────
    const onErrorEvent = ({ message }: { message: string }) => {
      setError(message);
    };

    const onVoteProgressUpdate = (data: { votesCast: number; totalNeeded: number }) => {
      setVoteProgress(data);
    };

    // ── Register all handlers ─────────────────────────────────────────────
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('room_created', handleRoomEntry);
    s.on('room_joined', handleRoomEntry);
    s.on('session_restored', onSessionRestored);
    s.on('session_invalid', onSessionInvalid);
    s.on('player_joined', onPlayerJoined);
    s.on('config_updated', onConfigUpdated);
    s.on('phase_change', onPhaseChange);
    s.on('private_role_assign', onPrivateRoleAssign);
    s.on('action_phase_start', onActionPhaseStart);
    s.on('decoys_complete_ack', onDecoysCompleteAck);
    s.on('awaiting_action', onAwaitingAction);
    s.on('room_state_update', onRoomStateUpdate);
    s.on('night_resolved', onNightResolved);
    s.on('vote_update', onVoteUpdate);
    s.on('vote_progress_update', onVoteProgressUpdate);
    s.on('vote_resolved', onVoteResolved);
    s.on('end_game_vote_update', onEndGameVoteUpdate);
    s.on('victory_votes_update', onVictoryVotesUpdate);
    s.on('game_over', onGameOver);
    s.on('error_event', onErrorEvent);

    const onKickedFromRoom = () => {
      clearSession();
      setPlayerId(null);
      setRoomCode(null);
      setRoomState(null);
      setMyRole(null);
      setMyDecoySequence(null);
      setNightResolution(null);
      setVoteResolution(null);
      setGameOverInfo(null);
      setIsDecoysComplete(false);
      setIsActionSubmitted(false);
      alert('You have been kicked from the room.');
      window.location.href = '/';
    };

    s.on('kicked_from_room', onKickedFromRoom);

    // ── Cleanup: remove listeners ONLY — never disconnect ─────────────────
    // Removing listeners is idempotent and safe for Strict Mode's double-mount.
    // The underlying WebSocket connection is intentionally kept alive.
    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('room_created', handleRoomEntry);
      s.off('room_joined', handleRoomEntry);
      s.off('session_restored', onSessionRestored);
      s.off('session_invalid', onSessionInvalid);
      s.off('player_joined', onPlayerJoined);
      s.off('config_updated', onConfigUpdated);
      s.off('phase_change', onPhaseChange);
      s.off('private_role_assign', onPrivateRoleAssign);
      s.off('action_phase_start', onActionPhaseStart);
      s.off('decoys_complete_ack', onDecoysCompleteAck);
      s.off('awaiting_action', onAwaitingAction);
      s.off('room_state_update', onRoomStateUpdate);
      s.off('night_resolved', onNightResolved);
      s.off('vote_update', onVoteUpdate);
      s.off('vote_progress_update', onVoteProgressUpdate);
      s.off('vote_resolved', onVoteResolved);
      s.off('end_game_vote_update', onEndGameVoteUpdate);
      s.off('victory_votes_update', onVictoryVotesUpdate);
      s.off('game_over', onGameOver);
      s.off('kicked_from_room', onKickedFromRoom);
      s.off('error_event', onErrorEvent);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Action helpers ────────────────────────────────────────────────────────

  const emit = useCallback(
    (event: string, payload?: Record<string, unknown>) => {
      socketRef.current?.emit(event, {
        roomCode: roomCodeRef.current,
        playerId: playerIdRef.current,
        ...payload,
      });
    },
    []
  );

  const createRoom = useCallback(
    (playerName: string, customRoomCode?: string) =>
      socketRef.current?.emit('create_room', { playerName, customRoomCode }),
    []
  );

  const joinRoom = useCallback(
    (playerName: string, code: string) =>
      socketRef.current?.emit('join_room', { playerName, roomCode: code }),
    []
  );

  const updateConfig = useCallback(
    (config: Partial<GameConfig>) => emit('update_config', { config }),
    [emit]
  );

  const startGame = useCallback(() => emit('start_game'), [emit]);
  const advanceToNight = useCallback(() => emit('advance_to_night'), [emit]);
  const advanceToVote = useCallback(() => emit('advance_to_vote'), [emit]);

  const onDecoySequenceComplete = useCallback(() => {
    setIsDecoysComplete(true);
    emit('decoy_sequence_complete');
  }, [emit]);

  const submitNightAction = useCallback(
    (targetId: string | null) => {
      setIsActionSubmitted(true);
      emit('submit_night_action', { targetId });
    },
    [emit]
  );

  const submitDayVote = useCallback(
    (targetId: string | null) => emit('submit_day_vote', { targetId }),
    [emit]
  );

  const callEndGame = useCallback(() => emit('call_end_game'), [emit]);

  const kickPlayer = useCallback(
    (targetId: string) => emit('kick_player', { targetId }),
    [emit]
  );

  const promoteHost = useCallback(
    (targetId: string) => emit('promote_host', { targetId }),
    [emit]
  );

  const leaveGame = useCallback(() => {
    emit('leave_game');
    clearSession();
    setPlayerId(null);
    setRoomCode(null);
    setRoomState(null);
    setMyRole(null);
    setMyDecoySequence(null);
    setNightResolution(null);
    setVoteResolution(null);
    setGameOverInfo(null);
    setIsDecoysComplete(false);
    setIsActionSubmitted(false);
    window.location.href = '/';
  }, [emit]);

  // ─── Context value ─────────────────────────────────────────────────────────
  const value: SocketContextValue = {
    socket,           // React state — properly triggers re-renders
    isConnected,
    playerId,
    roomCode,
    roomState,
    myRole,
    myDecoySequence,
    nightResolution,
    voteResolution,
    gameOverInfo,
    isDecoysComplete,
    isActionSubmitted,
    endGameVoteCount,
    endGameVoteRequired,
    voteProgress,
    error,
    setError,
    clearError,
    createRoom,
    joinRoom,
    updateConfig,
    startGame,
    advanceToNight,
    advanceToVote,
    onDecoySequenceComplete,
    submitNightAction,
    submitDayVote,
    callEndGame,
    kickPlayer,
    promoteHost,
    leaveGame,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within <SocketProvider>');
  return ctx;
}
