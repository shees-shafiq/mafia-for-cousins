// ─── gameManager.js ───────────────────────────────────────────────────────────
// Manages all in-memory room state and wires up Socket.io event handlers.
// Authoritative server model: all game-state mutations happen here.

const { v4: uuidv4 } = require('uuid');
const {
  ROLES,
  getThemeForIndex,
  generateDecoySequence,
  assignRoles,
  resolveNight,
  resolveVote,
  checkWinCondition,
} = require('./roles');

// ─── In-memory store ──────────────────────────────────────────────────────────
/** @type {Map<string, RoomState>} */
const rooms = new Map();

// ─── Room code generation ─────────────────────────────────────────────────────
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O to avoid confusion

function generateRoomCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () =>
      CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    ).join('');
  } while (rooms.has(code));
  return code;
}

// ─── Public state snapshot (NEVER includes roles) ────────────────────────────
function getPublicRoomState(room) {
  let skipCount = 0;
  if (room.votes) {
    for (const [, targetId] of room.votes.entries()) {
      if (!targetId || targetId === 'skip' || targetId === 'null') {
        skipCount++;
      }
    }
  }

  return {
    code: room.code,
    hostId: room.hostId,
    config: room.config,
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      animal: p.animal,
      themeName: p.themeName,
      isAlive: p.isAlive,
      connected: p.connected !== false,
      isHost: p.id === room.hostId,
      hasSubmittedAction: p.hasSubmittedAction,
      hasCompletedDecoys: p.hasCompletedDecoys,
      hasVoted: room.votes ? room.votes.has(p.id) : false,
    })),
    phase: room.phase,
    round: room.round,
    winner: room.winner,
    announceType: room.announceType,
    lastResolution: room.lastResolution,
    voteCounts: getVoteCounts(room),
    skipCount,
    totalVotesCast: room.votes ? room.votes.size : 0,
    endGameVoteCount: room.endGameVotes.size,
  };
}

function getVoteCounts(room) {
  const counts = {};
  for (const [, targetId] of room.votes.entries()) {
    if (targetId && targetId !== 'skip' && room.players.has(targetId)) {
      counts[targetId] = (counts[targetId] || 0) + 1;
    }
  }
  return counts;
}

// ─── Garbage Collection ───────────────────────────────────────────────────────
const ROOM_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Count how many players in this room still have a live socket connection.
 */
function countConnectedSockets(io, room) {
  let connected = 0;
  for (const player of room.players.values()) {
    if (player.socketId && io.sockets.sockets.has(player.socketId)) {
      connected++;
    }
  }
  return connected;
}

/**
 * Schedule room deletion after ROOM_TTL_MS if nobody is connected.
 * Cancels any previously scheduled cleanup first.
 */
function scheduleRoomCleanup(io, room) {
  // Clear any existing timer
  if (room.cleanupTimeout) {
    clearTimeout(room.cleanupTimeout);
    room.cleanupTimeout = null;
  }

  room.cleanupTimeout = setTimeout(() => {
    // Double-check: still empty when the timer fires?
    if (countConnectedSockets(io, room) === 0) {
      rooms.delete(room.code);
      console.log(`[GC] Deleted empty room ${room.code} after ${ROOM_TTL_MS / 60000} min TTL`);
    }
  }, ROOM_TTL_MS);

  console.log(`[GC] Room ${room.code} is empty — will be deleted in ${ROOM_TTL_MS / 60000} min if no one rejoins`);
}

/**
 * Cancel any pending cleanup for this room (called when someone joins/reconnects).
 */
function cancelRoomCleanup(room) {
  if (room.cleanupTimeout) {
    clearTimeout(room.cleanupTimeout);
    room.cleanupTimeout = null;
    console.log(`[GC] Cleanup cancelled for ${room.code} — player reconnected`);
  }
}

// ─── Private role packet (sent to a single socket ONLY) ──────────────────────
function buildPrivateRolePacket(player, room) {
  const teammates =
    player.role === ROLES.IMPOSTER
      ? [...room.players.values()]
          .filter((p) => p.role === ROLES.IMPOSTER && p.id !== player.id)
          .map((p) => ({ id: p.id, name: p.name, isBoss: p.isBoss }))
      : [];
  return { role: player.role, isBoss: player.isBoss, teammates };
}

// ─── Phase transition helpers ─────────────────────────────────────────────────

