import Phaser from 'phaser';
import { ProceduralAudio } from '../../game/audio/ProceduralAudio';
import { createOpeningLevel } from '../../game/content/levelFactory';
import { InputController } from '../../game/input/InputController';
import { defaultAccessibility, defaultLoadout } from '../../game/progression/metaProgression';
import { createRunSummary } from '../../game/scoring/runSummary';
import { AdaptiveDirector } from '../../game/simulation/adaptiveDirector';
import { TelemetryBuffer } from '../../game/simulation/telemetry';
import { readBestScore, writeBestDeaths, writeBestScore } from '../../game/storage';
import type {
  ActionState,
  AccessibilitySettings,
  CollisionMask,
  CosmeticLoadout,
  DailyAnomaly,
  DirectorDecision,
  DeathEffectId,
  DynamicLevelSchema,
  EntitySchema,
  HudSnapshot,
  MenuMode,
  MutationEvent,
  PlayerProfile,
  PortalEffectId,
  SkinId,
  TrailId,
  TutorialSnapshot
} from '../../game/types';
import { createGeneratedTextures, textureKeyFor } from '../view/TextureFactory';

export interface GameSceneConfig {
  accessibility?: AccessibilitySettings;
  cosmetics?: CosmeticLoadout;
  dailyAnomaly?: DailyAnomaly;
  input: InputController;
  aggression: number;
  levelIndex: number;
  mode: MenuMode;
}

type PlayerAnimKey = 'player-dash' | 'player-death' | 'player-idle' | 'player-jump' | 'player-run';

interface RuntimeEntity {
  originalSchema: EntitySchema;
  reactivateAt: number;
  rebuildTimer: Phaser.Time.TimerEvent | null;
  schema: EntitySchema;
  sprite: Phaser.Physics.Arcade.Sprite;
  triggered: boolean;
  telegraphStartedAt: number | null;
  telegraphTween: Phaser.Tweens.Tween | null;
}

interface PhysicsDebugSnapshot {
  player: {
    animation: PlayerAnimKey | '';
    textureKey: string;
    visible: boolean;
    flipX: boolean;
    x: number;
    y: number;
    vx: number;
    vy: number;
    onGround: boolean;
    bodyBottom: number;
    bodyHeight: number;
    bodyTop: number;
    blockedDown: boolean;
    touchingDown: boolean;
  };
  deaths: number;
  coins: number;
  weaponCharges: number;
  actions: ActionState;
  checkpointIndex: number;
  checkpoint: {
    x: number;
    y: number;
  };
  run: {
    elapsedMs: number;
    mutationsSurvived: number;
    runComplete: boolean;
    totalCoins: number;
  };
  profile: PlayerProfile;
  entities: Record<string, {
    x: number;
    y: number;
    vx: number;
    vy: number;
    mask: CollisionMask;
    alpha: number;
    bodyEnabled: boolean;
    bodyType: 'dynamic' | 'static' | 'none';
    active: boolean;
    visible: boolean;
    triggered: boolean;
  }>;
}

declare global {
  interface Window {
    __PARADOX_DEBUG__?: {
      completeRun: () => void;
      forceMutation: (entityId: string) => boolean;
      killPlayer: (reason?: string) => void;
      setPlayerVelocity: (x: number, y: number) => void;
      setProfile: (profile: PlayerProfile) => void;
      setStationaryMs: (ms: number) => void;
      snapshot: () => PhysicsDebugSnapshot;
      teleportPlayer: (x: number, y: number) => void;
    };
  }
}

const playerStart = { x: 120, y: 560 };
const coyoteTimeMs = 120;
const dashCooldownMs = 720;
const dashSpeed = 540;
const jumpBufferMs = 140;
const jumpCutVelocity = -210;
const jumpVelocity = -540;
const tutorialStorageKey = 'unxpected:tutorial-complete';

const skinTints: Record<SkinId, number | null> = {
  neon: null,
  signal: 0xffe29a,
  void: 0xd7b8ff,
  paradox: 0xff9eb1
};

const trailPalettes: Record<TrailId, { primary: number; secondary: number }> = {
  ion: { primary: 0x45d7ff, secondary: 0x58f0a7 },
  data: { primary: 0x58f0a7, secondary: 0xd8ffe8 },
  warning: { primary: 0xffd166, secondary: 0xff4f6d },
  paradox: { primary: 0xd46cff, secondary: 0xff4f6d }
};

const deathPalettes: Record<DeathEffectId, { primary: number; secondary: number; texture: string }> = {
  glitch: { primary: 0xd46cff, secondary: 0x45d7ff, texture: 'fx_glitch' },
  fracture: { primary: 0xffd166, secondary: 0xff4f6d, texture: 'fx_warning_ring' },
  static: { primary: 0x45d7ff, secondary: 0xf5f8ff, texture: 'fx_glitch' },
  nova: { primary: 0x58f0a7, secondary: 0xf5f8ff, texture: 'fx_spark' }
};

const portalPalettes: Record<PortalEffectId, { primary: number; secondary: number; texture: string }> = {
  clean: { primary: 0x58f0a7, secondary: 0x45d7ff, texture: 'fx_spark' },
  daily: { primary: 0xffd166, secondary: 0x45d7ff, texture: 'fx_warning_ring' },
  singularity: { primary: 0xd46cff, secondary: 0x45d7ff, texture: 'fx_glitch' },
  paradox: { primary: 0xff4f6d, secondary: 0xd46cff, texture: 'fx_glitch' }
};

type TutorialStepId = 'move' | 'jump' | 'dash' | 'coin' | 'warning' | 'complete';

interface TutorialStepDefinition {
  body: string;
  id: TutorialStepId;
  objective: string;
  title: string;
  tone: TutorialSnapshot['tone'];
}

const tutorialSteps: TutorialStepDefinition[] = [
  {
    id: 'move',
    title: 'Start moving',
    body: 'Move right and let the camera pull you into the level.',
    objective: 'Objective: hold the right arrow or right touch button',
    tone: 'info'
  },
  {
    id: 'jump',
    title: 'Control your jump',
    body: 'Hold jump for height or tap it for a shorter hop. The game buffers late presses.',
    objective: 'Objective: jump once',
    tone: 'info'
  },
  {
    id: 'dash',
    title: 'Use dash deliberately',
    body: 'Dash gives a sharp burst and then recharges on the HUD meter.',
    objective: 'Objective: press Dash',
    tone: 'info'
  },
  {
    id: 'coin',
    title: 'Collect route value',
    body: 'Coins improve your run score later. Some objects can change meaning after a warning.',
    objective: 'Objective: collect the first coin',
    tone: 'success'
  },
  {
    id: 'warning',
    title: 'Read the warning pulse',
    body: 'A warning pulse means the AI is changing the route. Keep moving, jump, or dash before it lands.',
    objective: 'Objective: survive one AI change',
    tone: 'warning'
  },
  {
    id: 'complete',
    title: 'Route synced',
    body: 'You now know the core loop: move, jump, dash, collect, read warnings, and survive the AI route changes.',
    objective: 'Objective: finish the run through the portal',
    tone: 'success'
  }
];

export class GameScene extends Phaser.Scene {
  private level!: DynamicLevelSchema;
  private originalLevel!: DynamicLevelSchema;
  private director!: AdaptiveDirector;
  private telemetry = new TelemetryBuffer();
  private audio = new ProceduralAudio();
  private player!: Phaser.Physics.Arcade.Sprite;
  private entities = new Map<string, RuntimeEntity>();
  private solidGroup!: Phaser.Physics.Arcade.StaticGroup;
  private dynamicSolidGroup!: Phaser.Physics.Arcade.Group;
  private hazardGroup!: Phaser.Physics.Arcade.Group;
  private collectibleGroup!: Phaser.Physics.Arcade.Group;
  private playerShotGroup!: Phaser.Physics.Arcade.Group;
  private checkpointGroup!: Phaser.Physics.Arcade.Group;
  private goalGroup!: Phaser.Physics.Arcade.Group;
  private actions: ActionState = { left: false, right: false, jump: false, dash: false, down: false };
  private currentDecision!: DirectorDecision;
  private adaptationLog: string[] = [];
  private deaths = 0;
  private checkpointIndex = 0;
  private checkpoint = playerStart;
  private coins = 0;
  private mutationsSurvived = 0;
  private pausedByUi = false;
  private respawnAt = 0;
  private respawning = false;
  private routeStartedAt = 0;
  private runComplete = false;
  private runStartedAt = 0;
  private totalCoins = 0;
  private lastHudAt = 0;
  private stationaryMs = 0;
  private lastActionTimeMs = 0;
  private dashReadyAt = 0;
  private lastDashDeniedAt = -Infinity;
  private lastShotAt = -Infinity;
  private dashVisualUntil = 0;
  private dashUsedThisRun = false;
  private weaponCharges = 0;
  private jumpBufferedUntil = 0;
  private jumpCutAvailable = false;
  private jumpUsedThisRun = false;
  private lastAirVelocityY = 0;
  private lastGroundedAt = 0;
  private playerAnimKey: PlayerAnimKey | '' = '';
  private profileDecisionReady = false;
  private reducedMotion = false;
  private scanlineLayer: Phaser.GameObjects.TileSprite | null = null;
  private tutorialCompleteHideAt = 0;
  private tutorialEnabled = false;
  private tutorialLastStepIndex = -1;
  private tutorialMutationSeen = false;
  private tutorialStepIndex = 0;
  private tutorialWarningSeenAt = 0;
  private tutorialWasCompleted = false;
  private tutorialSkipHandler: (() => void) | null = null;

