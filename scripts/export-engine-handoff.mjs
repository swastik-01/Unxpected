import fs from 'node:fs/promises';
import path from 'node:path';

const outDir = path.resolve('engine-export');
const levels = [1, 25, 50, 99].map(createEngineLevel);

await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(path.join(outDir, 'unxpected-levels.json'), `${JSON.stringify({
  project: 'Unxpected',
  sourceRuntime: 'Phaser 3 Arcade Physics',
  coordinateSystem: {
    sourceUnits: 'pixels',
    blenderScale: '1 pixel = 0.01 Blender meters',
    unrealScale: '1 pixel = 1 Unreal centimeter',
    origin: 'source top-left converted to centered 3D blockout coordinates'
  },
  levels
}, null, 2)}\n`);
await fs.writeFile(path.join(outDir, 'blender_import_unxpected.py'), blenderScript());
await fs.writeFile(path.join(outDir, 'UNREAL_IMPORT_NOTES.md'), unrealNotes());
await fs.writeFile(path.join(outDir, 'README.md'), readme());

console.log(JSON.stringify({
  outDir,
  files: [
    'unxpected-levels.json',
    'blender_import_unxpected.py',
    'UNREAL_IMPORT_NOTES.md',
    'README.md'
  ]
}, null, 2));

function createEngineLevel(levelIndex) {
  const variant = Math.max(0, (levelIndex - 2) % 6);
  const tier = Math.floor((levelIndex - 1) / 25);
  const entities = [
    platform('ground_00', 0, 650, 720, 70),
    platform('ground_01', 730, 650, 340, 70),
    platform('wait_lift_01', 1120, 580, 220, 38, 'elevator_crush'),
    platform('collapse_01', 1400, 650, 300, 70, 'floor_collapse'),
    platform('phase_01', 1810, 545, 210, 35, 'platform_phase'),
    platform('ground_03', 2140, 650, 330, 70),
    platform('jump_wall_sensor', 2540, 465, 42, 185, 'physics_gaslight', 'sensor'),
    platform('ground_04', 2715, 650, 340, 70),
    platform('mercy_bridge', 3065, 612, 230, 32, 'mercy_bridge', 'sensor'),
    platform('ground_05', 3380, 650, 740, 70),
    coin('coin_00', 520, 560),
    coin('coin_01', 900, 560),
    coin('coin_scramble_02', 1535, 578, levelIndex >= 2 ? 'semantic_scramble' : null),
    coin('coin_03', 2235, 560),
    coin('coin_scramble_04', 2875, 560, levelIndex >= 3 ? 'semantic_scramble' : null),
    hazard('spike_00', 1040, 612, 38, 38),
    hazard('spike_01', 1680, 612, 38, 38),
    hazard('spike_02', 2485, 612, 38, 38),
    hazard('projectile_01', 2360, 602, 58, 18, 'weapon_fire'),
    goal('goal_01', 3980, 530, 72, 120)
  ];

  if (levelIndex >= 2) {
    entities.splice(10, 0, platform('variant_riser_01', 610 + variant * 26, 548 - (variant % 3) * 28, 178, 30));
  }
  if (levelIndex >= 5) {
    entities.splice(11, 0, hazard('timer_shot_01', 3270, 588 - (variant % 2) * 40, 58, 18, 'weapon_fire'));
  }
  if (levelIndex >= 9) {
    entities.splice(12, 0, platform('collapse_02', 865 + variant * 22, 650, 185, 70, 'floor_collapse'));
  }
  if (levelIndex >= 15) {
    entities.splice(13, 0, coin('coin_high_variant', 1960 + variant * 18, 470 - (variant % 2) * 34, 'semantic_scramble'));
  }
  if (tier >= 2) {
    entities.splice(14, 0, hazard('spike_pressure_variant', 3065 + (variant % 3) * 42, 574, 38, 76, 'physics_gaslight'));
  }

  return {
    levelIndex,
    noCheckpoints: true,
    playerStart: { x: 120, y: 560, width: 34, height: 52 },
    world: { width: 4300, height: 980 },
    entities
  };
}

function platform(id, x, y, width, height, mutation = null, collision = 'solid') {
  return entity('platform', id, x, y, width, height, collision, mutation);
}

