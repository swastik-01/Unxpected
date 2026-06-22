import Phaser from 'phaser';
import type { RenderLayer } from '../../game/types';

const textureSize = 96;

export function createGeneratedTextures(scene: Phaser.Scene) {
  makeBlock(scene, 'visual_neon_block', 0x244a78, 0x45d7ff);
  makeBlock(scene, 'visual_grass_block', 0x1c4934, 0x58f0a7);
  makeBlock(scene, 'visual_warning_block', 0x4a1d2a, 0xff4f6d);
  makeBlock(scene, 'visual_shadow_block', 0x1d2436, 0x9ca8bd);
  makeBlock(scene, 'visual_glitch_block', 0x251f52, 0xd46cff);
  makeCoinFrames(scene, 'visual_gold_coin', 0xffd166, 0xff8f3d, false);
  makeCoinFrames(scene, 'visual_corrupt_coin', 0xff4f6d, 0x45d7ff, true);
  makeProjectile(scene);
  makeRock(scene);
  makeHunter(scene);
  makeSpike(scene);
  makePortalFrames(scene);
  makeCheckpoint(scene);
  makePlayerFrames(scene);
  makeFxTextures(scene);
}

export function textureKeyFor(layer: RenderLayer) {
  return layer === 'transparent' ? 'visual_transparent' : layer;
}

function withGraphics(scene: Phaser.Scene, key: string, draw: (graphics: Phaser.GameObjects.Graphics) => void) {
  if (scene.textures.exists(key)) return;
  const graphics = scene.add.graphics();
  draw(graphics);
  graphics.generateTexture(key, textureSize, textureSize);
  graphics.destroy();
}

function makeBlock(scene: Phaser.Scene, key: string, fill: number, stroke: number) {
  withGraphics(scene, key, (graphics) => {
    graphics.fillStyle(fill, 1);
    graphics.fillRoundedRect(4, 12, 88, 70, 8);
    graphics.lineStyle(5, stroke, 0.8);
    graphics.strokeRoundedRect(4, 12, 88, 70, 8);
    graphics.fillStyle(0xffffff, 0.15);
    graphics.fillRect(11, 18, 74, 8);
  });
}

function makeCoinFrames(scene: Phaser.Scene, key: string, fill: number, stroke: number, corrupt: boolean) {
  for (let frame = 0; frame < 4; frame += 1) {
    const frameKey = frame === 0 ? key : `${key}_${frame}`;
    makeCoin(scene, frameKey, fill, stroke, frame, corrupt);
  }
}

function makeCoin(scene: Phaser.Scene, key: string, fill: number, stroke: number, frame: number, corrupt: boolean) {
  withGraphics(scene, key, (graphics) => {
    const squeeze = 1 - Math.abs(1.5 - frame) * 0.18;
    const radiusX = 31 * squeeze;
    graphics.fillStyle(fill, 1);
    graphics.fillEllipse(48, 48, radiusX * 2, 66);
    graphics.lineStyle(6, stroke, 0.9);
    graphics.strokeEllipse(48, 48, radiusX * 2, 66);
    graphics.lineStyle(3, 0xffffff, 0.42);
    graphics.strokeEllipse(48, 48, Math.max(8, radiusX * 1.25), 42);
    if (corrupt) {
      graphics.lineStyle(4, 0x45d7ff, 0.8);
      graphics.lineBetween(32, 32 + frame * 3, 62, 56 - frame * 2);
      graphics.lineStyle(2, 0xffffff, 0.45);
      graphics.lineBetween(56, 24, 40, 72);
    }
  });
}

function makeSpike(scene: Phaser.Scene) {
  withGraphics(scene, 'visual_spike', (graphics) => {
    graphics.fillStyle(0xff4f6d, 1);
    graphics.fillTriangle(10, 84, 48, 16, 86, 84);
    graphics.lineStyle(5, 0xffd166, 0.65);
    graphics.strokeTriangle(10, 84, 48, 16, 86, 84);
  });
}

function makeProjectile(scene: Phaser.Scene) {
  withGraphics(scene, 'visual_projectile', (graphics) => {
    graphics.fillStyle(0xff4f6d, 0.96);
    graphics.fillRoundedRect(8, 37, 70, 22, 11);
    graphics.fillStyle(0xffd166, 0.9);
    graphics.fillTriangle(76, 30, 92, 48, 76, 66);
    graphics.fillStyle(0xffffff, 0.78);
    graphics.fillRoundedRect(18, 43, 38, 10, 5);
    graphics.lineStyle(4, 0x111727, 0.9);
    graphics.strokeRoundedRect(8, 37, 70, 22, 11);
    graphics.lineStyle(3, 0x45d7ff, 0.72);
    graphics.lineBetween(3, 48, 18, 48);
  });
}

