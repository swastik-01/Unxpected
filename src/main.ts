import Phaser from 'phaser';
import './style.css';
import { GameScene, type GameSceneConfig } from './phaser/scenes/GameScene';
import { InputController } from './game/input/InputController';
import {
  completeRunProgression,
  cosmeticCatalog,
  createDailyAnomaly,
  maxCampaignLevel,
  readMetaProgression,
  selectCampaignLevel,
  updateAccessibility,
  updateLoadout,
  updatePlayerName,
  type CosmeticDefinition
} from './game/progression/metaProgression';
import { fetchGlobalLeaderboard, submitGlobalScore } from './game/leaderboard/globalLeaderboard';
import type {
  AccessibilitySettings,
  CosmeticLoadout,
  DeathEffectId,
  HudSnapshot,
  LeaderboardEntry,
  MenuMode,
  PortalEffectId,
  ProgressionResult,
  RunSummary,
  SkinId,
  TrailId,
  TutorialSnapshot
} from './game/types';

const input = new InputController(document);
const hasTouchInput = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
document.body.classList.toggle('has-touch', hasTouchInput);

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Unxpected UI failed to boot: ${selector} missing.`);
  return element;
}

const menu = requiredElement<HTMLElement>('#menu');
const menuPanel = requiredElement<HTMLElement>('.menu__panel');
const hud = requiredElement<HTMLElement>('#hud');
const pauseMenu = requiredElement<HTMLElement>('#pause-menu');
const startButton = requiredElement<HTMLButtonElement>('#start-button');
const dailyButton = requiredElement<HTMLButtonElement>('#daily-button');
const pauseButton = requiredElement<HTMLButtonElement>('#pause-button');
const pauseTitle = requiredElement<HTMLElement>('#pause-title');
const resumeButton = requiredElement<HTMLButtonElement>('#resume-button');
const restartButton = requiredElement<HTMLButtonElement>('#restart-button');
const quitButton = requiredElement<HTMLButtonElement>('#quit-button');
const aggression = requiredElement<HTMLInputElement>('#aggression');
const aggressionOutput = requiredElement<HTMLOutputElement>('#aggression-output');
const profile = requiredElement<HTMLElement>('#hud-profile');
const modeLabel = requiredElement<HTMLElement>('#hud-mode');
const deaths = requiredElement<HTMLElement>('#hud-deaths');
const trust = requiredElement<HTMLElement>('#hud-trust');
const hudTime = requiredElement<HTMLElement>('#hud-time');
const hudCoins = requiredElement<HTMLElement>('#hud-coins');
const hudScore = requiredElement<HTMLElement>('#hud-score');
const dashMeter = requiredElement<HTMLElement>('.dash-meter');
const dashMeterFill = requiredElement<HTMLElement>('#dash-meter-fill');
const notice = requiredElement<HTMLElement>('#hud-notice');
const feed = requiredElement<HTMLElement>('#mutation-feed');
const mobileControls = requiredElement<HTMLElement>('#mobile-controls');
const dashButton = requiredElement<HTMLButtonElement>('[data-action="dash"]');
const tutorial = requiredElement<HTMLElement>('#tutorial-card');
const tutorialStep = requiredElement<HTMLElement>('#tutorial-step');
const tutorialProgress = requiredElement<HTMLElement>('#tutorial-progress');
const tutorialTitle = requiredElement<HTMLElement>('#tutorial-title');
const tutorialBody = requiredElement<HTMLElement>('#tutorial-body');
const tutorialObjective = requiredElement<HTMLElement>('#tutorial-objective');
const tutorialSkipButton = requiredElement<HTMLButtonElement>('#tutorial-skip-button');
const dailyTitle = requiredElement<HTMLElement>('#daily-title');
const dailyStreak = requiredElement<HTMLElement>('#daily-streak');
const dailyCopy = requiredElement<HTMLElement>('#daily-copy');
const campaignProgress = requiredElement<HTMLElement>('#campaign-progress');
const campaignCopy = requiredElement<HTMLElement>('#campaign-copy');
const levelSelect = requiredElement<HTMLSelectElement>('#level-select');
const levelPrevButton = requiredElement<HTMLButtonElement>('#level-prev-button');
const levelNextButton = requiredElement<HTMLButtonElement>('#level-next-button');
const progressionXp = requiredElement<HTMLElement>('#progression-xp');
const playerName = requiredElement<HTMLInputElement>('#player-name');
const playerStatus = requiredElement<HTMLElement>('#player-status');
const settingsStatus = requiredElement<HTMLElement>('#settings-status');
const leaderboardStatus = requiredElement<HTMLElement>('#leaderboard-status');
const localLeaderboard = requiredElement<HTMLOListElement>('#local-leaderboard');
const globalLeaderboardStatus = requiredElement<HTMLElement>('#global-leaderboard-status');
const globalLeaderboard = requiredElement<HTMLOListElement>('#global-leaderboard');
const skinSelect = requiredElement<HTMLSelectElement>('#skin-select');
const trailSelect = requiredElement<HTMLSelectElement>('#trail-select');
const deathEffectSelect = requiredElement<HTMLSelectElement>('#death-effect-select');
const portalEffectSelect = requiredElement<HTMLSelectElement>('#portal-effect-select');
const audioToggle = requiredElement<HTMLInputElement>('#audio-toggle');
const motionToggle = requiredElement<HTMLInputElement>('#motion-toggle');
const colorSafeToggle = requiredElement<HTMLInputElement>('#color-safe-toggle');
const uiScaleSelect = requiredElement<HTMLSelectElement>('#ui-scale-select');
const runSummary = requiredElement<HTMLElement>('#run-summary');
const summaryBest = requiredElement<HTMLElement>('#summary-best');
const summaryCoins = requiredElement<HTMLElement>('#summary-coins');
const summaryDeaths = requiredElement<HTMLElement>('#summary-deaths');
const summaryGrade = requiredElement<HTMLElement>('#summary-grade');
const summaryMissions = requiredElement<HTMLElement>('#summary-missions');
const summaryMutations = requiredElement<HTMLElement>('#summary-mutations');
const summaryPersonalBest = requiredElement<HTMLElement>('#summary-personal-best');
const summaryProgression = requiredElement<HTMLElement>('#summary-progression');
const summaryRecap = requiredElement<HTMLElement>('#summary-recap');
const summaryLeaderboard = requiredElement<HTMLOListElement>('#summary-leaderboard');
const summaryGlobalStatus = requiredElement<HTMLElement>('#summary-global-status');
const summaryScore = requiredElement<HTMLElement>('#summary-score');
const summaryTime = requiredElement<HTMLElement>('#summary-time');
const summaryTrust = requiredElement<HTMLElement>('#summary-trust');
const spoof = requiredElement<HTMLElement>('#system-spoof');
const spoofText = requiredElement<HTMLElement>('#spoof-text');

let game: Phaser.Game | null = null;
let activeScene: GameScene | null = null;
let lastMode: MenuMode = 'standard';
let lastLevelIndex = 1;
let showingRunSummary = false;
let currentDaily = createDailyAnomaly();

const getAggression = () => Number(aggression.value) / 100;
const formatScore = new Intl.NumberFormat('en-US');

document.body.classList.add('is-menu');
renderMenuProgression();
void renderGlobalLeaderboard();

function createGameConfig(mode: MenuMode, levelOverride?: number): Phaser.Types.Core.GameConfig {
  const meta = readMetaProgression();
  const levelIndex = mode === 'standard' ? levelOverride ?? meta.campaign.selectedLevel : 1;
  lastLevelIndex = levelIndex;
  const sceneConfig: GameSceneConfig = {
    accessibility: meta.accessibility,
    cosmetics: meta.loadout,
    dailyAnomaly: mode === 'daily' ? currentDaily : undefined,
    input,
    aggression: mode === 'daily' ? Math.max(getAggression(), 0.72) : getAggression(),
    levelIndex,
    mode
  };

  return {
    type: Phaser.AUTO,
    parent: 'game-container',
    backgroundColor: '#070914',
    width: 1280,
    height: 720,
    pixelArt: false,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 980 },
        debug: false
      }
    },
    scene: [new GameScene(sceneConfig)]
  };
}

function startGame(mode: MenuMode, levelOverride?: number) {
  lastMode = mode;
  resetPauseOverlay();
  document.body.classList.remove('is-menu');
  document.body.classList.add('is-playing');
  menu.classList.add('menu--hidden');
  pauseMenu.classList.add('pause-menu--hidden');
  hud.classList.remove('hud--hidden');
  mobileControls.classList.remove('mobile-controls--hidden');
  if (game) {
    game.destroy(true);
  }
  game = new Phaser.Game(createGameConfig(mode, levelOverride));
  game.events.once(Phaser.Core.Events.READY, () => {
    activeScene = game?.scene.getScene('GameScene') as GameScene | null;
  });
}

function pauseGame() {
  if (!activeScene || showingRunSummary) return;
  resetPauseOverlay();
  input.releaseAll();
  activeScene?.setPaused(true);
  mobileControls.classList.add('mobile-controls--hidden');
  tutorial.classList.add('tutorial-card--hidden');
  pauseMenu.classList.remove('pause-menu--hidden');
}

function resumeGame() {
  if (showingRunSummary) return;
  pauseMenu.classList.add('pause-menu--hidden');
  mobileControls.classList.remove('mobile-controls--hidden');
  activeScene?.setPaused(false);
}

function quitToMenu() {
  game?.destroy(true);
  game = null;
  activeScene = null;
  document.body.classList.remove('is-playing');
  document.body.classList.add('is-menu');
  hud.classList.add('hud--hidden');
  mobileControls.classList.add('mobile-controls--hidden');
  tutorial.classList.add('tutorial-card--hidden');
  pauseMenu.classList.add('pause-menu--hidden');
  resetPauseOverlay();
  menu.classList.remove('menu--hidden');
  menuPanel.scrollTop = 0;
}

function resetPauseOverlay() {
  showingRunSummary = false;
  pauseTitle.textContent = 'Paused';
  resumeButton.hidden = false;
  runSummary.classList.add('run-summary--hidden');
  summaryMissions.replaceChildren();
  summaryRecap.replaceChildren();
  summaryProgression.replaceChildren();
  summaryLeaderboard.replaceChildren();
  summaryGlobalStatus.textContent = 'Global leaderboard offline';
}

function renderHud(snapshot: HudSnapshot) {
  modeLabel.textContent = snapshot.modeLabel;
  profile.textContent = snapshot.notice.toLowerCase().includes('warning')
    ? 'Changing'
    : snapshot.trust < 0.58
      ? 'Hunting'
      : 'Watching';
  deaths.textContent = String(snapshot.deaths);
  trust.textContent = `${Math.max(0, Math.round(snapshot.trust * 100))}%`;
  hudTime.textContent = snapshot.durationText;
  hudCoins.textContent = `${snapshot.coins}/${snapshot.totalCoins}`;
  hudScore.textContent = formatScore.format(snapshot.score);
  const dashReadyPercent = Math.max(0, Math.min(1, snapshot.dashReadyPercent));
  const dashReady = dashReadyPercent >= 0.995;
  dashMeterFill.style.transform = `scaleX(${dashReadyPercent})`;
  dashMeter.classList.toggle('dash-meter--ready', dashReady);
  dashMeter.classList.toggle('dash-meter--charging', !dashReady);
  dashButton.classList.toggle('mobile-controls__action--ready', dashReady);
  dashButton.setAttribute('aria-label', dashReady ? 'Dash ready' : 'Dash recharging');
  notice.textContent = snapshot.notice;
  feed.replaceChildren();
  feed.classList.add('mutation-feed--hidden');
}

function renderTutorial(snapshot: TutorialSnapshot) {
  if (!snapshot.active) {
    tutorial.classList.add('tutorial-card--hidden');
    return;
  }

  tutorial.classList.remove('tutorial-card--hidden', 'tutorial-card--info', 'tutorial-card--success', 'tutorial-card--warning');
  tutorial.classList.add(`tutorial-card--${snapshot.tone}`);
  tutorialStep.textContent = `Step ${snapshot.step}/${snapshot.total}`;
  tutorialTitle.textContent = snapshot.title;
  tutorialBody.textContent = snapshot.body;
  tutorialObjective.textContent = snapshot.objective;
  tutorialSkipButton.hidden = !snapshot.skippable;
  tutorialProgress.style.transform = `scaleX(${Math.max(0, Math.min(1, snapshot.progress))})`;
}

function renderRunSummary(summary: RunSummary, progression?: ProgressionResult) {
  pauseTitle.textContent = 'Run Complete';
  summaryGrade.textContent = summary.grade;
  summaryScore.textContent = formatScore.format(summary.score);
  summaryBest.textContent = `Best ${formatScore.format(summary.bestScore)}`;
  summaryPersonalBest.textContent = summary.personalBest ? 'New personal best' : 'Personal best held';
  summaryTime.textContent = summary.durationText;
  summaryCoins.textContent = `${summary.coins}/${summary.totalCoins}`;
  summaryDeaths.textContent = String(summary.deaths);
  summaryMutations.textContent = String(summary.mutationsSurvived);
  summaryTrust.textContent = `${summary.trustPercent}%`;

  summaryMissions.replaceChildren(
    ...summary.missions.map((mission) => {
      const item = document.createElement('article');
      item.className = `run-summary__mission${mission.achieved ? ' run-summary__mission--complete' : ''}`;

      const label = document.createElement('strong');
      label.textContent = mission.label;

      const description = document.createElement('span');
      description.textContent = mission.description;

      const progress = document.createElement('small');
      progress.textContent = `${mission.progress} - ${mission.achieved ? 'Complete' : 'Open'}`;

      item.replaceChildren(label, description, progress);
      return item;
    })
  );

  summaryRecap.replaceChildren(
    ...summary.recap.map((line) => {
      const item = document.createElement('li');
      item.textContent = line;
      return item;
    })
  );

  if (progression) {
    const unlockedLabels = progression.unlocked.map((unlock) => unlock.label);
    const lines = [
      `+${formatScore.format(progression.xpEarned)} XP earned, ${formatScore.format(progression.totalXp)} XP total.`,
      summary.mode === 'standard'
        ? progression.campaignUnlockedLevel
          ? `Campaign Level ${progression.campaignUnlockedLevel} unlocked.`
          : `Campaign highest unlocked: Level ${progression.campaignHighestUnlocked}.`
        : null,
      progression.leaderboardRank ? `Leaderboard entry #${progression.leaderboardRank}.` : 'Score missed the local top 10.',
      summary.mode === 'daily'
        ? progression.dailyCompleted
          ? `Daily anomaly cleared. Streak ${progression.dailyStreak}.`
          : `Daily anomaly already cleared today. Streak ${progression.dailyStreak}.`
        : null,
      unlockedLabels.length ? `Unlocked: ${unlockedLabels.join(', ')}.` : 'No new unlocks this run.'
    ].filter(Boolean) as string[];

    summaryProgression.replaceChildren(...lines.map((line) => {
      const item = document.createElement('span');
      item.textContent = line;
      return item;
    }));

    summaryLeaderboard.replaceChildren(...progression.leaderboard.slice(0, 5).map(renderLeaderboardEntry));
  }
}

