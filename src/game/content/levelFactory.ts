import type { DailyAnomaly, DynamicLevelSchema, EntitySchema, LevelBlueprint, MenuMode, PlayerProfile, RouteArchetypeId } from '../types';
import { maxCampaignLevel } from '../constants';
import { blueprintForLevel, chapterForLevel } from './levelThemes';

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

const weaponCache = (entity_id: string, x: number, y: number): EntitySchema => ({
  entity_id,
  base_type: 'collectible',
  behavior: 'weapon_pickup',
  transform: { x, y, width: 42, height: 34 },
  render_layer: 'visual_weapon_cache',
  collision_mask: 'trigger_pickup',
  mutation_event: null
});

const flickerFloor = (
  entity_id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  conditionValue: number,
  telegraphMs: number,
  hint: string
): EntitySchema => platform(entity_id, x, y, width, height, {
  behavior: 'flicker_floor',
  render_layer: 'visual_grass_block',
  mutation_event: {
    trigger_condition: 'player_distance_less_than',
    condition_value: conditionValue,
    action: 'floor_collapse',
    hint,
    once: false,
    telegraph_ms: telegraphMs,
    active_profiles: ['Balanced', 'Speedrunner', 'Methodical', 'Panicked', 'Safe-Zoner'],
    mutated_state: {
      render_layer: 'visual_glitch_block',
      collision_mask: 'pass_through',
      alpha: 0.2,
      velocity: { x: 0, y: 250 }
    }
  }
});

