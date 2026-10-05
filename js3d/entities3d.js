// ============ 3D 实体：鲨鱼/海鸥/鱼群/海豚/鲸/克拉肯/商筏/漩涡/沉船/水下点/粒子/钩绳/船员 ============
import * as THREE from 'three';
import { S, dist } from '../js/state.js';
import { crewSlotPos } from '../js/entities.js';
import { W2U, cloneModel, modelReady, makeTextSprite } from './scene3d.js';

const M = {};
function mat(color, opts = {}) {
  const k = 'm_' + color + JSON.stringify(opts);
  if (!M[k]) M[k] = new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.85, metalness: opts.metal ?? 0, transparent: !!opts.opacity, opacity: opts.opacity ?? 1, emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emitI ?? 1 });
  return M[k];
}
const to3 = (x, y, h = 0) => new THREE.Vector3(x * W2U, h, y * W2U);
const ROLE_COLORS = { fisher: 0x3e8ea8, deckhand: 0x8a6b3b, cook: 0xc05a4a };

// 用玩家模型克隆一个换色人物（船员/幸存者）
function makePerson(shirtHex, withHat = true) {
  let g;
  if (modelReady('player')) {
    g = cloneModel('player');
    g.traverse(o => {
      if (o.isMesh && o.name === 'Torso') {
        o.material = o.material.clone();
        o.material.color.setHex(shirtHex);
      }
      if (!withHat && (o.name === 'HatBrim' || o.name === 'HatTop')) o.visible = false;
    });
  } else {
    g = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.35, 4, 8), mat(shirtHex));
    g.position.y = 0.4;
  }
  return g;
}

const R = {
  sharks: [], gulls: [], fish: [], under: [], vortices: [], wrecks: [],
  merchant: null, dolphin: null, whale: null, kraken: null,
  hook: null, hookLine: null, parts: [], bubbles: [],
  survivor: null, crew: [], levelFx: [],
};

function setFace(obj, dirDeg) { obj.rotation.y = -dirDeg; }

// ---------------- 鲨鱼 ----------------
export function syncSharks3d(scene, t) {
  while (R.sharks.length < S.entities.sharks.length) {
    let m = modelReady('shark') ? cloneModel('shark') : null;
    if (!m) {
      m = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.6, 4, 8), mat(0x5a7a8a));
      m.rotation.z = Math.PI / 2;
    }
    scene.add(m);
    const warn = makeTextSprite('❗', { bg: null, font: 'bold 40px system-ui', color: '#e63c32' });
    warn.visible = false;
    scene.add(warn);
    R.sharks.push({ m, warn, tail: null });
  }
  for (let i = 0; i < R.sharks.length; i++) {
    const e = R.sharks[i], s = S.entities.sharks[i];
    if (!s) { e.m.visible = false; e.warn.visible = false; continue; }
    e.m.visible = s.state !== 'dead' || s.deadT > 0;
    if (s.state === 'dead') e.m.position.y = -0.25;
    const h = s.state === 'dead' ? -0.25 : 0.02 + Math.sin(s.animT * 2) * 0.04;
    e.m.position.copy(to3(s.x, s.y, s.state === 'dead' ? -0.25 : h));
    setFace(e.m, s.dir);
    if (s.boss) {
      e.m.scale.setScalar(1.8);
      e.warn.visible = true;
      e.warn.position.copy(to3(s.x, s.y, 1.2));
    } else {
      e.m.scale.setScalar(1);
      e.warn.visible = s.state === 'approach' || s.state === 'hunt';
      if (s.state === 'approach') { e.warn.position.copy(to3(s.x, s.y, 0.8)); e.warn.material.opacity = 0.6 + 0.4 * Math.sin(t * 10); }
      else if (s.state === 'hunt') { e.warn.position.copy(to3(s.x, s.y, 0.8)); e.warn.material.opacity = 0.6 + 0.4 * Math.sin(t * 12); }
    }
    // 尾摆
    if (!e.tail) e.tail = e.m.getObjectByName('Tail');
    if (e.tail) e.tail.rotation.y = Math.sin(s.animT * 8) * 0.45;
  }
}

