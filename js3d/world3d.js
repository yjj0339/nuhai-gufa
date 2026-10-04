// ============ 3D 世界：岛屿 / 漂流物 / 灯塔 ============
import * as THREE from 'three';
import { S, dist } from '../js/state.js';
import { ISLAND_TYPES } from '../js/data.js';
import { W2U, cloneModel, modelReady, makeTextSprite } from './scene3d.js';

const M = {};
function mat(color, opts = {}) {
  const k = 'm_' + color + JSON.stringify(opts);
  if (!M[k]) M[k] = new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.9, metalness: opts.metal ?? 0, transparent: !!opts.opacity, opacity: opts.opacity ?? 1, emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emitI ?? 1 });
  return M[k];
}

export const worldRefs = { islands: new Map(), floaters: [], lighthouseBeams: [] };

// ---------------- 岛屿 ----------------
function buildIslandGroup(isl, scene) {
  const g = new THREE.Group();
  const T = ISLAND_TYPES[isl.type] || ISLAND_TYPES.sand;
  const r = isl.r * W2U;
  // 浅水圈
  const shallow = new THREE.Mesh(new THREE.CircleGeometry(r * 1.45, 26), new THREE.MeshBasicMaterial({ color: 0xa8f0e0, transparent: true, opacity: 0.4 }));
  shallow.rotation.x = -Math.PI / 2;
  shallow.position.y = 0.03;
  g.add(shallow);
  // 岛体（不规则圆柱）
  const geo = new THREE.CylinderGeometry(r, r * 1.12, 0.5, 22, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    if (Math.abs(x) > 0.01 || Math.abs(z) > 0.01) {
      const jitter = 1 + 0.13 * Math.sin(Math.atan2(z, x) * 3 + isl.id * 2.2) + 0.05 * Math.sin(Math.atan2(z, x) * 7 + isl.id);
      pos.setX(i, x * jitter); pos.setZ(i, z * jitter);
    }
    if (pos.getY(i) > 0) pos.setY(i, 0.12 + 0.06 * Math.sin(x * 2.1 + z * 1.7));
  }
  geo.computeVertexNormals();
  const bodyCol = isl.type === 'jungle' ? 0xa8d78a : isl.type === 'rock' ? 0xc9c3b8 : 0xf5e3b3;
  const body = new THREE.Mesh(geo, mat(bodyCol));
  body.position.y = -0.13;
  body.receiveShadow = true;
  g.add(body);
  // 灯塔
  if (isl.type === 'lighthouse') {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.75, 3.2, 14), mat(0xe8e4da));
    tower.position.y = 1.7; tower.castShadow = true;
    const band1 = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.68, 0.5, 14), mat(0xe05a4a));
    band1.position.y = 1.0;
    const band2 = band1.clone(); band2.position.y = 2.1;
    const room = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 12), mat(0x5a6270));
    room.position.y = 3.5;
    const lampG = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), mat(0xffeb8c, { emissive: 0xffe070, emitI: 1.5 }));
    lampG.name = 'lampG';
    lampG.position.y = 3.5;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.4, 12), mat(0xe05a4a));
    roof.position.y = 3.92;
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(1.4, 14, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff0aa, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.name = 'beam';
    beam.rotation.z = Math.PI / 2;
    beam.position.set(7, 3.5, 0);
    const beamG = new THREE.Group();
    beamG.name = 'beamG';
    beamG.position.y = 0;
    beamG.add(beam);
    beamG.position.y = 3.5;
    g.add(tower, band1, band2, room, lampG, roof, beamG);
    worldRefs.lighthouseBeams.push(beamG);
  }
  // 资源节点
  const nodeMeshes = [];
  for (const nd of isl.nodes) {
    const nm = makeNodeMesh(nd);
    g.add(nm);
    nodeMeshes.push(nm);
  }
  // 宝箱
  let chestG = null;
  if (isl.chest) {
    chestG = new THREE.Group();
    const cb = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.3), mat(0x8a5a2e));
    cb.position.y = 0.13;
    const cl = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.1, 0.32), mat(0xd8b25e, { metal: 0.4 }));
    cl.position.y = 0.3;
    chestG.add(cb, cl);
    const glowRing = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.02, 6, 18), new THREE.MeshBasicMaterial({ color: 0xffd750, transparent: true, opacity: 0.7 }));
    glowRing.name = 'glow';
    glowRing.rotation.x = -Math.PI / 2;
    glowRing.position.y = 0.05;
    chestG.add(glowRing);
    chestG.position.set((isl.chest.x - isl.x) * W2U, 0.18, (isl.chest.y - isl.y) * W2U);
    g.add(chestG);
  }
  // 名字牌
  const label = makeTextSprite(isl.type === 'lighthouse' ? '🗼 灯塔岛' : (T.name || '海岛'));
  label.position.y = (isl.type === 'lighthouse' ? 4.8 : 1.6);
  g.add(label);
  g.position.set(isl.x * W2U, 0, isl.y * W2U);
  scene.add(g);
  return { g, label, nodeMeshes, chestG, isl, visited: isl.visited, type: isl.type };
}

