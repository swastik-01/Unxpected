import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { chromium } from '@playwright/test';

const port = Number(process.env.QA_PORT) || await findFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const outDir = path.resolve('qa-artifacts');
const ignoredConsole = /GPU stall due to ReadPixels/;
const failures = [];

await fs.mkdir(outDir, { recursive: true });

const serverCommand = process.platform === 'win32' ? 'cmd.exe' : 'npm';
const serverArgs = process.platform === 'win32'
  ? ['/d', '/s', '/c', `npm run dev -- --port ${port} --strictPort`]
  : ['run', 'dev', '--', '--port', String(port), '--strictPort'];
const server = spawn(serverCommand, serverArgs, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    BROWSER: 'none',
    VITE_SUPABASE_URL: '',
    VITE_SUPABASE_ANON_KEY: ''
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverLog = '';
server.stdout.on('data', (chunk) => {
  serverLog += chunk.toString();
});
server.stderr.on('data', (chunk) => {
  serverLog += chunk.toString();
});

try {
  await waitForServer(baseUrl);
  const browser = await chromium.launch();

  const desktop = await runDesktopQa(browser);
  const level99 = await runLevel99Qa(browser);
  const mobileLandscape = await runMobileLandscapeQa(browser);
  const mobilePortrait = await runMobilePortraitQa(browser);

  await browser.close();

  if (failures.length) {
    console.error(JSON.stringify({ failures, desktop, level99, mobileLandscape, mobilePortrait, outDir }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ desktop, level99, mobileLandscape, mobilePortrait, outDir }, null, 2));
  }
} finally {
  stopServer();
}