function renderMenuProgression() {
  currentDaily = createDailyAnomaly();
  const meta = readMetaProgression();
  applyAccessibilitySettings(meta.accessibility);

  dailyTitle.textContent = `${currentDaily.dateKey}: ${currentDaily.label}`;
  dailyCopy.textContent = currentDaily.subtitle;
  dailyStreak.textContent = `Streak ${meta.daily.streak}`;
  renderCampaignControls(meta.campaign.highestUnlockedLevel, meta.campaign.selectedLevel);
  progressionXp.textContent = `XP ${formatScore.format(meta.xp)}`;
  playerName.value = meta.playerName;
  playerStatus.textContent = meta.playerName === 'Runner' ? 'Set name' : meta.playerName;
  settingsStatus.textContent = meta.accessibility.audioEnabled ? 'Sound on' : 'Muted';
  leaderboardStatus.textContent = meta.leaderboard.length ? `${meta.leaderboard.length} saved` : 'No runs yet';

  populateCosmeticSelect(skinSelect, cosmeticCatalog.skins, meta.unlocked.skins, meta.loadout.skin);
  populateCosmeticSelect(trailSelect, cosmeticCatalog.trails, meta.unlocked.trails, meta.loadout.trail);
  populateCosmeticSelect(deathEffectSelect, cosmeticCatalog.deathEffects, meta.unlocked.deathEffects, meta.loadout.deathEffect);
  populateCosmeticSelect(portalEffectSelect, cosmeticCatalog.portalEffects, meta.unlocked.portalEffects, meta.loadout.portalEffect);
  localLeaderboard.replaceChildren(...meta.leaderboard.slice(0, 5).map(renderLeaderboardEntry));
}

