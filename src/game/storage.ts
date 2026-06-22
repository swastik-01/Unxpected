const bestDeathsKey = 'unxpected.bestDeaths';
const bestScoreKey = 'unxpected.bestScore';

export function readBestDeaths(): number | null {
  return readNumber(bestDeathsKey);
}

export function writeBestDeaths(deaths: number) {
  const current = readBestDeaths();
  if (current === null || deaths < current) {
    writeNumber(bestDeathsKey, deaths);
  }
}

export function readBestScore(): number | null {
  return readNumber(bestScoreKey);
}

export function writeBestScore(score: number) {
  const current = readBestScore();
  if (current === null || score > current) {
    writeNumber(bestScoreKey, score);
  }
}

function readNumber(key: string): number | null {
  try {
    const value = window.localStorage.getItem(key);
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeNumber(key: string, value: number) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Local storage can be unavailable in privacy-restricted webviews.
  }
}
