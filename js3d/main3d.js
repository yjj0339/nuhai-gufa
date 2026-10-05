// ============ 怒海孤筏 3D · 主程序 ============
import { S, bus, toast, dist, ERRS } from '../js/state.js';
import { CFG, TILE, BUILDINGS, SAVE_KEY } from '../js/data.js';
import { initAudio, resumeAudio, updateAmbient, setVolumes } from '../js/audio.js';
import { updateWorld } from '../js/world.js';
import { updateBuildings, place, tileAt, demolish, hasBuilding } from '../js/raft.js';
import { updateSharks, updateGulls, updateFish, updateHook, updateParticles, updateUnderNodes, updateMerchant, updateDolphin, updateVortices, updateWrecks, updateWhale, updateKraken, updateSurvivor, updateCrew } from '../js/entities.js';
import { updatePlayer, doUse, doHookAt, updateIslandNodes, damagePlayer, doAttack } from '../js/player.js';
import { updateFishing } from '../js/fishing.js';
import { initWeather, updateWeather } from '../js/weather.js';
import { updateQuests } from '../js/quests.js';
import { newGame, loadGame, saveGame, hasSave } from '../js/save.js';
import { countItem, startStationCook, craft } from '../js/inv.js';
import { grantXP, buyUpgrade, eff } from '../js/upgrades.js';
import { updateBargain, stopBargain } from '../js/bargain.js';
import { initUI, updateHUD, openPanel, closePanel, tickToasts, setupTouch } from '../js/ui.js';
import { handleWorldTap } from '../js/ui.js';

import { init3d, render3d, updateCamera, setEnvironment, screenToWorld, orbitDrag, orbitZoom, setOrbiting, isOrbiting, loadGLB, getCamYaw, perfTick, skyU, scene, renderer, W2U } from './scene3d.js';
import { initRaft3d, syncRaft3d, updateGhost, raftTileCount3d } from './raft3d.js';
import { syncWorld3d } from './world3d.js';
import { syncSharks3d, syncGulls3d, syncFish3d, syncDolphin3d, syncWhale3d, syncKraken3d, syncMerchant3d, syncVortices3d, syncWrecks3d, syncUnder3d, syncHook3d, syncParticles3d, syncPeople3d, spawnLevelRing3d } from './entities3d.js';
import { initPlayer3d, syncPlayer3d } from './player3d.js';
import { initOverlay, drawOverlay } from './overlay2d.js';

const keys = {};

// ---------------- 菜单 ----------------
function buildMenu() {
  const m = document.createElement('div');
  m.id = 'menu';
  m.innerHTML = `
    <div class="menuCard glass" id="menuCard">
      <h1>🌊 怒海孤筏 <span style="font-size:18px;color:#2bb3a3">3D</span></h1>
      <p class="sub">一钩一板一孤筏，怒海求生见灯塔 · 3D 版</p>
      <button class="primary big" id="btnNew">🆕 新的游戏</button>
      ${hasSave() ? '<button class="primary big ghost" id="btnCont">▶️ 继续游戏</button>' : ''}
      <button class="primary big ghost" id="btnHelpMenu">❓ 玩法说明</button>
      <button class="primary big ghost" id="btn2d">↩️ 返回 2D 版</button>
      <p class="fine">WASD 移动 · 空格动作 · E 使用 · Q 潜水 · 点水面扔钩<br>拖拽旋转视角 · 滚轮缩放 · M 静音 · P 暂停 · 手机：摇杆+按钮</p>
    </div>`;
  document.body.appendChild(m);
  document.body.classList.add('inMenu');
  const start = fn => { document.body.classList.remove('inMenu'); m.remove(); S.mode = 'play'; fn(); };
  m.querySelector('#btnNew').onclick = () => { initAudio(); resumeAudio(); start(() => newGame()); };
  const c = m.querySelector('#btnCont');
  if (c) c.onclick = () => { initAudio(); resumeAudio(); start(() => { if (!loadGame()) newGame(); toast('欢迎回来，船长！', '⛵'); }); };
  m.querySelector('#btn2d').onclick = () => { location.href = '../'; };
  m.querySelector('#btnHelpMenu').onclick = () => {
    m.querySelector('#menuCard').innerHTML = `
      <h1>❓ 玩法说明</h1>
      <div class="helpText left">
      <b>🎯 目标：</b>在海上活下去，扩建木筏，修复无线电找到灯塔岛获救。<br><br>
      <b>⌨️ 电脑：</b>WASD 移动（随视角）· 空格=动作 · E=使用 · Q=潜水/上浮 · 鼠标点水面=扔钩 · 按住拖拽=转视角 · 滚轮=缩放 · B=建造 · 1-6 切工具 · M 静音 · P 暂停<br><br>
      <b>📱 手机：</b>左下摇杆移动 · 右下按钮 · 点水面扔钩 · 单指拖空白处转视角<br><br>
      <b>💡 提示：</b>白天看阳光方向就知道时间；夜里灯柱和营火真的会发光；雾天远处一片白，注意开雷达小地图。
      </div>
      <button class="primary big ghost" id="btnBack">↩️ 返回</button>`;
    m.querySelector('#btnBack').onclick = () => location.reload();
  };
}

