import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const workspace = path.resolve('.');
const androidDir = path.join(workspace, 'android');
const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';
const gradleCmd = isWindows ? 'gradlew.bat' : './gradlew';

const javaHome = findJavaHome();
const buildEnv = {
  ...process.env,
  JAVA_HOME: javaHome,
  Path: `${path.join(javaHome, 'bin')}${path.delimiter}${process.env.Path ?? process.env.PATH ?? ''}`,
  PATH: `${path.join(javaHome, 'bin')}${path.delimiter}${process.env.PATH ?? process.env.Path ?? ''}`
};

run(npmCmd, ['run', 'build'], { cwd: workspace });
run(npxCmd, ['cap', 'sync', 'android'], { cwd: workspace });
run(path.join(androidDir, gradleCmd), [':app:assembleDebug', ':app:assembleRelease', ':app:bundleRelease'], {
  cwd: androidDir,
  env: buildEnv
});

const artifacts = [
  copyArtifact('android/app/build/outputs/apk/debug/app-debug.apk', 'Unxpected-debug.apk'),
  copyArtifact('android/app/build/outputs/apk/release/app-release.apk', 'Unxpected-release.apk'),
  copyArtifact('android/app/build/outputs/bundle/release/app-release.aab', 'Unxpected-release.aab')
];

const apksigner = findApkSigner();
if (apksigner) {
  run(apksigner, ['verify', '--verbose', path.join(workspace, 'Unxpected-release.apk')], {
    cwd: workspace,
    env: buildEnv
  });
} else {
  console.warn('apksigner not found; skipped APK signature verification.');
}

console.log(JSON.stringify({ javaHome, artifacts }, null, 2));

function run(command, args, options = {}) {
  console.log(`> ${[command, ...args].join(' ')}`);
  const isBatchCommand = isWindows && /\.(bat|cmd)$/i.test(command);
  const result = isBatchCommand
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', windowsCommandLine(command, args)], {
        stdio: 'inherit',
        ...options
      })
    : spawnSync(command, args, { stdio: 'inherit', shell: false, ...options });
  if (result.status !== 0) {
    const detail = result.error ? `: ${result.error.message}` : '';
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}${detail}`);
  }
}

function windowsCommandLine(command, args) {
  return [command, ...args].map(windowsQuote).join(' ');
}

function windowsQuote(value) {
  if (!/[()\s^&|<>"]/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

function copyArtifact(from, to) {
  const source = path.join(workspace, from);
  const destination = path.join(workspace, to);
  fs.copyFileSync(source, destination);
  const stat = fs.statSync(destination);
  return { file: to, bytes: stat.size };
}

function findJavaHome() {
  const candidates = discoverJavaHomes();
  const selected = candidates.find((candidate) => javaMajor(candidate) >= 21);
  if (!selected) {
    throw new Error('JDK 21+ is required. Install JDK 21 or set JAVA_HOME to a JDK 21 installation.');
  }
  return selected;
}

function discoverJavaHomes() {
  const found = new Set();
  addIfDirectory(found, process.env.JAVA_HOME);

  const roots = [
    path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Microsoft'),
    path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Java'),
    path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Eclipse Adoptium')
  ];

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const child of fs.readdirSync(root, { withFileTypes: true })) {
      if (!child.isDirectory()) continue;
      if (/jdk-?\d+/i.test(child.name)) addIfDirectory(found, path.join(root, child.name));
    }
  }

  return [...found].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
}

function addIfDirectory(set, value) {
  if (value && fs.existsSync(value) && fs.statSync(value).isDirectory()) set.add(value);
}

function javaMajor(home) {
  const java = path.join(home, 'bin', isWindows ? 'java.exe' : 'java');
  if (!fs.existsSync(java)) return 0;
  const result = spawnSync(java, ['-version'], { encoding: 'utf8' });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const match = output.match(/version "(\d+)/) ?? output.match(/openjdk (\d+)/i);
  return match ? Number(match[1]) : 0;
}

function findApkSigner() {
  const sdkRoots = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    'D:\\Android\\sdk',
    path.join(process.env.LOCALAPPDATA ?? '', 'Android', 'sdk')
  ].filter(Boolean);

  const candidates = [];
  for (const sdkRoot of sdkRoots) {
    const buildTools = path.join(sdkRoot, 'build-tools');
    if (!fs.existsSync(buildTools)) continue;
    for (const version of fs.readdirSync(buildTools, { withFileTypes: true })) {
      if (!version.isDirectory()) continue;
      const signer = path.join(buildTools, version.name, isWindows ? 'apksigner.bat' : 'apksigner');
      if (fs.existsSync(signer)) candidates.push(signer);
    }
  }

  return candidates.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0] ?? null;
}
