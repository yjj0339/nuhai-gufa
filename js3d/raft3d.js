// ============ 3D 木筏：地板网格 + 建筑建模 + 幽灵预览 ============
import * as THREE from 'three';
import { S, key } from '../js/state.js';
import { W2U } from './scene3d.js';

const M = {};
export const raftRefs = { tiles: new Map(), ghost: null, sailCloth: null, sailTilt: null };

function mat(color, opts = {}) {
  const k = 'm_' + color + JSON.stringify(opts);
  if (!M[k]) M[k] = new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.85, metalness: opts.metal ?? 0, transparent: !!opts.opacity, opacity: opts.opacity ?? 1, emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emitI ?? 1 });
  return M[k];
}

// ---------------- 建筑模型工厂 ----------------
const BUILDERS = {
  purifier(g) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.5), mat(0xd8e6ec));
    body.position.y = 0.25;
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.34, 12), mat(0x6ec6e8, { rough: 0.3 }));
    tank.position.set(0, 0.62, 0);
    const tap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.12), mat(0x7a828c, { metal: 0.5 }));
    tap.position.set(0, 0.3, 0.3);
    g.add(body, tank, tap);
  },
  grill(g) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.4), mat(0x3e4550));
    base.position.y = 0.34;
    const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.06), mat(0x4a505a, { metal: 0.4 }));
    l1.position.set(-0.2, 0.13, 0.12);
    const l2 = l1.clone(); l2.position.set(0.2, 0.13, -0.12);
    const fire = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 10), mat(0xff8c32, { emissive: 0xff6a1a, emitI: 0.9 }));
    fire.name = 'fire'; fire.position.y = 0.44;
    g.add(base, l1, l2, fire);
  },
  smelter(g) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.55), mat(0x8a6b52));
    body.position.y = 0.28;
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.57), mat(0x6a5038));
    top.position.y = 0.58;
    const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 10), mat(0x2e2a26));
    mouth.rotation.x = Math.PI / 2; mouth.position.set(0, 0.24, 0.28);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat(0xff9628, { emissive: 0xff7a1a, emitI: 1.4 }));
    glow.name = 'fire'; glow.position.set(0, 0.24, 0.3);
    g.add(body, top, mouth, glow);
  },
  farm(g) {
    const boxm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.9), mat(0x8a5a2e));
    boxm.position.y = 0.15;
    const soil = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.08, 0.78), mat(0x5c4326));
    soil.position.y = 0.32;
    g.add(boxm, soil);
    const plants = new THREE.Group();
    plants.name = 'plants';
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat(0x4fa24c));
      p.position.set(-0.22 + i * 0.22, 0.42, (i % 2) * 0.2 - 0.1);
      plants.add(p);
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), mat(i % 2 ? 0xe84a6a : 0xe8c86a));
      fruit.position.set(-0.22 + i * 0.22 + 0.05, 0.46, (i % 2) * 0.2 - 0.1 + 0.04);
      fruit.name = 'fruit'; fruit.visible = false;
      plants.add(fruit);
    }
    g.add(plants);
  },
  bed(g) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.5), mat(0x8a5a2e));
    frame.position.y = 0.22;
    const pil = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.4), mat(0xf0ead8));
    pil.position.set(-0.28, 0.3, 0);
    const blank = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.07, 0.44), mat(0xe8735a));
    blank.position.set(0.12, 0.3, 0);
    g.add(frame, pil, blank);
  },
  chest(g) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.38), mat(0x8a5a2e));
    body.position.y = 0.14;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.1, 0.4), mat(0xa9713d));
    lid.position.y = 0.32;
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.03), mat(0xd8b25e, { metal: 0.6 }));
    latch.position.set(0, 0.24, 0.2);
    g.add(body, lid, latch);
  },
  sail(g) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.5, 8), mat(0x7a5a36));
    mast.position.y = 0.75;
    const clothG = new THREE.Group();
    clothG.name = 'clothG';
    clothG.position.y = 0.72;
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.8, 6, 6), new THREE.MeshStandardMaterial({ color: 0xf2ebd8, side: THREE.DoubleSide, roughness: 0.9 }));
    cloth.name = 'cloth';
    cloth.position.set(0.31, 0, 0);
    clothG.add(cloth);
    const pivot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(0x5ac86a));
    pivot.position.y = 0.05;
    g.add(mast, clothG, pivot);
  },
  anchor(g) {
    const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), mat(0x5a6270, { metal: 0.5 }));
    shank.position.y = 0.3;
    const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 8), mat(0x5a6270, { metal: 0.5 }));
    cross.rotation.z = Math.PI / 2; cross.position.y = 0.5;
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 8, 14, Math.PI), mat(0x5a6270, { metal: 0.5 }));
    arc.position.y = 0.06;
    g.add(shank, cross, arc);
  },
  campfire(g) {
    for (let i = 0; i < 3; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.5, 7), mat(0x6a5038));
      log.rotation.z = Math.PI / 2;
      log.rotation.y = i * 1.05;
      log.position.y = 0.06;
      g.add(log);
    }
    const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 7), mat(0xff781e, { emissive: 0xff5a0a, emitI: 1.5 }));
    f1.name = 'fire'; f1.position.y = 0.2;
    const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 6), mat(0xffd24a, { emissive: 0xffc020, emitI: 1.8 }));
    f2.name = 'fire2'; f2.position.y = 0.24;
    g.add(f1, f2);
  },
  raincatcher(g) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 8), mat(0x8a6b52));
    pole.position.y = 0.4;
    const umb = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.2, 10), mat(0x78c8eb, { rough: 0.4 }));
    umb.position.y = 0.85;
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.1, 10), mat(0x4696c8, { rough: 0.3 }));
    basin.position.y = 0.62;
    g.add(pole, umb, basin);
  },
  scarecrow(g) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.85, 7), mat(0x8a5a2e));
    pole.position.y = 0.42;
    const arms = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 7), mat(0x8a5a2e));
    arms.rotation.z = Math.PI / 2; arms.position.y = 0.6;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), mat(0xe8c86a));
    head.position.y = 0.78;
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.1, 9), mat(0xc0554a));
    hat.position.y = 0.88;
    g.add(pole, arms, head, hat);
  },
  lamp(g) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.9, 8), mat(0x5a6270, { metal: 0.5 }));
    pole.position.y = 0.45;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.16), mat(0xffdca0, { emissive: 0xffc860, emitI: 0.2, rough: 0.2 }));
    glass.name = 'bulb';
    glass.position.y = 0.98;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.22), mat(0x3e4550));
    cap.position.y = 1.09;
    const light = new THREE.PointLight(0xffc860, 0, 4.5, 2);
    light.name = 'light';
    light.position.y = 0.98;
    g.add(pole, glass, cap, light);
  },
  radio(g) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.32), mat(0x5a6270, { metal: 0.3 }));
    body.position.y = 0.16;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.02), mat(0x3e4550));
    panel.position.set(-0.04, 0.2, 0.17);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), mat(0x7aff8c, { emissive: 0x40ff60, emitI: 0.6 }));
    led.name = 'led';
    led.position.set(0.16, 0.24, 0.17);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), mat(0x8a929c, { metal: 0.6 }));
    ant.position.set(0.18, 0.55, 0);
    ant.rotation.z = -0.3;
    g.add(body, panel, led, ant);
  },
};

