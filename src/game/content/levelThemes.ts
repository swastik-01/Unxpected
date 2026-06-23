import type {
  AudioProfile,
  ChapterDefinition,
  LevelBlueprint,
  LevelTheme,
  LevelThemeId,
  RouteArchetype,
  RouteArchetypeId,
  TrapFamily
} from '../types';

const campaignLevelCount = 99;

export const levelThemes: LevelTheme[] = [
  {
    id: 'neon_city',
    label: 'Neon City',
    shortLabel: 'Neon',
    skyTop: '#070914',
    skyBottom: '#101a2c',
    far: '#12213a',
    mid: '#173354',
    foreground: '#45d7ff',
    accent: '#45d7ff',
    accent2: '#58f0a7',
    danger: '#ff4f6d',
    groundTint: '#58f0a7',
    shadowTint: '#9ca8bd'
  },
  {
    id: 'overgrown_ruins',
    label: 'Overgrown Ruins',
    shortLabel: 'Ruins',
    skyTop: '#06120f',
    skyBottom: '#16281b',
    far: '#1c3a2a',
    mid: '#27513a',
    foreground: '#92f06f',
    accent: '#92f06f',
    accent2: '#ffd166',
    danger: '#ff6b57',
    groundTint: '#8ee86f',
    shadowTint: '#6e8f75'
  },
  {
    id: 'ember_forge',
    label: 'Ember Forge',
    shortLabel: 'Forge',
    skyTop: '#120708',
    skyBottom: '#261116',
    far: '#3a1c19',
    mid: '#5b2b22',
    foreground: '#ff9f43',
    accent: '#ff9f43',
    accent2: '#ffd166',
    danger: '#ff4f6d',
    groundTint: '#ff9f43',
    shadowTint: '#b45f4d'
  },
  {
    id: 'frost_lab',
    label: 'Frost Lab',
    shortLabel: 'Frost',
    skyTop: '#071018',
    skyBottom: '#122536',
    far: '#1b4057',
    mid: '#2b5f78',
    foreground: '#9de8ff',
    accent: '#9de8ff',
    accent2: '#d8ffe8',
    danger: '#ff7090',
    groundTint: '#9de8ff',
    shadowTint: '#7fa8bd'
  },
  {
    id: 'solar_ruins',
    label: 'Solar Ruins',
    shortLabel: 'Solar',
    skyTop: '#0f0b07',
    skyBottom: '#28200e',
    far: '#4a3715',
    mid: '#6d4d1c',
    foreground: '#ffd166',
    accent: '#ffd166',
    accent2: '#58f0a7',
    danger: '#ff4f6d',
    groundTint: '#ffd166',
    shadowTint: '#b69a57'
  },
  {
    id: 'void_tide',
    label: 'Void Tide',
    shortLabel: 'Void',
    skyTop: '#080716',
    skyBottom: '#16102d',
    far: '#241a4a',
    mid: '#342466',
    foreground: '#d46cff',
    accent: '#d46cff',
    accent2: '#45d7ff',
    danger: '#ff4f9a',
    groundTint: '#d46cff',
    shadowTint: '#9180c7'
  },
  {
    id: 'signal_metro',
    label: 'Signal Metro',
    shortLabel: 'Metro',
    skyTop: '#080b10',
    skyBottom: '#151923',
    far: '#202837',
    mid: '#2b3546',
    foreground: '#ff4f6d',
    accent: '#ff4f6d',
    accent2: '#45d7ff',
    danger: '#ffd166',
    groundTint: '#ff6b82',
    shadowTint: '#8993a8'
  },
  {
    id: 'crystal_cave',
    label: 'Crystal Cave',
    shortLabel: 'Cave',
    skyTop: '#061013',
    skyBottom: '#10262c',
    far: '#143c42',
    mid: '#1d555d',
    foreground: '#58f0e0',
    accent: '#58f0e0',
    accent2: '#d46cff',
    danger: '#ff4f6d',
    groundTint: '#58f0e0',
    shadowTint: '#78a9ad'
  },
  {
    id: 'storm_rig',
    label: 'Storm Rig',
    shortLabel: 'Storm',
    skyTop: '#070b13',
    skyBottom: '#121b2b',
    far: '#1c2940',
    mid: '#283b59',
    foreground: '#8fb7ff',
    accent: '#8fb7ff',
    accent2: '#ffd166',
    danger: '#ff4f6d',
    groundTint: '#8fb7ff',
    shadowTint: '#7789a8'
  },
  {
    id: 'paradox_core',
    label: 'Paradox Core',
    shortLabel: 'Paradox',
    skyTop: '#090511',
    skyBottom: '#1d0d21',
    far: '#32173b',
    mid: '#4a1f52',
    foreground: '#ff7ab6',
    accent: '#ff7ab6',
    accent2: '#58f0e0',
    danger: '#ff355f',
    groundTint: '#ff7ab6',
    shadowTint: '#b88ad2'
  }
];