async function renderGlobalLeaderboard() {
  const state = await fetchGlobalLeaderboard(5);
  globalLeaderboardStatus.textContent = state.configured ? state.status : 'Supabase off';
  globalLeaderboard.replaceChildren(
    ...(state.entries.length ? state.entries : readMetaProgression().leaderboard.slice(0, 5)).map(renderLeaderboardEntry)
  );
  summaryGlobalStatus.textContent = state.status;
}

function renderCampaignControls(highestUnlockedLevel: number, selectedLevel: number) {
  const highest = Math.max(1, Math.min(maxCampaignLevel, highestUnlockedLevel));
  const selected = Math.max(1, Math.min(highest, selectedLevel));

  const options: HTMLOptionElement[] = [];
  for (let level = 1; level <= highest; level += 1) {
    const option = document.createElement('option');
    option.value = String(level);
    option.textContent = `Level ${level}`;
    options.push(option);
  }
  if (highest < maxCampaignLevel) {
    const locked = document.createElement('option');
    locked.value = String(highest + 1);
    locked.textContent = `Level ${highest + 1} locked`;
    locked.disabled = true;
    options.push(locked);
  }
  levelSelect.replaceChildren(...options);
  levelSelect.value = String(selected);
  levelPrevButton.disabled = selected <= 1;
  levelNextButton.disabled = selected >= highest;
  campaignProgress.textContent = `Unlocked ${highest}/${maxCampaignLevel}`;
  campaignCopy.textContent = highest >= maxCampaignLevel
    ? `All ${maxCampaignLevel} levels unlocked. Replay Level ${selected} for a cleaner rank.`
    : selected === highest
      ? `Clear Level ${selected} to unlock Level ${selected + 1}.`
      : `Replay Level ${selected}; Level ${highest + 1} unlocks after Level ${highest}.`;
  startButton.textContent = `Start Level ${selected}`;
}

