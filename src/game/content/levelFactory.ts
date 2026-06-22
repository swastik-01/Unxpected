import type { DailyAnomaly, DynamicLevelSchema, EntitySchema, MenuMode, PlayerProfile } from '../types';
import { maxCampaignLevel } from '../constants';

const platform = (
  entity_id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  overrides: Partial<EntitySchema> = {}
): EntitySchema => ({
  entity_id,
  base_type: 'platform',
  transform: { x, y, width, height },
  render_layer: 'visual_neon_block',
  collision_mask: 'solid',
  mutation_event: null,
  ...overrides
});

const hazard = (
  entity_id: string,
  x: number,
  y: number,
  width = 38,
  height = 38,
  overrides: Partial<EntitySchema> = {}
): EntitySchema => ({
  entity_id,
  base_type: 'hazard',
  transform: { x, y, width, height },
  render_layer: 'visual_spike',
  collision_mask: 'lethal_hazard',
  mutation_event: null,
  ...overrides
});

type CoinMutationMode = 'none' | 'safe_warning' | 'lethal';

const coin = (entity_id: string, x: number, y: number, mutationMode: CoinMutationMode = 'none'): EntitySchema => ({
  entity_id,
  base_type: 'collectible',
  transform: { x, y, width: 34, height: 34 },
  render_layer: 'visual_gold_coin',
  collision_mask: 'trigger_pickup',
  mutation_event: mutationMode !== 'none'
    ? {
        trigger_condition: 'player_distance_less_than',
        condition_value: 82,
        action: 'semantic_scramble',
        hint: mutationMode === 'safe_warning' ? 'Warning pulse marks an unstable pickup' : 'Trusted collectible became hostile',
        once: true,
        telegraph_ms: mutationMode === 'safe_warning' ? 520 : 220,
        active_profiles: ['Methodical', 'Balanced', 'Panicked'],
        mutated_state:
          mutationMode === 'safe_warning'
            ? {
                render_layer: 'visual_corrupt_coin',
                alpha: 0.94
              }
            : {
                render_layer: 'visual_corrupt_coin',
                collision_mask: 'lethal_hazard',
                velocity: { x: 0, y: 280 }
              }
      }
    : null
});

