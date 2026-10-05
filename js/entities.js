// ============ 实体：鲨鱼 / 海鸥 / 鱼群 / 水下资源 / 钩子 / 粒子 ============
import { S, rand, randi, dist, clamp, key, toast } from './state.js';
import { TILE, CFG, ITEMS, FISH, SHOP_STOCK, BUILDINGS, CREW_NAMES, CREW_ROLES } from './data.js';
import { addItem, grantLoot, countItem, removeItem } from './inv.js';
import { grantXP, lucky } from './upgrades.js';
import { dailyProg } from './daily.js';
import { tileAt, edgeTiles, hasBuilding } from './raft.js';
import { floaterLoot } from './world.js';
import { sfx } from './audio.js';
// damagePlayer 延迟引用，避免与 player.js 循环导入
let damagePlayer = (n, m) => import('./player.js').then(mo => mo.damagePlayer(n, m));

// ---------------- 水下资源点 ----------------
const UNDER_KINDS = {
  seaweed: { name: '海草',   item: 'seaweed', color: '#3E9E5A', n: [1, 2] },
  clay:    { name: '黏土',   item: 'clay',    color: '#A8744A', n: [1, 2] },
  sand:    { name: '沙堆',   item: 'sand',    color: '#E8D8A0', n: [1, 3] },
  stone:   { name: '石头',   item: 'stone',   color: '#8E8A82', n: [1, 2] },
  ore:     { name: '矿石',   item: 'ore',     color: '#C0A060', n: [1, 1], rare: true },
  pearl:   { name: '珍珠贝', item: 'pearl',   color: '#F0D8E8', n: [1, 1], rare: true },
};
export function initUnderNodes() {
  S.underNodes = [];
  for (let i = 0; i < 9; i++) S.underNodes.push(makeUnderNode());
}
function makeUnderNode() {
  const r = Math.random();
  let kind;
  if (r < 0.3) kind = 'seaweed';
  else if (r < 0.5) kind = 'sand';
  else if (r < 0.68) kind = 'clay';
  else if (r < 0.86) kind = 'stone';
  else if (r < 0.96) kind = 'ore';
  else kind = 'pearl';
  const a = rand(0, Math.PI * 2), d = rand(180, 620);
  return { kind, x: Math.cos(a) * d, y: Math.sin(a) * d, taken: false, respawn: 0, bob: rand(0, 6) };
}
export function updateUnderNodes(dt) {
  for (let i = 0; i < S.underNodes.length; i++) {
    const nd = S.underNodes[i];
    if (nd.taken) {
      nd.respawn -= dt;
      if (nd.respawn <= 0) S.underNodes[i] = makeUnderNode();
    }
  }
}
export function tryTakeUnderNode() {
  const p = S.player;
  let best = null, bd = 52;
  for (const nd of S.underNodes) {
    if (nd.taken) continue;
    const d = dist(p.x, p.y, nd.x, nd.y);
    if (d < bd) { bd = d; best = nd; }
  }
  if (!best) return false;
  const def = UNDER_KINDS[best.kind];
  let n = randi(def.n[0], def.n[1]);
  if (lucky()) { n *= 2; toast('🍀 幸运采集，双倍！', '🍀'); }
  addItem(def.item, n, true);
  toast(`采集 ${def.name} ×${n}`, ITEMS[def.item].emoji);
  best.taken = true; best.respawn = rand(60, 110);
  S.stats.diveTake++;
  grantXP(3);
  dailyProg('dive');
  sfx.pickup();
  spawnBubbles(p.x, p.y, 6);
  return true;
}

