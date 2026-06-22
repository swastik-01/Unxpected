import type {
  AccessibilitySettings,
  CosmeticLoadout,
  DailyAnomaly,
  DeathEffectId,
  LeaderboardEntry,
  MenuMode,
  PortalEffectId,
  ProgressionResult,
  ProgressionUnlock,
  RunGrade,
  RunSummary,
  SkinId,
  TrailId
} from '../types';
import { maxCampaignLevel } from '../constants';

const metaKey = 'unxpected.meta.v1';
const maxLeaderboardEntries = 10;
export { maxCampaignLevel };

export interface CosmeticDefinition<TId extends string> {
  description: string;
  id: TId;
  label: string;
  swatch: string;
}

export interface MetaProgressionState {
  accessibility: AccessibilitySettings;
  campaign: {
    highestUnlockedLevel: number;
    selectedLevel: number;
  };
  daily: {
    bestScore: number;
    lastCompletedDateKey: string | null;
    streak: number;
  };
  leaderboard: LeaderboardEntry[];
  loadout: CosmeticLoadout;
  playerName: string;
  unlocked: {
    deathEffects: DeathEffectId[];
    portalEffects: PortalEffectId[];
    skins: SkinId[];
    trails: TrailId[];
  };
  xp: number;
}

export const defaultAccessibility: AccessibilitySettings = {
  audioEnabled: true,
  colorSafeWarnings: false,
  reducedMotion: false,
  uiScale: 'standard'
};

export const defaultLoadout: CosmeticLoadout = {
  skin: 'neon',
  trail: 'ion',
  deathEffect: 'glitch',
  portalEffect: 'clean'
};

export const cosmeticCatalog = {
  skins: [
    { id: 'neon', label: 'Neon Runner', description: 'Default cyan chassis.', swatch: '#45d7ff' },
    { id: 'signal', label: 'Signal Gold', description: 'Unlock: finish with A rank or better.', swatch: '#ffd166' },
    { id: 'void', label: 'Void Violet', description: 'Unlock: survive 4 mutations in one run.', swatch: '#d46cff' },
    { id: 'paradox', label: 'Paradox Red', description: 'Unlock: earn Paradox rank or score 9000+.', swatch: '#ff4f6d' }
  ] satisfies CosmeticDefinition<SkinId>[],
  trails: [
    { id: 'ion', label: 'Ion Trail', description: 'Default dash afterimage.', swatch: '#45d7ff' },
    { id: 'data', label: 'Data Rain', description: 'Unlock: complete 2 local missions.', swatch: '#58f0a7' },
    { id: 'warning', label: 'Warning Pulse', description: 'Unlock: finish under 3 deaths.', swatch: '#ffd166' },
    { id: 'paradox', label: 'Paradox Tear', description: 'Unlock: S rank or better.', swatch: '#d46cff' }
  ] satisfies CosmeticDefinition<TrailId>[],
  deathEffects: [
    { id: 'glitch', label: 'Glitch Break', description: 'Default death burst.', swatch: '#d46cff' },
    { id: 'fracture', label: 'Signal Fracture', description: 'Unlock: finish under 3 deaths.', swatch: '#ffd166' },
    { id: 'static', label: 'Static Bloom', description: 'Unlock: survive 4 mutations.', swatch: '#45d7ff' },
    { id: 'nova', label: 'Clean Nova', description: 'Unlock: complete all local missions.', swatch: '#58f0a7' }
  ] satisfies CosmeticDefinition<DeathEffectId>[],
  portalEffects: [
    { id: 'clean', label: 'Clean Gate', description: 'Default portal burst.', swatch: '#58f0a7' },
    { id: 'daily', label: 'Daily Gate', description: 'Unlock: complete a daily anomaly.', swatch: '#ffd166' },
    { id: 'singularity', label: 'Singularity', description: 'Unlock: score 8000+.', swatch: '#d46cff' },
    { id: 'paradox', label: 'Paradox Gate', description: 'Unlock: Paradox rank.', swatch: '#ff4f6d' }
  ] satisfies CosmeticDefinition<PortalEffectId>[]
};