function hazard(id, x, y, width, height, mutation = null) {
  return entity('hazard', id, x, y, width, height, mutation ? 'sensor' : 'lethal_hazard', mutation);
}

function coin(id, x, y, mutation = null) {
  return entity('collectible', id, x, y, 34, 34, mutation ? 'trigger_or_lethal' : 'trigger_pickup', mutation);
}

function goal(id, x, y, width, height) {
  return entity('goal', id, x, y, width, height, 'goal', null);
}

function entity(type, id, x, y, width, height, collision, mutation) {
  return {
    id,
    type,
    x,
    y,
    width,
    height,
    collision,
    mutation,
    blenderMaterial: materialFor(type, collision, mutation)
  };
}

function materialFor(type, collision, mutation) {
  if (type === 'goal') return 'portal_green';
  if (type === 'collectible') return mutation ? 'coin_unstable' : 'coin_gold';
  if (type === 'hazard') return mutation ? 'hazard_warning' : 'hazard_red';
  if (collision === 'sensor') return 'sensor_blue';
  if (mutation) return 'platform_unstable';
  return 'platform_safe';
}

function blenderScript() {
  return `import json
from pathlib import Path
import bpy

SCALE = 0.01
DATA = Path(__file__).with_name("unxpected-levels.json")

materials = {
    "platform_safe": (0.11, 0.55, 0.34, 1.0),
    "platform_unstable": (0.55, 0.18, 0.75, 1.0),
    "sensor_blue": (0.18, 0.55, 0.95, 0.35),
    "hazard_red": (1.0, 0.16, 0.24, 1.0),
    "hazard_warning": (1.0, 0.72, 0.2, 1.0),
    "coin_gold": (1.0, 0.72, 0.22, 1.0),
    "coin_unstable": (1.0, 0.2, 0.45, 1.0),
    "portal_green": (0.18, 0.95, 0.55, 1.0),
    "player": (0.9, 0.95, 1.0, 1.0)
}

def material(name):
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = materials[name]
    return mat

def clear_collection(name):
    collection = bpy.data.collections.get(name)
    if collection:
        for obj in list(collection.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
    else:
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
    return collection

def add_box(collection, name, x, y, width, height, mat_name, z=0.0, depth=0.18):
    bpy.ops.mesh.primitive_cube_add(size=1, location=((x + width / 2) * SCALE, z, -(y + height / 2) * SCALE))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = (width * SCALE, depth, height * SCALE)
    obj.data.materials.append(material(mat_name))
    collection.objects.link(obj)
    bpy.context.collection.objects.unlink(obj)
    return obj

def add_level(level):
    collection = clear_collection(f"Unxpected Level {level['levelIndex']}")
    add_box(collection, "player_start_collision", level["playerStart"]["x"], level["playerStart"]["y"], level["playerStart"]["width"], level["playerStart"]["height"], "player", z=-0.45, depth=0.24)
    for ent in level["entities"]:
        add_box(collection, ent["id"], ent["x"], ent["y"], ent["width"], ent["height"], ent["blenderMaterial"])
    return collection

data = json.loads(DATA.read_text())
for level in data["levels"]:
    add_level(level)

bpy.ops.wm.save_as_mainfile(filepath=str(DATA.with_suffix(".blend")))
print("Unxpected blockout exported next to JSON.")
`;
}

function unrealNotes() {
  return `# Unreal Import Notes

This folder is a handoff package, not a native Unreal project.

Use \`unxpected-levels.json\` as blockout data:

- 1 source pixel maps cleanly to 1 Unreal centimeter.
- \`x/y/width/height\` are Phaser top-left rectangles.
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
`;
}

function readme() {
  return `# Unxpected Engine Handoff

Generated files:

- \`unxpected-levels.json\`: editable level blockout and mutation metadata.
- \`blender_import_unxpected.py\`: creates a Blender blockout from the JSON and saves a \`.blend\`.
- \`UNREAL_IMPORT_NOTES.md\`: Unreal porting notes and coordinate mapping.

Blender:

1. Open Blender.
2. Run \`blender_import_unxpected.py\` from the Scripting workspace.
3. Edit or replace the generated meshes with final art.

Unreal:

Use the JSON as a blockout/data import source. A direct Unreal edit is not possible because the game is built with Phaser and Capacitor.
`;
}