function buildEndScreen(kind) {
  const e = document.createElement('div');
  e.id = 'endScreen';
  const rescued = kind === 'ending';
  e.innerHTML = `
    <div class="menuCard glass">
      <h1>${rescued ? '🎉 获救了！' : '💀 你倒下了'}</h1>
      <p class="sub">${rescued ? '灯塔的光穿透风暴，救援船找到了你。' : '怒海无情，但你的故事还远没有结束。'}</p>
      <div class="endStats">
        <div><b>${S.stats.days}</b><span>存活天数</span></div>
        <div><b>${S.stats.collected}</b><span>收集物品</span></div>
        <div><b>${S.stats.fish}</b><span>钓鱼</span></div>
        <div><b>${S.stats.sharkKill + S.stats.bossKill}</b><span>猎鲨</span></div>
        <div><b>${S.stats.krakenKill}</b><span>退海怪</span></div>
        <div><b>${S.letters.length}/12</b><span>信件</span></div>
        <div><b>Lv.${S.level}</b><span>等级</span></div>
        <div><b>${S.stats.islands}</b><span>岛屿</span></div>
        <div><b>${S.stats.sailed | 0}</b><span>航行米</span></div>
      </div>
      <button class="primary big" id="btnRestart">${rescued ? '🌊 继续无尽航行' : '🔁 重新开始'}</button>
    </div>`;
  document.body.appendChild(e);
  e.querySelector('#btnRestart').onclick = () => {
    e.remove();
    if (rescued) { S.mode = 'play'; toast('无尽航行模式：继续经营你的海上家园吧！', '♾️'); }
    else newGame();
  };
}

// ---------------- 输入 ----------------
window.addEventListener('keydown', e => {
  if (e.repeat) return;
  keys[e.code] = true;
  const k = e.key.toLowerCase();
  if (k === 'm' && S.mode === 'play') {
    if (S.settings.sfx > 0 || S.settings.music > 0) {
      S.prevVolumes = { sfx: S.settings.sfx, music: S.settings.music };
      S.settings.sfx = 0; S.settings.music = 0;
      toast('🔇 已静音（按 M 恢复）', '🔇');
    } else if (S.prevVolumes) {
      S.settings.sfx = S.prevVolumes.sfx; S.settings.music = S.prevVolumes.music;
      toast('🔊 声音恢复', '🔊');
    }
    setVolumes();
    return;
  }
  if (k === 'p' && S.mode === 'play') { S.paused = !S.paused; return; }
  if (S.mode !== 'play') { if (e.code === 'Escape' && S.ui.panel) closePanel(); return; }
  if (e.code === 'Space' || k === 'j') { S.input.attack = true; S.input.fishingHold = true; e.preventDefault(); }
  if (k === 'e') { if (S.ui.panel) closePanel(); else S.input.use = true; }
  if (k === 'q') S.input.dive = true;
  if (k === 'b') openPanel('build');
  if (k === 'i' || k === 'r') openPanel('inv');
  if (k === 'escape') { if (S.ui.buildSel) { S.ui.buildSel = null; } else if (S.ui.panel) closePanel(); }
  if (k >= '1' && k <= '6') {
    const order = ['hook', 'spear', 'spear_metal', 'blade', 'hammer', 'rod'];
    S.player.tool = order[+k - 1];
  }
  if (k === 'a') S.input.sailL = true;
  if (k === 'd') S.input.sailR = true;
});
window.addEventListener('keyup', e => {
  keys[e.code] = false;
  const k = e.key.toLowerCase();
  if (e.code === 'Space' || k === 'j') S.input.fishingHold = false;
});

