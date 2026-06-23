import { afterEach, describe, expect, it, vi } from 'vitest';
import { maxCampaignLevel } from '../src/game/constants';
import { createOpeningLevel } from '../src/game/content/levelFactory';
import type { CollisionMask, DynamicLevelSchema, EntitySchema, MutationAction } from '../src/game/types';

const worldBounds = {
  width: 4300,
  height: 980
};

const resetCriticalIds = ['collapse_01', 'projectile_01'] as const;
const coreRoutePlatformIds = [
  'ground_00',
  'ground_01',
  'wait_lift_01',
  'collapse_01',
  'phase_01',
  'ground_03',
  'jump_wall_sensor',
  'ground_04',
  'route_drift_base_01',
  'ground_05',
  'final_collapse_01',
  'goal_lip_01'
] as const;
const maxCoreRouteGapPx = 190;
const maxCoreRouteRisePx = 125;
const expectedActionsByLevel: Array<{ action: MutationAction; from: number }> = [
  { action: 'sky_strike', from: 3 },
  { action: 'weapon_fire', from: 5 },
  { action: 'rolling_rock', from: 7 },
  { action: 'floor_collapse', from: 9 },
  { action: 'hunter_spawn', from: 18 },
  { action: 'physics_gaslight', from: 51 }
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('campaign level integrity', () => {
  it('builds all 99 campaign levels with valid entities, collisions, and reset-critical pieces', () => {
    for (let levelIndex = 1; levelIndex <= maxCampaignLevel; levelIndex += 1) {
      const level = createDeterministicLevel(levelIndex);
      const ids = new Set<string>();

      expect(level.session_id).toContain(`L${levelIndex}`);
      expect(level.entities.length).toBeGreaterThanOrEqual(13);
      expect(level.entities.some((entity) => entity.collision_mask === 'checkpoint')).toBe(false);
      expect(level.entities.filter((entity) => entity.base_type === 'goal')).toHaveLength(1);
      expect(level.entities.filter((entity) => entity.base_type === 'collectible').length).toBeGreaterThanOrEqual(5);

      for (const entity of level.entities) {
        expect(ids.has(entity.entity_id), `${levelLabel(levelIndex, entity)} duplicated entity id`).toBe(false);
        ids.add(entity.entity_id);
        expectEntityGeometry(levelIndex, entity);
        expectEntityCollision(levelIndex, entity);
        expectMutation(levelIndex, entity);
      }

      for (const criticalId of resetCriticalIds) {
        expect(ids.has(criticalId), `Level ${levelIndex} missing ${criticalId}`).toBe(true);
      }

      expectCoreRouteReachable(levelIndex, level);
    }
  });

  it('increases campaign pressure with advanced hazards while keeping each level schema unique', () => {
    const fingerprints = new Set<string>();
    let previousComplexity = 0;

    for (let levelIndex = 1; levelIndex <= maxCampaignLevel; levelIndex += 1) {
      const level = createDeterministicLevel(levelIndex);
      const actions = new Set(level.entities.map((entity) => entity.mutation_event?.action).filter(Boolean));
      const complexity = calculateComplexity(level);

      for (const expectation of expectedActionsByLevel) {
        if (levelIndex >= expectation.from) {
          expect(actions.has(expectation.action), `Level ${levelIndex} missing ${expectation.action}`).toBe(true);
        }
      }

      if (levelIndex % 8 === 1 || levelIndex === maxCampaignLevel) {
        expect(complexity, `Level ${levelIndex} should not lose long-term complexity`).toBeGreaterThanOrEqual(previousComplexity);
        previousComplexity = complexity;
      }

      fingerprints.add(fingerprintLevel(level));
    }

    expect(fingerprints.size).toBe(maxCampaignLevel);
  });
});

function createDeterministicLevel(levelIndex: number) {
  vi.spyOn(Date, 'now').mockReturnValue(1_789_000_000_000 + levelIndex * 10_000);
  vi.spyOn(Math, 'random').mockReturnValue(((levelIndex * 37) % 997) / 997);
  const aggression = Math.min(0.98, 0.58 + levelIndex / 220);
  return createOpeningLevel('standard', aggression, undefined, levelIndex);
}

function expectEntityGeometry(levelIndex: number, entity: EntitySchema) {
  const { transform } = entity;
  expect(Number.isFinite(transform.x), levelLabel(levelIndex, entity)).toBe(true);
  expect(Number.isFinite(transform.y), levelLabel(levelIndex, entity)).toBe(true);
  expect(transform.width, levelLabel(levelIndex, entity)).toBeGreaterThan(0);
  expect(transform.height, levelLabel(levelIndex, entity)).toBeGreaterThan(0);
  expect(transform.x, levelLabel(levelIndex, entity)).toBeGreaterThanOrEqual(0);
  expect(transform.y, levelLabel(levelIndex, entity)).toBeGreaterThanOrEqual(0);
  expect(transform.x + transform.width, levelLabel(levelIndex, entity)).toBeLessThanOrEqual(worldBounds.width);
  expect(transform.y + transform.height, levelLabel(levelIndex, entity)).toBeLessThanOrEqual(worldBounds.height);
}

function expectEntityCollision(levelIndex: number, entity: EntitySchema) {
  const label = levelLabel(levelIndex, entity);
  const validMasks: CollisionMask[] = ['solid', 'pass_through', 'lethal_hazard', 'trigger_pickup', 'checkpoint', 'goal', 'sensor'];

  expect(validMasks).toContain(entity.collision_mask);
  if (entity.base_type === 'platform') {
    expect(['solid', 'pass_through']).toContain(entity.collision_mask);
  }
  if (entity.base_type === 'collectible') {
    expect(entity.collision_mask, label).toBe('trigger_pickup');
  }
  if (entity.base_type === 'goal') {
    expect(entity.collision_mask, label).toBe('goal');
  }
  if (entity.render_layer === 'transparent') {
    expect(['sensor', 'pass_through']).toContain(entity.collision_mask);
  }
}

function expectMutation(levelIndex: number, entity: EntitySchema) {
  if (!entity.mutation_event) return;
  const label = levelLabel(levelIndex, entity);
  const { mutation_event: event } = entity;

  expect(event.hint.trim().length, label).toBeGreaterThan(0);
  expect(event.telegraph_ms, label).toBeGreaterThanOrEqual(0);
  expect(Object.keys(event.mutated_state).length, label).toBeGreaterThan(0);

  const mutatedMask = event.mutated_state.collision_mask;
  if (mutatedMask) {
    expect(['solid', 'pass_through', 'lethal_hazard', 'trigger_pickup', 'checkpoint', 'goal', 'sensor']).toContain(mutatedMask);
  }
  if (event.mutated_state.velocity) {
    expect(Number.isFinite(event.mutated_state.velocity.x), label).toBe(true);
    expect(Number.isFinite(event.mutated_state.velocity.y), label).toBe(true);
  }
}

function expectCoreRouteReachable(levelIndex: number, level: DynamicLevelSchema) {
  const route = coreRoutePlatformIds.map((id) => {
    const entity = level.entities.find((candidate) => candidate.entity_id === id);
    expect(entity, `Level ${levelIndex} missing route platform ${id}`).toBeDefined();
    expect(entity?.base_type, `Level ${levelIndex} ${id} should be a platform`).toBe('platform');
    expect(entity?.collision_mask, `Level ${levelIndex} ${id} should support the player by default`).toBe('solid');
    return entity as EntitySchema;
  });

  for (let index = 1; index < route.length; index += 1) {
    const previous = route[index - 1];
    const current = route[index];
    const previousRight = previous.transform.x + previous.transform.width;
    const gap = current.transform.x - previousRight;
    const upwardRise = previous.transform.y - current.transform.y;
    const label = `Level ${levelIndex} route ${previous.entity_id} -> ${current.entity_id}`;

    expect(gap, `${label} gap is too wide for a reliable platforming route`).toBeLessThanOrEqual(maxCoreRouteGapPx);
    expect(upwardRise, `${label} rises too sharply for a readable jump`).toBeLessThanOrEqual(maxCoreRouteRisePx);
  }
}

function calculateComplexity(level: DynamicLevelSchema) {
  const actionWeight = level.entities.filter((entity) => entity.mutation_event).length * 3;
  const hazardWeight = level.entities.filter((entity) => entity.base_type === 'hazard').length * 2;
  const movingWeight = level.entities.filter((entity) => entity.mutation_event?.mutated_state.velocity).length;
  return actionWeight + hazardWeight + movingWeight;
}

function fingerprintLevel(level: DynamicLevelSchema) {
  return level.entities
    .map((entity) => [
      entity.entity_id,
      entity.base_type,
      entity.behavior ?? 'none',
      Math.round(entity.transform.x),
      Math.round(entity.transform.y),
      Math.round(entity.transform.width),
      Math.round(entity.transform.height),
      entity.collision_mask,
      entity.mutation_event?.action ?? 'none',
      entity.mutation_event?.condition_value ?? 'none',
      entity.mutation_event?.telegraph_ms ?? 'none',
      entity.mutation_event?.mutated_state.velocity?.x ?? 'none',
      entity.mutation_event?.mutated_state.velocity?.y ?? 'none'
    ].join(':'))
    .join('|');
}

function levelLabel(levelIndex: number, entity: EntitySchema) {
  return `Level ${levelIndex} entity ${entity.entity_id}`;
}