export function createDefaultMetaState(): MetaProgressionState {
  return {
    accessibility: { ...defaultAccessibility },
    campaign: {
      highestUnlockedLevel: 1,
      selectedLevel: 1
    },
    daily: {
      bestScore: 0,
      lastCompletedDateKey: null,
      streak: 0
    },
    leaderboard: [],
    loadout: { ...defaultLoadout },
    playerName: 'Runner',
    unlocked: {
      deathEffects: ['glitch'],
      portalEffects: ['clean'],
      skins: ['neon'],
      trails: ['ion']
    },
    xp: 0
  };
}

export function readMetaProgression(): MetaProgressionState {
  try {
    const raw = window.localStorage.getItem(metaKey);
    if (!raw) return createDefaultMetaState();
    return sanitizeMetaState(JSON.parse(raw) as Partial<MetaProgressionState>);
  } catch {
    return createDefaultMetaState();
  }
}

export function writeMetaProgression(state: MetaProgressionState) {
  try {
    window.localStorage.setItem(metaKey, JSON.stringify(sanitizeMetaState(state)));
  } catch {
    // Local storage may be unavailable in constrained WebViews.
  }
}

export function updateLoadout(patch: Partial<CosmeticLoadout>) {
  const state = readMetaProgression();
  state.loadout = sanitizeLoadout({ ...state.loadout, ...patch }, state.unlocked);
  writeMetaProgression(state);
  return state;
}

export function updateAccessibility(patch: Partial<AccessibilitySettings>) {
  const state = readMetaProgression();
  state.accessibility = sanitizeAccessibility({ ...state.accessibility, ...patch });
  writeMetaProgression(state);
  return state;
}

export function updatePlayerName(name: string) {
  const state = readMetaProgression();
  state.playerName = sanitizePlayerName(name);
  writeMetaProgression(state);
  return state;
}

export function selectCampaignLevel(level: number) {
  const state = readMetaProgression();
  state.campaign.selectedLevel = clampLevel(level, state.campaign.highestUnlockedLevel);
  writeMetaProgression(state);
  return state;
}

export function completeRunProgression(summary: RunSummary, mode: MenuMode, dailyAnomaly: DailyAnomaly): ProgressionResult {
  const state = readMetaProgression();
  const missionsCompleted = summary.missions.filter((mission) => mission.achieved).length;
  const xpEarned = Math.max(60, Math.round(summary.score / 18) + missionsCompleted * 60 + (mode === 'daily' ? 140 : 0));
  const unlocks = grantUnlocks(state, summary, mode);
  const { entry, leaderboard } = addLeaderboardEntry(state.leaderboard, summary, mode, state.playerName);
  const campaignUnlockedLevel = updateCampaignProgression(state, summary, mode);

  state.xp += xpEarned;
  state.leaderboard = leaderboard;

  let dailyCompleted = false;
  if (mode === 'daily') {
    dailyCompleted = state.daily.lastCompletedDateKey !== dailyAnomaly.dateKey;
    if (dailyCompleted) {
      const yesterday = getAdjacentDateKey(-1);
      state.daily.streak = state.daily.lastCompletedDateKey === yesterday ? state.daily.streak + 1 : 1;
      state.daily.lastCompletedDateKey = dailyAnomaly.dateKey;
    }
    state.daily.bestScore = Math.max(state.daily.bestScore, summary.score);
  }

  state.loadout = sanitizeLoadout(state.loadout, state.unlocked);
  writeMetaProgression(state);

  const insertedRank = leaderboard.findIndex((item) => item.id === entry.id) + 1;
  return {
    campaignHighestUnlocked: state.campaign.highestUnlockedLevel,
    campaignUnlockedLevel,
    dailyCompleted,
    dailyStreak: state.daily.streak,
    leaderboardRank: insertedRank > 0 ? insertedRank : null,
    leaderboard,
    latestEntry: entry,
    unlocked: unlocks,
    xpEarned,
    totalXp: state.xp
  };
}