function makeNodeMesh(nd) {
  const g = new THREE.Group();
  if (nd.kind === 'palm' && modelReady('palm')) {
    const p = cloneModel('palm');
    p.rotation.y = Math.random() * 6.28;
    g.add(p);
  } else if (nd.kind === 'palm') {
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.2, 7), mat(0x8a5a2e));
    tr.position.y = 0.6;
    const fr = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.4, 6), mat(0x4e9e4a));
    fr.position.y = 1.3;
    g.add(tr, fr);
  } else if (nd.kind === 'rock') {
    const r = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), mat(0x8e8a82));
    r.position.y = 0.22;
    r.rotation.set(Math.random(), Math.random() * 6, 0);
    const r2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), mat(0xa8a49a));
    r2.position.set(0.22, 0.12, 0.1);
    g.add(r, r2);
  } else {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), mat(0x3e8e4a));
    b.position.y = 0.2;
    b.scale.y = 0.75;
    for (let i = 0; i < 3; i++) {
      const berry = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), mat(0xe84a6a));
      berry.position.set(Math.cos(i * 2.1) * 0.18, 0.22, Math.sin(i * 2.1) * 0.18);
      g.add(berry);
    }
    g.add(b);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.position.set((nd.x - 0) * 0, 0, 0);
  return g;
}

export function syncWorld3d(scene, t) {
  // 岛屿同步
  const seenIds = new Set();
  for (const isl of S.islands) {
    if (dist(0, 0, isl.x, isl.y) > 3800) continue;
    seenIds.add(isl.id);
    let e = worldRefs.islands.get(isl.id);
    if (!e) {
      e = buildIslandGroup(isl, scene);
      worldRefs.islands.set(isl.id, e);
    }
    e.g.position.set(isl.x * W2U, 0, isl.y * W2U);
    // 名字牌
    if (e.visited !== isl.visited) {
      e.visited = isl.visited;
      e.g.remove(e.label);
      const T = ISLAND_TYPES[isl.type];
      e.label = makeTextSprite((isl.type === 'lighthouse' ? '🗼 灯塔岛' : (T?.name || '海岛')) + (isl.visited ? ' ·已探索' : ''));
      e.label.position.y = isl.type === 'lighthouse' ? 4.8 : 1.6;
      e.g.add(e.label);
    }
    // 节点 hp 可视
    e.nodeMeshes.forEach((nm, i) => {
      const nd = isl.nodes[i];
      if (nd) nm.visible = nd.hp > 0;
    });
    // 宝箱
    if (e.chestG) {
      e.chestG.visible = !isl.chest.open;
      const glow = e.chestG.getObjectByName('glow');
      if (glow) glow.rotation.z = t * 1.5;
    }
    // 灯塔光束
    if (e.type === 'lighthouse') {
      const beamG = e.g.getObjectByName('beamG');
      if (beamG) beamG.rotation.y = t * 0.9;
    }
  }
  for (const [id, e] of worldRefs.islands) {
    if (!seenIds.has(id)) { scene.remove(e.g); worldRefs.islands.delete(id); }
  }
  // 漂流物同步
  const fdefs = {
    plank: { geo: () => new THREE.BoxGeometry(0.5, 0.08, 0.2), m: () => mat(0xb07a45) },
    plastic: { geo: () => new THREE.CylinderGeometry(0.06, 0.06, 0.22, 8), m: () => mat(0xdcf5fa, { rough: 0.3 }) },
    barrel: { geo: () => new THREE.CylinderGeometry(0.2, 0.2, 0.28, 10), m: () => mat(0x9a6b3b) },
    crate: { geo: () => new THREE.BoxGeometry(0.3, 0.28, 0.3), m: () => mat(0xc9a06a) },
    leaves: { geo: () => new THREE.ConeGeometry(0.18, 0.14, 6), m: () => mat(0x5fae5b) },
    bottle: { geo: () => new THREE.CylinderGeometry(0.06, 0.07, 0.26, 8), m: () => mat(0xb4ebdc, { rough: 0.2, opacity: 0.85 }) },
  };
  while (worldRefs.floaters.length < S.entities.floaters.length) {
    const f = S.entities.floaters[worldRefs.floaters.length];
    const d = fdefs[f.type] || fdefs.plank;
    const mesh = new THREE.Mesh(d.geo(), d.m());
    mesh.castShadow = true;
    scene.add(mesh);
    worldRefs.floaters.push(mesh);
  }
  for (let i = 0; i < worldRefs.floaters.length; i++) {
    const m = worldRefs.floaters[i];
    const f = S.entities.floaters[i];
    if (!f) { m.visible = false; continue; }
    m.visible = true;
    m.position.set(f.x * W2U, 0.06 + Math.sin(f.bob) * 0.05, f.y * W2U);
    m.rotation.y = f.rot;
  }
}
