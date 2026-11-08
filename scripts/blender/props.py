"""
props.py - own Blender work for Hazard Hunt v3: the warehouse objects no CC0 library
offers (forklift, reach truck, pallet jack, pallets and cartons, racking, conveyor and
e-stop, trailer, dock leveller, dock signal and restraint, eyewash station, PPE board,
battery charger and its frayed cable, convex mirror, fire-exit door, exit sign, high-bay
light, cable ramp, swing gate, hose, packing bench and cutter, bollard, wheel chock).

    blender -b -noaudio --python scripts/blender/props.py -- [--only forklift,pallet] [--render]

Units are metres at real size (1 unit = 1 m). Blender front is -Y, so the exported glTF
front is +Z; the origin is on the floor under the footprint centre unless meta.json says
otherwise. Parts the app animates or toggles are separate named nodes (listed in meta).
Textures: Poly Haven CC0 maps from data/raw/polyhaven/textures (scripts/fetch-assets.mjs)
and own decals from data/raw/decals (scripts/make-decals.mjs).
Output: data/raw/own/<id>.glb + meta.json; --render writes tmp/own/<id>.png previews.
"""
import bpy, bmesh, os, sys, json, math, random
from mathutils import Vector, Matrix, Euler

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RAW = os.path.join(ROOT, "data", "raw")
OUT = os.path.join(RAW, "own")
PREVIEW = os.path.join(ROOT, "tmp", "own")
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ONLY = argv[argv.index("--only") + 1].split(",") if "--only" in argv else None
RENDER = "--render" in argv
TEX = lambda tid, m: os.path.join(RAW, "polyhaven", "textures", tid, f"{tid}_{m}_1k.jpg")
DECAL = lambda n: os.path.join(RAW, "decals", f"{n}.png")
rng = random.Random(7)

# ---------------------------------------------------------------- helpers
def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c] + [1]


_MATS = {}
def mat(name, color="#808080", rough=0.6, metal=0.0, normal=None, arm=None, image=None, emit=None, emit_image=False, alpha=None, nstrength=0.7):
    if name in _MATS:
        return _MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = srgb(color)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    img_node = None
    if image:
        img_node = nt.nodes.new("ShaderNodeTexImage")
        img_node.image = bpy.data.images.load(image, check_existing=True)
        nt.links.new(img_node.outputs["Color"], b.inputs["Base Color"])
        if alpha == "texture":
            nt.links.new(img_node.outputs["Alpha"], b.inputs["Alpha"])
    if arm:
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = bpy.data.images.load(arm, check_existing=True)
        t.image.colorspace_settings.name = "Non-Color"
        sep = nt.nodes.new("ShaderNodeSeparateColor")
        nt.links.new(t.outputs["Color"], sep.inputs["Color"])
        nt.links.new(sep.outputs["Green"], b.inputs["Roughness"])
    if normal:
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = bpy.data.images.load(normal, check_existing=True)
        t.image.colorspace_settings.name = "Non-Color"
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = nstrength
        nt.links.new(t.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    if emit:
        b.inputs["Emission Color"].default_value = srgb(emit[0])
        b.inputs["Emission Strength"].default_value = emit[1]
        if emit_image and img_node:
            nt.links.new(img_node.outputs["Color"], b.inputs["Emission Color"])
    if isinstance(alpha, float):
        b.inputs["Alpha"].default_value = alpha
    if alpha is not None:
        m.blend_method = "BLEND" if isinstance(alpha, float) else "CLIP"
    _MATS[name] = m
    return m


def paint(name, color, rough=0.45):
    """Painted steel: colour factor plus the Poly Haven blue_metal_plate normal and roughness."""
    return mat(name, color, rough=rough, metal=0.0, normal=TEX("blue_metal_plate", "nor_gl"), arm=TEX("blue_metal_plate", "arm"), nstrength=0.35)


def new_obj(name, bm, material, parent=None, uv=("box", 1.0)):
    me = bpy.data.meshes.new(name)
    if uv and uv[0] == "box":
        box_uv(bm, uv[1])
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    if material:
        me.materials.append(material)
    if parent:
        o.parent = parent
    return o


def box_uv(bm, tile):
    """World-scale box projection: 1 UV unit = `tile` metres."""
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            c = l.vert.co
            u, v = [(c.y, c.z), (c.x, c.z), (c.x, c.y)][ax]
            l[uvl].uv = (u / tile, v / tile)


def face_uv(bm):
    """Each face gets the full 0..1 square (signs, carton sides)."""
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        pts = [l.vert.co for l in f.loops]
        ia, ib = [(1, 2), (0, 2), (0, 1)][ax]
        amin, amax = min(p[ia] for p in pts), max(p[ia] for p in pts)
        bmin, bmax = min(p[ib] for p in pts), max(p[ib] for p in pts)
        flip = -1 if n[ax] < 0 else 1
        for l in f.loops:
            a = (l.vert.co[ia] - amin) / max(1e-6, amax - amin)
            b = (l.vert.co[ib] - bmin) / max(1e-6, bmax - bmin)
            if ax == 0:
                a = a if n[0] > 0 else 1 - a
            elif ax == 1:
                a = 1 - a if n[1] > 0 else a
            l[uvl].uv = (a, b)


def box(name, size, loc, material, parent=None, rot=(0, 0, 0), bevel=0.004, tile=1.0, uv="box"):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if uv == "face":
        face_uv(bm)
        o = new_obj(name, bm, material, parent, uv=None)
    else:
        o = new_obj(name, bm, material, parent, uv=("box", tile))
    o.location = loc
    o.rotation_euler = rot
    if bevel:
        bv = o.modifiers.new("Bevel", "BEVEL")
        bv.width = bevel
        bv.segments = 2
        bv.limit_method = "ANGLE"
    return o


def cyl(name, r, depth, loc, material, parent=None, rot=(0, 0, 0), seg=24, bevel=0.0, r2=None, tile=0.5, cap=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=depth)
    o = new_obj(name, bm, material, parent, uv=("box", tile))
    o.location = loc
    o.rotation_euler = rot
    if bevel:
        bv = o.modifiers.new("Bevel", "BEVEL")
        bv.width = bevel
        bv.segments = 2
        bv.limit_method = "ANGLE"
    return o


def prism(name, profile, length, loc, material, parent=None, axis="x", rot=(0, 0, 0), tile=0.5, bevel=0.0):
    """Extrude a 2D profile [(a, b), ...] along an axis. For axis x the profile is (y, z)."""
    bm = bmesh.new()
    vs0, vs1 = [], []
    for a, b in profile:
        if axis == "x":
            p0, p1 = Vector((-length / 2, a, b)), Vector((length / 2, a, b))
        elif axis == "y":
            p0, p1 = Vector((a, -length / 2, b)), Vector((a, length / 2, b))
        else:
            p0, p1 = Vector((a, b, -length / 2)), Vector((a, b, length / 2))
        vs0.append(bm.verts.new(p0))
        vs1.append(bm.verts.new(p1))
    n = len(profile)
    for i in range(n):
        bm.faces.new((vs0[i], vs0[(i + 1) % n], vs1[(i + 1) % n], vs1[i]))
    bm.faces.new(list(reversed(vs0)))
    bm.faces.new(vs1)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = new_obj(name, bm, material, parent, uv=("box", tile))
    o.location = loc
    o.rotation_euler = rot
    if bevel:
        bv = o.modifiers.new("Bevel", "BEVEL")
        bv.width = bevel
        bv.segments = 2
        bv.limit_method = "ANGLE"
    return o


def plane(name, w, h, loc, material, parent=None, rot=(math.pi / 2, 0, 0)):
    """A decal plane (w x h) facing -Y by default (the model front)."""
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    bmesh.ops.scale(bm, vec=Vector((w, h, 1)), verts=bm.verts)
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        for l in f.loops:
            l[uvl].uv = (l.vert.co.x / w + 0.5, l.vert.co.y / h + 0.5)
    o = new_obj(name, bm, material, parent, uv=None)
    o.location = loc
    o.rotation_euler = rot
    return o


def empty(name, loc=(0, 0, 0), parent=None):
    o = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(o)
    o.location = loc
    if parent:
        o.parent = parent
    return o


def wheel(name, r, w, loc, parent, tyre, hub, axis="x", lugs=True):
    """Solid tyre with tread blocks and a hub; axle along X."""
    g = empty(name, loc, parent)
    rot = (0, math.pi / 2, 0)
    t = cyl(f"{name}-tyre", r, w, (0, 0, 0), tyre, g, rot=rot, seg=36, bevel=0.012)
    # Tread: shallow transverse blocks around the rim.
    for i in range(18):
        a = i / 18 * 2 * math.pi
        box(f"{name}-tread{i}", (w * 0.92, 0.035, 0.012), (0, math.cos(a) * (r + 0.004), math.sin(a) * (r + 0.004)), tyre, g,
            rot=(a + math.pi / 2, 0, 0), bevel=0.003)
    cyl(f"{name}-hub", r * 0.55, w * 1.04, (0, 0, 0), hub, g, rot=rot, seg=24, bevel=0.006)
    if lugs:
        for i in range(6):
            a = i / 6 * 2 * math.pi
            cyl(f"{name}-lug{i}", r * 0.05, w * 1.1, (0, math.cos(a) * r * 0.33, math.sin(a) * r * 0.33), hub, g, rot=rot, seg=8)
    return g


def finalize(root):
    """Apply modifiers, smooth by angle, and join all meshes under each named node so each
    node is one mesh per material group (fewer draw calls)."""
    for o in [root] + list(root.children_recursive):
        if o.type != "MESH":
            continue
        bpy.context.view_layer.objects.active = o
        for m in list(o.modifiers):
            try:
                bpy.ops.object.modifier_apply(modifier=m.name)
            except RuntimeError:
                o.modifiers.remove(m)
        for p in o.data.polygons:
            p.use_smooth = True
        o.data.set_sharp_from_angle(angle=math.radians(32))


def merge_children(node):
    """Join every mesh directly under `node` (that is not itself a named part) into one mesh."""
    meshes = [c for c in node.children if c.type == "MESH" and not c.get("part")]
    for c in list(node.children):
        if c.type == "EMPTY" and not c.get("part"):
            for cc in list(c.children_recursive):
                if cc.type == "MESH":
                    mw = cc.matrix_world.copy()
                    cc.parent = node
                    cc.matrix_world = mw
                    meshes.append(cc)
    if len(meshes) < 2:
        return meshes[0] if meshes else None
    bpy.ops.object.select_all(action="DESELECT")
    for m in meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    return bpy.context.active_object


def part(o):
    o["part"] = True
    return o


def clear():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    _MATS.clear()
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.curves):
        for b in list(coll):
            if b.users == 0:
                coll.remove(b)