// ---------------- 鲨鱼 ----------------
export function initSharks() {
  S.entities.sharks = [];
  S.sharkTimer = 85; // 开局宽限期，先熟悉打捞
}
export function updateSharks(dt) {
  const sh = S.entities.sharks;
  // 每 5 天：深渊巨鲨
  if (S.time.day >= 5 && S.time.day % 5 === 0 && S.lastBossDay !== S.time.day && S.time.frac > 0.3 && S.mode === 'play') {
    S.lastBossDay = S.time.day;
    const a = rand(0, 6.28);
    const boss = makeShark();
    Object.assign(boss, { x: Math.cos(a) * 560, y: Math.sin(a) * 560, hp: 14, boss: true, circT: rand(10, 16) });
    sh.push(boss);
    toast('⚠️ 海面下涌起巨大的阴影——深渊巨鲨出现了！', '🦈');
    sfx.thunder();
    S.shakeT = 0.5;
  }
  // 补充鲨鱼
  S.sharkTimer -= dt;
  const maxSharks = S.time.day >= 5 ? 2 : 1;
  if (S.sharkTimer <= 0 && sh.filter(s => !s.boss).length < maxSharks) {
    sh.push(makeShark());
    S.sharkTimer = CFG.sharkRespawn + rand(0, 40);
  }
  const p = S.player;
  for (const s of sh) {
    s.animT += dt;
    if (s.state === 'dead') { s.deadT -= dt; if (s.deadT <= 0) sh.splice(sh.indexOf(s), 1); continue; }
    if (s.state === 'flee') {
      s.x += Math.cos(s.fleeDir) * 260 * dt;
      s.y += Math.sin(s.fleeDir) * 260 * dt;
      s.fleeT -= dt;
      if (s.fleeT <= 0) s.state = 'circle';
      continue;
    }
    // 游泳的玩家 → 主动猎杀（海豚护航可吓阻）
    if (p.swimming && s.state !== 'lunge' && !dolphinNearPlayer(160)) s.state = 'hunt';
    if (s.state === 'circle') {
      s.circT -= dt;
      const a = s.animT * 0.5 + s.phase;
      const tx = Math.cos(a) * s.radius, ty = Math.sin(a) * s.radius * 0.8;
      s.x += (tx - s.x) * dt * 1.2; s.y += (ty - s.y) * dt * 1.2;
      s.dir = Math.atan2(ty - s.y || 0.01, tx - s.x || 0.01);
      if (s.circT <= 0 && !p.swimming) { s.state = 'approach'; s.target = pickEdgeTile(); s.warnT = s.boss ? 1.6 : 2.2; }
    } else if (s.state === 'approach') {
      s.warnT -= dt;
      if (!s.target || !S.raft.tiles.has(key(s.target.c, s.target.r))) { s.target = pickEdgeTile(); }
      if (s.target) {
        const tx = (s.target.c + 0.5) * TILE, ty = (s.target.r + 0.5) * TILE;
        s.dir = Math.atan2(ty - s.y, tx - s.x);
        s.x += Math.cos(s.dir) * (s.boss ? 150 : 120) * dt; s.y += Math.sin(s.dir) * (s.boss ? 150 : 120) * dt;
      }
      if (s.warnT <= 0 && s.target) { s.state = 'lunge'; s.lungeT = 0.55; sfx.sharkBite(); S.shakeT = 0.3; }
    } else if (s.state === 'lunge') {
      s.lungeT -= dt;
      s.x += Math.cos(s.dir) * (s.boss ? 380 : 330) * dt; s.y += Math.sin(s.dir) * (s.boss ? 380 : 330) * dt;
      if (s.lungeT <= 0) { doBite(s, s.boss ? 2 : 1); s.state = 'circle'; s.circT = s.boss ? rand(10, 18) : rand(24, 44); s.radius = rand(150, 250); }
    } else if (s.state === 'hunt') {
      s.dir = Math.atan2(p.y - s.y, p.x - s.x);
      s.x += Math.cos(s.dir) * (s.boss ? 185 : 150) * dt; s.y += Math.sin(s.dir) * (s.boss ? 185 : 150) * dt;
      if (dist(s.x, s.y, p.x, p.y) < 30) {
        bitePlayer(s);
        s.state = 'circle'; s.circT = rand(18, 30); s.radius = rand(180, 260);
      }
      if (!p.swimming) s.state = 'circle';
    }
  }
}
function makeShark() {
  const a = rand(0, Math.PI * 2);
  return {
    x: Math.cos(a) * 500, y: Math.sin(a) * 500, dir: 0,
    state: 'circle', circT: rand(20, 40), radius: rand(150, 250), phase: rand(0, 6.28),
    hp: CFG.sharkHp, warnT: 0, lungeT: 0, fleeT: 0, fleeDir: 0, deadT: 0, animT: rand(0, 6), target: null,
  };
}
function pickEdgeTile() {
  const edges = edgeTiles();
  if (!edges.length) return null;
  return edges[randi(0, edges.length - 1)];
}
function doBite(s, dmg = 1) {
  const t = s.target;
  if (!t) return;
  const tile = S.raft.tiles.get(key(t.c, t.r));
  if (!tile) return;
  if (tile.net || tile.armor) {
    toast('鲨鱼咬到了防护，悻悻而回！', '🦈');
    spawnSplash((t.c + 0.5) * TILE, (t.r + 0.5) * TILE, 8);
    return;
  }
  tile.hp -= dmg;
  spawnSplash((t.c + 0.5) * TILE, (t.r + 0.5) * TILE, 12);
  sfx.sharkBite();
  S.shakeT = 0.45;
  // 咬到玩家站的格子
  const p = S.player;
  if (!p.swimming && Math.floor(p.x / TILE) === t.c && Math.floor(p.y / TILE) === t.r) {
    damagePlayer(CFG.sharkBiteDmg, '鲨鱼咬了你！');
  }
  if (tile.hp <= 0) {
    if (tile.b) {
      const bdef = BUILDINGS[tile.b.type];
      if (bdef && bdef.decor) S.stats.beauty = Math.max(0, S.stats.beauty - (bdef.name === '吊椅' ? 2 : 1));
      toast(`${BUILDING_NAME(tile.b.type)}随地板被鲨鱼咬碎了！`, '💥');
      delete S.cooking[key(t.c, t.r)]; delete S.farmPlots[key(t.c, t.r)];
    }
    S.raft.tiles.delete(key(t.c, t.r));
    S.stats.tiles = S.raft.tiles.size;
    toast('一块地板被咬碎了！', '💥');
  } else {
    toast('鲨鱼咬坏了地板！', '🦈');
  }
}
function BUILDING_NAME(type) { return (ITEMS[type] && ITEMS[type].name) || '建筑'; }
function bitePlayer(s) {
  if (S.player.invul > 0) return;
  damagePlayer(CFG.sharkBiteDmg + 6, '鲨鱼袭击了你！快游回木筏！');
  // 击退到最近地板边缘
  const p = S.player;
  const edges = edgeTiles();
  if (edges.length) {
    const t = edges[randi(0, edges.length - 1)];
    p.x = (t.c + 0.5) * TILE; p.y = (t.r + 0.5) * TILE;
  }
}
export function hitShark(s, dmg = 1) {
  s.hp -= dmg;
  sfx.hit();
  spawnSplash(s.x, s.y, 6);
  if (s.hp <= 0) {
    s.state = 'dead'; s.deadT = 1.2;
    if (s.boss) {
      S.stats.bossKill++;
      addItem('shark_raw', 4, true);
      addItem('shark_tooth', 3, true);
      addItem('coin', 6, true);
      addItem('pearl', 2, true);
      if (Math.random() < 0.5) addItem('radio_part', 1, true);
      toast('击败了深渊巨鲨！海量战利品入包！', '🏆');
      grantXP(60);
      sfx.achv();
    } else {
      S.stats.sharkKill++;
      addItem('shark_raw', 2, true);
      addItem('shark_tooth', 1, true);
      toast('击败了鲨鱼！获得鲨鱼肉 ×2、鲨鱼牙 ×1', '🏆');
      grantXP(25);
      dailyProg('shark');
      sfx.achv();
    }
  } else if (!s.boss) {
    s.state = 'flee';
    s.fleeT = rand(14, 22);
    s.fleeDir = Math.atan2(s.y, s.x);
    S.stats.sharkFlee++;
    toast('鲨鱼被击退了！', '⚔️');
    grantXP(10);
    dailyProg('shark');
    sfx.sharkFlee();
  } else {
    spawnHitStar(s.x, s.y - 20);
    toast(`巨鲨受创！剩余生命 ${s.hp}/14`, '🩸');
  }
}
export function sharkNearPlayer(range = 64) {
  const p = S.player;
  for (const s of S.entities.sharks) {
    if (s.state !== 'dead' && dist(s.x, s.y, p.x, p.y) < range) return s;
  }
  return null;
}

// ---------------- 海鸥 ----------------
export function initGulls() { S.entities.gulls = []; S.gullTimer = 30; }
export function updateGulls(dt) {
  const night = S.time.frac > 0.78 || S.time.frac < 0.22;
  S.gullTimer -= dt;
  const farms = [];
  for (const t of S.raft.tiles.values()) {
    if (t.b && t.b.type === 'farm') {
      const f = S.farmPlots[key(t.c, t.r)];
      if (f && f.crop && !f.done) farms.push(t);
    }
  }
  if (S.gullTimer <= 0 && !night && farms.length && S.entities.gulls.length < 1) {
    S.gullTimer = rand(45, 90);
    const a = rand(0, 6.28);
    S.entities.gulls.push({ x: Math.cos(a) * 600, y: Math.sin(a) * 600, state: 'fly', t: 0, target: farms[randi(0, farms.length - 1)], alt: 120, dir: 0, bob: rand(0, 6) });
    sfx.gull();
  }
  for (const g of S.entities.gulls) {
    g.bob += dt * 3;
    if (g.state === 'fly') {
      const tx = (g.target.c + 0.5) * TILE, ty = (g.target.r + 0.5) * TILE;
      const d = dist(g.x, g.y, tx, ty);
      g.dir = Math.atan2(ty - g.y, tx - g.x);
      g.x += Math.cos(g.dir) * 140 * dt;
      g.y += Math.sin(g.dir) * 140 * dt;
      g.alt = 60 + Math.sin(g.bob) * 18;
      if (d < 40) {
        // 检查稻草人/营火
        let scared = false;
        for (const t of S.raft.tiles.values()) {
          if (t.b && (t.b.type === 'scarecrow' || t.b.type === 'campfire') &&
              Math.abs(t.c - g.target.c) <= 2 && Math.abs(t.r - g.target.r) <= 2) scared = true;
        }
        if (scared) { g.state = 'flee'; g.fleeT = 3; toast('稻草人吓退了海鸥！', '🎃'); }
        else { g.state = 'steal'; g.t = CFG.gullStealTime; sfx.gull(); }
      }
    } else if (g.state === 'steal') {
      g.t -= dt;
      g.alt = 26 + Math.sin(g.bob * 2) * 3;
      if (g.t <= 0) {
        const f = S.farmPlots[key(g.target.c, g.target.r)];
        if (f && f.crop && !f.done) {
          f.crop = null; f.t = 0;
          toast('海鸥偷走了你的作物！', '🐦');
          sfx.gull();
        }
        g.state = 'flee'; g.fleeT = 3;
      }
    } else if (g.state === 'flee') {
      g.fleeT -= dt;
      g.x += Math.cos(g.dir || 0.5) * 240 * dt;
      g.y += Math.sin(g.dir || 0.5) * 240 * dt;
      g.alt += 60 * dt;
      if (g.fleeT <= 0) g.done = true;
    }
  }
  S.entities.gulls = S.entities.gulls.filter(g => !g.done);
}
export function hitGull(g) {
  g.state = 'flee'; g.fleeT = 2.5;
  S.stats.gullShoo++;
  addItem('feather', 1, true);
  if (Math.random() < 0.6) addItem('egg', 1, true);
  toast('赶走了海鸥！掉落了羽毛' + (Math.random() < 0.6 ? '和鸟蛋' : ''), '🪶');
  sfx.hit();
}