  constructor(private readonly sceneConfig: GameSceneConfig) {
    super('GameScene');
  }

  create() {
    createGeneratedTextures(this);
    this.createAnimations();
    const accessibility = this.getAccessibility();
    this.reducedMotion = accessibility.reducedMotion || (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
    this.audio.setMuted(!accessibility.audioEnabled);
    this.audio.unlock();
    this.originalLevel = createOpeningLevel(this.sceneConfig.mode, this.sceneConfig.aggression, this.sceneConfig.dailyAnomaly, this.sceneConfig.levelIndex);
    this.level = structuredClone(this.originalLevel);
    this.director = new AdaptiveDirector(this.sceneConfig.aggression);
    this.adaptationLog = [];
    this.mutationsSurvived = 0;
    this.weaponCharges = 0;
    this.lastShotAt = -Infinity;
    this.runStartedAt = this.time.now;
    this.routeStartedAt = this.runStartedAt;
    this.profileDecisionReady = false;
    this.totalCoins = this.level.entities.filter((entity) => entity.base_type === 'collectible').length;
    this.currentDecision = {
      profile: 'Balanced',
      notice: 'AI is watching your run.',
      trust: 1,
      inputHijack: this.level.input_hijack,
      environment: this.level.global_environment,
      mutationBias: ['semantic_scramble'],
      logEntries: ['AI online']
    };
    this.audio.startMusic(this.getMusicIntensity());

    this.solidGroup = this.physics.add.staticGroup();
    this.dynamicSolidGroup = this.physics.add.group({ allowGravity: false, immovable: true });
    this.hazardGroup = this.physics.add.group({ allowGravity: false, immovable: true });
    this.collectibleGroup = this.physics.add.group({ allowGravity: false, immovable: true });
    this.playerShotGroup = this.physics.add.group({ allowGravity: false, immovable: false });
    this.checkpointGroup = this.physics.add.group({ allowGravity: false, immovable: true });
    this.goalGroup = this.physics.add.group({ allowGravity: false, immovable: true });

    this.createWorld();
    this.createPlayer();
    this.bindCollisions();
    this.configureCamera();
    this.emitHud('Run started');
    this.installDebugApi();
    this.setupTutorial();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.audio.stopMusic());
  }

  update(time: number, delta: number) {
    if (this.pausedByUi || this.runComplete) return;

    if (this.respawning) {
      this.updateWorldEffects(delta);
      if (this.respawnAt > 0 && time >= this.respawnAt) this.respawnPlayer();
      this.updatePlayerPresentation(time);
      return;
    }

    this.actions = this.sceneConfig.input.snapshot(this.level.input_hijack, time);
    this.applyPlayerInput(time, delta);
    this.trackStationary(delta);
    this.checkMutationTriggers(time);
    this.sampleTelemetry(time);
    this.applyDirector(time);
    this.keepPlayerInBounds();
    this.updateWorldEffects(delta);
    this.updatePlayerPresentation(time);
    this.updateTutorial(time);

    if (time - this.lastHudAt > 160) {
      this.emitHud(this.currentDecision.notice);
      this.lastHudAt = time;
    }
  }

  setPaused(paused: boolean) {
    this.pausedByUi = paused;
    if (paused) {
      this.sceneConfig.input.releaseAll();
      this.physics.pause();
      this.audio.stopMusic();
      return;
    }

    this.physics.resume();
    this.audio.startMusic(this.getMusicIntensity());
    this.audio.setMusicIntensity(this.getMusicIntensity());
  }

  private getAccessibility() {
    return this.sceneConfig.accessibility ?? defaultAccessibility;
  }

  private getLoadout() {
    return this.sceneConfig.cosmetics ?? defaultLoadout;
  }

  private getWarningTint() {
    return this.getAccessibility().colorSafeWarnings ? 0x2dd4bf : 0xffd166;
  }

  private getMusicIntensity() {
    return Phaser.Math.Clamp(
      0.24 + this.sceneConfig.aggression * 0.42 + this.mutationsSurvived * 0.055 + (1 - this.currentDecision.trust) * 0.28,
      0.18,
      0.92
    );
  }

  private createAnimations() {
    this.registerAnimation('player-idle', ['player', 'player_idle_1'], 4, -1);
    this.registerAnimation('player-run', ['player_run_0', 'player_run_1', 'player_run_2', 'player_run_3'], 14, -1);
    this.registerAnimation('player-jump', ['player_jump'], 1, -1);
    this.registerAnimation('player-dash', ['player_dash'], 1, -1);
    this.registerAnimation('player-death', ['player_death'], 1, -1);
    this.registerAnimation('coin-spin', ['visual_gold_coin', 'visual_gold_coin_1', 'visual_gold_coin_2', 'visual_gold_coin_3'], 10, -1);
    this.registerAnimation(
      'coin-corrupt',
      ['visual_corrupt_coin', 'visual_corrupt_coin_1', 'visual_corrupt_coin_2', 'visual_corrupt_coin_3'],
      14,
      -1
    );
    this.registerAnimation('portal-pulse', ['visual_portal', 'visual_portal_1', 'visual_portal_2', 'visual_portal_3'], 7, -1);
  }

  private registerAnimation(key: string, textureKeys: string[], frameRate: number, repeat: number) {
    if (this.anims.exists(key)) return;
    this.anims.create({
      key,
      frames: textureKeys.map((frameKey) => ({ key: frameKey })),
      frameRate,
      repeat
    });
  }

  private createWorld() {
    this.cameras.main.setBackgroundColor('#070914');
    this.addParallax();
    this.createWorldEffects();
    this.createRuntimeEntities();
  }

  private createRuntimeEntities() {
    for (const schema of this.level.entities) {
      const sprite = this.physics.add.sprite(
        schema.transform.x + schema.transform.width / 2,
        schema.transform.y + schema.transform.height / 2,
        textureKeyFor(schema.render_layer)
      );

      sprite.displayWidth = schema.transform.width;
      sprite.displayHeight = schema.transform.height;
      sprite.setName(schema.entity_id);
      sprite.setImmovable(true);
      sprite.setData('entity_id', schema.entity_id);
      sprite.body?.setSize(schema.transform.width, schema.transform.height, true);

      const runtime: RuntimeEntity = {
        originalSchema: structuredClone(schema),
        reactivateAt: 0,
        rebuildTimer: null,
        schema: structuredClone(schema),
        sprite,
        triggered: false,
        telegraphStartedAt: null,
        telegraphTween: null
      };

      this.entities.set(schema.entity_id, runtime);
      this.assignCollision(runtime, schema.collision_mask);
      if (schema.render_layer === 'transparent') sprite.setAlpha(0.001);
      this.applyEntityPresentation(runtime);
    }
  }

  private createPlayer() {
    this.player = this.physics.add.sprite(playerStart.x, playerStart.y, 'player');
    this.player.setDepth(20);
    this.player.setDisplaySize(42, 56);
    this.player.setCollideWorldBounds(false);
    this.player.setMaxVelocity(620, 980);
    this.player.setDragX(1450);
    this.player.body?.setSize(34, 52, true);
    this.applyPlayerTint();
    this.playPlayerAnimation('player-idle');
  }