def bounds(root):
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    for o in [root] + list(root.children_recursive):
        if o.type == "MESH":
            for c in o.bound_box:
                w = o.matrix_world @ Vector(c)
                lo = Vector(map(min, lo, w))
                hi = Vector(map(max, hi, w))
    return lo, hi


# ---------------------------------------------------------------- shared materials
def M():
    return dict(
        yellow=paint("paint-forklift-yellow", "#E9A716", 0.42),
        black=paint("paint-black", "#202225", 0.5),
        grey=paint("paint-dark-grey", "#3A3D41", 0.5),
        light=paint("paint-light-grey", "#C9CCCB", 0.5),
        orange=paint("paint-rack-orange", "#E8601C", 0.45),
        safety=paint("paint-safety-yellow", "#F6C700", 0.45),
        green=paint("paint-safety-green", "#00843D", 0.5),
        red=paint("paint-red", "#B8121E", 0.4),
        blue=paint("paint-blue", "#1F4E8C", 0.45),
        steel=mat("steel-bare", "#9BA0A5", 0.35, 1.0, normal=TEX("metal_plate", "nor_gl"), nstrength=0.15),
        chrome=mat("steel-chrome", "#D5D8DB", 0.12, 1.0),
        rubber=mat("rubber", "#151515", 0.88),
        tread=mat("tread-plate", "#8C9196", 0.4, 1.0, image=TEX("metal_plate", "diff"), normal=TEX("metal_plate", "nor_gl"), arm=TEX("metal_plate", "arm")),
        wood=mat("pallet-wood", "#B7946A", 0.85, image=TEX("raw_plank_wall", "diff"), normal=TEX("raw_plank_wall", "nor_gl"), arm=TEX("raw_plank_wall", "arm")),
        plastic=mat("plastic-black", "#1C1D1F", 0.55),
        glass=mat("glass", "#C8D6DE", 0.05, 0.0, alpha=0.25),
        amber=mat("lamp-amber", "#FF9E1B", 0.2, emit=("#FF8A00", 3.0)),
        lamp_white=mat("lamp-white", "#F3F6F8", 0.2, emit=("#FFF6E5", 2.0)),
        lamp_blue=mat("lamp-blue", "#2E6BFF", 0.2, emit=("#2E6BFF", 3.0)),
    )


# ---------------------------------------------------------------- models
MODELS = {}
def model(id_, **meta):
    def deco(fn):
        MODELS[id_] = (fn, meta)
        return fn
    return deco


@model("pallet", label="GMA-style stringer pallet", realSizeM=[1.219, 0.152, 1.016], note="48 x 40 x 6 in")
def pallet(root, m, with_root=True):
    # 1,219 x 1,016 x 152 mm: 16 mm deck boards top and bottom, 120 mm stringers with
    # 60 mm-deep fork notches (four-way entry for pallet jacks between the notches).
    w, d, t, sh = 1.219, 1.016, 0.016, 0.12
    g = root
    for i, x in enumerate((-0.57, 0.0, 0.57)):
        for j, (y0, y1, h) in enumerate(((-0.508, -0.28, sh), (-0.28, -0.08, sh - 0.06), (-0.08, 0.08, sh), (0.08, 0.28, sh - 0.06), (0.28, 0.508, sh))):
            box(f"stringer{i}-{j}", (0.038, y1 - y0 + 0.002, h), (x, (y0 + y1) / 2, t + sh - h / 2), m["wood"], g, bevel=0.002, tile=0.6)
    for k in range(7):
        x = -w / 2 + 0.07 + k * (w - 0.14) / 6
        box(f"top{k}", (0.14, d, t), (x, 0, t + sh + t / 2), m["wood"], g, rot=(0, 0, rng.uniform(-0.004, 0.004)), bevel=0.002, tile=0.6)
    for k, x in enumerate((-0.54, 0.0, 0.54)):
        box(f"bottom{k}", (0.14, d, t), (x, 0, t / 2), m["wood"], g, bevel=0.002, tile=0.6)


def carton(name, size, loc, parent, side="label", rot=(0, 0, 0)):
    lab = mat("carton-label", "#FFFFFF", 0.85, image=DECAL("carton-side-label"))
    plain = mat("carton-plain", "#FFFFFF", 0.85, image=DECAL("carton-side-plain"))
    o = box(name, size, loc, None, parent, rot=rot, bevel=0.004, uv="face")
    o.data.materials.append(plain)
    o.data.materials.append(lab)
    for p in o.data.polygons:
        n = p.normal
        p.material_index = 1 if side == "label" and (n.y < -0.5 or n.x > 0.5) else 0
    return o


@model("carton-600", label="Labelled carton 600 x 400 x 400 mm", realSizeM=[0.6, 0.4, 0.4])
def carton600(root, m):
    carton("carton", (0.6, 0.4, 0.4), (0, 0, 0.2), root)


@model("carton-400", label="Labelled carton 400 x 300 x 300 mm", realSizeM=[0.4, 0.3, 0.3])
def carton400(root, m):
    carton("carton", (0.4, 0.3, 0.3), (0, 0, 0.15), root)


def stack(root, m, layers, lean=False, wrap=True):
    pallet(root, m)
    z0 = 0.152
    for L in range(layers):
        for i, x in enumerate((-0.3, 0.3)):
            for j, y in enumerate((-0.2, 0.2)):
                off, tilt = Vector((0, 0, 0)), (0, 0, rng.uniform(-0.01, 0.01))
                if lean and L == layers - 1:
                    off = Vector((0.0, -0.06 - 0.02 * i, 0.012))
                    tilt = (math.radians(-6), 0, rng.uniform(-0.05, 0.05))
                elif lean:
                    off = Vector((0, -0.02 * L, 0))
                carton(f"c{L}{i}{j}", (0.6, 0.4, 0.4), Vector((x, y, z0 + 0.2 + L * 0.4)) + off, root, side="label" if (j == 0 or i == 1) else "plain", rot=tilt)
    if wrap:
        film = mat("stretch-film", "#E9EEF2", 0.12, alpha=0.28)
        h = layers * 0.4 + 0.07
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=Vector((1.215, 0.82, h)), verts=bm.verts)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.z < -0.5], context="FACES")
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=10, use_grid_fill=True)
        for v in bm.verts:
            # Film creases: small inward/outward ripples, tighter near the pallet band.
            k = 0.006 * math.sin(v.co.z * 40 + v.co.x * 9) + rng.uniform(-0.003, 0.003)
            v.co += Vector((math.copysign(k, v.co.x) if abs(v.co.x) > 0.6 else 0, math.copysign(k, v.co.y) if abs(v.co.y) > 0.4 else 0, 0))
        o = new_obj("film", bm, film, root)
        o.location = (0, 0, 0.12 + h / 2)


@model("pallet-wrapped", label="Shrink-wrapped pallet, 3 layers", realSizeM=[1.219, 1.39, 1.016])
def pallet_wrapped(root, m):
    stack(root, m, 3)


@model("pallet-wrapped-tall", label="Tall wrapped pallet stack, 4 layers", realSizeM=[1.219, 1.79, 1.016])
def pallet_wrapped_tall(root, m):
    stack(root, m, 4)


@model("carton-stack-leaning", label="Leaning unwrapped carton stack (hazard)", realSizeM=[1.219, 0.95, 1.016])
def carton_leaning(root, m):
    stack(root, m, 2, lean=True, wrap=False)


@model("rack-frame", label="Pallet rack upright frame, 6.0 m x 1.07 m", realSizeM=[0.076, 6.0, 1.07], nodes=[])
def rack_frame(root, m, damaged=False):
    face = mat("rack-upright", "#FFFFFF", 0.45, image=DECAL("rack-upright-face"), normal=TEX("blue_metal_plate", "nor_gl"), nstrength=0.3)
    blue = paint("paint-rack-blue", "#1F5FA8", 0.45)
    H, D, c = 6.0, 1.07, 0.076
    for side, y in (("front", -D / 2 + c / 2), ("back", D / 2 - c / 2)):
        if damaged and side == "front":
            # Kink between 0.25 and 0.6 m: the struck section is pushed 45 mm into the bay and twisted.
            segs = [(0.0, 0.25, 0.0, 0), (0.25, 0.6, 0.045, 6), (0.6, H, 0.0, 0)]
            for i, (z0, z1, dy, tw) in enumerate(segs):
                col = box(f"col-{side}-{i}", (c, c, z1 - z0), (0, y + dy, (z0 + z1) / 2), None, root, rot=(math.radians(tw * (1 if i == 1 else 0)), 0, math.radians(tw)), bevel=0.003, uv="box")
                uprightuv(col, c)
                col.data.materials.append(face)
            scrape = mat("paint-scraped", "#8E8A84", 0.35, 0.8)
            box("scrape", (c * 1.02, 0.02, 0.18), (0, y + 0.045 - c / 2 - 0.002, 0.43), scrape, root, rot=(0, 0, math.radians(6)), bevel=0)
        else:
            col = box(f"col-{side}", (c, c, H), (0, y, H / 2), None, root, bevel=0.003, uv="box")
            uprightuv(col, c)
            col.data.materials.append(face)
        box(f"base-{side}", (0.15, 0.13, 0.006), (0, y, 0.003), m["steel"], root, bevel=0.001)
        for bx in (-0.045, 0.045):
            cyl(f"anchor-{side}{bx}", 0.008, 0.02, (bx, y, 0.012), m["steel"], root, seg=8)
    # Bracing: horizontals every 1.2 m, diagonals between.
    zs = [0.15 + i * 1.15 for i in range(6)]
    for i, z in enumerate(zs):
        box(f"h{i}", (0.035, D - 2 * c, 0.03), (0, 0, z), blue, root, bevel=0.002)
        if i < len(zs) - 1:
            dz = zs[i + 1] - z
            L = math.hypot(D - 2 * c, dz)
            ang = math.atan2(dz, D - 2 * c) * (1 if i % 2 else -1)
            box(f"d{i}", (0.035, L, 0.03), (0, 0, z + dz / 2), blue, root, rot=(ang, 0, 0), bevel=0.002)


def uprightuv(o, c):
    """UVs for the slotted upright texture: U across the 76 mm face, V along the height (203 mm per tile)."""
    me = o.data
    uvl = me.uv_layers.active or me.uv_layers.new()
    for p in me.polygons:
        for li in p.loop_indices:
            v = me.vertices[me.loops[li].vertex_index].co
            n = p.normal
            u = (v.y if abs(n.x) > 0.5 else v.x) / c + 0.5
            uvl.data[li].uv = (u, v.z / 0.203)


@model("rack-frame-damaged", label="Rack upright frame with a bent front column (hazard)", realSizeM=[0.12, 6.0, 1.07])
def rack_frame_damaged(root, m):
    rack_frame(root, m, damaged=True)


