// ============ 玩家：移动 / 属性 / 动作 / 潜水 ============
import { S, rand, randi, dist, clamp, toast, bus } from './state.js';
import { TILE, CFG, ITEMS, ISLAND_TYPES, CHEST_LOOT } from './data.js';
import { eff, grantXP } from './upgrades.js';
import { addItem, countItem, removeItem } from './inv.js';
import { tileAt, isOnRaft, nearestInteractable, farmInteract, sleepBed, hasBuilding, findBuilding } from './raft.js';
import { islandWalkable } from './world.js';
import { tryTakeUnderNode, hitShark, sharkNearPlayer, hitGull, spawnSplash, spawnBubbles, spawnHitStar, tryTakeWreckNode, dolphinNearPlayer } from './entities.js';
import { startFishing, stopFishing } from './fishing.js';
import { sfx } from './audio.js';

export function updatePlayer(dt) {
  const p = S.player;
  p.atkCd -= dt; p.useCd -= dt; p.invul -= dt; p.swingT = Math.max(0, (p.swingT || 0) - dt * 3.4);
  const inp = S.input;

  // ---- 移动 ----
  let mx = inp.moveX, my = inp.moveY;
  const mag = Math.hypot(mx, my);
  if (mag > 1) { mx /= mag; my /= mag; }
  const moving = mag > 0.1;
  p.moving = moving;
  if (moving) p.dir = Math.atan2(my, mx);
  const spd = p.swimming ? eff.swimSpeed() : CFG.playerSpeed;
  const nx = p.x + mx * spd * dt, ny = p.y + my * spd * dt;

  if (p.swimming) {
    p.x = nx; p.y = ny;
    p.oxygen -= dt * (dolphinNearPlayer() ? 0.55 : 1);
    spawnBubbles(p.x, p.y, dt > 0.5 ? 1 : (Math.random() < dt * 2 ? 1 : 0));
    if (p.oxygen <= 0) {
      p.oxygen = 0;
      damagePlayer(8 * dt + 2, '缺氧了！快回木筏！');
      // 拉回木筏
      climbRaft();
    }
    // 自动上筏：游到筏上位置
    if (!p._climbCd || p._climbCd <= 0) {
      if (isOnRaft(p.x, p.y)) { exitWater(); }
    } else p._climbCd -= dt;
    // 登岛
    const isl = islandWalkable(p.x, p.y);
    if (isl) {
      p.swimming = false; p.onIsland = isl; p.oxygen = eff.oxygenMax();
      if (!isl.visited) { isl.visited = true; S.stats.islands++; if (isl.type === 'lighthouse') S.stats.lighthouse = 1; grantXP(15); toast(`登上了${ISLAND_TYPES[isl.type]?.name || '灯塔岛'}！`, '🏝️'); sfx.quest(); }
    }
  } else {
    // 在筏上或在岛上行走
    const onRaftNow = isOnRaft(p.x, p.y);
    const isl = p.onIsland || islandWalkable(p.x, p.y);
    if (onRaftNow) {
      p.x = nx; p.y = ny; p.onIsland = null;
      // 走出筏边 → 落水
      if (!isOnRaft(nx, ny) && !islandWalkable(nx, ny)) {
        enterWater();
        p.x = nx; p.y = ny;
      }
    } else if (isl && islandWalkable(nx, ny)) {
      p.x = nx; p.y = ny; p.onIsland = isl;
    } else if (isl) {
      // 岛边落水
      p.x = nx; p.y = ny; p.onIsland = null;
      enterWater();
    } else {
      // 悬空（筏没了）→ 落水
      enterWater();
      p.x = nx; p.y = ny;
    }
    if (moving) p.walkT += dt * 9;
  }

  // ---- 属性消耗 ----
  const raining = S.weather.type === 'rain' || S.weather.type === 'storm';
  if (raining && p.swimming) S.stats.rainTime += dt;
  p.hunger = clamp(p.hunger - eff.hungerRate() * dt * (p.swimming ? 1.4 : 1), 0, 100);
  p.thirst = clamp(p.thirst - CFG.thirstRate * dt * (raining ? 0.85 : 1), 0, 100);
  if (p.sick > 0) p.sick -= dt;
  if (p.hunger <= 0 || p.thirst <= 0) {
    damagePlayer(CFG.starveDmg * dt * (p.hunger <= 0 && p.thirst <= 0 ? 2 : 1), null);
  } else if (p.hunger > 55 && p.thirst > 55 && p.hp < 100) {
    p.hp = clamp(p.hp + CFG.hpRegen * dt, 0, 100);
  }

  // ---- 消费按键事件 ----
  if (inp.attack) { inp.attack = false; doAttack(); }
  if (inp.use) { inp.use = false; doUse(); }
  if (inp.dive) { inp.dive = false; toggleDive(); }
  if (inp.hook) { inp.hook = false; doHookDefault(); }

  // Q/E 调帆
  if (inp.sailL || inp.sailR) {
    if (S.sailing.raised) {
      S.sailing.angle += (inp.sailR ? 1 : -1) * dt * 1.8;
      inp.sailL = false; inp.sailR = false;
    }
  }
}

