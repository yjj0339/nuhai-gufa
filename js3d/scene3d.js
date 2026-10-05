// ============ 3D 场景：渲染器 / 海洋 / 天空 / 光照 / 相机 ============
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/GLTFLoader.js';
import { S } from '../js/state.js';

export const W2U = 1 / 48;   // 逻辑像素 → 世界单位（1 格地板 = 1 单位）
export const U2L = 48;

export let renderer, scene, camera, glCanvas;
export const skyU = {};       // 天空/环境 uniforms 与对象引用
const MODELS = {};            // name -> THREE.Group 模板
const MODELS_LOADING = {};

let camYaw = 0.6, camPitch = 0.78, camDist = 9;
let camTarget = new THREE.Vector3();
let orbiting = false;

// ---------------- 初始化 ----------------
export function init3d() {
  glCanvas = document.getElementById('gl');
  renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true });
  renderer.setPixelRatio(Math.min(1.6, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = S.settings.quality !== 'low';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xbfe8e2, 30, 160);

  camera = new THREE.PerspectiveCamera(52, 1, 0.1, 800);
  camera.position.set(9, 9, 9);

  // 光照
  const hemi = new THREE.HemisphereLight(0xcfeef2, 0x3e7e96, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2dd, 2.2);
  sun.position.set(20, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -16; sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -16;
  sun.shadow.camera.far = 90;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);
  skyU.hemi = hemi; skyU.sun = sun;

  // 天空穹顶
  const skyGeo = new THREE.SphereGeometry(420, 24, 14);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x8fd8f0) },
      bottom: { value: new THREE.Color(0xd8f2ec) },
      uRb: { value: 0 },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      uniform vec3 top; uniform vec3 bottom; uniform float uRb;
      varying vec3 vP;
      void main(){
        vec3 dir = normalize(vP);
        float h = clamp(dir.y * 1.6 + 0.28, 0.0, 1.0);
        vec3 col = mix(bottom, top, h);
        // 彩虹：固定方位（世界 -Z 偏西）的低空色带
        if (uRb > 0.01) {
          float az = atan(dir.x, -dir.z);
          float azMask = smoothstep(0.75, 0.25, abs(az));
          float el = asin(clamp(dir.y, -1.0, 1.0));
          float band = smoothstep(0.20, 0.12, abs(el - 0.17));
          if (band > 0.0 && azMask > 0.0) {
            float t = clamp((el - 0.05) / 0.24, 0.0, 1.0);
            vec3 rc = t < 0.2 ? vec3(1.0,0.54,0.54) : t < 0.4 ? vec3(1.0,0.77,0.42) : t < 0.6 ? vec3(1.0,0.91,0.54) : t < 0.8 ? vec3(0.62,0.91,0.63) : t < 0.93 ? vec3(0.54,0.78,1.0) : vec3(0.71,0.62,1.0);
            col = mix(col, rc, band * azMask * uRb * 0.75);
          }
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
  skyU.sky = sky;

  // 月亮 & 星星
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(9, 14, 10),
    new THREE.MeshBasicMaterial({ color: 0xfaf5dc, fog: false })
  );
  scene.add(moon);
  skyU.moon = moon;
  const starGeo = new THREE.BufferGeometry();
  const starPos = [];
  for (let i = 0; i < 420; i++) {
    const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI * 0.42 + 0.08, r = 380;
    starPos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xfffbe8, size: 1.6, transparent: true, opacity: 0, fog: false, sizeAttenuation: false }));
  scene.add(stars);
  skyU.stars = stars;

  // 海洋
  const oceanGeo = new THREE.PlaneGeometry(760, 760, 128, 128);
  oceanGeo.rotateX(-Math.PI / 2);
  const oceanMat = new THREE.ShaderMaterial({
    fog: false,
    uniforms: {
      uT: { value: 0 },
      uDeep: { value: new THREE.Color(0x2fb4c9) },
      uShallow: { value: new THREE.Color(0x7fe0d6) },
      uFog: { value: new THREE.Color(0xbfe8e2) },
      uRaftMin: { value: new THREE.Vector2(-2, -2) },
      uRaftMax: { value: new THREE.Vector2(2, 2) },
      uFoam: { value: 1 },
      uRb: { value: 0 },
      uCam: { value: new THREE.Vector3() },
    },
    vertexShader: `
      uniform float uT;
      varying vec3 vW;
      varying float vWave;
      float wave(vec2 p, vec2 dir, float freq, float speed, float amp, float t){
        return sin(dot(p, dir) * freq + t * speed) * amp;
      }
      void main(){
        vec3 pos = position;
        vec2 xz = vec2(pos.x, pos.z);
        float w = 0.0;
        w += wave(xz, normalize(vec2(1.0,0.4)), 0.32, 1.1, 0.16, uT);
        w += wave(xz, normalize(vec2(-0.6,1.0)), 0.5, 1.6, 0.10, uT);
        w += wave(xz, normalize(vec2(0.8,-0.9)), 0.9, 2.2, 0.05, uT);
        pos.y += w;
        vWave = w;
        vec4 wp = modelMatrix * vec4(pos, 1.0);
        vW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uFog; uniform vec3 uCam;
      uniform vec2 uRaftMin; uniform vec2 uRaftMax; uniform float uFoam; uniform float uT;
      uniform float uRb;
      varying vec3 vW; varying float vWave;
      void main(){
        float band = smoothstep(0.15, 0.65, vWave + 0.18);
        vec3 col = mix(uDeep, uShallow, band);
        // 细微波光（正弦条带，不是方块）
        float glint = sin(vW.x * 2.1 + uT * 1.2) * sin(vW.z * 1.7 - uT * 0.9);
        col += smoothstep(0.86, 1.0, glint) * 0.06;
        // 木筏四周泡沫
        vec2 rc = (uRaftMin + uRaftMax) * 0.5;
        vec2 re = max(abs(vW.xz - rc) - (uRaftMax - uRaftMin) * 0.5, 0.0);
        float rd = length(re);
        float foam = uFoam * (1.0 - smoothstep(0.0, 0.55, abs(rd - 0.08 - sin(vW.x * 2.2 + vW.z * 1.7) * 0.06)));
        col = mix(col, vec3(0.93, 0.98, 0.97), foam * 0.8);
        // 彩虹倒影带：从木筏向 -Z 方向海面铺开（在雾之后叠加，不被雾冲淡）
        if (uRb > 0.01) {
          float dz = -(vW.z - rc.y);
          float dx = vW.x - rc.x;
          float along = dz / max(1.0, abs(dx) * 0.55 + 1.0);
          float lat = abs(dx) / max(2.0, along);
          float distMask = smoothstep(2.5, 9.0, along) * (1.0 - smoothstep(38.0, 60.0, along));
          float azMask = 1.0 - smoothstep(0.16, 0.34, lat);
          if (distMask > 0.0 && azMask > 0.0) {
            float tt = clamp((along - 2.5) / 42.0, 0.0, 1.0);
            vec3 rc6 = tt < 0.17 ? vec3(1.0,0.45,0.4) : tt < 0.34 ? vec3(1.0,0.68,0.32) : tt < 0.5 ? vec3(1.0,0.88,0.42) : tt < 0.67 ? vec3(0.5,0.88,0.55) : tt < 0.84 ? vec3(0.42,0.68,1.0) : vec3(0.6,0.48,1.0);
            col = mix(col, rc6, distMask * azMask * uRb * 0.55);
          }
        }
        // 雾
        float d = distance(vW, uCam);
        float f = smoothstep(30.0, 150.0, d);
        col = mix(col, uFog, f);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const ocean = new THREE.Mesh(oceanGeo, oceanMat);
  ocean.position.y = 0;
  scene.add(ocean);
  skyU.oceanMat = oceanMat;

  // 雨
  const rainGeo = new THREE.BufferGeometry();
  const rainArr = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) {
    rainArr[i * 3] = (Math.random() - 0.5) * 70;
    rainArr[i * 3 + 1] = Math.random() * 26;
    rainArr[i * 3 + 2] = (Math.random() - 0.5) * 70;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainArr, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xb8d8ee, size: 0.11, transparent: true, opacity: 0.7 }));
  rain.visible = false;
  scene.add(rain);
  skyU.rain = rain;

  window.addEventListener('resize', resize);
  resize();
}

export function resize() {
  if (!renderer) return;
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

// ---------------- GLB 加载 ----------------
export function loadGLB(name) {
  if (MODELS[name]) return Promise.resolve(MODELS[name]);
  if (MODELS_LOADING[name]) return MODELS_LOADING[name];
  MODELS_LOADING[name] = new Promise((res, rej) => {
    new GLTFLoader().load(`../assets/models/${name}.glb`,
      g => {
        const root = g.scene;
        root.traverse(o => {
          if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; }
        });
        MODELS[name] = root;
        MODELS_LOADING[name] = null;
        window.__glbLoaded = (window.__glbLoaded || 0) + 1;
        res(root);
      },
      undefined,
      e => { console.error('GLB加载失败:', name, e); MODELS_LOADING[name] = null; rej(e); }
    );
  });
  return MODELS_LOADING[name];
}
export function modelReady(name) { return !!MODELS[name]; }
export function cloneModel(name) {
  const t = MODELS[name];
  if (!t) return null;
  const c = t.clone(true);
  return c;
}

// ---------------- 文字精灵 ----------------
export function makeTextSprite(text, opts = {}) {
  const { font = 'bold 26px system-ui', color = '#33505e', bg = 'rgba(253,250,242,0.88)', pad = 14 } = opts;
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
  const h = 46;
  cv.width = w; cv.height = h;
  const c2 = cv.getContext('2d');
  c2.font = font;
  if (bg) {
    c2.fillStyle = bg;
    c2.beginPath(); c2.roundRect(0, 0, w, h, 12); c2.fill();
    c2.strokeStyle = 'rgba(200,185,150,0.9)'; c2.lineWidth = 2; c2.stroke();
  }
  c2.fillStyle = color; c2.textAlign = 'center'; c2.textBaseline = 'middle';
  c2.fillText(text, w / 2, h / 2 + 1);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(w / 130, h / 130, 1);
  return sp;
}

// ---------------- 环境（昼夜/天气驱动） ----------------
const dayTop = new THREE.Color(0x6ec6ea), dayBot = new THREE.Color(0xd8f2ec);
const setTop = new THREE.Color(0x5b7b95), setBot = new THREE.Color(0xa8bfc4);
const nightTop = new THREE.Color(0x182658), nightBot = new THREE.Color(0x2a3f6e);
const fogDay = new THREE.Color(0xbfe8e2), fogNight = new THREE.Color(0x2a3a5e), fogFoggy = new THREE.Color(0xdfe8ec);
const deepDay = new THREE.Color(0x2fa8c2), deepStorm = new THREE.Color(0x23708c), deepNight = new THREE.Color(0x143a56);
const shalDay = new THREE.Color(0x8fe3d9), shalStorm = new THREE.Color(0x6fb0bc), shalNight = new THREE.Color(0x2f6b7e);
const tmpTop = new THREE.Color(), tmpBot = new THREE.Color(), tmpDeep = new THREE.Color(), tmpShal = new THREE.Color(), tmpFog = new THREE.Color();

export function nightFactor3d() {
  const f = S.time.frac;
  if (f > 0.8 || f < 0.2) return 1;
  if (f > 0.72) return (f - 0.72) / 0.08;
  if (f < 0.28) return 1 - (f - 0.2) / 0.08;
  return 0;
}

export function setEnvironment(dt, t) {
  const nf = nightFactor3d();
  const stormy = S.weather.type === 'storm' || S.weather.type === 'rain';
  const foggy = S.weather.type === 'foggy';
  const underwater = S.player.swimming && camera.position.y < 0.05;
  skyU.underwater = underwater;
  // 天空渐变
  tmpTop.copy(dayTop).lerp(nightTop, nf);
  if (stormy) tmpTop.lerp(setTop, 0.55);
  tmpBot.copy(dayBot).lerp(nightBot, nf);
  if (stormy) tmpBot.lerp(setBot, 0.6);
  // 雷暴闪电：天光爆闪
  const flash = S.weather.flash > 0 ? S.weather.flash : 0;
  if (flash > 0) {
    tmpTop.lerp(new THREE.Color(0xf4f8ff), Math.min(0.8, flash));
    tmpBot.lerp(new THREE.Color(0xf4f8ff), Math.min(0.8, flash));
  }
  skyU.sky.material.uniforms.top.value.copy(tmpTop);
  skyU.sky.material.uniforms.bottom.value.copy(tmpBot);
  // 太阳
  const sunAng = (S.time.frac - 0.25) * Math.PI * 2;
  const sunEl = Math.sin(sunAng);
  skyU.sun.position.set(Math.cos(sunAng) * 46, Math.max(4, sunEl * 40), 20);
  skyU.sun.intensity = (stormy ? 0.9 : 1.1 + Math.max(0, sunEl) * 1.6) + flash * 6;
  skyU.sun.color.setHSL(0.09, 0.5, 0.5 + Math.max(0, sunEl) * 0.34);
  skyU.hemi.intensity = (stormy ? 0.55 : 0.85 - nf * 0.45) + flash * 3;
  // 雾（水面 / 水下两套）
  if (underwater) {
    tmpFog.copy(fogDay).lerp(new THREE.Color(0x0e4a66), Math.max(0.55, nf * 0.85));
    scene.fog.color.copy(tmpFog);
    scene.fog.near = 1.5;
    scene.fog.far = 16;
  } else {
    tmpFog.copy(fogDay).lerp(fogNight, nf);
    if (foggy) tmpFog.lerp(fogFoggy, 0.8);
    scene.fog.color.copy(tmpFog);
    scene.fog.near = foggy ? 10 : 30;
    scene.fog.far = foggy ? 70 : (stormy ? 120 : 165);
  }
  // 海色
  tmpDeep.copy(deepDay).lerp(deepNight, nf * 0.9);
  if (stormy) tmpDeep.lerp(deepStorm, 0.65);
  tmpShal.copy(shalDay).lerp(shalNight, nf * 0.9);
  if (stormy) tmpShal.lerp(shalStorm, 0.55);
  const om = skyU.oceanMat.uniforms;
  om.uDeep.value.copy(tmpDeep);
  om.uShallow.value.copy(tmpShal);
  om.uFog.value.copy(tmpFog);
  om.uT.value = t;
  om.uCam.value.copy(camera.position);
  // 月亮与星星
  skyU.moon.position.set(Math.cos(sunAng + Math.PI) * 300, Math.max(30, -sunEl * 260), -160);
  skyU.moon.visible = nf > 0.05 && !underwater;
  skyU.stars.material.opacity = nf * (stormy ? 0.15 : 0.95);
  // 雨
  const raining = S.weather.type === 'rain' || S.weather.type === 'storm';
  skyU.rain.visible = raining && !underwater;
  if (raining) {
    skyU.rain.position.set(camera.position.x, 0, camera.position.z);
    const arr = skyU.rain.geometry.attributes.position;
    const sp = dt * 22;
    for (let i = 0; i < arr.count; i++) {
      let y = arr.getY(i) - sp;
      if (y < 0) y = 24 + Math.random() * 4;
      arr.setY(i, y);
    }
    arr.needsUpdate = true;
  }
  // 彩虹强度（天穹色带 + 海面倒影带）
  const rbA = S.weather.rainbow > 0 ? Math.min(1, S.weather.rainbow / 7) : 0;
  skyU.sky.material.uniforms.uRb.value = rbA * (0.85 + 0.15 * Math.sin(t * 2));
  skyU.oceanMat.uniforms.uRb.value = rbA;
  // 木筏泡沫范围
  let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
  for (const tl of S.raft.tiles.values()) {
    const x = tl.c * W2U, z = tl.r * W2U;
    minx = Math.min(minx, x - 0.5); maxx = Math.max(maxx, x + 0.5);
    minz = Math.min(minz, z - 0.5); maxz = Math.max(maxz, z + 0.5);
  }
  if (minx < maxx) {
    om.uRaftMin.value.set(minx, minz);
    om.uRaftMax.value.set(maxx, maxz);
  }
}

// ---------------- 相机 ----------------
export function orbitDrag(dx, dy) {
  camYaw -= dx * 0.006;
  camPitch = Math.max(0.35, Math.min(1.25, camPitch + dy * 0.004));
}
export function orbitZoom(delta) {
  camDist = Math.max(5, Math.min(20, camDist + delta * 0.01));
}
export function getCamYaw() { return camYaw; }
export function setCamYaw(v) { camYaw = v; }
export function isOrbiting() { return orbiting; }
export function setOrbiting(v) { orbiting = v; }

export function updateCamera(dt) {
  const p = S.player;
  const wx = p.x * W2U, wz = p.y * W2U;
  const ty = p.swimming ? -0.55 : 0.4;
  camTarget.x += (wx - camTarget.x) * Math.min(1, dt * 6);
  camTarget.z += (wz - camTarget.z) * Math.min(1, dt * 6);
  camTarget.y += (ty - camTarget.y) * Math.min(1, dt * 4);
  const distNow = p.swimming ? camDist * 0.75 : camDist;
  const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
  const cx = camTarget.x + Math.sin(camYaw) * cp * distNow;
  const cz = camTarget.z + Math.cos(camYaw) * cp * distNow;
  const cy = camTarget.y + sp * distNow;
  let sx = 0, sy = 0;
  if (S.shakeT > 0 && S.settings.shake) {
    sx = (Math.random() - 0.5) * S.shakeT * 0.8;
    sy = (Math.random() - 0.5) * S.shakeT * 0.8;
  }
  camera.position.set(cx + sx, Math.min(cy, p.swimming ? -0.15 : 99) + (p.swimming ? 0 : 0) + sy, cz);
  if (p.swimming) camera.position.y = Math.min(camera.position.y, -0.12);
  // 视点略抬高：海平线入画，远处天空/彩虹可见
  camera.lookAt(camTarget.x, camTarget.y + 1.5, camTarget.z);
}

// ---------------- 屏幕坐标 → 逻辑世界坐标（水面拾取） ----------------
const raycaster = new THREE.Raycaster();
const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
export function screenToWorld(clientX, clientY) {
  const ndc = new THREE.Vector2(
    (clientX / window.innerWidth) * 2 - 1,
    -(clientY / window.innerHeight) * 2 + 1
  );
  raycaster.setFromCamera(ndc, camera);
  const hit = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(waterPlane, hit)) {
    return { x: hit.x / W2U, y: hit.z / W2U };
  }
  return null;
}

export function render3d() {
  renderer.render(scene, camera);
}