function makeRock(scene: Phaser.Scene) {
  withGraphics(scene, 'visual_rock', (graphics) => {
    graphics.fillStyle(0x2d3448, 1);
    graphics.fillCircle(48, 50, 35);
    graphics.fillStyle(0x59657a, 0.9);
    graphics.fillCircle(36, 38, 10);
    graphics.fillCircle(59, 56, 13);
    graphics.fillStyle(0x111727, 0.34);
    graphics.fillCircle(47, 51, 25);
    graphics.lineStyle(5, 0xffd166, 0.48);
    graphics.strokeCircle(48, 50, 35);
  });
}

function makeHunter(scene: Phaser.Scene) {
  withGraphics(scene, 'visual_hunter', (graphics) => {
    graphics.fillStyle(0x111727, 1);
    graphics.fillRoundedRect(22, 18, 52, 58, 14);
    graphics.fillStyle(0xff4f6d, 0.95);
    graphics.fillRoundedRect(26, 22, 44, 50, 12);
    graphics.fillStyle(0x070914, 1);
    graphics.fillRoundedRect(32, 34, 32, 14, 7);
    graphics.fillStyle(0xffd166, 1);
    graphics.fillCircle(40, 41, 4);
    graphics.fillCircle(56, 41, 4);
    graphics.lineStyle(6, 0x111727, 1);
    graphics.lineBetween(24, 70, 12, 84);
    graphics.lineBetween(72, 70, 84, 84);
    graphics.lineStyle(3, 0x45d7ff, 0.72);
    graphics.lineBetween(28, 58, 68, 58);
  });
}

function makePortalFrames(scene: Phaser.Scene) {
  for (let frame = 0; frame < 4; frame += 1) {
    const frameKey = frame === 0 ? 'visual_portal' : `visual_portal_${frame}`;
    withGraphics(scene, frameKey, (graphics) => {
      const pulse = frame * 2;
      graphics.lineStyle(9, 0x58f0a7, 0.92);
      graphics.strokeEllipse(48, 48, 46 + pulse, 76 - pulse);
      graphics.lineStyle(5, 0x45d7ff, 0.72);
      graphics.strokeEllipse(48, 48, 28 - frame, 58 + frame * 2);
      graphics.lineStyle(2, 0xd46cff, 0.45);
      graphics.strokeEllipse(48, 48, 62 - frame * 3, 42 + frame * 4);
    });
  }
}

function makeCheckpoint(scene: Phaser.Scene) {
  withGraphics(scene, 'visual_checkpoint', (graphics) => {
    graphics.fillStyle(0x45d7ff, 1);
    graphics.fillRect(42, 15, 10, 72);
    graphics.fillStyle(0xffd166, 1);
    graphics.fillTriangle(52, 18, 84, 31, 52, 44);
  });
}

