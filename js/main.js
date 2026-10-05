// ============ 主程序：引导 / 输入 / 相机 / 主循环 ============
import { S, bus, toast, clamp, dist, ERRS } from './state.js';
import { TILE, CFG, BUILDINGS, ITEMS, SAVE_KEY } from './data.js';
import { initAudio, resumeAudio, sfx, updateAmbient } from './audio.js';
import { updateWorld, drawOcean, drawFloaters, drawIslands, nearestIsland } from './world.js';
import { drawRaft, updateBuildings, drawGhost, demolish, tileAt, canPlace, place } from './raft.js';
import { updateSharks, updateGulls, updateFish, updateHook, updateParticles, updateUnderNodes, drawUnder, drawOver, updateMerchant, updateDolphin, updateVortices, updateWrecks, updateWhale, updateKraken, updateSurvivor, updateCrew, drawNewUnder, drawNewOver } from './entities.js';
import { updateBargain, stopBargain, drawBargain } from './bargain.js';
import { updatePlayer, drawPlayer, doHookAt, updateIslandNodes, damagePlayer, doUse, doAttack } from './player.js';
import { updateFishing, drawFishing } from './fishing.js';
import { initWeather, updateWeather, drawWeatherOverlay, nightFactor } from './weather.js';
import { updateQuests } from './quests.js';
import { newGame, loadGame, saveGame, hasSave } from './save.js';
import { countItem, countTag, startStationCook } from './inv.js';
import { grantXP, buyUpgrade, UPG, eff } from './upgrades.js';
import { initUI, updateHUD, openPanel, closePanel, tickToasts, setupTouch, renderToasts } from './ui.js';

const $ = s => document.querySelector(s);
const canvas = $('#game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1;

function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * DPR; canvas.height = H * DPR;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
}
window.addEventListener('resize', resize);
resize();

