"""
characters.py - build the five lifelike adult characters for Hazard Hunt v3 (plan 10
decision 7) with MPFB 2 in headless Blender, and export one skinned GLB per character.

    export BLENDER_USER_RESOURCES=$PWD/data/raw/blender-user     # MPFB + MakeHuman CC0 pack
    blender -b -noaudio --python scripts/blender/characters.py -- [--only grace] [--render]

Inputs (CC0): MPFB base mesh, macro targets and game_engine rig; MakeHuman system assets
(skins, eyes, brows, lashes, teeth, tongue, hair, clothes, shoes). scripts/fetch-assets.mjs
checks every licence first.
Own work in this file: the hi-vis vests (cut from the fitted clothing, reflective tape
bands), hard hats, hand props (scanner, tablet, clipboard), and every animation clip.

Animation is restrained and hand-keyed (no motion capture, no Mixamo):
  idle   4 s  breathing, small weight shift, slow head turn
  walk   1.12 s cycle (about 107 steps/min, 1.25 m/s when the app moves the root at that speed)
  scan   3 s  right arm raised, small scanning sweeps (handheld scanner)
  talk   4 s  hand gesture and nods (speak-up scene)
  drive  2 s  seated at a forklift wheel, small steering corrections
The root stays in place; the app moves characters along their routes.

Output: data/raw/characters/<id>.glb + meta.json (and --render: tmp/characters/*.png).
"""
import bpy, bmesh, importlib, sys, os, json, math
from mathutils import Vector, Matrix, Quaternion

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "data", "raw", "characters")
RENDER_DIR = os.path.join(ROOT, "tmp", "characters")
FABRIC = os.path.join(ROOT, "data", "raw", "decals")
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ONLY = argv[argv.index("--only") + 1].split(",") if "--only" in argv else None
RENDER = "--render" in argv
FPS = 30


def di(pkg, key):
    for m in list(sys.modules):
        if m.endswith(pkg):
            return getattr(importlib.import_module(m), key)
    raise ValueError(pkg)


HumanService = di("mpfb.services.humanservice", "HumanService")
AssetService = di("mpfb.services.assetservice", "AssetService")
TargetService = di("mpfb.services.targetservice", "TargetService")
ExportService = di("mpfb.services.exportservice", "ExportService")
HumanObjectProperties = di("mpfb.entities.objectproperties", "HumanObjectProperties")

# MakeHuman age macro: 0.5 = 25 years, 1.0 = 90 years (linear in between).
def age(years):
    return 0.5 + (years - 25) / 65 * 0.5

CHARACTERS = [
    dict(id="grace-supervisor", label="Grace, shift supervisor", gender=0.0, age=age(46), muscle=0.5, weight=0.58, height=0.45,
         eth=dict(african=1.0, asian=0.0, caucasian=0.0), skin="middleage_african_female", eyes="brown", brows="eyebrow006",
         hair="braid01", clothes=["male_casualsuit01", "shoes02"], hat="#F2F2EE", prop="clipboard", vest="#C9F200"),
    dict(id="associate-receiving", label="Receiving associate", gender=1.0, age=age(31), muscle=0.6, weight=0.52, height=0.5,
         eth=dict(african=0.0, asian=1.0, caucasian=0.0), skin="young_asian_male", eyes="brown", brows="eyebrow001",
         hair="short02", clothes=["male_worksuit01", "shoes02"], hat="#F7C600", prop="scanner", vest="#C9F200"),
    dict(id="associate-staging", label="Staging associate", gender=0.0, age=age(27), muscle=0.55, weight=0.48, height=0.55,
         eth=dict(african=0.0, asian=0.0, caucasian=1.0), skin="young_caucasian_female", eyes="blue", brows="eyebrow010",
         hair="ponytail01", clothes=["male_worksuit01", "shoes02"], hat="#F7C600", prop="tablet", vest="#FF7A1A"),
    dict(id="picker-replay", label="Order picker (incident replay)", gender=1.0, age=age(52), muscle=0.5, weight=0.62, height=0.48,
         eth=dict(african=0.0, asian=0.0, caucasian=1.0), skin="middleage_caucasian_male", eyes="brownlight", brows="eyebrow001",
         hair="short04", clothes=["male_casualsuit03", "shoes06"], hat="#F7C600", prop="scanner", vest="#C9F200"),
    dict(id="forklift-driver", label="Forklift driver", gender=1.0, age=age(24), muscle=0.62, weight=0.5, height=0.42,
         eth=dict(african=1.0, asian=0.0, caucasian=0.0), skin="young_african_male", eyes="brown", brows="eyebrow006",
         hair="short01", clothes=["male_worksuit01", "shoes02"], hat="#F7C600", prop=None, vest="#C9F200"),
]


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.actions, bpy.data.armatures):
        for block in list(coll):
            if block.users == 0:
                coll.remove(block)