@model("rack-beam", label="Pallet rack step beam, 2.7 m", realSizeM=[2.7, 0.11, 0.05])
def rack_beam(root, m):
    box("beam", (2.62, 0.05, 0.11), (0, 0, 0.055), m["orange"], root, bevel=0.003)
    box("step", (2.62, 0.02, 0.012), (0, 0.035, 0.104), m["orange"], root, bevel=0.002)
    for s in (-1, 1):
        box(f"connector{s}", (0.04, 0.05, 0.2), (s * 1.33, 0, 0.07), m["orange"], root, bevel=0.002)
        cyl(f"lockpin{s}", 0.006, 0.03, (s * 1.33, -0.03, 0.14), m["steel"], root, rot=(math.pi / 2, 0, 0), seg=8)


@model("rack-upright-protector", label="Upright protector (yellow guard)", realSizeM=[0.2, 0.4, 0.2])
def rack_protector(root, m):
    prism("guard", [(-0.1, 0), (0.1, 0), (0.1, 0.006), (-0.094, 0.006), (-0.094, 0.2), (-0.1, 0.2)], 0.4, (0, 0, 0.2), m["safety"], root, axis="z", rot=(0, 0, 0), bevel=0.002)
    stripe = mat("stripe-hazard", "#FFFFFF", 0.5, image=DECAL("stripe-dock-edge"))
    plane("stripe", 0.19, 0.08, (0, -0.0035, 0.33), stripe, root, rot=(math.pi / 2, 0, 0))
    box("plate", (0.22, 0.22, 0.008), (0, 0.1, 0.004), m["safety"], root)


@model("forklift", label="Counterbalance forklift (electric, 2.5 t class)", realSizeM=[1.15, 2.2, 3.35],
       nodes=["mast", "carriage", "forks", "wheel-fl", "wheel-fr", "wheel-rl", "wheel-rr", "steering-wheel", "lever-lift", "lever-tilt", "lever-aux", "beacon", "blue-spot-front", "blue-spot-rear", "headlights", "seat",
              "seat-hip", "pedal-accel", "pedal-brake"])
def forklift(root, m, reach=False):
    # G2 (2026-11-07): rebuilt from the v3 box model. Rounded counterweight with tail lamps and tow pin,
    # chamfered chassis, curved fenders, a dash with display and key, a contoured suspension seat with
    # hip restraints and a right armrest, a toe board with accelerator and brake pedals, the hydraulic
    # levers on the driver's right (they were on the left), mast hoses and tilt cylinders, a grab handle
    # and both mirrors. Seat, wheel and pedals are placed for a seated 1.8 m operator (anchors
    # seat-hip, pedal-accel, pedal-brake; the app solves the driver's arms and legs onto them).
    # Blender axes: -Y is the front, +X is the driver's left.
    Y, G = m["yellow"], m["black"]
    red = mat("lamp-red", "#C8102E", 0.25, emit=("#FF1A1A", 1.2))
    screen = mat("screen-display", "#0B1A14", 0.2, emit=("#3FD68A", 0.6))
    # Chassis: side profile with a chamfered nose.
    prism("chassis", [(-0.80, 0.15), (-0.88, 0.24), (-0.88, 0.62), (-0.82, 0.70), (0.80, 0.70), (0.80, 0.17), (0.74, 0.15)], 1.0, (0, 0, 0), Y, root, axis="x", bevel=0.02)
    # Counterweight: rounded rear casting with tail lamps, a reverse lamp and a tow pin.
    prism("counterweight", [(0.75, 0.15), (1.03, 0.15), (1.12, 0.22), (1.17, 0.36), (1.19, 0.55), (1.17, 0.76), (1.11, 0.93), (1.02, 1.03), (0.86, 1.07), (0.75, 1.07)],
          1.06, (0, 0, 0), G, root, axis="x", bevel=0.02)
    box("tow-recess", (0.18, 0.05, 0.11), (0, 1.175, 0.42), m["grey"], root, bevel=0.01)
    cyl("tow-pin", 0.018, 0.16, (0, 1.17, 0.45), m["chrome"], root, seg=12)
    for x in (-0.40, 0.40):
        box(f"tail-housing{x}", (0.11, 0.04, 0.08), (x, 1.14, 0.86), m["grey"], root, bevel=0.01)
        box(f"tail-lens{x}", (0.085, 0.012, 0.055), (x, 1.163, 0.86), red, root, bevel=0.004)
    box("reverse-lens", (0.07, 0.012, 0.04), (0.0, 1.163, 0.86), m["lamp_white"], root, bevel=0.004)
    # Battery hood with hinge line and side vent slots.
    box("hood", (0.92, 0.85, 0.28), (0, 0.35, 0.84), Y, root, bevel=0.045)
    box("hood-hinge", (0.9, 0.014, 0.014), (0, -0.07, 0.985), G, root, bevel=0)
    box("battery-vent", (0.5, 0.3, 0.01), (0, 0.55, 0.985), G, root, bevel=0.002)
    for s in (-1, 1):
        for k in range(6):
            box(f"vent{s}{k}", (0.006, 0.022, 0.15), (s * 0.462, 0.12 + k * 0.06, 0.84), G, root, bevel=0)
    # Operator floor, toe board and front panel.
    box("floorplate", (0.86, 0.40, 0.02), (0, -0.24, 0.71), m["tread"], root, bevel=0.003, tile=0.4)
    prism("toe-board", [(-0.44, 0.70), (-0.60, 0.95), (-0.64, 0.95), (-0.64, 0.70)], 0.86, (0, 0, 0), m["tread"], root, axis="x", tile=0.4)
    box("front-panel", (0.92, 0.18, 0.27), (0, -0.79, 0.83), Y, root, bevel=0.03)
    box("step-l", (0.12, 0.3, 0.04), (0.5, -0.15, 0.36), m["tread"], root, tile=0.4)
    # Dash: cowl, top pad, display, key switch, capacity plate.
    box("cowl", (0.92, 0.30, 0.30), (0, -0.55, 1.11), Y, root, bevel=0.04)
    box("dash-pad", (0.66, 0.20, 0.03), (0, -0.52, 1.265), m["plastic"], root, rot=(math.radians(8), 0, 0), bevel=0.01)
    box("display", (0.15, 0.012, 0.085), (0.17, -0.396, 1.17), screen, root, rot=(math.radians(-15), 0, 0), bevel=0.004)
    cyl("key-switch", 0.016, 0.02, (-0.17, -0.392, 1.16), m["chrome"], root, rot=(math.pi / 2, 0, 0), seg=12)
    box("capacity-plate", (0.12, 0.004, 0.08), (-0.30, -0.398, 1.07), mat("plate-alu", "#C9CCCB", 0.3, 0.8), root, bevel=0)
    # Pedals on the toe board: accelerator (right foot) and brake (left foot).
    pa = part(empty("pedal-accel", (-0.14, -0.37, 0.81), root))
    pa.rotation_euler = (math.radians(-40), 0, 0)
    box("accel-pad", (0.085, 0.20, 0.016), (0, 0, 0), m["rubber"], pa, bevel=0.004)
    box("accel-hinge", (0.06, 0.03, 0.03), (0, 0.09, -0.02), G, pa, bevel=0.004)
    pb = part(empty("pedal-brake", (0.10, -0.40, 0.87), root))
    pb.rotation_euler = (math.radians(-50), 0, 0)
    box("brake-pad", (0.13, 0.10, 0.016), (0, 0, 0), m["rubber"], pb, bevel=0.004)
    box("brake-arm", (0.025, 0.025, 0.16), (0, -0.04, -0.08), G, pb, rot=(math.radians(20), 0, 0), bevel=0.003)
    # Suspension seat: base, contoured cushion with side bolsters, reclined backrest,
    # hip restraints, right armrest and an orange lap belt.
    seat = part(empty("seat", (0, 0.30, 0.98), root))
    box("seat-base", (0.40, 0.40, 0.06), (0, 0, 0.03), G, seat, bevel=0.01)
    box("cushion", (0.50, 0.46, 0.10), (0, -0.01, 0.11), m["plastic"], seat, bevel=0.04)
    for s in (-1, 1):
        box(f"bolster{s}", (0.07, 0.40, 0.05), (s * 0.215, -0.01, 0.175), m["plastic"], seat, bevel=0.022)
        box(f"hip-wing{s}", (0.06, 0.16, 0.18), (s * 0.255, 0.15, 0.29), m["plastic"], seat, bevel=0.02)
    box("backrest", (0.48, 0.10, 0.50), (0, 0.23, 0.43), m["plastic"], seat, rot=(math.radians(-12), 0, 0), bevel=0.04)
    box("armrest", (0.08, 0.30, 0.05), (-0.31, 0.02, 0.36), m["plastic"], seat, bevel=0.02)
    box("armrest-post", (0.03, 0.03, 0.22), (-0.31, 0.12, 0.25), G, seat, bevel=0.004)
    box("belt", (0.46, 0.012, 0.05), (0, -0.20, 0.17), mat("belt-orange", "#FF6A13", 0.7), seat, bevel=0.002)
    part(empty("seat-hip", (0, 0.36, 1.19), root))
    # Steering column and wheel, tilted 45 degrees toward the operator, with a spinner knob.
    tilt = math.radians(-45)
    hub = Vector((0, -0.10, 1.48))
    n = Vector((0, math.sin(-tilt), math.cos(tilt)))
    cyl("column", 0.032, 0.42, tuple(hub - n * 0.21), G, root, rot=(tilt, 0, 0), seg=16)
    box("column-shroud", (0.11, 0.11, 0.17), tuple(hub - n * 0.30), m["plastic"], root, rot=(tilt, 0, 0), bevel=0.025)
    sw = part(empty("steering-wheel", tuple(hub), root))
    sw.rotation_euler = (tilt, 0, 0)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.15, minor_radius=0.016, major_segments=48, minor_segments=10)
    t = bpy.context.active_object
    t.name = "rim"
    t.data.materials.append(m["plastic"])
    t.parent = sw
    for a in (math.pi / 2, math.pi / 2 + 2.1, math.pi / 2 + 4.2):
        box(f"spoke{a:.2f}", (0.14, 0.022, 0.012), (math.cos(a) * 0.075, math.sin(a) * 0.075, -0.01), m["plastic"], sw, rot=(0, 0, a), bevel=0.003)
    cyl("hub-cap", 0.045, 0.035, (0, 0, -0.005), m["plastic"], sw, seg=20, bevel=0.006)
    cyl("knob", 0.018, 0.06, (0.11, 0.11, 0.03), m["plastic"], sw, seg=12)
    # Hydraulic levers on the operator's right (-X), on a small console.
    box("lever-console", (0.17, 0.10, 0.10), (-0.30, -0.45, 1.22), G, root, bevel=0.015)
    for i, nm in enumerate(("lever-lift", "lever-tilt", "lever-aux")):
        lv = part(empty(nm, (-0.24 - i * 0.06, -0.45, 1.27), root))
        cyl(f"{nm}-rod", 0.007, 0.18, (0, 0, 0.09), G, lv, seg=8)
        cyl(f"{nm}-knob", 0.018, 0.04, (0, 0, 0.19), mat(f"knob{i}", ["#202225", "#202225", "#C8102E"][i], 0.4), lv, seg=12)
    # Overhead guard: four posts, a framed slatted roof, a grab handle and two mirrors.
    for x in (-0.5, 0.5):
        box(f"post-front{x}", (0.06, 0.08, 1.48), (x, -0.55, 1.43), G, root, rot=(math.radians(4), 0, 0), bevel=0.012)
        box(f"post-rear{x}", (0.06, 0.08, 1.2), (x, 0.82, 1.57), G, root, rot=(math.radians(-6), 0, 0), bevel=0.012)
        box(f"gusset-front{x}", (0.05, 0.12, 0.12), (x, -0.47, 2.11), G, root, rot=(math.radians(45), 0, 0), bevel=0.006)
        box(f"gusset-rear{x}", (0.05, 0.12, 0.12), (x, 0.76, 2.11), G, root, rot=(math.radians(45), 0, 0), bevel=0.006)
        box(f"mirror-arm{x}", (0.1, 0.02, 0.02), (x * 1.1, 0.78, 2.0), G, root)
        box(f"mirror{x}", (0.02, 0.14, 0.1), (x * 1.2, 0.78, 2.0), m["chrome"], root, rot=(0, 0, math.radians(15 if x > 0 else -15)), bevel=0.01)
    box("roof-frame-l", (0.06, 1.5, 0.06), (-0.5, 0.15, 2.17), G, root, bevel=0.01)
    box("roof-frame-r", (0.06, 1.5, 0.06), (0.5, 0.15, 2.17), G, root, bevel=0.01)
    box("roof-frame-f", (1.06, 0.06, 0.06), (0, -0.58, 2.17), G, root, bevel=0.01)
    box("roof-frame-b", (1.06, 0.06, 0.06), (0, 0.88, 2.17), G, root, bevel=0.01)
    for k in range(7):
        box(f"slat{k}", (1.0, 0.04, 0.03), (0, -0.45 + k * 0.205, 2.17), G, root, bevel=0.005)
    cyl("grab-handle", 0.016, 0.46, (0.47, -0.47, 1.55), G, root, rot=(math.radians(4), 0, 0), seg=12)
    for z in (1.34, 1.76):
        box(f"grab-standoff{z}", (0.03, 0.08, 0.03), (0.49, -0.50, z), G, root, bevel=0.005)
    # Beacon, blue warning spots, headlights, rear work light.
    bc = part(empty("beacon", (0, 0.7, 2.2), root))
    cyl("beacon-base", 0.07, 0.03, (0, 0, 0.015), G, bc, seg=20)
    cyl("beacon-dome", 0.06, 0.1, (0, 0, 0.08), m["amber"], bc, seg=20, r2=0.045)
    for nm, y, tl in (("blue-spot-front", -0.58, 35), ("blue-spot-rear", 0.86, -35)):
        bs = part(empty(nm, (0.42, y, 2.12), root))
        bs.rotation_euler = (math.radians(tl), 0, 0)
        box(f"{nm}-housing", (0.08, 0.1, 0.08), (0, 0, 0), G, bs, bevel=0.01)
        cyl(f"{nm}-lens", 0.03, 0.01, (0, -0.052 if tl > 0 else 0.052, 0), m["lamp_blue"], bs, rot=(math.pi / 2, 0, 0), seg=16)
    hl = part(empty("headlights", (0, -0.6, 1.9), root))
    for x in (-0.5, 0.5):
        box(f"hl-housing{x}", (0.1, 0.07, 0.08), (x, 0, 0), G, hl, bevel=0.01)
        cyl(f"hl-lens{x}", 0.032, 0.01, (x, -0.037, 0), m["lamp_white"], hl, rot=(math.pi / 2, 0, 0), seg=16)
    box("work-light", (0.14, 0.06, 0.07), (-0.2, 0.90, 2.12), G, root, bevel=0.01)
    box("work-light-lens", (0.11, 0.01, 0.05), (-0.2, 0.932, 2.12), m["lamp_white"], root, bevel=0.003)
    # Wheels and curved fenders.
    for nm, x, y, r, w in (("wheel-fl", 0.47, -0.62, 0.28, 0.2), ("wheel-fr", -0.47, -0.62, 0.28, 0.2), ("wheel-rl", 0.4, 0.78, 0.21, 0.16), ("wheel-rr", -0.4, 0.78, 0.21, 0.16)):
        part(wheel(nm, r, w, (x, y, r), root, m["rubber"], m["light"]))
    for x in (-0.47, 0.47):
        for k in range(7):
            a = math.radians(30 + k * 20)
            box(f"fender{x}-{k}", (0.24, 0.125, 0.014), (x, -0.62 + 0.33 * math.cos(a), 0.28 + 0.33 * math.sin(a)), Y, root, rot=(a + math.pi / 2, 0, 0), bevel=0.004)
    # Mast (lowered) with hoses, tilt cylinders, carriage and forks.
    mast = part(empty("mast", (0, -0.98, 0.1), root))
    for x in (-0.36, 0.36):
        prism(f"outer{x}", [(-0.04, 0), (0.04, 0), (0.04, 0.012), (-0.028, 0.012), (-0.028, 0.098), (0.04, 0.098), (0.04, 0.11), (-0.04, 0.11)], 2.05,
              (x, 0, 1.025), m["grey"], mast, axis="z", rot=(0, 0, math.pi / 2 if x > 0 else -math.pi / 2), bevel=0.003)
        box(f"inner{x}", (0.07, 0.07, 2.0), (x * 0.86, -0.02, 1.05), m["grey"], mast, bevel=0.004)
        box(f"chain{x}", (0.03, 0.015, 1.9), (x * 0.6, -0.05, 1.0), G, mast, bevel=0)
        cyl(f"hose{x}", 0.011, 1.8, (x * 0.33, 0.05, 1.0), m["rubber"], mast, seg=8)
        cyl(f"roller{x}", 0.035, 0.03, (x * 0.86, -0.06, 0.35), m["chrome"], mast, rot=(0, math.pi / 2, 0), seg=16)
    for z in (0.12, 1.1, 2.0):
        box(f"tie{z}", (0.78, 0.06, 0.08), (0, 0.01, z), m["grey"], mast, bevel=0.004)
    cyl("lift-cylinder", 0.05, 1.6, (0, 0.04, 0.85), m["chrome"], mast, seg=16)
    ta = math.radians(62.6)
    for x in (-0.40, 0.40):
        cyl(f"tilt-barrel{x}", 0.032, 0.18, (x, -0.77, 0.66), G, root, rot=(ta, 0, 0), seg=16)
        cyl(f"tilt-rod{x}", 0.016, 0.16, (x, -0.88, 0.72), m["chrome"], root, rot=(ta, 0, 0), seg=12)
    carriage = part(empty("carriage", (0, -1.06, 0.06), root))
    box("fork-plate", (1.0, 0.05, 0.42), (0, 0, 0.23), m["grey"], carriage, bevel=0.006)
    for x in (-0.45, -0.15, 0.15, 0.45):
        box(f"backrest-bar{x}", (0.03, 0.03, 0.8), (x, 0.0, 0.84), m["grey"], carriage, bevel=0.003)
    box("backrest-top", (0.96, 0.04, 0.04), (0, 0, 1.24), m["grey"], carriage, bevel=0.004)
    forks = part(empty("forks", (0, -1.09, 0.0), root))
    for x in (-0.3, 0.3):
        box(f"shank{x}", (0.1, 0.045, 0.46), (x, 0, 0.27), G, forks, bevel=0.004)
        prism(f"blade{x}", [(0.0, 0.01), (-1.0, 0.01), (-1.07, 0.02), (-1.07, 0.035), (0.0, 0.055)], 0.1, (x, 0, 0), G, forks, axis="x", bevel=0.003)


