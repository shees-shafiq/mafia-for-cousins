// ─── roles.js ────────────────────────────────────────────────────────────────
// Pure role-logic module — no socket.io imports here.
// All functions are deterministic given their inputs.

const ROLES = {
  CITIZEN: 'citizen',
  IMPOSTER: 'imposter',
  DOCTOR: 'doctor',
  JESTER: 'jester',
};

/** Twenty visually distinct player themes (color + animal emoji) */
const PLAYER_THEMES = [
  { color: '#ef4444', animal: '🦊', name: 'Crimson Fox' },
  { color: '#3b82f6', animal: '🐺', name: 'Cobalt Wolf' },
  { color: '#10b981', animal: '🐸', name: 'Emerald Frog' },
  { color: '#f59e0b', animal: '🐻', name: 'Amber Bear' },
  { color: '#8b5cf6', animal: '🦁', name: 'Violet Lion' },
  { color: '#ec4899', animal: '🦋', name: 'Rose Moth' },
  { color: '#06b6d4', animal: '🐬', name: 'Cyan Dolphin' },
  { color: '#84cc16', animal: '🐊', name: 'Lime Gator' },
  { color: '#f97316', animal: '🦝', name: 'Tangerine Raccoon' },
  { color: '#a855f7', animal: '🦂', name: 'Plum Scorpion' },
  { color: '#14b8a6', animal: '🐙', name: 'Teal Octopus' },
  { color: '#fbbf24', animal: '🦅', name: 'Gold Eagle' },
  { color: '#e11d48', animal: '🦉', name: 'Ruby Owl' },
  { color: '#6366f1', animal: '🦈', name: 'Indigo Shark' },
  { color: '#059669', animal: '🐢', name: 'Jade Turtle' },
  { color: '#d97706', animal: '🐯', name: 'Topaz Tiger' },
  { color: '#9333ea', animal: '🦇', name: 'Purple Bat' },
  { color: '#0284c7', animal: '🐧', name: 'Sky Penguin' },
  { color: '#65a30d', animal: '🦎', name: 'Olive Chameleon' },
  { color: '#db2777', animal: '🦩', name: 'Flamingo Pink' },
];

function getThemeForIndex(index) {
  return PLAYER_THEMES[index % PLAYER_THEMES.length];
}

/**
 * True Fisher-Yates (Knuth) Shuffle Algorithm.
 * Produces an unbiased, statistically uniform permutation of the array.
 *
 * @template T
 * @param {T[]} arr
 * @returns {T[]} Freshly shuffled copy of the array
 */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = a[i];
    a[i] = a[j];
    a[j] = temp;
  }
  return a;
}

/**
 * Generate a decoy tapping sequence for one player.
 * Picks 2–3 random OTHER living players (never includes self, never includes dead).
 *
 * @param {string} playerId   - The player receiving the sequence
 * @param {Array}  livingPlayers - Array of alive player objects { id, name, ... }
 * @returns {string[]}  Array of player IDs to tap in order
 */
function generateDecoySequence(playerId, livingPlayers) {
  const others = livingPlayers.filter((p) => p.id !== playerId);
  const shuffled = shuffle(others);
  // 2 decoys if few players, 3 otherwise
  const count = others.length >= 3 ? (Math.random() < 0.5 ? 2 : 3) : Math.min(2, others.length);
  return shuffled.slice(0, count).map((p) => p.id);
}

/**
 * Assign roles to all players using Fisher-Yates permutation.
 * Assigns Imposters, Doctor (if enabled), Jester (if enabled), and Citizens.
 * Supports having both Doctor and Jester active in the same game.
 * Returns Map<playerId, { role: string, isBoss: boolean }>
 *
 * @param {Map} players  - room.players map
 * @param {object} config - host config object
 */
function assignRoles(players, config) {
  const playerList = [...players.values()];
  const shuffled = shuffle(playerList);
  const assignments = new Map();
  let idx = 0;

  // Imposters cannot equal or exceed non-imposters (max is floor((total-1)/2), capped at 5)
  const maxImposters = Math.max(1, Math.min(5, Math.floor((playerList.length - 1) / 2)));
  const imposterCount = Math.min(Number(config.imposterCount) || 1, maxImposters);

  // 1. Assign Imposters
  for (let i = 0; i < imposterCount && idx < shuffled.length; i++) {
    assignments.set(shuffled[idx].id, {
      role: ROLES.IMPOSTER,
      isBoss: config.imposterMode === 'godfather' && i === 0,
    });
    idx++;
  }

  // 2. Assign Doctor if enabled (if slot available)
  if (config.hasDoctor && idx < shuffled.length) {
    assignments.set(shuffled[idx].id, { role: ROLES.DOCTOR, isBoss: false });
    idx++;
  }

  // 3. Assign Jester if enabled (if slot available, ensuring at least 1 citizen slot remains)
  if (config.hasJester && idx < shuffled.length - 1) {
    assignments.set(shuffled[idx].id, { role: ROLES.JESTER, isBoss: false });
    idx++;
  }

  // 4. All remaining players become Citizens
  for (let i = idx; i < shuffled.length; i++) {
    assignments.set(shuffled[i].id, { role: ROLES.CITIZEN, isBoss: false });
  }

  return assignments;
}

/**
 * Resolve all night actions and mutate player.isAlive directly.
 *
 * @param {object} room  - Full room state object
 * @returns {{ killed: string[], saved: string[] }}
 */