def asset(fname, sub):
    p = AssetService.find_asset_absolute_path(fname, asset_subdir=sub)
    if not p:
        raise RuntimeError(f"missing MakeHuman asset {sub}/{fname}")
    return p


def principled(name, color, rough=0.6, metal=0.0, image=None, normal=None, scale=None, emission=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*hex_rgb(color), 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*hex_rgb(emission[0]), 1)
        bsdf.inputs["Emission Strength"].default_value = emission[1]
    if image:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(image, check_existing=True)
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    if normal:
        nt_img = nt.nodes.new("ShaderNodeTexImage")
        nt_img.image = bpy.data.images.load(normal, check_existing=True)
        nt_img.image.colorspace_settings.name = "Non-Color"
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = 0.6
        nt.links.new(nt_img.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def hex_rgb(h):
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]


def weight_to_bone(obj, rig, bone):
    vg = obj.vertex_groups.new(name=bone)
    vg.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = rig
    obj.parent = rig


def dominant_group(obj, v):
    best, bw = None, 0.0
    for g in v.groups:
        if g.weight > bw:
            best, bw = obj.vertex_groups[g.group].name, g.weight
    return best


ARM = ("upperarm", "lowerarm", "hand", "thumb", "index", "middle", "ring", "pinky")


def make_vest(clothes, rig, spec, bones):
    """Cut a vest from the fitted top: torso faces of the clothing, pushed out 9 mm, with
    retro-reflective tape (two hoops and two braces over the shoulders)."""
    bpy.ops.object.select_all(action="DESELECT")
    clothes.select_set(True)
    bpy.context.view_layer.objects.active = clothes
    bpy.ops.object.duplicate()
    vest = bpy.context.active_object
    vest.name = f"{spec['id']}-vest"
    for m in list(vest.modifiers):
        if m.type != "ARMATURE":
            vest.modifiers.remove(m)
    z_lo = bones["pelvis"].head_local.z + 0.06
    z_hi = bones["neck_01"].head_local.z - 0.015
    half_w = abs(bones["upperarm_l"].head_local.x) * 0.98
    me = vest.data
    me.materials.clear()
    # Fluorescent pigment converts short wavelengths into visible light, so the fabric reads
    # brighter than its albedo; a small emissive term stands in for that.
    me.materials.append(principled(f"{spec['id']}-vest-fabric", spec["vest"], rough=0.78,
                                   image=None, normal=os.path.join(FABRIC, "fabric-hivis-mesh-normal.png"),
                                   emission=(spec["vest"], 0.12)))
    me.materials.append(principled(f"{spec['id']}-vest-tape", "#D9DDE0", rough=0.28, metal=0.0))
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    deform = bm.verts.layers.deform.active
    names = {i: g.name for i, g in enumerate(vest.vertex_groups)}

    def is_arm(v):
        if deform is None:
            return False
        wts = v[deform]
        arm = sum(w for gi, w in wts.items() if names.get(gi, "").startswith(ARM))
        return arm > 0.25

    kill = []
    for f in bm.faces:
        c = f.calc_center_median()
        if c.z < z_lo or c.z > z_hi or abs(c.x) > half_w or any(is_arm(v) for v in f.verts):
            kill.append(f)
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    # The face-centre cut leaves stepped edges; relax the boundary loops along themselves.
    for _ in range(8):
        moves = {}
        for v in bm.verts:
            if not v.is_boundary:
                continue
            nb = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
            if len(nb) == 2:
                moves[v] = v.co * 0.5 + (nb[0].co + nb[1].co) * 0.25
        for v, co in moves.items():
            v.co = co
    # Push out along normals so the vest sits over the shirt.
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * 0.009
    # Tape layout.
    h = z_hi - z_lo
    for f in bm.faces:
        c = f.calc_center_median()
        rel = (c.z - z_lo) / h
        hoop = 0.16 < rel < 0.25 or 0.48 < rel < 0.57
        brace = rel > 0.57 and 0.42 * half_w < abs(c.x) < 0.66 * half_w
        f.material_index = 1 if (hoop or brace) else 0
    bm.to_mesh(me)
    bm.free()
    solid = vest.modifiers.new("Solidify", "SOLIDIFY")
    solid.thickness = 0.003
    solid.offset = 1.0
    # Keep the armature modifier last so the solidify bakes in rest space.
    bpy.context.view_layer.objects.active = vest
    bpy.ops.object.modifier_move_to_index(modifier="Solidify", index=0)
    bpy.ops.object.modifier_apply(modifier="Solidify")
    # Tiling UVs for the mesh-fabric normal map (cube projection, ~5 cm repeat).
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.cube_project(cube_size=0.05)
    bpy.ops.object.mode_set(mode="OBJECT")
    return vest


