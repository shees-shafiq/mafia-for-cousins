// ─── Shared TypeScript types for the Mafia game ───────────────────────────────

export type GamePhase =
  | 'lobby'
  | 'role_reveal'
  | 'night'
  | 'day_announce'
  | 'day_vote'
  | 'game_over';

export type Role = 'citizen' | 'imposter' | 'doctor' | 'jester';

export type ImposterMode = 'godfather' | 'roulette';
export type RevealMode = 'classic' | 'secret';
export type AnnounceType = 'night' | 'vote' | null;

export interface GameConfig {
  imposterCount: number;       // 1–5
  imposterMode: ImposterMode;
  hasDoctor: boolean;
  hasJester: boolean;
  revealMode: RevealMode;
}

// ─── Player Representations ───────────────────────────────────────────────────

/** Public player info broadcast to all clients — never includes role */
export interface PublicPlayer {
  id: string;
  name: string;
  color: string;      // hex color string
  animal: string;     // emoji
  themeName: string;  // e.g. "Cobalt Wolf"
  isAlive: boolean;
  connected?: boolean;
  isHost: boolean;
  hasSubmittedAction: boolean;
  hasCompletedDecoys: boolean;
  hasVoted?: boolean;
}

/** Full player info revealed at game-over only */
export interface RevealedPlayer extends PublicPlayer {
  role: Role;
  isBoss: boolean;
}

// ─── Room State (public snapshot, safe to broadcast) ─────────────────────────

export interface RoomState {
  code: string;
  hostId: string;
  config: GameConfig;
  players: PublicPlayer[];
  phase: GamePhase;
  round: number;
  winner: string | null;
  announceType: AnnounceType;
  lastResolution: NightResolution | VoteResolution | null;
  voteCounts: Record<string, number>;   // playerId → vote count
  skipCount?: number;
  totalVotesCast?: number;
  endGameVoteCount: number;
}

// ─── Private Role Info (sent only to the specific player's socket) ────────────

export interface MyRoleInfo {
  role: Role;
  isBoss: boolean;
  /** Imposter teammates (only populated for imposters) */
  teammates: Array<{ id: string; name: string; isBoss: boolean }>;
}

// ─── Night / Vote Resolution ──────────────────────────────────────────────────

export interface KilledPlayer {
  id: string;
  name: string;
  role: Role | null;  // null if revealMode === 'secret'
}

export interface SavedPlayer {
  id: string;
  name: string;
}

export interface NightResolution {
  type: 'night';
  killed: KilledPlayer[];
  saved: SavedPlayer[];   // empty if revealMode === 'secret'
  peaceful: boolean;      // true if no one died
}

export interface VoteResolution {
  type: 'vote';
  executedPlayer: {
    id: string;
    name: string;
    role: Role | null;
  } | null;
  tied: boolean;
  reason?: 'tie' | 'skipped' | string | null;
}

// ─── Game Over ────────────────────────────────────────────────────────────────

export type WinnerType = 'citizens' | 'imposters' | 'jester';

export interface GameOverInfo {
  winner: WinnerType;
  reason: string;
  jesterName: string | null;
  players: RevealedPlayer[];
}

// ─── Socket event payloads ────────────────────────────────────────────────────

export interface ActionPhaseStartPayload {
  decoyTargetIds: string[];
  phase: 'night';
}