export function createOpeningLevel(mode: MenuMode, aggression: number, dailyAnomaly?: DailyAnomaly, levelIndex = 1): DynamicLevelSchema {
  const training = mode === 'training';
  const daily = mode === 'daily' ? dailyAnomaly : undefined;
  const campaignLevel = clampLevel(levelIndex);
  const levelPressure = mode === 'standard' ? Math.min(0.42, (campaignLevel - 1) / (maxCampaignLevel - 1) * 0.42) : 0;
  const runSeed = (dailyAnomaly?.seed ?? Math.round((Date.now() % 1_000_000) + Math.random() * 100_000)) + campaignLevel * 9973;
  const random = seededRandom(runSeed);
  const dailySeedBump = dailyAnomaly ? (dailyAnomaly.seed % 12) / 100 : 0;
  const trapScale = training ? 0.45 : daily ? 0.68 + dailySeedBump : Math.min(0.98, aggression + levelPressure);
  const pressureDelay = dailyAnomaly?.modifier === 'pressure_plate' ? 840 : training ? 1900 : 1040 + Math.round(random() * 520);
  const pressureProfiles: PlayerProfile[] = dailyAnomaly?.modifier === 'pressure_plate'
    ? ['Safe-Zoner', 'Balanced']
    : ['Safe-Zoner'];
  const phaseGate = dailyAnomaly?.modifier === 'gravity_drift' ? 260 : training ? 460 : 295 + Math.round(random() * 95);
  const collapseDistance = training ? 74 : 96 + Math.round(random() * 56 + levelPressure * 80);
  const collapseTelegraphMs = training ? 980 : 520 + Math.round((1 - Math.min(0.9, trapScale)) * 320);
  const projectileTelegraphMs = training ? 920 : 560 + Math.round(random() * 240);
  const projectileSpeed = training ? -330 : -(390 + Math.round(random() * 170 + trapScale * 80 + levelPressure * 90));
  const phaseState = dailyAnomaly?.modifier === 'gravity_drift'
    ? {
        collision_mask: 'pass_through' as const,
        alpha: 0.28,
        render_layer: 'visual_glitch_block' as const,
        gravity_vector: { x: -115, y: 980 }
      }
    : {
        collision_mask: 'pass_through' as const,
        alpha: 0.28,
        render_layer: 'visual_glitch_block' as const
      };
  const wallProfiles: PlayerProfile[] = dailyAnomaly?.modifier === 'mirror_wall'
    ? ['Panicked', 'Speedrunner', 'Balanced']
    : ['Panicked', 'Speedrunner'];
  const firstScramble = dailyAnomaly?.modifier === 'coin_betrayal'
    ? 'lethal'
    : trapScale > 0.35 ? (training ? 'safe_warning' : 'lethal') : 'none';
  const secondScramble = daily
    ? daily.modifier === 'coin_betrayal' ? 'lethal' : 'safe_warning'
    : trapScale > 0.55 ? 'lethal' : 'none';
  const bridgeProfile: PlayerProfile = dailyAnomaly?.modifier === 'pressure_plate' ? 'Balanced' : 'Methodical';
  const campaignVariants = createCampaignVariants(campaignLevel, training, daily, random, trapScale, levelPressure);

  const entities: EntitySchema[] = [
    platform('ground_00', 0, 650, 720, 70, { render_layer: 'visual_grass_block' }),
    platform('ground_01', 730, 650, 340, 70, { render_layer: 'visual_grass_block' }),
    platform('wait_lift_01', 1120, 580, 220, 38, {
      render_layer: 'visual_shadow_block',
      mutation_event: {
        trigger_condition: 'player_stationary_for_ms',
        condition_value: pressureDelay,
        action: 'elevator_crush',
        hint: dailyAnomaly?.modifier === 'pressure_plate' ? 'Daily pressure plate armed early' : 'Safe-zone pressure plate armed',
        once: true,
        telegraph_ms: 450,
        active_profiles: pressureProfiles,
        mutated_state: {
          render_layer: 'visual_warning_block',
          velocity: { x: 0, y: -250 }
        }
      }
    }),
    platform('collapse_01', 1400, 650, 300, 70, {
      render_layer: 'visual_grass_block',
      mutation_event: {
        trigger_condition: 'player_distance_less_than',
        condition_value: collapseDistance,
        action: 'floor_collapse',
        hint: 'AI stress test: floor collapsing',
        once: true,
        telegraph_ms: collapseTelegraphMs,
        active_profiles: ['Balanced', 'Speedrunner', 'Methodical', 'Panicked', 'Safe-Zoner'],
        mutated_state: {
          render_layer: 'visual_glitch_block',
          collision_mask: 'pass_through',
          alpha: 0.28,
          velocity: { x: 0, y: 420 }
        }
      }
    }),
    platform('phase_01', 1810, 545, 210, 35, {
      render_layer: 'visual_glitch_block',
      mutation_event: {
        trigger_condition: 'player_velocity_greater_than',
        condition_value: phaseGate,
        action: 'platform_phase',
        hint: dailyAnomaly?.modifier === 'gravity_drift' ? 'Daily drift phased the route sideways' : 'Velocity-gated platform phased out',
        once: true,
        telegraph_ms: 180,
        active_profiles: ['Speedrunner', 'Balanced'],
        mutated_state: phaseState
      }
    }),
    platform('ground_03', 2140, 650, 330, 70, { render_layer: 'visual_grass_block' }),
    platform('jump_wall_sensor', 2540, 465, 42, 185, {
      render_layer: 'transparent',
      collision_mask: 'pass_through',
      mutation_event: {
        trigger_condition: 'player_input_active',
        condition_value: 'jump',
        action: 'physics_gaslight',
        hint: dailyAnomaly?.modifier === 'mirror_wall' ? 'Daily mirror wall read the jump' : 'Jump read created a wall',
        once: true,
        telegraph_ms: dailyAnomaly?.modifier === 'mirror_wall' ? 160 : 110,
        active_profiles: wallProfiles,
        mutated_state: {
          render_layer: 'visual_warning_block',
          collision_mask: 'solid',
          alpha: 0.96
        }
      }
    }),
    platform('ground_04', 2715, 650, 340, 70, { render_layer: 'visual_grass_block' }),
    platform('mercy_bridge', 3065, 612, 230, 32, {
      render_layer: 'transparent',
      collision_mask: 'pass_through',
      mutation_event: {
        trigger_condition: 'profile_detected',
        condition_value: bridgeProfile,
        action: 'mercy_bridge',
        hint: dailyAnomaly?.modifier === 'pressure_plate' ? 'Daily recovery bridge rendered' : 'Recovery bridge rendered',
        once: true,
        telegraph_ms: 0,
        active_profiles: [bridgeProfile, 'Balanced'],
        mutated_state: {
          render_layer: 'visual_neon_block',
          collision_mask: 'solid',
          alpha: 0.92
        }
      }
    }),
    platform('ground_05', 3380, 650, 740, 70, { render_layer: 'visual_grass_block' }),
    ...campaignVariants,
    coin('coin_00', 520, 560),
    coin('coin_01', 900, 560),
    coin('coin_scramble_02', 1535, 578, firstScramble),
    coin('coin_03', 2235, 560),
    coin('coin_scramble_04', 2875, 560, secondScramble),
    hazard('spike_00', 1040, 612),
    hazard('spike_01', 1680, 612),
    hazard('spike_02', 2485, 612),
    hazard('projectile_01', 2360, 602, 58, 18, {
      render_layer: 'transparent',
      collision_mask: 'sensor',
      mutation_event: {
        trigger_condition: 'player_distance_less_than',
        condition_value: 430,
        action: 'weapon_fire',
        hint: 'AI fired a counter-shot',
        once: true,
        telegraph_ms: projectileTelegraphMs,
        active_profiles: ['Balanced', 'Speedrunner', 'Methodical', 'Panicked', 'Safe-Zoner'],
        mutated_state: {
          render_layer: 'visual_projectile',
          collision_mask: 'lethal_hazard',
          alpha: 1,
          velocity: { x: projectileSpeed, y: 0 }
        }
      }
    }),
    {
      entity_id: 'goal_01',
      base_type: 'goal',
      transform: { x: 3980, y: 530, width: 72, height: 120 },
      render_layer: 'visual_portal',
      collision_mask: 'goal',
      mutation_event: null
    }
  ];

  return {
    session_id: `px_${runSeed}_${mode}_L${campaignLevel}${dailyAnomaly ? `_${dailyAnomaly.dateKey}` : ''}`,
    tick_sequence: 0,
    global_environment: {
      gravity_vector: { x: 0, y: 980 },
      friction_multiplier: 1,
      camera_lock: false
    },
    input_hijack: {
      active: false,
      mapping: {}
    },
    entities
  };
}