def head_bounds(objs, rig):
    """Bounding box of everything weighted mostly to the head bone (skin + hair)."""
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    for o in objs:
        if o.type != "MESH":
            continue
        gi = o.vertex_groups.find("head")
        if gi < 0:
            continue
        for v in o.data.vertices:
            for g in v.groups:
                if g.group == gi and g.weight > 0.6:
                    co = o.matrix_world @ v.co
                    lo = Vector(map(min, lo, co))
                    hi = Vector(map(max, hi, co))
    return lo, hi


def make_hat(spec, rig, lo, hi):
    """Hard hat: a shell over the crown, a front peak and a brim ridge, weighted to the head."""
    cx, cy = (lo.x + hi.x) / 2, (lo.y + hi.y) / 2
    rx, ry = (hi.x - lo.x) / 2 + 0.012, (hi.y - lo.y) / 2 + 0.016
    top = hi.z + 0.018
    base = hi.z - 0.118
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=20, radius=1, location=(0, 0, 0))
    shell = bpy.context.active_object
    bm = bmesh.new()
    bm.from_mesh(shell.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.02], context="VERTS")
    for v in bm.verts:
        x, y, z = v.co
        z = max(z, 0)
        # Slight forward peak and a central ridge, as on common cap-style hard hats.
        peak = 0.18 * max(0, -y) * (1 - z) ** 2
        ridge = 0.035 * math.exp(-(x / 0.12) ** 2) * z
        # Flatter crown than a sphere: z ** 0.8 keeps the sides steep and the top broad.
        v.co = Vector((cx + x * rx, cy + y * ry * (1 + peak), base + (z ** 0.8) * (top - base) * (1 + ridge)))
    bm.to_mesh(shell.data)
    bm.free()
    sol = shell.modifiers.new("Solidify", "SOLIDIFY")
    sol.thickness = 0.004
    bpy.ops.object.modifier_apply(modifier="Solidify")
    bpy.ops.object.shade_smooth()
    shell.name = f"{spec['id']}-hardhat"
    shell.data.materials.append(principled(f"{spec['id']}-hardhat", spec["hat"], rough=0.38))
    # Brim ridge ring.
    bpy.ops.mesh.primitive_torus_add(major_radius=1, minor_radius=0.03, major_segments=48, minor_segments=8, location=(0, 0, 0))
    ring = bpy.context.active_object
    for v in ring.data.vertices:
        v.co = Vector((cx + v.co.x * rx * 1.02, cy + v.co.y * ry * 1.02 * (1.12 if v.co.y < 0 else 1.0), base + v.co.z * 0.25))
    ring.data.materials.append(shell.data.materials[0])
    bpy.ops.object.select_all(action="DESELECT")
    shell.select_set(True)
    ring.select_set(True)
    bpy.context.view_layer.objects.active = shell
    bpy.ops.object.join()
    bpy.ops.object.shade_smooth()
    weight_to_bone(shell, rig, "head")
    return shell


