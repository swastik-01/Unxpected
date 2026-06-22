import type { ActionState, TelemetryBatch, TelemetrySample } from '../types';

const batchIntervalMs = 500;

export class TelemetryBuffer {
  private samples: TelemetrySample[] = [];
  private startedAtMs = 0;
  private lastSample: TelemetrySample | null = null;
  private lastActions: ActionState | null = null;
  private jumpWasDown = false;
  private dashWasDown = false;
  private jumpPresses = 0;
  private dashPresses = 0;
  private inputSwitches = 0;
  private stationaryMs = 0;
  private nextFlushMs = batchIntervalMs;

  add(sample: TelemetrySample) {
    if (this.samples.length === 0) {
      this.startedAtMs = sample.timeMs;
      this.nextFlushMs = sample.timeMs + batchIntervalMs;
    }

    const dt = this.lastSample ? Math.max(0, sample.timeMs - this.lastSample.timeMs) : 0;
    const actionChanged = this.lastActions && (
      this.lastActions.left !== sample.actions.left ||
      this.lastActions.right !== sample.actions.right ||
      this.lastActions.jump !== sample.actions.jump ||
      this.lastActions.dash !== sample.actions.dash ||
      this.lastActions.down !== sample.actions.down
    );

    if (actionChanged) this.inputSwitches += 1;
    if (sample.actions.jump && !this.jumpWasDown) this.jumpPresses += 1;
    if (sample.actions.dash && !this.dashWasDown) this.dashPresses += 1;
    if (sample.onGround && Math.abs(sample.vx) < 10) this.stationaryMs += dt;

    this.jumpWasDown = sample.actions.jump;
    this.dashWasDown = sample.actions.dash;
    this.lastActions = { ...sample.actions };
    this.lastSample = sample;
    this.samples.push(sample);
  }

  drainIfReady(nowMs: number): TelemetryBatch | null {
    if (nowMs < this.nextFlushMs || this.samples.length < 2) return null;

    const samples = this.samples;
    const speeds = samples.map((sample) => Math.abs(sample.vx));
    const endedAtMs = samples[samples.length - 1].timeMs;
    const batch: TelemetryBatch = {
      startedAtMs: this.startedAtMs,
      endedAtMs,
      samples,
      jumpPresses: this.jumpPresses,
      dashPresses: this.dashPresses,
      inputSwitches: this.inputSwitches,
      stationaryMs: this.stationaryMs,
      maxSpeed: Math.max(...speeds),
      averageSpeed: speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length,
      deaths: samples[samples.length - 1].deaths
    };

    this.samples = [];
    this.jumpPresses = 0;
    this.dashPresses = 0;
    this.inputSwitches = 0;
    this.stationaryMs = 0;
    this.startedAtMs = nowMs;
    this.nextFlushMs = nowMs + batchIntervalMs;

    return batch;
  }

  reset(nowMs = 0) {
    this.samples = [];
    this.startedAtMs = nowMs;
    this.lastSample = null;
    this.lastActions = null;
    this.jumpWasDown = false;
    this.dashWasDown = false;
    this.jumpPresses = 0;
    this.dashPresses = 0;
    this.inputSwitches = 0;
    this.stationaryMs = 0;
    this.nextFlushMs = nowMs + batchIntervalMs;
  }
}