@model("reach-truck", label="Reach truck (parked, mast lowered)", realSizeM=[1.27, 2.3, 2.5],
       nodes=["mast", "carriage", "forks", "beacon", "blue-spot-rear"])
def reach_truck(root, m):
    B = m["blue"]
    box("body", (1.27, 0.95, 1.15), (0, 0.6, 0.65), B, root, bevel=0.03)
    box("bumper", (1.27, 0.1, 0.18), (0, 1.1, 0.14), m["black"], root, bevel=0.02)
    box("compartment-floor", (0.6, 0.55, 0.05), (0.25, 0.55, 0.22), m["tread"], root, tile=0.4)
    box("compartment-cut", (0.62, 0.56, 0.9), (0.26, 0.58, 0.72), m["grey"], root, bevel=0.01)
    box("console", (0.4, 0.25, 0.25), (0.25, 0.25, 1.18), m["black"], root, bevel=0.02)
    for x in (-0.55, 0.55):
        box(f"leg{x}", (0.15, 1.25, 0.16), (x, -0.55, 0.12), B, root, bevel=0.012)
        part(wheel(f"loadwheel{x}", 0.09, 0.08, (x, -1.05, 0.09), root, m["rubber"], m["light"], lugs=False))
    part(wheel("drivewheel", 0.17, 0.12, (-0.35, 0.85, 0.17), root, m["rubber"], m["light"]))
    for x in (-0.58, 0.58):
        box(f"post{x}", (0.06, 0.07, 1.25), (x, 0.15, 1.85), m["black"], root, bevel=0.006)
        box(f"rearpost{x}", (0.06, 0.07, 1.0), (x, 1.0, 1.75), m["black"], root, bevel=0.006)
        box(f"roof{x}", (0.06, 0.95, 0.06), (x, 0.58, 2.25), m["black"], root, bevel=0.006)
    for k in range(5):
        box(f"slat{k}", (1.16, 0.04, 0.03), (0, 0.15 + k * 0.21, 2.25), m["black"], root, bevel=0.004)
    mast = part(empty("mast", (0, 0.02, 0.2), root))
    for x in (-0.33, 0.33):
        box(f"channel{x}", (0.09, 0.11, 2.05), (x, 0, 1.02), m["grey"], mast, bevel=0.004)
    for z in (0.1, 1.0, 2.0):
        box(f"tie{z}", (0.72, 0.06, 0.08), (0, 0.02, z), m["grey"], mast, bevel=0.004)
    carriage = part(empty("carriage", (0, -0.08, 0.06), root))
    box("fork-plate", (0.85, 0.05, 0.4), (0, 0, 0.2), m["grey"], carriage, bevel=0.006)
    forks = part(empty("forks", (0, -0.11, 0.0), root))
    for x in (-0.25, 0.25):
        box(f"shank{x}", (0.1, 0.045, 0.42), (x, 0, 0.23), m["black"], forks, bevel=0.004)
        prism(f"blade{x}", [(0.0, 0.01), (-1.0, 0.01), (-1.07, 0.02), (-1.07, 0.035), (0.0, 0.05)], 0.1, (x, 0, 0), m["black"], forks, axis="x", bevel=0.003)
    bc = part(empty("beacon", (0.4, 0.95, 2.28), root))
    cyl("beacon-dome", 0.06, 0.1, (0, 0, 0.05), m["amber"], bc, seg=20, r2=0.045)
    bs = part(empty("blue-spot-rear", (-0.4, 1.02, 2.2), root))
    box("housing", (0.08, 0.1, 0.08), (0, 0, 0), m["black"], bs, bevel=0.01)
    cyl("lens", 0.03, 0.01, (0, 0.052, 0), m["lamp_blue"], bs, rot=(math.pi / 2, 0, 0), seg=16)
    box("key-tag", (0.04, 0.004, 0.06), (0.25, 0.12, 1.2), mat("tag-red", "#C8102E", 0.5), root, bevel=0)