function createCampaignVariants(
  campaignLevel: number,
  training: boolean,
  daily: DailyAnomaly | undefined,
  random: () => number,
  trapScale: number,
  levelPressure: number
) {
  if (training || (campaignLevel <= 1 && !daily)) return [];

  const variant = daily ? daily.seed % 6 : (campaignLevel - 2) % 6;
  const tier = Math.floor((campaignLevel - 1) / 25);
  const timeShotDelay = Math.max(3400, 9200 - campaignLevel * 18 - Math.round(random() * 560));
  const archetype = daily ? daily.seed % 4 : Math.floor((campaignLevel - 1) / 8) % 4;
  const variants: EntitySchema[] = [];

  variants.push(platform('variant_riser_01', 610 + variant * 26, 548 - (variant % 3) * 28, 178, 30, {
    render_layer: variant % 2 === 0 ? 'visual_shadow_block' : 'visual_neon_block'
  }));

  if (archetype === 1) {
    variants.push(platform('route_upper_step_01', 1320 + variant * 14, 490, 154, 28, {
      render_layer: 'visual_neon_block'
    }));
    variants.push(coin('coin_upper_route', 1388 + variant * 14, 426, trapScale > 0.64 ? 'safe_warning' : 'none'));
  }

  if (archetype === 2) {
    variants.push(platform('route_gap_lip_01', 2240 - variant * 12, 610, 120, 30, {
      render_layer: 'visual_shadow_block'
    }));
    variants.push(hazard('spike_route_pin_01', 2390 + variant * 8, 612, 34, 38));
  }

  if (archetype === 3) {
    variants.push(platform('route_mid_air_01', 2850 + variant * 9, 520, 150, 30, {
      render_layer: 'visual_glitch_block',
      mutation_event: {
        trigger_condition: 'player_velocity_greater_than',
        condition_value: 240 + variant * 14,
        action: 'platform_phase',
        hint: 'AI thinned the mid-air route',
        once: true,
        telegraph_ms: Math.max(170, 360 - tier * 10),
        active_profiles: ['Balanced', 'Speedrunner', 'Methodical'],
        mutated_state: {
          render_layer: 'visual_glitch_block',
          collision_mask: 'pass_through',
          alpha: 0.24
        }
      }
    }));
  }

  if (campaignLevel >= 5 || daily) {
    variants.push(hazard('timer_shot_01', 3270, 588 - (variant % 2) * 40, 58, 18, {
      render_layer: 'transparent',
      collision_mask: 'sensor',
      mutation_event: {
        trigger_condition: 'time_elapsed_ms',
        condition_value: timeShotDelay,
        action: 'weapon_fire',
        hint: daily ? 'Daily timer shot entered the route' : 'AI timer shot entered the route',
        once: true,
        telegraph_ms: 620,
        active_profiles: ['Balanced', 'Speedrunner', 'Methodical', 'Panicked', 'Safe-Zoner'],
        mutated_state: {
          render_layer: 'visual_projectile',
          collision_mask: 'lethal_hazard',
          alpha: 1,
          velocity: { x: -(360 + variant * 26 + tier * 12 + Math.round(trapScale * 80)), y: 0 }
        }
      }
    }));
  }

  if (campaignLevel >= 3 || daily) {
    variants.push(hazard('sky_strike_01', 1900 + variant * 45, 72, 56, 56, {
      behavior: 'sky_fall',
      render_layer: 'transparent',
      collision_mask: 'sensor',
      mutation_event: {
        trigger_condition: daily ? 'time_elapsed_ms' : 'player_distance_less_than',
        condition_value: daily ? 4200 + variant * 220 : 620,
        action: 'sky_strike',
        hint: daily ? 'Daily sky strike entered the lane' : 'AI dropped a sky object',
        once: true,
        telegraph_ms: Math.max(420, 760 - tier * 18),
        active_profiles: ['Balanced', 'Speedrunner', 'Methodical', 'Panicked', 'Safe-Zoner'],
        mutated_state: {
          render_layer: 'visual_rock',
          collision_mask: 'lethal_hazard',
          alpha: 1,
          velocity: { x: variant % 2 === 0 ? -24 : 28, y: 380 + tier * 18 + Math.round(trapScale * 100) }
        }
      }
    }));
  }

  if (campaignLevel >= 7 || daily) {
    variants.push(hazard('rolling_rock_01', 3310 - variant * 24, 606, 62, 62, {
      behavior: 'rolling_hazard',
      render_layer: 'transparent',
      collision_mask: 'sensor',
      mutation_event: {
        trigger_condition: 'player_distance_less_than',
        condition_value: 520 + tier * 18,
        action: 'rolling_rock',
        hint: 'AI released a rolling rock',
        once: true,
        telegraph_ms: Math.max(360, 660 - tier * 16),
        active_profiles: ['Balanced', 'Speedrunner', 'Methodical', 'Safe-Zoner'],
        mutated_state: {
          render_layer: 'visual_rock',
          collision_mask: 'lethal_hazard',
          alpha: 1,
          velocity: { x: -(180 + variant * 18 + tier * 22), y: 0 }
        }
      }
    }));
  }

  if (campaignLevel >= 9) {
    variants.push(platform('collapse_02', 865 + variant * 22, 650, 185, 70, {
      render_layer: 'visual_grass_block',
      mutation_event: {
        trigger_condition: 'player_distance_less_than',
        condition_value: 74 + Math.round(levelPressure * 120),
        action: 'floor_collapse',
        hint: 'AI split the early floor plate',
        once: true,
        telegraph_ms: Math.max(360, 680 - tier * 12),
        active_profiles: ['Balanced', 'Speedrunner', 'Methodical', 'Panicked', 'Safe-Zoner'],
        mutated_state: {
          render_layer: 'visual_glitch_block',
          collision_mask: 'pass_through',
          alpha: 0.26,
          velocity: { x: 0, y: 380 + tier * 8 }
        }
      }
    }));
  }

  if (campaignLevel >= 12) {
    variants.push(platform('rebuild_floor_01', 2050 + variant * 16, 650, 172, 70, {
      behavior: 'rebuild_floor',
      render_layer: 'visual_grass_block',
      mutation_event: {
        trigger_condition: 'player_distance_less_than',
        condition_value: 82 + Math.round(levelPressure * 90),
        action: 'floor_collapse',
        hint: 'AI broke and rebuilt a route plate',
        once: true,
        telegraph_ms: Math.max(420, 720 - tier * 18),
        active_profiles: ['Balanced', 'Speedrunner', 'Methodical', 'Panicked', 'Safe-Zoner'],
        mutated_state: {
          render_layer: 'visual_glitch_block',
          collision_mask: 'pass_through',
          alpha: 0.2,
          velocity: { x: 0, y: 330 + tier * 14 }
        }
      }
    }));
  }

  if (campaignLevel >= 15) {
    variants.push(coin('coin_high_variant', 1960 + variant * 18, 470 - (variant % 2) * 34, trapScale > 0.72 ? 'safe_warning' : 'none'));
  }

  if (campaignLevel >= 18) {
    variants.push(hazard('hunter_01', 3520 - variant * 18, 590, 48, 64, {
      behavior: 'hunter_chase',
      render_layer: 'transparent',
      collision_mask: 'sensor',
      mutation_event: {
        trigger_condition: 'profile_detected',
        condition_value: variant % 2 === 0 ? 'Methodical' : 'Safe-Zoner',
        action: 'hunter_spawn',
        hint: 'AI spawned a hunter unit',
        once: true,
        telegraph_ms: 620,
        active_profiles: ['Balanced', 'Methodical', 'Safe-Zoner', 'Panicked'],
        mutated_state: {
          render_layer: 'visual_hunter',
          collision_mask: 'lethal_hazard',
          alpha: 1,
          velocity: { x: -110 - tier * 14, y: 0 }
        }
      }
    }));
  }

  if (tier >= 2) {
    variants.push(hazard('spike_pressure_variant', 3065 + (variant % 3) * 42, 574, 38, 76, {
      render_layer: 'visual_spike',
      mutation_event: {
        trigger_condition: 'profile_detected',
        condition_value: variant % 2 === 0 ? 'Speedrunner' : 'Methodical',
        action: 'physics_gaslight',
        hint: 'AI raised a late pressure spike',
        once: true,
        telegraph_ms: 520,
        active_profiles: ['Speedrunner', 'Methodical', 'Balanced'],
        mutated_state: {
          alpha: 1,
          collision_mask: 'lethal_hazard',
          gravity_vector: { x: variant % 2 === 0 ? -80 : 80, y: 990 + tier * 8 }
        }
      }
    }));
  }

  return variants;
}

function clampLevel(level: number) {
  return Math.max(1, Math.min(maxCampaignLevel, Math.round(level)));
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