function addLeaderboardEntry(entries: LeaderboardEntry[], summary: RunSummary, mode: MenuMode, playerName: string) {
  const playedAt = new Date().toISOString();
  const entryId = `${playedAt}_${Math.round(summary.score)}_${Math.round(summary.durationMs)}`;
  const entry: LeaderboardEntry = {
    coins: summary.coins,
    dailyDateKey: summary.dailyAnomaly?.dateKey,
    deaths: summary.deaths,
    durationMs: summary.durationMs,
    durationText: summary.durationText,
    grade: summary.grade,
    id: entryId,
    levelIndex: summary.levelIndex,
    mode,
    mutationsSurvived: summary.mutationsSurvived,
    playerName: sanitizePlayerName(playerName),
    playedAt,
    score: summary.score,
    trustPercent: summary.trustPercent
  };

  const leaderboard = [...entries, entry]
    .sort((a, b) => b.score - a.score || a.durationMs - b.durationMs || a.deaths - b.deaths)
    .slice(0, maxLeaderboardEntries);
  return { entry, leaderboard };
}

function grantUnlocks(state: MetaProgressionState, summary: RunSummary, mode: MenuMode) {
  const unlocked: ProgressionUnlock[] = [];
  const missionsCompleted = summary.missions.filter((mission) => mission.achieved).length;

  unlockIf(state.unlocked.skins, 'signal', summary.score >= 6200 || ['A', 'S', 'Paradox'].includes(summary.grade), unlocked, 'Signal Gold', 'A-rank runner skin');
  unlockIf(state.unlocked.skins, 'void', summary.mutationsSurvived >= 4, unlocked, 'Void Violet', 'Mutation-survivor runner skin');
  unlockIf(state.unlocked.skins, 'paradox', summary.grade === 'Paradox' || summary.score >= 9000, unlocked, 'Paradox Red', 'Elite runner skin');

  unlockIf(state.unlocked.trails, 'data', missionsCompleted >= 2, unlocked, 'Data Rain', 'Dash trail');
  unlockIf(state.unlocked.trails, 'warning', summary.deaths < 3, unlocked, 'Warning Pulse', 'Dash trail');
  unlockIf(state.unlocked.trails, 'paradox', ['S', 'Paradox'].includes(summary.grade), unlocked, 'Paradox Tear', 'Dash trail');

  unlockIf(state.unlocked.deathEffects, 'fracture', summary.deaths < 3, unlocked, 'Signal Fracture', 'Death effect');
  unlockIf(state.unlocked.deathEffects, 'static', summary.mutationsSurvived >= 4, unlocked, 'Static Bloom', 'Death effect');
  unlockIf(state.unlocked.deathEffects, 'nova', missionsCompleted === summary.missions.length, unlocked, 'Clean Nova', 'Death effect');

  unlockIf(state.unlocked.portalEffects, 'daily', mode === 'daily', unlocked, 'Daily Gate', 'Portal effect');
  unlockIf(state.unlocked.portalEffects, 'singularity', summary.score >= 8000, unlocked, 'Singularity', 'Portal effect');
  unlockIf(state.unlocked.portalEffects, 'paradox', summary.grade === 'Paradox', unlocked, 'Paradox Gate', 'Portal effect');

  return unlocked;
}

function unlockIf<TId extends string>(
  bucket: TId[],
  id: TId,
  condition: boolean,
  unlocked: ProgressionUnlock[],
  label: string,
  description: string
) {
  if (!condition || bucket.includes(id)) return;
  bucket.push(id);
  unlocked.push({ label, description });
}