async function runDesktopQa(browser) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  watchPage(page, 'desktop');
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto(`${baseUrl}/?debugPhysics=1`, { waitUntil: 'networkidle' });

  const menu = await inspectMenu(page);
  assert('desktop menu boots as a compact player-facing launch panel', menu.dailyButton === 'Daily Anomaly' && !menu.trainingVisible && menu.aggression === '50%' && menu.campaignProgress === 'Unlocked 1/99' && menu.playerName === 'Runner' && menu.globalStatus && menu.startButton === 'Start Level 1', menu);
  assert('desktop menu has no horizontal overflow or internal scrolling', !menu.overflowX && !menu.panelScrollable, menu);
  assert('desktop menu keeps controls hidden', menu.mobileControlsHidden, menu);
  await page.screenshot({ path: path.join(outDir, 'desktop-menu.png'), fullPage: true });

  await page.click('#start-button');
  await page.waitForFunction(() => Boolean(window.__PARADOX_DEBUG__?.snapshot));
  await page.waitForFunction(() => window.__PARADOX_DEBUG__?.snapshot().player.onGround, null, { timeout: 5000 });
  const idle = await page.evaluate(() => window.__PARADOX_DEBUG__.snapshot().player);
  assert('desktop player boots in idle animation with a generated body texture', idle.animation === 'player-idle' && idle.textureKey.startsWith('player'), idle);
  const levelShape = await page.evaluate(() => {
    const entities = window.__PARADOX_DEBUG__.snapshot().entities;
    return {
      hasCheckpoint: Boolean(entities.checkpoint_01),
      hasCollapseTrap: Boolean(entities.collapse_01),
      hasProjectileTrap: Boolean(entities.projectile_01)
    };
  });
  assert('desktop route has no checkpoint and includes surprise AI traps', !levelShape.hasCheckpoint && levelShape.hasCollapseTrap && levelShape.hasProjectileTrap, levelShape);

  const started = await page.evaluate(() => ({
    hudHidden: document.querySelector('#hud')?.classList.contains('hud--hidden'),
    mode: document.querySelector('#hud-mode')?.textContent,
    ai: document.querySelector('#hud-profile')?.textContent,
    time: document.querySelector('#hud-time')?.textContent,
    coins: document.querySelector('#hud-coins')?.textContent,
    score: document.querySelector('#hud-score')?.textContent,
    mutationFeedHidden: getComputedStyle(document.querySelector('#mutation-feed')).display === 'none',
    tutorialSkipVisible: !document.querySelector('#tutorial-skip-button')?.hasAttribute('hidden'),
    canvas: document.querySelector('canvas')?.getBoundingClientRect().toJSON()
  }));
  assert('desktop live HUD is lean and exposes only player-facing run info', started.mode === 'Level 1' && started.ai && started.time && started.coins === '0/5' && Number(started.score?.replaceAll(',', '')) > 0 && started.mutationFeedHidden, started);
  assert('desktop canvas is full gameplay size', started.canvas.width > 1000 && started.canvas.height > 560, started.canvas);
  assert('desktop tutorial starts with a visible skip control', started.tutorialSkipVisible, started);

  await page.click('#tutorial-skip-button');
  const skippedTutorial = await page.evaluate(() => ({
    hidden: document.querySelector('#tutorial-card')?.classList.contains('tutorial-card--hidden'),
    stored: window.localStorage.getItem('unxpected:tutorial-complete')
  }));
  assert('desktop tutorial can be skipped and is persisted', skippedTutorial.hidden && skippedTutorial.stored === '1', skippedTutorial);

  const beforeMove = await page.evaluate(() => window.__PARADOX_DEBUG__.snapshot().player.x);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(420);
  await page.keyboard.up('ArrowRight');
  const afterMove = await page.evaluate(() => window.__PARADOX_DEBUG__.snapshot().player);
  assert('desktop move verb applies velocity and advances player', afterMove.vx > 200 && afterMove.x > beforeMove + 8, { beforeMove, afterMove });
  assert('desktop movement drives the four-frame run animation', afterMove.animation === 'player-run' && afterMove.textureKey.startsWith('player_run_'), afterMove);

  await mappedKeyDown(page, 'KeyK', 'k');
  const dash = await waitForPlayerAnimation(page, 'player-dash', 'player_dash');
  await mappedKeyUp(page, 'KeyK', 'k');
  assert('desktop dash uses the stretched dash pose', dash.animation === 'player-dash' && dash.textureKey === 'player_dash', dash);
  const dashText = await page.locator('#dash-meter-fill').evaluate((node) => getComputedStyle(node).transform);
  assert('desktop dash meter reacts after dash', dashText !== 'none', { dashText });
  await page.screenshot({ path: path.join(outDir, 'desktop-gameplay.png'), fullPage: true });
  await page.waitForTimeout(260);

  await page.waitForFunction(() => window.__PARADOX_DEBUG__.snapshot().player.onGround, null, { timeout: 1500 });
  await page.keyboard.press('Space');
  const jump = await waitForPlayerAnimation(page, 'player-jump', 'player_jump');
  assert('desktop jump verb creates upward velocity', jump.vy < -150 || !jump.onGround, jump);
  assert('desktop jump uses the airborne pose', jump.animation === 'player-jump' && jump.textureKey === 'player_jump', jump);

  await page.evaluate(() => window.__PARADOX_DEBUG__.killPlayer('QA death animation'));
  await page.waitForTimeout(90);
  const death = await page.evaluate(() => window.__PARADOX_DEBUG__.snapshot().player);
  assert('desktop death triggers the readable fractured body animation state', death.animation === 'player-death' && death.textureKey === 'player_death' && death.visible, death);
  await page.waitForFunction(() => {
    const player = window.__PARADOX_DEBUG__.snapshot().player;
    return player.visible && player.animation !== 'player-death';
  }, null, { timeout: 2500 });
  const afterDeathReset = await page.evaluate(() => window.__PARADOX_DEBUG__.snapshot());
  assert('desktop death respawns from level start', afterDeathReset.player.x < 145 && afterDeathReset.player.y < 590 && afterDeathReset.checkpointIndex === 0, afterDeathReset.player);

  await page.evaluate(() => {
    const api = window.__PARADOX_DEBUG__;
    api.forceMutation('collapse_01');
    api.forceMutation('projectile_01');
  });
  await page.waitForFunction(() => {
    const entities = window.__PARADOX_DEBUG__.snapshot().entities;
    return entities.collapse_01.mask === 'pass_through' && entities.projectile_01.mask === 'lethal_hazard';
  }, null, { timeout: 1500 });
  await page.waitForTimeout(180);
  await page.evaluate(() => window.__PARADOX_DEBUG__.killPlayer('QA world reset'));
  const resetPoll = await waitForDebugSnapshot(page, (snapshot) => (
    snapshot.deaths >= 2
      && snapshot.player.visible
      && snapshot.player.animation !== 'player-death'
      && snapshot.player.x < 145
  ), { timeout: 7000 });
  assert('desktop second death respawns from the start before world reset assertions', resetPoll.matched, resetPoll.snapshot);
  const resetWorld = await page.evaluate(() => {
    const snapshot = window.__PARADOX_DEBUG__.snapshot();
    return {
      player: snapshot.player,
      coins: snapshot.coins,
      checkpointIndex: snapshot.checkpointIndex,
      mutationsSurvived: snapshot.run.mutationsSurvived,
      collapse: snapshot.entities.collapse_01,
      projectile: snapshot.entities.projectile_01
    };
  });
  assert('desktop death rebuilds mutated surfaces and projectiles to their original state', resetWorld.coins === 0 && resetWorld.checkpointIndex === 0 && resetWorld.mutationsSurvived === 0 && resetWorld.collapse.mask === 'solid' && resetWorld.collapse.bodyType === 'static' && resetWorld.projectile.mask === 'sensor' && resetWorld.projectile.bodyEnabled === false && resetWorld.projectile.alpha < 0.01, resetWorld);

  await page.click('#pause-button');
  await page.waitForSelector('#pause-menu:not(.pause-menu--hidden)');
  const pause = await page.evaluate(() => ({
    title: document.querySelector('#pause-title')?.textContent,
    summaryHidden: document.querySelector('#run-summary')?.classList.contains('run-summary--hidden'),
    controlsHidden: document.querySelector('#mobile-controls')?.classList.contains('mobile-controls--hidden')
  }));
  assert('desktop pause is a pause state not a run summary', pause.title === 'Paused' && pause.summaryHidden && pause.controlsHidden, pause);
  await page.click('#resume-button');
  await page.waitForFunction(() => document.querySelector('#pause-menu')?.classList.contains('pause-menu--hidden'));

  await page.evaluate(() => {
    const api = window.__PARADOX_DEBUG__;
    api.forceMutation('collapse_01');
    api.forceMutation('projectile_01');
    api.forceMutation('phase_01');
    api.forceMutation('jump_wall_sensor');
    api.forceMutation('mercy_bridge');
    api.completeRun();
  });
  await page.waitForSelector('#run-summary:not(.run-summary--hidden)');
  const summary = await page.evaluate(() => ({
    title: document.querySelector('#pause-title')?.textContent,
    grade: document.querySelector('#summary-grade')?.textContent,
    progression: [...document.querySelectorAll('#summary-progression span')].map((node) => node.textContent),
    leaderboard: document.querySelectorAll('#summary-leaderboard li').length,
    stored: JSON.parse(window.localStorage.getItem('unxpected.meta.v1'))
  }));
  assert('desktop completion summary records progression and leaderboard', summary.title === 'Run Complete' && summary.progression.length >= 3 && summary.leaderboard >= 1, summary);
  assert('desktop meta progression persisted', summary.stored.xp > 0 && summary.stored.leaderboard.length >= 1, summary.stored);
  await page.screenshot({ path: path.join(outDir, 'desktop-summary.png'), fullPage: true });

  await page.close();
  return { menu, started, pause, summary: { grade: summary.grade, progression: summary.progression.length } };
}