// ---------------- 鱼群（装饰 + 钓鱼对象） ----------------
export function initFish() { S.entities.fish = []; }
export function updateFish(dt) {
  const want = 5;
  while (S.entities.fish.length < want) {
    const a = rand(0, 6.28), d = rand(120, 500);
    S.entities.fish.push({
      x: Math.cos(a) * d, y: Math.sin(a) * d, dir: rand(0, 6.28),
      spd: rand(14, 34), t: rand(2, 6), size: rand(0.7, 1.3), rare: Math.random() < 0.15,
    });
  }
  for (const f of S.entities.fish) {
    f.t -= dt;
    if (f.t <= 0) { f.t = rand(2, 6); f.dir += rand(-1.4, 1.4); }
    f.x += Math.cos(f.dir) * f.spd * dt;
    f.y += Math.sin(f.dir) * f.spd * dt;
    if (dist(f.x, f.y, 0, 0) > 620) f.dir = Math.atan2(-f.y, -f.x) + rand(-0.6, 0.6);
  }
}

// ---------------- 钩子 ----------------
export function throwHook(tx, ty) {
  const p = S.player;
  const d = dist(p.x, p.y, tx, ty);
  if (d > CFG.hookRange) { toast('太远了，够不着', '⚠️'); sfx.error(); return false; }
  if (isOnRaftPoint(tx, ty)) { sfx.error(); return false; }
  // 找目标漂流物
  let target = null, bd = 46;
  for (const f of S.entities.floaters) {
    const dd = dist(tx, ty, f.x, f.y);
    if (dd < bd) { bd = dd; target = f; }
  }
  S.hook = { sx: p.x, sy: p.y - 8, x: p.x, y: p.y - 8, tx, ty, phase: 'fly', target, t: 0 };
  sfx.hookOut();
  return true;
}
function isOnRaftPoint(x, y) { return !!tileAt(x, y); }
export function updateHook(dt) {
  const h = S.hook;
  if (!h) return;
  const speed = CFG.hookSpeed;
  if (h.phase === 'fly') {
    const d = dist(h.x, h.y, h.tx, h.ty);
    const step = speed * dt;
    if (d <= step) {
      h.x = h.tx; h.y = h.ty;
      if (h.target) { h.phase = 'reel'; sfx.splash(); spawnSplash(h.tx, h.ty, 7); }
      else { spawnSplash(h.tx, h.ty, 5); sfx.splash(); S.hook = null; }
    } else {
      h.x += (h.tx - h.x) / d * step;
      h.y += (h.ty - h.y) / d * step;
    }
  } else if (h.phase === 'reel') {
    const p = S.player;
    // 目标被拉向玩家
    if (h.target) {
      const f = h.target;
      f.x += (p.x - f.x) * dt * 3.2;
      f.y += (p.y - f.y) * dt * 3.2;
    }
    const d = dist(h.x, h.y, p.x, p.y);
    const step = speed * 1.15 * dt;
    if (d <= 26) {
      if (h.target) {
        const f = h.target;
        const i = S.entities.floaters.indexOf(f);
        if (i >= 0) {
          S.entities.floaters.splice(i, 1);
          let loot = floaterLoot(f.type);
          if (lucky()) { for (const k in loot) loot[k] *= 2; toast('🍀 幸运一钩，双倍收获！', '🍀'); }
          grantLoot(loot);
          if (f.type === 'bottle') import('./letters.js').then(m => m.grantLetter());
          grantXP(3);
          dailyProg('loot');
          sfx.hookGot();
        }
      }
      S.hook = null;
    } else {
      h.x += (p.x - h.x) / d * step;
      h.y += (p.y - h.y) / d * step;
    }
  }
}

// ---------------- 粒子 ----------------
export function spawnSplash(x, y, n = 8) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, 6.28), sp = rand(40, 150);
    S.entities.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 60, t: rand(0.4, 0.8), max: 0.8, kind: 'drop' });
  }
}
export function spawnBubbles(x, y, n = 5) {
  for (let i = 0; i < n; i++) {
    S.entities.bubbles.push({ x: x + rand(-8, 8), y: y + rand(-8, 8), vy: -rand(20, 45), t: rand(0.8, 1.6), r: rand(2, 4.5) });
  }
}
export function spawnHitStar(x, y) {
  for (let i = 0; i < 6; i++) {
    const a = rand(0, 6.28), sp = rand(60, 160);
    S.entities.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0.35, max: 0.35, kind: 'star' });
  }
}
export function updateParticles(dt) {
  for (const p of S.entities.parts) {
    p.t -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += (p.kind === 'drop' ? 300 : 60) * dt;
  }
  S.entities.parts = S.entities.parts.filter(p => p.t > 0);
  for (const b of S.entities.bubbles) {
    b.t -= dt; b.y += b.vy * dt; b.vy -= 8 * dt;
  }
  S.entities.bubbles = S.entities.bubbles.filter(b => b.t > 0);
}

