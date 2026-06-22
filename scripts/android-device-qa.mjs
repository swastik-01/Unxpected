import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const packageName = 'com.unexpectedgame.unxpected';
const apkPath = path.resolve('Unxpected-release.apk');
const outDir = path.resolve('qa-artifacts');
const screenshotPath = path.join(outDir, 'device-latest.png');
const menuScreenshotPath = path.join(outDir, 'device-menu-latest.png');
const gameplayScreenshotPath = path.join(outDir, 'device-gameplay-latest.png');

fs.mkdirSync(outDir, { recursive: true });

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  }
  return `${result.stdout ?? ''}${result.stderr ?? ''}`;
}

function adb(args, options = {}) {
  return run('adb', args, options);
}

function tryAdb(args, options = {}) {
  const result = spawnSync('adb', args, { encoding: 'utf8', ...options });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`
  };
}

function parseDevices(output) {
  return output
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter(([id, state]) => id && state === 'device')
    .map(([id]) => id);
}

function isLockscreenActive(windowDump) {
  return /mDreamingLockscreen=true|mShowingLockscreen=true|mKeyguardShowing=true/.test(windowDump);
}

function hasFatalLog(log) {
  return /FATAL EXCEPTION|AndroidRuntime|Uncaught|TypeError|ReferenceError/i.test(log);
}

function readPngSize(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

const report = {
  apk: apkPath,
  screenshot: screenshotPath,
  menuScreenshot: menuScreenshotPath,
  gameplayScreenshot: gameplayScreenshotPath,
  device: null,
  installed: false,
  launched: false,
  gameplayTapped: false,
  visualCapture: 'not-run',
  lockscreenActive: false,
  fatalLog: false,
  warnings: []
};

try {
  if (!fs.existsSync(apkPath)) {
    throw new Error(`Missing ${apkPath}. Build the release APK before device QA.`);
  }

  const devices = parseDevices(adb(['devices']));
  if (!devices.length) {
    throw new Error('No unlocked ADB device is connected.');
  }

  report.device = devices[0];
  adb(['install', '-r', apkPath]);
  report.installed = true;

  adb(['shell', 'am', 'force-stop', packageName]);
  const clearLog = tryAdb(['logcat', '-c']);
  if (!clearLog.ok) report.warnings.push('Unable to clear logcat before launch; checking recent logs after launch.');
  adb(['shell', 'monkey', '-p', packageName, '-c', 'android.intent.category.LAUNCHER', '1']);
  report.launched = true;

  execFileSync('powershell', ['-NoProfile', '-Command', 'Start-Sleep -Seconds 3'], { stdio: 'ignore' });

  const activityDump = adb(['shell', 'dumpsys', 'activity', 'activities']);
  const windowDump = adb(['shell', 'dumpsys', 'window']);
  report.lockscreenActive = isLockscreenActive(windowDump);
  report.foregroundActivity = /ResumedActivity:.*com\.unexpectedgame\.unxpected/.test(activityDump);

  adb(['shell', 'screencap', '-p', '/sdcard/unxpected_latest.png']);
  adb(['pull', '/sdcard/unxpected_latest.png', screenshotPath]);
  adb(['pull', '/sdcard/unxpected_latest.png', menuScreenshotPath]);
  report.visualCapture = report.lockscreenActive ? 'blocked-by-secure-lockscreen' : 'captured';

  if (!report.lockscreenActive) {
    const menuSize = readPngSize(menuScreenshotPath);
    const tapX = menuSize ? Math.round(menuSize.width * 0.603) : 1410;
    const tapY = menuSize ? Math.round(menuSize.height * 0.194) : 210;
    adb(['shell', 'input', 'tap', String(tapX), String(tapY)]);
    report.gameplayTapped = true;
    execFileSync('powershell', ['-NoProfile', '-Command', 'Start-Sleep -Seconds 3'], { stdio: 'ignore' });
    adb(['shell', 'screencap', '-p', '/sdcard/unxpected_gameplay.png']);
    adb(['pull', '/sdcard/unxpected_gameplay.png', gameplayScreenshotPath]);
  }

  const log = tryAdb(['logcat', '-d', '-t', '700']);
  if (log.ok) {
    report.fatalLog = hasFatalLog(log.output);
  } else {
    report.warnings.push('Unable to read logcat after launch.');
  }

  console.log(JSON.stringify(report, null, 2));
  if (report.fatalLog || !report.foregroundActivity) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ ...report, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
}