async function runLevel99Qa(browser) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  watchPage(page, 'level-99');
  await page.addInitScript(() => {
    window.localStorage.setItem('unxpected.meta.v1', JSON.stringify({
      campaign: {
        highestUnlockedLevel: 99,
        selectedLevel: 99
      },
      playerName: 'QA Runner',
      leaderboard: [],
      xp: 0
    }));
    window.localStorage.setItem('unxpected:tutorial-complete', '1');
  });
  await page.goto(`${baseUrl}/?debugPhysics=1`, { waitUntil: 'networkidle' });

  const menu = await inspectMenu(page);
  assert('level 99 menu unlock state is selectable', menu.campaignProgress === 'Unlocked 99/99' && menu.startButton === 'Start Level 99', menu);
  await page.click('#start-button');
  await page.waitForFunction(() => Boolean(window.__PARADOX_DEBUG__?.snapshot));
  await page.waitForTimeout(450);

  const boot = await page.evaluate(() => {
    const snapshot = window.__PARADOX_DEBUG__.snapshot();
    const inertIds = [
      'sky_strike_02',
      'timer_shot_02',
      'rolling_rock_02',
      'hunter_02',
      'final_sky_strike'
    ];
    const requiredIds = [...inertIds, 'spike_pressure_variant'];
    return {
      hudMode: document.querySelector('#hud-mode')?.textContent,
      missing: requiredIds.filter((id) => !snapshot.entities[id]),
      entityCount: Object.keys(snapshot.entities).length,
      transparentAdvancedHazards: inertIds.every((id) => {
        const entity = snapshot.entities[id];
        return entity && entity.mask === 'sensor' && entity.alpha < 0.01;
      }),
      activePressureSpike: snapshot.entities.spike_pressure_variant?.mask === 'lethal_hazard'
        && snapshot.entities.spike_pressure_variant?.bodyEnabled
    };
  });
  assert('level 99 boots with endgame hazards staged and pressure spike active', boot.hudMode === 'Level 99' && boot.missing.length === 0 && boot.entityCount >= 29 && boot.transparentAdvancedHazards && boot.activePressureSpike, boot);

  await page.evaluate(() => {
    const api = window.__PARADOX_DEBUG__;
    ['sky_strike_02', 'timer_shot_02', 'rolling_rock_02', 'hunter_02', 'final_sky_strike', 'spike_pressure_variant']
      .forEach((id) => api.forceMutation(id));
  });
  await page.waitForFunction(() => {
    const entities = window.__PARADOX_DEBUG__.snapshot().entities;
    return ['sky_strike_02', 'timer_shot_02', 'rolling_rock_02', 'hunter_02', 'final_sky_strike', 'spike_pressure_variant']
      .every((id) => entities[id]?.mask === 'lethal_hazard' && entities[id]?.bodyEnabled);
  }, null, { timeout: 1800 });
  const mutated = await page.evaluate(() => {
    const entities = window.__PARADOX_DEBUG__.snapshot().entities;
    return Object.fromEntries(['sky_strike_02', 'timer_shot_02', 'rolling_rock_02', 'hunter_02', 'final_sky_strike', 'spike_pressure_variant']
      .map((id) => [id, entities[id]]));
  });
  assert('level 99 forced endgame hazards become active lethal physics objects', Object.values(mutated).every((entity) => entity.mask === 'lethal_hazard' && entity.bodyEnabled), mutated);
  await page.screenshot({ path: path.join(outDir, 'desktop-level-99-endgame.png'), fullPage: true });

  await page.evaluate(() => window.__PARADOX_DEBUG__.killPlayer('QA level 99 reset'));
  const resetPoll = await waitForDebugSnapshot(page, (snapshot) => (
    snapshot.deaths >= 1
      && snapshot.player.visible
      && snapshot.player.animation !== 'player-death'
      && snapshot.player.x < 145
  ), { timeout: 7000 });
  assert('level 99 death respawns from the start', resetPoll.matched, resetPoll.snapshot);
  const reset = await page.evaluate(() => {
    const snapshot = window.__PARADOX_DEBUG__.snapshot();
    const inertIds = ['sky_strike_02', 'timer_shot_02', 'rolling_rock_02', 'hunter_02', 'final_sky_strike'];
    return {
      player: snapshot.player,
      mutationsSurvived: snapshot.run.mutationsSurvived,
      hazards: Object.fromEntries(['sky_strike_02', 'timer_shot_02', 'rolling_rock_02', 'hunter_02', 'final_sky_strike', 'spike_pressure_variant']
        .map((id) => [id, snapshot.entities[id]])),
      inertRestored: inertIds.every((id) => {
        const entity = snapshot.entities[id];
        return entity?.mask === 'sensor' && !entity.bodyEnabled && entity.alpha < 0.01;
      }),
      pressureSpikeRestored: snapshot.entities.spike_pressure_variant?.mask === 'lethal_hazard'
        && snapshot.entities.spike_pressure_variant?.bodyEnabled
    };
  });
  assert('level 99 death reset restores endgame hazards to original state', reset.mutationsSurvived === 0 && reset.inertRestored && reset.pressureSpikeRestored, reset);
  await page.close();
  return { menu, boot, mutatedCount: Object.keys(mutated).length, reset: { player: reset.player, mutationsSurvived: reset.mutationsSurvived } };
}

