import { maxCampaignLevel } from '../constants';
import type { DailyAnomaly, MenuMode, RunGrade, RunMissionResult, RunSummary } from '../types';

export interface RunSummaryInput {
  dailyAnomaly?: DailyAnomaly;
  durationMs: number;
  deaths: number;
  levelIndex?: number;
  coins: number;
  totalCoins: number;
  mutationsSurvived: number;
  trust: number;
  previousBestScore: number | null;
  adaptationLog: string[];
  mode: MenuMode;
}

export function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((Math.max(0, durationMs) % 1000) / 10);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

export function gradeForScore(score: number, deaths: number, trustPercent: number): RunGrade {
  if (score >= 9000 && deaths <= 1 && trustPercent >= 75) return 'Paradox';
  if (score >= 7600) return 'S';
  if (score >= 6200) return 'A';
  if (score >= 4600) return 'B';
  return 'C';
}

export function createRunSummary(input: RunSummaryInput): RunSummary {
  const levelIndex = clampLevel(input.levelIndex ?? 1);
  const seconds = Math.max(0, input.durationMs / 1000);
  const trustPercent = Math.max(0, Math.min(100, Math.round(input.trust * 100)));
  const coinRatio = input.totalCoins > 0 ? input.coins / input.totalCoins : 1;
  const levelBonus = input.mode === 'standard' ? Math.min(1800, (levelIndex - 1) * 4) : 0;
  const score = Math.max(0, Math.round(
    5200 +
      levelBonus +
      input.coins * 520 +
      coinRatio * 900 +
      input.mutationsSurvived * 620 +
      trustPercent * 18 -
      input.deaths * 850 -
      seconds * 17
  ));
  const bestScore = Math.max(input.previousBestScore ?? 0, score);
  const grade = gradeForScore(score, input.deaths, trustPercent);
  const missions = createMissionResults(input, trustPercent);

  return {
    dailyAnomaly: input.dailyAnomaly,
    durationMs: input.durationMs,
    durationText: formatDuration(input.durationMs),
    deaths: input.deaths,
    levelIndex,
    coins: input.coins,
    totalCoins: input.totalCoins,
    mutationsSurvived: input.mutationsSurvived,
    trustPercent,
    score,
    grade,
    bestScore,
    personalBest: input.previousBestScore === null || score > input.previousBestScore,
    mode: input.mode,
    missions,
    recap: createRecap(input, trustPercent, missions)
  };
}

function createMissionResults(input: RunSummaryInput, trustPercent: number): RunMissionResult[] {
  return [
    {
      id: 'clean_route',
      label: 'Clean Route',
      description: 'Finish with under 3 deaths.',
      progress: `${input.deaths}/2 deaths`,
      achieved: input.deaths < 3
    },
    {
      id: 'full_sweep',
      label: 'Full Sweep',
      description: 'Collect every visible coin.',
      progress: `${input.coins}/${input.totalCoins} coins`,
      achieved: input.totalCoins > 0 && input.coins >= input.totalCoins
    },
    {
      id: 'mutation_reader',
      label: 'Anomaly Reader',
      description: 'Survive at least 4 mutations.',
      progress: `${input.mutationsSurvived}/4 mutations`,
      achieved: input.mutationsSurvived >= 4
    },
    {
      id: 'trust_retained',
      label: 'Trust Retained',
      description: 'Finish with at least 70% trust.',
      progress: `${trustPercent}/70% trust`,
      achieved: trustPercent >= 70
    }
  ];
}

function createRecap(input: RunSummaryInput, trustPercent: number, missions: RunMissionResult[]) {
  const levelIndex = clampLevel(input.levelIndex ?? 1);
  const recap = [
    `Level ${levelIndex} adapted ${input.mutationsSurvived} time${input.mutationsSurvived === 1 ? '' : 's'} during the route.`,
    input.adaptationLog[0] ? `Most recent adaptation: ${input.adaptationLog[0]}.` : 'No late-run adaptation was recorded.',
    `Trust ended at ${trustPercent}%, with ${input.deaths} death${input.deaths === 1 ? '' : 's'} and ${input.coins}/${input.totalCoins} coins collected.`
  ];

  const completed = missions.filter((mission) => mission.achieved).length;
  recap.push(`${completed}/${missions.length} local missions completed this run.`);
  return recap;
}

function clampLevel(level: number) {
  return Math.max(1, Math.min(maxCampaignLevel, Math.round(level)));
}