function enterWater() {
  const p = S.player;
  if (p.swimming) return;
  p.swimming = true;
  p.oxygen = eff.oxygenMax();
  p._climbCd = 0.8;
  spawnSplash(p.x, p.y, 12);
  sfx.splash();
  toast('落水了！小心鲨鱼，游回木筏边', '🌊');
}
function exitWater() {
  const p = S.player;
  p.swimming = false;
  p.oxygen = eff.oxygenMax();
  p.onIsland = null;
  sfx.splash();
  spawnSplash(p.x, p.y, 8);
}
function climbRaft() {
  // 找最近地板
  let best = null, bd = 1e9;
  for (const t of S.raft.tiles.values()) {
    const d = dist(S.player.x, S.player.y, (t.c + 0.5) * TILE, (t.r + 0.5) * TILE);
    if (d < bd) { bd = d; best = t; }
  }
  if (best) {
    S.player.x = (best.c + 0.5) * TILE;
    S.player.y = (best.r + 0.5) * TILE;
    exitWater();
  }
}
export function toggleDive() {
  const p = S.player;
  if (S.fishing) { stopFishing(false); }
  if (p.swimming) { climbRaft(); return; }
  // 在筏边才能跳水
  const onRaft = isOnRaft(p.x, p.y);
  if (!onRaft && !p.onIsland) return;
  p.swimming = true;
  p.oxygen = eff.oxygenMax();
  p._climbCd = 1.0;
  // 往面朝方向跳一小段
  p.x += Math.cos(p.dir) * 40; p.y += Math.sin(p.dir) * 40;
  spawnSplash(p.x, p.y, 12);
  sfx.dive();
  toast('潜水模式：🫧 找水下资源按 使用 采集', '🤿');
}

// ---------------- 动作 ----------------
export function doHookDefault() {
  const p = S.player;
  if (p.swimming) { toast('游泳时不能用钩子', '⚠️'); return; }
  if (S.hook) return;
  // 自动瞄准最近漂流物
  let best = null, bd = CFG.hookRange;
  for (const f of S.entities.floaters) {
    const d = dist(p.x, p.y, f.x, f.y);
    if (d < bd) { bd = d; best = f; }
  }
  if (best) {
    S.hook = { sx: p.x, sy: p.y - 8, x: p.x, y: p.y - 8, tx: best.x, ty: best.y, phase: 'fly', target: best, t: 0 };
    sfx.hookOut();
  } else {
    toast('附近没有漂流物', '⚠️');
  }
}
export function doHookAt(wx, wy) {
  const p = S.player;
  if (p.swimming) { toast('游泳时不能用钩子', '⚠️'); return; }
  if (S.hook) return;
  if (dist(p.x, p.y, wx, wy) > CFG.hookRange) { toast('太远了，够不着', '⚠️'); sfx.error(); return; }
  if (isOnRaft(wx, wy)) return;
  let target = null, bd = 50;
  for (const f of S.entities.floaters) {
    const d = dist(wx, wy, f.x, f.y);
    if (d < bd) { bd = d; target = f; }
  }
  S.hook = { sx: p.x, sy: p.y - 8, x: p.x, y: p.y - 8, tx: wx, ty: wy, phase: 'fly', target, t: 0 };
  sfx.hookOut();
}