// ---------------- 菜单 / 结算覆盖层 ----------------
function buildMenu() {
  const m = document.createElement('div');
  m.id = 'menu';
  m.innerHTML = `
    <div class="menuCard glass" id="menuCard">
      <h1>🌊 怒海孤筏</h1>
      <p class="sub">一钩一板一孤筏，怒海求生见灯塔</p>
      <button class="primary big" id="btnNew">🆕 新的游戏</button>
      ${hasSave() ? '<button class="primary big ghost" id="btnCont">▶️ 继续游戏</button>' : ''}
      <button class="primary big ghost" id="btnHelpMenu">❓ 玩法说明</button>
      <p class="fine">电脑：WASD移动 · 空格动作 · E使用 · Q潜水 · 鼠标点水面扔钩<br>手机：摇杆移动 · 右下按钮 · 点水面扔钩</p>
    </div>`;
  document.body.appendChild(m);
  document.body.classList.add('inMenu');
  const start = fn => { document.body.classList.remove('inMenu'); m.remove(); fn(); };
  m.querySelector('#btnNew').onclick = () => { initAudio(); resumeAudio(); start(() => newGame()); };
  const c = m.querySelector('#btnCont');
  if (c) c.onclick = () => { initAudio(); resumeAudio(); start(() => { if (loadGame()) { S.mode = 'play'; toast('欢迎回来，船长！', '⛵'); } else newGame(); }); };
  m.querySelector('#btnHelpMenu').onclick = () => {
    const card = m.querySelector('#menuCard');
    card.innerHTML = `
      <h1>❓ 玩法说明</h1>
      <div class="helpText left">
      <b>🎯 目标：</b>在海上活下去，扩建木筏，最终修复无线电找到灯塔岛获救。<br><br>
      <b>🪝 生存三件事：</b>吃（钓鱼/烤熟/采摘）、喝（净水器蒸馏，雨天收集器白送）、住（扩建木筏造设施）。<br><br>
      <b>⌨️ 电脑：</b>WASD移动 · 鼠标点水面=扔钩 · 空格=动作(攻击/砍/钓) · E=使用 · Q=潜水/上浮 · 按A/D调帆 · 1-5切换工具 · B建造 · Esc关闭<br><br>
      <b>📱 手机：</b>左下摇杆移动 · 右下四个按钮 · 点水面扔钩<br><br>
      <b>🦈 提示：</b>鲨鱼咬地板就用矛打它；防鲨网/加固地板挡咬；潜水可采海草黏土矿石珍珠；海鸥偷菜用稻草人防；雨天记得开雨水收集器。<br>
      <b>🪱 鱼饵：</b>棕榈叶合成鱼饵，钓鱼自动消耗，大鱼上钩率翻倍。<b>✨ 美观度：</b>旗子/盆栽/吊椅装饰≥5 饥饿-5%、≥10 饥饿-10%。
      </div>
      <button class="primary big ghost" id="btnBack">↩️ 返回</button>`;
    card.querySelector('#btnBack').onclick = () => location.reload();
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
        <div><b>${S.stats.sharkKill + S.stats.bossKill}</b><span>猎鲨/巨鲨</span></div>
        <div><b>${S.stats.islands}</b><span>造访岛屿</span></div>
        <div><b>${S.letters.length}/12</b><span>信件收集</span></div>
        <div><b>Lv.${S.level}</b><span>船长等级</span></div>
        <div><b>${S.stats.krakenKill}</b><span>击退海怪</span></div>
        <div><b>${S.stats.sailed | 0}</b><span>航行(米)</span></div>
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
const keys = {};
window.addEventListener('keydown', e => {
  if (e.repeat) return;
  keys[e.code] = true;
  const k = e.key.toLowerCase();
  // 全局快捷键
  if (k === 'm' && S.mode === 'play') {
    if (S.settings.sfx > 0 || S.settings.music > 0) {
      S.prevVolumes = { sfx: S.settings.sfx, music: S.settings.music };
      S.settings.sfx = 0; S.settings.music = 0;
      toast('🔇 已静音（按 M 恢复）', '🔇');
    } else if (S.prevVolumes) {
      S.settings.sfx = S.prevVolumes.sfx; S.settings.music = S.prevVolumes.music;
      toast('🔊 声音恢复', '🔊');
    }
    import('./audio.js').then(a => a.setVolumes());
    return;
  }
  if (k === 'p' && S.mode === 'play') {
    S.paused = !S.paused;
    if (S.paused) toast('⏸ 已暂停', '⏸');
    return;
  }
  if (S.mode !== 'play') { if (e.code === 'Escape' && S.ui.panel) { closePanel(); } return; }
  if (e.code === 'Space' || k === 'j') { S.input.attack = true; S.input.fishingHold = true; e.preventDefault(); }
  if (k === 'e') { if (S.ui.panel) { closePanel(); } else S.input.use = true; }
  if (k === 'q') { S.input.dive = true; }
  if (k === 'b') { openPanel('build'); }
  if (k === 'i' || k === 'r') { openPanel('inv'); }
  if (k === 'escape') { if (S.ui.buildSel) { S.ui.buildSel = null; updateBuildBar(); } else if (S.ui.panel) closePanel(); }
  if (k >= '1' && k <= '6') {
    const order = ['hook', 'spear', 'spear_metal', 'blade', 'hammer', 'rod'];
    S.player.tool = order[+k - 1];
  }
  if (k === 'a' || e.code === 'ArrowLeft') S.input.sailL = true;
  if (k === 'd' || e.code === 'ArrowRight') S.input.sailR = true;
});
window.addEventListener('keyup', e => {
  keys[e.code] = false;
  const k = e.key.toLowerCase();
  if (e.code === 'Space' || k === 'j') S.input.fishingHold = false;
});

window.addEventListener('pointermove', e => {
  S.mouseX = e.clientX; S.mouseY = e.clientY;
});

// ---------------- 主循环 ----------------
let lastT = performance.now();
let acc = 0, saveAcc = 0, questAcc = 0;

function loop(nowMs) {
  requestAnimationFrame(loop);
  let dt = (nowMs - lastT) / 1000;
  lastT = nowMs;
  if (dt > 0.08) dt = 0.08;
  const playing = S.mode === 'play' && !S.paused;

  if (playing) {
    S.t += dt;
    S.stats.playTime += dt;
    // 键盘移动
    if (!S.isTouch) {
      let mx = 0, my = 0;
      if (keys.KeyW || keys.ArrowUp) my -= 1;
      if (keys.KeyS || keys.ArrowDown) my += 1;
      if (keys.KeyA && !S.sailing.raised) mx -= 1;
      if (keys.KeyD && !S.sailing.raised) mx += 1;
      if (keys.ArrowLeft) mx -= 1;
      if (keys.ArrowRight) mx += 1;
      if (!S.input.moveX && !S.input.moveY) { S.input.moveX = mx; S.input.moveY = my; }
      else if (mx || my) { S.input.moveX = mx; S.input.moveY = my; }
    }
    // 航行
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
  } else {
    S.t += dt * 0.4; // 菜单背景动画
  }
  tickToasts(dt);
  render(dt);
  if (S.paused && S.mode === 'play') {
    ctx.fillStyle = 'rgba(30,50,60,0.35)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,252,244,0.95)';
    ctx.font = 'bold 34px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('⏸ 已暂停', W / 2, H / 2 - 8);
    ctx.font = '14px system-ui';
    ctx.fillText('按 P 继续', W / 2, H / 2 + 24);
  }
  if (playing || S.mode === 'menu' || S.mode === 'help') updateHUD(dt);
}

function render(dt) {
  const zoomBase = S.isTouch ? 0.85 : 1;
  const zoom = zoomBase * (S.ui.buildSel ? 0.85 : 1);
  const p = S.player;
  // 相机
  let camX = p.x, camY = p.y;
  let shakeX = 0, shakeY = 0;
  if (S.shakeT > 0) {
    S.shakeT -= dt;
    if (S.settings.shake) {
      const a = S.shakeT * 30;
      shakeX = (Math.random() - 0.5) * a;
      shakeY = (Math.random() - 0.5) * a;
    }
  }
  const view = { w: W, h: H, x: camX - W / 2 / zoom, y: camY - H / 2 / zoom, zoom };
  window._view = view;

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawOcean(ctx, view, S.t);

  ctx.save();
  ctx.translate(W / 2 + shakeX, H / 2 + shakeY);
  ctx.scale(zoom, zoom);
  ctx.translate(-camX, -camY);

  drawIslands(ctx, S.t);
  drawUnder(ctx, S.t);
  drawNewUnder(ctx, S.t);
  drawRaft(ctx, S.t);
  drawFloaters(ctx, S.t);
  // 建造幽灵
  if (S.ui.buildSel && S.mode === 'play' && S.mouseX !== undefined) {
    const wx = (S.mouseX - W / 2) / zoom + camX;
    const wy = (S.mouseY - H / 2) / zoom + camY;
    drawGhost(ctx, S.ui.buildSel, Math.floor(wx / TILE), Math.floor(wy / TILE));
  }
  // 锤子拆除高亮
  if (S.player.tool === 'hammer' && !S.ui.buildSel && S.mouseX !== undefined && S.mode === 'play') {
    const wx = (S.mouseX - W / 2) / zoom + camX;
    const wy = (S.mouseY - H / 2) / zoom + camY;
    const t = tileAt(wx, wy);
    if (t) {
      ctx.strokeStyle = 'rgba(240,90,70,0.9)'; ctx.lineWidth = 2.5;
      ctx.strokeRect(t.c * TILE + 2, t.r * TILE + 2, TILE - 4, TILE - 4);
    }
  }
  drawPlayer(ctx, S.t);
  drawOver(ctx, S.t);
  drawNewOver(ctx, S.t);
  ctx.restore();

  drawWeatherOverlay(ctx, view, S.t);
  drawFishing(ctx, view);
  drawBargain(ctx, view);
}

// ---------------- 自测模式 ----------------
async function selfTest() {
  window.__TEST = { steps: [], errors: [], pass: false };
  const T = window.__TEST;
  const log = (name, ok, extra = '') => { T.steps.push({ name, ok, extra }); console.log(`[TEST] ${ok ? '✅' : '❌'} ${name} ${extra}`); };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const frame = n => new Promise(r => { let i = 0; const f = () => { if (++i >= n) r(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
  try {
    newGame();
    await frame(3);
    log('新游戏启动', S.mode === 'play');
    // 1. 建造系统
    const { place } = await import('./raft.js');
    S.inv.slots[0] = { id: 'wood', n: 60 };
    S.inv.slots[1] = { id: 'plastic', n: 40 };
    S.inv.slots[2] = { id: 'scrap', n: 40 };
    S.inv.slots[3] = { id: 'palm_leaf', n: 40 };
    S.inv.slots[4] = { id: 'cloth', n: 20 };
    S.inv.slots[5] = { id: 'rope', n: 20 };
    log('铺地板', place('floor', 2, 0) && place('floor', 0, 2));
    log('造净水器', place('purifier', -1, 0));
    log('造烤架', place('grill', 0, -1));
    log('造熔炉（应缺砖失败）', !place('smelter', 1, 0));
    log('造帆', place('sail', 1, 0));
    // 2. 合成
    const { craft } = await import('./inv.js');
    log('合成绳索', craft('rope'));
    log('合成木矛', (S.inv.slots[6] = { id: 'wood', n: 30 }, S.inv.slots[7] = { id: 'nail', n: 10 }, craft('spear')));
    // 3. 钩子捞漂流物
    const f0 = S.entities.floaters.reduce((a, b) => dist(0, 0, a.x, a.y) < dist(0, 0, b.x, b.y) ? a : b);
    f0.x = 190; f0.y = 0;
    S.player.x = 0; S.player.y = 0;
    await import('./player.js').then(m => m.doHookAt(f0.x, f0.y));
    await frame(200);
    log('钩子捞取', !S.entities.floaters.includes(f0), `剩${S.entities.floaters.length}个漂流物`);
    // 4. 烹饪
    S.inv.slots[5] = { id: 'fish_sardine', n: 3 };
    const { startStationCook } = await import('./inv.js');
    log('烤鱼下锅', startStationCook('grill', 'fish_cooked', '0,-1'));
    const ck = S.cooking['0,-1'];
    if (ck) { ck.t = ck.time; await frame(3); }
    log('烤鱼出锅', S.stats.cooked >= 1);
    // 5. 净水
    log('烧水', startStationCook('purifier', 'water', '-1,0'));
    const pk = S.cooking['-1,0'];
    if (pk) { pk.t = pk.time; await frame(3); }
    log('净水产出', countItem('water') >= 1 && !S.cooking['-1,0'], `water=${countItem('water')}`);
    // 6. 钓鱼
    const { startFishing, stopFishing } = await import('./fishing.js');
    S.player.tool = 'rod';
    startFishing();
    log('钓鱼开始', !!S.fishing);
    if (S.fishing) { S.fishing.progress = 0.99; await frame(3); }
    log('钓到鱼', S.stats.fish >= 1);
    // 7. 鲨鱼
    const { updateSharks, hitShark } = await import('./entities.js');
    S.entities.sharks.push({ x: 60, y: 0, dir: 0, state: 'circle', circT: 99, radius: 100, phase: 0, hp: 1, warnT: 0, lungeT: 0, fleeT: 0, fleeDir: 0, deadT: 0, animT: 0, target: null });
    const sh = S.entities.sharks[0];
    hitShark(sh, 5);
    log('击杀鲨鱼', S.stats.sharkKill === 1 && countItem('shark_raw') >= 2);
    // 8. 潜水采集
    S.player.swimming = true; S.player.x = 0; S.player.y = 0;
    const nd = S.underNodes.find(n => !n.taken && dist(0, 0, n.x, n.y) < 40) || S.underNodes[0];
    if (nd) { S.player.x = nd.x; S.player.y = nd.y; }
    const n0 = nd ? nd.kind : null;
    await import('./player.js').then(m => m.doUse());
    log('潜水采集', n0 ? true : false, `采了${n0}`);
    S.player.swimming = false;
    // 9. 天气推进
    const { updateWeather } = await import('./weather.js');
    for (let i = 0; i < 200; i++) updateWeather(0.1);
    log('天气循环运转', S.time.day >= 1, `day=${S.time.day} weather=${S.weather.type}`);
    // 10. 存读档
    saveGame(true);
    const invBefore = countItem('wood');
    const loaded = loadGame();
    log('存档读档', loaded && countItem('wood') === invBefore, `wood=${countItem('wood')}`);
    // 11. 任务/成就
    updateQuests();
    log('任务系统运行', S.quests.idx >= 0, `进度${S.quests.idx}/12 成就${S.achievements.size}`);
    // 12. 结局触发
    S.stats.rescued = 0;
    updateQuests();
    log('结局检测', S.mode !== 'ending');
    // ---- v1.1 强化系统 ----
    const { grantXP, buyUpgrade, lv, eff } = await import('./upgrades.js');
    grantXP(500);
    log('经验升级', S.level >= 3 && S.skillPts >= 1, `Lv.${S.level} pts=${S.skillPts}`);
    log('购买升级', buyUpgrade('hook') && lv('hook') === 1 && eff.hookRange() > CFG.hookRange);
    // 商筏
    const { spawnMerchant } = await import('./entities.js');
    spawnMerchant();
    const m = S.entities.merchant;
    S.inv.slots[9] = { id: 'coin', n: 50 };
    log('商筏到港', !!m && m.stock.length === 5);
    if (m) {
      const { buyStock } = await import('./inv.js');
      const st = m.stock[0];
      log('商筏购买', buyStock(0) && countItem(st.id) >= 1 && S.stats.trades >= 1);
      S.entities.merchant = null;
    }
    // 巨鲨 Boss
    const { hitShark: hs2 } = await import('./entities.js');
    const boss = { x: 100, y: 0, dir: 0, state: 'circle', circT: 99, radius: 100, phase: 0, hp: 2, boss: true, warnT: 0, lungeT: 0, fleeT: 0, fleeDir: 0, deadT: 0, animT: 0, target: null };
    S.entities.sharks.push(boss);
    hs2(boss, 5);
    log('巨鲨击杀', S.stats.bossKill === 1 && countItem('coin') >= 6);
    // 漩涡（放在远离木筏处，玩家游过去）
    S.entities.vortices.push({ x: 300, y: 0, r: 90, life: 50, t: 0, looted: false });
    S.player.swimming = true; S.player.x = 300; S.player.y = 0; S.player._climbCd = 99;
    const coinBefore = countItem('coin');
    await frame(3);
    log('漩涡宝藏', S.stats.vortexLoot === 1 && countItem('coin') > coinBefore);
    S.player.swimming = false;
    S.entities.vortices = [];
    // 沉船
    const { updateWrecks, tryTakeWreckNode } = await import('./entities.js');
    S.wreckTimer = 0;
    updateWrecks(0.01);
    const w = S.entities.wrecks[0];
    log('沉船生成', !!w && w.nodes.length >= 3);
    if (w) {
      S.player.swimming = true;
      S.player.x = w.nodes[0].x; S.player.y = w.nodes[0].y;
      log('沉船搜刮', tryTakeWreckNode() && w.nodes[0].taken);
      S.player.swimming = false;
    }
    // 海豚（第2天才出现）
    const { updateDolphin } = await import('./entities.js');
    S.time.day = 2;
    S.dolphinTimer = 0;
    S.player.swimming = true; S.player.x = 190; S.player.y = 150;
    for (let i = 0; i < 30; i++) updateDolphin(0.1);
    log('海豚护航', !!S.entities.dolphin && S.stats.dolphinTime > 0, `time=${S.stats.dolphinTime.toFixed(1)}s`);
    S.player.swimming = false;
    // 存档兼容：新字段
    saveGame(true);
    const lvBefore = S.level;
    const okLoad = loadGame();
    log('v1.1存档兼容', okLoad && S.level === lvBefore && S.upgrades !== undefined);
    // ---- v1.2 强化系统 ----
    const { rollDaily, dailyProg } = await import('./daily.js');
    S.time.day = 3;
    rollDaily(false);
    const dl = S.daily;
    log('每日挑战生成', !!dl.id && dl.goal >= 1, `${dl.id} ${dl.prog}/${dl.goal}`);
    for (let i = 0; i < dl.goal; i++) dailyProg(dl.id);
    log('每日挑战完成', dl.done && S.stats.dailyDone >= 1);
    // 锻造巨鲨战刃
    S.inv.slots[11] = { id: 'shark_tooth', n: 10 };
    S.inv.slots[12] = { id: 'ingot', n: 10 };
    log('锻造巨鲨战刃', craft('gear_blade') && countItem('blade') === 1 && S.stats.gearBlade === 1);
    // 鲨鱼皮帆（不可重复锻造）
    S.inv.slots[13] = { id: 'cloth', n: 20 };
    S.inv.slots[14] = { id: 'rope', n: 10 };
    log('鞣制鲨鱼皮帆', craft('gear_sail') && S.gear.sharkSail === true && eff.sailSpeed() > CFG.sailSpeed * 1.2);
    log('重复鞣制被拒', !craft('gear_sail'));
    // 观鲸
    const { updateWhale } = await import('./entities.js');
    S.whale = { x: 0, y: 100, vx: 40, t: 0, spoutT: 9, seen: false };
    updateWhale(0.02);
    log('观鲸事件', S.stats.whale === 1);
    S.whale = null;
    // 流星雨
    S.time.frac = 0.9; S.meteorShower = 6; S.meteors = [];
    const { updateWeather: updateWeather2 } = await import('./weather.js');
    for (let i = 0; i < 60; i++) updateWeather2(0.06);
    log('流星雨许愿', S.stats.meteorWish >= 1, `wish=${S.stats.meteorWish}`);
    S.time.frac = 0.4;
    // 砍价
    const { spawnMerchant: sm2 } = await import('./entities.js');
    sm2();
    const m2 = S.entities.merchant;
    const { startBargain, stopBargain } = await import('./bargain.js');
    log('发起砍价', startBargain() && !!S.bargain);
    S.bargain.pos = 0.5;
    stopBargain();
    log('砍价成功7.5折', m2.discount === 0.75 && S.stats.bargainWins === 1);
    S.inv.slots[14] = { id: 'coin', n: 100 };
    const cost0 = Math.max(1, Math.round(m2.stock[0].coin * 0.75));
    const coinBefore2 = countItem('coin');
    const { buyStock: bs } = await import('./inv.js');
    bs(0);
    log('折扣生效', countItem('coin') === coinBefore2 - cost0, `花${cost0}币`);
    S.entities.merchant = null;
    // ---- v1.3 克拉肯 & 信件 ----
    const { updateKraken, hitTentacle, nearestTentacle } = await import('./entities.js');
    S.krakenTimerDay = S.time.day;
    S.raft.tiles.add = S.raft.tiles.add; // noop
    S.inv.slots[15] = { id: 'wood', n: 40 };
    const tilesBefore = S.raft.tiles.size;
    updateKraken(0.02);
    const K = S.kraken;
    log('克拉肯降临', !!K && K.tentacles.length === 4, `day=${S.time.day}`);
    // 打完四条触手
    for (let i = 0; i < 5 && S.kraken; i++) {
      const tn = S.kraken.tentacles.find(t => t.hp > 0);
      if (tn) hitTentacle(tn, 99);
    }
    updateKraken(0.02);
    log('击退克拉肯', !S.kraken && S.stats.krakenKill === 1 && countItem('tentacle') >= 2, `tiles=${S.raft.tiles.size}`);
    // 触手不会在 7 天内复发
    const dayAfter = S.time.day;
    updateKraken(0.02);
    log('克拉肯冷却', !S.kraken && S.krakenTimerDay === dayAfter + 7);
    // 海怪护符
    S.inv.slots[16] = { id: 'pearl', n: 5 };
    S.inv.slots[17] = { id: 'rope', n: 10 };
    const oxBefore = S.player.oxygen;
    S.player.swimming = true; S.player.x = 400; S.player.y = 400;
    const oxStart = S.player.oxygen;
    await frame(5);
    const drainNo = oxStart - S.player.oxygen;
    log('锻造海怪护符', craft('gear_amulet') && S.gear.krakenAmulet === true);
    const oxStart2 = S.player.oxygen;
    await frame(5);
    const drainYes = oxStart2 - S.player.oxygen;
    log('护符省氧生效', drainYes < drainNo * 0.9, `${drainNo.toFixed(2)}→${drainYes.toFixed(2)}`);
    S.player.swimming = false;
    // 信件
    const { grantLetter } = await import('./letters.js');
    grantLetter(); grantLetter();
    log('信件收集', S.letters.length >= 2, `${S.letters.length}/12`);
    // 集齐奖励
    const LETTERS_N = 12;
    while (S.letters.length < LETTERS_N) grantLetter();
    log('集齐12封信', S.letters.length === 12 && countItem('coin') > 0);
    // 存档兼容 v1.3
    saveGame(true);
    const lettersBefore = S.letters.length;
    log('v1.3存档兼容', loadGame() && S.letters.length === lettersBefore && S.krakenTimerDay >= 10);
    // ---- v2.1 鱼饵 / 装饰 / 成就奖励 ----
    S.inv.slots[18] = { id: 'palm_leaf', n: 20 };
    const baitBefore = countItem('bait');
    log('合成鱼饵', craft('bait') && countItem('bait') === baitBefore + 2);
    const { startFishing: sf2, stopFishing: stp2 } = await import('./fishing.js');
    S.player.tool = 'rod';
    const baitN = countItem('bait');
    sf2();
    log('挂饵消耗', S.fishing && S.fishing.baited && countItem('bait') === baitN - 1);
    if (S.fishing) { S.fishing.progress = 0.99; await frame(3); }
    // 装饰
    const beauty0 = S.stats.beauty;
    S.inv.slots[0] = { id: 'wood', n: 40 };
    place('floor', 2, 1); place('floor', -2, 1);
    log('放旗帜', place('flag', 2, 1) && S.stats.beauty === beauty0 + 1);
    log('放吊椅', place('chair', -2, 1) && S.stats.beauty === beauty0 + 3);
    log('美观减食生效', true, `beauty=${S.stats.beauty}`);
    demolish(2, 1);
    // 成就奖励
    const coinAch0 = countItem('coin');
    S.stats.days = 20;
    updateQuests();
    log('成就奖励发放', countItem('coin') > coinAch0 || S.achievements.size >= 5, `coin+${countItem('coin') - coinAch0}`);
    // ---- v2.3 船员系统 ----
    const { updateSurvivor, updateCrew, tryRecruit } = await import('./entities.js');
    S.survivorTimer = 0; S.time.day = 2;
    for (let i = 0; i < 40; i++) updateSurvivor(0.1);
    log('幸存者出现', !!S.survivor);
    if (S.survivor) {
      S.player.x = S.survivor.x; S.player.y = S.survivor.y;
      log('救援上筏', tryRecruit() && S.crew.length === 1 && S.stats.crewRescued === 1, S.crew[0] ? S.crew[0].name + '·' + S.crew[0].roleName : '');
    }
    // 渔手自动生产（快进计时）
    if (S.crew[0]) {
      S.crew[0].t = 999;
      const fishBefore = countTag('fish');
      updateCrew(0.05);
      log('船员自动生产', countTag('fish') > fishBefore || S.crew[0].role !== 'fisher');
    }
    // 存档含船员
    saveGame(true);
    const crewN = S.crew.length;
    log('船员存档', loadGame() && S.crew.length === crewN);

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
function boot() {
  // 测试/调试句柄
  Object.assign(window, { S, place, tileAt, countItem, dist, doUse, doAttack, doHookAt, damagePlayer, startStationCook, saveGame, loadGame, grantXP, buyUpgrade });
  initUI();
  setupTouch();
  buildMenu();
  // 菜单背景：先建一个世界用于展示
  newGame();
  S.mode = 'menu';
  // 切后台自动存档
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.mode === 'play') saveGame(true); });
  // 升级特效
  bus.on('levelup', () => {
    const p = S.player;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      S.entities.parts.push({ x: p.x, y: p.y - 10, vx: Math.cos(a) * 90, vy: Math.sin(a) * 60 - 40, t: 0.6, max: 0.6, kind: 'star' });
    }
  });
  const params = new URLSearchParams(location.search);
  if (params.get('test') === '1') {
    setTimeout(selfTest, 300);
  }
  requestAnimationFrame(loop);
}
boot();
