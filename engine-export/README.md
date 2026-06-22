# Unxpected Engine Handoff

Generated files:

- `unxpected-levels.json`: editable level blockout and mutation metadata.
- `blender_import_unxpected.py`: creates a Blender blockout from the JSON and saves a `.blend`.
- `UNREAL_IMPORT_NOTES.md`: Unreal porting notes and coordinate mapping.

Blender:

1. Open Blender.
2. Run `blender_import_unxpected.py` from the Scripting workspace.
3. Edit or replace the generated meshes with final art.

Unreal:

Use the JSON as a blockout/data import source. A direct Unreal edit is not possible because the game is built with Phaser and Capacitor.