export function createDailyAnomaly(date = new Date()): DailyAnomaly {
  const dateKey = toDateKey(date);
  const seed = hashString(`unxpected:${dateKey}`);
  const modifiers: DailyAnomaly['modifier'][] = ['coin_betrayal', 'gravity_drift', 'pressure_plate', 'mirror_wall'];
  const modifier = modifiers[seed % modifiers.length];
  const labels: Record<DailyAnomaly['modifier'], string> = {
    coin_betrayal: 'Coin Betrayal',
    gravity_drift: 'Gravity Drift',
    pressure_plate: 'Pressure Plate',
    mirror_wall: 'Mirror Wall'
  };
  const subtitles: Record<DailyAnomaly['modifier'], string> = {
    coin_betrayal: 'Two pickups can turn hostile after short warning pulses.',
    gravity_drift: 'Speed-gated platforms trigger earlier and pull the route sideways.',
    pressure_plate: 'Safe zones arm faster and Balanced players can trip the lift.',
    mirror_wall: 'Jump reads create earlier defensive walls near the final route.'
  };

  return {
    dateKey,
    label: labels[modifier],
    modifier,
    seed,
    subtitle: subtitles[modifier]
  };
}

function sanitizeMetaState(raw: Partial<MetaProgressionState>): MetaProgressionState {
  const defaults = createDefaultMetaState();
  const highestUnlockedLevel = clampLevel(raw.campaign?.highestUnlockedLevel, maxCampaignLevel);
  const selectedLevel = clampLevel(raw.campaign?.selectedLevel, highestUnlockedLevel);
  const unlocked = {
    deathEffects: sanitizeIds(raw.unlocked?.deathEffects, cosmeticCatalog.deathEffects.map((item) => item.id), defaults.unlocked.deathEffects),
    portalEffects: sanitizeIds(raw.unlocked?.portalEffects, cosmeticCatalog.portalEffects.map((item) => item.id), defaults.unlocked.portalEffects),
    skins: sanitizeIds(raw.unlocked?.skins, cosmeticCatalog.skins.map((item) => item.id), defaults.unlocked.skins),
    trails: sanitizeIds(raw.unlocked?.trails, cosmeticCatalog.trails.map((item) => item.id), defaults.unlocked.trails)
  };

  return {
    accessibility: sanitizeAccessibility(raw.accessibility),
    campaign: {
      highestUnlockedLevel,
      selectedLevel
    },
    daily: {
      bestScore: numberOr(raw.daily?.bestScore, 0),
      lastCompletedDateKey: typeof raw.daily?.lastCompletedDateKey === 'string' ? raw.daily.lastCompletedDateKey : null,
      streak: numberOr(raw.daily?.streak, 0)
    },
    leaderboard: sanitizeLeaderboardEntries(raw.leaderboard),
    loadout: sanitizeLoadout(raw.loadout, unlocked),
    playerName: sanitizePlayerName(raw.playerName),
    unlocked,
    xp: numberOr(raw.xp, 0)
  };
}

function sanitizeAccessibility(settings?: Partial<AccessibilitySettings>): AccessibilitySettings {
  return {
    audioEnabled: typeof settings?.audioEnabled === 'boolean' ? settings.audioEnabled : defaultAccessibility.audioEnabled,
    colorSafeWarnings: typeof settings?.colorSafeWarnings === 'boolean' ? settings.colorSafeWarnings : defaultAccessibility.colorSafeWarnings,
    reducedMotion: typeof settings?.reducedMotion === 'boolean' ? settings.reducedMotion : defaultAccessibility.reducedMotion,
    uiScale: settings?.uiScale === 'compact' || settings?.uiScale === 'large' ? settings.uiScale : defaultAccessibility.uiScale
  };
}