function makePlayerFrames(scene: Phaser.Scene) {
  makePlayerFrame(scene, 'player', {
    bob: 0,
    lean: 0,
    visor: 0x45d7ff,
    leftArm: [[35, 40], [27, 50], [31, 60]],
    rightArm: [[61, 40], [69, 50], [65, 60]],
    leftLeg: [[42, 62], [39, 74], [34, 84]],
    rightLeg: [[54, 62], [57, 74], [62, 84]]
  });
  makePlayerFrame(scene, 'player_idle_1', {
    bob: -2,
    lean: -1,
    visor: 0x58f0a7,
    leftArm: [[35, 38], [28, 49], [32, 58]],
    rightArm: [[61, 38], [68, 48], [66, 57]],
    leftLeg: [[42, 60], [40, 73], [35, 84]],
    rightLeg: [[54, 60], [56, 73], [61, 84]]
  });
  makePlayerFrame(scene, 'player_run_0', {
    bob: 1,
    lean: 5,
    visor: 0x45d7ff,
    leftArm: [[36, 41], [25, 47], [22, 57]],
    rightArm: [[62, 40], [73, 52], [79, 58]],
    leftLeg: [[42, 63], [34, 73], [27, 82]],
    rightLeg: [[54, 63], [64, 72], [73, 83]]
  });
  makePlayerFrame(scene, 'player_run_1', {
    bob: -1,
    lean: 3,
    visor: 0x58f0a7,
    leftArm: [[36, 39], [30, 52], [34, 61]],
    rightArm: [[62, 39], [67, 51], [64, 62]],
    leftLeg: [[42, 61], [43, 73], [39, 84]],
    rightLeg: [[54, 61], [53, 73], [57, 84]]
  });
  makePlayerFrame(scene, 'player_run_2', {
    bob: 1,
    lean: -5,
    visor: 0x45d7ff,
    leftArm: [[34, 40], [23, 52], [17, 58]],
    rightArm: [[60, 41], [71, 47], [74, 57]],
    leftLeg: [[42, 63], [32, 72], [23, 83]],
    rightLeg: [[54, 63], [62, 73], [69, 82]]
  });
  makePlayerFrame(scene, 'player_run_3', {
    bob: -1,
    lean: -3,
    visor: 0x58f0a7,
    leftArm: [[34, 39], [29, 51], [32, 62]],
    rightArm: [[60, 39], [66, 52], [62, 61]],
    leftLeg: [[42, 61], [41, 73], [37, 84]],
    rightLeg: [[54, 61], [55, 73], [60, 84]]
  });
  makePlayerFrame(scene, 'player_jump', {
    bob: -7,
    lean: 1,
    visor: 0xffd166,
    leftArm: [[35, 33], [26, 23], [24, 12]],
    rightArm: [[61, 33], [70, 23], [72, 12]],
    leftLeg: [[42, 55], [35, 66], [31, 75]],
    rightLeg: [[54, 55], [62, 66], [68, 75]]
  });
  makePlayerFrame(scene, 'player_dash', {
    bob: 0,
    lean: 12,
    visor: 0x45d7ff,
    leftArm: [[38, 41], [25, 44], [14, 48]],
    rightArm: [[64, 40], [50, 50], [39, 57]],
    leftLeg: [[44, 62], [31, 68], [20, 74]],
    rightLeg: [[56, 62], [44, 74], [34, 84]]
  });
  makeBrokenPlayerFrame(scene, 'player_death');

  withGraphics(scene, 'visual_transparent', (graphics) => {
    graphics.fillStyle(0xffffff, 0.001);
    graphics.fillRect(0, 0, textureSize, textureSize);
  });
}

type LimbPoint = [number, number];

interface PlayerPose {
  bob: number;
  lean: number;
  visor: number;
  leftArm: [LimbPoint, LimbPoint, LimbPoint];
  rightArm: [LimbPoint, LimbPoint, LimbPoint];
  leftLeg: [LimbPoint, LimbPoint, LimbPoint];
  rightLeg: [LimbPoint, LimbPoint, LimbPoint];
}

function makePlayerFrame(scene: Phaser.Scene, key: string, pose: PlayerPose) {
  withGraphics(scene, key, (graphics) => {
    const shifted = (points: [LimbPoint, LimbPoint, LimbPoint]) =>
      points.map(([x, y]) => [x + pose.lean * 0.16, y + pose.bob] as LimbPoint) as [LimbPoint, LimbPoint, LimbPoint];

    drawLimb(graphics, shifted(pose.leftLeg), 0x45d7ff, true);
    drawLimb(graphics, shifted(pose.rightLeg), 0x58f0a7, true);
    drawLimb(graphics, shifted(pose.leftArm), 0xd8ffe8, false);
    drawLimb(graphics, shifted(pose.rightArm), 0xd8ffe8, false);

    const bodyX = 34 + pose.lean * 0.2;
    const bodyY = 28 + pose.bob;
    const headX = 31 + pose.lean * 0.3;
    const headY = 8 + pose.bob;

    graphics.fillStyle(0x111727, 1);
    graphics.fillRoundedRect(bodyX - 2, bodyY - 2, 32, 43, 11);
    graphics.fillStyle(0xf5f8ff, 1);
    graphics.fillRoundedRect(bodyX, bodyY, 28, 39, 10);
    graphics.fillStyle(0xb8c4d9, 0.82);
    graphics.fillRoundedRect(bodyX + 10, bodyY + 22, 9, 14, 4);
    graphics.fillStyle(0x111727, 1);
    graphics.fillRoundedRect(headX - 2, headY - 2, 34, 30, 10);
    graphics.fillStyle(0xf5f8ff, 1);
    graphics.fillRoundedRect(headX, headY, 30, 26, 9);
    graphics.fillStyle(0x111727, 1);
    graphics.fillRoundedRect(headX + 5, headY + 7, 21, 13, 5);
    graphics.fillStyle(pose.visor, 1);
    graphics.fillRoundedRect(headX + 9, headY + 10, 14, 7, 3);
    graphics.fillStyle(0xffffff, 0.46);
    graphics.fillRect(headX + 12, headY + 11, 6, 2);
  });
}