// 指针：拖拽转视角 / 轻点交互
let pDown = null, pDragged = false;
window.addEventListener('pointerdown', e => {
  if (e.target.closest('#ui, #menu, #endScreen')) return;
  pDown = { x: e.clientX, y: e.clientY, id: e.pointerId };
  pDragged = false;
});
window.addEventListener('pointermove', e => {
  if (!pDown || e.pointerId !== pDown.id) return;
  const dx = e.clientX - pDown.x, dy = e.clientY - pDown.y;
  if (!pDragged && Math.hypot(dx, dy) > 8) { pDragged = true; setOrbiting(true); }
  if (pDragged) orbitDrag(dx, dy);
  pDown.x = e.clientX; pDown.y = e.clientY;
});
window.addEventListener('pointerup', e => {
  if (!pDown || e.pointerId !== pDown.id) return;
  setOrbiting(false);
  if (!pDragged && !e.target.closest('#ui, #menu, #endScreen')) {
    handleWorldTap(e);
  }
  pDown = null;
});
window.addEventListener('wheel', e => {
  if (e.target.closest('#ui, #panelWrap')) return;
  orbitZoom(e.deltaY);
}, { passive: true });

// ---------------- 主循环 ----------------
let lastT = performance.now();
let saveAcc = 0, questAcc = 0, mouse = { x: 0, y: 0 };
let ecoAcc = 0;

function loop(nowMs) {
  requestAnimationFrame(loop);
  let dt = (nowMs - lastT) / 1000;
  lastT = nowMs;
  if (dt > 0.08) dt = 0.08;
  // 省电模式：限 30 帧
  if (S.settings.eco30 && S.mode === 'play') {
    ecoAcc += dt;
    if (ecoAcc < 1 / 30) return;
    ecoAcc = 0;
  }
  const playing = S.mode === 'play' && !S.paused;

  if (playing) {
    S.t += dt;
    S.stats.playTime += dt;
    // 键盘移动（相机相对）
    if (!S.isTouch) {
      let mx = 0, my = 0;
      if (keys.KeyW || keys.ArrowUp) my -= 1;
      if (keys.KeyS || keys.ArrowDown) my += 1;
      if (keys.KeyA && S.sailing.raised) S.input.sailL = true;
      if (keys.KeyD && S.sailing.raised) S.input.sailR = true;
      if (keys.KeyA && !S.sailing.raised) mx -= 1;
      if (keys.KeyD && !S.sailing.raised) mx += 1;
      if (keys.ArrowLeft) mx -= 1;
      if (keys.ArrowRight) mx += 1;
      // 相机相对旋转（绕 Y 轴 camYaw）
      if (mx || my) {
        const yaw = getCamYaw();
        const cos = Math.cos(-yaw), sin = Math.sin(-yaw);
        S.input.moveX = mx * cos - my * sin;
        S.input.moveY = mx * sin + my * cos;
      } else if (!S.isTouch) {
        S.input.moveX = 0; S.input.moveY = 0;
      }
    }
    let sailDX = 0, sailDY = 0;
    if (S.sailing.raised && !S.anchor) {
      const spd = eff.sailSpeed() * (0.55 + 0.75 * S.wind.strength);
      sailDX = Math.cos(S.sailing.angle) * spd * dt;
      sailDY = Math.sin(S.sailing.angle) * spd * dt;
    }
    updateWeather(dt);
    updateWorld(dt, sailDX, sailDY);
    updatePlayer(dt);
    updateBuildings(dt);
    updateSharks(dt);
    updateGulls(dt);
    updateFish(dt);
    updateHook(dt);
    updateFishing(dt);
    updateUnderNodes(dt);
    updateIslandNodes(dt);
    updateParticles(dt);
    updateMerchant(dt);
    updateDolphin(dt);
    updateVortices(dt);
    updateWrecks(dt);
    updateWhale(dt);
    updateKraken(dt);
    updateSurvivor(dt);
    updateCrew(dt);
    updateBargain(dt);
    if (S.bargain && S.input.attack) { S.input.attack = false; stopBargain(); }
    updateAmbient(dt);
    questAcc += dt;
    if (questAcc > 1) { questAcc = 0; updateQuests(); }
    saveAcc += dt;
    if (saveAcc > CFG.saveEvery) { saveAcc = 0; saveGame(true); }
    if (S.mode === 'dead' && !document.getElementById('endScreen')) buildEndScreen('dead');
    if (S.mode === 'ending' && !document.getElementById('endScreen')) { saveGame(true); buildEndScreen('ending'); }
  }
  tickToasts(dt);
  perfTick(dt);
  // ===== 同步 3D =====
  setEnvironment(dt, S.t);
  updateCamera(dt);
  syncRaft3d(scene, S.t);
  syncWorld3d(scene, S.t);
  syncSharks3d(scene, S.t);
  syncGulls3d(scene);
  syncFish3d(scene);
  syncDolphin3d(scene, S.t);
  syncWhale3d(scene);
  syncKraken3d(scene, S.t);
  syncMerchant3d(scene, S.t);
  syncVortices3d(scene, S.t);
  syncWrecks3d(scene, S.t);
  syncUnder3d(scene, S.t);
  syncHook3d(scene, S.t);
  syncParticles3d(scene);
  syncPeople3d(scene, S.t);
  syncPlayer3d(S.t);
  // 建造幽灵
  if (S.ui.buildSel && S.mode === 'play' && !S.isTouch) {
    const pt = screenToWorld(mouse.x, mouse.y);
    if (pt) {
      const c = Math.floor(pt.x / TILE), r = Math.floor(pt.y / TILE);
      const chk = _raft.canPlace(S.ui.buildSel, c, r);
      updateGhost({ c, r }, chk.ok);
    }
  } else updateGhost(null);
  render3d();
  drawOverlay({ w: window.innerWidth, h: window.innerHeight });
  if (S.mode === 'play') updateHUD(dt);
}
let _raft = null;

