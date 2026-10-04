// ============ UI：HUD / 面板 / 手机操控 ============
import { S, bus, toast, clamp, fmtTime } from './state.js';
import { ITEMS, RECIPES, BUILDINGS, STATION_RECIPES, QUESTS, ACHIEVEMENTS, CFG, TILE, SELL_PRICES } from './data.js';
import { countItem, countTag, craft, startStationCook, addItem, buyStock, sellItem } from './inv.js';
import { canPlace, place, hasBuilding, findBuilding } from './raft.js';
import { nearestIsland } from './world.js';
import { consumeItem } from './player.js';
import { UPG, lv, xpNeed } from './upgrades.js';
import { saveGame, hasSave } from './save.js';
import { WEATHER_NAMES, nightFactor } from './weather.js';
import { currentQuest } from './quests.js';
import { sfx, setVolumes, initAudio, resumeAudio } from './audio.js';

const $ = s => document.querySelector(s);
const TOOL_ORDER = ['hook', 'spear', 'spear_metal', 'hammer', 'rod'];

export function initUI() {
  const root = $('#ui');
  root.innerHTML = `
  <div id="toasts"></div>
  <div id="statPanel" class="glass">
    <div class="barRow"><span class="ico">❤️</span><div class="bar"><i id="barHp" style="background:#F0655A"></i></div><b id="txtHp"></b></div>
    <div class="barRow"><span class="ico">🍗</span><div class="bar"><i id="barHunger" style="background:#F2A24A"></i></div><b id="txtHunger"></b></div>
    <div class="barRow"><span class="ico">💧</span><div class="bar"><i id="barThirst" style="background:#4AB8E8"></i></div><b id="txtThirst"></b></div>
    <div class="barRow"><span class="ico">⭐</span><div class="bar"><i id="barXp" style="background:#B886E8"></i></div><b id="txtXp"></b></div>
    <div id="envRow"><span id="txtDay">📅</span><span id="txtClock"></span><span id="txtWeather"></span><span id="txtWind"></span></div>
  </div>
  <div id="questTracker" class="glass"></div>
  <div id="topRight">
    <div id="menuBtns" class="glass">
      <button data-a="inv" title="背包">🎒</button>
      <button data-a="craft" title="合成">🛠️</button>
      <button data-a="build" title="建造">🏗️</button>
      <button data-a="upg" title="升级">⭐</button>
      <button data-a="quests" title="任务">📜</button>
      <button data-a="achv" title="成就">🏆</button>
      <button data-a="map" title="海图">🗺️</button>
      <button data-a="stats" title="统计">📊</button>
      <button data-a="help" title="帮助">❓</button>
      <button data-a="settings" title="设置">⚙️</button>
    </div>
    <canvas id="minimap" width="150" height="150" class="glass"></canvas>
  </div>
  <div id="hotbar" class="glass"></div>
  <div id="dockHint" class="glass" style="display:none"></div>
  <div id="buildBar" class="glass" style="display:none">
    <span id="buildName"></span>
    <button data-a="buildCancel">取消(Esc)</button><button data-a="buildRotate" style="display:none"></button>
  </div>
  <div id="actionBtns">
    <button id="btnUse" data-a="use">✋<small>使用</small></button>
    <button id="btnAtk" data-a="attack">⚔️<small>动作</small></button>
    <button id="btnHook" data-a="hook">🪝<small>钩子</small></button>
    <button id="btnDive" data-a="dive">🤿<small>潜/爬</small></button>
  </div>
  <div id="joystick" style="display:none"><div id="joyKnob"></div></div>
  <div id="panelWrap" style="display:none"><div id="panel" class="glass"></div></div>
  `;

  // 事件委托
  root.addEventListener('click', e => {
    const btn = e.target.closest('[data-a]');
    if (!btn) return;
    const a = btn.dataset.a;
    handleAction(a, btn);
  });
  root.addEventListener('pointerdown', e => {
    // 面板内不处理世界点击
    if (e.target.closest('#panelWrap, #topRight, #statPanel, #hotbar, #menuBtns, #actionBtns, #joystick, #buildBar, #questTracker')) return;
    handleWorldTap(e);
  }, true);
  bus.on('inv', () => { renderHotbar(); if (S.ui.panel) renderPanel(); });
  bus.on('toast', () => renderToasts());
  bus.on('openStation', () => openPanel('station'));
  bus.on('openPanel', name => openPanel(name));
  setInterval(() => { if (S.ui.panel) renderPanel(); }, 700);

  renderHotbar();
}