function sanitizeLoadout(loadout: Partial<CosmeticLoadout> | undefined, unlocked: MetaProgressionState['unlocked']): CosmeticLoadout {
  return {
    skin: unlocked.skins.includes(loadout?.skin as SkinId) ? loadout?.skin as SkinId : defaultLoadout.skin,
    trail: unlocked.trails.includes(loadout?.trail as TrailId) ? loadout?.trail as TrailId : defaultLoadout.trail,
    deathEffect: unlocked.deathEffects.includes(loadout?.deathEffect as DeathEffectId) ? loadout?.deathEffect as DeathEffectId : defaultLoadout.deathEffect,
    portalEffect: unlocked.portalEffects.includes(loadout?.portalEffect as PortalEffectId) ? loadout?.portalEffect as PortalEffectId : defaultLoadout.portalEffect
  };
}

function sanitizePlayerName(value: unknown) {
  const cleaned = typeof value === 'string'
    ? value.replace(/[^\p{L}\p{N} _.-]/gu, '').replace(/\s+/g, ' ').trim()
    : '';
  return cleaned.slice(0, 18) || 'Runner';
}

function sanitizeLeaderboardEntries(entries: unknown): LeaderboardEntry[] {
  if (!Array.isArray(entries)) return [];
  return entries
    .slice(0, maxLeaderboardEntries)
    .map((entry) => entry as Partial<LeaderboardEntry>)
    .filter((entry) => typeof entry.id === 'string')
    .map((entry) => ({
      coins: numberOr(entry.coins, 0),
      dailyDateKey: typeof entry.dailyDateKey === 'string' ? entry.dailyDateKey : undefined,
      deaths: numberOr(entry.deaths, 0),
      durationMs: numberOr(entry.durationMs, 0),
      durationText: typeof entry.durationText === 'string' ? entry.durationText : '0:00.00',
      grade: sanitizeRunGrade(entry.grade),
      id: entry.id as string,
      levelIndex: clampLevel(entry.levelIndex, maxCampaignLevel),
      mode: sanitizeMenuMode(entry.mode),
      mutationsSurvived: numberOr(entry.mutationsSurvived, 0),
      playerName: sanitizePlayerName(entry.playerName),
      playedAt: typeof entry.playedAt === 'string' ? entry.playedAt : new Date().toISOString(),
      score: numberOr(entry.score, 0),
      trustPercent: numberOr(entry.trustPercent, 0)
    }))
    .sort((a, b) => b.score - a.score || a.durationMs - b.durationMs || a.deaths - b.deaths);
}

function sanitizeRunGrade(value: unknown): RunGrade {
  return value === 'B' || value === 'A' || value === 'S' || value === 'Paradox' ? value : 'C';
}

function sanitizeMenuMode(value: unknown): MenuMode {
  return value === 'daily' || value === 'training' ? value : 'standard';
}

function updateCampaignProgression(state: MetaProgressionState, summary: RunSummary, mode: MenuMode) {
  if (mode !== 'standard') return null;

  const clearedLevel = clampLevel(summary.levelIndex, maxCampaignLevel);
  state.campaign.highestUnlockedLevel = clampLevel(state.campaign.highestUnlockedLevel, maxCampaignLevel);
  state.campaign.selectedLevel = clampLevel(state.campaign.selectedLevel, state.campaign.highestUnlockedLevel);

  if (clearedLevel === state.campaign.highestUnlockedLevel && state.campaign.highestUnlockedLevel < maxCampaignLevel) {
    const nextLevel = Math.min(maxCampaignLevel, clearedLevel + 1);
    state.campaign.highestUnlockedLevel = Math.max(state.campaign.highestUnlockedLevel, nextLevel);
    state.campaign.selectedLevel = nextLevel;
    return nextLevel;
  }

  return null;
}

function clampLevel(value: unknown, ceiling: number) {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 1;
  return Math.max(1, Math.min(Math.max(1, ceiling), numeric));
}

function sanitizeIds<TId extends string>(ids: TId[] | undefined, valid: TId[], fallback: TId[]) {
  const set = new Set<TId>(fallback);
  for (const id of ids ?? []) {
    if (valid.includes(id)) set.add(id);
  }
  return [...set];
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getAdjacentDateKey(dayOffset: number) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  return toDateKey(date);
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