// ---------------- 自测 ----------------
async function selfTest() {
  window.__TEST = { steps: [], errors: [], pass: false };
  const T = window.__TEST;
  const log = (name, ok, extra = '') => { T.steps.push({ name, ok, extra }); console.log(`[TEST] ${ok ? '✅' : '❌'} ${name} ${extra}`); };
  const frame = n => new Promise(r => { let i = 0; const f = () => { if (++i >= n) r(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
  const waitMs = ms => new Promise(r => setTimeout(r, ms));
  try {
    newGame();
    S.mode = 'play';
    await frame(30); // 等 GLB 加载几帧
    log('新游戏启动', S.mode === 'play');
    log('GLB模型加载', (window.__glbLoaded || 0) >= 6, `loaded=${window.__glbLoaded || 0}`);
    log('WebGL渲染', !!renderer && renderer.info.render.calls > 5, `calls=${renderer.info.render.calls}`);
    // 物资
    S.inv.slots[0] = { id: 'wood', n: 60 };
    S.inv.slots[1] = { id: 'plastic', n: 40 };
    S.inv.slots[2] = { id: 'scrap', n: 40 };
    S.inv.slots[3] = { id: 'palm_leaf', n: 40 };
    S.inv.slots[4] = { id: 'cloth', n: 20 };
    S.inv.slots[5] = { id: 'rope', n: 20 };
    log('铺地板', place('floor', 2, 0) && place('floor', 0, 2));
    log('造净水器', place('purifier', -1, 0));
    log('造烤架', place('grill', 0, -1));
    log('造帆', place('sail', 1, 0));
    await waitMs(700);
    log('3D地板网格同步', raftTileCount3d() === 11, `tiles=${raftTileCount3d()}`);
    const { craft } = await import('../js/inv.js');
    log('合成绳索', craft('rope'));
    // 钩子捞取
    const f0 = S.entities.floaters.reduce((a, b) => dist(0, 0, a.x, a.y) < dist(0, 0, b.x, b.y) ? a : b);
    f0.x = 190; f0.y = 0;
    doHookAt(f0.x, f0.y);
    await waitMs(2500);
    log('钩子捞取', !S.entities.floaters.includes(f0));
    // 烹饪
    S.inv.slots[6] = { id: 'fish_sardine', n: 3 };
    log('烤鱼出锅', startStationCook('grill', 'fish_cooked', '0,-1') && (() => { const c = S.cooking['0,-1']; if (c) c.t = c.time; return true; })());
    await frame(3);
    log('烹饪计数', S.stats.cooked >= 1);
    // 钓鱼
    const { startFishing } = await import('../js/fishing.js');
    S.player.tool = 'rod';
    startFishing();
    if (S.fishing) S.fishing.progress = 0.99;
    await frame(3);
    log('钓到鱼', S.stats.fish >= 1);    // 鲨鱼
    const { hitShark } = await import('../js/entities.js');
    S.entities.sharks.push({ x: 60, y: 0, dir: 0, state: 'circle', circT: 99, radius: 100, phase: 0, hp: 1, warnT: 0, lungeT: 0, fleeT: 0, fleeDir: 0, deadT: 0, animT: 0, target: null });
    hitShark(S.entities.sharks[0], 5);
    log('击杀鲨鱼', S.stats.sharkKill === 1);
    // 潜水采集
    S.player.swimming = true; S.player.x = 400; S.player.y = 400; S.player._climbCd = 99;
    const nd = S.underNodes[0];
    S.player.x = nd.x; S.player.y = nd.y;
    doUse();
    log('潜水采集', S.stats.diveTake >= 1);
    S.player.swimming = false;
    // 克拉肯
    const { updateKraken } = await import('../js/entities.js');
    S.krakenTimerDay = S.time.day;
    updateKraken(0.02);
    log('克拉肯降临', !!S.kraken);
    // 天气推进
    for (let i = 0; i < 200; i++) updateWeather(0.1);
    log('天气循环', S.time.day >= 1);
    // 升级/信件
    grantXP(500);
    log('经验升级', S.level >= 3 && S.skillPts >= 1);
    const { grantLetter } = await import('../js/letters.js');
    grantLetter();
    log('信件收集', S.letters.length >= 1);
    // 砍价
    const { spawnMerchant } = await import('../js/entities.js');
    spawnMerchant();
    const { startBargain, stopBargain } = await import('../js/bargain.js');
    startBargain();
    S.bargain.pos = 0.5;
    stopBargain();
    log('砍价成功', S.stats.bargainWins === 1);
    S.entities.merchant = null;
    // 存档
    saveGame(true);
    log('存读档', loadGame());
    // 渲染帧无错误
    await frame(10);
    log('渲染稳定', ERRS.length === 0, `errs=${ERRS.length}`);
    T.pass = T.steps.every(s => s.ok) && ERRS.length === 0;
    T.errors = [...ERRS];
    document.title = (T.pass ? 'TEST-PASS' : 'TEST-FAIL') + ` ${T.steps.filter(s => !s.ok).map(s => s.name).join(',')}`;
    console.log(`[TEST] ${T.pass ? '全部通过' : '有失败'}`, T);
  } catch (e) {
    T.errors.push(String(e && e.stack || e));
    document.title = 'TEST-ERROR ' + (e && e.message);
    console.error('[TEST] 异常', e);
  }
}

// ---------------- 启动 ----------------
async function boot() {
  window.__errs = [];
  window._customWorldTap = true; // 3D 自管点击（拖拽区分）
  window._screenToWorld = screenToWorld;
  initUI();
  setupTouch();
  initOverlay();
  init3d();
  initRaft3d(scene);
  // 预载 GLB 后再建玩家（避免落到兜底占位）
  await Promise.allSettled(['player', 'shark', 'dolphin', 'whale', 'gull', 'fish', 'tentacle', 'palm'].map(loadGLB));
  initPlayer3d(scene);
  _raft = await import('../js/raft.js');
  window.S = S; window.place = place; window.tileAt = tileAt; window.countItem = countItem; window.dist = dist;
  window.scene3d = scene; window.renderer3d = renderer;
  // 画质实时切换
  window.__applyQuality = q => {
    const low = q === 'low';
    renderer.shadowMap.enabled = !low;
    if (skyU && skyU.sun) skyU.sun.castShadow = !low;
    renderer.setPixelRatio(low ? 1 : Math.min(1.35, window.devicePixelRatio || 1));
    scene.traverse(o => { if (o.isMesh && o.material) o.material.needsUpdate = true; });
  };
  // 升级光环
  bus.on('levelup', () => spawnLevelRing3d(scene, S.player.x, S.player.y));
  // 切后台自动存档
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.mode === 'play') saveGame(true); });
  window.doUse = doUse; window.doAttack = doAttack; window.doHookAt = doHookAt; window.damagePlayer = damagePlayer;
  window.startStationCook = startStationCook; window.saveGame = saveGame; window.loadGame = loadGame;
  window.grantXP = grantXP; window.buyUpgrade = buyUpgrade; window.craft = craft;
  buildMenu();
  newGame();
  S.mode = 'menu';
  const params = new URLSearchParams(location.search);
  if (params.get('test') === '1') setTimeout(selfTest, 400);
  requestAnimationFrame(loop);
}
boot();
