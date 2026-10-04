# 怒海孤筏 3D · Blender 5.2 批量建模 → GLB
# 运行: blender -b -P tools/build_models.py
import bpy, bmesh, math, os, sys

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'models')
os.makedirs(OUT, exist_ok=True)

def clean():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.curves):
        for block in list(coll):
            if block.users == 0:
                coll.remove(block)

def mat(name, color, rough=0.8, emit=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    if emit > 0:
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = emit
    return m

def box(name, size, loc, m, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name; o.scale = (size[0]/2, size[1]/2, size[2]/2)
    o.data.materials.append(m)
    return o

def sphere(name, r, loc, m, scale=(1,1,1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=16, ring_count=10)
    o = bpy.context.object
    o.name = name; o.scale = scale
    bpy.ops.object.shade_flat()
    o.data.materials.append(m)
    return o

def cyl(name, r, depth, loc, m, rot=(0,0,0), verts=10):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=verts)
    o = bpy.context.object
    o.name = name
    bpy.ops.object.shade_flat()
    o.data.materials.append(m)
    return o

def cone(name, r, depth, loc, m, rot=(0,0,0), verts=10):
    bpy.ops.mesh.primitive_cone_add(radius1=r, depth=depth, location=loc, rotation=rot, vertices=verts)
    o = bpy.context.object
    o.name = name
    bpy.ops.object.shade_flat()
    o.data.materials.append(m)
    return o

def origin_to(objs, loc):
    """把 objs 的共同原点设到 loc（用于关节旋转）"""
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.context.scene.cursor.location = loc
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.context.scene.cursor.location = (0,0,0)

def parent(root, objs):
    for o in objs:
        if o is not root:
            o.parent = root

def export(name, root):
    bpy.ops.object.select_all(action='DESELECT')
    # 每个 build 前都 clean，场景里只有本模型的物体
    for o in bpy.context.scene.objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = root
    path = os.path.join(OUT, name + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True)
    print(f'✅ {name}.glb ({os.path.getsize(path)//1024}KB)')

# ============ 玩家（水手） ============
def build_player():
    clean()
    skin = mat('skin', (0.95, 0.79, 0.63))
    shirt = mat('shirt', (0.91, 0.45, 0.35))
    pants = mat('pants', (0.29, 0.35, 0.47))
    hat = mat('hat', (0.91, 0.78, 0.42))
    legL = box('LegL', (0.11, 0.12, 0.28), (-0.065, 0, 0.14), pants)
    legR = box('LegR', (0.11, 0.12, 0.28), (0.065, 0, 0.14), pants)
    torso = box('Torso', (0.27, 0.16, 0.30), (0, 0, 0.43), shirt)
    armL = box('ArmL', (0.07, 0.07, 0.26), (-0.17, 0, 0.30), shirt)
    armR = box('ArmR', (0.07, 0.07, 0.26), (0.17, 0, 0.30), shirt)
    origin_to([armL], (-0.17, 0, 0.43))
    origin_to([armR], (0.17, 0, 0.43))
    head = sphere('Head', 0.11, (0, 0, 0.67), skin)
    brim = cyl('HatBrim', 0.155, 0.02, (0, 0, 0.745), hat, verts=14)
    top = cyl('HatTop', 0.09, 0.07, (0, 0, 0.78), hat, verts=14)
    root = bpy.data.objects.new('Player', None)
    bpy.context.collection.objects.link(root)
    root.location = (0, 0, 0)
    parent(root, [legL, legR, torso, armL, armR, head, brim, top])
    # 朝向 +X（Blender 前方 -Y，旋转对齐）
    for o in [legL, legR, torso, armL, armR, head, brim, top]:
        o.rotation_euler = (0, 0, math.radians(-90))
        # 绕 Z 转 -90° 后 Y 尺寸变为横向宽度
    export('player', root)

# ============ 鲨鱼 ============
def build_shark():
    clean()
    body_m = mat('shark', (0.35, 0.48, 0.54))
    belly = mat('shark_belly', (0.78, 0.85, 0.88))
    fin = mat('shark_fin', (0.30, 0.42, 0.48))
    eye = mat('eye', (0.05, 0.05, 0.07))
    body = sphere('Body', 1, (0.05, 0, 0), body_m, scale=(0.52, 0.15, 0.17))
    belly_s = sphere('Belly', 1, (0.09, 0, -0.045), belly, scale=(0.42, 0.12, 0.10))
    nose = cone('Nose', 0.09, 0.22, (0.62, 0, -0.01), body_m, rot=(0, math.radians(90), 0))
    dorsal = cone('Dorsal', 0.13, 0.24, (-0.02, 0, 0.20), fin, rot=(math.radians(-12), 0, 0), verts=4)
    tail = box('Tail', (0.24, 0.02, 0.22), (-0.62, 0, 0.02), fin)
    origin_to([tail], (-0.52, 0, 0.02))
    finL = box('FinL', (0.20, 0.02, 0.10), (0.18, 0.13, -0.07), fin, rot=(0, math.radians(28), math.radians(22)))
    finR = box('FinR', (0.20, 0.02, 0.10), (0.18, -0.13, -0.07), fin, rot=(0, math.radians(-28), math.radians(-22)))
    eyeL = sphere('EyeL', 0.022, (0.44, 0.10, 0.05), eye)
    eyeR = sphere('EyeR', 0.022, (0.44, -0.10, 0.05), eye)
    root = bpy.data.objects.new('Shark', None)
    bpy.context.collection.objects.link(root)
    parent(root, [body, belly_s, nose, dorsal, tail, finL, finR, eyeL, eyeR])
    export('shark', root)

# ============ 海豚 ============
def build_dolphin():
    clean()
    body_m = mat('dolphin', (0.49, 0.62, 0.72))
    belly = mat('dolphin_belly', (0.91, 0.95, 0.97))
    eye = mat('eye', (0.05, 0.05, 0.07))
    body = sphere('Body', 1, (0, 0, 0), body_m, scale=(0.42, 0.12, 0.13))
    belly_s = sphere('Belly', 1, (0.03, 0, -0.035), belly, scale=(0.32, 0.09, 0.08))
    nose = cone('Rostrum', 0.045, 0.16, (0.47, 0, 0.005), body_m, rot=(0, math.radians(90), 0))
    dorsal = cone('Dorsal', 0.06, 0.12, (-0.02, 0, 0.15), body_m, rot=(math.radians(-8), 0, 0), verts=6)
    tail = box('Fluke', (0.16, 0.20, 0.02), (-0.44, 0, 0.01), body_m)
    origin_to([tail], (-0.38, 0, 0.01))
    flL = box('FlipperL', (0.12, 0.02, 0.06), (0.12, 0.10, -0.05), body_m, rot=(math.radians(30), 0, math.radians(35)))
    flR = box('FlipperR', (0.12, 0.02, 0.06), (0.12, -0.10, -0.05), body_m, rot=(math.radians(30), 0, math.radians(-35)))
    eyeL = sphere('EyeL', 0.016, (0.33, 0.075, 0.035), eye)
    eyeR = sphere('EyeR', 0.016, (0.33, -0.075, 0.035), eye)
    root = bpy.data.objects.new('Dolphin', None)
    bpy.context.collection.objects.link(root)
    parent(root, [body, belly_s, nose, dorsal, tail, flL, flR, eyeL, eyeR])
    export('dolphin', root)

# ============ 鲸鱼 ============
def build_whale():
    clean()
    body_m = mat('whale', (0.24, 0.35, 0.47))
    belly = mat('whale_belly', (0.78, 0.85, 0.89))
    body = sphere('Body', 1, (0, 0, 0), body_m, scale=(1.5, 0.42, 0.45))
    belly_s = sphere('Belly', 1, (0.1, 0, -0.13), belly, scale=(1.2, 0.30, 0.30))
    nose = sphere('Snout', 1, (1.35, 0, -0.02), body_m, scale=(0.45, 0.30, 0.30))
    dorsal = cone('Dorsal', 0.12, 0.22, (-0.5, 0, 0.42), body_m, verts=6)
    tail = box('Fluke', (0.5, 1.05, 0.05), (-1.55, 0, 0.05), body_m)
    origin_to([tail], (-1.35, 0, 0.05))
    finL = box('FinL', (0.45, 0.05, 0.16), (0.55, 0.36, -0.22), body_m, rot=(math.radians(18), 0, math.radians(24)))
    finR = box('FinR', (0.45, 0.05, 0.16), (0.55, -0.36, -0.22), body_m, rot=(math.radians(18), 0, math.radians(-24)))
    eyeL = sphere('EyeL', 0.045, (1.05, 0.27, 0.05), mat('eye', (0.04, 0.05, 0.07)))
    eyeR = sphere('EyeR', 0.045, (1.05, -0.27, 0.05), mat('eye2', (0.04, 0.05, 0.07)))
    root = bpy.data.objects.new('Whale', None)
    bpy.context.collection.objects.link(root)
    parent(root, [body, belly_s, nose, dorsal, tail, finL, finR, eyeL, eyeR])
    export('whale', root)

# ============ 海鸥 ============
def build_gull():
    clean()
    white = mat('gull', (0.96, 0.97, 0.97))
    grey = mat('gull_grey', (0.85, 0.88, 0.90))
    beak = mat('beak', (0.95, 0.62, 0.20))
    eye = mat('eye', (0.05, 0.05, 0.07))
    body = sphere('Body', 1, (0, 0, 0), white, scale=(0.10, 0.055, 0.055))
    head = sphere('Head', 0.042, (0.085, 0, 0.035), white)
    bk = cone('Beak', 0.014, 0.05, (0.135, 0, 0.032), beak, rot=(0, math.radians(90), 0))
    tail = box('Tail', (0.08, 0.05, 0.012), (-0.10, 0, 0), grey)
    wingL = box('WingL', (0.16, 0.045, 0.012), (0, 0.10, 0.01), grey)
    origin_to([wingL], (0, 0.025, 0.01))
    wingR = box('WingR', (0.16, 0.045, 0.012), (0, -0.10, 0.01), grey)
    origin_to([wingR], (0, -0.025, 0.01))
    eyeL = sphere('EyeL', 0.009, (0.10, 0.028, 0.05), eye)
    eyeR = sphere('EyeR', 0.009, (0.10, -0.028, 0.05), eye)
    root = bpy.data.objects.new('Gull', None)
    bpy.context.collection.objects.link(root)
    parent(root, [body, head, bk, tail, wingL, wingR, eyeL, eyeR])
    export('gull', root)

# ============ 小鱼 ============
def build_fish():
    clean()
    orange = mat('fish', (0.95, 0.62, 0.25))
    fin = mat('fish_fin', (0.88, 0.50, 0.16))
    body = sphere('Body', 1, (0, 0, 0), orange, scale=(0.11, 0.045, 0.055))
    tail = cone('Tail', 0.05, 0.07, (-0.13, 0, 0), fin, rot=(0, 0, math.radians(90)), verts=3)
    origin_to([tail], (-0.095, 0, 0))
    dorsal = cone('Dorsal', 0.03, 0.05, (0, 0, 0.055), fin, verts=3)
    root = bpy.data.objects.new('Fish', None)
    bpy.context.collection.objects.link(root)
    parent(root, [body, tail, dorsal])
    export('fish', root)

# ============ 克拉肯触手 ============
def build_tentacle():
    clean()
    purple = mat('tentacle', (0.42, 0.29, 0.54))
    sucker = mat('sucker', (0.90, 0.71, 1.0))
    segs = []
    n = 9
    ang_total = math.radians(105)
    seg_len = 0.15
    r0, r1 = 0.15, 0.045
    # 底部朝下，向上弯；原点在底部
    a = 0.0
    z = 0.0
    x = 0.0
    for i in range(n):
        r = r0 + (r1 - r0) * (i / (n - 1))
        mid_ang = a + ang_total / (n - 1) / 2
        cx = x + math.sin(mid_ang) * seg_len / 2
        cz = z + math.cos(mid_ang) * seg_len / 2
        s = cyl(f'Seg{i}', r, seg_len * 1.06, (cx, 0, cz), purple, rot=(mid_ang, 0, 0), verts=9)
        segs.append(s)
        a += ang_total / (n - 1)
        x += math.sin(a) * seg_len
        z += math.cos(a) * seg_len
    # 吸盘
    a2 = 0.0; x2 = 0.0; z2 = 0.0
    for i in range(6):
        a2 += ang_total / 7
        x2 += math.sin(a2) * seg_len
        z2 += math.cos(a2) * seg_len
        sphere(f'Suk{i}', 0.028, (x2, 0.10 * (1 - i / 8), z2), sucker)
    tips = [o for o in bpy.data.objects if o.name.startswith(('Seg', 'Suk'))]
    origin_to([segs[0]], (0, 0, -seg_len / 2))
    root = bpy.data.objects.new('Tentacle', None)
    bpy.context.collection.objects.link(root)
    parent(root, tips)
    export('tentacle', root)

# ============ 棕榈树 ============
def build_palm():
    clean()
    trunk_m = mat('trunk', (0.54, 0.35, 0.18))
    frond_m = mat('frond', (0.30, 0.62, 0.29))
    coco = mat('coco', (0.45, 0.30, 0.15))
    segs = []
    n = 5
    for i in range(n):
        t = i / (n - 1)
        bend = math.sin(t * 0.9) * 0.12
        s = cyl(f'Trunk{i}', 0.09 - t * 0.025, 0.34, (bend * 1.6, 0, 0.17 + i * 0.32), trunk_m, rot=(bend * 0.55, 0, 0), verts=8)
        segs.append(s)
    fronds = []
    for i in range(6):
        a = i / 6 * math.pi * 2
        f = cone(f'Frond{i}', 0.13, 0.72, (0.24 + math.cos(a) * 0.30, math.sin(a) * 0.30, 1.78), frond_m,
                 rot=(math.radians(105), 0, a), verts=5)
        f.scale = (1.0, 0.30, 1.0)
        fronds.append(f)
    c1 = sphere('Coco1', 0.055, (0.16, 0.05, 1.66), coco)
    c2 = sphere('Coco2', 0.05, (0.10, -0.07, 1.63), coco)
    root = bpy.data.objects.new('Palm', None)
    bpy.context.collection.objects.link(root)
    parent(root, segs + fronds + [c1, c2])
    export('palm', root)

build_player()
build_shark()
build_dolphin()
build_whale()
build_gull()
build_fish()
build_tentacle()
build_palm()
print('全部模型完成')
