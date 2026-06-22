import { describe, expect, it } from 'vitest';
import { createRunSummary, formatDuration, gradeForScore } from '../src/game/scoring/runSummary';

describe('run summary scoring', () => {
  it('formats run duration with centisecond precision', () => {
    expect(formatDuration(65090)).toBe('1:05.09');
  });

  it('awards Paradox rank and completes local missions for a clean full route', () => {
    const summary = createRunSummary({
      durationMs: 90000,
      deaths: 0,
      coins: 8,
      totalCoins: 8,
      mutationsSurvived: 4,
      trust: 1,
      previousBestScore: null,
      adaptationLog: ['Bridge spawned after cautious movement'],
      mode: 'standard'
    });

    expect(summary.grade).toBe('Paradox');
    expect(summary.personalBest).toBe(true);
    expect(summary.bestScore).toBe(summary.score);
    expect(summary.missions.every((mission) => mission.achieved)).toBe(true);
    expect(summary.recap[1]).toContain('Bridge spawned');
  });

  it('keeps rough runs in C rank and preserves the previous best score', () => {
    const summary = createRunSummary({
      durationMs: 180000,
      deaths: 8,
      coins: 1,
      totalCoins: 8,
      mutationsSurvived: 0,
      trust: 0.3,
      previousBestScore: 8400,
      adaptationLog: [],
      mode: 'standard'
    });

    expect(summary.grade).toBe('C');
    expect(summary.personalBest).toBe(false);
    expect(summary.bestScore).toBe(8400);
    expect(summary.missions.filter((mission) => mission.achieved)).toHaveLength(0);
  });

  it('gates Paradox rank behind deaths and retained trust', () => {
    expect(gradeForScore(9400, 2, 90)).toBe('S');
    expect(gradeForScore(9400, 0, 60)).toBe('S');
    expect(gradeForScore(9400, 1, 75)).toBe('Paradox');
  });
});