// ---------------- 海鸥 ----------------
export function syncGulls3d(scene) {
  while (R.gulls.length < S.entities.gulls.length) {
    let m = modelReady('gull') ? cloneModel('gull') : new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mat(0xf4f6f8));
    m.scale.setScalar(1.6);
    scene.add(m);
    const warn = makeTextSprite('🐦 偷菜!', { color: '#c23228' });
    warn.visible = false;
    scene.add(warn);
    R.gulls.push({ m, warn });
  }
  for (let i = 0; i < R.gulls.length; i++) {
    const e = R.gulls[i], g = S.entities.gulls[i];
    if (!g) { e.m.visible = false; e.warn.visible = false; continue; }
    e.m.visible = true;
    e.m.position.set(g.x * W2U, g.alt * W2U + 0.3, g.y * W2U);
    setFace(e.m, g.dir);
    const flap = Math.sin(g.bob * 4) * 0.7;
    const wl = e.m.getObjectByName('WingL'), wr = e.m.getObjectByName('WingR');
    if (wl) wl.rotation.x = flap;
    if (wr) wr.rotation.x = -flap;
    e.warn.visible = g.state === 'steal';
    if (e.warn.visible) e.warn.position.set(g.x * W2U, g.alt * W2U + 0.75, g.y * W2U);
  }
}

// ---------------- 鱼群 ----------------
export function syncFish3d(scene) {
  while (R.fish.length < S.entities.fish.length) {
    let m = modelReady('fish') ? cloneModel('fish') : new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), mat(0x2e5a72));
    m.scale.setScalar(1.4);
    scene.add(m);
    R.fish.push(m);
  }
  for (let i = 0; i < R.fish.length; i++) {
    const m = R.fish[i], f = S.entities.fish[i];
    if (!f) { m.visible = false; continue; }
    m.visible = true;
    m.position.set(f.x * W2U, -0.02 + Math.sin(f.t * 2 + i) * 0.05, f.y * W2U);
    m.rotation.x = Math.sin(f.t * 3 + i) * 0.2;
    setFace(m, f.dir);
    const tail = m.getObjectByName('Tail');
    if (tail) tail.rotation.y = Math.sin(f.t * 8) * 0.5;
  }
}

// ---------------- 海豚 / 鲸 ----------------
export function syncDolphin3d(scene, t) {
  const d = S.entities.dolphin;
  if (!d) { if (R.dolphin) { R.dolphin.visible = false; } return; }
  if (!R.dolphin) {
    R.dolphin = modelReady('dolphin') ? cloneModel('dolphin') : new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.5, 4, 8), mat(0x7c9eb8));
    R.dolphin.scale.setScalar(1.5);
    scene.add(R.dolphin);
  }
  R.dolphin.visible = true;
  R.dolphin.position.set(d.x * W2U, -0.05 + d.jump * 0.45, d.y * W2U);
  const nd = R.dolphin.getObjectByName('Fluke');
  if (nd) nd.rotation.y = Math.sin(d.t * 5) * 0.4;
  R.dolphin.rotation.z = Math.sin(d.t * 2) * 0.12;
}

export function syncWhale3d(scene) {
  const w = S.whale;
  if (!w) { if (R.whale) R.whale.visible = false; return; }
  if (!R.whale) {
    R.whale = modelReady('whale') ? cloneModel('whale') : new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mat(0x3e5a78));
    R.whale.scale.setScalar(1.5);
    scene.add(R.whale);
  }
  R.whale.visible = true;
  R.whale.position.set(w.x * W2U, -0.5 + Math.sin(w.t * 1.1) * 0.15, w.y * W2U);
  R.whale.rotation.y = w.vx > 0 ? -Math.PI / 2 : Math.PI / 2;
  const fl = R.whale.getObjectByName('Fluke');
  if (fl) fl.rotation.y = Math.sin(w.t * 2.4) * 0.3;
}