function populateCosmeticSelect<TId extends string>(
  select: HTMLSelectElement,
  catalog: CosmeticDefinition<TId>[],
  unlocked: TId[],
  selected: TId
) {
  select.replaceChildren(...catalog.map((item) => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = unlocked.includes(item.id) ? item.label : `${item.label} (locked)`;
    option.disabled = !unlocked.includes(item.id);
    option.title = item.description;
    return option;
  }));
  select.value = selected;
}

function renderLeaderboardEntry(entry: LeaderboardEntry) {
  const item = document.createElement('li');
  const mode = entry.mode === 'daily' ? 'Daily' : `Level ${entry.levelIndex}`;
  item.textContent = `${entry.playerName} - ${mode} ${formatScore.format(entry.score)} ${entry.grade} - ${entry.durationText}, ${entry.deaths} deaths`;
  return item;
}

function applyAccessibilitySettings(settings: AccessibilitySettings) {
  document.body.dataset.uiScale = settings.uiScale;
  document.body.classList.toggle('color-safe-warnings', settings.colorSafeWarnings);
  audioToggle.checked = settings.audioEnabled;
  motionToggle.checked = settings.reducedMotion;
  colorSafeToggle.checked = settings.colorSafeWarnings;
  uiScaleSelect.value = settings.uiScale;
}