def make_prop(kind, spec, rig, bones):
    hand = bones["hand_r" if kind == "scanner" else "hand_l"]
    p = hand.tail_local.copy()
    if kind == "scanner":
        # Handheld barcode scanner: grip, head and a red window. About 18 cm long.
        bpy.ops.mesh.primitive_cube_add(size=1, location=p + Vector((0.0, -0.02, -0.03)))
        grip = bpy.context.active_object
        grip.scale = (0.03, 0.04, 0.11)
        bpy.ops.mesh.primitive_cube_add(size=1, location=p + Vector((0.0, -0.075, 0.03)))
        head = bpy.context.active_object
        head.scale = (0.055, 0.12, 0.045)
        bpy.ops.mesh.primitive_plane_add(size=1, location=p + Vector((0.0, -0.1361, 0.03)), rotation=(math.pi / 2, 0, 0))
        window = bpy.context.active_object
        window.scale = (0.045, 0.03, 1)
        for o, mat in ((grip, principled("scanner-body", "#2B2F33", rough=0.55)), (head, principled("scanner-head", "#F2B705", rough=0.45)),
                       (window, principled("scanner-window", "#5A0A0A", rough=0.1, emission=("#FF2A2A", 1.5)))):
            o.data.materials.append(mat)
        objs = [grip, head, window]
    elif kind == "tablet":
        bpy.ops.mesh.primitive_cube_add(size=1, location=p + Vector((0.02, -0.06, 0.0)))
        body = bpy.context.active_object
        body.scale = (0.012, 0.17, 0.25)
        bpy.ops.mesh.primitive_plane_add(size=1, location=p + Vector((0.027, -0.06, 0.0)), rotation=(0, math.pi / 2, 0))
        scr = bpy.context.active_object
        scr.scale = (0.22, 0.15, 1)
        body.data.materials.append(principled("tablet-case", "#1D2126", rough=0.7))
        scr.data.materials.append(principled("tablet-screen", "#0B1A26", rough=0.08, emission=("#3D7FB5", 0.6)))
        objs = [body, scr]
    else:  # clipboard with a sheet
        bpy.ops.mesh.primitive_cube_add(size=1, location=p + Vector((0.02, -0.07, 0.0)))
        board = bpy.context.active_object
        board.scale = (0.006, 0.23, 0.32)
        bpy.ops.mesh.primitive_cube_add(size=1, location=p + Vector((0.024, -0.07, -0.01)))
        sheet = bpy.context.active_object
        sheet.scale = (0.002, 0.21, 0.28)
        bpy.ops.mesh.primitive_cube_add(size=1, location=p + Vector((0.026, -0.07, 0.15)))
        clip = bpy.context.active_object
        clip.scale = (0.01, 0.09, 0.03)
        board.data.materials.append(principled("clipboard-board", "#6B4A2B", rough=0.7))
        sheet.data.materials.append(principled("clipboard-sheet", "#F4F2EC", rough=0.9))
        clip.data.materials.append(principled("clipboard-clip", "#A7ADB3", rough=0.3, metal=1.0))
        objs = [board, sheet, clip]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.join()
    prop = bpy.context.active_object
    prop.name = f"{spec['id']}-{kind}"
    weight_to_bone(prop, rig, hand.name)
    return prop


# ---------------- Animation ----------------
def rest_rot(bone):
    return bone.matrix_local.to_3x3().to_quaternion()


def local_q(pb, world_q):
    """Rotation given in armature rest space -> pose-bone local quaternion."""
    b = rest_rot(pb.bone)
    return b.inverted() @ world_q @ b


def axis_q(axis, deg):
    return Quaternion(Vector(axis), math.radians(deg))


AX = {"x": (1, 0, 0), "y": (0, 1, 0), "z": (0, 0, 1)}
FINGERS = ("thumb", "index", "middle", "ring", "pinky")


def base_pose(side):
    """Arms down from the MakeHuman A-pose to a relaxed stance."""
    s = 1 if side == "l" else -1
    return {f"upperarm_{side}": axis_q(AX["y"], 33 * s) @ axis_q(AX["x"], -4),
            f"lowerarm_{side}": axis_q(AX["x"], -8)}


def key_clip(rig, name, length_s, fn, step=2):
    """fn(t in [0,1)) -> {bone: Quaternion in armature space} plus optional ('loc', bone): Vector."""
    act = bpy.data.actions.new(name)
    rig.animation_data_create()
    rig.animation_data.action = act
    frames = int(round(length_s * FPS))
    pbs = rig.pose.bones
    base = {**base_pose("l"), **base_pose("r")}
    for pb in pbs:
        pb.rotation_mode = "QUATERNION"
    for f in list(range(0, frames, step)) + [frames]:
        t = (f % frames) / frames
        pose = fn(t)
        # Every body bone is keyed in every clip, so clips are self-contained and blend cleanly.
        for pb in pbs:
            bn = pb.name
            if bn == "Root":
                continue
            if bn.startswith(FINGERS):
                curl = 12 if bn.startswith("thumb") else (14 if "_01_" in bn else 22)
                pb.rotation_quaternion = Quaternion((1, 0, 0), math.radians(curl))
            else:
                q = pose.get(bn, Quaternion()) @ base.get(bn, Quaternion())
                pb.rotation_quaternion = local_q(pb, q)
            pb.keyframe_insert("rotation_quaternion", frame=f + 1)
        pbs["pelvis"].location = Vector()
        pbs["pelvis"].keyframe_insert("location", frame=f + 1)
        for k, v in pose.items():
            if isinstance(k, tuple) and k[0] == "loc":
                pb = pbs[k[1]]
                pb.location = rest_rot(pb.bone).inverted() @ v
                pb.keyframe_insert("location", frame=f + 1)
    for fc in act.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, 1, act)
    strip.action_frame_end = frames + 1
    rig.animation_data.action = None
    return act