@model("pallet-jack", label="Manual pallet jack", realSizeM=[0.54, 1.22, 1.53], nodes=["handle"])
def pallet_jack(root, m):
    R = mat("paint-jack-red", "#C42A1C", 0.42)
    for x in (-0.19, 0.19):
        prism(f"fork{x}", [(-1.15, 0.03), (-0.05, 0.03), (-0.05, 0.08), (-1.12, 0.08), (-1.15, 0.06)], 0.16, (x, 0, 0), R, root, axis="x", rot=(0, 0, 0), bevel=0.004)
        cyl(f"loadroller{x}", 0.04, 0.12, (x, -1.05, 0.04), m["rubber"], root, rot=(0, math.pi / 2, 0), seg=16)
    box("body", (0.54, 0.25, 0.12), (0, 0.05, 0.12), R, root, bevel=0.01)
    cyl("pump", 0.05, 0.3, (0, 0.12, 0.3), m["chrome"], root, seg=16)
    for x in (-0.09, 0.09):
        part(wheel(f"steer{x}", 0.09, 0.05, (x, 0.18, 0.09), root, m["rubber"], m["light"], lugs=False))
    h = part(empty("handle", (0, 0.15, 0.45), root))
    h.rotation_euler = (math.radians(-12), 0, 0)
    cyl("bar", 0.018, 1.0, (0, 0, 0.5), R, h, seg=12)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.12, minor_radius=0.018, major_segments=24, minor_segments=8, location=(0, 0, 1.08), rotation=(math.pi / 2, 0, 0))
    t = bpy.context.active_object
    t.parent = h
    t.data.materials.append(m["rubber"])


@model("conveyor-section", label="Powered roller conveyor, 3 m section", realSizeM=[3.0, 0.9, 0.9], nodes=["rollers"], note="tile 4 sections for a 12 m line")
def conveyor(root, m):
    G = m["grey"]
    for y in (-0.42, 0.42):
        prism(f"frame{y}", [(-0.025, 0), (0.025, 0), (0.025, 0.15), (-0.025, 0.15)], 3.0, (0, y, 0.73), G, root, axis="x", bevel=0.004)
        box(f"guard{y}", (3.0, 0.012, 0.06), (0, y * 1.02, 0.93), m["safety"], root, bevel=0.002)
        for x in (-1.3, 1.3):
            box(f"leg{x}{y}", (0.05, 0.05, 0.73), (x, y, 0.365), G, root, bevel=0.004)
            box(f"foot{x}{y}", (0.12, 0.12, 0.01), (x, y, 0.005), m["steel"], root)
    for x in (-1.3, 1.3):
        box(f"brace{x}", (0.04, 0.84, 0.04), (x, 0, 0.25), G, root, bevel=0.003)
    rollers = part(empty("rollers", (0, 0, 0.86), root))
    for k in range(40):
        cyl(f"roller{k}", 0.025, 0.8, (-1.4625 + k * 0.075, 0, 0), m["steel"], rollers, rot=(math.pi / 2, 0, 0), seg=14)
    box("drive", (0.4, 0.3, 0.25), (1.0, 0.0, 0.55), m["blue"], root, bevel=0.01)
    cyl("motor", 0.08, 0.25, (1.0, 0.3, 0.55), m["blue"], root, rot=(math.pi / 2, 0, 0), seg=20)


@model("conveyor-estop", label="Conveyor emergency stop", realSizeM=[0.12, 0.17, 0.1], nodes=["button"])
def estop(root, m):
    box("box", (0.1, 0.08, 0.12), (0, 0, 0.06), m["safety"], root, bevel=0.008)
    btn = part(empty("button", (0, -0.04, 0.07), root))
    cyl("stem", 0.015, 0.02, (0, -0.01, 0), m["black"], btn, rot=(math.pi / 2, 0, 0), seg=16)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.032, segments=24, ring_count=12, location=(0, -0.025, 0))
    s = bpy.context.active_object
    s.scale = (1, 0.45, 1)
    s.parent = btn
    s.data.materials.append(mat("estop-red", "#D10A0A", 0.3))
    plane("label", 0.12, 0.05, (0, -0.041, -0.02), mat("label-estop", "#FFFFFF", 0.6, image=DECAL("sign-estop")), root)


@model("trailer-53ft", label="53 ft box trailer, rear doors open", realSizeM=[2.59, 4.11, 16.15], origin="ground under the rear sill centre; the open rear faces -Y (glTF +Z)")
def trailer(root, m):
    L, W, H, F = 16.15, 2.59, 4.11, 1.22
    shell = mat("trailer-panel", "#E8E8E4", 0.5, normal=TEX("painted_metal_shutter", "nor_gl"), arm=TEX("painted_metal_shutter", "arm"), nstrength=0.25)
    lining = mat("trailer-lining", "#D7D4CC", 0.7)
    floor = mat("trailer-floor", "#9D7E5A", 0.8, image=TEX("raw_plank_wall", "diff"), normal=TEX("raw_plank_wall", "nor_gl"))
    box("floor", (W - 0.1, L, 0.04), (0, L / 2, F), floor, root, tile=1.2)
    for s in (-1, 1):
        box(f"side{s}", (0.04, L, H - F - 0.05), (s * (W / 2 - 0.02), L / 2, (H + F) / 2), shell, root, bevel=0.004, tile=2.0)
        box(f"lining{s}", (0.01, L - 0.2, H - F - 0.25), (s * (W / 2 - 0.05), L / 2, (H + F) / 2), lining, root, bevel=0)
        for k in range(1, 26):
            box(f"logtrack{s}{k}", (0.012, 0.03, H - F - 0.3), (s * (W / 2 - 0.058), k * 0.6, (H + F) / 2), m["light"], root, bevel=0)
        box(f"rail{s}", (0.08, L, 0.18), (s * (W / 2 - 0.02), L / 2, F - 0.05), m["grey"], root, bevel=0.005)
        # Rear door leaves swung open against the sides.
        box(f"door{s}", (0.05, W / 2 - 0.08, H - F - 0.2), (s * (W / 2 + 0.05), (W / 2 - 0.08) / 2 + 0.05, (H + F) / 2 - 0.05), shell, root, bevel=0.006, tile=2.0)
        for z in (F + 0.5, H - 0.6):
            box(f"hinge{s}{z}", (0.04, 0.12, 0.08), (s * (W / 2 + 0.02), 0.03, z), m["steel"], root)
        for x in (0.25, 0.75):
            cyl(f"lockbar{s}{x}", 0.016, H - F - 0.3, (s * (W / 2 + 0.08), x * (W / 2 - 0.1) + 0.1, (H + F) / 2), m["steel"], root, seg=10)
    box("roof", (W, L, 0.05), (0, L / 2, H - 0.025), shell, root, tile=2.0)
    box("front", (W, 0.05, H - F), (0, L - 0.025, (H + F) / 2), shell, root, tile=2.0)
    box("header", (W, 0.12, 0.25), (0, 0.06, H - 0.12), m["steel"], root, bevel=0.008)
    box("sill", (W, 0.15, 0.18), (0, 0.075, F - 0.09), m["steel"], root, bevel=0.008)
    for s in (-1, 1):
        box(f"rearpost{s}", (0.14, 0.12, H - F), (s * (W / 2 - 0.07), 0.06, (H + F) / 2), m["steel"], root, bevel=0.008)
        cyl(f"taillight{s}", 0.05, 0.03, (s * (W / 2 - 0.2), -0.005, F - 0.12), mat("lamp-tail", "#7A0A0A", 0.2, emit=("#FF1A1A", 0.6)), root, rot=(math.pi / 2, 0, 0), seg=16)
    # Rear impact guard (under-ride bar), sub-frame, bogie, landing gear.
    box("icc-bar", (W - 0.3, 0.1, 0.12), (0, 0.2, 0.55), m["black"], root, bevel=0.01)
    for s in (-1, 1):
        box(f"icc-strut{s}", (0.08, 0.08, 0.6), (s * 0.8, 0.3, 0.85), m["black"], root)
        box(f"subframe{s}", (0.12, L - 1.0, 0.25), (s * 0.5, L / 2, F - 0.25), m["grey"], root, bevel=0.005)
    for y in (2.6, 3.9):
        cyl(f"axle{y}", 0.06, W - 0.2, (0, y, 0.52), m["grey"], root, rot=(0, math.pi / 2, 0), seg=12)
        for s in (-1, 1):
            for k, dx in enumerate((0.0, 0.29)):
                part(wheel(f"wheel{y}{s}{k}", 0.51, 0.28, (s * (W / 2 - 0.2 - dx), y, 0.51), root, m["rubber"], m["light"]))
            box(f"mudflap{s}{y}", (0.6, 0.01, 0.6), (s * (W / 2 - 0.35), y + 0.75, 0.45), m["rubber"], root, bevel=0) if y == 3.9 else None
    for s in (-1, 1):
        box(f"landing{s}", (0.1, 0.1, F - 0.2), (s * 0.9, L - 3.5, (F - 0.2) / 2 + 0.05), m["grey"], root, bevel=0.004)
        box(f"pad{s}", (0.25, 0.25, 0.04), (s * 0.9, L - 3.5, 0.02), m["grey"], root)
    stripe = mat("conspicuity-tape", "#C8102E", 0.3)
    for s in (-1, 1):
        for k in range(12):
            box(f"tape{s}{k}", (0.005, 0.3, 0.05), (s * (W / 2 + 0.001), 1.0 + k * 1.25, F + 0.12), stripe if k % 2 else m["light"], root, bevel=0)


