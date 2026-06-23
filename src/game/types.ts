export type PlayerProfile = 'Balanced' | 'Speedrunner' | 'Panicked' | 'Safe-Zoner' | 'Methodical';
export type MenuMode = 'standard' | 'training' | 'daily';
export type SkinId = 'neon' | 'signal' | 'void' | 'paradox';
export type TrailId = 'ion' | 'data' | 'warning' | 'paradox';
export type DeathEffectId = 'glitch' | 'fracture' | 'static' | 'nova';
export type PortalEffectId = 'clean' | 'daily' | 'singularity' | 'paradox';
export type LevelThemeId =
  | 'neon_city'
  | 'overgrown_ruins'
  | 'ember_forge'
  | 'frost_lab'
  | 'solar_ruins'
  | 'void_tide'
  | 'signal_metro'
  | 'crystal_cave'
  | 'storm_rig'
  | 'paradox_core';
export type RouteArchetypeId =
  | 'core_run'
  | 'sky_ladder'
  | 'tunnel_cut'
  | 'collapse_bridge'
  | 'crossfire_gap'
  | 'hunter_lane'
  | 'vertical_gate'
  | 'split_path'
  | 'weapon_arena';
export type TrapFamily =
  | 'bottom_bullet'
  | 'collapse'
  | 'crusher'
  | 'fake_safe'
  | 'falling_object'
  | 'hunter'
  | 'portal_trap'
  | 'rebuild_floor'
  | 'rolling_rock'
  | 'weapon';

export interface LevelTheme {
  accent: string;
  accent2: string;
  danger: string;
  far: string;
  foreground: string;
  groundTint: string;
  id: LevelThemeId;
  label: string;
  mid: string;
  shadowTint: string;
  shortLabel: string;
  skyBottom: string;
  skyTop: string;
}

export interface RouteArchetype {
  id: RouteArchetypeId;
  label: string;
  signature: string;
}

export interface AudioProfile {
  bassFrequency: number;
  filterBase: number;
  filterRange: number;
  id: string;
  label: string;
  masterGain: number;
  noiseTone: 'clean' | 'warm' | 'cold' | 'metal' | 'void' | 'storm';
  pulseFrequency: number;
  pulseIntervalMs: number;
  shimmerFrequency: number;
}

export interface TrapSpec {
  family: TrapFamily;
  id: string;
  telegraphMs: number;
  warning: string;
}

export interface ChapterDefinition {
  audioProfile: AudioProfile;
  id: string;
  label: string;
  levelEnd: number;
  levelStart: number;
  motif: string;
  theme: LevelTheme;
  trapStyle: string;
}

export interface LevelBlueprint {
  blueprintIndex: number;
  chapterId: string;
  difficulty: number;
  id: string;
  label: string;
  levelIndex: number;
  routeArchetype: RouteArchetype;
  routeSignature: string;
  trapSpecs: TrapSpec[];
}

export interface CosmeticLoadout {
  skin: SkinId;
  trail: TrailId;
  deathEffect: DeathEffectId;
  portalEffect: PortalEffectId;
}

export interface AccessibilitySettings {
  audioEnabled: boolean;
  colorSafeWarnings: boolean;
  reducedMotion: boolean;
  uiScale: 'compact' | 'standard' | 'large';
}

export interface DailyAnomaly {
  dateKey: string;
  label: string;
  modifier: 'coin_betrayal' | 'gravity_drift' | 'pressure_plate' | 'mirror_wall';
  seed: number;
  subtitle: string;
}

export type BaseEntityType =
  | 'platform'
  | 'hazard'
  | 'collectible'
  | 'checkpoint'
  | 'goal'
  | 'decor'
  | 'player';

export type CollisionMask =
  | 'solid'
  | 'pass_through'
  | 'lethal_hazard'
  | 'trigger_pickup'
  | 'checkpoint'
  | 'goal'
  | 'sensor';

export type RenderLayer =
  | 'visual_neon_block'
  | 'visual_grass_block'
  | 'visual_warning_block'
  | 'visual_shadow_block'
  | 'visual_glitch_block'
  | 'visual_gold_coin'
  | 'visual_corrupt_coin'
  | 'visual_projectile'
  | 'visual_weapon_cache'
  | 'visual_rock'
  | 'visual_hunter'
  | 'visual_spike'
  | 'visual_portal'
  | 'visual_checkpoint'
  | 'transparent';

export type MutationAction =
  | 'semantic_scramble'
  | 'physics_gaslight'
  | 'input_redirection'
  | 'platform_phase'
  | 'floor_collapse'
  | 'weapon_fire'
  | 'sky_strike'
  | 'rolling_rock'
  | 'hunter_spawn'
  | 'elevator_crush'
  | 'mercy_bridge';

export type TriggerCondition =
  | 'player_distance_less_than'
  | 'player_input_active'
  | 'player_stationary_for_ms'
  | 'player_velocity_greater_than'
  | 'time_elapsed_ms'
  | 'profile_detected';