export const audioProfiles: AudioProfile[] = [
  { id: 'neon_pulse', label: 'Neon Pulse', bassFrequency: 55, shimmerFrequency: 165, pulseFrequency: 880, pulseIntervalMs: 3450, filterBase: 420, filterRange: 980, masterGain: 0.034, noiseTone: 'clean' },
  { id: 'ruin_breath', label: 'Ruin Breath', bassFrequency: 49, shimmerFrequency: 147, pulseFrequency: 620, pulseIntervalMs: 4100, filterBase: 360, filterRange: 740, masterGain: 0.03, noiseTone: 'warm' },
  { id: 'forge_heat', label: 'Forge Heat', bassFrequency: 62, shimmerFrequency: 124, pulseFrequency: 520, pulseIntervalMs: 2900, filterBase: 500, filterRange: 1020, masterGain: 0.036, noiseTone: 'metal' },
  { id: 'frost_signal', label: 'Frost Signal', bassFrequency: 44, shimmerFrequency: 198, pulseFrequency: 990, pulseIntervalMs: 3820, filterBase: 330, filterRange: 880, masterGain: 0.028, noiseTone: 'cold' },
  { id: 'solar_choir', label: 'Solar Choir', bassFrequency: 58, shimmerFrequency: 174, pulseFrequency: 740, pulseIntervalMs: 3200, filterBase: 470, filterRange: 940, masterGain: 0.032, noiseTone: 'warm' },
  { id: 'void_tide', label: 'Void Tide', bassFrequency: 41, shimmerFrequency: 123, pulseFrequency: 430, pulseIntervalMs: 4400, filterBase: 300, filterRange: 760, masterGain: 0.031, noiseTone: 'void' },
  { id: 'metro_alarm', label: 'Metro Alarm', bassFrequency: 57, shimmerFrequency: 228, pulseFrequency: 1180, pulseIntervalMs: 2600, filterBase: 520, filterRange: 1080, masterGain: 0.034, noiseTone: 'metal' },
  { id: 'crystal_hum', label: 'Crystal Hum', bassFrequency: 52, shimmerFrequency: 208, pulseFrequency: 1040, pulseIntervalMs: 3650, filterBase: 390, filterRange: 900, masterGain: 0.029, noiseTone: 'cold' },
  { id: 'storm_engine', label: 'Storm Engine', bassFrequency: 48, shimmerFrequency: 144, pulseFrequency: 690, pulseIntervalMs: 3100, filterBase: 430, filterRange: 1120, masterGain: 0.035, noiseTone: 'storm' },
  { id: 'paradox_alarm', label: 'Paradox Alarm', bassFrequency: 38, shimmerFrequency: 190, pulseFrequency: 1330, pulseIntervalMs: 2200, filterBase: 560, filterRange: 1300, masterGain: 0.038, noiseTone: 'void' }
];

export const routeArchetypes: RouteArchetype[] = [
  {
    id: 'core_run',
    label: 'Core Run',
    signature: 'classic collapses, phasing platforms, and route reads'
  },
  {
    id: 'sky_ladder',
    label: 'Sky Ladder',
    signature: 'stair-step air platforms that change vertical rhythm'
  },
  {
    id: 'tunnel_cut',
    label: 'Tunnel Cut',
    signature: 'low ceiling tunnel pieces and tighter jump windows'
  },
  {
    id: 'collapse_bridge',
    label: 'Collapse Bridge',
    signature: 'multiple breakable and rebuilding plates around the main route'
  },
  {
    id: 'crossfire_gap',
    label: 'Crossfire Gap',
    signature: 'timed shots and gap pressure with safe landings'
  },
  {
    id: 'hunter_lane',
    label: 'Hunter Lane',
    signature: 'AI hunter pressure that forces forward movement'
  },
  {
    id: 'vertical_gate',
    label: 'Vertical Gate',
    signature: 'climb-and-drop route reads before the portal lane'
  },
  {
    id: 'split_path',
    label: 'Split Path',
    signature: 'upper and lower lanes with different trap reads'
  },
  {
    id: 'weapon_arena',
    label: 'Weapon Arena',
    signature: 'late-game blaster pickups, guards, and portal crossfire'
  }
];