S = lambda x: math.sin(2 * math.pi * x)
C = lambda x: math.cos(2 * math.pi * x)


def walk(t):
    p = {}
    for side, ph in (("l", 0.0), ("r", 0.5)):
        u = (t + ph) % 1.0
        p[f"thigh_{side}"] = axis_q(AX["x"], -21 * C(u) + 3)
        swing = max(0.0, S(u - 0.5)) if u >= 0.5 else 0.0
        load = max(0.0, S(u * 2)) if u < 0.25 else 0.0
        p[f"calf_{side}"] = axis_q(AX["x"], 4 + 58 * swing ** 1.4 + 12 * load)
        p[f"foot_{side}"] = axis_q(AX["x"], -10 * C(u) - 4 * swing)
        p[f"upperarm_{side}"] = axis_q(AX["x"], 14 * C(u))
        p[f"lowerarm_{side}"] = axis_q(AX["x"], -10 - 6 * max(0, -C(u)))
    p["pelvis"] = axis_q(AX["z"], 4 * C(t)) @ axis_q(AX["y"], 2 * S(t))
    p["spine_02"] = axis_q(AX["z"], -3 * C(t))
    p["spine_03"] = axis_q(AX["z"], -2 * C(t))
    p["neck_01"] = axis_q(AX["z"], 1.5 * C(t))
    p[("loc", "pelvis")] = Vector((0, 0, 0.018 * C(2 * t) - 0.012))
    return p


def idle(t):
    br = S(t)  # one breath per 4 s clip
    shift = S(t * 0.5 + 0.1) if False else S(t)
    return {
        "spine_02": axis_q(AX["x"], -1.2 * br),
        "spine_03": axis_q(AX["x"], -1.0 * br),
        "pelvis": axis_q(AX["y"], 1.4 * shift),
        "neck_01": axis_q(AX["z"], 6 * S(t + 0.2)),
        "head": axis_q(AX["x"], 2 * br),
        "upperarm_l": axis_q(AX["x"], 1.5 * br), "upperarm_r": axis_q(AX["x"], 1.5 * br),
        "thigh_l": axis_q(AX["x"], -1.5 * shift), "thigh_r": axis_q(AX["x"], 1.5 * shift),
    }


def scan(t):
    sweep = S(t * 2)
    return {
        "upperarm_r": axis_q(AX["x"], -52 + 4 * sweep) @ axis_q(AX["z"], -14),
        "lowerarm_r": axis_q(AX["x"], -38),
        "hand_r": axis_q(AX["z"], 10 * sweep),
        "upperarm_l": axis_q(AX["x"], -12),
        "lowerarm_l": axis_q(AX["x"], -30),
        "spine_03": axis_q(AX["x"], 6) @ axis_q(AX["z"], 4 * sweep),
        "head": axis_q(AX["x"], 14),
    }


def talk(t):
    g = max(0.0, S(t)) ** 1.5
    return {
        "upperarm_r": axis_q(AX["x"], -24 * g) @ axis_q(AX["y"], -10 * g),
        "lowerarm_r": axis_q(AX["x"], -48 * g - 10),
        "hand_r": axis_q(AX["z"], -20 * g),
        "upperarm_l": axis_q(AX["x"], -14),
        "lowerarm_l": axis_q(AX["x"], -55),
        "head": axis_q(AX["x"], 4 * S(t * 3)),
        "neck_01": axis_q(AX["z"], 5 * S(t + 0.3)),
        "spine_03": axis_q(AX["x"], -1.5 * S(t)),
    }