@model("dock-leveller", label="Dock leveller with bumpers", realSizeM=[2.6, 0.6, 2.84], origin="deck flush with the floor at the dock edge; the lip points -Y (glTF +Z, toward the trailer)", nodes=["deck", "lip"])
def leveller(root, m):
    deck = part(empty("deck", (0, 1.22, 0), root))
    box("plate", (1.83, 2.44, 0.05), (0, 0, -0.025), m["tread"], deck, bevel=0.004, tile=0.5)
    for s in (-1, 1):
        prism(f"toeguard{s}", [(-1.22, 0), (1.22, 0), (1.22, -0.05), (-1.22, -0.45)], 0.006, (s * 0.912, 0, 0), m["safety"], deck, axis="x", bevel=0)
    lip = part(empty("lip", (0, 0, 0), root))
    box("lip-plate", (1.83, 0.4, 0.02), (0, -0.2, -0.01), m["tread"], lip, bevel=0.003, tile=0.5)
    stripe = mat("stripe-hazard", "#FFFFFF", 0.5, image=DECAL("stripe-dock-edge"))
    plane("edge-stripe", 1.83, 0.12, (0, -0.395, 0.001), stripe, lip, rot=(0, 0, 0))
    box("pit-frame", (1.95, 0.1, 0.1), (0, 0.05, -0.05), m["steel"], root)
    for s in (-1, 1):
        box(f"bumper{s}", (0.25, 0.12, 0.5), (s * 1.17, -0.06, -0.35), m["rubber"], root, bevel=0.02)
        for z in (-0.2, -0.5):
            cyl(f"bolt{s}{z}", 0.012, 0.02, (s * 1.17 + 0.08, -0.125, z), m["steel"], root, rot=(math.pi / 2, 0, 0), seg=8)


@model("dock-door", label="Dock roller door, 2.74 x 3.05 m (9 x 10 ft)", realSizeM=[3.0, 3.6, 0.45],
       origin="floor at the door centre; the bay side faces -Y (glTF +Z)", nodes=["curtain"],
       note="curtain pivots at its top edge: scale it on Y (0.05..1) to roll the door up")
def dock_door(root, m):
    W, H = 2.74, 3.05
    slat = paint("paint-door-slat", "#B9BEC2", 0.45)
    for s in (-1, 1):
        prism(f"guide{s}", [(-0.05, -0.06), (0.05, -0.06), (0.05, 0.06), (-0.05, 0.06)], H, (s * (W / 2 + 0.05), 0, H / 2), m["grey"], root, axis="z", bevel=0.004)
    box("hood", (W + 0.3, 0.45, 0.5), (0, 0.12, H + 0.25), m["grey"], root, bevel=0.01)
    curtain = part(empty("curtain", (0, 0, H), root))
    # Curtain: interlocking slats about 78 mm high, each a shallow wave profile; the bar and
    # seal (90 mm) close the gap to the floor.
    n = 38
    p = (H - 0.09) / n
    prof = [(-0.008, -1.0), (0.008, -1.0), (0.008, -0.66), (0.002, -0.5), (0.008, -0.34), (0.008, 0.0), (-0.008, 0.0), (-0.008, -0.34), (-0.002, -0.5), (-0.008, -0.66)]
    for k in range(n):
        prism(f"slat{k}", [(y, (z - k) * p) for y, z in prof], W, (0, 0, 0), slat, curtain, axis="x", tile=0.6)
    bottom = -n * p
    box("bottom-bar", (W, 0.05, 0.06), (0, 0, bottom - 0.03), m["grey"], curtain, bevel=0.004)
    box("seal", (W, 0.03, 0.03), (0, 0, bottom - 0.075), m["rubber"], curtain, bevel=0.004)
    box("pull-handle", (0.12, 0.04, 0.03), (0, -0.04, bottom + 0.1), m["black"], curtain, bevel=0.004)
    stripe = mat("stripe-hazard", "#FFFFFF", 0.5, image=DECAL("stripe-dock-edge"))
    plane("bottom-stripe", W, 0.15, (0, -0.0105, bottom + 0.075), stripe, curtain)


@model("dock-signal-light", label="Dock signal light (red / green)", realSizeM=[0.16, 0.34, 0.12], nodes=["lamp-red", "lamp-green"])
def signal(root, m):
    box("housing", (0.16, 0.1, 0.34), (0, 0, 0.17), m["black"], root, bevel=0.01)
    for n, z, c in (("lamp-red", 0.25, "#E01E1E"), ("lamp-green", 0.09, "#16C35A")):
        lamp = part(empty(n, (0, -0.05, z), root))
        cyl(f"{n}-lens", 0.055, 0.02, (0, 0, 0), mat(f"{n}-mat", c, 0.2, emit=(c, 2.5 if "red" in n else 0.0)), lamp, rot=(math.pi / 2, 0, 0), seg=24)
        box(f"{n}-hood", (0.14, 0.05, 0.015), (0, -0.03, 0.065), m["black"], lamp, bevel=0)


@model("vehicle-restraint", label="Trailer restraint hook (dock wall)", realSizeM=[0.5, 0.35, 0.35], nodes=["hook"])
def restraint(root, m):
    box("carriage", (0.5, 0.3, 0.35), (0, 0, 0.175), m["safety"], root, bevel=0.015)
    hook = part(empty("hook", (0, -0.15, 0.3), root))
    prism("hook-plate", [(0, 0), (-0.18, 0), (-0.18, 0.2), (-0.1, 0.2), (-0.1, 0.06), (0, 0.06)], 0.06, (0, 0, -0.05), m["red"], hook, axis="x", bevel=0.004)
    stripe = mat("stripe-hazard", "#FFFFFF", 0.5, image=DECAL("stripe-dock-edge"))
    plane("stripe", 0.48, 0.1, (0, -0.151, 0.1), stripe, root)


@model("wheel-chock", label="Wheel chock", realSizeM=[0.22, 0.2, 0.32])
def chock(root, m):
    prism("wedge", [(-0.16, 0), (0.16, 0), (0.16, 0.03), (-0.02, 0.2), (-0.16, 0.2)], 0.22, (0, 0, 0), m["safety"], root, axis="x", bevel=0.01)
    box("handle", (0.16, 0.02, 0.02), (0, -0.09, 0.205), m["black"], root, bevel=0.004)


@model("eyewash-station", label="Self-contained eyewash station", realSizeM=[0.45, 0.6, 0.16], nodes=["bottle-1", "bottle-2"])
def eyewash(root, m, neglected=False):
    box("backboard", (0.45, 0.02, 0.6), (0, 0.07, 0.3), m["green"], root, bevel=0.006)
    box("shelf", (0.42, 0.13, 0.02), (0, 0.0, 0.08), m["green"], root, bevel=0.004)
    box("lip", (0.42, 0.01, 0.06), (0, -0.065, 0.11), m["green"], root, bevel=0.002)
    full = mat("eyewash-bottle", "#E8F4FA", 0.25, alpha=0.75)
    empty_m = mat("eyewash-bottle-empty", "#D9DEE0", 0.45, alpha=0.4)
    cap = mat("eyewash-cap", "#0B7BC1", 0.4)
    for i, x in enumerate((-0.1, 0.1)):
        if neglected and i == 0:
            continue
        b = part(empty(f"bottle-{i + 1}", (x, 0.0, 0.09), root))
        cyl("body", 0.045, 0.24, (0, 0, 0.12), empty_m if neglected else full, b, seg=20, bevel=0.01)
        cyl("shoulder", 0.045, 0.04, (0, 0, 0.26), empty_m if neglected else full, b, seg=20, r2=0.02)
        cyl("cap", 0.022, 0.05, (0, 0, 0.305), cap, b, seg=16)
        plane("label", 0.07, 0.1, (0, -0.0455, 0.13), mat("eyewash-label", "#FFFFFF", 0.6, image=DECAL("sign-eyewash")), b)
    box("strap", (0.44, 0.012, 0.03), (0, -0.05, 0.25), m["black"], root, bevel=0.002)
    if neglected:
        dust = mat("dust", "#8A8A84", 0.95, alpha=0.35)
        box("dust", (0.4, 0.11, 0.002), (0, 0, 0.091), dust, root, bevel=0)


@model("eyewash-station-neglected", label="Eyewash station with a missing and an empty bottle (hazard)", realSizeM=[0.45, 0.6, 0.16])
def eyewash_bad(root, m):
    eyewash(root, m, neglected=True)


def flat_vest(name, loc, parent, colour):
    """A vest hanging on a hook: outline extruded 8 mm, with tape bands."""
    outline = [(-0.27, 0), (0.27, 0), (0.27, 0.5), (0.17, 0.66), (0.08, 0.66), (0.06, 0.52), (-0.06, 0.52), (-0.08, 0.66), (-0.17, 0.66), (-0.27, 0.5)]
    o = prism(f"{name}-body", [(x, z) for x, z in outline], 0.008, loc, mat(f"vest-{colour}", colour, 0.8, normal=DECAL("fabric-hivis-mesh-normal"), emit=(colour, 0.12)), parent, axis="y", tile=0.05)
    tape = mat("vest-tape", "#D9DDE0", 0.28)
    for z in (0.12, 0.3):
        box(f"{name}-tape{z}", (0.54, 0.01, 0.05), (loc[0], loc[1] - 0.001, loc[2] + z), tape, parent, bevel=0)
    return o


@model("ppe-station", label="PPE station board", realSizeM=[1.2, 2.0, 0.25])
def ppe(root, m):
    board = mat("pegboard", "#E4E2DC", 0.8, normal=TEX("concrete_block_wall", "nor_gl"), nstrength=0.1)
    box("board", (1.2, 0.02, 1.4), (0, 0.1, 1.2), board, root, bevel=0.004)
    box("frame-top", (1.24, 0.04, 0.04), (0, 0.09, 1.91), m["blue"], root, bevel=0.004)
    box("frame-bottom", (1.24, 0.04, 0.04), (0, 0.09, 0.49), m["blue"], root, bevel=0.004)
    for x in (-0.6, 0.6):
        box(f"leg{x}", (0.05, 0.05, 2.0), (x, 0.1, 1.0), m["blue"], root, bevel=0.004)
        box(f"foot{x}", (0.08, 0.4, 0.03), (x, 0.0, 0.015), m["blue"], root, bevel=0.004)
    for i, x in enumerate((-0.4, 0.0, 0.4)):
        cyl(f"hook{i}", 0.006, 0.06, (x, 0.06, 1.78), m["chrome"], root, rot=(math.pi / 2, 0, 0), seg=8)
        flat_vest(f"vest{i}", (x, 0.07 - i * 0.012, 1.1), root, ["#C9F200", "#FF7A1A", "#C9F200"][i])
    shelf = box("shelf", (1.1, 0.25, 0.02), (0, 0.0, 0.85), m["light"], root, bevel=0.003)
    box("glove-box", (0.25, 0.12, 0.14), (-0.35, -0.02, 0.93), mat("glove-box", "#2E6DB4", 0.7), root, bevel=0.004)
    box("glasses-box", (0.25, 0.12, 0.12), (0.0, -0.02, 0.92), mat("clear-box", "#DDE6EA", 0.1, alpha=0.5), root, bevel=0.004)
    for k in range(4):
        box(f"glasses{k}", (0.14, 0.04, 0.03), (0.0, -0.02, 0.88 + k * 0.025), m["plastic"], root, bevel=0.003)
    # Ear defenders: two cups and a band.
    for s in (-1, 1):
        cyl(f"cup{s}", 0.04, 0.035, (0.35 + s * 0.065, -0.02, 0.92), mat("ear-red", "#C8102E", 0.5), root, rot=(0, math.pi / 2, 0), seg=20, bevel=0.008)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.07, minor_radius=0.008, major_segments=24, minor_segments=6, location=(0.35, -0.02, 0.92), rotation=(0, math.pi / 2, 0))
    t = bpy.context.active_object
    t.parent = root
    t.data.materials.append(m["plastic"])
    for x in (-0.25, 0.25):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.13, segments=24, ring_count=12, location=(x, -0.05, 0.62))
        h = bpy.context.active_object
        bm = bmesh.new()
        bm.from_mesh(h.data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.01], context="VERTS")
        bm.to_mesh(h.data)
        bm.free()
        h.scale = (1.0, 1.2, 0.85)
        h.parent = root
        h.data.materials.append(mat("hat-white", "#F2F2EE", 0.38))


