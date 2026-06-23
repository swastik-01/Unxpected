import { describe, expect, it } from 'vitest';
import { AdaptiveDirector } from '../src/game/simulation/adaptiveDirector';
import type { DynamicLevelSchema, TelemetryBatch } from '../src/game/types';
import { blueprintForLevel, chapterForLevel, levelThemes, routeArchetypes } from '../src/game/content/levelThemes';

const chapter = chapterForLevel(1);
const blueprint = blueprintForLevel(1);

const level: DynamicLevelSchema = {
  audioProfile: chapter.audioProfile,
  blueprintId: blueprint.id,
  chapterId: chapter.id,
  chapterTheme: chapter.theme,
  session_id: 'test',
  tick_sequence: 0,
  theme: levelThemes[0],
  route_archetype: routeArchetypes[0],
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
  entities: []
};

function batch(overrides: Partial<TelemetryBatch>): TelemetryBatch {
  return {
    startedAtMs: 0,
    endedAtMs: 500,
    samples: [
      {
        timeMs: 0,
        x: 0,
        y: 0,
        vx: overrides.averageSpeed ?? 0,
        vy: 0,
        onGround: true,
        actions: { left: false, right: true, jump: false, dash: false, down: false },
        checkpointIndex: 0,
        deaths: overrides.deaths ?? 0
      },
      {
        timeMs: 500,
        x: 100,
        y: 0,
        vx: overrides.maxSpeed ?? overrides.averageSpeed ?? 0,
        vy: 0,
        onGround: true,
        actions: { left: false, right: true, jump: false, dash: false, down: false },
        checkpointIndex: 0,
        deaths: overrides.deaths ?? 0
      }
    ],
    jumpPresses: 0,
    dashPresses: 0,
    inputSwitches: 0,
    stationaryMs: 0,
    maxSpeed: 0,
    averageSpeed: 0,
    deaths: 0,
    ...overrides
  };
}

describe('AdaptiveDirector', () => {
  it('classifies speedrunner behavior and primes collapse pressure', () => {
    const director = new AdaptiveDirector(0.7);
    const decision = director.ingest(batch({ maxSpeed: 420, averageSpeed: 360, stationaryMs: 0 }), level);

    expect(decision.profile).toBe('Speedrunner');
    expect(decision.mutationBias[0]).toBe('floor_collapse');
    expect(decision.mutationBias).toContain('platform_phase');
    expect(decision.environment.gravity_vector.x).toBeLessThan(0);
  });

  it('classifies panic input and briefly desyncs controls at high aggression', () => {
    const director = new AdaptiveDirector(0.8);
    const decision = director.ingest(batch({ startedAtMs: 6500, endedAtMs: 7000, inputSwitches: 10, jumpPresses: 4, maxSpeed: 160, averageSpeed: 80 }), level);

    expect(decision.profile).toBe('Panicked');
    expect(decision.inputHijack.active).toBe(true);
    expect(decision.inputHijack.mapping.jump_button).toBe('action_dash');
  });

  it('keeps a recovery-oriented mutation available for methodical players', () => {
    const director = new AdaptiveDirector(0.5);
    const decision = director.ingest(batch({ averageSpeed: 110, maxSpeed: 150, inputSwitches: 1, deaths: 0 }), level);

    expect(decision.profile).toBe('Methodical');
    expect(decision.mutationBias).toContain('mercy_bridge');
  });
});