// ---------------- 克拉肯 ----------------
export function syncKraken3d(scene, t) {
  const K = S.kraken;
  if (!K) {
    if (R.kraken) { scene.remove(R.kraken.ring); for (const tn of R.kraken.tn) scene.remove(tn.m); R.kraken = null; }
    return;
  }
  if (!R.kraken) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(4.1, 4.35, 48),
      new THREE.MeshBasicMaterial({ color: 0xb43cb8, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    scene.add(ring);
    const tn = K.tentacles.map(() => {
      let m = modelReady('tentacle') ? cloneModel('tentacle') : new THREE.Mesh(new THREE.ConeGeometry(0.16, 1, 8), mat(0x6a4a8a));
      m.scale.setScalar(1.15);
      scene.add(m);
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.07), new THREE.MeshBasicMaterial({ color: 0xc05ae8 }));
      bar.position.y = 1.55;
      const barBg = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.11), new THREE.MeshBasicMaterial({ color: 0x142832, transparent: true, opacity: 0.7 }));
      barBg.position.y = 1.55;
      m.add(bar, barBg);
      m.userData.bar = bar;
      return m;
    });
    R.kraken = { ring, tn };
  }
  R.kraken.ring.material.opacity = 0.3 + 0.15 * Math.sin(t * 3);
  for (let i = 0; i < K.tentacles.length; i++) {
    const tn = K.tentacles[i], m = R.kraken.tn[i];
    const rise = tn.state === 'rise' ? tn.rise : (tn.hp <= 0 ? Math.max(0, 1 - (tn.deadT || 0)) : 1);
    m.visible = rise > 0.01;
    m.position.set(tn.x * W2U, -0.5 + rise * 0.5, tn.y * W2U);
    m.scale.set(1.15 * rise, 1.15 * rise, 1.15 * rise);
    m.rotation.z = Math.sin(tn.t * 2 + tn.phase) * 0.12;
    m.rotation.y = -tn.dir + Math.sin(tn.t + i) * 0.15;
    if (tn.hp > 0 && tn.state === 'slam') {
      m.rotation.z = Math.sin((0.6 - tn.slamT) / 0.6 * Math.PI) * 0.9;
    }
    const bar = m.userData.bar;
    if (bar) {
      bar.visible = tn.hp > 0 && rise >= 1;
      bar.scale.x = Math.max(0.01, tn.hp / 4);
      bar.position.x = -(1 - tn.hp / 4) * 0.3;
      bar.lookAt(scene.position);
    }
  }
}

// ---------------- 商筏 ----------------
export function syncMerchant3d(scene, t) {
  const m = S.entities.merchant;
  if (!m) { if (R.merchant) R.merchant.visible = false; return; }
  if (!R.merchant) {
    const g = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.24, 0.9), mat(0x8a5a2e));
    deck.position.y = 0.12;
    deck.castShadow = true;
    const cargo1 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.3), mat(0xc9a06a));
    cargo1.position.set(-0.6, 0.37, 0.1);
    const cargo2 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.26), mat(0xb5834e));
    cargo2.position.set(-0.2, 0.35, -0.12);
    for (const p of [new THREE.Vector3(-0.8, 0, -0.35), new THREE.Vector3(0.8, 0, -0.35), new THREE.Vector3(-0.8, 0, 0.35), new THREE.Vector3(0.8, 0, 0.35)]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.1, 6), mat(0x5a3a1e));
      post.position.copy(p); post.position.y = 0.6;
      g.add(post);
    }
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 0.9), mat(0xe86a4a));
    canopy.position.y = 1.16;
    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), mat(0x5a3a1e));
    flagPole.position.set(0.85, 1.5, 0);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.22), new THREE.MeshBasicMaterial({ color: 0xffd750, side: THREE.DoubleSide }));
    flag.name = 'flag';
    flag.position.set(0.65, 1.72, 0);
    const label = makeTextSprite('🛒 商筏', { color: '#5a4a30' });
    label.name = 'label';
    label.position.y = 2.2;
    g.add(deck, cargo1, cargo2, canopy, flagPole, flag, label);
    scene.add(g);
    R.merchant = g;
    R.merchantLabelSec = -1;
    R.merchantLabelDisc = -1;
  }
  R.merchant.visible = true;
  R.merchant.position.set(m.x * W2U, Math.sin(m.bob) * 0.05, m.y * W2U);
  const flag = R.merchant.getObjectByName('flag');
  if (flag) flag.rotation.y = Math.sin(m.bob * 2) * 0.3;
  // 招牌文字：仅在秒数/折扣变化时重建（每帧重建 = 纹理泄漏 + 卡顿）
  const label = R.merchant.getObjectByName('label');
  if (label) {
    const sec = Math.ceil(m.life);
    const disc = m.discount || 1;
    if (sec !== R.merchantLabelSec || disc !== R.merchantLabelDisc) {
      R.merchantLabelSec = sec;
      R.merchantLabelDisc = disc;
      const ns = makeTextSprite(`🛒 商筏 ${sec}s${disc < 1 ? ' ✂折' : ''}`, { color: '#5a4a30' });
      if (label.material.map) label.material.map.dispose();
      label.material.dispose();
      label.material = ns.material;
      label.scale.copy(ns.scale);
    }
  }
}