export function doAttack() {
  const p = S.player;
  if (p.atkCd > 0) return;
  p.atkCd = 0.5;
  p.swingT = 1;
  const tool = p.tool;
  // 鱼竿 → 钓鱼
  if (tool === 'rod') {
    if (!p.swimming) { startFishing(); return; }
  }
  // 长矛/手钩 → 攻击
  if (tool === 'spear' || tool === 'spear_metal' || tool === 'hook') {
    const dmg = eff.spearDmg(tool === 'spear_metal' ? 2 : 1);
    const shark = sharkNearPlayer(tool === 'spear_metal' ? 85 : 64);
    if (shark) { hitShark(shark, dmg); spawnHitStar(shark.x, shark.y); return; }
    // 海鸥（在头顶低空）
    for (const g of S.entities.gulls) {
      if (dist(p.x, p.y, g.x, g.y) < 60 && g.alt < 50) { hitGull(g); spawnHitStar(g.x, g.y - g.alt); return; }
    }
    // 岛屿资源
    if (harvestIslandNode()) return;
    spawnSplash(p.x + Math.cos(p.dir) * 26, p.y + Math.sin(p.dir) * 26, 3);
  }
}

// 岛屿采集
function harvestIslandNode() {
  const p = S.player;
  const isl = p.onIsland || islandWalkable(p.x, p.y);
  if (!isl) return false;
  let best = null, bd = 56;
  for (const nd of isl.nodes) {
    if (nd.hp <= 0) continue;
    const d = dist(p.x, p.y, nd.x, nd.y);
    if (d < bd) { bd = d; best = nd; }
  }
  if (!best) return false;
  best.hp--; best.shake = 0.4;
  sfx.hit();
  spawnHitStar(best.x, best.y - 10);
  if (best.kind === 'palm') {
    addItem('wood', 1, true); addItem('palm_leaf', 1, true);
    if (best.hp <= 0 || Math.random() < 0.3) { addItem('coconut', 1, true); toast('砍倒棕榈树：木材+棕榈叶+椰子', '🌴'); }
    else toast('砍伐中…', '🌴');
  } else if (best.kind === 'rock') {
    addItem('stone', 1, true);
    if (Math.random() < 0.45) addItem('ore', 1, true);
    if (best.hp <= 0) toast('敲碎岩石：石头+矿石', '🪨'); else toast('敲石中…', '🪨');
  } else {
    addItem('berry', 2, true);
    if (Math.random() < 0.6) addItem('seed_berry', 1, true);
    best.hp = 0;
    toast('采到浆果和种子！', '🍓');
  }
  if (best.hp <= 0) best.respawn = rand(90, 150);
  return true;
}
export function updateIslandNodes(dt) {
  for (const isl of S.islands) {
    for (const nd of isl.nodes) {
      if (nd.shake > 0) nd.shake -= dt;
      if (nd.hp <= 0 && nd.respawn > 0) {
        nd.respawn -= dt;
        if (nd.respawn <= 0) { nd.hp = nd.kind === 'palm' ? 3 : nd.kind === 'rock' ? 4 : 1; }
      }
    }
  }
}