function drawLimb(graphics: Phaser.GameObjects.Graphics, points: [LimbPoint, LimbPoint, LimbPoint], color: number, foot: boolean) {
  const [start, mid, end] = points;
  graphics.lineStyle(9, 0x111727, 1);
  graphics.lineBetween(start[0], start[1], mid[0], mid[1]);
  graphics.lineBetween(mid[0], mid[1], end[0], end[1]);
  graphics.fillStyle(0x111727, 1);
  graphics.fillCircle(end[0], end[1], foot ? 6 : 5);

  graphics.lineStyle(5, color, 1);
  graphics.lineBetween(start[0], start[1], mid[0], mid[1]);
  graphics.lineBetween(mid[0], mid[1], end[0], end[1]);
  graphics.fillStyle(color, 1);
  graphics.fillCircle(end[0], end[1], foot ? 4 : 3.5);
  if (foot) {
    graphics.fillStyle(0xf5f8ff, 0.94);
    graphics.fillRoundedRect(end[0] - 7, end[1] - 1, 14, 6, 3);
  }
}

function makeBrokenPlayerFrame(scene: Phaser.Scene, key: string) {
  withGraphics(scene, key, (graphics) => {
    graphics.fillStyle(0xf5f8ff, 0.95);
    graphics.fillRoundedRect(18, 18, 22, 24, 7);
    graphics.fillRoundedRect(51, 19, 27, 22, 7);
    graphics.fillRoundedRect(30, 50, 36, 25, 8);
    graphics.lineStyle(7, 0x111727, 0.92);
    graphics.lineBetween(20, 61, 12, 78);
    graphics.lineBetween(64, 58, 82, 75);
    graphics.lineBetween(24, 44, 12, 34);
    graphics.lineBetween(72, 44, 84, 33);
    graphics.fillStyle(0xff4f6d, 1);
    graphics.fillCircle(12, 78, 5);
    graphics.fillCircle(82, 75, 5);
    graphics.fillStyle(0xd8ffe8, 1);
    graphics.fillCircle(12, 34, 4);
    graphics.fillCircle(84, 33, 4);
    graphics.lineStyle(4, 0xff4f6d, 0.9);
    graphics.lineBetween(23, 21, 73, 79);
    graphics.lineBetween(70, 18, 24, 80);
    graphics.lineStyle(3, 0x45d7ff, 0.65);
    graphics.lineBetween(30, 37, 78, 34);
  });
}

function makeFxTextures(scene: Phaser.Scene) {
  withGraphics(scene, 'fx_spark', (graphics) => {
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(48, 48, 10);
    graphics.lineStyle(4, 0x45d7ff, 0.85);
    graphics.strokeCircle(48, 48, 15);
  });

  withGraphics(scene, 'fx_dust', (graphics) => {
    graphics.fillStyle(0xc8d7ef, 0.72);
    graphics.fillCircle(48, 48, 18);
  });

  withGraphics(scene, 'fx_dash', (graphics) => {
    graphics.fillStyle(0x45d7ff, 0.9);
    graphics.fillTriangle(14, 48, 82, 18, 82, 78);
    graphics.fillStyle(0x58f0a7, 0.55);
    graphics.fillTriangle(28, 48, 88, 30, 88, 66);
  });

  withGraphics(scene, 'fx_glitch', (graphics) => {
    graphics.fillStyle(0xd46cff, 0.95);
    graphics.fillRect(24, 28, 48, 14);
    graphics.fillStyle(0x45d7ff, 0.82);
    graphics.fillRect(34, 50, 30, 12);
    graphics.fillStyle(0xff4f6d, 0.7);
    graphics.fillRect(18, 66, 60, 8);
  });

  withGraphics(scene, 'fx_warning_ring', (graphics) => {
    graphics.lineStyle(6, 0xffd166, 0.95);
    graphics.strokeCircle(48, 48, 32);
    graphics.lineStyle(2, 0xffffff, 0.6);
    graphics.strokeCircle(48, 48, 42);
  });

  withGraphics(scene, 'fx_scanline', (graphics) => {
    graphics.fillStyle(0x45d7ff, 0.16);
    graphics.fillRect(0, 0, 96, 2);
    graphics.fillStyle(0xffffff, 0.05);
    graphics.fillRect(0, 6, 96, 1);
  });
}