// ---------------- 动作分发 ----------------
export function handleAction(a, btn) {
  initAudio(); resumeAudio();
  switch (a) {
    case 'inv': openPanel('inv'); break;
    case 'craft': openPanel('craft'); break;
    case 'build': openPanel('build'); break;
    case 'quests': openPanel('quests'); break;
    case 'achv': openPanel('achv'); break;
    case 'map': openPanel('map'); break;
    case 'help': openPanel('help'); break;
    case 'settings': openPanel('settings'); break;
    case 'upg': openPanel('upg'); break;
    case 'stats': openPanel('stats'); break;
    case 'buildCancel': S.ui.buildSel = null; updateBuildBar(); break;
    case 'use': S.input.use = true; break;
    case 'attack': S.input.attack = true; S.input.fishingHold = true; break;
    case 'hook': S.input.hook = true; break;
    case 'dive': S.input.dive = true; break;
    default:
      if (a.startsWith('tool:')) selectTool(a.slice(5));
      else if (a.startsWith('eat:')) { consumeItem(+a.slice(4)); if (S.ui.panel) renderPanel(); }
      else if (a.startsWith('craft:')) { craft(a.slice(6)); renderPanel(); }
      else if (a.startsWith('buildSel:')) { S.ui.buildSel = a.slice(9); openPanel(null); updateBuildBar(); }
      else if (a.startsWith('cook:')) cookAction(a.slice(5), btn);
      else if (a.startsWith('panel:')) openPanel(a.slice(6));
      else if (a.startsWith('buyUpg:')) { buyUpgrade(a.slice(7)); renderPanel(); }
      else if (a.startsWith('buyStock:')) { buyStock(+a.slice(9)); renderPanel(); }
      else if (a.startsWith('sellItem:')) { sellItem(a.slice(9)); renderPanel(); }
      else if (a.startsWith('setSfx:')) { S.settings.sfx = +a.slice(7); setVolumes(); renderPanel(); }
      else if (a.startsWith('setMus:')) { S.settings.music = +a.slice(7); setVolumes(); renderPanel(); }
      else if (a.startsWith('setQual:')) { S.settings.quality = a.slice(8); renderPanel(); }
      else if (a === 'toggleShake') { S.settings.shake = !S.settings.shake; renderPanel(); }
      else if (a === 'saveNow') { saveGame(); renderPanel(); }
      else if (a === 'toStorage') { moveItem(+btn.dataset.idx, 'to'); renderPanel(); }
      else if (a === 'fromStorage') { moveItem(+btn.dataset.idx, 'from'); renderPanel(); }
      break;
  }
}

// ---------------- 商店面板由 inv.js 提供交易逻辑 ----------------

function cookAction(pair, btn) {
  const [bkey, recipeId] = pair.split('|');
  const st = S.ui.stationOpen;
  if (!st) return;
  startStationCook(st.type, recipeId, bkey);
  renderPanel();
}
function selectTool(id) {
  if (countItem(id) <= 0 && id !== 'hook') { toast('还没有这件工具，去合成台做吧', '⚠️'); return; }
  S.player.tool = id;
  renderHotbar();
  sfx.open();
}
function moveItem(idx, dir) {
  const pool = dir === 'to' ? S.inv.slots : S.storage;
  const other = dir === 'to' ? S.storage : S.inv.slots;
  const s = pool[idx];
  if (!s) return;
  // 找目标空位
  let moved = false;
  for (let i = 0; i < other.length; i++) {
    const t = other[i];
    if (t && t.id === s.id && t.n < ITEMS[s.id].stack) {
      const add = Math.min(ITEMS[s.id].stack - t.n, s.n);
      t.n += add; s.n -= add;
      if (s.n <= 0) { pool[idx] = null; moved = true; break; }
    }
  }
  if (!moved) {
    for (let i = 0; i < other.length; i++) {
      if (!other[i]) { other[i] = s; pool[idx] = null; moved = true; break; }
    }
  }
  if (!moved) toast('那边满了！', '😢');
  sfx.open();
  bus.emit('inv');
}

// ---------------- 世界点击（钩子投掷 / 建造放置） ----------------
function handleWorldTap(e) {
  if (S.mode !== 'play') return;
  const view = window._view;
  if (!view) return;
  const wx = (e.clientX - view.w / 2) / view.zoom + view.x;
  const wy = (e.clientY - view.h / 2) / view.zoom + view.y;
  if (S.ui.buildSel) {
    const c = Math.floor(wx / TILE), r = Math.floor(wy / TILE);
    if (place(S.ui.buildSel, c, r)) bus.emit('inv');
    return;
  }
  // 锤子拆除
  if (S.player.tool === 'hammer' && !S.player.swimming) {
    import('./raft.js').then(m => {
      const t = m.tileAt(wx, wy);
      if (t) m.demolish(t.c, t.r);
    });
    return;
  }
  // 扔钩
  S.player.dir = Math.atan2(wy - S.player.y, wx - S.player.x);
  doHookAtSafe(wx, wy);
}
function doHookAtSafe(wx, wy) {
  import('./player.js').then(m => m.doHookAt(wx, wy));
}