// E 键交互
export function doUse() {
  const p = S.player;
  if (p.swimming) {
    if (tryTakeWreckNode()) return;
    tryTakeUnderNode();
    return;
  }
  // 商筏交易
  const m = S.entities.merchant;
  if (m && dist(p.x, p.y, m.x, m.y) < 85) {
    S.ui.panel = 'shop';
    bus.emit('openPanel', 'shop');
    sfx.open();
    return;
  }
  // 岛屿宝箱
  const isl = p.onIsland || islandWalkable(p.x, p.y);
  if (isl && isl.chest && !isl.chest.open && dist(p.x, p.y, isl.chest.x, isl.chest.y) < 56) {
    openChest(isl);
    return;
  }
  // 建筑
  const t = nearestInteractable(p.x, p.y);
  if (!t) return;
  const b = t.b;
  const bk = t.c + ',' + t.r;
  switch (b.type) {
    case 'purifier': case 'grill': case 'smelter':
      S.ui.stationOpen = { type: b.type, bkey: bk };
      S.ui.panel = 'station';
      bus.emit('openStation');
      sfx.open();
      break;
    case 'farm': farmInteract(t); break;
    case 'bed': sleepBed(); break;
    case 'chest': S.ui.panel = 'storage'; sfx.open(); break;
    case 'sail':
      S.sailing.raised = !S.sailing.raised;
      S.anchor = false;
      toast(S.sailing.raised ? '帆已升起！Q/E 调整帆向' : '帆已收起', '⛵');
      sfx.open();
      break;
    case 'anchor':
      S.anchor = !S.anchor;
      if (S.anchor) S.sailing.raised = false;
      toast(S.anchor ? '已抛锚，船停住了' : '起锚了', '⚓');
      sfx.open();
      break;
    case 'radio': radioInteract(); break;
    case 'campfire': toast('营火噼啪作响，夜里很安心', '🔥'); break;
    case 'raincatcher': toast('下雨时会自动收集纯净水', '☔'); break;
    case 'scarecrow': toast('稻草人守护着周围的农田', '🎃'); break;
    case 'lamp': toast('灯柱照亮夜晚', '🏮'); break;
    default: break;
  }
}

function openChest(isl) {
  isl.chest.open = true;
  S.stats.chests++;
  grantXP(20);
  sfx.chest();
  const got = {};
  for (const l of CHEST_LOOT) if (Math.random() < l.p) got[l.id] = (got[l.id] || 0) + randi(l.n[0], l.n[1]);
  if (!Object.keys(got).length) got.wood = 6;
  for (const [id, n] of Object.entries(got)) {
    addItem(id, n, true);
    toast(`宝箱：${ITEMS[id].name} ×${n}`, ITEMS[id].emoji);
  }
}

