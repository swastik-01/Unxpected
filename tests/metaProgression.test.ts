import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  completeRunProgression,
  createDailyAnomaly,
  maxCampaignLevel,
  readMetaProgression,
  selectCampaignLevel,
  updateLoadout
} from '../src/game/progression/metaProgression';
import type { RunSummary } from '../src/game/types';

function installLocalStorage() {
  const values = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => {
        values.set(key, value);
      }
    }
  });
}

function summary(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    durationMs: 84000,
    durationText: '1:24.00',
    deaths: 0,
    levelIndex: 1,
    coins: 5,
    totalCoins: 5,
    mutationsSurvived: 4,
    trustPercent: 82,
    score: 9100,
    grade: 'Paradox',
    bestScore: 9100,
    personalBest: true,
    mode: 'daily',
    missions: [
      { id: 'clean_route', label: 'Clean Route', description: 'Finish with under 3 deaths.', progress: '0/2 deaths', achieved: true },
      { id: 'full_sweep', label: 'Full Sweep', description: 'Collect every visible coin.', progress: '5/5 coins', achieved: true },
      { id: 'mutation_reader', label: 'Anomaly Reader', description: 'Survive at least 4 mutations.', progress: '4/4 mutations', achieved: true },
      { id: 'trust_retained', label: 'Trust Retained', description: 'Finish with at least 70% trust.', progress: '82/70% trust', achieved: true }
    ],
    recap: [],
    ...overrides
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('meta progression', () => {
  it('creates a stable daily anomaly for a date', () => {
    const first = createDailyAnomaly(new Date(2026, 5, 21));
    const second = createDailyAnomaly(new Date(2026, 5, 21));
    const next = createDailyAnomaly(new Date(2026, 5, 22));

    expect(first).toEqual(second);
    expect(first.dateKey).toBe('2026-06-21');
    expect(next.dateKey).toBe('2026-06-22');
    expect(next.seed).not.toBe(first.seed);
  });

  it('unlocks cosmetics, records daily streak, and stores leaderboard entries', () => {
    installLocalStorage();
    const daily = createDailyAnomaly(new Date(2026, 5, 21));
    const result = completeRunProgression({ ...summary(), dailyAnomaly: daily }, 'daily', daily);
    const state = readMetaProgression();

    expect(result.dailyCompleted).toBe(true);
    expect(result.dailyStreak).toBe(1);
    expect(result.leaderboardRank).toBe(1);
    expect(result.unlocked.map((unlock) => unlock.label)).toContain('Paradox Red');
    expect(state.unlocked.portalEffects).toContain('daily');
    expect(state.leaderboard).toHaveLength(1);
    expect(result.latestEntry.playerName).toBe('Runner');
  });

  it('unlocks campaign levels one at a time after standard clears only', () => {
    installLocalStorage();
    const daily = createDailyAnomaly(new Date(2026, 5, 21));
    expect(maxCampaignLevel).toBe(99);

    const first = completeRunProgression({ ...summary({ mode: 'standard' }), dailyAnomaly: undefined }, 'standard', daily);
    expect(first.campaignUnlockedLevel).toBe(2);
    expect(readMetaProgression().campaign.highestUnlockedLevel).toBe(2);

    const clamped = selectCampaignLevel(maxCampaignLevel);
    expect(clamped.campaign.selectedLevel).toBe(2);

    completeRunProgression({ ...summary({ mode: 'daily', levelIndex: 2 }), dailyAnomaly: daily }, 'daily', daily);
    expect(readMetaProgression().campaign.highestUnlockedLevel).toBe(2);

    const second = completeRunProgression({ ...summary({ mode: 'standard', levelIndex: 2 }), dailyAnomaly: undefined }, 'standard', daily);
    expect(second.campaignUnlockedLevel).toBe(3);
    expect(readMetaProgression().campaign.selectedLevel).toBe(3);
  });

  it('prevents selecting locked cosmetics', () => {
    installLocalStorage();
    const state = updateLoadout({ skin: 'paradox' });

    expect(state.loadout.skin).toBe('neon');
  });
});