export const chapterDefinitions: ChapterDefinition[] = [
  chapter('chapter_01_neon', 'Neon City', 1, 10, 'neon_city', 'neon_pulse', 'wide onboarding lanes', 'readable collapse plates and first AI tells'),
  chapter('chapter_02_ruins', 'Overgrown Ruins', 11, 20, 'overgrown_ruins', 'ruin_breath', 'broken garden terraces', 'rebuilding floors, hunter shadows, and split paths'),
  chapter('chapter_03_forge', 'Ember Forge', 21, 30, 'ember_forge', 'forge_heat', 'hot bridgework', 'falling debris, early bottom shots, and rolling rocks'),
  chapter('chapter_04_frost', 'Frost Lab', 31, 40, 'frost_lab', 'frost_signal', 'cold vertical labs', 'sky drops, crushers, and tighter tunnels'),
  chapter('chapter_05_solar', 'Solar Ruins', 41, 50, 'solar_ruins', 'solar_choir', 'sunken switchbacks', 'crossfire gaps and fake-safe coins'),
  chapter('chapter_06_void', 'Void Tide', 51, 60, 'void_tide', 'void_tide', 'unstable gravity shelves', 'gravity drift, hunters, and reappearing bridges'),
  chapter('chapter_07_metro', 'Signal Metro', 61, 70, 'signal_metro', 'metro_alarm', 'railgun corridors', 'weapon pickups, tunnel guards, and bottom fire'),
  chapter('chapter_08_cave', 'Crystal Cave', 71, 80, 'crystal_cave', 'crystal_hum', 'crystal climbs', 'stacked vertical gates and crossfire ladders'),
  chapter('chapter_09_storm', 'Storm Rig', 81, 90, 'storm_rig', 'storm_engine', 'storm-platform machinery', 'double hunters, crusher timing, and moving pressure'),
  chapter('chapter_10_paradox', 'Paradox Core', 91, 99, 'paradox_core', 'paradox_alarm', 'final anomaly routes', 'combined traps, portal ambushes, and weapon pressure')
];

interface BlueprintPattern {
  label: string;
  routeId: RouteArchetypeId;
  signature: string;
  traps: TrapFamily[];
}

const blueprintPattern: BlueprintPattern[] = [
  { routeId: 'core_run', label: 'Signal Walk', signature: 'flat route with one readable warning plate', traps: ['collapse'] },
  { routeId: 'sky_ladder', label: 'Sky Climb', signature: 'safe ladder steps over the main route', traps: ['falling_object'] },
  { routeId: 'tunnel_cut', label: 'Tunnel Mouth', signature: 'low ceiling control with a wider landing', traps: ['fake_safe'] },
  { routeId: 'hunter_lane', label: 'Hunter Wake', signature: 'forward pressure without blocking the route', traps: ['hunter'] },
  { routeId: 'collapse_bridge', label: 'Rebuild Bridge', signature: 'timed floor disappearance and return', traps: ['collapse', 'rebuild_floor'] },
  { routeId: 'split_path', label: 'Split Choice', signature: 'upper coin route and lower fast route', traps: ['fake_safe', 'falling_object'] },
  { routeId: 'vertical_gate', label: 'Vertical Gate', signature: 'climb, drop, and recover before portal pressure', traps: ['crusher'] },
  { routeId: 'crossfire_gap', label: 'Crossfire Gap', signature: 'bottom fire between safe landings', traps: ['bottom_bullet'] },
  { routeId: 'collapse_bridge', label: 'Flicker Span', signature: 'bridge flickers, rebuilds, then re-arms later', traps: ['collapse', 'rebuild_floor', 'portal_trap'] },
  { routeId: 'weapon_arena', label: 'Gate Arena', signature: 'late-game combat lane with portal-area final trap', traps: ['weapon', 'hunter', 'portal_trap'] }
];

export function chapterForLevel(levelIndex: number) {
  const clamped = clampLevel(levelIndex);
  const chapter = chapterDefinitions.find((candidate) => clamped >= candidate.levelStart && clamped <= candidate.levelEnd);
  if (!chapter) return chapterDefinitions[chapterDefinitions.length - 1]!;
  return chapter;
}