export function createOpeningLevel(mode: MenuMode, aggression: number, dailyAnomaly?: DailyAnomaly, levelIndex = 1): DynamicLevelSchema {
  const training = mode === 'training';
  const daily = mode === 'daily' ? dailyAnomaly : undefined;
  const campaignLevel = clampLevel(levelIndex);
  const chapter = chapterForLevel(campaignLevel);
  const blueprint = blueprintForLevel(campaignLevel, dailyAnomaly?.seed);
  const theme = chapter.theme;
  const routeArchetype = blueprint.routeArchetype;
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
  const blueprintArchitecture = createBlueprintArchitecture(blueprint, training, daily, trapScale, levelPressure);
  const campaignVariants = createCampaignVariants(campaignLevel, training, daily, random, trapScale, levelPressure, routeArchetype.id);

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
    platform('jump_wall_sensor', 2530, 620, 150, 30, {
      render_layer: 'visual_shadow_block',
      collision_mask: 'solid',
      mutation_event: {
        trigger_condition: 'player_input_active',
        condition_value: 'jump',
        action: 'physics_gaslight',
        hint: dailyAnomaly?.modifier === 'mirror_wall' ? 'Daily mirror bridge reinforced' : 'Jump read reinforced the bridge',
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
    platform('route_drift_base_01', 3090, 626, 200, 32, { render_layer: 'visual_neon_block' }),
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
    platform('ground_05', 3380, 650, 390, 70, { render_layer: 'visual_grass_block' }),
    platform('final_collapse_01', 3810, 650, 130, 70, {
      render_layer: 'visual_grass_block',
      mutation_event: {
        trigger_condition: 'player_distance_less_than',
        condition_value: 155,
        action: 'floor_collapse',
        hint: 'Final floor trap armed near the gate',
        once: true,
        telegraph_ms: 680,
        active_profiles: ['Balanced', 'Speedrunner', 'Methodical', 'Panicked', 'Safe-Zoner'],
        mutated_state: {
          render_layer: 'visual_glitch_block',
          collision_mask: 'pass_through',
          alpha: 0.26,
          velocity: { x: 0, y: 360 }
        }
      }
    }),
    platform('goal_lip_01', 3970, 650, 150, 70, { render_layer: 'visual_grass_block' }),
    ...blueprintArchitecture,
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
    audioProfile: chapter.audioProfile,
    blueprintId: blueprint.id,
    chapterId: chapter.id,
    chapterTheme: chapter.theme,
    session_id: `px_${runSeed}_${mode}_L${campaignLevel}${dailyAnomaly ? `_${dailyAnomaly.dateKey}` : ''}`,
    tick_sequence: 0,
    theme,
    route_archetype: routeArchetype,
    routeSignature: blueprint.routeSignature,
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
  levelPressure: number,
  routeArchetype: RouteArchetypeId
) {
  if (training || (campaignLevel <= 1 && !daily)) return [];

  const variant = daily ? daily.seed % 6 : (campaignLevel * 3 + Math.floor(random() * 6)) % 6;
  const tier = Math.floor((campaignLevel - 1) / 25);
  const timeShotDelay = Math.max(3400, 9200 - campaignLevel * 18 - Math.round(random() * 560));
  const localArchetype = daily ? daily.seed % 4 : Math.floor((campaignLevel - 1) / 8) % 4;
  const variants: EntitySchema[] = [];

  variants.push(platform('variant_riser_01', 610 + variant * 26, 548 - (variant % 3) * 28, 178, 30, {
    render_layer: variant % 2 === 0 ? 'visual_shadow_block' : 'visual_neon_block'
  }));
  variants.push(...createRouteArchetypeEntities(routeArchetype, campaignLevel, variant, tier, trapScale, levelPressure, daily));

  if (localArchetype === 1) {
    variants.push(platform('route_upper_step_01', 1320 + variant * 14, 490, 154, 28, {
      render_layer: 'visual_neon_block'
    }));
    variants.push(coin('coin_upper_route', 1388 + variant * 14, 426, trapScale > 0.64 ? 'safe_warning' : 'none'));
  }

  if (localArchetype === 2) {
    variants.push(platform('route_gap_lip_01', 2240 - variant * 12, 610, 120, 30, {
      render_layer: 'visual_shadow_block'
    }));
    variants.push(hazard('spike_route_pin_01', 2390 + variant * 8, 612, 34, 38));
  }

  if (localArchetype === 3) {
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

  if (campaignLevel >= 22) {
    variants.push(platform('air_ladder_step_01', 2180 + variant * 10, 555, 108, 26, {
      render_layer: 'visual_neon_block'
    }));
    variants.push(platform('air_ladder_step_02', 2368 + variant * 8, 504, 104, 26, {
      render_layer: 'visual_shadow_block'
    }));
    variants.push(platform('air_ladder_step_03', 2552 + variant * 6, 454, 112, 26, {
      render_layer: 'visual_neon_block'
    }));
  }

  if (campaignLevel >= 28) {
    variants.push(hazard('bottom_shot_01', 2015 + variant * 22, 714, 18, 58, {
      render_layer: 'transparent',
      collision_mask: 'sensor',
      mutation_event: {
        trigger_condition: 'time_elapsed_ms',
        condition_value: 5200 + variant * 180,
        action: 'weapon_fire',
        hint: 'AI fired a floor turret between platforms',
        once: true,
        telegraph_ms: Math.max(420, 660 - tier * 18),
        active_profiles: ['Balanced', 'Speedrunner', 'Methodical', 'Panicked', 'Safe-Zoner'],
        mutated_state: {
          render_layer: 'visual_projectile',
          collision_mask: 'lethal_hazard',
          alpha: 1,
          velocity: { x: 0, y: -(360 + tier * 36 + Math.round(trapScale * 80)) }
        }
      }
    }));
  }

  if (campaignLevel >= 40) {
    variants.push(platform('tunnel_ceiling_01', 3180 + variant * 10, 518, 160, 28, {
      render_layer: 'visual_shadow_block'
    }));
    variants.push(platform('tunnel_ceiling_02', 3515 - variant * 8, 518, 190, 28, {
      render_layer: 'visual_shadow_block'
    }));
    variants.push(platform('tunnel_lower_step_01', 3260 + variant * 8, 604, 134, 28, {
      render_layer: 'visual_glitch_block'
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

  if (campaignLevel >= 33) {
    variants.push(hazard('sky_strike_02', 1510 + variant * 32, 68, 50, 50, {
      behavior: 'sky_fall',
      render_layer: 'transparent',
      collision_mask: 'sensor',
      mutation_event: {
        trigger_condition: 'time_elapsed_ms',
        condition_value: Math.max(3300, 6200 - campaignLevel * 16 + variant * 160),
        action: 'sky_strike',
        hint: 'AI chained a second sky drop',
        once: true,
        telegraph_ms: Math.max(360, 650 - tier * 18),
        active_profiles: ['Balanced', 'Speedrunner', 'Methodical', 'Panicked', 'Safe-Zoner'],
        mutated_state: {
          render_layer: 'visual_rock',
          collision_mask: 'lethal_hazard',
          alpha: 1,
          velocity: { x: variant % 2 === 0 ? 36 : -34, y: 410 + tier * 24 + Math.round(trapScale * 110) }
        }
      }
    }));
  }

  if (campaignLevel >= 49) {
    variants.push(hazard('timer_shot_02', 1225 + variant * 30, 540 - (variant % 3) * 34, 56, 18, {
      render_layer: 'transparent',
      collision_mask: 'sensor',
      mutation_event: {
        trigger_condition: 'time_elapsed_ms',
        condition_value: Math.max(2800, 5400 - campaignLevel * 14 + variant * 130),
        action: 'weapon_fire',
        hint: 'AI chained a cross-lane shot',
        once: true,
        telegraph_ms: Math.max(330, 560 - tier * 15),
        active_profiles: ['Balanced', 'Speedrunner', 'Methodical', 'Panicked', 'Safe-Zoner'],
        mutated_state: {
          render_layer: 'visual_projectile',
          collision_mask: 'lethal_hazard',
          alpha: 1,
          velocity: { x: -(420 + variant * 30 + tier * 28 + Math.round(trapScale * 95)), y: variant % 2 === 0 ? -18 : 18 }
        }
      }
    }));
  }

  if (campaignLevel >= 61) {
    variants.push(weaponCache('weapon_cache_01', 3425 - variant * 14, 560));
    variants.push(hazard('armed_monster_01', 3725 - variant * 12, 590, 52, 66, {
      behavior: 'hunter_chase',
      render_layer: 'transparent',
      collision_mask: 'sensor',
      mutation_event: {
        trigger_condition: 'player_distance_less_than',
        condition_value: 760,
        action: 'hunter_spawn',
        hint: 'AI deployed an armed tunnel guard',
        once: true,
        telegraph_ms: Math.max(360, 620 - tier * 18),
        active_profiles: ['Balanced', 'Speedrunner', 'Methodical', 'Safe-Zoner', 'Panicked'],
        mutated_state: {
          render_layer: 'visual_hunter',
          collision_mask: 'lethal_hazard',
          alpha: 1,
          velocity: { x: -150 - tier * 24, y: 0 }
        }
      }
    }));
  }

  if (campaignLevel >= 65) {
    variants.push(hazard('rolling_rock_02', 2630 + variant * 18, 606, 58, 58, {
      behavior: 'rolling_hazard',
      render_layer: 'transparent',
      collision_mask: 'sensor',
      mutation_event: {
        trigger_condition: 'player_distance_less_than',
        condition_value: 460 + tier * 24,
        action: 'rolling_rock',
        hint: 'AI released a second rolling rock',
        once: true,
        telegraph_ms: Math.max(310, 560 - tier * 17),
        active_profiles: ['Balanced', 'Speedrunner', 'Methodical', 'Panicked', 'Safe-Zoner'],
        mutated_state: {
          render_layer: 'visual_rock',
          collision_mask: 'lethal_hazard',
          alpha: 1,
          velocity: { x: -(230 + variant * 22 + tier * 28), y: 0 }
        }
      }
    }));
  }

  if (campaignLevel >= 72) {
    variants.push(hazard('bottom_shot_02', 3120 - variant * 18, 714, 18, 58, {
      render_layer: 'transparent',
      collision_mask: 'sensor',
      mutation_event: {
        trigger_condition: 'time_elapsed_ms',
        condition_value: 7600 + variant * 150,
        action: 'weapon_fire',
        hint: 'AI chained a second floor turret',
        once: true,
        telegraph_ms: Math.max(330, 560 - tier * 18),
        active_profiles: ['Balanced', 'Speedrunner', 'Methodical', 'Panicked', 'Safe-Zoner'],
        mutated_state: {
          render_layer: 'visual_projectile',
          collision_mask: 'lethal_hazard',
          alpha: 1,
          velocity: { x: variant % 2 === 0 ? -18 : 18, y: -(420 + tier * 44 + Math.round(trapScale * 90)) }
        }
      }
    }));
  }

  if (campaignLevel >= 81) {
    variants.push(hazard('hunter_02', 3000 + variant * 20, 590, 48, 64, {
      behavior: 'hunter_chase',
      render_layer: 'transparent',
      collision_mask: 'sensor',
      mutation_event: {
        trigger_condition: 'profile_detected',
        condition_value: variant % 2 === 0 ? 'Speedrunner' : 'Balanced',
        action: 'hunter_spawn',
        hint: 'AI deployed a second hunter unit',
        once: true,
        telegraph_ms: Math.max(360, 590 - tier * 18),
        active_profiles: ['Balanced', 'Speedrunner', 'Methodical', 'Safe-Zoner', 'Panicked'],
        mutated_state: {
          render_layer: 'visual_hunter',
          collision_mask: 'lethal_hazard',
          alpha: 1,
          velocity: { x: -130 - tier * 18, y: 0 }
        }
      }
    }));
  }

  if (campaignLevel >= 97) {
    variants.push(hazard('final_sky_strike', 2260 + variant * 20, 60, 52, 52, {
      behavior: 'sky_fall',
      render_layer: 'transparent',
      collision_mask: 'sensor',
      mutation_event: {
        trigger_condition: 'time_elapsed_ms',
        condition_value: 3000 + variant * 120,
        action: 'sky_strike',
        hint: 'AI final anomaly dropped into the route',
        once: true,
        telegraph_ms: 330,
        active_profiles: ['Balanced', 'Speedrunner', 'Methodical', 'Panicked', 'Safe-Zoner'],
        mutated_state: {
          render_layer: 'visual_rock',
          collision_mask: 'lethal_hazard',
          alpha: 1,
          velocity: { x: variant % 2 === 0 ? -48 : 48, y: 520 + Math.round(trapScale * 120) }
        }
      }
    }));
  }

  if (campaignLevel >= 99) {
    variants.push(hazard('final_crossfire_99', 3460 - variant * 12, 540, 58, 18, {
      render_layer: 'transparent',
      collision_mask: 'sensor',
      mutation_event: {
        trigger_condition: 'time_elapsed_ms',
        condition_value: 5200 + variant * 110,
        action: 'weapon_fire',
        hint: 'AI final crossfire entered the portal lane',
        once: true,
        telegraph_ms: 310,
        active_profiles: ['Balanced', 'Speedrunner', 'Methodical', 'Panicked', 'Safe-Zoner'],
        mutated_state: {
          render_layer: 'visual_projectile',
          collision_mask: 'lethal_hazard',
          alpha: 1,
          velocity: { x: -(520 + tier * 34 + Math.round(trapScale * 120)), y: variant % 2 === 0 ? -24 : 24 }
        }
      }
    }));
  }

  return variants;
}

function createBlueprintArchitecture(
  blueprint: LevelBlueprint,
  training: boolean,
  daily: DailyAnomaly | undefined,
  trapScale: number,
  levelPressure: number
) {
  if (training) return [];

  const campaignLevel = blueprint.levelIndex;
  const index = blueprint.blueprintIndex;
  const tier = Math.floor((campaignLevel - 1) / 10);
  const levelTag = `bp_${String(campaignLevel).padStart(2, '0')}`;
  const variants: EntitySchema[] = [];
  const allProfiles: PlayerProfile[] = ['Balanced', 'Speedrunner', 'Methodical', 'Panicked', 'Safe-Zoner'];
  const telegraphMs = Math.max(330, 820 - tier * 42 - Math.round(trapScale * 120));
  const pressureReach = 78 + Math.round(levelPressure * 140) + tier * 4;
  variants.push(platform(`${levelTag}_chapter_anchor`, 560 + (tier % 5) * 36 + (index % 3) * 18, 590 - (tier % 4) * 24, 88 + (tier % 3) * 18, 24, {
    render_layer: tier % 2 === 0 ? 'visual_neon_block' : 'visual_shadow_block'
  }));

  switch (blueprint.routeArchetype.id) {
    case 'core_run':
      variants.push(platform(`${levelTag}_readable_step`, 1160 + index * 9, 522 - (tier % 2) * 12, 116, 26, {
        render_layer: tier % 2 === 0 ? 'visual_neon_block' : 'visual_shadow_block'
      }));
      variants.push(coin(`${levelTag}_route_coin`, 1214 + index * 9, 464, trapScale > 0.7 ? 'safe_warning' : 'none'));
      break;

    case 'sky_ladder':
      variants.push(platform(`${levelTag}_sky_step_01`, 760 + index * 5, 548, 126, 26, {
        render_layer: 'visual_neon_block'
      }));
      variants.push(platform(`${levelTag}_sky_step_02`, 952 + index * 5, 496, 126, 26, {
        render_layer: 'visual_shadow_block'
      }));
      variants.push(platform(`${levelTag}_sky_step_03`, 1144 + index * 5, 444, 132, 26, {
        render_layer: 'visual_neon_block'
      }));
      variants.push(hazard(`${levelTag}_sky_drop`, 1650 + index * 24, 70, 52, 52, {
        behavior: 'sky_fall',
        render_layer: 'transparent',
        collision_mask: 'sensor',
        mutation_event: {
          trigger_condition: daily ? 'time_elapsed_ms' : 'player_distance_less_than',
          condition_value: daily ? 3600 + index * 170 : 600 + tier * 12,
          action: 'sky_strike',
          hint: `${blueprint.label}: overhead object falling`,
          once: true,
          telegraph_ms: telegraphMs,
          active_profiles: allProfiles,
          mutated_state: {
            render_layer: 'visual_rock',
            collision_mask: 'lethal_hazard',
            alpha: 1,
            velocity: { x: index % 2 === 0 ? -28 : 26, y: 360 + tier * 32 + Math.round(trapScale * 90) }
          }
        }
      }));
      break;

    case 'tunnel_cut':
      variants.push(platform(`${levelTag}_tunnel_ceiling_01`, 1715 + index * 7, 500, 194, 28, {
        render_layer: 'visual_shadow_block'
      }));
      variants.push(platform(`${levelTag}_tunnel_floor_step`, 1895 + index * 5, 610, 120, 28, {
        render_layer: 'visual_glitch_block'
      }));
      variants.push(coin(`${levelTag}_false_safe_coin`, 1960 + index * 5, 552, trapScale > 0.55 ? 'safe_warning' : 'none'));
      break;

    case 'hunter_lane':
      variants.push(platform(`${levelTag}_hunter_lane_step`, 1540 + index * 10, 552, 118, 26, {
        render_layer: 'visual_shadow_block'
      }));
      variants.push(hazard(`${levelTag}_hunter`, 1820 + index * 13, 590, 48, 64, {
        behavior: 'hunter_chase',
        render_layer: 'transparent',
        collision_mask: 'sensor',
        mutation_event: {
          trigger_condition: campaignLevel >= 10 || daily ? 'player_distance_less_than' : 'profile_detected',
          condition_value: campaignLevel >= 10 || daily ? 575 : 'Methodical',
          action: 'hunter_spawn',
          hint: `${blueprint.label}: hunter tracking your pace`,
          once: true,
          telegraph_ms: telegraphMs,
          active_profiles: allProfiles,
          mutated_state: {
            render_layer: 'visual_hunter',
            collision_mask: 'lethal_hazard',
            alpha: 1,
            velocity: { x: -(92 + tier * 16), y: 0 }
          }
        }
      }));
      break;

    case 'collapse_bridge':
      variants.push(flickerFloor(
        `${levelTag}_flicker_floor_01`,
        1725 + index * 4,
        618,
        92,
        28,
        pressureReach,
        telegraphMs,
        `${blueprint.label}: floor disappearing then rebuilding`
      ));
      variants.push(flickerFloor(
        `${levelTag}_flicker_floor_02`,
        3295 + index * 3,
        618,
        86,
        28,
        pressureReach + 18,
        telegraphMs,
        `${blueprint.label}: bridge flicker re-armed`
      ));
      if (campaignLevel >= 12) {
        variants.push(hazard(`${levelTag}_portal_pressure_shot`, 3860, 566 - (index % 2) * 28, 56, 18, {
          render_layer: 'transparent',
          collision_mask: 'sensor',
          mutation_event: {
            trigger_condition: 'player_distance_less_than',
            condition_value: 540 + tier * 28,
            action: 'weapon_fire',
            hint: `${blueprint.label}: portal lane crossfire armed`,
            once: true,
            telegraph_ms: Math.max(330, telegraphMs - 80),
            active_profiles: allProfiles,
            mutated_state: {
              render_layer: 'visual_projectile',
              collision_mask: 'lethal_hazard',
              alpha: 1,
              velocity: { x: -(360 + tier * 28 + Math.round(trapScale * 80)), y: 0 }
            }
          }
        }));
      }
      break;

    case 'split_path':
      variants.push(platform(`${levelTag}_split_upper_01`, 1835 + index * 5, 494, 128, 26, {
        render_layer: 'visual_neon_block'
      }));
      variants.push(platform(`${levelTag}_split_upper_02`, 2040 + index * 5, 454, 126, 26, {
        render_layer: 'visual_shadow_block'
      }));
      variants.push(platform(`${levelTag}_split_rejoin`, 2265 + index * 3, 514, 118, 26, {
        render_layer: 'visual_neon_block'
      }));
      variants.push(coin(`${levelTag}_split_reward`, 2100 + index * 5, 392, trapScale > 0.68 ? 'safe_warning' : 'none'));
      if (campaignLevel >= 16) {
        variants.push(hazard(`${levelTag}_split_sky_drop`, 2145 + index * 9, 66, 48, 48, {
          behavior: 'sky_fall',
          render_layer: 'transparent',
          collision_mask: 'sensor',
          mutation_event: {
            trigger_condition: 'time_elapsed_ms',
            condition_value: 4200 + index * 150,
            action: 'sky_strike',
            hint: `${blueprint.label}: upper path overhead drop`,
            once: true,
            telegraph_ms: telegraphMs,
            active_profiles: allProfiles,
            mutated_state: {
              render_layer: 'visual_rock',
              collision_mask: 'lethal_hazard',
              alpha: 1,
              velocity: { x: index % 2 === 0 ? 34 : -32, y: 390 + tier * 30 }
            }
          }
        }));
      }
      break;

    case 'vertical_gate':
      variants.push(platform(`${levelTag}_gate_step_01`, 3150, 574, 108, 26, {
        render_layer: 'visual_neon_block'
      }));
      variants.push(platform(`${levelTag}_gate_step_02`, 3298, 518, 106, 26, {
        render_layer: 'visual_shadow_block'
      }));
      variants.push(platform(`${levelTag}_gate_step_03`, 3450, 462, 110, 26, {
        render_layer: 'visual_neon_block'
      }));
      variants.push(hazard(`${levelTag}_vertical_crusher`, 3588, 374, 62, 88, {
        render_layer: 'transparent',
        collision_mask: 'sensor',
        mutation_event: {
          trigger_condition: 'player_distance_less_than',
          condition_value: 620 + tier * 22,
          action: 'elevator_crush',
          hint: `${blueprint.label}: vertical crusher dropping`,
          once: true,
          telegraph_ms: telegraphMs,
          active_profiles: allProfiles,
          mutated_state: {
            render_layer: 'visual_warning_block',
            collision_mask: 'lethal_hazard',
            alpha: 1,
            velocity: { x: 0, y: 250 + tier * 24 }
          }
        }
      }));
      if (campaignLevel >= 17) {
        variants.push(flickerFloor(
          `${levelTag}_gate_recovery_plate`,
          3304,
          618,
          78,
          28,
          pressureReach + 12,
          telegraphMs,
          `${blueprint.label}: recovery plate flickering near the gate`
        ));
      }
      break;

    case 'crossfire_gap':
      variants.push(platform(`${levelTag}_crossfire_lip`, 2960 + index * 4, 598, 102, 28, {
        render_layer: 'visual_shadow_block'
      }));
      variants.push(hazard(`${levelTag}_bottom_turret`, 3065 + index * 12, 714, 18, 58, {
        render_layer: 'transparent',
        collision_mask: 'sensor',
        mutation_event: {
          trigger_condition: campaignLevel >= 28 ? 'time_elapsed_ms' : 'player_distance_less_than',
          condition_value: campaignLevel >= 28 ? 4300 + index * 160 : 510,
          action: 'weapon_fire',
          hint: `${blueprint.label}: floor turret between platforms`,
          once: true,
          telegraph_ms: telegraphMs,
          active_profiles: allProfiles,
          mutated_state: {
            render_layer: 'visual_projectile',
            collision_mask: 'lethal_hazard',
            alpha: 1,
            velocity: { x: index % 2 === 0 ? -16 : 16, y: -(330 + tier * 36 + Math.round(trapScale * 70)) }
          }
        }
      }));
      break;

    case 'weapon_arena':
      variants.push(platform(`${levelTag}_arena_step_01`, 3375, 555, 118, 26, {
        render_layer: 'visual_neon_block'
      }));
      variants.push(platform(`${levelTag}_arena_step_02`, 3546, 512, 112, 26, {
        render_layer: 'visual_shadow_block'
      }));
      if (campaignLevel >= 61) {
        variants.push(weaponCache(`${levelTag}_weapon_cache`, 3300 - index * 4, 552));
        variants.push(hazard(`${levelTag}_arena_guard`, 3675 - index * 5, 590, 52, 66, {
          behavior: 'hunter_chase',
          render_layer: 'transparent',
          collision_mask: 'sensor',
          mutation_event: {
            trigger_condition: 'player_distance_less_than',
            condition_value: 760,
            action: 'hunter_spawn',
            hint: `${blueprint.label}: armed guard entering arena`,
            once: true,
            telegraph_ms: Math.max(320, telegraphMs - 70),
            active_profiles: allProfiles,
            mutated_state: {
              render_layer: 'visual_hunter',
              collision_mask: 'lethal_hazard',
              alpha: 1,
              velocity: { x: -(128 + tier * 20), y: 0 }
            }
          }
        }));
      }
      variants.push(hazard(`${levelTag}_final_lane_shot`, 3885, 538, 56, 18, {
        render_layer: 'transparent',
        collision_mask: 'sensor',
        mutation_event: {
          trigger_condition: 'player_distance_less_than',
          condition_value: 520 + tier * 28,
          action: 'weapon_fire',
          hint: `${blueprint.label}: final portal shot armed`,
          once: true,
          telegraph_ms: Math.max(300, telegraphMs - 90),
          active_profiles: allProfiles,
          mutated_state: {
            render_layer: 'visual_projectile',
            collision_mask: 'lethal_hazard',
            alpha: 1,
            velocity: { x: -(410 + tier * 34 + Math.round(trapScale * 90)), y: index % 2 === 0 ? -18 : 16 }
          }
        }
      }));
      break;

    default:
      break;
  }

  return variants;
}

function createRouteArchetypeEntities(
  routeArchetype: RouteArchetypeId,
  campaignLevel: number,
  variant: number,
  tier: number,
  trapScale: number,
  levelPressure: number,
  daily: DailyAnomaly | undefined
) {
  const variants: EntitySchema[] = [];
  const allProfiles: PlayerProfile[] = ['Balanced', 'Speedrunner', 'Methodical', 'Panicked', 'Safe-Zoner'];

  switch (routeArchetype) {
    case 'sky_ladder':
      variants.push(platform('route_sky_ladder_01', 1165 + variant * 8, 522, 116, 26, {
        render_layer: 'visual_neon_block'
      }));
      variants.push(platform('route_sky_ladder_02', 1378 + variant * 7, 474, 112, 26, {
        render_layer: 'visual_shadow_block'
      }));
      variants.push(platform('route_sky_ladder_03', 1594 + variant * 6, 426, 118, 26, {
        render_layer: 'visual_neon_block'
      }));
      variants.push(coin('coin_sky_ladder', 1646 + variant * 6, 362, trapScale > 0.66 ? 'safe_warning' : 'none'));
      break;

    case 'tunnel_cut':
      variants.push(platform('route_tunnel_ceiling_01', 2480 - variant * 8, 512, 205, 26, {
        render_layer: 'visual_shadow_block'
      }));
      variants.push(platform('route_tunnel_ceiling_02', 2790 + variant * 8, 504, 218, 26, {
        render_layer: 'visual_shadow_block'
      }));
      variants.push(platform('route_tunnel_step_01', 2986 + variant * 5, 604, 128, 28, {
        render_layer: 'visual_glitch_block'
      }));
      break;

    case 'collapse_bridge':
      variants.push(platform('route_collapse_bridge_01', 1190 + variant * 10, 650, 138, 70, {
        render_layer: 'visual_grass_block',
        mutation_event: {
          trigger_condition: 'player_distance_less_than',
          condition_value: 88 + Math.round(levelPressure * 90),
          action: 'floor_collapse',
          hint: 'AI cracked a side bridge plate',
          once: true,
          telegraph_ms: Math.max(420, 760 - tier * 18),
          active_profiles: allProfiles,
          mutated_state: {
            render_layer: 'visual_glitch_block',
            collision_mask: 'pass_through',
            alpha: 0.24,
            velocity: { x: 0, y: 340 + tier * 18 }
          }
        }
      }));
      variants.push(platform('route_collapse_bridge_02', 2870 - variant * 8, 650, 122, 70, {
        behavior: 'rebuild_floor',
        render_layer: 'visual_grass_block',
        mutation_event: {
          trigger_condition: 'player_distance_less_than',
          condition_value: 96,
          action: 'floor_collapse',
          hint: 'AI rebuilt a collapsing bridge behind you',
          once: true,
          telegraph_ms: Math.max(430, 720 - tier * 16),
          active_profiles: allProfiles,
          mutated_state: {
            render_layer: 'visual_glitch_block',
            collision_mask: 'pass_through',
            alpha: 0.22,
            velocity: { x: 0, y: 320 + tier * 18 }
          }
        }
      }));
      break;

    case 'crossfire_gap':
      variants.push(hazard('route_crossfire_shot_01', 3040 + variant * 18, 548, 58, 18, {
        render_layer: 'transparent',
        collision_mask: 'sensor',
        mutation_event: {
          trigger_condition: 'time_elapsed_ms',
          condition_value: Math.max(3600, 7100 - campaignLevel * 24 + variant * 160),
          action: 'weapon_fire',
          hint: 'AI opened a crossfire lane',
          once: true,
          telegraph_ms: Math.max(420, 650 - tier * 20),
          active_profiles: allProfiles,
          mutated_state: {
            render_layer: 'visual_projectile',
            collision_mask: 'lethal_hazard',
            alpha: 1,
            velocity: { x: -(350 + variant * 26 + tier * 30 + Math.round(trapScale * 90)), y: variant % 2 === 0 ? -22 : 18 }
          }
        }
      }));
      break;

    case 'hunter_lane':
      variants.push(hazard('route_hunter_shadow_01', 1800 + variant * 24, 590, 48, 64, {
        behavior: 'hunter_chase',
        render_layer: 'transparent',
        collision_mask: 'sensor',
        mutation_event: {
          trigger_condition: campaignLevel >= 10 || daily ? 'player_distance_less_than' : 'profile_detected',
          condition_value: campaignLevel >= 10 || daily ? 560 : 'Methodical',
          action: 'hunter_spawn',
          hint: 'AI released a hunter into this lane',
          once: true,
          telegraph_ms: Math.max(440, 700 - tier * 18),
          active_profiles: allProfiles,
          mutated_state: {
            render_layer: 'visual_hunter',
            collision_mask: 'lethal_hazard',
            alpha: 1,
            velocity: { x: -96 - tier * 18, y: 0 }
          }
        }
      }));
      break;

    case 'vertical_gate':
      variants.push(platform('route_vertical_gate_01', 2150 + variant * 8, 562, 104, 26, {
        render_layer: 'visual_neon_block'
      }));
      variants.push(platform('route_vertical_gate_02', 2308 + variant * 8, 510, 104, 26, {
        render_layer: 'visual_shadow_block'
      }));
      variants.push(platform('route_vertical_gate_03', 2468 + variant * 8, 458, 108, 26, {
        render_layer: 'visual_neon_block'
      }));
      variants.push(platform('route_vertical_gate_drop', 2640 + variant * 5, 570, 118, 26, {
        render_layer: 'visual_glitch_block',
        mutation_event: {
          trigger_condition: 'player_velocity_greater_than',
          condition_value: 230 + variant * 10,
          action: 'platform_phase',
          hint: 'AI opened the vertical gate drop',
          once: true,
          telegraph_ms: Math.max(220, 430 - tier * 12),
          active_profiles: allProfiles,
          mutated_state: {
            render_layer: 'visual_glitch_block',
            collision_mask: 'pass_through',
            alpha: 0.26
          }
        }
      }));
      break;

    case 'core_run':
    default:
      variants.push(coin('coin_core_route_bonus', 1015 + variant * 20, 512, trapScale > 0.7 ? 'safe_warning' : 'none'));
      break;
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
