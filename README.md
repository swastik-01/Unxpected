# Unxpected

Unxpected is a schema-driven adaptive platformer based on `Untitled document.txt`.
The current implementation ships as a Phaser/Vite web game wrapped with Capacitor for Android.

## What is implemented

- 2D side-scrolling platformer with keyboard and touch controls.
- Dynamic JSON-style level schema for environment, entities, collision masks, and mutation triggers.
- Local adaptive director that classifies play style as Speedrunner, Panicked, Safe-Zoner, Methodical, or Balanced.
- Real-time trap mutations: semantic coin scrambles, velocity-gated platforms, safe-zone elevator traps, jump-triggered walls, gravity drift, and short in-game input desync windows.
- DOM HUD, pause menu, mobile controls, local best-death persistence, and training mode.
- Capacitor configuration for Android packaging.

## Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm test
npm run build
npm run test:qa
```

## Leaderboards

Scores are saved locally in browser or Android WebView storage by default. The menu now asks for a player name and attaches it to local leaderboard entries.

For a global leaderboard, create a Supabase table named `leaderboard_runs` and provide these Vite environment variables before building:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
VITE_SUPABASE_LEADERBOARD_TABLE=leaderboard_runs
```

The SQL schema is available at `supabase/leaderboard_runs.sql`. Recommended table shape:

```sql
create table leaderboard_runs (
  id text primary key,
  player_name text not null,
  mode text not null,
  level_index integer not null,
  score integer not null,
  duration_ms double precision not null,
  duration_text text not null,
  deaths integer not null,
  coins integer not null,
  mutations_survived integer not null,
  trust_percent integer not null,
  grade text not null,
  daily_date_key text,
  played_at timestamptz not null
);
```

The game reads global ranks by level completed first, then score, then faster time, then fewer deaths. Keep Supabase Row Level Security policies scoped to `select` and controlled `insert` for public clients.

## Android

Create or update the Android project after the web build:

```bash
npm run android:sync
```

Open the generated native project:

```bash
npm run android:open
```

For Play Store upload, build a signed Android App Bundle from Android Studio or Gradle.
Do not commit upload keystores or signing passwords.

Run connected-device QA after building `Unxpected-release.apk`:

```bash
npm run android:qa-device
```

If Android reports `visualCapture: "blocked-by-secure-lockscreen"`, unlock the phone and rerun the same command. The script still verifies install, launch, foreground activity, and fatal logs.

## Blender and Unreal handoff

The Phaser/Capacitor game is not directly editable in Blender or Unreal. Use the engine handoff exporter for final-art blockout work:

```bash
npm run export:engine
```

Generated files are written to `engine-export/`, including Blender import script, JSON level data, and Unreal import notes.