function resolveNight(room) {
  const { nightActions, players, config } = room;

  const killTargets = [];
  const healTargets = [];

  for (const [playerId, targetId] of nightActions.entries()) {
    const actor = players.get(playerId);
    if (!actor || !actor.isAlive) continue;

    if (actor.role === ROLES.IMPOSTER && targetId !== null) {
      if (config.imposterMode === 'godfather') {
        // Only the Boss's kill counts
        if (actor.isBoss) killTargets.push(targetId);
      } else {
        // Roulette: collect all submitted kills
        killTargets.push(targetId);
      }
    }

    if (actor.role === ROLES.DOCTOR && targetId !== null) {
      healTargets.push(targetId);
    }
  }

  // Roulette: randomly choose exactly one kill to execute
  let finalKills = [...killTargets];
  if (config.imposterMode === 'roulette' && finalKills.length > 1) {
    finalKills = [finalKills[Math.floor(Math.random() * finalKills.length)]];
  }

  // Doctor heal cancels an imposter kill on the same target
  const actualKills = finalKills.filter((id) => !healTargets.includes(id));
  const saved = finalKills.filter((id) => healTargets.includes(id));

  // Apply kills (mutate in place — server is authoritative)
  for (const victimId of actualKills) {
    const victim = players.get(victimId);
    if (victim && victim.isAlive) {
      victim.isAlive = false;
    }
  }

  return { killed: actualKills, saved };
}

/**
 * Resolve the day vote.
 * Mutates the executed player's isAlive to false.
 * Handles Godfather boss promotion.
 *
 * @param {object} room
 * @returns {{ executedId: string|null, jesterWin: boolean, tied: boolean }}
 */
function resolveVote(room) {
  const { votes, players } = room;

  if (votes.size === 0) {
    return { executedId: null, jesterWin: false, tied: false, reason: 'skipped' };
  }

  // Tally player votes and count skips
  const tally = {};
  let skipCount = 0;

  for (const [, targetId] of votes.entries()) {
    if (!targetId || targetId === 'skip' || targetId === 'null' || !players.has(targetId)) {
      skipCount++;
    } else {
      tally[targetId] = (tally[targetId] || 0) + 1;
    }
  }

  const voteCounts = Object.values(tally);
  const maxPlayerVotes = voteCounts.length > 0 ? Math.max(...voteCounts) : 0;

  // Fix 2: Skip is a valid candidate
  // If skipCount > maxPlayerVotes: Town chose to skip
  if (skipCount > maxPlayerVotes) {
    return { executedId: null, jesterWin: false, tied: false, reason: 'skipped' };
  }

  // If skipCount === maxPlayerVotes: Tie between player and skip
  if (skipCount === maxPlayerVotes) {
    return { executedId: null, jesterWin: false, tied: true, reason: 'tie' };
  }

  // If maxPlayerVotes > skipCount: Check if there is a tie between top players
  const topCandidates = Object.keys(tally).filter((id) => tally[id] === maxPlayerVotes);

  // Tie between multiple top players → no execution
  if (topCandidates.length > 1) {
    return { executedId: null, jesterWin: false, tied: true, reason: 'tie' };
  }

  const executedId = topCandidates[0];
  const executed = players.get(executedId);
  if (!executed || !executed.isAlive) {
    return { executedId: null, jesterWin: false, tied: false, reason: 'skipped' };
  }

  // Jester win condition — check BEFORE killing so we can report correctly
  if (executed.role === ROLES.JESTER) {
    executed.isAlive = false;
    return { executedId, jesterWin: true, tied: false, reason: null };
  }

  // Execute player
  executed.isAlive = false;

  // Godfather boss promotion: if the Boss was just eliminated, pick a new one
  if (executed.role === ROLES.IMPOSTER && executed.isBoss) {
    executed.isBoss = false;
    promoteNewBoss(room);
  }

  return { executedId, jesterWin: false, tied: false, reason: null };
}

/**
 * Promote a random living Accomplice to Boss.
 */
function promoteNewBoss(room) {
  const accomplices = [...room.players.values()].filter(
    (p) => p.isAlive && p.role === ROLES.IMPOSTER && !p.isBoss
  );
  if (accomplices.length > 0) {
    const newBoss = accomplices[Math.floor(Math.random() * accomplices.length)];
    newBoss.isBoss = true;
  }
}

/**
 * Check the overall win condition after any phase resolution.
 *
 * Imposters win when: living imposters >= living non-imposters
 * Citizens win when:  no imposters remain
 * Jester win is handled inside resolveVote — not checked here.
 *
 * @param {object} room
 * @returns {'citizens'|'imposters'|null}
 */
function checkWinCondition(room) {
  const living = [...room.players.values()].filter((p) => p.isAlive);
  const livingImposters = living.filter((p) => p.role === ROLES.IMPOSTER);
  const livingNonImposters = living.filter((p) => p.role !== ROLES.IMPOSTER);

  if (livingImposters.length === 0) return 'citizens';
  if (livingImposters.length >= livingNonImposters.length) return 'imposters';
  return null;
}

module.exports = {
  ROLES,
  PLAYER_THEMES,
  getThemeForIndex,
  generateDecoySequence,
  assignRoles,
  resolveNight,
  resolveVote,
  checkWinCondition,
};