export function blueprintForLevel(levelIndex: number, dailySeed?: number): LevelBlueprint {
  const clamped = clampLevel(levelIndex);
  const chapter = chapterForLevel(clamped);
  const localIndex = clamped - chapter.levelStart + 1;
  const dailyOffset = dailySeed === undefined ? 0 : Math.abs(dailySeed) % blueprintPattern.length;
  const patternIndex = clamped === campaignLevelCount
    ? blueprintPattern.length - 1
    : (localIndex - 1 + dailyOffset) % blueprintPattern.length;
  const pattern = blueprintPattern[patternIndex]!;
  const routeArchetype = routeById(pattern.routeId);
  const difficulty = Number((0.08 + ((clamped - 1) / (campaignLevelCount - 1)) * 0.92).toFixed(3));
  const id = `L${String(clamped).padStart(2, '0')}_${chapter.id}_${pattern.routeId}_${localIndex}`;

  return {
    blueprintIndex: localIndex,
    chapterId: chapter.id,
    difficulty,
    id,
    label: `${chapter.label} ${pattern.label}`,
    levelIndex: clamped,
    routeArchetype,
    routeSignature: [
      chapter.id,
      chapter.motif,
      routeArchetype.id,
      pattern.signature,
      `difficulty:${difficulty.toFixed(3)}`,
      `traps:${pattern.traps.join(',')}`
    ].join('|'),
    trapSpecs: createTrapSpecs(id, pattern.traps, chapter)
  };
}

export function themeForLevel(levelIndex: number, _dailySeed?: number) {
  return chapterForLevel(levelIndex).theme;
}

export function archetypeForLevel(levelIndex: number, dailySeed?: number) {
  return blueprintForLevel(levelIndex, dailySeed).routeArchetype;
}

function chapter(
  id: string,
  label: string,
  levelStart: number,
  levelEnd: number,
  themeId: LevelThemeId,
  audioProfileId: string,
  motif: string,
  trapStyle: string
): ChapterDefinition {
  return {
    audioProfile: audioProfileById(audioProfileId),
    id,
    label,
    levelEnd,
    levelStart,
    motif,
    theme: themeById(themeId),
    trapStyle
  };
}

function createTrapSpecs(blueprintId: string, traps: TrapFamily[], chapterDefinition: ChapterDefinition) {
  return traps.map((family, index) => ({
    family,
    id: `${blueprintId}_${family}_${index + 1}`,
    telegraphMs: family === 'bottom_bullet' || family === 'hunter' ? 560 : family === 'portal_trap' ? 640 : 720,
    warning: trapWarning(family, chapterDefinition)
  }));
}

function trapWarning(family: TrapFamily, chapter: ChapterDefinition) {
  switch (family) {
    case 'bottom_bullet':
      return `${chapter.theme.shortLabel} floor turret charging`;
    case 'collapse':
      return `${chapter.label} floor plate destabilizing`;
    case 'crusher':
      return `${chapter.label} vertical crusher armed`;
    case 'fake_safe':
      return `${chapter.label} safe marker may be false`;
    case 'falling_object':
      return `${chapter.label} overhead object falling`;
    case 'hunter':
      return `${chapter.label} hunter tracking player pace`;
    case 'portal_trap':
      return `${chapter.label} portal-area trap armed`;
    case 'rebuild_floor':
      return `${chapter.label} bridge will rebuild after collapse`;
    case 'rolling_rock':
      return `${chapter.label} rolling hazard released`;
    case 'weapon':
      return `${chapter.label} weapon gate available`;
    default:
      return `${chapter.label} trap armed`;
  }
}

function themeById(id: LevelThemeId) {
  const theme = levelThemes.find((candidate) => candidate.id === id);
  if (!theme) throw new Error(`Missing level theme ${id}`);
  return theme;
}

function audioProfileById(id: string) {
  const profile = audioProfiles.find((candidate) => candidate.id === id);
  if (!profile) throw new Error(`Missing audio profile ${id}`);
  return profile;
}

function routeById(id: RouteArchetypeId) {
  const route = routeArchetypes.find((candidate) => candidate.id === id);
  if (!route) throw new Error(`Missing route archetype ${id}`);
  return route;
}

function clampLevel(level: number) {
  return Math.max(1, Math.min(campaignLevelCount, Math.round(level)));
}