async function runMobileLandscapeQa(browser) {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  watchPage(page, 'mobile-landscape');
  await page.goto(`${baseUrl}/?debugPhysics=1`, { waitUntil: 'networkidle' });
  const menu = await inspectMenu(page);
  assert('mobile landscape menu fits without horizontal overflow or internal scrolling', !menu.overflowX && !menu.panelScrollable && menu.panelWidth <= 844 && menu.panelHeight <= 390 && menu.campaignProgress === 'Unlocked 1/99' && !menu.trainingVisible, menu);

  await page.click('#start-button');
  await page.waitForFunction(() => Boolean(window.__PARADOX_DEBUG__?.snapshot));
  await page.waitForTimeout(350);
  const gameplay = await page.evaluate(() => ({
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
    controlsVisible: getComputedStyle(document.querySelector('#mobile-controls')).display !== 'none',
    rotateVisible: getComputedStyle(document.querySelector('#rotate-device')).display !== 'none',
    moveButtonCodes: [...document.querySelectorAll('.mobile-controls__move button')].map((node) => node.textContent.trim().codePointAt(0)),
    controlOpacity: Number(getComputedStyle(document.querySelector('.mobile-controls__move button')).opacity),
    rightUserSelect: getComputedStyle(document.querySelector('[data-action="right"]')).userSelect,
    rightTouchAction: getComputedStyle(document.querySelector('[data-action="right"]')).touchAction,
    rightContextMenuPrevented: !document.querySelector('[data-action="right"]').dispatchEvent(new Event('contextmenu', { bubbles: true, cancelable: true })),
    tutorialVisible: getComputedStyle(document.querySelector('#tutorial-card')).display !== 'none',
    tutorialSkipVisible: getComputedStyle(document.querySelector('#tutorial-skip-button')).display !== 'none' && !document.querySelector('#tutorial-skip-button')?.hasAttribute('hidden'),
    hudRunWidth: document.querySelector('.hud__cluster--run')?.getBoundingClientRect().width ?? 0,
    hudScore: document.querySelector('#hud-score')?.textContent
  }));
  assert('mobile landscape gameplay shows controls without rotate blocker', gameplay.controlsVisible && !gameplay.rotateVisible, gameplay);
  assert('mobile landscape movement uses arrow buttons, not keyboard-letter prompts', gameplay.moveButtonCodes.join(',') === '8592,8594', gameplay);
  assert('mobile landscape touch buttons suppress long-press selection and context menus', gameplay.rightUserSelect === 'none' && gameplay.rightTouchAction === 'none' && gameplay.rightContextMenuPrevented, gameplay);
  assert('mobile landscape touch controls are translucent and first-run tutorial is skippable', gameplay.controlOpacity < 0.9 && (!gameplay.tutorialVisible || gameplay.tutorialSkipVisible), gameplay);
  assert('mobile landscape HUD fits and exposes score', !gameplay.overflowX && gameplay.hudRunWidth > 0 && Number(gameplay.hudScore?.replaceAll(',', '')) > 0, gameplay);
  if (gameplay.tutorialVisible) {
    await page.click('#tutorial-skip-button');
    const tutorialAfterSkip = await page.evaluate(() => ({
      hidden: document.querySelector('#tutorial-card')?.classList.contains('tutorial-card--hidden'),
      stored: window.localStorage.getItem('unxpected:tutorial-complete')
    }));
    assert('mobile landscape tutorial skip hides onboarding and persists choice', tutorialAfterSkip.hidden && tutorialAfterSkip.stored === '1', tutorialAfterSkip);
  }
  await page.screenshot({ path: path.join(outDir, 'mobile-landscape-gameplay.png'), fullPage: true });

  await page.evaluate(() => window.__PARADOX_DEBUG__.completeRun());
  await page.waitForSelector('#run-summary:not(.run-summary--hidden)');
  const summary = await page.evaluate(() => ({
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
    controlsVisible: getComputedStyle(document.querySelector('#mobile-controls')).display !== 'none',
    title: document.querySelector('#pause-title')?.textContent,
    progression: [...document.querySelectorAll('#summary-progression span')].map((node) => node.textContent),
    stored: JSON.parse(window.localStorage.getItem('unxpected.meta.v1'))
  }));
  assert('mobile landscape completion hides controls and avoids overflow', summary.title === 'Run Complete' && !summary.controlsVisible && !summary.overflowX, summary);
  assert('mobile landscape standard clear unlocks exactly the next campaign level', summary.stored.campaign.highestUnlockedLevel === 2 && summary.stored.campaign.selectedLevel === 2 && summary.progression.some((line) => line?.includes('Campaign Level 2 unlocked')), summary);
  await page.screenshot({ path: path.join(outDir, 'mobile-landscape-summary.png'), fullPage: true });
  await page.close();
  return { menu, gameplay, summary };
}