def drive(t):
    steer = S(t)
    p = {}
    for side, s in (("l", 1), ("r", -1)):
        p[f"thigh_{side}"] = axis_q(AX["x"], -82) @ axis_q(AX["y"], 6 * s)
        p[f"calf_{side}"] = axis_q(AX["x"], 80)
        p[f"foot_{side}"] = axis_q(AX["x"], -6)
        p[f"upperarm_{side}"] = axis_q(AX["x"], -40) @ axis_q(AX["z"], -6 * s)
        p[f"lowerarm_{side}"] = axis_q(AX["x"], -32 + 4 * steer * s)
    p["spine_02"] = axis_q(AX["x"], 4)
    p["head"] = axis_q(AX["z"], 8 * S(t + 0.25))
    p[("loc", "pelvis")] = Vector((0, 0.0, 0.0))
    return p


CLIPS = [("idle", 4.0, idle), ("walk", 1.12, walk), ("scan", 3.0, scan), ("talk", 4.0, talk), ("drive", 2.0, drive)]


def set_eye_colour(eyes_obj, colour):
    img_path = os.path.join(os.path.dirname(asset("low-poly.mhclo", "eyes")), "..", "materials", f"{colour}_eye.png")
    img_path = os.path.abspath(img_path)
    for slot in eyes_obj.material_slots:
        for n in slot.material.node_tree.nodes:
            if n.type == "TEX_IMAGE" and n.image and "eye" in n.image.name.lower():
                n.image = bpy.data.images.load(img_path, check_existing=True)


def build(spec):
    clear_scene()
    b = HumanService.create_human()
    for k, v in (("gender", spec["gender"]), ("age", spec["age"]), ("muscle", spec["muscle"]),
                 ("weight", spec["weight"]), ("height", spec["height"]), ("proportions", 0.6), *spec["eth"].items()):
        HumanObjectProperties.set_value(k, v, entity_reference=b)
    TargetService.reapply_macro_details(b)
    HumanService.set_character_skin(asset(f"{spec['skin']}.mhmat", "skins"), b, skin_type="GAMEENGINE")
    HumanService.add_builtin_rig(b, "game_engine")
    rig = b.parent
    parts = {}
    for sub, fname, atype in [("eyes", "low-poly.mhclo", "Eyes"), ("eyebrows", f"{spec['brows']}.mhclo", "Eyebrows"),
                              ("eyelashes", "eyelashes01.mhclo", "Eyelashes"), ("hair", f"{spec['hair']}.mhclo", "Hair")] + \
                             [("clothes", f"{c}.mhclo", "Clothes") for c in spec["clothes"]]:
        before = set(bpy.data.objects)
        HumanService.add_mhclo_asset(asset(fname, sub), b, asset_type=atype, material_type="GAMEENGINE")
        new = [o for o in bpy.data.objects if o not in before]
        parts[fname] = new[0] if new else None
    set_eye_colour(parts["low-poly.mhclo"], spec["eyes"])
    bones = rig.data.bones
    top = parts[f"{spec['clothes'][0]}.mhclo"]
    make_vest(top, rig, spec, bones)
    lo, hi = head_bounds([b, parts[f"{spec['hair']}.mhclo"]], rig)
    make_hat(spec, rig, lo, hi)
    if spec["prop"]:
        make_prop(spec["prop"], spec, rig, bones)
    ExportService.bake_modifiers_remove_helpers(b, bake_masks=True, bake_subdiv=False, remove_helpers=True, also_proxy=False)
    # Bake MakeHuman shape keys into the mesh: the GLB carries no morph targets.
    for o in rig.children:
        if o.type == "MESH" and o.data.shape_keys:
            bpy.context.view_layer.objects.active = o
            o.shape_key_add(name="baked", from_mix=True)
            for kb in list(o.data.shape_keys.key_blocks)[:-1]:
                o.shape_key_remove(kb)
            o.shape_key_remove(o.data.shape_keys.key_blocks[0])
        if o.type == "MESH":
            for m in list(o.modifiers):
                if m.type not in ("ARMATURE",):
                    bpy.context.view_layer.objects.active = o
                    try:
                        bpy.ops.object.modifier_apply(modifier=m.name)
                    except RuntimeError:
                        o.modifiers.remove(m)
    for name, length, fn in CLIPS:
        key_clip(rig, name, length, fn)
    rig.name = spec["id"]
    return rig


