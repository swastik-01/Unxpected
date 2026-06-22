import type { LeaderboardEntry } from '../types';

export interface GlobalLeaderboardState {
  configured: boolean;
  entries: LeaderboardEntry[];
  status: string;
}

const tableName = import.meta.env.VITE_SUPABASE_LEADERBOARD_TABLE || 'leaderboard_runs';

export function isGlobalLeaderboardConfigured() {
  return Boolean(getSupabaseConfig());
}

export async function submitGlobalScore(entry: LeaderboardEntry): Promise<GlobalLeaderboardState> {
  const config = getSupabaseConfig();
  if (!config) return notConfigured();

  try {
    const response = await fetch(`${config.url}/rest/v1/${tableName}`, {
      method: 'POST',
      headers: headers(config.key, { Prefer: 'return=minimal' }),
      body: JSON.stringify(toSupabaseRow(entry))
    });

    if (!response.ok) throw new Error(`Supabase submit failed: ${response.status}`);
    return { configured: true, entries: [], status: 'Global score submitted' };
  } catch {
    return { configured: true, entries: [], status: 'Global submit failed; saved locally' };
  }
}

export async function fetchGlobalLeaderboard(limit = 10): Promise<GlobalLeaderboardState> {
  const config = getSupabaseConfig();
  if (!config) return notConfigured();

  const query = new URLSearchParams({
    select: '*',
    order: 'level_index.desc,score.desc,duration_ms.asc,deaths.asc',
    limit: String(limit)
  });

  try {
    const response = await fetch(`${config.url}/rest/v1/${tableName}?${query.toString()}`, {
      headers: headers(config.key)
    });

    if (!response.ok) throw new Error(`Supabase fetch failed: ${response.status}`);
    const rows = await response.json() as SupabaseLeaderboardRow[];
    return {
      configured: true,
      entries: rows.map(fromSupabaseRow),
      status: rows.length ? `${rows.length} global runs` : 'Global leaderboard is empty'
    };
  } catch {
    return { configured: true, entries: [], status: 'Global leaderboard unavailable' };
  }
}

function getSupabaseConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url: String(url).replace(/\/$/, ''), key: String(key) };
}

function headers(key: string, extra: Record<string, string> = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

function notConfigured(): GlobalLeaderboardState {
  return {
    configured: false,
    entries: [],
    status: 'Global leaderboard offline; add Supabase env vars'
  };
}

interface SupabaseLeaderboardRow {
  coins: number;
  daily_date_key?: string | null;
  deaths: number;
  duration_ms: number;
  duration_text: string;
  grade: LeaderboardEntry['grade'];
  id: string;
  level_index: number;
  mode: LeaderboardEntry['mode'];
  mutations_survived: number;
  player_name: string;
  played_at: string;
  score: number;
  trust_percent: number;
}

function toSupabaseRow(entry: LeaderboardEntry): SupabaseLeaderboardRow {
  return {
    coins: entry.coins,
    daily_date_key: entry.dailyDateKey ?? null,
    deaths: entry.deaths,
    duration_ms: entry.durationMs,
    duration_text: entry.durationText,
    grade: entry.grade,
    id: entry.id,
    level_index: entry.levelIndex,
    mode: entry.mode,
    mutations_survived: entry.mutationsSurvived,
    player_name: entry.playerName,
    played_at: entry.playedAt,
    score: entry.score,
    trust_percent: entry.trustPercent
  };
}

function fromSupabaseRow(row: SupabaseLeaderboardRow): LeaderboardEntry {
  return {
    coins: row.coins,
    dailyDateKey: row.daily_date_key ?? undefined,
    deaths: row.deaths,
    durationMs: row.duration_ms,
    durationText: row.duration_text,
    grade: row.grade,
    id: row.id,
    levelIndex: row.level_index,
    mode: row.mode,
    mutationsSurvived: row.mutations_survived,
    playerName: row.player_name,
    playedAt: row.played_at,
    score: row.score,
    trustPercent: row.trust_percent
  };
}