function radioInteract() {
  if (S.lighthouseFound) {
    const lh = S.islands.find(i => i.type === 'lighthouse');
    if (lh) {
      const a = Math.atan2(lh.y, lh.x);
      const dirs = ['东', '东南', '南', '西南', '西', '西北', '北', '东北'];
      const d8 = Math.round(((a + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
      toast(`无线电：灯塔岛在${dirs[d8]}方向，距离 ${Math.round(dist(0, 0, lh.x, lh.y) / 10)} 米，升起帆出发吧！`, '📻');
    }
    return;
  }
  if (countItem('map_frag') >= 3) {
    removeItem('map_frag', 3);
    S.stats.radioFixed++;
    toast('用3张地图碎片修复了无线电！灯塔岛坐标已获知！', '📡');
    sfx.quest();
    import('./world.js').then(m => m.spawnLighthouse());
  } else {
    toast(`还差 ${3 - countItem('map_frag')} 张地图碎片（开岛屿宝箱/漂流瓶获得）`, '🗺️');
  }
}

// ---------------- 吃喝 ----------------
export function consumeItem(idx) {
  const s = S.inv.slots[idx];
  if (!s) return false;
  const def = ITEMS[s.id];
  if (def.type !== 'food') return false;
  const p = S.player;
  if (def.wet) { p.thirst = clamp(p.thirst + def.wet, 0, 100); if (s.id === 'water') { S.stats.drank++; sfx.drink(); } }
  if (def.val) p.hunger = clamp(p.hunger + def.val, 0, 100);
  if (def.hp) p.hp = clamp(p.hp + def.hp, 0, 100);
  if (s.id === 'shark_raw' && Math.random() < 0.35) { p.sick = 20; toast('生鲨肉有点腥，感觉不舒服…', '🤢'); }
  s.n--;
  if (s.n <= 0) S.inv.slots[idx] = null;
  if (!def.wet || s.id !== 'water') sfx.eat();
  toast(`吃掉 ${def.name}${def.hp ? ' ❤+' + def.hp : ''}${def.val ? ' 🍗+' + def.val : ''}${def.wet ? ' 💧+' + def.wet : ''}`, def.emoji);
  return true;
}

export function damagePlayer(amount, msg) {
  const p = S.player;
  if (p.invul > 0 || S.mode !== 'play') return;
  p.hp = clamp(p.hp - amount, 0, 100);
  if (msg) { toast(msg, '💔'); p.invul = 1.2; }
  S.shakeT = Math.max(S.shakeT, 0.25);
  sfx.hurt();
  if (p.hp <= 0) {
    S.mode = 'dead';
    S.stats.deaths++;
    sfx.sharkBite();
  }
}

// ---------------- 渲染玩家 ----------------
export function drawPlayer(ctx, t) {
  const p = S.player;
  const swimming = p.swimming;
  const bob = swimming ? Math.sin(t * 3) * 2 : Math.sin(p.walkT) * 1.6 * (p.moving ? 1 : 0);
  ctx.save();
  ctx.translate(p.x, p.y + bob);
  if (swimming) {
    // 只露头+水纹
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.ellipse(0, 2, 15, 7, 0, 0, 6.29); ctx.fill();
  }
  // 影子
  if (!swimming) {
    ctx.fillStyle = 'rgba(30,50,60,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 13, 10, 4, 0, 0, 6.29); ctx.fill();
  }
  // 腿（行走）
  if (!swimming) {
    const legSw = Math.sin(p.walkT) * 5 * (p.moving ? 1 : 0);
    ctx.strokeStyle = '#4A5A78'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-3, 6); ctx.lineTo(-3 + legSw, 13); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3, 6); ctx.lineTo(3 - legSw, 13); ctx.stroke();
  }
  // 身体
  ctx.fillStyle = '#E8735A';
  ctx.beginPath(); ctx.roundRect(-7, -8, 14, 15, 5); ctx.fill();
  // 手（挥动时朝向 dir）
  const swing = p.swingT > 0 ? Math.sin(p.swingT * Math.PI) : 0;
  ctx.strokeStyle = '#E8735A'; ctx.lineWidth = 3.5;
  const handAng = p.dir + (swing > 0 ? -0.6 + swing * 1.4 : 0.5);
  const hx = Math.cos(handAng) * 9, hy = Math.sin(handAng) * 9 - 1;
  ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(hx, hy); ctx.stroke();
  // 手中的工具
  if (swing > 0 || p.tool) {
    const toolEmoji = { hook: '🪝', spear: '🔱', spear_metal: '⚔️', hammer: '🔨', rod: '🎣' }[p.tool] || '';
    if (toolEmoji && (swing > 0.05 || p.tool === 'rod' || p.tool === 'hook')) {
      ctx.font = '13px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(toolEmoji, hx + Math.cos(handAng) * 5, hy + Math.sin(handAng) * 5 + 4);
    }
  }
  // 头
  ctx.fillStyle = '#F2C9A0';
  ctx.beginPath(); ctx.arc(0, -13, 7, 0, 6.29); ctx.fill();
  // 草帽
  ctx.fillStyle = '#E8C86A';
  ctx.beginPath(); ctx.ellipse(0, -16, 10, 4.5, 0, 0, 6.29); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -17, 5.5, Math.PI, 0); ctx.fill();
  // 面向
  ctx.fillStyle = '#3A3A4A';
  const ex = Math.cos(p.dir) * 3, ey = Math.sin(p.dir) * 2;
  ctx.beginPath(); ctx.arc(ex - 1.4, -12.5 + ey, 1.1, 0, 6.29); ctx.fill();
  ctx.beginPath(); ctx.arc(ex + 1.8, -12.5 + ey, 1.1, 0, 6.29); ctx.fill();
  // 生病
  if (p.sick > 0) {
    ctx.font = '10px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('😵', 8, -20);
  }
  // 氧气泡表
  if (swimming) {
    const frac = p.oxygen / CFG.oxygenMax;
    ctx.fillStyle = 'rgba(20,50,70,0.55)';
    ctx.beginPath(); ctx.roundRect(-14, -30, 28, 5, 3); ctx.fill();
    ctx.fillStyle = frac > 0.3 ? '#6ED0F0' : '#F0655A';
    ctx.beginPath(); ctx.roundRect(-13, -29, 26 * frac, 3, 2); ctx.fill();
  }
  ctx.restore();
}