export interface Vector2 {
  x: number;
  y: number;
}

export interface Transform {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MutatedEntityState {
  render_layer?: RenderLayer;
  collision_mask?: CollisionMask;
  velocity?: Vector2;
  transform?: Partial<Transform>;
  alpha?: number;
  gravity_vector?: Vector2;
  friction_multiplier?: number;
  input_hijack?: InputHijackState;
}

export interface MutationEvent {
  trigger_condition: TriggerCondition;
  condition_value: number | string | PlayerProfile;
  action: MutationAction;
  mutated_state: MutatedEntityState;
  hint: string;
  once: boolean;
  telegraph_ms: number;
  active_profiles?: PlayerProfile[];
}

export interface EntitySchema {
  entity_id: string;
  base_type: BaseEntityType;
  behavior?: 'none' | 'rebuild_floor' | 'flicker_floor' | 'rolling_hazard' | 'sky_fall' | 'hunter_chase' | 'weapon_pickup';
  transform: Transform;
  render_layer: RenderLayer;
  collision_mask: CollisionMask;
  mutation_event: MutationEvent | null;
}

export interface InputHijackState {
  active: boolean;
  mapping: Partial<Record<'jump_button' | 'move_left' | 'move_right' | 'action_dash', string>>;
  ui_spoofing?: {
    trigger_fake_popup: 'paradox_config' | 'trust_warning' | 'level_complete';
    delay_ms: number;
  };
  expires_at_ms?: number;
}

export interface DynamicLevelSchema {
  audioProfile: AudioProfile;
  blueprintId: string;
  chapterId: string;
  chapterTheme: LevelTheme;
  session_id: string;
  tick_sequence: number;
  theme: LevelTheme;
  route_archetype: RouteArchetype;
  routeSignature: string;
  global_environment: {
    gravity_vector: Vector2;
    friction_multiplier: number;
    camera_lock: boolean;
  };
  input_hijack: InputHijackState;
  entities: EntitySchema[];
}

export interface ActionState {
  left: boolean;
  right: boolean;
  jump: boolean;
  dash: boolean;
  down: boolean;
}

export interface TelemetrySample {
  timeMs: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  actions: ActionState;
  checkpointIndex: number;
  deaths: number;
}

export interface TelemetryBatch {
  startedAtMs: number;
  endedAtMs: number;
  samples: TelemetrySample[];
  jumpPresses: number;
  dashPresses: number;
  inputSwitches: number;
  stationaryMs: number;
  maxSpeed: number;
  averageSpeed: number;
  deaths: number;
}

export interface DirectorDecision {
  profile: PlayerProfile;
  notice: string;
  trust: number;
  inputHijack: InputHijackState;
  environment: DynamicLevelSchema['global_environment'];
  mutationBias: MutationAction[];
  logEntries: string[];
}

export interface HudSnapshot {
  coins: number;
  dashReadyPercent: number;
  durationText: string;
  levelIndex: number;
  modeLabel: string;
  profile: PlayerProfile;
  deaths: number;
  score: number;
  totalCoins: number;
  trust: number;
  notice: string;
  mutations: string[];
  weaponCharges: number;
  weaponReady: boolean;
}

export interface TutorialSnapshot {
  active: boolean;
  body: string;
  skippable: boolean;
  objective: string;
  progress: number;
  step: number;
  title: string;
  tone: 'info' | 'success' | 'warning';
  total: number;
}

export type RunGrade = 'C' | 'B' | 'A' | 'S' | 'Paradox';

export interface RunMissionResult {
  description: string;
  id: 'clean_route' | 'full_sweep' | 'mutation_reader' | 'trust_retained';
  label: string;
  progress: string;
  achieved: boolean;
}

export interface RunSummary {
  dailyAnomaly?: DailyAnomaly;
  durationMs: number;
  durationText: string;
  deaths: number;
  levelIndex: number;
  coins: number;
  totalCoins: number;
  mutationsSurvived: number;
  trustPercent: number;
  score: number;
  grade: RunGrade;
  bestScore: number;
  personalBest: boolean;
  mode: MenuMode;
  missions: RunMissionResult[];
  recap: string[];
}

export interface LeaderboardEntry {
  coins: number;
  dailyDateKey?: string;
  deaths: number;
  durationMs: number;
  durationText: string;
  grade: RunGrade;
  id: string;
  levelIndex: number;
  mode: MenuMode;
  mutationsSurvived: number;
  playerName: string;
  playedAt: string;
  score: number;
  trustPercent: number;
}

export interface ProgressionUnlock {
  description: string;
  label: string;
}

export interface ProgressionResult {
  campaignHighestUnlocked: number;
  campaignUnlockedLevel: number | null;
  dailyCompleted: boolean;
  dailyStreak: number;
  leaderboardRank: number | null;
  leaderboard: LeaderboardEntry[];
  latestEntry: LeaderboardEntry;
  unlocked: ProgressionUnlock[];
  xpEarned: number;
  totalXp: number;
}