  private bindCollisions() {
    this.physics.add.collider(this.player, this.solidGroup);
    this.physics.add.collider(this.player, this.dynamicSolidGroup);
    this.physics.add.overlap(this.player, this.hazardGroup, () => this.killPlayer('Hazard collision'));
    this.physics.add.overlap(this.player, this.collectibleGroup, (_, object) => {
      const sprite = object as Phaser.Physics.Arcade.Sprite;
      const entity = this.entities.get(sprite.getData('entity_id'));
      if (!entity || entity.schema.collision_mask !== 'trigger_pickup') return;
      this.coins += 1;
      this.spawnPickupBurst(sprite.x, sprite.y);
      if (entity.schema.behavior === 'weapon_pickup') {
        this.weaponCharges = Math.max(this.weaponCharges, 3);
        this.currentDecision.notice = 'Blaster charged: shoot hunters with the Shoot button.';
        this.spawnFloatText('Blaster +3', sprite.x, sprite.y - 30, '#45d7ff');
        this.audio.play('mutation');
        this.emitHud(this.currentDecision.notice);
      } else {
        this.spawnFloatText('+1', sprite.x, sprite.y - 28, '#ffd166');
        this.audio.play('coin');
      }
      sprite.disableBody(true, true);
      entity.schema.collision_mask = 'sensor';
      this.flashCamera(0x58f0a7, 90);
    });
    this.physics.add.overlap(this.playerShotGroup, this.hazardGroup, (shotObject, hazardObject) => {
      this.handlePlayerShotHit(shotObject as Phaser.Physics.Arcade.Sprite, hazardObject as Phaser.Physics.Arcade.Sprite);
    });
    this.physics.add.overlap(this.player, this.goalGroup, () => this.finishRun());
  }