export function initRaft3d(scene) {
  const ghost = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.22, 1),
    new THREE.MeshBasicMaterial({ color: 0x5adc78, transparent: true, opacity: 0.4 })
  );
  ghost.visible = false;
  scene.add(ghost);
  raftRefs.ghost = ghost;
}

export function syncRaft3d(scene, t) {
  // 地板同步（按 key 增删）
  const seen = new Set();
  for (const tl of S.raft.tiles.values()) {
    const k = key(tl.c, tl.r);
    seen.add(k);
    let e = raftRefs.tiles.get(k);
    if (!e) {
      const g = new THREE.Group();
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.16, 0.96), mat(0xa9713d));
      plank.position.y = 0.02;
      plank.castShadow = true; plank.receiveShadow = true;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.02, 0.3), mat(0xc08547));
      strip.position.y = 0.105;
      g.add(plank, strip);
      g.position.set(tl.c, 0, tl.r);
      scene.add(g);
      e = { g, plank, strip, net: null, building: null, btype: null };
      raftRefs.tiles.set(k, e);
    }
    // 加固
    const wantArmor = tl.armor ? 0 : 1;
    if (e.armor !== tl.armor) {
      e.plank.material = tl.armor ? mat(0x7a828c, { metal: 0.4 }) : mat(0xa9713d);
      if (tl.armor && !e.frame) {
        e.frame = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 1.0), mat(0x5a6270, { metal: 0.5 }));
        e.frame.position.y = 0.1;
        e.g.add(e.frame);
      }
      e.armor = tl.armor;
    }
    // 防鲨网
    if (tl.net && !e.net) {
      e.net = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ color: 0xf0f0dc, wireframe: true, transparent: true, opacity: 0.65 }));
      e.net.rotation.x = -Math.PI / 2;
      e.net.position.y = 0.12;
      e.g.add(e.net);
    } else if (!tl.net && e.net) { e.g.remove(e.net); e.net = null; }
    // 建筑
    const bt = tl.b ? tl.b.type : null;
    if (bt !== e.btype) {
      if (e.building) { e.g.remove(e.building); e.building = null; }
      e.btype = bt;
      if (bt) {
        const bg = new THREE.Group();
        BUILDERS[bt](bg);
        bg.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
        e.building = bg;
        e.g.add(bg);
        if (bt === 'sail') raftRefs.sailCloth = bg;
      }
    }
  }
  // 删除消失的地板
  for (const [k, e] of raftRefs.tiles) {
    if (!seen.has(k)) {
      scene.remove(e.g);
      raftRefs.tiles.delete(k);
      if (raftRefs.sailCloth === e.building) raftRefs.sailCloth = null;
    }
  }
  // 帆动画
  if (raftRefs.sailCloth) {
    const clothG = raftRefs.sailCloth.getObjectByName('clothG');
    const cloth = raftRefs.sailCloth.getObjectByName('cloth');
    if (clothG) {
      clothG.rotation.y = -S.sailing.angle;
      if (cloth) cloth.scale.y = S.sailing.raised ? 1 : 0.12;
    }
  }
  // 灯火动画
  const night = S.time.frac > 0.74 || S.time.frac < 0.24;
  for (const e of raftRefs.tiles.values()) {
    if (!e.building) continue;
    const fire = e.building.getObjectByName('fire');
    if (fire) { const s = 0.9 + Math.sin(t * 9) * 0.15; fire.scale.setScalar(s); }
    const bulb = e.building.getObjectByName('bulb');
    const light = e.building.getObjectByName('light');
    if (bulb) {
      bulb.material = mat(night ? 0xffe2a8 : 0xbfd0d8, { emissive: night ? 0xffc860 : 0x223030, emitI: night ? 1.2 : 0.2, rough: 0.2 });
      if (light) light.intensity = night ? 3.2 + Math.sin(t * 3) * 0.5 : 0;
    }
    const led = e.building.getObjectByName('led');
    if (led) {
      const on = S.lighthouseFound ? 1 : (Math.sin(t * 4) > 0 ? 1 : 0.25);
      led.material = mat(0x7aff8c, { emissive: 0x40ff60, emitI: on });
    }
    // 农田成熟
    if (e.btype === 'farm') {
      const f = S.farmPlots[Math.round(e.g.position.x) + ',' + Math.round(e.g.position.z)];
      const plants = e.building.getObjectByName('plants');
      if (plants) {
        const grown = !!(f && f.crop);
        const done = !!(f && f.done);
        plants.visible = grown;
        if (grown) {
          plants.children.forEach(c => {
            if (c.name === 'fruit') c.visible = done;
            else c.scale.setScalar(done ? 1.25 : 0.7);
          });
        }
      }
    }
  }
}

// 建造幽灵预览
export function updateGhost(tile, ok) {
  const gh = raftRefs.ghost;
  if (!tile) { gh.visible = false; return; }
  gh.visible = true;
  gh.position.set(tile.c, 0.14, tile.r);
  gh.material.color.setHex(ok ? 0x5adc78 : 0xf87171);
}

export function raftTileCount3d() { return raftRefs.tiles.size; }
