import { describe, expect, it } from 'vitest';
import { createOpeningLevel } from '../src/game/content/levelFactory';
import { maxCampaignLevel } from '../src/game/constants';

describe('campaign level factory', () => {
  it('keeps the opener readable and checkpoint-free', () => {
    const level = createOpeningLevel('standard', 0.62, undefined, 1);
    const ids = level.entities.map((entity) => entity.entity_id);

    expect(ids).toContain('collapse_01');
    expect(ids).toContain('projectile_01');
    expect(ids).not.toContain('variant_riser_01');
    expect(level.entities.some((entity) => entity.collision_mask === 'checkpoint')).toBe(false);
  });

  it('adds deterministic surprise variants as campaign pressure rises', () => {
    const level = createOpeningLevel('standard', 0.75, undefined, 25);
    const ids = level.entities.map((entity) => entity.entity_id);

    expect(ids).toContain('variant_riser_01');
    expect(ids).toContain('timer_shot_01');
    expect(ids).toContain('sky_strike_01');
    expect(ids).toContain('rolling_rock_01');
    expect(ids).toContain('collapse_02');
    expect(ids).toContain('rebuild_floor_01');
    expect(ids).toContain('coin_high_variant');
    expect(ids).toContain('hunter_01');
    expect(level.entities.some((entity) => entity.collision_mask === 'checkpoint')).toBe(false);
  });

  it('supports exactly 99 campaign levels without adding checkpoint shortcuts', () => {
    expect(maxCampaignLevel).toBe(99);
    const level = createOpeningLevel('standard', 1, undefined, maxCampaignLevel);
    const ids = level.entities.map((entity) => entity.entity_id);

    expect(level.session_id).toContain(`L${maxCampaignLevel}`);
    expect(ids).toContain('sky_strike_01');
    expect(ids).toContain('rolling_rock_01');
    expect(ids).toContain('spike_pressure_variant');
    expect(level.entities.some((entity) => entity.collision_mask === 'checkpoint')).toBe(false);
  });
});