// ---------------- 漩涡 ----------------
export function syncVortices3d(scene, t) {
  while (R.vortices.length < S.entities.vortices.length) {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.4 - i * 0.38, 0.055, 6, 40),
        new THREE.MeshBasicMaterial({ color: i % 2 ? 0x285a78 : 0x9fd8e8, transparent: true, opacity: 0.55 })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03 + i * 0.015;
      ring.name = 'ring' + i;
      g.add(ring);
    }
    const center = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), new THREE.MeshBasicMaterial({ color: 0x0c2a40, transparent: true, opacity: 0.85 }));
    center.rotation.x = -Math.PI / 2;
    center.position.y = 0.04;
    g.add(center);
    scene.add(g);
    R.vortices.push(g);
  }
  for (let i = 0; i < R.vortices.length; i++) {
    const g = R.vortices[i], v = S.entities.vortices[i];
    if (!v) { g.visible = false; continue; }
    g.visible = true;
    const fade = v.life < 3 ? Math.max(0, v.life / 3) : 1;
    g.position.set(v.x * W2U, 0, v.y * W2U);
    g.scale.setScalar(v.r * W2U / 1.4);
    g.children.forEach((c, j) => {
      if (c.name.startsWith('ring')) c.rotation.z = t * (1.4 + j * 0.4) * (j % 2 ? -1 : 1);
      c.material.opacity *= 1; // 不改基础透明度，用 scale/整体 visible 即可
    });
    g.traverse(o => { if (o.material && o.userData.baseOp === undefined) o.userData.baseOp = o.material.opacity; if (o.material) o.material.transparent = true, o.material.opacity = (o.userData.baseOp ?? 0.6) * fade; });
  }
}

// ---------------- 沉船 ----------------
export function syncWrecks3d(scene, t) {
  while (R.wrecks.length < S.entities.wrecks.length) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.6), mat(0x5a4430));
    hull.position.y = 0.1;
    const bow = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 4), mat(0x5a4430));
    bow.rotation.z = -Math.PI / 2;
    bow.position.set(1.0, 0.1, 0);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.1, 7), mat(0x4a3828));
    mast.position.set(0.2, 0.7, 0);
    mast.rotation.z = 0.4;
    g.add(hull, bow, mast);
    for (let i = 0; i < 2; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.66), mat(0x3a2c1e));
      rib.position.set(-0.4 + i * 0.7, 0.22, 0);
      g.add(rib);
    }
    scene.add(g);
    const markers = [];
    R.wrecks.push({ g, markers });
  }
  for (let i = 0; i < R.wrecks.length; i++) {
    const e = R.wrecks[i], w = S.entities.wrecks[i];
    if (!w) { e.g.visible = false; e.markers.forEach(mk => mk.visible = false); continue; }
    e.g.visible = !w.done || w.fade > 0;
    if (w.done) e.g.rotation.z = Math.min(0.4, (3 - w.fade) * 0.3);
    e.g.position.set(w.x * W2U, -0.06 + Math.sin(w.t * 0.8) * 0.04, w.y * W2U);
    e.g.rotation.y = w.rot;
    // 搜刮点标记
    while (e.markers.length < w.nodes.length) {
      const mk = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat(0xffd54a, { emissive: 0xffc020, emitI: 1.2 }));
      scene.add(mk);
      e.markers.push(mk);
    }
    w.nodes.forEach((n, j) => {
      const mk = e.markers[j];
      mk.visible = !n.taken && !w.done;
      if (mk.visible) {
        mk.position.set(n.x * W2U, 0.18 + Math.sin(t * 3 + j) * 0.05, n.y * W2U);
      }
    });
  }
}