  private configureCamera() {
    this.cameras.main.setBounds(0, 0, 4300, 720);
    this.physics.world.setBounds(0, 0, 4300, 980);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12, -180, 120);
  }

  private addParallax() {
    const back = this.add.graphics();
    back.setDepth(-40);
    back.fillStyle(0x0d1526, 1);
    back.fillRect(0, 0, 4300, 720);
    back.fillStyle(0x111d31, 1);
    for (let i = 0; i < 42; i += 1) {
      const x = i * 124 + (i % 3) * 36;
      const h = 90 + (i % 5) * 36;
      back.fillRect(x, 720 - h, 70 + (i % 4) * 24, h);
    }
    back.lineStyle(2, 0x45d7ff, 0.16);
    for (let i = 0; i < 28; i += 1) {
      back.lineBetween(i * 170, 90 + (i % 6) * 33, i * 170 + 80, 70 + (i % 5) * 40);
    }
    back.setScrollFactor(0.28, 0.18);

    const mid = this.add.graphics();
    mid.setDepth(-30);
    mid.lineStyle(1, 0x58f0a7, 0.16);
    for (let i = 0; i < 34; i += 1) {
      const x = i * 138 + (i % 4) * 23;
      mid.lineBetween(x, 130 + (i % 5) * 44, x, 190 + (i % 6) * 36);
    }
    mid.lineStyle(3, 0xd46cff, 0.12);
    for (let i = 0; i < 18; i += 1) {
      const x = 90 + i * 238;
      mid.lineBetween(x, 250 + (i % 3) * 38, x + 64, 252 + (i % 4) * 42);
    }
    mid.setScrollFactor(0.42, 0.28);
  }

  private createWorldEffects() {
    this.scanlineLayer = this.add.tileSprite(0, 0, 1280, 720, 'fx_scanline');
    this.scanlineLayer.setOrigin(0, 0);
    this.scanlineLayer.setScrollFactor(0);
    this.scanlineLayer.setDepth(85);
    this.scanlineLayer.setAlpha(this.reducedMotion ? 0.05 : 0.11);
    this.scanlineLayer.setBlendMode(Phaser.BlendModes.ADD);
  }

  private updateWorldEffects(delta: number) {
    if (this.scanlineLayer && !this.reducedMotion) {
      this.scanlineLayer.tilePositionY += delta * 0.018;
    }
    this.cleanupPlayerShots();
    this.updateAdaptiveHazards(delta);
  }

  private cleanupPlayerShots() {
    for (const shot of this.playerShotGroup.getChildren()) {
      const sprite = shot as Phaser.Physics.Arcade.Sprite;
      if (sprite.x < -80 || sprite.x > 4380 || sprite.y < -80 || sprite.y > 900) sprite.destroy();
    }
  }

  private updateAdaptiveHazards(delta: number) {
    for (const runtime of this.entities.values()) {
      if (!runtime.triggered) continue;
      const body = runtime.sprite.body as Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | null;
      const dynamicBody = body instanceof Phaser.Physics.Arcade.Body ? body : null;

      if ((runtime.schema.behavior === 'rolling_hazard' || runtime.schema.behavior === 'sky_fall') && dynamicBody) {
        runtime.sprite.angle += dynamicBody.velocity.x * delta * 0.0014;
      }

      if (runtime.schema.behavior === 'hunter_chase' && dynamicBody && runtime.schema.collision_mask === 'lethal_hazard') {
        const distance = this.player.x - runtime.sprite.x;
        const speed = Phaser.Math.Clamp(Math.abs(distance) * 0.42, 95, 188 + this.sceneConfig.levelIndex * 1.4);
        dynamicBody.setVelocityX(Math.sign(distance || -1) * speed);
        dynamicBody.setVelocityY(0);
      }
    }
  }

  private applyEntityPresentation(runtime: RuntimeEntity) {
    const { sprite, schema } = runtime;
    sprite.setDepth(this.depthForEntity(schema.base_type));

    if (schema.base_type === 'collectible') {
      sprite.play(schema.render_layer === 'visual_corrupt_coin' ? 'coin-corrupt' : 'coin-spin', true);
    }

    if (schema.base_type === 'goal') {
      sprite.play('portal-pulse', true);
      sprite.setBlendMode(Phaser.BlendModes.ADD);
    }

    if (schema.base_type === 'hazard') {
      sprite.setBlendMode(Phaser.BlendModes.NORMAL);
      if (!this.reducedMotion) {
        this.tweens.add({
          targets: sprite,
          scaleX: 1.06,
          scaleY: 1.06,
          duration: 520,
          ease: 'Sine.easeInOut',
          repeat: -1,
          yoyo: true
        });
      }
    }
  }

  private depthForEntity(type: EntitySchema['base_type']) {
    if (type === 'collectible' || type === 'checkpoint' || type === 'goal') return 12;
    if (type === 'hazard') return 11;
    if (type === 'decor') return -10;
    return 4;
  }

  private applyPlayerInput(time: number, delta: number) {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const dt = delta / 1000;
    const speed = 282;
    const gravityX = this.level.global_environment.gravity_vector.x;
    const friction = this.level.global_environment.friction_multiplier;
    const grounded = this.isPlayerGrounded(body);

    this.physics.world.gravity.y = this.level.global_environment.gravity_vector.y;
    this.player.setDragX(1450 * friction);
    if (grounded) this.lastGroundedAt = time;

    if (this.actions.left) body.setVelocityX(-speed);
    if (this.actions.right) body.setVelocityX(speed);
    if (gravityX !== 0) body.setVelocityX(body.velocity.x + gravityX * dt);

    const jumpPressed = this.sceneConfig.input.consumeJumpPressed(this.actions);
    if (jumpPressed) {
      this.jumpBufferedUntil = time + jumpBufferMs;
    }

    if (this.jumpBufferedUntil >= time && time - this.lastGroundedAt <= coyoteTimeMs) {
      body.setVelocityY(jumpVelocity);
      this.jumpBufferedUntil = 0;
      this.lastGroundedAt = -Infinity;
      this.jumpCutAvailable = true;
      this.jumpUsedThisRun = true;
      this.lastActionTimeMs = this.time.now;
      this.spawnLandingDust(this.player.x, body.bottom, 0.72);
      this.audio.play('jump');
    }

    if (!this.actions.jump && this.jumpCutAvailable && body.velocity.y < jumpCutVelocity) {
      body.setVelocityY(jumpCutVelocity);
      this.jumpCutAvailable = false;
    }

    if (grounded || body.velocity.y >= 0) this.jumpCutAvailable = false;

    const dashPressed = this.sceneConfig.input.consumeDashPressed(this.actions);
    if (dashPressed && time >= this.dashReadyAt) {
      const direction = this.actions.left ? -1 : this.actions.right ? 1 : body.velocity.x < 0 ? -1 : 1;
      body.setVelocityX(direction * dashSpeed);
      if (!grounded) body.setVelocityY(Math.min(body.velocity.y, -70));
      this.dashReadyAt = time + dashCooldownMs;
      this.dashVisualUntil = time + 260;
      this.dashUsedThisRun = true;
      this.lastActionTimeMs = this.time.now;
      this.spawnDashTrail(direction);
      this.audio.play('dash');
      this.shakeCamera(0.0024, 70);
      this.flashCamera(0x45d7ff, 55);
    } else if (dashPressed && time - this.lastDashDeniedAt > 260) {
      this.lastDashDeniedAt = time;
      this.spawnFloatText('Dash charging', this.player.x, this.player.y - 46, '#ffd166');
      this.flashCamera(0xffd166, 28);
    }

    const shootPressed = this.sceneConfig.input.consumeDownPressed(this.actions);
    if (shootPressed) {
      if (this.weaponCharges > 0 && time - this.lastShotAt > 240) {
        this.firePlayerShot();
        this.weaponCharges -= 1;
        this.lastShotAt = time;
      } else if (this.sceneConfig.levelIndex >= 61 && time - this.lastShotAt > 360) {
        this.lastShotAt = time;
        this.spawnFloatText('No charge', this.player.x, this.player.y - 54, '#9ca8bd');
      }
    }
  }

  private firePlayerShot() {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const direction = this.player.flipX || body.velocity.x < -30 ? -1 : 1;
    const shot = this.physics.add.sprite(this.player.x + direction * 34, this.player.y - 4, 'visual_projectile');
    shot.setDepth(14);
    shot.setDisplaySize(58, 17);
    shot.setFlipX(direction < 0);
    shot.body?.setSize(58, 17, true);
    shot.body?.setAllowGravity(false);
    shot.setVelocity(direction * 720, 0);
    shot.setData('player_shot', true);
    this.playerShotGroup.add(shot, true);
    this.time.delayedCall(90, () => this.neutralizeNearestHunter(direction));
    this.spawnDashTrail(direction);
    this.flashCamera(0x45d7ff, 42);
    this.audio.play('dash');
  }

  private handlePlayerShotHit(shot: Phaser.Physics.Arcade.Sprite, target: Phaser.Physics.Arcade.Sprite) {
    if (!shot.active) return;
    const runtime = this.entities.get(target.getData('entity_id'));
    shot.destroy();
    if (!runtime || runtime.schema.render_layer !== 'visual_hunter') return;
    this.neutralizeHunter(runtime);
  }

  private neutralizeNearestHunter(direction: number) {
    const candidates = [...this.entities.values()]
      .filter((runtime) => (
        runtime.schema.render_layer === 'visual_hunter'
        && runtime.schema.collision_mask === 'lethal_hazard'
        && runtime.sprite.visible
        && (runtime.sprite.x - this.player.x) * direction > 0
        && Math.abs(runtime.sprite.y - this.player.y) < 105
        && Math.abs(runtime.sprite.x - this.player.x) < 620
      ))
      .sort((a, b) => Math.abs(a.sprite.x - this.player.x) - Math.abs(b.sprite.x - this.player.x));

    if (candidates[0]) this.neutralizeHunter(candidates[0]);
  }

  private neutralizeHunter(runtime: RuntimeEntity) {
    this.removeFromGroups(runtime.sprite);
    runtime.schema.collision_mask = 'sensor';
    runtime.triggered = true;
    runtime.telegraphTween?.remove();
    runtime.telegraphTween = null;
    runtime.sprite.disableBody(true, true);
    this.spawnMutationBurst(runtime.sprite.x, runtime.sprite.y, true);
    this.spawnFloatText('Neutralized', runtime.sprite.x, runtime.sprite.y - 48, '#58f0a7');
    this.currentDecision.notice = 'Hunter neutralized.';
    this.adaptationLog = ['Hunter neutralized by blaster', ...this.adaptationLog].slice(0, 6);
    this.audio.play('coin');
    this.emitHud(this.currentDecision.notice);
  }

  private trackStationary(delta: number) {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (this.isPlayerGrounded(body) && Math.abs(body.velocity.x) < 10) this.stationaryMs += delta;
    else this.stationaryMs = 0;
  }

  private updatePlayerPresentation(time: number) {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const grounded = this.isPlayerGrounded(body);
    const velocityX = body.velocity.x;

    if (this.respawning) {
      this.applyPlayerTint(deathPalettes[this.getLoadout().deathEffect].primary);
      this.playPlayerAnimation('player-death');
      return;
    }

    if (Math.abs(velocityX) > 8) {
      this.player.setFlipX(velocityX < 0);
    }

    if (!grounded) {
      this.lastAirVelocityY = Math.max(this.lastAirVelocityY, body.velocity.y);
    }

    if (grounded && this.lastAirVelocityY > 260) {
      this.spawnLandingDust(this.player.x, body.bottom, Phaser.Math.Clamp(this.lastAirVelocityY / 680, 0.6, 1.25));
      this.audio.play('land');
      this.lastAirVelocityY = 0;
    }

    if (time < this.dashVisualUntil) {
      this.applyPlayerTint(trailPalettes[this.getLoadout().trail].primary);
      this.playPlayerAnimation('player-dash');
    } else if (!grounded) {
      this.applyPlayerTint();
      this.playPlayerAnimation('player-jump');
    } else if (Math.abs(velocityX) > 30) {
      this.applyPlayerTint();
      this.playPlayerAnimation('player-run');
    } else {
      this.applyPlayerTint();
      this.playPlayerAnimation('player-idle');
    }
  }

  private applyPlayerTint(overrideTint?: number) {
    const tint = overrideTint ?? skinTints[this.getLoadout().skin];
    if (typeof tint === 'number') this.player.setTint(tint);
    else this.player.clearTint();
  }

  private playPlayerAnimation(key: PlayerAnimKey) {
    if (this.playerAnimKey === key) return;
    this.playerAnimKey = key;
    this.player.play(key, true);
  }

  private checkMutationTriggers(time: number) {
    for (const runtime of this.entities.values()) {
      const event = runtime.schema.mutation_event;
      if (!event || runtime.triggered) continue;
      if (runtime.reactivateAt > time) continue;
      if (event.active_profiles && !event.active_profiles.includes(this.currentDecision.profile)) continue;
      if (!this.shouldTrigger(event, runtime, time)) continue;

      if (event.telegraph_ms > 0 && runtime.telegraphStartedAt === null) {
        this.startTelegraph(runtime, event, time);
        continue;
      }

      if (runtime.telegraphStartedAt !== null && time - runtime.telegraphStartedAt < event.telegraph_ms) continue;

      this.applyMutation(runtime, event, time);
    }
  }

  private shouldTrigger(event: MutationEvent, runtime: RuntimeEntity, time: number) {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    switch (event.trigger_condition) {
      case 'player_distance_less_than':
        return Phaser.Math.Distance.Between(this.player.x, this.player.y, runtime.sprite.x, runtime.sprite.y) < Number(event.condition_value);
      case 'player_input_active':
        return Boolean(this.actions[event.condition_value as keyof ActionState]);
      case 'player_stationary_for_ms':
        return this.stationaryMs >= Number(event.condition_value) && Phaser.Math.Distance.Between(this.player.x, this.player.y, runtime.sprite.x, runtime.sprite.y) < 150;
      case 'player_velocity_greater_than':
        return Math.abs(body.velocity.x) > Number(event.condition_value) && Math.abs(this.player.x - runtime.sprite.x) < 170;
      case 'profile_detected':
        return this.profileDecisionReady
          && this.currentDecision.profile === event.condition_value
          && Phaser.Math.Distance.Between(this.player.x, this.player.y, runtime.sprite.x, runtime.sprite.y) < 900;
      case 'time_elapsed_ms':
        return time - this.routeStartedAt >= Number(event.condition_value);
      default:
        return false;
    }
  }

  private applyMutation(runtime: RuntimeEntity, event: MutationEvent, time: number) {
    const wasTriggered = runtime.triggered;
    runtime.triggered = event.once;
    const state = event.mutated_state;
    this.stopTelegraph(runtime);

    if (state.render_layer) {
      runtime.schema.render_layer = state.render_layer;
      runtime.sprite.setTexture(textureKeyFor(state.render_layer));
      runtime.sprite.displayWidth = runtime.schema.transform.width;
      runtime.sprite.displayHeight = runtime.schema.transform.height;
      if (runtime.schema.base_type === 'collectible') {
        runtime.sprite.play(state.render_layer === 'visual_corrupt_coin' ? 'coin-corrupt' : 'coin-spin', true);
      }
    }

    if (typeof state.alpha === 'number') runtime.sprite.setAlpha(state.alpha);
    else if (runtime.schema.render_layer !== 'transparent') runtime.sprite.setAlpha(1);

    if (state.collision_mask) {
      runtime.schema.collision_mask = state.collision_mask;
      this.assignCollision(runtime, state.collision_mask);
    }

    if (state.velocity) {
      this.makeDynamic(runtime);
      runtime.sprite.setVelocity(state.velocity.x, state.velocity.y);
      runtime.sprite.setImmovable(false);
      const body = runtime.sprite.body as Phaser.Physics.Arcade.Body | null;
      body?.setAllowGravity(false);
    }

    if (state.gravity_vector) {
      this.level.global_environment.gravity_vector = state.gravity_vector;
    }

    if (typeof state.friction_multiplier === 'number') {
      this.level.global_environment.friction_multiplier = state.friction_multiplier;
    }

    if (state.input_hijack) {
      this.level.input_hijack = { ...state.input_hijack, expires_at_ms: time + 1400 };
    }

    this.currentDecision.logEntries = [event.hint, ...this.currentDecision.logEntries].slice(0, 8);
    this.currentDecision.notice = event.hint;
    if (!wasTriggered) {
      this.mutationsSurvived += 1;
      this.adaptationLog = [event.hint, ...this.adaptationLog.filter((entry) => entry !== event.hint)].slice(0, 6);
    }
    if (runtime.schema.behavior === 'rebuild_floor' && event.action === 'floor_collapse') {
      this.scheduleFloorRebuild(runtime, time);
    }
    this.spawnMutationBurst(runtime.sprite.x, runtime.sprite.y, event.action === 'mercy_bridge');
    this.spawnFloatText(event.action === 'mercy_bridge' ? 'Recovery' : 'Mutation', runtime.sprite.x, runtime.sprite.y - 48, event.action === 'mercy_bridge' ? '#58f0a7' : '#ffd166');
    this.audio.play(event.action === 'mercy_bridge' ? 'checkpoint' : 'mutation');
    this.audio.setMusicIntensity(this.getMusicIntensity());
    this.triggerHitStop(event.action === 'mercy_bridge' ? 38 : 58);
    this.shakeCamera(event.action === 'mercy_bridge' ? 0.0016 : 0.0032, 90);
  }

  private scheduleFloorRebuild(runtime: RuntimeEntity, time: number) {
    runtime.rebuildTimer?.remove();
    runtime.rebuildTimer = this.time.delayedCall(1700, () => {
      this.restoreRuntimeEntity(runtime);
      runtime.triggered = false;
      runtime.reactivateAt = time + 2600;
      this.spawnMutationBurst(runtime.sprite.x, runtime.sprite.y, true);
      this.spawnFloatText('Rebuilt', runtime.sprite.x, runtime.sprite.y - 48, '#58f0a7');
    });
  }

  private restoreRuntimeEntity(runtime: RuntimeEntity) {
    runtime.telegraphTween?.remove();
    runtime.telegraphTween = null;
    runtime.schema = structuredClone(runtime.originalSchema);
    const { transform, render_layer, collision_mask } = runtime.schema;
    runtime.sprite.setTexture(textureKeyFor(render_layer));
    runtime.sprite.setDisplaySize(transform.width, transform.height);
    runtime.sprite.setPosition(transform.x + transform.width / 2, transform.y + transform.height / 2);
    runtime.sprite.setVelocity(0, 0);
    runtime.sprite.setAngle(0);
    runtime.sprite.clearTint();
    runtime.sprite.setAlpha(render_layer === 'transparent' ? 0.001 : 1);
    this.assignCollision(runtime, collision_mask);
    this.applyEntityPresentation(runtime);
  }

  private startTelegraph(runtime: RuntimeEntity, event: MutationEvent, time: number) {
    runtime.telegraphStartedAt = time;
    runtime.sprite.setTint(this.getWarningTint());
    this.tutorialMutationSeen = true;
    this.tutorialWarningSeenAt = time;

    const warning = `Warning pulse: ${event.hint}`;
    this.currentDecision.notice = warning;
    this.currentDecision.logEntries = [warning, ...this.currentDecision.logEntries].slice(0, 8);
    this.emitHud(warning);
    this.spawnWarningBurst(runtime.sprite.x, runtime.sprite.y);
    this.audio.play('warning');
    this.shakeCamera(0.0018, 70);

    if (runtime.schema.render_layer === 'transparent') {
      runtime.sprite.setTexture('visual_warning_block');
      runtime.sprite.displayWidth = runtime.schema.transform.width;
      runtime.sprite.displayHeight = runtime.schema.transform.height;
      runtime.sprite.setAlpha(0.38);
    } else {
      runtime.sprite.setAlpha(Math.max(runtime.sprite.alpha, 0.72));
    }

    runtime.telegraphTween = this.tweens.add({
      targets: runtime.sprite,
      alpha: runtime.schema.render_layer === 'transparent' ? 0.78 : 1,
      duration: 115,
      ease: 'Sine.easeInOut',
      repeat: -1,
      yoyo: true
    });
  }

  private stopTelegraph(runtime: RuntimeEntity) {
    runtime.telegraphTween?.remove();
    runtime.telegraphTween = null;
    runtime.sprite.clearTint();

    if (runtime.schema.render_layer === 'transparent') {
      runtime.sprite.setTexture('visual_transparent');
      runtime.sprite.displayWidth = runtime.schema.transform.width;
      runtime.sprite.displayHeight = runtime.schema.transform.height;
      runtime.sprite.setAlpha(0.001);
    }
  }

  private assignCollision(runtime: RuntimeEntity, mask: CollisionMask) {
    this.removeFromGroups(runtime.sprite);

    if (mask === 'solid') {
      this.ensureStaticBody(runtime);
      this.solidGroup.add(runtime.sprite, true);
    }

    if (mask === 'lethal_hazard') {
      this.ensureDynamicBody(runtime, { allowGravity: false, immovable: true });
      this.hazardGroup.add(runtime.sprite, true);
    }

    if (mask === 'trigger_pickup') {
      this.ensureDynamicBody(runtime, { allowGravity: false, immovable: true });
      this.collectibleGroup.add(runtime.sprite, true);
    }

    if (mask === 'checkpoint') {
      this.ensureDynamicBody(runtime, { allowGravity: false, immovable: true });
      this.checkpointGroup.add(runtime.sprite, true);
    }

    if (mask === 'goal') {
      this.ensureDynamicBody(runtime, { allowGravity: false, immovable: true });
      this.goalGroup.add(runtime.sprite, true);
    }

    const body = runtime.sprite.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      body.enable = mask !== 'pass_through' && mask !== 'sensor';
      body.setSize(runtime.schema.transform.width, runtime.schema.transform.height, true);
      if (body instanceof Phaser.Physics.Arcade.StaticBody) {
        body.updateFromGameObject();
      }
    }
  }

  private removeFromGroups(sprite: Phaser.Physics.Arcade.Sprite) {
    this.solidGroup.remove(sprite, false, false);
    this.dynamicSolidGroup.remove(sprite, false, false);
    this.hazardGroup.remove(sprite, false, false);
    this.collectibleGroup.remove(sprite, false, false);
    this.checkpointGroup.remove(sprite, false, false);
    this.goalGroup.remove(sprite, false, false);
  }

  private makeDynamic(runtime: RuntimeEntity) {
    this.removeFromGroups(runtime.sprite);
    this.ensureDynamicBody(runtime, { allowGravity: false, immovable: true });
    if (runtime.schema.collision_mask === 'solid') this.dynamicSolidGroup.add(runtime.sprite, true);
    if (runtime.schema.collision_mask === 'lethal_hazard') this.hazardGroup.add(runtime.sprite, true);
  }

  private ensureStaticBody(runtime: RuntimeEntity) {
    this.replaceBody(runtime, Phaser.Physics.Arcade.STATIC_BODY);
    this.physics.world.enableBody(runtime.sprite, Phaser.Physics.Arcade.STATIC_BODY);
    const body = runtime.sprite.body as Phaser.Physics.Arcade.StaticBody | null;
    if (!body) return;
    body.enable = true;
    body.setSize(runtime.schema.transform.width, runtime.schema.transform.height, true);
    body.updateFromGameObject();
  }

  private ensureDynamicBody(runtime: RuntimeEntity, options: { allowGravity: boolean; immovable: boolean }) {
    this.replaceBody(runtime, Phaser.Physics.Arcade.DYNAMIC_BODY);
    this.physics.world.enableBody(runtime.sprite, Phaser.Physics.Arcade.DYNAMIC_BODY);
    const body = runtime.sprite.body as Phaser.Physics.Arcade.Body | null;
    if (!body) return;
    body.enable = true;
    body.setSize(runtime.schema.transform.width, runtime.schema.transform.height, true);
    body.setAllowGravity(options.allowGravity);
    body.setImmovable(options.immovable);
  }

  private replaceBody(runtime: RuntimeEntity, bodyType: number) {
    const body = runtime.sprite.body as Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | null;
    if (!body || body.physicsType === bodyType) return;

    this.physics.world.disableBody(body);
    (runtime.sprite as unknown as { body: null }).body = null;
  }

  private sampleTelemetry(time: number) {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    this.telemetry.add({
      timeMs: time,
      x: this.player.x,
      y: this.player.y,
      vx: body.velocity.x,
      vy: body.velocity.y,
      onGround: this.isPlayerGrounded(body),
      actions: { ...this.actions },
      checkpointIndex: this.checkpointIndex,
      deaths: this.deaths
    });
  }

  private applyDirector(time: number) {
    const batch = this.telemetry.drainIfReady(time);
    if (!batch) return;

    const decision = this.director.ingest(batch, this.level);
    this.currentDecision = decision;
    this.profileDecisionReady = true;
    this.level.global_environment = decision.environment;
    this.level.input_hijack = decision.inputHijack;
    this.audio.setMusicIntensity(this.getMusicIntensity());
    this.level.tick_sequence += 1;

    if (decision.inputHijack.active && decision.inputHijack.ui_spoofing) {
      window.dispatchEvent(new CustomEvent('paradox:ui-spoof', {
        detail: {
          message: 'AI scrambled controls briefly',
          durationMs: Math.max(1200, decision.inputHijack.ui_spoofing.delay_ms + 1000)
        }
      }));
    }
  }

  private keepPlayerInBounds() {
    if (this.player.y > 860) {
      this.killPlayer('Fell out of schema bounds');
    }
  }

  private killPlayer(reason: string) {
    if (this.runComplete || this.respawning) return;
    const deathX = this.player.x;
    const deathY = this.player.y;
    const body = this.player.body as Phaser.Physics.Arcade.Body | null;
    this.respawning = true;
    this.deaths += 1;
    this.playPlayerAnimation('player-death');
    this.spawnDeathBurst(deathX, deathY);
    this.audio.play('death');
    body?.setEnable(false);
    this.player.setVelocity(0, 0);
    this.player.setVisible(true);
    this.player.setAlpha(0.94);
    this.stationaryMs = 0;
    this.dashVisualUntil = 0;
    this.jumpBufferedUntil = 0;
    this.jumpCutAvailable = false;
    this.lastAirVelocityY = 0;
    this.lastGroundedAt = this.time.now;
    this.dashReadyAt = this.time.now + 220;
    this.sceneConfig.input.releaseAll();
    this.currentDecision.logEntries = [`Death vector: ${reason}`, ...this.currentDecision.logEntries].slice(0, 8);
    this.triggerHitStop(74);
    this.shakeCamera(0.005, 140);
    this.flashCamera(0xff4f6d, 180);
    this.scheduleRespawn();
  }

  private scheduleRespawn() {
    this.respawnAt = this.time.now + (this.reducedMotion ? 340 : 540);
  }

  private respawnPlayer() {
    const body = this.player.body as Phaser.Physics.Arcade.Body | null;
    this.resetLevelAfterDeath();
    body?.setEnable(true);
    body?.reset(playerStart.x, playerStart.y);
    this.player.setPosition(playerStart.x, playerStart.y);
    this.player.setVelocity(0, 0);
    body?.setAcceleration(0, 0);
    body?.setVelocity(0, 0);
    body?.updateFromGameObject();
    this.player.setVisible(true);
    this.player.setAlpha(1);
    this.respawnAt = 0;
    this.respawning = false;
    this.playerAnimKey = '';
    this.sceneConfig.input.releaseAll();
    this.playPlayerAnimation('player-idle');
    this.spawnRespawnBurst(this.player.x, this.player.y);
    this.emitHud('Respawned from level start. Route reset.');
  }

  private resetLevelAfterDeath() {
    this.destroyRuntimeEntities();
    this.level = structuredClone(this.originalLevel);
    this.level.tick_sequence = 0;
    this.level.input_hijack = { active: false, mapping: {} };
    this.level.global_environment = {
      gravity_vector: { x: 0, y: 980 },
      friction_multiplier: 1,
      camera_lock: false
    };
    this.physics.world.gravity.x = 0;
    this.physics.world.gravity.y = this.level.global_environment.gravity_vector.y;
    this.checkpointIndex = 0;
    this.checkpoint = { ...playerStart };
    this.coins = 0;
    this.totalCoins = this.level.entities.filter((entity) => entity.base_type === 'collectible').length;
    this.mutationsSurvived = 0;
    this.weaponCharges = 0;
    this.routeStartedAt = this.time.now;
    this.profileDecisionReady = false;
    this.adaptationLog = [];
    this.telemetry.reset(this.time.now);
    this.stationaryMs = 0;
    this.actions = { left: false, right: false, jump: false, dash: false, down: false };
    this.lastShotAt = -Infinity;
    this.sceneConfig.input.releaseAll();
    this.currentDecision.environment = this.level.global_environment;
    this.currentDecision.inputHijack = this.level.input_hijack;
    this.currentDecision.notice = 'Route reset after death.';
    this.currentDecision.logEntries = ['Route reset after death', ...this.currentDecision.logEntries].slice(0, 8);
    this.createRuntimeEntities();
  }

  private destroyRuntimeEntities() {
    for (const runtime of this.entities.values()) {
      runtime.rebuildTimer?.remove();
      runtime.rebuildTimer = null;
      runtime.telegraphTween?.remove();
      runtime.telegraphTween = null;
      this.removeFromGroups(runtime.sprite);
      runtime.sprite.destroy();
    }
    this.entities.clear();
    this.solidGroup.clear(false, false);
    this.dynamicSolidGroup.clear(false, false);
    this.hazardGroup.clear(false, false);
    this.collectibleGroup.clear(false, false);
    this.playerShotGroup.clear(true, true);
    this.checkpointGroup.clear(false, false);
    this.goalGroup.clear(false, false);
  }

  private finishRun() {
    if (this.runComplete) return;
    const goal = this.entities.get('goal_01');
    if (goal) {
      this.spawnPortalBurst(goal.sprite.x, goal.sprite.y);
      this.spawnFloatText('Complete', goal.sprite.x, goal.sprite.y - 68, '#58f0a7');
    }
    this.audio.play('portal');
    this.audio.setMusicIntensity(0.12);
    this.shakeCamera(0.003, 180);
    this.runComplete = true;
    const summary = createRunSummary({
      durationMs: this.time.now - this.runStartedAt,
      deaths: this.deaths,
      coins: this.coins,
      totalCoins: this.totalCoins,
      mutationsSurvived: this.mutationsSurvived,
      trust: this.currentDecision.trust,
      previousBestScore: readBestScore(),
      adaptationLog: this.adaptationLog,
      levelIndex: this.sceneConfig.levelIndex,
      mode: this.sceneConfig.mode,
      dailyAnomaly: this.sceneConfig.dailyAnomaly
    });
    writeBestDeaths(this.deaths);
    writeBestScore(summary.score);
    this.physics.pause();
    this.currentDecision.notice = `Run complete: ${summary.grade} rank, ${summary.score} score.`;
    this.emitHud(this.currentDecision.notice);
    this.hideTutorial();
    window.dispatchEvent(new CustomEvent('paradox:run-complete', { detail: summary }));
  }

  private flashCamera(color: number, duration: number) {
    this.cameras.main.flash(duration, (color >> 16) & 255, (color >> 8) & 255, color & 255, false);
  }

  private shakeCamera(intensity: number, duration: number) {
    if (this.reducedMotion) return;
    this.cameras.main.shake(duration, intensity);
  }

  private triggerHitStop(duration: number) {
    if (this.reducedMotion || this.pausedByUi || this.runComplete) return;
    this.physics.pause();
    this.time.delayedCall(duration, () => {
      if (!this.pausedByUi && !this.runComplete) this.physics.resume();
    });
  }

  private spawnPickupBurst(x: number, y: number) {
    this.spawnParticleBurst('fx_spark', x, y, this.reducedMotion ? 6 : 18, {
      lifespan: 360,
      speed: { min: 90, max: 220 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.22, end: 0 },
      alpha: { start: 0.95, end: 0 },
      gravityY: 380,
      blendMode: Phaser.BlendModes.ADD
    });
  }

  private spawnCheckpointBurst(x: number, y: number) {
    this.spawnParticleBurst('fx_spark', x, y, this.reducedMotion ? 8 : 26, {
      lifespan: 520,
      speed: { min: 70, max: 260 },
      angle: { min: 190, max: 350 },
      scale: { start: 0.26, end: 0 },
      alpha: { start: 1, end: 0 },
      gravityY: 190,
      blendMode: Phaser.BlendModes.ADD
    });
  }

  private spawnDashTrail(direction: number) {
    const palette = trailPalettes[this.getLoadout().trail];
    this.spawnDashAfterimages(direction);
    this.spawnParticleBurst('fx_dash', this.player.x - direction * 18, this.player.y + 4, this.reducedMotion ? 3 : 10, {
      lifespan: 230,
      speedX: { min: -direction * 260, max: -direction * 80 },
      speedY: { min: -50, max: 50 },
      rotate: direction < 0 ? 180 : 0,
      scale: { start: 0.45, end: 0.08 },
      alpha: { start: 0.78, end: 0 },
      tint: [palette.primary, palette.secondary],
      blendMode: Phaser.BlendModes.ADD
    });
  }

  private spawnDashAfterimages(direction: number) {
    const palette = trailPalettes[this.getLoadout().trail];
    const streak = this.add.rectangle(
      this.player.x - direction * 52,
      this.player.y + 2,
      this.reducedMotion ? 112 : 142,
      this.reducedMotion ? 22 : 28,
      palette.primary,
      this.reducedMotion ? 0.62 : 0.48
    );
    streak.setDepth(17);
    streak.setBlendMode(Phaser.BlendModes.ADD);
    if (this.reducedMotion) {
      this.time.delayedCall(110, () => streak.destroy());
      return;
    }

    this.tweens.add({
      targets: streak,
      alpha: 0,
      scaleX: 1.45,
      duration: 320,
      ease: 'Cubic.easeOut',
      onComplete: () => streak.destroy()
    });

    for (let index = 0; index < 4; index += 1) {
      const ghost = this.add.image(this.player.x - direction * (18 + index * 18), this.player.y, 'player_dash');
      ghost.setDepth(18 - index);
      ghost.setDisplaySize(42, 56);
      ghost.setFlipX(this.player.flipX);
      ghost.setTint(index % 2 === 0 ? palette.primary : palette.secondary);
      ghost.setBlendMode(Phaser.BlendModes.ADD);
      ghost.setAlpha(0.42 - index * 0.07);
      this.tweens.add({
        targets: ghost,
        alpha: 0,
        x: ghost.x - direction * 24,
        duration: 280 + index * 30,
        ease: 'Cubic.easeOut',
        onComplete: () => ghost.destroy()
      });
    }
  }

  private spawnLandingDust(x: number, y: number, scale: number) {
    this.spawnParticleBurst('fx_dust', x, y, this.reducedMotion ? 4 : 12, {
      lifespan: 280,
      speedX: { min: -120, max: 120 },
      speedY: { min: -80, max: -8 },
      scale: { start: 0.18 * scale, end: 0.02 },
      alpha: { start: 0.54, end: 0 },
      gravityY: 180
    });
  }

  private spawnWarningBurst(x: number, y: number) {
    this.spawnParticleBurst('fx_warning_ring', x, y, this.reducedMotion ? 3 : 8, {
      lifespan: 520,
      speed: { min: 26, max: 86 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.18, end: 0.72 },
      alpha: { start: 0.84, end: 0 },
      tint: [this.getWarningTint(), 0xffffff],
      blendMode: Phaser.BlendModes.ADD
    });
  }

  private spawnMutationBurst(x: number, y: number, friendly: boolean) {
    this.spawnParticleBurst(friendly ? 'fx_spark' : 'fx_glitch', x, y, this.reducedMotion ? 8 : 24, {
      lifespan: 420,
      speed: { min: 80, max: 300 },
      angle: { min: 0, max: 360 },
      scale: { start: friendly ? 0.22 : 0.38, end: 0 },
      alpha: { start: 0.92, end: 0 },
      blendMode: Phaser.BlendModes.ADD
    });
  }

  private spawnDeathBurst(x: number, y: number) {
    const palette = deathPalettes[this.getLoadout().deathEffect];
    this.spawnParticleBurst(palette.texture, x, y, this.reducedMotion ? 10 : 34, {
      lifespan: 520,
      speed: { min: 120, max: 360 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.46, end: 0 },
      alpha: { start: 1, end: 0 },
      gravityY: 80,
      tint: [palette.primary, palette.secondary],
      blendMode: Phaser.BlendModes.ADD
    });

    if (!this.reducedMotion && this.getLoadout().deathEffect !== 'glitch') {
      this.spawnParticleBurst('fx_warning_ring', x, y, 7, {
        lifespan: 420,
        speed: { min: 42, max: 120 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.2, end: 0.9 },
        alpha: { start: 0.72, end: 0 },
        tint: [palette.secondary, palette.primary],
        blendMode: Phaser.BlendModes.ADD
      });
    }
  }

  private spawnRespawnBurst(x: number, y: number) {
    this.spawnParticleBurst('fx_spark', x, y, this.reducedMotion ? 5 : 14, {
      lifespan: 340,
      speed: { min: 40, max: 150 },
      angle: { min: 210, max: 330 },
      scale: { start: 0.18, end: 0 },
      alpha: { start: 0.76, end: 0 },
      blendMode: Phaser.BlendModes.ADD
    });
  }

  private spawnPortalBurst(x: number, y: number) {
    const palette = portalPalettes[this.getLoadout().portalEffect];
    this.spawnParticleBurst(palette.texture, x, y, this.reducedMotion ? 12 : 38, {
      lifespan: 650,
      speed: { min: 110, max: 330 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.28, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [palette.primary, palette.secondary],
      blendMode: Phaser.BlendModes.ADD
    });

    if (!this.reducedMotion && this.getLoadout().portalEffect !== 'clean') {
      this.spawnParticleBurst('fx_warning_ring', x, y, 12, {
        lifespan: 780,
        speed: { min: 34, max: 120 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.25, end: 1.25 },
        alpha: { start: 0.78, end: 0 },
        tint: [palette.secondary, palette.primary],
        blendMode: Phaser.BlendModes.ADD
      });
    }
  }

  private spawnParticleBurst(
    texture: string,
    x: number,
    y: number,
    quantity: number,
    config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig
  ) {
    const lifespan = typeof config.lifespan === 'number' ? config.lifespan : 520;
    const emitter = this.add.particles(x, y, texture, { ...config, emitting: false });
    emitter.setDepth(40);
    emitter.explode(quantity, x, y);
    this.time.delayedCall(lifespan + 140, () => emitter.destroy());
  }

  private spawnFloatText(text: string, x: number, y: number, color: string) {
    const label = this.add.text(x, y, text, {
      color,
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '16px',
      fontStyle: '700',
      stroke: '#070914',
      strokeThickness: 4
    });
    label.setOrigin(0.5);
    label.setDepth(42);
    label.setShadow(0, 0, '#070914', 8, true, true);
    this.tweens.add({
      targets: label,
      alpha: 0,
      y: y - 34,
      duration: this.reducedMotion ? 140 : 620,
      ease: 'Cubic.easeOut',
      onComplete: () => label.destroy()
    });
  }

  private emitHud(notice: string) {
    const summaryPreview = createRunSummary({
      durationMs: this.time.now - this.runStartedAt,
      deaths: this.deaths,
      coins: this.coins,
      totalCoins: this.totalCoins,
      mutationsSurvived: this.mutationsSurvived,
      trust: this.currentDecision.trust,
      previousBestScore: null,
      adaptationLog: this.adaptationLog,
      levelIndex: this.sceneConfig.levelIndex,
      mode: this.sceneConfig.mode,
      dailyAnomaly: this.sceneConfig.dailyAnomaly
    });
    const snapshot: HudSnapshot = {
      coins: this.coins,
      dashReadyPercent: this.getDashReadyPercent(),
      durationText: summaryPreview.durationText,
      levelIndex: this.sceneConfig.levelIndex,
      modeLabel: this.getModeLabel(),
      profile: this.currentDecision.profile,
      deaths: this.deaths,
      score: summaryPreview.score,
      totalCoins: this.totalCoins,
      trust: this.currentDecision.trust,
      notice,
      mutations: this.currentDecision.logEntries
    };

    window.dispatchEvent(new CustomEvent('paradox:hud', { detail: snapshot }));
  }

  private getModeLabel() {
    if (this.sceneConfig.mode === 'daily') return this.sceneConfig.dailyAnomaly?.label ?? 'Daily';
    if (this.sceneConfig.mode === 'training') return 'Training';
    return `Level ${this.sceneConfig.levelIndex}`;
  }

  private setupTutorial() {
    this.tutorialEnabled = this.sceneConfig.mode === 'training' || (this.sceneConfig.mode === 'standard' && this.sceneConfig.levelIndex === 1 && !this.hasCompletedTutorial());
    this.tutorialStepIndex = 0;
    this.tutorialLastStepIndex = -1;
    this.tutorialWasCompleted = false;
    this.tutorialMutationSeen = false;
    this.tutorialWarningSeenAt = 0;
    this.dashUsedThisRun = false;
    this.jumpUsedThisRun = false;

    if (this.tutorialEnabled) this.emitTutorial();
    else this.hideTutorial();

    this.tutorialSkipHandler = () => this.skipTutorial();
    window.addEventListener('paradox:tutorial-skip', this.tutorialSkipHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.tutorialSkipHandler) {
        window.removeEventListener('paradox:tutorial-skip', this.tutorialSkipHandler);
        this.tutorialSkipHandler = null;
      }
    });
  }

  private updateTutorial(time: number) {
    if (!this.tutorialEnabled) return;

    if (this.tutorialWasCompleted) {
      if (this.tutorialCompleteHideAt > 0 && time >= this.tutorialCompleteHideAt) {
        this.tutorialEnabled = false;
        this.hideTutorial();
      }
      return;
    }

    while (
      this.tutorialStepIndex < tutorialSteps.length - 1 &&
      this.isTutorialStepComplete(tutorialSteps[this.tutorialStepIndex].id)
    ) {
      this.tutorialStepIndex += 1;
    }

    if (tutorialSteps[this.tutorialStepIndex].id === 'complete') {
      this.tutorialWasCompleted = true;
      this.tutorialCompleteHideAt = time + 3200;
      this.markTutorialComplete();
    }

    if (this.tutorialLastStepIndex !== this.tutorialStepIndex || this.tutorialWasCompleted) {
      this.emitTutorial();
      this.tutorialLastStepIndex = this.tutorialStepIndex;
    }
  }

  private isTutorialStepComplete(step: TutorialStepId) {
    switch (step) {
      case 'move':
        return this.player.x > playerStart.x + 120;
      case 'jump':
        return this.jumpUsedThisRun;
      case 'dash':
        return this.dashUsedThisRun;
      case 'coin':
        return this.coins > 0;
      case 'warning':
        return this.tutorialMutationSeen && this.time.now - this.tutorialWarningSeenAt > 1200;
      case 'complete':
      default:
        return false;
    }
  }

  private emitTutorial() {
    const step = tutorialSteps[this.tutorialStepIndex];
    const snapshot: TutorialSnapshot = {
      active: true,
      body: step.body,
      skippable: true,
      objective: step.objective,
      progress: (this.tutorialStepIndex + 1) / tutorialSteps.length,
      step: this.tutorialStepIndex + 1,
      title: step.title,
      tone: step.tone,
      total: tutorialSteps.length
    };

    window.dispatchEvent(new CustomEvent('paradox:tutorial', { detail: snapshot }));
  }

  private hideTutorial() {
    const snapshot: TutorialSnapshot = {
      active: false,
      body: '',
      skippable: false,
      objective: '',
      progress: 0,
      step: 0,
      title: '',
      tone: 'info',
      total: tutorialSteps.length
    };

    window.dispatchEvent(new CustomEvent('paradox:tutorial', { detail: snapshot }));
  }

  private hasCompletedTutorial() {
    try {
      return window.localStorage.getItem(tutorialStorageKey) === '1';
    } catch {
      return false;
    }
  }

  private markTutorialComplete() {
    try {
      window.localStorage.setItem(tutorialStorageKey, '1');
    } catch {
      // Local storage can be unavailable in privacy-restricted webviews.
    }
  }

  private skipTutorial() {
    if (!this.tutorialEnabled) return;
    this.tutorialEnabled = false;
    this.tutorialWasCompleted = true;
    this.markTutorialComplete();
    this.hideTutorial();
    this.currentDecision.notice = 'Tutorial skipped. Survive the route.';
    this.emitHud(this.currentDecision.notice);
  }

  private installDebugApi() {
    const enabled = new URLSearchParams(window.location.search).has('debugPhysics');
    if (!enabled) return;

    const debugApi = {
      completeRun: () => {
        this.finishRun();
      },
      forceMutation: (entityId: string) => {
        const runtime = this.entities.get(entityId);
        if (!runtime?.schema.mutation_event) return false;
        this.applyMutation(runtime, runtime.schema.mutation_event, this.time.now);
        return true;
      },
      killPlayer: (reason = 'Debug death') => {
        this.killPlayer(reason);
      },
      setPlayerVelocity: (x: number, y: number) => {
        this.player.setVelocity(x, y);
      },
      setProfile: (profile: PlayerProfile) => {
        this.currentDecision.profile = profile;
      },
      setStationaryMs: (ms: number) => {
        this.stationaryMs = ms;
      },
      snapshot: () => this.createDebugSnapshot(),
      teleportPlayer: (x: number, y: number) => {
        this.player.setPosition(x, y);
        this.player.setVelocity(0, 0);
        (this.player.body as Phaser.Physics.Arcade.Body | null)?.updateFromGameObject();
        this.lastAirVelocityY = 0;
        this.sceneConfig.input.releaseAll();
        this.physics.overlap(this.player, this.hazardGroup, () => this.killPlayer('Hazard collision'));
      }
    };

    window.__PARADOX_DEBUG__ = debugApi;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (window.__PARADOX_DEBUG__ === debugApi) {
        delete window.__PARADOX_DEBUG__;
      }
    });
  }

  private createDebugSnapshot(): PhysicsDebugSnapshot {
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    const entities: PhysicsDebugSnapshot['entities'] = {};

    for (const [id, runtime] of this.entities.entries()) {
      const body = runtime.sprite.body;
      const dynamicBody = body instanceof Phaser.Physics.Arcade.Body ? body : null;
      const staticBody = body instanceof Phaser.Physics.Arcade.StaticBody ? body : null;
      entities[id] = {
        x: runtime.sprite.x,
        y: runtime.sprite.y,
        vx: dynamicBody?.velocity.x ?? 0,
        vy: dynamicBody?.velocity.y ?? 0,
        mask: runtime.schema.collision_mask,
        alpha: runtime.sprite.alpha,
        bodyEnabled: Boolean(body?.enable),
        bodyType: dynamicBody ? 'dynamic' : staticBody ? 'static' : 'none',
        active: runtime.sprite.active,
        visible: runtime.sprite.visible,
        triggered: runtime.triggered
      };
    }

    return {
      player: {
        animation: (this.player.anims.currentAnim?.key as PlayerAnimKey | undefined) ?? this.playerAnimKey,
        textureKey: this.player.texture.key,
        visible: this.player.visible,
        flipX: this.player.flipX,
        x: this.player.x,
        y: this.player.y,
        vx: playerBody.velocity.x,
        vy: playerBody.velocity.y,
        onGround: this.isPlayerGrounded(playerBody),
        bodyBottom: playerBody.bottom,
        bodyHeight: playerBody.height,
        bodyTop: playerBody.top,
        blockedDown: playerBody.blocked.down,
        touchingDown: playerBody.touching.down
      },
      deaths: this.deaths,
      coins: this.coins,
      weaponCharges: this.weaponCharges,
      actions: { ...this.actions },
      checkpointIndex: this.checkpointIndex,
      checkpoint: { ...this.checkpoint },
      run: {
        elapsedMs: this.time.now - this.runStartedAt,
        mutationsSurvived: this.mutationsSurvived,
        runComplete: this.runComplete,
        totalCoins: this.totalCoins
      },
      profile: this.currentDecision.profile,
      entities
    };
  }

  private isPlayerGrounded(body: Phaser.Physics.Arcade.Body) {
    return body.blocked.down || body.touching.down;
  }

  private getDashReadyPercent() {
    return Phaser.Math.Clamp(1 - Math.max(0, this.dashReadyAt - this.time.now) / dashCooldownMs, 0, 1);
  }
}