// ---------------- 渲染 ----------------
export function drawUnder(ctx, t) {
  // 鱼影
  for (const f of S.entities.fish) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.dir);
    ctx.fillStyle = f.rare ? 'rgba(240,190,90,0.5)' : 'rgba(30,70,90,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 0, 13 * f.size, 5 * f.size, 0, 0, 6.29); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-11 * f.size, 0); ctx.lineTo(-17 * f.size, -4 * f.size); ctx.lineTo(-17 * f.size, 4 * f.size); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // 水下资源点
  for (const nd of S.underNodes) {
    if (nd.taken) continue;
    const def = UNDER_KINDS[nd.kind];
    const bob = Math.sin(t * 1.4 + nd.bob) * 2;
    ctx.save();
    ctx.translate(nd.x, nd.y + bob);
    ctx.globalAlpha = 0.85;
    if (nd.kind === 'seaweed') {
      ctx.strokeStyle = def.color; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(i * 5, 6);
        ctx.quadraticCurveTo(i * 5 + Math.sin(t * 2 + i) * 4, -6, i * 5 + Math.sin(t * 2 + i + 1) * 6, -16);
        ctx.stroke();
      }
    } else if (nd.kind === 'pearl') {
      ctx.fillStyle = '#C8B8D0';
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#F8F0F8';
      ctx.beginPath(); ctx.arc(0, -2, 4, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-1.4, -3.4, 1.3, 0, 6.29); ctx.fill();
    } else {
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.moveTo(-10, 6); ctx.lineTo(-6, -6); ctx.lineTo(4, -8); ctx.lineTo(10, 3); ctx.lineTo(4, 7);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.arc(-2, -3, 3, 0, 6.29); ctx.fill();
    }
    if (nd.kind === 'ore' || nd.kind === 'pearl') {
      ctx.strokeStyle = `rgba(255,220,100,${0.35 + 0.3 * Math.sin(t * 3)})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 13, 0, 6.29); ctx.stroke();
    }
    ctx.restore();
  }
}
export function drawOver(ctx, t) {
  // 幸存者（岛上挥手）
  if (S.survivor) {
    const sv = S.survivor;
    ctx.save();
    ctx.translate(sv.x, sv.y);
    ctx.fillStyle = 'rgba(30,50,60,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 12, 9, 3.5, 0, 0, 6.29); ctx.fill();
    const bob = Math.sin(t * 2.4) * 1.6;
    ctx.translate(0, bob);
    ctx.fillStyle = '#4A7A9A';
    ctx.beginPath(); ctx.roundRect(-6, -6, 12, 13, 4); ctx.fill();
    ctx.fillStyle = '#F2C9A0';
    ctx.beginPath(); ctx.arc(0, -11, 5.5, 0, 6.29); ctx.fill();
    // 挥手手臂
    const wa = sv.wave ? Math.sin(t * 10) * 0.7 - 2.2 : -0.6;
    ctx.strokeStyle = '#4A7A9A'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.save();
    ctx.translate(5, -3); ctx.rotate(wa);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -9); ctx.stroke();
    ctx.fillStyle = '#F2C9A0';
    ctx.beginPath(); ctx.arc(0, -10, 2.2, 0, 6.29); ctx.fill();
    ctx.restore();
    // 求救气泡
    ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(40,120,160,${0.6 + 0.4 * Math.sin(t * 4)})`;
    ctx.fillText('救命~!', 0, -24);
    ctx.restore();
  }
  // 船员（站筏上）
  for (let i = 0; i < S.crew.length; i++) {
    const c = S.crew[i];
    const sp = crewSlotPos(i);
    const cx = sp[0] * 48, cy = sp[1] * 48;
    const roleColor = c.role === 'fisher' ? '#3E8EA8' : c.role === 'deckhand' ? '#8A6B3B' : '#C05A4A';
    ctx.save();
    ctx.translate(cx, cy + Math.sin(t * 2 + i * 2) * 1.2);
    ctx.fillStyle = 'rgba(30,50,60,0.22)';
    ctx.beginPath(); ctx.ellipse(0, 12, 8.5, 3.4, 0, 0, 6.29); ctx.fill();
    ctx.fillStyle = roleColor;
    ctx.beginPath(); ctx.roundRect(-6, -6, 12, 13, 4); ctx.fill();
    ctx.fillStyle = '#F2C9A0';
    ctx.beginPath(); ctx.arc(0, -11, 5.5, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#3A3A4A';
    ctx.beginPath(); ctx.arc(-1.8, -11.5, 1, 0, 6.29); ctx.fill();
    ctx.beginPath(); ctx.arc(1.8, -11.5, 1, 0, 6.29); ctx.fill();
    ctx.font = '10px system-ui'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(60,60,80,0.85)';
    ctx.fillText(c.name + '·' + c.roleName, 0, -20);
    ctx.restore();
  }
  // 鲨鱼
  for (const s of S.entities.sharks) {
    ctx.save();
    ctx.translate(s.x, s.y);
    if (s.state === 'dead') {
      ctx.globalAlpha = Math.max(0, s.deadT / 1.2);
      ctx.rotate(0.6);
    }
    ctx.rotate(s.dir + Math.PI / 2);
    if (s.boss) ctx.scale(1.8, 1.8);
    const wig = Math.sin(s.animT * 8) * 0.25;
    // 身体阴影
    ctx.fillStyle = 'rgba(15,50,70,0.3)';
    ctx.beginPath(); ctx.ellipse(2, 4, 11, 22, 0, 0, 6.29); ctx.fill();
    // 身体
    ctx.fillStyle = s.state === 'dead' ? '#7A8A90' : s.boss ? '#3E5062' : '#5A7A8A';
    ctx.beginPath();
    ctx.moveTo(0, -26); ctx.quadraticCurveTo(12, -6, 9, 14);
    ctx.quadraticCurveTo(0, 20 + wig * 4, -9, 14);
    ctx.quadraticCurveTo(-12, -6, 0, -26);
    ctx.fill();
    // 背鳍
    ctx.beginPath(); ctx.moveTo(-2, -12); ctx.lineTo(0, -24); ctx.lineTo(6, -12); ctx.closePath(); ctx.fill();
    // 尾
    ctx.beginPath(); ctx.moveTo(0, 16); ctx.lineTo(-7 + wig * 6, 27); ctx.lineTo(7 + wig * 6, 27); ctx.closePath(); ctx.fill();
    if (s.boss) {
      ctx.fillStyle = '#FF4030';
      ctx.beginPath(); ctx.arc(-2.5, -16, 2, 0, 6.29); ctx.fill();
      ctx.fillStyle = 'rgba(255,60,40,0.25)';
      ctx.beginPath(); ctx.arc(0, -14, 7 + Math.sin(s.animT * 5) * 2, 0, 6.29); ctx.fill();
    }
    // 警示
    if (s.state === 'approach') {
      ctx.rotate(-s.dir - Math.PI / 2);
      ctx.font = 'bold 17px system-ui'; ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(230,60,50,${0.6 + 0.4 * Math.sin(t * 10)})`;
      ctx.fillText('!', 0, -36);
      ctx.font = '11px system-ui';
      ctx.fillStyle = 'rgba(230,60,50,0.9)';
      ctx.fillText('要咬这里！', 0, -52);
    }
    if (s.state === 'hunt') {
      ctx.rotate(-s.dir - Math.PI / 2);
      ctx.font = 'bold 15px system-ui'; ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(230,60,50,${0.6 + 0.4 * Math.sin(t * 12)})`;
      ctx.fillText('🦈!', 0, -36);
    }
    ctx.restore();
  }
  // 海鸥
  for (const g of S.entities.gulls) {
    ctx.save();
    ctx.translate(g.x, g.y - g.alt);
    // 地面影
    ctx.fillStyle = 'rgba(20,60,80,0.2)';
    ctx.beginPath(); ctx.ellipse(0, g.alt, 7, 3, 0, 0, 6.29); ctx.fill();
    const flap = Math.sin(g.bob * 4) * 0.5;
    ctx.fillStyle = '#F4F6F8';
    ctx.beginPath(); ctx.ellipse(0, 0, 9, 5, 0, 0, 6.29); ctx.fill();
    ctx.strokeStyle = '#E2E8EC'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-4, -1); ctx.quadraticCurveTo(-11, -6 - flap * 8, -17, -2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, -1); ctx.quadraticCurveTo(11, -6 - flap * 8, 17, -2); ctx.stroke();
    ctx.fillStyle = '#5A6270'; ctx.beginPath(); ctx.arc(7, -1, 2.6, 0, 6.29); ctx.fill();
    if (g.state === 'steal') {
      ctx.strokeStyle = `rgba(230,60,50,${0.5 + 0.4 * Math.sin(t * 8)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, 16, 0, 6.29 * (g.t / CFG.gullStealTime)); ctx.stroke();
      ctx.font = '10px system-ui'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(230,60,50,0.95)';
      ctx.fillText('在偷菜！打它！', 0, -14);
    }
    ctx.restore();
  }
  // 钩子与绳
  if (S.hook) {
    const h = S.hook, p = S.player;
    ctx.strokeStyle = 'rgba(90,70,40,0.8)';
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(p.x, p.y - 8);
    ctx.quadraticCurveTo((p.x + h.x) / 2, (p.y + h.y) / 2 - 24, h.x, h.y);
    ctx.stroke();
    ctx.fillStyle = '#C8D0D8';
    ctx.beginPath(); ctx.arc(h.x, h.y, 4.5, 0, 6.29); ctx.fill();
    ctx.strokeStyle = '#8A929C'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(h.x + 2, h.y + 4, 4, -0.5, 2.6); ctx.stroke();
  }
  // 粒子
  for (const p of S.entities.parts) {
    const a = p.t / p.max;
    ctx.globalAlpha = a;
    if (p.kind === 'drop') {
      ctx.fillStyle = '#CFF2F0';
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, 6.29); ctx.fill();
    } else {
      ctx.fillStyle = '#FFD54A';
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.t * 10);
      ctx.fillRect(-2.5, -2.5, 5, 5); ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  for (const b of S.entities.bubbles) {
    ctx.strokeStyle = 'rgba(230,250,255,0.7)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.29); ctx.stroke();
  }
}

// ================= 商筏 =================
export function updateMerchant(dt) {
  const m = S.entities.merchant;
  if (m) {
    m.life -= dt; m.bob += dt * 2;
    m.x += Math.cos(S.wind.dir + Math.PI) * 7 * dt;
    m.y += Math.sin(S.wind.dir + Math.PI) * 7 * dt;
    if (m.life <= 0) { S.entities.merchant = null; toast('商筏收帆远去了，江湖再见', '🛒'); }
  } else {
    S.merchantTimer -= dt;
    if (S.merchantTimer <= 0 && S.mode === 'play') {
      S.merchantTimer = rand(240, 340);
      spawnMerchant();
    }
  }
}
export function spawnMerchant() {
  const a = rand(0, 6.28);
  const pool = SHOP_STOCK.filter(s => !s.rare || Math.random() < 0.4);
  const stock = [...pool].sort(() => Math.random() - 0.5).slice(0, 5).map(s => ({ id: s.id, coin: s.coin }));
  S.entities.merchant = { x: Math.cos(a) * 280, y: Math.sin(a) * 280, life: 110, bob: 0, stock };
  toast('🛒 远方商筏到港！游过去看看货（限时停留）', '🛒');
  sfx.bell();
}

// ================= 海豚 =================
export function updateDolphin(dt) {
  const d = S.entities.dolphin;
  const p = S.player;
  if (d) {
    d.life -= dt; d.t += dt;
    if (p.swimming && dist(d.x, d.y, p.x, p.y) < 280) {
      const ang = d.t * 1.5;
      d.x += ((p.x + Math.cos(ang) * 48) - d.x) * dt * 2.4;
      d.y += ((p.y + Math.sin(ang) * 32) - d.y) * dt * 2.4;
      d.jump = Math.abs(Math.sin(d.t * 2.6));
      S.stats.dolphinTime += dt;
    } else {
      const a = d.t * 0.5;
      d.x += (Math.cos(a) * 190 - d.x) * dt * 0.8;
      d.y += (Math.sin(a) * 150 - d.y) * dt * 0.8;
      d.jump = Math.abs(Math.sin(d.t * 1.4)) * 0.6;
    }
    if (d.life <= 0) { S.entities.dolphin = null; toast('海豚跃入远方海面，后会有期', '🐬'); }
  } else {
    S.dolphinTimer -= dt;
    if (S.dolphinTimer <= 0 && S.time.day >= 2 && S.mode === 'play') {
      S.dolphinTimer = rand(280, 430);
      const a = rand(0, 6.28);
      S.entities.dolphin = { x: Math.cos(a) * 520, y: Math.sin(a) * 520, life: rand(70, 105), t: 0, jump: 0 };
      toast('🐬 一只海豚游了过来！潜水时它会护航（省氧气、吓鲨鱼）', '🐬');
      sfx.levelup();
    }
  }
}
export function dolphinNearPlayer(range = 150) {
  const d = S.entities.dolphin;
  if (!d) return false;
  return dist(d.x, d.y, S.player.x, S.player.y) < range;
}

// ================= 漩涡 =================
export function updateVortices(dt) {
  for (const v of S.entities.vortices) {
    v.life -= dt; v.t += dt;
    const d = dist(v.x, v.y, 0, 0);
    if (d > 250) { v.x -= v.x / d * 13 * dt; v.y -= v.y / d * 13 * dt; }
    const p = S.player;
    if (p.swimming && !v.looted && dist(p.x, p.y, v.x, v.y) < 44) {
      v.looted = true; v.life = Math.min(v.life, 2.5);
      S.stats.vortexLoot = 1;
      const loot = { coin: randi(4, 8), pearl: randi(1, 2) };
      if (Math.random() < 0.35) loot.map_frag = 1;
      grantLoot(loot, '漩涡宝藏');
      toast('从漩涡中心捞出了宝藏！', '🌀');
      sfx.chest();
      grantXP(30);
    } else if (p.swimming) {
      const pd = dist(p.x, p.y, v.x, v.y);
      if (pd < 120 && pd > 26) {
        p.x += (v.x - p.x) / pd * 26 * dt;
        p.y += (v.y - p.y) / pd * 26 * dt;
      }
    }
    // 木筏被卷入 → 绞地板
    if (dist(v.x, v.y, 0, 0) < v.r + 80) {
      v.dmgAcc = (v.dmgAcc || 0) + dt;
      if (v.dmgAcc >= 1.6) {
        v.dmgAcc = 0;
        const edges = edgeTiles();
        if (edges.length) {
          const t = edges[randi(0, edges.length - 1)];
          const tile = S.raft.tiles.get(key(t.c, t.r));
          if (tile && !tile.net && !tile.armor) {
            tile.hp--;
            spawnSplash((t.c + 0.5) * TILE, (t.r + 0.5) * TILE, 8);
            S.shakeT = 0.3;
            if (tile.hp <= 0) {
              if (tile.b) {
                const vb = BUILDINGS[tile.b.type];
                if (vb && vb.decor) S.stats.beauty = Math.max(0, S.stats.beauty - (vb.name === '吊椅' ? 2 : 1));
                delete S.cooking[key(t.c, t.r)]; delete S.farmPlots[key(t.c, t.r)];
              }
              S.raft.tiles.delete(key(t.c, t.r));
              S.stats.tiles = S.raft.tiles.size;
              toast('漩涡绞碎了一块地板！', '🌀');
            } else toast('漩涡在撕扯木筏！快逃离或抛锚', '🌀');
          }
        }
      }
    }
  }
  S.entities.vortices = S.entities.vortices.filter(v => v.life > 0);
  S.vortexTimer -= dt;
  if (S.vortexTimer <= 0 && S.mode === 'play') {
    S.vortexTimer = rand(280, 430);
    if (Math.random() < 0.7) {
      const a = rand(0, 6.28), dd = rand(400, 540);
      S.entities.vortices.push({ x: Math.cos(a) * dd, y: Math.sin(a) * dd, r: 90, life: rand(95, 130), t: 0, looted: false });
      toast('前方海面出现巨大漩涡！潜到中心有宝藏，但也危险', '🌀');
      sfx.thunder();
    }
  }
}

// ================= 沉船 =================
export function updateWrecks(dt) {
  S.wreckTimer -= dt;
  if (S.wreckTimer <= 0 && S.mode === 'play') {
    S.wreckTimer = rand(240, 380);
    const a = rand(0, 6.28), d = rand(280, 480);
    const w = { x: Math.cos(a) * d, y: Math.sin(a) * d, rot: rand(0, 6.28), t: 0, nodes: [], done: false, fade: 0 };
    const lootPool = [
      { scrap: 3 }, { plastic: 2 }, { bolt: 1 }, { coin: 2 },
      { scrap: 2, nail: 2 }, { coin: 3, glass: 1 }, { brick: 2 },
    ];
    for (let i = 0; i < 3; i++) {
      const off = rand(0, 6.28), dd = rand(0, 36);
      w.nodes.push({ x: w.x + Math.cos(off) * dd, y: w.y + Math.sin(off) * dd, loot: { ...lootPool[randi(0, lootPool.length - 1)] }, taken: false });
    }
    if (Math.random() < 0.3) w.nodes.push({ x: w.x, y: w.y - 20, loot: { map_frag: 1 }, taken: false });
    S.entities.wrecks.push(w);
    toast('探测到海底沉船残骸！潜水搜刮能有惊喜', '🚢');
  }
  for (const w of S.entities.wrecks) {
    w.t += dt;
    if (!w.done && w.nodes.every(n => n.taken)) {
      w.done = true; w.fade = 3;
      S.stats.wrecks = 1;
      toast('沉船搜刮一空！', '🚢');
      grantXP(20);
    }
    if (w.done) w.fade -= dt;
  }
  S.entities.wrecks = S.entities.wrecks.filter(w => !w.done || w.fade > 0);
}
export function tryTakeWreckNode() {
  const p = S.player;
  for (const w of S.entities.wrecks) {
    for (const n of w.nodes) {
      if (n.taken) continue;
      if (dist(p.x, p.y, n.x, n.y) < 46) {
        n.taken = true;
        let loot = { ...n.loot };
        if (lucky()) { for (const k in loot) loot[k] *= 2; toast('🍀 幸运搜刮，双倍！', '🍀'); }
        grantLoot(loot, '沉船搜得');
        grantXP(6);
        sfx.pickup();
        spawnBubbles(p.x, p.y, 5);
        return true;
      }
    }
  }
  return false;
}

// ================= 幸存者 & 船员 =================
const CREW_SLOTS = [[0.62, 0.62], [-0.62, 0.62], [0.62, -0.62]]; // 木筏中心附近的站位（格坐标偏移）

// 站位校验：所在地板被咬碎时退回中心板（中心 3x3 永久保留）
export function crewSlotPos(i) {
  const c = S.crew[i];
  if (!c) return CREW_SLOTS[0];
  const cc = Math.floor(c.slot[0]), rr = Math.floor(c.slot[1]);
  if (S.raft.tiles.has(cc + ',' + rr) || S.raft.tiles.has(Math.floor(c.slot[0]) + ',' + Math.floor(c.slot[1]))) return c.slot;
  return [0.31, 0.31];
}

export function updateSurvivor(dt) {
  const sv = S.survivor;
  if (sv) {
    sv.t = (sv.t || 0) + dt;
    sv.wave = Math.sin((sv.t || 0) * 4) > 0.4;
  } else {
    S.survivorTimer -= dt;
    if (S.survivorTimer <= 0 && S.mode === 'play' && S.time.day >= 2 && S.crew.length < 3) {
      S.survivorTimer = rand(260, 400);
      const cands = S.islands.filter(i => i.type !== 'lighthouse' && dist(0, 0, i.x, i.y) < 2800);
      if (cands.length) {
        const isl = cands[randi(0, cands.length - 1)];
        const a = rand(0, 6.28);
        S.survivor = { x: isl.x + Math.cos(a) * isl.r * 0.5, y: isl.y + Math.sin(a) * isl.r * 0.5, island: isl.id, t: 0, wave: true };
        toast('🏝️ 附近岛屿上似乎有人在挥手求救！游过去看看', '🙋');
        sfx.bell();
      }
    }
    return;
  }
  // 超时漂走
  if (sv.t > 240) { S.survivor = null; S.survivorTimer = rand(150, 260); toast('求救的人等不及，乘木筏漂走了…', '💭'); }
}
export function tryRecruit() {
  const sv = S.survivor;
  if (!sv) return false;
  const p = S.player;
  if (dist(p.x, p.y, sv.x, sv.y) > 70) return false;
  if (S.crew.length >= 3) { toast('船员已满员（3人）', '⚠️'); return true; }
  const used = S.crew.map(c => c.name);
  const pool = CREW_NAMES.filter(n => !used.includes(n));
  const name = pool[randi(0, pool.length - 1)] || ('船员' + (S.crew.length + 1));
  const role = CREW_ROLES[S.crew.length];
  const slot = CREW_SLOTS[S.crew.length];
  S.crew.push({ name, role: role.id, roleName: role.name, t: role.period * 0.5, slot });
  S.survivor = null;
  S.survivorTimer = rand(280, 420);
  S.stats.crewRescued++;
  grantXP(25);
  toast(`🙋 救起了幸存者【${name}】！他成了你的${role.name}——${role.desc}`, '🎉');
  sfx.achv();
  return true;
}
export function updateCrew(dt) {
  for (const c of S.crew) {
    c.t += dt;
    const role = CREW_ROLES.find(r => r.id === c.role);
    if (!role || c.t < role.period) continue;
    c.t = 0;
    if (c.role === 'fisher') {
      const fishIds = ['fish_sardine', 'fish_mackerel', 'fish_grouper'];
      const id = fishIds[randi(0, Math.random() < 0.2 ? 2 : 1)];
      addItem(id, 1, true);
      toast(`🎣 船员${c.name}（渔手）钓到了一条 ${ITEMS[id].name}`, '🎣');
      grantXP(4);
    } else if (c.role === 'deckhand') {
      const pool = [['wood', 2], ['plastic', 2], ['palm_leaf', 2], ['scrap', 1]];
      const [id, n] = pool[randi(0, pool.length - 1)];
      addItem(id, randi(1, n), true);
      toast(`🪝 船员${c.name}（杂工）捞回了些物资`, '🪝');
      grantXP(3);
    } else if (c.role === 'cook') {
      // 自动烤鱼：有生鱼且熟鱼不囤积过多
      let rawId = null;
      for (const fid of ['fish_sword', 'fish_tuna', 'fish_grouper', 'fish_mackerel', 'fish_sardine', 'fish_lantern']) {
        if (countItem(fid) > 0) { rawId = fid; break; }
      }
      if (rawId && countItem('fish_cooked') < 10) {
        removeItem(rawId, 1);
        addItem('fish_cooked', 1, true);
        toast(`🍢 船员${c.name}（厨师）烤好了一条鱼`, '🍢');
        grantXP(3);
      }
    }
  }
}

// ================= 观鲸 =================
export function updateWhale(dt) {
  S.whaleTimer -= dt;
  const w = S.whale;
  if (w) {
    w.t += dt; w.x += w.vx * dt;
    w.spoutT -= dt;
    if (w.spoutT <= 0) { w.spoutT = 2.6; spawnSplash(w.x - w.vx * 0.4, w.y, 5); }
    if (!w.seen && dist(w.x, w.y, 0, 0) < 640) {
      w.seen = true;
      S.stats.whale = 1;
      grantXP(15);
      toast('🐋 一头巨鲸浮出海面喷水，正好被你看见！', '🐋');
      sfx.levelup();
    }
    if (w.t > 34) S.whale = null;
  } else if (S.whaleTimer <= 0 && S.mode === 'play') {
    S.whaleTimer = rand(260, 420);
    if (Math.random() < 0.6) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      S.whale = { x: -dir * 720, y: rand(-360, 360), vx: dir * rand(38, 55), t: 0, spoutT: 1, seen: false };
      toast('远处海面似乎有什么巨大的东西在移动…', '🐋');
    }
  }
}

// ================= 克拉肯 =================
export function updateKraken(dt) {
  // 每 7 天（首次第 10 天）触发
  if (!S.kraken && S.mode === 'play' && S.time.day >= S.krakenTimerDay) {
    spawnKraken();
  }
  const K = S.kraken;
  if (!K) return;
  K.t += dt;
  const p = S.player;
  let alive = 0;
  for (const tn of K.tentacles) {
    if (tn.hp <= 0) { tn.deadT = (tn.deadT || 0) + dt; continue; }
    alive++;
    tn.t += dt;
    tn.sway = Math.sin(tn.t * 2 + tn.phase) * 8;
    if (tn.state === 'rise') {
      tn.rise = Math.min(1, tn.rise + dt * 0.9);
      if (tn.rise >= 1) { tn.state = 'hunt'; tn.atkT = rand(1.5, 3); }
    } else if (tn.state === 'hunt') {
      tn.atkT -= dt;
      // 微微追踪玩家
      const d = dist(tn.x, tn.y, p.x, p.y);
      if (d > 130) {
        tn.x += (p.x - tn.x) / d * 26 * dt;
        tn.y += (p.y - tn.y) / d * 26 * dt;
      }
      if (tn.atkT <= 0) { tn.state = 'slam'; tn.slamT = 0.6; sfx.splash(); }
    } else if (tn.state === 'slam') {
      tn.slamT -= dt;
      if (tn.slamT <= 0) {
        // 落点判定：砸玩家 / 砸边缘地板
        const d = dist(tn.x, tn.y, p.x, p.y);
        if (d < 46) {
          damagePlayer(14, '被触手拍进了海里！');
          p.swimming = true;
          p.x += (p.x - tn.x) / (d || 1) * 30;
          p.y += (p.y - tn.y) / (d || 1) * 30;
          p._climbCd = 1.2;
        } else {
          const t = tileAt(tn.x, tn.y);
          if (t && !t.net && !t.armor) {
            t.hp--;
            spawnSplash(tn.x, tn.y, 10);
            S.shakeT = 0.35;
            if (t.hp <= 0) {
              if (t.b) {
                const kb = BUILDINGS[t.b.type];
                if (kb && kb.decor) S.stats.beauty = Math.max(0, S.stats.beauty - (kb.name === '吊椅' ? 2 : 1));
                delete S.cooking[t.c + ',' + t.r]; delete S.farmPlots[t.c + ',' + t.r];
              }
              S.raft.tiles.delete(t.c + ',' + t.r);
              S.stats.tiles = S.raft.tiles.size;
              toast('触手卷走了一块地板！', '🦑');
            }
          }
        }
        tn.state = 'hunt';
        tn.atkT = rand(2.2, 4);
      }
    }
  }
  if (alive === 0 && K.tentacles.length) {
    // 击退奖励
    S.kraken = null;
    S.krakenTimerDay = S.time.day + 7;
    S.stats.krakenKill++;
    const loot = { tentacle: randi(2, 3), pearl: randi(1, 2), coin: randi(6, 10) };
    if (Math.random() < 0.5) loot.map_frag = 1;
    grantLoot(loot, '克拉肯战利品');
    toast('触手尽数沉入海底——克拉肯被击退了！', '🏆');
    grantXP(80);
    sfx.achv();
    S.shakeT = 0.4;
  }
}
function spawnKraken() {
  S.krakenTimerDay = S.time.day + 7;
  const tentacles = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rand(-0.3, 0.3);
    const d = rand(120, 160);
    tentacles.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, hp: 4, state: 'rise', rise: 0, t: 0, atkT: 0, slamT: 0, phase: rand(0, 6), sway: 0, dir: a });
  }
  S.kraken = { tentacles, t: 0 };
  toast('⚠️ 海水泛起漩涡——克拉肯的触手从四面八方升起了！', '🦑');
  sfx.thunder();
  S.shakeT = 0.6;
}
export function hitTentacle(tn, dmg) {
  tn.hp -= dmg;
  sfx.hit();
  spawnSplash(tn.x, tn.y, 6);
  spawnHitStar(tn.x, tn.y - 20);
  if (tn.hp <= 0) {
    toast('斩断了一条触手！剩余 ' + S.kraken.tentacles.filter(t => t.hp > 0).length + ' 条', '⚔️');
    grantXP(15);
    sfx.sharkFlee();
  }
}
export function nearestTentacle(range = 90) {
  if (!S.kraken) return null;
  const p = S.player;
  let best = null, bd = range;
  for (const tn of S.kraken.tentacles) {
    if (tn.hp <= 0) continue;
    const d = dist(p.x, p.y, tn.x, tn.y);
    if (d < bd) { bd = d; best = tn; }
  }
  return best;
}

// ================= 新实体渲染 =================
export function drawNewUnder(ctx, t) {
  // 沉船
  for (const w of S.entities.wrecks) {
    ctx.save();
    ctx.translate(w.x, w.y);
    if (w.done) ctx.globalAlpha = Math.max(0, w.fade / 3) * 0.8;
    ctx.rotate(w.rot);
    // 船体
    ctx.fillStyle = '#5A4430';
    ctx.beginPath();
    ctx.moveTo(-42, 0); ctx.quadraticCurveTo(-20, 16, 24, 12); ctx.quadraticCurveTo(46, 8, 50, -4);
    ctx.lineTo(40, -12); ctx.quadraticCurveTo(0, -6, -34, -10);
    ctx.closePath(); ctx.fill();
    // 肋骨
    ctx.strokeStyle = 'rgba(30,22,14,0.8)'; ctx.lineWidth = 3;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(i * 15, -9); ctx.lineTo(i * 15 - 4, 11); ctx.stroke();
    }
    // 断桅
    ctx.strokeStyle = '#4A3828'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(6, -8); ctx.lineTo(16, -34); ctx.stroke();
    // 破洞
    ctx.fillStyle = 'rgba(20,40,55,0.85)';
    ctx.beginPath(); ctx.ellipse(-14, 2, 10, 6, 0.3, 0, 6.29); ctx.fill();
    ctx.restore();
    // 搜刮点标记
    for (const n of w.nodes) {
      if (n.taken) continue;
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.globalAlpha = 0.6 + 0.35 * Math.sin(t * 3 + n.x);
      ctx.strokeStyle = '#FFD54A'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, 6.29); ctx.stroke();
      ctx.font = '10px system-ui'; ctx.textAlign = 'center';
      ctx.fillStyle = '#FFD54A';
      ctx.fillText('✦', 0, 3.5);
      ctx.restore();
    }
  }
}
export function drawNewOver(ctx, t) {
  // 克拉肯触手（最底层画）
  const K = S.kraken;
  if (K) {
    // 警示圈
    ctx.save();
    ctx.strokeStyle = `rgba(180,60,180,${0.25 + 0.15 * Math.sin(t * 3)})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 10]);
    ctx.beginPath(); ctx.arc(0, 0, 210, 0, 6.29); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    for (const tn of K.tentacles) {
      ctx.save();
      ctx.translate(tn.x, tn.y);
      if (tn.hp <= 0) {
        ctx.globalAlpha = Math.max(0, 1 - (tn.deadT || 0) / 1.5);
        ctx.rotate((tn.deadT || 0) * 1.2);
      }
      const rise = tn.state === 'rise' ? tn.rise : 1;
      const len = 46 * rise;
      // 触手主体（弯曲锥形）
      const dx = Math.cos(tn.dir), dy = Math.sin(tn.dir);
      ctx.fillStyle = tn.hp <= 0 ? '#5A4A6A' : '#6A4A8A';
      ctx.beginPath();
      ctx.moveTo(-dy * 13, dx * 13);
      ctx.quadraticCurveTo(-dy * 10 + dx * len * 0.5, dx * 10 + dy * len * 0.5 + tn.sway, dx * len + tn.sway, dy * len - rise * 26);
      ctx.quadraticCurveTo(dy * 10 + dx * len * 0.5, -dx * 10 + dy * len * 0.5 + tn.sway, dy * -13, dx * -13);
      ctx.closePath(); ctx.fill();
      // 吸盘
      ctx.fillStyle = 'rgba(230,180,255,0.55)';
      for (let i = 1; i <= 3; i++) {
        const px = dx * len * i / 3.4, py = dy * len * i / 3.4 + tn.sway * i / 3;
        ctx.beginPath(); ctx.arc(px - dy * 5, py + dx * 5, 3.2 - i * 0.5, 0, 6.29); ctx.fill();
      }
      // 尖端
      if (tn.hp > 0 && rise >= 1) {
        ctx.fillStyle = '#B46AE8';
        ctx.beginPath(); ctx.arc(dx * len + tn.sway, dy * len - rise * 26, 6, 0, 6.29); ctx.fill();
        ctx.fillStyle = '#3A2A4A';
        ctx.beginPath(); ctx.arc(dx * len + tn.sway - 1.5, dy * len - rise * 26 - 1.5, 2, 0, 6.29); ctx.fill();
      }
      // 血条
      if (tn.hp > 0 && rise >= 1) {
        ctx.fillStyle = 'rgba(20,40,50,0.6)';
        ctx.beginPath(); ctx.roundRect(-16, -44, 32, 6, 3); ctx.fill();
        ctx.fillStyle = '#C05AE8';
        ctx.beginPath(); ctx.roundRect(-15, -43, 30 * (tn.hp / 4), 4, 2); ctx.fill();
      }
      ctx.restore();
    }
  }
  // 鲸鱼（在漩涡/海豚之下先画）
  const wh = S.whale;
  if (wh) {
    ctx.save();
    ctx.translate(wh.x, wh.y);
    const bob = Math.sin(wh.t * 1.1) * 6;
    ctx.fillStyle = 'rgba(30,60,90,0.22)';
    ctx.beginPath(); ctx.ellipse(0, 10, 92, 22, 0, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#3E5A78';
    ctx.beginPath(); ctx.ellipse(0, bob, 88, 22, 0, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.moveTo(70, bob - 2); ctx.quadraticCurveTo(96, bob - 16, 106, bob - 4); ctx.lineTo(94, bob + 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(220,235,245,0.5)';
    ctx.beginPath(); ctx.ellipse(-10, bob - 6, 34, 7, 0.1, 0, 6.29); ctx.fill();
    if (wh.spoutT > 2.0) {
      ctx.strokeStyle = 'rgba(240,250,255,0.85)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(30, bob - 18);
        ctx.quadraticCurveTo(30 + i * 10, bob - 36, 30 + i * 17, bob - 46);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  // 漩涡
  for (const v of S.entities.vortices) {
    ctx.save();
    ctx.translate(v.x, v.y);
    if (v.life < 3) ctx.globalAlpha = Math.max(0, v.life / 3);
    const R = v.r;
    // 外圈泡沫
    ctx.strokeStyle = 'rgba(240,250,255,0.5)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, 6.29); ctx.stroke();
    // 旋转螺旋
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = i % 2 ? 'rgba(40,90,120,0.65)' : 'rgba(90,160,190,0.6)';
      ctx.lineWidth = 7 - i;
      ctx.beginPath();
      const a0 = v.t * (1.6 + i * 0.14) + i * 1.57;
      for (let a = 0; a < 5.2; a += 0.18) {
        const rr = 8 + (a / 5.2) * (R - 8);
        const x = Math.cos(a0 + a) * rr, y = Math.sin(a0 + a) * rr * 0.92;
        a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // 深心
    ctx.fillStyle = 'rgba(12,42,64,0.8)';
    ctx.beginPath(); ctx.arc(0, 0, 16 + Math.sin(v.t * 4) * 2, 0, 6.29); ctx.fill();
    if (!v.looted) {
      ctx.font = '13px system-ui'; ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255,215,90,${0.6 + 0.35 * Math.sin(t * 3)})`;
      ctx.fillText('💰', 0, -R - 10);
    }
    ctx.restore();
  }
  // 海豚
  const d = S.entities.dolphin;
  if (d) {
    ctx.save();
    ctx.translate(d.x, d.y - d.jump * 22);
    ctx.rotate(Math.atan2(S.player.y - d.y, S.player.x - d.x) * 0.15 - 0.1);
    const jump = d.jump;
    ctx.fillStyle = 'rgba(20,60,80,0.2)';
    ctx.beginPath(); ctx.ellipse(0, 14 + jump * 20, 16, 5, 0, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#7C9EB8';
    ctx.beginPath();
    ctx.moveTo(-20, 2); ctx.quadraticCurveTo(0, -12 - jump * 6, 22, -2 - jump * 4);
    ctx.quadraticCurveTo(8, 6, -20, 2);
    ctx.fill();
    ctx.fillStyle = '#E8F2F8';
    ctx.beginPath(); ctx.ellipse(-2, 1, 10, 4, 0.1, 0, 6.29); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-18, 1); ctx.lineTo(-27, -5); ctx.lineTo(-25, 4); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-2, -8 - jump * 3); ctx.lineTo(3, -16 - jump * 5); ctx.lineTo(7, -7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2A3A48';
    ctx.beginPath(); ctx.arc(17, -3, 1.8, 0, 6.29); ctx.fill();
    ctx.restore();
  }
  // 商筏
  const m = S.entities.merchant;
  if (m) {
    const bob = Math.sin(m.bob) * 2.5;
    ctx.save();
    ctx.translate(m.x, m.y + bob);
    // 泡沫
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(0, 4, 52, 26, 0, 0, 6.29); ctx.fill();
    // 筏体
    ctx.fillStyle = '#8A5A2E';
    ctx.beginPath(); ctx.roundRect(-46, -20, 92, 40, 8); ctx.fill();
    ctx.strokeStyle = '#6A4420'; ctx.lineWidth = 2;
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 13, -20); ctx.lineTo(i * 13, 20); ctx.stroke(); }
    // 货物
    ctx.fillStyle = '#C9A06A'; ctx.fillRect(-38, -14, 14, 12);
    ctx.fillStyle = '#B5834E'; ctx.fillRect(-22, -14, 12, 12);
    ctx.fillStyle = '#7FA8C9'; ctx.fillRect(-38, 2, 12, 10);
    // 遮阳棚
    ctx.fillStyle = '#E86A4A';
    ctx.beginPath(); ctx.moveTo(-16, -22); ctx.lineTo(16, -22); ctx.lineTo(24, -34); ctx.lineTo(-24, -34); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#5A3A1E'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-18, -22); ctx.lineTo(-18, -8); ctx.moveTo(18, -22); ctx.lineTo(18, -8); ctx.stroke();
    // 旗子
    ctx.strokeStyle = '#5A3A1E'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(40, -20); ctx.lineTo(40, -44); ctx.stroke();
    ctx.fillStyle = `rgba(255,215,80,${0.75 + 0.25 * Math.sin(m.bob * 3)})`;
    ctx.beginPath(); ctx.moveTo(40, -44); ctx.lineTo(58 + Math.sin(m.bob * 2) * 3, -39); ctx.lineTo(40, -33); ctx.closePath(); ctx.fill();
    // 商人
    ctx.font = '17px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('🧔', 0, -8);
    // 招牌
    ctx.fillStyle = 'rgba(252,248,238,0.92)';
    ctx.beginPath(); ctx.roundRect(-27, -64, 54, 20, 7); ctx.fill();
    ctx.strokeStyle = '#D8CBAA'; ctx.stroke();
    ctx.fillStyle = '#5A4A30'; ctx.font = 'bold 12px system-ui';
    ctx.fillText(`🛒 商筏 ${Math.ceil(m.life)}s`, 0, -50);
    ctx.restore();
  }
}
