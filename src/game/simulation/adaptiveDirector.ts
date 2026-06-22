import type {
  DirectorDecision,
  DynamicLevelSchema,
  InputHijackState,
  MutationAction,
  PlayerProfile,
  TelemetryBatch
} from '../types';

interface RollingStats {
  samples: number;
  averageSpeed: number;
  maxSpeed: number;
  stationaryRatio: number;
  inputSwitchesPerSecond: number;
  jumpsPerSecond: number;
  deaths: number;
}

const noHijack: InputHijackState = {
  active: false,
  mapping: {}
};

export class AdaptiveDirector {
  private profile: PlayerProfile = 'Balanced';
  private trust = 1;
  private mutationLog: string[] = ['Observer online'];
  private decisionCount = 0;
  private lastHijackAt = -10_000;

  constructor(private readonly aggression: number) {}

  ingest(batch: TelemetryBatch, level: DynamicLevelSchema): DirectorDecision {
    const stats = this.toRollingStats(batch);
    const nextProfile = this.classify(stats);
    this.profile = nextProfile;
    this.decisionCount += 1;
    this.trust = Math.max(0.18, 1 - this.aggression * 0.58 - batch.deaths * 0.045);

    const mutationBias = this.biasFor(nextProfile);
    const environment = this.environmentFor(nextProfile, level, batch.endedAtMs);
    const inputHijack = this.inputHijackFor(nextProfile, batch.endedAtMs, stats);
    const notice = this.noticeFor(nextProfile, mutationBias[0]);
    const logEntry = `${nextProfile}: ${this.describeMutation(mutationBias[0])}`;
    this.pushLog(logEntry);

    return {
      profile: nextProfile,
      notice,
      trust: this.trust,
      inputHijack,
      environment,
      mutationBias,
      logEntries: [...this.mutationLog]
    };
  }

  getProfile() {
    return this.profile;
  }

  getTrust() {
    return this.trust;
  }

  getLog() {
    return [...this.mutationLog];
  }

  private toRollingStats(batch: TelemetryBatch): RollingStats {
    const seconds = Math.max(0.1, (batch.endedAtMs - batch.startedAtMs) / 1000);
    return {
      samples: batch.samples.length,
      averageSpeed: batch.averageSpeed,
      maxSpeed: batch.maxSpeed,
      stationaryRatio: batch.stationaryMs / Math.max(1, batch.endedAtMs - batch.startedAtMs),
      inputSwitchesPerSecond: batch.inputSwitches / seconds,
      jumpsPerSecond: batch.jumpPresses / seconds,
      deaths: batch.deaths
    };
  }

  private classify(stats: RollingStats): PlayerProfile {
    if (stats.inputSwitchesPerSecond > 9.5 || stats.jumpsPerSecond > 4.8) return 'Panicked';
    if (stats.maxSpeed > 355 && stats.stationaryRatio < 0.08) return 'Speedrunner';
    if (stats.stationaryRatio > 0.34) return 'Safe-Zoner';
    if (stats.averageSpeed > 72 && stats.inputSwitchesPerSecond < 3.8 && stats.deaths < 2) return 'Methodical';
    return 'Balanced';
  }

  private biasFor(profile: PlayerProfile): MutationAction[] {
    switch (profile) {
      case 'Speedrunner':
        return ['floor_collapse', 'platform_phase', 'rolling_rock', 'weapon_fire'];
      case 'Panicked':
        return ['weapon_fire', 'input_redirection', 'physics_gaslight', 'sky_strike'];
      case 'Safe-Zoner':
        return ['elevator_crush', 'floor_collapse', 'sky_strike', 'hunter_spawn'];
      case 'Methodical':
        return ['hunter_spawn', 'semantic_scramble', 'mercy_bridge', 'rolling_rock'];
      default:
        return ['floor_collapse', 'weapon_fire', 'sky_strike', 'semantic_scramble'];
    }
  }

  private environmentFor(profile: PlayerProfile, level: DynamicLevelSchema, nowMs: number): DynamicLevelSchema['global_environment'] {
    const pulse = Math.sin((nowMs / 1000) * 1.7) * this.aggression;
    const base = level.global_environment;

    if (profile === 'Speedrunner') {
      return {
        ...base,
        friction_multiplier: 0.9,
        gravity_vector: { x: -90 * this.aggression, y: 1010 + 30 * pulse }
      };
    }

    if (profile === 'Safe-Zoner') {
      return {
        ...base,
        friction_multiplier: 1.05,
        gravity_vector: { x: 32 * pulse, y: 980 }
      };
    }

    if (profile === 'Panicked') {
      return {
        ...base,
        friction_multiplier: 0.94,
        gravity_vector: { x: 58 * pulse, y: 1020 }
      };
    }

    return {
      ...base,
      friction_multiplier: 1,
      gravity_vector: { x: 0, y: 980 }
    };
  }

  private inputHijackFor(profile: PlayerProfile, nowMs: number, stats: RollingStats): InputHijackState {
    const canHijack = this.aggression > 0.42 && nowMs - this.lastHijackAt > 6500;
    if (!canHijack || profile !== 'Panicked' || stats.jumpsPerSecond < 4) return noHijack;

    this.lastHijackAt = nowMs;
    return {
      active: true,
      mapping: {
        move_left: 'move_right',
        move_right: 'move_left',
        jump_button: 'action_dash'
      },
      ui_spoofing: {
        trigger_fake_popup: 'paradox_config',
        delay_ms: 300
      },
      expires_at_ms: nowMs + 1300 + Math.round(this.aggression * 900)
    };
  }

  private noticeFor(profile: PlayerProfile, action: MutationAction) {
    const actionText = this.describeMutation(action);
    return `AI adapted: ${actionText}.`;
  }

  private describeMutation(action: MutationAction) {
    switch (action) {
      case 'platform_phase':
        return 'platforms may phase out';
      case 'floor_collapse':
        return 'floor collapse armed';
      case 'weapon_fire':
        return 'counter-shot armed';
      case 'sky_strike':
        return 'sky strike armed';
      case 'rolling_rock':
        return 'rolling hazard armed';
      case 'hunter_spawn':
        return 'hunter spawned';
      case 'physics_gaslight':
        return 'gravity may shift';
      case 'input_redirection':
        return 'controls may glitch';
      case 'elevator_crush':
        return 'safe zones may move';
      case 'mercy_bridge':
        return 'recovery route possible';
      case 'semantic_scramble':
      default:
        return 'objects may change role';
    }
  }

  private pushLog(entry: string) {
    if (this.mutationLog[0] === entry) return;
    this.mutationLog.unshift(entry);
    this.mutationLog = this.mutationLog.slice(0, 8);
  }
}
