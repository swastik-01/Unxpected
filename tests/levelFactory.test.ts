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
    expect(ids).toContain('air_ladder_step_01');
    expect(level.entities.some((entity) => entity.collision_mask === 'checkpoint')).toBe(false);
  });

  it('changes theme and route identity across early campaign levels', () => {
    const earlyLevels = Array.from({ length: 20 }, (_, index) => createOpeningLevel('standard', 0.85, undefined, index + 1));
    const chapterOneThemes = new Set(earlyLevels.slice(0, 10).map((level) => level.theme.id));
    const chapterTwoThemes = new Set(earlyLevels.slice(10, 20).map((level) => level.theme.id));
    const audioProfiles = new Set(earlyLevels.slice(0, 10).map((level) => level.audioProfile.id));
    const routes = new Set(earlyLevels.map((level) => level.route_archetype.id));
    const fingerprints = new Set(earlyLevels.map((level) => `${level.blueprintId}|${level.routeSignature}`));
    const level14 = earlyLevels[13];
    const level14Ids = level14.entities.map((entity) => entity.entity_id);

    expect(chapterOneThemes).toEqual(new Set(['neon_city']));
    expect(chapterTwoThemes).toEqual(new Set(['overgrown_ruins']));
    expect(audioProfiles).toEqual(new Set(['neon_pulse']));
    expect(routes.size).toBeGreaterThanOrEqual(9);
    expect(fingerprints.size).toBe(20);
    expect(level14.route_archetype.id).toBe('hunter_lane');
    expect(level14Ids).toContain('route_hunter_shadow_01');
    expect(level14Ids.some((id) => id.startsWith('bp_14_hunter'))).toBe(true);
  });

  it('keeps every 10-level chapter visually and sonically fixed before changing identity', () => {
    const samples = [1, 10, 11, 20, 21, 30, 91, 99].map((levelIndex) => createOpeningLevel('standard', 1, undefined, levelIndex));

    expect(samples[0].chapterId).toBe(samples[1].chapterId);
    expect(samples[0].theme.id).toBe(samples[1].theme.id);
    expect(samples[0].audioProfile.id).toBe(samples[1].audioProfile.id);
    expect(samples[2].chapterId).toBe(samples[3].chapterId);
    expect(samples[0].theme.id).not.toBe(samples[2].theme.id);
    expect(samples[2].theme.id).not.toBe(samples[4].theme.id);
    expect(samples[6].theme.id).toBe('paradox_core');
    expect(samples[7].route_archetype.id).toBe('weapon_arena');
  });

  it('adds higher-level route variants without making the main path impossible', () => {
    const level = createOpeningLevel('standard', 1, undefined, 72);
    const ids = level.entities.map((entity) => entity.entity_id);

    expect(level.chapterId).toBe('chapter_08_cave');
    expect(level.audioProfile.id).toBe('crystal_hum');
    expect(ids).toContain('bottom_shot_01');
    expect(ids).toContain('bottom_shot_02');
    expect(ids).toContain('tunnel_ceiling_01');
    expect(ids).toContain('weapon_cache_01');
    expect(ids).toContain('armed_monster_01');
    expect(ids).toContain('final_collapse_01');
    expect(ids).toContain('goal_lip_01');
  });

  it('supports exactly 99 campaign levels without adding checkpoint shortcuts', () => {
    expect(maxCampaignLevel).toBe(99);
    const level = createOpeningLevel('standard', 1, undefined, maxCampaignLevel);
    const ids = level.entities.map((entity) => entity.entity_id);

    expect(level.session_id).toContain(`L${maxCampaignLevel}`);
    expect(ids).toContain('sky_strike_01');
    expect(ids).toContain('rolling_rock_01');
    expect(ids).toContain('spike_pressure_variant');
    expect(ids).toContain('bottom_shot_02');
    expect(ids).toContain('weapon_cache_01');
    expect(level.entities.some((entity) => entity.collision_mask === 'checkpoint')).toBe(false);
  });
});
