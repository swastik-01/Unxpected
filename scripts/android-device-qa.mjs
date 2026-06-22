import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const packageName = 'com.unexpectedgame.unxpected';
const apkPath = path.resolve('Unxpected-release.apk');
const outDir = path.resolve('qa-artifacts');
const screenshotPath = path.join(outDir, 'device-latest.png');

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

function parseDevices(output) {
  return output
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter(([id, state]) => id && state === 'device')
    .map(([id]) => id);
}

function isLockscreenActive(windowDump) {
  return /mDreamingLockscreen=true|mShowingLockscreen=true|NotificationShade/.test(windowDump);
}

function hasFatalLog(log) {
  return /FATAL EXCEPTION|AndroidRuntime|Uncaught|TypeError|ReferenceError/i.test(log);
}

const report = {
  apk: apkPath,
  screenshot: screenshotPath,
  device: null,
  installed: false,
  launched: false,
  visualCapture: 'not-run',
  lockscreenActive: false,
  fatalLog: false
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
  adb(['logcat', '-c']);
  adb(['shell', 'monkey', '-p', packageName, '-c', 'android.intent.category.LAUNCHER', '1']);
  report.launched = true;

  execFileSync('powershell', ['-NoProfile', '-Command', 'Start-Sleep -Seconds 3'], { stdio: 'ignore' });

  const activityDump = adb(['shell', 'dumpsys', 'activity', 'activities']);
  const windowDump = adb(['shell', 'dumpsys', 'window']);
  report.lockscreenActive = isLockscreenActive(windowDump);
  report.foregroundActivity = /ResumedActivity:.*com\.unexpectedgame\.unxpected/.test(activityDump);

  adb(['shell', 'screencap', '-p', '/sdcard/unxpected_latest.png']);
  adb(['pull', '/sdcard/unxpected_latest.png', screenshotPath]);
  report.visualCapture = report.lockscreenActive ? 'blocked-by-secure-lockscreen' : 'captured';

  const log = adb(['logcat', '-d', '-t', '700']);
  report.fatalLog = hasFatalLog(log);

  console.log(JSON.stringify(report, null, 2));
  if (report.fatalLog || !report.foregroundActivity) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ ...report, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
}
