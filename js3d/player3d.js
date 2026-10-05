// ============ 3D 玩家：GLB 模型 + 动画同步 ============
import * as THREE from 'three';
import { S } from '../js/state.js';
import { W2U, cloneModel, modelReady } from './scene3d.js';

const refs = { root: null, parts: {}, shadow: null, tool: null };

export function initPlayer3d(scene) {
  const root = modelReady('player') ? cloneModel('player') : null;
  if (root) {
    root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    root.scale.setScalar(1.35);
  } else {
    // 兜底占位（Blender 模型未加载完成时）
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.35, 4, 8), new THREE.MeshStandardMaterial({ color: 0xe8735a }));
    body.position.y = 0.4;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshStandardMaterial({ color: 0xf2c9a0 }));
    head.position.y = 0.68;
    g.add(body, head);
    refs.root = g;
  }
  refs.root = root || refs.root;
  scene.add(refs.root);
  // 工具小模型（持在右手位置）
  const tool = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 5), new THREE.MeshStandardMaterial({ color: 0x9a6b3b }));
  tool.name = 'tool';
  tool.visible = false;
  refs.root.add(tool);
  refs.tool = tool;
  // 影子
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.22, 14),
    new THREE.MeshBasicMaterial({ color: 0x0c3846, transparent: true, opacity: 0.25, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.115;
  scene.add(shadow);
  refs.shadow = shadow;
}

export function syncPlayer3d(t) {
  const p = S.player;
  const root = refs.root;
  if (!root) return;
  const wx = p.x * W2U, wz = p.y * W2U;
  const bobY = p.swimming ? -0.12 : Math.abs(Math.sin(p.walkT)) * 0.04 * (p.moving ? 1 : 0);
  root.position.set(wx, bobY + (p.swimming ? -0.18 : 0), wz);
  // 朝向：logic dir 0 = +x 平面，模型面朝 +X → rotation.y = -dir
  const targetRot = -p.dir;
  let d = ((targetRot - root.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  root.rotation.y += d * 0.25;
  // 游泳姿态
  if (root.rotation) {
    root.rotation.x = p.swimming ? 1.15 : 0;
  }
  // 行走摆动
  const swing = Math.sin(p.walkT) * 0.55 * (p.moving ? 1 : 0);
  const legL = root.getObjectByName('LegL'), legR = root.getObjectByName('LegR');
  const armL = root.getObjectByName('ArmL'), armR = root.getObjectByName('ArmR');
  if (legL) legL.rotation.x = swing;
  if (legR) legR.rotation.x = -swing;
  if (armL) armL.rotation.x = -swing * 0.8;
  if (armR) {
    if (p.swingT > 0) armR.rotation.x = -1.6 + Math.sin(p.swingT * Math.PI) * 1.4;
    else armR.rotation.x = swing * 0.8;
  }
  // 工具
  if (refs.tool) {
    const showTool = !p.swimming && ['hook', 'spear', 'spear_metal', 'blade', 'rod', 'hammer'].includes(p.tool);
    refs.tool.visible = showTool;
    if (showTool) {
      const colorMap = { hook: 0x8a929c, spear: 0xc8d0d8, spear_metal: 0xc8d0d8, blade: 0xe8e8f0, rod: 0x9a6b3b, hammer: 0x6a727c };
      refs.tool.material.color.setHex(colorMap[p.tool] || 0x9a6b3b);
      const hx = Math.cos(p.dir), hy = Math.sin(p.dir);
      refs.tool.position.set(hx * 0.2, 0.42, hy * 0.2);
      refs.tool.rotation.z = p.tool === 'rod' || p.tool === 'hook' ? -0.9 : 0.5;
      refs.tool.rotation.y = -p.dir + Math.PI / 2;
    }
  }
  // 影子
  refs.shadow.visible = !p.swimming;
  refs.shadow.position.set(wx, 0.115, wz);
}
