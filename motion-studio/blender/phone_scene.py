"""
Blender phone hero shot — the 3D half of the pipeline (like `blender_ugoki94.py` in the reference reel).

Builds a rounded phone body, maps a screen image onto its face, lights it with softbox area lights,
animates a slow camera-relative turn with drivers (no hand-set keyframes), and renders a PNG sequence.

  1. Make the screen image:   node ../render.cjs --still 0  (or screenshot screens/profile.html at 1170x2532)
  2. Render:                  blender -b -P phone_scene.py -- --screen ../out/screen.png --out ../out/phone_ --frames 90
  3. Use the frames as a background layer in a scene, or encode:  ffmpeg -framerate 30 -i ../out/phone_%04d.png phone.mp4

STATUS: written against Blender 4.x Python API; NOT yet run (Blender isn't installed in the build container).
Kimimaro should run it once on a machine with Blender before it's used for client work.
"""
import sys, math, argparse
import bpy

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--screen", required=True, help="PNG for the phone screen")
ap.add_argument("--out", default="//phone_", help="output path prefix")
ap.add_argument("--frames", type=int, default=90)
ap.add_argument("--fps", type=int, default=30)
ap.add_argument("--res", default="1080x1920")
ap.add_argument("--accent", default="0.9,0.15,0.12", help="rim light RGB 0-1")
ap.add_argument("--samples", type=int, default=64)
a = ap.parse_args(argv)

# ---------- reset ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene
W, H = map(int, a.res.split("x"))
scn.render.resolution_x, scn.render.resolution_y = W, H
scn.render.fps = a.fps
scn.frame_start, scn.frame_end = 1, a.frames
scn.render.engine = "CYCLES"
scn.cycles.samples = a.samples
scn.render.filepath = a.out
scn.render.image_settings.file_format = "PNG"
scn.render.film_transparent = False
scn.world = bpy.data.worlds.new("World")
scn.world.use_nodes = True
scn.world.node_tree.nodes["Background"].inputs[0].default_value = (0.02, 0.003, 0.003, 1)

def mat(name, color, rough=0.3, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    return m

# ---------- phone body (units: 1 = 10cm; iPhone ~ 0.715 x 1.47 x 0.08) ----------
bpy.ops.mesh.primitive_cube_add(size=1)
body = bpy.context.object; body.name = "Phone"
body.scale = (0.715, 1.47, 0.08)
bpy.ops.object.transform_apply(scale=True)
bev = body.modifiers.new("Bevel", "BEVEL"); bev.width = 0.11; bev.segments = 12
body.data.materials.append(mat("Titanium", (0.75, 0.75, 0.78), rough=0.25, metal=1.0))
bpy.ops.object.shade_smooth()

# ---------- screen: plane with emissive image texture ----------
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0.0405))
screen = bpy.context.object; screen.name = "Screen"
screen.scale = (0.67, 1.42, 1); screen.parent = body
sm = bpy.data.materials.new("ScreenMat"); sm.use_nodes = True
nt = sm.node_tree; nt.nodes.clear()
tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = bpy.data.images.load(bpy.path.abspath(a.screen))
emit = nt.nodes.new("ShaderNodeEmission"); emit.inputs["Strength"].default_value = 1.4
glossy = nt.nodes.new("ShaderNodeBsdfGlossy"); glossy.inputs["Roughness"].default_value = 0.05
mix = nt.nodes.new("ShaderNodeMixShader"); mix.inputs[0].default_value = 0.08   # a little glass reflection
outn = nt.nodes.new("ShaderNodeOutputMaterial")
nt.links.new(tex.outputs["Color"], emit.inputs["Color"])
nt.links.new(emit.outputs[0], mix.inputs[1]); nt.links.new(glossy.outputs[0], mix.inputs[2])
nt.links.new(mix.outputs[0], outn.inputs["Surface"])
screen.data.materials.append(sm)

# ---------- softbox lights ("the light") ----------
def softcard(name, loc, rot, size, power, color=(1, 1, 1)):
    bpy.ops.object.light_add(type="AREA", location=loc, rotation=[math.radians(r) for r in rot])
    L = bpy.context.object; L.name = name
    L.data.shape = "RECTANGLE"; L.data.size, L.data.size_y = size
    L.data.energy = power; L.data.color = color
    return L
softcard("sb_left",  (-2.2, 0.8, 1.5), (0, -55, 0),  (0.6, 3.0), 400)
softcard("sb_right", ( 2.4, -0.5, 1.2), (0, 60, 0),  (0.4, 3.0), 250)
softcard("rim",      ( 0.0, 2.5, -1.5), (120, 0, 0), (3.0, 0.3), 600, tuple(float(c) for c in a.accent.split(",")))

# ---------- camera ----------
bpy.ops.object.camera_add(location=(0, 0, 4.6))
cam = bpy.context.object; scn.camera = cam; cam.data.lens = 70

# ---------- motion as functions of frame (drivers), not keyframes ----------
def drive(obj, path, idx, expr):
    d = obj.driver_add(path, idx).driver; d.type = "SCRIPTED"; d.expression = expr
N = a.frames
# ease-in-out turn from -35deg to +20deg on Y, gentle tilt on X, slight float
drive(body, "rotation_euler", 1, f"radians(-35 + 55*(0.5-0.5*cos(pi*min(frame/{N},1))))")
drive(body, "rotation_euler", 0, f"radians(12 - 16*(frame/{N}))")
drive(body, "location", 1, f"0.04*sin(frame/{N}*2*pi)")

bpy.ops.render.render(animation=True)
print("Rendered", N, "frames to", a.out)