function setLoadout(patch: Partial<CosmeticLoadout>) {
  updateLoadout(patch);
  renderMenuProgression();
}

function setAccessibility(patch: Partial<AccessibilitySettings>) {
  const state = updateAccessibility(patch);
  applyAccessibilitySettings(state.accessibility);
  renderMenuProgression();
}

aggression.addEventListener('input', () => {
  aggressionOutput.textContent = `${aggression.value}%`;
});
playerName.addEventListener('change', () => {
  updatePlayerName(playerName.value);
  renderMenuProgression();
});
playerName.addEventListener('blur', () => {
  updatePlayerName(playerName.value);
  renderMenuProgression();
});

startButton.addEventListener('click', () => startGame('standard'));
dailyButton.addEventListener('click', () => startGame('daily'));
pauseButton.addEventListener('click', pauseGame);
resumeButton.addEventListener('click', resumeGame);
restartButton.addEventListener('click', () => startGame(lastMode, lastLevelIndex));
quitButton.addEventListener('click', quitToMenu);
tutorialSkipButton.addEventListener('click', () => {
  window.dispatchEvent(new CustomEvent('paradox:tutorial-skip'));
  tutorial.classList.add('tutorial-card--hidden');
});
levelSelect.addEventListener('change', () => {
  selectCampaignLevel(Number(levelSelect.value));
  renderMenuProgression();
});
levelPrevButton.addEventListener('click', () => {
  selectCampaignLevel(Number(levelSelect.value) - 1);
  renderMenuProgression();
});
levelNextButton.addEventListener('click', () => {
  selectCampaignLevel(Number(levelSelect.value) + 1);
  renderMenuProgression();
});
skinSelect.addEventListener('change', () => setLoadout({ skin: skinSelect.value as SkinId }));
trailSelect.addEventListener('change', () => setLoadout({ trail: trailSelect.value as TrailId }));
deathEffectSelect.addEventListener('change', () => setLoadout({ deathEffect: deathEffectSelect.value as DeathEffectId }));
portalEffectSelect.addEventListener('change', () => setLoadout({ portalEffect: portalEffectSelect.value as PortalEffectId }));
audioToggle.addEventListener('change', () => setAccessibility({ audioEnabled: audioToggle.checked }));
motionToggle.addEventListener('change', () => setAccessibility({ reducedMotion: motionToggle.checked }));
colorSafeToggle.addEventListener('change', () => setAccessibility({ colorSafeWarnings: colorSafeToggle.checked }));
uiScaleSelect.addEventListener('change', () => setAccessibility({ uiScale: uiScaleSelect.value as AccessibilitySettings['uiScale'] }));