// ---------------- 水下资源点 ----------------
const UNDER_STYLE = {
  seaweed: { c: 0x3e9e5a }, clay: { c: 0xa8744a }, sand: { c: 0xe8d8a0 },
  stone: { c: 0x8e8a82 }, ore: { c: 0xc0a060 }, pearl: { c: 0xf0d8e8 },
};
export function syncUnder3d(scene, t) {
  while (R.under.length < S.underNodes.length) {
    const i = R.under.length;
    const kind = S.underNodes[i] ? S.underNodes[i].kind : 'seaweed';
    const g = new THREE.Group();
    if (kind === 'seaweed') {
      for (let j = -1; j <= 1; j++) {
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.55, 5), mat(0x3e9e5a));
        blade.position.set(j * 0.09, 0.24, 0);
        blade.name = 'sway' + (j + 1);
        g.add(blade);
      }
    } else if (kind === 'pearl') {
      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xc8b8d0));
      shell.position.y = 0.02;
      const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(0xf8f0f8, { rough: 0.25 }));
      pearl.position.y = 0.1;
      g.add(shell, pearl);
    } else {
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0), mat(UNDER_STYLE[kind].c));
      blob.position.y = 0.06;
      blob.rotation.set(Math.random(), Math.random() * 6, 0);
      g.add(blob);
    }
    if (kind === 'ore' || kind === 'pearl') {
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.018, 6, 16), new THREE.MeshBasicMaterial({ color: 0xffd750, transparent: true, opacity: 0.5 }));
      halo.name = 'halo';
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.04;
      g.add(halo);
    }
    scene.add(g);
    R.under.push(g);
  }
  for (let i = 0; i < R.under.length; i++) {
    const g = R.under[i], nd = S.underNodes[i];
    if (!nd) { g.visible = false; continue; }
    g.visible = !nd.taken;
    if (nd.taken) continue;
    g.position.set(nd.x * W2U, -0.15 + Math.sin(t * 1.4 + nd.bob) * 0.03, nd.y * W2U);
    const halo = g.getObjectByName('halo');
    if (halo) halo.rotation.z = t * 1.6;
    g.children.forEach(c => { if (c.name.startsWith('sway')) c.rotation.z = Math.sin(t * 2 + i) * 0.2; });
  }
}

// ---------------- 钩子与绳 ----------------
export function syncHook3d(scene, t) {
  const h = S.hook;
  if (!h) {
    if (R.hook) { R.hook.visible = false; R.hookLine.visible = false; }
    return;
  }
  if (!R.hook) {
    const g = new THREE.Group();
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat(0xc8d0d8, { metal: 0.6 }));
    const claw = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.018, 6, 12, Math.PI * 1.4), mat(0x8a929c, { metal: 0.6 }));
    claw.rotation.x = Math.PI / 2;
    claw.position.y = -0.07;
    g.add(knob, claw);
    scene.add(g);
    R.hook = g;
    const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    R.hookLine = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x8a6a3e }));
    scene.add(R.hookLine);
  }
  R.hook.visible = true;
  const bob = Math.sin(t * 3) * 0.03;
  R.hook.position.set(h.x * W2U, 0.05 + bob, h.y * W2U);
  const p = S.player;
  const pos = R.hookLine.geometry.attributes.position;
  pos.setXYZ(0, p.x * W2U, 0.45, p.y * W2U);
  pos.setXYZ(1, h.x * W2U, 0.1 + bob, h.y * W2U);
  pos.needsUpdate = true;
  R.hookLine.visible = true;
}

