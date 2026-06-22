# Unreal Import Notes

This folder is a handoff package, not a native Unreal project.

Use `unxpected-levels.json` as blockout data:

- 1 source pixel maps cleanly to 1 Unreal centimeter.
- `x/y/width/height` are Phaser top-left rectangles.
- Convert to Unreal as X = source x, Z = -source y, Y = lane depth.
- Collision should be rebuilt with simple Box Collision components.
- Mutation fields are gameplay metadata. In Unreal, map them to Blueprint events or data assets.

Recommended Unreal final-touch path:

1. Import the JSON into a DataTable or a custom Editor Utility Blueprint.
2. Spawn StaticMeshActor boxes for platforms, spikes, sensors, coins, and portal markers.
3. Replace blockout meshes with authored art assets.
4. Rebuild movement with CharacterMovementComponent or a custom 2D side-scroller pawn.
5. Recreate the adaptive director as a Gameplay Ability, Actor Component, or subsystem.

The current Phaser app remains the shipping Android build. Unreal would be a port, not a direct edit.
