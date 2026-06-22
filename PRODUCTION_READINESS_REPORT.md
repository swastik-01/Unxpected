# Unxpected Production Readiness Report

Date: 2026-06-21

## Current Status

Unxpected is now a technically buildable Play Store candidate for internal testing. The web build, automated browser QA, Android sync, debug APK build, and release AAB build all pass locally.

This is not yet a premium public-launch final until the final authored art/audio pass, real-device testing, Play Console listing, content rating, data safety form, privacy policy decision, and Android vitals review are complete.

## What Was Upgraded In This Pass

- Replaced the simple placeholder player body with generated pose frames that visibly include arms, hands, legs, and feet.
- Expanded run animation from 2 frames to 4 frames.
- Added explicit idle, run, jump, dash, death, and respawn-state QA visibility.
- Fixed dash feel by raising the player X max velocity above dash speed.
- Increased dash visual identity so the dash pose is readable.
- Fixed death readability: the fractured death frame is now visible before respawn instead of being hidden immediately.
- Moved respawn timing into the scene update loop so respawn is deterministic while physics is paused for hit-stop.
- Strengthened browser QA to assert player animation states, desktop/mobile layout, HUD, pause, summary, persistence, and completion flow.

## Verification Passed

- `npm test`: 3 test files, 10 tests passed.
- `npm run build`: TypeScript and Vite production build passed.
- `npm run test:qa`: desktop, mobile landscape, and mobile portrait browser QA passed.
- `npx cap sync android`: synced current production web assets into Android.
- `.\gradlew.bat :app:assembleDebug :app:bundleRelease`: Android build successful.

## Current Build Artifacts

- Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- Debug APK size: 4,921,374 bytes
- Debug APK SHA256: `9694F851620C046A12BE5AB3429E2FD275B4802CC7D6810D045DFEAB239659BF`
- Release AAB: `android/app/build/outputs/bundle/release/app-release.aab`
- Release AAB size: 3,367,835 bytes
- Release AAB SHA256: `9B4F24F49538B1CA25843AFF50D7308754375A9F72FB4DB13C6A2DF0DD81217D`

## Player View

As a new user, the game starts fast, the menu is understandable, landscape mobile is usable, and the adaptive mutation hook is clear enough to notice. The tutorial helps explain movement and warning behavior. The core "one more run" loop is present through score, grade, missions, unlocks, daily anomaly, and local leaderboard.

The biggest new-user risk is still visual polish. The procedural world reads cleanly, but it does not yet look like a high-budget Play Store game. Stronger authored animation, bigger character readability, richer backgrounds, and better mutation telegraphs would make the hook easier to understand.

## Professional Gamer View

The platforming foundation is now respectable: coyote time, jump buffering, variable jump height, dash cooldown feedback, particles, hit-stop, death readability, and deterministic collision groups are in place. Dash now has stronger mechanical identity.

For serious players, the next bar is mastery fairness: every mutation must be telegraphed with consistent timing, challenge routes need medals and ghost replay, and leaderboard scoring needs anti-cheat/server validation before public competition.

## Retention View

The game has ethical retention foundations:

- fast restart loop
- score and rank
- mission goals
- cosmetic unlocks
- daily anomaly
- streak tracking
- local leaderboard
- post-run recap

To make it more addictive in a healthy way, add short level sets, S/Paradox route medals, ghost replay, clearer daily rewards, more unlockable trails/death effects, escalating mutation combinations, and weekly challenge seeds.

## Blender And Unreal Engine Editability

The current project is a Phaser 2D TypeScript game wrapped with Capacitor for Android. It is not directly editable as a Blender project or an Unreal Engine project.

Blender can still be used for the final-touch asset pipeline. The best route is to create a rigged character, render sprite sheets for idle/run/jump/dash/death, render parallax background layers and VFX passes, export PNG/WebP atlases, then replace the current generated textures in Phaser with authored atlas assets. The gameplay, physics, collisions, scoring, and Android packaging can stay in this project.

Unreal Engine would require a port/rebuild. You can reuse the concept, level design, art direction, rendered assets, sounds, and progression model, but Phaser gameplay code will not become an Unreal project automatically. Use Unreal only if the target changes to a 2.5D/3D premium rebuild, advanced lighting, cinematic camera work, or a broader console/PC pipeline.

## Recommended Final Polish Path

1. Keep Phaser/Capacitor for the Play Store version.
2. Use Blender to author final sprite sheets, backgrounds, portal effects, and marketing renders.
3. Replace procedural textures with texture atlases and asset manifests.
4. Run real Android device testing on at least one low-end phone, one mid-range phone, and one tablet/foldable-class screen.
5. Upload the release AAB to Play Console internal testing before public production.