// ---------------- 幸存者 & 船员 & 升级光环 ----------------
export function syncPeople3d(scene, t) {
  // 幸存者
  const sv = S.survivor;
  if (!sv) {
    if (R.survivor) { scene.remove(R.survivor.m); scene.remove(R.survivor.label); R.survivor = null; }
  } else {
    if (!R.survivor) {
      const m = makePerson(0x4a7a9a, false);
      m.scale.setScalar(1.3);
      scene.add(m);
      const label = makeTextSprite('🙋 救命~! 按 使用 救我', { color: '#2878a0' });
      scene.add(label);
      R.survivor = { m, label };
    }
    R.survivor.m.visible = true;
    R.survivor.m.position.set(sv.x * W2U, 0.12, sv.y * W2U);
    R.survivor.m.rotation.y = Math.sin(t * 1.5) * 0.5;
    const arm = R.survivor.m.getObjectByName('ArmR');
    if (arm) arm.rotation.z = -2.2 + Math.sin(t * 10) * 0.5;
    R.survivor.label.visible = true;
    R.survivor.label.position.set(sv.x * W2U, 1.5, sv.y * W2U);
  }
  // 船员
  while (R.crew.length < S.crew.length) {
    const i = R.crew.length;
    const role = S.crew[i].role;
    const m = makePerson(ROLE_COLORS[role] || 0x8a6b3b, true);
    m.scale.setScalar(1.25);
    scene.add(m);
    const label = makeTextSprite(S.crew[i].name + '·' + S.crew[i].roleName, { color: '#4a4030' });
    scene.add(label);
    R.crew.push({ m, label });
  }
  for (let i = 0; i < R.crew.length; i++) {
    const e = R.crew[i], c = S.crew[i];
    if (!c) { e.m.visible = false; e.label.visible = false; continue; }
    e.m.visible = true; e.label.visible = true;
    const sp = crewSlotPos(i);
    const bob = Math.sin(t * 2 + i * 2) * 0.03;
    e.m.position.set(sp[0], 0.1 + bob, sp[1]);
    e.m.rotation.y = Math.sin(t * 0.7 + i) * 0.6;
    e.label.position.set(sp[0], 1.35, sp[1]);
  }
  // 升级光环
  for (const fx of R.levelFx) {
    fx.t += 1 / 60;
    fx.ring.scale.setScalar(0.3 + fx.t * 5);
    fx.ring.material.opacity = Math.max(0, 0.85 - fx.t * 1.4);
    if (fx.t > 0.7) fx.ring.visible = false;
  }
  R.levelFx = R.levelFx.filter(f => f.t <= 0.7);
}
export function spawnLevelRing3d(scene, x, y) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.4, 0.045, 6, 26),
    new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.85 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x * W2U, 0.25, y * W2U);
  scene.add(ring);
  R.levelFx.push({ ring, t: 0 });
}

// ---------------- 粒子（水花/气泡） ----------------
export function syncParticles3d(scene) {
  const drops = S.entities.parts;
  while (R.parts.length < drops.length) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 4), mat(0xcff2f0, { rough: 0.3 }));
    scene.add(m);
    R.parts.push(m);
  }
  for (let i = 0; i < R.parts.length; i++) {
    const m = R.parts[i], p = drops[i];
    if (!p) { m.visible = false; continue; }
    m.visible = true;
    // 抛物线高度：生命周期中段最高
    const pr = p.t / p.max;
    m.position.set(p.x * W2U, 0.08 + 0.5 * pr * (1 - pr) * 4 * 0.25, p.y * W2U);
    m.scale.setScalar(Math.max(0.2, pr));
  }
  const bubbles = S.entities.bubbles;
  while (R.bubbles.length < bubbles.length) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), new THREE.MeshBasicMaterial({ color: 0xe6faff, transparent: true, opacity: 0.6 }));
    scene.add(m);
    R.bubbles.push(m);
  }
  for (let i = 0; i < R.bubbles.length; i++) {
    const m = R.bubbles[i], b = bubbles[i];
    if (!b) { m.visible = false; continue; }
    m.visible = true;
    m.position.set(b.x * W2U, 0.08 - b.t * 0.12, b.y * W2U);
    m.scale.setScalar(b.r / 4);
  }
}