function startNightPhase(io, room) {
  room.phase = 'night';
  room.nightActions = new Map();
  room.decoyComplete = new Set();
  room.decoySequences = new Map();
  room.votes = new Map();
  room.endGameVotes = new Set();
  room.announceType = null;
  room.lastResolution = null;

  // Reset per-player flags
  for (const player of room.players.values()) {
    player.hasCompletedDecoys = false;
    player.hasSubmittedAction = false;
  }

  const livingPlayers = [...room.players.values()].filter((p) => p.isAlive);

  // Generate and send a private decoy sequence to every living player
  for (const player of livingPlayers) {
    const seq = generateDecoySequence(player.id, livingPlayers);
    room.decoySequences.set(player.id, seq);

    const sock = io.sockets.sockets.get(player.socketId);
    if (sock) {
      sock.emit('action_phase_start', {
        decoyTargetIds: seq,
        phase: 'night',
      });
    }
  }

  // Broadcast phase change (no role data in this payload)
  io.to(room.code).emit('phase_change', {
    phase: 'night',
    roomState: getPublicRoomState(room),
  });
}

function resolveNightPhase(io, room) {
  const { killed, saved } = resolveNight(room);

  // Build public resolution (respect revealMode)
  const killedInfo = killed.map((id) => {
    const p = room.players.get(id);
    return {
      id: p.id,
      name: p.name,
      role: room.config.revealMode === 'classic' ? p.role : null,
    };
  });

  const savedInfo =
    room.config.revealMode === 'classic'
      ? saved.map((id) => {
          const p = room.players.get(id);
          return { id: p.id, name: p.name };
        })
      : [];

  const resolution = {
    type: 'night',
    killed: killedInfo,
    saved: savedInfo,
    peaceful: killed.length === 0,
  };

  room.phase = 'day_announce';
  room.announceType = 'night';
  room.lastResolution = resolution;

  // Check win condition AFTER kills are applied (Bypass in Secret Mode)
  if (room.config.revealMode !== 'secret') {
    const winner = checkWinCondition(room);
    if (winner) {
      endGame(io, room, winner, 'night_resolution');
      return;
    }
  }

  io.to(room.code).emit('night_resolved', {
    resolution,
    roomState: getPublicRoomState(room),
  });

  const livingPlayers = [...room.players.values()].filter((p) => p.isAlive);
  const requiredVotes = Math.floor(livingPlayers.length / 2) + 1;
  io.to(room.code).emit('victory_votes_update', {
    currentVotes: 0,
    requiredVotes,
  });
}

function resolveVotePhase(io, room) {
  const { executedId, jesterWin, tied, reason } = resolveVote(room);

  if (jesterWin) {
    const jester = room.players.get(executedId);
    endGame(io, room, 'jester', 'The Jester tricked the town!', jester?.name);
    return;
  }

  const executedPlayer = executedId ? room.players.get(executedId) : null;
  const resolution = {
    type: 'vote',
    executedPlayer: executedPlayer
      ? {
          id: executedPlayer.id,
          name: executedPlayer.name,
          role:
            room.config.revealMode === 'classic' ? executedPlayer.role : null,
        }
      : null,
    tied,
    reason: tied ? 'tie' : (!executedPlayer ? 'skipped' : null),
  };

  room.phase = 'day_announce';
  room.announceType = 'vote';
  room.lastResolution = resolution;

  // Check win condition after execution (Bypass in Secret Mode)
  if (room.config.revealMode !== 'secret') {
    const winner = checkWinCondition(room);
    if (winner) {
      endGame(io, room, winner, 'vote_resolution');
      return;
    }
  }

  io.to(room.code).emit('vote_resolved', {
    resolution,
    roomState: getPublicRoomState(room),
  });
}

function endGame(io, room, winner, reason, jesterName = null) {
  room.winner = winner;
  room.phase = 'game_over';

  // Full role reveal on game over — intentional broadcast
  const players = [...room.players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    animal: p.animal,
    themeName: p.themeName,
    isAlive: p.isAlive,
    isHost: p.id === room.hostId,
    role: p.role,
    isBoss: p.isBoss,
    hasSubmittedAction: p.hasSubmittedAction,
    hasCompletedDecoys: p.hasCompletedDecoys,
  }));

  io.to(room.code).emit('game_over', {
    winner,
    reason,
    jesterName,
    players,
    roomState: getPublicRoomState(room),
  });
}