@model("battery-charger", label="Wall-mounted battery charger", realSizeM=[0.6, 0.8, 0.4], nodes=["charge-led", "fault-led", "display"])
def charger(root, m):
    cab = mat("charger-cabinet", "#C8CAC6", 0.45, normal=TEX("blue_metal_plate", "nor_gl"), nstrength=0.3)
    box("cabinet", (0.6, 0.4, 0.8), (0, 0, 0.4), cab, root, bevel=0.012)
    box("door-seam", (0.56, 0.004, 0.76), (0, -0.2, 0.4), m["grey"], root, bevel=0)
    box("door", (0.555, 0.008, 0.755), (0, -0.204, 0.4), cab, root, bevel=0.004)
    for k in range(8):
        box(f"vent{k}", (0.3, 0.012, 0.012), (0, -0.21, 0.15 + k * 0.025), m["grey"], root, bevel=0)
    d = part(empty("display", (0, -0.21, 0.62), root))
    box("bezel", (0.2, 0.01, 0.1), (0, 0, 0), m["black"], d, bevel=0.003)
    box("screen", (0.17, 0.004, 0.07), (0, -0.006, 0), mat("charger-screen", "#0E2A1A", 0.1, emit=("#3BE07A", 0.8)), d, bevel=0)
    for n, x, c in (("charge-led", -0.1, "#28D46A"), ("fault-led", 0.1, "#E3A008")):
        led = part(empty(n, (x, -0.212, 0.5), root))
        cyl(f"{n}-lens", 0.008, 0.008, (0, 0, 0), mat(f"{n}-mat", c, 0.2, emit=(c, 2.5 if "charge" in n else 0.0)), led, rot=(math.pi / 2, 0, 0), seg=12)
    # Charging cable down to a connector hanging on a hook.
    pts = [Vector((0.15, -0.05, 0.0)), Vector((0.18, -0.1, -0.35)), Vector((0.12, -0.18, -0.7)), Vector((0.25, -0.25, -0.62))]
    cable_curve(root, "cable", pts, 0.012, m["rubber"])
    box("connector", (0.12, 0.08, 0.06), (0.25, -0.26, -0.6), mat("connector-grey", "#7D8288", 0.5), root, bevel=0.008)
    box("hook", (0.03, 0.08, 0.02), (0.25, -0.24, -0.55), m["steel"], root, bevel=0)


def cable_curve(parent, name, pts, r, material):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    sp = cu.splines.new("NURBS")
    sp.points.add(len(pts) - 1)
    for p, co in zip(sp.points, pts):
        p.co = (*co, 1)
    sp.use_endpoint_u = True
    sp.order_u = 3
    cu.bevel_depth = r
    cu.bevel_resolution = 3
    cu.resolution_u = 12
    o = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(material)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.ops.object.convert(target="MESH")
    o = bpy.context.active_object
    o.parent = parent
    return o


@model("charger-cable-frayed", label="Frayed charger cable at the plug (hazard)", realSizeM=[0.37, 0.06, 0.06])
def frayed(root, m):
    box("plug", (0.12, 0.08, 0.06), (-0.12, 0, 0.03), mat("connector-grey", "#7D8288", 0.5), root, bevel=0.008)
    jacket = m["rubber"]
    cyl("jacket-a", 0.013, 0.06, (-0.03, 0, 0.03), jacket, root, rot=(0, math.pi / 2, 0), seg=16)
    cyl("jacket-b", 0.013, 0.16, (0.15, 0, 0.03), jacket, root, rot=(0, math.pi / 2, 0), seg=16)
    # Split section: jacket peeled back, inner cores and copper strands exposed.
    for k, (c, y) in enumerate((("#B71C1C", 0.005), ("#1A1A1A", -0.005))):
        cyl(f"core{k}", 0.005, 0.07, (0.035, y, 0.03), mat(f"core{k}", c, 0.5), root, rot=(0, math.pi / 2, 0), seg=10)
    copper = mat("copper", "#C8743A", 0.3, 1.0)
    for k in range(9):
        a = rng.uniform(0, 6.28)
        cyl(f"strand{k}", 0.0008, rng.uniform(0.015, 0.03), (0.035 + rng.uniform(-0.01, 0.02), math.cos(a) * 0.008, 0.03 + math.sin(a) * 0.008), copper, root,
            rot=(rng.uniform(-0.8, 0.8), math.pi / 2 + rng.uniform(-0.6, 0.6), 0), seg=4)
    for k in range(5):
        a = k * 1.25
        box(f"flap{k}", (0.02, 0.012, 0.002), (0.012, math.cos(a) * 0.015, 0.03 + math.sin(a) * 0.015), jacket, root, rot=(a, 0.4, 0), bevel=0)


@model("convex-mirror", label="Convex traffic mirror, 600 mm", realSizeM=[0.6, 0.7, 0.22], nodes=["mirror-face"])
def mirror(root, m):
    face = part(empty("mirror-face", (0, 0, 0.4), root))
    # Spherical cap: radius 0.41 m cut exactly on the 45-degree ring (cap radius 0.29 m).
    R = 0.41
    bpy.ops.mesh.primitive_uv_sphere_add(radius=R, segments=48, ring_count=24, location=(0, 0, 0), rotation=(math.pi / 2, 0, 0))
    s = bpy.context.active_object
    bpy.ops.object.transform_apply(rotation=True)
    bm = bmesh.new()
    bm.from_mesh(s.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if math.degrees(math.acos(max(-1, min(1, -v.co.y / R)))) > 45.5], context="VERTS")
    bmesh.ops.translate(bm, verts=bm.verts, vec=Vector((0, R * math.cos(math.pi / 4), 0)))
    bm.to_mesh(s.data)
    bm.free()
    s.parent = face
    s.data.materials.append(mat("mirror-surface", "#E6EAEE", 0.02, 1.0))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.29, minor_radius=0.015, major_segments=48, minor_segments=8, location=(0, 0, 0), rotation=(math.pi / 2, 0, 0))
    r = bpy.context.active_object
    r.parent = face
    r.data.materials.append(mat("mirror-rim", "#FF6A13", 0.45))
    cyl("back", 0.29, 0.06, (0, 0.03, 0), m["black"], face, rot=(math.pi / 2, 0, 0), seg=48)
    box("bracket", (0.06, 0.16, 0.06), (0, 0.13, 0), m["grey"], face, bevel=0.004)
    cyl("clamp", 0.05, 0.12, (0, 0.2, 0), m["grey"], face, seg=16)


@model("fire-exit-door", label="Fire-exit door with push bar", realSizeM=[1.12, 2.15, 0.12], nodes=["leaf", "push-bar"])
def fire_door(root, m):
    frame = paint("paint-door-frame", "#5A6066", 0.5)
    for x in (-0.53, 0.53):
        box(f"jamb{x}", (0.06, 0.12, 2.15), (x, 0, 1.075), frame, root, bevel=0.004)
    box("head", (1.12, 0.12, 0.06), (0, 0, 2.12), frame, root, bevel=0.004)
    leaf = part(empty("leaf", (-0.5, 0, 0), root))
    door = paint("paint-door", "#6E7B5E", 0.45)
    box("panel", (0.99, 0.05, 2.07), (0.5, 0, 1.04), door, leaf, bevel=0.006)
    box("kick", (0.95, 0.004, 0.25), (0.5, -0.027, 0.15), m["steel"], leaf, bevel=0)
    box("vision", (0.2, 0.054, 0.6), (0.5, 0, 1.55), m["glass"], leaf, bevel=0.003)
    plane("sign", 0.4, 0.2, (0.5, -0.0265, 1.2), mat("sign-fire-door", "#FFFFFF", 0.5, image=DECAL("sign-fire-door")), leaf)
    pb = part(empty("push-bar", (0.5, -0.07, 0.98), leaf))
    box("bar", (0.8, 0.05, 0.07), (0, 0, 0), m["chrome"], pb, bevel=0.01)
    for x in (-0.42, 0.42):
        box(f"mount{x}", (0.08, 0.06, 0.14), (x, 0.02, 0), m["grey"], pb, bevel=0.008)
    box("closer", (0.3, 0.07, 0.06), (0.75, -0.06, 1.98), m["grey"], leaf, bevel=0.01)
    box("closer-arm", (0.3, 0.02, 0.02), (0.65, -0.1, 2.03), m["grey"], leaf, bevel=0)


@model("exit-sign-box", label="Lit exit sign", realSizeM=[0.38, 0.2, 0.06], nodes=["sign-face"])
def exit_box(root, m):
    box("housing", (0.38, 0.06, 0.2), (0, 0.03, 0.1), m["light"], root, bevel=0.008)
    f = part(empty("sign-face", (0, -0.0015, 0.1), root))
    plane("face", 0.36, 0.18, (0, 0, 0), mat("exit-face", "#FFFFFF", 0.3, image=DECAL("sign-exit"), emit=("#FFFFFF", 0.8), emit_image=True), f)