window.addEventListener('paradox:hud', (event) => {
  renderHud((event as CustomEvent<HudSnapshot>).detail);
});

window.addEventListener('paradox:tutorial', (event) => {
  renderTutorial((event as CustomEvent<TutorialSnapshot>).detail);
});

window.addEventListener('paradox:run-complete', (event) => {
  const summary = (event as CustomEvent<RunSummary>).detail;
  showingRunSummary = true;
  if (summary) {
    const progression = completeRunProgression(summary, lastMode, currentDaily);
    renderRunSummary(summary, progression);
    void submitGlobalScore(progression.latestEntry).then((state) => {
      summaryGlobalStatus.textContent = state.status;
      return renderGlobalLeaderboard();
    });
    renderMenuProgression();
  }
  resumeButton.hidden = true;
  runSummary.classList.remove('run-summary--hidden');
  mobileControls.classList.add('mobile-controls--hidden');
  tutorial.classList.add('tutorial-card--hidden');
  pauseMenu.classList.remove('pause-menu--hidden');
});

window.addEventListener('paradox:ui-spoof', (event) => {
  const detail = (event as CustomEvent<{ message: string; durationMs: number }>).detail;
  spoofText.textContent = detail.message;
  spoof.classList.remove('system-spoof--hidden');
  window.setTimeout(() => {
    spoof.classList.add('system-spoof--hidden');
  }, detail.durationMs);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && activeScene) {
    pauseGame();
  }
});

window.addEventListener('blur', () => {
  if (activeScene) pauseGame();
});

window.addEventListener('pagehide', () => {
  if (activeScene) pauseGame();
});

mobileControls.addEventListener('contextmenu', (event) => event.preventDefault());
mobileControls.addEventListener('selectstart', (event) => event.preventDefault());
mobileControls.addEventListener('copy', (event) => event.preventDefault());

window.addEventListener('keydown', (event) => {
  if (event.code === 'Escape' && activeScene) {
    if (pauseMenu.classList.contains('pause-menu--hidden')) pauseGame();
    else if (!showingRunSummary) resumeGame();
  }
});