// ─── Socket.io handler setup ──────────────────────────────────────────────────
function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`[+] Socket connected: ${socket.id}`);

    // ── create_room ────────────────────────────────────────────────────────
    socket.on('create_room', ({ playerName, customRoomCode }) => {
      let code;
      const custom = String(customRoomCode || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

      if (custom && custom.length >= 3) {
        if (rooms.has(custom)) {
          socket.emit('error_event', { message: `Room code "${custom}" is already taken. Please choose another.` });
          return;
        }
        code = custom;
      } else {
        code = generateRoomCode();
      }

      const playerId = uuidv4();
      const theme = getThemeForIndex(0);

      const hostPlayer = {
        id: playerId,
        name: String(playerName).slice(0, 12),
        socketId: socket.id,
        color: theme.color,
        animal: theme.animal,
        themeName: theme.name,
        role: null,
        isBoss: false,
        isAlive: true,
        connected: true,
        hasCompletedDecoys: false,
        hasSubmittedAction: false,
      };

      const room = {
        code,
        hostId: playerId,
        config: {
          imposterCount: 1,
          imposterMode: 'godfather',
          hasDoctor: false,
          hasJester: false,
          revealMode: 'classic',
        },
        players: new Map([[playerId, hostPlayer]]),
        phase: 'lobby',
        round: 0,
        nightActions: new Map(),
        decoyComplete: new Set(),
        decoySequences: new Map(),
        votes: new Map(),
        endGameVotes: new Set(),
        winner: null,
        announceType: null,
        lastResolution: null,
      };

      rooms.set(code, room);
      socket.join(code);

      socket.emit('room_created', {
        roomCode: code,
        playerId,
        roomState: getPublicRoomState(room),
      });

      console.log(`[Room] Created ${code} by ${hostPlayer.name}`);
    });

    // ── join_room ──────────────────────────────────────────────────────────
    socket.on('join_room', ({ playerName, roomCode }) => {
      const code = String(roomCode).toUpperCase().trim();
      const room = rooms.get(code);

      if (!room) {
        socket.emit('error_event', { message: 'Room not found. Check the code and try again.' });
        return;
      }
      if (room.phase !== 'lobby') {
        socket.emit('error_event', { message: 'Game has already started.' });
        return;
      }
      if (room.players.size >= 20) {
        socket.emit('error_event', { message: 'Room is full (max 20 players).' });
        return;
      }

      const nameTrimmed = String(playerName || '').trim();
      const nameLower = nameTrimmed.toLowerCase();
      const isNameTaken = [...room.players.values()].some(
        (p) => p.name.trim().toLowerCase() === nameLower
      );
      if (isNameTaken) {
        socket.emit('error_event', {
          message: 'Name already taken in this room. Please choose another name or nickname.',
        });
        return;
      }

      const playerId = uuidv4();
      const themeIndex = room.players.size;
      const theme = getThemeForIndex(themeIndex);

      const newPlayer = {
        id: playerId,
        name: String(playerName).slice(0, 12),
        socketId: socket.id,
        color: theme.color,
        animal: theme.animal,
        themeName: theme.name,
        role: null,
        isBoss: false,
        isAlive: true,
        connected: true,
        hasCompletedDecoys: false,
        hasSubmittedAction: false,
      };

      room.players.set(playerId, newPlayer);
      socket.join(code);
      cancelRoomCleanup(room); // someone joined — cancel any pending deletion

      // Confirm to the joining player
      socket.emit('room_joined', {
        roomCode: code,
        playerId,
        roomState: getPublicRoomState(room),
      });

      // Notify everyone else (including the new player via the room broadcast)
      io.to(code).emit('player_joined', {
        roomState: getPublicRoomState(room),
      });

      console.log(`[Room] ${newPlayer.name} joined ${code} (${room.players.size} players)`);
    });

    // ── reconnect_session ──────────────────────────────────────────────────
    socket.on('reconnect_session', ({ playerId, roomCode }) => {
      const code = String(roomCode || '').toUpperCase().trim();
      const room = rooms.get(code);

      if (!room || !room.players.has(playerId)) {
        socket.emit('session_invalid', {
          message: 'Session expired or room not found. Please rejoin.',
        });
        return;
      }

      const player = room.players.get(playerId);
      player.socketId = socket.id; // re-link socket
      player.connected = true;
      socket.join(code);
      cancelRoomCleanup(room); // player is back — cancel any pending deletion

      socket.emit('session_restored', {
        roomCode: code,
        playerId,
        roomState: getPublicRoomState(room),
      });

      // Broadcast state update to clear offline badge for all players
      io.to(code).emit('room_state_update', { roomState: getPublicRoomState(room) });

      // Re-send private role info if game is in progress
      if (room.phase !== 'lobby' && player.role) {
        socket.emit('private_role_assign', buildPrivateRolePacket(player, room));

        // If night phase: resend decoy sequence or awaiting_action state
        if (room.phase === 'night') {
          if (!player.hasCompletedDecoys) {
            const seq = room.decoySequences.get(playerId) || [];
            socket.emit('action_phase_start', { decoyTargetIds: seq, phase: 'night' });
          } else if (!player.hasSubmittedAction) {
            socket.emit('awaiting_action', { role: player.role });
          }
        }
      }

      console.log(`[Room] ${player.name} reconnected to ${code}`);
    });

    // ── update_config ──────────────────────────────────────────────────────
    socket.on('update_config', ({ roomCode, playerId, config }) => {
      const code = String(roomCode || '').toUpperCase();
      const room = rooms.get(code);
      if (!room || room.hostId !== playerId || room.phase !== 'lobby') return;

      const current = room.config || {
        imposterCount: 1,
        imposterMode: 'godfather',
        hasDoctor: false,
        hasJester: false,
        revealMode: 'classic',
      };

      // Safely merge incoming fields with existing room config
      const safe = {
        imposterCount:
          config.imposterCount !== undefined
            ? Math.max(1, Math.min(5, Number(config.imposterCount) || 1))
            : current.imposterCount,
        imposterMode:
          config.imposterMode !== undefined && ['godfather', 'roulette'].includes(config.imposterMode)
            ? config.imposterMode
            : current.imposterMode,
        hasDoctor:
          config.hasDoctor !== undefined
            ? Boolean(config.hasDoctor)
            : current.hasDoctor,
        hasJester:
          config.hasJester !== undefined
            ? Boolean(config.hasJester)
            : current.hasJester,
        revealMode:
          config.revealMode !== undefined && ['classic', 'secret'].includes(config.revealMode)
            ? config.revealMode
            : current.revealMode,
      };

      room.config = safe;
      io.to(code).emit('config_updated', { config: room.config });
    });

    // ── start_game ─────────────────────────────────────────────────────────
    socket.on('start_game', ({ roomCode, playerId }) => {
      const code = String(roomCode || '').toUpperCase();
      const room = rooms.get(code);

      if (!room || room.hostId !== playerId) return;
      if (room.players.size < 4) {
        socket.emit('error_event', { message: 'Need at least 4 players to start.' });
        return;
      }
      if (room.phase !== 'lobby') return;

      // Validate imposter count vs total player count
      const totalPlayers = room.players.size;
      const maxAllowedImposters = Math.floor((totalPlayers - 1) / 2);
      if (room.config.imposterCount > maxAllowedImposters) {
        socket.emit('error_event', {
          message: `Too many imposters for ${totalPlayers} players. Maximum is ${maxAllowedImposters}.`,
        });
        return;
      }

      // Assign roles privately
      const roleMap = assignRoles(room.players, room.config);
      for (const [pid, { role, isBoss }] of roleMap.entries()) {
        const p = room.players.get(pid);
        p.role = role;
        p.isBoss = isBoss;
      }

      room.phase = 'role_reveal';
      room.round = 1;

      // Send each player their private role — never broadcast the full map
      for (const player of room.players.values()) {
        const sock = io.sockets.sockets.get(player.socketId);
        if (sock) {
          sock.emit('private_role_assign', buildPrivateRolePacket(player, room));
        }
      }

      io.to(code).emit('phase_change', {
        phase: 'role_reveal',
        roomState: getPublicRoomState(room),
      });

      console.log(`[Room] Game started in ${code} (${room.players.size} players)`);
    });

    // ── advance_to_night ───────────────────────────────────────────────────
    // Host advances: role_reveal → night, OR day_announce(vote) → night
    socket.on('advance_to_night', ({ roomCode, playerId }) => {
      const code = String(roomCode || '').toUpperCase();
      const room = rooms.get(code);
      if (!room || room.hostId !== playerId) return;
      if (room.phase !== 'role_reveal' && !(room.phase === 'day_announce' && room.announceType === 'vote')) {
        return;
      }

      room.round = room.phase === 'role_reveal' ? 1 : room.round + 1;
      startNightPhase(io, room);
    });

    // ── advance_to_vote ────────────────────────────────────────────────────
    // Host advances: day_announce(night) → day_vote
    socket.on('advance_to_vote', ({ roomCode, playerId }) => {
      const code = String(roomCode || '').toUpperCase();
      const room = rooms.get(code);
      if (!room || room.hostId !== playerId) return;
      if (!(room.phase === 'day_announce' && room.announceType === 'night')) return;

      room.phase = 'day_vote';
      room.votes = new Map();
      room.endGameVotes = new Set();

      const livingPlayers = [...room.players.values()].filter((p) => p.isAlive);
      const requiredVotes = Math.floor(livingPlayers.length / 2) + 1;

      io.to(code).emit('phase_change', {
        phase: 'day_vote',
        roomState: getPublicRoomState(room),
      });

      io.to(code).emit('vote_progress_update', {
        votesCast: 0,
        totalNeeded: livingPlayers.length,
      });

      io.to(code).emit('victory_votes_update', {
        currentVotes: 0,
        requiredVotes,
      });
    });

    // ── decoy_sequence_complete ────────────────────────────────────────────
    // Client fires once after completing all local decoy taps (optimistic UI)
    socket.on('decoy_sequence_complete', ({ roomCode, playerId }) => {
      const code = String(roomCode || '').toUpperCase();
      const room = rooms.get(code);
      if (!room || room.phase !== 'night') return;

      const player = room.players.get(playerId);
      if (!player || !player.isAlive) return;

      player.hasCompletedDecoys = true;
      room.decoyComplete.add(playerId);

      // Confirm to the player — they can now render action buttons
      const sock = io.sockets.sockets.get(player.socketId);
      if (sock) {
        sock.emit('decoys_complete_ack', { role: player.role });
      }

      // Broadcast progress indicator
      io.to(code).emit('room_state_update', { roomState: getPublicRoomState(room) });
    });

    // ── submit_night_action ────────────────────────────────────────────────
    // targetId: string (kill/heal target) | null (sleep / skip)
    socket.on('submit_night_action', ({ roomCode, playerId, targetId }) => {
      const code = String(roomCode || '').toUpperCase();
      const room = rooms.get(code);
      if (!room || room.phase !== 'night') return;

      const player = room.players.get(playerId);
      if (!player || !player.isAlive) return;

      // GATEKEEPER: reject if decoys haven't been confirmed
      if (!room.decoyComplete.has(playerId)) {
        socket.emit('error_event', { message: 'Complete your tasks before acting.' });
        return;
      }
      // Prevent double-submission
      if (player.hasSubmittedAction) return;

      // Validate target (if provided)
      if (targetId !== null) {
        const target = room.players.get(targetId);
        if (!target || !target.isAlive) {
          socket.emit('error_event', { message: 'Invalid target.' });
          return;
        }
      }

      // Citizen "Fake Out" mechanic:
      // Citizens and Jesters can select a target on their screen to blend in,
      // but the server forces their action payload to null.
      let resolvedTargetId = targetId ?? null;
      if (player.role === ROLES.CITIZEN || player.role === ROLES.JESTER) {
        resolvedTargetId = null;
      }

      room.nightActions.set(playerId, resolvedTargetId);
      player.hasSubmittedAction = true;

      io.to(code).emit('room_state_update', { roomState: getPublicRoomState(room) });

      // Auto-resolve once every living player has submitted
      const livingPlayers = [...room.players.values()].filter((p) => p.isAlive);
      if (room.nightActions.size >= livingPlayers.length) {
        console.log(`[Room] All actions submitted in ${code} — resolving night`);
        resolveNightPhase(io, room);
      }
    });

    // ── submit_day_vote / submit_vote ──────────────────────────────────────
    const handleSubmitVote = ({ roomCode, playerId, targetId }) => {
      const code = String(roomCode || '').toUpperCase();
      const room = rooms.get(code);
      if (!room || room.phase !== 'day_vote') return;

      const voter = room.players.get(playerId);
      if (!voter || !voter.isAlive) return;

      // Backend Vote Lock — ignore if player has already submitted their vote
      if (room.votes.has(playerId)) return;

      // Handle skip / null / empty vote payload
      const isSkip = !targetId || targetId === 'skip' || targetId === 'null' || targetId === '';
      if (isSkip) {
        room.votes.set(playerId, 'skip');
        voter.hasVoted = true;
      } else {
        const target = room.players.get(targetId);
        if (!target || !target.isAlive) {
          // If invalid or dead target, treat as skip rather than ignoring vote
          room.votes.set(playerId, 'skip');
          voter.hasVoted = true;
        } else {
          // Only Jester is allowed to vote for themselves
          if (playerId === targetId && voter.role !== ROLES.JESTER) {
            socket.emit('error_event', { message: 'You cannot vote for yourself.' });
            return;
          }
          room.votes.set(playerId, targetId);
          voter.hasVoted = true;
        }
      }

      const livingPlayers = [...room.players.values()].filter((p) => p.isAlive);

      // Live Progress Event (emitted immediately on every valid vote or skip)
      io.to(code).emit('vote_progress_update', {
        votesCast: room.votes.size,
        totalNeeded: livingPlayers.length,
      });

      io.to(code).emit('vote_update', {
        voteCounts: getVoteCounts(room),
        roomState: getPublicRoomState(room),
      });

      // Auto-resolve when all living players have voted (including skips)
      if (room.votes.size >= livingPlayers.length) {
        console.log(`[Room] All votes submitted in ${code} (${room.votes.size}/${livingPlayers.length}) — resolving vote`);
        resolveVotePhase(io, room);
      }
    };

    socket.on('submit_day_vote', handleSubmitVote);
    socket.on('submit_vote', handleSubmitVote);

    // ── call_end_game / declare_victory ────────────────────────────────────
    // Only available when revealMode === 'secret'. Threshold is >50% of living players.
    const handleDeclareVictory = ({ roomCode, playerId }) => {
      const code = String(roomCode || '').toUpperCase();
      const room = rooms.get(code);
      if (!room || room.phase !== 'day_vote') return;
      if (room.config.revealMode !== 'secret') return;

      const voter = room.players.get(playerId);
      if (!voter || !voter.isAlive) return;

      room.endGameVotes.add(playerId);

      const livingPlayers = [...room.players.values()].filter((p) => p.isAlive);
      const requiredVotes = Math.floor(livingPlayers.length / 2) + 1;
      const currentVotes = room.endGameVotes.size;

      io.to(code).emit('end_game_vote_update', {
        votes: currentVotes,
        required: requiredVotes,
        currentVotes,
        requiredVotes,
        roomState: getPublicRoomState(room),
      });

      io.to(code).emit('victory_votes_update', {
        currentVotes,
        requiredVotes,
      });

      if (currentVotes >= requiredVotes) {
        const isImposterAlive = Array.from(room.players.values()).some(
          (p) => p.isAlive && p.role === ROLES.IMPOSTER
        );

        if (isImposterAlive) {
          endGame(
            io,
            room,
            'imposters',
            'The town foolishly declared victory while an Imposter was still among them!'
          );
        } else {
          endGame(
            io,
            room,
            'citizens',
            'The town successfully secured the village!'
          );
        }
      }
    };

    socket.on('call_end_game', handleDeclareVictory);
    socket.on('declare_victory', handleDeclareVictory);

    // ── force_end_night ─────────────────────────────────────────────────────
    // Host-only admin override. Fills all pending night actions with null (sleep)
    // then immediately resolves the night. Bypasses isAlive check.
    socket.on('force_end_night', ({ roomCode, playerId }) => {
      const code = String(roomCode || '').toUpperCase();
      const room = rooms.get(code);
      if (!room || room.phase !== 'night') return;
      if (room.hostId !== playerId) return;   // host-only — no isAlive check

      const livingPlayers = [...room.players.values()].filter((p) => p.isAlive);

      // Fill in anyone who hasn't submitted yet
      for (const player of livingPlayers) {
        if (!room.nightActions.has(player.id)) {
          // Mark decoy as complete so the action is accepted
          room.decoyComplete.add(player.id);
          player.hasCompletedDecoys = true;
          room.nightActions.set(player.id, null); // null = sleep/skip
          player.hasSubmittedAction = true;
        }
      }

      console.log(`[Room] Host force-ended night in ${code}`);
      resolveNightPhase(io, room);
    });

    // ── begin_voting ────────────────────────────────────────────────────────
    // Host-only. Advances day_announce(night) → day_vote.
    // Mirrors advance_to_vote but bypasses the isAlive check.
    socket.on('begin_voting', ({ roomCode, playerId }) => {
      const code = String(roomCode || '').toUpperCase();
      const room = rooms.get(code);
      if (!room || room.hostId !== playerId) return;
      if (!(room.phase === 'day_announce' && room.announceType === 'night')) return;

      room.phase = 'day_vote';
      room.votes = new Map();
      room.endGameVotes = new Set();

      const livingPlayers = [...room.players.values()].filter((p) => p.isAlive);
      const requiredVotes = Math.floor(livingPlayers.length / 2) + 1;

      io.to(code).emit('phase_change', {
        phase: 'day_vote',
        roomState: getPublicRoomState(room),
      });

      io.to(code).emit('vote_progress_update', {
        votesCast: 0,
        totalNeeded: livingPlayers.length,
      });

      io.to(code).emit('victory_votes_update', {
        currentVotes: 0,
        requiredVotes,
      });

      console.log(`[Room] Host began voting in ${code}`);
    });

    // ── force_end_vote ──────────────────────────────────────────────────────
    // Host-only admin override. Fills all non-votes with null (abstain)
    // then immediately resolves the vote. Bypasses isAlive check.
    socket.on('force_end_vote', ({ roomCode, playerId }) => {
      const code = String(roomCode || '').toUpperCase();
      const room = rooms.get(code);
      if (!room || room.phase !== 'day_vote') return;
      if (room.hostId !== playerId) return;   // host-only — no isAlive check

      const livingPlayers = [...room.players.values()].filter((p) => p.isAlive);

      // Fill in abstentions (null votes don't contribute to any tally)
      for (const player of livingPlayers) {
        if (!room.votes.has(player.id)) {
          room.votes.set(player.id, null);
        }
      }

      console.log(`[Room] Host force-ended vote in ${code}`);
      resolveVotePhase(io, room);
    });

    // ── restart_game ────────────────────────────────────────────────────────
    // Host-only. Resets per-game state back to lobby while keeping players
    // and config intact. Triggers lobby navigation on all clients.
    socket.on('restart_game', ({ roomCode, playerId }) => {
      const code = String(roomCode || '').toUpperCase();
      const room = rooms.get(code);
      if (!room) return;
      if (room.phase !== 'game_over') return;        // safety: only from game_over
      if (room.hostId !== playerId) return;          // host-only

      // ── Reset all per-round state ─────────────────────────────────────────
      room.phase = 'lobby';
      room.round = 0;
      room.winner = null;
      room.announceType = null;
      room.lastResolution = null;

      // Clear collections
      room.nightActions.clear();
      room.votes.clear();
      room.decoyComplete.clear();
      room.decoySequences.clear();
      room.endGameVotes.clear();

      // Reset per-player game state (keep name, color, animal, id)
      for (const player of room.players.values()) {
        player.role = null;
        player.isBoss = false;
        player.isAlive = true;
        player.hasSubmittedAction = false;
        player.hasCompletedDecoys = false;
      }

      console.log(`[Room] Game restarted in ${code} by host ${playerId}`);

      // Push everyone back to the lobby screen
      io.to(code).emit('phase_change', {
        phase: 'lobby',
        roomState: getPublicRoomState(room),
      });
    });

    // ── kick_player ────────────────────────────────────────────────────────
    // Host-only, lobby-phase only. Kicks target player and removes from room.
    socket.on('kick_player', ({ roomCode, playerId, targetId }) => {
      const code = String(roomCode || '').toUpperCase();
      const room = rooms.get(code);
      if (!room || room.hostId !== playerId || room.phase !== 'lobby') return;
      if (!targetId || targetId === playerId) return; // Cannot kick self

      const targetPlayer = room.players.get(targetId);
      if (!targetPlayer) return;

      // Notify target socket
      if (targetPlayer.socketId) {
        const targetSock = io.sockets.sockets.get(targetPlayer.socketId);
        if (targetSock) {
          targetSock.emit('kicked_from_room');
          targetSock.leave(code);
        }
      }

      room.players.delete(targetId);
      console.log(`[Room] Host kicked ${targetPlayer.name} from ${code}`);

      io.to(code).emit('room_state_update', { roomState: getPublicRoomState(room) });
    });

    // ── promote_host ───────────────────────────────────────────────────────
    // Host-only. Transfers room host privileges to target player.
    socket.on('promote_host', ({ roomCode, playerId, targetId }) => {
      const code = String(roomCode || '').toUpperCase();
      const room = rooms.get(code);
      if (!room || room.hostId !== playerId) return;
      if (!targetId || !room.players.has(targetId)) return;

      room.hostId = targetId;
      console.log(`[Room] Host promoted ${room.players.get(targetId).name} to host in ${code}`);

      io.to(code).emit('room_state_update', { roomState: getPublicRoomState(room) });
    });

    // ── leave_game ─────────────────────────────────────────────────────────
    // Voluntary player quit (lobby = remove; active game = eliminate).
    socket.on('leave_game', ({ roomCode, playerId }) => {
      const code = String(roomCode || '').toUpperCase();
      const room = rooms.get(code);
      if (!room || !room.players.has(playerId)) return;

      const player = room.players.get(playerId);
      const isHost = room.hostId === playerId;
      socket.leave(code);

      if (room.phase === 'lobby') {
        // In lobby: completely delete player from room
        room.players.delete(playerId);
        console.log(`[Room] ${player.name} left lobby in ${code}`);

        if (room.players.size === 0) {
          scheduleRoomCleanup(io, room);
        } else if (isHost) {
          // Reassign host to next available player
          const remaining = [...room.players.values()];
          const nextHost = remaining.find((p) => p.connected) || remaining[0];
          if (nextHost) {
            room.hostId = nextHost.id;
            console.log(`[Host] Host reassigned to ${nextHost.name} in ${code}`);
          }
        }

        io.to(code).emit('room_state_update', { roomState: getPublicRoomState(room) });
      } else {
        // In active game: eliminate player
        player.isAlive = false;
        player.connected = false;
        console.log(`[Room] ${player.name} fled active game in ${code}`);

        // Reassign host if leaving player was host
        if (isHost) {
          const remaining = [...room.players.values()];
          const nextHost =
            remaining.find((p) => p.connected && p.isAlive) ||
            remaining.find((p) => p.connected) ||
            remaining[0];
          if (nextHost) {
            room.hostId = nextHost.id;
            console.log(`[Host] Crown reassigned to ${nextHost.name} in ${code}`);
          }
        }

        // Clean up pending actions/votes from this player
        room.nightActions.delete(playerId);
        room.votes.delete(playerId);
        room.endGameVotes.delete(playerId);

        // Check if active game should instantly end (e.g. last imposter fled)
        if (room.phase !== 'game_over') {
          const winner = checkWinCondition(room);
          if (winner) {
            endGame(io, room, winner, 'elimination');
            return;
          }
        }

        // Check Phase Progression (Critical Constraint 1)
        const livingPlayers = [...room.players.values()].filter((p) => p.isAlive);
        if (room.phase === 'night') {
          if (livingPlayers.length > 0 && room.nightActions.size >= livingPlayers.length) {
            console.log(`[Room] All remaining living actions present in ${code} after leave — resolving night`);
            resolveNightPhase(io, room);
            return;
          }
        } else if (room.phase === 'day_vote') {
          if (livingPlayers.length > 0 && room.votes.size >= livingPlayers.length) {
            console.log(`[Room] All remaining living votes present in ${code} after leave — resolving vote`);
            resolveVotePhase(io, room);
            return;
          }
        }

        io.to(code).emit('room_state_update', { roomState: getPublicRoomState(room) });
      }
    });

    // ── disconnect ─────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`[-] Socket disconnected: ${socket.id}`);

      // Find which room this socket belonged to (scan by socketId)
      for (const room of rooms.values()) {
        const player = [...room.players.values()].find((p) => p.socketId === socket.id);
        if (!player) continue;

        player.connected = false;
        console.log(`[Room] ${player.name} disconnected (offline) from ${room.code}`);

        // The Crown Bounce: if disconnected player was the Host, find first available connected player
        if (room.hostId === player.id) {
          const newHost = [...room.players.values()].find((p) => p.connected === true);
          if (newHost) {
            room.hostId = newHost.id;
            console.log(`[Host] Crown bounced to ${newHost.name} in ${room.code}`);
          }
        }

        // Broadcast updated room_state to all remaining sockets
        io.to(room.code).emit('room_state_update', { roomState: getPublicRoomState(room) });

        // Count how many players still have a live socket
        setTimeout(() => {
          const connected = countConnectedSockets(io, room);
          if (connected === 0) {
            // Room is completely empty — start the TTL countdown
            scheduleRoomCleanup(io, room);
          }
        }, 500);

        break; // a socket can only belong to one room
      }
    });

  });
}

module.exports = { setupSocketHandlers, rooms };
