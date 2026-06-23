import type { LevelTheme, RouteArchetype } from '../types';

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
  }
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
    signature: 'multiple breakable plates around the main route'
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
  }
];

export function themeForLevel(levelIndex: number, dailySeed?: number) {
  const themeIndex = dailySeed === undefined
    ? Math.max(0, levelIndex - 1) % levelThemes.length
    : Math.abs(dailySeed + levelIndex * 3) % levelThemes.length;
  return levelThemes[themeIndex];
}

export function archetypeForLevel(levelIndex: number, dailySeed?: number) {
  if (levelIndex <= 1 && dailySeed === undefined) return routeArchetypes[0];
  const offset = dailySeed === undefined ? levelIndex - 2 : dailySeed + levelIndex;
  return routeArchetypes[Math.abs(offset) % routeArchetypes.length];
}