@model("high-bay-light", label="LED high-bay light", realSizeM=[0.43, 0.32, 0.43], nodes=["emitter"])
def highbay(root, m):
    fin = mat("heatsink", "#3B3F44", 0.4, 0.8)
    cyl("body", 0.2, 0.06, (0, 0, 0.06), fin, root, seg=40, bevel=0.006)
    for k in range(30):
        a = k / 30 * 2 * math.pi
        box(f"fin{k}", (0.012, 0.06, 0.06), (math.cos(a) * 0.19, math.sin(a) * 0.19, 0.12), fin, root, rot=(0, 0, a + math.pi / 2), bevel=0)
    cyl("driver", 0.09, 0.1, (0, 0, 0.17), fin, root, seg=32, bevel=0.006)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.035, minor_radius=0.008, major_segments=20, minor_segments=6, location=(0, 0, 0.27), rotation=(math.pi / 2, 0, 0))
    t = bpy.context.active_object
    t.parent = root
    t.data.materials.append(m["steel"])
    e = part(empty("emitter", (0, 0, 0.028), root))
    cyl("diffuser", 0.19, 0.012, (0, 0, 0), mat("led-diffuser", "#FFFFFF", 0.3, emit=("#F2F6FF", 4.0)), e, seg=40)


@model("cable-ramp", label="Cable protector ramp", realSizeM=[1.0, 0.05, 0.3])
def ramp(root, m):
    prism("ramp", [(-0.15, 0), (0.15, 0), (0.05, 0.05), (-0.05, 0.05)], 1.0, (0, 0, 0), m["rubber"], root, axis="x", bevel=0.004)
    prism("lid", [(-0.05, 0.05), (0.05, 0.05), (0.05, 0.052), (-0.05, 0.052)], 1.0, (0, 0, 0), m["safety"], root, axis="x", bevel=0.001)
    for k in range(9):
        box(f"rib{k}", (0.004, 0.18, 0.004), (-0.45 + k * 0.1125, 0, 0.034), m["rubber"], root, rot=(0, 0, 0), bevel=0)


@model("swing-gate", label="Self-closing swing gate", realSizeM=[1.05, 1.15, 0.08], origin="hinge post at the origin; the leaf extends +X", nodes=["gate-leaf"])
def gate(root, m):
    box("post", (0.06, 0.06, 1.15), (0, 0, 0.575), m["safety"], root, bevel=0.004)
    box("base", (0.18, 0.18, 0.01), (0, 0, 0.005), m["safety"], root)
    leaf = part(empty("gate-leaf", (0.03, 0, 0), root))
    stripe = mat("stripe-gate", "#FFFFFF", 0.5, image=DECAL("stripe-dock-edge"))
    box("top-rail", (1.0, 0.04, 0.06), (0.5, 0, 1.05), stripe, leaf, uv="face", bevel=0.004)
    box("mid-rail", (1.0, 0.03, 0.04), (0.5, 0, 0.55), m["safety"], leaf, bevel=0.003)
    box("end-post", (0.04, 0.04, 1.0), (1.0, 0, 0.55), m["safety"], leaf, bevel=0.003)
    for z in (0.3, 0.9):
        cyl(f"spring{z}", 0.022, 0.08, (0, 0, z), m["black"], leaf, seg=12)


@model("hose-floor", label="Hose lying across the walkway (hazard)", realSizeM=[6.0, 0.04, 0.6])
def hose(root, m):
    pts = [Vector((-3.0, 0.15, 0.02)), Vector((-1.8, -0.1, 0.02)), Vector((-0.6, 0.12, 0.02)), Vector((0.6, -0.2, 0.02)), Vector((1.8, 0.05, 0.02)), Vector((3.0, -0.25, 0.02))]
    cable_curve(root, "hose", pts, 0.02, mat("hose-rubber", "#1E2A22", 0.7))
    cyl("coupling", 0.026, 0.07, (3.0, -0.25, 0.026), mat("brass", "#B08D3C", 0.3, 1.0), root, rot=(0, math.pi / 2, 0), seg=16)


@model("packing-bench", label="Packing bench", realSizeM=[2.0, 0.92, 0.8])
def bench(root, m):
    top = mat("bench-top", "#A98B66", 0.7, image=TEX("raw_plank_wall", "diff"), normal=TEX("raw_plank_wall", "nor_gl"), nstrength=0.3)
    box("top", (2.0, 0.8, 0.04), (0, 0, 0.9), top, root, bevel=0.004, tile=1.2)
    for x in (-0.95, 0.95):
        for y in (-0.36, 0.36):
            box(f"leg{x}{y}", (0.05, 0.05, 0.88), (x, y, 0.44), m["blue"], root, bevel=0.003)
    box("shelf", (1.9, 0.7, 0.02), (0, 0, 0.25), m["light"], root, bevel=0.003)
    box("rail-back", (1.95, 0.04, 0.04), (0, 0.38, 0.7), m["blue"], root, bevel=0.003)
    cyl("tape-roll", 0.05, 0.05, (-0.6, 0.15, 0.95), mat("tape-brown", "#9A6A35", 0.4), root, seg=24)
    cyl("film-roll", 0.06, 0.45, (0.6, 0.25, 0.98), mat("film-roll", "#E3E9EE", 0.2, alpha=0.7), root, rot=(0, math.pi / 2, 0), seg=24)
    box("tape-gun", (0.16, 0.05, 0.12), (-0.35, -0.1, 0.98), mat("tape-gun-red", "#C8102E", 0.5), root, bevel=0.01)


@model("packing-cutter", label="Bench carton-cutting machine", realSizeM=[0.6, 0.45, 0.5], nodes=["blade", "guard-near", "guard-far"])
def cutter(root, m):
    box("base", (0.6, 0.5, 0.18), (0, 0, 0.09), m["grey"], root, bevel=0.01)
    box("table", (0.6, 0.5, 0.012), (0, 0, 0.186), m["steel"], root, bevel=0.002)
    box("slot", (0.4, 0.008, 0.002), (0, 0, 0.193), m["black"], root, bevel=0)
    bl = part(empty("blade", (0, 0, 0.19), root))
    cyl("disc", 0.12, 0.003, (0, 0, 0), mat("blade-steel", "#C7CBCF", 0.15, 1.0), bl, rot=(0, math.pi / 2, 0), seg=48)
    for k in range(24):
        a = k / 24 * 2 * math.pi
        box(f"tooth{k}", (0.004, 0.012, 0.012), (0, math.cos(a) * 0.124, math.sin(a) * 0.124), mat("blade-steel", "#C7CBCF", 0.15, 1.0), bl, rot=(a + 0.785, 0, 0), bevel=0)
    guard = mat("guard-poly", "#F2C200", 0.3, alpha=0.6)
    for n, y in (("guard-near", -0.06), ("guard-far", 0.06)):
        g = part(empty(n, (0, y, 0.25), root))
        prism(f"{n}-hood", [(-0.17, -0.06), (0.17, -0.06), (0.12, 0.08), (-0.12, 0.08)], 0.008, (0, 0, 0), guard, g, axis="y", bevel=0.002)
    box("motor", (0.2, 0.2, 0.15), (0.0, 0.3, 0.08), m["blue"], root, bevel=0.01)
    box("switch", (0.08, 0.04, 0.1), (0.25, -0.27, 0.12), m["safety"], root, bevel=0.006)
    cyl("switch-red", 0.02, 0.02, (0.25, -0.295, 0.13), mat("estop-red", "#D10A0A", 0.3), root, rot=(math.pi / 2, 0, 0), seg=16)


@model("bollard", label="Steel bollard", realSizeM=[0.2, 1.2, 0.2])
def bollard(root, m):
    cyl("pipe", 0.084, 1.15, (0, 0, 0.585), m["safety"], root, seg=28, bevel=0.01)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.084, segments=28, ring_count=14, location=(0, 0, 1.16))
    c = bpy.context.active_object
    c.scale = (1, 1, 0.45)
    c.parent = root
    c.data.materials.append(m["safety"])
    for z in (0.75, 0.95):
        cyl(f"band{z}", 0.0855, 0.07, (0, 0, z), m["black"], root, seg=28)
    box("plate", (0.2, 0.2, 0.012), (0, 0, 0.006), m["safety"], root)


@model("column-guard", label="Building column guard", realSizeM=[0.5, 1.2, 0.5])
def column_guard(root, m):
    for s, (x, y, rz) in enumerate(((0, -0.23, 0), (0, 0.23, 0), (-0.23, 0, math.pi / 2), (0.23, 0, math.pi / 2))):
        box(f"side{s}", (0.5, 0.04, 1.2), (x, y, 0.6), m["safety"], root, rot=(0, 0, rz), bevel=0.01)
    stripe = mat("stripe-hazard", "#FFFFFF", 0.5, image=DECAL("stripe-dock-edge"))
    for s, (x, y, rz) in enumerate(((0, -0.251, 0), (0, 0.251, math.pi), (-0.251, 0, -math.pi / 2), (0.251, 0, math.pi / 2))):
        plane(f"stripe{s}", 0.48, 0.12, (x, y, 1.0), stripe, root, rot=(math.pi / 2, 0, rz))


# ---------------------------------------------------------------- run
def export(id_, root):
    os.makedirs(OUT, exist_ok=True)
    finalize(root)
    # Join static meshes under every node to keep the draw-call count low.
    for node in [root] + [o for o in root.children_recursive if o.type == "EMPTY" and o.get("part")]:
        merge_children(node)
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for o in root.children_recursive:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, f"{id_}.glb"), export_format="GLB", use_selection=True, export_apply=True,
                              export_yup=True, export_image_format="AUTO", export_animations=False)


def render(id_, root):
    os.makedirs(PREVIEW, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items.keys() else "BLENDER_EEVEE"
    sc.render.resolution_x, sc.render.resolution_y = 640, 480
    sc.world = sc.world or bpy.data.worlds.new("w")
    sc.world.use_nodes = True
    sc.world.node_tree.nodes["Background"].inputs[0].default_value = (0.12, 0.13, 0.14, 1)
    lo, hi = bounds(root)
    c = (lo + hi) / 2
    size = max((hi - lo).length, 0.2)
    bpy.ops.object.light_add(type="SUN", rotation=(math.radians(50), 0, math.radians(35)))
    bpy.context.active_object.data.energy = 3.5
    bpy.ops.object.camera_add()
    cam = bpy.context.active_object
    d = Vector((0.9, -1.4, 0.7)).normalized() * size * 1.35
    cam.location = c + d
    cam.rotation_euler = (c - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 40
    sc.camera = cam
    sc.render.filepath = os.path.join(PREVIEW, f"{id_}.png")
    bpy.ops.render.render(write_still=True)


meta_path = os.path.join(OUT, "meta.json")
meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
for id_, (fn, info) in MODELS.items():
    if ONLY and id_ not in ONLY:
        continue
    clear()
    root = empty(id_)
    fn(root, M())
    bpy.context.view_layer.update()
    lo, hi = bounds(root)
    size = [round(hi.x - lo.x, 3), round(hi.z - lo.z, 3), round(hi.y - lo.y, 3)]  # glTF order: x, y(up), z
    export(id_, root)
    if RENDER:
        render(id_, root)
    meta[id_] = {**info, "sizeM": size, "honesty": "own model at real size; details simplified"}
    print(f"PROP {id_}: {size}")
json.dump(meta, open(meta_path, "w"), indent=2)
