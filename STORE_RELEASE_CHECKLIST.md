# Unxpected Store Release Checklist

## Completed Locally

- Landscape Android gameplay shell is configured in `AndroidManifest.xml`.
- Capacitor release WebView debugging is disabled in `capacitor.config.ts`.
- Release signing is wired through `android/signing.properties`.
- Debug APK and release AAB build successfully.
- Browser QA covers boot, menu progression, daily anomaly, live HUD, player animation states, readable death/respawn, pause, run summary, persistence, desktop layout, mobile landscape gameplay, and mobile portrait rotation.
- Current desktop/mobile browser screenshots are captured in `qa-artifacts/`.

## External Play Console Steps

- Upload the signed release AAB to an internal testing track.
- Complete store listing copy, screenshots, feature graphic, privacy policy URL, data safety, and content rating.
- Run a real-device internal test on at least one phone and one tablet-class device.
- Check Android vitals after internal testers play the build.
- Promote from internal testing only after crash-free sessions and gameplay feedback are acceptable.

## Current Artifacts

- Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- Release AAB: `android/app/build/outputs/bundle/release/app-release.aab`
