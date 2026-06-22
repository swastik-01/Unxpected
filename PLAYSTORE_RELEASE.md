# Play Store Release Handoff

This project is configured for Capacitor Android with package id:

```text
com.unexpectedgame.unxpected
```

## Build web assets

```bash
npm ci
npm run build
npm run android:sync
```

## Generate a signed app bundle

1. Open Android Studio with:

   ```bash
   npm run android:open
   ```

2. Use **Build > Generate Signed App Bundle / APK**.
3. Select **Android App Bundle**.
4. Use a private upload key or create a new upload key for Play App Signing.
5. Keep the keystore and passwords outside the repository.

## Command-line release bundle

After `android/` exists, create `android/signing.properties` locally:

```properties
storeFile=keystores/unxpected-upload.jks
storePassword=replace-with-private-password
keyAlias=unxpected-upload
keyPassword=replace-with-private-password
```

Then run from `android/`:

```bash
./gradlew bundleRelease
```

The upload bundle will be created under:

```text
android/app/build/outputs/bundle/release/
```

On Windows PowerShell, use:

```powershell
.\gradlew.bat bundleRelease
```

## Store listing checklist

- App name: Unxpected
- Category: Game, Action or Arcade
- Rating questionnaire: complete in Play Console
- Privacy policy: required if analytics, accounts, ads, or server telemetry are added later
- Data safety: current build stores only local best-run data and does not transmit telemetry
- Screenshots: capture phone and tablet screenshots from the Android build
- Release track: use Internal testing before Production