async function runMobilePortraitQa(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  watchPage(page, 'mobile-portrait');
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  const menu = await inspectMenu(page);
  assert('mobile portrait menu keeps controls hidden and avoids internal scrolling', menu.mobileControlsHidden && !menu.overflowX && !menu.panelScrollable, menu);

  await page.click('#start-button');
  await page.waitForTimeout(650);
  const portrait = await page.evaluate(() => ({
    rotateVisible: getComputedStyle(document.querySelector('#rotate-device')).display !== 'none',
    controlsVisible: getComputedStyle(document.querySelector('#mobile-controls')).display !== 'none',
    tutorialVisible: getComputedStyle(document.querySelector('#tutorial-card')).display !== 'none',
    hudOpacity: Number(getComputedStyle(document.querySelector('#hud')).opacity),
    overflowX: document.documentElement.scrollWidth > window.innerWidth
  }));
  assert('mobile portrait play asks for rotation without showing gameplay controls behind the overlay', portrait.rotateVisible && !portrait.controlsVisible && !portrait.tutorialVisible && portrait.hudOpacity < 0.35 && !portrait.overflowX, portrait);
  await page.screenshot({ path: path.join(outDir, 'mobile-portrait-rotate.png'), fullPage: true });
  await page.close();
  return { menu, portrait };
}

