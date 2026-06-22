import json
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
