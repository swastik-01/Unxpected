import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

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
  gameplayVisual: 'not-run',
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
    const tapY = menuSize ? Math.round(menuSize.height * 0.28) : 302;
    adb(['shell', 'input', 'tap', String(tapX), String(tapY)]);
    report.gameplayTapped = true;
    execFileSync('powershell', ['-NoProfile', '-Command', 'Start-Sleep -Seconds 3'], { stdio: 'ignore' });
    adb(['shell', 'screencap', '-p', '/sdcard/unxpected_gameplay.png']);
    adb(['pull', '/sdcard/unxpected_gameplay.png', gameplayScreenshotPath]);
    report.gameplayVisual = looksLikeGameplayScreen(gameplayScreenshotPath) ? 'gameplay-detected' : 'menu-or-blank-detected';
  }

  const log = tryAdb(['logcat', '-d', '-t', '700']);
  if (log.ok) {
    report.fatalLog = hasFatalLog(log.output);
  } else {
    report.warnings.push('Unable to read logcat after launch.');
  }

  console.log(JSON.stringify(report, null, 2));
  if (report.fatalLog || !report.foregroundActivity || report.gameplayVisual === 'menu-or-blank-detected') process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ ...report, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
}

function looksLikeGameplayScreen(filePath) {
  const png = decodePngRgba(filePath);
  if (!png) return false;

  let neonGameplayPixels = 0;
  const startY = Math.floor(png.height * 0.48);
  for (let y = startY; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const index = (y * png.width + x) * 4;
      const red = png.data[index];
      const green = png.data[index + 1];
      const blue = png.data[index + 2];
      const alpha = png.data[index + 3];
      if (alpha > 180 && green > 125 && green > red * 1.45 && blue > 60 && blue < 230) {
        neonGameplayPixels += 1;
      }
    }
  }
  return neonGameplayPixels > png.width * 2;
}

function decodePngRgba(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 33 || buffer.toString('ascii', 1, 4) !== 'PNG') return null;

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const chunks = [];

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buffer.length) return null;

    if (type === 'IHDR') {
      width = buffer.readUInt32BE(dataStart);
      height = buffer.readUInt32BE(dataStart + 4);
      bitDepth = buffer[dataStart + 8];
      colorType = buffer[dataStart + 9];
    } else if (type === 'IDAT') {
      chunks.push(buffer.subarray(dataStart, dataEnd));
    } else if (type === 'IEND') {
      break;
    }
    offset = dataEnd + 4;
  }

  if (!width || !height || bitDepth !== 8 || colorType !== 6 || !chunks.length) return null;

  const inflated = zlib.inflateSync(Buffer.concat(chunks));
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const output = Buffer.alloc(height * stride);
  let inputOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset];
    inputOffset += 1;
    const row = inflated.subarray(inputOffset, inputOffset + stride);
    const previousRow = y > 0 ? output.subarray((y - 1) * stride, y * stride) : null;
    const outputRow = output.subarray(y * stride, (y + 1) * stride);

    for (let x = 0; x < stride; x += 1) {
      const left = x >= bytesPerPixel ? outputRow[x - bytesPerPixel] : 0;
      const up = previousRow ? previousRow[x] : 0;
      const upLeft = previousRow && x >= bytesPerPixel ? previousRow[x - bytesPerPixel] : 0;
      let value = row[x];

      if (filter === 1) value = (value + left) & 0xff;
      else if (filter === 2) value = (value + up) & 0xff;
      else if (filter === 3) value = (value + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) value = (value + paeth(left, up, upLeft)) & 0xff;
      else if (filter !== 0) return null;

      outputRow[x] = value;
    }
    inputOffset += stride;
  }

  return { width, height, data: output };
}

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  return upDistance <= upLeftDistance ? up : upLeft;
}