async function inspectMenu(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('.menu__panel')?.getBoundingClientRect();
    return {
      panelWidth: panel?.width ?? 0,
    panelHeight: panel?.height ?? 0,
    panelScrollable: Boolean(document.querySelector('.menu__panel') && document.querySelector('.menu__panel').scrollHeight > document.querySelector('.menu__panel').clientHeight + 1),
    aggression: document.querySelector('#aggression-output')?.textContent ?? '',
    campaignProgress: document.querySelector('#campaign-progress')?.textContent ?? '',
    dailyButton: document.querySelector('#daily-button')?.textContent ?? '',
    dailyTitle: document.querySelector('#daily-title')?.textContent ?? '',
    globalStatus: document.querySelector('#global-leaderboard-status')?.textContent ?? '',
    playerName: document.querySelector('#player-name')?.value ?? '',
    startButton: document.querySelector('#start-button')?.textContent ?? '',
    trainingVisible: Boolean(document.querySelector('#training-button') && getComputedStyle(document.querySelector('#training-button')).display !== 'none'),
    mobileControlsHidden: getComputedStyle(document.querySelector('#mobile-controls')).display === 'none',
    overflowX: document.documentElement.scrollWidth > window.innerWidth
  };
  });
}

function watchPage(page, label) {
  page.on('pageerror', (error) => failures.push(`${label} pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type()) && !ignoredConsole.test(message.text())) {
      failures.push(`${label} ${message.type()}: ${message.text()}`);
    }
  });
}

function assert(name, pass, details = {}) {
  if (!pass) failures.push(`${name} failed: ${JSON.stringify(details)}`);
}

async function mappedKeyDown(page, code, key) {
  await page.evaluate(({ code, key }) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code, key, bubbles: true, cancelable: true }));
  }, { code, key });
}

async function mappedKeyUp(page, code, key) {
  await page.evaluate(({ code, key }) => {
    window.dispatchEvent(new KeyboardEvent('keyup', { code, key, bubbles: true, cancelable: true }));
  }, { code, key });
}

async function waitForPlayerAnimation(page, animation, textureKey, timeout = 1200) {
  return page.evaluate(({ animation, textureKey, timeout }) => new Promise((resolve) => {
    const startedAt = performance.now();
    let latest = window.__PARADOX_DEBUG__.snapshot().player;
    const tick = () => {
      latest = window.__PARADOX_DEBUG__.snapshot().player;
      if (latest.animation === animation && latest.textureKey === textureKey) {
        resolve(latest);
        return;
      }
      if (performance.now() - startedAt >= timeout) {
        resolve(latest);
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  }), { animation, textureKey, timeout });
}

async function waitForDebugSnapshot(page, predicate, { timeout = 5000, interval = 75 } = {}) {
  const startedAt = Date.now();
  let snapshot = null;
  while (Date.now() - startedAt < timeout) {
    snapshot = await page.evaluate(() => window.__PARADOX_DEBUG__?.snapshot?.() ?? null);
    if (snapshot && predicate(snapshot)) {
      return { matched: true, snapshot };
    }
    await page.waitForTimeout(interval);
  }
  return { matched: false, snapshot };
}

async function waitForServer(url) {
  const started = Date.now();
  while (Date.now() - started < 30000) {
    if (server.exitCode !== null) {
      throw new Error(`Vite server exited early.\n${serverLog}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}.\n${serverLog}`);
}

function stopServer() {
  if (server.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(server.pid), '/t', '/f'], { stdio: 'ignore' });
    return;
  }
  server.kill();
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const listener = net.createServer();
    listener.unref();
    listener.on('error', reject);
    listener.listen(0, '127.0.0.1', () => {
      const address = listener.address();
      listener.close(() => {
        if (typeof address === 'object' && address?.port) {
          resolve(address.port);
          return;
        }
        reject(new Error('Unable to allocate a QA server port.'));
      });
    });
  });
}