// ---------------- HUD 刷新 ----------------
export function updateHUD() {
  const p = S.player;
  $('#barHp').style.width = p.hp + '%';
  $('#barHunger').style.width = p.hunger + '%';
  $('#barThirst').style.width = p.thirst + '%';
  $('#barXp').style.width = Math.min(100, S.xp / xpNeed(S.level) * 100) + '%';
  $('#txtHp').textContent = Math.ceil(p.hp);
  $('#txtHunger').textContent = Math.ceil(p.hunger);
  $('#txtThirst').textContent = Math.ceil(p.thirst);
  $('#txtXp').textContent = `Lv.${S.level}`;
  $('#txtDay').textContent = `📅 第${S.time.day}天`;
  $('#txtClock').textContent = fmtTime(S.time.frac);
  $('#txtWeather').textContent = WEATHER_NAMES[S.weather.type] + (S.sailing.raised ? ' ⛵' : S.anchor ? ' ⚓' : '');
  const dirs = ['东', '东南', '南', '西南', '西', '西北', '北', '东北'];
  const d8 = Math.round(((S.wind.dir + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
  $('#txtWind').textContent = `🌬️ ${dirs[d8]}风 ${(S.wind.strength * 100 | 0)}%`;
  // 任务追踪
  const q = currentQuest();
  $('#questTracker').innerHTML = q ? `<b>📜 ${q.name}</b><span>${q.desc}</span>` : `<b>🎉 主线已全部完成</b>`;
  $('#btnDive').innerHTML = p.swimming ? '🧗<small>上浮</small>' : '🤿<small>潜/爬</small>';
  // 靠岛提示
  const near = nearestIsland();
  const dockHint = $('#dockHint');
  if (near) {
    const d = Math.hypot(near.x, near.y) - near.r;
    if (d < 160 && !near.visited && !p.swimming) {
      dockHint.style.display = '';
      dockHint.innerHTML = `🏝️ 靠近 ${near.type === 'lighthouse' ? '灯塔岛' : '岛屿'}！游过去即可登岛`;
    } else dockHint.style.display = 'none';
  } else dockHint.style.display = 'none';
  drawMinimap();
  // 摇杆显隐
  const joy = $('#joystick');
  joy.style.display = S.isTouch ? 'block' : 'none';
  $('#actionBtns').style.display = S.isTouch ? 'flex' : 'none';
}

function drawMinimap() {
  const cv = $('#minimap');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const scale = 150 / 3000; // 世界±1500
  ctx.fillStyle = '#BDEDE6';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#8FD8CE';
  for (let i = 0; i < 8; i++) ctx.fillRect(0, (i * 37 + (S.t * 6) % 37) % H, W, 2);
  // 岛屿
  for (const isl of S.islands) {
    const x = W / 2 + isl.x * scale, y = H / 2 + isl.y * scale;
    if (x < -10 || x > W + 10 || y < -10 || y > H + 10) continue;
    ctx.fillStyle = isl.type === 'lighthouse' ? '#E8D44A' : '#E8D8A0';
    ctx.beginPath(); ctx.arc(x, y, Math.max(3, isl.r * scale * 1.2), 0, 6.29); ctx.fill();
    ctx.strokeStyle = isl.visited ? '#8AA' : '#666';
    ctx.stroke();
    if (isl.type === 'lighthouse') { ctx.fillStyle = '#B8860B'; ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'center'; ctx.fillText('灯塔', x, y - 6); }
  }
  // 漂流物
  ctx.fillStyle = 'rgba(60,90,110,0.7)';
  for (const f of S.entities.floaters) {
    ctx.fillRect(W / 2 + f.x * scale - 1, H / 2 + f.y * scale - 1, 2.4, 2.4);
  }
  // 漩涡/沉船/商筏标记
  for (const v of S.entities.vortices) {
    ctx.fillStyle = '#7A4AB8';
    ctx.beginPath(); ctx.arc(W / 2 + v.x * scale, H / 2 + v.y * scale, 4, 0, 6.29); ctx.fill();
  }
  for (const w of S.entities.wrecks) {
    if (w.done) continue;
    ctx.fillStyle = '#5A4430';
    ctx.fillRect(W / 2 + w.x * scale - 2, H / 2 + w.y * scale - 2, 4, 4);
  }
  const mc = S.entities.merchant;
  if (mc) {
    ctx.fillStyle = '#E8B84A';
    ctx.beginPath(); ctx.arc(W / 2 + mc.x * scale, H / 2 + mc.y * scale, 4.5, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#4A3A10'; ctx.font = 'bold 7px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('商', W / 2 + mc.x * scale, H / 2 + mc.y * scale + 2.5);
  }
  // 木筏
  ctx.fillStyle = '#C0554A';
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 4, 0, 6.29); ctx.fill();
  // 风向
  ctx.strokeStyle = '#4A7A8A'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(W / 2, H / 2);
  ctx.lineTo(W / 2 + Math.cos(S.wind.dir) * 18, H / 2 + Math.sin(S.wind.dir) * 18); ctx.stroke();
}

// ---------------- 热键栏 ----------------
function renderHotbar() {
  const hb = $('#hotbar');
  if (!hb) return;
  let html = '';
  for (const id of TOOL_ORDER) {
    const own = countItem(id) > 0;
    const sel = S.player.tool === id;
    html += `<button class="hslot ${sel ? 'sel' : ''} ${own ? '' : 'dim'}" data-a="tool:${id}" title="${ITEMS[id].name}">${ITEMS[id].emoji}</button>`;
  }
  // 快捷食物：背包里的前2个食物
  let shown = 0;
  for (let i = 0; i < S.inv.slots.length && shown < 2; i++) {
    const s = S.inv.slots[i];
    if (s && ITEMS[s.id].type === 'food') {
      html += `<button class="hslot food" data-a="eat:${i}" title="${ITEMS[s.id].name}">${ITEMS[s.id].emoji}<b>${s.n}</b></button>`;
      shown++;
    }
  }
  hb.innerHTML = html;
}

// ---------------- 面板 ----------------
export function openPanel(name) {
  S.ui.panel = name === S.ui.panel ? null : name;
  if (name === 'build' && S.ui.panel === 'build') S.ui.buildSel = null;
  const wrap = $('#panelWrap');
  wrap.style.display = S.ui.panel ? '' : 'none';
  if (S.ui.panel) { sfx.open(); renderPanel(); }
  updateBuildBar();
}
export function closePanel() {
  S.ui.panel = null;
  $('#panelWrap').style.display = 'none';
  updateBuildBar();
}
export function updateBuildBar() {
  const bar = $('#buildBar');
  if (S.ui.buildSel && S.mode === 'play') {
    bar.style.display = '';
    $('#buildName').innerHTML = `${BUILDINGS[S.ui.buildSel].emoji} 正在建造：<b>${BUILDINGS[S.ui.buildSel].name}</b> — 点击地面放置`;
  } else bar.style.display = 'none';
}

function itemSlot(s, actionAttr, extraCls = '') {
  if (!s) return `<div class="slot empty ${extraCls}"></div>`;
  const def = ITEMS[s.id];
  return `<div class="slot ${extraCls}" data-a="${actionAttr}" title="${def.name}｜${def.desc || ''}">
    <span class="em">${def.emoji}</span>${s.n > 1 ? `<b>${s.n}</b>` : ''}</div>`;
}

function costHtml(cost) {
  let html = '';
  for (const [id, n] of Object.entries(cost)) {
    const have = id === 'fish' ? countTag('fish') : countItem(id);
    const name = id === 'fish' ? '任意鱼' : ITEMS[id].name;
    const em = id === 'fish' ? '🐟' : ITEMS[id].emoji;
    html += `<span class="cost ${have >= n ? 'ok' : 'lack'}">${em}${have}/${n}</span>`;
  }
  return html;
}

function renderPanel() {
  const p = $('#panel');
  const which = S.ui.panel;
  if (!which) return;
  let html = `<div class="panelHead"><b>${PANEL_TITLES[which] || which}</b><button class="x" data-a="panel:close">✕</button></div>`;

  if (which === 'inv') {
    const hasChest = hasBuilding('chest');
    html += `<div class="grid">`;
    S.inv.slots.forEach((s, i) => {
      if (s && ITEMS[s.id].type === 'food') html += itemSlot(s, `eat:${i}`);
      else if (s && ITEMS[s.id].type === 'tool') html += `<div class="slot" data-a="tool:${s.id}" title="装备 ${ITEMS[s.id].name}"><span class="em">${ITEMS[s.id].emoji}</span></div>`;
      else if (s && hasChest) html += `<div class="slot" data-a="toStorage" data-idx="${i}" title="${ITEMS[s.id].name}｜点此存入木箱"><span class="em">${ITEMS[s.id].emoji}</span>${s.n > 1 ? `<b>${s.n}</b>` : ''}</div>`;
      else html += itemSlot(s, 'noop');
    });
    html += `</div><p class="hint">点击食物直接吃掉 · 点击工具装备${hasChest ? ' · 点击材料存入木箱' : ' · 造木箱后可存放材料'}</p>`;
    // 木箱区
    if (hasChest) {
      html += `<h3>🧰 木箱仓储（所有木箱共享）</h3><div class="grid small">`;
      S.storage.forEach((s, i) => {
        if (s) html += `<div class="slot" data-a="fromStorage" data-idx="${i}" title="${ITEMS[s.id].name}｜点此取出"><span class="em">${ITEMS[s.id].emoji}</span><b>${s.n}</b></div>`;
        else html += `<div class="slot empty"></div>`;
      });
      html += `</div><p class="hint">点击木箱里的物品取回背包</p>`;
    }
  }
  else if (which === 'craft') {
    html += `<div class="rows">`;
    for (const r of RECIPES) {
      const can = Object.entries(r.in).every(([id, n]) => countItem(id) >= n);
      const outId = Object.keys(r.out)[0];
      html += `<div class="row">
        <span class="em big">${ITEMS[outId].emoji}</span>
        <div class="grow"><b>${ITEMS[outId].name} ×${r.out[outId]}</b><small>${r.desc}</small>
          <div class="costs">${costHtml(r.in)}</div></div>
        <button class="primary ${can ? '' : 'dis'}" data-a="craft:${r.id}" ${can ? '' : 'disabled'}>合成</button>
      </div>`;
    }
    html += `</div>`;
  }
  else if (which === 'build') {
    html += `<div class="buildCats">`;
    const cats = [['扩建', ['floor', 'floor_armor']], ['生存', ['purifier', 'grill', 'campfire', 'farm', 'bed']], ['功能', ['smelter', 'chest', 'sail', 'anchor', 'raincatcher']], ['防卫', ['net', 'scarecrow', 'lamp']], ['剧情', ['radio']]];
    for (const [cat, ids] of cats) {
      html += `<h3>${cat}</h3><div class="rows">`;
      for (const id of ids) {
        const def = BUILDINGS[id];
        const built = (id === 'sail' || id === 'anchor' || id === 'radio') && hasBuilding(id);
        const can = Object.entries(def.cost).every(([iid, n]) => countItem(iid) >= n) && !built;
        html += `<div class="row">
          <span class="em big">${def.emoji}</span>
          <div class="grow"><b>${def.name}</b><small>${def.desc}</small>
            <div class="costs">${costHtml(def.cost)}${built ? '<span class="cost ok">✅已建造</span>' : ''}</div></div>
          <button class="primary ${can ? '' : 'dis'}" data-a="buildSel:${id}" ${can ? '' : 'disabled'}>选择</button>
        </div>`;
      }
      html += `</div>`;
    }
    html += `</div><p class="hint">选择后点击木筏边缘的海面放地板 / 点击地板放建筑；拆除装备锤子后点建筑</p>`;
  }
  else if (which === 'station') {
    const st = S.ui.stationOpen;
    if (st) {
      html += `<p class="hint">${BUILDINGS[st.type].name}：材料就位即可开始，完成自动入包</p><div class="rows">`;
      for (const r of STATION_RECIPES[st.type]) {
        const busy = S.cooking[st.bkey];
        const can = !busy && Object.entries(r.in).every(([id, n]) => {
          if (r.useTag === 'fish') return countTag('fish') >= 1;
          return countItem(id) >= n;
        });
        const inStr = r.useTag === 'fish' ? '🐟任意鱼×1' : Object.entries(r.in).map(([id, n]) => `${ITEMS[id].emoji}${ITEMS[id].name}×${n}`).join(' ');
        const outId = Object.keys(r.out)[0];
        html += `<div class="row">
          <span class="em big">${ITEMS[outId].emoji}</span>
          <div class="grow"><b>${r.desc}</b><small>${inStr} → ${r.time}秒</small>
          ${busy && busy.recipeId === r.id ? `<div class="bar thin"><i style="width:${(busy.t / busy.time * 100) | 0}%"></i></div>` : ''}</div>
          <button class="primary ${can ? '' : 'dis'}" data-a="cook:${st.bkey}|${r.id}" ${can ? '' : 'disabled'}>开始</button>
        </div>`;
      }
      html += `</div>`;
    }
  }
  else if (which === 'quests') {
    html += `<div class="rows">`;
    QUESTS.forEach((q, i) => {
      const done = i < S.quests.idx;
      const active = i === S.quests.idx;
      html += `<div class="row ${done ? 'done' : active ? 'active' : 'locked'}">
        <span class="em big">${done ? '✅' : active ? '📜' : '🔒'}</span>
        <div class="grow"><b>${done ? q.name : (active ? q.name : '？？？')}</b><small>${active ? q.desc : done ? '已完成' : '完成前置后解锁'}</small>
        ${active && Object.keys(q.reward).length ? `<div class="costs"><span class="cost">奖励：</span>${Object.entries(q.reward).map(([id, n]) => `<span class="cost">${ITEMS[id].emoji}${ITEMS[id].name}×${n}</span>`).join('')}</div>` : ''}</div>
      </div>`;
    });
    html += `</div>`;
  }
  else if (which === 'achv') {
    html += `<p class="hint">已解锁 ${S.achievements.size} / ${ACHIEVEMENTS.length}</p><div class="rows">`;
    for (const a of ACHIEVEMENTS) {
      const got = S.achievements.has(a.id);
      html += `<div class="row ${got ? 'done' : 'locked'}">
        <span class="em big">${got ? '🏆' : '⬜'}</span>
        <div class="grow"><b>${got ? a.name : '???'}</b><small>${a.desc}</small></div>
      </div>`;
    }
    html += `</div>`;
  }
  else if (which === 'map') {
    html += `<canvas id="bigmap" width="380" height="380" style="border-radius:12px"></canvas>
      <p class="hint">红点=木筏 · 沙色=岛屿 · 金色=灯塔岛 · 箭头=风向。升起帆，用 Q/E 调帆向驶向岛屿！</p>`;
  }
  else if (which === 'settings') {
    const s = S.settings;
    html += `<div class="rows">
      <div class="row"><span class="em big">🔊</span><div class="grow"><b>音效 ${Math.round(s.sfx * 100)}%</b></div>
        <input type="range" min="0" max="100" value="${s.sfx * 100}" data-a="sfxRange"></div>
      <div class="row"><span class="em big">🎵</span><div class="grow"><b>音乐 ${Math.round(s.music * 100)}%</b></div>
        <input type="range" min="0" max="100" value="${s.music * 100}" data-a="musRange"></div>
      <div class="row"><span class="em big">📳</span><div class="grow"><b>屏幕震动</b></div>
        <button class="primary" data-a="toggleShake">${s.shake ? '开' : '关'}</button></div>
      <div class="row"><span class="em big">✨</span><div class="grow"><b>画质（影响粒子）</b></div>
        <button class="primary ${s.quality === 'high' ? '' : 'dis'}" data-a="setQual:high">高</button>
        <button class="primary ${s.quality === 'low' ? '' : 'dis'}" data-a="setQual:low">低</button></div>
      <div class="row"><span class="em big">💾</span><div class="grow"><b>手动存档</b><small>每 ${CFG.saveEvery} 秒也会自动保存</small></div>
        <button class="primary" data-a="saveNow">保存</button></div>
      <div class="row"><span class="em big">🗑️</span><div class="grow"><b>删除存档并重新开始</b></div>
        <button class="primary dis" data-a="resetSave">重开</button></div>
    </div>`;
  }
  else if (which === 'upg') {
    html += `<p class="hint">当前等级 <b>Lv.${S.level}</b> · 升级点 <b>${S.skillPts}</b> · 经验 ${S.xp}/${xpNeed(S.level)}<br>收集/钓鱼/烹饪/战斗/探岛都会涨经验</p><div class="rows">`;
    for (const u of UPG) {
      const cur = lv(u.id);
      const maxed = cur >= u.max;
      const pips = Array.from({ length: u.max }, (_, i) => i < cur ? '●' : '○').join('');
      html += `<div class="row ${maxed ? 'done' : ''}">
        <span class="em big">${u.emoji}</span>
        <div class="grow"><b>${u.name} ${pips}</b><small>${u.desc}</small></div>
        <button class="primary ${S.skillPts > 0 && !maxed ? '' : 'dis'}" data-a="buyUpg:${u.id}" ${S.skillPts > 0 && !maxed ? '' : 'disabled'}>${maxed ? '已满' : '升级'}</button>
      </div>`;
    }
    html += `</div>`;
  }
  else if (which === 'shop') {
    const m = S.entities.merchant;
    if (!m) {
      html += `<p class="hint">商筏已经远去了…等它下次到港吧</p>`;
    } else {
      html += `<p class="hint">🪙 古币余额：<b>${countItem('coin')}</b> · 商筏停留 ${Math.ceil(m.life)} 秒<br>古币来源：漩涡宝藏、巨鲨战利品、沉船搜刮</p><div class="rows">`;
      m.stock.forEach((st, i) => {
        const can = countItem('coin') >= st.coin;
        html += `<div class="row">
          <span class="em big">${ITEMS[st.id].emoji}</span>
          <div class="grow"><b>${ITEMS[st.id].name}</b><small>${ITEMS[st.id].desc || ''}</small></div>
          <span class="cost ${can ? 'ok' : 'lack'}">🪙${st.coin}</span>
          <button class="primary ${can ? '' : 'dis'}" data-a="buyStock:${i}" ${can ? '' : 'disabled'}>买</button>
        </div>`;
      });
      html += `</div><h3>💰 出售珍宝</h3><div class="rows">`;
      for (const [id, price] of Object.entries(SELL_PRICES)) {
        const have = countItem(id);
        html += `<div class="row ${have ? '' : 'locked'}">
          <span class="em big">${ITEMS[id].emoji}</span>
          <div class="grow"><b>${ITEMS[id].name}</b><small>持有 ×${have}</small></div>
          <span class="cost">🪙+${price}</span>
          <button class="primary ${have ? '' : 'dis'}" data-a="sellItem:${id}" ${have ? '' : 'disabled'}>卖</button>
        </div>`;
      }
      html += `</div>`;
    }
  }
  else if (which === 'stats') {
    const st = S.stats;
    const rows = [
      ['⭐', '等级', `Lv.${S.level}（${S.xp}/${xpNeed(S.level)} 经验）`],
      ['📅', '存活天数', st.days],
      ['⏱️', '游戏时长', Math.floor(st.playTime / 60) + ' 分钟'],
      ['📦', '收集物品', st.collected],
      ['🐟', '钓鱼', st.fish],
      ['🍢', '烹饪', st.cooked],
      ['💧', '喝水', st.drank],
      ['🦈', '击退鲨鱼', st.sharkFlee],
      ['⚔️', '击杀鲨鱼', st.sharkKill],
      ['🐙', '猎杀巨鲨', st.bossKill],
      ['🏝️', '造访岛屿', st.islands],
      ['💰', '开启宝箱', st.chests],
      ['🌾', '收获作物', st.harvest],
      ['🤿', '潜水采集', st.diveTake],
      ['🛒', '交易次数', st.trades],
      ['🌀', '漩涡宝藏', st.vortexLoot],
      ['🚢', '搜刮沉船', st.wrecks],
      ['🐬', '海豚同游', Math.floor(st.dolphinTime) + ' 秒'],
      ['⛵', '累计航行', Math.floor(st.sailed) + ' 米'],
      ['💀', '倒下次数', st.deaths],
    ];
    html += `<div class="rows">`;
    for (const [em, k, v] of rows) {
      html += `<div class="row"><span class="em big">${em}</span><div class="grow"><b>${k}</b></div><b style="color:#5A4A2A">${v}</b></div>`;
    }
    html += `</div>`;
  }
  else if (which === 'help') {
    html += `<div class="helpText">
      <b>🎯 目标：</b>在海上活下去，扩建木筏，最终修复无线电找到灯塔岛获救。<br><br>
      <b>🪝 生存三件事：</b><br>
      · <b>吃</b>：鱼竿钓鱼 / 烤架烤熟 / 岛上采浆果椰子<br>
      · <b>喝</b>：净水器烧出纯净水（雨天雨水收集器白送）<br>
      · <b>住</b>：木板扩建木筏，建造各类设施<br><br>
      <b>⌨️ 电脑操作：</b><br>
      WASD/方向键移动 · 鼠标点水面=扔钩 · <b>空格/J</b>=动作(攻击/砍/钓) · <b>E</b>=使用/交互 · <b>Q</b>=潜水/上浮 · <b>Q/E</b>=调帆(按住) · <b>数字1-5</b>=切换工具 · <b>B</b>=建造 · <b>Esc</b>=关面板<br><br>
      <b>📱 手机操作：</b>左下摇杆移动 · 右下按钮：使用/动作/钩子/潜水 · 点击水面扔钩<br><br>
      <b>🦈 提示：</b>鲨鱼会咬地板，装备矛在它靠近时攻击可击退；防鲨网和加固地板能挡咬。潜水时氧气有限，水下有海草/黏土/沙/石头/矿石/珍珠。海鸥会偷菜，稻草人和营火能吓走它。
    </div>`;
  }
  p.innerHTML = html;
  // 面板内特殊控件
  const sfxR = p.querySelector('[data-a=sfxRange]');
  if (sfxR) sfxR.oninput = e => { S.settings.sfx = e.target.value / 100; setVolumes(); e.target.previousElementSibling.querySelector('b').textContent = `音效 ${e.target.value}%`; };
  const musR = p.querySelector('[data-a=musRange]');
  if (musR) musR.oninput = e => { S.settings.music = e.target.value / 100; setVolumes(); e.target.previousElementSibling.querySelector('b').textContent = `音乐 ${e.target.value}%`; };
  const resetBtn = p.querySelector('[data-a=resetSave]');
  if (resetBtn) {
    resetBtn.disabled = false; resetBtn.classList.remove('dis');
    resetBtn.onclick = () => {
      if (!resetBtn._c) { resetBtn.textContent = '确认重开？'; resetBtn._c = 1; return; }
      localStorage.removeItem(SAVE_KEY); location.reload();
    };
  }
  if (which === 'map') drawBigMap();
}

const PANEL_TITLES = { inv: '🎒 背包', craft: '🛠️ 合成', build: '🏗️ 建造', quests: '📜 主线任务', achv: '🏆 成就', map: '🗺️ 海图', settings: '⚙️ 设置', help: '❓ 帮助', station: '🏭 工作台', upg: '⭐ 船长成长', shop: '🛒 商筏集市', stats: '📊 航海统计' };

function drawBigMap() {
  const cv = $('#bigmap');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width;
  const scale = 380 / 6000;
  ctx.fillStyle = '#BDEDE6';
  ctx.fillRect(0, 0, W, W);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(0, i * W / 6); ctx.lineTo(W, i * W / 6); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i * W / 6, 0); ctx.lineTo(i * W / 6, W); ctx.stroke(); }
  for (const isl of S.islands) {
    const x = W / 2 + isl.x * scale, y = W / 2 + isl.y * scale;
    if (x < -20 || x > W + 20 || y < -20 || y > W + 20) continue;
    ctx.fillStyle = isl.type === 'lighthouse' ? '#E8C84A' : '#EFE0AC';
    ctx.beginPath(); ctx.arc(x, y, Math.max(5, isl.r * scale * 1.25), 0, 6.29); ctx.fill();
    ctx.strokeStyle = isl.visited ? '#7A9' : '#888'; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = '10px system-ui'; ctx.textAlign = 'center';
    ctx.fillStyle = '#5A5A4A';
    ctx.fillText(isl.type === 'lighthouse' ? '🗼灯塔岛' : (isl.visited ? '已探索' : '?'), x, y - 8);
  }
  ctx.fillStyle = '#D0554A';
  ctx.beginPath(); ctx.arc(W / 2, W / 2, 6, 0, 6.29); ctx.fill();
  ctx.strokeStyle = '#3A6A7A'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(W / 2, W / 2);
  ctx.lineTo(W / 2 + Math.cos(S.wind.dir) * 26, W / 2 + Math.sin(S.wind.dir) * 26); ctx.stroke();
  ctx.fillStyle = '#3A6A7A'; ctx.font = '10px system-ui'; ctx.textAlign = 'center';
  ctx.fillText('风', W / 2 + Math.cos(S.wind.dir) * 34, W / 2 + Math.sin(S.wind.dir) * 34 + 3);
}

// ---------------- Toast ----------------
export function renderToasts() {
  const box = $('#toasts');
  if (!box) return;
  box.innerHTML = S.msg.map(m => `<div class="toast">${m.icon ? `<span>${m.icon}</span>` : ''}${m.text}</div>`).join('');
}
export function tickToasts(dt) {
  let changed = false;
  for (let i = S.msg.length - 1; i >= 0; i--) {
    S.msg[i].t -= dt;
    if (S.msg[i].t <= 0) { S.msg.splice(i, 1); changed = true; }
  }
  if (changed) renderToasts();
}

// ---------------- 手机摇杆 ----------------
export function setupTouch() {
  S.isTouch = navigator.maxTouchPoints > 0 &&
    (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
  const joy = $('#joystick'), knob = $('#joyKnob');
  let jid = null, cx = 0, cy = 0;
  joy.addEventListener('pointerdown', e => {
    jid = e.pointerId;
    const r = joy.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    joy.setPointerCapture(jid);
    e.preventDefault();
  });
  joy.addEventListener('pointermove', e => {
    if (e.pointerId !== jid) return;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const d = Math.hypot(dx, dy), max = 52;
    if (d > max) { dx = dx / d * max; dy = dy / d * max; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    S.input.moveX = dx / max; S.input.moveY = dy / max;
  });
  const end = e => {
    if (e.pointerId !== jid) return;
    jid = null;
    knob.style.transform = '';
    S.input.moveX = 0; S.input.moveY = 0;
  };
  joy.addEventListener('pointerup', end);
  joy.addEventListener('pointercancel', end);
  // 攻击按钮按住 = 钓鱼蓄力
  const atkBtn = $('#btnAtk');
  atkBtn.addEventListener('pointerdown', () => { S.input.fishingHold = true; });
  atkBtn.addEventListener('pointerup', () => { S.input.fishingHold = false; });
  atkBtn.addEventListener('pointercancel', () => { S.input.fishingHold = false; });
}
