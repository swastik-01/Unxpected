# Unxpected Production Phases

## Phase 1 - Playability Foundation

Goal: make the game feel reliable on the target device and improve the first-touch platforming feel.

- Lock Android to landscape and keep web/mobile portrait from presenting a broken playfield.
- Hide touch controls outside active gameplay.
- Add coyote time, jump buffering, variable jump height, and dash cooldown feedback.
- Keep physics and collision test coverage green after every gameplay-feel change.

## Phase 2 - First-Run Understanding

Goal: make the adaptive AI hook feel learnable instead of random.

- Add a short playable tutorial for move, jump, dash, coins, checkpoints, hazards, and mutation warnings.
- Add clear pre-mutation warning language and visual markers.
- Add a safe training route where the first mutation cannot instantly punish the player.

## Phase 3 - Combat Feel And Visual Juice

Goal: move from prototype visuals to an eye-catching action game.

- Replace generated placeholder shapes with authored sprite sheets.
- Add player idle, run, jump, dash, hit, death, and respawn animations.
- Add coin burst particles, dash trails, landing dust, hit-stop, camera punch, and mutation glitch effects.
- Add layered parallax, foreground scanlines, and stronger color language for safe, warning, lethal, and glitch states.
- Current slice implemented generated animation frames, procedural audio cues, dash/death/checkpoint/coin/mutation particles, safer hazard overlaps, and deferred respawn physics.

## Phase 4 - Retention Loop

Goal: give players a reason to replay immediately.

- Add run timer, coins collected, deaths, mutations survived, and trust retained.
- Add C/B/A/S/Paradox grades.
- Add post-run recap explaining how the AI adapted.
- Add local missions such as finish under 3 deaths, collect all coins, and survive 4 mutations.
- Current slice implemented deterministic run scoring, best score persistence, rank calculation, post-run recap, and four local mission checks.

## Phase 5 - Meta Progression

Goal: add ethical long-term goals without pay-to-win systems.

- Add unlockable skins, trails, death effects, and portal effects.
- Add daily anomaly seed with a unique mutation combination.
- Add streak rewards for completing daily anomalies.
- Prepare leaderboard-ready scoring.
- Current slice implemented persistent XP, unlockable cosmetics, selectable loadouts, daily seeded anomaly mode, daily streaks, and a local top-10 leaderboard data model.

## Phase 6 - Store-Ready Polish

Goal: make the Play Store build feel premium and maintainable.

- Add production audio for jump, dash, pickup, hazard, mutation warning, death, checkpoint, and portal.
- Add accessibility options for reduced motion, color-safe mutation warnings, and readable UI scaling.
- Capture final phone/tablet screenshots from Android.
- Run Android internal testing before production release.
- Current slice implemented audio/reduced-motion/color-safe/UI-scale settings, synced web assets to Android, rebuilt APK/AAB artifacts, and captured browser QA screenshots for desktop and mobile layout review.