def export(rig, spec):
    os.makedirs(OUT, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    for o in rig.children_recursive:
        if o.type == "MESH" and (o.name.startswith("Human") or o.name.startswith(spec["id"])):
            o.select_set(True)
    bpy.context.view_layer.objects.active = rig
    path = os.path.join(OUT, f"{spec['id']}.glb")
    stats_before = None
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True,
                              export_animations=True, export_animation_mode="NLA_TRACKS", export_skins=True,
                              export_morph=False, export_yup=True, export_image_format="AUTO",
                              export_force_sampling=True, export_frame_step=1, export_def_bones=False)
    sel = [o for o in bpy.context.selected_objects if o.type == "MESH"]
    for o in sel:
        o.data.calc_loop_triangles()
    tris = sum(len(o.data.loop_triangles) for o in sel)
    rig.data.pose_position = "REST"
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in sel for c in o.evaluated_get(bpy.context.evaluated_depsgraph_get()).bound_box]
    rig.data.pose_position = "POSE"
    lo = Vector([min(p[i] for p in pts) for i in range(3)])
    hi = Vector([max(p[i] for p in pts) for i in range(3)])
    height = hi.z
    size = [round(hi.x - lo.x, 3), round(hi.z - lo.z, 3), round(hi.y - lo.y, 3)]  # glTF order x, y(up), z; rest pose
    return dict(label=spec["label"], heightM=round(height, 3), sizeM=size, trianglesBlender=tris,
                clips={n: l for n, l, _ in CLIPS},
                inputs=dict(skin=spec["skin"], hair=spec["hair"], clothes=spec["clothes"], eyes=spec["eyes"], brows=spec["brows"]),
                ownWork=["hi-vis vest", "hard hat"] + ([spec["prop"]] if spec["prop"] else []) + ["animation clips"],
                honesty="fictional character; restrained hand-keyed animation")


def render(rig, spec):
    os.makedirs(RENDER_DIR, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items.keys() else "BLENDER_EEVEE"
    sc.render.resolution_x, sc.render.resolution_y = 640, 900
    sc.world = sc.world or bpy.data.worlds.new("w")
    sc.world.use_nodes = True
    sc.world.node_tree.nodes["Background"].inputs[0].default_value = (0.08, 0.09, 0.1, 1)
    sc.world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
    bpy.ops.object.light_add(type="AREA", location=(1.5, -2.5, 2.6))
    key = bpy.context.active_object
    key.data.energy = 600
    key.data.size = 2
    key.rotation_euler = (math.radians(55), 0, math.radians(30))
    bpy.ops.object.light_add(type="AREA", location=(-2, 1.5, 2.0))
    rim = bpy.context.active_object
    rim.data.energy = 250
    rim.rotation_euler = (math.radians(-60), 0, math.radians(-140))
    bpy.ops.object.camera_add(location=(0, -3.6, 1.0), rotation=(math.radians(88), 0, 0))
    cam = bpy.context.active_object
    cam.data.lens = 50
    sc.camera = cam
    shots = [("front", 0, "idle", 1), ("side", 90, "walk", 9), ("close", 0, "idle", 1), ("scan", 35, "scan", 20), ("drive", 70, "drive", 1)]
    for shot, yaw, clip, frame in shots:
        for tr in rig.animation_data.nla_tracks:
            tr.mute = tr.name != clip
        sc.frame_set(frame)
        rig.rotation_euler = (0, 0, math.radians(yaw))
        if shot == "close":
            cam.location = (0, -1.0, rig.data.bones["head"].head_local.z + 0.06)
            cam.rotation_euler = (math.radians(90), 0, 0)
        else:
            cam.location = (0, -3.6, 0.95)
            cam.rotation_euler = (math.radians(89), 0, 0)
        sc.render.filepath = os.path.join(RENDER_DIR, f"{spec['id']}-{shot}.png")
        bpy.ops.render.render(write_still=True)
    rig.rotation_euler = (0, 0, 0)
    for tr in rig.animation_data.nla_tracks:
        tr.mute = False


meta_path = os.path.join(OUT, "meta.json")
meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
for spec in CHARACTERS:
    if ONLY and spec["id"] not in ONLY:
        continue
    rig = build(spec)
    meta[spec["id"]] = export(rig, spec)
    if RENDER:
        render(rig, spec)
    print(f"CHAR {spec['id']}: {meta[spec['id']]}")
os.makedirs(OUT, exist_ok=True)
json.dump(meta, open(meta_path, "w"), indent=2)
